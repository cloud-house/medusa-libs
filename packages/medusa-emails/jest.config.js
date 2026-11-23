module.exports = {
  transform: {
    '^.+\\.[jt]sx?$': [
      '@swc/jest',
      { jsc: { parser: { syntax: 'typescript', tsx: true, decorators: true } } },
    ],
  },
  testEnvironment: 'node',
  moduleFileExtensions: ['js', 'ts', 'tsx', 'json'],
  modulePathIgnorePatterns: ['dist/', '<rootDir>/.medusa/'],
  setupFiles: ['./jest.setup.js'],
}

if (process.env.TEST_TYPE === 'integration:modules') {
  module.exports.testMatch = ['**/src/modules/*/__tests__/**/*.spec.[jt]s']
} else if (process.env.TEST_TYPE === 'unit') {
  module.exports.testMatch = ['**/src/**/__tests__/**/*.unit.spec.[jt]s?(x)']
}
