import { test, expect } from '@playwright/test';

test.describe('调试控制台日志', () => {
  test('捕获页面加载时的控制台错误', async ({ page }) => {
    const consoleMessages: string[] = [];
    const errors: string[] = [];
    
    // 监听控制台消息
    page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      consoleMessages.push(`[${type.toUpperCase()}] ${text}`);
      
      if (type === 'error') {
        errors.push(text);
      }
      
      console.log(`浏览器控制台 [${type.toUpperCase()}]:`, text);
    });
    
    // 监听页面错误
    page.on('pageerror', (error) => {
      console.log('页面错误:', error.message);
      errors.push(`页面错误: ${error.message}`);
    });
    
    // 导航到登录页面
    console.log('正在导航到登录页面...');
    await page.goto('/login');
    
    // 等待一些时间让Service Worker有机会加载
    console.log('等待5秒观察Service Worker加载...');
    await page.waitForTimeout(5000);
    
    // 检查页面状态
    const pageTitle = await page.title();
    console.log('页面标题:', pageTitle);
    
    const pageContent = await page.content();
    const hasInput = pageContent.includes('<input');
    const hasForm = pageContent.includes('<form');
    const hasError = pageContent.includes('error') || pageContent.includes('Error');
    
    console.log('页面分析:');
    console.log('- 包含输入框:', hasInput);
    console.log('- 包含表单:', hasForm);
    console.log('- 包含错误:', hasError);
    
    // 输出所有控制台消息
    console.log('\\n=== 所有控制台消息 ===');
    consoleMessages.forEach(msg => console.log(msg));
    
    if (errors.length > 0) {
      console.log('\\n=== 发现的错误 ===');
      errors.forEach(error => console.log('❌', error));
    }
    
    // 检查Service Worker注册状态
    const serviceWorkerInfo = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) {
        return { supported: false };
      }
      
      try {
        const registration = await navigator.serviceWorker.ready;
        return {
          supported: true,
          registered: true,
          controller: !!navigator.serviceWorker.controller,
          active: !!registration.active,
          installing: !!registration.installing,
          waiting: !!registration.waiting,
          activeState: registration.active?.state || 'none'
        };
      } catch (error) {
        return {
          supported: true,
          registered: false,
          error: error.message
        };
      }
    });
    
    console.log('Service Worker状态:', JSON.stringify(serviceWorkerInfo, null, 2));
    
    // 让测试通过，我们只关心日志输出
    expect(pageTitle).toContain('CuckooX');
  });
});