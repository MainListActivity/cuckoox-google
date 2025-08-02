import rtcConfigManager, { RTCConfig } from './rtcConfigManager';

// WebRTC连接状态
export type ConnectionState = 'new' | 'connecting' | 'connected' | 'disconnected' | 'failed' | 'closed';

// 媒体约束类型
export interface MediaConstraints {
  audio?: boolean | MediaTrackConstraints;
  video?: boolean | MediaTrackConstraints;
}

// ICE候选信息
export interface IceCandidate {
  candidate: string;
  sdpMLineIndex: number | null;
  sdpMid: string | null;
  usernameFragment: string | null;
}

// 会话描述信息
export interface SessionDescription {
  type: 'offer' | 'answer' | 'pranswer' | 'rollback';
  sdp: string;
}

// 连接信息
export interface PeerConnectionInfo {
  id: string;
  userId: string;
  connection: RTCPeerConnection;
  dataChannel?: RTCDataChannel;
  localStream?: MediaStream;
  remoteStream?: MediaStream;
  state: ConnectionState;
  isInitiator: boolean;
  createdAt: number;
  lastActivity: number;
}

// 媒体设备信息
export interface MediaDeviceInfo {
  deviceId: string;
  kind: 'audioinput' | 'audiooutput' | 'videoinput';
  label: string;
  groupId: string;
}

// 事件监听器类型
export interface WebRTCEventListeners {
  onConnectionStateChange?: (userId: string, state: ConnectionState) => void;
  onRemoteStream?: (userId: string, stream: MediaStream) => void;
  onDataChannelMessage?: (userId: string, message: any) => void;
  onDataChannelOpen?: (userId: string) => void;
  onDataChannelClose?: (userId: string) => void;
  onIceCandidate?: (userId: string, candidate: IceCandidate) => void;
  onError?: (userId: string, error: Error) => void;
}

/**
 * WebRTCManager - WebRTC核心管理器
 * 负责RTCPeerConnection的创建、管理、ICE候选处理和媒体流管理
 */
class WebRTCManager {
  private connections: Map<string, PeerConnectionInfo> = new Map();
  private config: RTCConfig | null = null;
  private listeners: WebRTCEventListeners = {};
  private isInitialized: boolean = false;
  private cleanupInterval: number | null = null;

  constructor() {
    this.initialize();
  }

  /**
   * 初始化WebRTC管理器
   */
  private async initialize(): Promise<void> {
    try {
      // 获取配置
      this.config = await rtcConfigManager.getConfig();
      
      // 监听配置变更
      rtcConfigManager.onConfigUpdate((newConfig) => {
        this.config = newConfig;
        console.log('WebRTCManager: 配置已更新');
      });

      // 启动连接清理定时器
      this.startCleanupTimer();

      this.isInitialized = true;
      console.log('WebRTCManager: 初始化完成');
    } catch (error) {
      console.error('WebRTCManager: 初始化失败', error);
      throw error;
    }
  }

  /**
   * 设置事件监听器
   */
  setEventListeners(listeners: WebRTCEventListeners): void {
    this.listeners = { ...this.listeners, ...listeners };
  }

  /**
   * 创建点对点连接
   */
  async createPeerConnection(userId: string, isInitiator: boolean = false): Promise<string> {
    if (!this.isInitialized || !this.config) {
      throw new Error('WebRTCManager未初始化');
    }

    // 如果连接已存在，先关闭旧连接
    if (this.connections.has(userId)) {
      await this.closePeerConnection(userId);
    }

    try {
      // 创建RTCPeerConnection配置
      const rtcConfig: RTCConfiguration = {
        iceServers: this.config.stun_servers.map(url => ({ urls: url })),
        iceCandidatePoolSize: 10,
        bundlePolicy: 'balanced',
        rtcpMuxPolicy: 'require',
        iceTransportPolicy: 'all'
      };

      // 创建连接
      const connection = new RTCPeerConnection(rtcConfig);
      const connectionId = `${userId}-${Date.now()}`;

      // 创建连接信息
      const connectionInfo: PeerConnectionInfo = {
        id: connectionId,
        userId,
        connection,
        state: 'new',
        isInitiator,
        createdAt: Date.now(),
        lastActivity: Date.now()
      };

      // 设置事件监听器
      this.setupPeerConnectionListeners(connectionInfo);

      // 如果是发起方，创建数据通道
      if (isInitiator) {
        connectionInfo.dataChannel = connection.createDataChannel('fileTransfer', {
          ordered: true,
          maxRetransmits: 3
        });
        this.setupDataChannelListeners(connectionInfo, connectionInfo.dataChannel);
      } else {
        // 接收方监听数据通道
        connection.ondatachannel = (event) => {
          connectionInfo.dataChannel = event.channel;
          this.setupDataChannelListeners(connectionInfo, event.channel);
        };
      }

      // 保存连接信息
      this.connections.set(userId, connectionInfo);

      console.log(`WebRTCManager: 已创建连接 ${connectionId} for user ${userId}`);
      return connectionId;

    } catch (error) {
      console.error(`WebRTCManager: 创建连接失败 for user ${userId}`, error);
      throw error;
    }
  }

  /**
   * 设置PeerConnection事件监听器
   */
  private setupPeerConnectionListeners(connectionInfo: PeerConnectionInfo): void {
    const { connection, userId } = connectionInfo;

    // 连接状态变化
    connection.onconnectionstatechange = () => {
      const newState = connection.connectionState as ConnectionState;
      connectionInfo.state = newState;
      connectionInfo.lastActivity = Date.now();

      console.log(`WebRTCManager: 连接状态变化 ${userId}: ${newState}`);
      this.listeners.onConnectionStateChange?.(userId, newState);

      // 如果连接失败或关闭，清理连接
      if (newState === 'failed' || newState === 'closed') {
        setTimeout(() => this.closePeerConnection(userId), 1000);
      }
    };

    // ICE候选
    connection.onicecandidate = (event) => {
      if (event.candidate) {
        const candidate: IceCandidate = {
          candidate: event.candidate.candidate,
          sdpMLineIndex: event.candidate.sdpMLineIndex,
          sdpMid: event.candidate.sdpMid,
          usernameFragment: event.candidate.usernameFragment
        };

        console.log(`WebRTCManager: 发现ICE候选 ${userId}`);
        this.listeners.onIceCandidate?.(userId, candidate);
      }
    };

    // 远程媒体流
    connection.ontrack = (event) => {
      console.log(`WebRTCManager: 收到远程媒体流 ${userId}`);
      const [stream] = event.streams;
      connectionInfo.remoteStream = stream;
      this.listeners.onRemoteStream?.(userId, stream);
    };

    // ICE连接状态变化
    connection.oniceconnectionstatechange = () => {
      console.log(`WebRTCManager: ICE连接状态 ${userId}: ${connection.iceConnectionState}`);
      connectionInfo.lastActivity = Date.now();
    };

    // 错误处理
    connection.onerror = (event) => {
      console.error(`WebRTCManager: 连接错误 ${userId}`, event);
      this.listeners.onError?.(userId, new Error('PeerConnection错误'));
    };
  }

  /**
   * 设置DataChannel事件监听器
   */
  private setupDataChannelListeners(connectionInfo: PeerConnectionInfo, dataChannel: RTCDataChannel): void {
    const { userId } = connectionInfo;

    dataChannel.onopen = () => {
      console.log(`WebRTCManager: 数据通道打开 ${userId}`);
      connectionInfo.lastActivity = Date.now();
      this.listeners.onDataChannelOpen?.(userId);
    };

    dataChannel.onclose = () => {
      console.log(`WebRTCManager: 数据通道关闭 ${userId}`);
      connectionInfo.lastActivity = Date.now();
      this.listeners.onDataChannelClose?.(userId);
    };

    dataChannel.onmessage = (event) => {
      console.log(`WebRTCManager: 收到数据通道消息 ${userId}`);
      connectionInfo.lastActivity = Date.now();
      
      try {
        const message = JSON.parse(event.data);
        this.listeners.onDataChannelMessage?.(userId, message);
      } catch (error) {
        // 如果不是JSON，直接传递原始数据
        this.listeners.onDataChannelMessage?.(userId, event.data);
      }
    };

    dataChannel.onerror = (error) => {
      console.error(`WebRTCManager: 数据通道错误 ${userId}`, error);
      this.listeners.onError?.(userId, new Error('DataChannel错误'));
    };
  }

  /**
   * 获取用户媒体流
   */
  async getUserMedia(constraints: MediaConstraints): Promise<MediaStream> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('WebRTCManager: 获取用户媒体流成功', constraints);
      return stream;
    } catch (error) {
      console.error('WebRTCManager: 获取用户媒体流失败', error);
      throw new Error(`获取媒体流失败: ${error}`);
    }
  }

  /**
   * 获取屏幕共享流
   */
  async getDisplayMedia(constraints?: MediaStreamConstraints): Promise<MediaStream> {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia(constraints || { video: true, audio: true });
      console.log('WebRTCManager: 获取屏幕共享流成功');
      return stream;
    } catch (error) {
      console.error('WebRTCManager: 获取屏幕共享流失败', error);
      throw new Error(`获取屏幕共享失败: ${error}`);
    }
  }

  /**
   * 添加本地媒体流到连接
   */
  async addLocalStream(userId: string, stream: MediaStream): Promise<void> {
    const connectionInfo = this.connections.get(userId);
    if (!connectionInfo) {
      throw new Error(`连接不存在: ${userId}`);
    }

    try {
      // 添加所有轨道到连接
      stream.getTracks().forEach(track => {
        connectionInfo.connection.addTrack(track, stream);
      });

      connectionInfo.localStream = stream;
      connectionInfo.lastActivity = Date.now();

      console.log(`WebRTCManager: 已添加本地媒体流 ${userId}`);
    } catch (error) {
      console.error(`WebRTCManager: 添加本地媒体流失败 ${userId}`, error);
      throw error;
    }
  }

  /**
   * 移除本地媒体流
   */
  async removeLocalStream(userId: string): Promise<void> {
    const connectionInfo = this.connections.get(userId);
    if (!connectionInfo) {
      return;
    }

    try {
      // 获取所有发送器
      const senders = connectionInfo.connection.getSenders();
      
      // 移除所有轨道
      for (const sender of senders) {
        if (sender.track) {
          connectionInfo.connection.removeTrack(sender);
        }
      }

      // 停止本地流
      if (connectionInfo.localStream) {
        connectionInfo.localStream.getTracks().forEach(track => track.stop());
        connectionInfo.localStream = undefined;
      }

      connectionInfo.lastActivity = Date.now();
      console.log(`WebRTCManager: 已移除本地媒体流 ${userId}`);
    } catch (error) {
      console.error(`WebRTCManager: 移除本地媒体流失败 ${userId}`, error);
      throw error;
    }
  }

  /**
   * 创建Offer
   */
  async createOffer(userId: string, options?: RTCOfferOptions): Promise<SessionDescription> {
    const connectionInfo = this.connections.get(userId);
    if (!connectionInfo) {
      throw new Error(`连接不存在: ${userId}`);
    }

    try {
      const offer = await connectionInfo.connection.createOffer(options);
      await connectionInfo.connection.setLocalDescription(offer);
      
      connectionInfo.lastActivity = Date.now();
      console.log(`WebRTCManager: 已创建Offer ${userId}`);

      return {
        type: offer.type as any,
        sdp: offer.sdp || ''
      };
    } catch (error) {
      console.error(`WebRTCManager: 创建Offer失败 ${userId}`, error);
      throw error;
    }
  }

  /**
   * 创建Answer
   */
  async createAnswer(userId: string, options?: RTCAnswerOptions): Promise<SessionDescription> {
    const connectionInfo = this.connections.get(userId);
    if (!connectionInfo) {
      throw new Error(`连接不存在: ${userId}`);
    }

    try {
      const answer = await connectionInfo.connection.createAnswer(options);
      await connectionInfo.connection.setLocalDescription(answer);
      
      connectionInfo.lastActivity = Date.now();
      console.log(`WebRTCManager: 已创建Answer ${userId}`);

      return {
        type: answer.type as any,
        sdp: answer.sdp || ''
      };
    } catch (error) {
      console.error(`WebRTCManager: 创建Answer失败 ${userId}`, error);
      throw error;
    }
  }

  /**
   * 设置远程描述
   */
  async setRemoteDescription(userId: string, description: SessionDescription): Promise<void> {
    const connectionInfo = this.connections.get(userId);
    if (!connectionInfo) {
      throw new Error(`连接不存在: ${userId}`);
    }

    try {
      await connectionInfo.connection.setRemoteDescription(new RTCSessionDescription(description));
      connectionInfo.lastActivity = Date.now();
      console.log(`WebRTCManager: 已设置远程描述 ${userId}`);
    } catch (error) {
      console.error(`WebRTCManager: 设置远程描述失败 ${userId}`, error);
      throw error;
    }
  }

  /**
   * 添加ICE候选
   */
  async addIceCandidate(userId: string, candidate: IceCandidate): Promise<void> {
    const connectionInfo = this.connections.get(userId);
    if (!connectionInfo) {
      throw new Error(`连接不存在: ${userId}`);
    }

    try {
      await connectionInfo.connection.addIceCandidate(new RTCIceCandidate(candidate));
      connectionInfo.lastActivity = Date.now();
      console.log(`WebRTCManager: 已添加ICE候选 ${userId}`);
    } catch (error) {
      console.error(`WebRTCManager: 添加ICE候选失败 ${userId}`, error);
      throw error;
    }
  }

  /**
   * 通过数据通道发送消息
   */
  sendDataChannelMessage(userId: string, message: any): void {
    const connectionInfo = this.connections.get(userId);
    if (!connectionInfo?.dataChannel) {
      throw new Error(`数据通道不存在: ${userId}`);
    }

    if (connectionInfo.dataChannel.readyState !== 'open') {
      throw new Error(`数据通道未打开: ${userId}`);
    }

    try {
      const data = typeof message === 'string' ? message : JSON.stringify(message);
      connectionInfo.dataChannel.send(data);
      connectionInfo.lastActivity = Date.now();
      console.log(`WebRTCManager: 已发送数据通道消息 ${userId}`);
    } catch (error) {
      console.error(`WebRTCManager: 发送数据通道消息失败 ${userId}`, error);
      throw error;
    }
  }

  /**
   * 停止媒体流
   */
  stopMediaStream(stream: MediaStream): void {
    try {
      stream.getTracks().forEach(track => {
        track.stop();
        console.log(`WebRTCManager: 停止媒体轨道 ${track.kind}`);
      });
    } catch (error) {
      console.error('WebRTCManager: 停止媒体流失败', error);
    }
  }

  /**
   * 获取可用的媒体设备
   */
  async getMediaDevices(): Promise<MediaDeviceInfo[]> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.map(device => ({
        deviceId: device.deviceId,
        kind: device.kind as any,
        label: device.label,
        groupId: device.groupId
      }));
    } catch (error) {
      console.error('WebRTCManager: 获取媒体设备失败', error);
      throw error;
    }
  }

  /**
   * 获取连接信息
   */
  getConnectionInfo(userId: string): PeerConnectionInfo | null {
    return this.connections.get(userId) || null;
  }

  /**
   * 获取所有连接
   */
  getAllConnections(): PeerConnectionInfo[] {
    return Array.from(this.connections.values());
  }

  /**
   * 检查连接是否存在
   */
  hasConnection(userId: string): boolean {
    return this.connections.has(userId);
  }

  /**
   * 关闭点对点连接
   */
  async closePeerConnection(userId: string): Promise<void> {
    const connectionInfo = this.connections.get(userId);
    if (!connectionInfo) {
      return;
    }

    try {
      // 停止本地媒体流
      if (connectionInfo.localStream) {
        this.stopMediaStream(connectionInfo.localStream);
      }

      // 关闭数据通道
      if (connectionInfo.dataChannel) {
        connectionInfo.dataChannel.close();
      }

      // 关闭连接
      connectionInfo.connection.close();

      // 从连接池中移除
      this.connections.delete(userId);

      console.log(`WebRTCManager: 已关闭连接 ${userId}`);
    } catch (error) {
      console.error(`WebRTCManager: 关闭连接失败 ${userId}`, error);
    }
  }

  /**
   * 启动连接清理定时器
   */
  private startCleanupTimer(): void {
    // 每30秒检查一次连接状态
    this.cleanupInterval = window.setInterval(() => {
      this.cleanupInactiveConnections();
    }, 30000);
  }

  /**
   * 清理非活跃连接
   */
  private cleanupInactiveConnections(): void {
    const now = Date.now();
    const timeout = 5 * 60 * 1000; // 5分钟超时

    for (const [userId, connectionInfo] of this.connections.entries()) {
      if (now - connectionInfo.lastActivity > timeout) {
        console.log(`WebRTCManager: 清理非活跃连接 ${userId}`);
        this.closePeerConnection(userId);
      }
    }
  }

  /**
   * 销毁WebRTC管理器
   */
  destroy(): void {
    console.log('WebRTCManager: 开始销毁...');

    // 关闭所有连接
    for (const userId of this.connections.keys()) {
      this.closePeerConnection(userId);
    }

    // 清除定时器
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // 重置状态
    this.connections.clear();
    this.listeners = {};
    this.isInitialized = false;

    console.log('WebRTCManager: 销毁完成');
  }
}

// 创建单例实例
const webrtcManager = new WebRTCManager();

// 导出管理器实例和类型
export default webrtcManager;
export { WebRTCManager };')