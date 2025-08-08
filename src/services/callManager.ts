import webrtcManager, { MediaConstraints, ConnectionState } from './webrtcManager';
import signalingService, { SignalType, CallRequestSignalData, CallResponseSignalData, GroupCallSignalData } from './signalingService';
import rtcConfigManager from './rtcConfigManager';

// 通话类型
export type CallType = 'audio' | 'video' | 'screen-share';

// 通话状态
export type CallState = 'idle' | 'initiating' | 'ringing' | 'connecting' | 'connected' | 'ended' | 'failed' | 'rejected';

// 通话方向
export type CallDirection = 'outgoing' | 'incoming';

// 会议角色
export type ConferenceRole = 'host' | 'moderator' | 'participant' | 'observer';

// 会议状态
export type ConferenceState = 'creating' | 'waiting' | 'active' | 'ended';

// 参与者连接状态
export type ParticipantConnectionState = 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'failed';

// 媒体状态
export interface MediaState {
  audioEnabled: boolean;
  videoEnabled: boolean;
  speakerEnabled: boolean;
  micMuted: boolean;
  cameraOff: boolean;
  screenSharing: boolean;
}

// 通话参与者信息
export interface CallParticipant {
  userId: string;
  userName: string;
  isLocal: boolean;
  mediaState: MediaState;
  connectionState: ConnectionState;
  joinedAt: number;
  stream?: MediaStream;
  // 多人会议扩展字段
  role?: ConferenceRole;
  connectionStates?: Map<string, ParticipantConnectionState>; // 与其他参与者的连接状态
  isPresenting?: boolean; // 是否正在演示/共享屏幕
  isMutedByHost?: boolean; // 是否被主持人静音
}

// 通话会话信息
export interface CallSession {
  callId: string;
  callType: CallType;
  direction: CallDirection;
  state: CallState;
  participants: Map<string, CallParticipant>;
  localParticipant: CallParticipant;
  startTime: number;
  endTime?: number;
  duration: number;
  isGroup: boolean;
  groupId?: string;
  metadata?: CallMetadata;
}

// 通话元数据接口
export interface CallMetadata {
  caseId?: string;
  subject?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  category?: string;
  tags?: string[];
  customData?: Record<string, any>;
}

// 通话统计信息
export interface CallStats {
  totalCalls: number;
  completedCalls: number;
  failedCalls: number;
  rejectedCalls: number;
  averageDuration: number;
  successRate: number;
}

// 事件监听器接口
export interface CallManagerEventListeners {
  onIncomingCall?: (callId: string, fromUser: string, callType: CallType, metadata?: any) => void;
  onCallStateChanged?: (callId: string, state: CallState, previousState: CallState) => void;
  onCallStarted?: (callId: string, callSession: CallSession) => void;
  onCallEnded?: (callId: string, duration: number, reason?: string) => void;
  onCallFailed?: (callId: string, error: Error) => void;
  onParticipantJoined?: (callId: string, participant: CallParticipant) => void;
  onParticipantLeft?: (callId: string, userId: string, reason?: string) => void;
  onParticipantMediaChanged?: (callId: string, userId: string, mediaState: MediaState) => void;
  onRemoteStreamReceived?: (callId: string, userId: string, stream: MediaStream) => void;
  onLocalStreamReady?: (callId: string, stream: MediaStream) => void;
  onGroupCallInvite?: (callId: string, groupId: string, fromUser: string, metadata?: any) => void;
}

/**
 * CallManager - 通话管理器
 * 负责音视频通话的会话管理、媒体流控制、状态管理和信令协调
 */
class CallManager {
  private activeCalls: Map<string, CallSession> = new Map();
  private listeners: CallManagerEventListeners = {};
  private currentUserId: string | null = null;
  private isInitialized: boolean = false;
  private callTimeout: number = 30000; // 30秒响铃超时
  private stats!: CallStats;

  constructor() {
    this.stats = {
      totalCalls: 0,
      completedCalls: 0,
      failedCalls: 0,
      rejectedCalls: 0,
      averageDuration: 0,
      successRate: 0
    };
    this.initialize();
  }

  /**
   * 初始化通话管理器
   */
  private async initialize(): Promise<void> {
    try {
      // 获取配置
      const config = await rtcConfigManager.getConfig();
      this.callTimeout = config.call_timeout;

      // 设置WebRTC事件监听器
      webrtcManager.setEventListeners({
        onConnectionStateChange: (userId: string, state: ConnectionState) => {
          this.handleConnectionStateChange(userId, state);
        },
        onRemoteStream: (userId: string, stream: MediaStream) => {
          this.handleRemoteStream(userId, stream);
        },
        onError: (userId: string, error: Error) => {
          this.handleWebRTCError(userId, error);
        }
      });

      // 设置信令服务事件监听器
      signalingService.setEventListeners({
        onCallRequest: (fromUser: string, data: CallRequestSignalData) => {
          this.handleIncomingCallRequest(fromUser, data);
        },
        onCallAccept: (fromUser: string, data: CallResponseSignalData) => {
          this.handleCallAccept(fromUser, data);
        },
        onCallReject: (fromUser: string, data: CallResponseSignalData) => {
          this.handleCallReject(fromUser, data);
        },
        onCallEnd: (fromUser: string, callId: string) => {
          this.handleCallEnd(fromUser, callId);
        },
        onGroupCallRequest: (fromUser: string, data: GroupCallSignalData) => {
          this.handleGroupCallRequest(fromUser, data);
        },
        onGroupCallJoin: (fromUser: string, data: GroupCallSignalData) => {
          this.handleGroupCallJoin(fromUser, data);
        },
        onGroupCallLeave: (fromUser: string, data: GroupCallSignalData) => {
          this.handleGroupCallLeave(fromUser, data);
        }
      });

      this.isInitialized = true;
      console.log('CallManager: 初始化完成');
    } catch (error) {
      console.error('CallManager: 初始化失败', error);
      throw error;
    }
  }

  /**
   * 设置当前用户ID
   */
  setCurrentUserId(userId: string): void {
    this.currentUserId = userId;
  }

  /**
   * 设置事件监听器
   */
  setEventListeners(listeners: CallManagerEventListeners): void {
    this.listeners = { ...this.listeners, ...listeners };
  }

  /**
   * 发起通话
   */
  async initiateCall(targetUserId: string, callType: CallType = 'audio', metadata?: any): Promise<string> {
    if (!this.isInitialized || !this.currentUserId) {
      throw new Error('CallManager未初始化或用户ID未设置');
    }

    // 检查是否已有活跃通话
    if (this.hasActiveCall()) {
      throw new Error('已有活跃通话正在进行');
    }

    try {
      const callId = this.generateCallId();
      
      // 创建通话会话
      const callSession = await this.createCallSession(
        callId,
        callType,
        'outgoing',
        [targetUserId],
        metadata
      );

      // 设置通话状态为发起中
      this.updateCallState(callId, 'initiating');

      // 创建WebRTC连接
      await webrtcManager.createPeerConnection(targetUserId, true);

      // 获取本地媒体流
      const constraints = this.getMediaConstraints(callType);
      const localStream = await webrtcManager.getUserMedia(constraints);
      
      // 添加本地流到连接
      await webrtcManager.addLocalStream(targetUserId, localStream);

      // 更新本地参与者信息
      callSession.localParticipant.stream = localStream;
      callSession.localParticipant.mediaState = this.getMediaStateFromStream(localStream, callType);

      // 通知本地流准备就绪
      this.listeners.onLocalStreamReady?.(callId, localStream);

      // 创建Offer
      const offer = await webrtcManager.createOffer(targetUserId);

      // 发送通话请求信令
      const callRequestData: CallRequestSignalData = {
        callType,
        callId,
        initiatorName: this.currentUserId,
        constraints: {
          audio: callType === 'audio' || callType === 'video',
          video: callType === 'video'
        }
      };

      await signalingService.sendCallRequest(targetUserId, callRequestData);

      // 设置响铃超时
      this.setCallTimeout(callId, targetUserId);

      // 更新状态为响铃中
      this.updateCallState(callId, 'ringing');

      console.log(`CallManager: 已发起通话 ${callId} to ${targetUserId}`);
      return callId;

    } catch (error) {
      console.error('CallManager: 发起通话失败', error);
      this.stats.failedCalls++;
      throw error;
    }
  }

  /**
   * 接听通话
   */
  async acceptCall(callId: string): Promise<void> {
    const callSession = this.activeCalls.get(callId);
    if (!callSession) {
      throw new Error(`通话会话不存在: ${callId}`);
    }

    if (callSession.state !== 'ringing' || callSession.direction !== 'incoming') {
      throw new Error(`无法接听，当前状态: ${callSession.state}`);
    }

    try {
      // 设置状态为连接中
      this.updateCallState(callId, 'connecting');

      // 获取对方用户ID
      const remoteUserId = Array.from(callSession.participants.keys())
        .find(userId => userId !== this.currentUserId);

      if (!remoteUserId) {
        throw new Error('无法找到对方用户');
      }

      // 获取本地媒体流
      const constraints = this.getMediaConstraints(callSession.callType);
      const localStream = await webrtcManager.getUserMedia(constraints);

      // 创建WebRTC连接（作为接收方）
      await webrtcManager.createPeerConnection(remoteUserId, false);
      await webrtcManager.addLocalStream(remoteUserId, localStream);

      // 更新本地参与者信息
      callSession.localParticipant.stream = localStream;
      callSession.localParticipant.mediaState = this.getMediaStateFromStream(localStream, callSession.callType);

      // 通知本地流准备就绪
      this.listeners.onLocalStreamReady?.(callId, localStream);

      // 创建Answer
      const answer = await webrtcManager.createAnswer(remoteUserId);

      // 发送接受信令
      const acceptData: CallResponseSignalData = {
        callId,
        accepted: true
      };

      await signalingService.sendCallAccept(remoteUserId, acceptData);

      console.log(`CallManager: 已接听通话 ${callId}`);

    } catch (error) {
      console.error('CallManager: 接听通话失败', error);
      await this.endCall(callId, '接听失败');
      throw error;
    }
  }

  /**
   * 拒绝通话
   */
  async rejectCall(callId: string, reason?: string): Promise<void> {
    const callSession = this.activeCalls.get(callId);
    if (!callSession) {
      throw new Error(`通话会话不存在: ${callId}`);
    }

    if (callSession.state !== 'ringing' || callSession.direction !== 'incoming') {
      throw new Error(`无法拒绝，当前状态: ${callSession.state}`);
    }

    try {
      // 设置状态为已拒绝
      this.updateCallState(callId, 'rejected');

      // 获取对方用户ID
      const remoteUserId = Array.from(callSession.participants.keys())
        .find(userId => userId !== this.currentUserId);

      if (remoteUserId) {
        // 发送拒绝信令
        const rejectData: CallResponseSignalData = {
          callId,
          accepted: false,
          reason: reason || '通话被拒绝'
        };

        await signalingService.sendCallReject(remoteUserId, rejectData);
      }

      // 清理通话会话
      this.cleanupCallSession(callId);
      this.stats.rejectedCalls++;

      // 通知监听器
      this.listeners.onCallEnded?.(callId, 0, reason || '通话被拒绝');

      console.log(`CallManager: 已拒绝通话 ${callId}`);

    } catch (error) {
      console.error('CallManager: 拒绝通话失败', error);
      throw error;
    }
  }

  /**
   * 结束通话
   */
  async endCall(callId: string, reason?: string): Promise<void> {
    const callSession = this.activeCalls.get(callId);
    if (!callSession) {
      return;
    }

    try {
      // 计算通话时长
      const duration = Date.now() - callSession.startTime;
      callSession.duration = duration;
      callSession.endTime = Date.now();

      // 设置状态为已结束
      this.updateCallState(callId, 'ended');

      // 发送结束信令给所有参与者
      for (const [userId, participant] of callSession.participants) {
        if (!participant.isLocal) {
          try {
            await signalingService.sendCallEnd(userId, callId);
          } catch (error) {
            console.warn(`发送结束信令失败 ${userId}:`, error);
          }
        }
      }

      // 关闭WebRTC连接
      for (const [userId, participant] of callSession.participants) {
        if (!participant.isLocal) {
          await webrtcManager.closePeerConnection(userId);
        }
      }

      // 停止本地媒体流
      if (callSession.localParticipant.stream) {
        webrtcManager.stopMediaStream(callSession.localParticipant.stream);
      }

      // 更新统计信息
      if (callSession.state === 'connected') {
        this.stats.completedCalls++;
        this.updateAverageDuration(duration);
      } else {
        this.stats.failedCalls++;
      }

      // 清理通话会话
      this.cleanupCallSession(callId);

      // 通知监听器
      this.listeners.onCallEnded?.(callId, duration, reason);

      console.log(`CallManager: 已结束通话 ${callId}, 时长: ${duration}ms`);

    } catch (error) {
      console.error('CallManager: 结束通话失败', error);
      throw error;
    }
  }

  /**
   * 切换静音状态
   */
  toggleMute(callId: string): boolean {
    const callSession = this.activeCalls.get(callId);
    if (!callSession || !callSession.localParticipant.stream) {
      return false;
    }

    const audioTracks = callSession.localParticipant.stream.getAudioTracks();
    const newMutedState = !callSession.localParticipant.mediaState.micMuted;

    audioTracks.forEach(track => {
      track.enabled = !newMutedState;
    });

    callSession.localParticipant.mediaState.micMuted = newMutedState;
    callSession.localParticipant.mediaState.audioEnabled = !newMutedState;

    // 通知媒体状态变更
    this.listeners.onParticipantMediaChanged?.(
      callId,
      this.currentUserId!,
      callSession.localParticipant.mediaState
    );

    return newMutedState;
  }

  /**
   * 切换摄像头状态
   */
  toggleCamera(callId: string): boolean {
    const callSession = this.activeCalls.get(callId);
    if (!callSession || !callSession.localParticipant.stream || callSession.callType === 'audio') {
      return false;
    }

    const videoTracks = callSession.localParticipant.stream.getVideoTracks();
    const newCameraOffState = !callSession.localParticipant.mediaState.cameraOff;

    videoTracks.forEach(track => {
      track.enabled = !newCameraOffState;
    });

    callSession.localParticipant.mediaState.cameraOff = newCameraOffState;
    callSession.localParticipant.mediaState.videoEnabled = !newCameraOffState;

    // 通知媒体状态变更
    this.listeners.onParticipantMediaChanged?.(
      callId,
      this.currentUserId!,
      callSession.localParticipant.mediaState
    );

    return newCameraOffState;
  }

  /**
   * 切换扬声器状态
   */
  async toggleSpeaker(callId: string): Promise<boolean> {
    const callSession = this.activeCalls.get(callId);
    if (!callSession) {
      return false;
    }

    const newSpeakerState = !callSession.localParticipant.mediaState.speakerEnabled;
    
    try {
      // 实际切换音频输出设备
      if ('setSinkId' in HTMLAudioElement.prototype) {
        // 获取所有音频元素
        const audioElements = document.querySelectorAll('audio');
        
        // 根据扬声器状态选择音频输出设备
        const sinkId = newSpeakerState ? 'default' : 'communications'; // 或者从配置获取设备ID
        
        // 切换所有音频元素的输出设备
        for (const audioElement of audioElements) {
          if ('setSinkId' in audioElement && typeof audioElement.setSinkId === 'function') {
            try {
              await (audioElement as any).setSinkId(sinkId);
            } catch (error) {
              console.warn('Failed to set audio sink for element:', error);
            }
          }
        }
      } else {
        console.warn('Audio output device selection is not supported');
      }

      // 更新状态
      callSession.localParticipant.mediaState.speakerEnabled = newSpeakerState;

      // 通知媒体状态变更
      this.listeners.onParticipantMediaChanged?.(
        callId,
        this.currentUserId!,
        callSession.localParticipant.mediaState
      );

      return newSpeakerState;
    } catch (error) {
      console.error('Failed to toggle speaker:', error);
      return callSession.localParticipant.mediaState.speakerEnabled;
    }
  }

  /**
   * 开始屏幕共享
   */
  async startScreenShare(callId: string, includeAudio: boolean = true): Promise<void> {
    const callSession = this.activeCalls.get(callId);
    if (!callSession) {
      throw new Error(`通话会话不存在: ${callId}`);
    }

    try {
      // 为每个远程参与者开始屏幕共享
      for (const [userId, participant] of callSession.participants) {
        if (!participant.isLocal) {
          const screenStream = await webrtcManager.startScreenShare(userId, includeAudio);
          
          // 监听屏幕共享结束事件
          const videoTrack = screenStream.getVideoTracks()[0];
          if (videoTrack) {
            videoTrack.onended = () => {
              this.stopScreenShare(callId);
            };
          }
        }
      }

      // 更新媒体状态
      callSession.localParticipant.mediaState.screenSharing = true;

      // 通知媒体状态变更
      this.listeners.onParticipantMediaChanged?.(
        callId,
        this.currentUserId!,
        callSession.localParticipant.mediaState
      );

      console.log(`CallManager: 开始屏幕共享 ${callId}`);

    } catch (error) {
      console.error('CallManager: 开始屏幕共享失败', error);
      throw error;
    }
  }

  /**
   * 停止屏幕共享
   */
  async stopScreenShare(callId: string, cameraId?: string): Promise<void> {
    const callSession = this.activeCalls.get(callId);
    if (!callSession || !callSession.localParticipant.mediaState.screenSharing) {
      return;
    }

    try {
      // 为每个远程参与者停止屏幕共享，恢复摄像头
      for (const [userId, participant] of callSession.participants) {
        if (!participant.isLocal) {
          await webrtcManager.stopScreenShare(userId, cameraId);
        }
      }

      // 更新媒体状态
      callSession.localParticipant.mediaState.screenSharing = false;

      // 通知媒体状态变更
      this.listeners.onParticipantMediaChanged?.(
        callId,
        this.currentUserId!,
        callSession.localParticipant.mediaState
      );

      console.log(`CallManager: 停止屏幕共享 ${callId}`);

    } catch (error) {
      console.error('CallManager: 停止屏幕共享失败', error);
      throw error;
    }
  }

  /**
   * 切换摄像头
   */
  async switchCamera(callId: string, cameraId?: string): Promise<void> {
    const callSession = this.activeCalls.get(callId);
    if (!callSession || callSession.callType === 'audio') {
      throw new Error('无法在语音通话中切换摄像头');
    }

    try {
      // 为每个远程参与者切换摄像头
      for (const [userId, participant] of callSession.participants) {
        if (!participant.isLocal) {
          const newStream = await webrtcManager.switchCamera(userId, cameraId);
          
          // 更新本地参与者的流
          if (callSession.localParticipant.stream) {
            // 保留音频轨道，替换视频轨道
            const audioTracks = callSession.localParticipant.stream.getAudioTracks();
            const videoTrack = newStream.getVideoTracks()[0];
            
            if (videoTrack) {
              callSession.localParticipant.stream = new MediaStream([...audioTracks, videoTrack]);
            }
          }
        }
      }

      // 通知本地流更新
      if (callSession.localParticipant.stream) {
        this.listeners.onLocalStreamReady?.(callId, callSession.localParticipant.stream);
      }

      console.log(`CallManager: 已切换摄像头 ${callId}`);

    } catch (error) {
      console.error('CallManager: 切换摄像头失败', error);
      throw error;
    }
  }

  /**
   * 调整视频质量
   */
  async adjustVideoQuality(callId: string, quality: 'low' | 'medium' | 'high' | 'ultra'): Promise<void> {
    const callSession = this.activeCalls.get(callId);
    if (!callSession || callSession.callType === 'audio') {
      throw new Error('无法在语音通话中调整视频质量');
    }

    try {
      // 为每个远程参与者调整视频质量
      for (const [userId, participant] of callSession.participants) {
        if (!participant.isLocal) {
          await webrtcManager.adjustVideoQuality(userId, quality);
        }
      }

      console.log(`CallManager: 已调整视频质量 ${callId} -> ${quality}`);

    } catch (error) {
      console.error('CallManager: 调整视频质量失败', error);
      throw error;
    }
  }

  /**
   * 自动调整视频质量基于网络状况
   */
  async autoAdjustVideoQuality(callId: string): Promise<void> {
    const callSession = this.activeCalls.get(callId);
    if (!callSession || callSession.callType === 'audio') {
      return;
    }

    try {
      // 为每个远程参与者自动调整视频质量
      for (const [userId, participant] of callSession.participants) {
        if (!participant.isLocal) {
          await webrtcManager.autoAdjustVideoQuality(userId);
        }
      }

      console.log(`CallManager: 已自动调整视频质量 ${callId}`);

    } catch (error) {
      console.error('CallManager: 自动调整视频质量失败', error);
    }
  }

  /**
   * 获取网络质量信息
   */
  async getNetworkQuality(callId: string): Promise<Record<string, 'excellent' | 'good' | 'fair' | 'poor' | 'unknown'>> {
    const callSession = this.activeCalls.get(callId);
    if (!callSession) {
      return {};
    }

    const networkQualities: Record<string, 'excellent' | 'good' | 'fair' | 'poor' | 'unknown'> = {};

    try {
      // 获取每个远程参与者的网络质量
      for (const [userId, participant] of callSession.participants) {
        if (!participant.isLocal) {
          networkQualities[userId] = await webrtcManager.detectNetworkQuality(userId);
        }
      }

      return networkQualities;

    } catch (error) {
      console.error('CallManager: 获取网络质量失败', error);
      return networkQualities;
    }
  }

  /**
   * 获取可用摄像头列表
   */
  async getAvailableCameras(): Promise<import('./webrtcManager').CameraInfo[]> {
    try {
      return await webrtcManager.getCameraDevices();
    } catch (error) {
      console.error('CallManager: 获取摄像头列表失败', error);
      return [];
    }
  }

  /**
   * 发起群组通话
   */
  async initiateGroupCall(groupId: string, callType: CallType = 'audio', metadata?: any): Promise<string> {
    if (!this.isInitialized || !this.currentUserId) {
      throw new Error('CallManager未初始化或用户ID未设置');
    }

    try {
      const callId = this.generateCallId();
      
      // 创建群组通话会话
      const callSession = await this.createCallSession(
        callId,
        callType,
        'outgoing',
        [],
        metadata,
        true,
        groupId
      );

      // 设置通话状态
      this.updateCallState(callId, 'initiating');

      // 发送群组通话请求
      const groupCallData: GroupCallSignalData = {
        callId,
        callType,
        groupName: groupId,
        initiatorName: this.currentUserId
      };

      await signalingService.sendGroupCallRequest(groupId, groupCallData);

      console.log(`CallManager: 已发起群组通话 ${callId} in group ${groupId}`);
      return callId;

    } catch (error) {
      console.error('CallManager: 发起群组通话失败', error);
      throw error;
    }
  }

  /**
   * 获取通话会话信息
   */
  getCallSession(callId: string): CallSession | null {
    return this.activeCalls.get(callId) || null;
  }

  /**
   * 获取所有活跃通话
   */
  getActiveCalls(): CallSession[] {
    return Array.from(this.activeCalls.values());
  }

  /**
   * 检查是否有活跃通话
   */
  hasActiveCall(): boolean {
    return this.activeCalls.size > 0;
  }

  /**
   * 获取当前通话ID
   */
  getCurrentCallId(): string | null {
    const activeCalls = this.getActiveCalls();
    return activeCalls.length > 0 ? activeCalls[0].callId : null;
  }

  /**
   * 获取通话统计信息
   */
  getCallStats(): CallStats {
    this.stats.successRate = this.stats.totalCalls > 0 
      ? (this.stats.completedCalls / this.stats.totalCalls) * 100 
      : 0;
    
    return { ...this.stats };
  }

  // ====================== 多人会议管理方法 ======================

  /**
   * 创建多人会议
   */
  async createConference(conferenceId: string, callType: CallType = 'video', metadata?: any): Promise<string> {
    if (!this.isInitialized || !this.currentUserId) {
      throw new Error('CallManager未初始化或用户ID未设置');
    }

    try {
      const callId = this.generateCallId();
      
      // 创建会议会话，设置创建者为主持人
      const callSession = await this.createCallSession(
        callId,
        callType,
        'outgoing',
        [],
        { ...metadata, conferenceId, conferenceState: 'creating' as ConferenceState },
        true,
        conferenceId
      );

      // 设置本地参与者为主持人
      callSession.localParticipant.role = 'host';
      callSession.localParticipant.connectionStates = new Map();

      // 设置通话状态
      this.updateCallState(callId, 'initiating');

      // 获取本地媒体流
      const constraints = this.getMediaConstraints(callType);
      const localStream = await webrtcManager.getUserMedia(constraints);
      
      // 更新本地参与者信息
      callSession.localParticipant.stream = localStream;
      callSession.localParticipant.mediaState = this.getMediaStateFromStream(localStream, callType);

      // 通知本地流准备就绪
      this.listeners.onLocalStreamReady?.(callId, localStream);

      // 更新会议状态为等待中
      if (callSession.metadata) {
        callSession.metadata.conferenceState = 'waiting';
      }

      console.log(`CallManager: 已创建多人会议 ${callId}, 会议ID: ${conferenceId}`);
      return callId;

    } catch (error) {
      console.error('CallManager: 创建多人会议失败', error);
      throw error;
    }
  }

  /**
   * 加入多人会议
   */
  async joinConference(callId: string, role: ConferenceRole = 'participant'): Promise<void> {
    const callSession = this.activeCalls.get(callId);
    if (!callSession) {
      throw new Error(`会议不存在: ${callId}`);
    }

    if (!callSession.isGroup) {
      throw new Error('该通话不是多人会议');
    }

    try {
      // 设置状态为连接中
      this.updateCallState(callId, 'connecting');

      // 获取本地媒体流
      const constraints = this.getMediaConstraints(callSession.callType);
      const localStream = await webrtcManager.getUserMedia(constraints);

      // 更新本地参与者信息
      callSession.localParticipant.role = role;
      callSession.localParticipant.connectionStates = new Map();
      callSession.localParticipant.stream = localStream;
      callSession.localParticipant.mediaState = this.getMediaStateFromStream(localStream, callSession.callType);

      // 通知本地流准备就绪
      this.listeners.onLocalStreamReady?.(callId, localStream);

      // 为每个现有参与者建立P2P连接
      for (const [userId, participant] of callSession.participants) {
        if (!participant.isLocal) {
          try {
            await this.establishPeerConnection(callId, userId, localStream);
          } catch (error) {
            console.warn(`与参与者 ${userId} 建立连接失败:`, error);
          }
        }
      }

      // 发送加入会议信令
      const groupCallData: GroupCallSignalData = {
        callId,
        callType: callSession.callType,
        groupName: callSession.groupId || '',
        initiatorName: this.currentUserId!
      };

      await signalingService.sendGroupCallJoin(callSession.groupId || '', groupCallData);

      // 更新会议状态为活跃
      if (callSession.metadata) {
        callSession.metadata.conferenceState = 'active';
      }

      console.log(`CallManager: 已加入多人会议 ${callId}`);

    } catch (error) {
      console.error('CallManager: 加入多人会议失败', error);
      throw error;
    }
  }

  /**
   * 离开多人会议
   */
  async leaveConference(callId: string, reason?: string): Promise<void> {
    const callSession = this.activeCalls.get(callId);
    if (!callSession) {
      return;
    }

    if (!callSession.isGroup) {
      throw new Error('该通话不是多人会议');
    }

    try {
      // 发送离开会议信令给所有参与者
      const groupCallData: GroupCallSignalData = {
        callId,
        callType: callSession.callType,
        groupName: callSession.groupId || '',
        initiatorName: this.currentUserId!
      };

      for (const [userId, participant] of callSession.participants) {
        if (!participant.isLocal) {
          try {
            await signalingService.sendGroupCallLeave(userId, groupCallData);
          } catch (error) {
            console.warn(`向参与者 ${userId} 发送离开信令失败:`, error);
          }
        }
      }

      // 关闭所有WebRTC连接
      for (const [userId, participant] of callSession.participants) {
        if (!participant.isLocal) {
          await webrtcManager.closePeerConnection(userId);
        }
      }

      // 结束通话
      await this.endCall(callId, reason || '主动离开会议');

      console.log(`CallManager: 已离开多人会议 ${callId}`);

    } catch (error) {
      console.error('CallManager: 离开多人会议失败', error);
      throw error;
    }
  }

  /**
   * 邀请参与者加入会议
   */
  async inviteToConference(callId: string, userIds: string[], role: ConferenceRole = 'participant'): Promise<void> {
    const callSession = this.activeCalls.get(callId);
    if (!callSession) {
      throw new Error(`会议不存在: ${callId}`);
    }

    if (!callSession.isGroup) {
      throw new Error('该通话不是多人会议');
    }

    // 检查权限：只有主持人和管理员可以邀请
    if (callSession.localParticipant.role !== 'host' && callSession.localParticipant.role !== 'moderator') {
      throw new Error('只有主持人和管理员可以邀请参与者');
    }

    try {
      // 为每个被邀请用户发送邀请信令
      const groupCallData: GroupCallSignalData = {
        callId,
        callType: callSession.callType,
        groupName: callSession.groupId || '',
        initiatorName: this.currentUserId!
      };

      for (const userId of userIds) {
        // 检查用户是否已在会议中
        if (callSession.participants.has(userId)) {
          console.warn(`用户 ${userId} 已在会议中，跳过邀请`);
          continue;
        }

        try {
          await signalingService.sendGroupCallRequest(userId, groupCallData);
          
          // 预先添加参与者到会话中（状态为连接中）
          const participant: CallParticipant = {
            userId,
            userName: userId,
            isLocal: false,
            mediaState: {
              audioEnabled: true,
              videoEnabled: callSession.callType === 'video',
              speakerEnabled: false,
              micMuted: false,
              cameraOff: callSession.callType !== 'video',
              screenSharing: false
            },
            connectionState: 'new',
            joinedAt: Date.now(),
            role,
            connectionStates: new Map(),
            isPresenting: false,
            isMutedByHost: false
          };

          callSession.participants.set(userId, participant);

          console.log(`CallManager: 已邀请用户 ${userId} 加入会议 ${callId}`);

        } catch (error) {
          console.error(`邀请用户 ${userId} 失败:`, error);
        }
      }

    } catch (error) {
      console.error('CallManager: 邀请参与者失败', error);
      throw error;
    }
  }

  /**
   * 管理参与者连接状态
   */
  async manageParticipantConnections(callId: string): Promise<void> {
    const callSession = this.activeCalls.get(callId);
    if (!callSession || !callSession.isGroup) {
      return;
    }

    try {
      // 检查所有参与者的连接状态
      for (const [userId, participant] of callSession.participants) {
        if (!participant.isLocal) {
          const connectionInfo = webrtcManager.getConnectionInfo(userId);
          
          if (connectionInfo) {
            // 更新参与者连接状态
            participant.connectionState = connectionInfo.state;
            
            // 如果连接断开，尝试重连
            if (connectionInfo.state === 'disconnected' || connectionInfo.state === 'failed') {
              console.log(`参与者 ${userId} 连接断开，尝试重连...`);
              
              if (participant.connectionStates) {
                participant.connectionStates.set(userId, 'reconnecting');
              }

              try {
                // 重新建立连接
                if (callSession.localParticipant.stream) {
                  await this.establishPeerConnection(callId, userId, callSession.localParticipant.stream);
                }
              } catch (error) {
                console.error(`重连参与者 ${userId} 失败:`, error);
                if (participant.connectionStates) {
                  participant.connectionStates.set(userId, 'failed');
                }
              }
            }
          }
        }
      }

    } catch (error) {
      console.error('CallManager: 管理参与者连接失败', error);
    }
  }

  /**
   * 管理会议特定的信令处理
   */
  async handleConferenceSignaling(callId: string, fromUser: string, signalType: string, data: any): Promise<void> {
    const callSession = this.activeCalls.get(callId);
    if (!callSession || !callSession.isGroup) {
      return;
    }

    try {
      switch (signalType) {
        case 'participant-mute':
          await this.handleParticipantMute(callId, fromUser, data);
          break;
        
        case 'participant-unmute':
          await this.handleParticipantUnmute(callId, fromUser, data);
          break;
        
        case 'role-change':
          await this.handleRoleChange(callId, fromUser, data);
          break;
        
        case 'presentation-start':
          await this.handlePresentationStart(callId, fromUser, data);
          break;
        
        case 'presentation-stop':
          await this.handlePresentationStop(callId, fromUser, data);
          break;
        
        case 'conference-end':
          await this.handleConferenceEnd(callId, fromUser, data);
          break;
        
        default:
          console.warn(`未知的会议信令类型: ${signalType}`);
      }

    } catch (error) {
      console.error('CallManager: 处理会议信令失败', error);
    }
  }

  /**
   * 设置参与者角色
   */
  async setParticipantRole(callId: string, userId: string, newRole: ConferenceRole): Promise<void> {
    const callSession = this.activeCalls.get(callId);
    if (!callSession || !callSession.isGroup) {
      throw new Error('会议不存在或不是多人会议');
    }

    // 检查权限：只有主持人可以修改角色
    if (callSession.localParticipant.role !== 'host') {
      throw new Error('只有主持人可以修改参与者角色');
    }

    const participant = callSession.participants.get(userId);
    if (!participant) {
      throw new Error(`参与者不存在: ${userId}`);
    }

    participant.role = newRole;

    console.log(`CallManager: 已设置参与者 ${userId} 角色为 ${newRole}`);
  }

  /**
   * 静音/取消静音参与者（主持人功能）
   */
  async muteParticipant(callId: string, userId: string, muted: boolean): Promise<void> {
    const callSession = this.activeCalls.get(callId);
    if (!callSession || !callSession.isGroup) {
      throw new Error('会议不存在或不是多人会议');
    }

    // 检查权限：只有主持人和管理员可以静音他人
    if (callSession.localParticipant.role !== 'host' && callSession.localParticipant.role !== 'moderator') {
      throw new Error('只有主持人和管理员可以静音其他参与者');
    }

    const participant = callSession.participants.get(userId);
    if (!participant) {
      throw new Error(`参与者不存在: ${userId}`);
    }

    participant.isMutedByHost = muted;

    // 这里应该发送信令通知目标用户被静音/取消静音
    // 实际实现中需要扩展信令服务支持这类控制消息

    console.log(`CallManager: 已${muted ? '静音' : '取消静音'}参与者 ${userId}`);
  }

  /**
   * 获取会议信息
   */
  getConferenceInfo(callId: string): {
    conferenceId: string;
    state: ConferenceState;
    participants: CallParticipant[];
    host: CallParticipant | null;
    moderators: CallParticipant[];
  } | null {
    const callSession = this.activeCalls.get(callId);
    if (!callSession || !callSession.isGroup) {
      return null;
    }

    const participants = Array.from(callSession.participants.values());
    const host = participants.find(p => p.role === 'host') || null;
    const moderators = participants.filter(p => p.role === 'moderator');
    
    return {
      conferenceId: callSession.metadata?.conferenceId || callSession.groupId || '',
      state: callSession.metadata?.conferenceState || 'active',
      participants,
      host,
      moderators
    };
  }

  // ====================== 私有辅助方法 ======================

  /**
   * 建立P2P连接
   */
  private async establishPeerConnection(callId: string, userId: string, localStream: MediaStream): Promise<void> {
    try {
      // 创建WebRTC连接
      await webrtcManager.createPeerConnection(userId, true);
      
      // 添加本地流
      await webrtcManager.addLocalStream(userId, localStream);
      
      // 创建Offer（如果是发起方）
      const offer = await webrtcManager.createOffer(userId);
      
      console.log(`CallManager: 已建立P2P连接 ${userId} for call ${callId}`);
      
    } catch (error) {
      console.error(`CallManager: 建立P2P连接失败 ${userId}`, error);
      throw error;
    }
  }

  /**
   * 处理参与者静音信令
   */
  private async handleParticipantMute(callId: string, fromUser: string, data: any): Promise<void> {
    const callSession = this.activeCalls.get(callId);
    if (!callSession) return;

    const participant = callSession.participants.get(fromUser);
    if (participant) {
      participant.mediaState.micMuted = true;
      participant.mediaState.audioEnabled = false;
      
      // 通知媒体状态变更
      this.listeners.onParticipantMediaChanged?.(callId, fromUser, participant.mediaState);
    }
  }

  /**
   * 处理参与者取消静音信令
   */
  private async handleParticipantUnmute(callId: string, fromUser: string, data: any): Promise<void> {
    const callSession = this.activeCalls.get(callId);
    if (!callSession) return;

    const participant = callSession.participants.get(fromUser);
    if (participant) {
      // 检查是否被主持人静音
      if (participant.isMutedByHost) {
        console.warn(`参与者 ${fromUser} 被主持人静音，无法取消静音`);
        return;
      }

      participant.mediaState.micMuted = false;
      participant.mediaState.audioEnabled = true;
      
      // 通知媒体状态变更
      this.listeners.onParticipantMediaChanged?.(callId, fromUser, participant.mediaState);
    }
  }

  /**
   * 处理角色变更信令
   */
  private async handleRoleChange(callId: string, fromUser: string, data: { userId: string; newRole: ConferenceRole }): Promise<void> {
    const callSession = this.activeCalls.get(callId);
    if (!callSession) return;

    const participant = callSession.participants.get(data.userId);
    if (participant) {
      participant.role = data.newRole;
      console.log(`CallManager: 参与者 ${data.userId} 角色变更为 ${data.newRole}`);
    }
  }

  /**
   * 处理演示开始信令
   */
  private async handlePresentationStart(callId: string, fromUser: string, data: any): Promise<void> {
    const callSession = this.activeCalls.get(callId);
    if (!callSession) return;

    const participant = callSession.participants.get(fromUser);
    if (participant) {
      // 停止其他人的演示
      for (const [userId, p] of callSession.participants) {
        if (p.isPresenting && userId !== fromUser) {
          p.isPresenting = false;
        }
      }

      participant.isPresenting = true;
      participant.mediaState.screenSharing = true;
      
      console.log(`CallManager: 参与者 ${fromUser} 开始演示`);
      
      // 通知媒体状态变更
      this.listeners.onParticipantMediaChanged?.(callId, fromUser, participant.mediaState);
    }
  }

  /**
   * 处理演示停止信令
   */
  private async handlePresentationStop(callId: string, fromUser: string, data: any): Promise<void> {
    const callSession = this.activeCalls.get(callId);
    if (!callSession) return;

    const participant = callSession.participants.get(fromUser);
    if (participant) {
      participant.isPresenting = false;
      participant.mediaState.screenSharing = false;
      
      console.log(`CallManager: 参与者 ${fromUser} 停止演示`);
      
      // 通知媒体状态变更
      this.listeners.onParticipantMediaChanged?.(callId, fromUser, participant.mediaState);
    }
  }

  /**
   * 处理会议结束信令
   */
  private async handleConferenceEnd(callId: string, fromUser: string, data: any): Promise<void> {
    const callSession = this.activeCalls.get(callId);
    if (!callSession) return;

    // 检查发起者权限（只有主持人可以结束会议）
    const participant = callSession.participants.get(fromUser);
    if (participant?.role === 'host') {
      await this.endCall(callId, '主持人结束会议');
    }
  }

  // ====================== 私有方法 ======================

  /**
   * 创建通话会话
   */
  private async createCallSession(
    callId: string,
    callType: CallType,
    direction: CallDirection,
    participantIds: string[],
    metadata?: any,
    isGroup: boolean = false,
    groupId?: string
  ): Promise<CallSession> {
    if (!this.currentUserId) {
      throw new Error('用户ID未设置');
    }

    // 创建本地参与者
    const localParticipant: CallParticipant = {
      userId: this.currentUserId,
      userName: this.currentUserId,
      isLocal: true,
      mediaState: {
        audioEnabled: true,
        videoEnabled: callType === 'video',
        speakerEnabled: false,
        micMuted: false,
        cameraOff: callType !== 'video',
        screenSharing: false
      },
      connectionState: 'new',
      joinedAt: Date.now()
    };

    // 创建远程参与者
    const participants = new Map<string, CallParticipant>();
    participants.set(this.currentUserId, localParticipant);

    for (const userId of participantIds) {
      participants.set(userId, {
        userId,
        userName: userId,
        isLocal: false,
        mediaState: {
          audioEnabled: true,
          videoEnabled: callType === 'video',
          speakerEnabled: false,
          micMuted: false,
          cameraOff: callType !== 'video',
          screenSharing: false
        },
        connectionState: 'new',
        joinedAt: Date.now()
      });
    }

    const callSession: CallSession = {
      callId,
      callType,
      direction,
      state: 'idle',
      participants,
      localParticipant,
      startTime: Date.now(),
      duration: 0,
      isGroup,
      groupId,
      metadata
    };

    this.activeCalls.set(callId, callSession);
    this.stats.totalCalls++;

    return callSession;
  }

  /**
   * 更新通话状态
   */
  private updateCallState(callId: string, newState: CallState): void {
    const callSession = this.activeCalls.get(callId);
    if (!callSession) {
      return;
    }

    const previousState = callSession.state;
    callSession.state = newState;

    // 如果状态变为已连接，记录开始时间
    if (newState === 'connected' && previousState !== 'connected') {
      callSession.startTime = Date.now();
      this.listeners.onCallStarted?.(callId, callSession);
    }

    // 通知状态变更
    this.listeners.onCallStateChanged?.(callId, newState, previousState);

    console.log(`CallManager: 通话状态变更 ${callId}: ${previousState} -> ${newState}`);
  }

  /**
   * 生成通话ID
   */
  private generateCallId(): string {
    return `call-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 获取媒体约束
   */
  private getMediaConstraints(callType: CallType): MediaConstraints {
    switch (callType) {
      case 'audio':
        return { audio: true, video: false };
      case 'video':
        return { audio: true, video: true };
      case 'screen-share':
        return { audio: true, video: false }; // 屏幕共享单独处理
      default:
        return { audio: true, video: false };
    }
  }

  /**
   * 从媒体流获取媒体状态
   */
  private getMediaStateFromStream(stream: MediaStream, callType: CallType): MediaState {
    const audioTracks = stream.getAudioTracks();
    const videoTracks = stream.getVideoTracks();

    return {
      audioEnabled: audioTracks.length > 0 && audioTracks[0].enabled,
      videoEnabled: videoTracks.length > 0 && videoTracks[0].enabled,
      speakerEnabled: false,
      micMuted: audioTracks.length === 0 || !audioTracks[0].enabled,
      cameraOff: callType === 'video' ? (videoTracks.length === 0 || !videoTracks[0].enabled) : true,
      screenSharing: false
    };
  }

  /**
   * 设置通话超时
   */
  private setCallTimeout(callId: string, targetUserId: string): void {
    setTimeout(async () => {
      const callSession = this.activeCalls.get(callId);
      if (callSession && callSession.state === 'ringing') {
        console.log(`CallManager: 通话超时 ${callId}`);
        await this.endCall(callId, '响铃超时');
      }
    }, this.callTimeout);
  }

  /**
   * 清理通话会话
   */
  private cleanupCallSession(callId: string): void {
    this.activeCalls.delete(callId);
    console.log(`CallManager: 已清理通话会话 ${callId}`);
  }

  /**
   * 更新平均通话时长
   */
  private updateAverageDuration(duration: number): void {
    const totalDuration = this.stats.averageDuration * (this.stats.completedCalls - 1) + duration;
    this.stats.averageDuration = totalDuration / this.stats.completedCalls;
  }

  // ====================== 信令处理方法 ======================

  /**
   * 处理收到的通话请求
   */
  private async handleIncomingCallRequest(fromUser: string, data: CallRequestSignalData): Promise<void> {
    try {
      // 检查是否已有活跃通话
      if (this.hasActiveCall()) {
        // 发送忙线拒绝
        const rejectData: CallResponseSignalData = {
          callId: data.callId,
          accepted: false,
          reason: '用户忙线中'
        };
        await signalingService.sendCallReject(fromUser, rejectData);
        return;
      }

      // 创建来电会话
      const callSession = await this.createCallSession(
        data.callId,
        data.callType,
        'incoming',
        [fromUser]
      );

      // 设置状态为响铃中
      this.updateCallState(data.callId, 'ringing');

      // 通知有来电
      this.listeners.onIncomingCall?.(data.callId, fromUser, data.callType);

      console.log(`CallManager: 收到通话请求 ${data.callId} from ${fromUser}`);

    } catch (error) {
      console.error('CallManager: 处理通话请求失败', error);
    }
  }

  /**
   * 处理通话接受
   */
  private async handleCallAccept(fromUser: string, data: CallResponseSignalData): Promise<void> {
    const callSession = this.activeCalls.get(data.callId);
    if (!callSession) {
      return;
    }

    try {
      // 设置状态为连接中
      this.updateCallState(data.callId, 'connecting');

      console.log(`CallManager: 通话被接受 ${data.callId} by ${fromUser}`);

    } catch (error) {
      console.error('CallManager: 处理通话接受失败', error);
      await this.endCall(data.callId, '连接失败');
    }
  }

  /**
   * 处理通话拒绝
   */
  private async handleCallReject(fromUser: string, data: CallResponseSignalData): Promise<void> {
    const callSession = this.activeCalls.get(data.callId);
    if (!callSession) {
      return;
    }

    // 设置状态为已拒绝
    this.updateCallState(data.callId, 'rejected');

    // 清理会话
    this.cleanupCallSession(data.callId);
    this.stats.rejectedCalls++;

    // 通知监听器
    this.listeners.onCallEnded?.(data.callId, 0, data.reason || '通话被拒绝');

    console.log(`CallManager: 通话被拒绝 ${data.callId} by ${fromUser}, 原因: ${data.reason}`);
  }

  /**
   * 处理通话结束
   */
  private async handleCallEnd(fromUser: string, callId: string): Promise<void> {
    const callSession = this.activeCalls.get(callId);
    if (!callSession) {
      return;
    }

    await this.endCall(callId, '对方结束通话');
  }

  /**
   * 处理群组通话请求
   */
  private async handleGroupCallRequest(fromUser: string, data: GroupCallSignalData): Promise<void> {
    try {
      // 通知群组通话邀请
      this.listeners.onGroupCallInvite?.(data.callId, data.groupName, fromUser);

      console.log(`CallManager: 收到群组通话邀请 ${data.callId} from ${fromUser} in group ${data.groupName}`);

    } catch (error) {
      console.error('CallManager: 处理群组通话请求失败', error);
    }
  }

  /**
   * 处理群组通话加入
   */
  private async handleGroupCallJoin(fromUser: string, data: GroupCallSignalData): Promise<void> {
    const callSession = this.activeCalls.get(data.callId);
    if (!callSession) {
      return;
    }

    try {
      // 添加参与者
      const participant: CallParticipant = {
        userId: fromUser,
        userName: fromUser,
        isLocal: false,
        mediaState: {
          audioEnabled: true,
          videoEnabled: data.callType === 'video',
          speakerEnabled: false,
          micMuted: false,
          cameraOff: data.callType !== 'video',
          screenSharing: false
        },
        connectionState: 'new',
        joinedAt: Date.now()
      };

      callSession.participants.set(fromUser, participant);

      // 建立WebRTC连接
      await webrtcManager.createPeerConnection(fromUser, true);

      // 通知参与者加入
      this.listeners.onParticipantJoined?.(data.callId, participant);

      console.log(`CallManager: 用户加入群组通话 ${fromUser} in ${data.callId}`);

    } catch (error) {
      console.error('CallManager: 处理群组通话加入失败', error);
    }
  }

  /**
   * 处理群组通话离开
   */
  private async handleGroupCallLeave(fromUser: string, data: GroupCallSignalData): Promise<void> {
    const callSession = this.activeCalls.get(data.callId);
    if (!callSession) {
      return;
    }

    try {
      // 移除参与者
      callSession.participants.delete(fromUser);

      // 关闭WebRTC连接
      await webrtcManager.closePeerConnection(fromUser);

      // 通知参与者离开
      this.listeners.onParticipantLeft?.(data.callId, fromUser, '主动离开');

      console.log(`CallManager: 用户离开群组通话 ${fromUser} in ${data.callId}`);

    } catch (error) {
      console.error('CallManager: 处理群组通话离开失败', error);
    }
  }

  // ====================== WebRTC事件处理方法 ======================

  /**
   * 处理连接状态变化
   */
  private handleConnectionStateChange(userId: string, state: ConnectionState): void {
    // 查找相关的通话会话并更新参与者状态
    for (const [callId, callSession] of this.activeCalls) {
      const participant = callSession.participants.get(userId);
      if (participant) {
        participant.connectionState = state;

        // 如果连接成功，设置通话状态为已连接
        if (state === 'connected' && callSession.state === 'connecting') {
          this.updateCallState(callId, 'connected');
        }

        // 如果连接失败，结束通话
        if (state === 'failed' || state === 'closed') {
          this.endCall(callId, '连接失败或关闭');
        }

        break;
      }
    }
  }

  /**
   * 处理远程媒体流
   */
  private handleRemoteStream(userId: string, stream: MediaStream): void {
    // 查找相关的通话会话并更新参与者流
    for (const [callId, callSession] of this.activeCalls) {
      const participant = callSession.participants.get(userId);
      if (participant) {
        participant.stream = stream;
        participant.mediaState = this.getMediaStateFromStream(stream, callSession.callType);

        // 通知远程流接收
        this.listeners.onRemoteStreamReceived?.(callId, userId, stream);

        break;
      }
    }
  }

  /**
   * 处理WebRTC错误
   */
  private handleWebRTCError(userId: string, error: Error): void {
    console.error(`CallManager: WebRTC错误 ${userId}`, error);

    // 查找相关的通话会话并结束通话
    for (const [callId, callSession] of this.activeCalls) {
      if (callSession.participants.has(userId)) {
        this.listeners.onCallFailed?.(callId, error);
        this.endCall(callId, `WebRTC错误: ${error.message}`);
        break;
      }
    }
  }

  /**
   * 销毁通话管理器
   */
  destroy(): void {
    console.log('CallManager: 开始销毁...');

    // 结束所有活跃通话
    for (const [callId] of this.activeCalls) {
      this.endCall(callId, '系统关闭').catch(error => {
        console.error(`结束通话失败 ${callId}:`, error);
      });
    }

    // 清理数据
    this.activeCalls.clear();
    this.listeners = {};
    this.currentUserId = null;
    this.isInitialized = false;

    console.log('CallManager: 销毁完成');
  }
}

// 创建单例实例
const callManager = new CallManager();

// 导出管理器实例和类型
export default callManager;
export { CallManager };