import { Page, expect } from '@playwright/test';

/**
 * 获取租户代码字段的多重选择器
 */
export async function getTenantCodeField(page: Page) {
  // 先等待一些时间让页面渲染
  await page.waitForTimeout(1000);
  
  const selectors = [
    () => page.getByLabel(/租户代码|Tenant Code/i),
    () => page.locator('input[name="tenantCode"]'),
    () => page.locator('input[placeholder*="租户代码"]'),
    () => page.locator('input[placeholder*="Tenant Code"]'),
    () => page.locator('input[data-testid="tenant-code"]'),
    () => page.locator('.MuiAutocomplete-root input'),
    () => page.locator('#tenantCode'),
    () => page.locator('[id*="tenant"]'),
    // MUI 组件特定选择器
    () => page.locator('.MuiTextField-root input').first(),
    () => page.locator('.MuiFormControl-root input').first(),
    () => page.locator('form input[type="text"]:first-of-type'),
    () => page.locator('input[type="text"]').first(),
    // 更通用的选择器
    () => page.locator('form').locator('input').first(),
    () => page.locator('input').first(),
  ];
  
  for (const selector of selectors) {
    try {
      const element = selector();
      if (await element.count() > 0) {
        // 等待元素可见
        await element.waitFor({ state: 'visible', timeout: 2000 });
        console.log(`找到租户代码字段`);
        return element;
      }
    } catch {
      // 继续尝试下一个选择器
      continue;
    }
  }
  
  console.log('租户代码字段未找到，尝试截图查看页面内容');
  await page.screenshot({ path: 'playwright-report/test-results/tenant-code-debug.png' });
  return page.locator('input').first(); // 返回第一个输入框
}

/**
 * 获取用户名字段的多重选择器
 */
export async function getUsernameField(page: Page) {
  await page.waitForTimeout(500);
  
  const selectors = [
    () => page.getByLabel(/用户名|Username/i),
    () => page.locator('input[name="username"]'),
    () => page.locator('input[name="adminUsername"]'),
    () => page.locator('input[placeholder*="用户名"]'),
    () => page.locator('input[placeholder*="Username"]'),
    () => page.locator('input[data-testid="username"]'),
    () => page.locator('#adminUsername'),
    () => page.locator('[id*="username"]'),
    () => page.locator('input[autocomplete="username"]'),
    // MUI 组件特定选择器
    () => page.locator('.MuiTextField-root input').nth(1),
    () => page.locator('.MuiFormControl-root input').nth(1),
    () => page.locator('form input[type="text"]:nth-of-type(2)'),
    () => page.locator('input[type="text"]').nth(1),
    () => page.locator('form').locator('input').nth(1),
  ];
  
  for (const selector of selectors) {
    try {
      const element = selector();
      if (await element.count() > 0) {
        await element.waitFor({ state: 'visible', timeout: 2000 });
        console.log(`找到用户名字段`);
        return element;
      }
    } catch {
      continue;
    }
  }
  
  console.log('用户名字段未找到');
  return page.locator('input').nth(1); // 返回第二个输入框
}

/**
 * 获取密码字段的多重选择器
 */
export async function getPasswordField(page: Page) {
  await page.waitForTimeout(500);
  
  const selectors = [
    () => page.getByLabel(/密码|Password/i),
    () => page.locator('input[name="password"]'),
    () => page.locator('input[name="adminPassword"]'),
    () => page.locator('input[type="password"]'),
    () => page.locator('input[placeholder*="密码"]'),
    () => page.locator('input[placeholder*="Password"]'),
    () => page.locator('input[data-testid="password"]'),
    () => page.locator('#adminPassword'),
    () => page.locator('[id*="password"]'),
    () => page.locator('input[autocomplete="current-password"]'),
    // MUI 组件特定选择器
    () => page.locator('.MuiTextField-root input[type="password"]'),
    () => page.locator('.MuiFormControl-root input[type="password"]'),
    () => page.locator('form').locator('input[type="password"]'),
  ];
  
  for (const selector of selectors) {
    try {
      const element = selector();
      if (await element.count() > 0) {
        await element.waitFor({ state: 'visible', timeout: 2000 });
        console.log(`找到密码字段`);
        return element;
      }
    } catch {
      continue;
    }
  }
  
  console.log('密码字段未找到');
  return page.locator('input[type="password"]'); // 返回密码类型的输入框
}

/**
 * 获取登录按钮的多重选择器
 */
export async function getLoginButton(page: Page) {
  await page.waitForTimeout(500);
  
  const selectors = [
    () => page.getByRole('button', { name: /登录|Login/i }),
    () => page.locator('button[type="submit"]'),
    () => page.locator('button:has-text("登录")'),
    () => page.locator('button:has-text("Login")'),
    () => page.locator('button[data-testid="login-button"]'),
    () => page.locator('form button'),
    // MUI 组件特定选择器
    () => page.locator('.MuiButton-root:has-text("登录")'),
    () => page.locator('.MuiButton-root:has-text("Login")'),
    () => page.locator('.MuiButton-root[type="submit"]'),
    () => page.locator('button:last-of-type'),
    () => page.locator('button').last(),
  ];
  
  for (const selector of selectors) {
    try {
      const element = selector();
      if (await element.count() > 0) {
        await element.waitFor({ state: 'visible', timeout: 2000 });
        console.log(`找到登录按钮`);
        return element;
      }
    } catch {
      continue;
    }
  }
  
  console.log('登录按钮未找到');
  return page.locator('button').last(); // 返回最后一个按钮
}

/**
 * 使用管理员凭据登录
 */
export async function loginAsAdmin(page: Page) {
  console.log('开始管理员登录流程...');
  
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  
  // 等待应用初始化完成，关键是等待“正在加载会话”消失且表单出现
  console.log('等待“正在加载会话...”消失且表单出现...');
  
  try {
    // 等待加载页面消失并且登录表单出现
    await page.waitForFunction(() => {
      // 检查是否仍在显示加载
      const loadingTexts = ['正在加载会话'];
      const bodyText = document.body.textContent || '';
      const isLoadingGone = !loadingTexts.some(text => bodyText.includes(text));
      
      // 检查是否有登录表单元素
      const hasPasswordInput = document.querySelector('input[type="password"]') !== null;
      const hasTextInput = document.querySelectorAll('input[type="text"]').length >= 2; // 租户代码 + 用户名
      const hasLoginButton = document.querySelector('button[type="submit"]') !== null || 
                             Array.from(document.querySelectorAll('button')).some(btn => 
                               btn.textContent?.includes('登录') || btn.textContent?.includes('Login')
                             );
      
      const formReady = hasPasswordInput && hasTextInput && hasLoginButton;
      
      if (formReady) {
        console.log('表单元素已就绪!');
      }
      
      return isLoadingGone && formReady;
    }, { timeout: 60000 }); // 增加超时时间到 60 秒
    
    console.log('登录表单已加载完成!');
  } catch (error) {
    console.log('等待登录表单加载超时，尝试继续...');
    await page.screenshot({ path: 'playwright-report/test-results/form-loading-timeout.png' });
  }
  
  // 略微等待让输入框稳定
  await page.waitForTimeout(1000);
  
  try {
    console.log('获取表单字段...');
    
    // 直接使用简单选择器首先尝试
    const allInputs = page.locator('input');
    const inputCount = await allInputs.count();
    console.log(`找到 ${inputCount} 个输入框`);
    
    if (inputCount < 3) {
      throw new Error(`输入框数量不够：${inputCount}，需要至少 3 个`);
    }
    
    // 租户代码字段（第一个 text 类型输入框）
    const tenantCodeField = page.locator('input[type="text"]').first();
    // 用户名字段（第二个 text 类型输入框）
    const usernameField = page.locator('input[type="text"]').nth(1);
    // 密码字段（第一个 password 类型输入框）
    const passwordField = page.locator('input[type="password"]').first();
    // 登录按钮（submit 类型或包含“登录”文本的按钮）
    const loginButton = page.locator('button[type="submit"]').or(
      page.locator('button:has-text("登录")')
    ).first();
    
    // 验证所有字段都存在且可见
    console.log('验证字段可见性...');
    await expect(tenantCodeField).toBeVisible();
    await expect(usernameField).toBeVisible();
    await expect(passwordField).toBeVisible();
    await expect(loginButton).toBeVisible();
    
    console.log('填写登录表单...');
    // 缓慢填写表单，每个字段间适当等待
    await tenantCodeField.fill('TEST1');
    console.log('租户代码已填写');
    await page.waitForTimeout(500);
    
    await usernameField.fill('admin');
    console.log('用户名已填写');
    await page.waitForTimeout(500);
    
    await passwordField.fill('admin123');
    console.log('密码已填写');
    await page.waitForTimeout(500);
    
    console.log('提交登录表单...');
    await loginButton.click();
    
    // 等待登录处理
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);
    
    // 验证登录结果
    const currentUrl = page.url();
    const loginSuccessful = !currentUrl.includes('/login');
    
    if (loginSuccessful) {
      console.log(`✓ 登录成功! 当前页面: ${currentUrl}`);
    } else {
      console.log(`✗ 登录失败，仍在登录页面: ${currentUrl}`);
      await page.screenshot({ path: 'playwright-report/test-results/login-failed-debug.png' });
    }
    
    return loginSuccessful;
    
  } catch (error) {
    console.error('登录过程中发生错误:', error);
    await page.screenshot({ path: 'playwright-report/test-results/login-error-debug.png' });
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
