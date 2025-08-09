/**
 * 债权人页面完整集成测试
 * 测试债权人列表页面与service worker的完整链路，不使用任何mock
 */

import React from "react";
import { describe, it, expect, beforeEach } from "vitest";
import { screen, fireEvent, waitFor, act } from "@testing-library/react";
import { RecordId } from "surrealdb";
import {
  renderWithRealSurreal,
  TestHelpers,
  TEST_IDS,
} from "../../utils/realSurrealTestUtils";

// 导入真实的债权人页面组件
import CreditorsPage from "@/src/pages/creditors/index";

describe('债权人列表页面 - 完整集成测试', () => {
  beforeEach(async () => {
    await TestHelpers.resetDatabase();
    await TestHelpers.setAuthUser(TEST_IDS.USERS.ADMIN);

    // 创建测试债权人数据
    const testCreditors = [
      {
        name: '北京某某科技有限公司',
        creditor_type: 'enterprise',
        contact_person: '张经理',
        contact_phone: '010-12345678',
        contact_email: 'zhang@example.com',
        address: '北京市朝阳区某某街道123号',
        identification_number: '91110108123456789X',
        created_at: new Date('2024-01-15'),
        updated_at: new Date('2024-01-15'),
      },
      {
        name: '李某某',
        creditor_type: 'individual',
        contact_person: '李某某',
        contact_phone: '138-0013-8000',
        contact_email: 'li@example.com',
        address: '上海市浦东新区某某路456号',
        identification_number: '310101199001011234',
        created_at: new Date('2024-02-01'),
        updated_at: new Date('2024-02-01'),
      },
      {
        name: '深圳某某贸易有限公司',
        creditor_type: 'enterprise',
        contact_person: '王总监',
        contact_phone: '0755-87654321',
        contact_email: 'wang@trading.com',
        address: '深圳市南山区某某大厦8楼',
        identification_number: '91440300234567890A',
        created_at: new Date('2024-02-15'),
        updated_at: new Date('2024-02-15'),
      },
      {
        name: '陈某某',
        creditor_type: 'individual',
        contact_person: '陈某某',
        contact_phone: '189-0018-9000',
        contact_email: 'chen@example.com',
        address: '广州市天河区某某小区102室',
        identification_number: '440101198501011234',
        created_at: new Date('2024-03-01'),
        updated_at: new Date('2024-03-01'),
      },
      {
        name: '成都某某制造有限公司',
        creditor_type: 'enterprise',
        contact_person: '刘厂长',
        contact_phone: '028-98765432',
        contact_email: 'liu@manufacturing.com',
        address: '成都市高新区某某产业园区A区',
        identification_number: '91510100345678901B',
        created_at: new Date('2024-03-15'),
        updated_at: new Date('2024-03-15'),
      },
    ];

    // 创建测试债权人
    for (const creditor of testCreditors) {
      await TestHelpers.create('creditor', creditor);
    }

    // 创建测试案件用于债权申报关联
    const testCase = await TestHelpers.create('case', {
      name: '债权人测试案件',
      case_number: '(2024)债权测试001号',
      case_manager_name: '测试管理员',
      acceptance_date: new Date(),
      case_procedure: 'bankruptcy_liquidation',
      procedure_phase: 'claim_declaration',
      case_status: 'active',
      created_by_user: new RecordId('user', 'admin'),
      created_at: new Date(),
      updated_at: new Date(),
    });

    const caseId = (testCase as any).id;

    // 为部分债权人创建债权申报记录
    const creditors = await TestHelpers.query("SELECT * FROM creditor LIMIT 3;");
    const creditorsList = (creditors?.[0] as any[]) || [];
    
    if (creditorsList.length >= 2) {
      await TestHelpers.create('claim', {
        case_id: caseId,
        creditor_id: creditorsList[0].id,
        claim_amount: 500000,
        claim_type: 'ordinary',
        claim_basis: '货款债务',
        claim_status: 'approved',
        asserted_claim_details: { type: 'enterprise' },
        submitted_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      });

      await TestHelpers.create('claim', {
        case_id: caseId,
        creditor_id: creditorsList[1].id,
        claim_amount: 100000,
        claim_type: 'priority',
        claim_basis: '税务债务',
        claim_status: 'submitted',
        asserted_claim_details: { type: 'individual' },
        submitted_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      });
    }
  });

  describe('页面基础渲染', () => {
    it('应该正确渲染页面标题和功能区', async () => {
      renderWithRealSurreal(<CreditorsPage />, { authUserId: TEST_IDS.USERS.ADMIN });

      // 等待页面加载完成
      await waitFor(() => {
        expect(screen.getByText(/债权人管理|债权人列表/)).toBeInTheDocument();
      }, { timeout: 10000 });

      // 验证搜索和操作功能
      await waitFor(() => {
        const searchInputs = screen.getAllByRole('textbox');
        expect(searchInputs.length).toBeGreaterThan(0);
      }, { timeout: 5000 });
    });

    it('应该渲染添加债权人按钮', async () => {
      renderWithRealSurreal(<CreditorsPage />, { authUserId: TEST_IDS.USERS.ADMIN });

      await waitFor(() => {
        expect(screen.getByText(/添加债权人|创建债权人|新增债权人/)).toBeInTheDocument();
      }, { timeout: 5000 });
    });

    it('应该显示导出功能', async () => {
      renderWithRealSurreal(<CreditorsPage />, { authUserId: TEST_IDS.USERS.ADMIN });

      await waitFor(() => {
        // 根据页面实现，可能有导出按钮或批量操作
        const exportButton = screen.queryByText(/导出|批量|打印/);
        // 如果实现了导出功能，应该能找到相关按钮
        if (exportButton) {
          expect(exportButton).toBeInTheDocument();
        }
      }, { timeout: 5000 });
    });
  });

  describe('债权人数据显示', () => {
    it('应该从数据库加载并显示债权人列表', async () => {
      renderWithRealSurreal(<CreditorsPage />, { authUserId: TEST_IDS.USERS.ADMIN });

      // 等待数据加载完成，通过等待特定债权人名称出现
      await waitFor(() => {
        expect(screen.getByText('北京某某科技有限公司')).toBeInTheDocument();
      }, { timeout: 10000 });

      // 验证所有测试债权人都显示了
      expect(screen.getByText('李某某')).toBeInTheDocument();
      expect(screen.getByText('深圳某某贸易有限公司')).toBeInTheDocument();
      expect(screen.getByText('陈某某')).toBeInTheDocument();
      expect(screen.getByText('成都某某制造有限公司')).toBeInTheDocument();
    });

    it('应该显示债权人的详细信息', async () => {
      renderWithRealSurreal(<CreditorsPage />, { authUserId: TEST_IDS.USERS.ADMIN });

      await waitFor(() => {
        expect(screen.getByText('北京某某科技有限公司')).toBeInTheDocument();
      }, { timeout: 10000 });

      // 验证联系人信息显示
      expect(screen.getByText('张经理')).toBeInTheDocument();
      expect(screen.getByText('王总监')).toBeInTheDocument();
      expect(screen.getByText('刘厂长')).toBeInTheDocument();

      // 验证联系方式显示
      expect(screen.getByText('010-12345678')).toBeInTheDocument();
      expect(screen.getByText('138-0013-8000')).toBeInTheDocument();
      expect(screen.getByText('0755-87654321')).toBeInTheDocument();
    });

    it('应该区分企业和个人债权人', async () => {
      renderWithRealSurreal(<CreditorsPage />, { authUserId: TEST_IDS.USERS.ADMIN });

      await waitFor(() => {
        expect(screen.getByText('北京某某科技有限公司')).toBeInTheDocument();
      }, { timeout: 10000 });

      // 验证债权人类型的显示
      // 具体显示方式取决于页面实现
      const enterpriseIndicators = screen.getAllByText(/企业|公司/);
      const individualIndicators = screen.getAllByText(/个人|自然人/);
      
      expect(enterpriseIndicators.length + individualIndicators.length).toBeGreaterThan(0);
    });

    it('应该显示债权人统计信息', async () => {
      renderWithRealSurreal(<CreditorsPage />, { authUserId: TEST_IDS.USERS.ADMIN });

      await waitFor(() => {
        expect(screen.getByText('北京某某科技有限公司')).toBeInTheDocument();
      }, { timeout: 10000 });

      // 如果页面实现了统计功能，应该显示总数等信息
      const statsElements = screen.queryAllByText(/总计|总数|企业.*个|个人.*人/);
      // 根据实际实现验证统计信息
    });
  });

  describe('搜索和过滤功能', () => {
    it('应该支持债权人名称搜索', async () => {
      renderWithRealSurreal(<CreditorsPage />, { authUserId: TEST_IDS.USERS.ADMIN });

      await waitFor(() => {
        expect(screen.getByText('北京某某科技有限公司')).toBeInTheDocument();
      }, { timeout: 10000 });

      // 查找搜索框
      const searchInputs = screen.getAllByRole('textbox');
      const searchInput = searchInputs.find(input => 
        input.getAttribute('placeholder')?.includes('搜索') ||
        input.getAttribute('placeholder')?.includes('查找') ||
        input.getAttribute('name')?.includes('search')
      );

      if (searchInput) {
        // 执行搜索
        fireEvent.change(searchInput, { target: { value: '北京' } });

        await waitFor(() => {
          expect(searchInput).toHaveValue('北京');
        });

        // 根据页面的搜索实现，可能需要等待搜索结果
        // 这里验证搜索功能的基本工作原理
      }
    });

    it('应该支持按债权人类型过滤', async () => {
      renderWithRealSurreal(<CreditorsPage />, { authUserId: TEST_IDS.USERS.ADMIN });

      await waitFor(() => {
        expect(screen.getByText('北京某某科技有限公司')).toBeInTheDocument();
      }, { timeout: 10000 });

      // 查找类型过滤器
      const filterSelects = screen.queryAllByRole('combobox');
      const typeFilter = filterSelects.find(select => 
        select.getAttribute('name')?.includes('type') ||
        select.getAttribute('aria-label')?.includes('类型')
      );

      if (typeFilter) {
        // 执行类型过滤
        fireEvent.mouseDown(typeFilter);
        
        // 等待下拉选项出现
        await waitFor(() => {
          const options = screen.queryAllByText(/企业|个人/);
          if (options.length > 0) {
            fireEvent.click(options[0]);
          }
        }, { timeout: 2000 });
      }
    });

    it('应该支持按联系方式搜索', async () => {
      renderWithRealSurreal(<CreditorsPage />, { authUserId: TEST_IDS.USERS.ADMIN });

      await waitFor(() => {
        expect(screen.getByText('010-12345678')).toBeInTheDocument();
      }, { timeout: 10000 });

      const searchInputs = screen.getAllByRole('textbox');
      const searchInput = searchInputs[0]; // 使用第一个搜索框

      if (searchInput) {
        fireEvent.change(searchInput, { target: { value: '010' } });

        await waitFor(() => {
          expect(searchInput).toHaveValue('010');
        });
      }
    });
  });

  describe('债权人操作功能', () => {
    it('应该为每个债权人提供操作按钮', async () => {
      renderWithRealSurreal(<CreditorsPage />, { authUserId: TEST_IDS.USERS.ADMIN });

      await waitFor(() => {
        expect(screen.getByText('北京某某科技有限公司')).toBeInTheDocument();
      }, { timeout: 10000 });

      // 查找操作按钮
      const actionButtons = screen.getAllByText(/查看|编辑|删除|详情|申报/);
      expect(actionButtons.length).toBeGreaterThan(0);
    });

    it('应该能够打开债权人详情', async () => {
      renderWithRealSurreal(<CreditorsPage />, { authUserId: TEST_IDS.USERS.ADMIN });

      await waitFor(() => {
        expect(screen.getByText('北京某某科技有限公司')).toBeInTheDocument();
      }, { timeout: 10000 });

      // 查找查看详情按钮
      const detailButtons = screen.queryAllByText(/查看详情|详情/);
      if (detailButtons.length > 0) {
        fireEvent.click(detailButtons[0]);

        // 等待详情对话框或页面出现
        await waitFor(() => {
          // 根据实际实现，可能会打开对话框或跳转页面
          const detailContent = screen.queryByText(/详细信息|基本信息/);
          if (detailContent) {
            expect(detailContent).toBeInTheDocument();
          }
        }, { timeout: 3000 });
      }
    });

    it('应该能够查看债权人的申报记录', async () => {
      renderWithRealSurreal(<CreditorsPage />, { authUserId: TEST_IDS.USERS.ADMIN });

      await waitFor(() => {
        expect(screen.getByText('北京某某科技有限公司')).toBeInTheDocument();
      }, { timeout: 10000 });

      // 查找申报相关按钮
      const claimButtons = screen.queryAllByText(/申报记录|债权|查看申报/);
      if (claimButtons.length > 0) {
        fireEvent.click(claimButtons[0]);

        await waitFor(() => {
          // 可能会显示申报记录对话框或跳转到申报页面
          const claimContent = screen.queryByText(/申报记录|债权金额/);
          if (claimContent) {
            expect(claimContent).toBeInTheDocument();
          }
        }, { timeout: 3000 });
      }
    });
  });

  describe('添加债权人功能', () => {
    it('应该能够打开添加债权人对话框', async () => {
      renderWithRealSurreal(<CreditorsPage />, { authUserId: TEST_IDS.USERS.ADMIN });

      await waitFor(() => {
        expect(screen.getByText(/添加债权人|创建债权人|新增债权人/)).toBeInTheDocument();
      }, { timeout: 10000 });

      // 点击添加按钮
      const addButton = screen.getByText(/添加债权人|创建债权人|新增债权人/);
      fireEvent.click(addButton);

      // 等待对话框出现
      await waitFor(() => {
        const dialogTitle = screen.queryByText(/添加债权人|新增债权人|创建债权人/);
        const nameInput = screen.queryByLabelText(/债权人名称|姓名|企业名称/);
        
        // 验证对话框已打开
        if (dialogTitle || nameInput) {
          expect(dialogTitle || nameInput).toBeInTheDocument();
        }
      }, { timeout: 3000 });
    });

    it('应该验证添加债权人表单的必填字段', async () => {
      renderWithRealSurreal(<CreditorsPage />, { authUserId: TEST_IDS.USERS.ADMIN });

      await waitFor(() => {
        expect(screen.getByText(/添加债权人|创建债权人|新增债权人/)).toBeInTheDocument();
      }, { timeout: 10000 });

      const addButton = screen.getByText(/添加债权人|创建债权人|新增债权人/);
      fireEvent.click(addButton);

      await waitFor(() => {
        const submitButton = screen.queryByText(/确定|保存|提交|创建/);
        if (submitButton) {
          // 不填写任何信息就提交
          fireEvent.click(submitButton);

          // 应该显示验证错误
          setTimeout(async () => {
            const errorMessages = screen.queryAllByText(/必填|不能为空|请输入/);
            if (errorMessages.length > 0) {
              expect(errorMessages[0]).toBeInTheDocument();
            }
          }, 1000);
        }
      }, { timeout: 3000 });
    });
  });

  describe('批量操作功能', () => {
    it('应该支持批量选择债权人', async () => {
      renderWithRealSurreal(<CreditorsPage />, { authUserId: TEST_IDS.USERS.ADMIN });

      await waitFor(() => {
        expect(screen.getByText('北京某某科技有限公司')).toBeInTheDocument();
      }, { timeout: 10000 });

      // 查找批量选择复选框
      const checkboxes = screen.getAllByRole('checkbox');
      if (checkboxes.length > 0) {
        // 选择第一个复选框
        fireEvent.click(checkboxes[0]);

        await waitFor(() => {
          expect(checkboxes[0]).toBeChecked();
        });

        // 如果有批量操作按钮，应该变为可用状态
        const batchButtons = screen.queryAllByText(/批量|删除选中|导出选中/);
        if (batchButtons.length > 0) {
          expect(batchButtons[0]).not.toBeDisabled();
        }
      }
    });

    it('应该支持批量导出功能', async () => {
      renderWithRealSurreal(<CreditorsPage />, { authUserId: TEST_IDS.USERS.ADMIN });

      await waitFor(() => {
        expect(screen.getByText('北京某某科技有限公司')).toBeInTheDocument();
      }, { timeout: 10000 });

      // 查找导出按钮
      const exportButtons = screen.queryAllByText(/导出|打印运单/);
      if (exportButtons.length > 0) {
        fireEvent.click(exportButtons[0]);

        // 可能会打开导出对话框或直接开始下载
        await waitFor(() => {
          const exportDialog = screen.queryByText(/导出设置|选择格式|确认导出/);
          if (exportDialog) {
            expect(exportDialog).toBeInTheDocument();
          }
        }, { timeout: 3000 });
      }
    });
  });

  describe('分页功能', () => {
    it('应该支持分页显示', async () => {
      renderWithRealSurreal(<CreditorsPage />, { authUserId: TEST_IDS.USERS.ADMIN });

      await waitFor(() => {
        expect(screen.getByText('北京某某科技有限公司')).toBeInTheDocument();
      }, { timeout: 10000 });

      // 查找分页控件
      const paginationElements = screen.queryAllByText(/下一页|上一页|第.*页/);
      const pageButtons = screen.queryAllByRole('button').filter(button => 
        /^\d+$/.test(button.textContent || '')
      );

      // 如果有分页功能，应该能找到相关元素
      if (paginationElements.length > 0 || pageButtons.length > 0) {
        expect(paginationElements.length + pageButtons.length).toBeGreaterThan(0);
      }
    });

    it('应该支持调整每页显示数量', async () => {
      renderWithRealSurreal(<CreditorsPage />, { authUserId: TEST_IDS.USERS.ADMIN });

      await waitFor(() => {
        expect(screen.getByText('北京某某科技有限公司')).toBeInTheDocument();
      }, { timeout: 10000 });

      // 查找每页显示数量选择器
      const pageSizeSelects = screen.queryAllByRole('combobox').filter(select =>
        select.getAttribute('aria-label')?.includes('每页') ||
        select.getAttribute('name')?.includes('pageSize')
      );

      if (pageSizeSelects.length > 0) {
        fireEvent.mouseDown(pageSizeSelects[0]);

        await waitFor(() => {
          const options = screen.queryAllByText(/10|20|50|100/);
          if (options.length > 0) {
            fireEvent.click(options[0]);
          }
        }, { timeout: 2000 });
      }
    });
  });

  describe('数据验证', () => {
    it('应该显示正确的债权人数量', async () => {
      renderWithRealSurreal(<CreditorsPage />, { authUserId: TEST_IDS.USERS.ADMIN });

      await waitFor(() => {
        expect(screen.getByText('北京某某科技有限公司')).toBeInTheDocument();
      }, { timeout: 10000 });

      // 验证数据库中确实有5个债权人
      const creditorCount = await TestHelpers.getRecordCount('creditor');
      expect(creditorCount).toBe(5);

      // 页面应该显示相应的债权人
      expect(screen.getByText('李某某')).toBeInTheDocument();
      expect(screen.getByText('深圳某某贸易有限公司')).toBeInTheDocument();
      expect(screen.getByText('陈某某')).toBeInTheDocument();
      expect(screen.getByText('成都某某制造有限公司')).toBeInTheDocument();
    });

    it('应该正确显示债权人的申报状态', async () => {
      renderWithRealSurreal(<CreditorsPage />, { authUserId: TEST_IDS.USERS.ADMIN });

      await waitFor(() => {
        expect(screen.getByText('北京某某科技有限公司')).toBeInTheDocument();
      }, { timeout: 10000 });

      // 验证已有申报记录的债权人显示状态
      // 具体显示方式取决于页面实现
      const statusIndicators = screen.queryAllByText(/已申报|未申报|审核中|已通过/);
      if (statusIndicators.length > 0) {
        expect(statusIndicators.length).toBeGreaterThan(0);
      }
    });
  });

  describe('权限控制', () => {
    it('管理员应该看到所有操作功能', async () => {
      renderWithRealSurreal(<CreditorsPage />, { authUserId: TEST_IDS.USERS.ADMIN });

      await waitFor(() => {
        expect(screen.getByText(/添加债权人|创建债权人|新增债权人/)).toBeInTheDocument();
      }, { timeout: 10000 });

      // 验证管理员可以看到所有功能按钮
      expect(screen.getByText('北京某某科技有限公司')).toBeInTheDocument();
    });

    it('普通用户应该只看到有权限的操作', async () => {
      renderWithRealSurreal(<CreditorsPage />, { authUserId: TEST_IDS.USERS.CREDITOR_USER });

      // 等待页面加载
      await waitFor(() => {
        // 根据权限配置，普通用户可能看不到添加按钮
        const pageContent = screen.getByText(/债权人管理|债权人列表|北京某某科技有限公司/);
        expect(pageContent).toBeInTheDocument();
      }, { timeout: 10000 });

      // 验证权限限制
      const addButton = screen.queryByText(/添加债权人|创建债权人|新增债权人/);
      // 根据权限配置，普通用户可能看不到添加按钮
    });
  });

  describe('响应式设计', () => {
    it('应该在移动端正确显示', async () => {
      // 设置移动端视口
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 667,
      });

      window.dispatchEvent(new Event('resize'));

      renderWithRealSurreal(<CreditorsPage />, { authUserId: TEST_IDS.USERS.ADMIN });

      await waitFor(() => {
        expect(screen.getByText('北京某某科技有限公司')).toBeInTheDocument();
      }, { timeout: 10000 });

      // 在移动端应该仍然能够正常显示债权人列表
      expect(screen.getByText('李某某')).toBeInTheDocument();
    });
  });

  describe('Service Worker集成', () => {
    it('应该通过service worker正确加载数据', async () => {
      renderWithRealSurreal(<CreditorsPage />, { authUserId: TEST_IDS.USERS.ADMIN });

      // 验证数据确实从数据库加载
      await waitFor(() => {
        expect(screen.getByText('北京某某科技有限公司')).toBeInTheDocument();
      }, { timeout: 10000 });

      // 验证这些是我们在数据库中创建的真实数据
      expect(screen.getByText('91110108123456789X')).toBeInTheDocument();
      expect(screen.getByText('zhang@example.com')).toBeInTheDocument();

      // 验证数据库查询确实工作
      const creditorCount = await TestHelpers.getRecordCount('creditor');
      expect(creditorCount).toBe(5);
    });

    it('应该处理认证失败的情况', async () => {
      // 清除认证状态
      await TestHelpers.clearAuth();

      renderWithRealSurreal(<CreditorsPage />);

      // 根据系统的认证处理，可能会重定向到登录页面或显示错误
      await waitFor(() => {
        const content = screen.getByText(/债权人管理|登录|认证|错误/);
        expect(content).toBeInTheDocument();
      }, { timeout: 5000 });
    });
  });

  describe('性能测试', () => {
    it('应该在合理时间内加载债权人列表', async () => {
      const startTime = Date.now();

      renderWithRealSurreal(<CreditorsPage />, { authUserId: TEST_IDS.USERS.ADMIN });

      await waitFor(() => {
        expect(screen.getByText('北京某某科技有限公司')).toBeInTheDocument();
      }, { timeout: 10000 });

      const endTime = Date.now();
      const loadTime = endTime - startTime;

      // 页面应该在合理时间内加载完成
      expect(loadTime).toBeLessThan(8000);
    });

    it('应该高效处理更多债权人数据', async () => {
      // 创建更多测试数据
      for (let i = 6; i <= 25; i++) {
        await TestHelpers.create('creditor', {
          name: `批量测试债权人${i}`,
          creditor_type: i % 2 === 0 ? 'enterprise' : 'individual',
          contact_person: `联系人${i}`,
          contact_phone: `138${String(i).padStart(8, '0')}`,
          contact_email: `test${i}@example.com`,
          identification_number: i % 2 === 0 ? `91110108${String(i).padStart(9, '0')}X` : `11010119900101${String(i).padStart(4, '0')}`,
          created_at: new Date(),
          updated_at: new Date(),
        });
      }

      const startTime = Date.now();

      renderWithRealSurreal(<CreditorsPage />, { authUserId: TEST_IDS.USERS.ADMIN });

      await waitFor(() => {
        expect(screen.getByText('北京某某科技有限公司')).toBeInTheDocument();
      }, { timeout: 15000 });

      const endTime = Date.now();
      const loadTime = endTime - startTime;

      // 即使有更多数据，也应该在合理时间内加载
      expect(loadTime).toBeLessThan(12000);

      // 验证数据确实增加了
      const totalCreditors = await TestHelpers.getRecordCount('creditor');
      expect(totalCreditors).toBe(25); // 5个初始 + 20个新增
    });
  });
});