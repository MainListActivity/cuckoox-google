import React from 'react';
import { Link } from 'react-router-dom';
// import RichTextEditor from '../components/RichTextEditor'; // To be used later

const CreateCasePage: React.FC = () => {
  // const [filingMaterial, setFilingMaterial] = useState(''); // To be used later

  return (
    <div className="p-6">
      <div className="mb-6">
        <Link to="/cases" className="text-blue-600 hover:underline">&larr; 返回案件列表</Link>
      </div>
      <h1 className="text-2xl font-semibold text-gray-800 mb-4">创建新案件</h1>
      
      <div className="bg-white p-6 rounded-lg shadow">
        <p className="text-gray-700 mb-2">此页面用于填写新案件的详细信息，包括案件基本情况和立案材料。</p>
        <p className="text-gray-500 text-sm mb-4">(表单字段，如案件名称、案件编号等，将在此处添加)</p>
        
        <h2 className="text-xl font-semibold text-gray-700 mt-6 mb-3">立案材料</h2>
        <p className="text-gray-500 text-sm mb-2">（此处将集成可编辑的 RichTextEditor 用于撰写立案材料）</p>
        {/* 
        // Placeholder for future RichTextEditor integration
        // <RichTextEditor 
        //   value={filingMaterial} 
        //   onChange={setFilingMaterial} 
        //   placeholder="撰写立案材料..."
        // /> 
        */}
        <div className="mt-4 p-4 border rounded min-h-[150px] bg-gray-50">
          [富文本编辑器区域]
        </div>

        <div className="mt-6">
          <button 
            // onClick={handleSaveCase} // To be implemented
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            保存案件 (功能待实现)
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateCasePage;
