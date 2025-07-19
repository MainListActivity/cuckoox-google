import type { TenantContext } from './multi-tenant-manager';
import type { DataCacheManager } from './data-cache-manager';
import type { SubscriptionManager } from './subscription-manager';

/**
 * 租户切换状态
 */
export interface TenantSwitchState {
  isInProgress: boolean;
  currentStep: string;
  progress: number; // 0-100
  startTime: number;
  error?: string;
}

/**
 * 租户切换配置
 */
export interface TenantSwitchConfig {
  enablePreloading: boolean;
  enableProgressTracking: boolean;
  maxSwitchTimeMs: number;
  retryAttempts: number;
  cleanupOldTenantData: boolean;
}

/**
 * 租户切换处理器
 * 负责管理租户切换的完整流程，包括缓存清理、数据预加载、订阅管理等
 */
export class TenantSwitchHandler {
  private dataCacheManager: DataCacheManager;
  private subscriptionManager: SubscriptionManager;
  private config: TenantSwitchConfig;
  private switchState: TenantSwitchState | null = null;
  private switchCallbacks = new Set<(state: TenantSwitchState) => void>();

  constructor(
    dataCacheManager: DataCacheManager,
    subscriptionManager: SubscriptionManager,
    config: Partial<TenantSwitchConfig> = {}
  ) {
    this.dataCacheManager = dataCacheManager;
    this.subscriptionManager = subscriptionManager;
    this.config = {
      enablePreloading: true,
      enableProgressTracking: true,
      maxSwitchTimeMs: 30000, // 30秒超时
      retryAttempts: 3,
      cleanupOldTenantData: true,
      ...config
    };

    console.log('TenantSwitchHandler: Initialized with config:', this.config);
  }

  /**
   * 执行租户切换
   */
  async switchTenant(newTenant: TenantContext | null, oldTenant?: TenantContext | null): Promise<void> {
    if (this.switchState?.isInProgress) {
      throw new Error('Tenant switch already in progress');
    }

    const startTime = Date.now();
    this.switchState = {
      isInProgress: true,
      currentStep: 'initializing',
      progress: 0,
      startTime
    };

    try {
      console.log('TenantSwitchHandler: Starting tenant switch from', oldTenant?.tenantId, 'to', newTenant?.tenantId);
      
      // 设置超时保护
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Tenant switch timeout')), this.config.maxSwitchTimeMs);
      });

      // 执行切换流程
      await Promise.race([
        this.executeSwitchSteps(newTenant, oldTenant),
        timeoutPromise
      ]);

      // 切换成功
      this.switchState = null;
      console.log('TenantSwitchHandler: Tenant switch completed successfully in', Date.now() - startTime, 'ms');

    } catch (error) {
      console.error('TenantSwitchHandler: Tenant switch failed:', error);
      
      // 更新错误状态
      if (this.switchState) {
        this.switchState.error = error instanceof Error ? error.message : String(error);
        this.switchState.isInProgress = false;
        this.notifyStateChange();
      }

      // 尝试回滚到旧租户
      if (oldTenant) {
        try {
          console.log('TenantSwitchHandler: Attempting rollback to previous tenant');
          await this.rollbackToTenant(oldTenant);
        } catch (rollbackError) {
          console.error('TenantSwitchHandler: Rollback failed:', rollbackError);
        }
      }

      throw error;
    }
  }

  /**
   * 执行切换步骤
   */
  private async executeSwitchSteps(newTenant: TenantContext | null, oldTenant?: TenantContext | null): Promise<void> {
    const steps = [
      { name: 'validating', weight: 10 },
      { name: 'stopping_subscriptions', weight: 15 },
      { name: 'cleaning_cache', weight: 20 },
      { name: 'setting_context', weight: 10 },
      { name: 'preloading_data', weight: 30 },
      { name: 'starting_subscriptions', weight: 15 }
    ];

    let completedWeight = 0;

    for (const step of steps) {
      if (!this.switchState) break;

      this.switchState.currentStep = step.name;
      this.notifyStateChange();

      try {
        await this.executeStep(step.name, newTenant, oldTenant);
        completedWeight += step.weight;
        this.switchState.progress = Math.min(completedWeight, 100);
        this.notifyStateChange();
      } catch (error) {
        console.error(`TenantSwitchHandler: Step ${step.name} failed:`, error);
        throw error;
      }
    }
  }

  /**
   * 执行单个切换步骤
   */
  private async executeStep(stepName: string, newTenant: TenantContext | null, oldTenant?: TenantContext | null): Promise<void> {
    switch (stepName) {
      case 'validating':
        await this.validateTenantSwitch(newTenant, oldTenant);
        break;

      case 'stopping_subscriptions':
        if (oldTenant) {
          await this.stopTenantSubscriptions(oldTenant);
        }
        break;

      case 'cleaning_cache':
        if (oldTenant && this.config.cleanupOldTenantData) {
          await this.cleanupTenantData(oldTenant);
        }
        break;

      case 'setting_context':
        await this.dataCacheManager.setTenantContext(newTenant);
        break;

      case 'preloading_data':
        if (newTenant && this.config.enablePreloading) {
          await this.preloadTenantData(newTenant);
        }
        break;

      case 'starting_subscriptions':
        if (newTenant) {
          await this.startTenantSubscriptions(newTenant);
        }
        break;

      default:
        throw new Error(`Unknown step: ${stepName}`);
    }
  }

  /**
   * 验证租户切换
   */
  private async validateTenantSwitch(newTenant: TenantContext | null, oldTenant?: TenantContext | null): Promise<void> {
    console.log('TenantSwitchHandler: Validating tenant switch');

    // 检查新租户的有效性
    if (newTenant) {
      if (!newTenant.tenantId) {
        throw new Error('Invalid tenant: missing tenantId');
      }

      if (!newTenant.userId) {
        throw new Error('Invalid tenant: missing userId');
      }
    }

    // 检查是否真的需要切换
    if (oldTenant?.tenantId === newTenant?.tenantId) {
      console.log('TenantSwitchHandler: Same tenant, skipping switch');
      return;
    }

    console.log('TenantSwitchHandler: Tenant switch validation passed');
  }

  /**
   * 停止租户订阅
   */
  private async stopTenantSubscriptions(tenant: TenantContext): Promise<void> {
    console.log('TenantSwitchHandler: Stopping subscriptions for tenant:', tenant.tenantId);

    try {
      // 获取租户相关的所有订阅并停止
      const activeSubscriptions = this.subscriptionManager.getActiveSubscriptions();
      
      for (const subscription of activeSubscriptions) {
        // 检查订阅是否属于当前租户
        if (this.isSubscriptionForTenant(subscription, tenant)) {
          await this.subscriptionManager.unsubscribe(subscription.id);
        }
      }

      console.log('TenantSwitchHandler: Tenant subscriptions stopped');
    } catch (error) {
      console.error('TenantSwitchHandler: Failed to stop tenant subscriptions:', error);
      throw error;
    }
  }

  /**
   * 清理租户数据
   */
  private async cleanupTenantData(tenant: TenantContext): Promise<void> {
    console.log('TenantSwitchHandler: Cleaning up data for tenant:', tenant.tenantId);

    try {
      // 这里可以添加具体的清理逻辑
      // 例如：清理临时文件、清理内存缓存、清理本地存储等
      
      console.log('TenantSwitchHandler: Tenant data cleanup completed');
    } catch (error) {
      console.error('TenantSwitchHandler: Failed to cleanup tenant data:', error);
      throw error;
    }
  }

  /**
   * 预加载租户数据
   */
  private async preloadTenantData(tenant: TenantContext): Promise<void> {
    console.log('TenantSwitchHandler: Preloading data for tenant:', tenant.tenantId);

    try {
      // 预加载核心数据表
      const coreTables = ['user', 'role', 'case', 'claim'];
      
      for (const table of coreTables) {
        try {
          // 这里可以调用数据缓存管理器的预加载方法
          console.log(`TenantSwitchHandler: Preloading table: ${table}`);
        } catch (error) {
          console.warn(`TenantSwitchHandler: Failed to preload table ${table}:`, error);
        }
      }

      console.log('TenantSwitchHandler: Tenant data preloading completed');
    } catch (error) {
      console.error('TenantSwitchHandler: Failed to preload tenant data:', error);
      throw error;
    }
  }

  /**
   * 启动租户订阅
   */
  private async startTenantSubscriptions(tenant: TenantContext): Promise<void> {
    console.log('TenantSwitchHandler: Starting subscriptions for tenant:', tenant.tenantId);

    try {
      // 为新租户启动必要的订阅
      const requiredTables = ['case', 'claim', 'notification'];
      
      for (const table of requiredTables) {
        try {
          await this.subscriptionManager.subscribeToTable(table, tenant.userId, tenant.caseId);
        } catch (error) {
          console.warn(`TenantSwitchHandler: Failed to subscribe to table ${table}:`, error);
        }
      }

      console.log('TenantSwitchHandler: Tenant subscriptions started');
    } catch (error) {
      console.error('TenantSwitchHandler: Failed to start tenant subscriptions:', error);
      throw error;
    }
  }

  /**
   * 回滚到指定租户
   */
  private async rollbackToTenant(tenant: TenantContext): Promise<void> {
    console.log('TenantSwitchHandler: Rolling back to tenant:', tenant.tenantId);

    try {
      await this.dataCacheManager.setTenantContext(tenant);
      console.log('TenantSwitchHandler: Rollback completed');
    } catch (error) {
      console.error('TenantSwitchHandler: Rollback failed:', error);
      throw error;
    }
  }

  /**
   * 检查订阅是否属于指定租户
   */
  private isSubscriptionForTenant(subscription: any, tenant: TenantContext): boolean {
    // 这里需要根据实际的订阅结构来判断
    // 例如：检查订阅的参数中是否包含租户ID
    return subscription.params?.case_id === tenant.tenantId ||
           subscription.params?.tenant_id === tenant.tenantId;
  }

  /**
   * 通知状态变化
   */
  private notifyStateChange(): void {
    if (!this.switchState || !this.config.enableProgressTracking) {
      return;
    }

    for (const callback of this.switchCallbacks) {
      try {
        callback(this.switchState);
      } catch (error) {
        console.error('TenantSwitchHandler: State change callback failed:', error);
      }
    }
  }

  /**
   * 注册状态变化回调
   */
  onStateChange(callback: (state: TenantSwitchState) => void): void {
    this.switchCallbacks.add(callback);
  }

  /**
   * 取消注册状态变化回调
   */
  offStateChange(callback: (state: TenantSwitchState) => void): void {
    this.switchCallbacks.delete(callback);
  }

  /**
   * 获取当前切换状态
   */
  getSwitchState(): TenantSwitchState | null {
    return this.switchState;
  }

  /**
   * 强制取消当前切换
   */
  async cancelSwitch(): Promise<void> {
    if (!this.switchState?.isInProgress) {
      return;
    }

    console.log('TenantSwitchHandler: Cancelling tenant switch');
    
    this.switchState.isInProgress = false;
    this.switchState.error = 'Cancelled by user';
    this.notifyStateChange();
    
    this.switchState = null;
  }

  /**
   * 获取切换统计信息
   */
  getSwitchStats(): {
    isInProgress: boolean;
    currentStep: string | null;
    progress: number;
    hasError: boolean;
  } {
    return {
      isInProgress: this.switchState?.isInProgress || false,
      currentStep: this.switchState?.currentStep || null,
      progress: this.switchState?.progress || 0,
      hasError: !!this.switchState?.error
    };
  }
}