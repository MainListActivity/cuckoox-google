import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useDataService } from '@/src/contexts/SurrealProvider';
import { RecordId } from 'surrealdb';
import { useAuth } from '@/src/contexts/AuthContext';
import { useSnackbar } from '@/src/contexts/SnackbarContext';
import { addCaseMember } from '@/src/services/caseMemberService';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Grid,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
  IconButton,
  Box,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';

interface CreateCaseDialogProps {
  open: boolean;
  onClose: () => void;
  onCaseCreated?: (caseId: string, caseName: string) => void;
}

const CreateCaseDialog: React.FC<CreateCaseDialogProps> = ({ 
  open, 
  onClose, 
  onCaseCreated 
}) => {
  const { t } = useTranslation();
  const dataService = useDataService();
  const { user } = useAuth();
  const { showSuccess } = useSnackbar();

  // 案件基本信息状态
  const [caseName, setCaseName] = useState<string>('');
  const [caseLead, setCaseLead] = useState<string>('');
  const [caseProcedure, setCaseProcedure] = useState<string>('破产清算');
  const [acceptanceDate, setAcceptanceDate] = useState<string>('');
  const [announcementDate, setAnnouncementDate] = useState<string>('');
  const [claimStartDate, setClaimStartDate] = useState<string>('');
  const [claimEndDate, setClaimEndDate] = useState<string>('');

  // Auto-calculation flags
  const [isAnnouncementDateAuto, setIsAnnouncementDateAuto] = useState(true);
  const [isClaimStartDateAuto, setIsClaimStartDateAuto] = useState(true);
  const [isClaimEndDateAuto, setIsClaimEndDateAuto] = useState(true);

  // 状态管理
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Determine if bankruptcy-specific fields should be shown
  const showBankruptcyFields = caseProcedure === '破产清算' || caseProcedure === '破产重整' || caseProcedure === '破产和解';

  // Auto-calculate dates based on acceptance date
  useEffect(() => {
    if (!acceptanceDate) {
      setAnnouncementDate('');
      setClaimStartDate('');
      setClaimEndDate('');
      setIsAnnouncementDateAuto(true);
      setIsClaimStartDateAuto(true);
      setIsClaimEndDateAuto(true);
      return;
    }

    if (showBankruptcyFields && isAnnouncementDateAuto) {
      const calculatedDate = addDays(acceptanceDate, 25);
      setAnnouncementDate(calculatedDate);
    }
  }, [acceptanceDate, caseProcedure, showBankruptcyFields, isAnnouncementDateAuto]);

  useEffect(() => {
    if (!announcementDate || !showBankruptcyFields) {
      if (showBankruptcyFields) {
        setClaimStartDate('');
        setClaimEndDate('');
        setIsClaimStartDateAuto(true);
        setIsClaimEndDateAuto(true);
      }
      return;
    }

    if (isClaimStartDateAuto) {
      const calculatedStartDate = addDays(announcementDate, 30);
      setClaimStartDate(calculatedStartDate);
    }
    if (isClaimEndDateAuto) {
      const calculatedEndDate = addMonths(announcementDate, 3);
      setClaimEndDate(calculatedEndDate);
    }
  }, [announcementDate, caseProcedure, showBankruptcyFields, isClaimStartDateAuto, isClaimEndDateAuto]);

  // Helper functions
  const addDays = (dateString: string, days: number): string => {
    if (!dateString) return '';
    const date = new Date(dateString);
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
  };

  const addMonths = (dateString: string, months: number): string => {
    if (!dateString) return '';
    const date = new Date(dateString);
    date.setMonth(date.getMonth() + months);
    return date.toISOString().split('T')[0];
  };

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setCaseName(`示例案件 ${Date.now()}`);
      setCaseLead('');
      setCaseProcedure('破产清算');
      setAcceptanceDate('');
      setAnnouncementDate('');
      setClaimStartDate('');
      setClaimEndDate('');
      setIsAnnouncementDateAuto(true);
      setIsClaimStartDateAuto(true);
      setIsClaimEndDateAuto(true);
      setError(null);
    }
  }, [open]);

  const handleSave = async () => {
    if (!dataService) {
      setError(t('create_case_error_no_connection', '数据库连接失败'));
      return;
    }
    
    setError(null);

    // Validate required fields
    if (!caseName.trim() || !acceptanceDate) {
      setError(t('create_case_error_required_fields', '请填写所有必填字段：案件名称和受理时间。'));
      return;
    }

    // Generate case number with timestamp
    const timestamp = Date.now();
    const generatedCaseNumber = `BK-${new Date().getFullYear()}-${timestamp.toString().slice(-6)}`;
    console.log('typeof user?.id===typeof RecordId',user?.id instanceof RecordId)
    // Convert date strings to Date objects for SurrealDB
    const caseData: any = {
      name: caseName.trim(),
      case_number: generatedCaseNumber,
      case_manager_name: caseLead.trim() || user?.name || t('unassigned', '未分配'),
      case_procedure: caseProcedure,
      acceptance_date: new Date(acceptanceDate + 'T00:00:00Z'),
      procedure_phase: '立案',
      created_by_user: user?.id,
      case_lead_user_id: user?.id,
    };

    // Add optional date fields if they exist (for bankruptcy cases)
    if (showBankruptcyFields) {
      if (announcementDate) {
        caseData.announcement_date = new Date(announcementDate + 'T00:00:00Z');
      }
      if (claimStartDate) {
        caseData.claim_submission_start_date = new Date(claimStartDate + 'T00:00:00Z');
      }
      if (claimEndDate) {
        caseData.claim_submission_end_date = new Date(claimEndDate + 'T00:00:00Z');
      }
    }

    console.log("Creating case:", caseData);

    setIsSaving(true);
    try {
      const createdCase = await dataService.create('case', caseData);
      console.log('Case created:', createdCase);
      
      let newCaseIdString: string | null = null;
      if (Array.isArray(createdCase) && createdCase[0]?.id) {
        newCaseIdString = typeof createdCase[0].id === 'string'
          ? createdCase[0].id 
          : createdCase[0].id.toString();
      } else if (createdCase && (createdCase as any).id) {
        newCaseIdString = typeof (createdCase as any).id === 'string'
          ? (createdCase as any).id 
          : (createdCase as any).id.toString();
      }

      if (newCaseIdString && user && user.id) {
        try {
          // Add current user as owner to this new case
          await addCaseMember(
            dataService,
            new RecordId('case', newCaseIdString),
            user.id, // user.id已经是RecordId类型
            user.name,
            user.email,
            undefined,
            [new RecordId('role', 'owner')] // roleIds应该是数组
          );
          console.log(`Successfully added user ${user.id.toString()} as owner to case ${newCaseIdString}`);
        } catch (memberError) {
          console.error(`Failed to add creator as case owner for ${newCaseIdString}:`, memberError);
          // Continue even if adding member fails
        }

        // Extract case ID (remove prefix)
        const caseId = newCaseIdString.replace('case:', '');
        
        showSuccess(t('create_case_success', '案件创建成功！'));
        
        // Notify parent component
        if (onCaseCreated) {
          onCaseCreated(caseId, caseName.trim());
        }
        
        // Close dialog
        onClose();
        
      } else {
        if (!newCaseIdString) throw new Error('Failed to get case ID from created record');
        if (!user || !user.id) throw new Error('Current user not available to be set as case owner');
      }
    } catch (e) {
      console.error('Error creating case:', e);
      const errorMessage = e instanceof Error ? e.message : String(e);
      
      if (errorMessage.includes('datetime') || errorMessage.includes('date')) {
        setError(t('create_case_error_date_format', '日期格式错误，请检查日期字段。'));
      } else if (errorMessage.includes('permission') || errorMessage.includes('auth')) {
        setError(t('create_case_error_permission', '您没有权限创建案件。'));
      } else {
        setError(t('create_case_error_generic', '创建案件失败，请稍后重试。'));
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleInputChange = () => {
    if (error) {
      setError(null);
    }
  };

  const handleClose = () => {
    if (!isSaving) {
      onClose();
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 2 }
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h5" component="div">
            {t('create_new_case', '创建新案件')}
          </Typography>
          <IconButton 
            onClick={handleClose}
            disabled={isSaving}
            sx={{ color: 'text.secondary' }}
          >
            <CloseIcon />
          </IconButton>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {t('create_case_dialog_desc', '请填写案件的基本信息。创建后，您可以在案件详情页面编辑立案材料。')}
        </Typography>
      </DialogTitle>

      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label={t('create_case_case_name_label', '案件名称')}
              value={caseName}
              onChange={(e) => { setCaseName(e.target.value); handleInputChange(); }}
              fullWidth
              variant="outlined"
              required
              disabled={isSaving}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label={t('create_case_lead_label', '案件负责人')}
              value={caseLead}
              onChange={(e) => { setCaseLead(e.target.value); handleInputChange(); }}
              fullWidth
              variant="outlined"
              disabled={isSaving}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <FormControl fullWidth variant="outlined" required disabled={isSaving}>
              <InputLabel>{t('create_case_procedure_label', '案件程序')}</InputLabel>
              <Select
                value={caseProcedure}
                onChange={(e) => { 
                  setCaseProcedure(e.target.value as string); 
                  handleInputChange();
                  setIsAnnouncementDateAuto(true);
                  setIsClaimStartDateAuto(true);
                  setIsClaimEndDateAuto(true);
                }}
                label={t('create_case_procedure_label', '案件程序')}
              >
                <MenuItem value="破产清算">{t('procedure_liquidation', '破产清算')}</MenuItem>
                <MenuItem value="破产重整">{t('procedure_reorganization', '破产重整')}</MenuItem>
                <MenuItem value="破产和解">{t('procedure_composition', '破产和解')}</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label={t('create_case_acceptance_date_label', '受理时间')}
              type="date"
              value={acceptanceDate}
              onChange={(e) => { 
                setAcceptanceDate(e.target.value); 
                handleInputChange();
                if (!e.target.value) {
                  setAnnouncementDate('');
                  setClaimStartDate('');
                  setClaimEndDate('');
                }
                setIsAnnouncementDateAuto(true);
              }}
              fullWidth
              variant="outlined"
              InputLabelProps={{ shrink: true }}
              required
              disabled={isSaving}
            />
          </Grid>

          {showBankruptcyFields && (
            <>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  label={t('create_case_announcement_date_label', '公告时间')}
                  type="date"
                  value={announcementDate}
                  onChange={(e) => { 
                    setAnnouncementDate(e.target.value); 
                    setIsAnnouncementDateAuto(false);
                    if (!e.target.value) {
                      setClaimStartDate('');
                      setClaimEndDate('');
                      setIsClaimStartDateAuto(true);
                      setIsClaimEndDateAuto(true);
                    } else {
                      setIsClaimStartDateAuto(true); 
                      setIsClaimEndDateAuto(true);
                    }
                    handleInputChange();
                  }}
                  fullWidth
                  variant="outlined"
                  InputLabelProps={{ shrink: true }}
                  helperText={t('create_case_announcement_date_hint', '最迟受理破产申请之日起25日')}
                  disabled={isSaving}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  label={t('create_case_claim_start_date_label', '债权申报开始时间')}
                  type="date"
                  value={claimStartDate}
                  onChange={(e) => { 
                    setClaimStartDate(e.target.value); 
                    setIsClaimStartDateAuto(false);
                    handleInputChange();
                  }}
                  fullWidth
                  variant="outlined"
                  InputLabelProps={{ shrink: true }}
                  helperText={t('create_case_claim_start_date_hint', '公告之日起不得少于30日')}
                  disabled={isSaving}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  label={t('create_case_claim_end_date_label', '债权申报截止时间')}
                  type="date"
                  value={claimEndDate}
                  onChange={(e) => { 
                    setClaimEndDate(e.target.value); 
                    setIsClaimEndDateAuto(false);
                    handleInputChange();
                  }}
                  fullWidth
                  variant="outlined"
                  InputLabelProps={{ shrink: true }}
                  helperText={t('create_case_claim_end_date_hint', '公告之日起不得超过3个月')}
                  disabled={isSaving}
                />
              </Grid>
            </>
          )}
        </Grid>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button 
          onClick={handleClose}
          disabled={isSaving}
          color="inherit"
        >
          {t('cancel', '取消')}
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={isSaving || !caseName.trim() || !acceptanceDate}
          startIcon={isSaving ? <CircularProgress size={20} color="inherit" /> : undefined}
        >
          {isSaving ? t('creating_case', '创建中...') : t('create_case', '创建案件')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CreateCaseDialog; 