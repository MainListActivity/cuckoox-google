import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Case } from '../contexts/AuthContext'; // Import Case interface

const CaseSelectionPage: React.FC = () => {
  const { 
    user, 
    userCases, 
    selectCase, 
    selectedCaseId, 
    isLoading: isAuthLoading, 
    isCaseLoading,
    isLoggedIn 
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleCaseSelect = async (caseToSelect: Case) => {
    if (!caseToSelect || !caseToSelect.id) return;
    try {
      await selectCase(caseToSelect.id.toString()); // Ensure ID is passed as string
      const from = location.state?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    } catch (error) {
      console.error("Error selecting case:", error);
      // Optionally display an error message to the user on this page
    }
  };

  if (isAuthLoading || isCaseLoading) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center bg-gray-100 p-4">
        <div className="text-xl font-semibold text-gray-700">正在加载您的信息...</div>
        {/* Add a spinner component here if available */}
      </div>
    );
  }

  if (!isLoggedIn || !user) {
    // Should be handled by ProtectedRoute, but as a fallback:
    navigate('/login', { replace: true });
    return null; // Or a message prompting login
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-indigo-600 flex flex-col justify-center items-center p-4">
      <div className="bg-white shadow-2xl rounded-xl p-8 md:p-12 w-full max-w-2xl">
        <h1 className="text-3xl md:text-4xl font-bold text-center text-gray-800 mb-3">
          选择案件
        </h1>
        <p className="text-center text-gray-600 mb-8 md:mb-10">
          欢迎，{user.name}。请选择一个案件以继续。
        </p>

        {userCases.length === 0 ? (
          <div className="text-center p-6 bg-yellow-50 border border-yellow-300 rounded-md">
            <p className="text-yellow-700 font-medium">当前没有为您分配任何案件或没有可供选择的案件。</p>
            <p className="text-sm text-yellow-600 mt-2">如果您认为这是一个错误，请联系支持人员。</p>
          </div>
        ) : (
          <div className="space-y-4">
            {userCases.map((caseItem) => (
              <button
                key={caseItem.id.toString()}
                onClick={() => handleCaseSelect(caseItem)}
                disabled={isCaseLoading} // Disable button while a case selection might be in progress
                className={`w-full text-left p-5 md:p-6 rounded-lg shadow-md transition-all duration-300 ease-in-out
                            focus:outline-none focus:ring-4 focus:ring-opacity-50
                            ${selectedCaseId === caseItem.id.toString() 
                              ? 'bg-blue-600 text-white ring-blue-400 hover:bg-blue-700' 
                              : 'bg-white text-gray-700 hover:bg-gray-100 ring-indigo-300 hover:shadow-lg'}`}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-lg md:text-xl font-semibold">{caseItem.name}</h2>
                    {caseItem.case_number && (
                      <p className={`text-sm ${selectedCaseId === caseItem.id.toString() ? 'text-blue-100' : 'text-gray-500'}`}>
                        案件编号：{caseItem.case_number}
                      </p>
                    )}
                  </div>
                  {selectedCaseId === caseItem.id.toString() && (
                    <span className="material-icons text-2xl">check_circle</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
        
        {/* Optional: Add a logout button or other navigation if needed */}
        {/* <div className="mt-8 text-center">
          <button 
            onClick={async () => { await logout(); navigate('/login'); }}
            className="text-sm text-gray-600 hover:text-indigo-500 underline"
          >
            Logout
          </button>
        </div> */}
      </div>
      <p className="text-center text-sm text-white mt-8">
        CuckooX 平台 © {new Date().getFullYear()}
      </p>
    </div>
  );
};

export default CaseSelectionPage;