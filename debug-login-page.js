#!/usr/bin/env node

/**
 * 调试登录页面的结构，了解为什么辅助函数找不到表单字段
 */

import { chromium } from 'playwright';
import { config } from 'dotenv';
import path from 'path';

// 加载测试环境变量
config({ path: path.resolve('.env.test') });

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage();

try {
  console.log('🔗 导航到登录页面...');
  await page.goto('http://localhost:5174/login');
  await page.waitForLoadState('networkidle');
  
  console.log('⏰ 等待页面加载...');
  await page.waitForTimeout(5000);
  
  // 等待不再显示加载文本
  try {
    await page.waitForFunction(() => {
      const loadingTexts = ['正在加载会话', '加载中', 'Loading', 'Initializing'];
      const bodyText = document.body.textContent || '';
      return !loadingTexts.some(text => bodyText.includes(text));
    }, { timeout: 30000 });
    console.log('✅ 页面加载完成');
  } catch {
    console.log('⚠️  页面加载超时，继续调试');
  }
  
  console.log('🔍 分析页面结构...');
  
  // 获取页面标题
  const title = await page.title();
  console.log(`页面标题: ${title}`);
  
  // 检查页面文本内容
  const bodyText = await page.textContent('body');
  console.log(`页面包含"正在加载会话": ${bodyText.includes('正在加载会话')}`);
  console.log(`页面包含"登录": ${bodyText.includes('登录')}`);
  
  // 检查所有输入框
  const inputs = await page.locator('input').all();
  console.log(`\n🔍 发现 ${inputs.length} 个输入框:`);
  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i];
    const type = await input.getAttribute('type');
    const name = await input.getAttribute('name');
    const placeholder = await input.getAttribute('placeholder');
    const id = await input.getAttribute('id');
    const ariaLabel = await input.getAttribute('aria-label');
    const className = await input.getAttribute('class');
    console.log(`  输入框 ${i + 1}:`);
    console.log(`    type: ${type || 'null'}`);
    console.log(`    name: ${name || 'null'}`);
    console.log(`    id: ${id || 'null'}`);
    console.log(`    placeholder: ${placeholder || 'null'}`);
    console.log(`    aria-label: ${ariaLabel || 'null'}`);
    console.log(`    class: ${className || 'null'}`);
    console.log('');
  }
  
  // 检查所有按钮
  const buttons = await page.locator('button').all();
  console.log(`🔍 发现 ${buttons.length} 个按钮:`);
  for (let i = 0; i < buttons.length; i++) {
    const button = buttons[i];
    const text = await button.textContent();
    const type = await button.getAttribute('type');
    const className = await button.getAttribute('class');
    console.log(`  按钮 ${i + 1}:`);
    console.log(`    text: ${text || 'null'}`);
    console.log(`    type: ${type || 'null'}`);
    console.log(`    class: ${className || 'null'}`);
    console.log('');
  }
  
  // 检查表单结构
  const forms = await page.locator('form').all();
  console.log(`🔍 发现 ${forms.length} 个表单`);
  
  // 获取页面的HTML结构（简化版）
  const html = await page.innerHTML('body');
  console.log('\n🏗️  页面HTML结构（前1000字符）:');
  console.log(html.substring(0, 1000));
  
  // 截图
  await page.screenshot({ path: 'login-page-debug.png' });
  console.log('📸 截图保存为 login-page-debug.png');
  
  console.log('\n⏸️  页面将保持打开，按任意键关闭...');
  await new Promise(resolve => {
    process.stdin.once('data', resolve);
  });
  
} catch (error) {
  console.error('调试过程中出错:', error);
} finally {
  await browser.close();
}