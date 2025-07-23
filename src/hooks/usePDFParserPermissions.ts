import { useMemo, useCallback } from 'react';
import { useAuth } from '@/src/contexts/AuthContext';
import { useDataPermission, useOperationPermission } from '@/src/hooks/usePermission';

// PDF解析器功能权限定义
export interface PDFParserPermissions {
  // 文件操作权限
  canUploadFile: boolean;
  canDeleteFile: boolean;
  canDownloadFile: boolean;
  
  // PDF解析权限
  canParsePDF: boolean;
  canViewParseResult: boolean;
  canEditParseResult: boolean;
  canExportParseResult: boolean;
  
  // 批量处理权限
  canBatchProcess: boolean;
  canManageBatchTasks: boolean;
  canViewBatchStatistics: boolean;
  
  // 利息计算权限
  canCalculateInterest: boolean;
  canSaveInterestCalculation: boolean;
  canViewInterestHistory: boolean;
  
  // 文档生成权限
  canGenerateDocument: boolean;
  canEditGeneratedDocument: boolean;
  canSaveDocument: boolean;
  canExportDocument: boolean;
  
  // 高级功能权限
  canCreateTemplate: boolean;
  canManageTemplates: boolean;
  canAccessStatistics: boolean;
  canManageSettings: boolean;
  
  // 管理员权限
  canViewAllUserData: boolean;
  canManageUserPermissions: boolean;
  canAccessSystemLogs: boolean;
}

// 权限检查结果
interface PermissionCheckResult {
  hasPermission: boolean;
  reason?: string;
  suggestions?: string[];
}

// 操作权限映射
const OPERATION_PERMISSIONS = {
  // 文件操作
  'pdf-parser.file.upload': 'canUploadFile',
  'pdf-parser.file.delete': 'canDeleteFile',
  'pdf-parser.file.download': 'canDownloadFile',
  
  // PDF解析
  'pdf-parser.parse.execute': 'canParsePDF',
  'pdf-parser.parse.view': 'canViewParseResult',
  'pdf-parser.parse.edit': 'canEditParseResult',
  'pdf-parser.parse.export': 'canExportParseResult',
  
  // 批量处理
  'pdf-parser.batch.process': 'canBatchProcess',
  'pdf-parser.batch.manage': 'canManageBatchTasks',
  'pdf-parser.batch.statistics': 'canViewBatchStatistics',
  
  // 利息计算
  'pdf-parser.interest.calculate': 'canCalculateInterest',
  'pdf-parser.interest.save': 'canSaveInterestCalculation',
  'pdf-parser.interest.history': 'canViewInterestHistory',
  
  // 文档生成
  'pdf-parser.document.generate': 'canGenerateDocument',
  'pdf-parser.document.edit': 'canEditGeneratedDocument',
  'pdf-parser.document.save': 'canSaveDocument',
  'pdf-parser.document.export': 'canExportDocument',
  
  // 高级功能
  'pdf-parser.template.create': 'canCreateTemplate',
  'pdf-parser.template.manage': 'canManageTemplates',
  'pdf-parser.statistics.access': 'canAccessStatistics',
  'pdf-parser.settings.manage': 'canManageSettings',
  
  // 管理员功能
  'pdf-parser.admin.view-all-data': 'canViewAllUserData',
  'pdf-parser.admin.manage-permissions': 'canManageUserPermissions',
  'pdf-parser.admin.access-logs': 'canAccessSystemLogs',
} as const;

// 数据权限映射
const DATA_PERMISSIONS = {
  'pdf_files': ['canUploadFile', 'canDeleteFile', 'canDownloadFile'],
  'parse_results': ['canViewParseResult', 'canEditParseResult', 'canExportParseResult'],
  'batch_tasks': ['canBatchProcess', 'canManageBatchTasks'],
  'interest_calculations': ['canCalculateInterest', 'canSaveInterestCalculation'],
  'generated_documents': ['canGenerateDocument', 'canEditGeneratedDocument', 'canSaveDocument'],
  'document_templates': ['canCreateTemplate', 'canManageTemplates'],
} as const;

export const usePDFParserPermissions = (): {
  permissions: PDFParserPermissions;
  checkPermission: (action: keyof PDFParserPermissions) => PermissionCheckResult;
  checkDataPermission: (table: keyof typeof DATA_PERMISSIONS, operation: 'create' | 'read' | 'update' | 'delete') => PermissionCheckResult;
  hasAnyPermission: (actions: Array<keyof PDFParserPermissions>) => boolean;
  hasAllPermissions: (actions: Array<keyof PDFParserPermissions>) => boolean;
  getPermissionSummary: () => {
    total: number;
    granted: number;
    denied: number;
    percentage: number;
  };
} => {
  const { user, isLoggedIn:isAuthenticated } = useAuth();

  // 检查操作权限 - 使用单独的hooks调用
  const uploadFilePermission = useOperationPermission('pdf-parser.file.upload');
  const deleteFilePermission = useOperationPermission('pdf-parser.file.delete');
  const downloadFilePermission = useOperationPermission('pdf-parser.file.download');
  const parseExecutePermission = useOperationPermission('pdf-parser.parse.execute');
  const parseViewPermission = useOperationPermission('pdf-parser.parse.view');
  const parseEditPermission = useOperationPermission('pdf-parser.parse.edit');
  const parseExportPermission = useOperationPermission('pdf-parser.parse.export');
  const batchProcessPermission = useOperationPermission('pdf-parser.batch.process');
  const batchManagePermission = useOperationPermission('pdf-parser.batch.manage');
  const batchStatsPermission = useOperationPermission('pdf-parser.batch.statistics');
  const interestCalcPermission = useOperationPermission('pdf-parser.interest.calculate');
  const interestSavePermission = useOperationPermission('pdf-parser.interest.save');
  const interestHistoryPermission = useOperationPermission('pdf-parser.interest.history');
  const docGeneratePermission = useOperationPermission('pdf-parser.document.generate');
  const docEditPermission = useOperationPermission('pdf-parser.document.edit');
  const docSavePermission = useOperationPermission('pdf-parser.document.save');
  const docExportPermission = useOperationPermission('pdf-parser.document.export');
  const templateCreatePermission = useOperationPermission('pdf-parser.template.create');
  const templateManagePermission = useOperationPermission('pdf-parser.template.manage');
  const statsAccessPermission = useOperationPermission('pdf-parser.statistics.access');
  const settingsManagePermission = useOperationPermission('pdf-parser.settings.manage');
  const adminViewAllPermission = useOperationPermission('pdf-parser.admin.view-all-data');
  const adminManagePermissionsPerm = useOperationPermission('pdf-parser.admin.manage-permissions');
  const adminAccessLogsPermission = useOperationPermission('pdf-parser.admin.access-logs');

  // 检查数据权限
  const fileReadPermission = useDataPermission('pdf_files', 'read');
  const fileWritePermission = useDataPermission('pdf_files', 'create');
  const fileDeleteDataPermission = useDataPermission('pdf_files', 'delete');
  
  const parseResultReadPermission = useDataPermission('parse_results', 'read');
  const parseResultWritePermission = useDataPermission('parse_results', 'update');
  
  const batchTaskDataPermission = useDataPermission('batch_tasks', 'create');
  
  const interestCalcDataPermission = useDataPermission('interest_calculations', 'create');
  
  const documentDataPermission = useDataPermission('generated_documents', 'create');
  
  const templateDataPermission = useDataPermission('document_templates', 'create');

  // 合并所有权限
  const permissions: PDFParserPermissions = useMemo(() => {
    if (!isAuthenticated) {
      // 未认证用户没有任何权限
      return {
        canUploadFile: false,
        canDeleteFile: false,
        canDownloadFile: false,
        canParsePDF: false,
        canViewParseResult: false,
        canEditParseResult: false,
        canExportParseResult: false,
        canBatchProcess: false,
        canManageBatchTasks: false,
        canViewBatchStatistics: false,
        canCalculateInterest: false,
        canSaveInterestCalculation: false,
        canViewInterestHistory: false,
        canGenerateDocument: false,
        canEditGeneratedDocument: false,
        canSaveDocument: false,
        canExportDocument: false,
        canCreateTemplate: false,
        canManageTemplates: false,
        canAccessStatistics: false,
        canManageSettings: false,
        canViewAllUserData: false,
        canManageUserPermissions: false,
        canAccessSystemLogs: false,
      };
    }

    return {
      // 文件操作权限
      canUploadFile: fileWritePermission && uploadFilePermission,
      canDeleteFile: fileDeleteDataPermission && deleteFilePermission,
      canDownloadFile: fileReadPermission && downloadFilePermission,
      
      // PDF解析权限
      canParsePDF: fileReadPermission && parseExecutePermission,
      canViewParseResult: parseResultReadPermission && parseViewPermission,
      canEditParseResult: parseResultWritePermission && parseEditPermission,
      canExportParseResult: parseResultReadPermission && parseExportPermission,
      
      // 批量处理权限
      canBatchProcess: batchTaskDataPermission && batchProcessPermission,
      canManageBatchTasks: batchTaskDataPermission && batchManagePermission,
      canViewBatchStatistics: batchTaskDataPermission && batchStatsPermission,
      
      // 利息计算权限
      canCalculateInterest: interestCalcDataPermission && interestCalcPermission,
      canSaveInterestCalculation: interestCalcDataPermission && interestSavePermission,
      canViewInterestHistory: interestCalcDataPermission && interestHistoryPermission,
      
      // 文档生成权限
      canGenerateDocument: documentDataPermission && docGeneratePermission,
      canEditGeneratedDocument: documentDataPermission && docEditPermission,
      canSaveDocument: documentDataPermission && docSavePermission,
      canExportDocument: documentDataPermission && docExportPermission,
      
      // 高级功能权限
      canCreateTemplate: templateDataPermission && templateCreatePermission,
      canManageTemplates: templateDataPermission && templateManagePermission,
      canAccessStatistics: statsAccessPermission,
      canManageSettings: settingsManagePermission,
      
      // 管理员权限
      canViewAllUserData: user?.github_id === '--admin--' && adminViewAllPermission,
      canManageUserPermissions: user?.github_id === '--admin--' && adminManagePermissionsPerm,
      canAccessSystemLogs: user?.github_id === '--admin--' && adminAccessLogsPermission,
    };
  }, [
    isAuthenticated,
    user,
    fileReadPermission,
    fileWritePermission,
    fileDeleteDataPermission,
    parseResultReadPermission,
    parseResultWritePermission,
    batchTaskDataPermission,
    interestCalcDataPermission,
    documentDataPermission,
    templateDataPermission,
    uploadFilePermission,
    deleteFilePermission,
    downloadFilePermission,
    parseExecutePermission,
    parseViewPermission,
    parseEditPermission,
    parseExportPermission,
    batchProcessPermission,
    batchManagePermission,
    batchStatsPermission,
    interestCalcPermission,
    interestSavePermission,
    interestHistoryPermission,
    docGeneratePermission,
    docEditPermission,
    docSavePermission,
    docExportPermission,
    templateCreatePermission,
    templateManagePermission,
    statsAccessPermission,
    settingsManagePermission,
    adminViewAllPermission,
    adminManagePermissionsPerm,
    adminAccessLogsPermission,
  ]);

  // 检查单个权限
  const checkPermission = useCallback((action: keyof PDFParserPermissions): PermissionCheckResult => {
    if (!isAuthenticated) {
      return {
        hasPermission: false,
        reason: '您需要登录才能使用此功能',
        suggestions: ['请先登录您的账户'],
      };
    }

    const hasPermission = permissions[action];
    
    if (!hasPermission) {
      const actionMessages = {
        canUploadFile: '您没有上传文件的权限',
        canDeleteFile: '您没有删除文件的权限',
        canDownloadFile: '您没有下载文件的权限',
        canParsePDF: '您没有解析PDF的权限',
        canViewParseResult: '您没有查看解析结果的权限',
        canEditParseResult: '您没有编辑解析结果的权限',
        canExportParseResult: '您没有导出解析结果的权限',
        canBatchProcess: '您没有批量处理的权限',
        canManageBatchTasks: '您没有管理批量任务的权限',
        canViewBatchStatistics: '您没有查看批量统计的权限',
        canCalculateInterest: '您没有计算利息的权限',
        canSaveInterestCalculation: '您没有保存利息计算的权限',
        canViewInterestHistory: '您没有查看利息历史的权限',
        canGenerateDocument: '您没有生成文档的权限',
        canEditGeneratedDocument: '您没有编辑生成文档的权限',
        canSaveDocument: '您没有保存文档的权限',
        canExportDocument: '您没有导出文档的权限',
        canCreateTemplate: '您没有创建模板的权限',
        canManageTemplates: '您没有管理模板的权限',
        canAccessStatistics: '您没有访问统计数据的权限',
        canManageSettings: '您没有管理设置的权限',
        canViewAllUserData: '您没有查看所有用户数据的权限',
        canManageUserPermissions: '您没有管理用户权限的权限',
        canAccessSystemLogs: '您没有访问系统日志的权限',
      };

      return {
        hasPermission: false,
        reason: actionMessages[action] || '您没有执行此操作的权限',
        suggestions: [
          '请联系管理员获取相应权限',
          '检查您的用户角色设置',
          '确认您的账户状态正常',
        ],
      };
    }

    return { hasPermission: true };
  }, [isAuthenticated, permissions]);

  // 检查数据权限
  const checkDataPermission = useCallback((
    table: keyof typeof DATA_PERMISSIONS,
    operation: 'create' | 'read' | 'update' | 'delete'
  ): PermissionCheckResult => {
    // 这里不能调用hooks，所以返回一个基本的检查
    // 实际的权限检查已经在permissions对象中完成
    const hasBasicPermission = isAuthenticated;
    
    if (!hasBasicPermission) {
      return {
        hasPermission: false,
        reason: `您没有对 ${table} 表进行 ${operation} 操作的权限`,
        suggestions: [
          '请联系管理员获取数据访问权限',
          '检查您的数据权限配置',
        ],
      };
    }

    return { hasPermission: true };
  }, [isAuthenticated]);

  // 检查是否拥有任一权限
  const hasAnyPermission = useCallback((actions: Array<keyof PDFParserPermissions>): boolean => {
    return actions.some(action => permissions[action]);
  }, [permissions]);

  // 检查是否拥有所有权限
  const hasAllPermissions = useCallback((actions: Array<keyof PDFParserPermissions>): boolean => {
    return actions.every(action => permissions[action]);
  }, [permissions]);

  // 获取权限摘要
  const getPermissionSummary = useCallback(() => {
    const permissionValues = Object.values(permissions);
    const total = permissionValues.length;
    const granted = permissionValues.filter(Boolean).length;
    const denied = total - granted;
    const percentage = total > 0 ? (granted / total) * 100 : 0;

    return { total, granted, denied, percentage };
  }, [permissions]);

  return {
    permissions,
    checkPermission,
    checkDataPermission,
    hasAnyPermission,
    hasAllPermissions,
    getPermissionSummary,
  };
};