import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  CircularProgress,
  Box,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment,
  IconButton,
  Grid,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Person as PersonIcon,
  Email as EmailIcon,
  AccountCircle as AccountIcon,
  Lock as LockIcon,
  AdminPanelSettings as AdminIcon,
} from '@mui/icons-material';
import { SelectChangeEvent } from '@mui/material/Select';
import { CaseMember } from '@/src/types/caseMember';
import { createUserAndAddToCase, CreateUserAndAddToCaseParams } from '@/src/services/caseMemberService';
import { useTranslation } from 'react-i18next';
import { useSurrealClient } from '@/src/contexts/SurrealProvider';

interface AddCaseMemberDialogProps {
  open: boolean;
  onClose: () => void;
  caseId: string;
  onMemberAdded: (newMember: CaseMember) => void;
}

interface FormData {
  username: string;
  password: string;
  email: string;
  name: string;
  role: 'owner' | 'member';
}

interface FormErrors {
  username?: string;
  password?: string;
  email?: string;
  name?: string;
}

const AddCaseMemberDialog: React.FC<AddCaseMemberDialogProps> = ({
  open,
  onClose,
  caseId,
  onMemberAdded,
}) => {
  const [formData, setFormData] = useState<FormData>({
    username: '',
    password: '',
    email: '',
    name: '',
    role: 'member',
  });
  
  const [errors, setErrors] = useState<FormErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  
  const client = useSurrealClient();
  const { t } = useTranslation();

  useEffect(() => {
    if (!open) {
      // Reset form when dialog is closed
      setFormData({
        username: '',
        password: '',
        email: '',
        name: '',
        role: 'member',
      });
      setErrors({});
      setApiError(null);
      setIsCreating(false);
      setShowPassword(false);
    }
  }, [open]);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // 用户名验证
    if (!formData.username.trim()) {
      newErrors.username = t('username_required', '用户名不能为空');
    } else if (formData.username.length < 3) {
      newErrors.username = t('username_min_length', '用户名至少需要3个字符');
    } else if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
      newErrors.username = t('username_invalid', '用户名只能包含字母、数字和下划线');
    }

    // 密码验证
    if (!formData.password) {
      newErrors.password = t('password_required', '密码不能为空');
    } else if (formData.password.length < 6) {
      newErrors.password = t('password_min_length', '密码至少需要6个字符');
    }

    // 邮箱验证
    if (!formData.email.trim()) {
      newErrors.email = t('email_required', '邮箱不能为空');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = t('email_invalid', '请输入有效的邮箱地址');
    }

    // 姓名验证
    if (!formData.name.trim()) {
      newErrors.name = t('name_required', '姓名不能为空');
    } else if (formData.name.length < 2) {
      newErrors.name = t('name_min_length', '姓名至少需要2个字符');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: keyof FormData) => (
    event: React.ChangeEvent<HTMLInputElement | { value: unknown }>
  ) => {
    const value = event.target.value as string;
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // 清除相应字段的错误
    if (errors[field as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
    setApiError(null);
  };

  const handleRoleChange = (event: SelectChangeEvent<'owner' | 'member'>) => {
    setFormData(prev => ({ ...prev, role: event.target.value as 'owner' | 'member' }));
  };

  const togglePasswordVisibility = () => {
    setShowPassword(prev => !prev);
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setIsCreating(true);
    setApiError(null);

    try {
      const params: CreateUserAndAddToCaseParams = {
        username: formData.username.trim(),
        password: formData.password,
        email: formData.email.trim().toLowerCase(),
        name: formData.name.trim(),
        role: formData.role,
      };

      const newMember = await createUserAndAddToCase(client, caseId, params);
      onMemberAdded(newMember);
      onClose();
    } catch (err) {
      console.error('Failed to create user and add to case:', err);
      setApiError((err as Error).message || t('create_user_error', '创建用户失败，请重试'));
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PersonIcon />
          <Typography variant="h6">
            {t('create_user_and_add_to_case', '创建用户并添加到案件')}
          </Typography>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        {apiError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {apiError}
          </Alert>
        )}

        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {t('create_user_description', '填写以下信息创建新用户账号并将其添加到当前案件中')}
        </Typography>

                 <Grid container spacing={2}>
           <Grid size={12}>
             <TextField
               autoFocus
               fullWidth
               label={t('username_label', '用户名')}
               value={formData.username}
               onChange={handleInputChange('username')}
               error={!!errors.username}
               helperText={errors.username || t('username_helper', '用户登录时使用的用户名')}
               InputProps={{
                 startAdornment: (
                   <InputAdornment position="start">
                     <AccountIcon />
                   </InputAdornment>
                 ),
               }}
             />
           </Grid>

           <Grid size={12}>
             <TextField
               fullWidth
               type={showPassword ? 'text' : 'password'}
               label={t('password_label', '密码')}
               value={formData.password}
               onChange={handleInputChange('password')}
               error={!!errors.password}
               helperText={errors.password || t('password_helper', '至少6个字符')}
               InputProps={{
                 startAdornment: (
                   <InputAdornment position="start">
                     <LockIcon />
                   </InputAdornment>
                 ),
                 endAdornment: (
                   <InputAdornment position="end">
                     <IconButton
                       onClick={togglePasswordVisibility}
                       edge="end"
                     >
                       {showPassword ? <VisibilityOff /> : <Visibility />}
                     </IconButton>
                   </InputAdornment>
                 ),
               }}
             />
           </Grid>

           <Grid size={12}>
             <TextField
               fullWidth
               type="email"
               label={t('email_label', '邮箱')}
               value={formData.email}
               onChange={handleInputChange('email')}
               error={!!errors.email}
               helperText={errors.email || t('email_helper', '用于接收通知和找回密码')}
               InputProps={{
                 startAdornment: (
                   <InputAdornment position="start">
                     <EmailIcon />
                   </InputAdornment>
                 ),
               }}
             />
           </Grid>

           <Grid size={12}>
             <TextField
               fullWidth
               label={t('display_name_label', '显示姓名')}
               value={formData.name}
               onChange={handleInputChange('name')}
               error={!!errors.name}
               helperText={errors.name || t('name_helper', '显示在系统中的姓名')}
               InputProps={{
                 startAdornment: (
                   <InputAdornment position="start">
                     <PersonIcon />
                   </InputAdornment>
                 ),
               }}
             />
           </Grid>

           <Grid size={12}>
             <FormControl fullWidth>
               <InputLabel>{t('role_in_case_label', '在案件中的角色')}</InputLabel>
               <Select
                 value={formData.role}
                 onChange={handleRoleChange}
                 label={t('role_in_case_label', '在案件中的角色')}
                 startAdornment={
                   <InputAdornment position="start">
                     {formData.role === 'owner' ? <AdminIcon /> : <PersonIcon />}
                   </InputAdornment>
                 }
               >
                 <MenuItem value="member">
                   <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                     <PersonIcon fontSize="small" />
                     {t('role_member', '普通成员')}
                   </Box>
                 </MenuItem>
                 <MenuItem value="owner">
                   <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                     <AdminIcon fontSize="small" />
                     {t('role_owner', '案件负责人')}
                   </Box>
                 </MenuItem>
               </Select>
             </FormControl>
           </Grid>
         </Grid>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={isCreating}>
          {t('cancel_button', '取消')}
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={isCreating}
          startIcon={isCreating ? <CircularProgress size={20} /> : <PersonIcon />}
        >
          {isCreating 
            ? t('creating_user', '创建中...') 
            : t('create_user_and_add', '创建用户并添加')
          }
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddCaseMemberDialog;
