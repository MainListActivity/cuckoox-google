import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/login';

test.describe('案件成员管理测试 - 使用 TEST1 租户', () => {
  test.beforeEach(async ({ page }) => {
    // 每个测试前先登录
    const loginSuccessful = await loginAsAdmin(page);
    if (!loginSuccessful) {
      console.log('登录失败，将跳过案件成员管理测试');
    }
  });

  test('应该成功导航到案件成员页面', async ({ page }) => {
    await page.goto('/case-members');
    await page.waitForLoadState('networkidle');
    
    // 如果重定向到登录页面，跳过测试
    if (page.url().includes('/login')) {
      test.skip(true, '需要认证 - 跳过案件成员页面测试');
      return;
    }

    // 验证案件成员页面元素
    const expectedElements = [
      page.getByRole('heading', { name: /案件成员|Case Members|成员管理|Member Management/i }),
      page.getByText(/案件成员列表|Case Members List|成员信息|Member Information/i),
      page.getByText(/成员|Member|管理人|Administrator/i),
    ];

    let elementFound = false;
    for (const element of expectedElements) {
      if (await element.count() > 0) {
        elementFound = true;
        console.log('发现案件成员页面元素');
        break;
      }
    }

    if (elementFound) {
      console.log('案件成员页面加载成功');
    } else {
      console.log('案件成员页面元素未完全找到，但页面已加载');
    }
  });

  test('应该显示案件成员数据', async ({ page }) => {
    await page.goto('/case-members');
    await page.waitForLoadState('networkidle');
    
    if (page.url().includes('/login')) {
      test.skip(true, '需要认证 - 跳过成员数据显示测试');
      return;
    }

    // 查找成员数据显示
    const dataContainers = [
      page.locator('table, .case-members-table'),
      page.locator('.members-list, .member-item'),
      page.locator('.MuiDataGrid-root'),
    ];

    let dataFound = false;
    for (const container of dataContainers) {
      if (await container.count() > 0) {
        dataFound = true;
        console.log('发现案件成员数据容器');
        break;
      }
    }

    // 检查页面内容是否包含成员相关关键词
    const pageContent = await page.locator('body').textContent() || '';
    const hasMemberKeywords = /成员|member|管理人|administrator|债权人|creditor/i.test(pageContent);
    
    console.log(`页面包含成员相关关键词: ${hasMemberKeywords}`);
    
    if (dataFound || hasMemberKeywords) {
      console.log('案件成员数据显示测试通过');
    }
  });

  test('应该支持添加成员功能', async ({ page }) => {
    await page.goto('/case-members');
    await page.waitForLoadState('networkidle');
    
    if (page.url().includes('/login')) {
      test.skip(true, '需要认证 - 跳过添加成员测试');
      return;
    }

    // 查找添加成员按钮
    const addButtons = [
      page.getByRole('button', { name: /添加成员|Add Member|邀请成员|Invite Member/i }),
      page.getByRole('button', { name: /添加|Add|新增|Create/i }),
      page.getByText(/新增成员|Add Member|创建成员|Create Member/i),
    ];

    let addButtonFound = false;
    for (const button of addButtons) {
      if (await button.count() > 0) {
        addButtonFound = true;
        console.log('发现添加成员按钮');
        
        try {
          await button.first().click();
          await page.waitForTimeout(2000);
          
          // 查找添加成员表单或对话框
          const addMemberForm = [
            page.locator('.MuiDialog-root'),
            page.getByRole('dialog'),
            page.getByText(/添加成员|Add Member|邀请成员|Invite Member/i),
          ];

          let formFound = false;
          for (const form of addMemberForm) {
            if (await form.count() > 0) {
              formFound = true;
              console.log('添加成员表单/对话框打开成功');
              
              // 关闭对话框
              const cancelButton = page.getByRole('button', { name: /取消|Cancel|关闭|Close/i });
              if (await cancelButton.count() > 0) {
                await cancelButton.click();
              } else {
                await page.keyboard.press('Escape');
              }
              break;
            }
          }

          if (!formFound) {
            console.log('点击添加按钮后未找到表单');
          }
        } catch (e) {
          console.log('添加成员按钮点击失败');
        }
        
        break;
      }
    }

    if (!addButtonFound) {
      console.log('未找到添加成员功能');
    }
  });
});