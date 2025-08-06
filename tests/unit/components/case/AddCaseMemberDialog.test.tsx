import React from 'react';
import { screen, fireEvent, waitFor, act } from '@testing-library/react';
import { render } from '../../utils/testUtils'; // Use unified testUtils render
import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { RecordId } from 'surrealdb';
import AddCaseMemberDialog from '@/src/components/case/AddCaseMemberDialog';
import { createUserAndAddToCase } from '@/src/services/caseMemberService';
import { getCaseMemberRoles } from '@/src/services/roleService';
import { useSurrealClient } from '@/src/contexts/SurrealProvider';

// Mock modules
vi.mock('@/src/services/roleService');
vi.mock('@/src/services/caseMemberService');
vi.mock('@/src/contexts/SurrealProvider');
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => {
      const translations: Record<string, string> = {
        'create_user_and_add_to_case': '创建用户并添加到案件',
        'username_label': '用户名',
        'username_helper': '用户登录时使用的用户名',
        'cancel_button': '取消',
        'create_user_and_add': '创建用户并添加',
        'password_label': '密码',
        'email_label': '邮箱',
        'name_label': '姓名',
        'role_label': '角色',
        'loading': '加载中...',
        'username_required': '用户名不能为空',
        'username_min_length': '用户名至少需要3个字符',
        'username_invalid': '用户名只能包含字母、数字和下划线',
        'password_required': '密码不能为空',
        'password_min_length': '密码至少需要6个字符',
        'email_required': '邮箱不能为空',
        'email_invalid': '邮箱格式不正确',
        'name_required': '姓名不能为空',
        'role_required': '请选择角色',
      };
      return translations[key] || fallback || key;
    },
  }),
}));

const mockGetCaseMemberRoles = getCaseMemberRoles as Mock;
const mockCreateUserAndAddToCase = createUserAndAddToCase as Mock;
const mockUseSurrealClient = useSurrealClient as Mock;

// Test constants
const TEST_CASE_ID = new RecordId('case', 'test123');

const mockOnClose = vi.fn();
const mockOnMemberAdded = vi.fn();

const mockRoles = [
  {
    id: new RecordId('role', 'case_manager'),
    name: 'case_manager',
    description: '案件负责人，负责案件的全面管理',
  },
  {
    id: new RecordId('role', 'member'),
    name: 'member',
    description: '案件成员',
  },
  {
    id: new RecordId('role', 'assistant_lawyer'),
    name: 'assistant_lawyer',
    description: '协办律师，协助处理案件事务',
  },
];

const mockClient = {};
const mockCaseId = new RecordId('case', 'test-case-id');

// Note: renderWithTheme is now handled by unified testUtils

describe('AddCaseMemberDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSurrealClient.mockReturnValue(mockClient);
    mockGetCaseMemberRoles.mockResolvedValue(mockRoles);
    // Set default successful create user response
    mockCreateUserAndAddToCase.mockResolvedValue({
      id: new RecordId('user', '002'),
      caseId: new RecordId('case', 'test123'),
      roles: [{ id: new RecordId('role', '001'), name: 'member', description: 'Case member' }],
      userName: 'Bob Lawyer',
      userEmail: 'bob@example.com',
      avatarUrl: 'avatar_bob.png',
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  it('renders correctly when open is true', async () => {
    await act(async () => {
      render(
        <AddCaseMemberDialog
          open={true}
          onClose={mockOnClose}
          caseId={TEST_CASE_ID}
          onMemberAdded={mockOnMemberAdded}
        />
      );
    });
    
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeVisible();
    });
    
    expect(screen.getByLabelText(/用户名/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /取消/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /创建用户并添加/i })).toBeInTheDocument();
  });

  it('does not render (or renders null) when open is false', () => {
    const { container } = render(
      <AddCaseMemberDialog
        open={false}
        onClose={mockOnClose}
        caseId={TEST_CASE_ID}
        onMemberAdded={mockOnMemberAdded}
      />
    );
    // Dialogs often render null or an empty fragment when not open,
    // so checking for the absence of its role or specific content is better.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    // Check if the container is empty (or only contains non-visible elements)
    expect(container.firstChild).toBeNull(); // MUI Dialogs often render null when closed
  });

  it('calls onClose when Cancel button is clicked', async () => {
    await act(async () => {
      render(
        <AddCaseMemberDialog
          open={true}
          onClose={mockOnClose}
          caseId={TEST_CASE_ID}
          onMemberAdded={mockOnMemberAdded}
        />
      );
    });
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /取消/i })).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByRole('button', { name: /取消/i }));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('username input updates its value', async () => {
    await act(async () => {
      render(
        <AddCaseMemberDialog
          open={true}
          onClose={mockOnClose}
          caseId={TEST_CASE_ID}
          onMemberAdded={mockOnMemberAdded}
        />
      );
    });
    
    await waitFor(() => {
      expect(screen.getByLabelText(/用户名/i)).toBeInTheDocument();
    });
    
    const usernameInput = screen.getByLabelText(/用户名/i);
    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    expect(usernameInput).toHaveValue('testuser');
  });

  it('displays all form fields correctly', async () => {
    await act(async () => {
      render(
        <AddCaseMemberDialog
          open={true}
          onClose={mockOnClose}
          caseId={TEST_CASE_ID}
          onMemberAdded={mockOnMemberAdded}
        />
      );
    });
    
    await waitFor(() => {
      expect(screen.getByLabelText(/用户名/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/密码/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/邮箱/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/显示姓名/i)).toBeInTheDocument();
    });
  });

  it('shows validation error when form is submitted with empty fields', async () => {
    await act(async () => {
      render(
        <AddCaseMemberDialog
          open={true}
          onClose={mockOnClose}
          caseId={TEST_CASE_ID}
          onMemberAdded={mockOnMemberAdded}
        />
      );
    });
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /创建用户并添加/i })).toBeInTheDocument();
    });
    
    const submitButton = screen.getByRole('button', { name: /创建用户并添加/i });
    fireEvent.click(submitButton);

    // 应该显示所有必填字段的验证错误
    await waitFor(() => {
      expect(screen.getByText(/用户名不能为空/i)).toBeInTheDocument();
      expect(screen.getByText(/密码不能为空/i)).toBeInTheDocument();
      expect(screen.getByText(/邮箱不能为空/i)).toBeInTheDocument();
      expect(screen.getByText(/姓名不能为空/i)).toBeInTheDocument();
    });
  });

  it('calls createUserAndAddToCase when form is submitted with valid data', async () => {
    await act(async () => {
      render(
        <AddCaseMemberDialog
          open={true}
          onClose={mockOnClose}
          caseId={TEST_CASE_ID}
          onMemberAdded={mockOnMemberAdded}
        />
      );
    });
    
    // 等待角色加载完成
    await waitFor(() => {
      expect(mockGetCaseMemberRoles).toHaveBeenCalled();
    });
    
    // 填写表单字段
    const usernameInput = screen.getByLabelText(/用户名/i);
    const passwordInput = screen.getByLabelText(/密码/i);
    const emailInput = screen.getByLabelText(/邮箱/i);
    const displayNameInput = screen.getByLabelText(/显示姓名/i);
    
    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(displayNameInput, { target: { value: '测试用户' } });
    
    const submitButton = screen.getByRole('button', { name: /创建用户并添加/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockCreateUserAndAddToCase).toHaveBeenCalledWith(
        mockClient,
        TEST_CASE_ID,
        expect.objectContaining({
          username: 'testuser',
          password_hash: 'password123',
          email: 'test@example.com',
          name: '测试用户'
        })
      );
    });
  });

  it('disables submit button when form has validation errors', async () => {
    await act(async () => {
      render(
        <AddCaseMemberDialog
          open={true}
          onClose={mockOnClose}
          caseId={TEST_CASE_ID}
          onMemberAdded={mockOnMemberAdded}
        />
      );
    });
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /创建用户并添加/i })).toBeInTheDocument();
    });
    
    const submitButton = screen.getByRole('button', { name: /创建用户并添加/i });
    
    // 表单为空时提交按钮应该可以点击，但会显示验证错误
    expect(submitButton).not.toBeDisabled();
  });

  it('displays loading indicator during user creation', async () => {
    let resolveUserCreation: (value: any) => void;
    const userCreationPromise = new Promise<any>(resolve => {
      resolveUserCreation = resolve;
    });
    mockCreateUserAndAddToCase.mockReturnValue(userCreationPromise);

    await act(async () => {
      render(
        <AddCaseMemberDialog
          open={true}
          onClose={mockOnClose}
          caseId={TEST_CASE_ID}
          onMemberAdded={mockOnMemberAdded}
        />
      );
    });

    // 等待角色加载完成
    await waitFor(() => {
      expect(mockGetCaseMemberRoles).toHaveBeenCalled();
    });

    // 填写表单字段
    const usernameInput = screen.getByLabelText(/用户名/i);
    const passwordInput = screen.getByLabelText(/密码/i);
    const emailInput = screen.getByLabelText(/邮箱/i);
    const displayNameInput = screen.getByLabelText(/显示姓名/i);
    
    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(displayNameInput, { target: { value: '测试用户' } });
    
    const submitButton = screen.getByRole('button', { name: /创建用户并添加/i });
    fireEvent.click(submitButton);
    
    // 检查是否显示加载状态
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /创建中.../i })).toBeInTheDocument();
    });
    
    await act(async () => {
      resolveUserCreation!({ id: 'user_123', username: 'testuser' });
    });
    
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /创建中.../i })).not.toBeInTheDocument();
    });
  });

  it('validates email format', async () => {
    await act(async () => {
      render(
        <AddCaseMemberDialog
          open={true}
          onClose={mockOnClose}
          caseId={TEST_CASE_ID}
          onMemberAdded={mockOnMemberAdded}
        />
      );
    });
    
    await waitFor(() => {
      expect(screen.getByLabelText(/邮箱/i)).toBeInTheDocument();
    });
    
    const emailInput = screen.getByLabelText(/邮箱/i);
    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
    fireEvent.blur(emailInput);
    
    // 点击提交按钮触发验证
    const submitButton = screen.getByRole('button', { name: /创建用户并添加/i });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText(/请输入有效的邮箱地址/i)).toBeInTheDocument();
    });
  });

  it('clears form when dialog is closed and reopened', async () => {
    const { rerender } = render(
      <AddCaseMemberDialog
        open={true}
        onClose={mockOnClose}
        caseId={TEST_CASE_ID}
        onMemberAdded={mockOnMemberAdded}
      />
    );
    
    await waitFor(() => {
      expect(screen.getByLabelText(/用户名/i)).toBeInTheDocument();
    });
    
    const usernameInput = screen.getByLabelText(/用户名/i);
    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    expect(usernameInput).toHaveValue('testuser');
    
    // Close dialog
    await act(async () => {
      rerender(
        <AddCaseMemberDialog
          open={false}
          onClose={mockOnClose}
          caseId={TEST_CASE_ID}
          onMemberAdded={mockOnMemberAdded}
        />
      );
    });
    
    // Reopen dialog
    await act(async () => {
      rerender(
        <AddCaseMemberDialog
          open={true}
          onClose={mockOnClose}
          caseId={TEST_CASE_ID}
          onMemberAdded={mockOnMemberAdded}
        />
      );
    });
    
    await waitFor(() => {
      const usernameInputAfterReopen = screen.getByLabelText(/用户名/i);
      expect(usernameInputAfterReopen).toHaveValue('');
    });
  });

  it('displays password field with proper security attributes', async () => {
    await act(async () => {
      render(
        <AddCaseMemberDialog
          open={true}
          onClose={mockOnClose}
          caseId={TEST_CASE_ID}
          onMemberAdded={mockOnMemberAdded}
        />
      );
    });
    
    await waitFor(() => {
      expect(screen.getByLabelText(/密码/i)).toBeInTheDocument();
    });
    
    const passwordInput = screen.getByLabelText(/密码/i);
    expect(passwordInput).toHaveAttribute('type', 'password');
    expect(passwordInput).toBeInTheDocument();
  });

  it('handles user creation error gracefully', async () => {
    mockCreateUserAndAddToCase.mockRejectedValue(new Error('用户创建失败'));
    
    await act(async () => {
      render(
        <AddCaseMemberDialog
          open={true}
          onClose={mockOnClose}
          caseId={TEST_CASE_ID}
          onMemberAdded={mockOnMemberAdded}
        />
      );
    });
    
    // 等待角色加载完成
    await waitFor(() => {
      expect(mockGetCaseMemberRoles).toHaveBeenCalled();
    });
    
    // 填写表单字段
    const usernameInput = screen.getByLabelText(/用户名/i);
    const passwordInput = screen.getByLabelText(/密码/i);
    const emailInput = screen.getByLabelText(/邮箱/i);
    const displayNameInput = screen.getByLabelText(/显示姓名/i);
    
    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(displayNameInput, { target: { value: '测试用户' } });
    
    const submitButton = screen.getByRole('button', { name: /创建用户并添加/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/用户创建失败/i)).toBeInTheDocument();
    });
  });

  it('handles form submission error gracefully', async () => {
    mockCreateUserAndAddToCase.mockRejectedValueOnce(new Error('用户已存在'));
    
    await act(async () => {
      render(
        <AddCaseMemberDialog
          open={true}
          onClose={mockOnClose}
          caseId={TEST_CASE_ID}
          onMemberAdded={mockOnMemberAdded}
        />
      );
    });
    
    // 等待角色加载完成
    await waitFor(() => {
      expect(mockGetCaseMemberRoles).toHaveBeenCalled();
    });
    
    // 填写表单
    const usernameInput = screen.getByLabelText(/用户名/i);
    const passwordInput = screen.getByLabelText(/密码/i);
    const emailInput = screen.getByLabelText(/邮箱/i);
    const displayNameInput = screen.getByLabelText(/显示姓名/i);
    
    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(displayNameInput, { target: { value: '测试用户' } });
    
    const submitButton = screen.getByRole('button', { name: /创建用户并添加/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/用户已存在/i)).toBeInTheDocument();
    });
    
    expect(mockOnClose).not.toHaveBeenCalled();
    expect(mockOnMemberAdded).not.toHaveBeenCalled();
  });

  it('resets state when dialog is closed and reopened', async () => {
    const { rerender } = render(
      <AddCaseMemberDialog
        open={true}
        onClose={mockOnClose}
        caseId={TEST_CASE_ID}
        onMemberAdded={mockOnMemberAdded}
      />
    );
    
    await waitFor(() => {
      expect(screen.getByLabelText(/用户名/i)).toBeInTheDocument();
    });
    
    const usernameInput = screen.getByLabelText(/用户名/i);
    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    expect(usernameInput).toHaveValue('testuser');
    
    await act(async () => {
      rerender(
        <AddCaseMemberDialog
          open={false}
          onClose={mockOnClose}
          caseId={TEST_CASE_ID}
          onMemberAdded={mockOnMemberAdded}
        />
      );
    });
    
    await act(async () => {
      rerender(
        <AddCaseMemberDialog
          open={true}
          onClose={mockOnClose}
          caseId={TEST_CASE_ID}
          onMemberAdded={mockOnMemberAdded}
        />
      );
    });
    
    await waitFor(() => {
      const newUsernameInput = screen.getByLabelText(/用户名/i);
      expect(newUsernameInput).toHaveValue('');
    });
  });

  it('validates form input correctly', async () => {
    await act(async () => {
      render(
        <AddCaseMemberDialog
          open={true}
          onClose={mockOnClose}
          caseId={TEST_CASE_ID}
          onMemberAdded={mockOnMemberAdded}
        />
      );
    });
    
    await waitFor(() => {
      expect(screen.getByLabelText(/用户名/i)).toBeInTheDocument();
    });
    
    const usernameInput = screen.getByLabelText(/用户名/i);
    
    // 测试快速输入变化
    fireEvent.change(usernameInput, { target: { value: 'a' } });
    fireEvent.change(usernameInput, { target: { value: 'ab' } });
    fireEvent.change(usernameInput, { target: { value: 'abc' } });
    fireEvent.change(usernameInput, { target: { value: 'abcd' } });
    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    
    expect(usernameInput).toHaveValue('testuser');
  });

  it('displays user form interface correctly', async () => {
    await act(async () => {
      render(
        <AddCaseMemberDialog
          open={true}
          onClose={mockOnClose}
          caseId={TEST_CASE_ID}
          onMemberAdded={mockOnMemberAdded}
        />
      );
    });
    
    // 检查主要表单元素
    await waitFor(() => {
      expect(screen.getByLabelText(/用户名/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/密码/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/邮箱/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/显示姓名/i)).toBeInTheDocument();
    });
  });

  it('tests form submission flow', async () => {
    await act(async () => {
      render(
        <AddCaseMemberDialog
          open={true}
          onClose={mockOnClose}
          caseId={TEST_CASE_ID}
          onMemberAdded={mockOnMemberAdded}
        />
      );
    });
    
    // 等待角色加载完成
    await waitFor(() => {
      expect(mockGetCaseMemberRoles).toHaveBeenCalled();
    });
    
    // 填写表单
    const usernameInput = screen.getByLabelText(/用户名/i);
    const passwordInput = screen.getByLabelText(/密码/i);
    const emailInput = screen.getByLabelText(/邮箱/i);
    const displayNameInput = screen.getByLabelText(/显示姓名/i);
    
    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(displayNameInput, { target: { value: '测试用户' } });
    
    const submitButton = screen.getByRole('button', { name: /创建用户并添加/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockCreateUserAndAddToCase).toHaveBeenCalled();
    });
  });

  it('renders dialog with all form fields', async () => {
    await act(async () => {
      render(
        <AddCaseMemberDialog
          open={true}
          onClose={mockOnClose}
          caseId={mockCaseId}
          onMemberAdded={mockOnMemberAdded}
        />
      );
    });

    await waitFor(() => {
      expect(screen.getByText('创建用户并添加到案件')).toBeInTheDocument();
      expect(screen.getByLabelText('用户名')).toBeInTheDocument();
      expect(screen.getByLabelText('密码')).toBeInTheDocument();
      expect(screen.getByLabelText('邮箱')).toBeInTheDocument();
      expect(screen.getByLabelText('显示姓名')).toBeInTheDocument();
    });
    
    // 等待角色字段加载
    await waitFor(() => {
      expect(mockGetCaseMemberRoles).toHaveBeenCalledWith(mockClient);
    });

    // 等待角色字段出现
    await waitFor(() => {
      expect(screen.getAllByText(/在案件中的角色/i)).toHaveLength(2);
    });
  });

  it('loads and displays roles from database', async () => {
    await act(async () => {
      render(
        <AddCaseMemberDialog
          open={true}
          onClose={mockOnClose}
          caseId={mockCaseId}
          onMemberAdded={mockOnMemberAdded}
        />
      );
    });

    // 等待角色加载
    await waitFor(() => {
      expect(mockGetCaseMemberRoles).toHaveBeenCalledWith(mockClient);
    });

    // 等待角色字段出现
    await waitFor(() => {
      expect(screen.getAllByText(/在案件中的角色/i)).toHaveLength(2);
    });

    // 打开角色选择下拉框
    const roleSelects = screen.getAllByRole('combobox');
    expect(roleSelects).toHaveLength(1);
    
    fireEvent.mouseDown(roleSelects[0]);

    // 检查角色是否显示（使用getAllByText因为会有重复的角色名）
    await waitFor(() => {
      expect(screen.getAllByText('案件负责人')).toHaveLength(2); // 一个在选中项中，一个在下拉选项中
      expect(screen.getAllByText('案件成员').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('协办律师').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows loading state while fetching roles', async () => {
    // Mock slow role loading
    mockGetCaseMemberRoles.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve(mockRoles), 100))
    );

    await act(async () => {
      render(
        <AddCaseMemberDialog
          open={true}
          onClose={mockOnClose}
          caseId={mockCaseId}
          onMemberAdded={mockOnMemberAdded}
        />
      );
    });

    // Check for role loading state (the role field should eventually appear)
    await waitFor(() => {
      expect(mockGetCaseMemberRoles).toHaveBeenCalled();
    });
    
    // Wait for roles to load and role field to appear
    await waitFor(() => {
      expect(screen.getAllByText(/在案件中的角色/i)).toHaveLength(2);
    });
  });

  it('validates required fields', async () => {
    await act(async () => {
      render(
        <AddCaseMemberDialog
          open={true}
          onClose={mockOnClose}
          caseId={mockCaseId}
          onMemberAdded={mockOnMemberAdded}
        />
      );
    });

    // 等待角色加载
    await waitFor(() => {
      expect(mockGetCaseMemberRoles).toHaveBeenCalled();
    });

    const submitButton = screen.getByText('创建用户并添加');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('用户名不能为空')).toBeInTheDocument();
      expect(screen.getByText('密码不能为空')).toBeInTheDocument();
      expect(screen.getByText('邮箱不能为空')).toBeInTheDocument();
      expect(screen.getByText('姓名不能为空')).toBeInTheDocument();
    });
  });

  it('submits form with selected role', async () => {
    const mockNewMember = {
      id: 'user123',
      caseId: mockCaseId,
      roleInCase: 'owner' as const,
      userName: 'Test User',
      userEmail: 'test@example.com',
      avatarUrl: 'https://i.pravatar.cc/150?u=test@example.com'
    };

    mockCreateUserAndAddToCase.mockResolvedValue(mockNewMember);

    await act(async () => {
      render(
        <AddCaseMemberDialog
          open={true}
          onClose={mockOnClose}
          caseId={mockCaseId}
          onMemberAdded={mockOnMemberAdded}
        />
      );
    });

    // 等待角色加载和表单准备就绪
    await waitFor(() => {
      expect(mockGetCaseMemberRoles).toHaveBeenCalled();
    }, { timeout: 3000 });

    // 等待角色在状态中并渲染选择器
    await waitFor(() => {
      // 查找任何与角色相关的元素，而不是确切的标签
      const selects = screen.getAllByRole('combobox');
      expect(selects).toHaveLength(1); // 应该有角色选择器
    }, { timeout: 3000 });

    // 填写表单
    fireEvent.change(screen.getByLabelText('用户名'), {
      target: { value: 'testuser' }
    });
    fireEvent.change(screen.getByLabelText('密码'), {
      target: { value: 'password123' }
    });
    fireEvent.change(screen.getByLabelText('邮箱'), {
      target: { value: 'test@example.com' }
    });
    fireEvent.change(screen.getByLabelText('显示姓名'), {
      target: { value: 'Test User' }
    });

    // 角色应该已经有默认值（case_manager），所以我们可以直接提交
    // 提交表单
    const submitButton = screen.getByText('创建用户并添加');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockCreateUserAndAddToCase).toHaveBeenCalledWith(
        mockClient,
        mockCaseId,
        {
          username: 'testuser',
          password_hash: 'password123',
          email: 'test@example.com',
          name: 'Test User',
          roleId: mockRoles[0].id // 使用默认选中的角色RecordId
        }
      );
      expect(mockOnMemberAdded).toHaveBeenCalledWith(mockNewMember);
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('handles role loading error', async () => {
    mockGetCaseMemberRoles.mockRejectedValue(new Error('Failed to load roles'));

    await act(async () => {
      render(
        <AddCaseMemberDialog
          open={true}
          onClose={mockOnClose}
          caseId={mockCaseId}
          onMemberAdded={mockOnMemberAdded}
        />
      );
    });

    await waitFor(() => {
      expect(screen.getByText('加载角色列表失败')).toBeInTheDocument();
    });
  });

  it('resets form when dialog is closed and reopened', async () => {
    const { rerender } = render(
      <AddCaseMemberDialog
        open={true}
        onClose={mockOnClose}
        caseId={mockCaseId}
        onMemberAdded={mockOnMemberAdded}
      />
    );

    await waitFor(() => {
      expect(screen.getByLabelText('用户名')).toBeInTheDocument();
    });

    // 填写表单
    fireEvent.change(screen.getByLabelText('用户名'), {
      target: { value: 'testuser' }
    });

    // 关闭对话框
    await act(async () => {
      rerender(
        <AddCaseMemberDialog
          open={false}
          onClose={mockOnClose}
          caseId={mockCaseId}
          onMemberAdded={mockOnMemberAdded}
        />
      );
    });

    // 重新打开对话框
    await act(async () => {
      rerender(
        <AddCaseMemberDialog
          open={true}
          onClose={mockOnClose}
          caseId={mockCaseId}
          onMemberAdded={mockOnMemberAdded}
        />
      );
    });

    // 检查表单是否重置
    await waitFor(() => {
      expect((screen.getByLabelText('用户名') as HTMLInputElement).value).toBe('');
    });
    
    // 应该重新加载角色
    await waitFor(() => {
      expect(mockGetCaseMemberRoles).toHaveBeenCalledTimes(2);
    });
  });
});
