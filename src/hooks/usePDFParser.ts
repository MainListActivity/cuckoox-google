// PDF解析器相关的React Query hooks
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback } from 'react';
import { pdfParseService } from '@/src/services/pdfParseService';
import {
  ParseResult,
  FieldEditForm,
  InterestCalculationParams,
  InterestCalculationResult,
  DocumentTemplate,
  GeneratedDocument,
  BatchProcessSummary,
  UploadedFile
} from '@/src/types/pdfParser';

// 查询键常量
export const PDF_PARSER_QUERY_KEYS = {
  parseResult: (parseId: string) => ['pdfParseResult', parseId],
  batchStatus: (batchId: string) => ['batchProcessStatus', batchId],
  documentTemplates: () => ['documentTemplates'],
} as const;

/**
 * 获取解析结果
 */
export const usePDFParseResult = (parseId: string | null) => {
  return useQuery({
    queryKey: PDF_PARSER_QUERY_KEYS.parseResult(parseId || ''),
    queryFn: () => pdfParseService.getParseResult(parseId!),
    enabled: !!parseId,
    refetchInterval: (data) => {
      // 如果状态是处理中，每2秒轮询一次
      return data?.status === 'processing' ? 2000 : false;
    },
    staleTime: 5 * 60 * 1000, // 5分钟
  });
};

/**
 * 批量处理状态查询
 */
export const useBatchProcessStatus = (batchId: string | null) => {
  return useQuery({
    queryKey: PDF_PARSER_QUERY_KEYS.batchStatus(batchId || ''),
    queryFn: () => pdfParseService.getBatchStatus(batchId!),
    enabled: !!batchId,
    refetchInterval: 2000, // 每2秒轮询
    staleTime: 1000, // 1秒内不重新获取
  });
};

/**
 * 获取文档模板列表
 */
export const useDocumentTemplates = () => {
  return useQuery({
    queryKey: PDF_PARSER_QUERY_KEYS.documentTemplates(),
    queryFn: pdfParseService.getDocumentTemplates,
    staleTime: 10 * 60 * 1000, // 10分钟
  });
};

/**
 * 文件上传hook
 */
export const useFileUpload = () => {
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: async ({ 
      file, 
      caseId, 
      fileId 
    }: { 
      file: File; 
      caseId?: string; 
      fileId: string;
    }) => {
      return pdfParseService.uploadFile(file, caseId, (progress) => {
        setUploadProgress(prev => ({ ...prev, [fileId]: progress }));
      });
    },
    onSuccess: (data) => {
      // 上传成功后开始轮询解析状态
      queryClient.invalidateQueries({
        queryKey: PDF_PARSER_QUERY_KEYS.parseResult(data.parseId)
      });
    },
    onError: (error, variables) => {
      console.error('上传失败:', error);
      setUploadProgress(prev => {
        const newProgress = { ...prev };
        delete newProgress[variables.fileId];
        return newProgress;
      });
    },
  });

  const getProgress = useCallback((fileId: string) => {
    return uploadProgress[fileId] || 0;
  }, [uploadProgress]);

  const clearProgress = useCallback((fileId: string) => {
    setUploadProgress(prev => {
      const newProgress = { ...prev };
      delete newProgress[fileId];
      return newProgress;
    });
  }, []);

  return {
    upload: uploadMutation.mutate,
    isUploading: uploadMutation.isPending,
    error: uploadMutation.error,
    getProgress,
    clearProgress,
    reset: uploadMutation.reset,
  };
};

/**
 * 字段更新hook
 */
export const useFieldUpdate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      parseId, 
      fieldName, 
      fieldData 
    }: { 
      parseId: string; 
      fieldName: string; 
      fieldData: FieldEditForm;
    }) => {
      return pdfParseService.updateField(parseId, fieldName, fieldData);
    },
    onSuccess: (_, variables) => {
      // 更新成功后刷新解析结果
      queryClient.invalidateQueries({
        queryKey: PDF_PARSER_QUERY_KEYS.parseResult(variables.parseId)
      });
    },
  });
};

/**
 * 利息计算hook
 */
export const useInterestCalculation = () => {
  return useMutation({
    mutationFn: (params: InterestCalculationParams) => {
      return pdfParseService.calculateInterest(params);
    },
  });
};

/**
 * 文档生成hook
 */
export const useDocumentGeneration = () => {
  return useMutation({
    mutationFn: async ({ 
      parseId, 
      templateId 
    }: { 
      parseId: string; 
      templateId: string;
    }) => {
      return pdfParseService.generateDocument(parseId, templateId);
    },
  });
};

/**
 * 文档保存hook
 */
export const useDocumentSave = () => {
  return useMutation({
    mutationFn: (document: GeneratedDocument) => {
      return pdfParseService.saveDocument(document);
    },
  });
};

/**
 * 批量上传hook
 */
export const useBatchUpload = () => {
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: async ({ 
      files, 
      caseId 
    }: { 
      files: File[]; 
      caseId?: string;
    }) => {
      return pdfParseService.uploadBatch(files, caseId, (fileIndex, progress) => {
        if (fileIndex === -1) {
          setUploadProgress(progress);
        }
      });
    },
    onSuccess: (batchId) => {
      setUploadProgress(0);
      // 开始轮询批量状态
      queryClient.invalidateQueries({
        queryKey: PDF_PARSER_QUERY_KEYS.batchStatus(batchId)
      });
    },
    onError: () => {
      setUploadProgress(0);
    },
  });

  return {
    uploadBatch: uploadMutation.mutate,
    isUploading: uploadMutation.isPending,
    progress: uploadProgress,
    error: uploadMutation.error,
    reset: uploadMutation.reset,
  };
};

/**
 * 批量操作hooks
 */
export const useBatchOperations = () => {
  const queryClient = useQueryClient();

  const cancelMutation = useMutation({
    mutationFn: (batchId: string) => pdfParseService.cancelBatch(batchId),
    onSuccess: (_, batchId) => {
      queryClient.invalidateQueries({
        queryKey: PDF_PARSER_QUERY_KEYS.batchStatus(batchId)
      });
    },
  });

  const retryMutation = useMutation({
    mutationFn: ({ 
      batchId, 
      fileId 
    }: { 
      batchId: string; 
      fileId: string;
    }) => {
      return pdfParseService.retryBatchItem(batchId, fileId);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: PDF_PARSER_QUERY_KEYS.batchStatus(variables.batchId)
      });
    },
  });

  return {
    cancelBatch: cancelMutation.mutate,
    retryItem: retryMutation.mutate,
    isCanceling: cancelMutation.isPending,
    isRetrying: retryMutation.isPending,
  };
};

/**
 * 解析结果删除hook
 */
export const useDeleteParseResult = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (parseId: string) => pdfParseService.deleteParseResult(parseId),
    onSuccess: (_, parseId) => {
      queryClient.removeQueries({
        queryKey: PDF_PARSER_QUERY_KEYS.parseResult(parseId)
      });
    },
  });
};

/**
 * 导出hook
 */
export const useExportParseResult = () => {
  return useMutation({
    mutationFn: async ({ 
      parseId, 
      format 
    }: { 
      parseId: string; 
      format: 'json' | 'excel' | 'pdf';
    }) => {
      const blob = await pdfParseService.exportParseResult(parseId, format);
      
      // 创建下载链接
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `parse-result-${parseId}.${format}`;
      link.click();
      window.URL.revokeObjectURL(url);
      
      return blob;
    },
  });
};

/**
 * 综合PDF解析器状态hook
 */
export const usePDFParserState = () => {
  const [currentParseId, setCurrentParseId] = useState<string | null>(null);
  const [currentBatchId, setCurrentBatchId] = useState<string | null>(null);

  const parseResult = usePDFParseResult(currentParseId);
  const batchStatus = useBatchProcessStatus(currentBatchId);
  const templates = useDocumentTemplates();

  return {
    // 当前状态
    currentParseId,
    currentBatchId,
    parseResult: parseResult.data,
    batchStatus: batchStatus.data,
    templates: templates.data || [],
    
    // 加载状态
    isLoadingParse: parseResult.isLoading,
    isLoadingBatch: batchStatus.isLoading,
    isLoadingTemplates: templates.isLoading,
    
    // 错误状态
    parseError: parseResult.error,
    batchError: batchStatus.error,
    templatesError: templates.error,
    
    // 操作方法
    setCurrentParseId,
    setCurrentBatchId,
    
    // 刷新方法
    refetchParseResult: parseResult.refetch,
    refetchBatchStatus: batchStatus.refetch,
    refetchTemplates: templates.refetch,
  };
};