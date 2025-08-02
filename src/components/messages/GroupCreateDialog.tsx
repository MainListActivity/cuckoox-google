import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Avatar,
  Chip,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Stepper,
  Step,
  StepLabel,
  Paper,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  Checkbox,
  Autocomplete,
  Grid,
  Card,
  CardContent,
  Divider,
  IconButton,
  Tooltip,
  Alert,
  CircularProgress,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  Close as CloseIcon,
  PhotoCamera as PhotoCameraIcon,
  Group as GroupIcon,
  Business as BusinessIcon,
  Security as SecurityIcon,
  Public as PublicIcon,
  Lock as LockIcon,
  Person as PersonIcon,
  Search as SearchIcon,
  Add as AddIcon,
  Remove as RemoveIcon
} from '@mui/icons-material';
import { RecordId } from 'surrealdb';
import { useAuth } from '@/src/contexts/AuthContext';
import { useSnackbar } from '@/src/contexts/SnackbarContext';
import { useGroupOperations } from '@/src/hooks/useGroupData';
import type { CreateGroupRequest } from '@/src/types/group';

interface GroupCreateDialogProps {
  open: boolean;
  onClose: () => void;
  onGroupCreated?: (groupId: RecordId | string) => void;
  preselectedUsers?: (RecordId | string)[];
  caseId?: RecordId | string; // 如果从案件页面创建群组
}

interface UserOption {
  id: RecordId | string;
  name: string;
  email?: string;
  avatar_url?: string;
  department?: string;
}

const steps = ['基本信息', '群组设置', '添加成员'];

export default function GroupCreateDialog({
  open,
  onClose,
  onGroupCreated,
  preselectedUsers = [],
  caseId
}: GroupCreateDialogProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { user } = useAuth();
  const { showSuccess, showError } = useSnackbar();
  const { createGroup } = useGroupOperations();
  
  // 步骤状态
  const [activeStep, setActiveStep] = useState(0);
  
  // 表单数据
  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    avatar_url?: string;
    type: 'normal' | 'case_related' | 'department';
    is_public: boolean;
    require_approval: boolean;
    allow_member_invite: boolean;
    max_members: number;
    selectedUsers: UserOption[];
    settings: {
      allow_all_member_at: boolean;
      allow_member_edit_info: boolean;
      message_auto_delete_days?: number;
      file_sharing_enabled: boolean;
      call_enabled: boolean;
      screen_share_enabled: boolean;
      member_join_notification: boolean;
      member_leave_notification: boolean;
    };
  }>({
    name: '',
    description: '',
    type: caseId ? 'case_related' : 'normal',
    is_public: false,
    require_approval: false,
    allow_member_invite: true,
    max_members: 500,
    selectedUsers: [],
    settings: {
      allow_all_member_at: true,
      allow_member_edit_info: false,
      file_sharing_enabled: true,
      call_enabled: true,
      screen_share_enabled: true,
      member_join_notification: true,
      member_leave_notification: true
    }
  });
  
  // 本地状态
  const [isLoading, setIsLoading] = useState(false);
  const [userSearchLoading, setUserSearchLoading] = useState(false);
  const [userOptions, setUserOptions] = useState<UserOption[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // 验证函数
  const validateStep = useCallback((step: number): boolean => {
    const newErrors: Record<string, string> = {};
    
    switch (step) {
      case 0: // 基本信息
        if (!formData.name.trim()) {
          newErrors.name = '群组名称不能为空';
        } else if (formData.name.length > 50) {
          newErrors.name = '群组名称不能超过50个字符';
        }
        
        if (formData.description.length > 500) {
          newErrors.description = '群组描述不能超过500个字符';
        }
        
        if (formData.max_members < 2 || formData.max_members > 1000) {
          newErrors.max_members = '群组成员数量应在2-1000之间';
        }
        break;
        
      case 1: // 群组设置
        if (formData.settings.message_auto_delete_days && 
            (formData.settings.message_auto_delete_days < 1 || formData.settings.message_auto_delete_days > 365)) {
          newErrors.message_auto_delete_days = '消息自动删除时间应在1-365天之间';
        }
        break;
        
      case 2: // 添加成员
        // 成员添加是可选的，无需验证
        break;
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);
  
  // 搜索用户
  const searchUsers = useCallback(async (query: string) => {
    if (!query.trim()) {
      setUserOptions([]);
      return;
    }
    
    try {
      setUserSearchLoading(true);
      // TODO: 调用实际的用户搜索API
      // 这里模拟搜索结果
      const mockUsers: UserOption[] = [
        { id: 'user:1', name: '张三', email: 'zhangsan@example.com', department: '技术部' },
        { id: 'user:2', name: '李四', email: 'lisi@example.com', department: '产品部' },
        { id: 'user:3', name: '王五', email: 'wangwu@example.com', department: '设计部' }
      ].filter(user => 
        user.name.includes(query) || 
        user.email?.includes(query) ||
        user.department?.includes(query)
      );
      
      setUserOptions(mockUsers);
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setUserSearchLoading(false);
    }
  }, []);
  
  // 处理头像上传
  const handleAvatarChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    // 验证文件类型和大小
    if (!file.type.startsWith('image/')) {
      showError('请选择图片文件');
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
      showError('图片大小不能超过5MB');
      return;
    }
    
    setAvatarFile(file);
    
    // 创建预览
    const reader = new FileReader();
    reader.onload = (e) => {
      setAvatarPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  }, [showError]);
  
  // 处理步骤导航
  const handleNext = useCallback(() => {
    if (!validateStep(activeStep)) return;
    
    if (activeStep < steps.length - 1) {
      setActiveStep(activeStep + 1);
    }
  }, [activeStep, validateStep]);
  
  const handleBack = useCallback(() => {
    if (activeStep > 0) {
      setActiveStep(activeStep - 1);
    }
  }, [activeStep]);
  
  // 处理创建群组
  const handleCreateGroup = useCallback(async () => {
    if (!validateStep(activeStep)) return;
    
    try {
      setIsLoading(true);
      
      // 构建创建群组的数据
      const createData: CreateGroupRequest = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        avatar_url: formData.avatar_url,
        type: formData.type,
        case_id: caseId,
        max_members: formData.max_members,
        is_public: formData.is_public,
        require_approval: formData.require_approval,
        allow_member_invite: formData.allow_member_invite,
        settings: formData.settings
      };
      
      // TODO: 如果有头像文件，先上传头像
      if (avatarFile) {
        // createData.avatar_url = await uploadAvatar(avatarFile);
      }
      
      // 创建群组
      const newGroup = await createGroup(createData);
      
      // TODO: 添加选定的成员
      if (formData.selectedUsers.length > 0) {
        // await addMembers(newGroup.id, formData.selectedUsers.map(u => u.id));
      }
      
      showSuccess('群组创建成功');
      onGroupCreated?.(newGroup.id);
      onClose();
      
      // 重置表单
      setActiveStep(0);
      setFormData({
        name: '',
        description: '',
        type: caseId ? 'case_related' : 'normal',
        is_public: false,
        require_approval: false,
        allow_member_invite: true,
        max_members: 500,
        selectedUsers: [],
        settings: {
          allow_all_member_at: true,
          allow_member_edit_info: false,
          file_sharing_enabled: true,
          call_enabled: true,
          screen_share_enabled: true,
          member_join_notification: true,
          member_leave_notification: true
        }
      });
      
    } catch (error) {
      showError(`创建群组失败: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  }, [
    activeStep, validateStep, formData, caseId, avatarFile, 
    createGroup, showSuccess, showError, onGroupCreated, onClose
  ]);
  
  // 初始化预选用户
  useEffect(() => {
    if (preselectedUsers.length > 0) {
      // TODO: 根据用户ID获取用户信息
      // setFormData(prev => ({ ...prev, selectedUsers: preselectedUserOptions }));
    }
  }, [preselectedUsers]);
  
  // 搜索用户防抖
  useEffect(() => {
    const timer = setTimeout(() => {
      if (userSearchQuery) {
        searchUsers(userSearchQuery);
      }
    }, 300);
    
    return () => clearTimeout(timer);
  }, [userSearchQuery, searchUsers]);
  
  // 获取群组类型选项
  const groupTypeOptions = [
    { value: 'normal', label: '普通群组', icon: <GroupIcon />, description: '适用于日常交流' },
    { value: 'case_related', label: '案件群组', icon: <SecurityIcon />, description: '与特定案件相关' },
    { value: 'department', label: '部门群组', icon: <BusinessIcon />, description: '部门内部交流' }
  ];
  
  // 渲染基本信息步骤
  const renderBasicInfoStep = () => (
    <Box>
      {/* 群组头像 */}
      <Box display="flex" justifyContent="center" mb={3}>
        <Box position="relative">
          <Avatar
            sx={{ 
              width: 80, 
              height: 80,
              bgcolor: 'primary.main',
              fontSize: '2rem'
            }}
            src={avatarPreview || undefined}
          >
            {formData.name.charAt(0)?.toUpperCase() || 'G'}
          </Avatar>
          
          <IconButton
            sx={{
              position: 'absolute',
              bottom: -8,
              right: -8,
              bgcolor: 'background.paper',
              border: `2px solid ${theme.palette.divider}`,
              '&:hover': { bgcolor: 'background.paper' }
            }}
            component="label"
          >
            <PhotoCameraIcon fontSize="small" />
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={handleAvatarChange}
            />
          </IconButton>
        </Box>
      </Box>
      
      {/* 群组名称 */}
      <TextField
        fullWidth
        label="群组名称"
        value={formData.name}
        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
        error={Boolean(errors.name)}
        helperText={errors.name}
        margin="normal"
        required
      />
      
      {/* 群组描述 */}
      <TextField
        fullWidth
        label="群组描述"
        value={formData.description}
        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
        error={Boolean(errors.description)}
        helperText={errors.description}
        margin="normal"
        multiline
        rows={3}
        placeholder="简单描述一下这个群组的用途..."
      />
      
      {/* 群组类型 */}
      <FormControl fullWidth margin="normal">
        <InputLabel>群组类型</InputLabel>
        <Select
          value={formData.type}
          label="群组类型"
          onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as any }))}
          disabled={Boolean(caseId)} // 如果指定了案件ID，类型固定为case_related
        >
          {groupTypeOptions.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              <Box display="flex" alignItems="center" gap={2}>
                {option.icon}
                <Box>
                  <Typography variant="body1">{option.label}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {option.description}
                  </Typography>
                </Box>
              </Box>
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      
      {/* 最大成员数 */}
      <TextField
        fullWidth
        label="最大成员数"
        type="number"
        value={formData.max_members}
        onChange={(e) => setFormData(prev => ({ ...prev, max_members: parseInt(e.target.value) || 500 }))}
        error={Boolean(errors.max_members)}
        helperText={errors.max_members || '设置群组可容纳的最大成员数量'}
        margin="normal"
        inputProps={{ min: 2, max: 1000 }}
      />
    </Box>
  );
  
  // 渲染群组设置步骤
  const renderSettingsStep = () => (
    <Box>
      {/* 隐私设置 */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            隐私设置
          </Typography>
          
          <FormControlLabel
            control={
              <Switch
                checked={formData.is_public}
                onChange={(e) => setFormData(prev => ({ ...prev, is_public: e.target.checked }))}
              />
            }
            label={
              <Box display="flex" alignItems="center" gap={1}>
                {formData.is_public ? <PublicIcon /> : <LockIcon />}
                <Box>
                  <Typography variant="body2">
                    {formData.is_public ? '公开群组' : '私密群组'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formData.is_public ? '任何人都可以搜索到此群组' : '只有受邀用户才能加入'}
                  </Typography>
                </Box>
              </Box>
            }
          />
          
          <FormControlLabel
            control={
              <Switch
                checked={formData.require_approval}
                onChange={(e) => setFormData(prev => ({ ...prev, require_approval: e.target.checked }))}
              />
            }
            label="需要管理员审批新成员"
          />
          
          <FormControlLabel
            control={
              <Switch
                checked={formData.allow_member_invite}
                onChange={(e) => setFormData(prev => ({ ...prev, allow_member_invite: e.target.checked }))}
              />
            }
            label="允许成员邀请他人加入"
          />
        </CardContent>
      </Card>
      
      {/* 功能设置 */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            功能设置
          </Typography>
          
          <FormControlLabel
            control={
              <Switch
                checked={formData.settings.allow_all_member_at}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  settings: { ...prev.settings, allow_all_member_at: e.target.checked }
                }))}
              />
            }
            label="允许@所有人"
          />
          
          <FormControlLabel
            control={
              <Switch
                checked={formData.settings.allow_member_edit_info}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  settings: { ...prev.settings, allow_member_edit_info: e.target.checked }
                }))}
              />
            }
            label="允许成员修改群组信息"
          />
          
          <FormControlLabel
            control={
              <Switch
                checked={formData.settings.file_sharing_enabled}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  settings: { ...prev.settings, file_sharing_enabled: e.target.checked }
                }))}
              />
            }
            label="启用文件分享"
          />
          
          <FormControlLabel
            control={
              <Switch
                checked={formData.settings.call_enabled}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  settings: { ...prev.settings, call_enabled: e.target.checked }
                }))}
              />
            }
            label="启用语音/视频通话"
          />
          
          <FormControlLabel
            control={
              <Switch
                checked={formData.settings.screen_share_enabled}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  settings: { ...prev.settings, screen_share_enabled: e.target.checked }
                }))}
              />
            }
            label="启用屏幕共享"
          />
        </CardContent>
      </Card>
      
      {/* 通知设置 */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            通知设置
          </Typography>
          
          <FormControlLabel
            control={
              <Switch
                checked={formData.settings.member_join_notification}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  settings: { ...prev.settings, member_join_notification: e.target.checked }
                }))}
              />
            }
            label="成员加入时通知"
          />
          
          <FormControlLabel
            control={
              <Switch
                checked={formData.settings.member_leave_notification}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  settings: { ...prev.settings, member_leave_notification: e.target.checked }
                }))}
              />
            }
            label="成员离开时通知"
          />
          
          <TextField
            fullWidth
            label="消息自动删除 (天)"
            type="number"
            value={formData.settings.message_auto_delete_days || ''}
            onChange={(e) => setFormData(prev => ({
              ...prev,
              settings: { 
                ...prev.settings, 
                message_auto_delete_days: e.target.value ? parseInt(e.target.value) : undefined 
              }
            }))}
            error={Boolean(errors.message_auto_delete_days)}
            helperText={errors.message_auto_delete_days || '留空表示消息永不自动删除'}
            margin="normal"
            inputProps={{ min: 1, max: 365 }}
          />
        </CardContent>
      </Card>
    </Box>
  );
  
  // 渲染添加成员步骤
  const renderMembersStep = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        添加成员 (可选)
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        您可以现在添加成员，也可以稍后在群组中邀请。
      </Typography>
      
      {/* 搜索用户 */}
      <Autocomplete
        multiple
        options={userOptions}
        value={formData.selectedUsers}
        onChange={(_, newValue) => {
          setFormData(prev => ({ ...prev, selectedUsers: newValue }));
        }}
        getOptionLabel={(option) => option.name}
        loading={userSearchLoading}
        onInputChange={(_, newInputValue) => {
          setUserSearchQuery(newInputValue);
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            label="搜索并添加成员"
            placeholder="输入姓名、邮箱或部门搜索"
            InputProps={{
              ...params.InputProps,
              startAdornment: <SearchIcon color="action" sx={{ mr: 1 }} />,
              endAdornment: (
                <>
                  {userSearchLoading ? <CircularProgress color="inherit" size={20} /> : null}
                  {params.InputProps.endAdornment}
                </>
              ),
            }}
          />
        )}
        renderOption={(props, option) => (
          <li {...props}>
            <Avatar
              src={option.avatar_url}
              sx={{ width: 32, height: 32, mr: 2 }}
            >
              {option.name.charAt(0)}
            </Avatar>
            <Box>
              <Typography variant="body2">{option.name}</Typography>
              <Typography variant="caption" color="text.secondary">
                {option.email} {option.department && `· ${option.department}`}
              </Typography>
            </Box>
          </li>
        )}
        renderTags={(value, getTagProps) =>
          value.map((option, index) => (
            <Chip
              avatar={<Avatar src={option.avatar_url}>{option.name.charAt(0)}</Avatar>}
              label={option.name}
              {...getTagProps({ index })}
              key={option.id}
            />
          ))
        }
      />
      
      {/* 选中成员统计 */}
      {formData.selectedUsers.length > 0 && (
        <Box mt={2}>
          <Typography variant="body2" color="text.secondary">
            已选择 {formData.selectedUsers.length} 名成员
          </Typography>
        </Box>
      )}
    </Box>
  );
  
  // 获取当前步骤内容
  const getStepContent = () => {
    switch (activeStep) {
      case 0:
        return renderBasicInfoStep();
      case 1:
        return renderSettingsStep();
      case 2:
        return renderMembersStep();
      default:
        return null;
    }
  };
  
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      fullScreen={isMobile}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="h6">创建群组</Typography>
          <IconButton onClick={onClose} disabled={isLoading}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      
      <DialogContent dividers>
        {/* 步骤指示器 */}
        <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
        
        {/* 步骤内容 */}
        {getStepContent()}
        
        {/* 案件关联提示 */}
        {caseId && (
          <Alert severity="info" sx={{ mt: 2 }}>
            此群组将与当前案件关联，用于案件相关的讨论和协作。
          </Alert>
        )}
      </DialogContent>
      
      <DialogActions>
        <Button
          onClick={activeStep === 0 ? onClose : handleBack}
          disabled={isLoading}
        >
          {activeStep === 0 ? '取消' : '上一步'}
        </Button>
        
        {activeStep < steps.length - 1 ? (
          <Button
            onClick={handleNext}
            variant="contained"
            disabled={isLoading}
          >
            下一步
          </Button>
        ) : (
          <Button
            onClick={handleCreateGroup}
            variant="contained"
            disabled={isLoading}
            startIcon={isLoading ? <CircularProgress size={20} /> : undefined}
          >
            创建群组
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}