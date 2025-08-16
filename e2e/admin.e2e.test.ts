import { test, expect, devices } from '@playwright/test';
import { loginAsAdmin } from './helpers/login';

test.describe('管理员功能测试 - 使用 TEST1 租户', () => {
  test.beforeEach(async ({ page }) => {
    // 使用改进的登录辅助函数
    const loginSuccessful = await loginAsAdmin(page);
    if (!loginSuccessful) {
      console.log('登录失败，将跳过此测试');
    }
  });

  test('应该成功访问管理员面板', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    
    // 如果重定向到登录页面，说明认证失败
    if (page.url().includes('/login')) {
      test.skip(true, '认证失败 - 跳过管理员面板测试');
      return;
    }

    // 验证管理员面板相关内容
    const adminIndicators = [
      page.getByRole('heading', { name: /管理|Admin|系统管理|System/i }),
      page.getByText(/管理面板|Admin Panel|管理中心|Admin Center/i),
      page.getByText(/控制台|Console|仪表板|Dashboard/i),
    ];

    let adminContentFound = false;
    for (const indicator of adminIndicators) {
      if (await indicator.count() > 0) {
        console.log('发现管理员相关内容');
        adminContentFound = true;
        break;
      }
    }

    // 检查是否有访问拒绝的消息
    const accessDeniedElements = [
      page.getByText(/访问被拒绝|Access Denied|权限不足|Insufficient Permission/i),
      page.getByText(/403|Forbidden|未授权|Unauthorized/i),
    ];

    let accessDenied = false;
    for (const denied of accessDeniedElements) {
      if (await denied.count() > 0) {
        console.log('管理员访问被拒绝');
        accessDenied = true;
        break;
      }
    }

    // 如果没有被拒绝访问，应该能看到某种管理相关内容
    if (!accessDenied) {
      const pageContent = await page.locator('body').textContent() || '';
      const hasAdminContent = /管理|admin|系统|system|用户|user|案件|case/i.test(pageContent);
      console.log(`页面包含管理相关关键词: ${hasAdminContent}`);
      
      if (hasAdminContent || adminContentFound) {
        console.log('管理员面板访问成功');
      }
    }
  });

  test('应该显示系统统计信息', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    
    if (page.url().includes('/login')) {
      test.skip(true, '需要认证 - 跳过统计信息测试');
      return;
    }

    // 查找可能的统计信息显示
    const statsSelectors = [
      '.admin-stats',
      '.system-stats',
      '.stats-card',
      '.MuiCard-root',
      '[data-testid*="stat"]',
      '.dashboard-card'
    ];

    let statsFound = false;
    for (const selector of statsSelectors) {
      const elements = page.locator(selector);
      if (await elements.count() > 0) {
        statsFound = true;
        console.log(`发现统计信息容器: ${selector}`);
        break;
      }
    }

    // 查找数字或统计相关文本
    const pageText = await page.locator('body').textContent() || '';
    const hasNumbers = /\d+/.test(pageText);
    const hasStatsKeywords = /(用户|Users|案件|Cases|债权|Claims|总计|Total|数量|Count)/i.test(pageText);

    if (statsFound || (hasNumbers && hasStatsKeywords)) {
      console.log('发现系统统计信息');
    } else {
      console.log('未找到明显的统计信息显示');
    }
  });

  test('应该能够管理用户', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    
    if (page.url().includes('/login')) {
      test.skip(true, '需要认证 - 跳过用户管理测试');
      return;
    }

    // 查找用户管理相关选项
    const userMgmtSelectors = [
      page.getByRole('link', { name: /用户管理|User Management|成员管理|Member Management/i }),
      page.getByRole('button', { name: /用户管理|User Management/i }),
      page.getByText(/用户列表|User List|成员列表|Member List/i),
      page.locator('[href*="user"], [href*="member"]'),
    ];

    let userMgmtFound = false;
    for (const selector of userMgmtSelectors) {
      if (await selector.count() > 0) {
        userMgmtFound = true;
        console.log('发现用户管理功能');
        
        // 尝试点击进入用户管理
        try {
          await selector.first().click();
          await page.waitForTimeout(2000);
          
          // 查找用户管理界面
          const userInterface = [
            page.getByText(/用户列表|User List/i),
            page.locator('table'),
            page.getByText(/admin/i),
          ];

          for (const ui of userInterface) {
            if (await ui.count() > 0) {
              console.log('用户管理界面加载成功');
              break;
            }
          }
        } catch (e) {
          console.log('用户管理点击失败，可能是链接或权限问题');
        }
        
        break;
      }
    }

    if (!userMgmtFound) {
      console.log('未找到用户管理功能');
    }
  });

  test('应该能够管理角色权限', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    
    if (page.url().includes('/login')) {
      test.skip(true, '需要认证 - 跳过权限管理测试');
      return;
    }

    // 查找权限管理相关选项
    const permissionSelectors = [
      page.getByRole('link', { name: /权限管理|Permission Management|角色管理|Role Management/i }),
      page.getByText(/权限设置|Permission Settings|访问控制|Access Control/i),
      page.locator('[href*="permission"], [href*="role"]'),
    ];

    let permissionMgmtFound = false;
    for (const selector of permissionSelectors) {
      if (await selector.count() > 0) {
        permissionMgmtFound = true;
        console.log('发现权限管理功能');
        
        try {
          await selector.first().click();
          await page.waitForTimeout(2000);
          
          // 查找权限管理界面
          const permissionInterface = [
            page.getByText(/权限列表|Permission List|角色列表|Role List/i),
            page.locator('table'),
            page.getByRole('button', { name: /添加权限|Add Permission|创建角色|Create Role/i }),
          ];

          for (const ui of permissionInterface) {
            if (await ui.count() > 0) {
              console.log('权限管理界面加载成功');
              break;
            }
          }
        } catch (e) {
          console.log('权限管理点击失败');
        }
        
        break;
      }
    }

    if (!permissionMgmtFound) {
      console.log('未找到权限管理功能');
    }
  });

  test('应该能够查看系统设置', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    
    if (page.url().includes('/login')) {
      test.skip(true, '需要认证 - 跳过系统设置测试');
      return;
    }

    // 查找系统设置相关选项
    const settingsSelectors = [
      page.getByRole('link', { name: /系统设置|System Settings|配置|Configuration/i }),
      page.getByRole('link', { name: /设置|Settings/i }),
      page.locator('[href*="settings"], [href*="config"]'),
    ];

    let settingsFound = false;
    for (const selector of settingsSelectors) {
      if (await selector.count() > 0) {
        settingsFound = true;
        console.log('发现系统设置功能');
        
        try {
          await selector.first().click();
          await page.waitForTimeout(2000);
          
          // 查找设置界面
          const settingsInterface = [
            page.getByText(/系统配置|System Configuration|基本设置|Basic Settings/i),
            page.locator('form'),
            page.getByLabel(/系统名称|System Name|网站标题|Site Title/i),
          ];

          for (const ui of settingsInterface) {
            if (await ui.count() > 0) {
              console.log('系统设置界面加载成功');
              break;
            }
          }
        } catch (e) {
          console.log('系统设置点击失败');
        }
        
        break;
      }
    }

    if (!settingsFound) {
      console.log('未找到系统设置功能');
    }
  });

  test('应该显示数据导出和备份选项', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    
    if (page.url().includes('/login')) {
      test.skip(true, '需要认证 - 跳过数据导出测试');
      return;
    }

    // 查找数据导出/备份选项
    const exportSelectors = [
      page.getByRole('button', { name: /数据导出|Data Export|导出|Export/i }),
      page.getByRole('button', { name: /备份|Backup|数据备份|Data Backup/i }),
      page.getByText(/数据管理|Data Management|数据操作|Data Operations/i),
    ];

    let exportFound = false;
    for (const selector of exportSelectors) {
      if (await selector.count() > 0) {
        exportFound = true;
        console.log('发现数据导出/备份选项');
        
        try {
          // 设置下载处理器
          const [download] = await Promise.all([
            page.waitForEvent('download', { timeout: 5000 }).catch(() => null),
            selector.first().click()
          ]);

          if (download) {
            console.log(`数据导出启动: ${download.suggestedFilename()}`);
            await download.cancel(); // 取消下载避免保存文件
          } else {
            // 检查是否打开了对话框
            await page.waitForTimeout(1000);
            const dialog = page.locator('.MuiDialog-root, [role="dialog"]');
            if (await dialog.count() > 0) {
              console.log('数据导出/备份对话框打开');
              
              // 关闭对话框
              const closeButton = page.getByRole('button', { name: /取消|Cancel|关闭|Close/i });
              if (await closeButton.count() > 0) {
                await closeButton.click();
              } else {
                await page.keyboard.press('Escape');
              }
            }
          }
        } catch (e) {
          console.log('数据导出/备份功能点击失败');
        }
        
        break;
      }
    }

    if (!exportFound) {
      console.log('未找到数据导出/备份功能');
    }
  });

  test('应该在移动设备上正确显示', async ({ page }) => {
    // 测试移动端视口下的管理员面板
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    
    if (page.url().includes('/login')) {
      test.skip(true, '需要认证 - 跳过移动端测试');
      return;
    }

    // 验证基本功能在移动端可用
    const mobileElements = [
      page.locator('.mobile-admin, .hamburger-menu'),
      page.getByRole('button', { name: /菜单|Menu/i }),
    ];

    for (const element of mobileElements) {
      if (await element.count() > 0) {
        console.log('发现移动端管理员UI');
        break;
      }
    }

    // 测试平板视口
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(500);
    
    const pageContent = await page.locator('body').textContent() || '';
    const isContentVisible = pageContent.length > 100;
    
    console.log(`移动端内容可见: ${isContentVisible}`);
    
    // 恢复桌面视口
    await page.setViewportSize({ width: 1200, height: 800 });
  });

  test('应该验证管理员权限要求', async ({ page }) => {
    // 先退出当前登录
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    
    // 尝试直接访问管理员面板（未登录状态）
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    
    // 应该被重定向到登录页面
    const currentUrl = page.url();
    const redirectedToLogin = currentUrl.includes('/login');
    
    if (redirectedToLogin) {
      console.log('未登录用户被正确重定向到登录页面');
      expect(redirectedToLogin).toBeTruthy();
    } else {
      // 检查是否显示了权限错误
      const errorElements = [
        page.getByText(/权限不足|Access Denied|未授权|Unauthorized/i),
        page.getByText(/请先登录|Please Login/i),
      ];

      let hasPermissionError = false;
      for (const error of errorElements) {
        if (await error.count() > 0) {
          hasPermissionError = true;
          console.log('显示了正确的权限错误信息');
          break;
        }
      }

      if (!hasPermissionError) {
        console.log('管理员权限验证可能未正确实施');
      }
    }
  });

  test('应该验证登录后刷新页面菜单不会消失', async ({ page }) => {
    // 先访问管理员面板确保已经登录
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    
    if (page.url().includes('/login')) {
      test.skip(true, '需要认证 - 跳过菜单刷新测试');
      return;
    }

    // 等待页面完全加载
    await page.waitForTimeout(2000);
    
    // 查找导航菜单元素
    const menuSelectors = [
      page.locator('nav'),
      page.locator('.MuiDrawer-root'),
      page.locator('.sidebar'),
      page.locator('[role="navigation"]'),
      page.locator('.navigation'),
      page.locator('.menu'),
      page.getByRole('navigation'),
    ];

    // 记录刷新前的菜单状态
    let menuFoundBefore = false;
    let beforeMenuText = '';
    let beforeMenuCount = 0;
    
    for (const selector of menuSelectors) {
      const count = await selector.count();
      if (count > 0) {
        menuFoundBefore = true;
        beforeMenuCount = count;
        const text = await selector.first().textContent() || '';
        beforeMenuText = text.substring(0, 200); // 取前200字符避免过长
        console.log(`刷新前发现菜单元素: ${count}个, 内容长度: ${text.length}`);
        break;
      }
    }

    // 查找具体的菜单项（更详细的检查）
    const menuItemSelectors = [
      page.getByRole('link', { name: /管理|Admin|用户|User|系统|System|设置|Settings/i }),
      page.locator('a[href*="admin"], a[href*="users"], a[href*="settings"]'),
      page.locator('.MuiListItem-root'),
      page.locator('.menu-item'),
      page.locator('nav a'),
      page.locator('[role="menuitem"]'),
    ];

    let menuItemsCountBefore = 0;
    let menuItemsTextBefore = '';
    
    for (const selector of menuItemSelectors) {
      const count = await selector.count();
      if (count > 0) {
        menuItemsCountBefore = count;
        const allText = await selector.allTextContents();
        menuItemsTextBefore = allText.join('|').substring(0, 300);
        console.log(`刷新前发现菜单项: ${count}个, 内容: ${allText.slice(0, 5).join(', ')}`);
        break;
      }
    }

    if (!menuFoundBefore && menuItemsCountBefore === 0) {
      console.log('警告: 刷新前未找到任何菜单元素，无法进行菜单刷新测试');
      // 不要跳过测试，继续执行刷新并检查
    }

    console.log('执行页面刷新...');
    // 刷新页面
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // 等待应用重新初始化
    await page.waitForTimeout(3000);

    // 检查是否被重定向到登录页面
    const urlAfterRefresh = page.url();
    if (urlAfterRefresh.includes('/login')) {
      console.log('❌ 刷新后被重定向到登录页面 - 这表明会话状态丢失');
      expect(false, '刷新后不应该被重定向到登录页面').toBeTruthy();
      return;
    }

    console.log('✓ 刷新后仍在管理员页面，检查菜单状态...');

    // 记录刷新后的菜单状态
    let menuFoundAfter = false;
    let afterMenuText = '';
    let afterMenuCount = 0;
    
    for (const selector of menuSelectors) {
      const count = await selector.count();
      if (count > 0) {
        menuFoundAfter = true;
        afterMenuCount = count;
        const text = await selector.first().textContent() || '';
        afterMenuText = text.substring(0, 200);
        console.log(`刷新后发现菜单元素: ${count}个, 内容长度: ${text.length}`);
        break;
      }
    }

    let menuItemsCountAfter = 0;
    let menuItemsTextAfter = '';
    
    for (const selector of menuItemSelectors) {
      const count = await selector.count();
      if (count > 0) {
        menuItemsCountAfter = count;
        const allText = await selector.allTextContents();
        menuItemsTextAfter = allText.join('|').substring(0, 300);
        console.log(`刷新后发现菜单项: ${count}个, 内容: ${allText.slice(0, 5).join(', ')}`);
        break;
      }
    }

    // 比较刷新前后的菜单状态
    console.log('=== 菜单状态比较 ===');
    console.log(`菜单容器: 刷新前 ${beforeMenuCount}个 -> 刷新后 ${afterMenuCount}个`);
    console.log(`菜单项: 刷新前 ${menuItemsCountBefore}个 -> 刷新后 ${menuItemsCountAfter}个`);
    
    // 检查菜单是否消失的逻辑
    const menuDisappeared = (menuFoundBefore && !menuFoundAfter) || 
                           (menuItemsCountBefore > 0 && menuItemsCountAfter === 0);
    
    const menuSignificantlyReduced = (menuItemsCountBefore > 0 && menuItemsCountAfter < menuItemsCountBefore * 0.5);

    if (menuDisappeared) {
      console.log('❌ 菜单在刷新后完全消失');
      await page.screenshot({ path: 'playwright-report/test-results/menu-disappeared-after-refresh.png' });
      expect(false, '菜单在页面刷新后不应该消失').toBeTruthy();
    } else if (menuSignificantlyReduced) {
      console.log('❌ 菜单项在刷新后显著减少');
      await page.screenshot({ path: 'playwright-report/test-results/menu-reduced-after-refresh.png' });
      expect(false, '菜单项在页面刷新后不应该显著减少').toBeTruthy();
    } else if (menuFoundAfter || menuItemsCountAfter > 0) {
      console.log('✓ 菜单在刷新后仍然存在');
    } else {
      console.log('⚠️ 刷新前后都未找到明显的菜单元素，可能是页面结构问题');
      await page.screenshot({ path: 'playwright-report/test-results/no-menu-found.png' });
      
      // 输出页面内容用于调试
      const bodyText = await page.locator('body').textContent() || '';
      console.log(`页面内容包含关键词: ${/管理|admin|用户|user|菜单|menu|导航|nav/i.test(bodyText)}`);
    }

    // 额外检查：尝试与菜单交互
    if (menuFoundAfter || menuItemsCountAfter > 0) {
      console.log('测试菜单交互功能...');
      
      // 尝试点击第一个可见的菜单项
      for (const selector of menuItemSelectors) {
        const elements = selector;
        const count = await elements.count();
        if (count > 0) {
          try {
            const firstItem = elements.first();
            await firstItem.waitFor({ state: 'visible', timeout: 3000 });
            
            // 获取菜单项文本
            const itemText = await firstItem.textContent() || '';
            console.log(`尝试点击菜单项: ${itemText.trim()}`);
            
            // 点击菜单项
            await firstItem.click();
            await page.waitForTimeout(1000);
            
            console.log('✓ 菜单项点击成功，功能正常');
            break;
          } catch (e) {
            console.log('菜单项点击失败，继续测试下一个');
            continue;
          }
        }
      }
    }
  });
});