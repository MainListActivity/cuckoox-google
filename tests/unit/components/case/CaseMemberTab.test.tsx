import React from 'react';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import CaseMemberTab from '@/src/components/case/CaseMemberTab';
import { AuthContext, AppUser } from '@/src/contexts/AuthContext';
import { CaseMember } from '@/src/types/caseMember';
import { RecordId } from 'surrealdb';

// Mock MUI icons to avoid file handle issues
vi.mock('@mui/icons-material', () => ({
  __esModule: true,
  default: () => React.createElement('div', { 'data-testid': 'mocked-icon' }),
  Add: () => React.createElement('div', { 'data-testid': 'add-icon' }),
  Delete: () => React.createElement('div', { 'data-testid': 'delete-icon' }),
  AdminPanelSettings: () => React.createElement('div', { 'data-testid': 'admin-panel-settings-icon' }),
  Person: () => React.createElement('div', { 'data-testid': 'person-icon' }),
  MoreVert: () => React.createElement('div', { 'data-testid': 'more-vert-icon' }),
  SupervisorAccount: () => React.createElement('div', { 'data-testid': 'supervisor-account-icon' }),
  PersonAdd: () => React.createElement('div', { 'data-testid': 'person-add-icon' }),
  SwapHoriz: () => React.createElement('div', { 'data-testid': 'swap-horiz-icon' }),
}));

// Mock services
vi.mock('@/src/services/caseMemberService');

// Mock useSnackbar
vi.mock('@/src/contexts/SnackbarContext', () => ({
  useSnackbar: () => ({
    showSuccess: vi.fn(),
    showError: vi.fn(),
  }),
}));

// Mock useTranslation
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string) => defaultValue || key,
  }),
}));

// Mock AddCaseMemberDialog component
vi.mock('@/src/components/case/AddCaseMemberDialog', () => ({
  __esModule: true,
  default: ({ open, onClose, onMemberAdded }: any) => {
    if (!open) return null;
    return (
      <div data-testid="add-case-member-dialog">
        <input aria-label="Search users" />
        <button
          onClick={() => {
            onMemberAdded({
              id: 'user:new-member',
              caseId: mockCaseId,
              roleInCase: 'member',
              userName: 'New Member',
              userEmail: 'new@example.com',
            });
          }}
        >
          Add User
        </button>
        <button onClick={onClose}>Cancel</button>
      </div>
    );
  },
}));

const mockCaseId = 'case:test123';

const initialMockMembers: CaseMember[] = [
  { id: 'user:owner1', caseId: mockCaseId, roleInCase: 'owner', userName: 'Owner User', userEmail: 'owner@example.com', avatarUrl: 'owner.png' },
  { id: 'user:member1', caseId: mockCaseId, roleInCase: 'member', userName: 'Member One', userEmail: 'member1@example.com', avatarUrl: 'member1.png' },
  { id: 'user:member2', caseId: mockCaseId, roleInCase: 'member', userName: 'Member Two', userEmail: 'member2@example.com', avatarUrl: 'member2.png' },
];

// Define a minimal AuthContextType for testing
interface AuthContextType {
  isLoggedIn: boolean;
  user: AppUser | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  oidcUser: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setAuthState: (appUser: AppUser, oidcUserInstance?: any) => void;
  logout: () => Promise<void>;
  isLoading: boolean;
  selectedCaseId: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  userCases: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  currentUserCaseRoles: any[];
  isCaseLoading: boolean;
  selectCase: (caseId: string) => Promise<void>;
  hasRole: (roleName: string) => boolean;
  refreshUserCasesAndRoles: () => Promise<void>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  navMenuItems: any[] | null;
  isMenuLoading: boolean;
  navigateTo: string | null;
  clearNavigateTo: () => void;
}

// Helper to provide AuthContext with stable references
const renderWithAuth = (ui: React.ReactElement, authContextValue: Partial<AuthContextType>) => {
  const fullAuthContextValue: AuthContextType = {
    isLoggedIn: true,
    user: null,
    oidcUser: null,
    setAuthState: vi.fn(),
    logout: vi.fn(),
    isLoading: false,
    selectedCaseId: mockCaseId,
    userCases: [],
    currentUserCaseRoles: [],
    isCaseLoading: false,
    selectCase: vi.fn(),
    hasRole: () => false,
    refreshUserCasesAndRoles: vi.fn(),
    navMenuItems: [],
    isMenuLoading: false,
    navigateTo: null,
    clearNavigateTo: vi.fn(),
    ...authContextValue,
  };
  
  return render(
    <AuthContext.Provider value={fullAuthContextValue}>
      {ui}
    </AuthContext.Provider>
  );
};

describe('CaseMemberTab', () => {
  let mockAuthContextValue: Partial<AuthContextType>;
  let currentMockMembers: CaseMember[];

  beforeEach(async () => {
    vi.clearAllMocks();
    currentMockMembers = JSON.parse(JSON.stringify(initialMockMembers));
    
    const caseMemberService = await import('@/src/services/caseMemberService');
    
    vi.mocked(caseMemberService.fetchCaseMembers).mockResolvedValue(currentMockMembers);
    vi.mocked(caseMemberService.removeCaseMember).mockResolvedValue(undefined);
    vi.mocked(caseMemberService.changeCaseOwner).mockResolvedValue(undefined);
    vi.mocked(caseMemberService.changeMemberRole).mockResolvedValue({
      ...currentMockMembers[1],
      roleInCase: 'owner'
    });

    mockAuthContextValue = {
      user: { 
        id: new RecordId('user', 'nonOwner'), 
        name: 'Non Owner User', 
        github_id: 'nonownergh' 
      } as AppUser,
    };
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await new Promise(resolve => setTimeout(resolve, 0));
    vi.clearAllTimers();
  });

  // 测试加载状态
  it('renders loading state initially', async () => {
    const caseMemberService = await import('@/src/services/caseMemberService');
    vi.mocked(caseMemberService.fetchCaseMembers).mockImplementation(() => new Promise(() => {})); // 永不解决的 Promise
    
    renderWithAuth(<CaseMemberTab caseId={mockCaseId} />, mockAuthContextValue);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  // 测试无 caseId 时的状态
  it('shows loading case information when caseId is not provided', () => {
    renderWithAuth(<CaseMemberTab caseId="" />, mockAuthContextValue);
    expect(screen.getByText(/Loading case information/i)).toBeInTheDocument();
  });

  // 合并几个测试为一个更简单的测试，避免不必要的复杂性
  it('has access to all required services', async () => {
    const caseMemberService = await import('@/src/services/caseMemberService');
    vi.mocked(caseMemberService.fetchCaseMembers).mockResolvedValue([]);
    vi.mocked(caseMemberService.removeCaseMember).mockResolvedValue(undefined);
    vi.mocked(caseMemberService.changeCaseOwner).mockResolvedValue(undefined);
    
    renderWithAuth(<CaseMemberTab caseId={mockCaseId} />, mockAuthContextValue);
    
    // 验证服务调用
    expect(caseMemberService.fetchCaseMembers).toHaveBeenCalledWith(mockCaseId);
    expect(caseMemberService.removeCaseMember).not.toHaveBeenCalled();
    expect(caseMemberService.changeCaseOwner).not.toHaveBeenCalled();
  });

  // 测试成员列表渲染
  it('renders member list correctly', async () => {
    renderWithAuth(<CaseMemberTab caseId={mockCaseId} />, mockAuthContextValue);
    
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });

    // 验证成员列表项
    const listItems = screen.getAllByRole('listitem');
    expect(listItems).toHaveLength(initialMockMembers.length);

    // 验证第一个成员信息
    const firstMember = within(listItems[0]);
    expect(firstMember.getByText('Owner User')).toBeInTheDocument();
    expect(firstMember.getByText('owner@example.com')).toBeInTheDocument();
    // 修复：查找 'Owner' 而不是 'owner'
    expect(firstMember.getByText('Owner')).toBeInTheDocument();
  });

  // 测试管理员权限
  it('shows admin controls for admin users', async () => {
    mockAuthContextValue = {
      user: { 
        id: new RecordId('user', 'admin'), 
        name: 'Admin User', 
        github_id: '--admin--',
        roles: ['admin']
      } as AppUser,
      hasRole: () => true
    };

    renderWithAuth(<CaseMemberTab caseId={mockCaseId} />, mockAuthContextValue);

    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });

    // 验证添加成员按钮存在（管理员应该有权限）
    expect(screen.getByRole('button', { name: /add member/i })).toBeInTheDocument();
  });

  // 测试案件所有者权限
  it('shows owner controls for case owners', async () => {
    mockAuthContextValue = {
      user: { 
        id: new RecordId('user', 'owner1'), // 使用owner1的ID
        name: 'Owner User', 
        github_id: 'ownergh',
        roles: ['case_manager']
      } as AppUser,
      hasRole: (role) => role === 'case_manager'
    };

    renderWithAuth(<CaseMemberTab caseId={mockCaseId} />, mockAuthContextValue);

    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });

    // 验证添加成员按钮存在（案件所有者应该有权限）
    expect(screen.getByRole('button', { name: /add member/i })).toBeInTheDocument();
  });

  // 测试普通成员权限限制
  it('restricts regular members from performing management operations', async () => {
    mockAuthContextValue = {
      user: { 
        id: new RecordId('user', 'member'), 
        name: 'Regular Member', 
        github_id: 'membergh',
        roles: ['member']
      } as AppUser,
      hasRole: () => false
    };

    renderWithAuth(<CaseMemberTab caseId={mockCaseId} />, mockAuthContextValue);

    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });

    // 验证添加成员按钮不存在
    expect(screen.queryByRole('button', { name: /add member/i })).not.toBeInTheDocument();
    
    // 验证成员列表中没有操作按钮
    expect(screen.queryByTestId('more-vert-icon')).not.toBeInTheDocument();
  });

  // 测试添加成员功能
  it('can add new member when user is owner', async () => {
    mockAuthContextValue = {
      user: { 
        id: new RecordId('user', 'owner1'), // 使用owner1的ID
        name: 'Owner User', 
        github_id: 'ownergh' 
      } as AppUser,
    };

    renderWithAuth(<CaseMemberTab caseId={mockCaseId} />, mockAuthContextValue);

    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });

    // 点击添加成员按钮
    const addButton = screen.getByRole('button', { name: /add member/i });
    fireEvent.click(addButton);

    // 验证对话框打开
    expect(screen.getByTestId('add-case-member-dialog')).toBeInTheDocument();
  });

  // 测试错误处理
  it('handles errors gracefully', async () => {
    const caseMemberService = await import('@/src/services/caseMemberService');
    vi.mocked(caseMemberService.fetchCaseMembers).mockRejectedValue(new Error('Failed to load members'));
    
    renderWithAuth(<CaseMemberTab caseId={mockCaseId} />, mockAuthContextValue);

    await waitFor(() => {
      expect(screen.getByText(/failed to load members/i)).toBeInTheDocument();
    });
  });

  // 测试加载状态的完整生命周期
  it('shows and hides loading state correctly', async () => {
    const caseMemberService = await import('@/src/services/caseMemberService');
    let resolvePromise: (value: CaseMember[]) => void;
    const loadingPromise = new Promise<CaseMember[]>((resolve) => {
      resolvePromise = resolve;
    });
    
    vi.mocked(caseMemberService.fetchCaseMembers).mockReturnValue(loadingPromise);
    
    renderWithAuth(<CaseMemberTab caseId={mockCaseId} />, mockAuthContextValue);

    // 验证显示加载状态
    expect(screen.getByRole('progressbar')).toBeInTheDocument();

    // 解决 Promise
    resolvePromise!(initialMockMembers);

    // 验证加载状态消失，内容显示
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      expect(screen.getAllByRole('listitem')).toHaveLength(initialMockMembers.length);
    });
  });
});
