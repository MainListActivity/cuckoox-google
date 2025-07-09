// WASM 垫片文件 - 单独处理 surrealdbWasmEngines 导入
import { surrealdbWasmEngines } from '@surrealdb/wasm';

// 创建一个全局变量来存储 WASM 引擎工厂
(self as any).__surrealdbWasmEngines = surrealdbWasmEngines;

// 添加一些简单的无关紧要的逻辑
console.log('WASM shim loaded');

// 导出一个简单的函数用于获取 WASM 引擎
export async function getWasmEngines() {
  return (self as any).__surrealdbWasmEngines;
}

// 一些简单的初始化逻辑
const shimInfo = {
  version: '1.0.0',
  loaded: true,
  timestamp: Date.now()
};

console.log('WASM shim info:', shimInfo);