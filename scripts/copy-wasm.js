#!/usr/bin/env node
import { copyFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

// 确保目标目录存在
const wasmDir = join(projectRoot, 'public', 'wasm');
if (!existsSync(wasmDir)) {
  mkdirSync(wasmDir, { recursive: true });
}

// 复制 WASM 文件
const wasmSource = join(projectRoot, 'node_modules', '@surrealdb', 'wasm', 'dist', 'surreal', 'index_bg.wasm');
const wasmDest = join(wasmDir, 'surrealdb.wasm');

const jsSource = join(projectRoot, 'node_modules', '@surrealdb', 'wasm', 'dist', 'surreal', 'index.js');
const jsDest = join(wasmDir, 'surrealdb.js');

try {
  copyFileSync(wasmSource, wasmDest);
  console.log('✅ Copied WASM file to public/wasm/surrealdb.wasm');
  
  copyFileSync(jsSource, jsDest);
  console.log('✅ Copied JS file to public/wasm/surrealdb.js');
} catch (error) {
  console.error('❌ Failed to copy WASM files:', error);
  process.exit(1);
}