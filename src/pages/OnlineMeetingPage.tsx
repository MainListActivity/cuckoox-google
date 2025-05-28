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
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search'; // Added search icon
import {
  mdiCalendarPlus,
  mdiInformationOutline,
  mdiVideoOutline,
  mdiFileDocumentOutline,
  mdiPencil,     // Added for Edit action
  mdiCancel,
  mdiPlayCircleOutline,
} from '@mdi/js';
import { useAuth } from '../../contexts/AuthContext'; 
import { useCaseStatus } from '../../contexts/CaseStatusContext'; 
import { RichTextEditor, QuillDelta } from '../../components/RichTextEditor'; // Added
import Delta from 'quill-delta'; // Added

import { useSurrealClient } from '../../contexts/SurrealProvider'; // Added for DB stubs
import { Meeting as MeetingData, useLiveMeetings } from '../../hooks/useLiveMeetingData'; // Import Meeting type and hook

// Define an interface for the meeting object for better type safety
// The Meeting interface is now imported from useLiveMeetingData.ts
// We'll alias it to MeetingFormData for the form to avoid confusion if fields differ slightly.
type MeetingFormData = Omit<MeetingData, 'id' | 'case_id' | 'status' | 'recording_url' | 'minutes_exist' | 'minutes_delta_json' | 'created_at' | 'updated_at'>;


const defaultMeetingFormData: MeetingFormData = {
  title: '',
  type: '临时会议',
  scheduled_time: '', 
  duration_minutes: 60,
  conference_link: '',
  agenda: '',
};


const OnlineMeetingPage: React.FC = () => {
  // const [meetings, setMeetings] = useState<MeetingData[]>(initialMockMeetings.map(m => ({...m, duration_minutes: m.duration_minutes || 60, agenda: m.agenda || ''}))); // Replaced by useLiveMeetings
  const [isMeetingFormOpen, setIsMeetingFormOpen] = useState(false);
  const [currentMeeting, setCurrentMeeting] = useState<MeetingData | null>(null); 
  const [formData, setFormData] = useState<MeetingFormData>(defaultMeetingFormData);
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false); 
  const [meetingToCancel, setMeetingToCancel] = useState<MeetingData | null>(null); 
  
  const [isMinutesDialogOpen, setIsMinutesDialogOpen] = useState(false); 
  const [currentMeetingForMinutes, setCurrentMeetingForMinutes] = useState<MeetingData | null>(null); 
  const [currentMinutesDelta, setCurrentMinutesDelta] = useState<QuillDelta | null>(null); 
  const [searchTerm, setSearchTerm] = useState(''); 

  const { user, selectedCaseId, hasRole, isLoading: isAuthLoading } = useAuth(); 
  const { caseStatus, isLoading: isCaseStatusLoading } = useCaseStatus();
  const { client } = useSurrealClient(); // For DB stubs
  
  const liveMeetings = useLiveMeetings(selectedCaseId); // Use live data hook

  const filteredMeetings = useMemo(() => {
    if (!searchTerm) {
      return liveMeetings; // Use liveMeetings
    }
    const lowerSearchTerm = searchTerm.toLowerCase();
    return liveMeetings.filter(meeting => 
      meeting.title.toLowerCase().includes(lowerSearchTerm) ||
      meeting.type.toLowerCase().includes(lowerSearchTerm)
    );
  }, [liveMeetings, searchTerm]); // Depend on liveMeetings

  const canViewModule = useMemo(() => {
    if (!selectedCaseId || !user) return false; // Must have a case selected and user loaded

    const hasRequiredViewRole = hasRole('案件管理人') || hasRole('协办律师') || hasRole('法官') || hasRole('债权人'); // Added more roles for viewing
    
    const allowedCaseStatusesForMeetings = [
      "债权人第一次会议", 
      "债权人第二次会议", 
      "破产清算", 
      "重整", 
      "和解",
      // Add any other statuses where meetings module should be active
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

      setFormData({
        title: currentMeeting.title,
        type: currentMeeting.type,
        scheduled_time: localScheduledTime,
        duration_minutes: currentMeeting.duration_minutes || 60,
        conference_link: currentMeeting.conference_link,
        agenda: currentMeeting.agenda || '',
      });
    } else {
      const now = new Date();
      now.setMinutes(now.getMinutes() - now.getTimezoneOffset()); 
      const defaultScheduledTime = now.toISOString().slice(0, 16);
      setFormData({...defaultMeetingFormData, scheduled_time: defaultScheduledTime });
    }
  }, [currentMeeting, isMeetingFormOpen]);


  const handleOpenMeetingForm = (meetingToEdit?: MeetingData) => {
    if (meetingToEdit) {
      setCurrentMeeting(meetingToEdit);
    } else {
      setCurrentMeeting(null);
    }
    setIsMeetingFormOpen(true);
  };

  const handleCloseMeetingForm = () => {
    setIsMeetingFormOpen(false);
    setCurrentMeeting(null);
    setFormData(defaultMeetingFormData);
  };

  const handleFormChange = (event: React.ChangeEvent<HTMLInputElement | { name?: string; value: unknown }> | SelectChangeEvent<string>) => {
    const { name, value } = event.target;
    setFormData(prev => ({ ...prev, [name as string]: value }));
  };
  
  const handleSaveMeeting = async () => {
    if (!selectedCaseId || !client) {
      alert('Case ID or Surreal client not available.');
      return;
    }
    if (!formData.title || !formData.scheduled_time) {
      alert('会议名称和计划开始时间不能为空！');
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
        updated_at: currentTimestamp,
        // Note: status is not changed here. It's changed by specific actions like cancel.
      };
      try {
        console.log('Attempting to update meeting:', String(currentMeeting.id), meetingDataToUpdate);
        await client.merge(String(currentMeeting.id), meetingDataToUpdate);
        console.log('Meeting updated successfully');
        // snackbar.enqueueSnackbar('会议已更新', { variant: 'success' }); // Optional
      } catch (error) {
        console.error('Error updating meeting:', error);
        alert('更新会议失败，请查看控制台了解详情。');
        // snackbar.enqueueSnackbar('更新会议失败', { variant: 'error' }); // Optional
      }
    } else { // Creating new meeting
      if (!selectedCaseId || !user?.id) {
        alert('未选择案件或用户信息不完整，无法创建会议。');
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
        status: '已安排',
        minutes_delta_json: null,
        minutes_exist: false,
        created_by: user.id, 
        created_at: currentTimestamp,
        updated_at: currentTimestamp,
        recording_url: null, // Explicitly set null for new meetings
      };
      try {
        console.log('Attempting to create meeting:', meetingDataToCreate);
        await client.create('meeting', meetingDataToCreate);
        console.log('Meeting created successfully');
        // snackbar.enqueueSnackbar('会议已创建', { variant: 'success' }); // Optional
      } catch (error) {
        console.error('Error creating meeting:', error);
        alert('创建会议失败，请查看控制台了解详情。');
        // snackbar.enqueueSnackbar('创建会议失败', { variant: 'error' }); // Optional
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
        // snackbar.enqueueSnackbar('会议已取消', { variant: 'success' }); // Optional
      } catch (error) {
        console.error('Error cancelling meeting:', error);
        alert('取消会议失败，请查看控制台了解详情。');
        // snackbar.enqueueSnackbar('取消会议失败', { variant: 'error' }); // Optional
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
        // snackbar.enqueueSnackbar('会议纪要已保存', { variant: 'success' }); // Optional
      } catch (error) {
        console.error('Error saving minutes:', error);
        alert('保存会议纪要失败，请查看控制台了解详情。');
        // snackbar.enqueueSnackbar('保存纪要失败', { variant: 'error' }); // Optional
      }
    }
    handleCloseMinutesDialog();
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

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
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
        />
      </Box>
      
      {filteredMeetings.length === 0 ? (
        <Paper elevation={1} sx={{ p: 3, textAlign: 'center', mt: 2 }}>
          <Typography color="text.secondary">
            {searchTerm ? "未找到匹配的会议记录。" : "当前案件暂无会议记录。"}
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
                  key={String(meeting.id)} // Use String(meeting.id) as key for RecordId
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
                      <IconButton size="small" onClick={() => alert(`查看详情: ${meeting.title}`)}>
                        <SvgIcon><path d={mdiInformationOutline} /></SvgIcon>
                      </IconButton>
                    </Tooltip>
                    { isEditable && (
                      <Tooltip title="编辑会议">
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

      {/* Meeting Form Dialog */}
      <Dialog open={isMeetingFormOpen} onClose={handleCloseMeetingForm} maxWidth="sm" fullWidth>
        <DialogTitle>{currentMeeting?.id ? '编辑会议' : '安排新会议'}</DialogTitle>
        <DialogContent>
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
            sx={{mb:2, mt:1}}
          />
          <FormControl fullWidth margin="dense" sx={{mb:2}}>
            <InputLabel id="meeting-type-label">会议类型</InputLabel>
            <Select
              labelId="meeting-type-label"
              name="type"
              value={formData.type}
              label="会议类型"
              onChange={handleFormChange as any} // Cast because SelectChangeEvent is slightly different
            >
              <MenuItem value="债权人第一次会议">债权人第一次会议</MenuItem>
              <MenuItem value="债权人第二次会议">债权人第二次会议</MenuItem>
              <MenuItem value="临时会议">临时会议</MenuItem>
              <MenuItem value="内部讨论会">内部讨论会</MenuItem>
              <MenuItem value="其他">其他</MenuItem>
            </Select>
          </FormControl>
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
            sx={{mb:2}}
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
            inputProps={{ min: 15 }}
            sx={{mb:2}}
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
            sx={{mb:2}}
          />
          <TextField
            margin="dense"
            name="agenda"
            label="会议议程"
            type="text"
            fullWidth
            multiline
            rows={3}
            variant="outlined"
            value={formData.agenda}
            onChange={handleFormChange}
          />
        </DialogContent>
        <DialogActions sx={{p: '16px 24px'}}>
          <Button onClick={handleCloseMeetingForm} color="secondary">取消</Button>
          <Button onClick={handleSaveMeeting} variant="contained" color="primary">保存</Button>
        </DialogActions>
      </Dialog>

      {/* Cancel Confirmation Dialog */}
      <Dialog
        open={isCancelConfirmOpen}
        onClose={handleCloseCancelConfirm}
        aria-labelledby="cancel-confirm-dialog-title"
        aria-describedby="cancel-confirm-dialog-description"
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