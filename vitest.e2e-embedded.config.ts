/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

/**
 * E2E测试转换为内嵌数据库集成测试配置
 * 将原有的 Playwright E2E 测试转换为使用内嵌 SurrealDB 的集成测试
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
    dedupe: [
      "react",
      "react-dom",
      "@emotion/react",
      "@emotion/styled",
      "react-i18next",
    ],
  },
  optimizeDeps: {
    exclude: ["@surrealdb/node"],
  },
  ssr: {
    external: ["@surrealdb/node"],
  },
  // 设置测试模式
  mode: "test",
  test: {
    // Vitest 配置 - E2E测试使用内嵌数据库
    globals: true,
    environment: "jsdom",

    // 包含转换后的E2E测试文件
    include: [
      "tests/e2e-embedded/basic-database.test.tsx", // 基础数据库功能测试
      "tests/e2e-embedded/auth.test.tsx", // 认证流程测试
      "tests/e2e-embedded/cases.test.tsx", // 案件管理测试
      "tests/e2e-embedded/admin.test.tsx", // 管理员功能测试
      "tests/e2e-embedded/full-workflow.test.tsx", // 完整业务流程测试
    ],

    setupFiles: ["./tests/setup-embedded-db.ts"], // 使用内嵌数据库设置

    // E2E测试需要更长的超时时间
    testTimeout: 30000, // 30秒，E2E测试需要更多时间
    hookTimeout: 15000, // 15秒钩子超时

    // 使用单线程确保测试顺序和数据一致性
    pool: "threads",
    poolOptions: {
      threads: {
        singleThread: true,
        isolate: false,
        useAtomics: false,
        maxThreads: 1,
        minThreads: 1,
      },
    },

    // 确保测试按顺序执行
    maxConcurrency: 1,
    sequence: {
      shuffle: false,
      concurrent: false,
    },

    // 详细输出用于调试
    logHeapUsage: false,
    silent: false,
    reporters: ["default"],

    // 输出测试结果
    outputFile: {
      json: "./test-results/e2e-embedded-results.json",
    },

    // 排除其他测试
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.{idea,git,cache,output,temp}/**",
      "**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*",
      "e2e/**", // 排除原始 E2E 测试
      "tests/unit/**/*.test.{ts,tsx}", // 排除单元测试
      "tests/integration/**/*.test.{ts,tsx}", // 排除集成测试
    ],

    // 环境变量
    env: {
      NODE_ENV: "test",
      VITE_NODE_ENV: "test",
      NODE_OPTIONS: "--max-old-space-size=8192", // 增加到8GB内存
    },
  },
});
