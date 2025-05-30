// STYLING: This page currently uses Tailwind CSS. Per 规范.md, consider migration to MUI components.
// TODO: Access Control - This page should only be accessible to users with a 'creditor' role.
// TODO: Access Control - Module access (new submission) should typically be conditional on Case Status being '债权申报'. This check might be done in higher-level routing.
// TODO: Access Control - If loaded with a claimId (for editing): Verify this claimId belongs to the logged-in creditor and is in an editable status ('草稿', '已驳回', '需要补充').
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from '@/src/contexts/SnackbarContext'; // Assuming path is correct
// TODO: import { useAuth } from '@/src/contexts/AuthContext'; // To get logged-in creditor info

const ClaimSubmissionPage: React.FC = () => {
  const navigate = useNavigate();
  const { showSnackbar } = useSnackbar();
  // const { user } = useAuth(); // TODO: Use this to get creditor details

  // Form state
  const [claimNature, setClaimNature] = useState('普通债权');
  const [principal, setPrincipal] = useState('');
  const [interest, setInterest] = useState('');
  const [otherFees, setOtherFees] = useState('');
  const [totalAmount, setTotalAmount] = useState(0);
  const [currency, setCurrency] = useState('CNY');
  const [briefDescription, setBriefDescription] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Calculate total amount
  useEffect(() => {
    const p = parseFloat(principal) || 0;
    const i = parseFloat(interest) || 0;
    const o = parseFloat(otherFees) || 0;
    setTotalAmount(p + i + o);
  }, [principal, interest, otherFees]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    // Claim Info Validation
    if (!claimNature) newErrors.claimNature = '债权性质不能为空';
    if (!principal) {
      newErrors.principal = '本金不能为空';
    } else if (parseFloat(principal) <= 0) {
      newErrors.principal = '本金必须为正数';
    }
    if (!currency) newErrors.currency = '币种不能为空';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validateForm()) {
      showSnackbar('请修正表单中的错误。', 'error');
      return;
    }
    
    const mockClaimId = `CLAIM-${Date.now()}`;
    // TODO: submit data to API
    console.log({
      claimId: mockClaimId, // Added mock claim ID
      claimNature, 
      principal, 
      interest, 
      otherFees, 
      totalAmount, 
      currency, 
      briefDescription
      // TODO: Add logged-in creditor's ID from AuthContext when submitting
      // creditorId: user?.id 
    });
    showSnackbar('债权基本信息已保存。', 'success');
    navigate(`/claim-attachment/${mockClaimId}`); 
  };

  const commonInputClassName = "mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white";
  const commonLabelClassName = "block text-sm font-medium text-gray-700 dark:text-gray-300";
  const errorTextClassName = "mt-1 text-xs text-red-600 dark:text-red-400";

  return (
    <div className="p-4 sm:p-6 bg-white dark:bg-gray-800 rounded-lg shadow min-h-screen">
      <h1 className="text-2xl font-semibold text-gray-800 dark:text-white mb-6">填写债权基本信息</h1>
      
      {/* TODO: Display logged-in creditor's information here from AuthContext */}
      {/* <div className="mb-6 p-4 border rounded-md bg-gray-50 dark:bg-gray-700/50">
        <h2 className="text-lg font-medium text-gray-700 dark:text-gray-200 mb-3">申报人信息 (自动带入)</h2>
        <p>名称: [Logged In Creditor Name]</p>
        <p>ID: [Logged In Creditor ID]</p>
      </div> */}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Claim Information Section */}
        <fieldset className="border p-4 rounded-md dark:border-gray-600">
          <legend className="text-lg font-medium text-gray-700 dark:text-gray-200 px-2">债权基本信息</legend>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 mt-4">
            <div>
              <label htmlFor="claimNature" className={commonLabelClassName}>债权性质 <span className="text-red-500">*</span></label>
              {/* TODO: Fetch claim nature options from backend (admin configured) */}
              <select 
                id="claimNature" 
                value={claimNature} 
                onChange={e => { setClaimNature(e.target.value); setErrors(prev => ({...prev, claimNature: ''})); }} 
                required
                className={`${commonInputClassName} ${errors.claimNature ? 'border-red-500 dark:border-red-400' : ''}`}
              >
                <option value="普通债权">普通债权</option>
                <option value="有财产担保债权">有财产担保债权</option>
                <option value="劳动报酬">劳动报酬</option>
              </select>
             {errors.claimNature && <p className={errorTextClassName}>{errors.claimNature}</p>}
            </div>
            <div>
              <label htmlFor="currency" className={commonLabelClassName}>币种 <span className="text-red-500">*</span></label>
              <select 
                id="currency" 
                value={currency} 
                onChange={e => { setCurrency(e.target.value); setErrors(prev => ({...prev, currency: ''})); }} 
                required
                className={`${commonInputClassName} ${errors.currency ? 'border-red-500 dark:border-red-400' : ''}`}
              >
                <option value="CNY">CNY</option>
                <option value="USD">USD</option>
              </select>
              {errors.currency && <p className={errorTextClassName}>{errors.currency}</p>}
            </div>
            <div>
              <label htmlFor="principal" className={commonLabelClassName}>本金 <span className="text-red-500">*</span></label>
              <input 
                type="number" 
                id="principal" 
                value={principal} 
                onChange={e => { setPrincipal(e.target.value); setErrors(prev => ({...prev, principal: ''})); }} 
                required 
                placeholder="0.00"
                className={`${commonInputClassName} ${errors.principal ? 'border-red-500 dark:border-red-400' : ''}`} 
              />
              {errors.principal && <p className={errorTextClassName}>{errors.principal}</p>}
            </div>
            <div>
              <label htmlFor="interest" className={commonLabelClassName}>利息</label>
              <input type="number" id="interest" value={interest} onChange={e => setInterest(e.target.value)} placeholder="0.00"
                className={commonInputClassName} 
                // No specific validation for interest other than being a number, which input type="number" handles
              />
            </div>
            <div>
              <label htmlFor="otherFees" className={commonLabelClassName}>其他费用</label>
              <input type="number" id="otherFees" value={otherFees} onChange={e => setOtherFees(e.target.value)} placeholder="如违约金、赔偿金等"
                className={commonInputClassName}
                // No specific validation for other fees
              />
            </div>
            <div>
              <label htmlFor="totalAmount" className={commonLabelClassName}>债权总额</label>
              <input type="text" id="totalAmount" value={totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} readOnly
                className={`${commonInputClassName} bg-gray-100 dark:bg-gray-600`} />
            </div>
          </div>
          <div className="mt-4"> {/* Adjusted margin */}
            <label htmlFor="briefDescription" className={commonLabelClassName}>简要说明</label>
            <textarea id="briefDescription" value={briefDescription} onChange={e => setBriefDescription(e.target.value)} rows={4}
              className={`${commonInputClassName} h-auto`} placeholder="（选填）可简要说明债权的形成、担保、诉讼仲裁等情况..."></textarea>
          </div>
        </fieldset>

        {Object.keys(errors).length > 0 && (
          <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-md">
            <p className="text-sm text-red-700 dark:text-red-300">请修正表单中的错误后重试。</p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-3 pt-4">
          <button type="button" onClick={() => navigate(-1)} // Go back to previous page or a specific claims list page
            className="px-6 py-2 border border-gray-300 dark:border-gray-500 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
            取消
          </button>
          <button type="submit"
            className="px-6 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-blue-500 dark:hover:bg-blue-600 disabled:opacity-50"
            // disabled={Object.keys(errors).length > 0} // Optionally disable if there are errors
          >
            保存并下一步（编辑附件）
          </button>
        </div>
      </form>
      <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">
        请确保所有必填项 (<span className="text-red-500">*</span>) 都已正确填写。保存后，将进入附件材料编辑页面。
      </p>
    </div>
  );
};

export default ClaimSubmissionPage;
