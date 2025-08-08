/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    // Vitest configuration for integration tests
    globals: true,
    environment: "jsdom",

    // Include only integration tests
    include: [
      "tests/unit/**/*.integration.test.{ts,tsx}",
      "tests/integration/**/*.test.{ts,tsx}",
    ],

    setupFiles: "./tests/setup.ts",

    // Longer timeouts for integration tests
    testTimeout: 30000, // 30 seconds
    hookTimeout: 15000, // 15 seconds

    // Use threads but with lower concurrency for stability
    pool: "threads",
    poolOptions: {
      threads: {
        singleThread: false,
        isolate: true, // Enable isolation for integration tests
      },
    },

    // Lower concurrency for integration tests
    maxConcurrency: 2,
    minThreads: 1,
    maxThreads: 2,

    // Enable isolation for better test separation
    isolate: true,

    // Memory and performance settings
    logHeapUsage: true,
    silent: false,

    // Use detailed reporter for integration tests
    reporters: ["verbose"],

    // Coverage settings
    coverage: {
      enabled: true,
      reporter: ["text", "html"],
      exclude: [
        "**/node_modules/**",
        "**/dist/**",
        "**/*.test.{ts,tsx}",
        "tests/**",
        "e2e/**",
      ],
    },

    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/cypress/**",
      "**/.{idea,git,cache,output,temp}/**",
      "**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*",
      "e2e/**",
      "tests/unit/**/*.test.{ts,tsx}", // Exclude regular unit tests
    ],
  },
});
