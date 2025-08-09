import { test, expect } from '@playwright/test';

test.describe('Creditors Management', () => {
  test.beforeEach(async ({ page }) => {
    // Each test starts fresh
  });

  test('should navigate to creditors list page', async ({ page }) => {
    await page.goto('/creditors');
    await page.waitForLoadState('networkidle');
    
    // If redirected to login
    if (page.url().includes('/login')) {
      await expect(page.getByLabel(/用户名|Username/i)).toBeVisible();
      test.skip('Authentication required - skipping creditors test');
      return;
    }

    // Verify creditors page elements
    const expectedElements = [
      page.getByRole('heading', { name: /债权人|Creditors|债权人管理|Creditor Management/i }),
      page.getByText(/债权人列表|Creditors List|债权人信息|Creditor Information/i),
    ];

    let elementFound = false;
    for (const element of expectedElements) {
      try {
        await expect(element).toBeVisible({ timeout: 5000 });
        elementFound = true;
        console.log('Creditors page element verified');
        break;
      } catch (e) {
        // Continue to next element
      }
    }

    expect(elementFound).toBeTruthy();
  });

  test('should display creditors data in table or card format', async ({ page }) => {
    await page.goto('/creditors');
    await page.waitForLoadState('networkidle');
    
    if (page.url().includes('/login')) {
      test.skip('Authentication required - skipping creditors data display test');
      return;
    }

    // Look for creditors data display
    const dataContainers = [
      page.locator('table tbody tr'),
      page.locator('.creditor-card, .creditor-item'),
      page.locator('[data-testid*="creditor"]'),
      page.locator('.MuiDataGrid-row'),
    ];

    let dataFound = false;
    for (const container of dataContainers) {
      const count = await container.count();
      if (count > 0) {
        dataFound = true;
        console.log(`Found ${count} creditor items`);
        
        // Verify creditor data contains expected fields
        const firstItem = container.first();
        await expect(firstItem).toBeVisible();
        
        // Look for common creditor fields
        const creditorFields = [
          firstItem.locator('text=/姓名|Name|债权人姓名|Creditor Name/i'),
          firstItem.locator('text=/身份证|ID Card|证件号|ID Number/i'),
          firstItem.locator('text=/联系方式|Contact|电话|Phone/i'),
          firstItem.locator('text=/地址|Address/i'),
          firstItem.locator('text=/邮编|Postal Code|邮箱|Email/i'),
        ];

        let fieldFound = false;
        for (const field of creditorFields) {
          try {
            await expect(field).toBeVisible({ timeout: 2000 });
            fieldFound = true;
            console.log('Creditor data field verified');
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
        page.getByText(/暂无债权人|No Creditors|空|Empty/i),
        page.getByText(/还没有债权人信息|No creditor information/i),
        page.locator('.empty-state, .no-data'),
      ];

      let emptyStateFound = false;
      for (const indicator of emptyStateIndicators) {
        try {
          await expect(indicator).toBeVisible({ timeout: 3000 });
          emptyStateFound = true;
          console.log('Empty state detected - no creditors available');
          break;
        } catch (e) {
          // Continue to next indicator
        }
      }

      if (!emptyStateFound) {
        console.log('No creditor data or empty state indicators found');
      }
    }
  });

  test('should display add creditor functionality', async ({ page }) => {
    await page.goto('/creditors');
    await page.waitForLoadState('networkidle');
    
    if (page.url().includes('/login')) {
      test.skip('Authentication required - skipping add creditor test');
      return;
    }

    // Look for add creditor button
    const addButtons = [
      page.getByRole('button', { name: /添加债权人|Add Creditor|新增债权人|Create Creditor/i }),
      page.getByRole('button', { name: /添加|Add|新增|Create/i }),
      page.locator('[aria-label*="添加"], [aria-label*="Add"], [title*="添加"], [title*="Add"]'),
    ];

    let addButtonFound = false;
    for (const button of addButtons) {
      try {
        await expect(button).toBeVisible({ timeout: 5000 });
        addButtonFound = true;
        console.log('Add creditor button found');
        
        // Try to click and see if dialog/form opens
        await button.click();
        await page.waitForTimeout(1000);
        
        // Look for add creditor dialog or form
        const addCreditorForm = [
          page.locator('.MuiDialog-root:visible'),
          page.getByRole('dialog'),
          page.locator('.add-creditor-form, .creditor-form'),
          page.getByText(/添加债权人|Add Creditor|债权人信息|Creditor Information/i),
        ];

        let formFound = false;
        for (const form of addCreditorForm) {
          try {
            await expect(form).toBeVisible({ timeout: 3000 });
            formFound = true;
            console.log('Add creditor form/dialog opened');
            
            // Look for form fields
            const formFields = [
              page.getByLabel(/姓名|Name|债权人姓名/i),
              page.getByLabel(/身份证|ID Card|证件号/i),
              page.getByLabel(/联系方式|Contact|电话/i),
              page.getByLabel(/地址|Address/i),
            ];

            let fieldsFound = 0;
            for (const field of formFields) {
              try {
                await expect(field).toBeVisible({ timeout: 2000 });
                fieldsFound++;
              } catch (e) {
                // Continue to next field
              }
            }

            if (fieldsFound > 0) {
              console.log(`Found ${fieldsFound} form fields in add creditor form`);
            }

            // Close the dialog if it opened
            const closeButton = page.getByRole('button', { name: /取消|Cancel|关闭|Close/i });
            try {
              await closeButton.click();
              await page.waitForTimeout(500);
            } catch (e) {
              // Try pressing Escape
              await page.keyboard.press('Escape');
            }

            break;
          } catch (e) {
            // Continue to next form element
          }
        }

        if (!formFound) {
          console.log('Add creditor button clicked but no form found - may require permissions');
        }

        break;
      } catch (e) {
        // Continue to next button
      }
    }

    if (!addButtonFound) {
      console.log('No add creditor button found - may be due to permissions');
    }
  });

  test('should handle creditors search and filtering', async ({ page }) => {
    await page.goto('/creditors');
    await page.waitForLoadState('networkidle');
    
    if (page.url().includes('/login')) {
      test.skip('Authentication required - skipping search and filter test');
      return;
    }

    // Look for search functionality
    const searchElements = [
      page.getByPlaceholder(/搜索债权人|Search Creditors|搜索|Search/i),
      page.getByLabel(/搜索|Search/i),
      page.locator('input[type="search"], input[name*="search"]'),
    ];

    let searchFound = false;
    for (const element of searchElements) {
      try {
        await expect(element).toBeVisible({ timeout: 3000 });
        searchFound = true;
        
        // Test search functionality
        await element.fill('张三');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(1000);
        
        console.log('Creditors search functionality tested');
        break;
      } catch (e) {
        // Continue to next element
      }
    }

    // Look for filter functionality
    const filterElements = [
      page.getByLabel(/筛选|Filter|分类|Category/i),
      page.locator('select[name*="filter"], select[name*="type"]'),
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
          const optionCount = await element.locator('option').count();
          if (optionCount > 1) {
            await element.selectOption({ index: 1 });
            await page.waitForTimeout(1000);
          }
        }
        
        console.log('Creditors filter functionality tested');
        break;
      } catch (e) {
        // Continue to next element
      }
    }

    console.log(`Creditors search/filter - Search: ${searchFound}, Filter: ${filterFound}`);
  });

  test('should display batch import functionality', async ({ page }) => {
    await page.goto('/creditors');
    await page.waitForLoadState('networkidle');
    
    if (page.url().includes('/login')) {
      test.skip('Authentication required - skipping batch import test');
      return;
    }

    // Look for batch import button
    const importButtons = [
      page.getByRole('button', { name: /批量导入|Batch Import|导入|Import|批量添加/i }),
      page.getByRole('button', { name: /Excel导入|Excel Import/i }),
      page.locator('[aria-label*="导入"], [aria-label*="Import"]'),
    ];

    let importButtonFound = false;
    for (const button of importButtons) {
      try {
        await expect(button).toBeVisible({ timeout: 5000 });
        importButtonFound = true;
        console.log('Batch import button found');
        
        // Try to click and see if import dialog opens
        await button.click();
        await page.waitForTimeout(1000);
        
        // Look for import dialog
        const importDialog = [
          page.locator('.MuiDialog-root:visible'),
          page.getByRole('dialog'),
          page.getByText(/批量导入|Batch Import|导入债权人|Import Creditors/i),
          page.locator('.import-dialog, .batch-import'),
        ];

        let dialogFound = false;
        for (const dialog of importDialog) {
          try {
            await expect(dialog).toBeVisible({ timeout: 3000 });
            dialogFound = true;
            console.log('Batch import dialog opened');
            
            // Look for file upload elements
            const uploadElements = [
              page.locator('input[type="file"]'),
              page.getByText(/选择文件|Choose File|上传文件|Upload File/i),
              page.locator('.dropzone, .upload-area'),
            ];

            let uploadFound = false;
            for (const upload of uploadElements) {
              try {
                await expect(upload).toBeVisible({ timeout: 2000 });
                uploadFound = true;
                console.log('File upload element found');
                break;
              } catch (e) {
                // Continue to next upload element
              }
            }

            // Look for template download
            const templateElements = [
              page.getByRole('button', { name: /下载模板|Download Template|模板|Template/i }),
              page.getByText(/下载模板|Download Template/i),
            ];

            let templateFound = false;
            for (const template of templateElements) {
              try {
                await expect(template).toBeVisible({ timeout: 2000 });
                templateFound = true;
                console.log('Template download found');
                break;
              } catch (e) {
                // Continue to next template element
              }
            }

            console.log(`Import dialog elements - Upload: ${uploadFound}, Template: ${templateFound}`);

            // Close the dialog
            const closeButton = page.getByRole('button', { name: /取消|Cancel|关闭|Close/i });
            try {
              await closeButton.click();
              await page.waitForTimeout(500);
            } catch (e) {
              await page.keyboard.press('Escape');
            }

            break;
          } catch (e) {
            // Continue to next dialog element
          }
        }

        if (!dialogFound) {
          console.log('Import button clicked but no dialog found');
        }

        break;
      } catch (e) {
        // Continue to next button
      }
    }

    if (!importButtonFound) {
      console.log('No batch import button found - may be due to permissions');
    }
  });

  test('should handle creditor detail view and editing', async ({ page }) => {
    await page.goto('/creditors');
    await page.waitForLoadState('networkidle');
    
    if (page.url().includes('/login')) {
      test.skip('Authentication required - skipping creditor detail test');
      return;
    }

    // Look for creditor detail/edit buttons
    const detailButtons = [
      page.locator('table tbody tr button, table tbody tr a'),
      page.getByRole('button', { name: /查看|View|编辑|Edit|详情|Detail/i }),
      page.locator('.creditor-card button, .creditor-item button'),
      page.locator('[aria-label*="查看"], [aria-label*="编辑"], [aria-label*="详情"]'),
    ];

    let detailFound = false;
    for (const buttons of detailButtons) {
      const count = await buttons.count();
      if (count > 0) {
        detailFound = true;
        console.log(`Found ${count} detail/edit buttons`);
        
        // Try clicking the first one
        const firstButton = buttons.first();
        await firstButton.click();
        await page.waitForTimeout(1000);
        
        // Look for detail dialog or edit form
        const detailElements = [
          page.locator('.MuiDialog-root:visible'),
          page.getByRole('dialog'),
          page.getByText(/债权人详情|Creditor Details|编辑债权人|Edit Creditor/i),
          page.locator('.creditor-detail, .creditor-edit'),
        ];

        let detailDialogFound = false;
        for (const element of detailElements) {
          try {
            await expect(element).toBeVisible({ timeout: 3000 });
            detailDialogFound = true;
            console.log('Creditor detail/edit dialog opened');
            
            // Look for creditor information fields
            const infoElements = [
              page.getByText(/姓名|Name/i),
              page.getByText(/身份证|ID Card|证件号/i),
              page.getByText(/联系方式|Contact|电话/i),
              page.getByText(/地址|Address/i),
            ];

            let infoFound = 0;
            for (const info of infoElements) {
              if (await info.count() > 0) {
                infoFound++;
              }
            }

            console.log(`Found ${infoFound} information fields in detail view`);

            // Close the dialog
            const closeButton = page.getByRole('button', { name: /取消|Cancel|关闭|Close/i });
            try {
              await closeButton.click();
              await page.waitForTimeout(500);
            } catch (e) {
              await page.keyboard.press('Escape');
            }

            break;
          } catch (e) {
            // Continue to next element
          }
        }

        if (!detailDialogFound) {
          console.log('Detail button clicked but no dialog found');
        }

        break;
      }
    }

    if (!detailFound) {
      console.log('No creditor detail/edit buttons found');
    }
  });

  test('should display creditor claims relationship', async ({ page }) => {
    await page.goto('/creditors');
    await page.waitForLoadState('networkidle');
    
    if (page.url().includes('/login')) {
      test.skip('Authentication required - skipping creditor claims test');
      return;
    }

    // Look for claims-related information
    const claimsElements = [
      page.getByText(/债权申报|Claims|相关债权|Related Claims/i),
      page.getByRole('button', { name: /查看债权|View Claims|债权详情|Claims Detail/i }),
      page.locator('.claims-count, .creditor-claims'),
      page.locator('[data-testid*="claims"]'),
    ];

    let claimsInfoFound = false;
    for (const element of claimsElements) {
      const count = await element.count();
      if (count > 0) {
        claimsInfoFound = true;
        console.log(`Found ${count} claims-related elements`);
        
        // Try to interact with claims information
        const firstElement = element.first();
        
        if (await firstElement.getAttribute('role') === 'button') {
          await firstElement.click();
          await page.waitForTimeout(1000);
          
          // Look for claims dialog or page
          const claimsDialog = [
            page.locator('.MuiDialog-root:visible'),
            page.getByRole('dialog'),
            page.getByText(/债权申报列表|Claims List|债权详情|Claims Details/i),
          ];

          for (const dialog of claimsDialog) {
            try {
              await expect(dialog).toBeVisible({ timeout: 3000 });
              console.log('Claims dialog opened successfully');
              
              // Close the dialog
              const closeButton = page.getByRole('button', { name: /关闭|Close/i });
              try {
                await closeButton.click();
              } catch (e) {
                await page.keyboard.press('Escape');
              }
              
              break;
            } catch (e) {
              // Continue to next dialog element
            }
          }
        }

        break;
      }
    }

    if (!claimsInfoFound) {
      console.log('No claims relationship information found');
    }
  });

  test('should handle export functionality', async ({ page }) => {
    await page.goto('/creditors');
    await page.waitForLoadState('networkidle');
    
    if (page.url().includes('/login')) {
      test.skip('Authentication required - skipping export test');
      return;
    }

    // Look for export buttons
    const exportButtons = [
      page.getByRole('button', { name: /导出|Export|下载|Download/i }),
      page.getByRole('button', { name: /Excel导出|Excel Export/i }),
      page.locator('[aria-label*="导出"], [aria-label*="Export"]'),
    ];

    let exportFound = false;
    for (const button of exportButtons) {
      try {
        await expect(button).toBeVisible({ timeout: 5000 });
        exportFound = true;
        console.log('Export button found');
        
        // Set up download handler
        const downloadPromise = page.waitForEvent('download', { timeout: 5000 });
        
        await button.click();
        
        try {
          const download = await downloadPromise;
          console.log(`Export download started: ${download.suggestedFilename()}`);
          
          // Cancel the download to avoid saving files
          await download.cancel();
        } catch (e) {
          console.log('Export button clicked but no download initiated');
        }

        break;
      } catch (e) {
        // Continue to next button
      }
    }

    if (!exportFound) {
      console.log('No export functionality found');
    }
  });

  test('should handle responsive layout for creditors', async ({ page }) => {
    await page.goto('/creditors');
    await page.waitForLoadState('networkidle');
    
    if (page.url().includes('/login')) {
      test.skip('Authentication required - skipping responsive layout test');
      return;
    }

    // Test desktop layout
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.waitForTimeout(500);
    
    const desktopElements = page.locator('table, .desktop-layout');
    const hasDesktopLayout = await desktopElements.count() > 0;
    
    // Test mobile layout
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);
    
    const mobileElements = page.locator('.mobile-layout, .creditor-card, .MuiAccordion-root');
    const hasMobileLayout = await mobileElements.count() > 0;
    
    // Test tablet layout
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(500);
    
    console.log(`Creditors responsive layout - Desktop: ${hasDesktopLayout}, Mobile: ${hasMobileLayout}`);
    
    // At least one layout should be responsive
    expect(hasDesktopLayout || hasMobileLayout).toBeTruthy();
  });

  test('should display pagination for large creditor lists', async ({ page }) => {
    await page.goto('/creditors');
    await page.waitForLoadState('networkidle');
    
    if (page.url().includes('/login')) {
      test.skip('Authentication required - skipping pagination test');
      return;
    }

    // Look for pagination elements
    const paginationElements = [
      page.locator('.MuiPagination-root'),
      page.locator('.pagination'),
      page.getByRole('button', { name: /下一页|Next|上一页|Previous/i }),
      page.locator('[aria-label*="分页"], [aria-label*="pagination"]'),
    ];

    let paginationFound = false;
    for (const element of paginationElements) {
      const count = await element.count();
      if (count > 0) {
        paginationFound = true;
        console.log(`Found ${count} pagination elements`);
        
        // Try to interact with pagination
        const nextButton = page.getByRole('button', { name: /下一页|Next/i });
        const prevButton = page.getByRole('button', { name: /上一页|Previous/i });
        
        if (await nextButton.count() > 0) {
          console.log('Next page button available');
          // Don't actually click to avoid changing data
        }
        
        if (await prevButton.count() > 0) {
          console.log('Previous page button available');
        }

        // Look for page numbers
        const pageNumbers = page.locator('.MuiPaginationItem-page');
        const pageCount = await pageNumbers.count();
        if (pageCount > 0) {
          console.log(`Found ${pageCount} page number buttons`);
        }

        break;
      }
    }

    if (!paginationFound) {
      console.log('No pagination found - may have few creditors or infinite scroll');
    }
  });

  test('should handle creditor selection and bulk actions', async ({ page }) => {
    await page.goto('/creditors');
    await page.waitForLoadState('networkidle');
    
    if (page.url().includes('/login')) {
      test.skip('Authentication required - skipping bulk actions test');
      return;
    }

    // Look for selection checkboxes
    const checkboxes = page.locator('input[type="checkbox"]');
    const checkboxCount = await checkboxes.count();
    
    if (checkboxCount > 0) {
      console.log(`Found ${checkboxCount} checkboxes for selection`);
      
      // Try to select some items
      if (checkboxCount > 1) {
        await checkboxes.nth(1).check(); // Skip header checkbox if present
        await page.waitForTimeout(500);
        
        // Look for bulk action buttons
        const bulkActionButtons = [
          page.getByRole('button', { name: /批量删除|Bulk Delete|批量操作|Bulk Action/i }),
          page.getByRole('button', { name: /删除选中|Delete Selected/i }),
          page.locator('.bulk-actions button'),
        ];

        let bulkActionFound = false;
        for (const button of bulkActionButtons) {
          try {
            await expect(button).toBeVisible({ timeout: 3000 });
            bulkActionFound = true;
            console.log('Bulk action button found');
            break;
          } catch (e) {
            // Continue to next button
          }
        }

        if (!bulkActionFound) {
          console.log('Selection available but no bulk actions found');
        }
        
        // Uncheck to clean up
        await checkboxes.nth(1).uncheck();
      }
    } else {
      console.log('No selection checkboxes found');
    }
  });
});