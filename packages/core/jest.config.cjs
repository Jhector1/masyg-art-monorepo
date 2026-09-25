"use strict";

/**
 * Package-local Jest config for @acme/core.
 *
 * Core is not a Next app, so its tests use SWC directly rather than borrowing
 * a storefront's next/jest configuration.
 */
module.exports = {
  rootDir: __dirname,
  clearMocks: true,
  restoreMocks: true,
  testEnvironment: "jsdom",
  testMatch: [
    "<rootDir>/src/**/__tests__/**/*.[jt]s?(x)",
    "<rootDir>/src/**/*.(spec|test).[jt]s?(x)",
  ],
  testPathIgnorePatterns: ["/node_modules/", "/.next/"],
  modulePathIgnorePatterns: ["<rootDir>/.next/"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@acme/core$": "<rootDir>/src/index.ts",
    "^@acme/core/(.*)$": "<rootDir>/src/$1",
  },
  transform: {
    "^.+\\.[jt]sx?$": [
      "@swc/jest",
      {
        jsc: {
          parser: {
            syntax: "typescript",
            tsx: true,
            decorators: false,
            dynamicImport: true,
          },
          transform: {
            react: {
              runtime: "automatic",
            },
          },
          target: "es2022",
        },
        module: {
          type: "commonjs",
        },
      },
    ],
  },
};
