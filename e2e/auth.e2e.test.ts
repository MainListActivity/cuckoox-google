import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('should navigate to the login page and verify page title', async ({ page }) => {
    // Navigate to the base URL (should be the login page or redirect to it)
    await page.goto('/'); 

    // Wait for the page to load and title to be set
    // Adjust the expected title if it's different for your application
    // For example, if the title is "CuckooX - Login" or similar
    await expect(page).toHaveTitle(/CuckooX/i); // Using a regex for flexibility

    // Optional: Verify a specific element on the login page is visible
    // For example, if there's a login form with a specific data-testid or role
    // const loginButton = page.getByRole('button', { name: /sign in/i });
    // await expect(loginButton).toBeVisible();
  });

  // Add more basic tests here if desired, for example:
  // test('should show error for invalid admin login', async ({ page }) => {
  //   await page.goto('/?admin=true'); // Navigate to admin login
  //   await page.getByLabel(/username/i).fill('invaliduser');
  //   await page.getByLabel(/password/i).fill('invalidpassword');
  //   await page.getByRole('button', { name: /log in/i }).click();
    
  //   // Assuming an error message appears. Adjust selector as needed.
  //   const errorMessage = page.locator('.MuiAlert-message'); // Example selector
  //   await expect(errorMessage).toContainText(/invalid credentials/i); 
  // });
});
