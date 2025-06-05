import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useSurreal } from '@/src/contexts/SurrealProvider';
import { RecordId } from 'surrealdb';
import FullscreenRichTextEditor from '@/src/components/FullscreenRichTextEditor';
import DocumentCenterLayout, { CaseInfo, TimelineEvent, Comment } from '@/src/components/DocumentCenterLayout';
import { Delta } from 'quill/core';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Alert,
  SvgIcon,
  Tabs,
  Tab,
} from '@mui/material';
import { 
  mdiArrowLeft, 
  mdiBookOpenOutline, 
  mdiSync, 
  mdiGavel, 
  mdiAccountGroup, 
  mdiCalendarAlert, 
  mdiAccountMultiplePlus, 
  mdiFileSign, 
  mdiFileDocumentOutline,
} from '@mdi/js';

// Import Dialogs
import ModifyCaseStatusDialog, { CaseStatus } from '@/src/components/case/ModifyCaseStatusDialog';
import MeetingMinutesDialog from '@/src/components/case/MeetingMinutesDialog';
import type { QuillDelta } from '@/src/components/RichTextEditor';
import { useSnackbar } from '@/src/contexts/SnackbarContext';
import { useAuth } from '@/src/contexts/AuthContext';
import CaseMemberTab from '@/src/components/case/CaseMemberTab';

// Define interfaces based on your SurrealDB schema
interface Case {
  id: RecordId;
  name: string;
  case_number: string;
  case_manager_name: string;
  case_procedure: string;
  acceptance_date: string;
  procedure_phase: string;
  created_by_user: RecordId;
  case_lead_user_id?: RecordId;
  filing_material_doc_id?: RecordId;
  announcement_date?: string;
  claim_submission_start_date?: string;
  claim_submission_end_date?: string;
  first_creditor_meeting_date?: string;
  second_creditor_meeting_date?: string;
  reorganization_ruling_date?: string;
  reorganization_plan_submission_date?: string;
  delayed_reorganization_plan_submission_date?: string;
  closing_date?: string;
  created_at: string;
  updated_at: string;
}

interface Document {
  id: RecordId;
  content: string;
  original_file_name?: string;
  mime_type?: string;
  created_at: string;
  updated_at: string;
}

// interface User {
//   id: RecordId;
//   name: string;
//   email?: string;
// }

const CaseDetailPage: React.FC = () => {
  const { t } = useTranslation(); 
  const { id } = useParams<{ id: string }>();
  const { surreal: client, isSuccess: isConnected } = useSurreal();
  const { user, hasRole } = useAuth();
  const [caseDetail, setCaseDetail] = useState<Case | null>(null);
  const [caseLeadName, setCaseLeadName] = useState<string>('');
  const [filingMaterialContent, setFilingMaterialContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { showSuccess, showError } = useSnackbar();

  // State for dialogs
  const [modifyStatusOpen, setModifyStatusOpen] = useState(false);
  const [meetingMinutesOpen, setMeetingMinutesOpen] = useState(false);
  const [currentMeetingTitle, setCurrentMeetingTitle] = useState<string>('');
  const [activeTab, setActiveTab] = useState(0);
  const [comments] = useState<Comment[]>([]);

  // Check if user is admin
  const isAdmin = user?.github_id === '--admin--';

  // Handler for filing material content change
  const handleFilingMaterialChange = (newContent: QuillDelta) => {
    // TODO: Save the content to the database
    console.log('Filing material content changed:', newContent);
    // For now, we'll just update the local state
    setFilingMaterialContent(JSON.stringify(newContent));
  };

  // Handlers for dialogs
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleOpenModifyStatus = () => {
    if (caseDetail) {
      setModifyStatusOpen(true);
    }
  };

  const handleOpenMeetingMinutes = () => {
    if (caseDetail) {
      let title = '';
      const currentStage = displayCase.current_stage;
      if (currentStage === '债权人第一次会议') {
        title = t('first_creditors_meeting_minutes_title', '第一次债权人会议纪要');
      } else if (currentStage === '债权人第二次会议') {
        title = t('second_creditors_meeting_minutes_title', '第二次债权人会议纪要');
      } else {
        title = t('meeting_minutes_generic_title', '会议纪要');
      }
      setCurrentMeetingTitle(title);
      setMeetingMinutesOpen(true);
    }
  };
  
  const handleSaveMeetingMinutes = (minutesDelta: QuillDelta, meetingTitle: string) => {
    console.log('Saving Meeting Minutes:');
    console.log('  caseId:', caseDetail?.id.toString());
    console.log('  meetingTitle:', meetingTitle);
    console.log('  minutesContent:', JSON.stringify(minutesDelta.ops));
    
    // TODO: Implement actual API call to save meeting minutes
    showSuccess(t('meeting_minutes_save_success_mock', '会议纪要已（模拟）保存成功！'));
    setMeetingMinutesOpen(false);
  };

  // 创建案件信息数据
  const createCaseInfo = (): CaseInfo | undefined => {
    if (!caseDetail) return undefined;
    
    const displayCase = {
      name: caseDetail.name || t('case_detail_unnamed_case'),
      case_number: caseDetail.case_number || `BK-N/A-${caseDetail.id.toString().slice(caseDetail.id.toString().indexOf(':') + 1).slice(-4)}`,
      case_lead_name: caseLeadName,
      acceptance_date: caseDetail.acceptance_date ? new Date(caseDetail.acceptance_date).toISOString().split('T')[0] : t('case_detail_date_unknown'),
      case_procedure: caseDetail.case_procedure || t('case_detail_procedure_unknown'),
      current_stage: caseDetail.procedure_phase || t('case_detail_stage_unknown'),
    };
    
    return {
      id: caseDetail.id.toString(),
      name: displayCase.name,
      case_number: displayCase.case_number,
      case_lead_name: displayCase.case_lead_name,
      case_procedure: displayCase.case_procedure,
      acceptance_date: displayCase.acceptance_date,
      current_stage: displayCase.current_stage,
      avatar: {
        text: '案',
        color: '#00897B'
      }
    };
  };

  // 创建时间线数据
  const createTimeline = (): TimelineEvent[] => {
    if (!caseDetail) return [];
    
    const events: TimelineEvent[] = [
      {
        date: caseDetail.acceptance_date ? new Date(caseDetail.acceptance_date).toISOString().split('T')[0] : '',
        title: '案件受理',
        icon: mdiGavel,
        color: 'success',
        completed: true
      }
    ];

    if (caseDetail.announcement_date) {
      events.push({
        date: new Date(caseDetail.announcement_date).toISOString().split('T')[0],
        title: '首次公告',
        icon: mdiFileDocumentOutline,
        color: 'success',
        completed: true
      });
    }

    if (caseDetail.claim_submission_start_date) {
      events.push({
        date: new Date(caseDetail.claim_submission_start_date).toISOString().split('T')[0],
        title: '债权申报开始',
        icon: mdiAccountMultiplePlus,
        color: 'info',
        completed: true
      });
    }

    if (caseDetail.claim_submission_end_date) {
      events.push({
        date: new Date(caseDetail.claim_submission_end_date).toISOString().split('T')[0],
        title: '债权申报截止',
        icon: mdiCalendarAlert,
        color: 'warning',
        completed: false
      });
    }

    if (caseDetail.first_creditor_meeting_date) {
      events.push({
        date: new Date(caseDetail.first_creditor_meeting_date).toISOString().split('T')[0],
        title: '债权人第一次会议',
        icon: mdiAccountGroup,
        color: 'primary',
        completed: true
      });
    }

    if (caseDetail.closing_date) {
      events.push({
        date: new Date(caseDetail.closing_date).toISOString().split('T')[0],
        title: '案件办结',
        icon: mdiFileSign,
        color: 'success',
        completed: true
      });
    }

    return events.filter(event => event.date).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  useEffect(() => {
    if (!id || !isConnected) {
      if (!id) {
        setError(t('case_detail_unspecified_case'));
        setIsLoading(false);
      }
      return;
    }

    const fetchCaseDetails = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const caseRecordId = id.startsWith('case:') ? id : `case:${id}`;
        
        // Query case with related user information
        const query = `
          SELECT 
            *,
            case_lead_user_id.name as case_lead_name
          FROM ${caseRecordId}
        `;
        
        const result = await client.query<[Case & { case_lead_name?: string }][]>(query);
        
        if (!result || result.length === 0 || !result[0] || (result[0] as any[]).length === 0) {
          setError(t('case_detail_error_not_found'));
          setCaseDetail(null);
          setIsLoading(false);
          return;
        }
        
        const fetchedCase = result[0][0] as Case & { case_lead_name?: string };
        setCaseDetail(fetchedCase);
        setCaseLeadName(fetchedCase.case_lead_name || fetchedCase.case_manager_name || t('case_detail_to_be_assigned'));

        // Fetch filing material document if exists
        if (fetchedCase.filing_material_doc_id) {
          const docId = fetchedCase.filing_material_doc_id.toString();
          try {
            const docQuery = `SELECT * FROM ${docId}`;
            const docResult = await client.query<[Document[]]>(docQuery);
            
            if (docResult && docResult[0] && docResult[0].length > 0) {
              const doc = docResult[0][0];
              setFilingMaterialContent(doc.content || '');
            } else {
              console.warn(`Filing material document not found for ID: ${docId}`);
              setFilingMaterialContent('');
            }
          } catch (docErr) {
            console.warn(`Error fetching filing material document: ${docErr}`);
            setFilingMaterialContent('');
          }
        } else {
          setFilingMaterialContent('');
        }
      } catch (err) {
        console.error("Error fetching case details:", err);
        setError(t('case_detail_error_fetch_failed'));
        showError(t('case_detail_error_fetch_failed'));
        setCaseDetail(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCaseDetails();
  }, [id, isConnected, client, t, showError]);

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px', p: 3 }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>{t('case_detail_loading')}</Typography>
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error" sx={{ m: 3 }}>{error}</Alert>;
  }

  if (!caseDetail) {
    return <Alert severity="info" sx={{ m: 3 }}>{t('case_detail_unspecified_case')}</Alert>;
  }

  const displayCase = {
    name: caseDetail.name || t('case_detail_unnamed_case'),
    case_number: caseDetail.case_number || `BK-N/A-${caseDetail.id.toString().slice(caseDetail.id.toString().indexOf(':') + 1).slice(-4)}`,
    id: caseDetail.id.toString(),
    case_lead_name: caseLeadName,
    acceptance_date: caseDetail.acceptance_date ? new Date(caseDetail.acceptance_date).toISOString().split('T')[0] : t('case_detail_date_unknown'),
    announcement_date: caseDetail.announcement_date ? new Date(caseDetail.announcement_date).toISOString().split('T')[0] : undefined,
    claim_start_date: caseDetail.claim_submission_start_date ? new Date(caseDetail.claim_submission_start_date).toISOString().split('T')[0] : undefined,
    claim_end_date: caseDetail.claim_submission_end_date ? new Date(caseDetail.claim_submission_end_date).toISOString().split('T')[0] : undefined,
    case_procedure: caseDetail.case_procedure || t('case_detail_procedure_unknown'),
    current_stage: caseDetail.procedure_phase || t('case_detail_stage_unknown'),
    filing_materials_status: filingMaterialContent ? t('case_detail_content_loaded') : t('case_detail_no_filing_material'),
    details: t('case_detail_no_details')
  };



  return (
    <DocumentCenterLayout
      caseInfo={createCaseInfo()}
      timeline={createTimeline()}
      comments={comments}
      showCasePanel={true}
      showCommentPanel={comments.length > 0}
    >
      <Box sx={{ 
        width: '100%',
        maxWidth: 800,
        mx: 'auto',
        mt: 2,
        p: 3,
        backgroundColor: 'background.paper',
        borderRadius: 2,
        boxShadow: 3,
      }}>
        {/* 简化的顶部导航 */}
        <Box sx={{ mb: 3 }}>
          <Button component={Link} to="/cases" startIcon={<SvgIcon><path d={mdiArrowLeft} /></SvgIcon>} size="small">
            {t('case_detail_back_to_list_link')}
          </Button>
        </Box>

        {/* 主要文档编辑区域 */}
        <Box sx={{ 
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}>
          {/* 标签页 */}
          <Box sx={{ 
            borderBottom: 1, 
            borderColor: 'divider', 
            flexShrink: 0,
            mb: 2
          }}>
            <Tabs value={activeTab} onChange={handleTabChange} aria-label="case details tabs">
              <Tab label={t('case_details_tab_main', '立案材料')} />
              <Tab label={t('case_members_tab_label', '案件成员')} />
            </Tabs>
          </Box>

          {/* 标签页内容 */}
          {activeTab === 0 && (
            <Box sx={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
              '& .ql-container.ql-snow': {
                flexGrow: 1,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                border: 'none',
              },
              '& .ql-editor': {
                flexGrow: 1,
                overflowY: 'auto',
                p: 2,
                minHeight: 'calc(100vh - 200px)',
              },
            }}>
              <FullscreenRichTextEditor
                value={filingMaterialContent}
                onChange={handleFilingMaterialChange}
                placeholder={t('case_detail_filing_material_empty')}
                documentId={caseDetail?.filing_material_doc_id?.toString()}
                userId={user?.id?.toString()}
                userName={user?.name || user?.email}
              />
              
              {/* 操作按钮 */}
              <Box sx={{ mt: 3, display: 'flex', gap: 2, flexWrap: 'wrap', flexShrink: 0 }}>
                {(isAdmin || (displayCase.current_stage === '债权人第一次会议' || displayCase.current_stage === '债权人第二次会议')) && (
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={<SvgIcon><path d={mdiBookOpenOutline} /></SvgIcon>}
                    onClick={handleOpenMeetingMinutes}
                  >
                    {t('case_detail_actions_meeting_minutes_button')}
                  </Button>
                )}
                {(isAdmin || hasRole('case_manager')) && displayCase.current_stage !== t('case_status_closed', '结案') && (
                  <Button
                    variant="contained"
                    color="secondary"
                    startIcon={<SvgIcon><path d={mdiSync} /></SvgIcon>}
                    onClick={handleOpenModifyStatus}
                  >
                    {t('case_detail_actions_change_status_button')}
                  </Button>
                )}
              </Box>
            </Box>
          )}

          {/* 案件成员标签页内容 */}
          {activeTab === 1 && (
            <Box sx={{
              flex: 1,
              overflow: 'auto',
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
              p: 3,
            }}>
              <CaseMemberTab caseId={id as string} />
            </Box>
                     )}
        </Box>
      </Box>

      {/* Dialogs */}
      {caseDetail && (
        <ModifyCaseStatusDialog
          open={modifyStatusOpen}
          onClose={() => setModifyStatusOpen(false)}
          currentCase={{ 
            id: caseDetail.id.toString(), 
            current_status: displayCase.current_stage as CaseStatus,
          }}
        />
      )}

      {caseDetail && (
        <MeetingMinutesDialog
          open={meetingMinutesOpen}
          onClose={() => setMeetingMinutesOpen(false)}
          caseInfo={{ 
            caseId: caseDetail.id.toString(), 
            caseName: displayCase.name,
          }}
          meetingTitle={currentMeetingTitle}
          existingMinutes={new Delta()}
          onSave={handleSaveMeetingMinutes}
        />
      )}
    </DocumentCenterLayout>
  );
};

export default CaseDetailPage;
