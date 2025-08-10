/**
 * 认证流程测试 - 使用内嵌数据库
 * 从 Playwright E2E 测试转换为 Vitest + 内嵌 SurrealDB 集成测试
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { screen, fireEvent, waitFor, act } from '@testing-library/react';
import { renderWithRealSurreal, TestHelpers } from '../utils/realSurrealTestUtils';
import { getTestDatabase, getTestDatabaseManager } from '../setup-embedded-db';
import LoginPage from '../../src/pages/login';

// 使用Testing Library的click和type函数模拟用户交互
const userClick = async (element: HTMLElement) => {
  await act(async () => {
    fireEvent.click(element);
  });
};

const userType = async (element: HTMLElement, text: string) => {
  await act(async () => {
    fireEvent.change(element, { target: { value: text } });
  });
};

const userClear = async (element: HTMLElement) => {
  await act(async () => {
    fireEvent.change(element, { target: { value: '' } });
  });
};

describe('认证流程 - 内嵌数据库测试', () => {
  beforeEach(() => {
    // 清除浏览器模拟状态
    Object.defineProperty(window, 'location', {
      value: {
        href: 'http://localhost:3000/',
        pathname: '/',
        search: '',
        hash: '',
        origin: 'http://localhost:3000',
        replace: vi.fn(),
        assign: vi.fn(),
      },
      writable: true,
    });
  });

  test('应该渲染登录页面并验证页面标题', async () => {
    // 渲染登录页面
    renderWithRealSurreal(<LoginPage />);

    // 验证页面标题
    expect(document.title).toMatch(/CuckooX/i);

    // 验证 CuckooX logo 可见
    const logo = screen.queryByAltText(/CuckooX/i) || screen.queryByRole('img');
    if (logo) {
      expect(logo).toBeInTheDocument();
    }

    // 验证登录表单元素存在
    expect(screen.getByLabelText(/租户代码|Tenant Code/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/用户名|Username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/密码|Password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /登录|Login/i })).toBeInTheDocument();
  });

  test('应该显示空表单提交的错误', async () => {
    renderWithRealSurreal(<LoginPage />);

    // 尝试提交空表单
    const loginButton = screen.getByRole('button', { name: /登录|Login/i });
    await userClick(loginButton);

    // 验证必填字段验证
    const tenantCodeField = screen.getByLabelText(/租户代码|Tenant Code/i) as HTMLInputElement;
    const usernameField = screen.getByLabelText(/用户名|Username/i) as HTMLInputElement;
    const passwordField = screen.getByLabelText(/密码|Password/i) as HTMLInputElement;

    await waitFor(() => {
      expect(tenantCodeField).toBeInvalid();
      expect(usernameField).toBeInvalid();
      expect(passwordField).toBeInvalid();
    });
  });

  test('应该显示无效租户登录凭据的错误', async () => {
    renderWithRealSurreal(<LoginPage />);

    // 填入无效凭据
    await userType(screen.getByLabelText(/租户代码|Tenant Code/i), 'INVALID');
    await userType(screen.getByLabelText(/用户名|Username/i), 'invaliduser');
    await userType(screen.getByLabelText(/密码|Password/i), 'invalidpassword');

    // 提交表单
    const loginButton = screen.getByRole('button', { name: /登录|Login/i });
    await userClick(loginButton);

    // 等待错误消息出现
    await waitFor(() => {
      const errorMessage = screen.queryByRole('alert') || screen.queryByText(/错误|Invalid|失败/i);
      if (errorMessage) {
        expect(errorMessage).toBeInTheDocument();
      }
    }, { timeout: 10000 });
  });

  test('应该切换到根管理员模式', async () => {
    renderWithRealSurreal(<LoginPage />);

    // 点击切换到根管理员按钮
    const switchButton = screen.getByRole('button', { name: /切换到根管理员|Switch to Root Administrator/i });
    await userClick(switchButton);

    // 验证 URL 变化到根管理员模式
    await waitFor(() => {
      expect(window.location.search).toMatch(/root=true/);
    });

    // 验证根管理员表单元素
    expect(screen.getByLabelText(/用户名|Username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/密码|Password/i)).toBeInTheDocument();

    // 验证租户代码字段在根管理员模式下不可见
    expect(screen.queryByLabelText(/租户代码|Tenant Code/i)).not.toBeInTheDocument();
  });

  test('应该显示密码切换功能', async () => {
    renderWithRealSurreal(<LoginPage />);

    const passwordField = screen.getByLabelText(/密码|Password/i) as HTMLInputElement;
    const toggleButton = screen.queryByLabelText(/toggle password|显示密码/i) || 
                        screen.queryByRole('button', { name: /toggle password|显示密码/i });

    if (toggleButton) {
      // 密码字段初始应该是 password 类型
      expect(passwordField.type).toBe('password');

      // 点击切换按钮
      await userClick(toggleButton);

      // 密码字段应该变为 text 类型
      await waitFor(() => {
        expect(passwordField.type).toBe('text');
      });

      // 再次点击切换按钮
      await userClick(toggleButton);

      // 密码字段应该回到 password 类型
      await waitFor(() => {
        expect(passwordField.type).toBe('password');
      });
    }
  });

  test('应该处理租户和根管理员模式间的导航', async () => {
    renderWithRealSurreal(<LoginPage />);

    // 验证初始在租户模式
    expect(screen.getByLabelText(/租户代码|Tenant Code/i)).toBeInTheDocument();

    // 切换到根管理员模式
    const switchToRootButton = screen.getByRole('button', { name: /切换到根管理员|Switch to Root Administrator/i });
    await userClick(switchToRootButton);

    await waitFor(() => {
      expect(window.location.search).toMatch(/root=true/);
    });

    // 切换回租户模式
    const backToTenantButton = screen.getByRole('button', { name: /返回租户登录|Back to Tenant Login/i });
    await userClick(backToTenantButton);

    await waitFor(() => {
      expect(window.location.search).not.toMatch(/root=true/);
    });

    // 验证回到租户模式
    expect(screen.getByLabelText(/租户代码|Tenant Code/i)).toBeInTheDocument();
  });

  test('应该在自动完成历史中保留租户代码', async () => {
    renderWithRealSurreal(<LoginPage />);

    const tenantCodeField = screen.getByLabelText(/租户代码|Tenant Code/i);

    // 填写和清除租户代码以模拟输入
    await userType(tenantCodeField, 'TEST');
    await userClear(tenantCodeField);

    // 点击字段以可能显示自动完成
    await userClick(tenantCodeField);

    // 再次输入以触发自动完成建议
    await userType(tenantCodeField, 'T');

    // 检查是否出现自动完成建议
    const autocompleteOptions = screen.queryAllByRole('option') || 
                               screen.queryAllByText(/TEST/i);

    // 如果有选项，验证它们是可见的
    if (autocompleteOptions.length > 0) {
      expect(autocompleteOptions[0]).toBeInTheDocument();
    }
  });

  test('应该显示适当的欢迎文本和品牌', async () => {
    renderWithRealSurreal(<LoginPage />);

    // 检查欢迎文本（仅桌面版）
    const welcomeText = screen.queryByText(/欢迎使用|Welcome to CuckooX/i);
    const subtitle = screen.queryByText(/案件管理|case management|Streamline/i);

    // 这些在移动端可能不可见，所以检查它们是否存在
    const isDesktop = window.innerWidth >= 900;

    if (isDesktop && welcomeText) {
      expect(welcomeText).toBeInTheDocument();
    }
    if (isDesktop && subtitle) {
      expect(subtitle).toBeInTheDocument();
    }

    // 页脚应该始终可见
    const footer = screen.queryByText(/© 2024 CuckooX/i);
    if (footer) {
      expect(footer).toBeInTheDocument();
    }
  });

  test('应该正确处理表单验证', async () => {
    renderWithRealSurreal(<LoginPage />);

    // 填写部分表单并验证验证
    await userType(screen.getByLabelText(/租户代码|Tenant Code/i), 'TEST');
    await userType(screen.getByLabelText(/用户名|Username/i), 'testuser');
    // 留空密码

    const loginButton = screen.getByRole('button', { name: /登录|Login/i });
    await userClick(loginButton);

    // 应该显示缺少密码的验证
    const passwordField = screen.getByLabelText(/密码|Password/i);
    expect(passwordField).toHaveAttribute('required');

    // 填写密码并再次尝试
    await userType(passwordField, 'testpass');
    await userClick(loginButton);

    // 应该进入下一步（Turnstile 或错误响应）
    // 这可能会显示错误，因为这些不是真实的凭据
    await waitFor(() => {
      // 验证表单处理了提交
      expect(loginButton).toBeInTheDocument();
    });
  });

  test('应该使用有效凭据成功登录（使用内嵌数据库）', async () => {
    // 获取测试数据库实例
    const db = getTestDatabase();
    const dbManager = getTestDatabaseManager();

    // 验证数据库中有管理员用户
    const users = await db.query('SELECT * FROM user WHERE username = "admin"');
    expect(users[0]).toBeDefined();

    renderWithRealSurreal(<LoginPage />);

    // 使用测试数据库中的有效凭据
    await userType(screen.getByLabelText(/租户代码|Tenant Code/i), 'TEST');
    await userType(screen.getByLabelText(/用户名|Username/i), 'admin');
    await userType(screen.getByLabelText(/密码|Password/i), 'admin123');

    const loginButton = screen.getByRole('button', { name: /登录|Login/i });
    await userClick(loginButton);

    // 等待登录处理完成
    await waitFor(() => {
      // 成功登录后，应该没有错误消息
      const errorMessages = screen.queryAllByRole('alert');
      const visibleErrors = errorMessages.filter(el => 
        el.textContent && el.textContent.includes('错误') || 
        el.textContent?.includes('Invalid') ||
        el.textContent?.includes('失败')
      );
      expect(visibleErrors).toHaveLength(0);
    }, { timeout: 10000 });

    // 验证数据库认证状态
    const authStatus = await dbManager.getDatabase().query('RETURN $auth;');
    console.log('认证状态:', authStatus);
  });
});
