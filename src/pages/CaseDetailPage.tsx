import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { db } from '../lib/surreal'; // Corrected path
import { RecordId } from 'surrealdb'; // For typing record IDs
import RichTextEditor from '../components/RichTextEditor'; // IMPORT RichTextEditor

// Define interfaces based on your SurrealDB schema
interface Case {
  id: RecordId;
  name: string; 
  case_number?: string;
  details?: string; // Added from schema
  status?: string; // Added from schema
  admin_id?: RecordId; // Added from schema
  created_at?: string; // Added from schema
  updated_at?: string; // Added from schema
  // Mock fields that might be added to schema later or sourced differently
  case_lead_name?: string; 
  acceptance_date?: string; 
  current_stage?: string; 
  filing_material_doc_id?: RecordId | null; 
}

interface Document {
  id: RecordId;
  content: string;
  // ... other document fields ...
}

const CaseDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [caseDetail, setCaseDetail] = useState<Case | null>(null);
  const [filingMaterialContent, setFilingMaterialContent] = useState<string>(''); // Default to empty string
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError('未提供案件ID。'); // Chinese: No case ID provided.
      setIsLoading(false);
      return;
    }

    const fetchCaseDetails = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const caseRecordId = id.startsWith('case:') ? id : `case:${id}`;
        const result: Case[] = await db.select(caseRecordId);
        
        if (result.length === 0 || !result[0]) {
          setError('案件未找到。'); // Chinese: Case not found.
          setCaseDetail(null);
          setIsLoading(false);
          return;
        }
        const fetchedCase = result[0];
        setCaseDetail(fetchedCase);

        if (fetchedCase.filing_material_doc_id) {
          const docId = fetchedCase.filing_material_doc_id.toString();
          // Ensure docId has a prefix if it's just a UUID, e.g., `document:${docId}`
          // Assuming the stored ID is already a full RecordId string like "document:xxxx"
          const docResult: Document[] = await db.select(docId); 
          if (docResult.length > 0 && docResult[0]) {
            setFilingMaterialContent(docResult[0].content);
          } else {
            console.warn(`Filing material document not found for ID: ${docId}`);
            setFilingMaterialContent('（立案材料内容未找到）'); // Chinese: (Filing material content not found)
          }
        } else {
          setFilingMaterialContent('（无关联立案材料文档）'); // Chinese: (No associated filing material document)
        }
      } catch (err) {
        console.error("Error fetching case details:", err);
        setError('获取案件详情失败。请稍后重试。'); // Chinese: Failed to fetch case details. Please try again later.
        setCaseDetail(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCaseDetails();
  }, [id]);

  if (isLoading) {
    return <div className="p-6 text-center">正在加载案件详情...</div>; // Chinese: Loading case details...
  }

  if (error) {
    return <div className="p-6 text-center text-red-500">{error}</div>;
  }

  if (!caseDetail) {
    return <div className="p-6 text-center">未找到指定案件。</div>; // Chinese: Specified case not found.
  }

  // Merge fetched data with any remaining mock data for smoother UI transition
  // Ideally, all these fields would come from `caseDetail` eventually
  const displayCase = {
    name: caseDetail.name || "未命名案件", // Chinese: Unnamed Case
    case_number: caseDetail.case_number || `BK-N/A-${caseDetail.id.toString().slice(caseDetail.id.toString().indexOf(':') + 1).slice(-4)}`,
    id: caseDetail.id.toString(),
    case_lead_name: caseDetail.case_lead_name || '待分配', // Chinese: To be assigned
    acceptance_date: caseDetail.acceptance_date || '日期未知', // Chinese: Date unknown
    current_stage: caseDetail.current_stage || caseDetail.status || '阶段未知', // Chinese: Stage unknown (use status if current_stage mock isn't in DB yet)
    filing_materials_status: filingMaterialContent ? '内容已加载' : '无立案材料内容', // Chinese: Content loaded / No filing material content
    details: caseDetail.details || '暂无详细信息。' // Chinese: No details available yet.
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-6">
        <Link to="/cases" className="text-blue-600 hover:underline">&larr; 返回案件列表</Link>
      </div>
      <h1 className="text-3xl font-bold text-gray-800 mb-3">案件详情: {displayCase.case_number}</h1>
      <p className="text-sm text-gray-500 mb-8">案件ID: {displayCase.id}</p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Basic Info Section */}
        <div className="lg:col-span-1 bg-white p-6 rounded-xl shadow-lg">
          <h2 className="text-xl font-semibold text-gray-700 mb-4 border-b pb-2">基本信息</h2>
          <dl className="space-y-3">
            <div><dt className="font-medium text-gray-600">案件名称:</dt><dd className="text-gray-800">{displayCase.name}</dd></div>
            <div><dt className="font-medium text-gray-600">案件负责人:</dt><dd className="text-gray-800">{displayCase.case_lead_name}</dd></div>
            <div><dt className="font-medium text-gray-600">受理时间:</dt><dd className="text-gray-800">{displayCase.acceptance_date}</dd></div>
            <div><dt className="font-medium text-gray-600">当前阶段:</dt><dd><span className="px-3 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">{displayCase.current_stage}</span></dd></div>
            <div><dt className="font-medium text-gray-600">案件状态:</dt><dd><span className="px-3 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">{caseDetail.status || '未知'}</span></dd></div>
            <div><dt className="font-medium text-gray-600">案件详情:</dt><dd className="text-gray-800 whitespace-pre-wrap">{displayCase.details}</dd></div>
          </dl>
          
          <h3 className="text-lg font-semibold text-gray-700 mt-6 mb-3 border-b pb-2">时间轴 (占位)</h3>
          <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
            <li>立案: 2023-01-10</li>
            <li>公告: 2023-01-15</li>
            <li>债权申报开始: 2023-02-15</li>
          </ul>
        </div>

        {/* Filing Material & Actions Section */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-lg">
          <h2 className="text-xl font-semibold text-gray-700 mb-4 border-b pb-2">立案材料 (只读预览)</h2>
          <div className="border rounded bg-gray-50 min-h-[200px] prose max-w-none editor-container">
            <RichTextEditor
              value={filingMaterialContent}
              onChange={() => {}} // Read-only, so no actual change handling needed
              readOnly={true}
              placeholder="（当前无立案材料内容）" // Placeholder if content is empty
            />
          </div>
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
       <p className="mt-8 text-sm text-gray-500 text-center">
        此页面将展示案件的详细信息，包括左侧固定的基本信息和时间轴，主区域展示立案材料（使用QuillJS渲染，只读）。
        操作（如修改状态、填写会议纪要）将根据案件阶段和用户权限显示。
      </p>
    </div>
  );
};

export default CaseDetailPage;