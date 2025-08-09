/**
 * 测试数据库管理器
 * 使用真正的SurrealDB内嵌数据库引擎进行测试
 */

import { Surreal } from "surrealdb";
import { surrealdbNodeEngines } from "@surrealdb/node";
import { TestDataGenerator } from "./testData";
import * as path from "path";
import * as fs from "fs/promises";

export class TestDatabaseManager {
  private db: Surreal | null = null;
  private static instance: TestDatabaseManager | null = null;
  private isInitialized = false;
  private readonly namespace = "test_ns";
  private readonly database = `test_db_${Date.now()}`; // 每次运行使用不同的数据库名

  private constructor() {}

  /**
   * 获取单例实例
   */
  public static getInstance(): TestDatabaseManager {
    if (!TestDatabaseManager.instance) {
      TestDatabaseManager.instance = new TestDatabaseManager();
    }
    return TestDatabaseManager.instance;
  }

  /**
   * 创建和初始化测试数据库
   */
  public async initialize(): Promise<Surreal> {
    if (this.db && this.isInitialized) {
      return this.db;
    }

    try {
      console.log("正在初始化真实内嵌SurrealDB数据库...");

      // 创建 SurrealDB 实例，使用 WASM 引擎以连接内存数据库
      this.db = new Surreal({
        engines: surrealdbNodeEngines(),
      });

      // 连接到内存数据库
      await this.db.connect("mem://");
      console.log("已连接到SurrealDB内存数据库");

      // 使用测试命名空间和数据库
      await this.db.use({
        namespace: this.namespace,
        database: this.database,
      });
      console.log(`已切换到数据库: ${this.namespace}/${this.database}`);

      // 加载并执行数据库Schema
      await this.loadSchema();

      // 定义数据库登录 Access（测试环境与生产一致）
      await this.defineAccountAccess();

      // 基础元数据最小化初始化（角色、菜单、操作）
      await this.ensureCoreMetadata();

      // 插入测试数据
      await this.insertTestData();

      // 关联基础关系（用户角色、角色菜单与操作）
      await this.ensureCoreRelations();

      // 为测试用户补齐用户名与密码哈希，便于 SIGNIN
      await this.ensureTestUserCredentials();

      this.isInitialized = true;
      console.log("真实内嵌SurrealDB数据库初始化完成");

      return this.db;
    } catch (error) {
      console.error("测试数据库初始化失败:", error);
      throw error;
    }
  }

  /**
   * 加载并执行数据库Schema
   * 测试环境使用生产脚本 src/lib/surreal_schemas.surql，并在加载后应用兼容性覆盖
   */
  private async loadSchema(): Promise<void> {
    if (!this.db) throw new Error("数据库未初始化");

    try {
      console.log("正在加载数据库Schema...");

      // 读取生产环境的Schema文件
      const schemaPath = path.resolve(
        __dirname,
        "../../src/lib/surreal_schemas.surql",
      );
      const schemaContent = await fs.readFile(schemaPath, "utf-8");

      // 执行Schema语句
      const statements = this.splitSqlStatements(schemaContent);

      for (const statement of statements) {
        if (statement.trim()) {
          try {
            await this.db.query(statement);
          } catch (error) {
            console.warn(
              `执行Schema语句时出现警告: ${statement.substring(0, 50)}...`,
              error,
            );
            // 继续执行其他语句，某些DEFINE语句可能会产生警告但仍然成功
          }
        }
      }

      console.log(`Schema加载完成，执行了${statements.length}个语句`);
    } catch (error) {
      console.error("加载Schema失败:", error);
      throw error;
    }
  }

  /**
   * 简化的基础元数据设置（依赖Schema自动创建）
   */
  private async ensureCoreMetadata(): Promise<void> {
    if (!this.db) throw new Error("数据库未初始化");

    try {
      console.log("基础数据已通过Schema定义创建，跳过手动元数据创建");
      // Schema会自动创建必要的角色、操作、菜单等基础数据
      // 这里我们只需要确保用户角色关系存在
      console.log("核心元数据确保完成");
    } catch (error) {
      console.error("确保核心元数据失败:", error);
      throw error;
    }
  }

  /**
   * 定义数据库 Access（与生产一致的 SIGNIN 方式）
   */
  private async defineAccountAccess(): Promise<void> {
    if (!this.db) throw new Error("数据库未初始化");
    try {
      await this.db.query(`
DEFINE ACCESS account ON DATABASE TYPE RECORD
  SIGNIN ( SELECT * FROM user WHERE username = $username AND crypto::argon2::compare(password_hash, $pass) )
  DURATION FOR TOKEN 15m, FOR SESSION 12h
;
`);
    } catch {
      // 向后兼容 SurrealDB 1.x：若 ACCESS 定义失败，使用 SCOPE 定义
      await this.db.query(`
DEFINE SCOPE account SESSION 12h
  SIGNIN ( SELECT * FROM user WHERE username = $username AND crypto::argon2::compare(password_hash, $pass) );
`);
    }
  }

  /**
   * 简化的基础关系设置（依赖Schema和生产系统默认数据）
   */
  private async ensureCoreRelations(): Promise<void> {
    if (!this.db) throw new Error("数据库未初始化");

    try {
      console.log("基础关系已通过Schema定义创建，依赖生产系统权限配置");
      // Schema应该已经创建了基础的角色权限关系
      // 测试环境应该依赖生产系统的权限配置而不是手动创建
      console.log("核心关系确保完成");
    } catch (error) {
      console.error("确保核心关系失败:", error);
      throw error;
    }
  }

  /**
   * 为内置测试用户设置用户名与口令（argon2 哈希），用于 SIGNIN
   */
  private async ensureTestUserCredentials(): Promise<void> {
    if (!this.db) throw new Error("数据库未初始化");
    const stmts = [
      "UPDATE user:admin SET username = 'admin', password_hash = crypto::argon2::generate('admin123');",
      "UPDATE user:case_manager SET username = 'case_manager', password_hash = crypto::argon2::generate('test123');",
      "UPDATE user:creditor_user SET username = 'creditor_user', password_hash = crypto::argon2::generate('test123');",
      "UPDATE user:test_user SET username = 'test_user', password_hash = crypto::argon2::generate('test123');",
    ];
    for (const s of stmts) {
      try {
        await this.db.query(s);
      } catch (e) {
        console.warn("设置测试用户口令失败:", e);
      }
    }
  }

  /**
   * 使用账户 Access 执行登录，获取 JWT 并设置认证
   */
  public async signIn(username: string, password: string): Promise<void> {
    if (!this.db) throw new Error("数据库未初始化");
    let token: string | undefined;
    try {
      // 优先使用 ACCESS（SurrealDB 2.x）
      token = (await this.db.signin({
        namespace: this.namespace,
        database: this.database,
        access: "account",
        variables: { username, pass: password },
      })) as unknown as string;
    } catch {
      // 回退使用 SCOPE（SurrealDB 1.x）
      token = (await this.db.signin({
        namespace: this.namespace,
        database: this.database,
        scope: "account",
        variables: { username, pass: password },
      })) as unknown as string;
    }
    if (!token) {
      throw new Error("SIGNIN 未返回有效 token");
    }
    await this.db.authenticate(token as string);
    // 调试：触发一次 $auth 读取，确保认证上下文生效
    try {
      await this.db.query("RETURN $auth;");
    } catch {
      // 忽略调试查询错误
    }
  }

  /**
   * 退出登录
   */
  public async signOut(): Promise<void> {
    if (!this.db) return;
    try {
      await this.db.invalidate();
    } catch (e) {
      console.warn("SIGNOUT 失败:", e);
    }
  }

  /**
   * 插入测试数据
   */
  private async insertTestData(): Promise<void> {
    if (!this.db) throw new Error("数据库未初始化");

    try {
      console.log("正在插入测试数据...");

      const dataGenerator = TestDataGenerator.getInstance();

      // 使用SQL语句插入数据，以确保与真实SurrealDB的完全兼容
      const statements = dataGenerator.generateInsertStatements();

      for (const statement of statements) {
        if (statement.trim()) {
          try {
            await this.db.query(statement);
          } catch (error) {
            console.warn(
              `插入数据语句执行警告: ${statement.substring(0, 100)}...`,
              error,
            );
            // 继续执行其他语句
          }
        }
      }

      console.log(`测试数据插入完成，执行了${statements.length}个语句`);
    } catch (error) {
      console.error("插入测试数据失败:", error);
      throw error;
    }
  }

  /**
   * 分割SQL语句
   */
  private splitSqlStatements(content: string): string[] {
    // 移除注释和空行
    const lines = content
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("--"));

    const statements: string[] = [];
    let currentStatement = "";

    for (const line of lines) {
      currentStatement += line + "\n";

      // 如果行以分号结束，认为是一个完整的语句
      if (line.endsWith(";")) {
        statements.push(currentStatement.trim());
        currentStatement = "";
      }
    }

    // 添加最后一个未以分号结尾的语句（如果有）
    if (currentStatement.trim()) {
      statements.push(currentStatement.trim());
    }

    return statements;
  }

  /**
   * 获取数据库实例
   */
  public getDatabase(): Surreal {
    if (!this.db) {
      throw new Error("测试数据库未初始化，请先调用 initialize()");
    }
    return this.db;
  }

  /**
   * 设置认证用户（用于权限测试）
   */
  public async setAuthUser(userId: string): Promise<void> {
    if (!this.db) throw new Error("数据库未初始化");
    const uname = userId.includes(":") ? userId.split(":")[1] : userId;
    const pwd = uname === "admin" ? "admin123" : "test123";
    await this.signIn(uname, pwd);
    console.log(`已登录用户: ${userId}`);
    try {
      const res = await this.db.query(`
        SELECT ->has_role->role.* AS roles FROM $auth;
      `);
      const rows = Array.isArray(res?.[0]) ? (res[0] as any[]) : [];
      const first = rows[0] || {};
      const roles = Array.isArray((first as any).roles)
        ? (first as any).roles
        : [];
      const names = roles.map((r: any) => r?.name).filter(Boolean);
      console.log("[调试] 当前用户角色：", names);
    } catch (e) {
      console.warn("查询用户角色列表失败：", e);
    }

    // 追加：逐步调试权限查询链
    try {
      // 步骤1: 检查用户角色关系
      console.log("[调试步骤1] 检查用户角色关系...");
      const step1Res = await this.db.query(`SELECT ->has_role FROM $auth;`);
      const step1Data = Array.isArray(step1Res?.[0]) ? (step1Res[0] as any[]) : [];
      console.log("[调试步骤1] 用户角色关系：", JSON.stringify(step1Data, null, 2));

      // 步骤2: 检查角色信息
      console.log("[调试步骤2] 检查角色信息...");
      const step2Res = await this.db.query(`SELECT ->has_role->role FROM $auth;`);
      const step2Data = Array.isArray(step2Res?.[0]) ? (step2Res[0] as any[]) : [];
      console.log("[调试步骤2] 角色信息：", JSON.stringify(step2Data, null, 2));

      // 步骤3: 检查角色操作权限关系
      console.log("[调试步骤3] 检查角色操作权限关系...");
      const step3Res = await this.db.query(`SELECT ->has_role->role->can_execute_operation FROM $auth;`);
      const step3Data = Array.isArray(step3Res?.[0]) ? (step3Res[0] as any[]) : [];
      console.log("[调试步骤3] 角色操作权限关系：", JSON.stringify(step3Data, null, 2));

      // 步骤4: 检查操作元数据
      console.log("[调试步骤4] 检查操作元数据...");
      const step4Res = await this.db.query(`SELECT ->has_role->role->can_execute_operation->operation_metadata FROM $auth;`);
      const step4Data = Array.isArray(step4Res?.[0]) ? (step4Res[0] as any[]) : [];
      console.log("[调试步骤4] 操作元数据：", JSON.stringify(step4Data, null, 2));

      // 步骤5: 最终查询操作ID
      console.log("[调试步骤5] 查询操作ID...");
      const step5Res = await this.db.query(`
        SELECT ->has_role->role->can_execute_operation->operation_metadata.operation_id AS operation_ids
        FROM $auth;
      `);
      const step5Data = Array.isArray(step5Res?.[0]) ? (step5Res[0] as any[]) : [];
      console.log("[调试步骤5] 最终操作ID：", JSON.stringify(step5Data, null, 2));

    } catch (e) {
      console.warn("调试权限查询失败：", e);
    }
  }

  /**
   * 清除认证状态
   */
  public async clearAuth(): Promise<void> {
    if (!this.db) return;
    try {
      await this.signOut();
      console.log("已清除认证状态");
    } catch (error) {
      console.warn("清除认证状态失败:", error);
    }
  }

  /**
   * 重置数据库状态（清空所有数据但保留Schema）
   */
  public async resetDatabase(): Promise<void> {
    if (!this.db) return;

    try {
      console.log("正在重置数据库状态...");

      // 删除所有数据表的数据（保留Schema）
      const tables = [
        "user",
        "case",
        "creditor",
        "claim",
        "has_role",
        "can_execute_operation",
        "can_access_menu",
        "has_case_role",
        "has_member",
      ];

      for (const table of tables) {
        try {
          await this.db.query(`DELETE ${table};`);
        } catch (error) {
          // 表可能不存在，继续删除其他表
          console.warn(`删除表 ${table} 数据时出现警告:`, error);
        }
      }

      // 确保核心元数据存在（角色/菜单/操作）
      await this.ensureCoreMetadata();

      // 重新插入测试数据
      await this.insertTestData();
      // 重新设置测试用户的用户名与口令哈希，确保 SIGNIN 可用
      await this.ensureTestUserCredentials();

      // 重新建立核心关系（用户角色、角色权限）
      await this.ensureCoreRelations();

      console.log("数据库状态重置完成");
    } catch (error) {
      console.error("重置数据库状态失败:", error);
      throw error;
    }
  }

  /**
   * 执行自定义查询（用于测试验证）
   */
  public async query(sql: string, vars?: Record<string, any>): Promise<any> {
    if (!this.db) throw new Error("数据库未初始化");

    try {
      return await this.db.query(sql, vars);
    } catch (error) {
      console.error("查询执行失败:", sql, error);
      throw error;
    }
  }

  /**
   * 验证数据库状态（检查基础数据是否正确）
   */
  public async validateDatabaseState(): Promise<boolean> {
    if (!this.db) return false;

    let prevUserId: string | null = null;
    try {
      // 捕获当前认证用户，便于后续恢复
      try {
        const authRes = await this.db.query("SELECT * FROM $auth;");
        const idObj = authRes?.[0]?.[0]?.id;
        if (idObj && typeof idObj.toString === "function") {
          prevUserId = idObj.toString();
        }
      } catch {
        // 忽略读取 $auth 的错误
      }

      // 临时以 admin 权限统计，避免权限限制导致统计为 0
      try {
        await this.signIn("admin", "admin123");
      } catch {
        // 即使无法登录，也继续尝试统计
      }

      // 检查关键表是否有数据
      const userResult = await this.db.query(
        "SELECT count() AS count FROM user GROUP ALL;",
      );
      const caseResult = await this.db.query(
        "SELECT count() AS count FROM case GROUP ALL;",
      );
      const roleResult = await this.db.query(
        "SELECT count() AS count FROM role GROUP ALL;",
      );

      const userCount = userResult?.[0]?.[0]?.count || 0;
      const caseCount = caseResult?.[0]?.[0]?.count || 0;
      const roleCount = roleResult?.[0]?.[0]?.count || 0;

      console.log(
        `数据库状态验证: 用户=${userCount}, 案件=${caseCount}, 角色=${roleCount}`,
      );

      return caseCount > 0 && roleCount > 0;
    } catch (error) {
      console.error("数据库状态验证失败:", error);
      return false;
    } finally {
      // 恢复之前的认证状态
      try {
        if (prevUserId) {
          await this.setAuthUser(prevUserId);
        } else {
          await this.clearAuth();
        }
      } catch {
        // 忽略恢复过程中的错误
      }
    }
  }

  /**
   * 获取数据库统计信息（用于调试）
   */
  public async getDatabaseStats(): Promise<Record<string, number>> {
    if (!this.db) return {};

    let prevUserId: string | null = null;
    try {
      // 捕获当前认证用户，便于后续恢复
      try {
        const authRes = await this.db.query("SELECT * FROM $auth;");
        const idObj = authRes?.[0]?.[0]?.id;
        if (idObj && typeof idObj.toString === "function") {
          prevUserId = idObj.toString();
        }
      } catch {
        // 忽略读取 $auth 的错误
      }

      // 临时以 admin 权限统计，避免权限导致的 SELECT 限制
      try {
        await this.signIn("admin", "admin123");
      } catch {
        // 即使无法登录，也尽量统计
      }

      const tables = [
        "user",
        "role",
        "operation_metadata",
        "menu_metadata",
        "case",
        "creditor",
        "claim",
        "has_role",
        "can_execute_operation",
        "can_access_menu",
        "has_case_role",
      ];
      const stats: Record<string, number> = {};

      for (const table of tables) {
        try {
          const result = await this.db.query(
            `SELECT count() AS count FROM ${table} GROUP ALL;`,
          );
          stats[table] = result?.[0]?.[0]?.count || 0;
        } catch (error) {
          stats[table] = 0;
        }
      }

      return stats;
    } catch (error) {
      console.error("获取数据库统计信息失败:", error);
      return {};
    } finally {
      // 恢复之前的认证状态
      try {
        if (prevUserId) {
          await this.setAuthUser(prevUserId);
        } else {
          await this.clearAuth();
        }
      } catch {
        // 忽略恢复过程中的错误
      }
    }
  }

  /**
   * 关闭数据库连接
   */
  public async close(): Promise<void> {
    if (this.db) {
      try {
        await this.db.close();
        console.log("真实内嵌SurrealDB连接已关闭");
      } catch (error) {
        console.warn("关闭数据库连接失败:", error);
      } finally {
        this.db = null;
        this.isInitialized = false;
      }
    }
  }

  /**
   * 销毁单例实例（主要用于测试清理）
   */
  public static async destroyInstance(): Promise<void> {
    if (TestDatabaseManager.instance) {
      await TestDatabaseManager.instance.close();
      TestDatabaseManager.instance = null;
    }
  }
}

// 导出便捷函数
export const getTestDatabase = async (): Promise<Surreal> => {
  const manager = TestDatabaseManager.getInstance();
  return await manager.initialize();
};

export const resetTestDatabase = async (): Promise<void> => {
  const manager = TestDatabaseManager.getInstance();
  await manager.resetDatabase();
};

export const closeTestDatabase = async (): Promise<void> => {
  await TestDatabaseManager.destroyInstance();
};
