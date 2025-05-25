import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const ClaimSubmissionPage: React.FC = () => {
  const navigate = useNavigate();
  // Form state
  const [creditorType, setCreditorType] = useState('organization');
  const [creditorName, setCreditorName] = useState('');
  const [creditorId, setCreditorId] = useState(''); // TIN or National ID
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [claimNature, setClaimNature] = useState('');
  const [principal, setPrincipal] = useState('');
  const [interest, setInterest] = useState('');
  const [otherAmount, setOtherAmount] = useState('');
  // Calculated total
  const totalAmount = (parseFloat(principal) || 0) + (parseFloat(interest) || 0) + (parseFloat(otherAmount) || 0);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // TODO: Validate and submit data to API
    console.log({
      creditorType, creditorName, creditorId, contactName, contactPhone,
      claimNature, principal, interest, otherAmount, totalAmount
    });
    // After successful submission, navigate to attachments editing page (QuillJS)
    // For now, navigate back to claim list or a success message page.
    alert('债权信息已保存 (模拟)。接下来应进入附件材料编辑页面。');
    navigate('/claims'); // Or a specific attachments editor route for the new claim
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <h1 className="text-2xl font-semibold text-gray-800 mb-6">创建债权</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Creditor Information */}
        <fieldset className="border p-4 rounded-md">
          <legend className="text-lg font-medium text-gray-700 px-2">债权人信息</legend>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
            <div>
              <label htmlFor="creditorType" className="block text-sm font-medium text-gray-700">类别</label>
              <select id="creditorType" value={creditorType} onChange={e => setCreditorType(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm">
                <option value="organization">组织</option>
                <option value="individual">个人</option>
              </select>
            </div>
            <div>
              <label htmlFor="creditorName" className="block text-sm font-medium text-gray-700">姓名/名称</label>
              <input type="text" id="creditorName" value={creditorName} onChange={e => setCreditorName(e.target.value)} required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"/>
            </div>
            <div>
              <label htmlFor="creditorId" className="block text-sm font-medium text-gray-700">
                {creditorType === 'organization' ? '统一社会信用代码' : '身份证号'}
              </label>
              <input type="text" id="creditorId" value={creditorId} onChange={e => setCreditorId(e.target.value)} required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"/>
            </div>
          </div>
        </fieldset>

        {/* Contact Information */}
        <fieldset className="border p-4 rounded-md">
          <legend className="text-lg font-medium text-gray-700 px-2">联系人信息</legend>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
            <div>
              <label htmlFor="contactName" className="block text-sm font-medium text-gray-700">联系人姓名</label>
              <input type="text" id="contactName" value={contactName} onChange={e => setContactName(e.target.value)} required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"/>
            </div>
            <div>
              <label htmlFor="contactPhone" className="block text-sm font-medium text-gray-700">联系方式</label>
              <input type="tel" id="contactPhone" value={contactPhone} onChange={e => setContactPhone(e.target.value)} required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"/>
            </div>
          </div>
        </fieldset>
        
        {/* Asserted Claim Information */}
        <fieldset className="border p-4 rounded-md">
          <legend className="text-lg font-medium text-gray-700 px-2">主张债权信息</legend>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
            <div>
              <label htmlFor="claimNature" className="block text-sm font-medium text-gray-700">债权性质</label>
              <input type="text" id="claimNature" value={claimNature} onChange={e => setClaimNature(e.target.value)} required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"/>
            </div>
             <div>
              <label htmlFor="principal" className="block text-sm font-medium text-gray-700">本金 (元)</label>
              <input type="number" id="principal" value={principal} onChange={e => setPrincipal(e.target.value)} required placeholder="0.00"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"/>
            </div>
            <div>
              <label htmlFor="interest" className="block text-sm font-medium text-gray-700">利息 (元)</label>
              <input type="number" id="interest" value={interest} onChange={e => setInterest(e.target.value)} placeholder="0.00"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"/>
            </div>
            <div>
              <label htmlFor="otherAmount" className="block text-sm font-medium text-gray-700">其他 (元)</label>
              <input type="number" id="otherAmount" value={otherAmount} onChange={e => setOtherAmount(e.target.value)} placeholder="0.00"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"/>
            </div>
          </div>
          <div className="mt-4 text-right">
            <p className="text-lg font-semibold text-gray-700">
              主张债权总额: <span className="text-blue-600">{totalAmount.toLocaleString('zh-CN', { style: 'currency', currency: 'CNY' })}</span>
            </p>
          </div>
        </fieldset>

        <div className="flex justify-end space-x-3 pt-4">
          <button type="button" onClick={() => navigate('/claims')}
            className="px-6 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
            取消
          </button>
          <button type="submit"
            className="px-6 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
            保存并编辑附件材料
          </button>
        </div>
      </form>
      <p className="mt-6 text-sm text-gray-500">
        填写债权的基本信息。保存后，将进入附件材料编辑页面（使用QuillJS）。
      </p>
    </div>
  );
};

export default ClaimSubmissionPage;