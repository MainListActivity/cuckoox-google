import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from '../../contexts/SnackbarContext'; // Assuming path is correct

interface Claim {
  id: string;
  submissionDate: string;
  claimNature: string;
  totalAmount: number;
  currency: string;
  reviewStatus: '待审核' | '审核通过' | '已驳回' | '审核不通过' | '需要补充'; // Extended statuses
  reviewOpinion?: string;
}

// Placeholder SVG icons
const EyeIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
const UndoIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" /></svg>;
const PencilIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>;

const MyClaimsPage: React.FC = () => {
  const navigate = useNavigate();
  const { showSnackbar } = useSnackbar();

  const claimsData: Claim[] = [
    { id: 'CLAIM-001', submissionDate: '2023-10-26', claimNature: '普通债权', totalAmount: 15000, currency: 'CNY', reviewStatus: '待审核', reviewOpinion: '' },
    { id: 'CLAIM-002', submissionDate: '2023-10-20', claimNature: '有财产担保债权', totalAmount: 125000, currency: 'CNY', reviewStatus: '审核通过', reviewOpinion: '符合要求' },
    { id: 'CLAIM-003', submissionDate: '2023-09-15', claimNature: '劳动报酬', totalAmount: 8000, currency: 'CNY', reviewStatus: '已驳回', reviewOpinion: '材料不足，请补充合同和工资流水。' },
    { id: 'CLAIM-004', submissionDate: '2023-11-01', claimNature: '普通债权', totalAmount: 22000, currency: 'USD', reviewStatus: '需要补充', reviewOpinion: '请提供债权发生时间的证明。' },
  ];

  const formatCurrencyDisplay = (amount: number, currency: string) => {
    return `${amount.toLocaleString('en-US', { style: 'currency', currency: currency, minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getStatusColor = (status: Claim['reviewStatus']) => {
    switch (status) {
      case '待审核': return 'text-yellow-600 dark:text-yellow-400 border-yellow-500 dark:border-yellow-400';
      case '审核通过': return 'text-green-600 dark:text-green-400 border-green-500 dark:border-green-400';
      case '已驳回': return 'text-red-600 dark:text-red-400 border-red-500 dark:border-red-400';
      case '审核不通过': return 'text-red-700 dark:text-red-500 border-red-700 dark:border-red-500';
      case '需要补充': return 'text-blue-600 dark:text-blue-400 border-blue-500 dark:border-blue-400';
      default: return 'text-gray-600 dark:text-gray-400 border-gray-500 dark:border-gray-400';
    }
  };
  
  const handleWithdraw = (claimId: string, status: Claim['reviewStatus']) => {
    if (status !== '待审核') {
      showSnackbar('只有“待审核”状态的债权才能撤回。', 'warning');
      return;
    }
    console.log(`Withdraw claim: ${claimId}`);
    showSnackbar(`债权 ${claimId} 已成功撤回 (模拟)。`, 'success');
    // Here you might want to re-fetch data or update state if this were a real app
  };

  const isWithdrawDisabled = (status: Claim['reviewStatus']) => status !== '待审核';
  const isEditDisabled = (status: Claim['reviewStatus']) => !['已驳回', '需要补充'].includes(status);


  const buttonBaseClass = "p-1.5 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-1 dark:focus:ring-offset-gray-800 inline-flex items-center justify-center";
  const enabledButtonClass = "hover:bg-gray-100 dark:hover:bg-gray-700";
  const disabledButtonClass = "opacity-50 cursor-not-allowed";

  return (
    <div className="p-4 sm:p-6 bg-gray-100 dark:bg-gray-900 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex flex-col sm:flex-row justify-between items-center gap-4">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-white">
            我的债权申报
          </h1>
          <button
            onClick={() => navigate('/claims/submit')} // Corrected path
            className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-blue-500 dark:hover:bg-blue-600 dark:focus:ring-offset-gray-900"
          >
            发起新的债权申报
          </button>
        </div>

        <div className="bg-white dark:bg-gray-800 shadow-md sm:rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  {['债权编号', '申报时间', '债权性质', '主张债权总额', '审核状态', '审核意见', '操作'].map(header => (
                    <th key={header} scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {claimsData.map((claim) => (
                  <tr key={claim.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-150">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{claim.id}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{claim.submissionDate}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{claim.claimNature}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{formatCurrencyDisplay(claim.totalAmount, claim.currency)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full border ${getStatusColor(claim.reviewStatus)}`}>
                        {claim.reviewStatus}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-300 max-w-xs truncate" title={claim.reviewOpinion}>
                      {claim.reviewOpinion || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      <button 
                        title="查看详情"
                        onClick={() => navigate('/submitted-claim-detail')} // In real app: navigate(`/my-claims/${claim.id}`)
                        className={`${buttonBaseClass} text-blue-600 dark:text-blue-400 focus:ring-blue-500 ${enabledButtonClass}`}
                      >
                        <EyeIcon />
                      </button>
                      <button
                        title="撤回"
                        onClick={() => handleWithdraw(claim.id, claim.reviewStatus)}
                        className={`${buttonBaseClass} ${isWithdrawDisabled(claim.reviewStatus) ? `${disabledButtonClass} text-gray-400 dark:text-gray-600` : `text-yellow-600 dark:text-yellow-400 focus:ring-yellow-500 ${enabledButtonClass}`}`}
                        // disabled={isWithdrawDisabled(claim.reviewStatus)} // Actual disable
                      >
                        <UndoIcon />
                      </button>
                      <button
                        title="编辑"
                        onClick={() => navigate('/claims/submit')} // Corrected path, in real app: navigate(`/claims/submit/${claim.id}/edit`) or similar
                        className={`${buttonBaseClass} ${isEditDisabled(claim.reviewStatus) ? `${disabledButtonClass} text-gray-400 dark:text-gray-600` : `text-green-600 dark:text-green-400 focus:ring-green-500 ${enabledButtonClass}`}`}
                        // disabled={isEditDisabled(claim.reviewStatus)} // Actual disable
                      >
                        <PencilIcon />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {claimsData.length === 0 && (
            <div className="text-center py-12">
              <p className="text-lg text-gray-500 dark:text-gray-400">您目前没有已提交的债权申报。</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MyClaimsPage;
