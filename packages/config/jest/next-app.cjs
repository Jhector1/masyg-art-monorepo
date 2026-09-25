"use strict";

/** Canonical Jest policy for Next.js app workspaces. */
module.exports = {
  coverageProvider: "v8",
  testEnvironment: "node",
  clearMocks: true,
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  modulePathIgnorePatterns: ["<rootDir>/.next/"],
  testPathIgnorePatterns: ["/node_modules/", "<rootDir>/.next/"],
  watchPathIgnorePatterns: ["<rootDir>/.next/"],
};
