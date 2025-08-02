import webrtcManager, { MediaConstraints, ConnectionState } from './webrtcManager';
import signalingService, { SignalType, CallRequestSignalData, CallResponseSignalData, GroupCallSignalData } from './signalingService';
import rtcConfigManager from './rtcConfigManager';

// 通话类型
export type CallType = 'audio' | 'video' | 'screen-share';

// 通话状态
export type CallState = 'idle' | 'initiating' | 'ringing' | 'connecting' | 'connected' | 'ended' | 'failed' | 'rejected';

// 通话方向
export type CallDirection = 'outgoing' | 'incoming';

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
  metadata?: any;
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
  private stats: CallStats;

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
  toggleSpeaker(callId: string): boolean {
    const callSession = this.activeCalls.get(callId);
    if (!callSession) {
      return false;
    }

    const newSpeakerState = !callSession.localParticipant.mediaState.speakerEnabled;
    callSession.localParticipant.mediaState.speakerEnabled = newSpeakerState;

    // 通知媒体状态变更
    this.listeners.onParticipantMediaChanged?.(
      callId,
      this.currentUserId!,
      callSession.localParticipant.mediaState
    );

    return newSpeakerState;
  }

  /**
   * 开始屏幕共享
   */
  async startScreenShare(callId: string): Promise<void> {
    const callSession = this.activeCalls.get(callId);
    if (!callSession) {
      throw new Error(`通话会话不存在: ${callId}`);
    }

    try {
      // 获取屏幕共享流
      const screenStream = await webrtcManager.getDisplayMedia();
      
      // 替换视频轨道
      for (const [userId, participant] of callSession.participants) {
        if (!participant.isLocal) {
          const connection = webrtcManager.getConnectionInfo(userId);
          if (connection) {
            const senders = connection.connection.getSenders();
            const videoSender = senders.find(sender => 
              sender.track && sender.track.kind === 'video'
            );

            if (videoSender) {
              const videoTrack = screenStream.getVideoTracks()[0];
              if (videoTrack) {
                await videoSender.replaceTrack(videoTrack);
              }
            }
          }
        }
      }

      // 更新媒体状态
      callSession.localParticipant.mediaState.screenSharing = true;
      
      // 监听屏幕共享结束事件
      screenStream.getVideoTracks()[0].onended = () => {
        this.stopScreenShare(callId);
      };

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
  async stopScreenShare(callId: string): Promise<void> {
    const callSession = this.activeCalls.get(callId);
    if (!callSession || !callSession.localParticipant.mediaState.screenSharing) {
      return;
    }

    try {
      // 重新获取摄像头流
      if (callSession.callType === 'video') {
        const constraints = this.getMediaConstraints('video');
        const cameraStream = await webrtcManager.getUserMedia(constraints);

        // 替换视频轨道
        for (const [userId, participant] of callSession.participants) {
          if (!participant.isLocal) {
            const connection = webrtcManager.getConnectionInfo(userId);
            if (connection) {
              const senders = connection.connection.getSenders();
              const videoSender = senders.find(sender => 
                sender.track && sender.track.kind === 'video'
              );

              if (videoSender) {
                const videoTrack = cameraStream.getVideoTracks()[0];
                if (videoTrack) {
                  await videoSender.replaceTrack(videoTrack);
                }
              }
            }
          }
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