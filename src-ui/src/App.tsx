import React, { useState, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { darkTheme, lightTheme } from './theme/theme';
import { MainLayout } from './components/Layout/MainLayout';
import { Login } from './pages/Login/Login';
import { CaseManagement } from './pages/Cases/CaseManagement';
import { CreditorManagement } from './pages/Creditors/CreditorManagement';
import { Dashboard } from './pages/Dashboard/Dashboard';
import { ClaimSubmission } from './pages/Claims/ClaimSubmission';
import { ClaimReview } from './pages/Claims/ClaimReview';
import { OnlineMeetings } from './pages/Meetings/OnlineMeetings';
import { MessageCenter } from './pages/Messages/MessageCenter';

// 占位组件，后续会实现
const RoleManagement = () => <div>身份管理</div>;
const StatusManagement = () => <div>审核状态管理</div>;

function App() {
  const [isDarkMode, setIsDarkMode] = useState(true);
  
  const theme = useMemo(
    () => (isDarkMode ? darkTheme : lightTheme),
    [isDarkMode]
  );

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  // 简单的认证检查（实际应该从context或redux获取）
  const isAuthenticated = localStorage.getItem('token') !== null;

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Routes>
          {/* 登录路由 */}
          <Route path="/signin" element={<Login />} />
          
          {/* 受保护的路由 */}
          <Route
            path="/"
            element={
              isAuthenticated ? (
                <MainLayout toggleTheme={toggleTheme} isDarkMode={isDarkMode} />
              ) : (
                <Navigate to="/signin" replace />
              )
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="cases" element={<CaseManagement />} />
            <Route path="creditors" element={<CreditorManagement />} />
            <Route path="claims" element={<ClaimSubmission />} />
            <Route path="reviews" element={<ClaimReview />} />
            <Route path="meetings" element={<OnlineMeetings />} />
            <Route path="messages" element={<MessageCenter />} />
            <Route path="roles" element={<RoleManagement />} />
            <Route path="statuses" element={<StatusManagement />} />
          </Route>
          
          {/* 404 路由 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;
