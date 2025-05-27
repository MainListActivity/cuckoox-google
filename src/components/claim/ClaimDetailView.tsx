import React from 'react';

interface ClaimData {
  id: string;
  claimNature: string;
  principal: string | number;
  interest: string | number;
  otherFees: string | number;
  totalAmount: string | number;
  currency: string;
  briefDescription?: string;
  attachmentsContent: string; // HTML string or plain text from RichTextEditor
  reviewStatus: string;
  submissionDate: string; // Example: '2023-10-26'
}

interface ClaimDetailViewProps {
  claim: ClaimData;
}

const ClaimDetailView: React.FC<ClaimDetailViewProps> = ({ claim }) => {
  const commonLabelClassName = "block text-sm font-medium text-gray-500 dark:text-gray-400";
  const commonValueClassName = "mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2";
  const sectionTitleClassName = "text-lg font-semibold text-gray-800 dark:text-white mb-3";
  const gridDlClassName = "sm:grid sm:grid-cols-3 sm:gap-x-4 sm:gap-y-2 sm:px-0"; // Adjusted gap-y

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  
  return (
    <div className="bg-white dark:bg-gray-800 shadow sm:rounded-lg p-4 sm:p-6">
      <div className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-6">
        <h1 className="text-2xl font-bold leading-tight text-gray-900 dark:text-white">
          债权申报详情 - {claim.id}
        </h1>
        <p className={`${commonLabelClassName} mt-1`}>提交日期: {claim.submissionDate}</p>
      </div>

      {/* Basic Information Section */}
      <section aria-labelledby="basic-claim-info" className="mb-6">
        <h2 id="basic-claim-info" className={sectionTitleClassName}>基本债权信息</h2>
        <dl className={`divide-y divide-gray-200 dark:divide-gray-700 ${gridDlClassName}`}>
          <div className="py-3 sm:grid sm:grid-cols-3 sm:gap-4">
            <dt className={commonLabelClassName}>审核状态</dt>
            <dd className={`${commonValueClassName} font-semibold ${
              claim.reviewStatus === '待审核' ? 'text-yellow-600 dark:text-yellow-400' : 
              claim.reviewStatus === '审核通过' ? 'text-green-600 dark:text-green-400' :
              claim.reviewStatus === '需要补充' ? 'text-blue-600 dark:text-blue-400' :
              'text-red-600 dark:text-red-400' // For '审核不通过' or other statuses
            }`}>
              {claim.reviewStatus}
            </dd>
          </div>
          <div className="py-3 sm:grid sm:grid-cols-3 sm:gap-4">
            <dt className={commonLabelClassName}>债权性质</dt>
            <dd className={commonValueClassName}>{claim.claimNature}</dd>
          </div>
          <div className="py-3 sm:grid sm:grid-cols-3 sm:gap-4">
            <dt className={commonLabelClassName}>币种</dt>
            <dd className={commonValueClassName}>{claim.currency}</dd>
          </div>
          <div className="py-3 sm:grid sm:grid-cols-3 sm:gap-4">
            <dt className={commonLabelClassName}>本金</dt>
            <dd className={commonValueClassName}>{formatCurrency(claim.principal)}</dd>
          </div>
          <div className="py-3 sm:grid sm:grid-cols-3 sm:gap-4">
            <dt className={commonLabelClassName}>利息</dt>
            <dd className={commonValueClassName}>{formatCurrency(claim.interest)}</dd>
          </div>
          <div className="py-3 sm:grid sm:grid-cols-3 sm:gap-4">
            <dt className={commonLabelClassName}>其他费用</dt>
            <dd className={commonValueClassName}>{formatCurrency(claim.otherFees)}</dd>
          </div>
          <div className="py-3 sm:grid sm:grid-cols-3 sm:gap-4">
            <dt className={`${commonLabelClassName} font-semibold`}>债权总额</dt>
            <dd className={`${commonValueClassName} font-semibold text-blue-600 dark:text-blue-400`}>
              {formatCurrency(claim.totalAmount)} ({claim.currency})
            </dd>
          </div>
          {claim.briefDescription && (
            <div className="py-3 sm:grid sm:grid-cols-3 sm:gap-4">
              <dt className={commonLabelClassName}>简要说明</dt>
              <dd className={`${commonValueClassName} whitespace-pre-wrap`}>{claim.briefDescription}</dd>
            </div>
          )}
        </dl>
      </section>

      {/* Attachments and Detailed Description Section */}
      <section aria-labelledby="attachments-info">
        <h2 id="attachments-info" className={sectionTitleClassName}>详细说明及附件</h2>
        <div className="mt-1 prose prose-sm sm:prose dark:prose-invert max-w-none p-3 border border-gray-200 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-700/30">
          {/* Render HTML content safely or use a sanitizer if content is user-generated and untrusted */}
          <div dangerouslySetInnerHTML={{ __html: claim.attachmentsContent }} />
        </div>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          以上为申报人提供的详细说明和上传的附件列表（如有）。附件通常显示为链接或嵌入内容。
        </p>
      </section>
    </div>
  );
};

export default ClaimDetailView;
