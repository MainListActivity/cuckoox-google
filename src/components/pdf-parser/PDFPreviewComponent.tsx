import React, { useState, useCallback, useMemo } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import {
  Box,
  Paper,
  IconButton,
  ButtonGroup,
  Typography,
  Toolbar,
  Slider,
  TextField,
  Alert,
  CircularProgress,
  Stack,
  Tooltip,
} from '@mui/material';
import {
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  FitScreen as FitScreenIcon,
  NavigateBefore as NavigateBeforeIcon,
  NavigateNext as NavigateNextIcon,
  FirstPage as FirstPageIcon,
  LastPage as LastPageIcon,
  Fullscreen as FullscreenIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import { HighlightRegion } from '@/src/types/pdfParser';

// 设置PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

interface PDFPreviewComponentProps {
  fileUrl: string;
  fileName?: string;
  highlightRegions?: HighlightRegion[];
  onPageChange?: (pageNumber: number) => void;
  onRegionClick?: (region: HighlightRegion) => void;
  onLoadSuccess?: (numPages: number) => void;
  onLoadError?: (error: Error) => void;
  initialPage?: number;
  initialScale?: number;
  enableControls?: boolean;
  enableHighlight?: boolean;
  maxWidth?: number;
  _maxHeight?: number;
}

const PDFPreviewComponent: React.FC<PDFPreviewComponentProps> = ({
  fileUrl,
  fileName,
  highlightRegions = [],
  onPageChange,
  onRegionClick,
  onLoadSuccess,
  onLoadError,
  initialPage = 1,
  initialScale = 1.0,
  enableControls = true,
  enableHighlight = true,
  maxWidth,
  _maxHeight,
}) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(initialPage);
  const [scale, setScale] = useState<number>(initialScale);
  const [pageInputValue, setPageInputValue] = useState<string>(initialPage.toString());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // 文档加载成功处理
  const handleDocumentLoadSuccess = useCallback((pdf: any) => {
    setNumPages(pdf.numPages);
    setIsLoading(false);
    setError(null);
    onLoadSuccess?.(pdf.numPages);
  }, [onLoadSuccess]);

  // 文档加载错误处理
  const handleDocumentLoadError = useCallback((error: Error) => {
    setIsLoading(false);
    setError(error.message);
    onLoadError?.(error);
  }, [onLoadError]);

  // 页面变化处理
  const handlePageChange = useCallback((newPage: number) => {
    if (newPage >= 1 && newPage <= numPages) {
      setCurrentPage(newPage);
      setPageInputValue(newPage.toString());
      onPageChange?.(newPage);
    }
  }, [numPages, onPageChange]);

  // 缩放变化处理
  const handleScaleChange = useCallback((newScale: number) => {
    const clampedScale = Math.max(0.25, Math.min(4.0, newScale));
    setScale(clampedScale);
  }, []);

  // 缩放到合适大小
  const handleFitToScreen = useCallback(() => {
    if (maxWidth) {
      // 根据容器宽度计算合适的缩放比例
      const targetScale = maxWidth / 612; // 612是PDF默认宽度点数
      handleScaleChange(Math.min(2.0, Math.max(0.25, targetScale)));
    } else {
      handleScaleChange(1.0);
    }
  }, [maxWidth, handleScaleChange]);

  // 键盘事件处理
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.target instanceof HTMLInputElement) return;

    switch (event.key) {
      case 'ArrowLeft':
        handlePageChange(currentPage - 1);
        break;
      case 'ArrowRight':
        handlePageChange(currentPage + 1);
        break;
      case 'Home':
        handlePageChange(1);
        break;
      case 'End':
        handlePageChange(numPages);
        break;
      case '+':
        handleScaleChange(scale * 1.25);
        break;
      case '-':
        handleScaleChange(scale * 0.8);
        break;
      case '0':
        handleFitToScreen();
        break;
      case 'f':
      case 'F11':
        event.preventDefault();
        setIsFullscreen(!isFullscreen);
        break;
    }
  }, [currentPage, numPages, scale, isFullscreen, handlePageChange, handleScaleChange, handleFitToScreen]);

  // 绑定键盘事件
  React.useEffect(() => {
    if (enableControls) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [enableControls, handleKeyDown]);

  // 页面输入验证
  const handlePageInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setPageInputValue(value);
  }, []);

  const handlePageInputBlur = useCallback(() => {
    const page = parseInt(pageInputValue, 10);
    if (!isNaN(page)) {
      handlePageChange(page);
    } else {
      setPageInputValue(currentPage.toString());
    }
  }, [pageInputValue, currentPage, handlePageChange]);

  // 获取当前页面的高亮区域
  const currentPageHighlights = useMemo(() => {
    return highlightRegions.filter(region => region.pageNumber === currentPage);
  }, [highlightRegions, currentPage]);

  // 高亮区域点击处理
  const handleRegionClick = useCallback((region: HighlightRegion, event: React.MouseEvent) => {
    event.stopPropagation();
    onRegionClick?.(region);
  }, [onRegionClick]);

  // 下载PDF
  const handleDownload = useCallback(() => {
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = fileName || 'document.pdf';
    link.click();
  }, [fileUrl, fileName]);

  // 渲染高亮区域
  const renderHighlights = () => {
    if (!enableHighlight || currentPageHighlights.length === 0) {
      return null;
    }

    return currentPageHighlights.map(region => (
      <Box
        key={region.id}
        sx={{
          position: 'absolute',
          left: `${region.x * scale}px`,
          top: `${region.y * scale}px`,
          width: `${region.width * scale}px`,
          height: `${region.height * scale}px`,
          backgroundColor: region.color || 'rgba(255, 255, 0, 0.3)',
          border: '2px solid',
          borderColor: region.color || 'orange',
          cursor: 'pointer',
          borderRadius: '2px',
          '&:hover': {
            backgroundColor: region.color ? `${region.color}80` : 'rgba(255, 255, 0, 0.5)',
          },
        }}
        onClick={(event) => handleRegionClick(region, event)}
        title={`字段: ${region.fieldName} | 置信度: ${(region.confidence * 100).toFixed(1)}%`}
      />
    ));
  };

  // 工具栏
  const renderToolbar = () => {
    if (!enableControls) return null;

    return (
      <Toolbar
        variant="dense"
        sx={{
          backgroundColor: 'background.paper',
          borderBottom: '1px solid',
          borderColor: 'divider',
          gap: 1,
        }}
      >
        {/* 页面导航 */}
        <ButtonGroup size="small">
          <IconButton 
            onClick={() => handlePageChange(1)}
            disabled={currentPage <= 1}
            title="首页"
          >
            <FirstPageIcon />
          </IconButton>
          <IconButton 
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            title="上一页"
          >
            <NavigateBeforeIcon />
          </IconButton>
          <IconButton 
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage >= numPages}
            title="下一页"
          >
            <NavigateNextIcon />
          </IconButton>
          <IconButton 
            onClick={() => handlePageChange(numPages)}
            disabled={currentPage >= numPages}
            title="末页"
          >
            <LastPageIcon />
          </IconButton>
        </ButtonGroup>

        {/* 页码输入 */}
        <TextField
          value={pageInputValue}
          onChange={handlePageInputChange}
          onBlur={handlePageInputBlur}
          size="small"
          variant="outlined"
          sx={{ width: 60 }}
          inputProps={{
            style: { textAlign: 'center' },
            min: 1,
            max: numPages,
          }}
        />
        <Typography variant="body2">
          / {numPages}
        </Typography>

        {/* 缩放控制 */}
        <ButtonGroup size="small" sx={{ ml: 2 }}>
          <IconButton 
            onClick={() => handleScaleChange(scale * 0.8)}
            disabled={scale <= 0.25}
            title="缩小"
          >
            <ZoomOutIcon />
          </IconButton>
          <IconButton 
            onClick={handleFitToScreen}
            title="适合宽度"
          >
            <FitScreenIcon />
          </IconButton>
          <IconButton 
            onClick={() => handleScaleChange(scale * 1.25)}
            disabled={scale >= 4.0}
            title="放大"
          >
            <ZoomInIcon />
          </IconButton>
        </ButtonGroup>

        {/* 缩放滑块 */}
        <Box sx={{ width: 120, ml: 2 }}>
          <Slider
            value={scale}
            min={0.25}
            max={4.0}
            step={0.05}
            onChange={(_, value) => handleScaleChange(value as number)}
            size="small"
            valueLabelDisplay="auto"
            valueLabelFormat={(value) => `${Math.round(value * 100)}%`}
          />
        </Box>

        <Typography variant="body2" sx={{ minWidth: 50, textAlign: 'center' }}>
          {Math.round(scale * 100)}%
        </Typography>

        {/* 其他操作 */}
        <Stack direction="row" spacing={1} sx={{ ml: 'auto' }}>
          <Tooltip title="下载PDF">
            <IconButton onClick={handleDownload}>
              <DownloadIcon />
            </IconButton>
          </Tooltip>
          
          <Tooltip title="全屏">
            <IconButton onClick={() => setIsFullscreen(!isFullscreen)}>
              <FullscreenIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      </Toolbar>
    );
  };

  return (
    <Paper 
      sx={{ 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        ...(isFullscreen && {
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 9999,
        }),
      }}
    >
      {renderToolbar()}
      
      <Box 
        sx={{ 
          flex: 1, 
          overflow: 'auto', 
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          p: 2,
          backgroundColor: 'grey.100',
          position: 'relative',
        }}
      >
        {error ? (
          <Alert severity="error" sx={{ maxWidth: 400 }}>
            PDF加载失败: {error}
          </Alert>
        ) : isLoading ? (
          <CircularProgress />
        ) : (
          <Box sx={{ position: 'relative' }}>
            <Document
              file={fileUrl}
              onLoadSuccess={handleDocumentLoadSuccess}
              onLoadError={handleDocumentLoadError}
              loading={<CircularProgress />}
              error={
                <Alert severity="error">
                  无法加载PDF文档
                </Alert>
              }
            >
              <Page
                pageNumber={currentPage}
                scale={scale}
                renderTextLayer={false}
                renderAnnotationLayer={false}
                loading={<CircularProgress />}
                error={
                  <Alert severity="error">
                    无法渲染页面 {currentPage}
                  </Alert>
                }
              />
            </Document>
            
            {/* 高亮区域覆盖层 */}
            {renderHighlights()}
          </Box>
        )}
      </Box>

      {/* 快捷键提示 */}
      {enableControls && !isFullscreen && (
        <Box sx={{ p: 1, backgroundColor: 'background.default', fontSize: '0.75rem', textAlign: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            快捷键: ←→ 翻页 | +/- 缩放 | Home/End 首末页 | F 全屏
          </Typography>
        </Box>
      )}
    </Paper>
  );
};

export default PDFPreviewComponent;