import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Card,
  CardContent,
  CardActions,
  Tooltip,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  useTheme,
  useMediaQuery,
  Tabs,
  Tab,
  Avatar,
  AvatarGroup,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Visibility,
  Cancel,
  VideoCall,
  Schedule,
  People,
  Description,
  Link as LinkIcon,
  CalendarToday,
  AccessTime,
  LocationOn,
  CheckCircle,
  Error,
  Warning,
  ContentCopy,
} from '@mui/icons-material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { zhCN } from 'date-fns/locale/zh-CN';

// 会议类型
const meetingTypes = [
  { value: 'creditor_first', label: '债权人第一次会议' },
  { value: 'creditor_second', label: '债权人第二次会议' },
  { value: 'internal', label: '内部讨论会' },
  { value: 'court', label: '法院听证会' },
];

// 会议状态
const meetingStatuses = {
  scheduled: { label: '已安排', color: 'info' },
  ongoing: { label: '进行中', color: 'success' },
  completed: { label: '已结束', color: 'default' },
  cancelled: { label: '已取消', color: 'error' },
};

// 模拟会议数据
const mockMeetings = [
  {
    id: '1',
    name: '第一次债权人会议',
    type: 'creditor_first',
    startTime: new Date('2024-04-15 14:00'),
    endTime: new Date('2024-04-15 16:00'),
    status: 'scheduled',
    platform: '腾讯会议',
    meetingLink: 'https://meeting.tencent.com/dm/xxxxx',
    meetingId: '123-456-789',
    password: '1234',
    participants: 45,
    agenda: '1. 债权申报情况说明\n2. 财产状况报告\n3. 管理人工作报告\n4. 后续工作安排',
    organizer: '王管理人',
    hasMinutes: false,
  },
  {
    id: '2',
    name: '管理人团队内部会议',
    type: 'internal',
    startTime: new Date('2024-04-10 10:00'),
    endTime: new Date('2024-04-10 11:30'),
    status: 'completed',
    platform: 'Zoom',
    meetingLink: 'https://zoom.us/j/xxxxx',
    meetingId: '987-654-321',
    password: '',
    participants: 8,
    agenda: '1. 债权审核进度汇报\n2. 问题债权讨论\n3. 下周工作计划',
    organizer: '李律师',
    hasMinutes: true,
    minutes: '会议纪要内容...',
  },
  {
    id: '3',
    name: '第二次债权人会议',
    type: 'creditor_second',
    startTime: new Date('2024-05-20 14:00'),
    endTime: new Date('2024-05-20 17:00'),
    status: 'scheduled',
    platform: '腾讯会议',
    meetingLink: 'https://meeting.tencent.com/dm/yyyyy',
    meetingId: '456-789-123',
    password: '5678',
    participants: 52,
    agenda: '1. 重整计划草案说明\n2. 债权人分组表决\n3. 表决结果统计',
    organizer: '王管理人',
    hasMinutes: false,
  },
];

export const OnlineMeetings: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [activeTab, setActiveTab] = useState(0);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<any>(null);
  const [openMinutesDialog, setOpenMinutesDialog] = useState(false);
  const [minutesContent, setMinutesContent] = useState('');

  // 表单数据
  const [formData, setFormData] = useState({
    name: '',
    type: '',
    startTime: null as Date | null,
    endTime: null as Date | null,
    platform: '',
    meetingLink: '',
    meetingId: '',
    password: '',
    agenda: '',
  });

  // 处理创建/编辑会议
  const handleOpenDialog = (meeting?: any) => {
    if (meeting) {
      setSelectedMeeting(meeting);
      setFormData({
        name: meeting.name,
        type: meeting.type,
        startTime: meeting.startTime,
        endTime: meeting.endTime,
        platform: meeting.platform,
        meetingLink: meeting.meetingLink,
        meetingId: meeting.meetingId,
        password: meeting.password,
        agenda: meeting.agenda,
      });
    } else {
      setSelectedMeeting(null);
      setFormData({
        name: '',
        type: '',
        startTime: null,
        endTime: null,
        platform: '',
        meetingLink: '',
        meetingId: '',
        password: '',
        agenda: '',
      });
    }
    setOpenDialog(true);
  };

  // 处理保存
  const handleSave = () => {
    console.log('保存会议', formData);
    setOpenDialog(false);
  };

  // 处理取消会议
  const handleCancelMeeting = (meeting: any) => {
    console.log('取消会议', meeting);
  };

  // 处理查看/编辑会议纪要
  const handleMinutes = (meeting: any) => {
    setSelectedMeeting(meeting);
    setMinutesContent(meeting.minutes || '');
    setOpenMinutesDialog(true);
  };

  // 处理保存会议纪要
  const handleSaveMinutes = () => {
    console.log('保存会议纪要', { meeting: selectedMeeting, content: minutesContent });
    setOpenMinutesDialog(false);
  };

  // 复制会议信息
  const handleCopyMeetingInfo = (meeting: any) => {
    const info = `会议名称：${meeting.name}
会议时间：${meeting.startTime.toLocaleString('zh-CN')}
会议平台：${meeting.platform}
会议链接：${meeting.meetingLink}
会议ID：${meeting.meetingId}
${meeting.password ? `会议密码：${meeting.password}` : ''}`;
    
    navigator.clipboard.writeText(info);
    // 这里应该显示一个提示
    console.log('会议信息已复制');
  };

  // 获取状态颜色
  const getStatusColor = (status: string): any => {
    return meetingStatuses[status as keyof typeof meetingStatuses]?.color || 'default';
  };

  // 获取状态标签
  const getStatusLabel = (status: string) => {
    return meetingStatuses[status as keyof typeof meetingStatuses]?.label || status;
  };

  // 即将开始的会议
  const upcomingMeetings = mockMeetings.filter(m => m.status === 'scheduled');
  // 历史会议
  const pastMeetings = mockMeetings.filter(m => m.status === 'completed' || m.status === 'cancelled');

  return (
    <Box>
      {/* 页面标题 */}
      <Box mb={3} display="flex" justifyContent="space-between" alignItems="center">
        <Typography variant="h4" fontWeight="bold">
          在线会议
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => handleOpenDialog()}
          size="large"
        >
          安排新会议
        </Button>
      </Box>

      {/* 标签页 */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)}>
          <Tab label={`即将进行 (${upcomingMeetings.length})`} />
          <Tab label={`历史记录 (${pastMeetings.length})`} />
        </Tabs>
      </Paper>

      {/* 即将进行的会议 */}
      {activeTab === 0 && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              md: 'repeat(2, 1fr)',
              lg: 'repeat(3, 1fr)',
            },
            gap: 3,
          }}
        >
          {upcomingMeetings.map((meeting) => (
            <Card key={meeting.id}>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                  <Typography variant="h6" gutterBottom>
                    {meeting.name}
                  </Typography>
                  <Chip
                    label={getStatusLabel(meeting.status)}
                    color={getStatusColor(meeting.status)}
                    size="small"
                  />
                </Box>

                <List dense>
                  <ListItem>
                    <ListItemIcon>
                      <CalendarToday fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary="会议时间"
                      secondary={`${meeting.startTime.toLocaleString('zh-CN')} - ${meeting.endTime.toLocaleTimeString('zh-CN')}`}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <VideoCall fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary="会议平台"
                      secondary={meeting.platform}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <People fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary="预计参会人数"
                      secondary={`${meeting.participants} 人`}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <LinkIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary="会议ID"
                      secondary={meeting.meetingId}
                    />
                  </ListItem>
                </List>

                <Divider sx={{ my: 2 }} />

                <Typography variant="body2" color="textSecondary" gutterBottom>
                  会议议程
                </Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
                  {meeting.agenda}
                </Typography>
              </CardContent>
              <CardActions>
                <Button
                  size="small"
                  startIcon={<ContentCopy />}
                  onClick={() => handleCopyMeetingInfo(meeting)}
                >
                  复制信息
                </Button>
                <Button
                  size="small"
                  startIcon={<Edit />}
                  onClick={() => handleOpenDialog(meeting)}
                >
                  编辑
                </Button>
                <Button
                  size="small"
                  color="error"
                  startIcon={<Cancel />}
                  onClick={() => handleCancelMeeting(meeting)}
                >
                  取消
                </Button>
              </CardActions>
            </Card>
          ))}
        </Box>
      )}

      {/* 历史记录 */}
      {activeTab === 1 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>会议名称</TableCell>
                <TableCell>会议类型</TableCell>
                <TableCell>会议时间</TableCell>
                <TableCell>参会人数</TableCell>
                <TableCell>状态</TableCell>
                <TableCell>组织者</TableCell>
                <TableCell>会议纪要</TableCell>
                <TableCell align="center">操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pastMeetings.map((meeting) => (
                <TableRow key={meeting.id}>
                  <TableCell>{meeting.name}</TableCell>
                  <TableCell>
                    {meetingTypes.find(t => t.value === meeting.type)?.label}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {meeting.startTime.toLocaleDateString('zh-CN')}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      {meeting.startTime.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} - 
                      {meeting.endTime.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                    </Typography>
                  </TableCell>
                  <TableCell>{meeting.participants}</TableCell>
                  <TableCell>
                    <Chip
                      label={getStatusLabel(meeting.status)}
                      color={getStatusColor(meeting.status)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{meeting.organizer}</TableCell>
                  <TableCell>
                    {meeting.hasMinutes ? (
                      <Chip
                        icon={<CheckCircle />}
                        label="已填写"
                        color="success"
                        size="small"
                      />
                    ) : (
                      <Chip
                        icon={<Warning />}
                        label="未填写"
                        color="warning"
                        size="small"
                      />
                    )}
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title="查看详情">
                      <IconButton size="small">
                        <Visibility />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={meeting.hasMinutes ? '查看纪要' : '填写纪要'}>
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => handleMinutes(meeting)}
                      >
                        <Description />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* 创建/编辑会议对话框 */}
      <Dialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {selectedMeeting ? '编辑会议' : '安排新会议'}
        </DialogTitle>
        <DialogContent>
          <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={zhCN}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
                gap: 2,
                mt: 2,
              }}
            >
              <TextField
                fullWidth
                required
                label="会议名称"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
              <FormControl fullWidth required>
                <InputLabel>会议类型</InputLabel>
                <Select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  label="会议类型"
                >
                  {meetingTypes.map((type) => (
                    <MenuItem key={type.value} value={type.value}>
                      {type.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <DateTimePicker
                label="开始时间"
                value={formData.startTime}
                onChange={(value) => {
                  if (value instanceof Date) {
                    setFormData({ ...formData, startTime: value });
                  }
                }}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    required: true,
                  },
                }}
              />
              <DateTimePicker
                label="结束时间"
                value={formData.endTime}
                onChange={(value) => {
                  if (value instanceof Date) {
                    setFormData({ ...formData, endTime: value });
                  }
                }}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    required: true,
                  },
                }}
              />
              <TextField
                fullWidth
                required
                label="会议平台"
                value={formData.platform}
                onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
                placeholder="如：腾讯会议、Zoom等"
              />
              <TextField
                fullWidth
                label="会议链接"
                value={formData.meetingLink}
                onChange={(e) => setFormData({ ...formData, meetingLink: e.target.value })}
              />
              <TextField
                fullWidth
                label="会议ID"
                value={formData.meetingId}
                onChange={(e) => setFormData({ ...formData, meetingId: e.target.value })}
              />
              <TextField
                fullWidth
                label="会议密码"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </Box>
            <TextField
              fullWidth
              multiline
              rows={4}
              label="会议议程"
              value={formData.agenda}
              onChange={(e) => setFormData({ ...formData, agenda: e.target.value })}
              sx={{ mt: 2 }}
              placeholder="请输入会议议程..."
            />
          </LocalizationProvider>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>取消</Button>
          <Button onClick={handleSave} variant="contained">
            保存
          </Button>
        </DialogActions>
      </Dialog>

      {/* 会议纪要对话框 */}
      <Dialog
        open={openMinutesDialog}
        onClose={() => setOpenMinutesDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          会议纪要 - {selectedMeeting?.name}
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            请详细记录会议的主要内容、决议事项和后续行动计划
          </Alert>
          <TextField
            fullWidth
            multiline
            rows={15}
            label="会议纪要"
            value={minutesContent}
            onChange={(e) => setMinutesContent(e.target.value)}
            placeholder="请输入会议纪要内容..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenMinutesDialog(false)}>取消</Button>
          <Button onClick={handleSaveMinutes} variant="contained">
            保存
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default OnlineMeetings;
