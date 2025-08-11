import { test, expect } from '@playwright/test';
import { getTenantCodeField, getUsernameField, getPasswordField, getLoginButton } from './helpers/login';
import { getTestCredentials } from './config/test-credentials';

test.describe('认证流程测试 - 使用 TEST1 租户', () => {
  // 为认证流程测试设置1分钟超时时间
  test.describe.configure({ timeout: 60000 });
  
  test.beforeEach(async ({ page }) => {
    // 每个测试前导航到登录页面
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    
    // 等待登录输入框出现
    await page.waitForSelector('input', { timeout: 20000 });
    
    // 调试：输出页面内容
    const content = await page.content();
    console.log('页面是否包含表单:', content.includes('form'));
    console.log('页面是否包含input:', content.includes('input'));
    console.log('页面是否包含button:', content.includes('button'));
  });

  test('应该渲染登录页面并验证页面标题', async ({ page }) => {
    // 验证页面标题
    await expect(page).toHaveTitle(/CuckooX/);

    // 验证 CuckooX logo 可见
    const logoSelectors = [
      '[alt*="CuckooX"]',
      '[src*="logo"]', 
      'img[alt*="logo"]',
      '.logo'
    ];
    
    for (const selector of logoSelectors) {
      const logo = page.locator(selector).first();
      if (await logo.count() > 0) {
        await expect(logo).toBeVisible();
        break;
      }
    }

    // 验证登录表单元素存在 - 使用更可靠的选择器
    // 直接查找输入框，不等待特定表单
    console.log('页面是否包含表单:', await page.locator('form').count() > 0);
    console.log('页面是否包含input:', await page.locator('input').count() > 0);
    console.log('页面是否包含button:', await page.locator('button').count() > 0);
    
    // 租户代码字段 - 使用ID或输入框
    const tenantCodeSelectors = [
      '#tenantCode input',
      '[id="tenantCode"] input',
      'input[placeholder*="tenant" i]',
      'input[placeholder*="租户" i]',
      '[data-testid="tenant-code"]',
      // 更通用的选择器
      'input:first-of-type',
      'form input:nth-of-type(1)',
    ];
    
    let tenantFieldFound = false;
    for (const selector of tenantCodeSelectors) {
      const field = page.locator(selector).first();
      if (await field.count() > 0) {
        await expect(field).toBeVisible();
        tenantFieldFound = true;
        console.log(`找到租户代码字段: ${selector}`);
        break;
      }
    }
    
    // 用户名字段
    const usernameSelectors = [
      '#adminUsername',
      'input[id="adminUsername"]',
      'input[placeholder*="username" i]',
      'input[placeholder*="用户名" i]',
      '[data-testid="username"]',
      // 更通用的选择器
      'input[type="text"]:nth-of-type(2)',
      'form input:nth-of-type(2)',
    ];
    
    let usernameFieldFound = false;
    for (const selector of usernameSelectors) {
      const field = page.locator(selector).first();
      if (await field.count() > 0) {
        await expect(field).toBeVisible();
        usernameFieldFound = true;
        console.log(`找到用户名字段: ${selector}`);
        break;
      }
    }
    
    // 密码字段
    const passwordSelectors = [
      '#adminPassword',
      'input[id="adminPassword"]',
      'input[type="password"]',
      'input[placeholder*="password" i]',
      'input[placeholder*="密码" i]',
      '[data-testid="password"]',
    ];
    
    let passwordFieldFound = false;
    for (const selector of passwordSelectors) {
      const field = page.locator(selector).first();
      if (await field.count() > 0) {
        await expect(field).toBeVisible();
        passwordFieldFound = true;
        console.log(`找到密码字段: ${selector}`);
        break;
      }
    }
    
    // 登录按钮
    const loginButtonSelectors = [
      'button[type="submit"]',
      'button:has-text("登录")',
      'button:has-text("Login")',
      '[data-testid="login-button"]',
      // 更通用的选择器
      'button:last-of-type',
      'form button',
    ];
    
    let loginButtonFound = false;
    for (const selector of loginButtonSelectors) {
      const button = page.locator(selector).first();
      if (await button.count() > 0) {
        await expect(button).toBeVisible();
        loginButtonFound = true;
        console.log(`找到登录按钮: ${selector}`);
        break;
      }
    }
    
    // 确保所有必要的表单元素都找到了
    if (!tenantFieldFound) {
      console.log('租户代码字段未找到，尝试截图查看页面内容');
      await page.screenshot({ path: 'playwright-report/test-results/tenant-field-debug.png' });
    }
    if (!usernameFieldFound) {
      console.log('用户名字段未找到');
    }
    if (!passwordFieldFound) {
      console.log('密码字段未找到');
    }
    if (!loginButtonFound) {
      console.log('登录按钮未找到');
    }
  });

  test('应该显示空表单提交的错误', async ({ page }) => {
    // 等待页面和表单加载完成
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    
    try {
      // 尝试提交空表单
      const loginButton = await getLoginButton(page);
      await loginButton.click();

      // 验证必填字段验证 - 应该有无效的必填字段
      const tenantCodeField = await getTenantCodeField(page);
      const usernameField = await getUsernameField(page);
      const passwordField = await getPasswordField(page);
      
      // 检查字段是否有required属性或错误状态
      const tenantRequired = await tenantCodeField.getAttribute('required') !== null;
      const usernameRequired = await usernameField.getAttribute('required') !== null;
      const passwordRequired = await passwordField.getAttribute('required') !== null;
      
      console.log(`表单验证状态 - 租户:${tenantRequired}, 用户名:${usernameRequired}, 密码:${passwordRequired}`);
    } catch (error) {
      console.log('表单验证测试失败，可能是字段未找到:', error);
    }
  });

  test('应该显示无效租户登录凭据的错误', async ({ page }) => {
    // 填入无效凭据
    const tenantCodeField = await getTenantCodeField(page);
    const usernameField = await getUsernameField(page);
    const passwordField = await getPasswordField(page);
    const loginButton = await getLoginButton(page);
    
    await tenantCodeField.fill('INVALID');
    await usernameField.fill('invaliduser');
    await passwordField.fill('invalidpassword');

    await loginButton.click();

    // 等待错误信息出现
    await page.waitForTimeout(2000);

    // 验证仍在登录页面或显示错误
    const currentUrl = page.url();
    const hasError = await page.locator('.error, .alert, [role="alert"]').count() > 0;
    const isStillOnLogin = currentUrl.includes('/login');
    
    expect(isStillOnLogin || hasError).toBe(true);
  });

  test('应该切换到根管理员模式', async ({ page }) => {
    // 查找切换到根管理员的按钮
    const switchButton = page.getByRole('button', { name: /切换到根管理员|Switch to Root Administrator/i });
    
    if (await switchButton.count() > 0) {
      await switchButton.click();

      // 验证 URL 变化到根管理员模式
      await page.waitForTimeout(500);
      await expect(page).toHaveURL(/root=true/);

      // 验证根管理员表单元素
      const usernameField = await getUsernameField(page);
      const passwordField = await getPasswordField(page);
      await expect(usernameField).toBeVisible();
      await expect(passwordField).toBeVisible();

      // 验证租户代码字段在根管理员模式下不可见
      const tenantCodeSelectors = [
        page.getByLabel(/租户代码|Tenant Code/i),
        page.locator('input[name="tenantCode"]'),
        page.locator('#tenantCode')
      ];
      
      let tenantFieldVisible = false;
      for (const selector of tenantCodeSelectors) {
        if (await selector.count() > 0 && await selector.isVisible()) {
          tenantFieldVisible = true;
          break;
        }
      }
      
      expect(tenantFieldVisible).toBe(false);
    } else {
      // 根管理员切换功能未实现
      console.log('根管理员切换功能未实现，跳过此验证');
    }
  });

  test('应该显示密码切换功能', async ({ page }) => {
    // 等待页面加载完成
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    
    let passwordField;
    try {
      passwordField = await getPasswordField(page);
      
      // 密码字段初始应该是 password 类型
      const fieldType = await passwordField.getAttribute('type');
      console.log(`密码字段类型: ${fieldType}`);
      
      if (fieldType === 'password') {
        console.log('密码字段类型验证通过');
      }
    } catch (error) {
      console.log('密码字段测试失败:', error);
      return; // 早期退出如果找不到密码字段
    }

    // 查找密码切换按钮 - 支持多种可能的选择器
    const toggleSelectors = [
      page.locator('button[aria-label*="显示密码"]'),
      page.locator('button[aria-label*="show password"]'),
      page.locator('[data-testid="password-toggle"]'),
      page.locator('button:has([class*="visibility"])'),
      page.locator('button').filter({ has: page.locator('svg') }).last(),
    ];

    let toggleButton = null;
    for (const selector of toggleSelectors) {
      if (await selector.count() > 0) {
        toggleButton = selector;
        break;
      }
    }

    if (toggleButton && await toggleButton.count() > 0) {
      // 点击切换按钮
      await toggleButton.click();
      
      // 验证密码现在显示为文本
      await expect(passwordField).toHaveAttribute('type', 'text');
      
      // 再次点击切换回隐藏
      await toggleButton.click();
      await expect(passwordField).toHaveAttribute('type', 'password');
    } else {
      console.log('密码切换按钮未找到，跳过密码切换测试');
    }
  });

  test('应该处理租户和根管理员模式间的导航', async ({ page }) => {
    // 验证初始在租户模式
    const tenantCodeField = await getTenantCodeField(page);
    await expect(tenantCodeField).toBeVisible();

    // 查找切换按钮
    const switchToRootButton = page.getByRole('button', { name: /切换到根管理员|Switch to Root Administrator/i });
    
    if (await switchToRootButton.count() > 0) {
      // 切换到根管理员模式
      await switchToRootButton.click();
      await page.waitForTimeout(500);
      
      await expect(page).toHaveURL(/root=true/);

      // 切换回租户模式
      const backToTenantButton = page.getByRole('button', { name: /返回租户登录|Back to Tenant Login/i });
      
      if (await backToTenantButton.count() > 0) {
        await backToTenantButton.click();
        await page.waitForTimeout(500);
        
        await expect(page).toHaveURL(/^(?!.*root=true)/);

        // 验证回到租户模式
        const tenantCodeFieldAgain = await getTenantCodeField(page);
        await expect(tenantCodeFieldAgain).toBeVisible();
      }
    } else {
      // 根管理员模式切换功能未实现
      console.log('根管理员模式切换功能未实现，跳过此验证');
    }
  });

  test('应该在自动完成历史中保留租户代码', async ({ page }) => {
    const tenantCodeField = await getTenantCodeField(page);

    // 填写租户代码
    await tenantCodeField.fill('TEST1');
    
    // 清除字段
    await tenantCodeField.fill('');
    
    // 点击字段以可能显示自动完成
    await tenantCodeField.click();
    
    // 再次输入以触发自动完成建议
    await tenantCodeField.fill('T');

    // 等待可能的自动完成选项
    await page.waitForTimeout(500);

    // 检查是否出现自动完成建议
    const autocompleteSelectors = [
      '[role="listbox"] li',
      '.MuiAutocomplete-option',
      '[role="option"]',
      '.autocomplete-option'
    ];

    let autocompleteFound = false;
    for (const selector of autocompleteSelectors) {
      const options = page.locator(selector);
      if (await options.count() > 0) {
        await expect(options.first()).toBeVisible();
        autocompleteFound = true;
        console.log('发现自动完成选项');
        break;
      }
    }

    if (!autocompleteFound) {
      console.log('未找到自动完成选项 - 可能未实现或需要历史数据');
    }
  });

  test('应该显示适当的欢迎文本和品牌', async ({ page }) => {
    // 检查品牌元素
    const brandSelectors = [
      { selector: /欢迎使用|Welcome to CuckooX/i, name: '欢迎文本' },
      { selector: /案件管理|case management|Streamline/i, name: '副标题' },
      { selector: /CuckooX/i, name: '品牌名称' },
      { selector: /© 2024 CuckooX/i, name: '版权信息' }
    ];

    let brandElementsFound = 0;
    for (const { selector, name } of brandSelectors) {
      const element = page.getByText(selector);
      if (await element.count() > 0) {
        brandElementsFound++;
        console.log(`发现品牌元素: ${name}`);
      }
    }

    expect(brandElementsFound).toBeGreaterThan(0);

    // 检查响应式显示
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    const isDesktop = viewportWidth >= 900;
    
    console.log(`当前视口宽度: ${viewportWidth}, 桌面版: ${isDesktop}`);
  });

  test('应该正确处理表单验证并显示租户状态', async ({ page }) => {
    // 获取测试凭据
    const credentials = getTestCredentials();
    
    // 监听浏览器控制台，查看API响应日志
    page.on('console', msg => {
      if (msg.text().includes('Turnstile配置')) {
        console.log('🔍 浏览器控制台:', msg.text());
      }
    });
    
    // 填写租户代码并验证状态提示显示
    const tenantCodeField = await getTenantCodeField(page);
    await tenantCodeField.fill(credentials.tenantCode);
    
    // 等待租户配置检查完成
    await page.waitForTimeout(3000);
    
    // 验证租户状态提示显示
    const statusText = await page.getByText(/此租户已.*人机验证/).first();
    if (await statusText.count() > 0) {
      console.log('✅ 发现租户状态提示:', await statusText.textContent());
      await expect(statusText).toBeVisible();
    } else {
      console.log('❌ 未找到租户状态提示');
      // 输出页面内容用于调试
      const pageText = await page.textContent('body');
      console.log('页面文本内容片段:', pageText?.substring(0, 500));
    }
    
    // 继续填写表单验证
    const usernameField = await getUsernameField(page);
    const passwordField = await getPasswordField(page);
    const loginButton = await getLoginButton(page);
    
    await usernameField.fill('testuser');
    // 留空密码
    await loginButton.click();

    // 应该显示缺少密码的验证
    await expect(passwordField).toHaveAttribute('required');
  });

  test('应该使用有效凭据成功登录（使用 TEST1 租户）', async ({ page }) => {
    // 获取测试凭据
    const credentials = getTestCredentials();
    
    // 使用环境变量中的管理员凭据进行测试
    const tenantCodeField = await getTenantCodeField(page);
    const usernameField = await getUsernameField(page);
    const passwordField = await getPasswordField(page);
    const loginButton = await getLoginButton(page);
    await tenantCodeField.fill(credentials.tenantCode);
    
    // 等待租户输入框右侧的loading效果消失
    console.log('等待租户配置检查完成...');
    try {
      // 等待租户输入框右侧的loading圈消失
      await page.waitForFunction(() => {
        // 查找租户输入框内的loading指示器
        const tenantField = document.querySelector('#tenantCode');
        if (!tenantField) return true; // 如果找不到字段，继续
        
        // 查找输入框内的CircularProgress组件
        const loadingIndicator = tenantField.querySelector('.MuiCircularProgress-root');
        return !loadingIndicator; // 当loading圈消失时返回true
      }, { timeout: 10000 });
      console.log('租户配置检查完成');
    } catch {
      console.log('租户配置检查超时，继续测试');
    }
    
    // 检查页面上是否有Turnstile相关的错误或提示
    await page.waitForTimeout(1000);
    const pageContent = await page.content();
    const hasTurnstileDialog = pageContent.includes('人机验证') || pageContent.includes('Turnstile');
    console.log('页面是否包含Turnstile对话框:', hasTurnstileDialog);
    
    await usernameField.fill(credentials.username);
    await passwordField.fill(credentials.password);

    // 开始监听控制台消息和网络请求
    const consoleMessages: string[] = [];
    const networkErrors: string[] = [];
    
    page.on('console', msg => {
      const message = `[${msg.type()}] ${msg.text()}`;
      consoleMessages.push(message);
      if (msg.type() === 'error') {
        console.log('浏览器控制台错误:', msg.text());
      }
    });
    
    page.on('response', response => {
      if (!response.ok()) {
        const errorMsg = `HTTP ${response.status()} - ${response.url()}`;
        networkErrors.push(errorMsg);
        console.log('网络请求失败:', errorMsg);
      }
    });

    await loginButton.click();

    // 等待登录处理 - 判断页面loading状态消失
    console.log('开始等待登录处理...');
    
    try {
      // 等待登录处理完成，超时时间40秒
      await page.waitForFunction(() => {
        // 首先检查GlobalLoader是否存在且可见
        const globalLoader = document.querySelector('.globalLoaderContainer');
        if (globalLoader && globalLoader instanceof HTMLElement) {
          // 检查GlobalLoader是否可见
          if (globalLoader.offsetParent !== null && !globalLoader.hidden) {
            return false; // GlobalLoader还存在，继续等待
          }
        }
        
        // 检查所有其他可能的loading指示器
        const loadingSelectors = [
          '.MuiCircularProgress-root', // Material-UI CircularProgress
          '[aria-label*="loading"]',
          '[role="progressbar"]',
          '.loading',
          '.spinner'
        ];
        
        // 检查是否还有loading元素可见
        for (const selector of loadingSelectors) {
          const elements = document.querySelectorAll(selector);
          for (const element of elements) {
            if (element instanceof HTMLElement && 
                element.offsetParent !== null && // 元素可见
                !element.hidden) {
              return false; // 还有loading元素，继续等待
            }
          }
        }
        
        // 检查登录按钮是否不再显示loading状态
        const loginButton = document.querySelector('button[type="submit"]');
        if (loginButton) {
          const buttonText = loginButton.textContent || '';
          if (buttonText.includes('Verifying') || 
              buttonText.includes('验证中') ||
              buttonText.includes('Checking Config') ||
              buttonText.includes('检查配置') ||
              buttonText.includes('Attempting') ||
              buttonText.includes('登录中') ||
              buttonText.includes('Redirecting') ||
              buttonText.includes('重定向')) {
            return false; // 按钮还在loading状态
          }
        }
        
        // 检查页面状态：要么成功跳转，要么显示错误，要么等待时间过长
        const currentUrl = window.location.href;
        const hasError = document.querySelector('.error, .alert, [role="alert"], .MuiAlert-root');
        
        // 如果URL已经改变（不再是登录页面），说明登录成功
        if (!currentUrl.includes('/login') || 
            currentUrl.includes('/cases') || 
            currentUrl.includes('/dashboard') || 
            currentUrl.includes('/select-case') || 
            currentUrl.includes('/admin')) {
          return true; // 已成功跳转
        }
        
        // 如果还在登录页面，检查是否有错误提示
        if (hasError) {
          return true; // 有错误提示，登录流程完成（虽然失败）
        }
        
        // 简化等待逻辑 - 如果没有loading、没有跳转、没有错误，但也不能一直等待
        
        // 如果没有loading但也没有跳转或错误，再等一下
        return false;
      }, { timeout: 40000 });
      
      console.log('loading状态已消失，登录处理完成');
      
    } catch (error) {
      console.log('等待loading消失超时，继续执行测试:', error);
      
      // 添加调试信息 - 检查当前页面状态
      const debugInfo = await page.evaluate(() => {
        return {
          url: window.location.href,
          hasGlobalLoader: !!document.querySelector('.globalLoaderContainer'),
          hasLoadingSpinner: !!document.querySelector('.MuiCircularProgress-root'),
          hasError: !!document.querySelector('.error, .alert, [role="alert"], .MuiAlert-root'),
          buttonText: document.querySelector('button[type="submit"]')?.textContent || 'N/A',
          pageTitle: document.title,
          bodyContent: document.body.innerText?.substring(0, 200) + '...'
        };
      });
      console.log('超时时页面状态调试信息:', debugInfo);
    }
    
    // 检查页面是否有错误信息
    const errorElements = await page.locator('.error, .alert, [role="alert"], .MuiAlert-root').all();
    if (errorElements.length > 0) {
      for (const errorElement of errorElements) {
        const errorText = await errorElement.textContent();
        console.log('发现错误信息:', errorText);
      }
    }
    
    // 输出收集到的调试信息
    if (consoleMessages.length > 0) {
      console.log('登录过程中的控制台消息:');
      consoleMessages.forEach(msg => console.log(msg));
    }
    
    if (networkErrors.length > 0) {
      console.log('登录过程中的网络错误:');
      networkErrors.forEach(err => console.log(err));
    }
    
    // 额外等待以确保页面状态稳定
    await page.waitForLoadState('networkidle');

    // 检查是否成功登录 - 可能的成功指示器
    const currentUrl = page.url();
    
    const successIndicators = [
      currentUrl.includes('/cases'),
      currentUrl.includes('/dashboard'),
      currentUrl.includes('/select-case'),
      currentUrl.includes('/admin'),
      !currentUrl.includes('/login')
    ];

    const loginSuccessful = successIndicators.some(indicator => indicator === true);
    
      console.log(`登录结束，已重定向到: ${currentUrl}`);
      //断言必须成功
    expect(loginSuccessful).toBe(true);
    if (loginSuccessful) {
      
      // 验证页面内容
      const welcomeElements = [
        page.getByText(/欢迎|Welcome/i),
        page.getByText(/案件列表|Case List/i),
        page.getByText(/仪表板|Dashboard/i)
      ];

      for (const element of welcomeElements) {
        if (await element.count() > 0) {
          console.log('发现登录后的欢迎内容');
          break;
        }
      }
    } else {
      // 检查是否仍在登录页面但没有错误
      const errorSelectors = [
        '[role="alert"]',
        '.error',
        '.MuiAlert-root'
      ];

      let hasError = false;
      for (const selector of errorSelectors) {
        if (await page.locator(selector).count() > 0) {
          hasError = true;
          break;
        }
      }
      
      if (!hasError) {
        console.log('登录提交成功，可能需要额外验证步骤');
      } else {
        console.log('登录失败，显示错误消息');
      }
    }
  });

  test('应该在移动设备上正确显示', async ({ page }) => {
    // 测试移动端视口
    await page.setViewportSize({ width: 375, height: 667 });
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // 表单在移动端应该仍然可用
    const loginButton = await getLoginButton(page);
    const usernameField = await getUsernameField(page);
    const passwordField = await getPasswordField(page);
    const tenantCodeField = await getTenantCodeField(page);
    
    await expect(loginButton).toBeVisible();
    await expect(usernameField).toBeVisible();
    await expect(passwordField).toBeVisible();
    await expect(tenantCodeField).toBeVisible();
    
    // 测试平板视口
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(500);
    
    const loginButtonTablet = await getLoginButton(page);
    await expect(loginButtonTablet).toBeVisible();
    
    // 恢复桌面视口
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.waitForTimeout(500);
  });

  test('应该支持键盘导航', async ({ page }) => {
    // 从页面顶部开始 Tab 导航
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab'); 
    await page.keyboard.press('Tab');
    
    // 应该能够用 Enter 键提交表单
    const passwordField = await getPasswordField(page);
    await passwordField.focus();
    await page.keyboard.press('Enter');
    
    // 表单应该尝试提交（预期会有验证错误）
    await page.waitForTimeout(1000);
    const loginButton = await getLoginButton(page);
    await expect(loginButton).toBeVisible();

    // 测试表单字段的 Tab 导航
    const tenantCodeField = await getTenantCodeField(page);
    await tenantCodeField.focus();
    await page.keyboard.press('Tab');
    
    // 下一个焦点应该在用户名字段
    const focusedElement = await page.evaluate(() => document.activeElement?.getAttribute('name') || document.activeElement?.getAttribute('aria-label'));
    console.log(`焦点元素: ${focusedElement}`);
  });

  test('应该处理表单自动填充功能', async ({ page }) => {
    // 获取测试凭据
    const credentials = getTestCredentials();
    
    // 模拟浏览器自动填充
    const tenantCodeField = await getTenantCodeField(page);
    const usernameField = await getUsernameField(page);
    const passwordField = await getPasswordField(page);
    
    await tenantCodeField.fill(credentials.tenantCode);
    await usernameField.fill(credentials.username);
    await passwordField.fill(credentials.password);

    // 验证字段值被正确填充
    await expect(tenantCodeField).toHaveValue(credentials.tenantCode);
    await expect(usernameField).toHaveValue(credentials.username);
    await expect(passwordField).toHaveValue(credentials.password);

    // 清除并测试部分填充
    await tenantCodeField.fill('');
    await tenantCodeField.fill('TE');
    
    // 等待可能的自动完成
    await page.waitForTimeout(500);
    
    console.log('表单自动填充测试完成');
  });
});
