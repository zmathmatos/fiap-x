const base = {
  preset: 'ts-jest',
  testEnvironment: 'node',
};

module.exports = {
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/index.ts',
    '!src/server.ts',
    '!src/container.ts',
    '!src/infrastructure/database/migrations/**',
  ],
  coverageThreshold: {
    global: { branches: 80, functions: 80, lines: 80, statements: 80 },
  },
  projects: [
    {
      ...base,
      displayName: 'unit',
      roots: ['<rootDir>/tests'],
      testMatch: ['**/tests/**/*.test.ts'],
      testPathIgnorePatterns: ['/tests/integration/'],
    },
    {
      ...base,
      displayName: 'integration',
      roots: ['<rootDir>/tests'],
      testMatch: ['**/tests/integration/**/*.test.ts'],
      setupFilesAfterEnv: ['<rootDir>/tests/integration/setup.ts'],
    },
  ],
};
