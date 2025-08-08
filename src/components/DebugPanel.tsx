import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Box, Typography, Button, Paper, Accordion, AccordionSummary, AccordionDetails } from '@mui/material';
import { mdiChevronDown, mdiRefresh, mdiConsole } from '@mdi/js';
import Icon from '@mdi/react';
import { useAuth } from '@/src/contexts/AuthContext';
import { useSurreal } from '@/src/contexts/SurrealProvider';
import authService from '@/src/services/authService';

// 最简化的性能监控 Hook，完全避免状态更新导致的循环
const useRenderCounter = (componentName: string) => {
  const renderCount = useRef(0);
  const lastWarnTime = useRef(0);
  
  renderCount.current += 1;
  
  // 只在必要时警告，且限制频率
  const now = Date.now();
  if (renderCount.current > 10 && now - lastWarnTime.current > 5000) {
    console.warn(`🔄 ${componentName} has rendered ${renderCount.current} times`);
    lastWarnTime.current = now;
  }
  
  // 返回固定的对象，避免每次都创建新对象
  return {
    renderCount: renderCount.current,
    averageRenderTime: 0,
    recentRenderCount: 0
  };
};

// 调试面板组件 - 使用React.memo优化
const DebugPanel: React.FC = React.memo(() => {
  const [isVisible, setIsVisible] = useState(false);
  const auth = useAuth();
  const surreal = useSurreal();
  const renderStats = useRenderCounter('DebugPanel');

  // 缓存经常使用的状态值，使用更稳定的依赖
  const authState = useMemo(() => {
    const userName = auth.user?.name || '';
    const caseId = auth.selectedCaseId?.toString() || '';
    return {
      isLoggedIn: Boolean(auth.isLoggedIn),
      isLoading: Boolean(auth.isLoading),
      userName,
      selectedCaseId: caseId
    };
  }, [auth.isLoggedIn, auth.isLoading, auth.user?.name, auth.selectedCaseId?.toString()]);

  const surrealState = useMemo(() => {
    const errorMsg = surreal.error?.message || '';
    return {
      isConnecting: Boolean(surreal.isConnecting),
      isConnected: Boolean(surreal.isConnected),
      errorMessage: errorMsg
    };
  }, [surreal.isConnecting, surreal.isConnected, surreal.error?.message]);
  
  // 监控 localStorage 变化
  const [localStorageItems, setLocalStorageItems] = useState<{[key: string]: string}>({});
  
  // 使用useCallback来稳定updateLocalStorage函数
  const updateLocalStorage = useCallback(() => {
    const items: {[key: string]: string} = {};
    const relevantKeys = [
      'tenant_code',
      'cuckoox-selectedCaseId'
      // token 现在由 Service Worker 管理，不再存储在 localStorage
    ];
    
    relevantKeys.forEach(key => {
      const value = localStorage.getItem(key);
      if (value) {
        items[key] = value.length > 50 ? value.substring(0, 50) + '...' : value;
      }
    });
    
    setLocalStorageItems(prevItems => {
      // 只有当items真的变化时才更新状态
      if (JSON.stringify(prevItems) !== JSON.stringify(items)) {
        return items;
      }
      return prevItems;
    });
  }, []);

  useEffect(() => {
    updateLocalStorage();
    
    // 监听 localStorage 变化
    const handleStorageChange = () => updateLocalStorage();
    window.addEventListener('storage', handleStorageChange);
    
    // 定期更新（因为同页面的 localStorage 变化不会触发 storage 事件）
    const interval = setInterval(updateLocalStorage, 2000);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [updateLocalStorage]);
  
  // 清理函数
  const clearAllData = () => {
    localStorage.clear();
    console.log('🧹 All localStorage data cleared');
    window.location.reload();
  };
  
  const clearTokens = async () => {
    try {
      // Use authService to clear tokens from Service Worker
      await authService.clearAuthTokens();
      console.log('🔑 Tokens cleared from Service Worker');
    } catch (error) {
      console.error('Failed to clear tokens:', error);
    }
  };
  
  // 显示性能信息
  const showPerformanceInfo = () => {
    const now = performance.now();
    const memory = (performance as typeof performance & { memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
    
    console.group('🔍 Performance Debug Info');
    console.log('Page Load Time:', now.toFixed(2), 'ms');
    if (memory) {
      console.log('Memory Usage:', {
        used: Math.round(memory.usedJSHeapSize / 1024 / 1024) + ' MB',
        total: Math.round(memory.totalJSHeapSize / 1024 / 1024) + ' MB',
        limit: Math.round(memory.jsHeapSizeLimit / 1024 / 1024) + ' MB'
      });
    }
    console.log('Auth State:', {
      isLoggedIn: authState.isLoggedIn,
      user: authState.userName,
      isLoading: authState.isLoading,
      selectedCase: authState.selectedCaseId
    });
    console.log('Surreal State:', {
      isConnecting: surrealState.isConnecting,
      isConnected: surrealState.isConnected,
      error: surrealState.errorMessage
    });
    console.groupEnd();
  };
  
  if (!isVisible) {
    return (
      <Box
        sx={{
          position: 'fixed',
          top: 70,
          right: 10,
          zIndex: 9999,
        }}
      >
        <Button
          variant="contained"
          size="small"
          onClick={() => setIsVisible(true)}
          sx={{ 
            backgroundColor: '#ff6b6b',
            color: 'white',
            minWidth: 'auto',
            px: 1
          }}
        >
          Debug
        </Button>
      </Box>
    );
  }
  
  return (
    <Paper
      sx={{
        '&.MuiPaper-root': {
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
        },
        position: 'fixed',
        top: 50,
        right: 10,
        width: 400,
        maxHeight: '80vh',
        overflowY: 'auto',
        zIndex: 9999,
        p: 2,
        color: 'white',
        border: '1px solid #ff6b6b',
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ color: '#ff6b6b' }}>
          🔍 Debug Panel
        </Typography>
        <Button
          size="small"
          onClick={() => setIsVisible(false)}
          sx={{ color: 'white', minWidth: 'auto' }}
        >
          ✕
        </Button>
      </Box>
      
      {/* 渲染统计 */}
      <Accordion sx={{ '&.MuiAccordion-root': { backgroundColor: 'rgba(255, 255, 255, 0.1)' }, color: 'white', mb: 1 }}>
        <AccordionSummary expandIcon={<Icon path={mdiChevronDown} size={1} color="white" />}>
          <Typography>📊 Render Stats</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography variant="body2">
            Total Renders: {renderStats.renderCount}<br/>
            Recent Renders: {renderStats.recentRenderCount}<br/>
            Avg Render Time: {renderStats.averageRenderTime}ms
          </Typography>
        </AccordionDetails>
      </Accordion>
      
      {/* 认证状态 */}
      <Accordion sx={{ '&.MuiAccordion-root': { backgroundColor: 'rgba(255, 255, 255, 0.1)' }, color: 'white', mb: 1 }}>
        <AccordionSummary expandIcon={<Icon path={mdiChevronDown} size={1} color="white" />}>
          <Typography>👤 Auth State</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography variant="body2">
            Logged In: {authState.isLoggedIn ? '✅' : '❌'}<br/>
            Loading: {authState.isLoading ? '⏳' : '✅'}<br/>
            User: {authState.userName || 'None'}<br/>
            Case: {authState.selectedCaseId || 'None'}
          </Typography>
        </AccordionDetails>
      </Accordion>
      
      {/* SurrealDB状态 */}
      <Accordion sx={{ '&.MuiAccordion-root': { backgroundColor: 'rgba(255, 255, 255, 0.1)' }, color: 'white', mb: 1 }}>
        <AccordionSummary expandIcon={<Icon path={mdiChevronDown} size={1} color="white" />}>
          <Typography>🗄️ Surreal State</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography variant="body2">
            Connecting: {surrealState.isConnecting ? '⏳' : '✅'}<br/>
            Connected: {surrealState.isConnected ? '✅' : '❌'}<br/>
            Error: {surrealState.errorMessage ? '❌' : '✅'}<br/>
            Message: {surrealState.errorMessage || 'None'}
          </Typography>
        </AccordionDetails>
      </Accordion>
      
      {/* localStorage 状态 */}
      <Accordion sx={{ '&.MuiAccordion-root': { backgroundColor: 'rgba(255, 255, 255, 0.1)' }, color: 'white', mb: 1 }}>
        <AccordionSummary expandIcon={<Icon path={mdiChevronDown} size={1} color="white" />}>
          <Typography>💾 localStorage</Typography>
        </AccordionSummary>
        <AccordionDetails>
          {Object.entries(localStorageItems).map(([key, value]) => (
            <Typography key={key} variant="body2" sx={{ fontSize: '0.75rem', mb: 0.5 }}>
              <strong>{key}:</strong> {value}
            </Typography>
          ))}
        </AccordionDetails>
      </Accordion>
      
      {/* 操作按钮 */}
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <Button
          size="small"
          variant="outlined"
          onClick={showPerformanceInfo}
          startIcon={<Icon path={mdiConsole} size={0.7} />}
          sx={{ color: 'white', borderColor: 'white' }}
        >
          Console Info
        </Button>
        <Button
          size="small"
          variant="outlined"
          onClick={clearTokens}
          sx={{ color: 'orange', borderColor: 'orange' }}
        >
          Clear Tokens
        </Button>
        <Button
          size="small"
          variant="outlined"
          onClick={clearAllData}
          sx={{ color: 'red', borderColor: 'red' }}
        >
          Clear All
        </Button>
        <Button
          size="small"
          variant="outlined"
          onClick={() => window.location.reload()}
          startIcon={<Icon path={mdiRefresh} size={0.7} />}
          sx={{ color: 'white', borderColor: 'white' }}
        >
          Reload
        </Button>
      </Box>
      
      <Typography variant="caption" sx={{ display: 'block', mt: 2, opacity: 0.7 }}>
        💡 Check browser console for detailed logs
      </Typography>
    </Paper>
  );
});

// 设置displayName方便调试
DebugPanel.displayName = 'DebugPanel';

export default DebugPanel; 