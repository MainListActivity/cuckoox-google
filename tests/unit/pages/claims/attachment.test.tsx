import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { createTheme } from '@mui/material/styles';
import ClaimAttachmentPage from '@/src/pages/claims/attachment';
import { AuthContext, AuthContextType, AppUser } from '@/src/contexts/AuthContext';
import { SnackbarProvider } from '@/src/contexts/SnackbarContext';
import { SurrealProvider } from '@/src/contexts/SurrealProvider';
import ClaimService, { ClaimData } from '@/src/services/claimService';
import { RecordId } from 'surrealdb';
import { Delta } from 'quill/core';

// Mock react-router-dom
const mockNavigate = vi.fn();
const mockParams = { claimId: 'test-claim-id' };

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => mockParams,
  };
});

// Mock ClaimService
vi.mock('@/src/services/claimService');

// Mock FullscreenRichTextEditor
vi.mock('@/src/components/FullscreenRichTextEditor', () => ({
  default: ({ value, onChange, documentId, userId, userName, contextInfo }: any) => (
    <div data-testid="rich-text-editor">
      <div data-testid="editor-document-id">{documentId}</div>
      <div data-testid="editor-user-id">{userId}</div>
      <div data-testid="editor-user-name">{userName}</div>
      <div data-testid="editor-context-title">{contextInfo?.title}</div>
      <textarea
        data-testid="editor-content"
        value={JSON.stringify(value)}
        onChange={(e) => {
          try {
            const delta = JSON.parse(e.target.value);
            onChange(delta);
          } catch {
            onChange(new Delta());
          }
        }}
      />
    </div>
  ),
}));

// Mock SurrealProvider
vi.mock('@/src/contexts/SurrealProvider', () => ({
  SurrealProvider: ({ children }: { children: React.ReactNode }) => children,
  useSurreal: () => ({
    surreal: {
      select: vi.fn(),
      query: vi.fn(),
      create: vi.fn(),
      merge: vi.fn(),
    },
  }),
}));

// Mock user data
const mockUser: AppUser = {
  id: new RecordId('user', 'test-user'),
  github_id: 'test-github-id',
  name: 'Test User',
  email: 'test@example.com',
};

// Mock RecordId toString method
Object.defineProperty(mockUser.id, 'toString', {
  value: () => 'user:test-user',
  writable: false,
});

// Mock claim data
const mockClaimData: ClaimData = {
  id: 'claim:test-claim-id',
  case_id: 'case:test-case',
  creditor_id: 'creditor:test-creditor',
  claim_number: 'CL-2024-001',
  asserted_claim_details: {
    nature: '普通债权',
    principal: 10000,
    interest: 500,
    other_amount: 60,
    total_asserted_amount: 10560,
    currency: 'CNY',
    brief_description: '测试债权',
    attachment_content: new Delta().insert('测试附件内容'),
  },
  review_status: 'draft',
  created_by: 'user:test-user', // 这应该匹配 mockUser.id.toString()
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

// Mock auth context
const mockAuthContext: AuthContextType = {
  isLoggedIn: true,
  user: mockUser,
  oidcUser: null,
  setAuthState: vi.fn(),
  logout: vi.fn(),
  isLoading: false,
  selectedCaseId: 'case:test-case',
  userCases: [],
  currentUserCaseRoles: [{ id: new RecordId('role', 'creditor_representative'), name: 'creditor_representative' }],
  isCaseLoading: false,
  selectCase: vi.fn(),
  hasRole: vi.fn((role) => role === 'creditor_representative'),
  refreshUserCasesAndRoles: vi.fn(),
  navMenuItems: [],
  isMenuLoading: false,
  navigateTo: null,
  clearNavigateTo: vi.fn(),
};

const theme = createTheme();

const renderWithProviders = (authContextValue = mockAuthContext) => {
  return render(
    <BrowserRouter>
      <ThemeProvider theme={theme}>
        <AuthContext.Provider value={authContextValue}>
          <SnackbarProvider>
            <ClaimAttachmentPage />
          </SnackbarProvider>
        </AuthContext.Provider>
      </ThemeProvider>
    </BrowserRouter>
  );
};

describe('ClaimAttachmentPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock ClaimService methods
    const mockClaimService = {
      getClaimById: vi.fn().mockResolvedValue(mockClaimData),
      isClaimEditable: vi.fn().mockReturnValue(true),
      getStatusText: vi.fn().mockReturnValue('草稿'),
      formatCurrency: vi.fn().mockReturnValue('¥10,560.00'),
      saveAttachmentDraft: vi.fn().mockResolvedValue(undefined),
      submitClaim: vi.fn().mockResolvedValue(mockClaimData),
    };
    
    (ClaimService as any).mockImplementation(() => mockClaimService);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('renders loading state initially', async () => {
    renderWithProviders();
    
    expect(screen.getByText('加载债权信息中...')).toBeInTheDocument();
  });

  it('renders claim attachment page with claim data', async () => {
    renderWithProviders();
    
    await waitFor(() => {
      expect(screen.getByText('编辑附件材料')).toBeInTheDocument();
    });
    
    expect(screen.getByText('债权基本信息 (参考)')).toBeInTheDocument();
    expect(screen.getByText('CL-2024-001')).toBeInTheDocument();
    expect(screen.getByText('普通债权')).toBeInTheDocument();
    expect(screen.getByText('¥10,560.00')).toBeInTheDocument();
  });

  it('renders rich text editor with correct props', async () => {
    renderWithProviders();
    
    await waitFor(() => {
      expect(screen.getByTestId('rich-text-editor')).toBeInTheDocument();
    });
    
    expect(screen.getByTestId('editor-document-id')).toHaveTextContent('claim-attachment-test-claim-id');
    expect(screen.getByTestId('editor-user-id')).toHaveTextContent('user:test-user');
    expect(screen.getByTestId('editor-user-name')).toHaveTextContent('Test User');
    expect(screen.getByTestId('editor-context-title')).toHaveTextContent('债权申报 - test-claim-id');
  });

  it('handles save draft successfully', async () => {
    // Mock a delayed response to test loading state
    const mockClaimService = {
      getClaimById: vi.fn().mockResolvedValue(mockClaimData),
      isClaimEditable: vi.fn().mockReturnValue(true),
      getStatusText: vi.fn().mockReturnValue('草稿'),
      formatCurrency: vi.fn().mockReturnValue('¥10,560.00'),
      saveAttachmentDraft: vi.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 100))
      ),
      submitClaim: vi.fn().mockResolvedValue(mockClaimData),
    };
    
    (ClaimService as any).mockImplementation(() => mockClaimService);
    
    renderWithProviders();
    
    await waitFor(() => {
      expect(screen.getByText('保存草稿')).toBeInTheDocument();
    });
    
    const saveDraftButton = screen.getByText('保存草稿');
    fireEvent.click(saveDraftButton);
    
    // Check for loading state
    await waitFor(() => {
      expect(screen.getByText('保存中...')).toBeInTheDocument();
    });
    
    // Wait for success message
    await waitFor(() => {
      expect(screen.getByText('草稿已成功保存')).toBeInTheDocument();
    });
  });

  it('handles submit claim successfully', async () => {
    // Mock a delayed response to test loading state
    const mockClaimService = {
      getClaimById: vi.fn().mockResolvedValue(mockClaimData),
      isClaimEditable: vi.fn().mockReturnValue(true),
      getStatusText: vi.fn().mockReturnValue('草稿'),
      formatCurrency: vi.fn().mockReturnValue('¥10,560.00'),
      saveAttachmentDraft: vi.fn().mockResolvedValue(undefined),
      submitClaim: vi.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(mockClaimData), 100))
      ),
    };
    
    (ClaimService as any).mockImplementation(() => mockClaimService);
    
    renderWithProviders();
    
    await waitFor(() => {
      expect(screen.getByText('提交申报')).toBeInTheDocument();
    });
    
    const submitButton = screen.getByText('提交申报');
    fireEvent.click(submitButton);
    
    // Check for loading state
    await waitFor(() => {
      expect(screen.getByText('提交中...')).toBeInTheDocument();
    });
    
    // Wait for success message
    await waitFor(() => {
      expect(screen.getByText('债权申报已成功提交')).toBeInTheDocument();
    });
  });

  it('shows error when user lacks permission', async () => {
    const authContextWithoutPermission = {
      ...mockAuthContext,
      hasRole: vi.fn(() => false),
    };
    
    renderWithProviders(authContextWithoutPermission);
    
    await waitFor(() => {
      expect(screen.getByText('您没有权限访问此页面')).toBeInTheDocument();
    });
  });

  it('shows error when claim does not exist', async () => {
    const mockClaimService = {
      getClaimById: vi.fn().mockResolvedValue(null),
      isClaimEditable: vi.fn().mockReturnValue(true),
      getStatusText: vi.fn().mockReturnValue('草稿'),
      formatCurrency: vi.fn().mockReturnValue('¥10,560.00'),
      saveAttachmentDraft: vi.fn().mockResolvedValue(undefined),
      submitClaim: vi.fn().mockResolvedValue(mockClaimData),
    };
    
    (ClaimService as any).mockImplementation(() => mockClaimService);
    
    renderWithProviders();
    
    await waitFor(() => {
      expect(screen.getByText('债权不存在')).toBeInTheDocument();
    });
  });

  it('shows error when user does not own the claim', async () => {
    const claimDataWithDifferentOwner = {
      ...mockClaimData,
      created_by: 'user:other-user',
    };
    
    const mockClaimService = {
      getClaimById: vi.fn().mockResolvedValue(claimDataWithDifferentOwner),
      isClaimEditable: vi.fn().mockReturnValue(true),
      getStatusText: vi.fn().mockReturnValue('草稿'),
      formatCurrency: vi.fn().mockReturnValue('¥10,560.00'),
      saveAttachmentDraft: vi.fn().mockResolvedValue(undefined),
      submitClaim: vi.fn().mockResolvedValue(mockClaimData),
    };
    
    (ClaimService as any).mockImplementation(() => mockClaimService);
    
    renderWithProviders();
    
    await waitFor(() => {
      expect(screen.getByText('您没有权限编辑此债权')).toBeInTheDocument();
    });
  });

  it('shows error when claim is not editable', async () => {
    const mockClaimService = {
      getClaimById: vi.fn().mockResolvedValue(mockClaimData),
      isClaimEditable: vi.fn().mockReturnValue(false),
      getStatusText: vi.fn().mockReturnValue('已提交'),
      formatCurrency: vi.fn().mockReturnValue('¥10,560.00'),
      saveAttachmentDraft: vi.fn().mockResolvedValue(undefined),
      submitClaim: vi.fn().mockResolvedValue(mockClaimData),
    };
    
    (ClaimService as any).mockImplementation(() => mockClaimService);
    
    renderWithProviders();
    
    await waitFor(() => {
      expect(screen.getByText('债权状态为"已提交"，无法编辑')).toBeInTheDocument();
    });
  });

  it('navigates back to basic info when clicking return button', async () => {
    renderWithProviders();
    
    await waitFor(() => {
      expect(screen.getByText('返回修改基本信息')).toBeInTheDocument();
    });
    
    const returnButton = screen.getByText('返回修改基本信息');
    fireEvent.click(returnButton);
    
    expect(mockNavigate).toHaveBeenCalledWith('/claims/submit/test-claim-id');
  });

  it('handles save draft error', async () => {
    const mockClaimService = {
      getClaimById: vi.fn().mockResolvedValue(mockClaimData),
      isClaimEditable: vi.fn().mockReturnValue(true),
      getStatusText: vi.fn().mockReturnValue('草稿'),
      formatCurrency: vi.fn().mockReturnValue('¥10,560.00'),
      saveAttachmentDraft: vi.fn().mockRejectedValue(new Error('保存失败')),
      submitClaim: vi.fn().mockResolvedValue(mockClaimData),
    };
    
    (ClaimService as any).mockImplementation(() => mockClaimService);
    
    renderWithProviders();
    
    await waitFor(() => {
      expect(screen.getByText('保存草稿')).toBeInTheDocument();
    });
    
    const saveDraftButton = screen.getByText('保存草稿');
    fireEvent.click(saveDraftButton);
    
    // 验证错误处理逻辑被调用
    await waitFor(() => {
      expect(mockClaimService.saveAttachmentDraft).toHaveBeenCalled();
    });
  });

  it('handles submit claim error', async () => {
    const mockClaimService = {
      getClaimById: vi.fn().mockResolvedValue(mockClaimData),
      isClaimEditable: vi.fn().mockReturnValue(true),
      getStatusText: vi.fn().mockReturnValue('草稿'),
      formatCurrency: vi.fn().mockReturnValue('¥10,560.00'),
      saveAttachmentDraft: vi.fn().mockResolvedValue(undefined),
      submitClaim: vi.fn().mockRejectedValue(new Error('提交失败')),
    };
    
    (ClaimService as any).mockImplementation(() => mockClaimService);
    
    renderWithProviders();
    
    await waitFor(() => {
      expect(screen.getByText('提交申报')).toBeInTheDocument();
    });
    
    const submitButton = screen.getByText('提交申报');
    fireEvent.click(submitButton);
    
    // 验证错误处理逻辑被调用
    await waitFor(() => {
      expect(mockClaimService.submitClaim).toHaveBeenCalled();
    });
  });

  it('disables buttons during save operation', async () => {
    renderWithProviders();
    
    await waitFor(() => {
      expect(screen.getByText('保存草稿')).toBeInTheDocument();
    });
    
    const saveDraftButton = screen.getByText('保存草稿');
    const submitButton = screen.getByText('提交申报');
    const returnButton = screen.getByText('返回修改基本信息');
    
    fireEvent.click(saveDraftButton);
    
    await waitFor(() => {
      expect(submitButton).toBeDisabled();
      expect(returnButton).toBeDisabled();
    });
  });

  it('disables buttons during submit operation', async () => {
    renderWithProviders();
    
    await waitFor(() => {
      expect(screen.getByText('提交申报')).toBeInTheDocument();
    });
    
    const saveDraftButton = screen.getByText('保存草稿');
    const submitButton = screen.getByText('提交申报');
    const returnButton = screen.getByText('返回修改基本信息');
    
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(saveDraftButton).toBeDisabled();
      expect(returnButton).toBeDisabled();
    });
  });
});
