import { AuthenticationRequiredError } from "@/src/contexts/SurrealProvider";
import type { SurrealWorkerAPI } from "@/src/contexts/SurrealProvider";

/**
 * 将 Surreal 原生或 SW 返回的结果统一为“结果条目数组”
 * - 原生 Surreal: Array<{ status, result }> 或 Array<Array<Row>>
 * - SW 代理: Array<any>（可能直接是数组，或为 { result } 包裹）
 */
function normalizeToResultsArray(raw: any): any[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object" && "result" in raw) return [raw];
  throw new Error("Unexpected query result format");
}

/**
 * 解包每条语句的返回值：
 * - { status, result } -> result
 * - 直接数组 -> 数组
 * - 单个对象/原始值 -> 原值
 */
function unwrapEntry(entry: any): any {
  if (entry == null) return entry;
  if (Array.isArray(entry)) return entry;
  if (typeof entry === "object" && "result" in entry) {
    // Surreal 原生 { status, result } 结构
    return (entry as any).result;
  }
  return entry;
}

/**
 * 执行带认证检查的查询
 * - 自动在 SQL 前拼接 `return $auth;`
 * - 若未认证则抛出 AuthenticationRequiredError
 * - 兼容 Surreal 原生客户端与 SW 代理返回格式
 */
export async function queryWithAuth<T = unknown>(
  client: SurrealWorkerAPI,
  sql: string,
  vars?: Record<string, unknown>,
): Promise<T> {
  const authQuery = `return $auth;${sql}`;
  const raw = await client.query(authQuery, vars);

  const results = normalizeToResultsArray(raw);

  // 至少应返回两条语句结果（第1条为 $auth，第2条为实际查询）
  if (results.length < 2) {
    throw new Error("Authentication check failed: insufficient results");
  }

  // 认证结果解包
  const authEntry = unwrapEntry(results[0]);
  const isAuthenticated =
    authEntry != null &&
    // 可能为对象（$auth 为记录）
    (typeof authEntry === "object" ||
      // 或数组（某些实现可能返回数组包装）
      (Array.isArray(authEntry) && authEntry.length > 0) ||
      // 或原始真值
      !!authEntry);

  if (!isAuthenticated) {
    throw new AuthenticationRequiredError("用户未登录，请先登录");
  }

  // 返回实际查询结果（第二条语句）
  const data = unwrapEntry(results[1]);
  return data as T;
}

/**
 * 执行带认证检查的写操作（变更）
 * - 自动在 SQL 前拼接 `return $auth;`
 * - 兼容 Surreal 原生客户端与 SW 代理返回格式
 * - 对于不支持 mutate 的客户端，回退使用 query 执行
 */
export async function mutateWithAuth<T = unknown>(
  client: SurrealWorkerAPI,
  sql: string,
  vars?: Record<string, unknown>,
): Promise<T> {
  const authQuery = `return $auth;${sql}`;

  // 兼容性：如果没有 mutate 方法，则回退到 query
  const raw =
    typeof (client as any).mutate === "function"
      ? await (client as any).mutate(authQuery, vars)
      : await client.query(authQuery, vars);

  const results = normalizeToResultsArray(raw);

  if (results.length < 2) {
    throw new Error("Authentication check failed: insufficient results");
  }

  const authEntry = unwrapEntry(results[0]);
  const isAuthenticated =
    authEntry != null &&
    (typeof authEntry === "object" ||
      (Array.isArray(authEntry) && authEntry.length > 0) ||
      !!authEntry);

  if (!isAuthenticated) {
    throw new AuthenticationRequiredError("用户未登录，请先登录");
  }

  const data = unwrapEntry(results[1]);
  return data as T;
}
