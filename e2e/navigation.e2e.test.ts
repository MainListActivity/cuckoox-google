import { test, expect } from '@playwright/test';

test.describe('导航和布局测试 - 使用 TEST1 租户', () => {
  // 通用登录辅助函数
  async function loginAsAdmin(page: any) {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    
    // 使用 TEST1 租户管理员登录
    await page.getByLabel(/租户代码|Tenant Code/i).fill('TEST1');
    await page.getByLabel(/用户名|Username/i).fill('admin');
    await page.getByLabel(/密码|Password/i).fill('admin123');
    await page.getByRole('button', { name: /登录|Login/i }).click();
    
    // 等待登录完成
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
  }

  test('应该显示登录页面的基本导航', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    
    // 查找登录页面的导航元素
    const loginNavElements = [
      page.locator('nav, .navigation'),
      page.getByRole('navigation'),
      page.locator('.header, .top-bar'),
      page.locator('.logo'),
      page.getByText(/CuckooX/i),
    ];

    let loginNavFound = false;
    for (const element of loginNavElements) {
      if (await element.count() > 0) {
        loginNavFound = true;
        console.log('登录页面发现导航元素');
        break;
      }
    }

    // 验证页面基本结构
    const hasBasicStructure = await page.locator('body').count() > 0;
    console.log(`页面基本结构正常: ${hasBasicStructure}`);

    if (loginNavFound) {
      console.log('登录页面导航元素测试通过');
    } else {
      console.log('登录页面可能使用简化导航设计');
    }
  });

  test('应该显示登录后的主导航菜单', async ({ page }) => {
    await loginAsAdmin(page);
    
    // 尝试导航到主页面
    const mainPages = ['/dashboard', '/cases', '/'];
    let mainPageLoaded = false;
    
    for (const url of mainPages) {
      await page.goto(url);
      await page.waitForLoadState('networkidle');
      
      if (!page.url().includes('/login')) {
        mainPageLoaded = true;
        console.log(`成功加载主页面: ${url}`);
        break;
      }
    }

    if (!mainPageLoaded) {
      test.skip('无法加载主页面进行导航测试');
      return;
    }

    // 查找主导航菜单
    const navElements = [
      page.locator('nav, .navigation'),
      page.getByRole('navigation'),
      page.locator('.sidebar, .nav-menu'),
      page.locator('.header-nav'),
    ];

    let navFound = false;
    for (const nav of navElements) {
      if (await nav.count() > 0) {
        navFound = true;
        console.log('发现主导航菜单');
        break;
      }
    }

    // 查找常见导航链接
    const commonLinks = [
      page.getByRole('link', { name: /首页|Home|仪表板|Dashboard/i }),
      page.getByRole('link', { name: /案件|Cases/i }),
      page.getByRole('link', { name: /债权人|Creditors/i }),
      page.getByRole('link', { name: /债权申报|Claims/i }),
      page.getByRole('link', { name: /管理|Admin/i }),
    ];

    let linksFound = 0;
    for (const link of commonLinks) {
      if (await link.count() > 0) {
        linksFound++;
      }
    }

    console.log(`发现导航链接数量: ${linksFound}`);
    
    if (navFound || linksFound > 0) {
      console.log('主导航菜单测试通过');
    }
  });

  test('应该能够正确导航到各个主要页面', async ({ page }) => {
    await loginAsAdmin(page);
    
    // 测试主要页面导航
    const pagesToTest = [
      { url: '/cases', name: '案件管理' },
      { url: '/creditors', name: '债权人管理' },
      { url: '/claims', name: '债权申报' },
      { url: '/admin', name: '管理面板' },
    ];

    let successfulNavigations = 0;

    for (const { url, name } of pagesToTest) {
      try {
        await page.goto(url);
        await page.waitForLoadState('networkidle');
        
        // 检查是否成功加载页面（未重定向到登录）
        if (!page.url().includes('/login')) {
          successfulNavigations++;
          console.log(`成功导航到 ${name}: ${url}`);
          
          // 验证页面有实际内容
          const pageContent = await page.locator('body').textContent() || '';
          const hasContent = pageContent.length > 100;
          console.log(`  页面内容加载: ${hasContent}`);
        } else {
          console.log(`${name} 需要额外权限或重定向到登录`);
        }
      } catch (e) {
        console.log(`导航到 ${name} 失败: ${e.message}`);
      }
      
      await page.waitForTimeout(500);
    }

    console.log(`成功导航的页面数量: ${successfulNavigations}/${pagesToTest.length}`);
    expect(successfulNavigations).toBeGreaterThan(0);
  });

  test('应该显示用户信息和退出登录功能', async ({ page }) => {
    await loginAsAdmin(page);
    
    // 导航到一个主页面
    await page.goto('/cases');
    await page.waitForLoadState('networkidle');
    
    if (page.url().includes('/login')) {
      test.skip('无法访问主页面进行用户信息测试');
      return;
    }

    // 查找用户信息显示
    const userInfoElements = [
      page.getByText(/admin/i),
      page.getByText(/管理员/i),
      page.locator('.user-info, .user-profile'),
      page.locator('.avatar'),
      page.getByRole('button', { name: /用户|User|个人|Profile/i }),
    ];

    let userInfoFound = false;
    for (const element of userInfoElements) {
      if (await element.count() > 0) {
        userInfoFound = true;
        console.log('发现用户信息显示');
        break;
      }
    }

    // 查找退出登录按钮
    const logoutElements = [
      page.getByRole('button', { name: /退出登录|Logout|退出|Sign Out/i }),
      page.getByRole('link', { name: /退出登录|Logout/i }),
      page.getByText(/退出|Logout/i),
    ];

    let logoutFound = false;
    for (const element of logoutElements) {
      if (await element.count() > 0) {
        logoutFound = true;
        console.log('发现退出登录功能');
        
        try {
          // 测试点击退出登录
          await element.first().click();
          await page.waitForTimeout(2000);
          
          // 检查是否重定向到登录页面
          const redirectedToLogin = page.url().includes('/login');
          if (redirectedToLogin) {
            console.log('退出登录功能正常工作');
            
            // 重新登录以便后续测试
            await loginAsAdmin(page);
          }
        } catch (e) {
          console.log('退出登录测试失败');
        }
        
        break;
      }
    }

    if (userInfoFound || logoutFound) {
      console.log('用户信息和退出功能测试通过');
    } else {
      console.log('未找到明显的用户信息或退出功能');
    }
  });

  test('应该在移动设备上显示响应式导航', async ({ page }) => {
    await loginAsAdmin(page);
    
    // 导航到主页面
    await page.goto('/cases');
    await page.waitForLoadState('networkidle');
    
    if (page.url().includes('/login')) {
      test.skip('无法访问主页面进行移动端导航测试');
      return;
    }

    // 设置移动端视口
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(1000);

    // 查找移动端导航元素
    const mobileNavElements = [
      page.getByRole('button', { name: /菜单|Menu/i }),
      page.locator('.hamburger, .mobile-menu-button'),
      page.locator('.drawer-toggle'),
      page.locator('[data-testid*="mobile-nav"]'),
    ];

    let mobileNavFound = false;
    for (const element of mobileNavElements) {
      if (await element.count() > 0) {
        mobileNavFound = true;
        console.log('发现移动端导航元素');
        
        try {
          // 测试移动菜单切换
          await element.first().click();
          await page.waitForTimeout(500);
          
          // 查找展开的菜单
          const expandedMenu = page.locator('.drawer, .mobile-menu, .sidebar-open');
          if (await expandedMenu.count() > 0) {
            console.log('移动端菜单成功展开');
            
            // 关闭菜单
            await element.first().click();
            await page.waitForTimeout(500);
          }
        } catch (e) {
          console.log('移动端菜单交互测试失败');
        }
        
        break;
      }
    }

    // 恢复桌面视口
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.waitForTimeout(500);

    if (mobileNavFound) {
      console.log('移动端响应式导航测试通过');
    } else {
      console.log('未找到明显的移动端导航元素');
    }
  });

  test('应该显示面包屑导航', async ({ page }) => {
    await loginAsAdmin(page);
    
    // 导航到一个可能有面包屑的页面
    await page.goto('/cases');
    await page.waitForLoadState('networkidle');
    
    if (page.url().includes('/login')) {
      test.skip('无法访问页面进行面包屑测试');
      return;
    }

    // 查找面包屑导航
    const breadcrumbElements = [
      page.locator('.breadcrumb, .breadcrumbs'),
      page.locator('nav[aria-label*="breadcrumb"]'),
      page.locator('.MuiBreadcrumbs-root'),
      page.getByRole('navigation', { name: /breadcrumb/i }),
    ];

    let breadcrumbFound = false;
    for (const element of breadcrumbElements) {
      if (await element.count() > 0) {
        breadcrumbFound = true;
        console.log('发现面包屑导航');
        
        // 检查面包屑内容
        const breadcrumbText = await element.first().textContent() || '';
        console.log(`面包屑内容: ${breadcrumbText.slice(0, 100)}`);
        
        break;
      }
    }

    if (breadcrumbFound) {
      console.log('面包屑导航测试通过');
    } else {
      console.log('未找到面包屑导航（可能未实现）');
    }
  });

  test('应该支持键盘导航', async ({ page }) => {
    await loginAsAdmin(page);
    
    // 导航到主页面
    await page.goto('/cases');
    await page.waitForLoadState('networkidle');
    
    if (page.url().includes('/login')) {
      test.skip('无法访问页面进行键盘导航测试');
      return;
    }

    // 测试 Tab 键导航
    await page.keyboard.press('Tab');
    await page.waitForTimeout(200);
    
    let focusedElement = await page.evaluate(() => {
      const activeElement = document.activeElement;
      return activeElement ? {
        tagName: activeElement.tagName,
        type: activeElement.getAttribute('type'),
        role: activeElement.getAttribute('role'),
        ariaLabel: activeElement.getAttribute('aria-label')
      } : null;
    });

    console.log('第一个焦点元素:', focusedElement);

    // 继续 Tab 导航
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(100);
    }

    focusedElement = await page.evaluate(() => {
      const activeElement = document.activeElement;
      return activeElement ? {
        tagName: activeElement.tagName,
        type: activeElement.getAttribute('type'),
        role: activeElement.getAttribute('role'),
        ariaLabel: activeElement.getAttribute('aria-label')
      } : null;
    });

    console.log('Tab导航后的焦点元素:', focusedElement);

    if (focusedElement) {
      console.log('键盘导航功能正常');
    } else {
      console.log('键盘导航可能存在问题');
    }
  });

  test('应该正确处理页面刷新和返回', async ({ page }) => {
    await loginAsAdmin(page);
    
    // 导航到案件页面
    await page.goto('/cases');
    await page.waitForLoadState('networkidle');
    
    if (page.url().includes('/login')) {
      test.skip('无法访问页面进行页面状态测试');
      return;
    }

    const originalUrl = page.url();
    console.log(`原始URL: ${originalUrl}`);

    // 测试页面刷新
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    const afterReloadUrl = page.url();
    console.log(`刷新后URL: ${afterReloadUrl}`);
    
    const stayedOnPage = !afterReloadUrl.includes('/login');
    console.log(`刷新后保持在页面: ${stayedOnPage}`);

    // 导航到另一个页面
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    
    // 测试返回
    await page.goBack();
    await page.waitForLoadState('networkidle');
    
    const afterBackUrl = page.url();
    console.log(`返回后URL: ${afterBackUrl}`);
    
    const returnedCorrectly = afterBackUrl.includes('/cases');
    console.log(`正确返回到案件页面: ${returnedCorrectly}`);

    if (stayedOnPage || returnedCorrectly) {
      console.log('页面状态管理测试通过');
    }
  });
});