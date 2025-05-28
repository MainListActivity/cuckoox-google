import React from 'react';
import { useCaseStatus, CaseStatus } from '../../contexts/CaseStatusContext'; // Adjust path as needed

const CaseStatusToggler: React.FC = () => {
  const { caseStatus, setCaseStatus } = useCaseStatus();

  const statuses: CaseStatus[] = ["立案", "公告", "债权申报", "第一次债权人会议", "其他阶段"];

  const commonButtonClass = "px-4 py-2 rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800";
  const activeClass = "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500";
  const inactiveClass = "bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 focus:ring-indigo-500";

  return (
    <div className="p-4 sm:p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
      <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">
        案件状态模拟切换器
      </h2>
      <p className="mb-3 text-sm text-gray-600 dark:text-gray-300">
        当前案件状态: <span className="font-bold text-blue-600 dark:text-blue-400">{caseStatus}</span>
      </p>
      <div className="space-y-3 sm:space-y-0 sm:flex sm:flex-wrap sm:gap-3">
        {statuses.map((status) => (
          <button
            key={status}
            onClick={() => setCaseStatus(status)}
            className={`${commonButtonClass} ${caseStatus === status ? activeClass : inactiveClass}`}
          >
            设置为: {status}
          </button>
        ))}
      </div>
      <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
        切换案件状态会影响特定模块（如债权申报）的访问权限。
        例如，只有在 "债权申报" 状态下，相关页面才可访问。
      </p>
    </div>
  );
};

// Exporting as default for lazy loading if this becomes a page
// For now, it's a component, but good practice for potential page conversion.
export default CaseStatusToggler;
