import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { SnackbarProvider } from '@/src/contexts/SnackbarContext';
import MyClaimsPage from '@/src/pages/my-claims/index';
import { Context as SurrealContext } from '@/src/contexts/SurrealProvider';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import type Surreal from 'surrealdb';

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock useSnackbar
const mockShowSuccess = vi.fn();
const mockShowError = vi.fn();
const mockShowWarning = vi.fn();
const mockShowInfo = vi.fn();
vi.mock('@/src/contexts/SnackbarContext', async () => {
  const actual = await vi.importActual('@/src/contexts/SnackbarContext');
  return {
    ...actual,
    useSnackbar: () => ({
      showSuccess: mockShowSuccess,
      showError: mockShowError,
      showWarning: mockShowWarning,
      showInfo: mockShowInfo,
    }),
  };
});

// Mock i18n translation
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: { [key: string]: string } = {
        my_claims: '我的债权申报',
        submit_new_claim: '发起新的债权申报',
        view_details: '查看详情',
        edit: '编辑',
        withdraw: '撤回',
        error_loading_claims: '加载债权列表失败',
        loading_claims: '正在加载债权列表...',
        claim_id: '债权编号',
        claim_amount: '申报金额',
        claim_status: '申报状态',
        actions: '操作',
        no_claims: '暂无债权申报记录'
      };
      return translations[key] || key;
    },
    i18n: {
      changeLanguage: vi.fn(),
    },
  }),
  I18nextProvider: ({ children }: { children: React.ReactNode }) => children,
}));

const theme = createTheme();

// Mock claims data
const mockClaimsData = [
  { id: 'CLAIM-001', submissionDate: '2023-10-26', claimNature: '普通债权', totalAmount: 15000, currency: 'CNY', reviewStatus: '待审核', reviewOpinion: '' },
  { id: 'CLAIM-002', submissionDate: '2023-10-20', claimNature: '有财产担保债权', totalAmount: 125000, currency: 'CNY', reviewStatus: '审核通过', reviewOpinion: '符合要求' },
  { id: 'CLAIM-003', submissionDate: '2023-09-15', claimNature: '劳动报酬', totalAmount: 8000, currency: 'CNY', reviewStatus: '已驳回', reviewOpinion: '材料不足，请补充合同和工资流水。' },
  { id: 'CLAIM-004', submissionDate: '2023-11-01', claimNature: '普通债权', totalAmount: 22000, currency: 'USD', reviewStatus: '需要补充', reviewOpinion: '请提供债权发生时间的证明。' },
];

// Mock SurrealDB context
let mockSurrealContextValue: SurrealContextType;

// Helper function to render component with providers
const renderMyClaimsPage = () => {
  return render(
    <ThemeProvider theme={theme}>
      <BrowserRouter>
        <SurrealContext.Provider value={mockSurrealContextValue}>
          <SnackbarProvider>
            <MyClaimsPage />
          </SnackbarProvider>
        </SurrealContext.Provider>
      </BrowserRouter>
    </ThemeProvider>
  );
};

interface SurrealContextType {
  surreal: Surreal;
  isConnecting: boolean;
  isSuccess: boolean;
  isError: boolean;
  error: Error | null;
  connect: () => Promise<boolean>;
  disconnect: () => Promise<void>;
  signin: (auth: unknown) => Promise<any>;
  signout: () => Promise<void>;
  setTokens: (accessToken: string, refreshToken?: string, expiresIn?: number) => any;
  clearTokens: () => any;
  getStoredAccessToken: () => string | null;
  setTenantCode: (tenantCode: string) => Promise<void>;
  getTenantCode: () => Promise<string | null>;
}

describe('MyClaimsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();      mockSurrealContextValue = {
      surreal: {
        query: vi.fn().mockResolvedValue([[mockClaimsData]]), // 使用双层数组，符合 SurrealDB 返回格式
        select: vi.fn().mockResolvedValue([]), // Add mock for select
        create: vi.fn().mockResolvedValue({}),  // Add mock for create
        update: vi.fn().mockResolvedValue({}),  // Add mock for update
        merge: vi.fn().mockResolvedValue([{}]),   // Add mock for merge，返回数组包装的结果
        delete: vi.fn().mockResolvedValue({}),  // Add mock for delete
        live: vi.fn(),   // Mock other methods if potentially called
        kill: vi.fn(),
        let: vi.fn(),
        unset: vi.fn(),
        signup: vi.fn().mockResolvedValue({}),
        signin: vi.fn().mockResolvedValue({}),
        invalidate: vi.fn().mockResolvedValue(undefined),
        authenticate: vi.fn().mockResolvedValue(''),
        sync: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
      } as unknown as Surreal,
      isConnecting: false,
      isSuccess: true,
      isError: false,
      error: null,
      connect: vi.fn().mockResolvedValue(true),
      disconnect: vi.fn().mockResolvedValue(undefined),
      signin: vi.fn().mockResolvedValue({}),
      signout: vi.fn().mockResolvedValue(undefined),
      setTokens: vi.fn(),
      clearTokens: vi.fn(),
      getStoredAccessToken: vi.fn().mockReturnValue(null),
      setTenantCode: vi.fn().mockResolvedValue(undefined),
      getTenantCode: vi.fn().mockResolvedValue(null),
    };
  });

  describe('Page Rendering', () => {
    it('renders the page title', () => {
      renderMyClaimsPage();
      expect(screen.getByText('我的债权申报')).toBeInTheDocument();
    });

    it('shows loading state while fetching data', async () => {
      // 延迟数据加载响应
      const loadingPromise = new Promise(resolve => setTimeout(() => resolve([[mockClaimsData]]), 100));
      (mockSurrealContextValue.surreal.query as Mock).mockImplementationOnce(() => loadingPromise);
      
      renderMyClaimsPage();
      
      // 验证加载状态显示
      expect(screen.getByText('正在加载债权列表...')).toBeInTheDocument();
      
      // 等待数据加载完成
      await waitFor(() => {
        expect(mockClaimsData.some(claim => 
          screen.getByText(claim.id)
        )).toBeTruthy();
      }, { timeout: 2000 });
      
      // 验证加载状态消失
      expect(screen.queryByText('正在加载债权列表...')).not.toBeInTheDocument();
    });

    it('shows error message when data fetching fails', async () => {
      (mockSurrealContextValue.surreal.query as Mock).mockRejectedValueOnce(new Error('Failed to load claims'));
      renderMyClaimsPage();
      
      await waitFor(() => {
        expect(mockShowError).toHaveBeenCalledWith('加载债权列表失败');
      }, { timeout: 2000 });
    });

    it('shows empty state when no claims exist', async () => {
      // 正确模拟 SurrealDB 返回空数据的格式：[[]]
      (mockSurrealContextValue.surreal.query as Mock).mockResolvedValueOnce([[]]); 
      renderMyClaimsPage();
      
      await waitFor(() => {
        expect(screen.getByText('暂无债权申报记录')).toBeInTheDocument();
      }, { timeout: 2000 }); // 添加合理的超时时间
    });

    it('renders all claims in the table', async () => {
      renderMyClaimsPage();
      
      await waitFor(() => {
        // 先等待第一个元素出现，确保表格已加载
        expect(screen.getByText(mockClaimsData[0].id)).toBeInTheDocument();
      }, { timeout: 2000 });

      // 然后检查所有数据
      mockClaimsData.forEach(claim => {
        // 使用表格行作为范围来查找内容
        const row = screen.getByText(claim.id).closest('tr');
        expect(row).toBeInTheDocument();
        
        // 在特定行内查找内容
        expect(within(row!).getByText(claim.reviewStatus)).toBeInTheDocument();
        expect(within(row!).getByText(claim.claimNature)).toBeInTheDocument();
      });
    });
  });

  describe('Button States', () => {
    it('disables withdraw button for claims not in pending review', async () => {
      renderMyClaimsPage();
      
      await waitFor(() => {
        const rowForClaim002 = screen.getByText('CLAIM-002').closest('tr');
        expect(rowForClaim002).toBeInTheDocument();
        const withdrawButton = within(rowForClaim002!).getByTestId('withdraw-button');
        expect(withdrawButton).toBeDisabled();
      }, { timeout: 2000 });
    });

    it('enables withdraw button for claims in pending review', async () => {
      renderMyClaimsPage();
      
      await waitFor(() => {
        const rowForClaim001 = screen.getByText('CLAIM-001').closest('tr');
        expect(rowForClaim001).toBeInTheDocument();
        const withdrawButton = within(rowForClaim001!).getByTestId('withdraw-button');
        expect(withdrawButton).not.toBeDisabled();
      }, { timeout: 2000 });
    });

    it('disables edit button for claims not in rejected or supplement status', async () => {
      renderMyClaimsPage();
      
      // 首先等待数据加载完成
      await waitFor(() => {
        expect(screen.getByText('CLAIM-001')).toBeInTheDocument();
        expect(screen.getByText('CLAIM-002')).toBeInTheDocument();
      }, { timeout: 2000 });
      
      // 然后检查每个按钮的状态
      const rows = ['CLAIM-001', 'CLAIM-002'].map(id => {
        const row = screen.getByText(id).closest('tr');
        expect(row).toBeInTheDocument();
        return row!;
      });
      
      rows.forEach(row => {
        const editButton = within(row).getByTestId('edit-button');
        expect(editButton).toBeDisabled();
      });
    });

    it('enables edit button for claims in rejected or supplement status', async () => {
      renderMyClaimsPage();
      
      // 首先等待数据加载完成
      await waitFor(() => {
        expect(screen.getByText('CLAIM-003')).toBeInTheDocument();
        expect(screen.getByText('CLAIM-004')).toBeInTheDocument();
      }, { timeout: 2000 });
      
      // 然后检查每个编辑按钮的状态
      const rows = ['CLAIM-003', 'CLAIM-004'].map(id => {
        const row = screen.getByText(id).closest('tr');
        expect(row).toBeInTheDocument();
        return row!;
      });
      
      rows.forEach(row => {
        const editButton = within(row).getByTestId('edit-button');
        expect(editButton).not.toBeDisabled();
      });
    });
  });

  describe('Navigation', () => {
    it('navigates to claim details page on view details click', async () => {
      renderMyClaimsPage();
      
      // 等待行渲染完成
      await waitFor(() => {
        expect(screen.getByText('CLAIM-001')).toBeInTheDocument();
      }, { timeout: 2000 });

      // 找到并点击查看详情按钮
      const rowForClaim001 = screen.getByText('CLAIM-001').closest('tr');
      expect(rowForClaim001).toBeInTheDocument();
      const viewDetailsButton = within(rowForClaim001!).getByTestId('view-details-button');
      fireEvent.click(viewDetailsButton);

      // 验证导航调用
      expect(mockNavigate).toHaveBeenCalledWith('/my-claims/CLAIM-001/submitted');
    });

    it('navigates to edit page for editable claims', async () => {
      renderMyClaimsPage();
      
      await waitFor(() => {
        expect(screen.getByText('CLAIM-003')).toBeInTheDocument();
      }, { timeout: 2000 });

      // 获取行和编辑按钮
      const rowForClaim003 = screen.getByText('CLAIM-003').closest('tr');
      expect(rowForClaim003).toBeInTheDocument();
      const editButton = within(rowForClaim003!).getByTestId('edit-button');

      // 触发点击并验证导航
      fireEvent.click(editButton);
      expect(mockNavigate).toHaveBeenCalledWith('/claims/submit/CLAIM-003');
    });

    it('navigates to new claim submission on button click', async () => {
      renderMyClaimsPage();
      
      // 等待数据加载和按钮可用
      await waitFor(() => {
        const newClaimButton = screen.getByRole('button', { name: '发起新的债权申报' });
        expect(newClaimButton).toBeInTheDocument();
        expect(newClaimButton).toBeEnabled();
      }, { timeout: 2000 });

      // 触发点击事件
      const newClaimButton = screen.getByRole('button', { name: '发起新的债权申报' });
      fireEvent.click(newClaimButton);

      // 验证导航
      expect(mockNavigate).toHaveBeenCalledWith('/claims/submit');
    });
  });

  describe('Claim Actions', () => {
    it('handles claim withdrawal successfully', async () => {
      // 正确模拟 SurrealDB 的查询返回格式
      (mockSurrealContextValue.surreal.query as Mock)
        .mockResolvedValueOnce([[mockClaimsData]])  // Initial load，使用双层数组
        .mockResolvedValueOnce([[{...mockClaimsData[0], reviewStatus: '已撤回'}]]); // After withdrawal，使用双层数组

      renderMyClaimsPage();
      
      await waitFor(() => {
        const rowForClaim001 = screen.getByText('CLAIM-001').closest('tr');
        expect(rowForClaim001).toBeInTheDocument();
        const withdrawButton = within(rowForClaim001!).getByTestId('withdraw-button');
        fireEvent.click(withdrawButton);
      });

      await waitFor(() => {
        expect(mockShowSuccess).toHaveBeenCalledWith('债权 CLAIM-001 已成功撤回 (模拟)。');
      }, { timeout: 2000 });
    });

    it('handles claim withdrawal error', async () => {
      (mockSurrealContextValue.surreal.merge as Mock).mockRejectedValueOnce(
        new Error('Failed to withdraw claim')
      );

      renderMyClaimsPage();
      
      await waitFor(() => {
        const rowForClaim001 = screen.getByText('CLAIM-001').closest('tr');
        expect(rowForClaim001).toBeInTheDocument();
        const withdrawButton = within(rowForClaim001!).getByTestId('withdraw-button');
        fireEvent.click(withdrawButton);
      }, { timeout: 2000 });

      await waitFor(() => {
        expect(mockShowError).toHaveBeenCalledWith(expect.stringContaining('撤回失败'));
      }, { timeout: 2000 });
    });

    it('prevents withdrawal of non-pending claims', async () => {
      renderMyClaimsPage();
      
      await waitFor(() => {
        const rowForClaim002 = screen.getByText('CLAIM-002').closest('tr');
        expect(rowForClaim002).toBeInTheDocument();
        const withdrawButton = within(rowForClaim002!).getByTestId('withdraw-button');
        expect(withdrawButton).toBeDisabled();
      }, { timeout: 2000 });
      
      // 获取按钮并尝试点击，即使被禁用
      const rowForClaim002 = screen.getByText('CLAIM-002').closest('tr');
      const withdrawButton = within(rowForClaim002!).getByTestId('withdraw-button');
      fireEvent.click(withdrawButton);
      
      // 验证禁用状态下的点击不会触发任何操作
      expect(mockSurrealContextValue.surreal.merge).not.toHaveBeenCalled();
      expect(mockShowSuccess).not.toHaveBeenCalled();
      expect(mockShowError).not.toHaveBeenCalled();
    });
  });
});
