/**
 * 临时调试脚本：快速验证 $auth 查询返回
 * 运行方式（建议使用 Bun）：
 *   bun run tsx tasks/quick-auth-check.ts
 *
 * 脚本做的事情：
 * 1) 在内存数据库（mem://）中初始化最小Schema与Access配置
 * 2) 创建一个 admin 测试用户（username=admin, password=admin123）
 * 3) 通过 Access: account 登录，拿到 token 并进行 authenticate
 * 4) 依次执行：
 *    - RETURN $auth;
 *    - RETURN $auth.id;
 *    - SELECT * FROM $auth;（部分引擎/版本可能不支持，失败会捕捉并打印）
 *
 * 注意：
 * - 该脚本不会加载完整生产Schema，仅用于快速验证 $auth 查询行为
 * - 如果你要对接真实数据库，请自行修改连接方式并移除相应初始化语句
 */

import { Surreal } from "surrealdb";
import { surrealdbWasmEngines } from "@surrealdb/wasm";

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

// 安全序列化（兼容 RecordId / BigInt 等不可直接 JSON.stringify 的类型）
function safeStringify(input: unknown): string {
  const cache = new Set<any>();
  const replacer = (_key: string, value: unknown): Json => {
    // 防循环
    if (typeof value === "object" && value !== null) {
      if (cache.has(value)) return "[Circular]";
      cache.add(value);
    }
    // 处理 RecordId
    if (value && typeof value === "object" && "toString" in value && typeof (value as any).toString === "function") {
      try {
        const s = (value as any).toString();
        if (typeof s === "string" && s.includes(":")) return s as unknown as Json;
      } catch {
        // ignore
      }
    }
    // 处理 BigInt
    if (typeof value === "bigint") return value.toString() as unknown as Json;

    // 仅返回可序列化值
    if (
      value === null ||
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      return value;
    }
    if (Array.isArray(value)) {
      return value.map((v) => replacer("", v));
    }
    if (typeof value === "object" && value) {
      const out: { [k: string]: Json } = {};
      for (const [k, v] of Object.entries(value)) {
        out[k] = replacer(k, v);
      }
      return out;
    }
    return (value as any) ?? null;
  };

  try {
    return JSON.stringify(replacer("", input), null, 2);
  } catch (e) {
    return `<<无法序列化: ${String(e)}>>`;
  }
}

async function main() {
  const db = new Surreal({
    engines: surrealdbWasmEngines(),
  });

  const NS = process.env.SURREAL_NS || "debug_ns";
  const DB = process.env.SURREAL_DB || `debug_db_${Date.now()}`;
  const USERNAME = process.env.DEBUG_USER || "admin";
  const PASSWORD = process.env.DEBUG_PASS || "admin123";

  console.log("== SurrealDB $auth 快速验证脚本 ==");
  console.log(`使用内存数据库: mem://`);
  console.log(`命名空间/数据库: ${NS}/${DB}`);

  try {
    await db.connect("mem://");
    await db.use({ namespace: NS, database: DB });

    console.log("初始化最小Schema与Access...");
    // 最小用户表（仅调试用，权限放开）
    await db.query(`
      DEFINE TABLE user TYPE NORMAL SCHEMAFULL PERMISSIONS FULL;
      DEFINE FIELD username ON user TYPE string;
      DEFINE FIELD password_hash ON user TYPE string;
      DEFINE FIELD name ON user TYPE option<string>;
      DEFINE FIELD created_at ON user TYPE datetime DEFAULT time::now() READONLY;
      DEFINE FIELD updated_at ON user TYPE datetime VALUE time::now();
    `);

    // 定义 Access: account（仅 SIGNIN，基于 username/password_hash）
    await db.query(`
      DEFINE ACCESS account ON DATABASE TYPE RECORD
        SIGNIN ( SELECT * FROM user WHERE username = $username AND crypto::argon2::compare(password_hash, $pass) )
        DURATION FOR TOKEN 15m, FOR SESSION 12h
      ;
    `);

    console.log("创建测试用户（如果不存在会覆盖）...");
    await db.query(`
      UPDATE user:admin SET
        username = '${USERNAME}',
        password_hash = crypto::argon2::generate('${PASSWORD}'),
        name = '系统管理员',
        updated_at = time::now();
    `);

    console.log("进行 SIGNIN...");
    const token = await db.signin({
      namespace: NS,
      database: DB,
      access: "account",
      variables: { username: USERNAME, pass: PASSWORD },
    });

    if (!token || typeof token !== "string") {
      throw new Error("SIGNIN 未返回有效 token");
    }

    await db.authenticate(token);
    console.log("已认证，尝试查询 $auth ...");

    // 1) RETURN $auth
    try {
      const r = await db.query("RETURN $auth;");
      console.log("RETURN $auth; =>", safeStringify(r));
    } catch (e) {
      console.log("RETURN $auth; 执行失败：", e);
    }

    // 2) RETURN $auth.id
    try {
      const r = await db.query("RETURN $auth.id;");
      console.log("RETURN $auth.id; =>", safeStringify(r));
    } catch (e) {
      console.log("RETURN $auth.id; 执行失败：", e);
    }

    // 3) SELECT * FROM $auth（部分版本不支持）
    try {
      const r = await db.query("SELECT * FROM $auth;");
      console.log("SELECT * FROM $auth; =>", safeStringify(r));
    } catch (e) {
      console.log("SELECT * FROM $auth; 可能不被当前引擎/版本支持，错误：", e);
    }

    console.log("验证完成。");
  } catch (err) {
    console.error("运行失败：", err);
  } finally {
    try {
      await db.invalidate();
    } catch {
      // ignore
    }
    try {
      await db.close();
    } catch {
      // ignore
    }
  }
}

// 允许作为独立脚本执行
main();
