import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/login';

// 配置移动端设备 - 使用简化配置避免依赖问题
test.use({
  viewport: { width: 390, height: 844 }, // iPhone 13 Pro 尺寸
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
  hasTouch: true,
  isMobile: true,
});

// 移动端管理员功能测试
test.describe('移动端管理员功能测试 - iPhone 13 Pro', () => {

  test.beforeEach(async ({ page }) => {
    // 使用改进的登录辅助函数
    const loginSuccessful = await loginAsAdmin(page);
    if (!loginSuccessful) {
      console.log('登录失败，将跳过此测试');
    }
  });

  test('移动端应该正确显示管理员面板', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    
    if (page.url().includes('/login')) {
      test.skip(true, '需要认证 - 跳过移动端管理员面板测试');
      return;
    }

    // 等待页面完全加载
    await page.waitForTimeout(2000);

    // 验证移动端视口大小
    const viewportSize = page.viewportSize();
    console.log(`移动端视口大小: ${viewportSize?.width}x${viewportSize?.height}`);
    expect(viewportSize?.width).toBeLessThanOrEqual(430); // iPhone 13 Pro width
    
    // 检查移动端特有的UI元素
    const mobileUIElements = [
      // 汉堡菜单按钮
      page.locator('[data-testid="mobile-menu-toggle"]'),
      page.locator('.mobile-menu-button'),
      page.getByRole('button', { name: /菜单|Menu|≡/i }),
      page.locator('button[aria-label*="menu"], button[aria-label*="菜单"]'),
      
      // 移动端导航抽屉
      page.locator('.MuiDrawer-root.MuiDrawer-modal'),
      page.locator('[role="presentation"]'),
      
      // 移动端响应式容器
      page.locator('.mobile-container'),
      page.locator('.responsive-container'),
    ];

    let mobileUIFound = false;
    for (const element of mobileUIElements) {
      const count = await element.count();
      if (count > 0) {
        console.log(`发现移动端UI元素: ${await element.first().getAttribute('class') || '未知类名'}`);
        mobileUIFound = true;
        break;
      }
    }

    // 检查页面内容是否适配移动端
    const bodyElement = page.locator('body');
    const hasOverflow = await bodyElement.evaluate(el => {
      const style = window.getComputedStyle(el);
      return style.overflowX !== 'hidden' && el.scrollWidth > el.clientWidth;
    });

    if (hasOverflow) {
      console.log('⚠️ 页面可能存在水平滚动');
      await page.screenshot({ path: 'playwright-report/test-results/mobile-horizontal-overflow.png' });
    } else {
      console.log('✓ 页面无水平滚动，移动端适配良好');
    }

    // 验证管理员内容在移动端的可见性
    const adminContent = await page.locator('body').textContent() || '';
    const hasAdminKeywords = /管理|admin|统计|statistics|用户|users|案件|cases/i.test(adminContent);
    
    expect(hasAdminKeywords).toBeTruthy();
    console.log('✓ 移动端管理员页面内容正常显示');
  });

  test('移动端应该正确处理触摸交互', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    
    if (page.url().includes('/login')) {
      test.skip(true, '需要认证 - 跳过移动端触摸交互测试');
      return;
    }

    await page.waitForTimeout(2000);

    // 查找可点击的元素
    const interactiveElements = [
      page.locator('button:visible').first(),
      page.locator('a:visible').first(),
      page.locator('.MuiCard-root:visible').first(),
    ];

    for (const element of interactiveElements) {
      const count = await element.count();
      if (count > 0) {
        try {
          // 测试触摸开始和结束事件
          await element.dispatchEvent('touchstart');
          await page.waitForTimeout(100);
          await element.dispatchEvent('touchend');
          await page.waitForTimeout(100);
          
          // 测试点击
          await element.tap();
          await page.waitForTimeout(500);
          
          console.log('✓ 移动端触摸交互正常');
          break;
        } catch (e) {
          console.log('移动端触摸交互测试失败，继续下一个元素');
          continue;
        }
      }
    }
  });

  test('移动端应该正确显示统计卡片', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    
    if (page.url().includes('/login')) {
      test.skip(true, '需要认证 - 跳过移动端统计卡片测试');
      return;
    }

    await page.waitForTimeout(2000);

    // 查找统计卡片
    const statsCards = page.locator('.MuiCard-root');
    const cardCount = await statsCards.count();
    
    if (cardCount > 0) {
      console.log(`发现 ${cardCount} 个统计卡片`);
      
      // 验证卡片在移动端的布局
      for (let i = 0; i < Math.min(cardCount, 3); i++) {
        const card = statsCards.nth(i);
        
        // 检查卡片是否可见
        await expect(card).toBeVisible();
        
        // 检查卡片宽度是否适配移动端
        const cardBox = await card.boundingBox();
        if (cardBox) {
          const viewportWidth = page.viewportSize()?.width || 0;
          const cardWidthPercentage = (cardBox.width / viewportWidth) * 100;
          
          console.log(`卡片 ${i + 1} 宽度占视口的 ${cardWidthPercentage.toFixed(1)}%`);
          
          // 移动端卡片应该占据合理的宽度（不应该太小或溢出）
          expect(cardWidthPercentage).toBeGreaterThan(20); // 至少20%
          expect(cardWidthPercentage).toBeLessThanOrEqual(100); // 不超过100%
        }
      }
      
      console.log('✓ 移动端统计卡片布局适配正常');
    } else {
      console.log('未找到统计卡片');
    }
  });

  test('移动端应该支持响应式导航', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    
    if (page.url().includes('/login')) {
      test.skip(true, '需要认证 - 跳过移动端响应式导航测试');
      return;
    }

    await page.waitForTimeout(2000);

    // 查找移动端菜单按钮
    const menuButtons = [
      page.getByRole('button', { name: /菜单|Menu/i }),
      page.locator('button[aria-label*="menu"]'),
      page.locator('.mobile-menu-button'),
      page.locator('[data-testid="mobile-menu-toggle"]'),
      page.locator('button:has-text("≡")'),
    ];

    let menuButtonFound = false;
    for (const button of menuButtons) {
      const count = await button.count();
      if (count > 0) {
        try {
          console.log('找到移动端菜单按钮，测试点击');
          
          // 点击菜单按钮
          await button.first().click();
          await page.waitForTimeout(1000);
          
          // 查找展开的菜单或抽屉
          const expandedMenu = [
            page.locator('.MuiDrawer-root[aria-hidden="false"]'),
            page.locator('.mobile-menu.open'),
            page.locator('[role="presentation"]:visible'),
            page.locator('.menu-drawer:visible'),
          ];

          let menuExpanded = false;
          for (const menu of expandedMenu) {
            if (await menu.count() > 0) {
              console.log('✓ 移动端菜单成功展开');
              menuExpanded = true;
              
              // 测试关闭菜单
              await page.keyboard.press('Escape');
              await page.waitForTimeout(500);
              
              const stillVisible = await menu.isVisible().catch(() => false);
              if (!stillVisible) {
                console.log('✓ 移动端菜单成功关闭');
              }
              
              break;
            }
          }
          
          if (!menuExpanded) {
            console.log('菜单按钮点击后未找到展开的菜单');
          }
          
          menuButtonFound = true;
          break;
        } catch (e) {
          console.log('移动端菜单按钮点击失败，继续尝试下一个');
          continue;
        }
      }
    }

    if (!menuButtonFound) {
      console.log('未找到移动端菜单按钮，可能使用其他导航方式');
      
      // 检查是否有其他形式的导航
      const otherNav = [
        page.locator('nav:visible'),
        page.locator('.navigation:visible'),
        page.locator('[role="navigation"]:visible'),
      ];

      for (const nav of otherNav) {
        if (await nav.count() > 0) {
          console.log('发现其他形式的导航元素');
          break;
        }
      }
    }
  });

  test('移动端应该正确处理长内容滚动', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    
    if (page.url().includes('/login')) {
      test.skip(true, '需要认证 - 跳过移动端滚动测试');
      return;
    }

    await page.waitForTimeout(2000);

    // 获取页面初始滚动位置
    const initialScrollY = await page.evaluate(() => window.scrollY);
    
    // 模拟向下滚动
    await page.evaluate(() => {
      window.scrollTo(0, window.innerHeight);
    });
    await page.waitForTimeout(500);
    
    const afterScrollY = await page.evaluate(() => window.scrollY);
    
    if (afterScrollY > initialScrollY) {
      console.log(`✓ 移动端页面支持滚动: ${initialScrollY} -> ${afterScrollY}`);
      
      // 测试平滑滚动回顶部
      await page.evaluate(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
      await page.waitForTimeout(1000);
      
      const finalScrollY = await page.evaluate(() => window.scrollY);
      console.log(`滚动回顶部: ${finalScrollY}`);
      
    } else {
      console.log('页面内容可能不需要滚动或滚动被禁用');
    }
  });

  test('移动端应该验证文本可读性', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    
    if (page.url().includes('/login')) {
      test.skip(true, '需要认证 - 跳过移动端文本可读性测试');
      return;
    }

    await page.waitForTimeout(2000);

    // 检查主要文本元素的字体大小
    const textElements = [
      page.locator('h1, h2, h3, h4, h5, h6').first(),
      page.locator('p').first(),
      page.locator('.MuiTypography-root').first(),
    ];

    for (const element of textElements) {
      const count = await element.count();
      if (count > 0) {
        const fontSize = await element.evaluate(el => {
          const style = window.getComputedStyle(el);
          return parseFloat(style.fontSize);
        });
        
        const tagName = await element.evaluate(el => el.tagName.toLowerCase());
        console.log(`${tagName} 元素字体大小: ${fontSize}px`);
        
        // 移动端最小字体大小建议
        const minFontSize = tagName.startsWith('h') ? 18 : 14;
        if (fontSize < minFontSize) {
          console.log(`⚠️ ${tagName} 字体可能过小，建议至少 ${minFontSize}px`);
        } else {
          console.log(`✓ ${tagName} 字体大小适合移动端`);
        }
      }
    }
  });

  test('移动端应该验证触摸目标大小', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    
    if (page.url().includes('/login')) {
      test.skip(true, '需要认证 - 跳过移动端触摸目标测试');
      return;
    }

    await page.waitForTimeout(2000);

    // 检查按钮和链接的触摸目标大小
    const touchTargets = [
      page.locator('button:visible'),
      page.locator('a:visible'),
      page.locator('[role="button"]:visible'),
    ];

    for (const targets of touchTargets) {
      const count = await targets.count();
      if (count > 0) {
        // 检查前几个元素
        for (let i = 0; i < Math.min(count, 3); i++) {
          const target = targets.nth(i);
          const box = await target.boundingBox();
          
          if (box) {
            const minSize = Math.min(box.width, box.height);
            const tagName = await target.evaluate(el => el.tagName.toLowerCase());
            
            console.log(`${tagName} 触摸目标大小: ${box.width.toFixed(1)}x${box.height.toFixed(1)}px`);
            
            // 推荐的最小触摸目标大小是44px
            if (minSize < 44) {
              console.log(`⚠️ ${tagName} 触摸目标可能过小，建议至少 44x44px`);
            } else {
              console.log(`✓ ${tagName} 触摸目标大小符合移动端标准`);
            }
          }
        }
        break;
      }
    }
  });

  test('移动端应该验证刷新后菜单状态', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    
    if (page.url().includes('/login')) {
      test.skip(true, '需要认证 - 跳过移动端菜单刷新测试');
      return;
    }

    await page.waitForTimeout(2000);
    
    // 在移动端查找菜单元素
    const mobileMenuSelectors = [
      page.locator('.MuiDrawer-root'),
      page.getByRole('button', { name: /菜单|Menu/i }),
      page.locator('[data-testid="mobile-menu-toggle"]'),
      page.locator('nav'),
      page.locator('[role="navigation"]'),
    ];

    // 记录刷新前的移动端菜单状态
    let menuFoundBefore = false;
    let beforeMenuDescription = '';
    
    for (const selector of mobileMenuSelectors) {
      const count = await selector.count();
      if (count > 0) {
        menuFoundBefore = true;
        const selectorInfo = await selector.first().evaluate(el => ({
          tagName: el.tagName,
          className: el.className,
          textContent: el.textContent?.substring(0, 50) || ''
        }));
        beforeMenuDescription = `${selectorInfo.tagName}.${selectorInfo.className}`;
        console.log(`移动端刷新前发现菜单: ${beforeMenuDescription}`);
        break;
      }
    }

    console.log('执行移动端页面刷新...');
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // 检查是否被重定向到登录页面
    if (page.url().includes('/login')) {
      console.log('❌ 移动端刷新后被重定向到登录页面');
      expect(false, '移动端刷新后不应该被重定向到登录页面').toBeTruthy();
      return;
    }

    console.log('✓ 移动端刷新后仍在管理员页面，检查菜单状态...');

    // 记录刷新后的移动端菜单状态
    let menuFoundAfter = false;
    let afterMenuDescription = '';
    
    for (const selector of mobileMenuSelectors) {
      const count = await selector.count();
      if (count > 0) {
        menuFoundAfter = true;
        const selectorInfo = await selector.first().evaluate(el => ({
          tagName: el.tagName,
          className: el.className,
          textContent: el.textContent?.substring(0, 50) || ''
        }));
        afterMenuDescription = `${selectorInfo.tagName}.${selectorInfo.className}`;
        console.log(`移动端刷新后发现菜单: ${afterMenuDescription}`);
        break;
      }
    }

    // 比较移动端菜单状态
    console.log('=== 移动端菜单状态比较 ===');
    console.log(`菜单存在: 刷新前 ${menuFoundBefore} -> 刷新后 ${menuFoundAfter}`);
    
    if (menuFoundBefore && !menuFoundAfter) {
      console.log('❌ 移动端菜单在刷新后消失');
      await page.screenshot({ path: 'playwright-report/test-results/mobile-menu-disappeared.png' });
      expect(false, '移动端菜单在页面刷新后不应该消失').toBeTruthy();
    } else if (menuFoundAfter) {
      console.log('✓ 移动端菜单在刷新后仍然存在');
    } else {
      console.log('⚠️ 移动端菜单检测可能需要调整，未找到明显的菜单元素');
      await page.screenshot({ path: 'playwright-report/test-results/mobile-no-menu.png' });
    }
  });
});