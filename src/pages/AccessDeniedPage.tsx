import React from 'react';
import { Link } from 'react-router-dom';

const AccessDeniedPage: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] bg-white dark:bg-gray-800 text-center px-4">
      <div className="max-w-md">
        <svg 
          className="w-24 h-24 text-red-500 dark:text-red-400 mx-auto mb-6" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24" 
          xmlns="http://www.w3.org/2000/svg"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"></path>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01"></path>
           <circle cx="12" cy="12" r="10" strokeWidth="2"></circle> {/* Simplified: Circle with cross */}
        </svg>
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-4">
          访问受限
        </h1>
        <p className="text-md text-gray-600 dark:text-gray-300 mb-8">
          抱歉，当前案件状态不允许访问此模块。请联系管理员或等待案件进入相应阶段。
        </p>
        <Link
          to="/" // Navigate to dashboard or home
          className="px-6 py-3 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-blue-500 dark:hover:bg-blue-600 dark:focus:ring-offset-gray-800"
        >
          返回首页
        </Link>
      </div>
    </div>
  );
};

export default AccessDeniedPage;
