import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: [
      'tests/unit/components/messages/GroupInfoPanel.test.tsx',
      'tests/unit/components/call/VideoCallInterface.test.tsx'
    ],
    testTimeout: 5000,
    hookTimeout: 2000,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
        isolate: false
      }
    },
    maxConcurrency: 1,
    minThreads: 1,
    maxThreads: 1,
    coverage: {
      enabled: false
    },
    setupFiles: './tests/setup.ts',
  },
  resolve: {
    alias: {
      '@': '/home/runner/work/cuckoox-google/cuckoox-google',
    }
  },
});