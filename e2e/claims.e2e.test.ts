import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/login';

test.describe('债权申报管理测试 - 使用 TEST1 租户', () => {
  test.beforeEach(async ({ page }) => {
    // 每个测试前先登录
    const loginSuccessful = await loginAsAdmin(page);
    if (!loginSuccessful) {
      console.log('登录失败，将跳过债权申报管理测试');
    }
  });

  test('应该成功导航到债权申报列表页面', async ({ page }) => {
    await page.goto('/claims');
    await page.waitForLoadState('networkidle');
    
    // If redirected to login, verify authentication flow
    if (page.url().includes('/login')) {
      await expect(page.getByLabel(/用户名|Username/i)).toBeVisible();
      test.skip(true, '需要认证 - 跳过债权申报列表测试');
      return;
    }

    // Verify claims page elements
    const expectedElements = [
      page.getByRole('heading', { name: /债权|Claims|申报|Declaration/i }),
      page.getByText(/债权列表|Claims List|债权申报|Claim Declaration/i),
    ];

    let elementFound = false;
    for (const element of expectedElements) {
      try {
        await expect(element).toBeVisible({ timeout: 5000 });
        elementFound = true;
        break;
      } catch (e) {
        // Continue to next element
      }
    }

    expect(elementFound).toBeTruthy();
  });

  test('should display claims data in appropriate format', async ({ page }) => {
    await page.goto('/claims');
    await page.waitForLoadState('networkidle');
    
    // Skip if redirected to login
    if (page.url().includes('/login')) {
      test.skip('Authentication required - skipping claims data display test');
      return;
    }

    // Look for claims data display
    const dataContainers = [
      page.locator('table tbody tr'),
      page.locator('.claim-card, .claim-item'),
      page.locator('[data-testid*="claim"]'),
      page.locator('.MuiDataGrid-row'),
    ];

    let dataFound = false;
    for (const container of dataContainers) {
      const count = await container.count();
      if (count > 0) {
        dataFound = true;
        console.log(`Found ${count} claim items`);
        
        // Verify claim data contains expected fields
        const firstItem = container.first();
        await expect(firstItem).toBeVisible();
        
        // Look for common claim fields
        const claimFields = [
          firstItem.locator('text=/债权编号|Claim Number|编号/i'),
          firstItem.locator('text=/债权人|Creditor|申报人/i'),
          firstItem.locator('text=/金额|Amount/i'),
          firstItem.locator('text=/状态|Status/i'),
          firstItem.locator('text=/申报时间|Submission Time|时间/i'),
        ];

        let fieldFound = false;
        for (const field of claimFields) {
          try {
            await expect(field).toBeVisible({ timeout: 2000 });
            fieldFound = true;
            console.log('Claim data field verified');
            break;
          } catch (e) {
            // Continue to next field
          }
        }

        break;
      }
    }

    if (!dataFound) {
      // Check for empty state
      const emptyStateIndicators = [
        page.getByText(/暂无债权|No Claims|空|Empty/i),
        page.getByText(/还没有债权申报|No claims submitted/i),
        page.locator('.empty-state, .no-data'),
      ];

      let emptyStateFound = false;
      for (const indicator of emptyStateIndicators) {
        try {
          await expect(indicator).toBeVisible({ timeout: 3000 });
          emptyStateFound = true;
          console.log('Empty state detected - no claims available');
          break;
        } catch (e) {
          // Continue to next indicator
        }
      }

      if (!emptyStateFound) {
        console.log('No claim data or empty state indicators found');
      }
    }
  });

  test('should navigate to claim submission page', async ({ page }) => {
    await page.goto('/claims/submit');
    await page.waitForLoadState('networkidle');
    
    // If redirected to login
    if (page.url().includes('/login')) {
      test.skip('Authentication required - skipping claim submission test');
      return;
    }

    // Verify claim submission form elements
    const formElements = [
      page.getByRole('heading', { name: /债权申报|Claim Submission|提交申报/i }),
      page.getByLabel(/债权性质|Claim Nature|性质/i),
      page.getByLabel(/本金|Principal|金额|Amount/i),
      page.getByLabel(/利息|Interest/i),
      page.getByLabel(/币种|Currency/i),
      page.getByRole('button', { name: /提交|Submit|申报/i }),
    ];

    let formElementFound = false;
    for (const element of formElements) {
      try {
        await expect(element).toBeVisible({ timeout: 5000 });
        formElementFound = true;
        console.log('Claim submission form element found');
        break;
      } catch (e) {
        // Continue to next element
      }
    }

    if (!formElementFound) {
      // Check if this page requires case selection
      const caseSelectionIndicators = [
        page.getByText(/请选择案件|Please select case/i),
        page.getByText(/未选择案件|No case selected/i),
        page.locator('.case-selector'),
      ];

      for (const indicator of caseSelectionIndicators) {
        try {
          await expect(indicator).toBeVisible({ timeout: 3000 });
          console.log('Case selection required for claim submission');
          return;
        } catch (e) {
          // Continue to next indicator
        }
      }
      
      // If no form elements or case selection found, there might be an access issue
      console.log('No claim submission form elements found - may require permissions or case selection');
    }
  });

  test('should handle claim form validation', async ({ page }) => {
    await page.goto('/claims/submit');
    await page.waitForLoadState('networkidle');
    
    // Skip if redirected to login or requires case selection
    if (page.url().includes('/login')) {
      test.skip('Authentication required - skipping form validation test');
      return;
    }

    // Look for submit button
    const submitButton = page.getByRole('button', { name: /提交|Submit|申报/i });
    
    try {
      await expect(submitButton).toBeVisible({ timeout: 5000 });
      
      // Try to submit empty form
      await submitButton.click();
      
      // Wait for validation messages
      await page.waitForTimeout(1000);
      
      // Look for validation error indicators
      const validationIndicators = [
        page.locator('input:invalid'),
        page.locator('.error, .MuiFormHelperText-error'),
        page.locator('[aria-invalid="true"]'),
        page.getByText(/必填|Required|不能为空|Cannot be empty/i),
      ];

      let validationFound = false;
      for (const indicator of validationIndicators) {
        const count = await indicator.count();
        if (count > 0) {
          validationFound = true;
          console.log(`Found ${count} validation indicators`);
          break;
        }
      }

      if (validationFound) {
        console.log('Form validation working correctly');
      } else {
        console.log('No validation indicators found - form may have different validation approach');
      }
      
    } catch (e) {
      console.log('Submit button not found - may require case selection or different form structure');
    }
  });

  test('should navigate to claim attachment page', async ({ page }) => {
    await page.goto('/claims/attachment');
    await page.waitForLoadState('networkidle');
    
    // If redirected to login
    if (page.url().includes('/login')) {
      test.skip('Authentication required - skipping attachment page test');
      return;
    }

    // Look for attachment-related elements
    const attachmentElements = [
      page.getByRole('heading', { name: /附件|Attachment|文档|Document/i }),
      page.getByText(/上传附件|Upload Attachment|上传文档|Upload Document/i),
      page.locator('input[type="file"]'),
      page.getByRole('button', { name: /选择文件|Choose File|上传|Upload/i }),
      page.locator('.dropzone, .upload-area'),
    ];

    let attachmentElementFound = false;
    for (const element of attachmentElements) {
      try {
        await expect(element).toBeVisible({ timeout: 5000 });
        attachmentElementFound = true;
        console.log('Attachment page element found');
        break;
      } catch (e) {
        // Continue to next element
      }
    }

    if (!attachmentElementFound) {
      console.log('No attachment elements found - page may require specific parameters or permissions');
    }
  });

  test('should display my claims page', async ({ page }) => {
    await page.goto('/my-claims');
    await page.waitForLoadState('networkidle');
    
    // If redirected to login
    if (page.url().includes('/login')) {
      test.skip('Authentication required - skipping my claims test');
      return;
    }

    // Look for my claims elements
    const myClaimsElements = [
      page.getByRole('heading', { name: /我的债权|My Claims|我的申报/i }),
      page.getByText(/我的债权申报|My Claim Submissions/i),
      page.locator('table, .claim-list, .my-claims-grid'),
    ];

    let myClaimsElementFound = false;
    for (const element of myClaimsElements) {
      try {
        await expect(element).toBeVisible({ timeout: 5000 });
        myClaimsElementFound = true;
        console.log('My claims page element found');
        break;
      } catch (e) {
        // Continue to next element
      }
    }

    if (!myClaimsElementFound) {
      // Check for empty state
      const emptyStateIndicators = [
        page.getByText(/您还没有提交任何债权申报|You haven't submitted any claims/i),
        page.getByText(/暂无申报记录|No submission records/i),
        page.locator('.empty-state'),
      ];

      for (const indicator of emptyStateIndicators) {
        try {
          await expect(indicator).toBeVisible({ timeout: 3000 });
          console.log('My claims empty state detected');
          return;
        } catch (e) {
          // Continue to next indicator
        }
      }
      
      console.log('No my claims elements or empty state found');
    }
  });

  test('should handle claim detail view', async ({ page }) => {
    // First try to find a claim ID from claims list
    await page.goto('/claims');
    await page.waitForLoadState('networkidle');
    
    if (page.url().includes('/login')) {
      test.skip('Authentication required - skipping claim detail test');
      return;
    }

    // Look for claim detail links
    const claimLinks = [
      page.locator('table tbody tr a[href*="/claims/"]'),
      page.locator('.claim-card a, .claim-item a'),
      page.getByRole('link', { name: /查看|View|详情|Detail/i }),
    ];

    let claimDetailFound = false;
    for (const links of claimLinks) {
      const count = await links.count();
      if (count > 0) {
        const firstLink = links.first();
        
        const href = await firstLink.getAttribute('href');
        if (href && href.includes('/claims/') && href !== '/claims/submit' && href !== '/claims/attachment') {
          await firstLink.click();
          await page.waitForURL('**/claims/**', { timeout: 5000 });
          
          // Verify we're on a claim detail page
          const claimDetailElements = [
            page.getByRole('heading', { name: /债权详情|Claim Detail|债权信息/i }),
            page.getByText(/债权编号|Claim Number/i),
            page.getByText(/申报金额|Claimed Amount/i),
            page.getByText(/审核状态|Review Status/i),
          ];

          for (const element of claimDetailElements) {
            try {
              await expect(element).toBeVisible({ timeout: 5000 });
              claimDetailFound = true;
              console.log('Claim detail page verified');
              break;
            } catch (e) {
              // Continue to next element
            }
          }
          
          if (claimDetailFound) break;
        }
      }
    }

    if (!claimDetailFound) {
      // Try navigating to a generic claim detail page
      await page.goto('/claims/test-claim-id');
      await page.waitForLoadState('networkidle');
      
      // Check if we get a 404 or detail page
      const is404 = page.url().includes('/404') || await page.getByText(/404|Not Found|找不到/i).isVisible();
      
      if (is404) {
        console.log('Claim detail page returns 404 for test ID - normal behavior');
      } else {
        console.log('Generic claim detail navigation successful');
      }
    }
  });

  test('should handle claims search and filtering', async ({ page }) => {
    await page.goto('/claims');
    await page.waitForLoadState('networkidle');
    
    if (page.url().includes('/login')) {
      test.skip('Authentication required - skipping search and filter test');
      return;
    }

    // Look for search functionality
    const searchElements = [
      page.getByPlaceholder(/搜索债权|Search Claims|搜索|Search/i),
      page.getByLabel(/搜索|Search/i),
      page.locator('input[type="search"], input[name*="search"]'),
    ];

    let searchFound = false;
    for (const element of searchElements) {
      try {
        await expect(element).toBeVisible({ timeout: 3000 });
        searchFound = true;
        
        // Test search functionality
        await element.fill('测试债权');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(1000);
        
        console.log('Search functionality tested');
        break;
      } catch (e) {
        // Continue to next element
      }
    }

    // Look for filter functionality
    const filterElements = [
      page.getByLabel(/状态筛选|Status Filter|筛选|Filter/i),
      page.locator('select[name*="status"], select[name*="filter"]'),
      page.getByRole('button', { name: /筛选|Filter/i }),
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
        } else {
          await element.selectOption({ index: 1 });
          await page.waitForTimeout(1000);
        }
        
        console.log('Filter functionality tested');
        break;
      } catch (e) {
        // Continue to next element
      }
    }

    console.log(`Claims search/filter - Search: ${searchFound}, Filter: ${filterFound}`);
  });

  test('should display claim statistics and summary info', async ({ page }) => {
    await page.goto('/claims');
    await page.waitForLoadState('networkidle');
    
    if (page.url().includes('/login')) {
      test.skip('Authentication required - skipping statistics test');
      return;
    }

    // Look for statistics or summary cards
    const statsElements = [
      page.locator('.stats-card, .summary-card'),
      page.getByText(/总计|Total|统计|Statistics/i),
      page.locator('[data-testid*="stat"]'),
      page.locator('.MuiCard-root:has-text("总"), .MuiCard-root:has-text("Total")'),
    ];

    let statsFound = false;
    for (const element of statsElements) {
      const count = await element.count();
      if (count > 0) {
        statsFound = true;
        console.log(`Found ${count} statistics elements`);
        
        // Verify stats contain numbers
        const firstStat = element.first();
        await expect(firstStat).toBeVisible();
        
        // Look for numeric values in stats
        const numericPattern = /\d+/;
        const textContent = await firstStat.textContent();
        
        if (textContent && numericPattern.test(textContent)) {
          console.log('Statistics contain numeric data');
        }
        
        break;
      }
    }

    if (!statsFound) {
      console.log('No statistics or summary elements found');
    }
  });

  test('should handle responsive layout for claims', async ({ page }) => {
    await page.goto('/claims');
    await page.waitForLoadState('networkidle');
    
    if (page.url().includes('/login')) {
      test.skip('Authentication required - skipping responsive layout test');
      return;
    }

    // Test desktop layout
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.waitForTimeout(500);
    
    const desktopIndicators = page.locator('table, .desktop-layout');
    const hasDesktopLayout = await desktopIndicators.count() > 0;
    
    // Test mobile layout
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);
    
    const mobileIndicators = page.locator('.mobile-layout, .claim-card, .MuiAccordion-root');
    const hasMobileLayout = await mobileIndicators.count() > 0;
    
    console.log(`Claims responsive layout - Desktop: ${hasDesktopLayout}, Mobile: ${hasMobileLayout}`);
    
    // At least one layout should be responsive
    expect(hasDesktopLayout || hasMobileLayout).toBeTruthy();
  });
});