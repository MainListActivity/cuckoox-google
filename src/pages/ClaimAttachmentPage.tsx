import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import RichTextEditor from '../../components/RichTextEditor'; // Adjusted path
import { useSnackbar } from '../../contexts/SnackbarContext'; // Assuming path is correct

const ClaimAttachmentPage: React.FC = () => {
  const navigate = useNavigate();
  const { showSnackbar } = useSnackbar();
  const [editorContent, setEditorContent] = useState('');

  // Placeholder claim data - in a real app, this would come from state or API
  const placeholderClaimData = {
    id: 'CLAIM-2023-00789',
    totalAmount: '¥10,560.00',
    currency: 'CNY',
    nature: '普通债权',
  };

  const handleSaveDraft = () => {
    // Simulate API call
    const isSuccess = Math.random() > 0.1; // 90% success rate
    if (isSuccess) {
      console.log('Saving draft with content:', editorContent);
      showSnackbar('草稿已成功保存。', 'success');
    } else {
      console.error('Failed to save draft.');
      showSnackbar('保存草稿失败，请稍后重试。', 'error');
    }
  };

  const handleSubmitClaim = () => {
    // Simulate API call
    const isSuccess = Math.random() > 0.1; // 90% success rate
    if (isSuccess) {
      console.log('Submitting claim with content:', editorContent);
      showSnackbar('债权申报已成功提交。', 'success');
      // Potentially navigate to a success page or claims list
      // For now, let's navigate to a placeholder submitted detail page
      navigate('/submitted-claim-detail'); 
    } else {
      console.error('Failed to submit claim.');
      showSnackbar('提交申报失败，请检查网络或稍后重试。', 'error');
    }
  };

  const commonLabelClassName = "block text-sm font-medium text-gray-700 dark:text-gray-300";
  const commonValueClassName = "text-sm text-gray-900 dark:text-white";
  const buttonBaseClass = "px-6 py-2 rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800";


  return (
    <div className="p-4 sm:p-6 bg-white dark:bg-gray-800 rounded-lg shadow min-h-screen">
      <h1 className="text-2xl font-semibold text-gray-800 dark:text-white mb-6">编辑附件材料</h1>

      {/* Basic Claim Information Section */}
      <div className="mb-6 p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-700/50">
        <h2 className="text-lg font-medium text-gray-700 dark:text-gray-200 mb-3">债权基本信息 (参考)</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div>
            <span className={commonLabelClassName}>申报ID:</span>
            <span className={commonValueClassName}>{placeholderClaimData.id}</span>
          </div>
          <div>
            <span className={commonLabelClassName}>债权性质:</span>
            <span className={commonValueClassName}>{placeholderClaimData.nature}</span>
          </div>
          <div>
            <span className={commonLabelClassName}>申报金额:</span>
            <span className={commonValueClassName}>{placeholderClaimData.totalAmount} ({placeholderClaimData.currency})</span>
          </div>
        </div>
      </div>

      {/* Rich Text Editor Section */}
      <div className="mb-6">
        <label htmlFor="claim-attachments-editor" className={`${commonLabelClassName} mb-1`}>
          详细说明及附件上传:
        </label>
        {/* 
          The RichTextEditor component is expected to handle its own theming (light/dark) 
          based on its internal logic or by respecting CSS variables if quill-theme.css is designed that way.
          We ensure the container around it fits the page's theme.
        */}
        <div className="border border-gray-300 dark:border-gray-600 rounded-md overflow-hidden">
           {/* MinIO integration is assumed to be handled within RichTextEditor */}
          <RichTextEditor value={editorContent} onChange={setEditorContent} />
        </div>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          请在此处详细说明债权情况，并上传相关证明文件（如合同、发票、银行流水、判决书等）。支持图片、PDF、Word、Excel等文件格式。
        </p>
      </div>

      {/* Action Buttons Section */}
      <div className="flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-3 pt-4 mt-6 border-t border-gray-200 dark:border-gray-700">
        <button 
          type="button" 
          onClick={() => navigate('/claims/submit')} // Corrected path
          className={`${buttonBaseClass} border border-gray-300 dark:border-gray-500 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:ring-indigo-500`}
        >
          返回修改基本信息
        </button>
        <button 
          type="button" 
          onClick={handleSaveDraft}
          className={`${buttonBaseClass} bg-yellow-500 hover:bg-yellow-600 text-white focus:ring-yellow-400 dark:bg-yellow-600 dark:hover:bg-yellow-700`}
        >
          保存草稿
        </button>
        <button 
          type="button" 
          onClick={handleSubmitClaim}
          className={`${buttonBaseClass} bg-green-600 hover:bg-green-700 text-white focus:ring-green-500 dark:bg-green-500 dark:hover:bg-green-600`}
        >
          提交申报
        </button>
      </div>
    </div>
  );
};

export default ClaimAttachmentPage;
