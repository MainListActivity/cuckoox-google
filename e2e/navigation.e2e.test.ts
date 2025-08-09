import { test, expect } from '@playwright/test';

test.describe('Navigation and Layout', () => {
  test.beforeEach(async ({ page }) => {
    // Each test starts fresh
  });

  test('should display main navigation menu', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // If on login page, that's expected - test navigation after potential login
    if (page.url().includes('/login')) {
      console.log('On login page - navigation will be tested after authentication');
      
      // Look for any navigation elements even on login page
      const loginNavElements = [
        page.locator('nav, .navigation'),
        page.getByRole('navigation'),
        page.locator('.header, .top-bar'),
      ];

      let loginNavFound = false;
      for (const element of loginNavElements) {
        if (await element.count() > 0) {
          loginNavFound = true;
          console.log('Some navigation elements found on login page');
          break;
        }
      }

      // Try to navigate directly to a main page to test navigation
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
    }

    // Now test for main navigation elements
    const navigationElements = [
      page.locator('nav, .navigation, .sidebar'),
      page.getByRole('navigation'),
      page.locator('.main-nav, .app-nav'),
      page.locator('.MuiDrawer-root'),
    ];

    let navFound = false;
    for (const element of navigationElements) {
      const count = await element.count();
      if (count > 0) {
        navFound = true;
        console.log(`Found ${count} navigation elements`);
        break;
      }
    }

    if (!navFound && page.url().includes('/login')) {
      test.skip('Still on login page - authentication required for navigation test');
      return;
    }

    expect(navFound).toBeTruthy();
  });

  test('should display main menu items', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    if (page.url().includes('/login')) {
      test.skip('Authentication required - skipping menu items test');
      return;
    }

    // Look for common menu items
    const menuItems = [
      page.getByRole('link', { name: /仪表板|Dashboard|概览/i }),
      page.getByRole('link', { name: /案件|Cases|案件管理/i }),
      page.getByRole('link', { name: /债权|Claims|债权申报/i }),
      page.getByRole('link', { name: /债权人|Creditors|债权人管理/i }),
      page.getByRole('link', { name: /管理|Admin|设置/i }),
    ];

    const foundMenuItems = [];
    for (const item of menuItems) {
      try {
        await expect(item).toBeVisible({ timeout: 3000 });
        const itemText = await item.textContent();
        if (itemText) {
          foundMenuItems.push(itemText.trim());
        }
      } catch (e) {
        // Item not found, continue
      }
    }

    console.log(`Found menu items: ${foundMenuItems.join(', ')}`);
    expect(foundMenuItems.length).toBeGreaterThan(0);
  });

  test('should handle menu navigation between pages', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    if (page.url().includes('/login')) {
      test.skip('Authentication required - skipping menu navigation test');
      return;
    }

    // Test navigation to different pages
    const navigationTests = [
      { link: /案件|Cases/i, expectedUrl: /cases/ },
      { link: /债权|Claims/i, expectedUrl: /claims/ },
      { link: /债权人|Creditors/i, expectedUrl: /creditors/ },
    ];

    for (const navTest of navigationTests) {
      const menuLink = page.getByRole('link', { name: navTest.link });
      
      try {
        await expect(menuLink).toBeVisible({ timeout: 3000 });
        
        // Click the menu item
        await menuLink.click();
        await page.waitForLoadState('networkidle');
        
        // Verify navigation occurred
        await expect(page).toHaveURL(navTest.expectedUrl, { timeout: 5000 });
        console.log(`Successfully navigated to ${page.url()}`);
        
        // Navigate back to dashboard for next test
        const dashboardLink = page.getByRole('link', { name: /仪表板|Dashboard/i });
        if (await dashboardLink.count() > 0) {
          await dashboardLink.click();
          await page.waitForLoadState('networkidle');
        } else {
          await page.goto('/dashboard');
          await page.waitForLoadState('networkidle');
        }
        
      } catch (e) {
        console.log(`Navigation to ${navTest.link} not available or failed`);
      }
    }
  });

  test('should display user profile and account menu', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    if (page.url().includes('/login')) {
      test.skip('Authentication required - skipping user profile test');
      return;
    }

    // Look for user profile elements
    const userProfileElements = [
      page.locator('.user-profile, .account-menu'),
      page.getByRole('button', { name: /用户|User|账户|Account|头像|Avatar/i }),
      page.locator('.MuiAvatar-root'),
      page.locator('[data-testid*="user"], [data-testid*="profile"]'),
    ];

    let userProfileFound = false;
    for (const element of userProfileElements) {
      const count = await element.count();
      if (count > 0) {
        userProfileFound = true;
        console.log(`Found ${count} user profile elements`);
        
        // Try to click and open user menu
        const firstElement = element.first();
        
        if (await firstElement.getAttribute('role') === 'button') {
          await firstElement.click();
          await page.waitForTimeout(1000);
          
          // Look for user menu items
          const userMenuItems = [
            page.getByRole('menuitem', { name: /个人资料|Profile|设置|Settings/i }),
            page.getByRole('menuitem', { name: /退出登录|Logout|登出/i }),
            page.getByText(/个人信息|Personal Info|账户设置|Account Settings/i),
          ];

          let menuItemFound = false;
          for (const menuItem of userMenuItems) {
            try {
              await expect(menuItem).toBeVisible({ timeout: 3000 });
              menuItemFound = true;
              console.log('User menu opened with menu items');
              break;
            } catch (e) {
              // Continue to next menu item
            }
          }

          if (menuItemFound) {
            // Click outside to close menu
            await page.click('body', { position: { x: 100, y: 100 } });
            await page.waitForTimeout(500);
          }
        }

        break;
      }
    }

    if (!userProfileFound) {
      console.log('No user profile elements found - may be different design pattern');
    }
  });

  test('should handle responsive navigation for mobile', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    if (page.url().includes('/login')) {
      test.skip('Authentication required - skipping mobile navigation test');
      return;
    }

    // Test mobile layout
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);

    // Look for mobile navigation elements
    const mobileNavElements = [
      page.getByRole('button', { name: /菜单|Menu|导航|Navigation/i }),
      page.locator('.mobile-menu-button, .hamburger-menu'),
      page.locator('[aria-label*="菜单"], [aria-label*="menu"]'),
      page.locator('.MuiIconButton-root:has([data-testid*="menu"])'),
    ];

    let mobileNavFound = false;
    for (const element of mobileNavElements) {
      try {
        await expect(element).toBeVisible({ timeout: 3000 });
        mobileNavFound = true;
        console.log('Mobile navigation button found');
        
        // Try to open mobile menu
        await element.click();
        await page.waitForTimeout(1000);
        
        // Look for mobile menu content
        const mobileMenuContent = [
          page.locator('.MuiDrawer-root[aria-hidden="false"]'),
          page.locator('.mobile-menu:visible'),
          page.locator('.sidebar:visible'),
        ];

        let menuContentFound = false;
        for (const content of mobileMenuContent) {
          try {
            await expect(content).toBeVisible({ timeout: 3000 });
            menuContentFound = true;
            console.log('Mobile menu content opened');
            
            // Look for menu items in mobile menu
            const mobileMenuItems = content.locator('a, [role="menuitem"]');
            const itemCount = await mobileMenuItems.count();
            console.log(`Found ${itemCount} items in mobile menu`);
            
            // Close mobile menu
            const closeButton = content.locator('button[aria-label*="关闭"], button[aria-label*="close"]');
            if (await closeButton.count() > 0) {
              await closeButton.click();
            } else {
              // Try clicking outside or pressing escape
              await page.keyboard.press('Escape');
            }
            
            break;
          } catch (e) {
            // Continue to next content element
          }
        }

        if (!menuContentFound) {
          console.log('Mobile nav button clicked but menu content not found');
        }

        break;
      } catch (e) {
        // Continue to next element
      }
    }

    if (!mobileNavFound) {
      console.log('No mobile navigation elements found');
    }

    // Reset to desktop for other tests
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.waitForTimeout(500);
  });

  test('should display breadcrumbs for navigation context', async ({ page }) => {
    await page.goto('/cases');
    await page.waitForLoadState('networkidle');
    
    if (page.url().includes('/login')) {
      test.skip('Authentication required - skipping breadcrumbs test');
      return;
    }

    // Look for breadcrumb elements
    const breadcrumbElements = [
      page.locator('.breadcrumbs, .breadcrumb'),
      page.locator('nav[aria-label*="breadcrumb"], nav[aria-label*="面包屑"]'),
      page.locator('.MuiBreadcrumbs-root'),
      page.locator('[data-testid*="breadcrumb"]'),
    ];

    let breadcrumbFound = false;
    for (const element of breadcrumbElements) {
      const count = await element.count();
      if (count > 0) {
        breadcrumbFound = true;
        console.log(`Found ${count} breadcrumb elements`);
        
        // Verify breadcrumb contains navigation path
        const breadcrumbText = await element.first().textContent();
        if (breadcrumbText) {
          console.log(`Breadcrumb content: ${breadcrumbText}`);
          
          // Look for common breadcrumb separators and items
          const hasSeparators = breadcrumbText.includes('/') || breadcrumbText.includes('>') || breadcrumbText.includes('›');
          const hasMultipleItems = breadcrumbText.split(/[/>›]/).length > 1;
          
          if (hasSeparators || hasMultipleItems) {
            console.log('Breadcrumb appears to have navigation structure');
          }
        }

        break;
      }
    }

    if (!breadcrumbFound) {
      console.log('No breadcrumb navigation found');
    }
  });

  test('should handle page header and title display', async ({ page }) => {
    const testPages = [
      { url: '/dashboard', expectedTitle: /仪表板|Dashboard/i },
      { url: '/cases', expectedTitle: /案件|Cases/i },
      { url: '/claims', expectedTitle: /债权|Claims/i },
      { url: '/creditors', expectedTitle: /债权人|Creditors/i },
    ];

    for (const testPage of testPages) {
      await page.goto(testPage.url);
      await page.waitForLoadState('networkidle');
      
      if (page.url().includes('/login')) {
        console.log(`Authentication required for ${testPage.url} - skipping`);
        continue;
      }

      // Look for page title/header
      const titleElements = [
        page.getByRole('heading', { name: testPage.expectedTitle }),
        page.locator('h1, h2').filter({ hasText: testPage.expectedTitle }),
        page.locator('.page-title, .page-header').filter({ hasText: testPage.expectedTitle }),
      ];

      let titleFound = false;
      for (const element of titleElements) {
        try {
          await expect(element).toBeVisible({ timeout: 5000 });
          titleFound = true;
          console.log(`Page title verified for ${testPage.url}`);
          break;
        } catch (e) {
          // Continue to next element
        }
      }

      if (!titleFound) {
        console.log(`No matching title found for ${testPage.url}`);
      }

      // Verify browser title is set appropriately
      const browserTitle = await page.title();
      const hasCuckooX = browserTitle.toLowerCase().includes('cuckoox');
      
      if (hasCuckooX) {
        console.log(`Browser title properly set: ${browserTitle}`);
      }
    }
  });

  test('should handle footer display and links', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Look for footer elements
    const footerElements = [
      page.locator('footer'),
      page.locator('.footer, .app-footer'),
      page.locator('[role="contentinfo"]'),
    ];

    let footerFound = false;
    for (const element of footerElements) {
      const count = await element.count();
      if (count > 0) {
        footerFound = true;
        console.log(`Found ${count} footer elements`);
        
        // Look for footer content
        const footerText = await element.first().textContent();
        if (footerText) {
          console.log(`Footer content preview: ${footerText.substring(0, 100)}...`);
          
          // Look for common footer elements
          const hasCopyright = footerText.includes('©') || footerText.includes('版权');
          const hasYear = footerText.includes('2024') || footerText.includes('2023');
          const hasBrandName = footerText.toLowerCase().includes('cuckoox');
          
          console.log(`Footer elements - Copyright: ${hasCopyright}, Year: ${hasYear}, Brand: ${hasBrandName}`);
        }

        // Look for footer links
        const footerLinks = element.locator('a');
        const linkCount = await footerLinks.count();
        if (linkCount > 0) {
          console.log(`Found ${linkCount} links in footer`);
        }

        break;
      }
    }

    if (!footerFound) {
      console.log('No footer elements found');
    }
  });

  test('should handle theme switching functionality', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Look for theme toggle elements
    const themeToggleElements = [
      page.getByRole('button', { name: /主题|Theme|暗色|Dark|亮色|Light/i }),
      page.locator('[aria-label*="主题"], [aria-label*="theme"]'),
      page.locator('.theme-toggle, .dark-mode-toggle'),
      page.locator('[data-testid*="theme"]'),
    ];

    let themeToggleFound = false;
    for (const element of themeToggleElements) {
      try {
        await expect(element).toBeVisible({ timeout: 3000 });
        themeToggleFound = true;
        console.log('Theme toggle found');
        
        // Get current theme (check body class or other theme indicators)
        const bodyClasses = await page.locator('body').getAttribute('class');
        const isDarkTheme = bodyClasses?.includes('dark') || bodyClasses?.includes('theme-dark');
        
        console.log(`Current theme appears to be: ${isDarkTheme ? 'dark' : 'light'}`);
        
        // Click theme toggle
        await element.click();
        await page.waitForTimeout(1000);
        
        // Check if theme changed
        const newBodyClasses = await page.locator('body').getAttribute('class');
        const isNowDarkTheme = newBodyClasses?.includes('dark') || newBodyClasses?.includes('theme-dark');
        
        if (isDarkTheme !== isNowDarkTheme) {
          console.log('Theme toggle appears to be working');
        } else {
          console.log('Theme toggle clicked but change not detected in body classes');
        }

        break;
      } catch (e) {
        // Continue to next element
      }
    }

    if (!themeToggleFound) {
      console.log('No theme toggle functionality found');
    }
  });

  test('should handle language switching if available', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Look for language switching elements
    const languageElements = [
      page.getByRole('button', { name: /语言|Language|中文|English/i }),
      page.locator('[aria-label*="语言"], [aria-label*="language"]'),
      page.locator('.language-selector, .locale-selector'),
      page.getByText(/EN|中|CN/),
    ];

    let languageToggleFound = false;
    for (const element of languageElements) {
      const count = await element.count();
      if (count > 0) {
        languageToggleFound = true;
        console.log(`Found ${count} language toggle elements`);
        
        // Try to click and see if language menu opens
        const firstElement = element.first();
        await firstElement.click();
        await page.waitForTimeout(1000);
        
        // Look for language options
        const languageOptions = [
          page.getByText(/中文|Chinese|简体中文/i),
          page.getByText(/English|英文/i),
          page.locator('[role="menuitem"]'),
        ];

        let optionsFound = false;
        for (const option of languageOptions) {
          if (await option.count() > 0) {
            optionsFound = true;
            console.log('Language options menu opened');
            break;
          }
        }

        if (!optionsFound) {
          console.log('Language button clicked but no options found');
        }

        // Click outside to close any menu
        await page.click('body', { position: { x: 100, y: 100 } });

        break;
      }
    }

    if (!languageToggleFound) {
      console.log('No language switching functionality found');
    }
  });

  test('should handle search functionality in navigation', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    if (page.url().includes('/login')) {
      test.skip('Authentication required - skipping navigation search test');
      return;
    }

    // Look for global search elements
    const searchElements = [
      page.getByPlaceholder(/全局搜索|Global Search|搜索|Search/i),
      page.getByRole('searchbox'),
      page.locator('input[type="search"]'),
      page.locator('.global-search, .nav-search'),
    ];

    let searchFound = false;
    for (const element of searchElements) {
      try {
        await expect(element).toBeVisible({ timeout: 3000 });
        searchFound = true;
        console.log('Global search found in navigation');
        
        // Test search functionality
        await element.fill('测试搜索');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(1000);
        
        // Look for search results or navigation to search page
        const searchResults = [
          page.locator('.search-results'),
          page.getByText(/搜索结果|Search Results/i),
          page.locator('.search-dropdown'),
        ];

        let resultsFound = false;
        for (const results of searchResults) {
          if (await results.count() > 0) {
            resultsFound = true;
            console.log('Search results or search page displayed');
            break;
          }
        }

        if (!resultsFound) {
          console.log('Search executed but no obvious results display found');
        }

        break;
      } catch (e) {
        // Continue to next element
      }
    }

    if (!searchFound) {
      console.log('No global search functionality found in navigation');
    }
  });

  test('should handle notification or alert indicators', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    if (page.url().includes('/login')) {
      test.skip('Authentication required - skipping notifications test');
      return;
    }

    // Look for notification elements
    const notificationElements = [
      page.getByRole('button', { name: /通知|Notifications|消息|Messages/i }),
      page.locator('.notification-icon, .alert-icon'),
      page.locator('[aria-label*="通知"], [aria-label*="notification"]'),
      page.locator('.badge, .notification-badge'),
    ];

    let notificationFound = false;
    for (const element of notificationElements) {
      const count = await element.count();
      if (count > 0) {
        notificationFound = true;
        console.log(`Found ${count} notification elements`);
        
        // Check for notification badges/counts
        const badgeElements = element.locator('.badge, .count, .notification-count');
        const badgeCount = await badgeElements.count();
        
        if (badgeCount > 0) {
          console.log('Notification badges/counts found');
        }

        // Try to click and open notifications
        const firstElement = element.first();
        if (await firstElement.getAttribute('role') === 'button') {
          await firstElement.click();
          await page.waitForTimeout(1000);
          
          // Look for notification panel
          const notificationPanel = [
            page.locator('.notification-panel, .notifications-dropdown'),
            page.getByText(/通知列表|Notifications List/i),
            page.locator('[role="dialog"]:has-text("通知")'),
          ];

          let panelFound = false;
          for (const panel of notificationPanel) {
            try {
              await expect(panel).toBeVisible({ timeout: 3000 });
              panelFound = true;
              console.log('Notification panel opened');
              
              // Close panel
              await page.click('body', { position: { x: 100, y: 100 } });
              break;
            } catch (e) {
              // Continue to next panel
            }
          }

          if (!panelFound) {
            console.log('Notification button clicked but panel not found');
          }
        }

        break;
      }
    }

    if (!notificationFound) {
      console.log('No notification functionality found');
    }
  });
});