import React from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  CardActions,
  Chip,
  Paper,
  SvgIcon,
} from '@mui/material';
import {
  mdiCalendarPlus,
  mdiInformationOutline,
  mdiVideoOutline,
  mdiFileDocumentOutline,
} from '@mdi/js';

// Mock data, replace with API call relevant to a selected case
const mockMeetings = [
  { id: 'meet001', title: '第一次债权人会议 (Case BK-2023-001)', type: '债权人第一次会议', scheduled_time: '2023-05-15 10:00', status: '已结束', recording_url: '#', minutes_doc_id: 'doc_minutes_001' },
  { id: 'meet002', title: '重整计划讨论会 (Case BK-2023-001)', type: '临时会议', scheduled_time: '2023-06-01 14:00', status: '已安排', recording_url: null, minutes_doc_id: null },
  { id: 'meet003', title: '第二次债权人会议 (Case BK-2023-002)', type: '债权人第二次会议', scheduled_time: '2023-07-10 09:00', status: '已安排', recording_url: null, minutes_doc_id: null },
];

const OnlineMeetingPage: React.FC = () => {
  // TODO: Fetch meetings for the selected case from API
  // TODO: Implement meeting creation, joining (if applicable), viewing details
  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          在线会议
        </Typography>
        <Button variant="contained" color="primary" startIcon={<SvgIcon><path d={mdiCalendarPlus} /></SvgIcon>}>
          安排新会议
        </Button>
      </Box>
      
      {mockMeetings.length === 0 ? (
        <Paper elevation={1} sx={{ p: 3, textAlign: 'center' }}>
          <Typography color="text.secondary">当前案件暂无会议记录。</Typography>
        </Paper>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {mockMeetings.map((meeting) => (
            <Card key={meeting.id} elevation={2}>
              <CardContent>
                <Typography variant="h5" component="h2" color="primary" gutterBottom>
                  {meeting.title}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                  <strong>类型:</strong> {meeting.type}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                  <strong>计划时间:</strong> {meeting.scheduled_time}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
                  <Typography variant="body2" color="text.secondary" component="strong" sx={{mr:1}}>
                    状态:
                  </Typography>
                  <Chip
                    label={meeting.status}
                    size="small"
                    color={meeting.status === '已结束' ? 'default' : 'success'}
                    variant={meeting.status === '已结束' ? 'outlined' : 'filled'}
                  />
                </Box>
              </CardContent>
              <CardActions sx={{ pt: 0, pb: 1.5, pl: 2, pr: 2 }}>
                <Button size="small" variant="outlined" startIcon={<SvgIcon><path d={mdiInformationOutline} /></SvgIcon>}>
                  查看详情
                </Button>
                {meeting.recording_url && (
                  <Button
                    size="small"
                    variant="outlined"
                    href={meeting.recording_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    startIcon={<SvgIcon><path d={mdiVideoOutline} /></SvgIcon>}
                  >
                    查看录像
                  </Button>
                )}
                {meeting.minutes_doc_id && (
                  <Button size="small" variant="outlined" startIcon={<SvgIcon><path d={mdiFileDocumentOutline} /></SvgIcon>}>
                    查看纪要
                  </Button>
                )}
              </CardActions>
            </Card>
          ))}
        </Box>
      )}
      <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
        在线会议页面。将展示当前案件的会议列表和会议记录。
        操作权限将根据用户身份和案件程序进程进行控制。
      </Typography>
    </Box>
  );
};

export default OnlineMeetingPage;