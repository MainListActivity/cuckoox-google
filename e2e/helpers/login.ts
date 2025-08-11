import { Page, expect } from '@playwright/test';
import { getTestCredentials } from '../config/test-credentials';

/**
 * 获取租户代码字段的多重选择器
 */
export async function getTenantCodeField(page: Page) {
  // 先等待页面稳定
  await page.waitForTimeout(1000);
  
  // 等待表单完全加载和配置检查完成
  try {
    // 等待"Checking Config..."状态消失
    await page.waitForFunction(() => {
      const bodyText = document.body.textContent || '';
      const checkingTexts = ['Checking Config', 'checking config', 'config'];
      const hasChecking = checkingTexts.some(text => bodyText.toLowerCase().includes(text.toLowerCase()));
      return !hasChecking;
    }, { timeout: 15000 });
  } catch {
    console.log('等待配置检查完成超时，继续查找字段');
  }
  
  const selectors = [
    // MUI Autocomplete 特定选择器（租户代码使用Autocomplete组件）
    () => page.locator('.MuiAutocomplete-root input'),
    () => page.locator('#tenantCode input'),
    () => page.locator('[id*="tenantCode"] input'),
    // 标签和属性选择器
    () => page.getByLabel(/租户代码|Tenant Code/i),
    () => page.locator('input[name="tenantCode"]'),
    () => page.locator('input[placeholder*="租户代码"]'),
    () => page.locator('input[placeholder*="Tenant Code"]'),
    () => page.locator('input[placeholder*="tenant code" i]'),
    () => page.locator('input[data-testid="tenant-code"]'),
    // 通用MUI选择器
    () => page.locator('.MuiTextField-root input').first(),
    () => page.locator('.MuiFormControl-root input').first(),
    // 基于位置的选择器
    () => page.locator('form input[type="text"]:first-of-type'),
    () => page.locator('input[type="text"]').first(),
    () => page.locator('form').locator('input').first(),
    () => page.locator('input').first(),
  ];
  
  for (const selector of selectors) {
    try {
      const element = selector();
      if (await element.count() > 0) {
        // 确保元素可见且可交互
        await element.waitFor({ state: 'visible', timeout: 3000 });
        
        // 验证这确实是租户代码字段（通过检查父元素或属性）
        const inputValue = await element.inputValue().catch(() => '');
        const placeholder = await element.getAttribute('placeholder').catch(() => '');
        
        if (placeholder && (placeholder.includes('租户') || placeholder.toLowerCase().includes('tenant'))) {
          console.log(`找到租户代码字段（通过placeholder验证）`);
          return element;
        }
        
        console.log(`找到租户代码字段`);
        return element;
      }
    } catch {
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
    // 基于ID和属性的精确选择器
    () => page.locator('#adminUsername'),
    () => page.locator('input[name="adminUsername"]'),
    () => page.locator('input[name="username"]'),
    // 基于label的选择器
    () => page.getByLabel(/用户名|Username/i),
    // 基于placeholder的选择器
    () => page.locator('input[placeholder*="用户名"]'),
    () => page.locator('input[placeholder*="Username"]'),
    () => page.locator('input[placeholder*="username" i]'),
    () => page.locator('input[data-testid="username"]'),
    () => page.locator('[id*="username"]'),
    () => page.locator('input[autocomplete="username"]'),
    // MUI 组件特定选择器 - 排除Autocomplete字段
    () => page.locator('.MuiTextField-root:not(.MuiAutocomplete-root) input').first(),
    () => page.locator('.MuiFormControl-root:not(.MuiAutocomplete-root) input').first(),
    // 基于位置的选择器 - 第二个text输入框
    () => page.locator('form input[type="text"]:nth-of-type(2)'),
    () => page.locator('input[type="text"]').nth(1),
    () => page.locator('form').locator('input[type="text"]').nth(1),
  ];
  
  for (const selector of selectors) {
    try {
      const element = selector();
      if (await element.count() > 0) {
        await element.waitFor({ state: 'visible', timeout: 3000 });
        
        // 验证这确实是用户名字段（通过检查placeholder或id）
        const placeholder = await element.getAttribute('placeholder').catch(() => '');
        const id = await element.getAttribute('id').catch(() => '');
        
        if (placeholder && (placeholder.includes('用户名') || placeholder.toLowerCase().includes('username')) ||
            id && id.toLowerCase().includes('username')) {
          console.log(`找到用户名字段（通过属性验证）`);
          return element;
        }
        
        console.log(`找到用户名字段`);
        return element;
      }
    } catch {
      continue;
    }
  }
  
  console.log('用户名字段未找到');
  return page.locator('input[type="text"]').nth(1); // 返回第二个text输入框
}

/**
 * 获取密码字段的多重选择器
 */
export async function getPasswordField(page: Page) {
  await page.waitForTimeout(500);
  
  const selectors = [
    // 基于ID和属性的精确选择器
    () => page.locator('#adminPassword'),
    () => page.locator('input[name="adminPassword"]'),
    () => page.locator('input[name="password"]'),
    () => page.locator('input[type="password"]'),
    // 基于label的选择器
    () => page.getByLabel(/密码|Password/i),
    // 基于placeholder的选择器
    () => page.locator('input[placeholder*="密码"]'),
    () => page.locator('input[placeholder*="Password"]'),
    () => page.locator('input[placeholder*="password" i]'),
    () => page.locator('input[data-testid="password"]'),
    () => page.locator('[id*="password"]'),
    () => page.locator('input[autocomplete="current-password"]'),
    // MUI 组件特定选择器
    () => page.locator('.MuiTextField-root input[type="password"]'),
    () => page.locator('.MuiFormControl-root input[type="password"]'),
    () => page.locator('form input[type="password"]'),
  ];
  
  for (const selector of selectors) {
    try {
      const element = selector();
      if (await element.count() > 0) {
        await element.waitFor({ state: 'visible', timeout: 3000 });
        console.log(`找到密码字段`);
        return element;
      }
    } catch {
      continue;
    }
  }
  
  console.log('密码字段未找到');
  return page.locator('input[type="password"]').first(); // 返回第一个密码类型的输入框
}

/**
 * 获取登录按钮的多重选择器
 */
export async function getLoginButton(page: Page) {
  await page.waitForTimeout(500);
  
  // 等待按钮不是禁用状态
  try {
    await page.waitForFunction(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const loginButton = buttons.find(btn => 
        btn.textContent?.includes('登录') || 
        btn.textContent?.includes('Login') || 
        btn.type === 'submit'
      );
      return loginButton && !loginButton.disabled;
    }, { timeout: 10000 });
  } catch {
    console.log('等待登录按钮启用超时，继续查找');
  }
  
  const selectors = [
    // 基于role和文本的选择器
    () => page.getByRole('button', { name: /登录|Login/i }),
    () => page.locator('button[type="submit"]:not(:disabled)'),
    // 基于文本内容的选择器
    () => page.locator('button:has-text("登录"):not(:disabled)'),
    () => page.locator('button:has-text("Login"):not(:disabled)'),
    () => page.locator('button[data-testid="login-button"]'),
    // MUI 组件特定选择器
    () => page.locator('.MuiButton-root.MuiButton-contained:has-text("登录"):not(:disabled)'),
    () => page.locator('.MuiButton-root.MuiButton-contained:has-text("Login"):not(:disabled)'),
    () => page.locator('.MuiButton-root[type="submit"]:not(:disabled)'),
    () => page.locator('.MuiButton-root.MuiButton-contained:not(:disabled)').last(),
    // 表单内的按钮
    () => page.locator('form button:not(:disabled)').last(),
    // 位置选择器（最后的submit按钮）
    () => page.locator('button[type="submit"]').last(),
    () => page.locator('button:not(:disabled)').last(),
  ];
  
  for (const selector of selectors) {
    try {
      const element = selector();
      if (await element.count() > 0) {
        await element.waitFor({ state: 'visible', timeout: 3000 });
        
        // 验证按钮是否可点击（不被禁用）
        const isDisabled = await element.isDisabled().catch(() => false);
        if (isDisabled) {
          console.log('登录按钮被禁用，跳过此选择器');
          continue;
        }
        
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
  
  // 获取测试凭据
  const credentials = getTestCredentials();
  
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  
  // 等待应用初始化完成，关键是等待"正在加载会话"消失且表单出现
  console.log('等待"正在加载会话..."消失且表单出现...');
  
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
    // 登录按钮（submit 类型或包含"登录"文本的按钮）
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
    await tenantCodeField.fill(credentials.tenantCode);
    console.log(`租户代码已填写: ${credentials.tenantCode}`);
    await page.waitForTimeout(500);
    
    await usernameField.fill(credentials.username);
    console.log(`用户名已填写: ${credentials.username}`);
    await page.waitForTimeout(500);
    
    await passwordField.fill(credentials.password);
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
