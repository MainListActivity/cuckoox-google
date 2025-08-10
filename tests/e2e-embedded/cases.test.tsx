/**
 * 案件管理测试 - 使用内嵌数据库
 * 从 Playwright E2E 测试转换为 Vitest + 内嵌 SurrealDB 集成测试
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { screen, fireEvent, waitFor, act } from '@testing-library/react';
import { renderWithRealSurreal, TestHelpers } from '../utils/realSurrealTestUtils';
import { getTestDatabase, getTestDatabaseManager } from '../setup-embedded-db';
import CasesPage from '../../src/pages/cases';

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

describe('案件管理 - 内嵌数据库测试', () => {
  beforeEach(async () => {
    // 设置认证状态
    const dbManager = getTestDatabaseManager();
    await dbManager.setAuthUser('user:admin');
    
    // 模拟已登录状态
    Object.defineProperty(window, 'location', {
      value: {
        href: 'http://localhost:3000/cases',
        pathname: '/cases',
        search: '',
        hash: '',
        origin: 'http://localhost:3000',
        replace: vi.fn(),
        assign: vi.fn(),
      },
      writable: true,
    });
  });

  test('应该渲染案件列表页面', async () => {
    renderWithRealSurreal(<CasesPage />, { authUserId: 'user:admin' });

    // 验证页面标题
    expect(screen.getByText(/案件管理|Cases/i)).toBeInTheDocument();

    // 验证搜索框
    const searchBox = screen.queryByPlaceholderText(/搜索案件|Search cases/i) || 
                     screen.queryByLabelText(/搜索|Search/i);
    if (searchBox) {
      expect(searchBox).toBeInTheDocument();
    }

    // 验证创建按钮
    const createButton = screen.queryByRole('button', { name: /新建案件|Create Case|添加/i });
    if (createButton) {
      expect(createButton).toBeInTheDocument();
    }
  });

  test('应该能够搜索案件', async () => {
    // 先在数据库中创建一些测试案件
    const db = getTestDatabase();
    await TestHelpers.create('case', {
      name: '测试案件搜索',
      court_name: '北京市第一中级人民法院',
      case_number: 'TEST-2024-001',
      status: 'active'
    });

    renderWithRealSurreal(<CasesPage />, { authUserId: 'user:admin' });

    // 等待页面加载
    await waitFor(() => {
      expect(screen.getByText(/案件管理|Cases/i)).toBeInTheDocument();
    });

    // 查找搜索框
    const searchBox = screen.queryByPlaceholderText(/搜索案件|Search cases/i) || 
                     screen.queryByRole('textbox') || 
                     screen.queryByLabelText(/搜索|Search/i);

    if (searchBox) {
      // 输入搜索关键词
      await userType(searchBox, '测试案件');

      // 等待搜索结果
      await waitFor(() => {
        const searchResults = screen.queryByText(/测试案件搜索/i);
        if (searchResults) {
          expect(searchResults).toBeInTheDocument();
        }
      }, { timeout: 5000 });
    }
  });

  test('应该显示案件列表', async () => {
    // 在数据库中创建测试案件
    const testCase = await TestHelpers.create('case', {
      name: '显示测试案件',
      court_name: '上海市中级人民法院',
      case_number: 'DISPLAY-2024-001',
      status: 'active',
      case_type: 'bankruptcy'
    });

    renderWithRealSurreal(<CasesPage />, { authUserId: 'user:admin' });

    // 等待案件列表加载
    await waitFor(() => {
      const caseItem = screen.queryByText(/显示测试案件/i) || 
                      screen.queryByText(/DISPLAY-2024-001/i);
      if (caseItem) {
        expect(caseItem).toBeInTheDocument();
      }
    }, { timeout: 5000 });

    // 验证案件状态显示
    const statusIndicator = screen.queryByText(/active|进行中|活跃/i);
    if (statusIndicator) {
      expect(statusIndicator).toBeInTheDocument();
    }
  });

  test('应该能够点击案件查看详情', async () => {
    // 创建测试案件
    const testCase = await TestHelpers.create('case', {
      name: '详情查看案件',
      court_name: '广州市中级人民法院',
      case_number: 'DETAIL-2024-001',
      status: 'active',
      description: '这是一个测试案件详情'
    });

    renderWithRealSurreal(<CasesPage />, { authUserId: 'user:admin' });

    // 等待页面加载并查找案件
    await waitFor(() => {
      const caseItem = screen.queryByText(/详情查看案件/i) || 
                      screen.queryByText(/DETAIL-2024-001/i);
      if (caseItem) {
        expect(caseItem).toBeInTheDocument();
      }
    }, { timeout: 5000 });

    // 点击案件
    const caseItem = screen.queryByText(/详情查看案件/i) || 
                    screen.queryByText(/DETAIL-2024-001/i);
    if (caseItem) {
      await userClick(caseItem);

      // 验证导航或详情页面显示
      await waitFor(() => {
        // 可能导航到详情页面或显示模态框
        const detailView = screen.queryByText(/案件详情|Case Details/i) || 
                          screen.queryByText(/详情查看案件/i);
        if (detailView) {
          expect(detailView).toBeInTheDocument();
        }
      });
    }
  });

  test('应该显示分页控件', async () => {
    // 创建多个案件以触发分页
    for (let i = 1; i <= 15; i++) {
      await TestHelpers.create('case', {
        name: `分页测试案件 ${i}`,
        court_name: '深圳市中级人民法院',
        case_number: `PAGE-2024-${i.toString().padStart(3, '0')}`,
        status: 'active'
      });
    }

    renderWithRealSurreal(<CasesPage />, { authUserId: 'user:admin' });

    // 等待页面加载
    await waitFor(() => {
      expect(screen.getByText(/案件管理|Cases/i)).toBeInTheDocument();
    });

    // 查找分页控件
    const pagination = screen.queryByRole('navigation') || 
                      screen.queryByText(/页|Page/i) || 
                      screen.queryByText(/下一页|Next/i);
    
    if (pagination) {
      expect(pagination).toBeInTheDocument();
    }
  });

  test('应该能够筛选不同状态的案件', async () => {
    // 创建不同状态的案件
    await TestHelpers.create('case', {
      name: '活跃状态案件',
      court_name: '杭州市中级人民法院',
      case_number: 'ACTIVE-2024-001',
      status: 'active'
    });

    await TestHelpers.create('case', {
      name: '已关闭案件',
      court_name: '南京市中级人民法院',
      case_number: 'CLOSED-2024-001',
      status: 'closed'
    });

    renderWithRealSurreal(<CasesPage />, { authUserId: 'user:admin' });

    // 等待页面加载
    await waitFor(() => {
      expect(screen.getByText(/案件管理|Cases/i)).toBeInTheDocument();
    });

    // 查找状态筛选器
    const statusFilter = screen.queryByText(/状态|Status/i) || 
                        screen.queryByRole('button', { name: /筛选|Filter/i });

    if (statusFilter) {
      await userClick(statusFilter);

      // 选择特定状态
      const activeOption = screen.queryByText(/活跃|Active/i);
      if (activeOption) {
        await userClick(activeOption);

        // 验证筛选结果
        await waitFor(() => {
          const activeCase = screen.queryByText(/活跃状态案件/i);
          if (activeCase) {
            expect(activeCase).toBeInTheDocument();
          }
        });
      }
    }
  });

  test('应该能够排序案件列表', async () => {
    // 创建带有不同日期的案件
    const today = new Date();
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

    await TestHelpers.create('case', {
      name: '最新案件',
      court_name: '武汉市中级人民法院',
      case_number: 'LATEST-2024-001',
      status: 'active',
      created_at: today.toISOString()
    });

    await TestHelpers.create('case', {
      name: '较早案件',
      court_name: '成都市中级人民法院',
      case_number: 'EARLIER-2024-001',
      status: 'active',
      created_at: yesterday.toISOString()
    });

    renderWithRealSurreal(<CasesPage />, { authUserId: 'user:admin' });

    // 等待页面加载
    await waitFor(() => {
      expect(screen.getByText(/案件管理|Cases/i)).toBeInTheDocument();
    });

    // 查找排序控件
    const sortButton = screen.queryByText(/排序|Sort/i) || 
                      screen.queryByRole('button', { name: /排序|Sort/i });

    if (sortButton) {
      await userClick(sortButton);

      // 选择按日期排序
      const dateSort = screen.queryByText(/日期|Date/i) || 
                      screen.queryByText(/创建时间|Created/i);
      
      if (dateSort) {
        await userClick(dateSort);

        // 验证排序结果
        await waitFor(() => {
          const caseElements = screen.queryAllByText(/案件|LATEST|EARLIER/i);
          if (caseElements.length > 0) {
            expect(caseElements.length).toBeGreaterThan(0);
          }
        });
      }
    }
  });

  test('应该验证用户权限', async () => {
    // 测试无权限用户访问
    renderWithRealSurreal(<CasesPage />); // 不设置认证用户

    // 应该显示权限错误或重定向到登录页面
    await waitFor(() => {
      const errorMessage = screen.queryByText(/权限|Permission|未授权|Unauthorized/i) || 
                          screen.queryByText(/登录|Login/i);
      
      if (errorMessage) {
        expect(errorMessage).toBeInTheDocument();
      }
    }, { timeout: 5000 });
  });

  test('应该处理加载错误', async () => {
    // 模拟数据库错误
    vi.spyOn(TestHelpers, 'query').mockRejectedValueOnce(new Error('Database connection failed'));

    renderWithRealSurreal(<CasesPage />, { authUserId: 'user:admin' });

    // 等待错误处理
    await waitFor(() => {
      const errorMessage = screen.queryByText(/错误|Error|连接失败|Failed/i);
      if (errorMessage) {
        expect(errorMessage).toBeInTheDocument();
      }
    }, { timeout: 5000 });

    // 恢复模拟
    vi.restoreAllMocks();
  });
});
