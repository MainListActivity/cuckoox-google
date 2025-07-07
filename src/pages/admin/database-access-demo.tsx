import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Alert,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Card,
  CardContent,
  Chip,
  Divider
} from '@mui/material';
import { surrealUnifiedClient, resetUnifiedSurrealClient } from '@/src/lib/surrealUnifiedClient';
import { useSnackbar } from '@/src/contexts/SnackbarContext';
import PageContainer from '@/src/components/PageContainer';

const DatabaseAccessDemo: React.FC = () => {
  const { showSuccess, showError, showInfo } = useSnackbar();
  const [currentMode, setCurrentMode] = useState(
    import.meta.env.VITE_DB_ACCESS_MODE || 'service-worker'
  );
  const [testResult, setTestResult] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const handleModeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newMode = event.target.value;
    setCurrentMode(newMode);
    
    // 更新环境变量（这里只是演示，实际需要重启应用）
    (import.meta.env as any).VITE_DB_ACCESS_MODE = newMode;
    
    // 重置客户端实例以使用新的模式
    resetUnifiedSurrealClient();
    
    showInfo(`已切换到${newMode === 'service-worker' ? 'Service Worker' : '直接连接'}模式，请测试连接`);
  };

  const testConnection = async () => {
    setIsLoading(true);
    setTestResult('');
    
    try {
      const client = await surrealUnifiedClient();
      
      // 测试简单查询
      const result = await client.query('SELECT 1 as test');
      
      setTestResult(`✅ 连接成功! 使用模式: ${currentMode}
测试查询结果: ${JSON.stringify(result, null, 2)}`);
      
      showSuccess('数据库连接测试成功！');
    } catch (error) {
      const errorMsg = `❌ 连接失败: ${error instanceof Error ? error.message : String(error)}`;
      setTestResult(errorMsg);
      showError('数据库连接测试失败');
    } finally {
      setIsLoading(false);
    }
  };

  const getCurrentModeInfo = () => {
    if (currentMode === 'service-worker') {
      return {
        title: 'Service Worker 模式',
        description: '使用Service Worker处理数据库连接，支持离线功能和后台同步',
        features: ['支持离线操作', '后台同步', 'Token自动刷新', '跨标签页共享连接']
      };
    } else {
      return {
        title: '直接连接模式',
        description: '直接连接到SurrealDB，更简单但不支持离线功能',
        features: ['连接更直接', '调试更容易', '延迟更低', '不支持离线']
      };
    }
  };

  const modeInfo = getCurrentModeInfo();

  return (
    <PageContainer title="数据库访问模式演示">
      <Box sx={{ maxWidth: 800, mx: 'auto', p: 3 }}>
        <Alert severity="info" sx={{ mb: 3 }}>
          此页面用于演示和测试不同的数据库访问模式。在生产环境中，通过修改.env文件中的VITE_DB_ACCESS_MODE环境变量来切换模式。
        </Alert>

        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              当前配置
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <Chip 
                label={`模式: ${currentMode}`} 
                color="primary" 
                variant="outlined" 
              />
              <Chip 
                label={`环境变量: ${import.meta.env.VITE_DB_ACCESS_MODE || 'service-worker'}`} 
                color="secondary" 
                variant="outlined" 
              />
            </Box>
            
            <Typography variant="subtitle1" gutterBottom>
              {modeInfo.title}
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              {modeInfo.description}
            </Typography>
            
            <Typography variant="subtitle2" gutterBottom>
              特性:
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {modeInfo.features.map((feature, index) => (
                <Chip key={index} label={feature} size="small" />
              ))}
            </Box>
          </CardContent>
        </Card>

        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            切换访问模式 (演示用)
          </Typography>
          
          <FormControl component="fieldset" sx={{ mb: 3 }}>
            <FormLabel component="legend">选择数据库访问模式</FormLabel>
            <RadioGroup
              row
              value={currentMode}
              onChange={handleModeChange}
            >
              <FormControlLabel
                value="service-worker"
                control={<Radio />}
                label="Service Worker 模式"
              />
              <FormControlLabel
                value="direct"
                control={<Radio />}
                label="直接连接模式"
              />
            </RadioGroup>
          </FormControl>

          <Button
            variant="contained"
            onClick={testConnection}
            disabled={isLoading}
            sx={{ mb: 2 }}
          >
            {isLoading ? '测试中...' : '测试数据库连接'}
          </Button>

          {testResult && (
            <Box>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2" gutterBottom>
                测试结果:
              </Typography>
              <Paper 
                sx={{ 
                  p: 2, 
                  backgroundColor: 'grey.50',
                  fontFamily: 'monospace',
                  whiteSpace: 'pre-line'
                }}
              >
                {testResult}
              </Paper>
            </Box>
          )}
        </Paper>

        <Alert severity="warning">
          <Typography variant="subtitle2" gutterBottom>
            重要说明:
          </Typography>
          <Typography variant="body2">
            • 在生产环境中，需要修改.env文件中的VITE_DB_ACCESS_MODE并重启应用才能生效<br/>
            • Service Worker模式在开发环境可能需要手动刷新页面才能生效<br/>
            • 直接连接模式在某些网络环境下可能遇到CORS问题
          </Typography>
        </Alert>
      </Box>
    </PageContainer>
  );
};

export default DatabaseAccessDemo;