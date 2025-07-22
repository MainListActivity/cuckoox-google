import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Breadcrumbs,
  Link,
  Tabs,
  Tab,
  Fab,
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
} from '@mui/material';
import {
  PictureAsPdf as PdfIcon,
  Analytics as AnalyticsIcon,
  Calculate as CalculateIcon,
  Description as DocumentIcon,
  Settings as SettingsIcon,
  MoreVert as MoreVertIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  PDFUploadComponent,
  PDFPreviewComponent,
  ParseResultComponent,
  FieldEditDialog,
} from '@/src/components/pdf-parser';
import { usePDFParserState } from '@/src/hooks/usePDFParser';
import { UploadedFile, ParsedField } from '@/types/pdfParser';
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

  // 状态管理
  const [selectedFile, setSelectedFile] = useState<UploadedFile | null>(null);
  const [currentFileUrl, setCurrentFileUrl] = useState<string>('');
  const [selectedFieldName, setSelectedFieldName] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(isMobile ? 0 : -1); // 移动端默认显示上传tab
  const [showBackdrop, setShowBackdrop] = useState(false);
  const [editingField, setEditingField] = useState<ParsedField | null>(null);
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
    setCurrentParseId,
  } = usePDFParserState();

  // 从URL参数获取case ID
  const finalCaseId = caseId || searchParams.get('caseId') || undefined;

  // 处理文件上传成功
  const handleFilesUploaded = useCallback((files: UploadedFile[]) => {
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
  }, []);

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
    setEditingField(field);
  }, []);

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
    <Box sx={{ mb: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h4" component="h1">
          PDF智能解析工具
        </Typography>
        
        <Stack direction="row" spacing={1} alignItems="center">
          {selectedFile && (
            <Chip
              icon={<PdfIcon />}
              label={selectedFile.name}
              variant="outlined"
              onDelete={() => {
                setSelectedFile(null);
                setCurrentFileUrl('');
                setSelectedFieldName(null);
              }}
            />
          )}
          
          <IconButton onClick={(e) => setMenuAnchor(e.currentTarget)}>
            <MoreVertIcon />
          </IconButton>
          
          <Menu
            anchorEl={menuAnchor}
            open={Boolean(menuAnchor)}
            onClose={() => setMenuAnchor(null)}
          >
            <MenuItem>
              <SettingsIcon sx={{ mr: 1 }} />
              设置
            </MenuItem>
          </Menu>
        </Stack>
      </Stack>
      
      <Typography variant="body1" color="text.secondary">
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
    <PageContainer>
      <Box>
        {renderBreadcrumbs()}
        {renderPageHeader()}
        
        {isMobile ? renderMobileLayout() : renderDesktopLayout()}
        
        {/* 加载遮罩 */}
        <Backdrop
          sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }}
          open={showBackdrop || isLoadingParse}
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
  );
};

export default PDFParserPage;