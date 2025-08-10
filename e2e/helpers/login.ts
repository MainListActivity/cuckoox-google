import { Page } from '@playwright/test';

/**
 * 获取租户代码字段的多重选择器
 */
export async function getTenantCodeField(page: Page) {
  const selectors = [
    () => page.getByLabel(/租户代码|Tenant Code/i),
    () => page.locator('input[name="tenantCode"]'),
    () => page.locator('input[placeholder*="租户代码"]'),
    () => page.locator('input[placeholder*="Tenant Code"]'),
    () => page.locator('input[data-testid="tenant-code"]'),
    () => page.locator('.MuiAutocomplete-root input'),
    () => page.locator('input[type="text"]').first(),
  ];
  
  for (const selector of selectors) {
    const element = selector();
    if (await element.count() > 0) {
      console.log(`找到租户代码字段: ${element.toString()}`);
      return element;
    }
  }
  
  console.log('租户代码字段未找到，尝试截图查看页面内容');
  await page.screenshot({ path: 'tenant-code-debug.png' });
  return page.getByLabel(/租户代码|Tenant Code/i); // 返回默认选择器以便测试能继续
}

/**
 * 获取用户名字段的多重选择器
 */
export async function getUsernameField(page: Page) {
  const selectors = [
    () => page.getByLabel(/用户名|Username/i),
    () => page.locator('input[name="username"]'),
    () => page.locator('input[placeholder*="用户名"]'),
    () => page.locator('input[placeholder*="Username"]'),
    () => page.locator('input[data-testid="username"]'),
    () => page.locator('input[type="text"]:nth-of-type(2)'),
    () => page.locator('input[autocomplete="username"]'),
  ];
  
  for (const selector of selectors) {
    const element = selector();
    if (await element.count() > 0) {
      console.log(`找到用户名字段: ${element.toString()}`);
      return element;
    }
  }
  
  console.log('用户名字段未找到');
  return page.getByLabel(/用户名|Username/i); // 返回默认选择器
}

/**
 * 获取密码字段的多重选择器
 */
export async function getPasswordField(page: Page) {
  const selectors = [
    () => page.getByLabel(/密码|Password/i),
    () => page.locator('input[name="password"]'),
    () => page.locator('input[type="password"]'),
    () => page.locator('input[placeholder*="密码"]'),
    () => page.locator('input[placeholder*="Password"]'),
    () => page.locator('input[data-testid="password"]'),
    () => page.locator('input[autocomplete="current-password"]'),
  ];
  
  for (const selector of selectors) {
    const element = selector();
    if (await element.count() > 0) {
      console.log(`找到密码字段: ${element.toString()}`);
      return element;
    }
  }
  
  console.log('密码字段未找到');
  return page.getByLabel(/密码|Password/i); // 返回默认选择器
}

/**
 * 获取登录按钮的多重选择器
 */
export async function getLoginButton(page: Page) {
  const selectors = [
    () => page.getByRole('button', { name: /登录|Login/i }),
    () => page.locator('button[type="submit"]'),
    () => page.locator('button:has-text("登录")'),
    () => page.locator('button:has-text("Login")'),
    () => page.locator('button[data-testid="login-button"]'),
    () => page.locator('button:last-of-type'),
  ];
  
  for (const selector of selectors) {
    const element = selector();
    if (await element.count() > 0) {
      console.log(`找到登录按钮: ${element.toString()}`);
      return element;
    }
  }
  
  console.log('登录按钮未找到');
  return page.getByRole('button', { name: /登录|Login/i }); // 返回默认选择器
}

/**
 * 使用管理员凭据登录
 */
export async function loginAsAdmin(page: Page) {
  console.log('开始管理员登录流程...');
  
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  
  // 确保页面完全加载
  await page.waitForTimeout(2000);
  
  try {
    // 使用辅助函数获取字段
    const tenantCodeField = await getTenantCodeField(page);
    const usernameField = await getUsernameField(page);
    const passwordField = await getPasswordField(page);
    const loginButton = await getLoginButton(page);
    
    console.log('填写登录表单...');
    // 填写表单
    await tenantCodeField.fill('TEST1');
    await usernameField.fill('admin');
    await passwordField.fill('admin123');
    
    console.log('提交登录表单...');
    await loginButton.click();
    
    // 等待登录完成，增加超时时间
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);
    
    // 验证登录是否成功
    const currentUrl = page.url();
    const loginSuccessful = !currentUrl.includes('/login');
    
    if (loginSuccessful) {
      console.log(`登录成功，当前页面: ${currentUrl}`);
    } else {
      console.log('登录可能失败，仍在登录页面');
    }
    
    return loginSuccessful;
  } catch (error) {
    console.error('登录过程中发生错误:', error);
    return false;
  }
}

/**
 * 检查是否已登录（通过URL或页面内容）
 */
export async function isLoggedIn(page: Page): Promise<boolean> {
  try {
    // 检查URL是否不在登录页面
    const url = page.url();
    if (url.includes('/login')) {
      return false;
    }
    
    // 检查是否有登出按钮或用户信息
    const logoutButton = page.locator('button:has-text("登出"), button:has-text("Logout")');
    const userInfo = page.locator('[data-testid="user-info"], .user-info');
    
    const hasLogout = await logoutButton.count() > 0;
    const hasUserInfo = await userInfo.count() > 0;
    
    return hasLogout || hasUserInfo;
  } catch {
    return false;
  }
}
