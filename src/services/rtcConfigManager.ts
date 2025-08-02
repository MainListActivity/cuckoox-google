import rtcConfigService, { RTCConfig, RTCConfigService } from './rtcConfigService';

/**
 * RTCConfigManager - WebRTC配置管理器
 * 统一管理配置的生命周期，包括初始化、订阅变更、本地缓存管理
 */
class RTCConfigManager {
  private config: RTCConfig | null = null;
  private subscribers: ((config: RTCConfig) => void)[] = [];
  private isInitialized: boolean = false;
  private initPromise: Promise<void> | null = null;
  private subscriptionId: string | null = null;

  /**
   * 初始化配置管理器
   */
  async initialize(): Promise<void> {
    // 如果已经在初始化，返回初始化Promise
    if (this.initPromise) {
      return this.initPromise;
    }

    // 如果已经初始化完成，直接返回
    if (this.isInitialized) {
      return;
    }

    this.initPromise = this._doInitialize();
    return this.initPromise;
  }

  /**
   * 执行初始化逻辑
   */
  private async _doInitialize(): Promise<void> {
    try {
      console.log('RTCConfigManager: 开始初始化...');
      
      // 1. 尝试从本地缓存获取
      this.config = rtcConfigService.getCachedConfig();
      
      if (this.config) {
        console.log('RTCConfigManager: 使用缓存的配置');
      } else {
        console.log('RTCConfigManager: 本地缓存未找到，从服务器获取配置');
      }

      // 2. 从服务器获取最新配置
      try {
        const serverConfig = await rtcConfigService.getRTCConfig();
        if (serverConfig && this.isConfigNewer(serverConfig)) {
          this.config = serverConfig;
          rtcConfigService.cacheConfigLocally(serverConfig);
          this.notifySubscribers(serverConfig);
          console.log('RTCConfigManager: 已更新到最新服务器配置');
        }
      } catch (error) {
        console.warn('RTCConfigManager: 从服务器获取配置失败，使用缓存或默认配置', error);
        
        // 如果没有缓存配置，使用默认配置
        if (!this.config) {
          this.config = rtcConfigService.getDefaultConfig();
          console.log('RTCConfigManager: 使用默认配置');
        }
      }

      // 3. 订阅配置变更
      this.subscriptionId = rtcConfigService.onConfigUpdate((newConfig) => {
        console.log('RTCConfigManager: 收到配置更新');
        this.config = newConfig;
        this.notifySubscribers(newConfig);
      });

      this.isInitialized = true;
      console.log('RTCConfigManager: 初始化完成');
      
    } catch (error) {
      console.error('RTCConfigManager: 初始化失败', error);
      
      // 初始化失败时使用默认配置
      this.config = rtcConfigService.getDefaultConfig();
      this.isInitialized = true;
      
      throw error;
    } finally {
      this.initPromise = null;
    }
  }

  /**
   * 获取当前配置
   */
  async getConfig(): Promise<RTCConfig> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    return this.config || rtcConfigService.getDefaultConfig();
  }

  /**
   * 同步获取当前配置（如果未初始化则返回默认配置）
   */
  getConfigSync(): RTCConfig {
    return this.config || rtcConfigService.getDefaultConfig();
  }

  /**
   * 订阅配置变更
   */
  onConfigUpdate(callback: (config: RTCConfig) => void): () => void {
    this.subscribers.push(callback);
    
    // 如果已经有配置，立即调用回调
    if (this.config) {
      try {
        callback(this.config);
      } catch (error) {
        console.error('RTCConfigManager: 调用配置更新回调失败', error);
      }
    }

    // 返回取消订阅的函数
    return () => {
      const index = this.subscribers.indexOf(callback);
      if (index > -1) {
        this.subscribers.splice(index, 1);
      }
    };
  }

  /**
   * 强制刷新配置
   */
  async refreshConfig(): Promise<RTCConfig> {
    try {
      const newConfig = await rtcConfigService.getRTCConfig();
      this.config = newConfig;
      rtcConfigService.cacheConfigLocally(newConfig);
      this.notifySubscribers(newConfig);
      return newConfig;
    } catch (error) {
      console.error('RTCConfigManager: 刷新配置失败', error);
      throw error;
    }
  }

  /**
   * 清除本地缓存
   */
  clearCache(): void {
    rtcConfigService.clearLocalCache();
    console.log('RTCConfigManager: 已清除本地缓存');
  }

  /**
   * 更新配置（仅管理员可用）
   */
  async updateConfig(configUpdate: Partial<RTCConfig>): Promise<void> {
    try {
      await rtcConfigService.updateConfig(configUpdate);
      console.log('RTCConfigManager: 配置更新成功');
    } catch (error) {
      console.error('RTCConfigManager: 更新配置失败', error);
      throw error;
    }
  }

  /**
   * 判断配置是否更新
   */
  private isConfigNewer(serverConfig: RTCConfig): boolean {
    if (!this.config) {
      return true;
    }
    
    // 简单的配置比较 - 在实际项目中可能需要更复杂的比较逻辑
    const currentStr = JSON.stringify(this.config);
    const serverStr = JSON.stringify(serverConfig);
    
    return currentStr !== serverStr;
  }

  /**
   * 通知所有订阅者
   */
  private notifySubscribers(config: RTCConfig): void {
    this.subscribers.forEach(callback => {
      try {
        callback(config);
      } catch (error) {
        console.error('RTCConfigManager: 通知订阅者失败', error);
      }
    });
  }

  /**
   * 检查是否已初始化
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * 获取配置管理器状态信息
   */
  getStatus(): {
    initialized: boolean;
    hasConfig: boolean;
    subscriberCount: number;
    configSource: 'cache' | 'server' | 'default' | 'none';
  } {
    let configSource: 'cache' | 'server' | 'default' | 'none' = 'none';
    
    if (this.config) {
      // 简单判断配置来源（实际项目中可能需要更精确的跟踪）
      const cachedConfig = rtcConfigService.getCachedConfig();
      if (cachedConfig && JSON.stringify(cachedConfig) === JSON.stringify(this.config)) {
        configSource = 'cache';
      } else {
        configSource = 'server';
      }
    }

    return {
      initialized: this.isInitialized,
      hasConfig: !!this.config,
      subscriberCount: this.subscribers.length,
      configSource
    };
  }

  /**
   * 预加载配置（可选的性能优化）
   */
  async preloadConfig(): Promise<void> {
    if (!this.isInitialized) {
      try {
        await this.initialize();
      } catch (error) {
        console.warn('RTCConfigManager: 预加载配置失败，将在需要时重试', error);
      }
    }
  }

  /**
   * 销毁配置管理器，清理资源
   */
  destroy(): void {
    console.log('RTCConfigManager: 开始销毁...');
    
    // 取消配置订阅
    if (this.subscriptionId) {
      rtcConfigService.unsubscribeConfigUpdate(this.subscriptionId);
      this.subscriptionId = null;
    }

    // 清除订阅者
    this.subscribers = [];

    // 重置状态
    this.config = null;
    this.isInitialized = false;
    this.initPromise = null;

    console.log('RTCConfigManager: 销毁完成');
  }

  // ====================== 便利方法 ======================

  /**
   * 检查是否启用语音通话
   */
  async isVoiceCallEnabled(): Promise<boolean> {
    const config = await this.getConfig();
    return config.enable_voice_call;
  }

  /**
   * 检查是否启用视频通话
   */
  async isVideoCallEnabled(): Promise<boolean> {
    const config = await this.getConfig();
    return config.enable_video_call;
  }

  /**
   * 检查是否启用群组功能
   */
  async isGroupChatEnabled(): Promise<boolean> {
    const config = await this.getConfig();
    return config.enable_group_chat;
  }

  /**
   * 检查是否启用文件传输
   */
  async isFileTransferEnabled(): Promise<boolean> {
    const config = await this.getConfig();
    return config.enable_file_transfer;
  }

  /**
   * 获取最大文件大小限制
   */
  async getMaxFileSize(): Promise<number> {
    const config = await this.getConfig();
    return config.max_file_size;
  }

  /**
   * 获取STUN服务器列表
   */
  async getStunServers(): Promise<string[]> {
    const config = await this.getConfig();
    return config.stun_servers;
  }

  /**
   * 获取支持的文件类型
   */
  async getSupportedFileTypes(): Promise<{
    images: string[];
    videos: string[];
    audios: string[];
    documents: string[];
  }> {
    const config = await this.getConfig();
    return {
      images: config.supported_image_types,
      videos: config.supported_video_types,
      audios: config.supported_audio_types,
      documents: config.supported_document_types
    };
  }

  /**
   * 检查文件是否被支持
   */
  async isFileSupported(fileName: string): Promise<boolean> {
    const config = await this.getConfig();
    return rtcConfigService.isFileTypeSupported(fileName, config);
  }

  /**
   * 检查文件大小是否有效
   */
  async isFileSizeValid(fileSize: number): Promise<boolean> {
    const config = await this.getConfig();
    return rtcConfigService.isFileSizeValid(fileSize, config);
  }

  /**
   * 获取网络质量等级
   */
  async getNetworkQualityLevel(bandwidth: number, latency: number, packetLoss: number): Promise<string> {
    const config = await this.getConfig();
    return rtcConfigService.getNetworkQualityLevel(bandwidth, latency, packetLoss, config);
  }
}

// 创建单例实例
const rtcConfigManager = new RTCConfigManager();

// 导出管理器实例和类型
export default rtcConfigManager;
export { RTCConfigManager };
export type { RTCConfig } from './rtcConfigService';