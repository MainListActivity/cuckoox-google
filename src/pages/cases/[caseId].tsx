import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useSurreal } from '@/src/contexts/SurrealProvider';
import { RecordId } from 'surrealdb';
import RichTextEditor from '@/src/components/RichTextEditor';
import { Delta } from 'quill/core';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  SvgIcon,
  Tabs, // Added for tab structure
  Tab,   // Added for tab structure
} from '@mui/material';
import {
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
  TimelineOppositeContent, // Optional for aligning text opposite the dot
} from '@mui/lab'; // Import Timeline components
import { 
  mdiArrowLeft, 
  mdiBookOpenOutline, 
  mdiSync, 
  mdiGavel, 
  mdiAccountGroup, 
  mdiCalendarClock,
  mdiBank, // For closing_date
  mdiFileSign, // For restructuring_decision_date, plan_submission_date
  mdiCalendarAlert, // For delayed_plan_submission_date
  mdiAccountMultiplePlus, // For first_creditor_meeting_date
  mdiAccountMultipleCheck, // For second_creditor_meeting_date
} from '@mdi/js'; // Added new icons for timeline

// Import Dialogs
import ModifyCaseStatusDialog, { CaseStatus } from '@/src/components/case/ModifyCaseStatusDialog'; // Corrected path
import MeetingMinutesDialog from '@/src/components/case/MeetingMinutesDialog'; // Corrected path
import type { QuillDelta } from '@/src/components/RichTextEditor'; // Import QuillDelta type
import { useSnackbar } from '@/src/contexts/SnackbarContext'; // Added for showSuccess
import CaseMemberTab from '@/src/components/case/CaseMemberTab'; // Added for Case Member Management

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

interface User {
  id: RecordId;
  name: string;
  email?: string;
}

const CaseDetailPage: React.FC = () => {
  const { t } = useTranslation(); 
  const { id } = useParams<{ id: string }>();
  const { surreal: client, isSuccess: isConnected } = useSurreal();
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
  const [activeTab, setActiveTab] = useState(0); // State for active tab


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
      const currentStage = displayCase.current_stage; // Use displayCase as it's already processed
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
            // Use query instead of select to avoid type issues
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
    details: t('case_detail_no_details') // Schema doesn't have details field
  };

  // Timeline data from case
  const timelineEvents = [
    { date: displayCase.acceptance_date, title: t('timeline_event_case_accepted', '案件受理'), icon: mdiGavel, color: 'primary' as const },
    ...(displayCase.announcement_date ? [{ date: displayCase.announcement_date, title: t('timeline_event_first_announcement', '首次公告'), icon: mdiCalendarClock, color: 'secondary' as const }] : []),
    ...(displayCase.claim_start_date ? [{ date: displayCase.claim_start_date, title: t('timeline_event_claim_submission_start', '债权申报开始'), icon: mdiAccountGroup, color: 'info' as const }] : []),
    ...(displayCase.claim_end_date ? [{ date: displayCase.claim_end_date, title: t('timeline_event_claim_submission_end', '债权申报截止'), icon: mdiAccountGroup, color: 'warning' as const }] : []),
    ...(caseDetail?.first_creditor_meeting_date ? [{ date: new Date(caseDetail.first_creditor_meeting_date).toISOString().split('T')[0], title: t('timeline_event_first_creditor_meeting', '第一次债权人会议'), icon: mdiAccountMultiplePlus, color: 'success' as const }] : []),
    ...(caseDetail?.reorganization_ruling_date ? [{ date: new Date(caseDetail.reorganization_ruling_date).toISOString().split('T')[0], title: t('timeline_event_reorganization_ruling', '重整裁定'), icon: mdiFileSign, color: 'primary' as const }] : []),
    ...(caseDetail?.reorganization_plan_submission_date ? [{ date: new Date(caseDetail.reorganization_plan_submission_date).toISOString().split('T')[0], title: t('timeline_event_reorganization_plan_submission', '重整计划提交'), icon: mdiFileSign, color: 'secondary' as const }] : []),
    ...(caseDetail?.delayed_reorganization_plan_submission_date ? [{ date: new Date(caseDetail.delayed_reorganization_plan_submission_date).toISOString().split('T')[0], title: t('timeline_event_delayed_reorganization_plan_submission', '重整计划延期提交'), icon: mdiCalendarAlert, color: 'warning' as const }] : []),
    ...(caseDetail?.second_creditor_meeting_date ? [{ date: new Date(caseDetail.second_creditor_meeting_date).toISOString().split('T')[0], title: t('timeline_event_second_creditor_meeting', '第二次债权人会议'), icon: mdiAccountMultipleCheck, color: 'success' as const }] : []),
    ...(caseDetail?.closing_date ? [{ date: new Date(caseDetail.closing_date).toISOString().split('T')[0], title: t('timeline_event_closing_date', '案件办结'), icon: mdiBank, color: 'info' as const }] : []),
  ]
  .filter(event => event.date && event.date !== t('case_detail_date_unknown'))
  .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());


  return (
    <Box sx={{ p: 3 }}>
      <Button component={Link} to="/cases" startIcon={<SvgIcon><path d={mdiArrowLeft} /></SvgIcon>} sx={{ mb: 2 }}>
        {t('case_detail_back_to_list_link')}
      </Button>
      <Typography variant="h4" component="h1" gutterBottom>
        {t('case_detail_page_title_prefix')}: {displayCase.case_number}
      </Typography>
      <Typography variant="caption" color="text.secondary" display="block" gutterBottom sx={{ mb: 3 }}>
        {t('case_detail_id_label')}: {displayCase.id}
      </Typography>

      <Grid container spacing={3}>
        {/* Left Column: Basic Info & Timeline */}
        <Grid size={{ xs: 12, lg: 4 }}>
          <Card sx={{ mb: 3 }}> {/* Basic Info Card */}
            <CardContent>
              <Typography variant="h5" component="h2" gutterBottom borderBottom={1} borderColor="divider" pb={1} mb={2}>
                {t('case_detail_basic_info_title')}
              </Typography>
              <Box sx={{ mb: 1.5 }}>
                <Typography variant="subtitle2" component="span" color="text.secondary" sx={{ fontWeight: 'bold' }}>{t('case_detail_name_label')}: </Typography>
                <Typography variant="body1" component="span">{displayCase.name}</Typography>
              </Box>
              <Box sx={{ mb: 1.5 }}>
                <Typography variant="subtitle2" component="span" color="text.secondary" sx={{ fontWeight: 'bold' }}>{t('case_detail_procedure_label', '案件程序')}: </Typography>
                <Typography variant="body1" component="span">{displayCase.case_procedure}</Typography>
              </Box>
              <Box sx={{ mb: 1.5 }}>
                <Typography variant="subtitle2" component="span" color="text.secondary" sx={{ fontWeight: 'bold' }}>{t('case_detail_lead_label')}: </Typography>
                <Typography variant="body1" component="span">{displayCase.case_lead_name}</Typography>
              </Box>
              <Box sx={{ mb: 1.5 }}>
                <Typography variant="subtitle2" component="span" color="text.secondary" sx={{ fontWeight: 'bold', mr:1 }}>{t('case_detail_current_stage_label')}: </Typography>
                <Chip size="small" label={displayCase.current_stage} color="primary" variant="outlined" />
              </Box>
              <Box sx={{ mb: 1.5 }}>
                <Typography variant="subtitle2" component="span" color="text.secondary" sx={{ fontWeight: 'bold' }}>{t('case_detail_details_label')}: </Typography>
                <Typography variant="body1" component="span" sx={{whiteSpace: 'pre-wrap'}}>{displayCase.details}</Typography>
              </Box>
            </CardContent>
          </Card>

          <Card> {/* Timeline Card */}
            <CardContent>
              <Typography variant="h5" component="h2" gutterBottom borderBottom={1} borderColor="divider" pb={1} mb={2}>
                {t('case_detail_timeline_title_key_dates', '关键时间点')}
              </Typography>
              {timelineEvents.length > 0 ? (
                <Timeline position="right" sx={{ // Changed to "right" to avoid opposite content overlap issues on small screens
                  // Remove padding to use full width
                  '& .MuiTimelineItem-root:before': {
                    flex: 0,
                    padding: 0,
                  },
                }}>
                  {timelineEvents.map((event, index) => (
                    <TimelineItem key={index}>
                      <TimelineOppositeContent sx={{ display: { xs: 'none', sm: 'block' }, m: 'auto 0' }} align="right" variant="body2" color="text.secondary">
                        {event.date}
                      </TimelineOppositeContent>
                      <TimelineSeparator>
                        <TimelineConnector sx={{ bgcolor: `${event.color}.main` }}/>
                        <TimelineDot color={event.color as "primary" | "secondary" | "error" | "info" | "success" | "warning" | "grey"} variant="outlined">
                           <SvgIcon fontSize="small"><path d={event.icon} /></SvgIcon>
                        </TimelineDot>
                        {index < timelineEvents.length - 1 && <TimelineConnector sx={{ bgcolor: `${event.color}.main` }}/>}
                      </TimelineSeparator>
                      <TimelineContent sx={{ py: '12px', px: 2 }}>
                        <Typography variant="h6" component="span">{event.title}</Typography>
                        <Typography sx={{ display: { xs: 'block', sm: 'none' } }} color="text.secondary">{event.date}</Typography>
                      </TimelineContent>
                    </TimelineItem>
                  ))}
                </Timeline>
              ) : (
                <Typography variant="body2" color="text.secondary">{t('case_detail_no_timeline_events', '暂无关键时间点记录')}</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Right Column: Filing Material & Actions */}
        <Grid size={{ xs: 12, lg: 8 }}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 0 }}>
            <Tabs value={activeTab} onChange={handleTabChange} aria-label="case details tabs">
              <Tab label={t('case_details_tab_main', '案件详情')} />
              <Tab label={t('case_members_tab_label', '案件成员')} />
            </Tabs>
          </Box>

          {/* Main Details Tab Content */}
          {activeTab === 0 && (
            <Card sx={{height: '100%', borderTopLeftRadius:0, borderTopRightRadius:0 }}> {/* Ensure card takes full height of grid item */}
              <CardContent sx={{display: 'flex', flexDirection: 'column', height: '100%', p:3 }}>
                <Typography variant="h5" component="h2" gutterBottom borderBottom={1} borderColor="divider" pb={1} mb={2}>
                  {t('case_detail_filing_material_title')}
                </Typography>
                <Box sx={{
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    p: 1,
                    flexGrow: 1, // Allow editor to grow
                    minHeight: '300px', // Minimum height for editor area
                    display: 'flex', // To make RichTextEditor fill this box
                    flexDirection: 'column',
                    '& .ql-container.ql-snow': { // Target Quill's container
                      flexGrow: 1,
                      display: 'flex',
                      flexDirection: 'column',
                    },
                    '& .ql-editor': { // Target Quill's editor area
                      flexGrow: 1,
                      overflowY: 'auto', // Add scroll to editor if content overflows
                      p: 1, // Ensure padding inside editor
                    },
                    '& .ProseMirror': { backgroundColor: 'transparent', minHeight: '100%', p:1 }
                  }}>
                  <RichTextEditor
                    value={filingMaterialContent}
                    readOnly={true}
                    placeholder={t('case_detail_filing_material_empty')}
                  />
                </Box>
                <Box sx={{ mt: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  {/* // TODO: Access Control - Also check user permission for 'manage_meeting_minutes'. */}
                  { (displayCase.current_stage === '债权人第一次会议' || displayCase.current_stage === '债权人第二次会议') && (
                    <Button
                      variant="contained"
                      color="primary"
                      startIcon={<SvgIcon><path d={mdiBookOpenOutline} /></SvgIcon>}
                      onClick={handleOpenMeetingMinutes}
                    >
                      {t('case_detail_actions_meeting_minutes_button')}
                    </Button>
                  )}
                  {/* // TODO: Access Control - Visibility and enabled state depend on user role and case status. */}
                  <Button 
                    variant="contained" 
                    color="secondary"
                    startIcon={<SvgIcon><path d={mdiSync} /></SvgIcon>}
                    onClick={handleOpenModifyStatus}
                  >
                    {t('case_detail_actions_change_status_button')}
                  </Button>
                </Box>
              </CardContent>
            </Card>
          )}

          {/* Case Members Tab Content */}
          {activeTab === 1 && (
             <Card sx={{height: '100%', borderTopLeftRadius:0, borderTopRightRadius:0 }}>
                <CardContent sx={{p:3}}>
                    <CaseMemberTab
                        caseId={id as string}
                        // currentUserIsOwner and currentUserId props removed
                    />
                </CardContent>
             </Card>
          )}
        </Grid>
      </Grid>

      {/* Dialogs */}
      {caseDetail && (
        <ModifyCaseStatusDialog
          open={modifyStatusOpen}
          onClose={() => setModifyStatusOpen(false)}
          currentCase={{ 
            id: caseDetail.id.toString(), 
            current_status: displayCase.current_stage as CaseStatus,
            // Pass other necessary fields if ModifyCaseStatusDialog requires them
            // e.g. case_procedure: displayCase.case_procedure
          }}
          // onSave={handleSaveStatus} // You would need a save handler here
        />
      )}

      {caseDetail && (
        <MeetingMinutesDialog
          open={meetingMinutesOpen}
          onClose={() => setMeetingMinutesOpen(false)}
          caseInfo={{ 
            caseId: caseDetail.id.toString(), 
            caseName: displayCase.name, // Use displayCase for consistency
            // case_number: displayCase.case_number // if needed by dialog
          }}
          meetingTitle={currentMeetingTitle} // Use state for dynamic title
          existingMinutes={new Delta()} // Placeholder, replace with actual fetched minutes if available
          onSave={handleSaveMeetingMinutes}
        />
      )}

      <Typography variant="caption" color="text.secondary" align="center" display="block" sx={{ mt: 4, fontStyle: 'italic' }}>
        {t('case_detail_footer_info_1')} {t('case_detail_footer_info_2')}
      </Typography>
    </Box>
  );
};

export default CaseDetailPage;
