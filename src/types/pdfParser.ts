// PDF解析器相关类型定义

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  file: File;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  progress: number;
  error?: string;
  uploadedAt?: Date;
}

export interface HighlightRegion {
  id: string;
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  fieldName: string;
  confidence: number;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ParsedField {
  name: string;
  displayName: string;
  value: any;
  originalValue?: any;
  confidence: number;
  sourceText: string;
  pageNumber: number;
  position?: BoundingBox;
  isModified: boolean;
  modifiedBy?: string;
  modifiedAt?: Date;
  modificationReason?: string;
  dataType: 'text' | 'number' | 'date' | 'boolean' | 'currency' | 'percentage';
}

export interface ParseResult {
  id: string;
  fileId: string;
  fileName: string;
  status: 'processing' | 'completed' | 'failed';
  fields: ParsedField[];
  confidence: number;
  totalPages: number;
  processingTime?: number;
  highlightRegions: HighlightRegion[];
  createdAt: Date;
  updatedAt: Date;
  error?: string;
}

export interface FieldEditForm {
  value: any;
  reason: string;
}

export interface InterestCalculationParams {
  principal: number;
  interestRate: number;
  rateType: 'annual' | 'monthly' | 'daily';
  startDate: Date;
  endDate: Date;
  compoundFrequency?: 'none' | 'monthly' | 'quarterly' | 'annually';
  dayCountConvention?: '30/360' | 'actual/365' | 'actual/360';
}

export interface InterestBreakdown {
  period: string;
  startDate: Date;
  endDate: Date;
  principal: number;
  interest: number;
  cumulativeInterest: number;
}

export interface InterestCalculationResult {
  principal: number;
  interest: number;
  totalAmount: number;
  calculationDate: Date;
  parameters: InterestCalculationParams;
  breakdown: InterestBreakdown[];
  formula: string;
  days: number;
}

export interface DocumentTemplate {
  id: string;
  name: string;
  description: string;
  content: string; // QuillJS Delta JSON字符串
  fieldMappings: Record<string, string>; // 字段名称映射
  isDefault: boolean;
  createdBy?: string;
  createdAt: Date;
}

export interface DocumentMetadata {
  title: string;
  description?: string;
  createdBy: string;
  createdAt: Date;
  tags?: string[];
  caseId?: string;
}

export interface GeneratedDocument {
  id: string;
  title: string;
  content: any; // QuillJS Delta格式
  template: DocumentTemplate;
  metadata: DocumentMetadata;
  parseResultId: string;
  fieldValues: Record<string, any>;
}

export interface BatchProcessResult {
  fileId: string;
  fileName: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  result?: ParseResult;
  error?: string;
  startTime: Date;
  endTime?: Date;
}

export interface BatchProcessSummary {
  id: string;
  totalFiles: number;
  completedFiles: number;
  failedFiles: number;
  processingFiles: number;
  overallProgress: number;
  startTime: Date;
  endTime?: Date;
  results: BatchProcessResult[];
}

export interface PDFParserConfig {
  maxFileSize: number; // 字节
  maxFiles: number;
  allowedFileTypes: string[];
  enabledFeatures: {
    upload: boolean;
    preview: boolean;
    edit: boolean;
    calculate: boolean;
    generate: boolean;
    batch: boolean;
  };
}

export interface PDFParserPermissions {
  canUpload: boolean;
  canEdit: boolean;
  canCalculate: boolean;
  canGenerate: boolean;
  canBatch: boolean;
  canExport: boolean;
}

// API响应类型
export interface UploadResponse {
  success: boolean;
  fileId: string;
  parseId: string;
  message?: string;
}

export interface APIError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: APIError;
  message?: string;
}

// Context类型
export interface PDFParserContextValue {
  currentFile: UploadedFile | null;
  parseResult: ParseResult | null;
  selectedField: string | null;
  calculationResult: InterestCalculationResult | null;
  batchProcess: BatchProcessSummary | null;
  uiState: {
    isUploading: boolean;
    isParsing: boolean;
    isCalculating: boolean;
    isGenerating: boolean;
    showCalculator: boolean;
    showGenerator: boolean;
    previewScale: number;
    currentPage: number;
    selectedTab: number;
  };
  permissions: PDFParserPermissions;
  config: PDFParserConfig;
  actions: {
    setCurrentFile: (file: UploadedFile | null) => void;
    setSelectedField: (fieldName: string | null) => void;
    updateFieldValue: (fieldName: string, value: any, reason: string) => Promise<void>;
    calculateInterest: (params: InterestCalculationParams) => Promise<void>;
    generateDocument: (templateId: string) => Promise<void>;
    toggleCalculator: () => void;
    toggleGenerator: () => void;
    setPreviewScale: (scale: number) => void;
    setCurrentPage: (page: number) => void;
    setSelectedTab: (tab: number) => void;
  };
}

// 工具函数类型
export type FieldValidator = (value: any) => string | null;
export type FieldFormatter = (value: any) => string;

// 扩展类型（用于与现有系统集成）
export interface ExtendedParseResult extends ParseResult {
  caseId?: string;
  claimId?: string;
  creditorId?: string;
}

export interface ContractInfo {
  contractAmount: number;
  interestRate: number;
  contractDate: Date;
  maturityDate?: Date;
  contractType: string;
  parties: {
    creditor: string;
    debtor: string;
  };
}