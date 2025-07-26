import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Box, Typography, Button, Paper, Accordion, AccordionSummary, AccordionDetails } from '@mui/material';
import { mdiChevronDown, mdiRefresh, mdiConsole } from '@mdi/js';
import Icon from '@mdi/react';
import { useAuth } from '@/src/contexts/AuthContext';
import { useSurreal } from '@/src/contexts/SurrealProvider';
import authService from '@/src/services/authService';

// 性能监控 Hook - 修复无限循环问题
const useRenderCounter = (componentName: string) => {
  const renderCount = useRef(0);
  const lastRenderTime = useRef(Date.now());
  const renderTimes = useRef<number[]>([]);
  
  // 直接在组件渲染时更新计数器，不使用 useEffect
  renderCount.current += 1;
  const now = Date.now();
  renderTimes.current.push(now - lastRenderTime.current);
  lastRenderTime.current = now;
  
  // 保留最近10次渲染时间
  if (renderTimes.current.length > 10) {
    renderTimes.current.shift();
  }
  
  // 检测可能的死循环（1秒内超过10次渲染）
  const recentRenders = renderTimes.current.filter(time => time < 100);
  if (recentRenders.length >= 5) {
    console.warn(`🔄 Potential infinite loop detected in ${componentName}: ${recentRenders.length} renders in quick succession`);
  }
  
  return {
    renderCount: renderCount.current,
    averageRenderTime: renderTimes.current.length > 0 
      ? Math.round(renderTimes.current.reduce((a, b) => a + b, 0) / renderTimes.current.length)
      : 0,
    recentRenderCount: renderTimes.current.filter(time => time < 1000).length
  };
};

// 调试面板组件
const DebugPanel: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const auth = useAuth();
  const surreal = useSurreal();
  const renderStats = useRenderCounter('DebugPanel');
  
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
      isLoggedIn: auth.isLoggedIn,
      user: auth.user?.name,
      isLoading: auth.isLoading,
      selectedCase: auth.selectedCaseId?.toString()
    });
    console.log('Surreal State:', {
      isConnecting: surreal.isConnecting,
      isConnected: surreal.isConnected,
      error: surreal.error?.message
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
            Logged In: {auth.isLoggedIn ? '✅' : '❌'}<br/>
            Loading: {auth.isLoading ? '⏳' : '✅'}<br/>
            User: {auth.user?.name || 'None'}<br/>
            Case: {auth.selectedCaseId?.toString() || 'None'}
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
            Connecting: {surreal.isConnecting ? '⏳' : '✅'}<br/>
            Connected: {surreal.isConnected ? '✅' : '❌'}<br/>
            Error: {surreal.error ? '❌' : '✅'}<br/>
            Message: {surreal.error?.message || 'None'}
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
};

export default DebugPanel; 