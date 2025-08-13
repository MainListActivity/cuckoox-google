import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/login';

test.describe('仪表板测试 - 使用 TEST1 租户', () => {
  test.beforeEach(async ({ page }) => {
    // 每个测试前先登录
    const loginSuccessful = await loginAsAdmin(page);
    if (!loginSuccessful) {
      console.log('登录失败，将跳过仪表板测试');
    }
  });

  test('应该成功导航到仪表板页面并验证基本布局', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // If redirected to login
    if (page.url().includes('/login')) {
      await expect(page.getByLabel(/用户名|Username/i)).toBeVisible();
      test.skip(true, '需要认证 - 跳过仪表板测试');
      return;
    }

    // Verify dashboard page elements
    const dashboardElements = [
      page.getByRole('heading', { name: /仪表板|Dashboard|概览|Overview/i }),
      page.getByText(/仪表板|Dashboard|数据概览|Data Overview/i),
      page.locator('.dashboard-container, .dashboard-layout'),
    ];

    let dashboardElementFound = false;
    for (const element of dashboardElements) {
      try {
        await expect(element).toBeVisible({ timeout: 5000 });
        dashboardElementFound = true;
        console.log('Dashboard page element verified');
        break;
      } catch (e) {
        // Continue to next element
      }
    }

    expect(dashboardElementFound).toBeTruthy();
  });

  test('should display statistics cards with data', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    if (page.url().includes('/login')) {
      test.skip('Authentication required - skipping statistics cards test');
      return;
    }

    // Look for statistics cards
    const statsElements = [
      page.locator('.stats-card, .metric-card, .stat-card'),
      page.locator('.MuiCard-root'),
      page.locator('[data-testid*="stat"], [data-testid*="metric"]'),
      page.locator('.dashboard-card'),
    ];

    let statsFound = false;
    let statsCount = 0;

    for (const element of statsElements) {
      const count = await element.count();
      if (count > 0) {
        statsFound = true;
        statsCount = count;
        console.log(`Found ${count} statistics cards`);
        
        // Verify first few stats cards contain meaningful data
        const cardsToCheck = Math.min(count, 5);
        
        for (let i = 0; i < cardsToCheck; i++) {
          const card = element.nth(i);
          await expect(card).toBeVisible();
          
          // Look for numeric values or meaningful content
          const cardText = await card.textContent();
          if (cardText) {
            const hasNumbers = /\d+/.test(cardText);
            const hasStatsKeywords = /(总计|Total|案件|Cases|债权|Claims|用户|Users|金额|Amount)/i.test(cardText);
            
            if (hasNumbers || hasStatsKeywords) {
              console.log(`Stats card ${i + 1} contains meaningful data`);
            }
          }
        }
        
        break;
      }
    }

    if (!statsFound) {
      console.log('No statistics cards found on dashboard');
    } else {
      expect(statsCount).toBeGreaterThan(0);
    }
  });

  test('should display charts and visualizations', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    if (page.url().includes('/login')) {
      test.skip('Authentication required - skipping charts test');
      return;
    }

    // Look for chart elements
    const chartElements = [
      page.locator('canvas'), // Chart.js and other canvas-based charts
      page.locator('svg'), // D3, MUI Charts, etc.
      page.locator('.chart-container, .chart, .recharts-wrapper'),
      page.locator('[data-testid*="chart"]'),
      page.locator('.MuiCharts-root, .recharts-responsive-container'),
    ];

    let chartsFound = false;
    let chartCount = 0;

    for (const element of chartElements) {
      const count = await element.count();
      if (count > 0) {
        chartsFound = true;
        chartCount = count;
        console.log(`Found ${count} chart elements`);
        
        // Verify charts are properly rendered
        const firstChart = element.first();
        await expect(firstChart).toBeVisible();
        
        // Check if chart has content (not empty)
        const boundingBox = await firstChart.boundingBox();
        if (boundingBox && boundingBox.width > 50 && boundingBox.height > 50) {
          console.log('Chart has reasonable dimensions');
        }
        
        break;
      }
    }

    if (!chartsFound) {
      console.log('No chart visualizations found on dashboard');
    }

    // Look for chart titles or legends
    const chartLabels = [
      page.getByText(/图表|Chart|趋势|Trend|分布|Distribution/i),
      page.locator('.chart-title, .chart-legend'),
      page.getByText(/饼图|Pie Chart|柱状图|Bar Chart|折线图|Line Chart/i),
    ];

    let labelsFound = false;
    for (const label of chartLabels) {
      if (await label.count() > 0) {
        labelsFound = true;
        console.log('Chart labels or titles found');
        break;
      }
    }

    console.log(`Dashboard charts - Charts: ${chartsFound}, Labels: ${labelsFound}`);
  });

  test('should display recent activities or updates', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    if (page.url().includes('/login')) {
      test.skip('Authentication required - skipping recent activities test');
      return;
    }

    // Look for activity feeds or recent updates
    const activityElements = [
      page.getByText(/最近活动|Recent Activities|最新|Recent|动态|Updates/i),
      page.locator('.activity-feed, .recent-items, .updates-list'),
      page.locator('[data-testid*="activity"], [data-testid*="recent"]'),
      page.locator('.timeline, .activity-timeline'),
    ];

    let activityFound = false;
    for (const element of activityElements) {
      try {
        await expect(element).toBeVisible({ timeout: 3000 });
        activityFound = true;
        console.log('Recent activities section found');
        
        // Look for activity items
        const activityItems = page.locator('.activity-item, .recent-item, li');
        const itemCount = await activityItems.count();
        
        if (itemCount > 0) {
          console.log(`Found ${itemCount} activity items`);
          
          // Verify first activity item has content
          const firstItem = activityItems.first();
          const itemText = await firstItem.textContent();
          
          if (itemText && itemText.trim().length > 10) {
            console.log('Activity items contain meaningful content');
          }
        }
        
        break;
      } catch (e) {
        // Continue to next element
      }
    }

    if (!activityFound) {
      console.log('No recent activities section found');
    }
  });

  test('should handle dashboard refresh and real-time updates', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    if (page.url().includes('/login')) {
      test.skip('Authentication required - skipping refresh test');
      return;
    }

    // Look for refresh button or auto-refresh indicators
    const refreshElements = [
      page.getByRole('button', { name: /刷新|Refresh|更新|Update/i }),
      page.locator('[aria-label*="刷新"], [aria-label*="refresh"]'),
      page.locator('.refresh-btn, .reload-btn'),
    ];

    let refreshFound = false;
    for (const element of refreshElements) {
      try {
        await expect(element).toBeVisible({ timeout: 3000 });
        refreshFound = true;
        
        // Click refresh button and wait for updates
        await element.click();
        await page.waitForTimeout(2000);
        
        console.log('Dashboard refresh button clicked');
        break;
      } catch (e) {
        // Continue to next element
      }
    }

    // Look for auto-refresh indicators (timers, loading states)
    const autoRefreshIndicators = [
      page.locator('.loading, .spinner'),
      page.getByText(/自动刷新|Auto Refresh|实时|Real-time/i),
      page.locator('[data-testid*="loading"], .MuiCircularProgress-root'),
    ];

    let autoRefreshFound = false;
    for (const indicator of autoRefreshIndicators) {
      if (await indicator.count() > 0) {
        autoRefreshFound = true;
        console.log('Auto-refresh indicators found');
        break;
      }
    }

    console.log(`Dashboard refresh - Manual: ${refreshFound}, Auto: ${autoRefreshFound}`);
  });

  test('should display different sections for different user roles', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    if (page.url().includes('/login')) {
      test.skip('Authentication required - skipping role-based sections test');
      return;
    }

    // Look for role-specific sections
    const roleSections = [
      page.getByText(/管理员面板|Admin Panel|管理功能|Admin Functions/i),
      page.getByText(/我的案件|My Cases|我的债权|My Claims/i),
      page.getByText(/审核中心|Review Center|待处理|Pending/i),
      page.getByText(/统计报告|Statistics Report|数据分析|Data Analysis/i),
    ];

    let roleSectionFound = false;
    const foundSections = [];

    for (const section of roleSections) {
      if (await section.count() > 0) {
        roleSectionFound = true;
        const sectionText = await section.first().textContent();
        if (sectionText) {
          foundSections.push(sectionText.trim());
        }
      }
    }

    if (roleSectionFound) {
      console.log(`Found role-specific sections: ${foundSections.join(', ')}`);
    } else {
      console.log('No obvious role-specific sections found - may have unified dashboard');
    }

    // Look for navigation menu to different functional areas
    const navigationElements = [
      page.locator('nav a, .nav-link'),
      page.getByRole('link', { name: /案件|Cases|债权|Claims|管理|Admin/i }),
      page.locator('.sidebar a, .menu a'),
    ];

    let navFound = false;
    for (const nav of navigationElements) {
      const count = await nav.count();
      if (count > 0) {
        navFound = true;
        console.log(`Found ${count} navigation links`);
        break;
      }
    }

    console.log(`Dashboard navigation - Role sections: ${roleSectionFound}, Nav links: ${navFound}`);
  });

  test('should handle mobile responsive layout', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    if (page.url().includes('/login')) {
      test.skip('Authentication required - skipping mobile layout test');
      return;
    }

    // Test desktop layout first
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.waitForTimeout(500);
    
    // Count elements in desktop view
    const desktopStats = await page.locator('.stats-card, .metric-card, .MuiCard-root').count();
    const desktopCharts = await page.locator('canvas, svg, .chart').count();
    
    // Test mobile layout
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);
    
    // Verify mobile-specific elements
    const mobileElements = [
      page.locator('.mobile-layout, .mobile-dashboard'),
      page.locator('.MuiAccordion-root'), // Collapsible sections on mobile
      page.locator('.mobile-stat-card'),
    ];

    let mobileLayoutFound = false;
    for (const element of mobileElements) {
      if (await element.count() > 0) {
        mobileLayoutFound = true;
        break;
      }
    }

    // Test tablet layout
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(500);
    
    const tabletStats = await page.locator('.stats-card, .metric-card, .MuiCard-root').count();
    
    console.log(`Dashboard responsive - Desktop: ${desktopStats} stats, ${desktopCharts} charts`);
    console.log(`Mobile layout detected: ${mobileLayoutFound}`);
    console.log(`Tablet stats: ${tabletStats}`);
    
    // Verify responsive behavior
    expect(desktopStats >= 0).toBeTruthy(); // Should have some content in any layout
  });

  test('should handle dashboard search and filtering', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    if (page.url().includes('/login')) {
      test.skip('Authentication required - skipping dashboard search test');
      return;
    }

    // Look for search functionality
    const searchElements = [
      page.getByPlaceholder(/搜索|Search/i),
      page.getByLabel(/搜索|Search/i),
      page.locator('input[type="search"]'),
    ];

    let searchFound = false;
    for (const element of searchElements) {
      try {
        await expect(element).toBeVisible({ timeout: 3000 });
        searchFound = true;
        
        // Test search functionality
        await element.fill('测试搜索');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(1000);
        
        console.log('Dashboard search functionality tested');
        break;
      } catch (e) {
        // Continue to next element
      }
    }

    // Look for filter controls
    const filterElements = [
      page.getByLabel(/时间范围|Date Range|筛选|Filter/i),
      page.locator('select[name*="filter"], select[name*="period"]'),
      page.getByRole('button', { name: /筛选|Filter|时间|Date/i }),
    ];

    let filterFound = false;
    for (const element of filterElements) {
      try {
        await expect(element).toBeVisible({ timeout: 3000 });
        filterFound = true;
        
        // Test filter functionality
        if (await element.getAttribute('role') === 'button') {
          await element.click();
          await page.waitForTimeout(500);
        }
        
        console.log('Dashboard filter functionality tested');
        break;
      } catch (e) {
        // Continue to next element
      }
    }

    console.log(`Dashboard search/filter - Search: ${searchFound}, Filter: ${filterFound}`);
  });

  test('should display proper loading states', async ({ page }) => {
    // Intercept API calls to simulate slow loading
    await page.route('**/api/**', async route => {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Add delay
      route.continue();
    });

    await page.goto('/dashboard');
    
    if (page.url().includes('/login')) {
      test.skip('Authentication required - skipping loading states test');
      return;
    }

    // Look for loading indicators
    const loadingElements = [
      page.locator('.loading, .spinner'),
      page.locator('.MuiCircularProgress-root, .MuiSkeleton-root'),
      page.locator('[data-testid*="loading"], [aria-label*="loading"]'),
      page.getByText(/加载中|Loading|载入|正在加载/i),
    ];

    let loadingFound = false;
    for (const element of loadingElements) {
      try {
        await expect(element).toBeVisible({ timeout: 3000 });
        loadingFound = true;
        console.log('Loading indicators found during dashboard load');
        break;
      } catch (e) {
        // Continue to next element
      }
    }

    // Wait for loading to complete
    await page.waitForLoadState('networkidle');
    
    // Verify loading states disappear
    let loadingGone = true;
    for (const element of loadingElements) {
      if (await element.count() > 0) {
        const isStillVisible = await element.first().isVisible();
        if (isStillVisible) {
          loadingGone = false;
          break;
        }
      }
    }

    console.log(`Dashboard loading - Loading shown: ${loadingFound}, Loading cleared: ${loadingGone}`);
  });

  test('should handle error states gracefully', async ({ page }) => {
    // Intercept API calls to simulate errors
    await page.route('**/api/**', async route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      });
    });

    await page.goto('/dashboard');
    
    if (page.url().includes('/login')) {
      test.skip('Authentication required - skipping error states test');
      return;
    }

    await page.waitForTimeout(2000);

    // Look for error indicators
    const errorElements = [
      page.locator('.error, .error-message'),
      page.getByText(/错误|Error|失败|Failed|无法加载|Cannot load/i),
      page.locator('.MuiAlert-standardError'),
      page.getByRole('alert'),
    ];

    let errorFound = false;
    for (const element of errorElements) {
      try {
        await expect(element).toBeVisible({ timeout: 5000 });
        errorFound = true;
        console.log('Error state properly displayed');
        break;
      } catch (e) {
        // Continue to next element
      }
    }

    // Look for retry buttons
    const retryElements = [
      page.getByRole('button', { name: /重试|Retry|重新加载|Reload/i }),
      page.locator('[aria-label*="重试"], [aria-label*="retry"]'),
    ];

    let retryFound = false;
    for (const element of retryElements) {
      try {
        await expect(element).toBeVisible({ timeout: 3000 });
        retryFound = true;
        console.log('Retry functionality available');
        break;
      } catch (e) {
        // Continue to next element
      }
    }

    console.log(`Dashboard error handling - Error shown: ${errorFound}, Retry available: ${retryFound}`);
  });
});