import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next'; // <-- IMPORT I18N

interface ProtectedRouteProps {
  children: JSX.Element;
  requiredRole?: string; // For role-based access control (RBAC)
}

// Define routes that require a case to be selected to be accessible
const routesRequiringCaseSelection: string[] = [
  '/dashboard',
  '/cases', // CaseListPage might be an exception if it's where you *could* select/view all cases
            // But for now, let's assume individual case interaction pages require a selection.
  '/cases/:id', // CaseDetailPage definitely requires a selected case context, though ID is in URL
  '/creditors',
  '/claims',
  '/claims/submit',
  '/claims/:id/review',
  '/claim-dashboard',
  '/online-meetings',
  // '/messages', // Message center might be global or case-specific, TBD based on requirements
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
    // user, // Not directly used here for redirection, but for hasRole
    hasRole, 
    selectedCaseId, 
    isLoading: isAuthLoading, // Renamed for clarity
    isCaseLoading 
  } = useAuth();
  const location = useLocation();
  const { t } = useTranslation(); // <-- INITIALIZE T

  // 1. Authentication Check (Primary)
  if (isAuthLoading) {
    // If main authentication is still loading, show a loading indicator or null
    // This prevents premature redirects before auth state is known
    return <div className="flex justify-center items-center min-h-screen">{t('authenticating')}</div>; // Or a proper spinner component
  }

  if (!isLoggedIn) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 2. Case Selection Check (Secondary, after login confirmed)
  // Only proceed if authentication is done (isAuthLoading is false)
  if (
    pathMatches(location.pathname, routesRequiringCaseSelection) &&
    !selectedCaseId &&
    location.pathname !== '/select-case' // Don't redirect if already on select-case
  ) {
    if (isCaseLoading) {
      // If cases are still loading (e.g., user just logged in), show a loading indicator
      return <div className="flex justify-center items-center min-h-screen">{t('loading_case_info')}</div>;
    }
    // If cases are loaded and still no selectedCaseId, then redirect
    return <Navigate to="/select-case" state={{ from: location }} replace />;
  }
  
  // 3. Role-Based Access Control Check (Tertiary)
  // Only proceed if auth is done, and if case selection is required, it's also done.
  if (requiredRole && !hasRole(requiredRole)) {
    // User is logged in, case selected (if needed), but doesn't have the required role
    // Redirect to a 'Forbidden' page, or dashboard, or show an inline "access denied" message.
    // For now, redirecting to dashboard (or a more appropriate page like '/unauthorized')
    // Consider creating a dedicated '/unauthorized' page.
    console.warn(`User does not have required role '${requiredRole}' for route '${location.pathname}'. Redirecting.`);
    return <Navigate to="/dashboard" replace />; 
    // Or: return <Navigate to="/unauthorized" state={{ requiredRole, attemptedPath: location.pathname }} replace />;
  }

  // If all checks pass, render the requested component
  return children;
};

export default ProtectedRoute;