import rtcConfigManager, { RTCConfig } from './rtcConfigManager';

// 文件传输状态
export type TransferStatus = 'preparing' | 'transferring' | 'paused' | 'completed' | 'failed' | 'cancelled';

// 文件元数据接口
export interface FileMetadata {
  fileName: string;
  fileSize: number;
  fileType: string;
  mimeType: string;
  fileHash: string;
  chunkSize: number;
  totalChunks: number;
  thumbnailData?: string;
  duration?: number; // 音视频时长(秒)
  dimensions?: { width: number; height: number };
  transferStatus: TransferStatus;
  transferId: string;
  createdAt: number;
}

// 文件分片信息
export interface FileChunk {
  chunkIndex: number;
  chunkSize: number;
  data: ArrayBuffer;
  hash: string;
}

// 传输进度信息
export interface TransferProgress {
  transferId: string;
  fileName: string;
  totalSize: number;
  transferredSize: number;
  percentage: number;
  speed: number; // bytes per second
  estimatedTimeRemaining: number; // seconds
  status: TransferStatus;
  chunksCompleted: number;
  totalChunks: number;
}

// 传输错误信息
export interface TransferError {
  transferId: string;
  errorCode: string;
  errorMessage: string;
  canRetry: boolean;
  retryAfter?: number; // seconds
}

// 压缩选项
export interface CompressionOptions {
  quality: number; // 0.0 - 1.0
  maxWidth?: number;
  maxHeight?: number;
  format?: 'jpeg' | 'png' | 'webp';
}

// 事件监听器接口
export interface MediaFileEventListeners {
  onTransferProgress?: (progress: TransferProgress) => void;
  onTransferComplete?: (transferId: string, metadata: FileMetadata) => void;
  onTransferError?: (error: TransferError) => void;
  onChunkProcessed?: (transferId: string, chunkIndex: number) => void;
}

/**
 * MediaFileHandler - 多媒体文件处理器
 * 实现文件分片、重组、验证、压缩、缩略图生成等功能
 */
class MediaFileHandler {
  private config: RTCConfig | null = null;
  private listeners: MediaFileEventListeners = {};
  private activeTransfers: Map<string, TransferProgress> = new Map();
  private chunkCache: Map<string, Map<number, FileChunk>> = new Map();
  private isInitialized: boolean = false;

  constructor() {
    this.initialize();
  }

  /**
   * 初始化文件处理器
   */
  private async initialize(): Promise<void> {
    try {
      this.config = await rtcConfigManager.getConfig();
      
      // 监听配置变更
      rtcConfigManager.onConfigUpdate((newConfig) => {
        this.config = newConfig;
        console.log('MediaFileHandler: 配置已更新');
      });

      this.isInitialized = true;
      console.log('MediaFileHandler: 初始化完成');
    } catch (error) {
      console.error('MediaFileHandler: 初始化失败', error);
      throw error;
    }
  }

  /**
   * 设置事件监听器
   */
  setEventListeners(listeners: MediaFileEventListeners): void {
    this.listeners = { ...this.listeners, ...listeners };
  }

  /**
   * 验证文件类型
   */
  validateFileType(file: File): boolean {
    if (!this.config) return false;

    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!extension) return false;

    const allSupportedTypes = [
      ...this.config.supported_image_types,
      ...this.config.supported_video_types,
      ...this.config.supported_audio_types,
      ...this.config.supported_document_types
    ];

    return allSupportedTypes.includes(extension);
  }

  /**
   * 验证文件大小
   */
  validateFileSize(file: File): boolean {
    if (!this.config) return false;
    return file.size <= this.config.max_file_size;
  }

  /**
   * 生成文件哈希
   */
  private async generateFileHash(file: File | ArrayBuffer): Promise<string> {
    const data = file instanceof File ? await file.arrayBuffer() : file;
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * 生成缩略图
   */
  async generateThumbnail(file: File, size: { width: number; height: number } = { width: 200, height: 200 }): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) {
        reject(new Error('只支持图片文件生成缩略图'));
        return;
      }

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        try {
          // 计算等比例缩放尺寸
          const aspectRatio = img.width / img.height;
          let { width, height } = size;

          if (aspectRatio > 1) {
            height = width / aspectRatio;
          } else {
            width = height * aspectRatio;
          }

          canvas.width = width;
          canvas.height = height;

          // 绘制缩略图
          ctx?.drawImage(img, 0, 0, width, height);

          // 转换为base64
          const thumbnailData = canvas.toDataURL('image/jpeg', 0.8);
          resolve(thumbnailData);
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = () => reject(new Error('加载图片失败'));
      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * 压缩图片
   */
  async compressImage(file: File, options: CompressionOptions): Promise<File> {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) {
        reject(new Error('只支持图片文件压缩'));
        return;
      }

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        try {
          let { width, height } = img;

          // 如果指定了最大尺寸，进行缩放
          if (options.maxWidth && width > options.maxWidth) {
            height = (height * options.maxWidth) / width;
            width = options.maxWidth;
          }
          if (options.maxHeight && height > options.maxHeight) {
            width = (width * options.maxHeight) / height;
            height = options.maxHeight;
          }

          canvas.width = width;
          canvas.height = height;

          // 绘制图片
          ctx?.drawImage(img, 0, 0, width, height);

          // 压缩并输出
          canvas.toBlob(
            (blob) => {
              if (blob) {
                const compressedFile = new File([blob], file.name, {
                  type: blob.type,
                  lastModified: Date.now()
                });
                resolve(compressedFile);
              } else {
                reject(new Error('压缩失败'));
              }
            },
            options.format ? `image/${options.format}` : file.type,
            options.quality
          );
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = () => reject(new Error('加载图片失败'));
      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * 获取媒体文件信息
   */
  async extractMediaMetadata(file: File): Promise<{ duration?: number; dimensions?: { width: number; height: number } }> {
    return new Promise((resolve) => {
      const metadata: { duration?: number; dimensions?: { width: number; height: number } } = {};

      if (file.type.startsWith('video/')) {
        const video = document.createElement('video');
        video.onloadedmetadata = () => {
          metadata.duration = video.duration;
          metadata.dimensions = { width: video.videoWidth, height: video.videoHeight };
          resolve(metadata);
        };
        video.onerror = () => resolve(metadata);
        video.src = URL.createObjectURL(file);
      } else if (file.type.startsWith('audio/')) {
        const audio = document.createElement('audio');
        audio.onloadedmetadata = () => {
          metadata.duration = audio.duration;
          resolve(metadata);
        };
        audio.onerror = () => resolve(metadata);
        audio.src = URL.createObjectURL(file);
      } else if (file.type.startsWith('image/')) {
        const img = new Image();
        img.onload = () => {
          metadata.dimensions = { width: img.width, height: img.height };
          resolve(metadata);
        };
        img.onerror = () => resolve(metadata);
        img.src = URL.createObjectURL(file);
      } else {
        resolve(metadata);
      }
    });
  }

  /**
   * 将文件分片
   */
  async splitFileToChunks(file: File): Promise<{ metadata: FileMetadata; chunks: FileChunk[] }> {
    if (!this.isInitialized || !this.config) {
      throw new Error('MediaFileHandler未初始化');
    }

    try {
      const transferId = `transfer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const chunkSize = this.config.file_chunk_size;
      const totalChunks = Math.ceil(file.size / chunkSize);
      const fileHash = await this.generateFileHash(file);

      // 提取媒体元数据
      const mediaMetadata = await this.extractMediaMetadata(file);

      // 生成缩略图（如果是图片）
      let thumbnailData: string | undefined;
      if (file.type.startsWith('image/')) {
        try {
          thumbnailData = await this.generateThumbnail(file);
        } catch (error) {
          console.warn('生成缩略图失败:', error);
        }
      }

      // 创建文件元数据
      const metadata: FileMetadata = {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.name.split('.').pop()?.toLowerCase() || '',
        mimeType: file.type,
        fileHash,
        chunkSize,
        totalChunks,
        thumbnailData,
        duration: mediaMetadata.duration,
        dimensions: mediaMetadata.dimensions,
        transferStatus: 'preparing',
        transferId,
        createdAt: Date.now()
      };

      // 创建分片
      const chunks: FileChunk[] = [];
      const fileArrayBuffer = await file.arrayBuffer();

      for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const chunkData = fileArrayBuffer.slice(start, end);
        const chunkHash = await this.generateFileHash(chunkData);

        chunks.push({
          chunkIndex: i,
          chunkSize: chunkData.byteLength,
          data: chunkData,
          hash: chunkHash
        });
      }

      // 初始化传输进度
      const progress: TransferProgress = {
        transferId,
        fileName: file.name,
        totalSize: file.size,
        transferredSize: 0,
        percentage: 0,
        speed: 0,
        estimatedTimeRemaining: 0,
        status: 'preparing',
        chunksCompleted: 0,
        totalChunks
      };

      this.activeTransfers.set(transferId, progress);

      console.log(`MediaFileHandler: 文件分片完成 ${file.name}, ${totalChunks} 个分片`);
      return { metadata, chunks };

    } catch (error) {
      console.error('MediaFileHandler: 文件分片失败', error);
      throw error;
    }
  }

  /**
   * 重组文件
   */
  async reassembleFile(chunks: Map<number, FileChunk>, metadata: FileMetadata): Promise<File> {
    try {
      if (chunks.size !== metadata.totalChunks) {
        throw new Error(`分片不完整: ${chunks.size}/${metadata.totalChunks}`);
      }

      // 按顺序组装分片
      const orderedChunks: ArrayBuffer[] = [];
      for (let i = 0; i < metadata.totalChunks; i++) {
        const chunk = chunks.get(i);
        if (!chunk) {
          throw new Error(`缺少分片 ${i}`);
        }
        orderedChunks.push(chunk.data);
      }

      // 合并所有分片
      const totalSize = orderedChunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
      const reassembledData = new Uint8Array(totalSize);
      let offset = 0;

      for (const chunk of orderedChunks) {
        reassembledData.set(new Uint8Array(chunk), offset);
        offset += chunk.byteLength;
      }

      // 验证文件完整性
      const reassembledHash = await this.generateFileHash(reassembledData.buffer);
      if (reassembledHash !== metadata.fileHash) {
        throw new Error('文件完整性验证失败');
      }

      // 创建文件对象
      const file = new File([reassembledData], metadata.fileName, {
        type: metadata.mimeType,
        lastModified: Date.now()
      });

      console.log(`MediaFileHandler: 文件重组完成 ${metadata.fileName}`);
      return file;

    } catch (error) {
      console.error('MediaFileHandler: 文件重组失败', error);
      throw error;
    }
  }

  /**
   * 添加接收到的分片
   */
  addReceivedChunk(transferId: string, chunk: FileChunk): void {
    let chunkMap = this.chunkCache.get(transferId);
    if (!chunkMap) {
      chunkMap = new Map();
      this.chunkCache.set(transferId, chunkMap);
    }

    chunkMap.set(chunk.chunkIndex, chunk);

    // 更新传输进度
    const progress = this.activeTransfers.get(transferId);
    if (progress) {
      progress.chunksCompleted = chunkMap.size;
      progress.transferredSize = Array.from(chunkMap.values())
        .reduce((sum, c) => sum + c.chunkSize, 0);
      progress.percentage = (progress.chunksCompleted / progress.totalChunks) * 100;

      this.activeTransfers.set(transferId, progress);
      this.listeners.onTransferProgress?.(progress);
      this.listeners.onChunkProcessed?.(transferId, chunk.chunkIndex);
    }
  }

  /**
   * 检查传输是否完成
   */
  isTransferComplete(transferId: string, expectedChunks: number): boolean {
    const chunkMap = this.chunkCache.get(transferId);
    return chunkMap ? chunkMap.size === expectedChunks : false;
  }

  /**
   * 获取传输进度
   */
  getTransferProgress(transferId: string): TransferProgress | null {
    return this.activeTransfers.get(transferId) || null;
  }

  /**
   * 更新传输状态
   */
  updateTransferStatus(transferId: string, status: TransferStatus): void {
    const progress = this.activeTransfers.get(transferId);
    if (progress) {
      progress.status = status;
      this.activeTransfers.set(transferId, progress);
      this.listeners.onTransferProgress?.(progress);

      if (status === 'completed' || status === 'failed' || status === 'cancelled') {
        // 延迟清理，给UI时间显示最终状态
        setTimeout(() => {
          this.cleanupTransfer(transferId);
        }, 5000);
      }
    }
  }

  /**
   * 取消传输
   */
  cancelTransfer(transferId: string): void {
    this.updateTransferStatus(transferId, 'cancelled');
    console.log(`MediaFileHandler: 已取消传输 ${transferId}`);
  }

  /**
   * 清理传输数据
   */
  private cleanupTransfer(transferId: string): void {
    this.activeTransfers.delete(transferId);
    this.chunkCache.delete(transferId);
    console.log(`MediaFileHandler: 已清理传输数据 ${transferId}`);
  }

  /**
   * 创建文件预览URL
   */
  createPreviewUrl(file: File): string {
    return URL.createObjectURL(file);
  }

  /**
   * 释放预览URL
   */
  revokePreviewUrl(url: string): void {
    URL.revokeObjectURL(url);
  }

  /**
   * 获取所有活跃传输
   */
  getActiveTransfers(): TransferProgress[] {
    return Array.from(this.activeTransfers.values());
  }

  /**
   * 清理所有传输
   */
  clearAllTransfers(): void {
    this.activeTransfers.clear();
    this.chunkCache.clear();
    console.log('MediaFileHandler: 已清理所有传输数据');
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
    const config = await rtcConfigManager.getConfig();
    return {
      images: config.supported_image_types,
      videos: config.supported_video_types,
      audios: config.supported_audio_types,
      documents: config.supported_document_types
    };
  }

  /**
   * 销毁文件处理器
   */
  destroy(): void {
    console.log('MediaFileHandler: 开始销毁...');
    
    // 清理所有传输数据
    this.clearAllTransfers();
    
    // 重置状态
    this.listeners = {};
    this.isInitialized = false;
    
    console.log('MediaFileHandler: 销毁完成');
  }
}

// 创建单例实例
const mediaFileHandler = new MediaFileHandler();

// 导出处理器实例和类型
export default mediaFileHandler;
export { MediaFileHandler };