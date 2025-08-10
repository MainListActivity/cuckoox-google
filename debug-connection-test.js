#!/usr/bin/env node

/**
 * 调试service worker连接状态和console日志
 */

import { chromium } from 'playwright';
import { config } from 'dotenv';
import path from 'path';

// 加载测试环境变量
config({ path: path.resolve('.env.test') });

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext();
const page = await context.newPage();

// 监听所有console消息
page.on('console', msg => {
  const type = msg.type();
  const text = msg.text();
  console.log(`[${type.toUpperCase()}] ${text}`);
});

// 监听页面错误
page.on('pageerror', error => {
  console.error(`[PAGE ERROR] ${error.message}`);
});

// 监听请求失败
page.on('requestfailed', request => {
  console.error(`[REQUEST FAILED] ${request.method()} ${request.url()} - ${request.failure()?.errorText || 'Unknown error'}`);
});

try {
  console.log('🔗 导航到登录页面...');
  await page.goto('http://localhost:5174/login');
  await page.waitForLoadState('networkidle');
  
  console.log('⏰ 等待60秒观察应用初始化过程...');
  await page.waitForTimeout(60000);
  
  console.log('📊 页面最终状态:');
  const bodyText = await page.textContent('body');
  console.log(`页面包含"正在加载会话": ${bodyText.includes('正在加载会话')}`);
  console.log(`页面包含"登录": ${bodyText.includes('登录')}`);
  
  const inputs = await page.locator('input').count();
  const buttons = await page.locator('button').count();
  console.log(`输入框数量: ${inputs}`);
  console.log(`按钮数量: ${buttons}`);
  
  // 截图
  await page.screenshot({ path: 'connection-debug-final.png' });
  console.log('📸 截图保存为 connection-debug-final.png');
  
} catch (error) {
  console.error('调试过程中出错:', error);
} finally {
  console.log('按任意键关闭浏览器...');
  await new Promise(resolve => {
    process.stdin.once('data', resolve);
  });
  await browser.close();
}