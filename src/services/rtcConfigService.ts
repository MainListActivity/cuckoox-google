import { useSurrealClientSingleton, TenantCodeMissingError } from '@/src/contexts/SurrealProvider';
import type { SurrealWorkerAPI } from '@/src/contexts/SurrealProvider';

// WebRTC配置类型定义
export interface RTCConfig {
  // WebRTC服务器配置
  stun_servers: string[];
  
  // P2P文件传输限制
  max_file_size: number;
  file_chunk_size: number;
  supported_image_types: string[];
  supported_video_types: string[];
  supported_audio_types: string[];
  supported_document_types: string[];
  
  // 功能开关
  enable_voice_call: boolean;
  enable_video_call: boolean;
  enable_screen_share: boolean;
  enable_file_transfer: boolean;
  enable_group_chat: boolean;
  enable_group_call: boolean;
  enable_message_recall: boolean;
  enable_message_edit: boolean;
  max_conference_participants: number;
  max_group_members: number;
  
  // 超时设置
  file_transfer_timeout: number;
  call_timeout: number;
  signal_expiry: number;
  message_recall_timeout: number;
  
  // 网络质量阈值
  network_quality_thresholds: {
    excellent: { bandwidth: number; latency: number; packet_loss: number };
    good: { bandwidth: number; latency: number; packet_loss: number };
    fair: { bandwidth: number; latency: number; packet_loss: number };
    poor: { bandwidth: number; latency: number; packet_loss: number };
  };
  
  // 质量设置
  video_quality: {
    low: MediaQuality;
    medium: MediaQuality;
    high: MediaQuality;
    ultra: MediaQuality;
  };
  audio_quality: {
    low: AudioQuality;
    medium: AudioQuality;
    high: AudioQuality;
  };
  
  // 数据清理配置
  cleanup_config: {
    signal_retention_hours: number;
    call_record_retention_days: number;
    file_cache_retention_days: number;
    read_status_retention_days: number;
  };
  
  // 性能优化配置
  performance_config: {
    message_batch_size: number;
    max_concurrent_transfers: number;
    chunk_upload_concurrency: number;
    enable_message_pagination: boolean;
    cache_message_count: number;
  };
}

export interface MediaQuality {
  width: number;
  height: number;
  framerate: number;
  bitrate: number;
}

export interface AudioQuality {
  bitrate: number;
  sampleRate: number;
}

export interface SystemConfig {
  id: string;
  config_key: string;
  config_value: any;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface ConfigSubscriber {
  callback: (config: RTCConfig) => void;
  id: string;
}

class RTCConfigService {
  private clientGetter: () => Promise<SurrealWorkerAPI> | null = null;
  private cachedConfig: RTCConfig | null = null;
  private subscribers: ConfigSubscriber[] = [];
  private liveQueryUuid: string | null = null;
  private lastUpdateTime: number = 0;
  
  /**
   * 设置客户端获取函数 - 在应用启动时由 SurrealProvider 调用
   */
  setClientGetter(getter: () => Promise<SurrealWorkerAPI>) {
    this.clientGetter = getter;
  }

  /**
   * 获取客户端实例
   */
  private async getClient(): Promise<SurrealWorkerAPI> {
    if (!this.clientGetter) {
      throw new Error('MessageService: clientGetter not set. Please call setClientGetter first.');
    }
    
    const client = await this.clientGetter();
    if (!client) {
      throw new TenantCodeMissingError('无法获取数据库客户端');
    }
    
    return client;
  }

  /**
   * 获取WebRTC配置
   */
  async getRTCConfig(): Promise<RTCConfig> {
    try {
      const client = await this.getClient();
      
      const result = await client.query<SystemConfig[][]>(
        "SELECT * FROM system_config WHERE config_key = 'rtc'"
      );
      
      if (result && result[0] && result[0].length > 0) {
        const config = result[0][0].config_value as RTCConfig;
        this.cachedConfig = config;
        this.lastUpdateTime = Date.now();
        return config;
      }
      
      throw new Error('WebRTC配置未找到');
    } catch (error) {
      console.error('获取WebRTC配置失败:', error);
      
      // 如果有缓存配置且缓存时间不超过5分钟，返回缓存配置
      if (this.cachedConfig && (Date.now() - this.lastUpdateTime < 5 * 60 * 1000)) {
        console.warn('使用缓存的WebRTC配置');
        return this.cachedConfig;
      }
      
      // 返回默认配置
      return this.getDefaultConfig();
    }
  }

  /**
   * 获取默认配置
   */
  getDefaultConfig(): RTCConfig {
    return {
      stun_servers: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'],
      max_file_size: 104857600, // 100MB
      file_chunk_size: 65536,   // 64KB
      supported_image_types: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'],
      supported_video_types: ['mp4', 'webm', 'mov', 'avi', 'wmv'],
      supported_audio_types: ['mp3', 'wav', 'ogg', 'aac', 'm4a'],
      supported_document_types: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt'],
      enable_voice_call: true,
      enable_video_call: true,
      enable_screen_share: true,
      enable_file_transfer: true,
      enable_group_chat: true,
      enable_group_call: true,
      enable_message_recall: true,
      enable_message_edit: true,
      max_conference_participants: 8,
      max_group_members: 100,
      file_transfer_timeout: 300000, // 5分钟
      call_timeout: 30000,          // 30秒
      signal_expiry: 3600000,       // 信令1小时过期
      message_recall_timeout: 120,  // 消息撤回时限(秒)
      network_quality_thresholds: {
        excellent: { bandwidth: 2000, latency: 50, packet_loss: 0.1 },
        good: { bandwidth: 1000, latency: 100, packet_loss: 0.5 },
        fair: { bandwidth: 500, latency: 200, packet_loss: 1.0 },
        poor: { bandwidth: 200, latency: 300, packet_loss: 2.0 }
      },
      video_quality: {
        low: { width: 320, height: 240, framerate: 15, bitrate: 150000 },
        medium: { width: 640, height: 480, framerate: 24, bitrate: 500000 },
        high: { width: 1280, height: 720, framerate: 30, bitrate: 1000000 },
        ultra: { width: 1920, height: 1080, framerate: 30, bitrate: 2000000 }
      },
      audio_quality: {
        low: { bitrate: 32000, sampleRate: 16000 },
        medium: { bitrate: 64000, sampleRate: 44100 },
        high: { bitrate: 128000, sampleRate: 48000 }
      },
      cleanup_config: {
        signal_retention_hours: 24,
        call_record_retention_days: 365,
        file_cache_retention_days: 30,
        read_status_retention_days: 90
      },
      performance_config: {
        message_batch_size: 50,
        max_concurrent_transfers: 3,
        chunk_upload_concurrency: 2,
        enable_message_pagination: true,
        cache_message_count: 100
      }
    };
  }

  /**
   * 缓存配置到本地存储
   */
  cacheConfigLocally(config: RTCConfig): void {
    try {
      localStorage.setItem('rtc_config', JSON.stringify(config));
      localStorage.setItem('rtc_config_timestamp', Date.now().toString());
      this.cachedConfig = config;
      this.lastUpdateTime = Date.now();
    } catch (error) {
      console.warn('缓存WebRTC配置到本地存储失败:', error);
    }
  }

  /**
   * 从本地存储获取缓存配置
   */
  getCachedConfig(): RTCConfig | null {
    try {
      const configStr = localStorage.getItem('rtc_config');
      const timestampStr = localStorage.getItem('rtc_config_timestamp');
      
      if (!configStr || !timestampStr) {
        return null;
      }
      
      const timestamp = parseInt(timestampStr);
      const now = Date.now();
      
      // 缓存超过1小时则失效
      if (now - timestamp > 60 * 60 * 1000) {
        this.clearLocalCache();
        return null;
      }
      
      const config = JSON.parse(configStr) as RTCConfig;
      this.cachedConfig = config;
      this.lastUpdateTime = timestamp;
      
      return config;
    } catch (error) {
      console.warn('从本地存储获取WebRTC配置失败:', error);
      this.clearLocalCache();
      return null;
    }
  }

  /**
   * 清除本地缓存
   */
  clearLocalCache(): void {
    try {
      localStorage.removeItem('rtc_config');
      localStorage.removeItem('rtc_config_timestamp');
    } catch (error) {
      console.warn('清除本地WebRTC配置缓存失败:', error);
    }
  }

  /**
   * 订阅配置变更
   */
  onConfigUpdate(callback: (config: RTCConfig) => void): string {
    const id = Math.random().toString(36).substr(2, 9);
    this.subscribers.push({ callback, id });
    
    // 如果还没有启动live query，启动一个
    if (!this.liveQueryUuid) {
      this.startLiveQuery();
    }
    
    return id;
  }

  /**
   * 取消订阅配置变更
   */
  unsubscribeConfigUpdate(id: string): void {
    this.subscribers = this.subscribers.filter(sub => sub.id !== id);
    
    // 如果没有订阅者了，停止live query
    if (this.subscribers.length === 0 && this.liveQueryUuid) {
      this.stopLiveQuery();
    }
  }

  /**
   * 启动Live Query监听配置变更
   */
  private async startLiveQuery(): Promise<void> {
    try {
      const client = await this.getClient();
      
      const uuid = await client.live(
        "SELECT * FROM system_config WHERE config_key = 'rtc'",
        (action: string, result: SystemConfig) => {
          if (action === 'UPDATE' && result?.config_value) {
            const newConfig = result.config_value as RTCConfig;
            this.cachedConfig = newConfig;
            this.lastUpdateTime = Date.now();
            this.cacheConfigLocally(newConfig);
            
            // 通知所有订阅者
            this.subscribers.forEach(sub => {
              try {
                sub.callback(newConfig);
              } catch (error) {
                console.error('通知配置变更订阅者失败:', error);
              }
            });
          }
        }
      );
      
      this.liveQueryUuid = uuid;
    } catch (error) {
      console.error('启动WebRTC配置Live Query失败:', error);
    }
  }

  /**
   * 停止Live Query
   */
  private async stopLiveQuery(): Promise<void> {
    if (!this.liveQueryUuid) {
      return;
    }
    
    try {
      const client = await this.getClient();
      await client.kill(this.liveQueryUuid);
      this.liveQueryUuid = null;
    } catch (error) {
      console.error('停止WebRTC配置Live Query失败:', error);
    }
  }

  /**
   * 更新配置（仅管理员可用）
   */
  async updateConfig(config: Partial<RTCConfig>): Promise<void> {
    try {
      const client = await this.getClient();
      
      // 获取当前配置
      const currentConfig = await this.getRTCConfig();
      
      // 合并配置
      const newConfig = { ...currentConfig, ...config };
      
      // 更新数据库
      await client.query(
        "UPDATE system_config SET config_value = $config, updated_at = time::now() WHERE config_key = 'rtc'",
        { config: newConfig }
      );
      
      // 更新本地缓存
      this.cachedConfig = newConfig;
      this.lastUpdateTime = Date.now();
      this.cacheConfigLocally(newConfig);
      
    } catch (error) {
      console.error('更新WebRTC配置失败:', error);
      throw error;
    }
  }

  /**
   * 检查是否支持特定文件类型
   */
  isFileTypeSupported(fileName: string, config?: RTCConfig): boolean {
    const rtcConfig = config || this.cachedConfig;
    if (!rtcConfig) {
      return false;
    }
    
    const extension = fileName.split('.').pop()?.toLowerCase();
    if (!extension) {
      return false;
    }
    
    const allSupportedTypes = [
      ...rtcConfig.supported_image_types,
      ...rtcConfig.supported_video_types,
      ...rtcConfig.supported_audio_types,
      ...rtcConfig.supported_document_types
    ];
    
    return allSupportedTypes.includes(extension);
  }

  /**
   * 检查文件大小是否超过限制
   */
  isFileSizeValid(fileSize: number, config?: RTCConfig): boolean {
    const rtcConfig = config || this.cachedConfig;
    if (!rtcConfig) {
      return false;
    }
    
    return fileSize <= rtcConfig.max_file_size;
  }

  /**
   * 获取当前网络质量等级
   */
  getNetworkQualityLevel(bandwidth: number, latency: number, packetLoss: number, config?: RTCConfig): string {
    const rtcConfig = config || this.cachedConfig;
    if (!rtcConfig) {
      return 'unknown';
    }
    
    const thresholds = rtcConfig.network_quality_thresholds;
    
    if (bandwidth >= thresholds.excellent.bandwidth && 
        latency <= thresholds.excellent.latency && 
        packetLoss <= thresholds.excellent.packet_loss) {
      return 'excellent';
    }
    
    if (bandwidth >= thresholds.good.bandwidth && 
        latency <= thresholds.good.latency && 
        packetLoss <= thresholds.good.packet_loss) {
      return 'good';
    }
    
    if (bandwidth >= thresholds.fair.bandwidth && 
        latency <= thresholds.fair.latency && 
        packetLoss <= thresholds.fair.packet_loss) {
      return 'fair';
    }
    
    return 'poor';
  }

  /**
   * 销毁服务，清理资源
   */
  destroy(): void {
    this.subscribers = [];
    if (this.liveQueryUuid) {
      this.stopLiveQuery();
    }
    this.cachedConfig = null;
  }
}

// 创建单例实例
const rtcConfigService = new RTCConfigService();

// 导出服务实例和类型
export default rtcConfigService;
export { RTCConfigService };