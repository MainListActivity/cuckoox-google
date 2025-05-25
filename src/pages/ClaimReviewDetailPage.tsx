import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';

// Mock data for the claim being reviewed - replace with API call
const mockClaimToReview = {
  id: 'claim001',
  creditorName: 'Acme Corp (组织)',
  claim_number: 'CL-2023-001',
  contact: { name: 'John Doe', phone: '13800138000'},
  asserted_details: {
    nature: '货款',
    principal: 120000,
    interest: 30000,
    other: 0,
    total: 150000,
    attachments_doc_id: 'doc_asserted_001' // Placeholder for QuillJS document
  },
  // Approved details would be filled by reviewer or pre-filled if editing
  approved_details: {
    nature: '货款',
    principal: 0,
    interest: 0,
    other: 0,
  },
  audit_status: '待审核', // Could be '已审核', '部分通过', '已驳回'
  // ... other fields from spec
};


const ClaimReviewDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  // TODO: Fetch claim details by ID from API
  const claimData = { ...mockClaimToReview, id }; // Using mock data

  const [approvedNature, setApprovedNature] = useState(claimData.approved_details.nature || claimData.asserted_details.nature);
  const [approvedPrincipal, setApprovedPrincipal] = useState(claimData.approved_details.principal);
  const [approvedInterest, setApprovedInterest] = useState(claimData.approved_details.interest);
  const [approvedOther, setApprovedOther] = useState(claimData.approved_details.other);
  const [auditStatus, setAuditStatus] = useState(''); // Dropdown: '通过', '部分通过', '驳回'
  const [showAuditModal, setShowAuditModal] = useState(false);

  const calculatedApprovedTotal = approvedPrincipal + approvedInterest + approvedOther;

  const handleOpenAuditModal = () => {
    // Pre-fill approved amounts from asserted if not already set by a previous review
    if (claimData.audit_status === '待审核') {
        setApprovedPrincipal(claimData.asserted_details.principal);
        setApprovedInterest(claimData.asserted_details.interest);
        setApprovedOther(claimData.asserted_details.other);
    }
    setShowAuditModal(true);
  };

  const handleSubmitReview = () => {
    // TODO: Validate and submit review data to API
    if (!auditStatus) {
        alert("请选择审核状态");
        return;
    }
    if (window.confirm(`请确认债权金额: ${calculatedApprovedTotal.toLocaleString()} 元后提交。`)) {
      console.log('Submitting review:', {
        claimId: id,
        approvedNature,
        approvedPrincipal,
        approvedInterest,
        approvedOther,
        calculatedApprovedTotal,
        auditStatus,
        // attachments_doc_id for approved documents (if editable)
      });
      alert('审核意见已提交 (模拟)');
      setShowAuditModal(false);
      navigate('/claims');
    }
  };

  return (
    <div className="p-6">
      <div className="mb-4">
        <Link to="/claims" className="text-blue-600 hover:underline">&larr; 返回债权列表</Link>
      </div>
      <h1 className="text-2xl font-semibold text-gray-800 mb-6">审核债权: {claimData.claim_number}</h1>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left: Asserted Claim Info (Fixed) */}
        <div className="lg:w-1/3 bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold text-gray-700 mb-4">主张债权信息</h2>
          <p><strong>债权人:</strong> {claimData.creditorName}</p>
          <p><strong>联系人:</strong> {claimData.contact.name} ({claimData.contact.phone})</p>
          <p><strong>债权性质:</strong> {claimData.asserted_details.nature}</p>
          <p><strong>主张本金:</strong> {claimData.asserted_details.principal.toLocaleString()} 元</p>
          <p><strong>主张利息:</strong> {claimData.asserted_details.interest.toLocaleString()} 元</p>
          <p><strong>主张其他:</strong> {claimData.asserted_details.other.toLocaleString()} 元</p>
          <p className="font-bold mt-2">主张总额: {claimData.asserted_details.total.toLocaleString()} 元</p>
        </div>

        {/* Right: Attachments & Review Area */}
        <div className="lg:w-2/3 bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold text-gray-700 mb-4">申请附件材料</h2>
          <div className="border p-4 rounded bg-gray-50 min-h-[300px] mb-4">
            <p className="text-gray-600">(Placeholder for QuillJS document viewer: {claimData.asserted_details.attachments_doc_id})</p>
            <p className="mt-2 text-sm text-gray-400">
              用户可对段落或文字/图片添加评论。附件材料的变更将自动保存并显示变更记录。
            </p>
          </div>
          {/* TODO: Implement QuillJS editor/viewer with commenting and version history features */}
        </div>
      </div>

      {/* Floating Audit Button */}
      {!showAuditModal && claimData.audit_status === '待审核' && ( // Show button only if pending and modal not open
        <div className="fixed bottom-6 right-6">
          <button
            onClick={handleOpenAuditModal}
            className="px-6 py-3 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors text-lg font-medium"
          >
            审核
          </button>
        </div>
      )}

      {/* Audit Modal/Form */}
      {showAuditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-semibold text-gray-800 mb-6">填写审核意见</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="approvedNature" className="block text-sm font-medium text-gray-700">审核债权性质*</label>
                <input type="text" id="approvedNature" value={approvedNature} onChange={e => setApprovedNature(e.target.value)} required
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"/>
              </div>
              <div>
                <label htmlFor="approvedPrincipal" className="block text-sm font-medium text-gray-700">审核本金 (元)*</label>
                <input type="number" id="approvedPrincipal" value={approvedPrincipal} onChange={e => setApprovedPrincipal(parseFloat(e.target.value) || 0)} required placeholder="0.00"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"/>
              </div>
              <div>
                <label htmlFor="approvedInterest" className="block text-sm font-medium text-gray-700">审核利息 (元)*</label>
                <input type="number" id="approvedInterest" value={approvedInterest} onChange={e => setApprovedInterest(parseFloat(e.target.value) || 0)} required placeholder="0.00"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"/>
              </div>
              <div>
                <label htmlFor="approvedOther" className="block text-sm font-medium text-gray-700">审核其他 (元)</label>
                <input type="number" id="approvedOther" value={approvedOther} onChange={e => setApprovedOther(parseFloat(e.target.value) || 0)} placeholder="0.00"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"/>
              </div>
               <div>
                <label htmlFor="auditStatus" className="block text-sm font-medium text-gray-700">审核状态*</label>
                <select id="auditStatus" value={auditStatus} onChange={e => setAuditStatus(e.target.value)} required
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm">
                  <option value="">选择状态...</option>
                  {/* These statuses should be configurable by admin */}
                  <option value="approved_full">全部通过</option>
                  <option value="approved_partial">部分通过</option>
                  <option value="rejected">驳回</option>
                </select>
              </div>
              {/* Placeholder for approved attachments editor if needed */}
              {/* <div>
                <label className="block text-sm font-medium text-gray-700">审核附件材料 (可选)</label>
                <div className="mt-1 border p-2 rounded h-32 bg-gray-50">QuillJS editor for reviewer's attachments</div>
              </div> */}
            </div>
            <div className="mt-6 text-right">
                <p className="text-xl font-bold text-red-600 mb-4">
                审核认定债权总额: {calculatedApprovedTotal.toLocaleString()} 元
                </p>
            </div>
            <div className="flex justify-end space-x-3 mt-8">
              <button type="button" onClick={() => setShowAuditModal(false)}
                className="px-6 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                取消
              </button>
              <button type="button" onClick={handleSubmitReview}
                className="px-6 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                提交审核
              </button>
            </div>
          </div>
        </div>
      )}
      <p className="mt-8 text-sm text-gray-500">
        债权审核页面。左侧固定展示主张债权信息，右侧展示申请时的附件材料（QuillJS）。
        点击右下角悬浮“审核”按钮弹出审核输入框。
      </p>
    </div>
  );
};

export default ClaimReviewDetailPage;