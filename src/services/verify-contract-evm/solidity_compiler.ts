import {
  CompilerOutput,
  ISolidityCompiler,
  JsonInput,
} from '@ethereum-sourcify/lib-sourcify';
import { LoggerInstance } from 'moleculer';
import path from 'path';
import fs from 'fs';
import { exec, spawnSync } from 'child_process';
import semver from 'semver';
import { Worker, WorkerOptions } from 'worker_threads';
import config from '../../../config.json' assert { type: 'json' };

const HOST_SOLC_REPO = ' https://binaries.soliditylang.org/';

export class SolidityCompiler implements ISolidityCompiler {
  private _logger: LoggerInstance;

  constructor(logger: LoggerInstance) {
    this._logger = logger;
  }

  async compile(
    version: string,
    solcJsonInput: JsonInput,
    forceEmscripten = false
  ): Promise<CompilerOutput> {
    return this.useCompiler(version, solcJsonInput, forceEmscripten);
  }

  async useCompiler(
    version: string,
    solcJsonInput: JsonInput,
    forceEmscripten = false
  ): Promise<CompilerOutput> {
    // For nightly builds, Solidity version is saved as 0.8.17-ci.2022.8.9+commit.6b60524c instead of 0.8.17-nightly.2022.8.9+commit.6b60524c.
    // Not possible to retrieve compilers with "-ci.".
    if (version.includes('-ci.'))
      // eslint-disable-next-line no-param-reassign
      version = version.replace('-ci.', '-nightly.');
    const inputStringified = JSON.stringify(solcJsonInput);
    let compiled: string | undefined;

    const solcPlatform = this.findSolcPlatform();
    let solcPath;
    if (solcPlatform && !forceEmscripten) {
      solcPath = await this.getSolcExecutable(solcPlatform, version);
    }
    let startCompilation: number;
    if (solcPath && !forceEmscripten) {
      this._logger.debug(
        `Compiling with solc binary ${version} at ${solcPath}`
      );
      startCompilation = Date.now();
      try {
        compiled = await this.asyncExecSolc(inputStringified, solcPath);
      } catch (error: any) {
        if (error?.code === 'ENOBUFS') {
          throw new Error('Compilation output size too large');
        }
        this._logger.warn(error.message);
        throw error;
      }
    } else {
      const solJson = await this.getSolcJs(version);
      startCompilation = Date.now();
      this._logger.debug(`Compiling with solc-js ${version}`);
      if (solJson) {
        const coercedVersion =
          semver.coerce(new semver.SemVer(version))?.version ?? '';
        // Run Worker for solc versions < 0.4.0 for clean compiler context. See https://github.com/ethereum/sourcify/issues/1099
        if (semver.lt(coercedVersion, '0.4.0')) {
          compiled = await new Promise((resolve, reject) => {
            const worker = this.importWorker(
              path.resolve(__dirname, './compilerWorker.ts'),
              {
                workerData: { version, inputStringified },
              }
            );
            worker.once('message', (result) => {
              resolve(result);
            });
            worker.once('error', (error) => {
              reject(error);
            });
          });
        } else {
          compiled = solJson.compile(inputStringified);
        }
      }
    }

    const endCompilation = Date.now();
    this._logger.info(
      `Compilation time : ${endCompilation - startCompilation} ms`
    );

    if (!compiled) {
      throw new Error('Compilation failed. No output from the compiler.');
    }
    const compiledJSON = JSON.parse(compiled);
    const errorMessages = compiledJSON?.errors?.filter(
      (e: any) => e.severity === 'error'
    );
    if (errorMessages && errorMessages.length > 0) {
      const error = new Error(
        `Compiler error:\n ${JSON.stringify(errorMessages)}`
      );
      this._logger.error(error.message);
      throw error;
    }
    return compiledJSON;
  }

  findSolcPlatform(): string | false {
    if (process.platform === 'darwin' && process.arch === 'x64') {
      return 'macosx-amd64';
    }
    if (process.platform === 'linux' && process.arch === 'x64') {
      return 'linux-amd64';
    }
    if (process.platform === 'win32' && process.arch === 'x64') {
      return 'windows-amd64';
    }
    return false;
  }

  async getSolcExecutable(platform: string, version: string) {
    const fileName = `solc-${platform}-v${version}`;
    const repoPath =
      config.jobVerifyContractEVM.solcRepo || path.join('/tmp', 'solc-repo');
    const solcPath = path.join(repoPath, fileName);
    if (fs.existsSync(solcPath) && this.validateSolcPath(solcPath)) {
      this._logger.debug(
        `Found solc ${version} with platform ${platform} at ${solcPath}`
      );
      return solcPath;
    }

    this._logger.debug(
      `Downloading solc ${version} with platform ${platform} at ${solcPath}`
    );
    const success = await this.fetchAndSaveSolc(
      platform,
      solcPath,
      version,
      fileName
    );
    this._logger.debug(
      `Downloaded solc ${version} with platform ${platform} at ${solcPath}`
    );
    if (success && !this.validateSolcPath(solcPath)) {
      this._logger.error(`Cannot validate solc ${version}.`);
      return null;
    }
    return success ? solcPath : null;
  }

  validateSolcPath(solcPath: string): boolean {
    // TODO: Handle nodejs only dependencies
    const spawned = spawnSync(solcPath, ['--version']);
    if (spawned.status === 0) {
      return true;
    }

    const error =
      spawned?.error?.message ||
      spawned.stderr.toString() ||
      'Error running solc, are you on the right platoform? (e.g. x64 vs arm)';

    this._logger.warn(error);
    return false;
  }

  async fetchAndSaveSolc(
    platform: string,
    solcPath: string,
    version: string,
    fileName: string
  ): Promise<boolean> {
    const encodedURIFilename = encodeURIComponent(fileName);
    const githubSolcURI = `${HOST_SOLC_REPO}${platform}/${encodedURIFilename}`;
    this._logger.debug(
      `Fetching solc ${version} on platform ${platform}: ${githubSolcURI}`
    );
    let res = await this.fetchWithTimeout(githubSolcURI, { timeout: 10000 });
    let { status } = res;
    let buffer;

    // handle case in which the response is a link to another version
    if (status === 200) {
      buffer = await res.arrayBuffer();
      const responseText = Buffer.from(buffer).toString();
      if (
        /^([\w-]+)-v(\d+\.\d+\.\d+)\+commit\.([a-fA-F0-9]+).*$/.test(
          responseText
        )
      ) {
        const linkedGithubSolcURI = `${HOST_SOLC_REPO}${platform}/${responseText}`;
        res = await this.fetchWithTimeout(linkedGithubSolcURI, {
          timeout: 10000,
        });
        status = res.status;
        buffer = await res.arrayBuffer();
      }
    }

    if (status === 200 && buffer) {
      this._logger.debug(
        `Fetched solc ${version} on platform ${platform}: ${githubSolcURI}`
      );
      fs.mkdirSync(path.dirname(solcPath), { recursive: true });

      try {
        fs.unlinkSync(solcPath);
      } catch (e) {
        this._logger.error(e);
      }
      fs.writeFileSync(solcPath, new DataView(buffer), { mode: 0o755 });

      return true;
    }
    this._logger.warn(`Failed fetching solc ${version}: ${githubSolcURI}`);

    return false;
  }

  async fetchWithTimeout(resource: string, options: { timeout: number }) {
    const { timeout = 10000 } = options;

    const controller = new AbortController();
    const id = setTimeout(() => {
      this._logger.warn(
        `Aborting request ${resource} because of timout ${timeout}`
      );
      controller.abort();
    }, timeout);
    const response = await fetch(resource, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  }

  asyncExecSolc(inputStringified: string, solcPath: string): Promise<string> {
    // check if input is valid JSON. The input is untrusted and potentially cause arbitrary execution.
    JSON.parse(inputStringified);

    return new Promise((resolve, reject) => {
      const child = exec(
        `${solcPath} --standard-json`,
        {
          maxBuffer: 1000 * 1000 * 20,
        },
        (error, stdout, stderr) => {
          if (error) {
            reject(error);
          } else if (stderr) {
            reject(
              new Error(`Compiler process returned with errors:\n ${stderr}`)
            );
          } else {
            resolve(stdout);
          }
        }
      );
      if (!child.stdin) {
        throw new Error('No stdin on child process');
      }
      // Write input to child process's stdin
      child.stdin.write(inputStringified);
      child.stdin.end();
    });
  }

  async getSolcJs(version = 'latest'): Promise<any> {
    // /^\d+\.\d+\.\d+\+commit\.[a-f0-9]{8}$/
    // eslint-disable-next-line no-param-reassign
    version = version.trim();
    if (version !== 'latest' && !version.startsWith('v')) {
      // eslint-disable-next-line no-param-reassign
      version = `v${version}`;
    }

    const soljsonRepo =
      config.jobVerifyContractEVM.solcRepo || path.join('/tmp', 'soljson-repo');
    const fileName = `soljson-${version}.js`;
    const soljsonPath = path.resolve(soljsonRepo, fileName);

    if (!fs.existsSync(soljsonPath)) {
      if (
        !(await this.fetchAndSaveSolc('bin', soljsonPath, version, fileName))
      ) {
        return false;
      }
    }

    const solcjsImports = await import(soljsonPath);
    return solcjsImports;
    // return solc.setupMethods(solcjsImports);
  }

  importWorker(path: string, options: WorkerOptions) {
    const resolvedPath = require.resolve(path);
    return new Worker(resolvedPath, {
      ...options,
      execArgv: /\.ts$/.test(resolvedPath)
        ? ['--require', 'ts-node/register']
        : undefined,
    });
  }
}
