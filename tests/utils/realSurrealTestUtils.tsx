/**
 * 真实SurrealDB测试工具
 * 提供使用真实内嵌数据库的测试渲染和工具函数
 */

import React, { ReactElement, ReactNode } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { SurrealProvider } from '@/src/contexts/SurrealProvider';
import { AuthProvider } from '@/src/contexts/AuthContext';
import { SnackbarProvider } from '@/src/contexts/SnackbarContext';
import { getTestDatabase, getTestDatabaseManager } from '../setup-embedded-db';
import Surreal from 'surrealdb';

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
          <SnackbarProvider>
            {children}
          </SnackbarProvider>
        </AuthProvider>
      </SurrealProvider>
    </BrowserRouter>
  );
};

// 真实数据库测试渲染配置
interface RealSurrealRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  database?: Surreal;
  authUserId?: string;
  initialEntries?: string[];
}

/**
 * 使用真实SurrealDB的测试渲染函数
 */
export function renderWithRealSurreal(
  ui: ReactElement,
  options: RealSurrealRenderOptions = {}
) {
  const { database, authUserId, ...renderOptions } = options;

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <RealSurrealTestProvider 
      database={database} 
      authUserId={authUserId}
    >
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

  /**
   * 执行数据库查询
   */
  static async query(sql: string, vars?: Record<string, any>) {
    if (!this.db) this.initialize();
    return await this.db.query(sql, vars);
  }

  /**
   * 创建测试记录
   */
  static async create(table: string, data: Record<string, any>) {
    if (!this.db) this.initialize();
    const res = await this.db.create(table, data);
    // 规范返回为单条记录对象
    return Array.isArray(res) ? res[0] : res;
  }

  /**
   * 查询测试记录
   */
  static async select(thing: string) {
    if (!this.db) this.initialize();
    return await this.db.select(thing);
  }

  /**
   * 更新测试记录
   */
  static async update(thing: string, data: Record<string, any>) {
    if (!this.db) this.initialize();
    return await this.db.update(thing, data);
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
      const result = await this.query(`SELECT count() AS count FROM ${table} GROUP ALL;`);
      const count = result?.[0]?.[0]?.count;
      return typeof count === 'number' ? count : 0;
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
      throw new Error(`Expected ${expectedCount} records in ${table}, but found ${actualCount}`);
    }
  }

  /**
   * 等待数据库操作完成（用于异步操作）
   */
  static async waitForDatabaseOperation(
    operation: () => Promise<any>,
    maxAttempts: number = 10,
    delayMs: number = 100
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
      await new Promise(resolve => setTimeout(resolve, delayMs));
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
    ADMIN: 'user:admin',
    CASE_MANAGER: 'user:case_manager', 
    CREDITOR_USER: 'user:creditor_user',
    TEST_USER: 'user:test_user',
  },
  CASES: {
    TEST_CASE_1: 'case:test_case_1',
    TEST_CASE_2: 'case:test_case_2',
  },
  CREDITORS: {
    CREDITOR_1: 'creditor:creditor_1',
    CREDITOR_2: 'creditor:creditor_2',
  },
  CLAIMS: {
    CLAIM_1: 'claim:claim_1',
    CLAIM_2: 'claim:claim_2',
  },
  ROLES: {
    ADMIN: 'role:admin',
    CASE_MANAGER: 'role:case_manager',
    CREDITOR: 'role:creditor',
  },
};

// 导出默认渲染函数（向后兼容）
export const renderWithRealDatabase = renderWithRealSurreal;
export const TestHelpers = RealSurrealTestHelpers;