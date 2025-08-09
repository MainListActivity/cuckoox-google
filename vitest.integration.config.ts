/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

/**
 * 集成测试配置 - 使用内嵌 SurrealDB
 * 合并了原来的 embedded 测试配置，所有集成测试都使用真实内嵌数据库
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
  // 设置测试模式以加载 .env.test
  mode: "test",
  test: {
    // Vitest 配置 - 集成测试使用内嵌数据库
    globals: true,
    environment: "jsdom",

    // 按顺序包含集成测试文件
    include: [
      "tests/integration/auth/01-admin-creation.test.tsx",
      "tests/integration/case/02-case-creation.test.tsx",
      "tests/integration/auth/03-manager-login.test.tsx",
      "tests/integration/case/04-case-query.test.tsx",
      "tests/integration/case/05-case-member-addition.test.tsx",
      "tests/integration/claims/06-claims-management.test.tsx",
      "tests/integration/creditors/07-creditor-management.test.tsx",
      "tests/integration/documents/08-document-management.test.tsx",
      "tests/integration/pages/09-pages-integration.test.tsx",
      "tests/integration/auth/10-member-login.test.tsx",
      "tests/integration/auth/11-member-logout.test.tsx",
      "tests/**/*.embedded.test.{ts,tsx}", // 其他内嵌数据库测试
    ],

    setupFiles: ["./tests/setup-embedded-db.ts"], // 使用内嵌数据库设置

    // 更长的超时时间，因为需要初始化数据库
    testTimeout: 15000, // 15秒
    hookTimeout: 10000, // 10秒

    // 使用单线程以确保数据库操作的一致性和测试顺序
    pool: "threads",
    poolOptions: {
      threads: {
        singleThread: true, // 单线程模式确保数据库状态一致和测试顺序
        isolate: false, // 不隔离以保持数据共享
      },
    },

    // 设置为1确保测试按顺序执行
    maxConcurrency: 1,
    minThreads: 1,
    maxThreads: 1,

    // 确保测试按顺序执行
    sequence: {
      shuffle: false, // 不打乱测试顺序
      concurrent: false, // 不并发执行
    },

    // 详细输出用于调试数据库操作和测试顺序
    logHeapUsage: true,
    silent: false,

    // 使用详细报告器显示测试执行顺序
    reporters: ["verbose"],

    // 输出测试顺序信息
    outputFile: {
      json: "./test-results/integration-results.json",
    },

    // 排除常规单元测试和 E2E 测试
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.{idea,git,cache,output,temp}/**",
      "**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*",
      "e2e/**", // 排除 E2E 测试
      "tests/unit/**/*.test.{ts,tsx}", // 排除常规单元测试，避免冲突
    ],

    // 环境变量
    env: {
      NODE_ENV: "test",
      VITE_NODE_ENV: "test",
    },
  },
});
