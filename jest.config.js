/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: 'ts-jest/presets/js-with-ts',
  testEnvironment: 'node',
  runner: 'jest-light-runner',
  globalSetup: './test/config/global_setup.ts',
  globalTeardown: './test/config/global_teardown.ts',
};
