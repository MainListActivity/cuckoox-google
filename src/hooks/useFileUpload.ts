import { useState, useCallback } from 'react';
import { useAuth } from '@/src/contexts/AuthContext';

interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

interface UploadedFile {
  file_name: string;
  file_type: string;
  file_size: number;
  mime_type: string;
  s3_object_key: string;
  thumbnail_url?: string;
}

interface UseFileUploadOptions {
  maxFileSize?: number; // in bytes
  allowedMimeTypes?: string[];
  generateThumbnail?: boolean;
}

const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const DEFAULT_ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'application/zip',
  'application/x-rar-compressed'
];

export function useFileUpload(options: UseFileUploadOptions = {}) {
  const { user } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
    loaded: 0,
    total: 0,
    percentage: 0
  });
  const [error, setError] = useState<string | null>(null);
  
  const maxFileSize = options.maxFileSize || DEFAULT_MAX_FILE_SIZE;
  const allowedMimeTypes = options.allowedMimeTypes || DEFAULT_ALLOWED_MIME_TYPES;
  
  const validateFile = useCallback((file: File): string | null => {
    if (file.size > maxFileSize) {
      return `文件大小超过限制（最大 ${Math.round(maxFileSize / 1024 / 1024)}MB）`;
    }
    
    if (!allowedMimeTypes.includes(file.type)) {
      return '不支持的文件类型';
    }
    
    return null;
  }, [maxFileSize, allowedMimeTypes]);
  
  const generateObjectKey = useCallback((file: File): string => {
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const fileExtension = file.name.split('.').pop() || 'bin';
    const userId = user?.id ? String(user.id).replace(':', '_') : 'anonymous';
    
    return `messages/${userId}/${timestamp}_${randomString}.${fileExtension}`;
  }, [user]);
  
  const uploadFile = useCallback(async (file: File): Promise<UploadedFile | null> => {
    // Validate file
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return null;
    }
    
    setIsUploading(true);
    setError(null);
    setUploadProgress({ loaded: 0, total: file.size, percentage: 0 });
    
    try {
      const objectKey = generateObjectKey(file);
      
      // Create FormData
      const formData = new FormData();
      formData.append('file', file);
      formData.append('key', objectKey);
      
      // TODO: Replace with actual MinIO upload endpoint
      const uploadUrl = '/api/upload'; // This should be your actual upload endpoint
      
      const xhr = new XMLHttpRequest();
      
      // Track upload progress
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const percentage = Math.round((event.loaded / event.total) * 100);
          setUploadProgress({
            loaded: event.loaded,
            total: event.total,
            percentage
          });
        }
      });
      
      // Create a promise for the upload
      const uploadPromise = new Promise<UploadedFile>((resolve, reject) => {
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const response = JSON.parse(xhr.responseText);
              const uploadedFile: UploadedFile = {
                file_name: file.name,
                file_type: file.type.split('/')[0], // 'image', 'application', etc.
                file_size: file.size,
                mime_type: file.type,
                s3_object_key: objectKey,
                thumbnail_url: response.thumbnail_url
              };
              resolve(uploadedFile);
            } catch (error) {
              reject(new Error('Failed to parse upload response'));
            }
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        });
        
        xhr.addEventListener('error', () => {
          reject(new Error('Network error during upload'));
        });
        
        xhr.addEventListener('abort', () => {
          reject(new Error('Upload aborted'));
        });
      });
      
      // Start upload
      xhr.open('POST', uploadUrl);
      xhr.send(formData);
      
      const result = await uploadPromise;
      
      // Generate thumbnail for images on client side if needed
      if (options.generateThumbnail && file.type.startsWith('image/')) {
        result.thumbnail_url = await generateThumbnail(file);
      }
      
      return result;
    } catch (error) {
      console.error('Upload error:', error);
      setError(error instanceof Error ? error.message : '上传失败');
      return null;
    } finally {
      setIsUploading(false);
    }
  }, [validateFile, generateObjectKey, options.generateThumbnail]);
  
  const uploadMultipleFiles = useCallback(async (files: File[]): Promise<UploadedFile[]> => {
    const results: UploadedFile[] = [];
    
    for (const file of files) {
      const result = await uploadFile(file);
      if (result) {
        results.push(result);
      }
    }
    
    return results;
  }, [uploadFile]);
  
  const generateThumbnail = async (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        const img = new Image();
        
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            resolve('');
            return;
          }
          
          // Calculate thumbnail dimensions (max 200x200)
          const maxSize = 200;
          let width = img.width;
          let height = img.height;
          
          if (width > height) {
            if (width > maxSize) {
              height = (height * maxSize) / width;
              width = maxSize;
            }
          } else {
            if (height > maxSize) {
              width = (width * maxSize) / height;
              height = maxSize;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          
          ctx.drawImage(img, 0, 0, width, height);
          
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        
        img.src = e.target?.result as string;
      };
      
      reader.readAsDataURL(file);
    });
  };
  
  return {
    uploadFile,
    uploadMultipleFiles,
    isUploading,
    uploadProgress,
    error,
    validateFile
  };
}