// STYLING: This page currently uses Tailwind CSS. Per 规范.md, consider migration to MUI components.
// TODO: Access Control - This page should only be accessible to users with a 'creditor' role.
// TODO: Access Control - Verify this claimId belongs to the logged-in creditor OR if an admin is viewing, different rules might apply (though this page is creditor-focused).
// Workflow: This page displays a read-only view of the claim as per product requirements.
import React, { useState, useEffect } from 'react'; // Added useState, useEffect
import ClaimDetailView from '@/src/components/claim/ClaimDetailView'; // Adjusted path
import { useNavigate, useParams } from 'react-router-dom'; // Added useParams

// Define the structure for ClaimData, matching ClaimDetailView's expected props
// This interface should ideally be shared if it's used across multiple files.
interface ClaimData {
  id: string;
  claimNature: string;
  principal: string | number;
  interest: string | number;
  otherFees: string | number;
  totalAmount: string | number;
  currency: string;
  briefDescription?: string;
  attachmentsContent: string;
  reviewStatus: string;
  submissionDate: string;
}

// Initial placeholder claim data (will be overridden by mock fetch)
const initialPlaceholderClaim: ClaimData = {
  id: 'LOADING...',
  claimNature: '普通债权',
  principal: 10000,
  interest: 500,
  otherFees: 60,
  totalAmount: 10560,
  currency: 'CNY',
  briefDescription: '这是关于一项未付服务费用的债权。服务已提供，但款项逾期未付。已多次尝试沟通，未果。',
  attachmentsContent: `
    <h3>附件列表</h3>
    <p>以下是本次申报提交的附件材料：</p>
    <ul>
      <li><a href="#" target="_blank" rel="noopener noreferrer">合同扫描件.pdf</a> (模拟链接)</li>
      <li><a href="#" target="_blank" rel="noopener noreferrer">发票截图.png</a> (模拟链接)</li>
      <li><a href="#" target="_blank" rel="noopener noreferrer">沟通邮件记录.docx</a> (模拟链接)</li>
    </ul>
    <p><strong>详细说明：</strong></p>
    <p>合同签订于2023年1月15日，约定服务期为3个月，总金额10000元。服务按时完成，有验收记录。
    利息按合同约定年化5%计算，其他费用为催收通讯费60元。</p>
    <img src="https://via.placeholder.com/400x200.png?text=Sample+Chart+Placeholder" alt="Sample Chart" style="margin-top: 10px; max-width: 100%; border-radius: 4px;" />
  `,
  reviewStatus: '待审核',
  submissionDate: '2023-10-27',
};


const SubmittedClaimDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const { claimId } = useParams<{ claimId: string }>();

  const [claimToView, setClaimToView] = useState<ClaimData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (claimId) {
      setIsLoading(true);
      setError(null);
      console.log(`Fetching details for claim ID: ${claimId}`);
      // Simulate API call
      setTimeout(() => {
        // In a real app, you'd fetch from an API. Here, we'll use the placeholder and update its ID.
        const mockFetchedClaim: ClaimData = {
          ...initialPlaceholderClaim, // Use the defined placeholder
          id: claimId,
          submissionDate: '2023-11-05', // Example of potentially dynamic data
          // Potentially add more dynamic elements based on claimId if needed for demo
        };
        setClaimToView(mockFetchedClaim);
        setIsLoading(false);
      }, 500);
    } else {
      setError("No claim ID provided.");
      setIsLoading(false);
    }
  }, [claimId]);

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 bg-gray-100 dark:bg-gray-900 min-h-screen flex justify-center items-center">
        <p className="text-lg text-gray-700 dark:text-gray-300">Loading claim details...</p>
        {/* Consider adding a spinner/loader component here */}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 sm:p-6 bg-gray-100 dark:bg-gray-900 min-h-screen flex justify-center items-center">
        <p className="text-lg text-red-600 dark:text-red-400">Error: {error}</p>
      </div>
    );
  }

  if (!claimToView) {
    return (
      <div className="p-4 sm:p-6 bg-gray-100 dark:bg-gray-900 min-h-screen flex justify-center items-center">
        <p className="text-lg text-gray-700 dark:text-gray-300">Claim not found.</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 bg-gray-100 dark:bg-gray-900 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <ClaimDetailView claim={claimToView} />
        <div className="mt-8 flex justify-center">
          <button
            onClick={() => navigate('/my-claims')} 
            className="px-6 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-blue-500 dark:hover:bg-blue-600 dark:focus:ring-offset-gray-900"
          >
            返回我的申报列表
          </button>
        </div>
      </div>
    </div>
  );
};

export default SubmittedClaimDetailPage;
