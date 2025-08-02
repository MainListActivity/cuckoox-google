import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import mediaFileHandler, { 
  TransferStatus, 
  FileMetadata, 
  FileChunk, 
  TransferProgress, 
  CompressionOptions 
} from '@/src/services/mediaFileHandler';
import rtcConfigManager from '@/src/services/rtcConfigManager';

// Mock rtcConfigManager
vi.mock('@/src/services/rtcConfigManager', () => ({
  default: {
    getConfig: vi.fn(),
    onConfigUpdate: vi.fn(),
    isInitialized: vi.fn(),
  },
}));

const mockRtcConfigManager = rtcConfigManager as {
  getConfig: Mock;
  onConfigUpdate: Mock;
  isInitialized: Mock;
};

// Mock Web APIs
const mockCreateObjectURL = vi.fn();
const mockRevokeObjectURL = vi.fn();

vi.stubGlobal('URL', {
  createObjectURL: mockCreateObjectURL,
  revokeObjectURL: mockRevokeObjectURL,
});

// Mock FileReader
const mockFileReader = {
  readAsArrayBuffer: vi.fn(),
  readAsDataURL: vi.fn(),
  result: null,
  onload: null,
  onerror: null,
  addEventListener: vi.fn(),
};

vi.stubGlobal('FileReader', vi.fn(() => mockFileReader));

// Mock Canvas for image processing
const mockCanvas = {
  getContext: vi.fn(),
  toBlob: vi.fn(),
  toDataURL: vi.fn(),
  width: 0,
  height: 0,
};

const mockCanvasContext = {
  drawImage: vi.fn(),
  getImageData: vi.fn(),
  putImageData: vi.fn(),
};

mockCanvas.getContext.mockReturnValue(mockCanvasContext);
vi.stubGlobal('HTMLCanvasElement', vi.fn(() => mockCanvas));

// Mock Image
const mockImage = {
  onload: null,
  onerror: null,
  src: '',
  width: 800,
  height: 600,
  addEventListener: vi.fn(),
};

vi.stubGlobal('Image', vi.fn(() => mockImage));

// Mock crypto for hash generation
const mockCrypto = {
  subtle: {
    digest: vi.fn(),
  },
};

vi.stubGlobal('crypto', mockCrypto);

// Mock console
const mockConsole = {
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};
vi.stubGlobal('console', mockConsole);

// Mock config
const mockConfig = {
  max_file_size: 100 * 1024 * 1024, // 100MB
  file_chunk_size: 16384,
  supported_image_types: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  supported_video_types: ['video/mp4', 'video/webm', 'video/mov'],
  supported_audio_types: ['audio/mp3', 'audio/wav', 'audio/ogg'],
  supported_document_types: ['application/pdf'],
  file_transfer_timeout: 300000,
};

// Helper to create mock File
const createMockFile = (name: string, size: number, type: string): File => {
  const file = new File(['mock file content'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

describe('MediaFileHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset handler state
    (mediaFileHandler as any).config = null;
    (mediaFileHandler as any).listeners = {};
    (mediaFileHandler as any).activeTransfers.clear();
    (mediaFileHandler as any).chunkCache.clear();
    (mediaFileHandler as any).isInitialized = false;

    // Setup default mocks
    mockRtcConfigManager.getConfig.mockReturnValue(mockConfig);
    mockRtcConfigManager.isInitialized.mockReturnValue(true);
    mockCreateObjectURL.mockReturnValue('blob:mock-url');
    mockCrypto.subtle.digest.mockResolvedValue(new ArrayBuffer(32));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('validateFile', () => {
    it('should validate supported file types', () => {
      // Arrange
      const imageFile = createMockFile('test.jpg', 1024 * 1024, 'image/jpeg');
      const videoFile = createMockFile('test.mp4', 50 * 1024 * 1024, 'video/mp4');
      const audioFile = createMockFile('test.mp3', 10 * 1024 * 1024, 'audio/mp3');
      const pdfFile = createMockFile('test.pdf', 5 * 1024 * 1024, 'application/pdf');

      // Act & Assert
      expect(mediaFileHandler.validateFile(imageFile)).toBe(true);
      expect(mediaFileHandler.validateFile(videoFile)).toBe(true);
      expect(mediaFileHandler.validateFile(audioFile)).toBe(true);
      expect(mediaFileHandler.validateFile(pdfFile)).toBe(true);
    });

    it('should reject unsupported file types', () => {
      // Arrange
      const unsupportedFile = createMockFile('test.exe', 1024, 'application/octet-stream');

      // Act & Assert
      expect(mediaFileHandler.validateFile(unsupportedFile)).toBe(false);
    });

    it('should reject files exceeding size limit', () => {
      // Arrange
      const largeFile = createMockFile('large.jpg', 200 * 1024 * 1024, 'image/jpeg');

      // Act & Assert
      expect(mediaFileHandler.validateFile(largeFile)).toBe(false);
    });

    it('should reject empty files', () => {
      // Arrange
      const emptyFile = createMockFile('empty.jpg', 0, 'image/jpeg');

      // Act & Assert
      expect(mediaFileHandler.validateFile(emptyFile)).toBe(false);
    });
  });

  describe('compressImage', () => {
    beforeEach(() => {
      // Setup Image mock
      mockImage.addEventListener.mockImplementation((event, callback) => {
        if (event === 'load') {
          mockImage.onload = callback;
        }
      });

      // Setup Canvas mock
      mockCanvas.toBlob.mockImplementation((callback, type, quality) => {
        const mockBlob = new Blob(['compressed image'], { type });
        callback(mockBlob);
      });
    });

    it('should compress image with specified options', async () => {
      // Arrange
      const imageFile = createMockFile('test.jpg', 2 * 1024 * 1024, 'image/jpeg');
      const options: CompressionOptions = {
        quality: 0.8,
        maxWidth: 1024,
        maxHeight: 768,
        format: 'jpeg',
      };

      mockCreateObjectURL.mockReturnValue('blob:test-url');

      // Act
      const promise = mediaFileHandler.compressImage(imageFile, options);
      
      // Simulate image load
      if (mockImage.onload) {
        mockImage.onload(new Event('load'));
      }
      
      const result = await promise;

      // Assert
      expect(mockCreateObjectURL).toHaveBeenCalledWith(imageFile);
      expect(mockCanvas.width).toBe(1024);
      expect(mockCanvas.height).toBe(768);
      expect(mockCanvasContext.drawImage).toHaveBeenCalledWith(
        mockImage, 0, 0, 1024, 768
      );
      expect(mockCanvas.toBlob).toHaveBeenCalledWith(
        expect.any(Function),
        'image/jpeg',
        0.8
      );
      expect(result).toBeInstanceOf(Blob);
    });

    it('should handle image load errors', async () => {
      // Arrange
      const imageFile = createMockFile('test.jpg', 1024 * 1024, 'image/jpeg');
      
      mockImage.addEventListener.mockImplementation((event, callback) => {
        if (event === 'error') {
          mockImage.onerror = callback;
        }
      });

      // Act
      const promise = mediaFileHandler.compressImage(imageFile, { quality: 0.8 });
      
      // Simulate image error
      if (mockImage.onerror) {
        mockImage.onerror(new Event('error'));
      }

      // Assert
      await expect(promise).rejects.toThrow('图片加载失败');
    });

    it('should maintain aspect ratio when resizing', async () => {
      // Arrange
      mockImage.width = 1600;
      mockImage.height = 900;
      
      const imageFile = createMockFile('test.jpg', 2 * 1024 * 1024, 'image/jpeg');
      const options: CompressionOptions = {
        quality: 0.8,
        maxWidth: 800,
        maxHeight: 600,
      };

      // Act
      const promise = mediaFileHandler.compressImage(imageFile, options);
      
      if (mockImage.onload) {
        mockImage.onload(new Event('load'));
      }
      
      await promise;

      // Assert - Should scale to 800x450 to maintain 16:9 aspect ratio
      expect(mockCanvas.width).toBe(800);
      expect(mockCanvas.height).toBe(450);
    });
  });

  describe('generateThumbnail', () => {
    beforeEach(() => {
      mockImage.addEventListener.mockImplementation((event, callback) => {
        if (event === 'load') {
          mockImage.onload = callback;
        }
      });

      mockCanvas.toDataURL.mockReturnValue('data:image/jpeg;base64,thumbnail-data');
    });

    it('should generate thumbnail for image file', async () => {
      // Arrange
      const imageFile = createMockFile('test.jpg', 1024 * 1024, 'image/jpeg');

      // Act
      const promise = mediaFileHandler.generateThumbnail(imageFile);
      
      if (mockImage.onload) {
        mockImage.onload(new Event('load'));
      }
      
      const thumbnail = await promise;

      // Assert
      expect(thumbnail).toBe('data:image/jpeg;base64,thumbnail-data');
      expect(mockCanvas.width).toBe(200); // Default thumbnail size
      expect(mockCanvas.height).toBe(150);
    });

    it('should handle non-image files gracefully', async () => {
      // Arrange
      const pdfFile = createMockFile('test.pdf', 1024 * 1024, 'application/pdf');

      // Act
      const thumbnail = await mediaFileHandler.generateThumbnail(pdfFile);

      // Assert
      expect(thumbnail).toBeUndefined();
    });
  });

  describe('splitFileIntoChunks', () => {
    beforeEach(() => {
      // Mock FileReader for chunk processing
      mockFileReader.readAsArrayBuffer.mockImplementation(function() {
        // Simulate successful read
        this.result = new ArrayBuffer(16384);
        if (this.onload) {
          this.onload({ target: this });
        }
      });
    });

    it('should split file into chunks correctly', async () => {
      // Arrange
      const file = createMockFile('test.mp4', 100 * 1024, 'video/mp4'); // 100KB file
      const chunkSize = 16384; // 16KB chunks

      // Act
      const chunks = await mediaFileHandler.splitFileIntoChunks(file, chunkSize);

      // Assert
      expect(chunks.length).toBe(Math.ceil(file.size / chunkSize));
      expect(chunks[0].chunkIndex).toBe(0);
      expect(chunks[0].chunkSize).toBe(chunkSize);
      expect(chunks[0].data).toBeInstanceOf(ArrayBuffer);
    });

    it('should handle the last chunk correctly', async () => {
      // Arrange
      const file = createMockFile('test.mp3', 50000, 'audio/mp3'); // 50KB file
      const chunkSize = 16384; // 16KB chunks

      // Mock different sizes for different chunks
      let readCount = 0;
      mockFileReader.readAsArrayBuffer.mockImplementation(function() {
        readCount++;
        if (readCount === 4) {
          // Last chunk is smaller
          this.result = new ArrayBuffer(1424); // 50000 - 3*16384 = 1424
        } else {
          this.result = new ArrayBuffer(16384);
        }
        if (this.onload) {
          this.onload({ target: this });
        }
      });

      // Act
      const chunks = await mediaFileHandler.splitFileIntoChunks(file, chunkSize);

      // Assert
      expect(chunks.length).toBe(4);
      expect(chunks[3].chunkSize).toBe(1424);
    });

    it('should handle file read errors', async () => {
      // Arrange
      const file = createMockFile('test.jpg', 32768, 'image/jpeg');
      
      mockFileReader.readAsArrayBuffer.mockImplementation(function() {
        if (this.onerror) {
          this.onerror(new Event('error'));
        }
      });

      // Act & Assert
      await expect(mediaFileHandler.splitFileIntoChunks(file, 16384))
        .rejects.toThrow('文件分片失败');
    });
  });

  describe('reassembleChunks', () => {
    it('should reassemble chunks into complete file', async () => {
      // Arrange
      const chunks: FileChunk[] = [
        {
          chunkIndex: 0,
          chunkSize: 16384,
          data: new ArrayBuffer(16384),
          hash: 'hash1',
        },
        {
          chunkIndex: 1,
          chunkSize: 16384,
          data: new ArrayBuffer(16384),
          hash: 'hash2',
        },
        {
          chunkIndex: 2,
          chunkSize: 1000,
          data: new ArrayBuffer(1000),
          hash: 'hash3',
        },
      ];

      const metadata: FileMetadata = {
        fileName: 'test.mp4',
        fileSize: 33768,
        fileType: 'video/mp4',
        mimeType: 'video/mp4',
        fileHash: 'expected-hash',
        chunkSize: 16384,
        totalChunks: 3,
        transferStatus: 'completed',
        transferId: 'transfer_123',
        createdAt: Date.now(),
      };

      // Act
      const reassembledFile = await mediaFileHandler.reassembleChunks(chunks, metadata);

      // Assert
      expect(reassembledFile).toBeInstanceOf(File);
      expect(reassembledFile.name).toBe(metadata.fileName);
      expect(reassembledFile.type).toBe(metadata.mimeType);
      expect(reassembledFile.size).toBe(metadata.fileSize);
    });

    it('should throw error when chunks are missing', async () => {
      // Arrange
      const incompleteChunks: FileChunk[] = [
        {
          chunkIndex: 0,
          chunkSize: 16384,
          data: new ArrayBuffer(16384),
          hash: 'hash1',
        },
        // Missing chunk 1
        {
          chunkIndex: 2,
          chunkSize: 1000,
          data: new ArrayBuffer(1000),
          hash: 'hash3',
        },
      ];

      const metadata: FileMetadata = {
        fileName: 'test.mp4',
        fileSize: 33768,
        fileType: 'video/mp4',
        mimeType: 'video/mp4',
        fileHash: 'expected-hash',
        chunkSize: 16384,
        totalChunks: 3,
        transferStatus: 'completed',
        transferId: 'transfer_123',
        createdAt: Date.now(),
      };

      // Act & Assert
      await expect(mediaFileHandler.reassembleChunks(incompleteChunks, metadata))
        .rejects.toThrow('文件分片不完整');
    });

    it('should validate file hash after reassembly', async () => {
      // Arrange
      const chunks: FileChunk[] = [
        {
          chunkIndex: 0,
          chunkSize: 1000,
          data: new ArrayBuffer(1000),
          hash: 'hash1',
        },
      ];

      const metadata: FileMetadata = {
        fileName: 'test.txt',
        fileSize: 1000,
        fileType: 'text/plain',
        mimeType: 'text/plain',
        fileHash: 'expected-hash',
        chunkSize: 1000,
        totalChunks: 1,
        transferStatus: 'completed',
        transferId: 'transfer_123',
        createdAt: Date.now(),
      };

      // Mock hash verification to return different hash
      const mockArrayBuffer = new ArrayBuffer(32);
      const mockUint8Array = new Uint8Array(mockArrayBuffer);
      mockUint8Array.set([1, 2, 3, 4]); // Different from expected
      mockCrypto.subtle.digest.mockResolvedValue(mockArrayBuffer);

      // Act & Assert
      await expect(mediaFileHandler.reassembleChunks(chunks, metadata))
        .rejects.toThrow('文件完整性验证失败');
    });
  });

  describe('startTransfer', () => {
    it('should initiate file transfer successfully', async () => {
      // Arrange
      const file = createMockFile('test.jpg', 32768, 'image/jpeg');
      const onProgress = vi.fn();
      
      mediaFileHandler.addEventListener({ onTransferProgress: onProgress });

      // Mock file processing
      mockFileReader.readAsArrayBuffer.mockImplementation(function() {
        this.result = new ArrayBuffer(16384);
        if (this.onload) {
          this.onload({ target: this });
        }
      });

      // Act
      const transferId = await mediaFileHandler.startTransfer(file, 'user456');

      // Assert
      expect(transferId).toBeDefined();
      expect(typeof transferId).toBe('string');
      
      const progress = mediaFileHandler.getTransferProgress(transferId);
      expect(progress).toBeDefined();
      expect(progress!.fileName).toBe(file.name);
      expect(progress!.totalSize).toBe(file.size);
      expect(progress!.status).toBe('preparing');
    });

    it('should reject invalid files', async () => {
      // Arrange
      const invalidFile = createMockFile('test.exe', 1024, 'application/octet-stream');

      // Act & Assert
      await expect(mediaFileHandler.startTransfer(invalidFile, 'user456'))
        .rejects.toThrow('不支持的文件类型');
    });

    it('should reject files exceeding size limit', async () => {
      // Arrange
      const largeFile = createMockFile('huge.mp4', 200 * 1024 * 1024, 'video/mp4');

      // Act & Assert
      await expect(mediaFileHandler.startTransfer(largeFile, 'user456'))
        .rejects.toThrow('文件大小超出限制');
    });
  });

  describe('cancelTransfer', () => {
    it('should cancel active transfer successfully', async () => {
      // Arrange
      const file = createMockFile('test.jpg', 32768, 'image/jpeg');
      
      mockFileReader.readAsArrayBuffer.mockImplementation(function() {
        this.result = new ArrayBuffer(16384);
        if (this.onload) {
          this.onload({ target: this });
        }
      });

      const transferId = await mediaFileHandler.startTransfer(file, 'user456');

      // Act
      await mediaFileHandler.cancelTransfer(transferId);

      // Assert
      const progress = mediaFileHandler.getTransferProgress(transferId);
      expect(progress!.status).toBe('cancelled');
    });

    it('should throw error for non-existent transfer', async () => {
      // Act & Assert
      await expect(mediaFileHandler.cancelTransfer('nonexistent'))
        .rejects.toThrow('传输不存在');
    });
  });

  describe('addEventListener', () => {
    it('should register event listeners correctly', () => {
      // Arrange
      const listeners = {
        onTransferProgress: vi.fn(),
        onTransferComplete: vi.fn(),
        onTransferError: vi.fn(),
        onChunkProcessed: vi.fn(),
      };

      // Act
      mediaFileHandler.addEventListener(listeners);

      // Assert
      expect((mediaFileHandler as any).listeners.onTransferProgress).toBe(listeners.onTransferProgress);
      expect((mediaFileHandler as any).listeners.onTransferComplete).toBe(listeners.onTransferComplete);
      expect((mediaFileHandler as any).listeners.onTransferError).toBe(listeners.onTransferError);
      expect((mediaFileHandler as any).listeners.onChunkProcessed).toBe(listeners.onChunkProcessed);
    });
  });

  describe('getTransferProgress', () => {
    it('should return transfer progress for existing transfer', async () => {
      // Arrange
      const file = createMockFile('test.mp3', 16384, 'audio/mp3');
      
      mockFileReader.readAsArrayBuffer.mockImplementation(function() {
        this.result = new ArrayBuffer(16384);
        if (this.onload) {
          this.onload({ target: this });
        }
      });

      const transferId = await mediaFileHandler.startTransfer(file, 'user456');

      // Act
      const progress = mediaFileHandler.getTransferProgress(transferId);

      // Assert
      expect(progress).toBeDefined();
      expect(progress!.transferId).toBe(transferId);
      expect(progress!.fileName).toBe(file.name);
      expect(progress!.totalSize).toBe(file.size);
    });

    it('should return null for non-existent transfer', () => {
      // Act
      const progress = mediaFileHandler.getTransferProgress('nonexistent');

      // Assert
      expect(progress).toBeNull();
    });
  });

  describe('getAllActiveTransfers', () => {
    it('should return all active transfers', async () => {
      // Arrange
      const file1 = createMockFile('test1.jpg', 16384, 'image/jpeg');
      const file2 = createMockFile('test2.mp3', 32768, 'audio/mp3');
      
      mockFileReader.readAsArrayBuffer.mockImplementation(function() {
        this.result = new ArrayBuffer(16384);
        if (this.onload) {
          this.onload({ target: this });
        }
      });

      const transferId1 = await mediaFileHandler.startTransfer(file1, 'user456');
      const transferId2 = await mediaFileHandler.startTransfer(file2, 'user789');

      // Act
      const activeTransfers = mediaFileHandler.getAllActiveTransfers();

      // Assert
      expect(activeTransfers).toHaveLength(2);
      expect(activeTransfers.map(t => t.transferId)).toContain(transferId1);
      expect(activeTransfers.map(t => t.transferId)).toContain(transferId2);
    });

    it('should return empty array when no active transfers', () => {
      // Act
      const activeTransfers = mediaFileHandler.getAllActiveTransfers();

      // Assert
      expect(activeTransfers).toEqual([]);
    });
  });
});
