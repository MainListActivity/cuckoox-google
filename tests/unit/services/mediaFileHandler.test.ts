import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { mediaFileHandler } from '@/src/services/mediaFileHandler';
import webrtcManager from '@/src/services/webrtcManager';
import rtcConfigManager from '@/src/services/rtcConfigManager';

// Mock dependencies
vi.mock('@/src/services/webrtcManager', () => ({
  default: {
    sendDataChannelMessage: vi.fn(),
    onDataChannelMessage: vi.fn(),
    onDataChannelOpen: vi.fn(),
    onDataChannelClose: vi.fn(),
    hasConnection: vi.fn(),
    createPeerConnection: vi.fn(),
  },
}));

vi.mock('@/src/services/rtcConfigManager', () => ({
  default: {
    getConfig: vi.fn(),
    getMaxFileSize: vi.fn(),
    getSupportedFileTypes: vi.fn(),
    isFileSupported: vi.fn(),
    isFileSizeValid: vi.fn(),
  },
}));

const mockWebrtcManager = webrtcManager as {
  sendDataChannelMessage: Mock;
  onDataChannelMessage: Mock;
  onDataChannelOpen: Mock;
  onDataChannelClose: Mock;
  hasConnection: Mock;
  createPeerConnection: Mock;
};

const mockRtcConfigManager = rtcConfigManager as {
  getConfig: Mock;
  getMaxFileSize: Mock;
  getSupportedFileTypes: Mock;
  isFileSupported: Mock;
  isFileSizeValid: Mock;
};

// Mock File and FileReader
const mockFile = {
  name: 'test.jpg',
  size: 1024000,
  type: 'image/jpeg',
  lastModified: Date.now(),
  arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(1024000)),
  slice: vi.fn(),
} as unknown as File;

const mockFileReader = {
  readAsArrayBuffer: vi.fn(),
  readAsDataURL: vi.fn(),
  result: null,
  onload: null,
  onerror: null,
};

global.FileReader = vi.fn(() => mockFileReader) as any;
global.URL = {
  createObjectURL: vi.fn().mockReturnValue('blob:mock-url'),
  revokeObjectURL: vi.fn(),
} as any;

// Mock Canvas for image processing
const mockCanvas = {
  getContext: vi.fn().mockReturnValue({
    drawImage: vi.fn(),
    getImageData: vi.fn(),
    putImageData: vi.fn(),
  }),
  toBlob: vi.fn(),
  width: 0,
  height: 0,
};

global.HTMLCanvasElement = vi.fn(() => mockCanvas) as any;
document.createElement = vi.fn((tagName) => {
  if (tagName === 'canvas') return mockCanvas;
  if (tagName === 'img') return { onload: null, onerror: null, src: '' };
  return {};
}) as any;

describe('MediaFileHandler', () => {
  const mockConfig = {
    max_file_size: 100 * 1024 * 1024, // 100MB
    file_chunk_size: 16384, // 16KB
    supported_image_types: ['image/jpeg', 'image/png', 'image/gif'],
    supported_video_types: ['video/mp4', 'video/webm'],
    supported_audio_types: ['audio/mp3', 'audio/wav', 'audio/ogg'],
    supported_document_types: ['application/pdf'],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mocks
    mockRtcConfigManager.getConfig.mockReturnValue(mockConfig);
    mockRtcConfigManager.getMaxFileSize.mockReturnValue(mockConfig.max_file_size);
    mockRtcConfigManager.getSupportedFileTypes.mockReturnValue({
      images: mockConfig.supported_image_types,
      videos: mockConfig.supported_video_types,
      audios: mockConfig.supported_audio_types,
      documents: mockConfig.supported_document_types,
    });
    mockRtcConfigManager.isFileSupported.mockReturnValue(true);
    mockRtcConfigManager.isFileSizeValid.mockReturnValue(true);
    
    mockWebrtcManager.hasConnection.mockReturnValue(true);
    mockWebrtcManager.sendDataChannelMessage.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('File Validation', () => {
    it('should validate file type correctly', async () => {
      // Act
      const isValid = await mediaFileHandler.validateFileType(mockFile, mockConfig.supported_image_types);

      // Assert
      expect(isValid).toBe(true);
    });

    it('should reject unsupported file type', async () => {
      // Arrange
      const unsupportedFile = { ...mockFile, type: 'application/exe' } as File;

      // Act
      const isValid = await mediaFileHandler.validateFileType(unsupportedFile, mockConfig.supported_image_types);

      // Assert
      expect(isValid).toBe(false);
    });

    it('should validate file size correctly', async () => {
      // Act
      const isValid = await mediaFileHandler.validateFileSize(mockFile, mockConfig.max_file_size);

      // Assert
      expect(isValid).toBe(true);
    });

    it('should reject oversized file', async () => {
      // Arrange
      const oversizedFile = { ...mockFile, size: mockConfig.max_file_size + 1 } as File;

      // Act
      const isValid = await mediaFileHandler.validateFileSize(oversizedFile, mockConfig.max_file_size);

      // Assert
      expect(isValid).toBe(false);
    });
  });

  describe('File Processing', () => {
    it('should split file into chunks correctly', async () => {
      // Arrange
      const chunkSize = 1024;
      const fileBuffer = new ArrayBuffer(3000);
      mockFile.arrayBuffer = vi.fn().mockResolvedValue(fileBuffer);

      // Act
      const chunks = await mediaFileHandler.splitFileToChunks(mockFile, chunkSize);

      // Assert
      expect(chunks).toHaveLength(3); // 3000 bytes / 1024 = 3 chunks
      expect(chunks[0].byteLength).toBe(chunkSize);
      expect(chunks[1].byteLength).toBe(chunkSize);
      expect(chunks[2].byteLength).toBe(3000 - 2 * chunkSize);
    });

    it('should reassemble file from chunks correctly', async () => {
      // Arrange
      const chunks = [
        new ArrayBuffer(1024),
        new ArrayBuffer(1024),
        new ArrayBuffer(952)
      ];
      const metadata = {
        fileName: 'test.jpg',
        fileSize: 3000,
        fileType: 'image/jpeg',
        fileHash: 'mock-hash',
      };

      // Act
      const reassembledFile = await mediaFileHandler.reassembleFile(chunks, metadata);

      // Assert
      expect(reassembledFile.name).toBe(metadata.fileName);
      expect(reassembledFile.size).toBe(metadata.fileSize);
      expect(reassembledFile.type).toBe(metadata.fileType);
    });

    it('should generate thumbnail for image', async () => {
      // Arrange
      mockCanvas.toBlob = vi.fn((callback) => {
        callback(new Blob(['mock-thumbnail'], { type: 'image/jpeg' }));
      });

      // Act
      const thumbnail = await mediaFileHandler.generateThumbnail(mockFile);

      // Assert
      expect(thumbnail).toBe('blob:mock-url');
      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });

    it('should extract file metadata correctly', async () => {
      // Act
      const metadata = await mediaFileHandler.extractMetadata(mockFile);

      // Assert
      expect(metadata).toEqual({
        fileName: mockFile.name,
        fileSize: mockFile.size,
        fileType: mockFile.type,
        lastModified: mockFile.lastModified,
        fileHash: expect.any(String),
      });
    });
  });

  describe('P2P File Transfer', () => {
    const targetUserId = 'user456';
    const transferId = 'transfer123';

    it('should send file successfully', async () => {
      // Arrange
      const mockTransferId = 'mock-transfer-id';
      vi.spyOn(mediaFileHandler, 'generateTransferId').mockReturnValue(mockTransferId);

      // Act
      const result = await mediaFileHandler.sendFile(mockFile, targetUserId);

      // Assert
      expect(result).toBe(mockTransferId);
      expect(mockWebrtcManager.sendDataChannelMessage).toHaveBeenCalled();
    });

    it('should handle file transfer progress', async () => {
      // Arrange
      const progressCallback = vi.fn();
      const mockProgress = {
        transferId,
        fileName: mockFile.name,
        totalSize: mockFile.size,
        transferredSize: 512,
        percentage: 50,
        speed: 1024,
        estimatedTimeRemaining: 30,
        status: 'transferring' as const,
      };

      // Act
      mediaFileHandler.onTransferProgress(transferId, progressCallback);
      
      // Simulate progress update
      (mediaFileHandler as any).updateTransferProgress(transferId, mockProgress);

      // Assert
      expect(progressCallback).toHaveBeenCalledWith(mockProgress);
    });

    it('should handle transfer completion', async () => {
      // Arrange
      const completeCallback = vi.fn();

      // Act
      mediaFileHandler.onTransferComplete(transferId, completeCallback);
      
      // Simulate transfer completion
      (mediaFileHandler as any).completeTransfer(transferId, mockFile);

      // Assert
      expect(completeCallback).toHaveBeenCalledWith(mockFile);
    });

    it('should handle transfer errors', async () => {
      // Arrange
      const errorCallback = vi.fn();
      const mockError = {
        transferId,
        errorCode: 'NETWORK_ERROR',
        errorMessage: 'Connection lost',
        canRetry: true,
        retryAfter: 5,
      };

      // Act
      mediaFileHandler.onTransferError(transferId, errorCallback);
      
      // Simulate transfer error
      (mediaFileHandler as any).handleTransferError(transferId, mockError);

      // Assert
      expect(errorCallback).toHaveBeenCalledWith(mockError);
    });

    it('should pause file transfer', async () => {
      // Arrange
      (mediaFileHandler as any).activeTransfers.set(transferId, {
        status: 'transferring',
        file: mockFile,
        targetUserId,
      });

      // Act
      await mediaFileHandler.pauseFileTransfer(transferId);

      // Assert
      const transfer = (mediaFileHandler as any).activeTransfers.get(transferId);
      expect(transfer.status).toBe('paused');
    });

    it('should resume file transfer', async () => {
      // Arrange
      (mediaFileHandler as any).activeTransfers.set(transferId, {
        status: 'paused',
        file: mockFile,
        targetUserId,
        pausedAt: 512,
      });

      // Act
      await mediaFileHandler.resumeFileTransfer(transferId);

      // Assert
      const transfer = (mediaFileHandler as any).activeTransfers.get(transferId);
      expect(transfer.status).toBe('transferring');
    });

    it('should cancel file transfer', async () => {
      // Arrange
      (mediaFileHandler as any).activeTransfers.set(transferId, {
        status: 'transferring',
        file: mockFile,
        targetUserId,
      });

      // Act
      await mediaFileHandler.cancelFileTransfer(transferId);

      // Assert
      expect((mediaFileHandler as any).activeTransfers.has(transferId)).toBe(false);
    });
  });

  describe('File Compression', () => {
    it('should compress image successfully', async () => {
      // Arrange
      const quality = 0.8;
      mockCanvas.toBlob = vi.fn((callback) => {
        callback(new Blob(['compressed-image'], { type: 'image/jpeg' }));
      });

      // Act
      const compressedFile = await mediaFileHandler.compressImage(mockFile, quality);

      // Assert
      expect(compressedFile).toBeInstanceOf(File);
      expect(compressedFile.type).toBe('image/jpeg');
    });

    it('should handle image compression failure', async () => {
      // Arrange
      mockCanvas.toBlob = vi.fn((callback) => {
        callback(null); // Simulate compression failure
      });

      // Act & Assert
      await expect(mediaFileHandler.compressImage(mockFile, 0.8))
        .rejects.toThrow('图片压缩失败');
    });
  });

  describe('File Caching', () => {
    const cacheKey = 'test-cache-key';

    it('should cache file successfully', async () => {
      // Act
      await mediaFileHandler.cacheFile(mockFile, cacheKey);

      // Assert
      const cachedFile = await mediaFileHandler.getCachedFile(cacheKey);
      expect(cachedFile).toBeDefined();
      expect(cachedFile!.name).toBe(mockFile.name);
    });

    it('should return null for non-existent cache', async () => {
      // Act
      const cachedFile = await mediaFileHandler.getCachedFile('non-existent-key');

      // Assert
      expect(cachedFile).toBeNull();
    });

    it('should clear file cache', async () => {
      // Arrange
      await mediaFileHandler.cacheFile(mockFile, cacheKey);

      // Act
      await mediaFileHandler.clearFileCache();

      // Assert
      const cachedFile = await mediaFileHandler.getCachedFile(cacheKey);
      expect(cachedFile).toBeNull();
    });

    it('should clear file cache with pattern', async () => {
      // Arrange
      await mediaFileHandler.cacheFile(mockFile, 'test-1');
      await mediaFileHandler.cacheFile(mockFile, 'test-2');
      await mediaFileHandler.cacheFile(mockFile, 'other-1');

      // Act
      await mediaFileHandler.clearFileCache('test-*');

      // Assert
      expect(await mediaFileHandler.getCachedFile('test-1')).toBeNull();
      expect(await mediaFileHandler.getCachedFile('test-2')).toBeNull();
      expect(await mediaFileHandler.getCachedFile('other-1')).toBeDefined();
    });
  });

  describe('Multiple File Operations', () => {
    const targetUserId = 'user456';
    const files = [
      { ...mockFile, name: 'file1.jpg' },
      { ...mockFile, name: 'file2.jpg' },
      { ...mockFile, name: 'file3.jpg' },
    ] as File[];

    it('should send multiple files successfully', async () => {
      // Arrange
      vi.spyOn(mediaFileHandler, 'sendFile').mockResolvedValue('transfer-id');

      // Act
      const transferIds = await mediaFileHandler.sendMultipleFiles(files, targetUserId);

      // Assert
      expect(transferIds).toHaveLength(files.length);
      expect(mediaFileHandler.sendFile).toHaveBeenCalledTimes(files.length);
    });

    it('should create file package successfully', async () => {
      // Arrange
      const packageName = 'test-package';

      // Act
      const packageFile = await mediaFileHandler.createFilePackage(files, packageName);

      // Assert
      expect(packageFile.name).toBe(`${packageName}.zip`);
      expect(packageFile.type).toBe('application/zip');
    });

    it('should extract file package successfully', async () => {
      // Arrange
      const packageFile = new File(['mock-zip-content'], 'package.zip', { type: 'application/zip' });

      // Act
      const extractedFiles = await mediaFileHandler.extractFilePackage(packageFile);

      // Assert
      expect(extractedFiles).toBeInstanceOf(Array);
      expect(extractedFiles.length).toBeGreaterThan(0);
    });
  });

  describe('Preview Management', () => {
    it('should create preview URL successfully', () => {
      // Act
      const previewUrl = mediaFileHandler.createPreviewUrl(mockFile);

      // Assert
      expect(previewUrl).toBe('blob:mock-url');
      expect(global.URL.createObjectURL).toHaveBeenCalledWith(mockFile);
    });

    it('should revoke preview URL successfully', () => {
      // Arrange
      const previewUrl = 'blob:mock-url';

      // Act
      mediaFileHandler.revokePreviewUrl(previewUrl);

      // Assert
      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith(previewUrl);
    });

    it('should generate preview thumbnail with custom size', async () => {
      // Arrange
      const size = { width: 200, height: 150 };
      mockCanvas.toBlob = vi.fn((callback) => {
        callback(new Blob(['thumbnail'], { type: 'image/jpeg' }));
      });

      // Act
      const thumbnail = await mediaFileHandler.generatePreviewThumbnail(mockFile, size);

      // Assert
      expect(thumbnail).toBe('blob:mock-url');
      expect(mockCanvas.width).toBe(size.width);
      expect(mockCanvas.height).toBe(size.height);
    });
  });

  describe('Error Handling', () => {
    it('should handle file reading errors', async () => {
      // Arrange
      mockFile.arrayBuffer = vi.fn().mockRejectedValue(new Error('File read error'));

      // Act & Assert
      await expect(mediaFileHandler.splitFileToChunks(mockFile, 1024))
        .rejects.toThrow('File read error');
    });

    it('should handle network connection errors', async () => {
      // Arrange
      mockWebrtcManager.hasConnection.mockReturnValue(false);

      // Act & Assert
      await expect(mediaFileHandler.sendFile(mockFile, 'user456'))
        .rejects.toThrow('WebRTC连接不存在');
    });

    it('should handle data channel send errors', async () => {
      // Arrange
      mockWebrtcManager.sendDataChannelMessage.mockRejectedValue(new Error('Send failed'));

      // Act & Assert
      await expect(mediaFileHandler.sendFile(mockFile, 'user456'))
        .rejects.toThrow('Send failed');
    });
  });
});