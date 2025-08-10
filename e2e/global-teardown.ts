/**
 * Playwright 全局测试清理
 * 清理 TEST1 租户测试数据（可选）
 */

import { FullConfig } from '@playwright/test';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Global teardown: 测试完成，清理环境');
  console.log('📊 TEST1 租户数据保留，供下次测试使用');
  
  // 注意：根据 CLAUDE.md 的要求，TEST1 租户的测试数据不需要清理
  // 先运行的测试用例产生的数据在后面的测试用例中可以查询使用
  
  // 如需清理，可以在这里添加清理逻辑：
  // - 清理临时文件
  // - 关闭数据库连接
  // - 重置外部服务状态
}

export default globalTeardown;