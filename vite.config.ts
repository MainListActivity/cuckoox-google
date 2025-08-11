/// <reference types="vitest" />
import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath, URL } from "node:url";
import fs from "fs";
import path from "path";

// 将import手动添加到文件开头 - 在所有插件处理完成后执行（仅在需要时）
function prependImportToSwSurreal(): Plugin<unknown> {
  return {
    name: `prepend-import-to-sw-surreal`,
    enforce: "post", // 确保在所有其他插件之后执行
    generateBundle: {
      order: "post", // 在最后阶段执行
      handler(_options, bundle) {
        // 找到 sw-surreal.js 文件
        const swSurrealFile = Object.keys(bundle).find(
          (key) => key.includes("sw-surreal.js") || key === "sw-surreal.js",
        );

        if (swSurrealFile && bundle[swSurrealFile]) {
          const file = bundle[swSurrealFile];
          if (file.type === "chunk") {
            const importStatement = `import '/sw/wasm-shim.js';`;

            // 检查是否已经包含该import语句，避免重复添加
            if (!file.code.includes(importStatement)) {
              file.code = `${importStatement}\n${file.code}`;
              console.log(
                `Added import statement to ${swSurrealFile} (post-processing)`,
              );
            } else {
              console.log(
                `Import statement already exists in ${swSurrealFile}, skipping`,
              );
            }
          }
        }
      },
    },
  };
}

// 注：之前的 fixRegisterSW 插件已移除，因为使用 injectManifest 模式时不需要修改 registerSW.js

export default defineConfig(({ mode }) => {
  // 自定义环境变量加载逻辑
  const env = {} as Record<string, string>;

  // 加载顺序：.env.local -> .env.dev (dev模式) -> .env -> .env.test (test模式)
  const envFiles = [
    ".env", // 基础配置
    ...(mode === "development" ? [".env.dev"] : []), // dev模式时加载.env.dev
    ...(mode === "test" || process.env.NODE_ENV === "test" ? [".env.test"] : []), // test模式时加载.env.test
    ".env.local", // 本地配置（最高优先级）
  ];

  // 按顺序加载环境变量文件
  envFiles.forEach((file) => {
    const envPath = path.resolve(process.cwd(), file);
    if (fs.existsSync(envPath)) {
      // 读取文件内容并解析
      const content = fs.readFileSync(envPath, "utf-8");
      content.split("\n").forEach((line) => {
        line = line.trim();
        if (line && !line.startsWith("#")) {
          const [key, ...valueParts] = line.split("=");
          if (key && valueParts.length > 0) {
            env[key.trim()] = valueParts.join("=").trim();
          }
        }
      });
      console.log(`✓ 已加载环境变量文件: ${file}`);
    }
  });

  // 输出最终的环境变量配置（仅显示VITE_开头的）
  console.log("📋 当前环境变量配置:");
  Object.keys(env)
    .filter((key) => key.startsWith("VITE_"))
    .forEach((key) => {
      console.log(`  ${key}=${env[key]}`);
    });

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: "autoUpdate",
        strategies: "injectManifest",
        srcDir: "public/sw",
        filename: "sw-surreal.js",
        includeAssets: ["assets/logo/*.svg", "favicon.ico"],
        injectManifest: {
          maximumFileSizeToCacheInBytes: 15 * 1024 * 1024, // 15MB
          globIgnores: ["**/index_bg.wasm"], // 忽略WASM文件，不缓存
        },
        manifest: {
          name: "CuckooX 破产案件管理系统",
          short_name: "CuckooX",
          description: "企业破产案件管理系统 - 提供完整的破产案件生命周期管理",
          theme_color: "#009688",
          background_color: "#ffffff",
          display: "standalone",
          orientation: "portrait-primary",
          scope: "/",
          start_url: "/",
          id: "/",
          categories: ["business", "productivity", "utilities"],
          lang: "zh-CN",
          dir: "ltr",
          icons: [
            {
              src: "/assets/logo/favicon.svg",
              sizes: "32x32",
              type: "image/svg+xml",
              purpose: "any",
            },
            {
              src: "/assets/logo/cuckoo-icon.svg",
              sizes: "48x48 72x72 96x96 144x144 192x192 512x512",
              type: "image/svg+xml",
              purpose: "any",
            },
            {
              src: "/assets/logo/cuckoo-icon.svg",
              sizes: "48x48 72x72 96x96 144x144 192x192 512x512",
              type: "image/svg+xml",
              purpose: "maskable",
            },
          ],
        },
        devOptions: {
          enabled: true,
          type: "module",
        },
      }),
      prependImportToSwSurreal(),
    ],
    // 将环境变量传递给Vite
    define: {
      ...Object.keys(env).reduce(
        (acc, key) => {
          if (key.startsWith("VITE_")) {
            acc[`import.meta.env.${key}`] = JSON.stringify(env[key]);
          }
          return acc;
        },
        {} as Record<string, string>,
      ),
    },
    build: {
      target: "esnext",
      rollupOptions: {
        external: [
          // 将SurrealDB WASM作为外部依赖，不打包
          /@surrealdb\/wasm.*\.wasm$/,
        ],
        output: {
          paths: {
            // 将WASM文件指向CDN
            "@surrealdb/wasm/dist/surreal/index_bg.wasm":
              "https://unpkg.com/@surrealdb/wasm@1.4.1/dist/surreal/index_bg.wasm",
          },
        },
      },
    },
    optimizeDeps: {
      include: [
        "@mui/material",
        "@mui/icons-material",
        "@emotion/react",
        "@emotion/styled",
      ],
      exclude: ["@mui/icons-material/esm", "@surrealdb/wasm"],
      force: true, // 强制重新优化依赖，解决@emotion重复加载问题
      esbuildOptions: {
        target: "esnext",
      },
    },
    resolve: {
      alias: {
        "@": fileURLToPath(new URL(".", import.meta.url)),
      },
      // 使用 dedupe 来确保只加载单实例，避免通过 alias 指向具体文件导致子路径解析失败
      dedupe: [
        "react",
        "react-dom",
        "@emotion/react",
        "@emotion/styled",
        "react-i18next",
      ],
    },
    esbuild: {
      supported: {
        "top-level-await": true,
      },
    },
    server: {
      fs: {
        strict: false,
      },
      host: true,
      port: 5173, // 使用标准 Vite 端口
      allowedHosts: ["dev.cuckoox.cn", "dc.cuckoox.cn", "code.cuckoox.cn"],
    },
    preview: {
      port: 5173,
    },
    test: {
      // Vitest configuration
      globals: true,
      environment: "jsdom", // Common for React component testing
      include: [
        "tests/unit/**/*.test.{ts,tsx}",
        "tests/unit/**/*.test.fixed.{ts,tsx}", // Include fixed test files
      ],
      setupFiles: "./tests/setup.ts", // Setup file for test environment
      testTimeout: 5000, // 5 seconds timeout for each test
      hookTimeout: 3000, // 3 seconds timeout for hooks

      // 使用threads而不是forks来提升性能
      pool: "threads",
      poolOptions: {
        threads: {
          singleThread: false,
          isolate: true, // 保持隔离以确保测试稳定性
        },
      },

      // 适度提升并发度
      maxConcurrency: 3, // 从1提升到3
      minThreads: 1,
      maxThreads: 3,

      // Memory and performance optimization
      forceRerunTriggers: ["**/*.test.{ts,tsx}"],
      // Disable coverage for faster execution
      coverage: {
        enabled: false,
      },
      // Reduce memory usage
      logHeapUsage: false, // 禁用内存使用日志
      // 禁用详细输出
      silent: true,
      outputFile: undefined,
      // 使用超简洁的自定义reporter
      reporters: ["./tests/reporters/file-status-reporter.ts", "default"],
      exclude: [
        // Default Vitest excludes + e2e
        "**/node_modules/**",
        "**/dist/**",
        "**/cypress/**",
        "**/.{idea,git,cache,output,temp}/**",
        "**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*",
        "e2e/**", // Exclude E2E tests from unit test runner
      ],
    },
  };
});
