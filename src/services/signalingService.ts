import { RecordId } from 'surrealdb';
import { useSurrealClientSingleton, TenantCodeMissingError } from '@/src/contexts/SurrealProvider';
import type { SurrealWorkerAPI } from '@/src/contexts/SurrealProvider';

// 信令类型枚举
export enum SignalType {
  OFFER = 'offer',
  ANSWER = 'answer',
  ICE_CANDIDATE = 'ice-candidate',
  CALL_REQUEST = 'call-request',
  CALL_ACCEPT = 'call-accept',
  CALL_REJECT = 'call-reject',
  CALL_END = 'call-end',
  CONFERENCE_INVITE = 'conference-invite',
  GROUP_CALL_REQUEST = 'group-call-request',
  GROUP_CALL_JOIN = 'group-call-join',
  GROUP_CALL_LEAVE = 'group-call-leave'
}

// 信令消息接口
export interface SignalMessage {
  id?: string;
  signal_type: SignalType;
  from_user: RecordId | string;
  to_user?: RecordId | string;
  group_id?: RecordId | string;
  signal_data: any;
  call_id?: string;
  created_at?: string;
  expires_at?: string;
  processed?: boolean;
}

// WebRTC信令数据类型
export interface OfferSignalData {
  type: 'offer';
  sdp: string;
  constraints?: {
    audio: boolean;
    video: boolean;
  };
}

export interface AnswerSignalData {
  type: 'answer';
  sdp: string;
}

export interface IceCandidateSignalData {
  candidate: string;
  sdpMLineIndex: number | null;
  sdpMid: string | null;
  usernameFragment: string | null;
}

export interface CallRequestSignalData {
  callType: 'audio' | 'video';
  callId: string;
  initiatorName: string;
  constraints?: {
    audio: boolean;
    video: boolean;
  };
}

export interface CallResponseSignalData {
  callId: string;
  accepted: boolean;
  reason?: string;
}

export interface GroupCallSignalData {
  callId: string;
  callType: 'audio' | 'video' | 'conference';
  groupName: string;
  initiatorName: string;
  participants?: string[];
}

// 信令事件监听器类型
export interface SignalingEventListeners {
  onSignalReceived?: (signal: SignalMessage) => void;
  onOfferReceived?: (fromUser: string, data: OfferSignalData, callId?: string) => void;
  onAnswerReceived?: (fromUser: string, data: AnswerSignalData, callId?: string) => void;
  onIceCandidateReceived?: (fromUser: string, data: IceCandidateSignalData, callId?: string) => void;
  onCallRequest?: (fromUser: string, data: CallRequestSignalData) => void;
  onCallAccept?: (fromUser: string, data: CallResponseSignalData) => void;
  onCallReject?: (fromUser: string, data: CallResponseSignalData) => void;
  onCallEnd?: (fromUser: string, callId: string) => void;
  onGroupCallRequest?: (fromUser: string, data: GroupCallSignalData) => void;
  onGroupCallJoin?: (fromUser: string, data: GroupCallSignalData) => void;
  onGroupCallLeave?: (fromUser: string, data: GroupCallSignalData) => void;
  onError?: (error: Error) => void;
}

/**
 * SignalingService - WebRTC信令服务
 * 基于SurrealDB Live Query实现实时信令消息传递
 */
class SignalingService {
  private clientGetter: () => Promise<SurrealWorkerAPI> | null = null;
  private listeners: SignalingEventListeners = {};
  private liveQueryUuids: string[] = [];
  private currentUserId: string | null = null;
  private isConnected: boolean = false;

  /**
   * 设置客户端获取函数
   */
  setClientGetter(getter: () => Promise<SurrealWorkerAPI>) {
    this.clientGetter = getter;
  }

  /**
   * 获取客户端实例
   */
  private async getClient(): Promise<SurrealWorkerAPI> {
    if (!this.clientGetter) {
      throw new Error('SignalingService: clientGetter not set. Please call setClientGetter first.');
    }
    
    const client = await this.clientGetter();
    if (!client) {
      throw new TenantCodeMissingError('无法获取数据库客户端');
    }
    
    return client;
  }

  /**
   * 设置事件监听器
   */
  setEventListeners(listeners: SignalingEventListeners): void {
    this.listeners = { ...this.listeners, ...listeners };
  }

  /**
   * 初始化信令服务
   */
  async initialize(userId: string): Promise<void> {
    try {
      this.currentUserId = userId;
      
      // 启动信令监听
      await this.startSignalingListeners();
      
      this.isConnected = true;
      console.log(`SignalingService: 已初始化，用户ID: ${userId}`);
    } catch (error) {
      console.error('SignalingService: 初始化失败', error);
      throw error;
    }
  }

  /**
   * 启动信令监听器
   */
  private async startSignalingListeners(): Promise<void> {
    if (!this.currentUserId) {
      throw new Error('用户ID未设置');
    }

    const client = await this.getClient();

    try {
      // 监听发送给当前用户的私聊信令
      const privateSignalUuid = await client.live(
        "SELECT * FROM webrtc_signal WHERE to_user = $user_id AND processed = false ORDER BY created_at DESC",
        (action: string, result: SignalMessage) => {
          if (action === 'CREATE' && result) {
            this.handleReceivedSignal(result);
          }
        },
        { user_id: this.currentUserId }
      );
      this.liveQueryUuids.push(privateSignalUuid);

      // 监听发送给当前用户参与的群组的信令
      const groupSignalUuid = await client.live(
        `SELECT webrtc_signal.* FROM webrtc_signal 
         WHERE group_id IN (SELECT group_id FROM group_member WHERE user_id = $user_id) 
         AND processed = false 
         ORDER BY created_at DESC`,
        (action: string, result: SignalMessage) => {
          if (action === 'CREATE' && result) {
            this.handleReceivedSignal(result);
          }
        },
        { user_id: this.currentUserId }
      );
      this.liveQueryUuids.push(groupSignalUuid);

      console.log('SignalingService: 信令监听器已启动');
    } catch (error) {
      console.error('SignalingService: 启动信令监听器失败', error);
      throw error;
    }
  }

  /**
   * 处理收到的信令消息
   */
  private async handleReceivedSignal(signal: SignalMessage): Promise<void> {
    try {
      console.log(`SignalingService: 收到信令消息`, signal.signal_type, signal.from_user);
      
      // 标记消息为已处理
      await this.markSignalAsProcessed(signal.id!);

      // 通用信令处理
      this.listeners.onSignalReceived?.(signal);

      // 根据信令类型分发到特定处理器
      const fromUser = typeof signal.from_user === 'string' ? signal.from_user : signal.from_user.toString();

      switch (signal.signal_type) {
        case SignalType.OFFER:
          this.listeners.onOfferReceived?.(fromUser, signal.signal_data as OfferSignalData, signal.call_id);
          break;

        case SignalType.ANSWER:
          this.listeners.onAnswerReceived?.(fromUser, signal.signal_data as AnswerSignalData, signal.call_id);
          break;

        case SignalType.ICE_CANDIDATE:
          this.listeners.onIceCandidateReceived?.(fromUser, signal.signal_data as IceCandidateSignalData, signal.call_id);
          break;

        case SignalType.CALL_REQUEST:
          this.listeners.onCallRequest?.(fromUser, signal.signal_data as CallRequestSignalData);
          break;

        case SignalType.CALL_ACCEPT:
          this.listeners.onCallAccept?.(fromUser, signal.signal_data as CallResponseSignalData);
          break;

        case SignalType.CALL_REJECT:
          this.listeners.onCallReject?.(fromUser, signal.signal_data as CallResponseSignalData);
          break;

        case SignalType.CALL_END:
          this.listeners.onCallEnd?.(fromUser, signal.call_id || '');
          break;

        case SignalType.GROUP_CALL_REQUEST:
          this.listeners.onGroupCallRequest?.(fromUser, signal.signal_data as GroupCallSignalData);
          break;

        case SignalType.GROUP_CALL_JOIN:
          this.listeners.onGroupCallJoin?.(fromUser, signal.signal_data as GroupCallSignalData);
          break;

        case SignalType.GROUP_CALL_LEAVE:
          this.listeners.onGroupCallLeave?.(fromUser, signal.signal_data as GroupCallSignalData);
          break;

        default:
          console.warn(`SignalingService: 未知信令类型 ${signal.signal_type}`);
      }
    } catch (error) {
      console.error('SignalingService: 处理信令消息失败', error);
      this.listeners.onError?.(new Error(`处理信令消息失败: ${error}`));
    }
  }

  /**
   * 标记信令消息为已处理
   */
  private async markSignalAsProcessed(signalId: string): Promise<void> {
    try {
      const client = await this.getClient();
      await client.query(
        "UPDATE webrtc_signal SET processed = true WHERE id = $signal_id",
        { signal_id: signalId }
      );
    } catch (error) {
      console.error('SignalingService: 标记信令消息失败', error);
    }
  }

  /**
   * 发送私聊信令消息
   */
  async sendPrivateSignal(type: SignalType, data: any, targetUserId: string, callId?: string): Promise<void> {
    if (!this.isConnected) {
      throw new Error('信令服务未连接');
    }

    try {
      const client = await this.getClient();
      
      const signalMessage: Partial<SignalMessage> = {
        signal_type: type,
        from_user: this.currentUserId!,
        to_user: targetUserId,
        signal_data: data,
        call_id: callId,
        processed: false
      };

      await client.query(
        `INSERT INTO webrtc_signal {
          signal_type: $signal_type,
          from_user: $from_user,
          to_user: $to_user,
          signal_data: $signal_data,
          call_id: $call_id,
          processed: $processed
        }`,
        signalMessage
      );

      console.log(`SignalingService: 已发送私聊信令 ${type} to ${targetUserId}`);
    } catch (error) {
      console.error(`SignalingService: 发送私聊信令失败 ${type}`, error);
      throw error;
    }
  }

  /**
   * 发送群组信令消息
   */
  async sendGroupSignal(type: SignalType, data: any, groupId: string, callId?: string): Promise<void> {
    if (!this.isConnected) {
      throw new Error('信令服务未连接');
    }

    try {
      const client = await this.getClient();
      
      const signalMessage: Partial<SignalMessage> = {
        signal_type: type,
        from_user: this.currentUserId!,
        group_id: groupId,
        signal_data: data,
        call_id: callId,
        processed: false
      };

      await client.query(
        `INSERT INTO webrtc_signal {
          signal_type: $signal_type,
          from_user: $from_user,
          group_id: $group_id,
          signal_data: $signal_data,
          call_id: $call_id,
          processed: $processed
        }`,
        signalMessage
      );

      console.log(`SignalingService: 已发送群组信令 ${type} to group ${groupId}`);
    } catch (error) {
      console.error(`SignalingService: 发送群组信令失败 ${type}`, error);
      throw error;
    }
  }

  /**
   * 发送Offer信令
   */
  async sendOffer(targetUserId: string, offer: OfferSignalData, callId?: string): Promise<void> {
    await this.sendPrivateSignal(SignalType.OFFER, offer, targetUserId, callId);
  }

  /**
   * 发送Answer信令
   */
  async sendAnswer(targetUserId: string, answer: AnswerSignalData, callId?: string): Promise<void> {
    await this.sendPrivateSignal(SignalType.ANSWER, answer, targetUserId, callId);
  }

  /**
   * 发送ICE候选信令
   */
  async sendIceCandidate(targetUserId: string, candidate: IceCandidateSignalData, callId?: string): Promise<void> {
    await this.sendPrivateSignal(SignalType.ICE_CANDIDATE, candidate, targetUserId, callId);
  }

  /**
   * 发送通话请求
   */
  async sendCallRequest(targetUserId: string, callData: CallRequestSignalData): Promise<void> {
    await this.sendPrivateSignal(SignalType.CALL_REQUEST, callData, targetUserId, callData.callId);
  }

  /**
   * 发送通话接受
   */
  async sendCallAccept(targetUserId: string, responseData: CallResponseSignalData): Promise<void> {
    await this.sendPrivateSignal(SignalType.CALL_ACCEPT, responseData, targetUserId, responseData.callId);
  }

  /**
   * 发送通话拒绝
   */
  async sendCallReject(targetUserId: string, responseData: CallResponseSignalData): Promise<void> {
    await this.sendPrivateSignal(SignalType.CALL_REJECT, responseData, targetUserId, responseData.callId);
  }

  /**
   * 发送通话结束
   */
  async sendCallEnd(targetUserId: string, callId: string): Promise<void> {
    await this.sendPrivateSignal(SignalType.CALL_END, { callId }, targetUserId, callId);
  }

  /**
   * 发送群组通话请求
   */
  async sendGroupCallRequest(groupId: string, callData: GroupCallSignalData): Promise<void> {
    await this.sendGroupSignal(SignalType.GROUP_CALL_REQUEST, callData, groupId, callData.callId);
  }

  /**
   * 发送群组通话加入
   */
  async sendGroupCallJoin(groupId: string, callData: GroupCallSignalData): Promise<void> {
    await this.sendGroupSignal(SignalType.GROUP_CALL_JOIN, callData, groupId, callData.callId);
  }

  /**
   * 发送群组通话离开
   */
  async sendGroupCallLeave(groupId: string, callData: GroupCallSignalData): Promise<void> {
    await this.sendGroupSignal(SignalType.GROUP_CALL_LEAVE, callData, groupId, callData.callId);
  }

  /**
   * 获取历史信令消息
   */
  async getSignalHistory(targetUserId?: string, groupId?: string, limit: number = 50): Promise<SignalMessage[]> {
    try {
      const client = await this.getClient();
      
      let query = "SELECT * FROM webrtc_signal WHERE ";
      let params: any = { user_id: this.currentUserId, limit };

      if (targetUserId) {
        query += "(from_user = $user_id AND to_user = $target_user_id) OR (from_user = $target_user_id AND to_user = $user_id)";
        params.target_user_id = targetUserId;
      } else if (groupId) {
        query += "group_id = $group_id";
        params.group_id = groupId;
      } else {
        query += "to_user = $user_id OR from_user = $user_id";
      }

      query += " ORDER BY created_at DESC LIMIT $limit";

      const result = await client.query<SignalMessage[][]>(query, params);
      return result?.[0] || [];
    } catch (error) {
      console.error('SignalingService: 获取信令历史失败', error);
      throw error;
    }
  }

  /**
   * 清理过期信令消息
   */
  async cleanupExpiredSignals(): Promise<void> {
    try {
      const client = await this.getClient();
      
      await client.query(
        "DELETE webrtc_signal WHERE expires_at < time::now() OR created_at < (time::now() - 24h)"
      );
      
      console.log('SignalingService: 已清理过期信令消息');
    } catch (error) {
      console.error('SignalingService: 清理过期信令消息失败', error);
    }
  }

  /**
   * 检查是否连接
   */
  isConnected(): boolean {
    return this.isConnected;
  }

  /**
   * 重新连接
   */
  async reconnect(): Promise<void> {
    if (!this.currentUserId) {
      throw new Error('用户ID未设置');
    }

    try {
      // 停止现有监听器
      await this.stopListeners();
      
      // 重新启动监听器
      await this.startSignalingListeners();
      
      this.isConnected = true;
      console.log('SignalingService: 重新连接成功');
    } catch (error) {
      console.error('SignalingService: 重新连接失败', error);
      throw error;
    }
  }

  /**
   * 停止信令监听器
   */
  private async stopListeners(): Promise<void> {
    if (this.liveQueryUuids.length === 0) {
      return;
    }

    try {
      const client = await this.getClient();
      
      for (const uuid of this.liveQueryUuids) {
        await client.kill(uuid);
      }
      
      this.liveQueryUuids = [];
      console.log('SignalingService: 已停止信令监听器');
    } catch (error) {
      console.error('SignalingService: 停止信令监听器失败', error);
    }
  }

  /**
   * 销毁信令服务
   */
  async destroy(): Promise<void> {
    console.log('SignalingService: 开始销毁...');
    
    try {
      // 停止监听器
      await this.stopListeners();
      
      // 重置状态
      this.listeners = {};
      this.currentUserId = null;
      this.isConnected = false;
      
      console.log('SignalingService: 销毁完成');
    } catch (error) {
      console.error('SignalingService: 销毁失败', error);
    }
  }

  /**
   * 获取服务状态
   */
  getStatus(): {
    connected: boolean;
    userId: string | null;
    activeListeners: number;
  } {
    return {
      connected: this.isConnected,
      userId: this.currentUserId,
      activeListeners: this.liveQueryUuids.length
    };
  }
}

// 创建单例实例
const signalingService = new SignalingService();

// 导出服务实例和类型
export default signalingService;
export { SignalingService };