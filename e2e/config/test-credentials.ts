/**
 * E2E测试凭据配置
 * 
 * 这个文件管理E2E测试所需的登录凭据
 * 在CI/CD环境中，这些值应该通过环境变量（GitHub Secrets）设置
 * 在本地开发中，可以通过 .env.test.local 文件覆盖默认值
 */

export interface TestCredentials {
  tenantCode: string;
  username: string;
  password: string;
}

/**
 * 获取E2E测试凭据
 * 优先级：环境变量 > .env.test 文件中的默认值
 */
export function getTestCredentials(): TestCredentials {
  const tenantCode = process.env.E2E_TEST_TENANT_CODE || 'TEST1';
  const username = process.env.E2E_TEST_USERNAME || 'admin';
  const password = process.env.E2E_TEST_PASSWORD;
  
  if (!password) {
    throw new Error(
      'E2E_TEST_PASSWORD environment variable is required. ' +
      'In CI environments, set this via GitHub Secrets. ' +
      'For local development, add it to .env.test.local file.'
    );
  }
  
  return {
    tenantCode,
    username,
    password
  };
}

/**
 * 获取root管理员测试凭据
 */
export function getRootAdminCredentials(): Omit<TestCredentials, 'tenantCode'> {
  const username = process.env.E2E_ROOT_ADMIN_USERNAME || 'root';
  const password = process.env.E2E_ROOT_ADMIN_PASSWORD;
  
  if (!password) {
    throw new Error(
      'E2E_ROOT_ADMIN_PASSWORD environment variable is required for root admin tests. ' +
      'In CI environments, set this via GitHub Secrets. ' +
      'For local development, add it to .env.test.local file.'
    );
  }
  
  return {
    username,
    password
  };
}

/**
 * 检查是否有必要的测试凭据
 */
export function hasTestCredentials(): boolean {
  return !!(process.env.E2E_TEST_PASSWORD);
}

/**
 * 检查是否有root管理员测试凭据
 */
export function hasRootAdminCredentials(): boolean {
  return !!(process.env.E2E_ROOT_ADMIN_PASSWORD);
}