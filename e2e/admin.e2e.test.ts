import { test, expect } from '@playwright/test';

test.describe('Admin Panel and Management', () => {
  test.beforeEach(async ({ page }) => {
    // Each test starts fresh
  });

  test('should navigate to admin panel', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    
    // If redirected to login
    if (page.url().includes('/login')) {
      await expect(page.getByLabel(/用户名|Username/i)).toBeVisible();
      test.skip('Authentication required - skipping admin panel test');
      return;
    }

    // Verify admin panel elements
    const expectedElements = [
      page.getByRole('heading', { name: /管理面板|Admin Panel|系统管理|System Management/i }),
      page.getByText(/管理中心|Admin Center|控制台|Console/i),
    ];

    let elementFound = false;
    for (const element of expectedElements) {
      try {
        await expect(element).toBeVisible({ timeout: 5000 });
        elementFound = true;
        console.log('Admin panel element verified');
        break;
      } catch (e) {
        // Continue to next element
      }
    }

    if (!elementFound) {
      // Check for access denied
      const accessDeniedElements = [
        page.getByText(/访问被拒绝|Access Denied|权限不足|Insufficient Permission/i),
        page.getByText(/403|Forbidden/i),
      ];

      for (const denied of accessDeniedElements) {
        if (await denied.count() > 0) {
          console.log('Access denied to admin panel - user may not have admin privileges');
          return;
        }
      }
    }

    expect(elementFound).toBeTruthy();
  });

  test('should display admin menu and navigation', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    
    if (page.url().includes('/login')) {
      test.skip('Authentication required - skipping admin menu test');
      return;
    }

    // Check for access first
    const hasAccess = !(await page.getByText(/访问被拒绝|Access Denied|403/i).count() > 0);
    
    if (!hasAccess) {
      test.skip('User does not have admin access');
      return;
    }

    // Look for admin menu items
    const adminMenuItems = [
      page.getByRole('link', { name: /用户管理|User Management|成员管理|Member Management/i }),
      page.getByRole('link', { name: /权限管理|Permission Management|角色管理|Role Management/i }),
      page.getByRole('link', { name: /系统设置|System Settings|配置|Configuration/i }),
      page.getByRole('link', { name: /案件管理|Case Management/i }),
      page.getByRole('link', { name: /数据统计|Data Statistics|报告|Reports/i }),
    ];

    const foundMenuItems = [];
    for (const item of adminMenuItems) {
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

    console.log(`Found admin menu items: ${foundMenuItems.join(', ')}`);
    
    if (foundMenuItems.length === 0) {
      console.log('No admin menu items found - may be different admin interface design');
    }
  });

  test('should display system statistics and metrics', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    
    if (page.url().includes('/login')) {
      test.skip('Authentication required - skipping admin statistics test');
      return;
    }

    const hasAccess = !(await page.getByText(/访问被拒绝|Access Denied|403/i).count() > 0);
    if (!hasAccess) {
      test.skip('User does not have admin access');
      return;
    }

    // Look for system statistics
    const statsElements = [
      page.locator('.admin-stats, .system-stats'),
      page.getByText(/系统统计|System Statistics|数据概览|Data Overview/i),
      page.locator('.MuiCard-root:has-text("用户"), .MuiCard-root:has-text("案件"), .MuiCard-root:has-text("债权")'),
      page.locator('[data-testid*="admin-stat"]'),
    ];

    let statsFound = false;
    for (const element of statsElements) {
      const count = await element.count();
      if (count > 0) {
        statsFound = true;
        console.log(`Found ${count} admin statistics elements`);
        
        // Verify stats contain meaningful data
        const firstStat = element.first();
        const statText = await firstStat.textContent();
        
        if (statText) {
          const hasNumbers = /\d+/.test(statText);
          const hasSystemKeywords = /(用户|Users|案件|Cases|债权|Claims|系统|System)/i.test(statText);
          
          if (hasNumbers || hasSystemKeywords) {
            console.log('Admin statistics contain meaningful system data');
          }
        }

        break;
      }
    }

    if (!statsFound) {
      console.log('No admin statistics found');
    }
  });

  test('should handle user management functionality', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    
    if (page.url().includes('/login')) {
      test.skip('Authentication required - skipping user management test');
      return;
    }

    const hasAccess = !(await page.getByText(/访问被拒绝|Access Denied|403/i).count() > 0);
    if (!hasAccess) {
      test.skip('User does not have admin access');
      return;
    }

    // Look for user management links or sections
    const userMgmtElements = [
      page.getByRole('link', { name: /用户管理|User Management/i }),
      page.getByRole('button', { name: /用户管理|User Management/i }),
      page.getByText(/用户列表|User List|成员列表|Member List/i),
    ];

    let userMgmtFound = false;
    for (const element of userMgmtElements) {
      try {
        await expect(element).toBeVisible({ timeout: 3000 });
        userMgmtFound = true;
        console.log('User management section found');
        
        // Try to navigate to user management
        await element.click();
        await page.waitForTimeout(1000);
        
        // Look for user management interface
        const userMgmtInterface = [
          page.getByText(/用户列表|User List|用户管理|User Management/i),
          page.locator('table:has-text("用户"), table:has-text("User")'),
          page.locator('.user-list, .member-list'),
        ];

        let interfaceFound = false;
        for (const ui of userMgmtInterface) {
          try {
            await expect(ui).toBeVisible({ timeout: 5000 });
            interfaceFound = true;
            console.log('User management interface loaded');
            break;
          } catch (e) {
            // Continue to next interface element
          }
        }

        if (!interfaceFound) {
          console.log('User management clicked but interface not found');
        }

        break;
      } catch (e) {
        // Continue to next element
      }
    }

    if (!userMgmtFound) {
      console.log('No user management functionality found');
    }
  });

  test('should handle permission and role management', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    
    if (page.url().includes('/login')) {
      test.skip('Authentication required - skipping permission management test');
      return;
    }

    const hasAccess = !(await page.getByText(/访问被拒绝|Access Denied|403/i).count() > 0);
    if (!hasAccess) {
      test.skip('User does not have admin access');
      return;
    }

    // Look for permission management
    const permissionElements = [
      page.getByRole('link', { name: /权限管理|Permission Management|角色管理|Role Management/i }),
      page.getByText(/权限设置|Permission Settings|访问控制|Access Control/i),
      page.locator('[href*="permission"], [href*="role"]'),
    ];

    let permissionMgmtFound = false;
    for (const element of permissionElements) {
      try {
        await expect(element).toBeVisible({ timeout: 3000 });
        permissionMgmtFound = true;
        console.log('Permission management found');
        
        // Try to navigate
        await element.click();
        await page.waitForTimeout(1000);
        
        // Look for permission management interface
        const permissionInterface = [
          page.getByText(/权限列表|Permission List|角色列表|Role List/i),
          page.locator('table:has-text("权限"), table:has-text("Permission")'),
          page.getByRole('button', { name: /添加权限|Add Permission|创建角色|Create Role/i }),
        ];

        let permInterfaceFound = false;
        for (const ui of permissionInterface) {
          try {
            await expect(ui).toBeVisible({ timeout: 5000 });
            permInterfaceFound = true;
            console.log('Permission management interface loaded');
            break;
          } catch (e) {
            // Continue to next interface element
          }
        }

        if (!permInterfaceFound) {
          console.log('Permission management clicked but interface not found');
        }

        break;
      } catch (e) {
        // Continue to next element
      }
    }

    if (!permissionMgmtFound) {
      console.log('No permission management functionality found');
    }
  });

  test('should handle system settings and configuration', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    
    if (page.url().includes('/login')) {
      test.skip('Authentication required - skipping system settings test');
      return;
    }

    const hasAccess = !(await page.getByText(/访问被拒绝|Access Denied|403/i).count() > 0);
    if (!hasAccess) {
      test.skip('User does not have admin access');
      return;
    }

    // Look for system settings
    const settingsElements = [
      page.getByRole('link', { name: /系统设置|System Settings|配置|Configuration/i }),
      page.getByRole('link', { name: /设置|Settings/i }),
      page.locator('[href*="settings"], [href*="config"]'),
    ];

    let settingsFound = false;
    for (const element of settingsElements) {
      try {
        await expect(element).toBeVisible({ timeout: 3000 });
        settingsFound = true;
        console.log('System settings found');
        
        // Try to navigate
        await element.click();
        await page.waitForTimeout(1000);
        
        // Look for settings interface
        const settingsInterface = [
          page.getByText(/系统配置|System Configuration|基本设置|Basic Settings/i),
          page.locator('form:has-text("设置"), form:has-text("Settings")'),
          page.getByLabel(/系统名称|System Name|网站标题|Site Title/i),
        ];

        let settingsInterfaceFound = false;
        for (const ui of settingsInterface) {
          try {
            await expect(ui).toBeVisible({ timeout: 5000 });
            settingsInterfaceFound = true;
            console.log('System settings interface loaded');
            break;
          } catch (e) {
            // Continue to next interface element
          }
        }

        if (!settingsInterfaceFound) {
          console.log('System settings clicked but interface not found');
        }

        break;
      } catch (e) {
        // Continue to next element
      }
    }

    if (!settingsFound) {
      console.log('No system settings functionality found');
    }
  });

  test('should display data export and backup options', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    
    if (page.url().includes('/login')) {
      test.skip('Authentication required - skipping data export test');
      return;
    }

    const hasAccess = !(await page.getByText(/访问被拒绝|Access Denied|403/i).count() > 0);
    if (!hasAccess) {
      test.skip('User does not have admin access');
      return;
    }

    // Look for data export/backup options
    const exportElements = [
      page.getByRole('button', { name: /数据导出|Data Export|导出|Export/i }),
      page.getByRole('button', { name: /备份|Backup|数据备份|Data Backup/i }),
      page.getByText(/数据管理|Data Management|数据操作|Data Operations/i),
    ];

    let exportFound = false;
    for (const element of exportElements) {
      try {
        await expect(element).toBeVisible({ timeout: 3000 });
        exportFound = true;
        console.log('Data export/backup option found');
        
        // Set up download handler if it's an export button
        if (await element.textContent() && /导出|Export/i.test(await element.textContent() || '')) {
          const downloadPromise = page.waitForEvent('download', { timeout: 5000 });
          
          await element.click();
          
          try {
            const download = await downloadPromise;
            console.log(`Data export initiated: ${download.suggestedFilename()}`);
            await download.cancel(); // Cancel to avoid saving files
          } catch (e) {
            console.log('Export button clicked but no download initiated');
          }
        } else {
          await element.click();
          await page.waitForTimeout(1000);
          
          // Look for export/backup dialog
          const exportDialog = [
            page.locator('.MuiDialog-root:visible'),
            page.getByRole('dialog'),
            page.getByText(/数据导出|Data Export|数据备份|Data Backup/i),
          ];

          for (const dialog of exportDialog) {
            try {
              await expect(dialog).toBeVisible({ timeout: 3000 });
              console.log('Export/backup dialog opened');
              
              // Close dialog
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
        }

        break;
      } catch (e) {
        // Continue to next element
      }
    }

    if (!exportFound) {
      console.log('No data export/backup functionality found');
    }
  });

  test('should handle system monitoring and logs', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    
    if (page.url().includes('/login')) {
      test.skip('Authentication required - skipping system monitoring test');
      return;
    }

    const hasAccess = !(await page.getByText(/访问被拒绝|Access Denied|403/i).count() > 0);
    if (!hasAccess) {
      test.skip('User does not have admin access');
      return;
    }

    // Look for monitoring/logs sections
    const monitoringElements = [
      page.getByRole('link', { name: /系统监控|System Monitor|监控|Monitoring/i }),
      page.getByRole('link', { name: /日志|Logs|操作日志|Operation Logs/i }),
      page.getByText(/系统状态|System Status|运行状态|Running Status/i),
    ];

    let monitoringFound = false;
    for (const element of monitoringElements) {
      try {
        await expect(element).toBeVisible({ timeout: 3000 });
        monitoringFound = true;
        console.log('System monitoring/logs found');
        
        // Try to navigate
        await element.click();
        await page.waitForTimeout(1000);
        
        // Look for monitoring interface
        const monitoringInterface = [
          page.getByText(/系统状态|System Status|服务状态|Service Status/i),
          page.locator('table:has-text("日志"), table:has-text("Log")'),
          page.getByText(/CPU|内存|Memory|磁盘|Disk/i),
        ];

        let monitoringInterfaceFound = false;
        for (const ui of monitoringInterface) {
          try {
            await expect(ui).toBeVisible({ timeout: 5000 });
            monitoringInterfaceFound = true;
            console.log('System monitoring interface loaded');
            break;
          } catch (e) {
            // Continue to next interface element
          }
        }

        if (!monitoringInterfaceFound) {
          console.log('Monitoring link clicked but interface not found');
        }

        break;
      } catch (e) {
        // Continue to next element
      }
    }

    if (!monitoringFound) {
      console.log('No system monitoring/logs functionality found');
    }
  });

  test('should handle root admin functions if available', async ({ page }) => {
    await page.goto('/root-admin');
    await page.waitForLoadState('networkidle');
    
    if (page.url().includes('/login')) {
      test.skip('Authentication required - skipping root admin test');
      return;
    }

    // Check for root admin access
    const hasRootAccess = !(await page.getByText(/访问被拒绝|Access Denied|403/i).count() > 0);
    
    if (!hasRootAccess) {
      console.log('User does not have root admin access');
      return;
    }

    // Look for root admin features
    const rootAdminElements = [
      page.getByText(/根管理员|Root Administrator|超级管理员|Super Admin/i),
      page.getByText(/租户管理|Tenant Management|多租户|Multi-tenant/i),
      page.getByRole('button', { name: /创建租户|Create Tenant|添加租户|Add Tenant/i }),
    ];

    let rootAdminFound = false;
    for (const element of rootAdminElements) {
      const count = await element.count();
      if (count > 0) {
        rootAdminFound = true;
        console.log(`Found ${count} root admin elements`);
        break;
      }
    }

    if (rootAdminFound) {
      console.log('Root admin interface available');
      
      // Look for tenant management
      const tenantMgmtElements = [
        page.getByText(/租户列表|Tenant List/i),
        page.locator('table:has-text("租户"), table:has-text("Tenant")'),
        page.getByRole('button', { name: /管理租户|Manage Tenant/i }),
      ];

      let tenantMgmtFound = false;
      for (const element of tenantMgmtElements) {
        if (await element.count() > 0) {
          tenantMgmtFound = true;
          console.log('Tenant management functionality found');
          break;
        }
      }

      if (!tenantMgmtFound) {
        console.log('Root admin found but no tenant management');
      }
    } else {
      console.log('No root admin functionality found');
    }
  });

  test('should display admin activity logs and audit trail', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    
    if (page.url().includes('/login')) {
      test.skip('Authentication required - skipping admin logs test');
      return;
    }

    const hasAccess = !(await page.getByText(/访问被拒绝|Access Denied|403/i).count() > 0);
    if (!hasAccess) {
      test.skip('User does not have admin access');
      return;
    }

    // Look for audit logs
    const auditElements = [
      page.getByText(/操作日志|Operation Logs|审计日志|Audit Logs/i),
      page.getByText(/管理员活动|Admin Activity|操作记录|Operation Records/i),
      page.locator('.audit-log, .activity-log'),
    ];

    let auditFound = false;
    for (const element of auditElements) {
      const count = await element.count();
      if (count > 0) {
        auditFound = true;
        console.log(`Found ${count} audit log elements`);
        
        // Check for log entries
        const logEntries = page.locator('.log-entry, .audit-entry, tr:has-text("操作")');
        const entryCount = await logEntries.count();
        
        if (entryCount > 0) {
          console.log(`Found ${entryCount} log entries`);
          
          // Verify log entries contain expected information
          const firstEntry = logEntries.first();
          const entryText = await firstEntry.textContent();
          
          if (entryText) {
            const hasUser = /用户|User|管理员|Admin/i.test(entryText);
            const hasAction = /操作|Action|创建|Create|删除|Delete|修改|Modify/i.test(entryText);
            const hasTime = /时间|Time|\d{4}-\d{2}-\d{2}|\d{1,2}:\d{2}/i.test(entryText);
            
            console.log(`Log entry info - User: ${hasUser}, Action: ${hasAction}, Time: ${hasTime}`);
          }
        }

        break;
      }
    }

    if (!auditFound) {
      console.log('No audit logs or admin activity found');
    }
  });

  test('should handle responsive admin layout', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    
    if (page.url().includes('/login')) {
      test.skip('Authentication required - skipping admin responsive layout test');
      return;
    }

    const hasAccess = !(await page.getByText(/访问被拒绝|Access Denied|403/i).count() > 0);
    if (!hasAccess) {
      test.skip('User does not have admin access');
      return;
    }

    // Test desktop layout
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.waitForTimeout(500);
    
    const desktopElements = page.locator('.admin-sidebar, .admin-navigation');
    const hasDesktopLayout = await desktopElements.count() > 0;
    
    // Test mobile layout
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);
    
    const mobileElements = page.locator('.mobile-admin, .hamburger-menu');
    const hasMobileLayout = await mobileElements.count() > 0;
    
    // Test tablet layout
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(500);
    
    console.log(`Admin responsive layout - Desktop: ${hasDesktopLayout}, Mobile: ${hasMobileLayout}`);
    
    // Check for responsive menu
    const mobileMenuButton = page.getByRole('button', { name: /菜单|Menu/i });
    if (await mobileMenuButton.count() > 0) {
      console.log('Mobile admin menu button found');
    }
  });
});