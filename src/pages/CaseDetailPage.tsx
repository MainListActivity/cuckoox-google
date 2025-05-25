import React from 'react';
import { useParams, Link } from 'react-router-dom';

const CaseDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  // TODO: Fetch case details from API using the id
  // For now, placeholder:
  const mockCaseDetail = {
    id: id,
    case_number: `BK-2023-${id?.slice(-3)}`,
    case_lead_name: 'Alice Manager',
    acceptance_date: '2023-01-15',
    current_stage: '债权申报',
    filing_materials_status: '立案材料已提交 (Placeholder for QuillJS document viewer)',
    // Add more fields as per spec
  };

  if (!mockCaseDetail) {
    return <div className="p-6">Case not found.</div>;
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <Link to="/cases" className="text-blue-600 hover:underline">&larr; 返回案件列表</Link>
      </div>
      <h1 className="text-2xl font-semibold text-gray-800 mb-2">案件详情: {mockCaseDetail.case_number}</h1>
      <p className="text-sm text-gray-500 mb-6">案件ID: {mockCaseDetail.id}</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold text-gray-700 mb-4">基本信息</h2>
          <p><strong>案件负责人:</strong> {mockCaseDetail.case_lead_name}</p>
          <p><strong>受理时间:</strong> {mockCaseDetail.acceptance_date}</p>
          <p><strong>当前阶段:</strong> <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">{mockCaseDetail.current_stage}</span></p>
          {/* More case details here */}
          <h3 className="text-lg font-semibold text-gray-700 mt-6 mb-3">时间轴 (Placeholder)</h3>
          <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
            <li>立案: 2023-01-10</li>
            <li>公告: 2023-01-15</li>
            <li>债权申报开始: 2023-02-15</li>
          </ul>
        </div>

        <div className="md:col-span-2 bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold text-gray-700 mb-4">立案材料 (只读)</h2>
          <div className="border p-4 rounded bg-gray-50 min-h-[200px]">
            <p className="text-gray-600">{mockCaseDetail.filing_materials_status}</p>
            <p className="mt-4 text-sm text-gray-400">
              (Content from QuillJS/SurrealDB will be displayed here. Images will be previewed directly. Other files will be downloadable.)
            </p>
          </div>
           {/* Action buttons like '会议纪要', '修改状态' would appear here based on current_stage and user permissions */}
            <div className="mt-6 flex space-x-3">
                <button className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors">
                    填写会议纪要 (条件性显示)
                </button>
                 <button className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 transition-colors">
                    修改状态 (条件性显示)
                </button>
            </div>
        </div>
      </div>
       <p className="mt-8 text-sm text-gray-500">
        此页面将展示案件的详细信息，包括左侧固定的基本信息和时间轴，主区域展示立案材料（使用QuillJS渲染，只读）。
        操作（如修改状态、填写会议纪要）将根据案件阶段和用户权限显示。
      </p>
    </div>
  );
};

export default CaseDetailPage;