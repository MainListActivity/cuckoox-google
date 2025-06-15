import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useSurreal } from '@/src/contexts/SurrealProvider';
import { RecordId } from 'surrealdb';
import RichTextEditor from '@/src/components/RichTextEditor';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Alert,
  SvgIcon,
  Breadcrumbs,
  Paper,
  Grid,
  Chip,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
} from '@mui/material';
import { 
  mdiArrowLeft, 
  mdiBookOpenOutline, 
  mdiSync, 
  mdiGavel, 
  mdiFileDocumentOutline,
  mdiInformation,
  mdiAccount,
  mdiCalendar,
  mdiFileDocument,
  mdiPrinter,
} from '@mdi/js';
import { NavigateNext, Save, Share, Print, MoreVert } from '@mui/icons-material';

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

// 定义扩展区域内容的类型
interface ExtensionAreaContent {
  type: 'case' | 'claim' | 'law' | 'related_docs';
  data: any;
  renderContent?: () => React.ReactNode;
}

const CaseDetailPage: React.FC = () => {
  const { t } = useTranslation(); 
  const { id } = useParams<{ id: string }>();
  const { surreal: client, isSuccess: isConnected } = useSurreal();
  const { user, hasRole } = useAuth();
  const [caseDetail, setCaseDetail] = useState<Case | null>(null);
  const [caseLeadName, setCaseLeadName] = useState<string>('');
  const [filingMaterialContent, setFilingMaterialContent] = useState<QuillDelta | string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { showSuccess, showError } = useSnackbar();

  // State for dialogs
  const [modifyStatusOpen, setModifyStatusOpen] = useState(false);
  const [meetingMinutesOpen, setMeetingMinutesOpen] = useState(false);
  const [currentMeetingTitle, setCurrentMeetingTitle] = useState<string>('');

  // 扩展区域相关状态
  const [currentExtensionTab, setCurrentExtensionTab] = useState('case');
  const [extensionAreaContent, setExtensionAreaContent] = useState<ExtensionAreaContent>({
    type: 'case',
    data: {}
  });
  const [showExtensionArea, setShowExtensionArea] = useState(false);

  // Check if user is admin or has edit permissions
  const isAdmin = user?.github_id === '--admin--';
  const canEdit = isAdmin || hasRole('case_manager') || (caseDetail && caseDetail.created_by_user.toString() === user?.id?.toString());
  const isReadOnly = !canEdit;

  // Handler for filing material content change
  const handleFilingMaterialChange = useCallback((newContent: QuillDelta) => {
    if (!isReadOnly) {
      console.log('Filing material content changed:', newContent);
      setFilingMaterialContent(newContent);
      // TODO: Save the content to the database
    }
  }, [isReadOnly]);

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

  // 创建时间线数据
  const createTimelineData = useCallback(() => {
    if (!caseDetail) return [];
    
    const events = [
      {
        date: caseDetail.acceptance_date ? new Date(caseDetail.acceptance_date).toISOString().split('T')[0] : '',
        title: '案件受理',
        description: '法院正式受理破产申请',
        status: '已完成'
      }
    ];

    if (caseDetail.announcement_date) {
      events.push({
        date: new Date(caseDetail.announcement_date).toISOString().split('T')[0],
        title: '首次公告',
        description: '发布破产受理公告',
        status: '已完成'
      });
    }

    if (caseDetail.claim_submission_start_date) {
      events.push({
        date: new Date(caseDetail.claim_submission_start_date).toISOString().split('T')[0],
        title: '债权申报开始',
        description: '债权人开始申报债权',
        status: '已完成'
      });
    }

    if (caseDetail.claim_submission_end_date) {
      events.push({
        date: new Date(caseDetail.claim_submission_end_date).toISOString().split('T')[0],
        title: '债权申报截止',
        description: '债权申报期限结束',
        status: new Date() > new Date(caseDetail.claim_submission_end_date) ? '已完成' : '进行中'
      });
    }

    if (caseDetail.first_creditor_meeting_date) {
      events.push({
        date: new Date(caseDetail.first_creditor_meeting_date).toISOString().split('T')[0],
        title: '债权人第一次会议',
        description: '召开第一次债权人会议',
        status: '已完成'
      });
    }

    if (caseDetail.closing_date) {
      events.push({
        date: new Date(caseDetail.closing_date).toISOString().split('T')[0],
        title: '案件办结',
        description: '破产程序终结',
        status: '已完成'
      });
    }

    return events.filter(event => event.date).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [caseDetail]);

  // 创建相关文档数据
  const createRelatedDocsData = useCallback(() => {
    const formatDate = (date: string | Date | undefined) => {
      if (!date) return '2024-01-20';
      if (typeof date === 'string') return date;
      return new Date(date).toISOString().split('T')[0];
    };

    return [
      { id: 'doc1', title: '破产申请书', type: '申请文件', createTime: formatDate(caseDetail?.acceptance_date) },
      { id: 'doc2', title: '债权人名册', type: '债权文件', createTime: '2024-01-25' },
      { id: 'doc3', title: '财产清单', type: '财产文件', createTime: '2024-02-01' },
      { id: 'doc4', title: '第一次债权人会议通知', type: '会议文件', createTime: '2024-02-15' },
    ];
  }, [caseDetail]);

  // 处理扩展区域标签页切换
  const handleExtensionTabChange = useCallback((tabId: string) => {
    setCurrentExtensionTab(tabId);
    
    if (!caseDetail) return;

    // 根据所选标签页更新内容
    switch (tabId) {
      case 'case':
        setExtensionAreaContent({ 
          type: 'case', 
          data: {
            caseNumber: caseDetail.case_number,
            caseName: caseDetail.name,
            stage: caseDetail.procedure_phase,
            court: '广州市中级人民法院', // TODO: 从数据库获取
            administrator: caseLeadName,
            acceptanceDate: caseDetail.acceptance_date ? 
              (typeof caseDetail.acceptance_date === 'string' ? 
                caseDetail.acceptance_date : 
                new Date(caseDetail.acceptance_date).toISOString().split('T')[0]) : 
              '暂无数据',
          }
        });
        break;
             case 'timeline':
         setExtensionAreaContent({ 
           type: 'claim', 
           data: createTimelineData()
         });
         break;
       case 'members':
         setExtensionAreaContent({ 
           type: 'law', 
           data: { caseId: id }
         });
         break;
      case 'related_docs':
        setExtensionAreaContent({ 
          type: 'related_docs', 
          data: createRelatedDocsData()
        });
        break;
      default:
        setExtensionAreaContent({ type: 'case', data: {} });
    }
  }, [caseDetail, caseLeadName, id, createTimelineData, createRelatedDocsData]);

  // 扩展区域标签页定义
  const extensionAreaTabs = [
    { id: 'case', label: '案件信息', icon: mdiInformation },
    { id: 'timeline', label: '案件时间线', icon: mdiCalendar },
    { id: 'members', label: '案件成员', icon: mdiAccount },
    { id: 'related_docs', label: '相关文档', icon: mdiFileDocument },
  ];

  // 自定义渲染案件信息的内容
  const renderCaseInfo = useCallback(() => {
    const data = extensionAreaContent.data;
    return (
      <Box sx={{ p: 2, boxSizing: 'border-box' }}>
        <Grid container spacing={3}>
          <Grid size={4}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>案件编号</Typography>
              <Typography variant="body2" color="text.secondary">{data.caseNumber || '暂无数据'}</Typography>
            </Paper>
          </Grid>
          <Grid size={4}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>案件名称</Typography>
              <Typography variant="body2" color="text.secondary">{data.caseName || '暂无数据'}</Typography>
            </Paper>
          </Grid>
          <Grid size={4}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>当前阶段</Typography>
              <Typography variant="body2" color="text.secondary">{data.stage || '暂无数据'}</Typography>
            </Paper>
          </Grid>
          <Grid size={4}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>受理法院</Typography>
              <Typography variant="body2" color="text.secondary">{data.court || '暂无数据'}</Typography>
            </Paper>
          </Grid>
          <Grid size={4}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>管理人</Typography>
              <Typography variant="body2" color="text.secondary">{data.administrator || '暂无数据'}</Typography>
            </Paper>
          </Grid>
          <Grid size={4}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>受理日期</Typography>
              <Typography variant="body2" color="text.secondary">{data.acceptanceDate || '暂无数据'}</Typography>
            </Paper>
          </Grid>
        </Grid>
      </Box>
    );
  }, [extensionAreaContent.data]);

  // 自定义渲染时间线的内容
  const renderTimelineInfo = useCallback(() => {
    const data = extensionAreaContent.data;
    return (
      <Box sx={{ p: 2, boxSizing: 'border-box' }}>
        <Typography variant="subtitle1" gutterBottom>案件进展时间线</Typography>
        {data && data.length > 0 ? (
          data.map((event: any, index: number) => (
            <Paper key={index} variant="outlined" sx={{ p: 2, mb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                <Typography variant="subtitle2" gutterBottom>{event.title}</Typography>
                <Chip 
                  label={event.status} 
                  size="small" 
                  color={event.status === '已完成' ? 'success' : 'primary'}
                  sx={{ fontSize: '0.75rem' }}
                />
              </Box>
              <Typography variant="body2" color="text.secondary" paragraph>{event.description}</Typography>
              <Typography variant="caption" color="text.secondary">日期: {event.date}</Typography>
            </Paper>
          ))
        ) : (
          <Box sx={{ p: 2, textAlign: 'center' }}>
            <Typography color="text.secondary">暂无时间线数据</Typography>
          </Box>
        )}
      </Box>
    );
  }, [extensionAreaContent.data]);

  // 自定义渲染案件成员的内容
  const renderMembersInfo = useCallback(() => {
    const data = extensionAreaContent.data;
    return (
      <Box sx={{ p: 2, boxSizing: 'border-box' }}>
        <CaseMemberTab caseId={data.caseId} />
      </Box>
    );
  }, [extensionAreaContent.data]);

  // 自定义渲染相关文档的内容
  const renderRelatedDocs = useCallback(() => {
    const data = extensionAreaContent.data;
    return (
      <Box sx={{ p: 2, boxSizing: 'border-box' }}>
        <Typography variant="subtitle1" gutterBottom>相关文档</Typography>
        {data && data.length > 0 ? (
          <List>
            {data.map((doc: any) => (
              <ListItemButton key={doc.id} sx={{ borderRadius: 1, mb: 1 }}>
                <ListItemText
                  primary={doc.title}
                  secondary={`${doc.type} • ${doc.createTime}`}
                  primaryTypographyProps={{ fontWeight: 500 }}
                />
                                 <IconButton size="small" color="primary">
                   <SvgIcon fontSize="small">
                     <path d={mdiPrinter} />
                   </SvgIcon>
                 </IconButton>
              </ListItemButton>
            ))}
          </List>
        ) : (
          <Box sx={{ p: 2, textAlign: 'center' }}>
            <Typography color="text.secondary">暂无相关文档</Typography>
          </Box>
        )}
      </Box>
    );
  }, [extensionAreaContent.data]);

  // 根据当前选中的标签页渲染相应的内容
  const getExtensionContent = useCallback(() => {
    switch (currentExtensionTab) {
      case 'case':
        return renderCaseInfo();
      case 'timeline':
        return renderTimelineInfo();
      case 'members':
        return renderMembersInfo();
      case 'related_docs':
        return renderRelatedDocs();
      default:
        return null;
    }
  }, [currentExtensionTab, renderCaseInfo, renderTimelineInfo, renderMembersInfo, renderRelatedDocs]);

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
              try {
                // Try to parse as JSON (QuillDelta)
                const parsedContent = JSON.parse(doc.content || '{"ops":[]}');
                setFilingMaterialContent(parsedContent);
              } catch {
                // If not JSON, treat as plain text
                setFilingMaterialContent(doc.content || '');
              }
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

  // 初始化扩展区域内容
  useEffect(() => {
    if (caseDetail) {
      handleExtensionTabChange('case');
    }
  }, [caseDetail, handleExtensionTabChange]);

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
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
      <RichTextEditor 
        defaultValue={filingMaterialContent}
        onTextChange={handleFilingMaterialChange}
        readOnly={isReadOnly}
        placeholder={isReadOnly ? t('case_detail_filing_material_readonly') : t('case_detail_filing_material_empty')}
        documentId={caseDetail?.filing_material_doc_id?.toString()}
        userId={user?.id?.toString()}
        userName={user?.name || user?.email}
        contextInfo={{
          title: displayCase.name,
          subtitle: `${displayCase.case_number} / ${displayCase.case_procedure}`,
          details: [
            { label: '案件编号', value: displayCase.case_number, icon: mdiFileDocumentOutline },
            { label: '负责人', value: displayCase.case_lead_name, icon: mdiAccount },
            { label: '受理日期', value: displayCase.acceptance_date, icon: mdiCalendar },
            { label: '当前阶段', value: displayCase.current_stage, icon: mdiGavel },
          ],
          avatar: {
            text: '案',
            color: '#26A69A' // Teal 300
          }
        }}
                 breadcrumbs={
           <Breadcrumbs separator={<NavigateNext fontSize="small" />} aria-label="breadcrumb">
             <Typography color="inherit" sx={{ cursor: 'pointer' }} onClick={() => window.location.href = '/cases'}>案件管理</Typography>
             <Typography color="text.secondary">{displayCase.case_number}</Typography>
             <Typography color="text.primary">立案材料</Typography>
           </Breadcrumbs>
         }
        actions={
          <>
            {!isReadOnly && (
              <Button 
                startIcon={<Save />} 
                variant="contained" 
                color="primary" 
                size="small"
                onClick={() => {
                  // TODO: Implement save functionality
                  showSuccess('文档已保存');
                }}
              >
                保存
              </Button>
            )}
            <Button startIcon={<Share />} variant="outlined" size="small">分享</Button>
            <IconButton 
              size="small" 
              onClick={() => setShowExtensionArea(!showExtensionArea)}
            >
              <Print />
            </IconButton>
            {(isAdmin || (displayCase.current_stage === '债权人第一次会议' || displayCase.current_stage === '债权人第二次会议')) && (
              <Button
                variant="outlined"
                color="primary"
                size="small"
                startIcon={<SvgIcon><path d={mdiBookOpenOutline} /></SvgIcon>}
                onClick={handleOpenMeetingMinutes}
              >
                {t('case_detail_actions_meeting_minutes_button')}
              </Button>
            )}
            {(isAdmin || hasRole('case_manager')) && displayCase.current_stage !== t('case_status_closed', '结案') && (
              <Button
                variant="outlined"
                color="secondary"
                size="small"
                startIcon={<SvgIcon><path d={mdiSync} /></SvgIcon>}
                onClick={handleOpenModifyStatus}
              >
                {t('case_detail_actions_change_status_button')}
              </Button>
            )}
            <IconButton size="small"><MoreVert /></IconButton>
          </>
        }
        extensionAreaTabs={extensionAreaTabs}
        extensionAreaContent={{
          type: extensionAreaContent.type,
          data: extensionAreaContent.data,
          renderContent: getExtensionContent
        }}
        onExtensionAreaTabChange={handleExtensionTabChange}
        showExtensionArea={showExtensionArea}
      />

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
          existingMinutes={{ ops: [] } as any}
          onSave={handleSaveMeetingMinutes}
        />
      )}
    </Box>
  );
};

export default CaseDetailPage;
