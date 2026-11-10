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
  setupFiles: ['./integration-tests/setup.js'],
  testMatch: ['**/integration-tests/http/*.spec.[jt]s'],
}
