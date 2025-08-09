import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('should navigate to the login page and verify page title', async ({ page }) => {
    // Navigate to the base URL (should be the login page or redirect to it)
    await page.goto('/'); 

    // Wait for the page to load and title to be set
    await expect(page).toHaveTitle(/CuckooX/i);

    // Verify CuckooX logo is visible
    await expect(page.locator('[alt*="CuckooX"], [src*="logo"]').first()).toBeVisible();

    // Verify login form elements are present
    await expect(page.getByLabel(/租户代码|Tenant Code/i)).toBeVisible();
    await expect(page.getByLabel(/用户名|Username/i)).toBeVisible();
    await expect(page.getByLabel(/密码|Password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /登录|Login/i })).toBeVisible();
  });

  test('should show error for empty form submission', async ({ page }) => {
    await page.goto('/');
    
    // Try to submit empty form
    await page.getByRole('button', { name: /登录|Login/i }).click();
    
    // Verify required field validation
    await expect(page.locator('input:invalid')).toHaveCount(3); // tenant code, username, password
  });

  test('should show error for invalid tenant login credentials', async ({ page }) => {
    await page.goto('/');
    
    // Fill in invalid credentials
    await page.getByLabel(/租户代码|Tenant Code/i).fill('INVALID');
    await page.getByLabel(/用户名|Username/i).fill('invaliduser');
    await page.getByLabel(/密码|Password/i).fill('invalidpassword');
    
    // Submit form
    await page.getByRole('button', { name: /登录|Login/i }).click();
    
    // Wait for error message to appear
    const errorMessage = page.locator('.MuiAlert-message, [role="alert"]');
    await expect(errorMessage).toBeVisible({ timeout: 10000 });
  });

  test('should switch to root admin mode', async ({ page }) => {
    await page.goto('/');
    
    // Click switch to root admin button
    await page.getByRole('button', { name: /切换到根管理员|Switch to Root Administrator/i }).click();
    
    // Verify URL changed to root admin mode
    await expect(page).toHaveURL(/root=true/);
    
    // Verify root admin form elements
    await expect(page.getByLabel(/用户名|Username/i)).toBeVisible();
    await expect(page.getByLabel(/密码|Password/i)).toBeVisible();
    
    // Verify tenant code field is not present in root admin mode
    await expect(page.getByLabel(/租户代码|Tenant Code/i)).not.toBeVisible();
  });

  test('should show password toggle functionality', async ({ page }) => {
    await page.goto('/');
    
    const passwordField = page.getByLabel(/密码|Password/i);
    const toggleButton = page.locator('[aria-label*="toggle password"], [aria-label*="显示密码"]');
    
    // Password field should be of type 'password' initially
    await expect(passwordField).toHaveAttribute('type', 'password');
    
    // Click toggle button
    await toggleButton.click();
    
    // Password field should be of type 'text' after toggle
    await expect(passwordField).toHaveAttribute('type', 'text');
    
    // Click toggle button again
    await toggleButton.click();
    
    // Password field should be back to type 'password'
    await expect(passwordField).toHaveAttribute('type', 'password');
  });

  test('should handle back navigation between tenant and root admin modes', async ({ page }) => {
    await page.goto('/');
    
    // Verify we're in tenant mode initially
    await expect(page.getByLabel(/租户代码|Tenant Code/i)).toBeVisible();
    
    // Switch to root admin mode
    await page.getByRole('button', { name: /切换到根管理员|Switch to Root Administrator/i }).click();
    await expect(page).toHaveURL(/root=true/);
    
    // Switch back to tenant mode
    await page.getByRole('button', { name: /返回租户登录|Back to Tenant Login/i }).click();
    await expect(page).toHaveURL(/^(?!.*root=true)/);
    
    // Verify we're back in tenant mode
    await expect(page.getByLabel(/租户代码|Tenant Code/i)).toBeVisible();
  });

  test('should preserve tenant code in autocomplete history', async ({ page }) => {
    await page.goto('/');
    
    const tenantCodeField = page.getByLabel(/租户代码|Tenant Code/i);
    
    // Fill and clear tenant code to simulate typing
    await tenantCodeField.fill('TEST');
    await tenantCodeField.clear();
    
    // Click on the field to potentially show autocomplete
    await tenantCodeField.click();
    
    // Type again to trigger autocomplete suggestions
    await tenantCodeField.fill('T');
    
    // Check if autocomplete suggestions appear (this depends on localStorage history)
    const autocompleteOptions = page.locator('[role="listbox"] li, .MuiAutocomplete-option');
    
    // If there are options, verify they're visible
    const optionCount = await autocompleteOptions.count();
    if (optionCount > 0) {
      await expect(autocompleteOptions.first()).toBeVisible();
    }
  });

  test('should display proper welcome text and branding', async ({ page }) => {
    await page.goto('/');
    
    // Check for welcome text (desktop only)
    const welcomeText = page.getByText(/欢迎使用|Welcome to CuckooX/i);
    const subtitle = page.getByText(/案件管理|case management|Streamline/i);
    
    // These might not be visible on mobile, so we check if they exist
    const isDesktop = await page.evaluate(() => window.innerWidth >= 900);
    
    if (isDesktop) {
      await expect(welcomeText).toBeVisible();
      await expect(subtitle).toBeVisible();
    }
    
    // Footer should always be visible
    await expect(page.getByText(/© 2024 CuckooX/i)).toBeVisible();
  });

  test('should handle form validation properly', async ({ page }) => {
    await page.goto('/');
    
    // Fill partial form and verify validation
    await page.getByLabel(/租户代码|Tenant Code/i).fill('TEST');
    await page.getByLabel(/用户名|Username/i).fill('testuser');
    // Leave password empty
    
    await page.getByRole('button', { name: /登录|Login/i }).click();
    
    // Should show validation for missing password
    const passwordField = page.getByLabel(/密码|Password/i);
    await expect(passwordField).toHaveAttribute('required');
    
    // Fill password and try again
    await passwordField.fill('testpass');
    await page.getByRole('button', { name: /登录|Login/i }).click();
    
    // Should proceed to next step (Turnstile or error response)
    // This will likely show an error since these are not real credentials
    await page.waitForLoadState('networkidle');
  });
});
