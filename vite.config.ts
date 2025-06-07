import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react'; // Standard Vite React plugin
import { UserConfig } from 'vitest/config'; // Import UserConfig for typing
import { fileURLToPath, URL } from 'node:url';

// Define a type that extends Vite's UserConfig with Vitest's test config
interface VitestConfig extends UserConfig {
  test: any; // Replace 'any' with more specific Vitest config types if available/needed
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const config: VitestConfig = { // Use the extended type
      plugins: [react()], // Added react plugin, common for Vite React projects
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
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
    };
    return config;
});
