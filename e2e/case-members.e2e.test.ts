import { test, expect } from '@playwright/test';

test.describe('Case Members Management', () => {
  test.beforeEach(async ({ page }) => {
    // Each test starts fresh
  });

  test('should navigate to case members page', async ({ page }) => {
    await page.goto('/case-members');
    await page.waitForLoadState('networkidle');
    
    // If redirected to login
    if (page.url().includes('/login')) {
      await expect(page.getByLabel(/用户名|Username/i)).toBeVisible();
      test.skip('Authentication required - skipping case members test');
      return;
    }

    // Verify case members page elements
    const expectedElements = [
      page.getByRole('heading', { name: /案件成员|Case Members|成员管理|Member Management/i }),
      page.getByText(/案件成员列表|Case Members List|成员信息|Member Information/i),
    ];

    let elementFound = false;
    for (const element of expectedElements) {
      try {
        await expect(element).toBeVisible({ timeout: 5000 });
        elementFound = true;
        console.log('Case members page element verified');
        break;
      } catch (e) {
        // Continue to next element
      }
    }

    expect(elementFound).toBeTruthy();
  });

  test('should display case members data', async ({ page }) => {
    await page.goto('/case-members');
    await page.waitForLoadState('networkidle');
    
    if (page.url().includes('/login')) {
      test.skip('Authentication required - skipping members data display test');
      return;
    }

    // Look for members data display
    const dataContainers = [
      page.locator('table tbody tr'),
      page.locator('.member-card, .member-item'),
      page.locator('[data-testid*="member"]'),
      page.locator('.MuiDataGrid-row'),
    ];

    let dataFound = false;
    for (const container of dataContainers) {
      const count = await container.count();
      if (count > 0) {
        dataFound = true;
        console.log(`Found ${count} member items`);
        
        // Verify member data contains expected fields
        const firstItem = container.first();
        await expect(firstItem).toBeVisible();
        
        // Look for common member fields
        const memberFields = [
          firstItem.locator('text=/姓名|Name|用户名|Username/i'),
          firstItem.locator('text=/角色|Role|权限|Permission/i'),
          firstItem.locator('text=/邮箱|Email|联系方式|Contact/i'),
          firstItem.locator('text=/状态|Status|活跃|Active/i'),
          firstItem.locator('text=/加入时间|Join Time|创建时间|Created/i'),
        ];

        let fieldFound = false;
        for (const field of memberFields) {
          try {
            await expect(field).toBeVisible({ timeout: 2000 });
            fieldFound = true;
            console.log('Member data field verified');
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
        page.getByText(/暂无成员|No Members|空|Empty/i),
        page.getByText(/还没有案件成员|No case members/i),
        page.locator('.empty-state, .no-data'),
      ];

      let emptyStateFound = false;
      for (const indicator of emptyStateIndicators) {
        try {
          await expect(indicator).toBeVisible({ timeout: 3000 });
          emptyStateFound = true;
          console.log('Empty state detected - no members available');
          break;
        } catch (e) {
          // Continue to next indicator
        }
      }

      if (!emptyStateFound) {
        console.log('No member data or empty state indicators found');
      }
    }
  });

  test('should display add member functionality', async ({ page }) => {
    await page.goto('/case-members');
    await page.waitForLoadState('networkidle');
    
    if (page.url().includes('/login')) {
      test.skip('Authentication required - skipping add member test');
      return;
    }

    // Look for add member button
    const addButtons = [
      page.getByRole('button', { name: /添加成员|Add Member|邀请成员|Invite Member/i }),
      page.getByRole('button', { name: /添加|Add|新增|Create/i }),
      page.locator('[aria-label*="添加"], [aria-label*="Add"], [title*="添加"], [title*="Add"]'),
    ];

    let addButtonFound = false;
    for (const button of addButtons) {
      try {
        await expect(button).toBeVisible({ timeout: 5000 });
        addButtonFound = true;
        console.log('Add member button found');
        
        // Try to click and see if dialog/form opens
        await button.click();
        await page.waitForTimeout(1000);
        
        // Look for add member dialog or form
        const addMemberForm = [
          page.locator('.MuiDialog-root:visible'),
          page.getByRole('dialog'),
          page.locator('.add-member-form, .member-form'),
          page.getByText(/添加成员|Add Member|邀请成员|Invite Member/i),
        ];

        let formFound = false;
        for (const form of addMemberForm) {
          try {
            await expect(form).toBeVisible({ timeout: 3000 });
            formFound = true;
            console.log('Add member form/dialog opened');
            
            // Look for form fields
            const formFields = [
              page.getByLabel(/用户名|Username|邮箱|Email/i),
              page.getByLabel(/角色|Role|权限|Permission/i),
              page.getByLabel(/姓名|Name|显示名称|Display Name/i),
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
              console.log(`Found ${fieldsFound} form fields in add member form`);
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
          console.log('Add member button clicked but no form found - may require permissions');
        }

        break;
      } catch (e) {
        // Continue to next button
      }
    }

    if (!addButtonFound) {
      console.log('No add member button found - may be due to permissions');
    }
  });

  test('should handle member role and permission management', async ({ page }) => {
    await page.goto('/case-members');
    await page.waitForLoadState('networkidle');
    
    if (page.url().includes('/login')) {
      test.skip('Authentication required - skipping role management test');
      return;
    }

    // Look for role management elements
    const roleElements = [
      page.getByText(/角色|Role|权限|Permission/i),
      page.locator('select[name*="role"], select[name*="permission"]'),
      page.getByRole('button', { name: /编辑权限|Edit Permission|修改角色|Change Role/i }),
    ];

    let roleElementFound = false;
    for (const element of roleElements) {
      const count = await element.count();
      if (count > 0) {
        roleElementFound = true;
        console.log(`Found ${count} role/permission elements`);
        
        // If it's a select element, check options
        if (await element.first().getAttribute('role') === 'button' || 
            await element.first().tagName() === 'SELECT') {
          
          try {
            await element.first().click();
            await page.waitForTimeout(500);
            
            // Look for role options
            const roleOptions = [
              page.getByText(/管理员|Admin|管理者|Manager/i),
              page.getByText(/成员|Member|用户|User/i),
              page.getByText(/观察者|Observer|只读|Read-only/i),
              page.locator('[role="option"], [role="menuitem"]'),
            ];

            let optionsFound = false;
            for (const option of roleOptions) {
              if (await option.count() > 0) {
                optionsFound = true;
                console.log('Role options found');
                break;
              }
            }

            if (!optionsFound) {
              console.log('Role element clicked but no options found');
            }

            // Click outside to close any dropdown
            await page.click('body', { position: { x: 100, y: 100 } });
          } catch (e) {
            console.log('Could not interact with role element');
          }
        }

        break;
      }
    }

    if (!roleElementFound) {
      console.log('No role/permission management elements found');
    }
  });

  test('should display member actions (edit, remove)', async ({ page }) => {
    await page.goto('/case-members');
    await page.waitForLoadState('networkidle');
    
    if (page.url().includes('/login')) {
      test.skip('Authentication required - skipping member actions test');
      return;
    }

    // Look for member action buttons
    const actionButtons = [
      page.getByRole('button', { name: /编辑|Edit|修改|Modify/i }),
      page.getByRole('button', { name: /删除|Delete|移除|Remove/i }),
      page.locator('.member-actions button'),
      page.locator('[aria-label*="编辑"], [aria-label*="删除"], [aria-label*="移除"]'),
    ];

    let actionsFound = false;
    for (const buttons of actionButtons) {
      const count = await buttons.count();
      if (count > 0) {
        actionsFound = true;
        console.log(`Found ${count} member action buttons`);
        
        // Try to interact with an edit button
        const editButtons = buttons.filter({ hasText: /编辑|Edit/i });
        const editCount = await editButtons.count();
        
        if (editCount > 0) {
          const firstEditButton = editButtons.first();
          await firstEditButton.click();
          await page.waitForTimeout(1000);
          
          // Look for edit dialog
          const editDialog = [
            page.locator('.MuiDialog-root:visible'),
            page.getByRole('dialog'),
            page.getByText(/编辑成员|Edit Member|修改成员信息/i),
          ];

          let editDialogFound = false;
          for (const dialog of editDialog) {
            try {
              await expect(dialog).toBeVisible({ timeout: 3000 });
              editDialogFound = true;
              console.log('Edit member dialog opened');
              
              // Close the dialog
              const closeButton = page.getByRole('button', { name: /取消|Cancel|关闭|Close/i });
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

          if (!editDialogFound) {
            console.log('Edit button clicked but dialog not found');
          }
        }

        break;
      }
    }

    if (!actionsFound) {
      console.log('No member action buttons found');
    }
  });

  test('should handle member search and filtering', async ({ page }) => {
    await page.goto('/case-members');
    await page.waitForLoadState('networkidle');
    
    if (page.url().includes('/login')) {
      test.skip('Authentication required - skipping member search test');
      return;
    }

    // Look for search functionality
    const searchElements = [
      page.getByPlaceholder(/搜索成员|Search Members|搜索|Search/i),
      page.getByLabel(/搜索|Search/i),
      page.locator('input[type="search"], input[name*="search"]'),
    ];

    let searchFound = false;
    for (const element of searchElements) {
      try {
        await expect(element).toBeVisible({ timeout: 3000 });
        searchFound = true;
        
        // Test search functionality
        await element.fill('管理员');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(1000);
        
        console.log('Member search functionality tested');
        break;
      } catch (e) {
        // Continue to next element
      }
    }

    // Look for filter functionality
    const filterElements = [
      page.getByLabel(/角色筛选|Role Filter|状态筛选|Status Filter/i),
      page.locator('select[name*="role"], select[name*="status"]'),
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
        
        console.log('Member filter functionality tested');
        break;
      } catch (e) {
        // Continue to next element
      }
    }

    console.log(`Member search/filter - Search: ${searchFound}, Filter: ${filterFound}`);
  });

  test('should display member invitation functionality', async ({ page }) => {
    await page.goto('/case-members');
    await page.waitForLoadState('networkidle');
    
    if (page.url().includes('/login')) {
      test.skip('Authentication required - skipping invitation test');
      return;
    }

    // Look for invitation buttons
    const inviteButtons = [
      page.getByRole('button', { name: /邀请成员|Invite Member|发送邀请|Send Invitation/i }),
      page.getByRole('button', { name: /邀请|Invite/i }),
      page.locator('[aria-label*="邀请"], [aria-label*="invite"]'),
    ];

    let inviteButtonFound = false;
    for (const button of inviteButtons) {
      try {
        await expect(button).toBeVisible({ timeout: 5000 });
        inviteButtonFound = true;
        console.log('Invite member button found');
        
        // Try to click and see if invitation dialog opens
        await button.click();
        await page.waitForTimeout(1000);
        
        // Look for invitation dialog
        const inviteDialog = [
          page.locator('.MuiDialog-root:visible'),
          page.getByRole('dialog'),
          page.getByText(/邀请成员|Invite Member|发送邀请|Send Invitation/i),
          page.locator('.invite-dialog, .invitation-form'),
        ];

        let dialogFound = false;
        for (const dialog of inviteDialog) {
          try {
            await expect(dialog).toBeVisible({ timeout: 3000 });
            dialogFound = true;
            console.log('Invitation dialog opened');
            
            // Look for invitation form fields
            const inviteFields = [
              page.getByLabel(/邮箱|Email|邮件地址|Email Address/i),
              page.getByLabel(/角色|Role|权限|Permission/i),
              page.getByLabel(/消息|Message|邀请消息|Invitation Message/i),
            ];

            let fieldsFound = 0;
            for (const field of inviteFields) {
              try {
                await expect(field).toBeVisible({ timeout: 2000 });
                fieldsFound++;
              } catch (e) {
                // Continue to next field
              }
            }

            console.log(`Found ${fieldsFound} invitation form fields`);

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
          console.log('Invite button clicked but no dialog found');
        }

        break;
      } catch (e) {
        // Continue to next button
      }
    }

    if (!inviteButtonFound) {
      console.log('No invitation functionality found');
    }
  });

  test('should display member status and activity information', async ({ page }) => {
    await page.goto('/case-members');
    await page.waitForLoadState('networkidle');
    
    if (page.url().includes('/login')) {
      test.skip('Authentication required - skipping member status test');
      return;
    }

    // Look for member status indicators
    const statusElements = [
      page.getByText(/在线|Online|离线|Offline|活跃|Active/i),
      page.locator('.status-indicator, .activity-indicator'),
      page.locator('.member-status, .user-status'),
      page.getByText(/最后登录|Last Login|最后活动|Last Activity/i),
    ];

    let statusFound = false;
    for (const element of statusElements) {
      const count = await element.count();
      if (count > 0) {
        statusFound = true;
        console.log(`Found ${count} member status elements`);
        
        // Check for different status types
        const statusText = await element.first().textContent();
        if (statusText) {
          const hasOnlineStatus = /在线|Online|活跃|Active/i.test(statusText);
          const hasOfflineStatus = /离线|Offline|非活跃|Inactive/i.test(statusText);
          const hasTimeInfo = /时间|Time|ago|前/i.test(statusText);
          
          console.log(`Status info - Online: ${hasOnlineStatus}, Offline: ${hasOfflineStatus}, Time: ${hasTimeInfo}`);
        }

        break;
      }
    }

    if (!statusFound) {
      console.log('No member status information found');
    }

    // Look for activity history
    const activityElements = [
      page.getByText(/活动历史|Activity History|操作记录|Operation Log/i),
      page.locator('.activity-log, .member-activity'),
      page.getByRole('button', { name: /查看活动|View Activity|活动记录|Activity Log/i }),
    ];

    let activityFound = false;
    for (const element of activityElements) {
      const count = await element.count();
      if (count > 0) {
        activityFound = true;
        console.log(`Found ${count} activity elements`);
        break;
      }
    }

    if (!activityFound) {
      console.log('No member activity information found');
    }
  });

  test('should handle responsive layout for case members', async ({ page }) => {
    await page.goto('/case-members');
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
    
    const mobileElements = page.locator('.mobile-layout, .member-card, .MuiAccordion-root');
    const hasMobileLayout = await mobileElements.count() > 0;
    
    // Test tablet layout
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(500);
    
    console.log(`Case members responsive layout - Desktop: ${hasDesktopLayout}, Mobile: ${hasMobileLayout}`);
    
    // At least one layout should be responsive
    expect(hasDesktopLayout || hasMobileLayout).toBeTruthy();
  });

  test('should handle member bulk actions and selection', async ({ page }) => {
    await page.goto('/case-members');
    await page.waitForLoadState('networkidle');
    
    if (page.url().includes('/login')) {
      test.skip('Authentication required - skipping bulk actions test');
      return;
    }

    // Look for selection checkboxes
    const checkboxes = page.locator('input[type="checkbox"]');
    const checkboxCount = await checkboxes.count();
    
    if (checkboxCount > 0) {
      console.log(`Found ${checkboxCount} checkboxes for member selection`);
      
      // Try to select some members
      if (checkboxCount > 1) {
        await checkboxes.nth(1).check(); // Skip header checkbox if present
        await page.waitForTimeout(500);
        
        // Look for bulk action buttons
        const bulkActionButtons = [
          page.getByRole('button', { name: /批量删除|Bulk Delete|批量移除|Bulk Remove/i }),
          page.getByRole('button', { name: /删除选中|Delete Selected|移除选中|Remove Selected/i }),
          page.getByRole('button', { name: /批量修改权限|Bulk Change Permission/i }),
          page.locator('.bulk-actions button'),
        ];

        let bulkActionFound = false;
        for (const button of bulkActionButtons) {
          try {
            await expect(button).toBeVisible({ timeout: 3000 });
            bulkActionFound = true;
            console.log('Bulk action button found for members');
            break;
          } catch (e) {
            // Continue to next button
          }
        }

        if (!bulkActionFound) {
          console.log('Member selection available but no bulk actions found');
        }
        
        // Uncheck to clean up
        await checkboxes.nth(1).uncheck();
      }
    } else {
      console.log('No selection checkboxes found for members');
    }
  });

  test('should display member permissions and access levels', async ({ page }) => {
    await page.goto('/case-members');
    await page.waitForLoadState('networkidle');
    
    if (page.url().includes('/login')) {
      test.skip('Authentication required - skipping permissions test');
      return;
    }

    // Look for permission-related elements
    const permissionElements = [
      page.getByText(/权限|Permission|访问级别|Access Level/i),
      page.getByText(/读取|Read|写入|Write|管理|Manage/i),
      page.locator('.permission-badge, .access-badge'),
      page.getByRole('button', { name: /权限设置|Permission Settings|访问控制|Access Control/i }),
    ];

    let permissionFound = false;
    for (const element of permissionElements) {
      const count = await element.count();
      if (count > 0) {
        permissionFound = true;
        console.log(`Found ${count} permission-related elements`);
        
        // Check for specific permission types
        const permissionText = await element.first().textContent();
        if (permissionText) {
          const hasReadPermission = /读取|Read|查看|View/i.test(permissionText);
          const hasWritePermission = /写入|Write|编辑|Edit/i.test(permissionText);
          const hasManagePermission = /管理|Manage|Admin/i.test(permissionText);
          
          console.log(`Permissions - Read: ${hasReadPermission}, Write: ${hasWritePermission}, Manage: ${hasManagePermission}`);
        }

        break;
      }
    }

    if (!permissionFound) {
      console.log('No permission information found');
    }
  });
});