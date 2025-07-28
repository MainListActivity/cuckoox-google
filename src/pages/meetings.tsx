import React, { useMemo, useState, useEffect } from 'react'; // Added useState, useEffect
import {
  Box,
  Typography,
  Button,
  Chip,
  Paper,
  SvgIcon,
  Link, // Added for clickable links
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Dialog, // Added Dialog
  DialogActions, // Added
  DialogContent, // Added
  DialogTitle, // Added
  TextField, // Added
  Select, // Added
  MenuItem, // Added
  FormControl,
  InputLabel,
  InputAdornment, // Added for search icon
  Card,
  CardContent,
  CardActions,
  Grid,
  alpha,
  useTheme,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search'; // Added search icon

// Import mobile components
import MobileOptimizedLayout from '@/src/components/mobile/MobileOptimizedLayout';
import { useResponsiveLayout } from '@/src/hooks/useResponsiveLayout';
import {
  mdiCalendarPlus,
  mdiInformationOutline,
  mdiVideoOutline,
  mdiFileDocumentOutline,
  mdiPencil,     // Added for Edit action
  mdiCancel,
  mdiPlayCircleOutline,
  mdiAccountGroupOutline, // For attendees icon
} from '@mdi/js';
import { Autocomplete } from '@mui/material'; 
import { useAuth } from '@/src/contexts/AuthContext'; 
import { useCaseStatus, CaseStatus } from '@/src/contexts/CaseStatusContext'; 
import RichTextEditor,{ QuillDelta } from '@/src/components/RichTextEditor'; 
import { Delta } from 'quill/core'; 
import { useSnackbar } from '@/src/contexts/SnackbarContext';
import type { AlertColor } from '@mui/material/Alert';

import { useSurrealClient } from '@/src/contexts/SurrealProvider';
import { Meeting as MeetingData, MeetingAttendee, useLiveMeetings } from '@/src/hooks/useLiveMeetingData'; 
import { useCaseParticipants, Participant } from '@/src/hooks/useCaseParticipants'; 
import type { SurrealWorkerAPI } from '@/src/contexts/SurrealProvider';
import type { SnackbarContextType } from '@/src/contexts/SnackbarContext';

// Extended MeetingFormData to include attendees for the form
type MeetingFormData = Omit<MeetingData, 'id' | 'case_id' | 'status' | 'recording_url' | 'minutes_exist' | 'minutes_delta_json' | 'created_at' | 'updated_at' | 'attendees' | 'attendee_ids'> & {
  attendees: Participant[]; // Use Participant type for form state, as it includes 'group'
};


const defaultMeetingFormData: MeetingFormData = {
  title: '',
  type: '临时会议',
  scheduled_time: '', 
  duration_minutes: 60,
  conference_link: '',
  agenda: '',
  attendees: [], // Initialize attendees
};


const OnlineMeetingPage: React.FC = () => {
  const theme = useTheme();
  const { isMobile } = useResponsiveLayout();
  
  // const [meetings, setMeetings] = useState<MeetingData[]>(initialMockMeetings.map(m => ({...m, duration_minutes: m.duration_minutes || 60, agenda: m.agenda || ''}))); // Replaced by useLiveMeetings
  const [isMeetingFormOpen, setIsMeetingFormOpen] = useState(false);
  const [currentMeeting, setCurrentMeeting] = useState<MeetingData | null>(null); 
  const [formData, setFormData] = useState<MeetingFormData>(defaultMeetingFormData);
  const [isViewMode, setIsViewMode] = useState(false); // Added for view details mode
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false); 
  const [meetingToCancel, setMeetingToCancel] = useState<MeetingData | null>(null); 
  
  const [isMinutesDialogOpen, setIsMinutesDialogOpen] = useState(false); 
  const [currentMeetingForMinutes, setCurrentMeetingForMinutes] = useState<MeetingData | null>(null); 
  const [currentMinutesDelta, setCurrentMinutesDelta] = useState<QuillDelta | null>(null); 
  const [searchTerm, setSearchTerm] = useState(''); 
  const [startDate, setStartDate] = useState<string>(''); // For date range filter
  const [endDate, setEndDate] = useState<string>('');   // For date range filter

  const { user, selectedCaseId, hasRole, isLoading: isAuthLoading } = useAuth(); 
  const { caseStatus, isLoading: isCaseStatusLoading } = useCaseStatus();
  const [client, setClient] = useState<SurrealWorkerAPI | null>(null);

  // Get Surreal client from context
  const contextClient = useSurrealClient();
  
  useEffect(() => {
    if (contextClient) {
      setClient(contextClient);
    }
  }, [contextClient]);
  const { enqueueSnackbar } = useSnackbar();
  
  const liveMeetings = useLiveMeetings(selectedCaseId); 
  const { participants, isLoading: isLoadingParticipants } = useCaseParticipants(selectedCaseId); 

  const filteredMeetings = useMemo(() => {
    return liveMeetings.filter(meeting => {
      // Text search filter
      const lowerSearchTerm = searchTerm.toLowerCase();
      const matchesSearchTerm = !searchTerm ||
        meeting.title.toLowerCase().includes(lowerSearchTerm) ||
        meeting.type.toLowerCase().includes(lowerSearchTerm);

      if (!matchesSearchTerm) return false;

      // Date range filter
      // Assuming meeting.scheduled_time is an ISO string (e.g., "2023-10-26T10:00:00Z")
      // We only care about the date part for comparison with YYYY-MM-DD from date pickers
      const meetingDateStr = meeting.scheduled_time.substring(0, 10); // Extracts "YYYY-MM-DD"

      if (startDate && meetingDateStr < startDate) {
        return false;
      }
      if (endDate && meetingDateStr > endDate) {
        return false;
      }

      return true;
    });
  }, [liveMeetings, searchTerm, startDate, endDate]);

  const canViewModule = useMemo(() => {
    if (!selectedCaseId || !user) return false; // Must have a case selected and user loaded

    const hasRequiredViewRole = hasRole('案件管理人') || hasRole('协办律师') || hasRole('法官') || hasRole('债权人'); // Roles for viewing module
    
    // Corrected list of case statuses where meetings module should be active
    const allowedCaseStatusesForMeetings = [
      "债权人第一次会议", 
      "债权人第二次会议", 
      "破产清算", 
      "重整", 
      "和解"
      // Add other specific statuses from product.md if online meetings are relevant there.
      // For example, if certain preparatory meetings happen before "债权人第一次会议", they could be added.
      // Current list is based on common meeting-heavy stages.
    ];
    // Ensure caseStatus is a string before calling .includes
    const isCorrectCaseStatus = typeof caseStatus === 'string' && allowedCaseStatusesForMeetings.includes(caseStatus);

    return hasRequiredViewRole && isCorrectCaseStatus;
  }, [selectedCaseId, user, hasRole, caseStatus]);

  const canArrangeMeetings = hasRole('案件管理人'); // Primary role for creating/managing meetings
  const canEditMinutes = hasRole('案件管理人') || hasRole('协办律师'); // Example: Allow more roles to edit minutes

  useEffect(() => {
    if (currentMeeting && isMeetingFormOpen) {
      const localScheduledTime = currentMeeting.scheduled_time.includes(' ') || currentMeeting.scheduled_time.includes('Z')
        ? new Date(currentMeeting.scheduled_time.replace(' ', 'T')).toISOString().slice(0, 16)
        : currentMeeting.scheduled_time;
      
      // Populate attendees for editing
      let loadedAttendees: Participant[] = [];
      if (currentMeeting.attendee_ids && participants.length > 0) {
        loadedAttendees = participants.filter(p => currentMeeting.attendee_ids?.includes(p.id as string));
      } else if (currentMeeting.attendees && currentMeeting.attendees.length > 0) {
        // Fallback if full attendee objects are already on currentMeeting (e.g. from a richer fetch)
        // This might require mapping if MeetingAttendee and Participant types differ significantly
        loadedAttendees = currentMeeting.attendees.map(att => ({
          id: att.id,
          name: att.name,
          type: att.type,
          group: att.type === 'user' ? '系统用户' : '债权人'
        }));
      }

      setFormData({
        title: currentMeeting.title,
        type: currentMeeting.type,
        scheduled_time: localScheduledTime,
        duration_minutes: currentMeeting.duration_minutes || 60,
        conference_link: currentMeeting.conference_link,
        agenda: currentMeeting.agenda || '',
        attendees: loadedAttendees,
      });
    } else { // Setting up for a new meeting or if dialog closes
      const now = new Date();
      now.setMinutes(now.getMinutes() - now.getTimezoneOffset()); 
      const defaultScheduledTime = now.toISOString().slice(0, 16);
      setFormData({...defaultMeetingFormData, scheduled_time: defaultScheduledTime, attendees: [] });
    }
  }, [currentMeeting, isMeetingFormOpen, participants]); // Added participants to dependency array for attendee loading


  const handleOpenMeetingForm = (meetingData?: MeetingData, viewMode = false) => {
    setIsViewMode(viewMode);
    if (meetingData) {
      setCurrentMeeting(meetingData); 
    } else {
      setCurrentMeeting(null); 
    }
    setIsMeetingFormOpen(true);
  };

  const handleCloseMeetingForm = () => {
    setIsMeetingFormOpen(false);
    setCurrentMeeting(null);
    // Resetting form data, including attendees
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset()); 
    const defaultScheduledTime = now.toISOString().slice(0, 16);
    setFormData({...defaultMeetingFormData, scheduled_time: defaultScheduledTime, attendees: [] });
    setIsViewMode(false); 
  };

  const handleFormChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | SelectChangeEvent<string>
  ) => {
    const { name, value } = event.target;
    setFormData(prev => ({ ...prev, [name as string]: value }));
  };
  
  const handleSaveMeeting = async () => {
    if (!selectedCaseId || !client) {
      enqueueSnackbar('未选择案件或数据库连接不可用。', 'error' as AlertColor);
      return;
    }
    if (!formData.title || !formData.scheduled_time) {
      enqueueSnackbar('会议名称和计划开始时间不能为空！', { variant: 'warning' });
      return;
    }
    
    const scheduledTimeISO = new Date(formData.scheduled_time).toISOString();
    const currentTimestamp = new Date().toISOString();

    if (currentMeeting && currentMeeting.id) { // Editing existing meeting
      const meetingDataToUpdate = {
        title: formData.title,
        type: formData.type,
        scheduled_time: scheduledTimeISO,
        duration_minutes: formData.duration_minutes ? parseInt(String(formData.duration_minutes), 10) : undefined,
        conference_link: formData.conference_link,
        agenda: formData.agenda,
        attendee_ids: formData.attendees?.map(att => att.id as string) || [], // Save attendee IDs
        updated_at: currentTimestamp,
      };
      try {
        console.log('Attempting to update meeting:', String(currentMeeting.id), meetingDataToUpdate);
        await client.merge(String(currentMeeting.id), meetingDataToUpdate); 
        console.log('Meeting updated successfully');
        enqueueSnackbar('会议已成功更新', 'success');
      } catch (error) {
        console.error('Error updating meeting:', error);
        const msg = error instanceof Error ? error.message : '请查看控制台';
        enqueueSnackbar(`更新会议失败: ${msg}`, 'error');
      }
    } else { // Creating new meeting
      if (!selectedCaseId || !user?.id) {
        enqueueSnackbar('未选择案件或用户信息不完整，无法创建会议。', { variant: 'error' });
        return;
      }
      const meetingDataToCreate = {
        case_id: selectedCaseId,
        title: formData.title,
        type: formData.type,
        scheduled_time: scheduledTimeISO,
        duration_minutes: formData.duration_minutes ? parseInt(String(formData.duration_minutes), 10) : 60,
        conference_link: formData.conference_link,
        agenda: formData.agenda,
        attendee_ids: formData.attendees?.map(att => att.id as string) || [], // Save attendee IDs
        status: '已安排',
        minutes_delta_json: null,
        minutes_exist: false,
        created_by: user.id, 
        created_at: currentTimestamp,
        updated_at: currentTimestamp,
        recording_url: null,
      };
      try {
        console.log('Attempting to create meeting:', meetingDataToCreate);
        await client.create('meeting', meetingDataToCreate);
        console.log('Meeting created successfully');
        enqueueSnackbar('会议已成功创建', 'success');
      } catch (error) {
        console.error('Error creating meeting:', error);
        enqueueSnackbar(`创建会议失败: ${error.message || '请查看控制台'}`, { variant: 'error' });
      }
    }
    handleCloseMeetingForm();
  };

  const handleOpenCancelConfirm = (meeting: MeetingData) => {
    setMeetingToCancel(meeting);
    setIsCancelConfirmOpen(true);
  };

  const handleCloseCancelConfirm = () => {
    setMeetingToCancel(null);
    setIsCancelConfirmOpen(false);
  };

  const handleConfirmCancel = async () => {
    if (meetingToCancel && meetingToCancel.id && client) {
      try {
        console.log('Attempting to cancel meeting:', String(meetingToCancel.id));
        await client.merge(String(meetingToCancel.id), { 
          status: '已取消', 
          updated_at: new Date().toISOString() 
        });
        console.log('Meeting cancelled successfully');
        enqueueSnackbar('会议已成功取消', { variant: 'success' });
      } catch (error) {
        console.error('Error cancelling meeting:', error);
        enqueueSnackbar(`取消会议失败: ${error.message || '请查看控制台'}`, { variant: 'error' });
      }
    }
    handleCloseCancelConfirm();
  };

  const handleOpenMinutesDialog = (meeting: MeetingData) => {
    setCurrentMeetingForMinutes(meeting);
    if (meeting.minutes_delta_json) {
      try {
        const parsedDelta = new Delta(JSON.parse(meeting.minutes_delta_json));
        setCurrentMinutesDelta(parsedDelta);
      } catch (error) {
        console.error("Error parsing minutes Delta JSON:", error);
        setCurrentMinutesDelta(new Delta()); 
      }
    } else {
      setCurrentMinutesDelta(new Delta()); 
    }
    setIsMinutesDialogOpen(true);
  };

  const handleCloseMinutesDialog = () => {
    setIsMinutesDialogOpen(false);
    setCurrentMinutesDelta(null);
    setCurrentMeetingForMinutes(null);
  };

  const handleSaveMinutes = async () => {
    if (currentMeetingForMinutes && currentMeetingForMinutes.id && currentMinutesDelta && client) {
      const deltaJson = JSON.stringify(currentMinutesDelta.ops); 
      try {
        console.log('Attempting to save minutes for meeting:', String(currentMeetingForMinutes.id));
        await client.merge(String(currentMeetingForMinutes.id), { 
          minutes_delta_json: deltaJson, 
          minutes_exist: true, 
          updated_at: new Date().toISOString() 
        });
        console.log('Minutes saved successfully');
        enqueueSnackbar('会议纪要已成功保存', { variant: 'success' });
      } catch (error) {
        console.error('Error saving minutes:', error);
        enqueueSnackbar(`保存会议纪要失败: ${error.message || '请查看控制台'}`, { variant: 'error' });
      }
    }
    handleCloseMinutesDialog();
  };


  // Mobile meeting card renderer
  const renderMobileMeetingCard = (meeting: MeetingData) => {
    const isEditable = (meeting.status === '已安排' || meeting.status === '进行中') && canArrangeMeetings;
    const isCancellable = meeting.status === '已安排' && canArrangeMeetings;

    return (
      <Card key={String(meeting.id)} sx={{ mb: 2, cursor: 'pointer' }}>
        <CardContent sx={{ pb: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
            <Typography variant="h6" fontWeight="600" sx={{ flex: 1, pr: 1 }}>
              {meeting.title}
            </Typography>
            <Chip
              label={meeting.status}
              size="small"
              color={
                meeting.status === '已结束' ? 'default' :
                meeting.status === '已安排' ? 'info' :
                meeting.status === '进行中' ? 'success' :
                meeting.status === '已取消' ? 'error' :
                'default'
              }
              variant={meeting.status === '已结束' || meeting.status === '已取消' ? 'outlined' : 'filled'}
            />
          </Box>

          <Grid container spacing={1} sx={{ mb: 2 }}>
            <Grid size={6}>
              <Typography variant="caption" color="text.secondary" display="block">
                会议类型
              </Typography>
              <Typography variant="body2" fontWeight="500">
                {meeting.type}
              </Typography>
            </Grid>
            <Grid size={6}>
              <Typography variant="caption" color="text.secondary" display="block">
                持续时间
              </Typography>
              <Typography variant="body2" fontWeight="500">
                {meeting.duration_minutes || 'N/A'} 分钟
              </Typography>
            </Grid>
            <Grid size={12}>
              <Typography variant="caption" color="text.secondary" display="block">
                计划时间
              </Typography>
              <Typography variant="body2" fontWeight="500">
                {new Date(meeting.scheduled_time).toLocaleString()}
              </Typography>
            </Grid>
          </Grid>

          {meeting.attendees && meeting.attendees.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" color="text.secondary" display="block">
                参会人员
              </Typography>
              <Typography variant="body2" fontWeight="500">
                <SvgIcon sx={{ fontSize: '1rem', mr: 0.5, verticalAlign: 'middle' }}>
                  <path d={mdiAccountGroupOutline} />
                </SvgIcon>
                {meeting.attendees.length} 人参加
              </Typography>
            </Box>
          )}

          {meeting.agenda && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" color="text.secondary" display="block">
                议程
              </Typography>
              <Typography 
                variant="body2" 
                sx={{ 
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden'
                }}
              >
                {meeting.agenda}
              </Typography>
            </Box>
          )}
        </CardContent>

        <CardActions sx={{ pt: 0, px: 2, pb: 2, flexWrap: 'wrap', gap: 1 }}>
          {meeting.conference_link && (
            <Button
              variant="contained"
              size="small"
              color="primary"
              startIcon={<SvgIcon><path d={mdiPlayCircleOutline} /></SvgIcon>}
              href={meeting.conference_link}
              target="_blank"
              rel="noopener noreferrer"
              sx={{ minHeight: '36px' }}
            >
              进入会议
            </Button>
          )}

          <Button
            variant="outlined"
            size="small"
            startIcon={<SvgIcon><path d={mdiInformationOutline} /></SvgIcon>}
            onClick={() => handleOpenMeetingForm(meeting, true)}
            sx={{ minHeight: '36px' }}
          >
            查看详情
          </Button>

          {isEditable && (
            <Button
              variant="outlined"
              size="small"
              color="primary"
              startIcon={<SvgIcon><path d={mdiPencil} /></SvgIcon>}
              onClick={() => handleOpenMeetingForm(meeting)}
              sx={{ minHeight: '36px' }}
            >
              编辑
            </Button>
          )}

          {isCancellable && (
            <Button
              variant="outlined"
              size="small"
              color="error"
              startIcon={<SvgIcon><path d={mdiCancel} /></SvgIcon>}
              onClick={() => handleOpenCancelConfirm(meeting)}
              sx={{ minHeight: '36px' }}
            >
              取消
            </Button>
          )}

          {(meeting.minutes_exist || canEditMinutes) && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<SvgIcon><path d={mdiFileDocumentOutline} /></SvgIcon>}
              onClick={() => handleOpenMinutesDialog(meeting)}
              sx={{ minHeight: '36px' }}
            >
              {meeting.minutes_exist ? '查看纪要' : '添加纪要'}
            </Button>
          )}

          {meeting.recording_url && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<SvgIcon><path d={mdiVideoOutline} /></SvgIcon>}
              href={meeting.recording_url}
              target="_blank"
              rel="noopener noreferrer"
              sx={{ minHeight: '36px' }}
            >
              查看录像
            </Button>
          )}
        </CardActions>
      </Card>
    );
  };

  // TODO: Remove initialMockMeetings usage once DB is populated.
  if (isAuthLoading || isCaseStatusLoading) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography>加载中...</Typography>
      </Box>
    );
  }

  if (!canViewModule) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography>您无权访问此模块，或当前案件状态不适用在线会议功能。</Typography>
      </Box>
    );
  }

  // Mobile rendering
  if (isMobile) {
    return (
      <MobileOptimizedLayout
        title="在线会议"
        showBackButton={false}
        fabConfig={canArrangeMeetings ? {
          icon: <SvgIcon><path d={mdiCalendarPlus} /></SvgIcon>,
          action: () => handleOpenMeetingForm(),
          ariaLabel: "安排新会议",
        } : undefined}
      >
        <Box sx={{ p: 0 }}>
          {/* Mobile search and filters */}
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', backgroundColor: 'background.paper' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" fontWeight="600">
                在线会议
              </Typography>
              {selectedCaseId && (
                <Typography variant="caption" color="text.secondary">
                  案件: {selectedCaseId.replace(/^case:/, '')}
                </Typography>
              )}
            </Box>
            
            <TextField
              fullWidth
              placeholder="搜索会议名称或类型..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              size="small"
              inputProps={{ 
                style: { fontSize: 16 } // Prevent zoom on iOS
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
              sx={{
                mb: 2,
                '& .MuiOutlinedInput-root': {
                  borderRadius: '20px',
                  minHeight: '44px',
                }
              }}
            />

            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                label="开始日期"
                type="date"
                size="small"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                inputProps={{ 
                  style: { fontSize: 16 } // Prevent zoom on iOS
                }}
                sx={{ 
                  flex: 1,
                  '& .MuiOutlinedInput-root': {
                    minHeight: '44px',
                  }
                }}
              />
              <TextField
                label="结束日期"
                type="date"
                size="small"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                inputProps={{ 
                  style: { fontSize: 16 } // Prevent zoom on iOS
                }}
                sx={{ 
                  flex: 1,
                  '& .MuiOutlinedInput-root': {
                    minHeight: '44px',
                  }
                }}
              />
            </Box>
          </Box>

          {/* Mobile meeting list */}
          <Box sx={{ p: 2 }}>
            {filteredMeetings.length === 0 ? (
              <Box sx={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center', 
                height: '50vh',
                textAlign: 'center'
              }}>
                <SvgIcon sx={{ fontSize: 80, color: 'text.disabled', mb: 2 }}>
                  <path d={mdiCalendarPlus} />
                </SvgIcon>
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  {searchTerm || startDate || endDate ? "未找到匹配的会议" : "暂无会议记录"}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  {searchTerm || startDate || endDate ? "尝试调整搜索条件" : "开始安排第一个会议"}
                </Typography>
                {canArrangeMeetings && !searchTerm && !startDate && !endDate && (
                  <Button
                    variant="contained"
                    startIcon={<SvgIcon><path d={mdiCalendarPlus} /></SvgIcon>}
                    onClick={() => handleOpenMeetingForm()}
                    sx={{ minHeight: '48px', px: 3 }}
                  >
                    安排新会议
                  </Button>
                )}
              </Box>
            ) : (
              <>
                {filteredMeetings.map(renderMobileMeetingCard)}
              </>
            )}
          </Box>
        </Box>
      </MobileOptimizedLayout>
    );
  }

  // Desktop rendering
  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          在线会议 {selectedCaseId ? `(案件: ${selectedCaseId.replace(/^case:/, '')})` : '(请选择案件)'}
        </Typography>
        {canArrangeMeetings && (
          <Button variant="contained" color="primary" startIcon={<SvgIcon><path d={mdiCalendarPlus} /></SvgIcon>} onClick={() => handleOpenMeetingForm()}>
            安排新会议
          </Button>
        )}
      </Box>

      {/* Filter Controls: Search Text and Date Range */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2, mb: 2 }}>
        <TextField
          variant="outlined"
          size="small"
          placeholder="搜索会议名称或类型..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
          sx={{ flexGrow: 1, minWidth: '200px' }}
        />
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <TextField
            label="开始日期"
            type="date"
            size="small"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: '160px' }}
          />
          <TextField
            label="结束日期"
            type="date"
            size="small"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: '160px' }}
          />
        </Box>
      </Box>
      
      {filteredMeetings.length === 0 ? (
        <Paper elevation={1} sx={{ p: 3, textAlign: 'center', mt: 2 }}>
          <Typography color="text.secondary">
            {searchTerm || startDate || endDate ? "未找到匹配的会议记录。" : "当前案件暂无会议记录。"}
          </Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper} sx={{ mt: 2, backgroundColor: (theme) => theme.palette.background.paper }}>
          <Table sx={{ minWidth: 650 }} aria-label="在线会议列表">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold', color: 'text.primary' }}>会议名称</TableCell>
                <TableCell sx={{ fontWeight: 'bold', color: 'text.primary' }}>类型</TableCell>
                <TableCell sx={{ fontWeight: 'bold', color: 'text.primary' }}>计划时间</TableCell>
                <TableCell sx={{ fontWeight: 'bold', color: 'text.primary' }}>状态</TableCell>
                <TableCell sx={{ fontWeight: 'bold', color: 'text.primary' }}>会议链接</TableCell>
                <TableCell sx={{ fontWeight: 'bold', color: 'text.primary', textAlign: 'center' }}>操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredMeetings.map((meeting) => { 
                const isEditable = (meeting.status === '已安排' || meeting.status === '进行中') && canArrangeMeetings;
                const isCancellable = meeting.status === '已安排' && canArrangeMeetings;

                return (
                <TableRow
                  key={String(meeting.id)}
                  sx={{ '&:last-child td, &:last-child th': { border: 0 } , 
                        '&:hover': { backgroundColor: (theme) => alpha(theme.palette.action.hover, 0.08)}
                  }}
                >
                  <TableCell component="th" scope="row" sx={{color: 'text.primary'}}>
                    {meeting.title}
                  </TableCell>
                  <TableCell sx={{color: 'text.secondary'}}>{meeting.type}</TableCell>
                  <TableCell sx={{color: 'text.secondary'}}>{new Date(meeting.scheduled_time).toLocaleString()}</TableCell>
                  <TableCell>
                    <Chip
                      label={meeting.status}
                      size="small"
                      color={
                        meeting.status === '已结束' ? 'default' :
                        meeting.status === '已安排' ? 'info' :
                        meeting.status === '进行中' ? 'success' :
                        meeting.status === '已取消' ? 'error' :
                        'default'
                      }
                      variant={meeting.status === '已结束' || meeting.status === '已取消' ? 'outlined' : 'filled'}
                    />
                  </TableCell>
                  <TableCell>
                    <Link href={meeting.conference_link} target="_blank" rel="noopener noreferrer" sx={{display:'flex', alignItems:'center', color: 'primary.light'}}>
                       <SvgIcon sx={{mr:0.5, fontSize:'1rem'}}><path d={mdiPlayCircleOutline} /></SvgIcon>
                       进入会议
                    </Link>
                  </TableCell>
                  <TableCell sx={{ textAlign: 'center' }}>
                    <Tooltip title="查看详情">
                      {/* Updated onClick to call handleOpenMeetingForm with viewMode = true */}
                      <IconButton size="small" onClick={() => handleOpenMeetingForm(meeting, true)}>
                        <SvgIcon><path d={mdiInformationOutline} /></SvgIcon>
                      </IconButton>
                    </Tooltip>
                    { isEditable && (
                      <Tooltip title="编辑会议">
                        {/* Edit mode call (viewMode is false by default) */}
                        <IconButton size="small" onClick={() => handleOpenMeetingForm(meeting)}> 
                           <SvgIcon><path d={mdiPencil} /></SvgIcon>
                        </IconButton>
                      </Tooltip>
                    )}
                    { isCancellable && (
                       <Tooltip title="取消会议">
                        <IconButton size="small" onClick={() => handleOpenCancelConfirm(meeting)}>
                          <SvgIcon><path d={mdiCancel} /></SvgIcon>
                        </IconButton>
                      </Tooltip>
                    )}
                    { (meeting.minutes_exist || canEditMinutes) && ( 
                      <Tooltip title={meeting.minutes_exist ? "查看/编辑纪要" : "添加纪要"}>
                        <IconButton size="small" onClick={() => handleOpenMinutesDialog(meeting)}>
                          <SvgIcon><path d={mdiFileDocumentOutline} /></SvgIcon>
                        </IconButton>
                      </Tooltip>
                    )}
                    {meeting.recording_url && (
                       <Tooltip title="查看录像">
                        <IconButton size="small" href={meeting.recording_url} target="_blank" rel="noopener noreferrer">
                          <SvgIcon><path d={mdiVideoOutline} /></SvgIcon>
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              )})}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Meeting Form / View Details Dialog */}
      <Dialog 
        open={isMeetingFormOpen} 
        onClose={handleCloseMeetingForm} 
        maxWidth="sm" 
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>
          {isViewMode 
            ? '查看会议详情' 
            : (currentMeeting?.id ? '编辑会议' : '安排新会议')}
        </DialogTitle>
        <DialogContent dividers sx={{pt:2}}>
          {isViewMode && currentMeeting ? (
            // Read-only view
            <Box>
              <Typography variant="subtitle1" gutterBottom><strong>会议名称:</strong> {currentMeeting.title}</Typography>
              <Typography variant="body1" gutterBottom><strong>类型:</strong> {currentMeeting.type}</Typography>
              <Typography variant="body1" gutterBottom><strong>计划时间:</strong> {new Date(currentMeeting.scheduled_time).toLocaleString()}</Typography>
              <Typography variant="body1" gutterBottom><strong>持续时间:</strong> {currentMeeting.duration_minutes || 'N/A'} 分钟</Typography>
              <Typography variant="body1" gutterBottom>
                <strong>状态:</strong> <Chip label={currentMeeting.status} size="small" 
                                        color={
                                          currentMeeting.status === '已结束' ? 'default' :
                                          currentMeeting.status === '已安排' ? 'info' :
                                          currentMeeting.status === '进行中' ? 'success' :
                                          currentMeeting.status === '已取消' ? 'error' :
                                          'default'
                                        }
                                        variant={currentMeeting.status === '已结束' || currentMeeting.status === '已取消' ? 'outlined' : 'filled'}
                                      />
              </Typography>
              {currentMeeting.conference_link && (
                <Typography variant="body1" gutterBottom>
                  <strong>会议链接:</strong> <Link href={currentMeeting.conference_link} target="_blank" rel="noopener noreferrer">{currentMeeting.conference_link}</Link>
                </Typography>
              )}
              {currentMeeting.agenda && (
                <Typography variant="body1" gutterBottom style={{ whiteSpace: 'pre-wrap' }}>
                  <strong>议程:</strong>{'\n'}{currentMeeting.agenda}
                </Typography>
              )}
              <Typography variant="body1" gutterBottom>
                <strong>参会人员:</strong>
                {currentMeeting.attendees && currentMeeting.attendees.length > 0 
                  ? currentMeeting.attendees.map(att => `${att.name} (${att.type === 'user' ? '用户' : '债权人'})`).join('; ')
                  : (currentMeeting.attendee_ids && currentMeeting.attendee_ids.length > 0 && participants.length > 0)
                    ? participants.filter(p => currentMeeting.attendee_ids?.includes(p.id as string))
                        .map(p => `${p.name} (${p.group})`).join('; ')
                    : '无'
                }
              </Typography>
              
              {currentMeeting.minutes_exist ? (
                 <Button 
                    variant="outlined" 
                    size="small" 
                    onClick={() => handleOpenMinutesDialog(currentMeeting)} 
                    startIcon={<SvgIcon><path d={mdiFileDocumentOutline} /></SvgIcon>}
                    sx={{mt:1, mr:1}}
                >
                    查看/编辑会议纪要
                </Button>
              ) : (
                <Typography variant="body1" gutterBottom><strong>会议纪要:</strong> 暂无</Typography>
              )}

              {currentMeeting.recording_url && (
                 <Link href={currentMeeting.recording_url} target="_blank" rel="noopener noreferrer" sx={{display:'inline-flex', alignItems:'center', mt:1}}>
                    <Button 
                        variant="outlined" 
                        size="small" 
                        startIcon={<SvgIcon><path d={mdiVideoOutline} /></SvgIcon>}
                    >
                        查看录像
                    </Button>
                </Link>
              )}
            </Box>
          ) : (
            // Editable form
            <>
              <TextField
                autoFocus
                margin="dense"
                name="title"
                label="会议名称"
                type="text"
                fullWidth
                variant="outlined"
                value={formData.title}
                onChange={handleFormChange}
                required
                inputProps={{ 
                  style: { fontSize: 16 } // Prevent zoom on iOS
                }}
                sx={{
                  mb: 2, 
                  mt: 1,
                  '& .MuiOutlinedInput-root': isMobile ? {
                    minHeight: '44px',
                  } : {}
                }}
                disabled={isViewMode}
              />
              <FormControl fullWidth margin="dense" sx={{mb:2}}>
                <InputLabel id="meeting-type-label">会议类型</InputLabel>
                <Select
                  labelId="meeting-type-label"
                  name="type"
                  value={formData.type}
                  label="会议类型"
                  onChange={handleFormChange as any} 
                  disabled={isViewMode}
                >
                  <MenuItem value="债权人第一次会议">债权人第一次会议</MenuItem>
                  <MenuItem value="债权人第二次会议">债权人第二次会议</MenuItem>
                  <MenuItem value="临时会议">临时会议</MenuItem>
                  <MenuItem value="内部讨论会">内部讨论会</MenuItem>
                  <MenuItem value="其他">其他</MenuItem>
                </Select>
              </FormControl>
               <Autocomplete
                multiple
                id="attendees-select"
                options={participants}
                groupBy={(option) => option.group}
                getOptionLabel={(option) => option.name}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                value={formData.attendees}
                onChange={(_event, newValue) => {
                  setFormData(prev => ({ ...prev, attendees: newValue }));
                }}
                loading={isLoadingParticipants}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    variant="outlined"
                    label="参会人员"
                    placeholder="选择参会人员"
                    margin="dense"
                  />
                )}
                disabled={isViewMode}
                sx={{mb:2}}
              />
              <TextField
                margin="dense"
                name="scheduled_time"
                label="计划开始时间"
                type="datetime-local"
                fullWidth
                variant="outlined"
                value={formData.scheduled_time}
                onChange={handleFormChange}
                InputLabelProps={{ shrink: true }}
                required
                inputProps={{ 
                  style: { fontSize: 16 } // Prevent zoom on iOS
                }}
                sx={{
                  mb: 2,
                  '& .MuiOutlinedInput-root': isMobile ? {
                    minHeight: '44px',
                  } : {}
                }}
                disabled={isViewMode}
              />
              <TextField
                margin="dense"
                name="duration_minutes"
                label="持续时间 (分钟)"
                type="number"
                fullWidth
                variant="outlined"
                value={formData.duration_minutes}
                onChange={handleFormChange}
                inputProps={{ 
                  min: 15,
                  style: { fontSize: 16 } // Prevent zoom on iOS
                }}
                sx={{
                  mb: 2,
                  '& .MuiOutlinedInput-root': isMobile ? {
                    minHeight: '44px',
                  } : {}
                }}
                disabled={isViewMode}
              />
              <TextField
                margin="dense"
                name="conference_link"
                label="会议链接 (URL)"
                type="url"
                fullWidth
                variant="outlined"
                value={formData.conference_link}
                onChange={handleFormChange}
                inputProps={{ 
                  style: { fontSize: 16 } // Prevent zoom on iOS
                }}
                sx={{
                  mb: 2,
                  '& .MuiOutlinedInput-root': isMobile ? {
                    minHeight: '44px',
                  } : {}
                }}
                disabled={isViewMode}
              />
              <TextField
                margin="dense"
                name="agenda"
                label="会议议程"
                type="text"
                fullWidth
                multiline
                rows={isMobile ? 4 : 3}
                variant="outlined"
                value={formData.agenda}
                onChange={handleFormChange}
                inputProps={{ 
                  style: { fontSize: 16 } // Prevent zoom on iOS
                }}
                sx={{
                  '& .MuiOutlinedInput-root': isMobile ? {
                    minHeight: '44px',
                  } : {}
                }}
                disabled={isViewMode}
              />
            </>
          )}
        </DialogContent>
        <DialogActions sx={{p: '16px 24px'}}>
          {isViewMode ? (
            <Button 
              onClick={handleCloseMeetingForm} 
              color="primary" 
              variant="contained"
              sx={isMobile ? { minHeight: '48px', flex: 1 } : {}}
            >
              关闭
            </Button>
          ) : (
            <>
              <Button 
                onClick={handleCloseMeetingForm} 
                color="secondary"
                sx={isMobile ? { minHeight: '48px', flex: 1, mr: 1 } : {}}
              >
                取消
              </Button>
              <Button 
                onClick={handleSaveMeeting} 
                variant="contained" 
                color="primary"
                sx={isMobile ? { minHeight: '48px', flex: 1 } : {}}
              >
                保存
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>

      {/* Cancel Confirmation Dialog */}
      <Dialog
        open={isCancelConfirmOpen}
        onClose={handleCloseCancelConfirm}
        aria-labelledby="cancel-confirm-dialog-title"
        aria-describedby="cancel-confirm-dialog-description"
        fullScreen={isMobile}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle id="cancel-confirm-dialog-title">确认取消会议</DialogTitle>
        <DialogContent>
          <Typography id="cancel-confirm-dialog-description">
            您确定要取消会议 "{meetingToCancel?.title}" 吗? 此操作无法撤销。
          </Typography>
        </DialogContent>
        <DialogActions sx={{p: '16px 24px'}}>
          <Button onClick={handleCloseCancelConfirm}>返回</Button>
          <Button onClick={handleConfirmCancel} color="error" variant="contained">
            确认取消
          </Button>
        </DialogActions>
      </Dialog>

      {/* Meeting Minutes Dialog */}
      <Dialog 
        open={isMinutesDialogOpen} 
        onClose={handleCloseMinutesDialog} 
        maxWidth="md" 
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>会议纪要: {currentMeetingForMinutes?.title || ''}</DialogTitle>
        <DialogContent sx={{minHeight: '50vh', display: 'flex', flexDirection: 'column'}}> 
          {currentMinutesDelta !== null && ( 
            <RichTextEditor
              value={currentMinutesDelta}
              onChange={(newDelta) => setCurrentMinutesDelta(newDelta)}
              readOnly={!canEditMinutes} // Set readOnly based on permission
              sx={{flexGrow: 1, display: 'flex', flexDirection: 'column', '& .ql-container': {flexGrow:1}}}
            />
          )}
        </DialogContent>
        <DialogActions sx={{p: '16px 24px'}}>
          <Button onClick={handleCloseMinutesDialog}>关闭</Button>
          <Button 
            onClick={handleSaveMinutes} 
            variant="contained" 
            color="primary"
            disabled={!canEditMinutes} // Disable save if user cannot edit
          >
            保存纪要
          </Button>
        </DialogActions>
      </Dialog>

      <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
        在线会议列表，提供会议详情、编辑、取消、纪要和录像查看等功能。
        操作权限将根据用户身份和案件程序进程进行控制。
      </Typography>
    </Box>
  );
};

export default OnlineMeetingPage;