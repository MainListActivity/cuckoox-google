import React, { Component, ReactNode } from 'react';
import {
  Box,
  Typography,
  Button,
  Alert,
  Card,
  CardContent,
  CardActions,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
} from '@mui/material';
import {
  Error as ErrorIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandMoreIcon,
  BugReport as BugReportIcon,
  Home as HomeIcon,
} from '@mui/icons-material';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  errorId: string;
}

// 错误类型分类
type ErrorCategory = 'network' | 'permission' | 'validation' | 'runtime' | 'unknown';

interface ErrorDetails {
  category: ErrorCategory;
  severity: 'low' | 'medium' | 'high' | 'critical';
  userMessage: string;
  technicalMessage: string;
  suggestedActions: string[];
  retryable: boolean;
}

class PDFParserErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // 生成唯一错误ID
    const errorId = `ERR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      hasError: true,
      error,
      errorInfo: null,
      errorId,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    });

    // 调用外部错误处理回调
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // 记录错误到控制台（生产环境中可以发送到错误监控服务）
    console.error('PDF Parser Error Boundary caught an error:', error, errorInfo);
    
    // 发送错误报告到监控服务
    this.reportError(error, errorInfo);
  }

  // 分析错误类型和详情
  private analyzeError(error: Error): ErrorDetails {
    const message = error.message.toLowerCase();
    const stack = error.stack?.toLowerCase() || '';

    // 网络相关错误
    if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
      return {
        category: 'network',
        severity: 'high',
        userMessage: '网络连接出现问题，请检查您的网络连接',
        technicalMessage: error.message,
        suggestedActions: [
          '检查网络连接',
          '刷新页面重试',
          '稍后再试',
          '联系技术支持'
        ],
        retryable: true,
      };
    }

    // 权限相关错误
    if (message.includes('permission') || message.includes('unauthorized') || message.includes('forbidden')) {
      return {
        category: 'permission',
        severity: 'medium',
        userMessage: '您没有执行此操作的权限',
        technicalMessage: error.message,
        suggestedActions: [
          '请联系管理员获取权限',
          '检查您的登录状态',
          '重新登录',
        ],
        retryable: false,
      };
    }

    // 验证相关错误
    if (message.includes('validation') || message.includes('invalid') || message.includes('required')) {
      return {
        category: 'validation',
        severity: 'low',
        userMessage: '输入的数据不符合要求',
        technicalMessage: error.message,
        suggestedActions: [
          '检查输入数据的格式',
          '确保所有必填字段已填写',
          '参考帮助文档',
        ],
        retryable: true,
      };
    }

    // PDF相关错误
    if (message.includes('pdf') || stack.includes('react-pdf') || message.includes('canvas')) {
      return {
        category: 'runtime',
        severity: 'medium',
        userMessage: 'PDF处理出现问题',
        technicalMessage: error.message,
        suggestedActions: [
          '确保PDF文件没有损坏',
          '尝试重新上传文件',
          '检查文件大小是否超限',
          '尝试使用其他PDF文件',
        ],
        retryable: true,
      };
    }

    // 默认运行时错误
    return {
      category: 'runtime',
      severity: 'critical',
      userMessage: '应用程序遇到了未预期的错误',
      technicalMessage: error.message,
      suggestedActions: [
        '刷新页面重试',
        '清除浏览器缓存',
        '重启浏览器',
        '联系技术支持',
      ],
      retryable: true,
    };
  }

  // 发送错误报告
  private reportError(error: Error, errorInfo: React.ErrorInfo) {
    try {
      const errorReport = {
        errorId: this.state.errorId,
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        userId: 'current_user_id', // 可以从认证上下文获取
      };

      // 在生产环境中，这里应该发送到错误监控服务
      // 例如: Sentry, LogRocket, 或自定义错误收集API
      console.log('Error Report:', errorReport);
      
      // 存储到本地存储用于调试
      const existingReports = JSON.parse(localStorage.getItem('pdf-parser-error-reports') || '[]');
      existingReports.push(errorReport);
      localStorage.setItem('pdf-parser-error-reports', JSON.stringify(existingReports.slice(-10))); // 只保留最近10个
    } catch (reportError) {
      console.error('Failed to report error:', reportError);
    }
  }

  // 重试处理
  private handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
    });
  };

  // 返回首页
  private handleGoHome = () => {
    window.location.href = '/';
  };

  // 发送反馈
  private handleSendFeedback = () => {
    const { error, errorId } = this.state;
    const subject = `PDF解析器错误反馈 - ${errorId}`;
    const body = `错误ID: ${errorId}\n错误信息: ${error?.message}\n\n请描述您遇到问题时的操作：\n\n`;
    
    const mailtoLink = `mailto:support@example.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoLink);
  };

  render() {
    if (this.state.hasError) {
      const { error, errorInfo, errorId } = this.state;
      
      if (this.props.fallback) {
        return this.props.fallback;
      }

      if (!error) {
        return null;
      }

      const errorDetails = this.analyzeError(error);
      
      const getSeverityColor = (severity: string): "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning" => {
        switch (severity) {
          case 'low': return 'info';
          case 'medium': return 'warning';
          case 'high': return 'error';
          case 'critical': return 'error';
          default: return 'default';
        }
      };

      return (
        <Box
          display="flex"
          justifyContent="center"
          alignItems="center"
          minHeight="400px"
          p={3}
        >
          <Card sx={{ maxWidth: 600, width: '100%' }}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <ErrorIcon color="error" sx={{ mr: 1, fontSize: 32 }} />
                <Typography variant="h5" color="error">
                  出现错误
                </Typography>
                <Chip
                  label={errorDetails.severity}
                  color={getSeverityColor(errorDetails.severity)}
                  size="small"
                  sx={{ ml: 2 }}
                />
              </Box>

              <Alert severity="error" sx={{ mb: 2 }}>
                <Typography variant="body1" gutterBottom>
                  {errorDetails.userMessage}
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  错误ID: {errorId}
                </Typography>
              </Alert>

              {/* 建议操作 */}
              <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                建议解决方案
              </Typography>
              <Box component="ul" sx={{ pl: 2 }}>
                {errorDetails.suggestedActions.map((action, index) => (
                  <Typography component="li" key={index} variant="body2" sx={{ mb: 0.5 }}>
                    {action}
                  </Typography>
                ))}
              </Box>

              {/* 技术详情 */}
              <Accordion sx={{ mt: 2 }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="subtitle2">
                    技术详情（供开发人员参考）
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography variant="body2" component="pre" sx={{ 
                    whiteSpace: 'pre-wrap', 
                    fontSize: '0.75rem',
                    backgroundColor: 'grey.100',
                    p: 1,
                    borderRadius: 1,
                    mb: 1,
                  }}>
                    错误类型: {errorDetails.category}
                    {'\n'}错误信息: {error.message}
                    {'\n'}错误堆栈: {error.stack}
                  </Typography>
                  
                  {errorInfo && (
                    <Typography variant="body2" component="pre" sx={{ 
                      whiteSpace: 'pre-wrap', 
                      fontSize: '0.75rem',
                      backgroundColor: 'grey.100',
                      p: 1,
                      borderRadius: 1,
                    }}>
                      组件堆栈: {errorInfo.componentStack}
                    </Typography>
                  )}
                </AccordionDetails>
              </Accordion>
            </CardContent>

            <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
              <Box>
                <Button
                  variant="contained"
                  startIcon={<HomeIcon />}
                  onClick={this.handleGoHome}
                  sx={{ mr: 1 }}
                >
                  返回首页
                </Button>
                {errorDetails.retryable && (
                  <Button
                    variant="outlined"
                    startIcon={<RefreshIcon />}
                    onClick={this.handleRetry}
                  >
                    重试
                  </Button>
                )}
              </Box>
              
              <Button
                variant="text"
                startIcon={<BugReportIcon />}
                onClick={this.handleSendFeedback}
                size="small"
              >
                反馈问题
              </Button>
            </CardActions>
          </Card>
        </Box>
      );
    }

    return this.props.children;
  }
}

export default PDFParserErrorBoundary;