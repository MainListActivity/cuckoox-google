/**
 * 网络状态管理器
 * 
 * 负责监听和管理网络状态变化，包括：
 * - 在线/离线状态检测
 * - 网络连接质量监控
 * - 状态变化通知
 * - 与现有 OfflineManager 集成
 */

export interface NetworkState {
  isOnline: boolean;
  connectionType: 'wifi' | '4g' | '3g' | '2g' | 'unknown';
  effectiveType: 'slow-2g' | '2g' | '3g' | '4g';
  downlink: number; // Mbps
  rtt: number; // ms
  saveData: boolean;
  timestamp: number;
}

export interface NetworkStateChangeListener {
  (state: NetworkState): void;
}

export class NetworkStateManager {
  private currentState: NetworkState;
  private listeners: Set<NetworkStateChangeListener> = new Set();
  private offlineManager: any = null; // 引用现有的 OfflineManager
  private connectionHealthChecker: NodeJS.Timeout | null = null;
  private isInitialized = false;

  constructor() {
    this.currentState = this.getInitialState();
  }

  /**
   * 初始化网络状态管理器
   */
  async initialize(offlineManager?: any): Promise<void> {
    if (this.isInitialized) return;

    console.log('NetworkStateManager: Initializing...');

    this.offlineManager = offlineManager;
    
    // 设置网络状态监听器
    this.setupNetworkListeners();
    
    // 启动连接健康检查
    this.startConnectionHealthCheck();
    
    this.isInitialized = true;
    console.log('NetworkStateManager: Initialized successfully');
  }

  /**
   * 获取当前网络状态
   */
  getCurrentState(): NetworkState {
    return { ...this.currentState };
  }

  /**
   * 注册状态变化监听器
   */
  onStateChange(listener: NetworkStateChangeListener): () => void {
    this.listeners.add(listener);
    
    // 立即调用一次以提供当前状态
    listener(this.getCurrentState());
    
    return () => this.listeners.delete(listener);
  }

  /**
   * 移除状态变化监听器
   */
  removeStateListener(listener: NetworkStateChangeListener): void {
    this.listeners.delete(listener);
  }

  /**
   * 手动触发网络状态检查
   */
  async checkNetworkStatus(): Promise<NetworkState> {
    const newState = await this.detectNetworkState();
    this.updateState(newState);
    return this.getCurrentState();
  }

  /**
   * 测试网络连接质量
   */
  async testConnectionQuality(): Promise<{
    latency: number;
    downloadSpeed: number;
    isStable: boolean;
  }> {
    const startTime = performance.now();
    
    try {
      // 测试延迟 - 请求一个小的资源
      const testUrl = '/favicon.ico?' + Date.now();
      const response = await fetch(testUrl, { 
        method: 'HEAD',
        cache: 'no-cache'
      });
      
      const latency = performance.now() - startTime;
      
      // 简单的下载速度测试
      const downloadStart = performance.now();
      await fetch(testUrl + '_download', { cache: 'no-cache' });
      const downloadTime = performance.now() - downloadStart;
      
      // 估算下载速度（这是一个简化的计算）
      const downloadSpeed = response.ok ? Math.max(0.1, 1000 / downloadTime) : 0;
      
      return {
        latency,
        downloadSpeed,
        isStable: latency < 1000 && response.ok
      };
    } catch (error) {
      console.warn('NetworkStateManager: Connection quality test failed:', error);
      return {
        latency: 9999,
        downloadSpeed: 0,
        isStable: false
      };
    }
  }

  /**
   * 销毁管理器
   */
  destroy(): void {
    console.log('NetworkStateManager: Destroying...');
    
    // 清理事件监听器
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline);
      window.removeEventListener('offline', this.handleOffline);
    }

    // 清理连接健康检查
    if (this.connectionHealthChecker) {
      clearInterval(this.connectionHealthChecker);
      this.connectionHealthChecker = null;
    }

    // 清理监听器
    this.listeners.clear();
    
    this.isInitialized = false;
    console.log('NetworkStateManager: Destroyed');
  }

  // 私有方法

  private getInitialState(): NetworkState {
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    const connection = this.getConnectionInfo();

    return {
      isOnline,
      connectionType: connection.type,
      effectiveType: connection.effectiveType,
      downlink: connection.downlink,
      rtt: connection.rtt,
      saveData: connection.saveData,
      timestamp: Date.now()
    };
  }

  private getConnectionInfo(): {
    type: NetworkState['connectionType'];
    effectiveType: NetworkState['effectiveType'];
    downlink: number;
    rtt: number;
    saveData: boolean;
  } {
    // 尝试获取 Network Information API 数据
    const connection = (navigator as any)?.connection || 
                      (navigator as any)?.mozConnection || 
                      (navigator as any)?.webkitConnection;

    if (connection) {
      return {
        type: this.mapConnectionType(connection.type || connection.effectiveType),
        effectiveType: connection.effectiveType || '4g',
        downlink: connection.downlink || 10,
        rtt: connection.rtt || 100,
        saveData: connection.saveData || false
      };
    }

    // 回退到默认值
    return {
      type: 'unknown',
      effectiveType: '4g',
      downlink: 10,
      rtt: 100,
      saveData: false
    };
  }

  private mapConnectionType(type: string): NetworkState['connectionType'] {
    const typeMap: { [key: string]: NetworkState['connectionType'] } = {
      'cellular': '4g',
      'wifi': 'wifi',
      'ethernet': 'wifi', // 将有线连接映射为 wifi
      'bluetooth': '3g',
      'wimax': '4g',
      'other': 'unknown',
      'none': 'unknown',
      'unknown': 'unknown'
    };

    return typeMap[type.toLowerCase()] || 'unknown';
  }

  private setupNetworkListeners(): void {
    if (typeof window === 'undefined') return;

    // 在线/离线状态监听
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);

    // Network Information API 监听（如果支持）
    const connection = (navigator as any)?.connection;
    if (connection) {
      connection.addEventListener('change', this.handleConnectionChange);
    }
  }

  private handleOnline = () => {
    console.log('NetworkStateManager: Online event detected');
    this.updateStateFromEvent({ isOnline: true });
  };

  private handleOffline = () => {
    console.log('NetworkStateManager: Offline event detected');
    this.updateStateFromEvent({ isOnline: false });
  };

  private handleConnectionChange = () => {
    console.log('NetworkStateManager: Connection change detected');
    const connectionInfo = this.getConnectionInfo();
    this.updateStateFromEvent({
      connectionType: connectionInfo.type,
      effectiveType: connectionInfo.effectiveType,
      downlink: connectionInfo.downlink,
      rtt: connectionInfo.rtt,
      saveData: connectionInfo.saveData
    });
  };

  private updateStateFromEvent(changes: Partial<NetworkState>): void {
    const newState: NetworkState = {
      ...this.currentState,
      ...changes,
      timestamp: Date.now()
    };
    
    this.updateState(newState);
  }

  private async detectNetworkState(): Promise<NetworkState> {
    const isOnline = navigator.onLine;
    const connectionInfo = this.getConnectionInfo();

    // 如果显示在线，进行真实连接测试
    let actuallyOnline = isOnline;
    if (isOnline) {
      try {
        const quality = await this.testConnectionQuality();
        actuallyOnline = quality.isStable;
      } catch {
        actuallyOnline = false;
      }
    }

    return {
      isOnline: actuallyOnline,
      connectionType: connectionInfo.type,
      effectiveType: connectionInfo.effectiveType,
      downlink: connectionInfo.downlink,
      rtt: connectionInfo.rtt,
      saveData: connectionInfo.saveData,
      timestamp: Date.now()
    };
  }

  private updateState(newState: NetworkState): void {
    const oldState = this.currentState;
    const hasChanged = this.hasStateChanged(oldState, newState);

    if (!hasChanged) return;

    this.currentState = newState;

    console.log('NetworkStateManager: State changed', {
      from: oldState,
      to: newState
    });

    // 通知监听器
    this.notifyListeners(newState);

    // 通知现有的 OfflineManager
    if (this.offlineManager && oldState.isOnline !== newState.isOnline) {
      this.notifyOfflineManager(newState.isOnline);
    }
  }

  private hasStateChanged(oldState: NetworkState, newState: NetworkState): boolean {
    return (
      oldState.isOnline !== newState.isOnline ||
      oldState.connectionType !== newState.connectionType ||
      oldState.effectiveType !== newState.effectiveType ||
      Math.abs(oldState.downlink - newState.downlink) > 1 ||
      Math.abs(oldState.rtt - newState.rtt) > 50 ||
      oldState.saveData !== newState.saveData
    );
  }

  private notifyListeners(state: NetworkState): void {
    this.listeners.forEach(listener => {
      try {
        listener(state);
      } catch (error) {
        console.error('NetworkStateManager: Error in listener:', error);
      }
    });
  }

  private notifyOfflineManager(isOnline: boolean): void {
    if (!this.offlineManager) return;

    try {
      if (isOnline) {
        // 网络恢复，触发同步
        if (typeof this.offlineManager.onNetworkRestore === 'function') {
          this.offlineManager.onNetworkRestore();
        }
      } else {
        // 网络断开，进入离线模式
        if (typeof this.offlineManager.onNetworkLost === 'function') {
          this.offlineManager.onNetworkLost();
        }
      }
    } catch (error) {
      console.error('NetworkStateManager: Error notifying OfflineManager:', error);
    }
  }

  private startConnectionHealthCheck(): void {
    // 每30秒检查一次连接健康状况
    this.connectionHealthChecker = setInterval(async () => {
      try {
        const newState = await this.detectNetworkState();
        this.updateState(newState);
      } catch (error) {
        console.warn('NetworkStateManager: Health check failed:', error);
      }
    }, 30000);
  }
}

// 网络状态工具函数
export const NetworkUtils = {
  /**
   * 判断是否为慢速网络
   */
  isSlowNetwork(state: NetworkState): boolean {
    return state.effectiveType === 'slow-2g' || 
           state.effectiveType === '2g' ||
           state.downlink < 1.5;
  },

  /**
   * 判断是否应该启用数据节省模式
   */
  shouldSaveData(state: NetworkState): boolean {
    return state.saveData || 
           this.isSlowNetwork(state) ||
           state.connectionType === '3g' ||
           state.connectionType === '2g';
  },

  /**
   * 获取网络质量评分 (0-100)
   */
  getNetworkQuality(state: NetworkState): number {
    if (!state.isOnline) return 0;

    let score = 100;

    // 根据有效类型调整分数
    const typeScores = {
      'slow-2g': 20,
      '2g': 40,
      '3g': 70,
      '4g': 100
    };
    score = typeScores[state.effectiveType] || 100;

    // 根据延迟调整
    if (state.rtt > 1000) score *= 0.5;
    else if (state.rtt > 500) score *= 0.7;
    else if (state.rtt > 200) score *= 0.9;

    // 根据带宽调整
    if (state.downlink < 0.5) score *= 0.5;
    else if (state.downlink < 1.5) score *= 0.7;
    else if (state.downlink < 5) score *= 0.9;

    return Math.round(Math.max(0, Math.min(100, score)));
  },

  /**
   * 格式化网络状态为用户友好的文本
   */
  formatNetworkState(state: NetworkState): string {
    if (!state.isOnline) {
      return '离线';
    }

    const quality = this.getNetworkQuality(state);
    if (quality >= 80) return '网络良好';
    if (quality >= 60) return '网络一般';
    if (quality >= 30) return '网络较慢';
    return '网络很慢';
  }
};