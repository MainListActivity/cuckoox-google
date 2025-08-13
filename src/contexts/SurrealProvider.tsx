import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";
import { Surreal } from "surrealdb";
import { useMutation } from "@tanstack/react-query";
import { serviceWorkerEngines } from "@/src/lib/service-worker-engine";

/**
 * 自定义错误类
 */
export class AuthenticationRequiredError extends Error {
  constructor(message: string = "用户未登录，请先登录") {
    super(message);
    this.name = "AuthenticationRequiredError";
  }
}

export class TenantCodeMissingError extends Error {
  constructor(message: string = "租户代码缺失") {
    super(message);
    this.name = "TenantCodeMissingError";
  }
}

export class ServiceWorkerUnavailableError extends Error {
  constructor(message: string = "Service Worker不可用") {
    super(message);
    this.name = "ServiceWorkerUnavailableError";
  }
}

/**
 * SurrealDB Provider状态接口（按照官方标准模式）
 */
export interface SurrealProviderState {
  /** SurrealDB客户端实例 */
  client: Surreal;
  /** 连接是否正在进行中 */
  isConnecting: boolean;
  /** 连接是否成功建立 */
  isSuccess: boolean;
  /** 连接是否发生错误 */
  isError: boolean;
  /** 连接错误信息 */
  error: unknown;
  /** 连接到SurrealDB实例 */
  connect: () => Promise<true>;
  /** 关闭SurrealDB连接 */
  close: () => Promise<true>;
}

/**
 * 扩展接口：业务功能支持
 */
export interface SurrealContextValue extends SurrealProviderState {
  // 向后兼容的别名
  surreal: Surreal;

  // 业务状态
  isConnected: boolean;
  isAuthenticated: boolean;
  currentTenant: string | undefined;

  // 认证管理
  authenticate: (credentials: AuthCredentials) => Promise<void>;
  invalidate: () => Promise<void>;
  getAuthStatus: () => Promise<boolean>;

  // 租户管理
  switchTenant: (tenantCode: string) => Promise<void>;
  getCurrentTenant: () => string | undefined;

  // 连接管理（向后兼容）
  disconnect: () => Promise<void>;
  reconnect: () => Promise<void>;
}

/**
 * 认证凭据接口
 */
export interface AuthCredentials {
  github_id: string;
  token?: string;
  tenant_code?: string;
}

/**
 * 健康状态接口
 */
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'error';
  isConnected: boolean;
  isAuthenticated: boolean;
  serviceWorkerReady: boolean;
  lastCheck: number;
}

/**
 * Provider属性接口（按照官方标准模式）
 */
interface SurrealProviderProps {
  children: React.ReactNode;
  /** 可选的现有Surreal客户端 */
  client?: Surreal;
  /** 可选的连接参数 */
  params?: Parameters<Surreal["connect"]>[1];
  /** 组件挂载时自动连接，默认为true */
  autoConnect?: boolean;

}

// 创建上下文
const SurrealContext = createContext<SurrealContextValue | undefined>(undefined);

/**
 * SurrealDB Provider（按照官方标准模式，集成Service Worker引擎）
 */
export const SurrealProvider: React.FC<SurrealProviderProps> = ({
  children,
  client,
  params,
  autoConnect = true,
}) => {
  // 业务状态管理
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentTenant, setCurrentTenant] = useState<string>();

  // Surreal实例保持稳定（按照官方模式）
  const [surrealInstance] = useState(() => {
    if (client) return client;
    return new Surreal({
      engines: serviceWorkerEngines()
    });
  });

  // React Query mutation用于连接SurrealDB（按照官方模式）
  const {
    mutateAsync: connectMutation,
    isPending,
    isSuccess,
    isError,
    error,
    reset,
  } = useMutation({
    mutationFn: async () => {
      // 将真实URL协议修改为sw协议（适配Service Worker引擎）
      return await surrealInstance.connect('sw://localhost', params);
    },
  });

  // 封装connectMutation为稳定的回调（按照官方模式）
  const connect = useCallback(() => connectMutation(), [connectMutation]);

  // 封装close()为稳定的回调（按照官方模式）
  const close = useCallback(() => surrealInstance.close(), [surrealInstance]);

  // 向后兼容的断开连接方法
  const disconnect = useCallback(async (): Promise<void> => {
    await close();
    setIsAuthenticated(false);
    setCurrentTenant(undefined);
  }, [close]);

  // 向后兼容的重新连接方法
  const reconnect = useCallback(async (): Promise<void> => {
    reset();
    await connect();
  }, [reset, connect]);

  /**
   * 用户认证
   */
  const authenticate = useCallback(async (credentials: AuthCredentials): Promise<void> => {
    if (!isSuccess) {
      throw new Error('数据库未连接');
    }

    try {
      // 如果有租户代码，先切换到指定租户
      if (credentials.tenant_code) {
        await surrealInstance.use({
          namespace: 'ck_go',
          database: credentials.tenant_code
        });
        setCurrentTenant(credentials.tenant_code);
      }

      // 使用 token 进行认证
      if (credentials.token) {
        await surrealInstance.authenticate(credentials.token);
      }

      setIsAuthenticated(true);
      console.log('SurrealProvider: 用户认证成功');
    } catch (error) {
      console.error('SurrealProvider: 用户认证失败', error);
      throw error;
    }
  }, [surrealInstance, isSuccess]);

  /**
   * 注销认证
   */
  const invalidate = useCallback(async (): Promise<void> => {
    try {
      await surrealInstance.invalidate();
      setIsAuthenticated(false);
      setCurrentTenant(undefined);
      console.log('SurrealProvider: 用户认证已注销');
    } catch (error) {
      console.error('SurrealProvider: 注销认证失败', error);
      throw error;
    }
  }, [surrealInstance]);

  /**
   * 获取认证状态
   */
  const getAuthStatus = useCallback(async (): Promise<boolean> => {
    if (!isSuccess) {
      return false;
    }

    try {
      await surrealInstance.query('return $auth');
      return true;
    } catch {
      return false;
    }
  }, [surrealInstance, isSuccess]);

  /**
   * 切换租户
   */
  const switchTenant = useCallback(async (tenantCode: string): Promise<void> => {
    if (!isSuccess) {
      throw new Error('数据库未连接');
    }

    try {
      await surrealInstance.use({
        namespace: 'ck_go',
        database: tenantCode
      });
      setCurrentTenant(tenantCode);
      console.log(`SurrealProvider: 已切换到租户 ${tenantCode}`);
    } catch (error) {
      console.error('SurrealProvider: 切换租户失败', error);
      throw error;
    }
  }, [surrealInstance, isSuccess]);

  /**
   * 获取当前租户
   */
  const getCurrentTenant = useCallback((): string | undefined => {
    return currentTenant;
  }, [currentTenant]);

  // 自动连接和清理（按照官方模式）
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      reset();
      surrealInstance.close();
    };
  }, [autoConnect, connect, reset, surrealInstance]);

  // 构建上下文值
  const contextValue: SurrealContextValue = useMemo(
    () => ({
      // 标准接口
      client: surrealInstance,
      isConnecting: isPending,
      isSuccess,
      isError,
      error,
      connect,
      close,

      // 向后兼容和业务扩展
      surreal: surrealInstance,
      isConnected: isSuccess,
      isAuthenticated,
      currentTenant,
      authenticate,
      invalidate,
      getAuthStatus,
      switchTenant,
      getCurrentTenant,
      disconnect,
      reconnect,
    }),
    [
      surrealInstance,
      isPending,
      isSuccess,
      isError,
      error,
      connect,
      close,
      isAuthenticated,
      currentTenant,
      authenticate,
      invalidate,
      getAuthStatus,
      switchTenant,
      getCurrentTenant,
      disconnect,
      reconnect,
    ]
  );

  return <SurrealContext.Provider value={contextValue}>{children}</SurrealContext.Provider>;
};

/**
 * 使用SurrealDB上下文的Hook
 */
export const useSurreal = (): SurrealContextValue => {
  const context = useContext(SurrealContext);

  if (!context) {
    throw new Error('useSurreal必须在SurrealProvider内使用');
  }

  return context;
};

/**
 * 向后兼容的Hook别名
 */
export const useSurrealProvider = useSurreal;

/**
 * 向后兼容：useSurrealContext Hook（别名）
 */
export const useSurrealContext = useSurreal;

/**
 * 向后兼容：useSurrealClient Hook
 */
export const useSurrealClient = (): Surreal => {
  const { client } = useSurreal();
  return client;
};

/**
 * 向后兼容：useServiceWorkerComm Hook（已简化）
 */
export const useServiceWorkerComm = () => {
  const { client } = useSurreal();

  return {
    sendMessage: () => {
      console.warn('sendMessage已弃用 - Service Worker通信现在由SurrealDB引擎内部处理');
      return Promise.resolve();
    },
    isAvailable: () => !!client,
    waitForReady: () => Promise.resolve()
  };
};

// 导出别名（保持向后兼容）
export type SurrealWorkerAPI = Surreal;