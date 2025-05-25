import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
// import { useAuth } from '../contexts/AuthContext'; // If needed for user-specific case list

// Mock data: list of cases the user is part of. Replace with API call.
const userCases = [
  { id: 'case001', name: '破产案件 Alpha (BK-2023-001)', lastAccessed: '2023-10-26' },
  { id: 'case002', name: '重整案件 Beta (RZ-2023-005)', lastAccessed: '2023-10-20' },
  { id: 'case003', name: '清算案件 Gamma (QS-2022-012)', lastAccessed: '2023-09-15' },
];

const CaseSelectionPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  // const { selectCase } = useAuth(); // Assuming selectCase is added to AuthContext

  const from = location.state?.from?.pathname || '/dashboard';

  const handleSelectCase = (caseId: string) => {
    // TODO: Call API to record user's last choice in SurrealDB
    // TODO: Update global state / AuthContext with selected case ID
    localStorage.setItem('cuckoox-selectedCaseId', caseId); // Simple localStorage for now
    // selectCase(caseId);
    console.log(`Case ${caseId} selected. Navigating to ${from}`);
    navigate(from, { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-lg">
        <h1 className="text-2xl font-bold text-center text-blue-600 mb-6">选择案件</h1>
        <p className="text-center text-gray-600 mb-8">
          您参与了多个案件，请选择一个进入系统。系统将记住您的选择。
        </p>
        
        {userCases.length > 0 ? (
          <ul className="space-y-3">
            {userCases.map((caseItem) => (
              <li key={caseItem.id}>
                <button
                  onClick={() => handleSelectCase(caseItem.id)}
                  className="w-full text-left px-6 py-4 bg-white border border-gray-300 rounded-md hover:bg-blue-50 hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                >
                  <span className="block text-lg font-medium text-blue-700">{caseItem.name}</span>
                  <span className="block text-sm text-gray-500">上次访问: {caseItem.lastAccessed}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-center text-gray-500">您当前未参与任何案件。</p>
        )}
        
        <p className="mt-8 text-xs text-center text-gray-400">
          如果链接中已指定案件编号 (e.g., /signin?case=xxx)，系统将自动选择该案件。
        </p>
      </div>
    </div>
  );
};

export default CaseSelectionPage;