/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: 'ts-jest/presets/default-esm',
  globals: {
    'ts-jest': {
      useESM: true,
    },
  },
  testEnvironment: 'node',

  moduleDirectories: ['node_modules', 'src'],
  transform: {
    '\\.tsx?$': 'ts-jest',
  },
  testTimeout: 1000 * 1000,
};