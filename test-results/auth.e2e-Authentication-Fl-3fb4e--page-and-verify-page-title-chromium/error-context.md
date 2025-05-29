# Test info

- Name: Authentication Flow >> should navigate to the login page and verify page title
- Location: /app/e2e/auth.e2e.test.ts:4:3

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:5173/
Call log:
  - navigating to "http://localhost:5173/", waiting until "load"

    at /app/e2e/auth.e2e.test.ts:6:16
```

# Test source

```ts
   1 | import { test, expect } from '@playwright/test';
   2 |
   3 | test.describe('Authentication Flow', () => {
   4 |   test('should navigate to the login page and verify page title', async ({ page }) => {
   5 |     // Navigate to the base URL (should be the login page or redirect to it)
>  6 |     await page.goto('/'); 
     |                ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:5173/
   7 |
   8 |     // Wait for the page to load and title to be set
   9 |     // Adjust the expected title if it's different for your application
  10 |     // For example, if the title is "CuckooX - Login" or similar
  11 |     await expect(page).toHaveTitle(/CuckooX/i); // Using a regex for flexibility
  12 |
  13 |     // Optional: Verify a specific element on the login page is visible
  14 |     // For example, if there's a login form with a specific data-testid or role
  15 |     // const loginButton = page.getByRole('button', { name: /sign in/i });
  16 |     // await expect(loginButton).toBeVisible();
  17 |   });
  18 |
  19 |   // Add more basic tests here if desired, for example:
  20 |   // test('should show error for invalid admin login', async ({ page }) => {
  21 |   //   await page.goto('/?admin=true'); // Navigate to admin login
  22 |   //   await page.getByLabel(/username/i).fill('invaliduser');
  23 |   //   await page.getByLabel(/password/i).fill('invalidpassword');
  24 |   //   await page.getByRole('button', { name: /log in/i }).click();
  25 |     
  26 |   //   // Assuming an error message appears. Adjust selector as needed.
  27 |   //   const errorMessage = page.locator('.MuiAlert-message'); // Example selector
  28 |   //   await expect(errorMessage).toContainText(/invalid credentials/i); 
  29 |   // });
  30 | });
  31 |
```