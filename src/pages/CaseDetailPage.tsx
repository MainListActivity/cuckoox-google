import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { db } from '../lib/surreal'; // Corrected path
import { RecordId } from 'surrealdb'; // For typing record IDs
import RichTextEditor from '../components/RichTextEditor'; // IMPORT RichTextEditor
import { useTranslation } from 'react-i18next'; // <-- IMPORT I18N

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
  const { t } = useTranslation(); // <-- INITIALIZE T
  const { id } = useParams<{ id: string }>();
  const [caseDetail, setCaseDetail] = useState<Case | null>(null);
  const [filingMaterialContent, setFilingMaterialContent] = useState<string>(''); // Default to empty string
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError(t('case_detail_unspecified_case')); // Use a generic "unspecified" key if no ID
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
          setError(t('case_detail_error_not_found'));
          setCaseDetail(null);
          setIsLoading(false);
          return;
        }
        const fetchedCase = result[0];
        setCaseDetail(fetchedCase);

        if (fetchedCase.filing_material_doc_id) {
          const docId = fetchedCase.filing_material_doc_id.toString();
          const docResult: Document[] = await db.select(docId); 
          if (docResult.length > 0 && docResult[0]) {
            setFilingMaterialContent(docResult[0].content);
          } else {
            console.warn(`Filing material document not found for ID: ${docId}`);
            setFilingMaterialContent(t('case_detail_filing_material_not_found'));
          }
        } else {
          setFilingMaterialContent(t('case_detail_no_associated_filing_material'));
        }
      } catch (err) {
        console.error("Error fetching case details:", err);
        setError(t('case_detail_error_fetch_failed'));
        setCaseDetail(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCaseDetails();
  }, [id, t]); // Added t to dependency array

  if (isLoading) {
    return <div className="p-6 text-center">{t('case_detail_loading')}</div>;
  }

  if (error) {
    return <div className="p-6 text-center text-red-500">{error}</div>;
  }

  if (!caseDetail) {
    return <div className="p-6 text-center">{t('case_detail_unspecified_case')}</div>;
  }

  const displayCase = {
    name: caseDetail.name || t('case_detail_unnamed_case'),
    case_number: caseDetail.case_number || `BK-N/A-${caseDetail.id.toString().slice(caseDetail.id.toString().indexOf(':') + 1).slice(-4)}`,
    id: caseDetail.id.toString(),
    case_lead_name: caseDetail.case_lead_name || t('case_detail_to_be_assigned'),
    acceptance_date: caseDetail.acceptance_date || t('case_detail_date_unknown'),
    current_stage: caseDetail.current_stage || caseDetail.status || t('case_detail_stage_unknown'),
    filing_materials_status: filingMaterialContent ? t('case_detail_content_loaded') : t('case_detail_no_filing_material'),
    details: caseDetail.details || t('case_detail_no_details')
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-6">
        <Link to="/cases" className="text-blue-600 hover:underline">&larr; {t('case_detail_back_to_list_link')}</Link>
      </div>
      <h1 className="text-3xl font-bold text-gray-800 mb-3">{t('case_detail_page_title_prefix')}: {displayCase.case_number}</h1>
      <p className="text-sm text-gray-500 mb-8">{t('case_detail_id_label')}: {displayCase.id}</p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Basic Info Section */}
        <div className="lg:col-span-1 bg-white p-6 rounded-xl shadow-lg">
          <h2 className="text-xl font-semibold text-gray-700 mb-4 border-b pb-2">{t('case_detail_basic_info_title')}</h2>
          <dl className="space-y-3">
            <div><dt className="font-medium text-gray-600">{t('case_detail_name_label')}:</dt><dd className="text-gray-800">{displayCase.name}</dd></div>
            <div><dt className="font-medium text-gray-600">{t('case_detail_lead_label')}:</dt><dd className="text-gray-800">{displayCase.case_lead_name}</dd></div>
            <div><dt className="font-medium text-gray-600">{t('case_detail_acceptance_time_label')}:</dt><dd className="text-gray-800">{displayCase.acceptance_date}</dd></div>
            <div><dt className="font-medium text-gray-600">{t('case_detail_current_stage_label')}:</dt><dd><span className="px-3 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">{displayCase.current_stage}</span></dd></div>
            <div><dt className="font-medium text-gray-600">{t('case_detail_status_label')}:</dt><dd><span className="px-3 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">{caseDetail.status || t('case_detail_status_unknown')}</span></dd></div>
            <div><dt className="font-medium text-gray-600">{t('case_detail_details_label')}:</dt><dd className="text-gray-800 whitespace-pre-wrap">{displayCase.details}</dd></div>
          </dl>
          
          <h3 className="text-lg font-semibold text-gray-700 mt-6 mb-3 border-b pb-2">{t('case_detail_timeline_title')}</h3>
          <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
            <li>{t('case_detail_timeline_event1')}</li>
            <li>{t('case_detail_timeline_event2')}</li>
            <li>{t('case_detail_timeline_event3')}</li>
          </ul>
        </div>

        {/* Filing Material & Actions Section */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-lg">
          <h2 className="text-xl font-semibold text-gray-700 mb-4 border-b pb-2">{t('case_detail_filing_material_title')}</h2>
          <div className="border rounded bg-gray-50 min-h-[200px] prose max-w-none editor-container">
            <RichTextEditor
              value={filingMaterialContent}
              onChange={() => {}} // Read-only, so no actual change handling needed
              readOnly={true}
              placeholder={t('case_detail_filing_material_empty')}
            />
          </div>
            <div className="mt-6 flex space-x-3">
                <button className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors">
                    {t('case_detail_actions_meeting_minutes_button')}
                </button>
                 <button className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 transition-colors">
                    {t('case_detail_actions_change_status_button')}
                </button>
            </div>
        </div>
      </div>
       <p className="mt-8 text-sm text-gray-500 text-center">
        {t('case_detail_footer_info_1')}
        {t('case_detail_footer_info_2')}
      </p>
    </div>
  );
};

export default CaseDetailPage;