/**
 * 测试诊断工具
 * 帮助诊断和解决集成测试中的问题
 */

import { getTestDatabase, getTestDatabaseManager } from '../setup-embedded-db';

export class TestDiagnostics {
  /**
   * 检查数据库连接状态
   */
  static async checkDatabaseConnection(): Promise<{
    isConnected: boolean;
    error?: string;
    stats?: any;
  }> {
    try {
      const db = getTestDatabase();
      
      // 执行简单查询测试连接 - 使用SurrealQL的RETURN语法
      const result = await db.query('RETURN 1;');
      
      // 获取统计信息
      const dbManager = getTestDatabaseManager();
      const stats = await dbManager.getDatabaseStats();
      
      return {
        isConnected: true,
        stats
      };
    } catch (error: any) {
      return {
        isConnected: false,
        error: error.message || String(error)
      };
    }
  }

  /**
   * 清理测试环境
   */
  static async cleanupTestEnvironment(): Promise<void> {
    try {
      console.log('🧹 开始清理测试环境...');
      
      const dbManager = getTestDatabaseManager();
      
      // 清除认证状态
      await dbManager.clearAuth();
      
      // 可选：重置数据库状态
      // await dbManager.resetDatabase();
      
      console.log('✅ 测试环境清理完成');
    } catch (error) {
      console.warn('⚠️ 测试环境清理失败:', error);
    }
  }

  /**
   * 内存使用情况报告
   */
  static getMemoryUsage(): NodeJS.MemoryUsage {
    return process.memoryUsage();
  }

  /**
   * 诊断数据库Schema状态
   */
  static async diagnoseDatabaseSchema(): Promise<{
    tables: string[];
    tableStats: Record<string, number>;
    errors: string[];
  }> {
    const errors: string[] = [];
    const tables: string[] = [];
    const tableStats: Record<string, number> = {};

    try {
      const db = getTestDatabase();

      // 获取所有表信息 - 移除分号，SurrealQL不需要分号
      const tableInfo = await db.query('INFO FOR DB');
      console.log('数据库信息:', JSON.stringify(tableInfo, null, 2));

      // 检查关键表
      const keyTables = ['user', 'case', 'role', 'operation_metadata', 'menu_metadata'];
      
      for (const tableName of keyTables) {
        try {
          const result = await db.query(`SELECT count() AS count FROM ${tableName} GROUP ALL`);
          const count = result?.[0]?.[0]?.count || 0;
          tableStats[tableName] = count;
          tables.push(tableName);
        } catch (error: any) {
          errors.push(`表 ${tableName} 查询失败: ${error.message}`);
        }
      }
    } catch (error: any) {
      errors.push(`数据库Schema诊断失败: ${error.message}`);
    }

    return { tables, tableStats, errors };
  }

  /**
   * 验证测试数据完整性
   */
  static async validateTestData(): Promise<{
    isValid: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    try {
      const db = getTestDatabase();

      // 检查admin用户
      const adminUsers = await db.query('SELECT * FROM user WHERE username = "admin"');
      if (!adminUsers[0] || adminUsers[0].length === 0) {
        issues.push('缺少admin用户');
        recommendations.push('运行数据库初始化脚本创建admin用户');
      }

      // 检查角色
      const roles = await db.query('SELECT count() AS count FROM role GROUP ALL');
      const roleCount = roles?.[0]?.[0]?.count || 0;
      if (roleCount === 0) {
        issues.push('缺少角色数据');
        recommendations.push('运行Schema脚本初始化角色数据');
      }

      // 检查权限系统
      const operations = await db.query('SELECT count() AS count FROM operation_metadata GROUP ALL');
      const operationCount = operations?.[0]?.[0]?.count || 0;
      if (operationCount === 0) {
        issues.push('缺少操作元数据');
        recommendations.push('运行Schema脚本初始化权限系统');
      }

    } catch (error: any) {
      issues.push(`测试数据验证失败: ${error.message}`);
      recommendations.push('检查数据库连接和Schema状态');
    }

    return {
      isValid: issues.length === 0,
      issues,
      recommendations
    };
  }

  /**
   * 生成完整的诊断报告
   */
  static async generateDiagnosticReport(): Promise<string> {
    console.log('🔍 生成测试诊断报告...');

    const connectionStatus = await this.checkDatabaseConnection();
    const schemaStatus = await this.diagnoseDatabaseSchema();
    const dataValidation = await this.validateTestData();
    const memoryUsage = this.getMemoryUsage();

    const report = `
=== 测试环境诊断报告 ===

📊 内存使用情况:
- RSS: ${Math.round(memoryUsage.rss / 1024 / 1024)}MB
- Heap Used: ${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB
- Heap Total: ${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB
- External: ${Math.round(memoryUsage.external / 1024 / 1024)}MB

🔌 数据库连接状态:
- 连接状态: ${connectionStatus.isConnected ? '✅ 正常' : '❌ 失败'}
${connectionStatus.error ? `- 错误信息: ${connectionStatus.error}` : ''}
${connectionStatus.stats ? `- 数据库统计: ${JSON.stringify(connectionStatus.stats)}` : ''}

🗄️  数据库Schema状态:
- 发现的表: ${schemaStatus.tables.join(', ')}
- 表统计: ${JSON.stringify(schemaStatus.tableStats)}
${schemaStatus.errors.length > 0 ? `- 错误: ${schemaStatus.errors.join('; ')}` : ''}

✅ 数据验证状态:
- 数据完整性: ${dataValidation.isValid ? '✅ 正常' : '❌ 有问题'}
${dataValidation.issues.length > 0 ? `- 发现的问题: ${dataValidation.issues.join('; ')}` : ''}
${dataValidation.recommendations.length > 0 ? `- 建议: ${dataValidation.recommendations.join('; ')}` : ''}

=== 报告完成 ===
`;

    console.log(report);
    return report;
  }
}

export default TestDiagnostics;