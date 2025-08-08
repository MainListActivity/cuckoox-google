import { vi } from 'vitest';
import { RecordId } from 'surrealdb';

/**
 * 统一的Mock工厂，用于创建和管理测试中的Mock对象
 * 解决测试间Mock对象污染问题
 */
export class MockFactory {
  private static instances = new Map<string, any>();
  private static cleanup_callbacks = new Set<() => void>();

  /**
   * 创建SurrealDB客户端Mock
   * 每次调用都返回新的独立实例
   */
  static createSurrealClient() {
    const id = `surreal_${Math.random().toString(36).substr(2, 9)}`;

    const client = {
      status: 'disconnected' as const,
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      use: vi.fn().mockResolvedValue(undefined),
      select: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
      merge: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue([]),
      live: vi.fn().mockResolvedValue('mock-live-id'),
      subscribeLive: vi.fn(),
      kill: vi.fn().mockResolvedValue(undefined),
      signin: vi.fn().mockResolvedValue('mock-token'),
      signout: vi.fn().mockResolvedValue(undefined),
      authenticate: vi.fn().mockResolvedValue(true),
      invalidate: vi.fn().mockResolvedValue(undefined),
    };

    this.instances.set(id, client);
    return { client, id };
  }

  /**
   * 创建数据服务Mock
   */
  static createDataService() {
    const id = `dataservice_${Math.random().toString(36).substr(2, 9)}`;

    const service = {
      setClient: vi.fn(),
      query: vi.fn().mockResolvedValue([]),
      select: vi.fn().mockResolvedValue([]),
      merge: vi.fn().mockResolvedValue({}),
      getUser: vi.fn().mockResolvedValue(null),
      updateUser: vi.fn().mockResolvedValue({}),
      getCase: vi.fn().mockResolvedValue(null),
      getCases: vi.fn().mockResolvedValue([]),
      updateCase: vi.fn().mockResolvedValue({}),
      createCase: vi.fn().mockResolvedValue({}),
      deleteCase: vi.fn().mockResolvedValue(undefined),
      getCreditors: vi.fn().mockResolvedValue([]),
      createCreditor: vi.fn().mockResolvedValue({}),
      updateCreditor: vi.fn().mockResolvedValue({}),
      deleteCreditor: vi.fn().mockResolvedValue(undefined),
    };

    this.instances.set(id, service);
    return { service, id };
  }

  /**
   * 创建认证服务Mock
   */
  static createAuthService() {
    const id = `authservice_${Math.random().toString(36).substr(2, 9)}`;

    const service = {
      getUser: vi.fn().mockResolvedValue(null),
      loginRedirect: vi.fn().mockResolvedValue(undefined),
      logoutRedirect: vi.fn().mockResolvedValue(undefined),
      handleLoginRedirect: vi.fn().mockResolvedValue(null),
      setSurrealClient: vi.fn(),
      isAuthenticated: vi.fn().mockReturnValue(false),
      getAccessToken: vi.fn().mockReturnValue(null),
    };

    this.instances.set(id, service);
    return { service, id };
  }

  /**
   * 创建菜单服务Mock
   */
  static createMenuService() {
    const id = `menuservice_${Math.random().toString(36).substr(2, 9)}`;

    const service = {
      loadUserMenus: vi.fn().mockResolvedValue([]),
      getUserMenus: vi.fn().mockReturnValue([]),
      hasOperationPermission: vi.fn().mockReturnValue(true),
      hasMenuPermission: vi.fn().mockReturnValue(true),
      setClient: vi.fn(),
      setDataService: vi.fn(),
    };

    this.instances.set(id, service);
    return { service, id };
  }

  /**
   * 创建Service Worker通信Mock
   */
  static createServiceWorkerComm() {
    const id = `swcomm_${Math.random().toString(36).substr(2, 9)}`;

    const comm = {
      sendMessage: vi.fn().mockResolvedValue({}),
      isAvailable: vi.fn().mockReturnValue(true),
      waitForReady: vi.fn().mockResolvedValue(undefined),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    this.instances.set(id, comm);
    return { comm, id };
  }

  /**
   * 创建React Router Mock
   */
  static createReactRouterMocks() {
    const navigate = vi.fn();
    const location = {
      pathname: '/',
      search: '',
      hash: '',
      state: null,
      key: 'default',
    };
    const params = {};

    return {
      useNavigate: () => navigate,
      useLocation: () => location,
      useParams: () => params,
      navigate,
      location,
      params,
    };
  }

  /**
   * 创建i18n Mock
   */
  static createI18nMocks() {
    const t = vi.fn((key: string, options?: any) => {
      // 提供一些常用的翻译
      const translations: Record<string, string> = {
        'create_user_and_add_to_case': '创建用户并添加到案件',
        'username_label': '用户名',
        'cancel_button': '取消',
        'create_user_and_add': '创建用户并添加',
        'password_label': '密码',
        'email_label': '邮箱',
        'display_name_label': '显示姓名',
        'role_in_case_label': '在案件中的角色',
        'username_required': '用户名不能为空',
        'password_required': '密码不能为空',
        'email_required': '邮箱不能为空',
        'name_required': '姓名不能为空',
        'email_invalid': '邮箱格式不正确',
        'save': '保存',
        'saving': '保存中...',
        'edit': '编辑',
        'preview': '预览',
        'loading': '加载中...',
        'error': '错误',
        'success': '成功',
      };

      return translations[key] || key;
    });

    const i18n = {
      language: 'zh-CN',
      changeLanguage: vi.fn().mockResolvedValue(undefined),
    };

    return {
      useTranslation: () => ({ t, i18n }),
      t,
      i18n,
    };
  }

  /**
   * 创建测试用的案件数据
   */
  static createMockCase(overrides: Partial<any> = {}) {
    return {
      id: new RecordId('case', 'test_case_1'),
      name: '测试案件',
      number: 'TEST001',
      status: 'active',
      created_at: new Date('2024-01-01'),
      updated_at: new Date('2024-01-01'),
      ...overrides,
    };
  }

  /**
   * 创建测试用的用户数据
   */
  static createMockUser(overrides: Partial<any> = {}) {
    return {
      id: new RecordId('user', 'test_user_1'),
      username: 'testuser',
      email: 'test@example.com',
      display_name: '测试用户',
      is_admin: false,
      created_at: new Date('2024-01-01'),
      updated_at: new Date('2024-01-01'),
      ...overrides,
    };
  }

  /**
   * 创建测试用的债权人数据
   */
  static createMockCreditor(overrides: Partial<any> = {}) {
    return {
      id: new RecordId('creditor', 'test_creditor_1'),
      name: '测试债权人',
      id_number: '123456789012345678',
      phone: '13800138000',
      email: 'creditor@example.com',
      amount: 100000,
      case_id: new RecordId('case', 'test_case_1'),
      created_at: new Date('2024-01-01'),
      updated_at: new Date('2024-01-01'),
      ...overrides,
    };
  }

  /**
   * 注册清理回调
   */
  static onCleanup(callback: () => void) {
    this.cleanup_callbacks.add(callback);
  }

  /**
   * 获取Mock实例
   */
  static getInstance(id: string) {
    return this.instances.get(id);
  }

  /**
   * 清理所有Mock实例和回调
   */
  static cleanup() {
    // 执行清理回调
    this.cleanup_callbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.warn('Mock cleanup callback failed:', error);
      }
    });

    // 清理实例
    this.instances.clear();
    this.cleanup_callbacks.clear();
  }

  /**
   * 重置特定实例的Mock函数
   */
  static resetInstance(id: string) {
    const instance = this.instances.get(id);
    if (instance) {
      Object.values(instance).forEach(value => {
        if (vi.isMockFunction(value)) {
          value.mockClear();
        }
      });
    }
  }

  /**
   * 重置所有实例的Mock函数
   */
  static resetAllInstances() {
    this.instances.forEach((instance, id) => {
      this.resetInstance(id);
    });
  }
}

/**
 * 创建标准测试环境
 * 返回常用的Mock对象和清理函数
 */
export function createTestEnvironment() {
  const { client: surrealClient, id: surrealId } = MockFactory.createSurrealClient();
  const { service: dataService, id: dataServiceId } = MockFactory.createDataService();
  const { service: authService, id: authServiceId } = MockFactory.createAuthService();
  const { service: menuService, id: menuServiceId } = MockFactory.createMenuService();
  const { comm: swComm, id: swCommId } = MockFactory.createServiceWorkerComm();

  const routerMocks = MockFactory.createReactRouterMocks();
  const i18nMocks = MockFactory.createI18nMocks();

  return {
    mocks: {
      surrealClient,
      dataService,
      authService,
      menuService,
      swComm,
      ...routerMocks,
      ...i18nMocks,
    },
    ids: {
      surrealId,
      dataServiceId,
      authServiceId,
      menuServiceId,
      swCommId,
    },
    cleanup: () => {
      MockFactory.cleanup();
    },
    reset: () => {
      MockFactory.resetAllInstances();
    },
  };
}

/**
 * 轻量级测试环境
 * 只包含最基本的Mock，适用于简单单元测试
 */
export function createLightweightTestEnvironment() {
  const routerMocks = MockFactory.createReactRouterMocks();
  const i18nMocks = MockFactory.createI18nMocks();

  return {
    mocks: {
      ...routerMocks,
      ...i18nMocks,
    },
    cleanup: () => {
      MockFactory.cleanup();
    },
  };
}
