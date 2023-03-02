/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: 'ts-jest/presets/js-with-ts',
  testEnvironment: 'node',
  runner: 'jest-light-runner',
  globalSetup: './test/config/globalSetup.ts',
  globalTeardown: './test/config/globalTeardown.ts',
};
