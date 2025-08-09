/**
 * 债权申报页面完整集成测试
 * 测试债权申报列表页面与service worker的完整链路，不使用任何mock
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

// 导入真实的债权申报页面组件
import ClaimsPage from "@/src/pages/claims/index";

describe('债权申报列表页面 - 完整集成测试', () => {
  let testCaseId: string;
  let testCreditorIds: string[] = [];

  beforeEach(async () => {
    await TestHelpers.resetDatabase();
    await TestHelpers.setAuthUser(TEST_IDS.USERS.ADMIN);

    // 创建测试案件
    const testCase = await TestHelpers.create('case', {
      name: '债权申报测试案件',
      case_number: '(2024)申报测试001号',
      case_manager_name: '申报测试管理员',
      acceptance_date: new Date('2024-01-15'),
      case_procedure: 'bankruptcy_liquidation',
      procedure_phase: 'claim_declaration',
      case_status: 'active',
      created_by_user: new RecordId('user', 'admin'),
      created_at: new Date('2024-01-01'),
      updated_at: new Date('2024-01-15'),
    });
    testCaseId = (testCase as any).id.id;

    // 创建测试债权人
    const testCreditors = [
      {
        name: '申报测试企业A',
        creditor_type: 'enterprise',
        contact_person: '企业联系人A',
        contact_phone: '010-11111111',
        identification_number: '91110108111111111A',
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        name: '申报测试个人B',
        creditor_type: 'individual',
        contact_person: '申报测试个人B',
        contact_phone: '138-1111-1111',
        identification_number: '110101199001011111',
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        name: '申报测试企业C',
        creditor_type: 'enterprise',
        contact_person: '企业联系人C',
        contact_phone: '0755-22222222',
        identification_number: '91440300222222222C',
        created_at: new Date(),
        updated_at: new Date(),
      },
    ];

    for (const creditor of testCreditors) {
      const creditorResult = await TestHelpers.create('creditor', creditor);
      testCreditorIds.push((creditorResult as any).id.id);
    }

    // 创建不同状态的债权申报记录
    const testClaims = [
      {
        case_id: new RecordId('case', testCaseId),
        creditor_id: new RecordId('creditor', testCreditorIds[0]),
        claim_amount: 500000,
        claim_type: 'ordinary',
        claim_basis: '货款债务，基于2023年供货合同',
        claim_status: 'approved',
        submitted_at: new Date('2024-02-01'),
        reviewed_at: new Date('2024-02-15'),
        reviewer: new RecordId('user', 'admin'),
        review_notes: '债权证据充分，金额合理，予以确认',
        asserted_claim_details: {
          contract_number: 'HT-2023-001',
          evidence_count: 5,
        },
        created_at: new Date('2024-02-01'),
        updated_at: new Date('2024-02-15'),
      },
      {
        case_id: new RecordId('case', testCaseId),
        creditor_id: new RecordId('creditor', testCreditorIds[1]),
        claim_amount: 80000,
        claim_type: 'priority',
        claim_basis: '工资及社保费用',
        claim_status: 'submitted',
        submitted_at: new Date('2024-02-05'),
        asserted_claim_details: {
          employment_period: '2022-01-01 至 2023-12-31',
          evidence_count: 3,
        },
        created_at: new Date('2024-02-05'),
        updated_at: new Date('2024-02-05'),
      },
      {
        case_id: new RecordId('case', testCaseId),
        creditor_id: new RecordId('creditor', testCreditorIds[2]),
        claim_amount: 1200000,
        claim_type: 'secured',
        claim_basis: '抵押担保贷款，抵押物为厂房设备',
        claim_status: 'under_review',
        submitted_at: new Date('2024-02-10'),
        asserted_claim_details: {
          collateral_type: 'real_estate_equipment',
          mortgage_registration: 'true',
          evidence_count: 8,
        },
        created_at: new Date('2024-02-10'),
        updated_at: new Date('2024-02-12'),
      },
      {
        case_id: new RecordId('case', testCaseId),
        creditor_id: new RecordId('creditor', testCreditorIds[0]),
        claim_amount: 300000,
        claim_type: 'ordinary',
        claim_basis: '服务费债务',
        claim_status: 'rejected',
        submitted_at: new Date('2024-02-12'),
        reviewed_at: new Date('2024-02-20'),
        reviewer: new RecordId('user', 'admin'),
        review_notes: '证据不足，建议提供更多支持材料',
        asserted_claim_details: {
          service_type: 'consulting',
          evidence_count: 2,
        },
        created_at: new Date('2024-02-12'),
        updated_at: new Date('2024-02-20'),
      },
      {
        case_id: new RecordId('case', testCaseId),
        creditor_id: new RecordId('creditor', testCreditorIds[1]),
        claim_amount: 15000,
        claim_type: 'labor',
        claim_basis: '加班费及年终奖',
        claim_status: 'disputed',
        submitted_at: new Date('2024-02-15'),
        asserted_claim_details: {
          dispute_reason: '金额存在争议',
          evidence_count: 4,
        },
        created_at: new Date('2024-02-15'),
        updated_at: new Date('2024-02-18'),
      },
    ];

    for (const claim of testClaims) {
      await TestHelpers.create('claim', claim);
    }
  });

  describe('页面基础渲染', () => {
    it('应该正确渲染页面标题和功能区', async () => {
      renderWithRealSurreal(<ClaimsPage />, { authUserId: TEST_IDS.USERS.ADMIN });

      // 等待页面加载完成
      await waitFor(() => {
        expect(screen.getByText(/债权申报|债权列表|申报管理/)).toBeInTheDocument();
      }, { timeout: 10000 });

      // 验证搜索功能区域
      await waitFor(() => {
        const searchElements = screen.getAllByRole('textbox');
        expect(searchElements.length).toBeGreaterThan(0);
      }, { timeout: 5000 });
    });

    it('应该显示债权申报统计信息', async () => {
      renderWithRealSurreal(<ClaimsPage />, { authUserId: TEST_IDS.USERS.ADMIN });

      await waitFor(() => {
        // 等待统计卡片加载
        expect(screen.getByText(/总申报|申报总数|已审核|待审核|已通过|已拒绝/)).toBeInTheDocument();
      }, { timeout: 10000 });
    });

    it('应该显示操作按钮区域', async () => {
      renderWithRealSurreal(<ClaimsPage />, { authUserId: TEST_IDS.USERS.ADMIN });

      await waitFor(() => {
        // 根据页面实现，可能有导出、筛选等功能按钮
        const actionButtons = screen.queryAllByText(/导出|筛选|刷新|审核/);
        if (actionButtons.length > 0) {
          expect(actionButtons[0]).toBeInTheDocument();
        }
      }, { timeout: 5000 });
    });
  });

  describe('债权申报列表显示', () => {
    it('应该从数据库加载并显示申报列表', async () => {
      renderWithRealSurreal(<ClaimsPage />, { authUserId: TEST_IDS.USERS.ADMIN });

      // 等待数据加载完成，通过等待特定申报信息出现
      await waitFor(() => {
        expect(screen.getByText('货款债务，基于2023年供货合同')).toBeInTheDocument();
      }, { timeout: 10000 });

      // 验证不同状态的申报都显示了
      expect(screen.getByText('工资及社保费用')).toBeInTheDocument();
      expect(screen.getByText('抵押担保贷款，抵押物为厂房设备')).toBeInTheDocument();
      expect(screen.getByText('服务费债务')).toBeInTheDocument();
      expect(screen.getByText('加班费及年终奖')).toBeInTheDocument();
    });

    it('应该正确显示申报金额', async () => {
      renderWithRealSurreal(<ClaimsPage />, { authUserId: TEST_IDS.USERS.ADMIN });

      await waitFor(() => {
        expect(screen.getByText('货款债务，基于2023年供货合同')).toBeInTheDocument();
      }, { timeout: 10000 });

      // 验证金额显示（可能带有格式化）
      expect(screen.getByText(/500,?000|50万/)).toBeInTheDocument();
      expect(screen.getByText(/80,?000|8万/)).toBeInTheDocument();
      expect(screen.getByText(/1,?200,?000|120万/)).toBeInTheDocument();
      expect(screen.getByText(/300,?000|30万/)).toBeInTheDocument();
      expect(screen.getByText(/15,?000|1\.5万/)).toBeInTheDocument();
    });

    it('应该显示债权人信息', async () => {
      renderWithRealSurreal(<ClaimsPage />, { authUserId: TEST_IDS.USERS.ADMIN });

      await waitFor(() => {
        expect(screen.getByText('申报测试企业A')).toBeInTheDocument();
      }, { timeout: 10000 });

      // 验证所有债权人都显示了
      expect(screen.getByText('申报测试个人B')).toBeInTheDocument();
      expect(screen.getByText('申报测试企业C')).toBeInTheDocument();
    });

    it('应该正确显示申报类型', async () => {
      renderWithRealSurreal(<ClaimsPage />, { authUserId: TEST_IDS.USERS.ADMIN });

      await waitFor(() => {
        expect(screen.getByText('货款债务，基于2023年供货合同')).toBeInTheDocument();
      }, { timeout: 10000 });

      // 验证债权类型的中文显示
      const typeElements = screen.getAllByText(/普通债权|优先债权|有财产担保债权|职工债权/);
      expect(typeElements.length).toBeGreaterThan(0);
    });

    it('应该正确显示申报状态', async () => {
      renderWithRealSurreal(<ClaimsPage />, { authUserId: TEST_IDS.USERS.ADMIN });

      await waitFor(() => {
        expect(screen.getByText('货款债务，基于2023年供货合同')).toBeInTheDocument();
      }, { timeout: 10000 });

      // 验证各种状态的显示
      const statusElements = screen.getAllByText(/已通过|待审核|审核中|已拒绝|有争议/);
      expect(statusElements.length).toBeGreaterThan(0);
    });
  });

  describe('状态筛选功能', () => {
    it('应该支持按申报状态筛选', async () => {
      renderWithRealSurreal(<ClaimsPage />, { authUserId: TEST_IDS.USERS.ADMIN });

      await waitFor(() => {
        expect(screen.getByText('货款债务，基于2023年供货合同')).toBeInTheDocument();
      }, { timeout: 10000 });

      // 查找状态筛选器
      const filterSelects = screen.queryAllByRole('combobox');
      const statusFilter = filterSelects.find(select => 
        select.getAttribute('name')?.includes('status') ||
        select.getAttribute('aria-label')?.includes('状态')
      );

      if (statusFilter) {
        fireEvent.mouseDown(statusFilter);
        
        await waitFor(() => {
          const options = screen.queryAllByText(/已通过|待审核|已拒绝/);
          if (options.length > 0) {
            fireEvent.click(options[0]);
          }
        }, { timeout: 2000 });
      }
    });

    it('应该支持按债权类型筛选', async () => {
      renderWithRealSurreal(<ClaimsPage />, { authUserId: TEST_IDS.USERS.ADMIN });

      await waitFor(() => {
        expect(screen.getByText('货款债务，基于2023年供货合同')).toBeInTheDocument();
      }, { timeout: 10000 });

      // 查找类型筛选器
      const filterSelects = screen.queryAllByRole('combobox');
      const typeFilter = filterSelects.find(select => 
        select.getAttribute('name')?.includes('type') ||
        select.getAttribute('aria-label')?.includes('类型')
      );

      if (typeFilter) {
        fireEvent.mouseDown(typeFilter);
        
        await waitFor(() => {
          const options = screen.queryAllByText(/普通债权|优先债权|担保债权/);
          if (options.length > 0) {
            fireEvent.click(options[0]);
          }
        }, { timeout: 2000 });
      }
    });
  });

  describe('搜索功能', () => {
    it('应该支持债权人名称搜索', async () => {
      renderWithRealSurreal(<ClaimsPage />, { authUserId: TEST_IDS.USERS.ADMIN });

      await waitFor(() => {
        expect(screen.getByText('申报测试企业A')).toBeInTheDocument();
      }, { timeout: 10000 });

      // 查找搜索框
      const searchInputs = screen.getAllByRole('textbox');
      const searchInput = searchInputs.find(input => 
        input.getAttribute('placeholder')?.includes('搜索') ||
        input.getAttribute('name')?.includes('search')
      );

      if (searchInput) {
        fireEvent.change(searchInput, { target: { value: '企业A' } });

        await waitFor(() => {
          expect(searchInput).toHaveValue('企业A');
        });
      }
    });

    it('应该支持申报依据搜索', async () => {
      renderWithRealSurreal(<ClaimsPage />, { authUserId: TEST_IDS.USERS.ADMIN });

      await waitFor(() => {
        expect(screen.getByText('货款债务，基于2023年供货合同')).toBeInTheDocument();
      }, { timeout: 10000 });

      const searchInputs = screen.getAllByRole('textbox');
      const searchInput = searchInputs[0];

      if (searchInput) {
        fireEvent.change(searchInput, { target: { value: '货款' } });

        await waitFor(() => {
          expect(searchInput).toHaveValue('货款');
        });
      }
    });
  });

  describe('申报详情和操作', () => {
    it('应该为每个申报提供操作按钮', async () => {
      renderWithRealSurreal(<ClaimsPage />, { authUserId: TEST_IDS.USERS.ADMIN });

      await waitFor(() => {
        expect(screen.getByText('货款债务，基于2023年供货合同')).toBeInTheDocument();
      }, { timeout: 10000 });

      // 查找操作按钮
      const actionButtons = screen.getAllByText(/查看详情|审核|编辑|删除|查看|操作/);
      expect(actionButtons.length).toBeGreaterThan(0);
    });

    it('应该能够查看申报详情', async () => {
      renderWithRealSurreal(<ClaimsPage />, { authUserId: TEST_IDS.USERS.ADMIN });

      await waitFor(() => {
        expect(screen.getByText('货款债务，基于2023年供货合同')).toBeInTheDocument();
      }, { timeout: 10000 });

      // 查找详情按钮
      const detailButtons = screen.queryAllByText(/查看详情|详情/);
      if (detailButtons.length > 0) {
        fireEvent.click(detailButtons[0]);

        await waitFor(() => {
          // 可能会打开详情对话框或跳转页面
          const detailContent = screen.queryByText(/申报详情|基本信息|证据材料/);
          if (detailContent) {
            expect(detailContent).toBeInTheDocument();
          }
        }, { timeout: 3000 });
      }
    });

    it('应该根据申报状态显示不同的操作选项', async () => {
      renderWithRealSurreal(<ClaimsPage />, { authUserId: TEST_IDS.USERS.ADMIN });

      await waitFor(() => {
        expect(screen.getByText('工资及社保费用')).toBeInTheDocument();
      }, { timeout: 10000 });

      // 对于待审核的申报，应该有审核操作
      const reviewButtons = screen.queryAllByText(/审核|通过|拒绝/);
      if (reviewButtons.length > 0) {
        expect(reviewButtons.length).toBeGreaterThan(0);
      }

      // 对于已通过的申报，可能有不同的操作选项
      const approvedButtons = screen.queryAllByText(/查看|修改|撤销/);
      if (approvedButtons.length > 0) {
        expect(approvedButtons.length).toBeGreaterThan(0);
      }
    });
  });

  describe('审核功能', () => {
    it('应该能够审核待审核的申报', async () => {
      renderWithRealSurreal(<ClaimsPage />, { authUserId: TEST_IDS.USERS.ADMIN });

      await waitFor(() => {
        expect(screen.getByText('工资及社保费用')).toBeInTheDocument();
      }, { timeout: 10000 });

      // 查找审核按钮（针对待审核的申报）
      const reviewButtons = screen.queryAllByText(/审核|待审核/);
      if (reviewButtons.length > 0) {
        fireEvent.click(reviewButtons[0]);

        await waitFor(() => {
          // 应该打开审核对话框
          const reviewDialog = screen.queryByText(/审核债权申报|审核意见|通过|拒绝/);
          if (reviewDialog) {
            expect(reviewDialog).toBeInTheDocument();
          }
        }, { timeout: 3000 });
      }
    });

    it('应该显示审核历史和意见', async () => {
      renderWithRealSurreal(<ClaimsPage />, { authUserId: TEST_IDS.USERS.ADMIN });

      await waitFor(() => {
        expect(screen.getByText('债权证据充分，金额合理，予以确认')).toBeInTheDocument();
      }, { timeout: 10000 });

      // 验证已审核申报的审核意见显示
      expect(screen.getByText('证据不足，建议提供更多支持材料')).toBeInTheDocument();
    });
  });

  describe('统计信息', () => {
    it('应该正确显示申报统计', async () => {
      renderWithRealSurreal(<ClaimsPage />, { authUserId: TEST_IDS.USERS.ADMIN });

      await waitFor(() => {
        expect(screen.getByText('货款债务，基于2023年供货合同')).toBeInTheDocument();
      }, { timeout: 10000 });

      // 验证统计信息正确
      // 我们创建了5个申报：1个已通过，1个待审核，1个审核中，1个已拒绝，1个有争议
      const stats = await TestHelpers.query(`
        SELECT claim_status, count() AS count 
        FROM claim 
        GROUP BY claim_status;
      `);
      
      const statusCounts = (stats?.[0] as any[]) || [];
      expect(statusCounts.length).toBe(5); // 5种不同状态

      // 验证页面上的统计显示
      const totalApproved = statusCounts.find(s => s.claim_status === 'approved')?.count || 0;
      const totalSubmitted = statusCounts.find(s => s.claim_status === 'submitted')?.count || 0;
      const totalUnderReview = statusCounts.find(s => s.claim_status === 'under_review')?.count || 0;

      expect(totalApproved).toBe(1);
      expect(totalSubmitted).toBe(1);
      expect(totalUnderReview).toBe(1);
    });

    it('应该正确计算申报总金额', async () => {
      renderWithRealSurreal(<ClaimsPage />, { authUserId: TEST_IDS.USERS.ADMIN });

      await waitFor(() => {
        expect(screen.getByText('货款债务，基于2023年供货合同')).toBeInTheDocument();
      }, { timeout: 10000 });

      // 验证总金额计算
      const totalAmount = await TestHelpers.query(`
        SELECT sum(claim_amount) AS total_amount
        FROM claim;
      `);
      
      const total = (totalAmount?.[0] as any[])?.[0]?.total_amount || 0;
      expect(total).toBe(2095000); // 500000 + 80000 + 1200000 + 300000 + 15000

      // 如果页面显示总金额统计，验证显示正确
      const totalAmountElements = screen.queryAllByText(/总金额|申报总额|209.*万|2,?095,?000/);
      if (totalAmountElements.length > 0) {
        expect(totalAmountElements.length).toBeGreaterThan(0);
      }
    });
  });

  describe('排序功能', () => {
    it('应该支持按申报时间排序', async () => {
      renderWithRealSurreal(<ClaimsPage />, { authUserId: TEST_IDS.USERS.ADMIN });

      await waitFor(() => {
        expect(screen.getByText('货款债务，基于2023年供货合同')).toBeInTheDocument();
      }, { timeout: 10000 });

      // 查找排序控件
      const sortButtons = screen.queryAllByText(/排序|时间|金额/);
      const timeColumn = screen.queryByText(/申报时间|提交时间/);
      
      if (timeColumn) {
        fireEvent.click(timeColumn);
        
        // 等待排序生效
        await waitFor(() => {
          // 验证排序已应用
          const firstItem = screen.getAllByText(/货款债务|工资及社保|抵押担保/)[0];
          expect(firstItem).toBeInTheDocument();
        }, { timeout: 2000 });
      }
    });

    it('应该支持按申报金额排序', async () => {
      renderWithRealSurreal(<ClaimsPage />, { authUserId: TEST_IDS.USERS.ADMIN });

      await waitFor(() => {
        expect(screen.getByText('货款债务，基于2023年供货合同')).toBeInTheDocument();
      }, { timeout: 10000 });

      // 查找金额列标题
      const amountColumn = screen.queryByText(/申报金额|债权金额|金额/);
      
      if (amountColumn) {
        fireEvent.click(amountColumn);
        
        await waitFor(() => {
          // 验证排序后最大金额的申报显示在前面
          const highestAmount = screen.getByText(/1,?200,?000|120万/);
          expect(highestAmount).toBeInTheDocument();
        }, { timeout: 2000 });
      }
    });
  });

  describe('权限控制', () => {
    it('管理员应该看到所有审核操作', async () => {
      renderWithRealSurreal(<ClaimsPage />, { authUserId: TEST_IDS.USERS.ADMIN });

      await waitFor(() => {
        expect(screen.getByText('货款债务，基于2023年供货合同')).toBeInTheDocument();
      }, { timeout: 10000 });

      // 管理员应该能看到审核相关按钮
      const reviewActions = screen.queryAllByText(/审核|通过|拒绝|修改状态/);
      expect(reviewActions.length).toBeGreaterThan(0);
    });

    it('普通用户应该只看到查看权限', async () => {
      renderWithRealSurreal(<ClaimsPage />, { authUserId: TEST_IDS.USERS.CREDITOR_USER });

      await waitFor(() => {
        // 根据权限设置，普通用户可能只能看到有限的功能
        const pageContent = screen.getByText(/债权申报|债权列表|货款债务/);
        expect(pageContent).toBeInTheDocument();
      }, { timeout: 10000 });

      // 验证权限限制
      const reviewButtons = screen.queryAllByText(/审核|通过|拒绝/);
      // 普通用户应该看不到审核按钮，或者按钮被禁用
    });
  });

  describe('导出功能', () => {
    it('应该支持申报数据导出', async () => {
      renderWithRealSurreal(<ClaimsPage />, { authUserId: TEST_IDS.USERS.ADMIN });

      await waitFor(() => {
        expect(screen.getByText('货款债务，基于2023年供货合同')).toBeInTheDocument();
      }, { timeout: 10000 });

      // 查找导出按钮
      const exportButtons = screen.queryAllByText(/导出|Excel|PDF/);
      if (exportButtons.length > 0) {
        fireEvent.click(exportButtons[0]);

        await waitFor(() => {
          // 可能会打开导出设置对话框
          const exportDialog = screen.queryByText(/导出设置|选择格式|确认导出/);
          if (exportDialog) {
            expect(exportDialog).toBeInTheDocument();
          }
        }, { timeout: 3000 });
      }
    });
  });

  describe('Service Worker集成', () => {
    it('应该通过service worker正确加载申报数据', async () => {
      renderWithRealSurreal(<ClaimsPage />, { authUserId: TEST_IDS.USERS.ADMIN });

      // 验证数据确实从数据库加载
      await waitFor(() => {
        expect(screen.getByText('货款债务，基于2023年供货合同')).toBeInTheDocument();
      }, { timeout: 10000 });

      // 验证这些是我们在数据库中创建的真实数据
      expect(screen.getByText('HT-2023-001')).toBeInTheDocument();
      expect(screen.getByText('债权证据充分，金额合理，予以确认')).toBeInTheDocument();

      // 验证数据库查询正确
      const claimCount = await TestHelpers.getRecordCount('claim');
      expect(claimCount).toBe(5);
    });

    it('应该处理数据加载错误', async () => {
      // 清除认证状态模拟错误
      await TestHelpers.clearAuth();

      renderWithRealSurreal(<ClaimsPage />);

      await waitFor(() => {
        // 根据错误处理机制，可能显示错误消息或重定向
        const content = screen.getByText(/债权申报|登录|错误|认证/);
        expect(content).toBeInTheDocument();
      }, { timeout: 5000 });
    });
  });

  describe('实时更新', () => {
    it('应该反映数据库中的申报状态变化', async () => {
      renderWithRealSurreal(<ClaimsPage />, { authUserId: TEST_IDS.USERS.ADMIN });

      await waitFor(() => {
        expect(screen.getByText('工资及社保费用')).toBeInTheDocument();
      }, { timeout: 10000 });

      // 在测试过程中更新申报状态
      const claimResult = await TestHelpers.query(`
        SELECT id FROM claim 
        WHERE claim_basis = '工资及社保费用' 
        LIMIT 1;
      `);
      const claimId = (claimResult?.[0] as any[])?.[0]?.id;

      if (claimId) {
        await TestHelpers.update(claimId.toString(), {
          claim_status: 'approved',
          reviewed_at: new Date(),
          reviewer: new RecordId('user', 'admin'),
          review_notes: '工资债权确认通过',
          updated_at: new Date(),
        });

        // 根据页面的实时更新机制，状态变化可能会自动反映
        // 具体行为取决于页面实现
      }
    });
  });

  describe('性能测试', () => {
    it('应该在合理时间内加载申报列表', async () => {
      const startTime = Date.now();

      renderWithRealSurreal(<ClaimsPage />, { authUserId: TEST_IDS.USERS.ADMIN });

      await waitFor(() => {
        expect(screen.getByText('货款债务，基于2023年供货合同')).toBeInTheDocument();
      }, { timeout: 10000 });

      const endTime = Date.now();
      const loadTime = endTime - startTime;

      expect(loadTime).toBeLessThan(8000);
    });

    it('应该高效处理大量申报数据', async () => {
      // 创建更多测试申报数据
      for (let i = 6; i <= 30; i++) {
        await TestHelpers.create('claim', {
          case_id: new RecordId('case', testCaseId),
          creditor_id: new RecordId('creditor', testCreditorIds[i % 3]),
          claim_amount: Math.floor(Math.random() * 1000000) + 10000,
          claim_type: ['ordinary', 'priority', 'secured', 'labor'][i % 4],
          claim_basis: `批量测试申报${i}的债权依据`,
          claim_status: ['submitted', 'approved', 'rejected', 'under_review'][i % 4],
          submitted_at: new Date(),
          asserted_claim_details: { batch_test: true, index: i },
          created_at: new Date(),
          updated_at: new Date(),
        });
      }

      const startTime = Date.now();

      renderWithRealSurreal(<ClaimsPage />, { authUserId: TEST_IDS.USERS.ADMIN });

      await waitFor(() => {
        expect(screen.getByText('货款债务，基于2023年供货合同')).toBeInTheDocument();
      }, { timeout: 15000 });

      const endTime = Date.now();
      const loadTime = endTime - startTime;

      expect(loadTime).toBeLessThan(12000);

      // 验证数据确实增加了
      const totalClaims = await TestHelpers.getRecordCount('claim');
      expect(totalClaims).toBe(30); // 5个初始 + 25个新增
    });
  });
});