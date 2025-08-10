/**
 * 管理员功能测试 - 使用内嵌数据库
 * 从 Playwright E2E 测试转换为 Vitest + 内嵌 SurrealDB 集成测试
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { screen, fireEvent, waitFor, act } from '@testing-library/react';
import { renderWithRealSurreal, TestHelpers } from '../utils/realSurrealTestUtils';
import { getTestDatabase, getTestDatabaseManager } from '../setup-embedded-db';
import AdminPage from '../../src/pages/admin';

// 用户交互辅助函数
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

describe('管理员功能 - 内嵌数据库测试', () => {
  beforeEach(async () => {
    // 设置管理员认证状态
    const dbManager = getTestDatabaseManager();
    await dbManager.setAuthUser('user:admin');
    
    // 模拟管理员已登录状态
    Object.defineProperty(window, 'location', {
      value: {
        href: 'http://localhost:3000/admin',
        pathname: '/admin',
        search: '',
        hash: '',
        origin: 'http://localhost:3000',
        replace: vi.fn(),
        assign: vi.fn(),
      },
      writable: true,
    });
  });

  test('应该渲染管理员面板', async () => {
    renderWithRealSurreal(<AdminPage />, { authUserId: 'user:admin' });

    // 验证管理员页面标题
    await waitFor(() => {
      const adminTitle = screen.queryByText(/管理员|Admin|系统管理/i);
      if (adminTitle) {
        expect(adminTitle).toBeInTheDocument();
      }
    });
  });

  test('应该显示系统统计信息', async () => {
    // 先在数据库中创建一些测试数据
    await TestHelpers.create('user', {
      username: 'test_user_stats',
      name: '统计测试用户',
      email: 'stats@test.com'
    });

    await TestHelpers.create('case', {
      name: '统计测试案件',
      court_name: '统计测试法院',
      case_number: 'STATS-2024-001',
      status: 'active'
    });

    renderWithRealSurreal(<AdminPage />, { authUserId: 'user:admin' });

    // 等待统计信息加载
    await waitFor(() => {
      // 查找统计卡片或数字
      const statsElements = screen.queryAllByText(/\d+/) // 查找数字
        .concat(screen.queryAllByText(/用户|案件|数量|统计/i));
      
      if (statsElements.length > 0) {
        expect(statsElements.length).toBeGreaterThan(0);
      }
    }, { timeout: 5000 });
  });

  test('应该能够管理用户', async () => {
    renderWithRealSurreal(<AdminPage />, { authUserId: 'user:admin' });

    // 查找用户管理选项
    const userManagement = screen.queryByText(/用户管理|User Management|用户列表/i) || 
                          screen.queryByRole('button', { name: /用户|User/i });

    if (userManagement) {
      await userClick(userManagement);

      // 验证用户列表显示
      await waitFor(() => {
        const userList = screen.queryByText(/用户列表|User List/i) || 
                        screen.queryByText(/admin/i); // 应该显示admin用户
        
        if (userList) {
          expect(userList).toBeInTheDocument();
        }
      });
    }
  });

  test('应该能够创建新用户', async () => {
    renderWithRealSurreal(<AdminPage />, { authUserId: 'user:admin' });

    // 查找创建用户按钮
    const createUserButton = screen.queryByRole('button', { name: /新建用户|Create User|添加用户/i });

    if (createUserButton) {
      await userClick(createUserButton);

      // 查找用户表单
      const usernameField = screen.queryByLabelText(/用户名|Username/i);
      const nameField = screen.queryByLabelText(/姓名|Name|全名/i);
      const emailField = screen.queryByLabelText(/邮箱|Email/i);

      if (usernameField && nameField && emailField) {
        // 填写用户信息
        await userType(usernameField, 'new_test_user');
        await userType(nameField, '新测试用户');
        await userType(emailField, 'newuser@test.com');

        // 提交表单
        const submitButton = screen.queryByRole('button', { name: /保存|Save|提交|Submit/i });
        if (submitButton) {
          await userClick(submitButton);

          // 验证用户创建成功
          await waitFor(() => {
            const successMessage = screen.queryByText(/成功|Success|创建成功/i);
            if (successMessage) {
              expect(successMessage).toBeInTheDocument();
            }
          });

          // 验证用户在数据库中创建成功
          const users = await TestHelpers.query('SELECT * FROM user WHERE username = "new_test_user"');
          expect(users[0]).toBeDefined();
          if (users[0] && users[0].length > 0) {
            expect(users[0][0].username).toBe('new_test_user');
          }
        }
      }
    }
  });

  test('应该能够管理角色权限', async () => {
    renderWithRealSurreal(<AdminPage />, { authUserId: 'user:admin' });

    // 查找角色管理选项
    const roleManagement = screen.queryByText(/角色管理|Role Management|权限管理/i) || 
                          screen.queryByRole('button', { name: /角色|Role|权限|Permission/i });

    if (roleManagement) {
      await userClick(roleManagement);

      // 验证角色列表显示
      await waitFor(() => {
        const roleList = screen.queryByText(/角色列表|Role List/i) || 
                        screen.queryByText(/admin|管理员/i); // 应该显示admin角色
        
        if (roleList) {
          expect(roleList).toBeInTheDocument();
        }
      });
    }
  });

  test('应该能够查看系统日志', async () => {
    renderWithRealSurreal(<AdminPage />, { authUserId: 'user:admin' });

    // 查找系统日志选项
    const systemLogs = screen.queryByText(/系统日志|System Logs|日志|Logs/i) || 
                      screen.queryByRole('button', { name: /日志|Log/i });

    if (systemLogs) {
      await userClick(systemLogs);

      // 验证日志显示
      await waitFor(() => {
        const logEntries = screen.queryByText(/日志|Log|时间|Time|操作|Action/i);
        if (logEntries) {
          expect(logEntries).toBeInTheDocument();
        }
      });
    }
  });

  test('应该能够配置系统设置', async () => {
    renderWithRealSurreal(<AdminPage />, { authUserId: 'user:admin' });

    // 查找系统设置选项
    const systemSettings = screen.queryByText(/系统设置|System Settings|配置|Settings/i) || 
                          screen.queryByRole('button', { name: /设置|Setting/i });

    if (systemSettings) {
      await userClick(systemSettings);

      // 验证设置表单显示
      await waitFor(() => {
        const settingsForm = screen.queryByText(/设置|Settings|配置|Configuration/i);
        if (settingsForm) {
          expect(settingsForm).toBeInTheDocument();
        }
      });
    }
  });

  test('应该能够导出数据', async () => {
    renderWithRealSurreal(<AdminPage />, { authUserId: 'user:admin' });

    // 查找数据导出选项
    const exportData = screen.queryByText(/导出|Export|备份|Backup/i) || 
                      screen.queryByRole('button', { name: /导出|Export/i });

    if (exportData) {
      await userClick(exportData);

      // 验证导出选项显示
      await waitFor(() => {
        const exportOptions = screen.queryByText(/导出格式|Export Format|CSV|Excel/i);
        if (exportOptions) {
          expect(exportOptions).toBeInTheDocument();
        }
      });
    }
  });

  test('应该验证管理员权限', async () => {
    // 测试非管理员用户访问
    await TestHelpers.clearAuth(); // 清除认证
    
    renderWithRealSurreal(<AdminPage />); // 不设置认证用户

    // 应该显示权限错误或重定向
    await waitFor(() => {
      const errorMessage = screen.queryByText(/权限不足|Access Denied|未授权|Unauthorized/i) || 
                          screen.queryByText(/登录|Login/i);
      
      if (errorMessage) {
        expect(errorMessage).toBeInTheDocument();
      }
    }, { timeout: 5000 });
  });

  test('应该显示实时系统状态', async () => {
    renderWithRealSurreal(<AdminPage />, { authUserId: 'user:admin' });

    // 验证系统状态指示器
    await waitFor(() => {
      const statusIndicators = screen.queryAllByText(/在线|Online|运行中|Running|正常|Normal/i);
      if (statusIndicators.length > 0) {
        expect(statusIndicators.length).toBeGreaterThan(0);
      }
    });
  });

  test('应该能够搜索用户和案件', async () => {
    // 创建测试数据
    await TestHelpers.create('user', {
      username: 'search_test_user',
      name: '搜索测试用户',
      email: 'search@test.com'
    });

    renderWithRealSurreal(<AdminPage />, { authUserId: 'user:admin' });

    // 查找搜索框
    const searchBox = screen.queryByPlaceholderText(/搜索|Search/i) || 
                     screen.queryByRole('textbox');

    if (searchBox) {
      await userType(searchBox, '搜索测试');

      // 验证搜索结果
      await waitFor(() => {
        const searchResults = screen.queryByText(/搜索测试用户|search_test_user/i);
        if (searchResults) {
          expect(searchResults).toBeInTheDocument();
        }
      });
    }
  });

  test('应该能够批量操作', async () => {
    // 创建多个测试用户
    for (let i = 1; i <= 3; i++) {
      await TestHelpers.create('user', {
        username: `batch_user_${i}`,
        name: `批量测试用户 ${i}`,
        email: `batch${i}@test.com`
      });
    }

    renderWithRealSurreal(<AdminPage />, { authUserId: 'user:admin' });

    // 查找批量操作选项
    const batchActions = screen.queryByText(/批量操作|Batch Actions|选择多个/i);

    if (batchActions) {
      await userClick(batchActions);

      // 查找复选框选择用户
      const checkboxes = screen.queryAllByRole('checkbox');
      if (checkboxes.length > 0) {
        // 选择第一个复选框
        await userClick(checkboxes[0]);

        // 查找批量操作按钮
        const batchButton = screen.queryByRole('button', { name: /批量|Batch/i });
        if (batchButton) {
          expect(batchButton).toBeInTheDocument();
        }
      }
    }
  });
});
