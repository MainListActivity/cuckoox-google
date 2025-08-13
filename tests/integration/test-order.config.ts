/**
 * 集成测试执行顺序配置
 * 定义测试用例的执行顺序，确保数据依赖关系正确
 *
 * 执行顺序: admin账号创建->案件创建（指定管理人）->管理人登录->案件查询->添加案件成员->其他测试用例->案件成员登录->案件成员退出登录
 */

export interface TestOrderConfig {
  /** 测试序号 */
  order: number;
  /** 测试文件路径 */
  testFile: string;
  /** 测试描述 */
  description: string;
  /** 是否必须按顺序执行 */
  sequential: boolean;
}

/**
 * 集成测试执行顺序
 */
export const TEST_ORDER: TestOrderConfig[] = [
  // 第1步：创建admin账号
  {
    order: 1,
    testFile: 'tests/integration/auth/01-admin-creation.test.tsx',
    description: 'admin账号创建',
    sequential: true
  },

  // 第2步：案件创建（指定管理人）
  {
    order: 2,
    testFile: 'tests/integration/case/02-case-creation.test.tsx',
    description: '案件创建（指定管理人）',
    sequential: true
  },

  // 第3步：管理人登录
  {
    order: 3,
    testFile: 'tests/integration/auth/03-manager-login.test.tsx',
    description: '管理人登录',
    sequential: true
  },

  // 第4步：案件查询
  {
    order: 4,
    testFile: 'tests/integration/case/04-case-query.test.tsx',
    description: '案件查询',
    sequential: true
  },

  // 第5步：添加案件成员
  {
    order: 5,
    testFile: 'tests/integration/case/05-case-member-addition.test.tsx',
    description: '添加案件成员',
    sequential: true
  },

  // 第6-9步：其他功能测试（可并行）
  {
    order: 6,
    testFile: 'tests/integration/claims/06-claims-management.test.tsx',
    description: '债权申报管理测试',
    sequential: false
  },
  {
    order: 7,
    testFile: 'tests/integration/creditors/07-creditor-management.test.tsx',
    description: '债权人管理测试',
    sequential: false
  },
  {
    order: 8,
    testFile: 'tests/integration/documents/08-document-management.test.tsx',
    description: '文档管理测试',
    sequential: false
  },
  {
    order: 9,
    testFile: 'tests/integration/pages/09-pages-integration.test.tsx',
    description: '页面集成测试',
    sequential: false
  },

  // 第10步：案件成员登录
  {
    order: 10,
    testFile: 'tests/integration/auth/10-member-login.test.tsx',
    description: '案件成员登录',
    sequential: true
  },

  // 第11步：案件成员退出登录
  {
    order: 11,
    testFile: 'tests/integration/auth/11-member-logout.test.tsx',
    description: '案件成员退出登录',
    sequential: true
  }
];

/**
 * 获取按顺序排列的测试配置
 */
export function getOrderedTests(): TestOrderConfig[] {
  return TEST_ORDER.sort((a, b) => a.order - b.order);
}

/**
 * 获取必须顺序执行的测试
 */
export function getSequentialTests(): TestOrderConfig[] {
  return TEST_ORDER.filter(test => test.sequential)
    .sort((a, b) => a.order - b.order);
}

/**
 * 获取可以并行执行的测试
 */
export function getParallelTests(): TestOrderConfig[] {
  return TEST_ORDER.filter(test => !test.sequential);
}

/**
 * 根据文件路径获取测试配置
 */
export function getTestConfig(testFile: string): TestOrderConfig | undefined {
  return TEST_ORDER.find(test => test.testFile === testFile);
}

/**
 * 验证测试顺序配置
 */
export function validateTestOrder(): boolean {
  const orders = TEST_ORDER.map(t => t.order);
  const uniqueOrders = new Set(orders);

  if (orders.length !== uniqueOrders.size) {
    console.error('测试顺序配置中存在重复的序号');
    return false;
  }

  return true;
}
