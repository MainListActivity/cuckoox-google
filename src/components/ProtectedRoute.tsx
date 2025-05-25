import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: JSX.Element;
  requiredRole?: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredRole }) => {
  const { isLoggedIn, user, hasRole } = useAuth();
  const location = useLocation();

  if (!isLoggedIn) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredRole && !hasRole(requiredRole)) {
    // Redirect to a 'Forbidden' page or dashboard if role doesn't match
    // For now, redirecting to dashboard
    return <Navigate to="/dashboard" replace />;
  }
  
  // TODO: Implement case selection logic from specification
  // If case selection is required for this route and not selected, redirect to /select-case
  // const selectedCaseId = localStorage.getItem('cuckoox-selectedCaseId');
  // const routesRequiringCaseSelection = ['/dashboard', '/cases', '/creditors', '/claims']; // Example
  // if (routesRequiringCaseSelection.includes(location.pathname) && !selectedCaseId && location.pathname !== '/select-case') {
  //   return <Navigate to="/select-case" state={{ from: location }} replace />;
  // }


  return children;
};

export default ProtectedRoute;