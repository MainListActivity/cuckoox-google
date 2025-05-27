import React from 'react';
import ClaimDetailView from '../../components/claim/ClaimDetailView'; // Adjusted path
import { useNavigate } from 'react-router-dom';

// Define the structure for ClaimData, matching ClaimDetailView's expected props
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

const SubmittedClaimDetailPage: React.FC = () => {
  const navigate = useNavigate();

  // Hardcoded placeholder claim data
  const placeholderClaim: ClaimData = {
    id: 'CLAIM-2023-00789',
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
    reviewStatus: '待审核', // Or '审核通过', '需要补充', '审核不通过'
    submissionDate: '2023-10-27',
  };

  return (
    <div className="p-4 sm:p-6 bg-gray-100 dark:bg-gray-900 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <ClaimDetailView claim={placeholderClaim} />
        <div className="mt-8 flex justify-center">
          <button
            onClick={() => navigate('/my-claims')} // Corrected path
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
