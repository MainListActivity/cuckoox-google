import mediaFileHandler, { FileMetadata, FileChunk, TransferProgress, TransferStatus } from './mediaFileHandler';
import webrtcManager from './webrtcManager';
import signalingService, { SignalType } from './signalingService';
import rtcConfigManager from './rtcConfigManager';

// 文件传输会话状态
export type TransferSessionState = 'preparing' | 'negotiating' | 'transferring' | 'paused' | 'completed' | 'failed' | 'cancelled';

// 传输方向
export type TransferDirection = 'sending' | 'receiving';

// 文件传输控制消息类型
export enum FileTransferMessageType {
  TRANSFER_REQUEST = 'transfer-request',
  TRANSFER_ACCEPT = 'transfer-accept',
  TRANSFER_REJECT = 'transfer-reject',
  TRANSFER_START = 'transfer-start',
  CHUNK_REQUEST = 'chunk-request',
  CHUNK_DATA = 'chunk-data',
  CHUNK_ACK = 'chunk-ack',
  TRANSFER_COMPLETE = 'transfer-complete',
  TRANSFER_CANCEL = 'transfer-cancel',
  TRANSFER_PAUSE = 'transfer-pause',
  TRANSFER_RESUME = 'transfer-resume',
  TRANSFER_ERROR = 'transfer-error'
}

// 文件传输会话信息
export interface FileTransferSession {
  sessionId: string;
  transferId: string;
  userId: string;
  direction: TransferDirection;
  state: TransferSessionState;
  metadata: FileMetadata;
  chunks: Map<number, FileChunk>;
  completedChunks: Set<number>;
  failedChunks: Set<number>;
  currentChunkIndex: number;
  startTime: number;
  lastActivityTime: number;
  concurrency: number;
  retryCount: number;
  maxRetries: number;
}

// 传输统计信息
export interface TransferStats {
  sessionId: string;
  totalSessions: number;
  activeSessions: number;
  completedTransfers: number;
  failedTransfers: number;
  totalBytesTransferred: number;
  averageSpeed: number;
  successRate: number;
}

// 事件监听器接口
export interface P2PFileTransferEventListeners {
  onSessionCreated?: (sessionId: string, metadata: FileMetadata) => void;
  onTransferRequest?: (fromUser: string, metadata: FileMetadata, sessionId: string) => void;
  onTransferAccepted?: (sessionId: string) => void;
  onTransferRejected?: (sessionId: string, reason?: string) => void;
  onTransferStarted?: (sessionId: string) => void;
  onTransferProgress?: (sessionId: string, progress: TransferProgress) => void;
  onTransferCompleted?: (sessionId: string, file?: File) => void;
  onTransferFailed?: (sessionId: string, error: Error) => void;
  onTransferCancelled?: (sessionId: string) => void;
  onTransferPaused?: (sessionId: string) => void;
  onTransferResumed?: (sessionId: string) => void;
}

/**
 * P2PFileTransferService - P2P文件传输服务
 * 基于WebRTC DataChannel实现点对点文件传输，支持分片传输、进度监控、断点续传
 */
class P2PFileTransferService {
  private sessions: Map<string, FileTransferSession> = new Map();
  private listeners: P2PFileTransferEventListeners = {};
  private isInitialized: boolean = false;
  private maxConcurrentSessions: number = 3;
  private stats: TransferStats;
  
  constructor() {
    this.stats = {
      sessionId: '',
      totalSessions: 0,
      activeSessions: 0,
      completedTransfers: 0,
      failedTransfers: 0,
      totalBytesTransferred: 0,
      averageSpeed: 0,
      successRate: 0
    };
    this.initialize();
  }

  /**
   * 初始化P2P文件传输服务
   */
  private async initialize(): Promise<void> {
    try {
      // 设置WebRTC事件监听器
      webrtcManager.setEventListeners({
        onDataChannelMessage: (userId: string, message: any) => {
          this.handleDataChannelMessage(userId, message);
        },
        onDataChannelOpen: (userId: string) => {
          console.log(`P2PFileTransferService: 数据通道已打开 ${userId}`);
        },
        onDataChannelClose: (userId: string) => {
          this.handleDataChannelClose(userId);
        },
        onError: (userId: string, error: Error) => {
          this.handleConnectionError(userId, error);
        }
      });

      // 设置文件处理器事件监听器
      mediaFileHandler.setEventListeners({
        onTransferProgress: (progress: TransferProgress) => {
          this.handleFileTransferProgress(progress);
        },
        onTransferComplete: (transferId: string, metadata: FileMetadata) => {
          this.handleFileTransferComplete(transferId, metadata);
        },
        onTransferError: (error: any) => {
          this.handleFileTransferError(error);
        }
      });

      this.isInitialized = true;
      console.log('P2PFileTransferService: 初始化完成');
    } catch (error) {
      console.error('P2PFileTransferService: 初始化失败', error);
      throw error;
    }
  }

  /**
   * 设置事件监听器
   */
  setEventListeners(listeners: P2PFileTransferEventListeners): void {
    this.listeners = { ...this.listeners, ...listeners };
  }

  /**
   * 发起文件传输
   */
  async initiateFileTransfer(userId: string, file: File): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('P2PFileTransferService未初始化');
    }

    // 检查当前活跃会话数量
    if (this.getActiveSessionCount() >= this.maxConcurrentSessions) {
      throw new Error('超过最大并发传输数量限制');
    }

    try {
      // 验证文件
      if (!mediaFileHandler.validateFileType(file)) {
        throw new Error('不支持的文件类型');
      }

      if (!mediaFileHandler.validateFileSize(file)) {
        throw new Error('文件大小超过限制');
      }

      // 确保WebRTC连接存在
      if (!webrtcManager.hasConnection(userId)) {
        await webrtcManager.createPeerConnection(userId, true);
      }

      // 分割文件为分片
      const { metadata, chunks } = await mediaFileHandler.splitFileToChunks(file);
      
      // 创建传输会话
      const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const session: FileTransferSession = {
        sessionId,
        transferId: metadata.transferId,
        userId,
        direction: 'sending',
        state: 'preparing',
        metadata,
        chunks: new Map(chunks.map(chunk => [chunk.chunkIndex, chunk])),
        completedChunks: new Set(),
        failedChunks: new Set(),
        currentChunkIndex: 0,
        startTime: Date.now(),
        lastActivityTime: Date.now(),
        concurrency: await this.getOptimalConcurrency(),
        retryCount: 0,
        maxRetries: 3
      };

      this.sessions.set(sessionId, session);
      this.stats.totalSessions++;
      this.stats.activeSessions++;

      // 通知监听器
      this.listeners.onSessionCreated?.(sessionId, metadata);

      // 发送传输请求信令
      await this.sendTransferRequest(userId, sessionId, metadata);

      console.log(`P2PFileTransferService: 已发起文件传输 ${sessionId} to ${userId}`);
      return sessionId;

    } catch (error) {
      console.error('P2PFileTransferService: 发起文件传输失败', error);
      throw error;
    }
  }

  /**
   * 发送传输请求信令
   */
  private async sendTransferRequest(userId: string, sessionId: string, metadata: FileMetadata): Promise<void> {
    const requestData = {
      type: FileTransferMessageType.TRANSFER_REQUEST,
      sessionId,
      metadata: {
        fileName: metadata.fileName,
        fileSize: metadata.fileSize,
        fileType: metadata.fileType,
        mimeType: metadata.mimeType,
        thumbnailData: metadata.thumbnailData,
        duration: metadata.duration,
        dimensions: metadata.dimensions,
        totalChunks: metadata.totalChunks
      }
    };

    await signalingService.sendPrivateSignal(
      SignalType.OFFER,
      requestData,
      userId
    );
  }

  /**
   * 接受文件传输
   */
  async acceptFileTransfer(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`传输会话不存在: ${sessionId}`);
    }

    if (session.state !== 'negotiating') {
      throw new Error(`无效的会话状态: ${session.state}`);
    }

    try {
      session.state = 'transferring';
      session.lastActivityTime = Date.now();

      // 发送接受信令
      await this.sendTransferControl(session.userId, {
        type: FileTransferMessageType.TRANSFER_ACCEPT,
        sessionId
      });

      // 通知监听器
      this.listeners.onTransferAccepted?.(sessionId);

      console.log(`P2PFileTransferService: 已接受文件传输 ${sessionId}`);
    } catch (error) {
      console.error('P2PFileTransferService: 接受文件传输失败', error);
      session.state = 'failed';
      throw error;
    }
  }

  /**
   * 拒绝文件传输
   */
  async rejectFileTransfer(sessionId: string, reason?: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`传输会话不存在: ${sessionId}`);
    }

    try {
      session.state = 'cancelled';

      // 发送拒绝信령
      await this.sendTransferControl(session.userId, {
        type: FileTransferMessageType.TRANSFER_REJECT,
        sessionId,
        reason
      });

      // 清理会话
      this.cleanupSession(sessionId);

      // 通知监听器
      this.listeners.onTransferRejected?.(sessionId, reason);

      console.log(`P2PFileTransferService: 已拒绝文件传输 ${sessionId}`);
    } catch (error) {
      console.error('P2PFileTransferService: 拒绝文件传输失败', error);
      throw error;
    }
  }

  /**
   * 开始文件传输
   */
  private async startFileTransfer(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    if (session.direction !== 'sending') {
      return;
    }

    try {
      session.state = 'transferring';
      session.startTime = Date.now();
      session.lastActivityTime = Date.now();

      // 发送开始信령
      await this.sendTransferControl(session.userId, {
        type: FileTransferMessageType.TRANSFER_START,
        sessionId
      });

      // 开始发送分片
      await this.sendNextChunks(sessionId);

      // 通知监听器
      this.listeners.onTransferStarted?.(sessionId);

      console.log(`P2PFileTransferService: 开始文件传输 ${sessionId}`);
    } catch (error) {
      console.error('P2PFileTransferService: 开始文件传输失败', error);
      await this.failSession(sessionId, error);
    }
  }

  /**
   * 发送下一批分片
   */
  private async sendNextChunks(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session || session.state !== 'transferring') {
      return;
    }

    try {
      const chunksToSend: number[] = [];
      let sentCount = 0;

      // 找到需要发送的分片
      for (let i = session.currentChunkIndex; i < session.metadata.totalChunks; i++) {
        if (!session.completedChunks.has(i) && !session.failedChunks.has(i)) {
          chunksToSend.push(i);
          sentCount++;

          if (sentCount >= session.concurrency) {
            break;
          }
        }
      }

      // 发送分片
      for (const chunkIndex of chunksToSend) {
        await this.sendChunk(sessionId, chunkIndex);
      }

      session.currentChunkIndex = Math.max(session.currentChunkIndex, Math.max(...chunksToSend) + 1);
    } catch (error) {
      console.error('P2PFileTransferService: 发送分片失败', error);
      await this.failSession(sessionId, error);
    }
  }

  /**
   * 发送单个分片
   */
  private async sendChunk(sessionId: string, chunkIndex: number): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    const chunk = session.chunks.get(chunkIndex);
    if (!chunk) {
      throw new Error(`分片不存在: ${chunkIndex}`);
    }

    try {
      const chunkMessage = {
        type: FileTransferMessageType.CHUNK_DATA,
        sessionId,
        chunkIndex,
        chunkSize: chunk.chunkSize,
        hash: chunk.hash,
        data: Array.from(new Uint8Array(chunk.data)) // 转换为可序列化格式
      };

      // 通过数据通道发送
      webrtcManager.sendDataChannelMessage(session.userId, chunkMessage);
      
      session.lastActivityTime = Date.now();
      console.log(`P2PFileTransferService: 已发送分片 ${sessionId}/${chunkIndex}`);
    } catch (error) {
      console.error(`P2PFileTransferService: 发送分片失败 ${chunkIndex}`, error);
      session.failedChunks.add(chunkIndex);
      throw error;
    }
  }

  /**
   * 处理数据通道消息
   */
  private async handleDataChannelMessage(userId: string, message: any): Promise<void> {
    try {
      if (typeof message !== 'object' || !message.type) {
        return;
      }

      const { type, sessionId } = message;

      switch (type) {
        case FileTransferMessageType.TRANSFER_REQUEST:
          await this.handleTransferRequest(userId, message);
          break;

        case FileTransferMessageType.TRANSFER_ACCEPT:
          await this.handleTransferAccept(sessionId);
          break;

        case FileTransferMessageType.TRANSFER_REJECT:
          await this.handleTransferReject(sessionId, message.reason);
          break;

        case FileTransferMessageType.TRANSFER_START:
          await this.handleTransferStart(sessionId);
          break;

        case FileTransferMessageType.CHUNK_DATA:
          await this.handleChunkData(userId, message);
          break;

        case FileTransferMessageType.CHUNK_ACK:
          await this.handleChunkAck(sessionId, message.chunkIndex);
          break;

        case FileTransferMessageType.TRANSFER_COMPLETE:
          await this.handleTransferComplete(sessionId);
          break;

        case FileTransferMessageType.TRANSFER_CANCEL:
          await this.handleTransferCancel(sessionId);
          break;

        case FileTransferMessageType.TRANSFER_ERROR:
          await this.handleTransferError(sessionId, message.error);
          break;

        default:
          console.warn(`P2PFileTransferService: 未知消息类型 ${type}`);
      }
    } catch (error) {
      console.error('P2PFileTransferService: 处理数据通道消息失败', error);
    }
  }

  /**
   * 处理传输请求
   */
  private async handleTransferRequest(fromUser: string, message: any): Promise<void> {
    const { sessionId, metadata } = message;

    try {
      // 创建接收会话
      const session: FileTransferSession = {
        sessionId,
        transferId: `receive-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        userId: fromUser,
        direction: 'receiving',
        state: 'negotiating',
        metadata: {
          ...metadata,
          transferId: `receive-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          transferStatus: 'preparing' as TransferStatus,
          createdAt: Date.now()
        },
        chunks: new Map(),
        completedChunks: new Set(),
        failedChunks: new Set(),
        currentChunkIndex: 0,
        startTime: Date.now(),
        lastActivityTime: Date.now(),
        concurrency: await this.getOptimalConcurrency(),
        retryCount: 0,
        maxRetries: 3
      };

      this.sessions.set(sessionId, session);
      this.stats.totalSessions++;
      this.stats.activeSessions++;

      // 通知监听器
      this.listeners.onTransferRequest?.(fromUser, session.metadata, sessionId);

      console.log(`P2PFileTransferService: 收到传输请求 ${sessionId} from ${fromUser}`);
    } catch (error) {
      console.error('P2PFileTransferService: 处理传输请求失败', error);
    }
  }

  /**
   * 处理传输接受
   */
  private async handleTransferAccept(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    try {
      await this.startFileTransfer(sessionId);
    } catch (error) {
      console.error('P2PFileTransferService: 处理传输接受失败', error);
      await this.failSession(sessionId, error);
    }
  }

  /**
   * 处理传输拒绝
   */
  private async handleTransferReject(sessionId: string, reason?: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    session.state = 'cancelled';
    this.cleanupSession(sessionId);
    this.listeners.onTransferRejected?.(sessionId, reason);
  }

  /**
   * 处理分片数据
   */
  private async handleChunkData(fromUser: string, message: any): Promise<void> {
    const { sessionId, chunkIndex, chunkSize, hash, data } = message;
    const session = this.sessions.get(sessionId);
    
    if (!session || session.direction !== 'receiving') {
      return;
    }

    try {
      // 重建分片数据
      const chunkData = new Uint8Array(data).buffer;
      const chunk: FileChunk = {
        chunkIndex,
        chunkSize,
        data: chunkData,
        hash
      };

      // 验证分片完整性
      const calculatedHash = await this.calculateChunkHash(chunkData);
      if (calculatedHash !== hash) {
        throw new Error(`分片完整性验证失败: ${chunkIndex}`);
      }

      // 添加到文件处理器
      mediaFileHandler.addReceivedChunk(session.transferId, chunk);
      session.completedChunks.add(chunkIndex);
      session.lastActivityTime = Date.now();

      // 发送确认
      await this.sendTransferControl(fromUser, {
        type: FileTransferMessageType.CHUNK_ACK,
        sessionId,
        chunkIndex
      });

      // 检查是否完成
      if (mediaFileHandler.isTransferComplete(session.transferId, session.metadata.totalChunks)) {
        await this.completeReceiveTransfer(sessionId);
      }

      console.log(`P2PFileTransferService: 已接收分片 ${sessionId}/${chunkIndex}`);
    } catch (error) {
      console.error(`P2PFileTransferService: 处理分片数据失败 ${chunkIndex}`, error);
      session.failedChunks.add(chunkIndex);
    }
  }

  /**
   * 处理分片确认
   */
  private async handleChunkAck(sessionId: string, chunkIndex: number): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session || session.direction !== 'sending') {
      return;
    }

    session.completedChunks.add(chunkIndex);
    session.lastActivityTime = Date.now();

    // 更新进度
    const progress = this.calculateProgress(session);
    this.listeners.onTransferProgress?.(sessionId, progress);

    // 检查是否还有分片需要发送
    if (session.completedChunks.size < session.metadata.totalChunks) {
      await this.sendNextChunks(sessionId);
    } else {
      // 所有分片已发送完成
      await this.completeSendTransfer(sessionId);
    }
  }

  /**
   * 完成发送传输
   */
  private async completeSendTransfer(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    try {
      session.state = 'completed';

      // 发送完成信令
      await this.sendTransferControl(session.userId, {
        type: FileTransferMessageType.TRANSFER_COMPLETE,
        sessionId
      });

      // 更新统计
      this.stats.completedTransfers++;
      this.stats.totalBytesTransferred += session.metadata.fileSize;

      // 通知监听器
      this.listeners.onTransferCompleted?.(sessionId);

      // 清理会话
      this.cleanupSession(sessionId);

      console.log(`P2PFileTransferService: 发送传输完成 ${sessionId}`);
    } catch (error) {
      console.error('P2PFileTransferService: 完成发送传输失败', error);
      await this.failSession(sessionId, error);
    }
  }

  /**
   * 完成接收传输
   */
  private async completeReceiveTransfer(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    try {
      // 重组文件
      const chunks = mediaFileHandler.getChunkMap?.(session.transferId);
      if (!chunks) {
        throw new Error('无法获取分片数据');
      }

      const file = await mediaFileHandler.reassembleFile(chunks, session.metadata);
      session.state = 'completed';

      // 更新统计
      this.stats.completedTransfers++;
      this.stats.totalBytesTransferred += session.metadata.fileSize;

      // 通知监听器
      this.listeners.onTransferCompleted?.(sessionId, file);

      // 清理会话
      this.cleanupSession(sessionId);

      console.log(`P2PFileTransferService: 接收传输完成 ${sessionId}`);
    } catch (error) {
      console.error('P2PFileTransferService: 完成接收传输失败', error);
      await this.failSession(sessionId, error);
    }
  }

  /**
   * 计算分片哈希
   */
  private async calculateChunkHash(data: ArrayBuffer): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * 发送传输控制消息
   */
  private async sendTransferControl(userId: string, message: any): Promise<void> {
    try {
      webrtcManager.sendDataChannelMessage(userId, message);
    } catch (error) {
      console.error('P2PFileTransferService: 发送传输控制消息失败', error);
      throw error;
    }
  }

  /**
   * 计算传输进度
   */
  private calculateProgress(session: FileTransferSession): TransferProgress {
    const completed = session.completedChunks.size;
    const total = session.metadata.totalChunks;
    const percentage = (completed / total) * 100;
    
    const elapsed = Date.now() - session.startTime;
    const transferredSize = completed * session.metadata.chunkSize;
    const speed = elapsed > 0 ? (transferredSize / elapsed) * 1000 : 0;
    const remainingSize = session.metadata.fileSize - transferredSize;
    const estimatedTimeRemaining = speed > 0 ? remainingSize / speed : 0;

    return {
      transferId: session.transferId,
      fileName: session.metadata.fileName,
      totalSize: session.metadata.fileSize,
      transferredSize,
      percentage,
      speed,
      estimatedTimeRemaining,
      status: session.state as TransferStatus,
      chunksCompleted: completed,
      totalChunks: total
    };
  }

  /**
   * 获取最优并发数
   */
  private async getOptimalConcurrency(): Promise<number> {
    const config = await rtcConfigManager.getConfig();
    return Math.min(config.performance_config.chunk_upload_concurrency, 5);
  }

  /**
   * 处理文件传输进度
   */
  private handleFileTransferProgress(progress: TransferProgress): void {
    // 查找对应的会话
    for (const [sessionId, session] of this.sessions) {
      if (session.transferId === progress.transferId) {
        this.listeners.onTransferProgress?.(sessionId, progress);
        break;
      }
    }
  }

  /**
   * 处理文件传输完成
   */
  private handleFileTransferComplete(transferId: string, metadata: FileMetadata): void {
    // 在会话完成时已经处理
  }

  /**
   * 处理文件传输错误
   */
  private handleFileTransferError(error: any): void {
    console.error('P2PFileTransferService: 文件传输错误', error);
  }

  /**
   * 处理数据通道关闭
   */
  private handleDataChannelClose(userId: string): void {
    // 查找用户的活跃传输并标记为失败
    for (const [sessionId, session] of this.sessions) {
      if (session.userId === userId && session.state === 'transferring') {
        this.failSession(sessionId, new Error('数据通道已关闭'));
      }
    }
  }

  /**
   * 处理连接错误
   */
  private handleConnectionError(userId: string, error: Error): void {
    // 查找用户的活跃传输并标记为失败
    for (const [sessionId, session] of this.sessions) {
      if (session.userId === userId && session.state === 'transferring') {
        this.failSession(sessionId, error);
      }
    }
  }

  /**
   * 处理传输取消
   */
  private async handleTransferCancel(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    session.state = 'cancelled';
    this.cleanupSession(sessionId);
    this.listeners.onTransferCancelled?.(sessionId);
  }

  /**
   * 处理传输错误
   */
  private async handleTransferError(sessionId: string, error: any): Promise<void> {
    await this.failSession(sessionId, new Error(error));
  }

  /**
   * 处理传输开始
   */
  private async handleTransferStart(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    session.state = 'transferring';
    session.startTime = Date.now();
    this.listeners.onTransferStarted?.(sessionId);
  }

  /**
   * 处理传输完成
   */
  private async handleTransferComplete(sessionId: string): Promise<void> {
    await this.completeReceiveTransfer(sessionId);
  }

  /**
   * 失败会话
   */
  private async failSession(sessionId: string, error: Error): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    console.error(`P2PFileTransferService: 传输失败 ${sessionId}`, error);

    session.state = 'failed';
    this.stats.failedTransfers++;

    try {
      // 发送错误信令
      await this.sendTransferControl(session.userId, {
        type: FileTransferMessageType.TRANSFER_ERROR,
        sessionId,
        error: error.message
      });
    } catch (sendError) {
      console.error('发送错误信令失败:', sendError);
    }

    // 通知监听器
    this.listeners.onTransferFailed?.(sessionId, error);

    // 清理会话
    this.cleanupSession(sessionId);
  }

  /**
   * 取消传输
   */
  async cancelTransfer(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`传输会话不存在: ${sessionId}`);
    }

    try {
      session.state = 'cancelled';

      // 发送取消信令
      await this.sendTransferControl(session.userId, {
        type: FileTransferMessageType.TRANSFER_CANCEL,
        sessionId
      });

      // 通知监听器
      this.listeners.onTransferCancelled?.(sessionId);

      // 清理会话
      this.cleanupSession(sessionId);

      console.log(`P2PFileTransferService: 已取消传输 ${sessionId}`);
    } catch (error) {
      console.error('P2PFileTransferService: 取消传输失败', error);
      throw error;
    }
  }

  /**
   * 暂停传输
   */
  async pauseTransfer(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`传输会话不存在: ${sessionId}`);
    }

    if (session.state !== 'transferring') {
      throw new Error(`无法暂停，当前状态: ${session.state}`);
    }

    try {
      session.state = 'paused';

      // 发送暂停信令
      await this.sendTransferControl(session.userId, {
        type: FileTransferMessageType.TRANSFER_PAUSE,
        sessionId
      });

      // 通知监听器
      this.listeners.onTransferPaused?.(sessionId);

      console.log(`P2PFileTransferService: 已暂停传输 ${sessionId}`);
    } catch (error) {
      console.error('P2PFileTransferService: 暂停传输失败', error);
      throw error;
    }
  }

  /**
   * 恢复传输
   */
  async resumeTransfer(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`传输会话不存在: ${sessionId}`);
    }

    if (session.state !== 'paused') {
      throw new Error(`无法恢复，当前状态: ${session.state}`);
    }

    try {
      session.state = 'transferring';
      session.lastActivityTime = Date.now();

      // 发送恢复信令
      await this.sendTransferControl(session.userId, {
        type: FileTransferMessageType.TRANSFER_RESUME,
        sessionId
      });

      // 继续传输
      if (session.direction === 'sending') {
        await this.sendNextChunks(sessionId);
      }

      // 通知监听器
      this.listeners.onTransferResumed?.(sessionId);

      console.log(`P2PFileTransferService: 已恢复传输 ${sessionId}`);
    } catch (error) {
      console.error('P2PFileTransferService: 恢复传输失败', error);
      throw error;
    }
  }

  /**
   * 获取传输会话信息
   */
  getTransferSession(sessionId: string): FileTransferSession | null {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * 获取所有活跃传输
   */
  getActiveTransfers(): FileTransferSession[] {
    return Array.from(this.sessions.values()).filter(
      session => session.state === 'transferring' || session.state === 'negotiating'
    );
  }

  /**
   * 获取活跃会话数量
   */
  private getActiveSessionCount(): number {
    return Array.from(this.sessions.values()).filter(
      session => session.state !== 'completed' && session.state !== 'failed' && session.state !== 'cancelled'
    ).length;
  }

  /**
   * 获取传输统计信息
   */
  getTransferStats(): TransferStats {
    this.stats.activeSessions = this.getActiveSessionCount();
    this.stats.successRate = this.stats.totalSessions > 0 
      ? (this.stats.completedTransfers / this.stats.totalSessions) * 100 
      : 0;
    
    return { ...this.stats };
  }

  /**
   * 清理会话
   */
  private cleanupSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    // 从MediaFileHandler清理传输数据
    if (session.direction === 'receiving') {
      mediaFileHandler.cancelTransfer(session.transferId);
    }

    // 从会话池中移除
    this.sessions.delete(sessionId);
    this.stats.activeSessions = Math.max(0, this.stats.activeSessions - 1);

    console.log(`P2PFileTransferService: 已清理会话 ${sessionId}`);
  }

  /**
   * 销毁服务
   */
  destroy(): void {
    console.log('P2PFileTransferService: 开始销毁...');

    // 取消所有活跃传输
    for (const [sessionId] of this.sessions) {
      this.cancelTransfer(sessionId).catch(error => {
        console.error(`取消传输失败 ${sessionId}:`, error);
      });
    }

    // 清理数据
    this.sessions.clear();
    this.listeners = {};
    this.isInitialized = false;

    console.log('P2PFileTransferService: 销毁完成');
  }
}

// 创建单例实例
const p2pFileTransferService = new P2PFileTransferService();

// 导出服务实例和类型
export default p2pFileTransferService;
export { P2PFileTransferService };