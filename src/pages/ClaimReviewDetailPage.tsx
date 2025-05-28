import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import RichTextEditor from '../../components/RichTextEditor';
import { useSnackbar } from '../../contexts/SnackbarContext';

// Define a type for the claim data structure for better type safety
interface AssertedDetails {
  nature: string;
  currency: string;
  principal: number;
  interest: number;
  other: number;
  total: number;
  briefDescription: string;
  attachments_content: string;
}

interface ApprovedDetails {
  nature: string | null;
  principal: number | null;
  interest: number | null;
  other: number | null;
}

interface ClaimDataType {
  id: string;
  creditorName: string;
  creditorType: '组织' | '个人';
  creditorId: string;
  claim_number: string;
  contact: { name: string; phone: string; email?: string };
  submissionDate: string;
  asserted_details: AssertedDetails;
  approved_details: ApprovedDetails;
  audit_status: '待审核' | '审核通过' | '部分通过' | '已驳回' | '要求补充材料';
  auditor: string;
  audit_time: string;
  reviewOpinion: string;
  admin_attachments_content?: string; // Content from admin's supplemental RichTextEditor
}

const initialMockClaimData: ClaimDataType = {
  id: 'claim001',
  creditorName: 'Acme Corp',
  creditorType: '组织',
  creditorId: '91310000MA1FL000XQ',
  claim_number: 'CL-2023-001',
  contact: { name: 'John Doe', phone: '13800138000', email: 'john.doe@acme.com' },
  submissionDate: '2023-10-15',
  asserted_details: {
    nature: '货款',
    currency: 'CNY',
    principal: 120000,
    interest: 30000,
    other: 0,
    total: 150000,
    briefDescription: '合同编号 XYZ-2022，供应原材料A，款项逾期未付。',
    attachments_content: `
      <h2>附件材料说明</h2>
      <p>这是债权人提交的关于债权 <strong>CL-2023-001</strong> 的详细说明和附件列表。</p>
      <p>合同文件：<a href="#" target="_blank">Contract_XYZ-2022.pdf</a> (模拟链接)</p>
      <p>相关发票：<a href="#" target="_blank">Invoice_INV001.pdf</a>, <a href="#" target="_blank">Invoice_INV002.pdf</a> (模拟链接)</p>
      <p><em>请注意：以上链接均为模拟，实际应用中应指向真实文件。</em></p>
    `
  },
  approved_details: {
    nature: null,
    principal: null,
    interest: null,
    other: null,
  },
  audit_status: '待审核', 
  auditor: '', 
  audit_time: '', 
  reviewOpinion: '', 
  admin_attachments_content: '',
};


const ClaimReviewDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showSnackbar } = useSnackbar();

  const [claimData, setClaimData] = useState<ClaimDataType>({ ...initialMockClaimData, id: id || initialMockClaimData.id });

  // Modal specific states
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [modalApprovedNature, setModalApprovedNature] = useState<string>('');
  const [modalApprovedPrincipal, setModalApprovedPrincipal] = useState<number | null>(null);
  const [modalApprovedInterest, setModalApprovedInterest] = useState<number | null>(null);
  const [modalApprovedOther, setModalApprovedOther] = useState<number | null>(null);
  const [modalAuditStatus, setModalAuditStatus] = useState<ClaimDataType['audit_status'] | ''>('');
  const [modalReviewOpinion, setModalReviewOpinion] = useState<string>('');
  const [modalAdminSupplementalAttachmentsContent, setModalAdminSupplementalAttachmentsContent] = useState<string>('');
  const [modalErrors, setModalErrors] = useState<Record<string, string>>({});
  
  const [adminInternalNotes, setAdminInternalNotes] = useState(claimData.reviewOpinion || '');

  const calculatedModalApprovedTotal = (modalApprovedPrincipal || 0) + (modalApprovedInterest || 0) + (modalApprovedOther || 0);

  // Styling classes
  const commonLabelClass = "block text-sm font-medium text-gray-700 dark:text-gray-300";
  const commonValueClass = "mt-1 text-sm text-gray-900 dark:text-white";
  const commonSectionTitleClass = "text-xl font-semibold text-gray-800 dark:text-white mb-4";
  const commonInputClass = "mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white dark:placeholder-gray-400";
  const commonButtonClass = "inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800";
  const primaryButtonClass = `${commonButtonClass} text-white bg-blue-600 hover:bg-blue-700 focus:ring-blue-500`;
  const outlineButtonClass = `${commonButtonClass} text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 focus:ring-indigo-500`;
  const disabledButtonClass = `${commonButtonClass} text-gray-400 dark:text-gray-500 bg-gray-200 dark:bg-gray-700 cursor-not-allowed opacity-50`;
  const errorTextClass = "mt-1 text-xs text-red-600 dark:text-red-400";

  const formatCurrencyDisplay = (amount: number | null, currency: string) => {
    if (amount === null) return '-';
    return `${amount.toLocaleString('zh-CN', { style: 'currency', currency: currency })}`;
  };

  const handleOpenAuditModal = () => {
    setModalErrors({});
    if (claimData.audit_status === '待审核' || claimData.approved_details.principal === null) {
        setModalApprovedNature(claimData.asserted_details.nature);
        setModalApprovedPrincipal(claimData.asserted_details.principal);
        setModalApprovedInterest(claimData.asserted_details.interest);
        setModalApprovedOther(claimData.asserted_details.other);
        setModalAuditStatus(''); 
        setModalReviewOpinion(''); 
        setModalAdminSupplementalAttachmentsContent(''); 
    } else {
        setModalApprovedNature(claimData.approved_details.nature || claimData.asserted_details.nature);
        setModalApprovedPrincipal(claimData.approved_details.principal);
        setModalApprovedInterest(claimData.approved_details.interest);
        setModalApprovedOther(claimData.approved_details.other);
        setModalAuditStatus(claimData.audit_status); 
        setModalReviewOpinion(claimData.reviewOpinion);
        setModalAdminSupplementalAttachmentsContent(claimData.admin_attachments_content || '');
    }
    setShowAuditModal(true);
  };

  const validateModalForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!modalApprovedNature) errors.modalApprovedNature = '审核认定债权性质不能为空。';
    if (modalApprovedPrincipal === null || modalApprovedPrincipal < 0) errors.modalApprovedPrincipal = '审核认定本金不能为空且必须大于等于0。';
    if (modalApprovedInterest === null || modalApprovedInterest < 0) errors.modalApprovedInterest = '审核认定利息不能为空且必须大于等于0。';
    if (modalApprovedOther !== null && modalApprovedOther < 0) errors.modalApprovedOther = '审核认定其他费用必须大于等于0（如果填写）。';
    if (!modalAuditStatus) errors.modalAuditStatus = '审核状态不能为空。';
    if (!modalReviewOpinion.trim()) errors.modalReviewOpinion = '审核意见/备注不能为空。';
    setModalErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmitReview = () => {
    if (!validateModalForm()) {
      showSnackbar('请修正审核表单中的错误。', 'error');
      return;
    }

    if (window.confirm(`请再次确认认定的债权金额及信息后提交。\n审核认定债权总额: ${formatCurrencyDisplay(calculatedModalApprovedTotal, claimData.asserted_details.currency)}`)) {
      const updatedClaimData: ClaimDataType = {
        ...claimData,
        approved_details: {
          nature: modalApprovedNature,
          principal: modalApprovedPrincipal,
          interest: modalApprovedInterest,
          other: modalApprovedOther,
        },
        audit_status: modalAuditStatus as ClaimDataType['audit_status'], 
        reviewOpinion: modalReviewOpinion,
        admin_attachments_content: modalAdminSupplementalAttachmentsContent,
        auditor: 'CurrentAdminUser', 
        audit_time: new Date().toISOString().split('T')[0], 
      };
      setClaimData(updatedClaimData); 
      
      showSnackbar('审核意见已提交 (模拟)', 'success');
      setShowAuditModal(false);
      // navigate('/admin/claims'); // Or current page to see updates
    }
  };

  // Effect to update adminInternalNotes if claimData.reviewOpinion changes (e.g., after submission)
  useEffect(() => {
    setAdminInternalNotes(claimData.reviewOpinion || '');
  }, [claimData.reviewOpinion]);

  return (
    <div className="p-4 sm:p-6 bg-gray-100 dark:bg-gray-900 min-h-screen">
      <div className="mb-4">
        <Link to="/admin/claims" className="text-blue-600 hover:underline dark:text-blue-400 dark:hover:text-blue-300">&larr; 返回债权列表</Link>
      </div>
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-6">审核债权: {claimData.claim_number}</h1>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left Panel: Creditor's Submitted Information */}
        <div className="lg:w-1/3 bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <h2 className={commonSectionTitleClass}>债权人申报信息</h2>
          <dl className="space-y-3">
            <div><dt className={commonLabelClass}>债权人:</dt><dd className={commonValueClass}>{claimData.creditorName} ({claimData.creditorType})</dd></div>
            <div><dt className={commonLabelClass}>{claimData.creditorType === '组织' ? '统一社会信用代码:' : '身份证号:'}</dt><dd className={commonValueClass}>{claimData.creditorId}</dd></div>
            <div><dt className={commonLabelClass}>提交日期:</dt><dd className={commonValueClass}>{claimData.submissionDate}</dd></div>
            <hr className="dark:border-gray-600"/>
            <div><dt className={commonLabelClass}>联系人:</dt><dd className={commonValueClass}>{claimData.contact.name}</dd></div>
            <div><dt className={commonLabelClass}>联系电话:</dt><dd className={commonValueClass}>{claimData.contact.phone}</dd></div>
            <div><dt className={commonLabelClass}>联系邮箱:</dt><dd className={commonValueClass}>{claimData.contact.email || '-'}</dd></div>
            <hr className="dark:border-gray-600"/>
            <div><dt className={commonLabelClass}>主张债权性质:</dt><dd className={commonValueClass}>{claimData.asserted_details.nature}</dd></div>
            <div><dt className={commonLabelClass}>币种:</dt><dd className={commonValueClass}>{claimData.asserted_details.currency}</dd></div>
            <div><dt className={commonLabelClass}>主张本金:</dt><dd className={commonValueClass}>{formatCurrencyDisplay(claimData.asserted_details.principal, claimData.asserted_details.currency)}</dd></div>
            <div><dt className={commonLabelClass}>主张利息:</dt><dd className={commonValueClass}>{formatCurrencyDisplay(claimData.asserted_details.interest, claimData.asserted_details.currency)}</dd></div>
            <div><dt className={commonLabelClass}>主张其他费用:</dt><dd className={commonValueClass}>{formatCurrencyDisplay(claimData.asserted_details.other, claimData.asserted_details.currency)}</dd></div>
            <div className="pt-2"><dt className={`${commonLabelClass} font-semibold`}>主张总金额:</dt><dd className={`${commonValueClass} font-semibold text-lg text-blue-600 dark:text-blue-400`}>{formatCurrencyDisplay(claimData.asserted_details.total, claimData.asserted_details.currency)}</dd></div>
            {claimData.asserted_details.briefDescription && (
                <div className="pt-2"><dt className={commonLabelClass}>简要说明:</dt><dd className={`${commonValueClass} whitespace-pre-wrap break-words`}>{claimData.asserted_details.briefDescription}</dd></div>
            )}
            <hr className="dark:border-gray-600"/>
            <h3 className="text-md font-semibold text-gray-700 dark:text-gray-200 pt-2">当前审核状态</h3>
            <div><dt className={commonLabelClass}>状态:</dt><dd className={commonValueClass}>{claimData.audit_status}</dd></div>
            <div><dt className={commonLabelClass}>审核人:</dt><dd className={commonValueClass}>{claimData.auditor || '-'}</dd></div>
            <div><dt className={commonLabelClass}>审核时间:</dt><dd className={commonValueClass}>{claimData.audit_time || '-'}</dd></div>
            <div><dt className={commonLabelClass}>官方审核意见:</dt><dd className={`${commonValueClass} whitespace-pre-wrap break-words`}>{claimData.reviewOpinion || '-'}</dd></div>
             {claimData.admin_attachments_content && (
                <div className="pt-2">
                    <dt className={commonLabelClass}>管理人补充材料:</dt>
                    <dd className={`${commonValueClass} mt-1 p-2 border dark:border-gray-700 rounded-md max-h-48 overflow-y-auto prose prose-sm dark:prose-invert max-w-none`} dangerouslySetInnerHTML={{ __html: claimData.admin_attachments_content }} />
                </div>
            )}
          </dl>
        </div>

        {/* Right Panel: Attachments & Review Area */}
        <div className="lg:w-2/3 space-y-6">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                <div className="flex justify-between items-center mb-4">
                    <h2 className={commonSectionTitleClass}>债权人提交的附件材料</h2>
                    <button className={`${disabledButtonClass} text-xs`} disabled>
                        查看历史版本 (未来功能)
                    </button>
                </div>
                <div className="border border-gray-200 dark:border-gray-700 rounded-md min-h-[250px] p-1 bg-gray-50 dark:bg-gray-900">
                    <RichTextEditor value={claimData.asserted_details.attachments_content} readOnly={true} />
                </div>
            </div>
            
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                <h2 className={commonSectionTitleClass}>管理员内部审核备注</h2>
                <textarea
                    rows={6}
                    value={adminInternalNotes} 
                    onChange={(e) => setAdminInternalNotes(e.target.value)}
                    placeholder="输入内部审核备注，此内容对债权人不可见，且不会随审核意见提交..."
                    className={`${commonInputClass} h-auto`}
                ></textarea>
                 <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">此备注仅为管理员内部记录，不作为官方审核意见的一部分。</p>
            </div>
        </div>
      </div>

      {/* Floating Audit Button */}
      {!showAuditModal && ( 
        <div className="fixed bottom-6 right-6 z-40">
          <button
            onClick={handleOpenAuditModal}
            className={`${primaryButtonClass} px-6 py-3 rounded-full shadow-lg text-lg font-medium flex items-center`}
          >
             <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            {claimData.audit_status === '待审核' ? '开始审核' : '修改审核结果'}
          </button>
        </div>
      )}

      {/* Audit Modal/Form */}
      {showAuditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50 transition-opacity duration-300 ease-in-out">
          <div className="bg-white dark:bg-gray-800 p-6 sm:p-8 rounded-lg shadow-xl w-full max-w-3xl max-h-[95vh] overflow-y-auto transform transition-all duration-300 ease-in-out scale-100">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">填写审核意见与认定金额</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                <div>
                  <label htmlFor="modalApprovedNature" className={`${commonLabelClass} mb-1`}>审核认定债权性质*</label>
                  <select id="modalApprovedNature" value={modalApprovedNature} 
                    onChange={e => { setModalApprovedNature(e.target.value); setModalErrors(p => ({...p, modalApprovedNature: ''}));}} 
                    required
                    className={`${commonInputClass} ${modalErrors.modalApprovedNature ? 'border-red-500 dark:border-red-400' : ''}`}
                  >
                    <option value="">选择性质...</option>
                    <option value="货款">货款</option>
                    <option value="服务费">服务费</option>
                    <option value="劳动报酬">劳动报酬</option>
                    <option value="其他">其他</option>
                  </select>
                  {modalErrors.modalApprovedNature && <p className={errorTextClass}>{modalErrors.modalApprovedNature}</p>}
                </div>
                <div>
                  <label htmlFor="modalAuditStatus" className={`${commonLabelClass} mb-1`}>审核状态*</label>
                  <select id="modalAuditStatus" value={modalAuditStatus} 
                    onChange={e => { setModalAuditStatus(e.target.value as ClaimDataType['audit_status'] | ''); setModalErrors(p => ({...p, modalAuditStatus: ''}));}} 
                    required
                    className={`${commonInputClass} ${modalErrors.modalAuditStatus ? 'border-red-500 dark:border-red-400' : ''}`}
                  >
                    <option value="">选择状态...</option>
                    <option value="审核通过">审核通过</option>
                    <option value="部分通过">部分通过</option>
                    <option value="已驳回">已驳回</option>
                    <option value="要求补充材料">要求补充材料</option>
                  </select>
                  {modalErrors.modalAuditStatus && <p className={errorTextClass}>{modalErrors.modalAuditStatus}</p>}
                </div>
                <div>
                  <label htmlFor="modalApprovedPrincipal" className={`${commonLabelClass} mb-1`}>审核认定本金 ({claimData.asserted_details.currency})*</label>
                  <input type="number" id="modalApprovedPrincipal" value={modalApprovedPrincipal ?? ''} 
                    onChange={e => { setModalApprovedPrincipal(parseFloat(e.target.value) || null); setModalErrors(p => ({...p, modalApprovedPrincipal: ''}));}} 
                    required placeholder="0.00"
                    className={`${commonInputClass} ${modalErrors.modalApprovedPrincipal ? 'border-red-500 dark:border-red-400' : ''}`}
                  />
                  {modalErrors.modalApprovedPrincipal && <p className={errorTextClass}>{modalErrors.modalApprovedPrincipal}</p>}
                </div>
                <div>
                  <label htmlFor="modalApprovedInterest" className={`${commonLabelClass} mb-1`}>审核认定利息 ({claimData.asserted_details.currency})*</label>
                  <input type="number" id="modalApprovedInterest" value={modalApprovedInterest ?? ''} 
                    onChange={e => { setModalApprovedInterest(parseFloat(e.target.value) || null); setModalErrors(p => ({...p, modalApprovedInterest: ''}));}} 
                    required placeholder="0.00"
                    className={`${commonInputClass} ${modalErrors.modalApprovedInterest ? 'border-red-500 dark:border-red-400' : ''}`}
                  />
                  {modalErrors.modalApprovedInterest && <p className={errorTextClass}>{modalErrors.modalApprovedInterest}</p>}
                </div>
                <div className="md:col-span-2">
                  <label htmlFor="modalApprovedOther" className={`${commonLabelClass} mb-1`}>审核认定其他费用 ({claimData.asserted_details.currency})</label>
                  <input type="number" id="modalApprovedOther" value={modalApprovedOther ?? ''} 
                    onChange={e => { setModalApprovedOther(parseFloat(e.target.value) || null); setModalErrors(p => ({...p, modalApprovedOther: ''}));}} 
                    placeholder="0.00"
                    className={`${commonInputClass} ${modalErrors.modalApprovedOther ? 'border-red-500 dark:border-red-400' : ''}`}
                  />
                  {modalErrors.modalApprovedOther && <p className={errorTextClass}>{modalErrors.modalApprovedOther}</p>}
                </div>
              </div>
              <div className="mt-4">
                <label htmlFor="modalReviewOpinion" className={`${commonLabelClass} mb-1`}>审核意见/备注*</label>
                <textarea id="modalReviewOpinion" value={modalReviewOpinion} 
                  onChange={e => { setModalReviewOpinion(e.target.value); setModalErrors(p => ({...p, modalReviewOpinion: ''}));}} 
                  rows={4} required placeholder="请输入官方审核意见和备注..."
                  className={`${commonInputClass} h-auto ${modalErrors.modalReviewOpinion ? 'border-red-500 dark:border-red-400' : ''}`}
                ></textarea>
                {modalErrors.modalReviewOpinion && <p className={errorTextClass}>{modalErrors.modalReviewOpinion}</p>}
              </div>
              <div className="mt-4">
                <label className={`${commonLabelClass} mb-1`}>管理人补充附件材料 (可选)</label>
                <div className="border border-gray-300 dark:border-gray-600 rounded-md min-h-[200px] p-1 bg-white dark:bg-gray-900">
                  <RichTextEditor 
                    value={modalAdminSupplementalAttachmentsContent} 
                    onChange={setModalAdminSupplementalAttachmentsContent} 
                  />
                </div>
              </div>
            </div>
            <div className="mt-6 text-right">
                <p className="text-xl font-bold text-red-600 dark:text-red-400 mb-4">
                审核认定债权总额: {formatCurrencyDisplay(calculatedModalApprovedTotal, claimData.asserted_details.currency)}
                </p>
            </div>
            <div className="mt-8 flex flex-col sm:flex-row sm:justify-end sm:space-x-3 space-y-2 sm:space-y-0">
              <button type="button" onClick={() => setShowAuditModal(false)}
                className={`${outlineButtonClass} w-full sm:w-auto justify-center`}>
                取消
              </button>
              <button type="button" onClick={handleSubmitReview}
                className={`${primaryButtonClass} w-full sm:w-auto justify-center`}>
                提交审核
              </button>
            </div>
          </div>
        </div>
      )}
      <p className="mt-8 text-sm text-gray-500 dark:text-gray-400 text-center">
        管理员审核页面。左侧为债权人申报信息，右侧为附件材料和内部审核备注。
      </p>
    </div>
  );
};

export default ClaimReviewDetailPage;
