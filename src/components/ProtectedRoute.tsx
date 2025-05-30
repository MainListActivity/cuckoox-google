import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/src/contexts/AuthContext';
import GlobalLoader from '@/src/components/GlobalLoader'; // Import GlobalLoader
import { useTranslation } from 'react-i18next';
import { useCaseStatus, CaseStatus } from '@/src/contexts/CaseStatusContext';

interface AutoNavigateConfig {
  requiredRole: string;
  requiredCaseStatus: CaseStatus;
  targetPath: string;
}

interface ProtectedRouteProps {
  children: JSX.Element;
  requiredRole?: string; 
  requiredCaseStatus?: CaseStatus;
  autoNavigateConfig?: AutoNavigateConfig; // <-- ADDED
}

// Define routes that require a case to be selected to be accessible
const routesRequiringCaseSelection: string[] = [
  '/dashboard',
  // '/cases', // 案件列表页面不需要先选择案件，用户需要通过这个页面来创建或选择案件
  // '/cases/create', // 案件创建页面也不需要先选择案件
  '/cases/:id', // CaseDetailPage definitely requires a selected case context, though ID is in URL
  '/creditors',
  '/claims',
  '/claims/submit',
  '/claims/:id/review',
  '/claim-dashboard',
  '/online-meetings',
  '/messages', // 消息中心可能需要案件上下文
  // '/admin', // Admin page might operate outside a specific case context or have its own logic
];

// Helper to check if a path matches any of the routes requiring case selection, including dynamic segments
const pathMatches = (path: string, patterns: string[]): boolean => {
  return patterns.some(pattern => {
    if (pattern.includes(':')) { // Simple dynamic segment check (e.g., /cases/:id)
      const basePattern = pattern.substring(0, pattern.indexOf('/:'));
      return path.startsWith(basePattern + '/');
    }
    return path === pattern;
  });
};


const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredRole }) => {
  const { 
    isLoggedIn, 
    user, // Need user object for role in autoNavigateConfig
    hasRole, 
    selectedCaseId, 
    isLoading: isAuthLoading, 
    isCaseLoading 
  } = useAuth();
  const { caseStatus } = useCaseStatus();
  const location = useLocation();
  const { t } = useTranslation();

  // 1. Authentication Check (Primary)
  if (isAuthLoading) {
    return <GlobalLoader message={t('authenticating', 'Authenticating...')} />;
  }

  if (!isLoggedIn) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 2. Case Selection Check (Secondary, after login confirmed)
  if (
    pathMatches(location.pathname, routesRequiringCaseSelection) &&
    !selectedCaseId &&
    location.pathname !== '/select-case'
  ) {
    if (isCaseLoading) {
      return <GlobalLoader message={t('loading_case_info', 'Loading case information...')} />;
    }
    return <Navigate to="/select-case" state={{ from: location }} replace />;
  }
  
  // 3. Auto-Navigation Logic (NEW - Placed before route-specific checks)
  // if (autoNavigateConfig && user) { // Ensure user object is available
  //   if (
  //     user.role === autoNavigateConfig.requiredRole &&
  //     caseStatus === autoNavigateConfig.requiredCaseStatus &&
  //     location.pathname !== autoNavigateConfig.targetPath
  //   ) {
  //     console.log(`Auto-navigating user with role '${user.role}' to '${autoNavigateConfig.targetPath}' due to case status '${caseStatus}'.`);
  //     return <Navigate to={autoNavigateConfig.targetPath} replace />;
  //   }
  // }
  //
  // // 4. Role-Based Access Control Check for the current route
  // if (requiredRole && !hasRole(requiredRole)) {
  //   console.warn(`User with role '${user?.role}' does not have required role '${requiredRole}' for route '${location.pathname}'. Redirecting to /access-denied-role.`);
  //   return <Navigate to="/access-denied-role" state={{ requiredRole, attemptedPath: location.pathname }} replace />;
  // }
  //
  // // 5. Case Status Check for the current route
  // if (requiredCaseStatus && caseStatus !== requiredCaseStatus) {
  //   console.warn(`Access to route '${location.pathname}' denied. Current case status: '${caseStatus}'. Required: '${requiredCaseStatus}'. Redirecting to /access-denied-status.`);
  //   return <Navigate to="/access-denied-status" state={{ requiredStatus: requiredCaseStatus, currentStatus: caseStatus, attemptedPath: location.pathname }} replace />;
  // }

  return children;
};

export default ProtectedRoute;
