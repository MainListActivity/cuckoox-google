import React from 'react';
import { Link } from 'react-router-dom';

// Mock data, replace with API call relevant to a selected case
const mockClaims = [
  { id: 'claim001', creditorName: 'Acme Corp (组织)', claim_number: 'CL-2023-001', asserted_total: 150000, approved_total: 145000, auditor: 'Reviewer A', audit_status: '部分通过', audit_time: '2023-04-10' },
  { id: 'claim002', creditorName: 'Jane Smith (个人)', claim_number: 'CL-2023-002', asserted_total: 75000, approved_total: 0, auditor: 'Reviewer B', audit_status: '已驳回', audit_time: '2023-04-12' },
  { id: 'claim003', creditorName: 'Beta LLC (组织)', claim_number: 'CL-2023-003', asserted_total: 220000, approved_total: null, auditor: '', audit_status: '待审核', audit_time: '' },
];

const ClaimListPage: React.FC = () => {
  // TODO: Fetch claims for the selected case from API
  // TODO: Implement claim creation, filtering, pagination, search
  // TODO: Implement "批量驳回"
  return (
    <div className="p-6">
      <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
        <h1 className="text-2xl font-semibold text-gray-800">债权申报与审核</h1>
        <div className="flex items-center space-x-3">
          <input 
            type="text" 
            placeholder="关键字搜索..."
            className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          />
          <button className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors">
            搜索
          </button>
        </div>
        <div className="space-x-3">
            <Link to="/claims/submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">
            创建债权
            </Link>
            <button className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors">
            批量驳回 (选中)
            </button>
        </div>
      </div>
      
      <div className="bg-white shadow-md rounded-lg overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-2 py-3 text-left"><input type="checkbox" className="rounded"/></th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">债权人 (类别)</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">债权编号</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">主张债权总额</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">认定债权总额</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">审核状态</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">审核人</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">审核时间</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {mockClaims.map((claim) => (
              <tr key={claim.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-2 py-4"><input type="checkbox" className="rounded"/></td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{claim.creditorName}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{claim.claim_number}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{claim.asserted_total.toLocaleString()}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{claim.approved_total !== null ? claim.approved_total.toLocaleString() : '-'}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    claim.audit_status === '部分通过' ? 'bg-yellow-100 text-yellow-800' :
                    claim.audit_status === '已驳回' ? 'bg-red-100 text-red-800' :
                    claim.audit_status === '待审核' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {claim.audit_status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{claim.auditor || '-'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{claim.audit_time || '-'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <Link to={`/claims/${claim.id}/review`} className="text-blue-600 hover:text-blue-800">
                    {claim.audit_status === '待审核' ? '审核债权' : '查看详情'}
                  </Link>
                </td>
              </tr>
            ))}
             {mockClaims.length === 0 && (
               <tr>
                <td colSpan={9} className="px-6 py-4 text-center text-sm text-gray-500">暂无债权数据</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-6 text-sm text-gray-500">
        债权申报与审核页面。当案件进入债权申报阶段且用户有权限时，将自动进入此菜单。
        支持创建债权、批量驳回、全文检索、审核债权。附件材料将使用QuillJS进行实时在线编辑。
      </p>
    </div>
  );
};

export default ClaimListPage;