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
import { getCaseMemberRoles, Role } from '@/src/services/roleService';
import { useTranslation } from 'react-i18next';
import { useSurrealClient } from '@/src/contexts/SurrealProvider';
import { RecordId } from 'surrealdb';

interface AddCaseMemberDialogProps {
  open: boolean;
  onClose: () => void;
  caseId: RecordId;
  onMemberAdded: (newMember: CaseMember) => void;
}

interface FormData {
  username: string;
  password: string;
  email: string;
  name: string;
  role: RecordId | null;
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
    role: null,
  });
  
  const [errors, setErrors] = useState<FormErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoadingRoles, setIsLoadingRoles] = useState(false);
  
  const { t } = useTranslation();
  const client = useSurrealClient();

  // Load roles from database
  const loadRoles = React.useCallback(async () => {
    setIsLoadingRoles(true);
    try {
      if (!client) {
        throw new Error('SurrealDB client not available');
      }
      const roleList = await getCaseMemberRoles(client);
      setRoles(roleList);
      
      // Set default role if roles are available and no role is selected
      if (roleList.length > 0) {
        setFormData(prev => {
          if (!prev.role) {
            // Find case_manager role or use first available role
            const defaultRole = roleList.find(role => role.name === 'case_manager') || roleList[0];
            return { ...prev, role: defaultRole.id };
          }
          return prev;
        });
      }
    } catch (error) {
      console.error('Failed to load roles:', error);
      setApiError('加载角色列表失败');
    } finally {
      setIsLoadingRoles(false);
    }
  }, [client]);

  useEffect(() => {
    if (!open) {
      // Reset form when dialog is closed
      setFormData({
        username: '',
        password: '',
        email: '',
        name: '',
        role: null,
      });
      setErrors({});
      setApiError(null);
      setIsCreating(false);
      setShowPassword(false);
    } else {
      // Load roles when dialog is opened
      loadRoles();
    }
  }, [open, loadRoles]);

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

  const handleRoleChange = (event: SelectChangeEvent<string>) => {
    const selectedRoleId = event.target.value;
    const selectedRole = roles.find(role => role.id.toString() === selectedRoleId);
    if (selectedRole) {
      setFormData(prev => ({ ...prev, role: selectedRole.id }));
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(prev => !prev);
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    if (!formData.role) {
      setApiError('请选择角色');
      return;
    }

    setIsCreating(true);
    setApiError(null);

    try {
      if (!client) {
        throw new Error('Database client not available');
      }
      
      const params: CreateUserAndAddToCaseParams = {
        username: formData.username.trim(),
        password_hash: formData.password,
        email: formData.email.trim().toLowerCase(),
        name: formData.name.trim(),
        roleId: formData.role, // 直接使用角色RecordId
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

  // Get role icon by RecordId
  const getRoleIcon = (roleId: RecordId) => {
    const role = roles.find(r => r.id.toString() === roleId.toString());
    return role ? getRoleIconByName(role.name) : <PersonIcon fontSize="small" />;
  };

  // Get role icon by role name
  const getRoleIconByName = (roleName: string) => {
    switch (roleName) {
      case 'case_manager':
        return <AdminIcon fontSize="small" />;
      case 'admin':
        return <AdminIcon fontSize="small" />;
      default:
        return <PersonIcon fontSize="small" />;
    }
  };

  // Get role display name
  const getRoleDisplayName = (roleName: string): string => {
    switch (roleName) {
      case 'case_manager':
        return t('role_case_manager', '案件负责人');
      case 'member':
        return t('role_member', '案件成员');
      case 'admin':
        return t('role_admin', '系统管理员');
      case 'assistant_lawyer':
        return t('role_assistant_lawyer', '协办律师');
      case 'claim_reviewer':
        return t('role_claim_reviewer', '债权审核员');
      case 'creditor_representative':
        return t('role_creditor_representative', '债权人代表');
      default:
        return roleName;
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
                 value={formData.role ? formData.role.toString() : ''}
                 onChange={handleRoleChange}
                 label={t('role_in_case_label', '在案件中的角色')}
                 disabled={isLoadingRoles}
                 startAdornment={
                   <InputAdornment position="start">
                     {formData.role && getRoleIcon(formData.role)}
                   </InputAdornment>
                 }
               >
                 {isLoadingRoles ? (
                   <MenuItem disabled>
                     <CircularProgress size={20} />
                     <Typography sx={{ ml: 1 }}>{t('loading_roles', '加载角色中...')}</Typography>
                   </MenuItem>
                 ) : (
                   roles.map((role) => (
                     <MenuItem key={role.id.toString()} value={role.id.toString()}>
                       <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                         {getRoleIconByName(role.name)}
                         <Box>
                           <Typography variant="body2">{getRoleDisplayName(role.name)}</Typography>
                           {role.description && (
                             <Typography variant="caption" color="text.secondary">
                               {role.description}
                             </Typography>
                           )}
                         </Box>
                       </Box>
                     </MenuItem>
                   ))
                 )}
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
