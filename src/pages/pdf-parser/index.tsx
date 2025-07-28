import React, { useState, useCallback } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Breadcrumbs,
  Link,
  Tabs,
  Tab,
  Backdrop,
  CircularProgress,
  Snackbar,
  Alert,
  useMediaQuery,
  useTheme,
  Stack,
  Card,
  CardContent,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  PictureAsPdf as PdfIcon,
  Analytics as AnalyticsIcon,
  Calculate as CalculateIcon,
  Settings as SettingsIcon,
  MoreVert as MoreVertIcon,
  Lock as LockIcon,
} from '@mui/icons-material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  PDFUploadComponent,
  PDFPreviewComponent,
  ParseResultComponent,
  FieldEditDialog,
  PDFParserErrorBoundary,
  NetworkStatusMonitor,
} from '@/src/components/pdf-parser';
import { usePDFParserState } from '@/src/hooks/usePDFParser';
import { usePDFParserPermissions } from '@/src/hooks/usePDFParserPermissions';
import { useNetworkStatus } from '@/src/hooks/useNetworkStatus';
import { handleError } from '@/src/utils/errorHandler';
import { UploadedFile, ParsedField } from '@/src/types/pdfParser';
import PageContainer from '@/src/components/PageContainer';

interface PDFParserPageProps {
  caseId?: string;
}

interface TabPanelProps {
  children?: React.ReactNode;
  value: number;
  index: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index, ...other }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`pdf-parser-tabpanel-${index}`}
      aria-labelledby={`pdf-parser-tab-${index}`}
      style={{ height: '100%' }}
      {...other}
    >
      {value === index && children}
    </div>
  );
};

const PDFParserPage: React.FC<PDFParserPageProps> = ({ caseId }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // 权限检查
  const { permissions, checkPermission } = usePDFParserPermissions();
  const _networkStatus = useNetworkStatus();

  // 状态管理
  const [selectedFile, setSelectedFile] = useState<UploadedFile | null>(null);
  const [currentFileUrl, setCurrentFileUrl] = useState<string>('');
  const [_selectedFieldName, setSelectedFieldName] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(isMobile ? 0 : -1); // 移动端默认显示上传tab
  const [_showBackdrop, _setShowBackdrop] = useState(false);
  const [editingField, setEditingField] = useState<ParsedField | null>(null);
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const [permissionDialogInfo, setPermissionDialogInfo] = useState<{
    action: string;
    reason: string;
    suggestions: string[];
  } | null>(null);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
  }>({
    open: false,
    message: '',
    severity: 'info',
  });
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

  // PDF解析器状态
  const {
    currentParseId,
    parseResult,
    isLoadingParse,
    parseError,
    setCurrentParseId: _setCurrentParseId,
  } = usePDFParserState();

  // 从URL参数获取case ID
  const finalCaseId = caseId || searchParams.get('caseId') || undefined;

  // 权限检查辅助函数
  const checkAndExecute = useCallback((
    action: keyof typeof permissions,
    callback: () => void,
    actionLabel: string
  ) => {
    const permissionCheck = checkPermission(action);
    if (!permissionCheck.hasPermission) {
      setPermissionDialogInfo({
        action: actionLabel,
        reason: permissionCheck.reason || '权限不足',
        suggestions: permissionCheck.suggestions || [],
      });
      setShowPermissionDialog(true);
      return false;
    }
    
    try {
      callback();
      return true;
    } catch (error) {
      handleError(error instanceof Error ? error : new Error(String(error)), `execute_${action}`);
      return false;
    }
  }, [permissions, checkPermission]);

  // 处理文件上传成功
  const handleFilesUploaded = useCallback((files: UploadedFile[]) => {
    checkAndExecute('canUploadFile', () => {
      if (files.length > 0) {
        const firstFile = files[0];
        setSelectedFile(firstFile);
        
        // 这里需要从上传响应中获取文件URL和解析ID
        // 暂时模拟文件URL
        setCurrentFileUrl(URL.createObjectURL(firstFile.file));
        
        // 显示成功消息
        setSnackbar({
          open: true,
          message: `成功上传 ${files.length} 个文件`,
          severity: 'success',
        });
      }
    }, '上传文件');
  }, [checkAndExecute]);

  // 处理文件选择
  const handleFileSelected = useCallback((file: UploadedFile) => {
    setSelectedFile(file);
    setCurrentFileUrl(URL.createObjectURL(file.file));
    
    // 在移动端自动切换到预览tab
    if (isMobile) {
      setActiveTab(1);
    }
  }, [isMobile]);

  // 处理字段点击（高亮PDF对应区域）
  const handleFieldClick = useCallback((fieldName: string) => {
    setSelectedFieldName(fieldName);
    
    // 在移动端切换到PDF预览tab
    if (isMobile) {
      setActiveTab(1);
    }
  }, [isMobile]);

  // 处理字段编辑
  const handleFieldEdit = useCallback((field: ParsedField) => {
    checkAndExecute('canEditParseResult', () => {
      setEditingField(field);
    }, '编辑解析结果');
  }, [checkAndExecute]);

  // 处理字段编辑成功
  const handleFieldEditSuccess = useCallback(() => {
    setSnackbar({
      open: true,
      message: '字段修正成功',
      severity: 'success',
    });
  }, []);

  // 关闭字段编辑对话框
  const handleCloseFieldEdit = useCallback(() => {
    setEditingField(null);
  }, []);

  // 处理PDF页面变化
  const handlePDFPageChange = useCallback((pageNumber: number) => {
    console.log('PDF页面变化:', pageNumber);
  }, []);

  // 处理解析成功
  const handleParseSuccess = useCallback((numPages: number) => {
    console.log('PDF解析成功，共', numPages, '页');
  }, []);

  // 处理解析错误
  const handleParseError = useCallback((error: Error) => {
    setSnackbar({
      open: true,
      message: `PDF加载失败: ${error.message}`,
      severity: 'error',
    });
  }, []);

  // 关闭snackbar
  const handleCloseSnackbar = useCallback(() => {
    setSnackbar(prev => ({ ...prev, open: false }));
  }, []);

  // Tab变化处理
  const handleTabChange = useCallback((event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  }, []);

  // 渲染面包屑
  const renderBreadcrumbs = () => (
    <Breadcrumbs sx={{ mb: 2 }}>
      <Link
        color="inherit"
        href="/"
        onClick={(e) => {
          e.preventDefault();
          navigate('/');
        }}
      >
        首页
      </Link>
      {finalCaseId && (
        <Link
          color="inherit"
          href={`/cases/${finalCaseId}`}
          onClick={(e) => {
            e.preventDefault();
            navigate(`/cases/${finalCaseId}`);
          }}
        >
          案件详情
        </Link>
      )}
      <Typography color="text.primary">PDF智能解析</Typography>
    </Breadcrumbs>
  );

  // 渲染页面标题
  const renderPageHeader = () => (
    <Box sx={{ mb: isMobile ? 2 : 3 }}>
      <Stack 
        direction={isMobile ? "column" : "row"} 
        justifyContent="space-between" 
        alignItems={isMobile ? "flex-start" : "center"} 
        sx={{ mb: 2 }}
        spacing={isMobile ? 1 : 0}
      >
        <Typography variant={isMobile ? "h5" : "h4"} component="h1">
          PDF智能解析工具
        </Typography>
        
        <Stack direction="row" spacing={1} alignItems="center">
          {selectedFile && (
            <Chip
              icon={<PdfIcon />}
              label={isMobile ? selectedFile.name.substring(0, 15) + '...' : selectedFile.name}
              variant="outlined"
              size={isMobile ? "small" : "medium"}
              onDelete={() => {
                setSelectedFile(null);
                setCurrentFileUrl('');
                setSelectedFieldName(null);
              }}
              sx={isMobile ? { 
                '& .MuiChip-deleteIcon': { 
                  minHeight: '24px',
                  minWidth: '24px'
                }
              } : {}}
            />
          )}
          
          <IconButton 
            onClick={(e) => setMenuAnchor(e.currentTarget)}
            sx={isMobile ? { 
              minHeight: '44px',
              minWidth: '44px'
            } : {}}
          >
            <MoreVertIcon />
          </IconButton>
          
          <Menu
            anchorEl={menuAnchor}
            open={Boolean(menuAnchor)}
            onClose={() => setMenuAnchor(null)}
          >
            <MenuItem sx={isMobile ? { minHeight: '44px' } : {}}>
              <SettingsIcon sx={{ mr: 1 }} />
              设置
            </MenuItem>
          </Menu>
        </Stack>
      </Stack>
      
      <Typography 
        variant={isMobile ? "body2" : "body1"} 
        color="text.secondary"
        sx={isMobile ? { px: 0 } : {}}
      >
        上传PDF文档，智能提取合同信息、计算利息、生成报告
      </Typography>
    </Box>
  );

  // 渲染桌面端布局
  const renderDesktopLayout = () => (
    <Grid container spacing={3} sx={{ height: 'calc(100vh - 200px)' }}>
      {/* 左侧面板 */}
      <Grid size={6}>
        <Stack spacing={2} sx={{ height: '100%' }}>
          {/* 文件上传区域 */}
          <Card>
            <CardContent>
              <PDFUploadComponent
                onFilesUploaded={handleFilesUploaded}
                onFileSelected={handleFileSelected}
                caseId={finalCaseId}
                maxFiles={5}
              />
            </CardContent>
          </Card>
          
          {/* 解析结果区域 */}
          <Box sx={{ flex: 1 }}>
            <ParseResultComponent
              parseResult={parseResult}
              onFieldEdit={handleFieldEdit}
              onFieldClick={handleFieldClick}
              highlightLowConfidence={true}
            />
          </Box>
        </Stack>
      </Grid>
      
      {/* 右侧PDF预览面板 */}
      <Grid size={6}>
        {currentFileUrl ? (
          <PDFPreviewComponent
            fileUrl={currentFileUrl}
            fileName={selectedFile?.name}
            onPageChange={handlePDFPageChange}
            onLoadSuccess={handleParseSuccess}
            onLoadError={handleParseError}
            enableControls={true}
            enableHighlight={true}
          />
        ) : (
          <Paper sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Box sx={{ textAlign: 'center' }}>
              <PdfIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6" color="text.secondary">
                选择PDF文件开始解析
              </Typography>
            </Box>
          </Paper>
        )}
      </Grid>
    </Grid>
  );

  // 渲染移动端布局
  const renderMobileLayout = () => (
    <Box sx={{ height: 'calc(100vh - 160px)', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            '& .MuiTab-root': isMobile ? {
              minHeight: '48px',
              minWidth: '90px',
              fontSize: '0.875rem',
            } : {},
          }}
        >
          <Tab icon={<PdfIcon />} label="上传" />
          <Tab icon={<AnalyticsIcon />} label="预览" disabled={!currentFileUrl} />
          <Tab icon={<CalculateIcon />} label="结果" disabled={!parseResult} />
        </Tabs>
      </Box>
      
      <Box sx={{ flex: 1, overflow: 'hidden' }}>
        <TabPanel value={activeTab} index={0}>
          <Box sx={{ p: 2, height: '100%' }}>
            <PDFUploadComponent
              onFilesUploaded={handleFilesUploaded}
              onFileSelected={handleFileSelected}
              caseId={finalCaseId}
              maxFiles={3}
            />
          </Box>
        </TabPanel>
        
        <TabPanel value={activeTab} index={1}>
          {currentFileUrl && (
            <PDFPreviewComponent
              fileUrl={currentFileUrl}
              fileName={selectedFile?.name}
              onPageChange={handlePDFPageChange}
              onLoadSuccess={handleParseSuccess}
              onLoadError={handleParseError}
              enableControls={true}
              enableHighlight={true}
            />
          )}
        </TabPanel>
        
        <TabPanel value={activeTab} index={2}>
          <ParseResultComponent
            parseResult={parseResult}
            onFieldEdit={handleFieldEdit}
            onFieldClick={handleFieldClick}
            highlightLowConfidence={true}
          />
        </TabPanel>
      </Box>
    </Box>
  );

  return (
    <PDFParserErrorBoundary
      onError={(error, errorInfo) => {
        handleError(error, 'pdf_parser_page');
        console.error('PDF Parser页面错误:', error, errorInfo);
      }}
    >
      <PageContainer>
        <Box>
          {renderBreadcrumbs()}
          {renderPageHeader()}
          
          {isMobile ? renderMobileLayout() : renderDesktopLayout()}
          
          {/* 网络状态监控 */}
          <NetworkStatusMonitor
            showDetailedInfo={true}
            position="bottom"
            autoHide={true}
            autoHideDelay={3000}
          />
          
          {/* 加载遮罩 */}
          <Backdrop
            sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }}
            open={_showBackdrop || isLoadingParse}
          >
            <CircularProgress color="inherit" />
          </Backdrop>
          
          {/* 消息提示 */}
          <Snackbar
            open={snackbar.open}
            autoHideDuration={6000}
            onClose={handleCloseSnackbar}
            anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
          >
            <Alert
              onClose={handleCloseSnackbar}
              severity={snackbar.severity}
              sx={{ width: '100%' }}
            >
              {snackbar.message}
            </Alert>
          </Snackbar>
          
          {/* 错误处理 */}
          {parseError && (
            <Snackbar
              open={true}
              autoHideDuration={8000}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
              <Alert severity="error">
                解析失败: {parseError.message}
              </Alert>
            </Snackbar>
          )}

          {/* 权限不足对话框 */}
          <Dialog
            open={showPermissionDialog}
            onClose={() => setShowPermissionDialog(false)}
            maxWidth="sm"
            fullWidth
            fullScreen={isMobile}
          >
            <DialogTitle>
              <Box display="flex" alignItems="center" gap={1}>
                <LockIcon color="warning" />
                <Typography variant="h6">权限不足</Typography>
              </Box>
            </DialogTitle>
            <DialogContent>
              {permissionDialogInfo && (
                <Box>
                  <Alert severity="warning" sx={{ mb: 2 }}>
                    <Typography variant="body1" gutterBottom>
                      无法执行"{permissionDialogInfo.action}"操作
                    </Typography>
                    <Typography variant="body2">
                      {permissionDialogInfo.reason}
                    </Typography>
                  </Alert>
                  
                  {permissionDialogInfo.suggestions.length > 0 && (
                    <Box>
                      <Typography variant="subtitle2" gutterBottom>
                        建议解决方案：
                      </Typography>
                      <Box component="ul" sx={{ pl: 2 }}>
                        {permissionDialogInfo.suggestions.map((suggestion, index) => (
                          <Typography component="li" key={index} variant="body2" sx={{ mb: 0.5 }}>
                            {suggestion}
                          </Typography>
                        ))}
                      </Box>
                    </Box>
                  )}
                </Box>
              )}
            </DialogContent>
            <DialogActions sx={isMobile ? { p: 2, flexDirection: 'column', gap: 1 } : {}}>
              <Button 
                onClick={() => setShowPermissionDialog(false)}
                sx={isMobile ? { 
                  minHeight: '44px',
                  width: '100%'
                } : {}}
              >
                我知道了
              </Button>
              <Button
                variant="contained"
                onClick={() => {
                  setShowPermissionDialog(false);
                  navigate('/settings/permissions');
                }}
                sx={isMobile ? { 
                  minHeight: '44px',
                  width: '100%'
                } : {}}
              >
                查看权限设置
              </Button>
            </DialogActions>
          </Dialog>

          {/* 字段编辑对话框 */}
          {currentParseId && (
            <FieldEditDialog
              open={!!editingField}
              field={editingField}
              parseId={currentParseId}
              onClose={handleCloseFieldEdit}
              onSuccess={handleFieldEditSuccess}
            />
          )}
        </Box>
      </PageContainer>
    </PDFParserErrorBoundary>
  );
};

export default PDFParserPage;