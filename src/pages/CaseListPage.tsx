import React from 'react';
import { Link } from 'react-router-dom';

// Mock data, replace with API call
const mockCases = [
  { id: 'case001', case_number: 'BK-2023-001', case_lead_name: 'Alice Manager', current_stage: '债权申报', acceptance_date: '2023-01-15' },
  { id: 'case002', case_number: 'BK-2023-002', case_lead_name: 'Bob Admin', current_stage: '立案', acceptance_date: '2023-02-20' },
  { id: 'case003', case_number: 'BK-2023-003', case_lead_name: 'Carol Handler', current_stage: '债权人第一次会议', acceptance_date: '2023-03-10' },
];

const CaseListPage: React.FC = () => {
  // TODO: Fetch cases from API
  // TODO: Implement case creation, filtering, pagination
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-gray-800">案件列表</h1>
        <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">
          创建案件
        </button>
      </div>
      
      <div className="bg-white shadow-md rounded-lg overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">案件编号</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">案件负责人</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">受理时间</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">程序进程</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {mockCases.map((caseItem) => (
              <tr key={caseItem.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{caseItem.case_number}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{caseItem.case_lead_name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{caseItem.acceptance_date}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                    {caseItem.current_stage}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <Link to={`/cases/${caseItem.id}`} className="text-blue-600 hover:text-blue-800 mr-3">查看详情</Link>
                  {/* Add other actions like '修改状态' based on permissions */}
                </td>
              </tr>
            ))}
            {mockCases.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">暂无案件数据</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-6 text-sm text-gray-500">案件管理页面，将包含创建、编辑、查看案件详情、修改案件状态等功能。案件的展示和操作将根据用户权限和案件当前进程进行控制。</p>
    </div>
  );
};

export default CaseListPage;