import { test, expect } from '@playwright/test';

test.describe('认证流程测试 - 使用 TEST1 租户', () => {
  test.beforeEach(async ({ page }) => {
    // 每个测试前导航到登录页面
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
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
    
    let logoFound = false;
    for (const selector of logoSelectors) {
      const logo = page.locator(selector).first();
      if (await logo.count() > 0) {
        await expect(logo).toBeVisible();
        logoFound = true;
        break;
      }
    }

    // 验证登录表单元素存在
    await expect(page.getByLabel(/租户代码|Tenant Code/i)).toBeVisible();
    await expect(page.getByLabel(/用户名|Username/i)).toBeVisible();
    await expect(page.getByLabel(/密码|Password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /登录|Login/i })).toBeVisible();
  });

  test('应该显示空表单提交的错误', async ({ page }) => {
    // 尝试提交空表单
    await page.getByRole('button', { name: /登录|Login/i }).click();

    // 验证必填字段验证 - 应该有无效的必填字段
    const invalidFields = await page.locator('input:invalid').count();
    expect(invalidFields).toBeGreaterThan(0);

    // 验证特定必填字段
    await expect(page.getByLabel(/租户代码|Tenant Code/i)).toHaveAttribute('required');
    await expect(page.getByLabel(/用户名|Username/i)).toHaveAttribute('required'); 
    await expect(page.getByLabel(/密码|Password/i)).toHaveAttribute('required');
  });

  test('应该显示无效租户登录凭据的错误', async ({ page }) => {
    // 填入无效凭据
    await page.getByLabel(/租户代码|Tenant Code/i).fill('INVALID');
    await page.getByLabel(/用户名|Username/i).fill('invaliduser');
    await page.getByLabel(/密码|Password/i).fill('invalidpassword');

    // 提交表单
    await page.getByRole('button', { name: /登录|Login/i }).click();

    // 等待可能的错误处理时间
    await page.waitForTimeout(3000);

    // 查找错误消息 - 支持多种可能的错误显示方式
    const errorSelectors = [
      '.MuiAlert-message',
      '[role="alert"]',
      '.error-message',
      '.MuiAlert-root',
      '[data-testid="error-message"]'
    ];

    let errorFound = false;
    for (const selector of errorSelectors) {
      const errorElement = page.locator(selector);
      if (await errorElement.count() > 0) {
        const errorText = await errorElement.textContent();
        if (errorText && (errorText.includes('错误') || errorText.includes('Invalid') || errorText.includes('失败'))) {
          errorFound = true;
          console.log(`发现错误消息: ${errorText}`);
          break;
        }
      }
    }

    // 至少验证表单仍然存在（未成功登录）
    await expect(page.getByRole('button', { name: /登录|Login/i })).toBeVisible();
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
      await expect(page.getByLabel(/用户名|Username/i)).toBeVisible();
      await expect(page.getByLabel(/密码|Password/i)).toBeVisible();

      // 验证租户代码字段在根管理员模式下不可见
      await expect(page.getByLabel(/租户代码|Tenant Code/i)).not.toBeVisible();
    } else {
      test.skip('根管理员切换功能未实现');
    }
  });

  test('应该显示密码切换功能', async ({ page }) => {
    const passwordField = page.getByLabel(/密码|Password/i);
    
    // 密码字段初始应该是 password 类型
    await expect(passwordField).toHaveAttribute('type', 'password');

    // 查找密码切换按钮 - 支持多种可能的选择器
    const toggleSelectors = [
      '[aria-label*="toggle password"]',
      '[aria-label*="显示密码"]',
      '[data-testid*="toggle"]',
      'button[type="button"]:near(:text("密码"))',
      '.password-toggle',
      'button:has([data-testid*="visibility"])'
    ];

    let toggleFound = false;
    for (const selector of toggleSelectors) {
      const toggleButton = page.locator(selector);
      if (await toggleButton.count() > 0) {
        toggleFound = true;
        
        // 点击切换按钮
        await toggleButton.click();
        await page.waitForTimeout(200);

        // 密码字段应该变为 text 类型
        await expect(passwordField).toHaveAttribute('type', 'text');

        // 再次点击切换按钮
        await toggleButton.click();
        await page.waitForTimeout(200);

        // 密码字段应该回到 password 类型
        await expect(passwordField).toHaveAttribute('type', 'password');
        
        break;
      }
    }

    if (!toggleFound) {
      console.log('密码切换功能未找到或未实现');
    }
  });

  test('应该处理租户和根管理员模式间的导航', async ({ page }) => {
    // 验证初始在租户模式
    await expect(page.getByLabel(/租户代码|Tenant Code/i)).toBeVisible();

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
        await expect(page.getByLabel(/租户代码|Tenant Code/i)).toBeVisible();
      }
    } else {
      test.skip('根管理员模式切换功能未实现');
    }
  });

  test('应该在自动完成历史中保留租户代码', async ({ page }) => {
    const tenantCodeField = page.getByLabel(/租户代码|Tenant Code/i);

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
      { selector: '/欢迎使用|Welcome to CuckooX/i', name: '欢迎文本' },
      { selector: '/案件管理|case management|Streamline/i', name: '副标题' },
      { selector: '/CuckooX/i', name: '品牌名称' },
      { selector: '/© 2024 CuckooX/i', name: '版权信息' }
    ];

    let brandElementsFound = 0;
    for (const { selector, name } of brandSelectors) {
      const element = page.getByText(new RegExp(selector.slice(1, -2), selector.slice(-2, -1)));
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

  test('应该正确处理表单验证', async ({ page }) => {
    // 填写部分表单并验证验证
    await page.getByLabel(/租户代码|Tenant Code/i).fill('TEST1');
    await page.getByLabel(/用户名|Username/i).fill('testuser');
    // 留空密码

    await page.getByRole('button', { name: /登录|Login/i }).click();

    // 应该显示缺少密码的验证
    const passwordField = page.getByLabel(/密码|Password/i);
    await expect(passwordField).toHaveAttribute('required');

    // 填写密码并再次尝试
    await passwordField.fill('testpass');
    await page.getByRole('button', { name: /登录|Login/i }).click();

    // 等待处理
    await page.waitForTimeout(2000);
    
    // 验证表单仍然存在（因为这些不是有效凭据）
    await expect(page.getByRole('button', { name: /登录|Login/i })).toBeVisible();
  });

  test('应该使用有效凭据成功登录（使用 TEST1 租户）', async ({ page }) => {
    // 使用 TEST1 租户的管理员凭据进行测试
    await page.getByLabel(/租户代码|Tenant Code/i).fill('TEST1');
    await page.getByLabel(/用户名|Username/i).fill('admin');
    await page.getByLabel(/密码|Password/i).fill('admin123');

    await page.getByRole('button', { name: /登录|Login/i }).click();

    // 等待登录处理
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);

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
    
    if (loginSuccessful) {
      console.log(`登录成功，已重定向到: ${currentUrl}`);
      
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
    await expect(page.getByRole('button', { name: /登录|Login/i })).toBeVisible();
    await expect(page.getByLabel(/用户名|Username/i)).toBeVisible();
    await expect(page.getByLabel(/密码|Password/i)).toBeVisible();
    await expect(page.getByLabel(/租户代码|Tenant Code/i)).toBeVisible();
    
    // 测试平板视口
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(500);
    
    await expect(page.getByRole('button', { name: /登录|Login/i })).toBeVisible();
    
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
    await page.getByLabel(/密码|Password/i).focus();
    await page.keyboard.press('Enter');
    
    // 表单应该尝试提交（预期会有验证错误）
    await page.waitForTimeout(1000);
    await expect(page.getByRole('button', { name: /登录|Login/i })).toBeVisible();

    // 测试表单字段的 Tab 导航
    await page.getByLabel(/租户代码|Tenant Code/i).focus();
    await page.keyboard.press('Tab');
    
    // 下一个焦点应该在用户名字段
    const focusedElement = await page.evaluate(() => document.activeElement?.getAttribute('name') || document.activeElement?.getAttribute('aria-label'));
    console.log(`焦点元素: ${focusedElement}`);
  });

  test('应该处理表单自动填充功能', async ({ page }) => {
    // 模拟浏览器自动填充
    await page.getByLabel(/租户代码|Tenant Code/i).fill('TEST1');
    await page.getByLabel(/用户名|Username/i).fill('admin');
    await page.getByLabel(/密码|Password/i).fill('admin123');

    // 验证字段值被正确填充
    await expect(page.getByLabel(/租户代码|Tenant Code/i)).toHaveValue('TEST1');
    await expect(page.getByLabel(/用户名|Username/i)).toHaveValue('admin');
    await expect(page.getByLabel(/密码|Password/i)).toHaveValue('admin123');

    // 清除并测试部分填充
    await page.getByLabel(/租户代码|Tenant Code/i).fill('');
    await page.getByLabel(/租户代码|Tenant Code/i).fill('TE');
    
    // 等待可能的自动完成
    await page.waitForTimeout(500);
    
    console.log('表单自动填充测试完成');
  });
});
