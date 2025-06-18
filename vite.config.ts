/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react'; // Standard Vite React plugin
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({ // Use the extended type
  plugins: [react()], // Added react plugin, common for Vite React projects
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    }
  },
  optimizeDeps: {
    include: ['@mui/material', '@mui/icons-material'],
    exclude: ['@mui/icons-material/esm']
  },
  server: {
    fs: {
      strict: false
    }
  },
  test: { // Vitest configuration
    globals: true,
    environment: 'jsdom', // Common for React component testing
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    setupFiles: './tests/setup.ts', // Setup file for test environment
    testTimeout: 10000, // 10 seconds timeout for each test
    pool: 'forks', // Use forks pool to avoid file handle issues
    poolOptions: {
      forks: {
        singleFork: true // Use single fork to reduce resource usage
      }
    },
    exclude: [ // Default Vitest excludes + e2e
      '**/node_modules/**',
      '**/dist/**',
      '**/cypress/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*',
      'e2e/**' // Exclude E2E tests from unit test runner
    ],
  }
});
