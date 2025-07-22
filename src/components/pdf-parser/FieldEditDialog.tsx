import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  Stack,
  Chip,
  LinearProgress,
  Alert,
} from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ParsedField } from '@/types/pdfParser';
import { useFieldUpdate } from '@/src/hooks/usePDFParser';

interface FieldEditDialogProps {
  open: boolean;
  field: ParsedField | null;
  parseId: string;
  onClose: () => void;
  onSuccess?: () => void;
}

// 表单验证模式
const fieldEditSchema = z.object({
  value: z.string().min(1, '字段值不能为空'),
  reason: z.string().min(5, '修正原因至少需要5个字符'),
});

type FieldEditFormData = z.infer<typeof fieldEditSchema>;

const FieldEditDialog: React.FC<FieldEditDialogProps> = ({
  open,
  field,
  parseId,
  onClose,
  onSuccess,
}) => {
  const { mutate: updateField, isPending, error } = useFieldUpdate();

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isValid },
  } = useForm<FieldEditFormData>({
    resolver: zodResolver(fieldEditSchema),
    defaultValues: {
      value: '',
      reason: '',
    },
  });

  // 当字段变化时重置表单
  React.useEffect(() => {
    if (field) {
      reset({
        value: String(field.value || ''),
        reason: '',
      });
    }
  }, [field, reset]);

  // 提交表单
  const onSubmit = async (data: FieldEditFormData) => {
    if (!field) return;

    updateField({
      parseId,
      fieldName: field.name,
      fieldData: {
        value: convertValueByType(data.value, field.dataType),
        reason: data.reason,
      },
    }, {
      onSuccess: () => {
        onSuccess?.();
        onClose();
      },
    });
  };

  // 根据数据类型转换值
  const convertValueByType = (value: string, dataType: string) => {
    switch (dataType) {
      case 'number':
        return parseFloat(value) || 0;
      case 'currency':
        return parseFloat(value.replace(/[¥,]/g, '')) || 0;
      case 'percentage':
        return parseFloat(value.replace('%', '')) / 100 || 0;
      case 'boolean':
        return ['true', '1', '是', '√'].includes(value.toLowerCase());
      case 'date':
        return value; // 保持字符串格式，后端处理
      default:
        return value;
    }
  };

  // 格式化置信度颜色
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'success';
    if (confidence >= 0.8) return 'primary';
    if (confidence >= 0.6) return 'warning';
    return 'error';
  };

  // 获取输入框类型
  const getInputType = (dataType: string) => {
    switch (dataType) {
      case 'number':
      case 'currency':
        return 'number';
      case 'date':
        return 'date';
      default:
        return 'text';
    }
  };

  // 获取输入框帮助文本
  const getHelperText = (dataType: string) => {
    switch (dataType) {
      case 'currency':
        return '请输入数字金额，可包含¥符号和逗号';
      case 'percentage':
        return '请输入百分数，如：5.5% 或 5.5';
      case 'date':
        return '请输入日期，格式：YYYY-MM-DD';
      case 'number':
        return '请输入数字';
      default:
        return '';
    }
  };

  if (!field) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        编辑字段: {field.displayName}
      </DialogTitle>
      
      <DialogContent>
        <Box sx={{ mb: 3 }}>
          {/* 字段信息展示 */}
          <Stack spacing={2}>
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                原始识别值
              </Typography>
              <Typography variant="body1">
                {field.originalValue || field.value || '未识别'}
              </Typography>
            </Box>
            
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                来源文本
              </Typography>
              <Typography variant="body1">
                "{field.sourceText}"
              </Typography>
            </Box>
            
            <Box>
              <Stack direction="row" spacing={2} alignItems="center">
                <Chip
                  label={`第${field.pageNumber}页`}
                  size="small"
                  variant="outlined"
                />
                <Chip
                  label={field.dataType}
                  size="small"
                  color="primary"
                  variant="outlined"
                />
              </Stack>
            </Box>
            
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                置信度
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <LinearProgress
                  variant="determinate"
                  value={field.confidence * 100}
                  color={getConfidenceColor(field.confidence)}
                  sx={{ flex: 1, height: 8, borderRadius: 4 }}
                />
                <Typography variant="body2">
                  {Math.round(field.confidence * 100)}%
                </Typography>
              </Box>
              {field.confidence < 0.8 && (
                <Typography variant="caption" color="warning.main" sx={{ mt: 0.5 }}>
                  置信度较低，建议仔细核对
                </Typography>
              )}
            </Box>
          </Stack>
        </Box>

        {/* 编辑表单 */}
        <form onSubmit={handleSubmit(onSubmit)}>
          <Stack spacing={3}>
            <Controller
              name="value"
              control={control}
              render={({ field: formField }) => (
                <TextField
                  {...formField}
                  label="修正后的值"
                  type={getInputType(field.dataType)}
                  fullWidth
                  variant="outlined"
                  error={!!errors.value}
                  helperText={errors.value?.message || getHelperText(field.dataType)}
                  disabled={isPending}
                />
              )}
            />
            
            <Controller
              name="reason"
              control={control}
              render={({ field: formField }) => (
                <TextField
                  {...formField}
                  label="修正原因"
                  multiline
                  rows={3}
                  fullWidth
                  variant="outlined"
                  error={!!errors.reason}
                  helperText={errors.reason?.message || '请说明修正的原因'}
                  placeholder="例如：原文档识别有误，根据人工核对结果修正"
                  disabled={isPending}
                />
              )}
            />
          </Stack>
        </form>

        {/* 错误提示 */}
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            修正失败: {error.message}
          </Alert>
        )}

        {/* 修正历史 */}
        {field.isModified && (
          <Box sx={{ mt: 3, p: 2, backgroundColor: 'background.default', borderRadius: 1 }}>
            <Typography variant="subtitle2" gutterBottom>
              修正历史
            </Typography>
            <Typography variant="body2" color="text.secondary">
              修正人: {field.modifiedBy} <br />
              修正时间: {field.modifiedAt?.toLocaleString()} <br />
              修正原因: {field.modificationReason}
            </Typography>
          </Box>
        )}
      </DialogContent>
      
      <DialogActions>
        <Button
          onClick={onClose}
          disabled={isPending}
        >
          取消
        </Button>
        <Button
          onClick={handleSubmit(onSubmit)}
          variant="contained"
          disabled={!isValid || isPending}
        >
          {isPending ? '保存中...' : '保存修正'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default FieldEditDialog;