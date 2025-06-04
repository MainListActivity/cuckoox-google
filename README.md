# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

## Run Locally

**Prerequisites:**  Node.js

ssh-keygen -t rsa -b 2048 -C "1025988443@qq.com" -f ~/.ssh/cuckoox

git config --global user.email "1025988443@qq.com"
git config --global user.name "MainActivity"
git config --global core.sshCommand "ssh -i ~/.ssh/cuckoox"


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.dev) to your Gemini API key
3. Run the app:
   `npm run dev`

git config --global http.proxy socks5://127.0.0.1:7891

git config --global --unset http.proxy

## E2E Testing

This project uses [Playwright](https://playwright.dev/) for End-to-End (E2E) testing. Playwright allows for testing user interactions and application behavior in real browser environments.

### Setup

If you haven't already, or if you're setting up the project on a new machine, you may need to install the browser binaries required by Playwright:

```bash
npx playwright install --with-deps
```
This command downloads the necessary browser executables (Chromium, Firefox, WebKit) and installs any required system dependencies.

### Running E2E Tests

To run the E2E tests, use the following npm script:

```bash
npm run test:e2e
```
(If using pnpm, use `pnpm test:e2e`)

This command will execute all test files located in the `e2e/` directory using the Playwright test runner.

### Test Reports

After the tests complete, an HTML report will be generated in the `playwright-report` directory. You can open the `index.html` file in this directory to view a detailed report of the test execution:

```bash
npx playwright show-report
```
Alternatively, you can directly open `playwright-report/index.html` in your browser.

### Test Location

E2E test files are located in the `e2e/` directory at the root of the project. The example test file `e2e/auth.e2e.test.ts` demonstrates the basic structure of a Playwright test.
