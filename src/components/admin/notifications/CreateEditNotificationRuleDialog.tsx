import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Typography,
  Box,
  Grid,
  Stack,
  useTheme,
  MenuItem,
  InputAdornment,
} from '@mui/material';
import { NotificationRule, NotificationRuleInput, NotificationRuleTimingCondition } from '../../../services/adminNotificationRuleService';

// Props for the Dialog component
export interface CreateEditNotificationRuleDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (ruleData: NotificationRuleInput) => void; // Parent handles if it's create or update
  initialData?: NotificationRule | null;
  // For select dropdowns - these would ideally come from a shared config or context
  caseStatuses: string[];
  caseDateFields: string[];
}

const CreateEditNotificationRuleDialog: React.FC<CreateEditNotificationRuleDialogProps> = ({
  open,
  onClose,
  onSave,
  initialData,
  caseStatuses,
  caseDateFields,
}) => {
  const theme = useTheme();

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [caseStatusTrigger, setCaseStatusTrigger] = useState('');
  
  const [timing_caseDateField, setTiming_caseDateField] = useState<string | undefined>(undefined);
  const [timing_offsetDays, setTiming_offsetDays] = useState<number | string>(''); // string to allow empty input
  const [timing_comparisonOperator, setTiming_comparisonOperator] = useState<'<=' | '>=' | '==' | undefined>(undefined);
  const [timing_comparisonValue, setTiming_comparisonValue] = useState<number | string>(''); // string to allow empty input
  const [timing_triggerType, setTiming_triggerType] = useState<NotificationRuleTimingCondition['triggerType']>('daily_check_offset_from_date');
  
  const [frequencyDescription, setFrequencyDescription] = useState('');
  const [messageTemplate, setMessageTemplate] = useState('');
  const [isEnabled, setIsEnabled] = useState(true);

  const [nameError, setNameError] = useState('');
  const [statusTriggerError, setStatusTriggerError] = useState('');
  const [messageTemplateError, setMessageTemplateError] = useState('');


  useEffect(() => {
    if (open) {
      if (initialData) {
        setName(initialData.name);
        setDescription(initialData.description || '');
        setCaseStatusTrigger(initialData.caseStatusTrigger);
        
        const tc = initialData.timingCondition;
        setTiming_caseDateField(tc.caseDateField || undefined);
        setTiming_offsetDays(tc.offsetDays === undefined ? '' : tc.offsetDays);
        setTiming_comparisonOperator(tc.comparisonOperator || undefined);
        setTiming_comparisonValue(tc.comparisonValue === undefined ? '' : tc.comparisonValue);
        setTiming_triggerType(tc.triggerType);

        setFrequencyDescription(initialData.frequencyDescription);
        setMessageTemplate(initialData.messageTemplate);
        setIsEnabled(initialData.isEnabled);
      } else {
        // Reset to defaults for new rule
        setName('');
        setDescription('');
        setCaseStatusTrigger('');
        setTiming_caseDateField(undefined);
        setTiming_offsetDays('');
        setTiming_comparisonOperator(undefined);
        setTiming_comparisonValue('');
        setTiming_triggerType('daily_check_offset_from_date');
        setFrequencyDescription('每日检查');
        setMessageTemplate('');
        setIsEnabled(true);
      }
      setNameError('');
      setStatusTriggerError('');
      setMessageTemplateError('');
    }
  }, [open, initialData]);

  const validate = (): boolean => {
    let isValid = true;
    if (!name.trim()) {
      setNameError('规则名称不能为空');
      isValid = false;
    } else {
      setNameError('');
    }
    if (!caseStatusTrigger) {
      setStatusTriggerError('触发状态不能为空');
      isValid = false;
    } else {
      setStatusTriggerError('');
    }
    if (!messageTemplate.trim()) {
        setMessageTemplateError('消息模板不能为空');
        isValid = false;
    } else {
        setMessageTemplateError('');
    }
    return isValid;
  }

  const handleSave = () => {
    if (!validate()) {
      return;
    }

    const timingCondition: NotificationRuleTimingCondition = {
      triggerType: timing_triggerType,
      caseDateField: timing_caseDateField || undefined, // Ensure empty string becomes undefined
      offsetDays: timing_offsetDays === '' ? undefined : Number(timing_offsetDays),
      comparisonOperator: timing_triggerType === 'daily_check_offset_from_date' && timing_caseDateField ? timing_comparisonOperator : undefined,
      comparisonValue: timing_triggerType === 'daily_check_offset_from_date' && timing_caseDateField ? (timing_comparisonValue === '' ? undefined : Number(timing_comparisonValue)) : undefined,
    };
    
    // Ensure comparison fields are undefined if not relevant
    if (timing_triggerType === 'on_status_change' || !timing_caseDateField) {
        timingCondition.comparisonOperator = undefined;
        timingCondition.comparisonValue = undefined;
        timingCondition.offsetDays = undefined; // Offset days might not be relevant if no date field for daily_check
    }


    const ruleDataToSave: NotificationRuleInput = {
      id: initialData?.id, // Include id if editing
      name: name.trim(),
      description: description.trim() || undefined,
      caseStatusTrigger,
      timingCondition,
      frequencyDescription: frequencyDescription.trim(),
      messageTemplate: messageTemplate.trim(),
      isEnabled,
    };
    onSave(ruleDataToSave);
  };

  const isEditing = initialData != null;
  const showDateOffsetFields = timing_triggerType === 'daily_check_offset_from_date';
  const showComparisonFields = showDateOffsetFields && !!timing_caseDateField;


  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ borderBottom: `1px solid ${theme.palette.divider}` }}>
        {isEditing ? '编辑通知规则' : '创建新通知规则'}
      </DialogTitle>
      <DialogContent sx={{ py: 2.5 }}>
        <Stack spacing={3} sx={{mt:1}}>
          <TextField
            autoFocus
            label="规则名称"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            error={!!nameError}
            helperText={nameError || "例如：'受理后25日未公告提醒'"}
            fullWidth
          />
          <TextField
            label="规则描述 (可选)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            multiline
            rows={2}
            fullWidth
          />
          <TextField
            select
            label="案件状态触发器"
            value={caseStatusTrigger}
            onChange={(e) => setCaseStatusTrigger(e.target.value)}
            required
            error={!!statusTriggerError}
            helperText={statusTriggerError || "当案件进入此状态时，规则可能被激活"}
            fullWidth
          >
            {caseStatuses.map((status) => (
              <MenuItem key={status} value={status}>
                {status}
              </MenuItem>
            ))}
          </TextField>

          <Typography variant="subtitle1" sx={{ fontWeight: 'medium', pt:1, borderTop: `1px dashed ${theme.palette.divider}` }}>触发详细条件</Typography>
          <TextField
            select
            label="触发类型"
            value={timing_triggerType}
            onChange={(e) => setTiming_triggerType(e.target.value as NotificationRuleTimingCondition['triggerType'])}
            helperText="选择规则如何被触发"
            fullWidth
          >
            <MenuItem value="daily_check_offset_from_date">基于日期字段偏移量的每日检查</MenuItem>
            <MenuItem value="on_status_change">状态变更时立即检查</MenuItem>
          </TextField>

          {showDateOffsetFields && (
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  select
                  label="相关日期字段 (可选)"
                  value={timing_caseDateField || ''}
                  onChange={(e) => setTiming_caseDateField(e.target.value || undefined)}
                  helperText="规则计算基于哪个案件日期"
                  fullWidth
                >
                  <MenuItem value=""><em>无特定日期字段</em></MenuItem>
                  {caseDateFields.map((field) => (
                    <MenuItem key={field} value={field}>
                      {field}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                 <TextField
                    label="偏移天数 (可选)"
                    type="number"
                    value={timing_offsetDays}
                    onChange={(e) => setTiming_offsetDays(e.target.value)}
                    helperText="例如: -5 (提前5天), 25 (之后25天)"
                    fullWidth
                    InputProps={{
                        startAdornment: <InputAdornment position="start">天</InputAdornment>,
                    }}
                    disabled={!timing_caseDateField} // Disable if no date field selected
                    />
              </Grid>
            </Grid>
          )}

          {showComparisonFields && (
            <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                    <TextField
                    select
                    label="比较操作符 (可选)"
                    value={timing_comparisonOperator || ''}
                    onChange={(e) => setTiming_comparisonOperator(e.target.value as any || undefined)}
                    helperText="用于 '剩余天数' 或 '已过天数' 的比较"
                    fullWidth
                    >
                    <MenuItem value=""><em>无比较</em></MenuItem>
                    <MenuItem value="<=">&lt;= (小于等于)</MenuItem>
                    <MenuItem value=">=">&gt;= (大于等于)</MenuItem>
                    <MenuItem value="==">== (等于)</MenuItem>
                    </TextField>
                </Grid>
                <Grid item xs={12} sm={6}>
                    <TextField
                    label="比较值 (可选)"
                    type="number"
                    value={timing_comparisonValue}
                    onChange={(e) => setTiming_comparisonValue(e.target.value)}
                    helperText="与操作符一起使用的数值"
                    fullWidth
                    />
                </Grid>
            </Grid>
          )}


          <Typography variant="subtitle1" sx={{ fontWeight: 'medium', pt:1, borderTop: `1px dashed ${theme.palette.divider}` }}>通知与启用</Typography>
          <TextField
            label="执行频率描述"
            value={frequencyDescription}
            onChange={(e) => setFrequencyDescription(e.target.value)}
            helperText="例如: '每日上午9点检查', '状态变更时一次性'"
            fullWidth
          />
          <TextField
            label="消息模板"
            value={messageTemplate}
            onChange={(e) => setMessageTemplate(e.target.value)}
            multiline
            rows={3}
            required
            error={!!messageTemplateError}
            helperText={messageTemplateError || "例如: '案件 {caseName} 距离 {dateField} 还有 {daysRemaining} 天。请注意处理。' 可用占位符: {caseName}, {caseId}, {dateField}, {daysRemaining}, {daysPassed}"}
            fullWidth
          />
          <FormGroup>
            <FormControlLabel
              control={<Checkbox checked={isEnabled} onChange={(e) => setIsEnabled(e.target.checked)} />}
              label="启用此规则"
            />
          </FormGroup>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ borderTop: `1px solid ${theme.palette.divider}`, px:3, py:2 }}>
        <Button onClick={onClose} variant="outlined" color="secondary">取消</Button>
        <Button onClick={handleSave} variant="contained" color="primary">保存规则</Button>
      </DialogActions>
    </Dialog>
  );
};

export default CreateEditNotificationRuleDialog;
