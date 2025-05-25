import React from 'react';

// Mock data, replace with API call relevant to a selected case
const mockCreditors = [
  { id: 'cred001', type: '组织', name: 'Acme Corp', identifier: '91330100MA2XXXXX1A', contact_person_name: 'John Doe', contact_person_phone: '13800138000' },
  { id: 'cred002', type: '个人', name: 'Jane Smith', identifier: '33010019900101XXXX', contact_person_name: 'Jane Smith', contact_person_phone: '13900139000' },
];

const CreditorListPage: React.FC = () => {
  // TODO: Fetch creditors for the selected case from API
  // TODO: Implement creditor creation, editing, filtering, pagination
  // TODO: Implement "一键打印债权人通知快递单"
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-gray-800">债权人管理</h1>
        <div className="space-x-3">
            <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">
            新增债权人
            </button>
            <button className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors">
            一键打印通知
            </button>
        </div>
      </div>
      
      <div className="bg-white shadow-md rounded-lg overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">类别</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">姓名/名称</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID/统一码</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">联系人</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">联系方式</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {mockCreditors.map((creditor) => (
              <tr key={creditor.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{creditor.type}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{creditor.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{creditor.identifier}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{creditor.contact_person_name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{creditor.contact_person_phone}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button className="text-blue-600 hover:text-blue-800 mr-3">编辑</button>
                  <button className="text-red-600 hover:text-red-800">删除</button>
                </td>
              </tr>
            ))}
            {mockCreditors.length === 0 && (
               <tr>
                <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">暂无债权人数据</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-6 text-sm text-gray-500">
        债权人管理页面。当案件处于立案阶段且用户有权限时，将自动进入此菜单。
        支持录入债权人信息和一键打印债权人通知快递单。
      </p>
    </div>
  );
};

export default CreditorListPage;