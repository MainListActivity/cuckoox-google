/**
 * 真实SurrealDB测试工具
 * 提供使用真实内嵌数据库的测试渲染和工具函数
 */

import React, { ReactElement, ReactNode } from "react";
import { render, RenderOptions } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { SurrealProvider } from "@/src/contexts/SurrealProvider";
import { AuthProvider } from "@/src/contexts/AuthContext";
import { SnackbarProvider } from "@/src/contexts/SnackbarContext";
import { getTestDatabase, getTestDatabaseManager } from "../setup-embedded-db";
import Surreal from "surrealdb";

// 真实数据库测试Provider包装器
interface RealSurrealTestProviderProps {
  children: ReactNode;
  database?: Surreal;
  authUserId?: string;
}

const RealSurrealTestProvider: React.FC<RealSurrealTestProviderProps> = ({
  children,
  database,
  authUserId,
}) => {
  const testDb = database || getTestDatabase();

  // 如果指定了认证用户，设置认证状态
  React.useEffect(() => {
    if (authUserId) {
      const manager = getTestDatabaseManager();
      manager.setAuthUser(authUserId).catch(console.error);
    }
  }, [authUserId]);

  return (
    <BrowserRouter key={Math.random()}>
      <SurrealProvider client={testDb} autoConnect={false}>
        <AuthProvider>
          <SnackbarProvider>{children}</SnackbarProvider>
        </AuthProvider>
      </SurrealProvider>
    </BrowserRouter>
  );
};

// 真实数据库测试渲染配置
interface RealSurrealRenderOptions extends Omit<RenderOptions, "wrapper"> {
  database?: Surreal;
  authUserId?: string;
  initialEntries?: string[];
}

/**
 * 使用真实SurrealDB的测试渲染函数
 */
export function renderWithRealSurreal(
  ui: ReactElement,
  options: RealSurrealRenderOptions = {},
) {
  const { database, authUserId, ...renderOptions } = options;

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <RealSurrealTestProvider database={database} authUserId={authUserId}>
      {children}
    </RealSurrealTestProvider>
  );

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}

/**
 * 测试数据库查询辅助函数
 */
export class RealSurrealTestHelpers {
  private static db: Surreal;
  private static manager: any;

  static initialize() {
    this.db = getTestDatabase();
    this.manager = getTestDatabaseManager();
  }

  // 过滤只读字段，避免写操作触发 READONLY 约束
  private static sanitizeDataForWrite<T extends Record<string, any>>(
    data: T,
  ): T {
    if (!data) return data;
    const { created_at, updated_at, ...rest } = data as any;
    return rest as T;
  }

  /**
   * 执行数据库查询
   */
  static async query(sql: string, vars?: Record<string, any>) {
    if (!this.db) this.initialize();
    const raw = await this.db.query(sql, vars);

    // 规范化：支持 SurrealDB 返回 { status, result } 结构，确保每条语句的返回均为数组
    const normalizeOne = (item: any) => {
      if (item == null) return [];
      if (Array.isArray(item)) return item;
      if (typeof item === "object" && "result" in item) {
        const r = (item as any).result;
        return Array.isArray(r) ? r : r == null ? [] : [r];
      }
      return [item];
    };
    const res = Array.isArray(raw)
      ? raw.map(normalizeOne)
      : [normalizeOne(raw)];

    // 调试：当检测到角色查询时，安全打印角色名列表，便于定位权限/数据问题
    try {
      if (/->has_role->role\.\*\s+AS\s+roles/i.test(sql)) {
        const rows = Array.isArray(res?.[0]) ? (res[0] as any[]) : [];
        const first = rows[0] || {};
        const roles = Array.isArray(first.roles) ? first.roles : [];
        const names = roles
          .map((r: any) => (r && r.name) || null)
          .filter(Boolean);
        console.log("[角色查询调试] 当前用户角色：", names);
      }
    } catch {
      // 打印失败不影响测试流程
    }

    return res;
  }

  /**
   * 创建测试记录
   */
  // 将返回记录中的 id 字段规范化为具备 id 和 toString() 的对象，确保 id.id 可用
  private static normalizeIdField<T extends Record<string, any>>(obj: T): T {
    if (!obj || typeof obj !== "object") return obj;
    const raw = (obj as any).id;
    let wrapped: any = null;

    try {
      if (raw && typeof raw === "object") {
        const tb =
          (raw as any).tb || (raw as any).table || (raw as any)["@table"];
        const id = (raw as any).id || (raw as any)["@id"];
        if (tb && id) {
          wrapped = {
            table: tb,
            id,
            toString() {
              return `${tb}:${id}`;
            },
          };
        }
      } else if (typeof raw === "string" && raw.includes(":")) {
        const [tb, id] = (raw as string).split(":");
        if (tb && id) {
          wrapped = {
            table: tb,
            id,
            toString() {
              return `${tb}:${id}`;
            },
          };
        }
      }
    } catch {
      // 忽略规范化异常
    }

    if (wrapped) {
      (obj as any).id = wrapped;
    }
    return obj;
  }

  static async create(table: string, data: Record<string, any>) {
    if (!this.db) this.initialize();
    const payload = this.sanitizeDataForWrite(data);
    // 针对 claim：补齐必须的对象字段，避免 NONE 违约
    if (table === "claim" && (payload as any).asserted_claim_details == null) {
      (payload as any).asserted_claim_details = {};
    }
    // 针对 document：删除只读字段并补齐可选字段，避免 READONLY 写入与约束不满足
    if (table === "document") {
      if ("created_by" in (payload as any)) {
        delete (payload as any).created_by;
      }
      if ((payload as any).version == null) {
        (payload as any).version = 1;
      }
      if ((payload as any).file_size == null) {
        (payload as any).file_size = 0;
      }
    }
    let res: any = await this.db.create(table, payload);
    // 兼容 SurrealDB { status, result } 返回
    if (res && typeof res === "object" && "result" in res) {
      res = (res as any).result;
    }
    // 规范返回为单条记录对象，并规范化 id 字段
    const record = Array.isArray(res) ? res[0] : res;
    return this.normalizeIdField(record);
  }

  /**
   * 查询测试记录
   */
  static async select(thing: string) {
    if (!this.db) this.initialize();
    let res: any = await this.db.select(thing);
    if (res && typeof res === "object" && "result" in res) {
      res = (res as any).result;
    }
    const arr = Array.isArray(res) ? res : res ? [res] : [];
    return arr.map((r: any) => this.normalizeIdField(r));
  }

  /**
   * 更新测试记录
   */
  static async update(thing: string, data: Record<string, any>) {
    if (!this.db) this.initialize();
    const payload = this.sanitizeDataForWrite(data);
    let res: any = await this.db.update(thing, payload);
    if (res && typeof res === "object" && "result" in res) {
      res = (res as any).result;
    }
    return res;
  }

  /**
   * 删除测试记录
   */
  static async delete(thing: string) {
    if (!this.db) this.initialize();
    return await this.db.delete(thing);
  }

  /**
   * 设置认证用户
   */
  static async setAuthUser(userId: string) {
    if (!this.manager) this.initialize();
    await this.manager.setAuthUser(userId);
  }

  /**
   * 清除认证状态
   */
  static async clearAuth() {
    if (!this.manager) this.initialize();
    await this.manager.clearAuth();
  }

  /**
   * 重置数据库状态
   */
  static async resetDatabase() {
    if (!this.manager) this.initialize();
    await this.manager.resetDatabase();
  }

  /**
   * 验证数据库记录存在
   */
  static async assertRecordExists(table: string, id: string) {
    const result = await this.select(`${table}:${id}`);
    if (!result || result.length === 0) {
      throw new Error(`Record ${table}:${id} does not exist`);
    }
    return result[0];
  }

  /**
   * 验证数据库记录不存在
   */
  static async assertRecordNotExists(table: string, id: string) {
    const result = await this.select(`${table}:${id}`);
    if (result && result.length > 0) {
      throw new Error(`Record ${table}:${id} should not exist`);
    }
  }

  /**
   * 获取记录总数
   */
  static async getRecordCount(table: string): Promise<number> {
    try {
      // Surreal 统计建议使用 GROUP ALL 聚合
      const result = await this.query(
        `SELECT count() AS count FROM ${table} GROUP ALL;`,
      );
      const count = result?.[0]?.[0]?.count;
      return typeof count === "number" ? count : 0;
    } catch (error) {
      console.warn(`获取${table}表记录数失败:`, error);
      return 0;
    }
  }

  /**
   * 验证记录总数
   */
  static async assertRecordCount(table: string, expectedCount: number) {
    const actualCount = await this.getRecordCount(table);
    if (actualCount !== expectedCount) {
      throw new Error(
        `Expected ${expectedCount} records in ${table}, but found ${actualCount}`,
      );
    }
  }

  /**
   * 等待数据库操作完成（用于异步操作）
   */
  static async waitForDatabaseOperation(
    operation: () => Promise<any>,
    maxAttempts: number = 10,
    delayMs: number = 100,
  ) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await operation();
        if (result) {
          return result;
        }
      } catch (error) {
        if (attempt === maxAttempts) {
          throw error;
        }
      }

      // 等待一段时间再重试
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    throw new Error(`Database operation failed after ${maxAttempts} attempts`);
  }

  /**
   * 获取数据库统计信息
   */
  static async getDatabaseStats() {
    if (!this.manager) this.initialize();
    return await this.manager.getDatabaseStats();
  }

  /**
   * 验证数据库状态
   */
  static async validateDatabaseState() {
    if (!this.manager) this.initialize();
    return await this.manager.validateDatabaseState();
  }
}

// 常用的测试数据ID
export const TEST_IDS = {
  USERS: {
    ADMIN: "user:admin",
    CASE_MANAGER: "user:case_manager",
    CREDITOR_USER: "user:creditor_user",
    TEST_USER: "user:test_user",
  },
  CASES: {
    TEST_CASE_1: "case:test_case_1",
    TEST_CASE_2: "case:test_case_2",
  },
  CREDITORS: {
    CREDITOR_1: "creditor:creditor_1",
    CREDITOR_2: "creditor:creditor_2",
  },
  CLAIMS: {
    CLAIM_1: "claim:claim_1",
    CLAIM_2: "claim:claim_2",
  },
  ROLES: {
    ADMIN: "role:admin",
    CASE_MANAGER: "role:case_manager",
    CREDITOR: "role:creditor",
  },
};

// 导出默认渲染函数（向后兼容）
export const renderWithRealDatabase = renderWithRealSurreal;
export const TestHelpers = RealSurrealTestHelpers;
