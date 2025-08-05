import rtcConfigManager, { RTCConfig, NetworkQualityThresholds, VideoQuality, AudioQuality } from './rtcConfigManager';

// 网络质量级别
export type NetworkQualityLevel = 'excellent' | 'good' | 'fair' | 'poor' | 'critical';

// 网络质量指标
export interface NetworkQualityMetrics {
  bandwidth: number; // Kbps
  latency: number; // ms
  packetLoss: number; // percentage (0-1)
  jitter: number; // ms
  measurementTime: number; // timestamp
}

// 网络质量状态
export interface NetworkQualityState {
  level: NetworkQualityLevel;
  metrics: NetworkQualityMetrics;
  recommendedVideoQuality: keyof VideoQuality;
  recommendedAudioQuality: keyof AudioQuality;
  shouldAdjustQuality: boolean;
  adaptationReason: string;
}

// 自适应配置
export interface AdaptationConfig {
  enableVideoAdaptation: boolean;
  enableAudioAdaptation: boolean;
  measurementInterval: number; // ms
  adaptationThreshold: number; // 0-1
  stabilityDuration: number; // ms - 稳定多久后才触发调整
  maxAdaptationsPerMinute: number;
}

// 连接统计信息
export interface ConnectionStats {
  bytesReceived: number;
  bytesSent: number;
  packetsReceived: number;
  packetsSent: number;
  packetsLost: number;
  framesDecoded: number;
  framesDropped: number;
  currentRoundTripTime: number;
  availableOutgoingBitrate: number;
  availableIncomingBitrate: number;
}

// 质量调整历史记录
export interface QualityAdjustmentHistory {
  timestamp: number;
  from: {
    videoQuality: keyof VideoQuality;
    audioQuality: keyof AudioQuality;
  };
  to: {
    videoQuality: keyof VideoQuality;
    audioQuality: keyof AudioQuality;
  };
  reason: string;
  networkLevel: NetworkQualityLevel;
}

// 事件监听器接口
export interface NetworkAdaptationEventListeners {
  onQualityChanged?: (state: NetworkQualityState) => void;
  onNetworkIssueDetected?: (issue: string, metrics: NetworkQualityMetrics) => void;
  onAdaptationApplied?: (adjustment: QualityAdjustmentHistory) => void;
  onStatsUpdated?: (stats: ConnectionStats) => void;
}

/**
 * NetworkAdaptation - 网络自适应服务
 * 实现网络质量检测、视频质量自动调整、网络状况监控等功能
 */
class NetworkAdaptation {
  private config: RTCConfig | null = null;
  private adaptationConfig: AdaptationConfig = {
    enableVideoAdaptation: true,
    enableAudioAdaptation: true,
    measurementInterval: 5000, // 5秒
    adaptationThreshold: 0.3, // 30%的性能下降触发调整
    stabilityDuration: 10000, // 10秒稳定期
    maxAdaptationsPerMinute: 5
  };

  private listeners: NetworkAdaptationEventListeners = {};
  private isMonitoring: boolean = false;
  private measurementTimer: NodeJS.Timeout | null = null;
  private stabilityTimer: NodeJS.Timeout | null = null;
  
  // 状态管理
  private currentQualityState: NetworkQualityState | null = null;
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private qualityHistory: QualityAdjustmentHistory[] = [];
  private lastAdaptationTime: number = 0;
  private adaptationCount: number = 0;
  private adaptationCountResetTime: number = Date.now();
  
  // 网络指标历史
  private metricsHistory: NetworkQualityMetrics[] = [];
  private readonly MAX_HISTORY_LENGTH = 20; // 保留最近20次测量

  constructor() {
    this.initialize();
  }

  /**
   * 初始化网络自适应服务
   */
  private async initialize(): Promise<void> {
    try {
      this.config = await rtcConfigManager.getConfig();
      
      // 监听配置变更
      rtcConfigManager.onConfigUpdate((newConfig) => {
        this.config = newConfig;
        console.log('NetworkAdaptation: 配置已更新');
      });

      console.log('NetworkAdaptation: 初始化完成');
    } catch (error) {
      console.error('NetworkAdaptation: 初始化失败', error);
      throw error;
    }
  }

  /**
   * 设置事件监听器
   */
  setEventListeners(listeners: NetworkAdaptationEventListeners): void {
    this.listeners = { ...this.listeners, ...listeners };
  }

  /**
   * 设置自适应配置
   */
  setAdaptationConfig(config: Partial<AdaptationConfig>): void {
    this.adaptationConfig = { ...this.adaptationConfig, ...config };
    console.log('NetworkAdaptation: 自适应配置已更新', this.adaptationConfig);
  }

  /**
   * 添加要监控的RTCPeerConnection
   */
  addPeerConnection(connectionId: string, peerConnection: RTCPeerConnection): void {
    this.peerConnections.set(connectionId, peerConnection);
    console.log(`NetworkAdaptation: 添加连接监控 ${connectionId}`);
    
    // 如果还没有开始监控，启动监控
    if (!this.isMonitoring) {
      this.startMonitoring();
    }
  }

  /**
   * 移除RTCPeerConnection监控
   */
  removePeerConnection(connectionId: string): void {
    this.peerConnections.delete(connectionId);
    console.log(`NetworkAdaptation: 移除连接监控 ${connectionId}`);
    
    // 如果没有连接了，停止监控
    if (this.peerConnections.size === 0) {
      this.stopMonitoring();
    }
  }

  /**
   * 开始网络质量监控
   */
  startMonitoring(): void {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    this.scheduleNextMeasurement();
    console.log('NetworkAdaptation: 开始网络质量监控');
  }

  /**
   * 停止网络质量监控
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) return;
    
    this.isMonitoring = false;
    
    if (this.measurementTimer) {
      clearTimeout(this.measurementTimer);
      this.measurementTimer = null;
    }
    
    if (this.stabilityTimer) {
      clearTimeout(this.stabilityTimer);
      this.stabilityTimer = null;
    }
    
    console.log('NetworkAdaptation: 停止网络质量监控');
  }

  /**
   * 安排下次测量
   */
  private scheduleNextMeasurement(): void {
    if (!this.isMonitoring) return;
    
    this.measurementTimer = setTimeout(async () => {
      try {
        await this.measureNetworkQuality();
        this.scheduleNextMeasurement();
      } catch (error) {
        console.error('NetworkAdaptation: 网络质量测量失败', error);
        this.scheduleNextMeasurement(); // 即使失败也继续监控
      }
    }, this.adaptationConfig.measurementInterval);
  }

  /**
   * 测量网络质量
   */
  private async measureNetworkQuality(): Promise<void> {
    if (this.peerConnections.size === 0) return;

    try {
      // 收集所有连接的统计信息
      const allStats: ConnectionStats[] = [];
      
      for (const [connectionId, peerConnection] of this.peerConnections) {
        try {
          const stats = await this.collectConnectionStats(peerConnection);
          allStats.push(stats);
        } catch (error) {
          console.warn(`NetworkAdaptation: 收集连接统计失败 ${connectionId}`, error);
        }
      }

      if (allStats.length === 0) return;

      // 计算综合网络指标
      const aggregatedMetrics = this.aggregateNetworkMetrics(allStats);
      
      // 添加到历史记录
      this.metricsHistory.push(aggregatedMetrics);
      if (this.metricsHistory.length > this.MAX_HISTORY_LENGTH) {
        this.metricsHistory.shift();
      }

      // 分析网络质量
      const qualityLevel = this.analyzeNetworkQuality(aggregatedMetrics);
      
      // 获取推荐的质量设置
      const recommendedSettings = this.getRecommendedQualitySettings(qualityLevel, aggregatedMetrics);
      
      // 创建新的质量状态
      const newQualityState: NetworkQualityState = {
        level: qualityLevel,
        metrics: aggregatedMetrics,
        recommendedVideoQuality: recommendedSettings.videoQuality,
        recommendedAudioQuality: recommendedSettings.audioQuality,
        shouldAdjustQuality: this.shouldTriggerAdaptation(qualityLevel, aggregatedMetrics),
        adaptationReason: this.getAdaptationReason(qualityLevel, aggregatedMetrics)
      };

      // 检查是否需要质量调整
      if (newQualityState.shouldAdjustQuality && this.canPerformAdaptation()) {
        await this.performQualityAdaptation(newQualityState);
      }

      // 更新当前状态
      this.currentQualityState = newQualityState;
      
      // 触发事件
      this.listeners.onQualityChanged?.(newQualityState);
      
      // 检测网络问题
      this.detectNetworkIssues(aggregatedMetrics);

    } catch (error) {
      console.error('NetworkAdaptation: 网络质量测量过程失败', error);
    }
  }

  /**
   * 收集单个连接的统计信息
   */
  private async collectConnectionStats(peerConnection: RTCPeerConnection): Promise<ConnectionStats> {
    const stats = await peerConnection.getStats();
    
    let bytesReceived = 0;
    let bytesSent = 0;
    let packetsReceived = 0;
    let packetsSent = 0;
    let packetsLost = 0;
    let framesDecoded = 0;
    let framesDropped = 0;
    let currentRoundTripTime = 0;
    let availableOutgoingBitrate = 0;
    let availableIncomingBitrate = 0;

    if (stats && typeof stats.forEach === 'function') {
      stats.forEach((report) => {
      switch (report.type) {
        case 'inbound-rtp':
          if (report.mediaType === 'video' || report.mediaType === 'audio') {
            bytesReceived += report.bytesReceived || 0;
            packetsReceived += report.packetsReceived || 0;
            packetsLost += report.packetsLost || 0;
            
            if (report.mediaType === 'video') {
              framesDecoded += report.framesDecoded || 0;
              framesDropped += report.framesDropped || 0;
            }
          }
          break;
          
        case 'outbound-rtp':
          if (report.mediaType === 'video' || report.mediaType === 'audio') {
            bytesSent += report.bytesSent || 0;
            packetsSent += report.packetsSent || 0;
          }
          break;
          
        case 'candidate-pair':
          if (report.state === 'succeeded') {
            currentRoundTripTime = Math.max(currentRoundTripTime, report.currentRoundTripTime || 0);
            availableOutgoingBitrate = Math.max(availableOutgoingBitrate, report.availableOutgoingBitrate || 0);
            availableIncomingBitrate = Math.max(availableIncomingBitrate, report.availableIncomingBitrate || 0);
          }
          break;
      }
      });
    }

    return {
      bytesReceived,
      bytesSent,
      packetsReceived,
      packetsSent,
      packetsLost,
      framesDecoded,
      framesDropped,
      currentRoundTripTime, // 保持原始值，在聚合时处理单位转换
      availableOutgoingBitrate,
      availableIncomingBitrate
    };
  }

  /**
   * 聚合多个连接的网络指标
   */
  private aggregateNetworkMetrics(statsArray: ConnectionStats[]): NetworkQualityMetrics {
    if (statsArray.length === 0) {
      return {
        bandwidth: 0,
        latency: 0,
        packetLoss: 0,
        jitter: 0,
        measurementTime: Date.now()
      };
    }

    // 计算总带宽（取可用带宽的平均值）
    const totalOutgoingBandwidth = statsArray.reduce((sum, stats) => sum + stats.availableOutgoingBitrate, 0);
    const totalIncomingBandwidth = statsArray.reduce((sum, stats) => sum + stats.availableIncomingBitrate, 0);
    const avgBandwidth = (totalOutgoingBandwidth + totalIncomingBandwidth) / (2 * statsArray.length) / 1000; // 转换为Kbps

    // 计算平均延迟（从秒转换为毫秒）
    const avgLatency = statsArray.reduce((sum, stats) => sum + stats.currentRoundTripTime * 1000, 0) / statsArray.length;

    // 计算丢包率
    const totalPacketsSent = statsArray.reduce((sum, stats) => sum + stats.packetsSent, 0);
    const totalPacketsLost = statsArray.reduce((sum, stats) => sum + stats.packetsLost, 0);
    const packetLoss = totalPacketsSent > 0 ? totalPacketsLost / totalPacketsSent : 0;

    // 计算抖动（简化计算）
    const jitter = this.calculateJitter();

    return {
      bandwidth: avgBandwidth,
      latency: avgLatency,
      packetLoss,
      jitter,
      measurementTime: Date.now()
    };
  }

  /**
   * 计算网络抖动
   */
  private calculateJitter(): number {
    if (this.metricsHistory.length < 2) return 0;

    const latencies = this.metricsHistory.slice(-5).map(m => m.latency); // 取最近5次测量
    if (latencies.length < 2) return 0;

    // 计算延迟变化的标准差作为抖动指标
    const avg = latencies.reduce((sum, val) => sum + val, 0) / latencies.length;
    const variance = latencies.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / latencies.length;
    
    return Math.sqrt(variance);
  }

  /**
   * 分析网络质量级别
   */
  private analyzeNetworkQuality(metrics: NetworkQualityMetrics): NetworkQualityLevel {
    if (!this.config) return 'poor';

    const thresholds = this.config.network_quality_thresholds;
    
    // 按优先级检查各个级别
    if (this.meetsQualityThreshold(metrics, thresholds.excellent)) {
      return 'excellent';
    } else if (this.meetsQualityThreshold(metrics, thresholds.good)) {
      return 'good';
    } else if (this.meetsQualityThreshold(metrics, thresholds.fair)) {
      return 'fair';
    } else if (this.meetsQualityThreshold(metrics, thresholds.poor)) {
      return 'poor';
    } else {
      return 'critical';
    }
  }

  /**
   * 检查是否满足质量阈值
   */
  private meetsQualityThreshold(metrics: NetworkQualityMetrics, threshold: NetworkQualityThresholds[keyof NetworkQualityThresholds]): boolean {
    return (
      metrics.bandwidth >= threshold.bandwidth &&
      metrics.latency <= threshold.latency &&
      metrics.packetLoss <= threshold.packet_loss
    );
  }

  /**
   * 获取推荐的质量设置
   */
  private getRecommendedQualitySettings(qualityLevel: NetworkQualityLevel, metrics: NetworkQualityMetrics): {
    videoQuality: keyof VideoQuality;
    audioQuality: keyof AudioQuality;
  } {
    // 根据网络质量级别推荐设置
    switch (qualityLevel) {
      case 'excellent':
        return { videoQuality: 'ultra', audioQuality: 'high' };
      case 'good':
        return { videoQuality: 'high', audioQuality: 'high' };
      case 'fair':
        return { videoQuality: 'medium', audioQuality: 'medium' };
      case 'poor':
        return { videoQuality: 'low', audioQuality: 'medium' };
      case 'critical':
        return { videoQuality: 'low', audioQuality: 'low' };
      default:
        return { videoQuality: 'medium', audioQuality: 'medium' };
    }
  }

  /**
   * 判断是否应该触发自适应调整
   */
  private shouldTriggerAdaptation(qualityLevel: NetworkQualityLevel, metrics: NetworkQualityMetrics): boolean {
    if (!this.currentQualityState) return true; // 首次设置

    // 如果质量级别有显著变化
    const levelChanged = this.currentQualityState.level !== qualityLevel;
    
    // 如果网络指标有显著恶化
    const significantDegradation = this.hasSignificantDegradation(metrics);
    
    // 如果有明显的网络问题
    const hasNetworkIssues = qualityLevel === 'critical' || metrics.packetLoss > 0.1;

    return levelChanged || significantDegradation || hasNetworkIssues;
  }

  /**
   * 检查是否有显著的网络性能恶化
   */
  private hasSignificantDegradation(currentMetrics: NetworkQualityMetrics): boolean {
    if (!this.currentQualityState) return false;

    const previousMetrics = this.currentQualityState.metrics;
    const threshold = this.adaptationConfig.adaptationThreshold;

    // 检查带宽下降
    const bandwidthDrop = (previousMetrics.bandwidth - currentMetrics.bandwidth) / previousMetrics.bandwidth;
    
    // 检查延迟增加
    const latencyIncrease = (currentMetrics.latency - previousMetrics.latency) / previousMetrics.latency;
    
    // 检查丢包率增加
    const packetLossIncrease = currentMetrics.packetLoss - previousMetrics.packetLoss;

    return (
      bandwidthDrop > threshold ||
      latencyIncrease > threshold ||
      packetLossIncrease > threshold
    );
  }

  /**
   * 获取自适应调整原因
   */
  private getAdaptationReason(qualityLevel: NetworkQualityLevel, metrics: NetworkQualityMetrics): string {
    if (!this.currentQualityState) return '初始质量设置';

    const previousLevel = this.currentQualityState.level;
    const previousMetrics = this.currentQualityState.metrics;

    if (qualityLevel !== previousLevel) {
      return `网络质量从 ${previousLevel} 变化到 ${qualityLevel}`;
    }

    if (metrics.bandwidth < previousMetrics.bandwidth * 0.7) {
      return '带宽显著下降';
    }

    if (metrics.latency > previousMetrics.latency * 1.5) {
      return '网络延迟显著增加';
    }

    if (metrics.packetLoss > previousMetrics.packetLoss + 0.05) {
      return '丢包率显著增加';
    }

    return '网络状况变化';
  }

  /**
   * 检查是否可以执行自适应调整
   */
  private canPerformAdaptation(): boolean {
    const now = Date.now();
    
    // 重置计数器（每分钟）
    if (now - this.adaptationCountResetTime > 60000) {
      this.adaptationCount = 0;
      this.adaptationCountResetTime = now;
    }
    
    // 检查调整频率限制
    if (this.adaptationCount >= this.adaptationConfig.maxAdaptationsPerMinute) {
      return false;
    }
    
    // 检查稳定期
    if (now - this.lastAdaptationTime < this.adaptationConfig.stabilityDuration) {
      return false;
    }
    
    return true;
  }

  /**
   * 执行质量自适应调整
   */
  private async performQualityAdaptation(qualityState: NetworkQualityState): Promise<void> {
    if (!this.adaptationConfig.enableVideoAdaptation && !this.adaptationConfig.enableAudioAdaptation) {
      return;
    }

    try {
      const previousState = this.currentQualityState;
      
      // 记录调整历史
      const adjustment: QualityAdjustmentHistory = {
        timestamp: Date.now(),
        from: {
          videoQuality: previousState?.recommendedVideoQuality || 'medium',
          audioQuality: previousState?.recommendedAudioQuality || 'medium'
        },
        to: {
          videoQuality: qualityState.recommendedVideoQuality,
          audioQuality: qualityState.recommendedAudioQuality
        },
        reason: qualityState.adaptationReason,
        networkLevel: qualityState.level
      };

      // 添加到历史记录
      this.qualityHistory.push(adjustment);
      if (this.qualityHistory.length > 50) { // 保留最近50次调整
        this.qualityHistory.shift();
      }

      // 更新调整计数和时间
      this.adaptationCount++;
      this.lastAdaptationTime = Date.now();

      // 触发自适应调整事件
      this.listeners.onAdaptationApplied?.(adjustment);

      console.log('NetworkAdaptation: 执行质量自适应调整', adjustment);

    } catch (error) {
      console.error('NetworkAdaptation: 质量自适应调整失败', error);
    }
  }

  /**
   * 检测网络问题
   */
  private detectNetworkIssues(metrics: NetworkQualityMetrics): void {
    const issues: string[] = [];

    // 高延迟检测：超过300ms认为延迟过高
    if (metrics.latency > 300) {
      issues.push('网络延迟过高');
    }

    // 高丢包率检测：超过5%认为丢包率过高
    if (metrics.packetLoss > 0.05) {
      issues.push('丢包率过高');
    }

    // 低带宽检测：低于100Kbps认为带宽不足
    if (metrics.bandwidth < 100) {
      issues.push('可用带宽不足');
    }

    // 网络抖动检测：超过50ms认为抖动严重
    if (metrics.jitter > 50) {
      issues.push('网络抖动严重');
    }

    if (issues.length > 0) {
      const issueDescription = issues.join(', ');
      this.listeners.onNetworkIssueDetected?.(issueDescription, metrics);
      console.warn('NetworkAdaptation: 检测到网络问题', issueDescription, metrics);
    }
  }

  /**
   * 获取当前网络质量状态
   */
  getCurrentQualityState(): NetworkQualityState | null {
    return this.currentQualityState;
  }

  /**
   * 获取网络指标历史
   */
  getMetricsHistory(): NetworkQualityMetrics[] {
    return [...this.metricsHistory];
  }

  /**
   * 获取质量调整历史
   */
  getQualityAdjustmentHistory(): QualityAdjustmentHistory[] {
    return [...this.qualityHistory];
  }

  /**
   * 手动触发网络质量测量
   */
  async measureNetworkQualityManual(): Promise<NetworkQualityState | null> {
    try {
      await this.measureNetworkQuality();
      return this.currentQualityState;
    } catch (error) {
      console.error('NetworkAdaptation: 手动测量网络质量失败', error);
      return null;
    }
  }

  /**
   * 重置自适应状态
   */
  resetAdaptationState(): void {
    this.currentQualityState = null;
    this.metricsHistory.length = 0;
    this.qualityHistory.length = 0;
    this.lastAdaptationTime = 0;
    this.adaptationCount = 0;
    this.adaptationCountResetTime = Date.now();
    
    console.log('NetworkAdaptation: 自适应状态已重置');
  }

  /**
   * 销毁网络自适应服务
   */
  destroy(): void {
    console.log('NetworkAdaptation: 开始销毁...');
    
    this.stopMonitoring();
    this.peerConnections.clear();
    this.listeners = {};
    this.resetAdaptationState();
    
    console.log('NetworkAdaptation: 销毁完成');
  }
}

// 创建单例实例
const networkAdaptation = new NetworkAdaptation();

// 导出服务实例和类型
export default networkAdaptation;
export { NetworkAdaptation };