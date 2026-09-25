"use strict";

const nextJestModule = require("next/jest");
const nextJest = nextJestModule.default ?? nextJestModule;
const sharedConfig = require("@acme/config/jest/next-app");

const createJestConfig = nextJest({ dir: "./" });
module.exports = createJestConfig(sharedConfig);
