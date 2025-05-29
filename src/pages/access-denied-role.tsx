import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const AccessDeniedRolePage: React.FC = () => {
  const location = useLocation();
  const { requiredRole, attemptedPath } = location.state || {};

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] bg-white dark:bg-gray-800 text-center px-4">
      <div className="max-w-md">
        <svg 
          className="w-24 h-24 text-orange-500 dark:text-orange-400 mx-auto mb-6" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24" 
          xmlns="http://www.w3.org/2000/svg"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
        </svg>
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-4">
          权限不足
        </h1>
        <p className="text-md text-gray-600 dark:text-gray-300 mb-2">
          抱歉，您没有访问此页面所需的权限。
        </p>
        {requiredRole && attemptedPath && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
            (需要角色: {requiredRole} | 尝试访问: {attemptedPath})
          </p>
        )}
        <Link
          to="/dashboard" // Navigate to dashboard or home
          className="px-6 py-3 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-blue-500 dark:hover:bg-blue-600 dark:focus:ring-offset-gray-800"
        >
          返回仪表盘
        </Link>
      </div>
    </div>
  );
};

export default AccessDeniedRolePage;
