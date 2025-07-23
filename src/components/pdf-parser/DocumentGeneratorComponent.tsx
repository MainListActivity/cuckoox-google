import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  Typography,
  Grid,
  Button,
  Box,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  TextField,
  Checkbox,
  FormControlLabel,
  List,
  ListItem,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Paper,
  Tooltip,
  CircularProgress,
  FormGroup,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Preview as PreviewIcon,
  Download as DownloadIcon,
  EditDocument as TemplateIcon,
  Assignment as AssignmentIcon,
} from '@mui/icons-material';
import RichTextEditor from '@/src/components/RichTextEditor/RichTextEditor';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { ParseResult } from '@/src/types/pdfParser';
import type { QuillDelta } from '@/src/components/RichTextEditor/types';

// 文档模板定义
interface DocumentTemplate {
  id: string;
  name: string;
  description: string;
  category: 'legal' | 'financial' | 'administrative' | 'custom';
  content: QuillDelta;
  fieldPlaceholders: Record<string, string>; // field name -> placeholder text
  isDefault: boolean;
  isCustom: boolean;
}

// 字段映射配置
interface FieldMapping {
  fieldName: string;
  fieldDisplayName: string;
  placeholderText: string;
  isIncluded: boolean;
  customFormat?: string;
  validation?: {
    required: boolean;
    format?: 'currency' | 'date' | 'percentage' | 'text' | 'number';
  };
}

// 文档生成参数
const documentGenerationSchema = z.object({
  templateId: z.string().min(1, '请选择文档模板'),
  title: z.string().min(1, '请输入文档标题'),
  description: z.string().optional(),
  includeMetadata: z.boolean(),
  includeSignature: z.boolean(),
  outputFormat: z.enum(['quill', 'html', 'pdf']),
});

type DocumentGenerationForm = z.infer<typeof documentGenerationSchema>;

// 组件Props
interface DocumentGeneratorComponentProps {
  parseResult: ParseResult | null;
  onDocumentGenerated?: (document: GeneratedDocument) => void;
  onDocumentSaved?: (documentId: string) => void;
}

// 生成的文档接口
interface GeneratedDocument {
  id: string;
  title: string;
  content: QuillDelta;
  htmlContent: string;
  fieldMappings: FieldMapping[];
  templateUsed: string;
  generatedAt: Date;
  parseResultId?: string;
}

// 预定义模板
const defaultTemplates: DocumentTemplate[] = [
  {
    id: 'debt-claim',
    name: '债权申报书',
    description: '用于破产案件中的债权申报',
    category: 'legal',
    content: {
      ops: [
        { insert: '债权申报书\n', attributes: { header: 1, align: 'center' } },
        { insert: '\n案件名称：' },
        { insert: '{{case_name}}', attributes: { background: '#e3f2fd', bold: true } },
        { insert: '\n案件编号：' },
        { insert: '{{case_number}}', attributes: { background: '#e3f2fd', bold: true } },
        { insert: '\n\n申报人信息\n', attributes: { header: 2 } },
        { insert: '债权人名称：' },
        { insert: '{{creditor_name}}', attributes: { background: '#e8f5e8', bold: true } },
        { insert: '\n债权金额：' },
        { insert: '{{debt_amount}}', attributes: { background: '#fff3e0', bold: true } },
        { insert: '\n债权性质：' },
        { insert: '{{debt_type}}', attributes: { background: '#fce4ec', bold: true } },
        { insert: '\n\n债权详情\n', attributes: { header: 2 } },
        { insert: '本金：' },
        { insert: '{{principal_amount}}', attributes: { background: '#fff3e0', bold: true } },
        { insert: '\n利息：' },
        { insert: '{{interest_amount}}', attributes: { background: '#fff3e0', bold: true } },
        { insert: '\n违约金：' },
        { insert: '{{penalty_amount}}', attributes: { background: '#fff3e0', bold: true } },
        { insert: '\n\n' },
        { insert: '申报人：{{creditor_name}}\n日期：{{application_date}}', attributes: { align: 'right' } },
      ]
    },
    fieldPlaceholders: {
      case_name: '案件名称',
      case_number: '案件编号',
      creditor_name: '债权人名称',
      debt_amount: '债权总额',
      debt_type: '债权性质',
      principal_amount: '本金金额',
      interest_amount: '利息金额',
      penalty_amount: '违约金金额',
      application_date: '申报日期',
    },
    isDefault: true,
    isCustom: false,
  },
  {
    id: 'contract-analysis',
    name: '合同分析报告',
    description: '基于PDF解析结果的合同分析',
    category: 'legal',
    content: {
      ops: [
        { insert: '合同分析报告\n', attributes: { header: 1, align: 'center' } },
        { insert: '\n基本信息\n', attributes: { header: 2 } },
        { insert: '合同名称：' },
        { insert: '{{contract_title}}', attributes: { background: '#e3f2fd', bold: true } },
        { insert: '\n合同编号：' },
        { insert: '{{contract_number}}', attributes: { background: '#e3f2fd', bold: true } },
        { insert: '\n签订日期：' },
        { insert: '{{signing_date}}', attributes: { background: '#e8f5e8', bold: true } },
        { insert: '\n\n当事方信息\n', attributes: { header: 2 } },
        { insert: '甲方：' },
        { insert: '{{party_a}}', attributes: { background: '#fff3e0', bold: true } },
        { insert: '\n乙方：' },
        { insert: '{{party_b}}', attributes: { background: '#fff3e0', bold: true } },
        { insert: '\n\n金额条款\n', attributes: { header: 2 } },
        { insert: '合同金额：' },
        { insert: '{{contract_amount}}', attributes: { background: '#fce4ec', bold: true } },
        { insert: '\n付款方式：' },
        { insert: '{{payment_method}}', attributes: { background: '#f3e5f5', bold: true } },
        { insert: '\n\n风险提示\n', attributes: { header: 2 } },
        { insert: '基于AI解析结果，请注意核实以上信息的准确性。\n' },
      ]
    },
    fieldPlaceholders: {
      contract_title: '合同标题',
      contract_number: '合同编号',
      signing_date: '签订日期',
      party_a: '甲方名称',
      party_b: '乙方名称',
      contract_amount: '合同金额',
      payment_method: '付款方式',
    },
    isDefault: true,
    isCustom: false,
  },
];

const DocumentGeneratorComponent: React.FC<DocumentGeneratorComponentProps> = ({
  parseResult,
  onDocumentGenerated,
  onDocumentSaved,
}) => {
  // 状态管理
  const [activeStep, setActiveStep] = useState(0);
  const [templates] = useState<DocumentTemplate[]>(defaultTemplates);
  const [selectedTemplate, setSelectedTemplate] = useState<DocumentTemplate | null>(null);
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([]);
  const [generatedDocument, setGeneratedDocument] = useState<GeneratedDocument | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);

  // 富文本编辑器引用
  const editorRef = useRef<any>(null);

  // 表单控制
  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isValid },
  } = useForm<DocumentGenerationForm>({
    resolver: zodResolver(documentGenerationSchema),
    defaultValues: {
      templateId: '',
      title: '',
      description: '',
      includeMetadata: true,
      includeSignature: false,
      outputFormat: 'quill',
    },
    mode: 'onChange',
  });

  const _watchedValues = watch();

  // 初始化字段映射
  useEffect(() => {
    if (parseResult && selectedTemplate) {
      const mappings: FieldMapping[] = [];
      
      // 从解析结果创建字段映射
      parseResult.fields.forEach(field => {
        const placeholderKey = Object.keys(selectedTemplate.fieldPlaceholders).find(key => 
          key.toLowerCase().includes(field.name.toLowerCase()) ||
          field.name.toLowerCase().includes(key.toLowerCase())
        );

        mappings.push({
          fieldName: field.name,
          fieldDisplayName: field.displayName,
          placeholderText: placeholderKey ? `{{${placeholderKey}}}` : `{{${field.name}}}`,
          isIncluded: field.confidence > 0.8, // 高置信度字段默认包含
          validation: {
            required: field.confidence > 0.9,
            format: field.dataType === 'currency' ? 'currency' : 
                   field.dataType === 'date' ? 'date' :
                   field.dataType === 'percentage' ? 'percentage' :
                   field.dataType === 'number' ? 'number' : 'text',
          },
        });
      });

      setFieldMappings(mappings);
    }
  }, [parseResult, selectedTemplate]);

  // 步骤控制
  const handleNext = () => {
    setActiveStep(prev => prev + 1);
  };

  const handleBack = () => {
    setActiveStep(prev => prev - 1);
  };

  // 模板选择处理
  const handleTemplateSelect = (template: DocumentTemplate) => {
    setSelectedTemplate(template);
    setValue('templateId', template.id);
    setValue('title', template.name);
    handleNext();
  };

  // 字段映射更新
  const updateFieldMapping = (index: number, updates: Partial<FieldMapping>) => {
    setFieldMappings(prev => prev.map((mapping, i) => 
      i === index ? { ...mapping, ...updates } : mapping
    ));
  };

  // 生成文档内容
  const generateDocumentContent = useCallback((
    template: DocumentTemplate,
    mappings: FieldMapping[],
    formData: DocumentGenerationForm
  ): QuillDelta => {
    if (!parseResult) return template.content;

    // 创建字段值映射
    const fieldValues: Record<string, any> = {};
    parseResult.fields.forEach(field => {
      const mapping = mappings.find(m => m.fieldName === field.name);
      if (mapping && mapping.isIncluded) {
        const key = mapping.placeholderText.replace(/[{}]/g, '');
        let value = field.value;

        // 根据验证格式化值
        if (mapping.validation?.format === 'currency' && typeof value === 'number') {
          value = new Intl.NumberFormat('zh-CN', {
            style: 'currency',
            currency: 'CNY'
          }).format(value);
        } else if (mapping.validation?.format === 'date' && value instanceof Date) {
          value = value.toLocaleDateString('zh-CN');
        } else if (mapping.validation?.format === 'percentage' && typeof value === 'number') {
          value = `${(value * 100).toFixed(2)}%`;
        }

        fieldValues[key] = value;
      }
    });

    // 添加元数据
    if (formData.includeMetadata) {
      fieldValues['generation_date'] = new Date().toLocaleDateString('zh-CN');
      fieldValues['document_title'] = formData.title;
      fieldValues['parse_result_id'] = parseResult.id;
    }

    // 替换模板中的占位符
    const newOps = template.content.ops?.map(op => {
      if (typeof op.insert === 'string') {
        let text = op.insert;
        Object.entries(fieldValues).forEach(([key, value]) => {
          const placeholder = `{{${key}}}`;
          if (text.includes(placeholder)) {
            text = text.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), String(value || ''));
          }
        });
        return { ...op, insert: text };
      }
      return op;
    }) || [];

    return { ops: newOps };
  }, [parseResult]);

  // 提交表单并生成文档
  const onSubmit = async (data: DocumentGenerationForm) => {
    if (!selectedTemplate || !parseResult) return;

    setIsGenerating(true);
    try {
      const content = generateDocumentContent(selectedTemplate, fieldMappings, data);
      
      const document: GeneratedDocument = {
        id: `doc_${Date.now()}`,
        title: data.title,
        content,
        htmlContent: '', // 将由编辑器填充
        fieldMappings,
        templateUsed: selectedTemplate.id,
        generatedAt: new Date(),
        parseResultId: parseResult.id,
      };

      setGeneratedDocument(document);
      onDocumentGenerated?.(document);
      handleNext();
    } catch (error) {
      console.error('文档生成失败:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  // 保存文档
  const handleSaveDocument = useCallback(async (content: QuillDelta) => {
    if (!generatedDocument) return;

    try {
      // 更新文档内容
      const updatedDocument = {
        ...generatedDocument,
        content,
        htmlContent: editorRef.current?.root.innerHTML || '',
      };
      setGeneratedDocument(updatedDocument);
      
      // 触发保存回调
      onDocumentSaved?.(updatedDocument.id);
      
      console.log('文档保存成功');
    } catch (error) {
      console.error('文档保存失败:', error);
    }
  }, [generatedDocument, onDocumentSaved]);

  // 导出文档
  const handleExportDocument = () => {
    if (!generatedDocument) return;

    const exportData = {
      ...generatedDocument,
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
      type: 'application/json' 
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${generatedDocument.title}_${new Date().toLocaleDateString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const _steps = ['选择模板', '配置字段', '生成文档', '编辑完善'];

  return (
    <Card>
      <CardHeader
        title="文档生成器"
        subheader="基于PDF解析结果生成结构化文档"
        action={
          generatedDocument && (
            <Tooltip title="导出文档">
              <IconButton onClick={handleExportDocument}>
                <DownloadIcon />
              </IconButton>
            </Tooltip>
          )
        }
      />
      <CardContent>
        <Stepper activeStep={activeStep} orientation="vertical">
          {/* 步骤1: 选择模板 */}
          <Step>
            <StepLabel>选择文档模板</StepLabel>
            <StepContent>
              <Grid container spacing={2}>
                {templates.map((template) => (
                  <Grid size={{ xs: 12, md: 6 }} key={template.id}>
                    <Card 
                      variant="outlined" 
                      sx={{ 
                        cursor: 'pointer',
                        border: selectedTemplate?.id === template.id ? 2 : 1,
                        borderColor: selectedTemplate?.id === template.id ? 'primary.main' : 'divider',
                      }}
                      onClick={() => handleTemplateSelect(template)}
                    >
                      <CardContent>
                        <Box display="flex" alignItems="center" gap={1} mb={1}>
                          <TemplateIcon color="primary" />
                          <Typography variant="h6">{template.name}</Typography>
                          <Chip 
                            label={template.category} 
                            size="small" 
                            color="primary" 
                            variant="outlined" 
                          />
                        </Box>
                        <Typography variant="body2" color="textSecondary">
                          {template.description}
                        </Typography>
                        <Box mt={1}>
                          <Typography variant="caption">
                            包含 {Object.keys(template.fieldPlaceholders).length} 个字段占位符
                          </Typography>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
              <Box mt={2}>
                <Button
                  variant="outlined"
                  startIcon={<AddIcon />}
                  onClick={() => setShowTemplateDialog(true)}
                >
                  创建自定义模板
                </Button>
              </Box>
            </StepContent>
          </Step>

          {/* 步骤2: 配置字段 */}
          <Step>
            <StepLabel>配置字段映射</StepLabel>
            <StepContent>
              <form onSubmit={handleSubmit(onSubmit)}>
                <Grid container spacing={3}>
                  <Grid size={12}>
                    <Controller
                      name="title"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          label="文档标题"
                          fullWidth
                          error={!!errors.title}
                          helperText={errors.title?.message}
                        />
                      )}
                    />
                  </Grid>

                  <Grid size={12}>
                    <Controller
                      name="description"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          label="文档描述"
                          fullWidth
                          multiline
                          rows={2}
                        />
                      )}
                    />
                  </Grid>

                  <Grid size={12}>
                    <Typography variant="h6" gutterBottom>
                      字段映射配置
                    </Typography>
                    <Alert severity="info" sx={{ mb: 2 }}>
                      选择要包含在生成文档中的解析字段，并配置其在模板中的映射关系。
                    </Alert>
                  </Grid>

                  <Grid size={12}>
                    <List>
                      {fieldMappings.map((mapping, index) => (
                        <ListItem key={index} divider>
                          <ListItemText
                            primary={
                              <Box display="flex" alignItems="center" gap={2}>
                                <FormControlLabel
                                  control={
                                    <Checkbox
                                      checked={mapping.isIncluded}
                                      onChange={(e) => updateFieldMapping(index, { 
                                        isIncluded: e.target.checked 
                                      })}
                                    />
                                  }
                                  label={mapping.fieldDisplayName}
                                />
                                {parseResult?.fields.find(f => f.name === mapping.fieldName) && (
                                  <Chip
                                    label={`置信度: ${(parseResult.fields.find(f => f.name === mapping.fieldName)!.confidence * 100).toFixed(1)}%`}
                                    size="small"
                                    color={parseResult.fields.find(f => f.name === mapping.fieldName)!.confidence > 0.8 ? 'success' : 'warning'}
                                  />
                                )}
                              </Box>
                            }
                            secondary={
                              <Box mt={1}>
                                <TextField
                                  label="模板占位符"
                                  value={mapping.placeholderText}
                                  onChange={(e) => updateFieldMapping(index, { 
                                    placeholderText: e.target.value 
                                  })}
                                  size="small"
                                  disabled={!mapping.isIncluded}
                                />
                                <TextField
                                  label="自定义格式"
                                  value={mapping.customFormat || ''}
                                  onChange={(e) => updateFieldMapping(index, { 
                                    customFormat: e.target.value 
                                  })}
                                  size="small"
                                  disabled={!mapping.isIncluded}
                                  sx={{ ml: 1 }}
                                />
                              </Box>
                            }
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Grid>

                  <Grid size={12}>
                    <Typography variant="h6" gutterBottom>
                      生成选项
                    </Typography>
                    <FormGroup row>
                      <Controller
                        name="includeMetadata"
                        control={control}
                        render={({ field }) => (
                          <FormControlLabel
                            control={<Checkbox {...field} checked={field.value} />}
                            label="包含元数据"
                          />
                        )}
                      />
                      <Controller
                        name="includeSignature"
                        control={control}
                        render={({ field }) => (
                          <FormControlLabel
                            control={<Checkbox {...field} checked={field.value} />}
                            label="包含签名区域"
                          />
                        )}
                      />
                    </FormGroup>
                  </Grid>

                  <Grid size={12}>
                    <Box display="flex" gap={2}>
                      <Button onClick={handleBack}>
                        返回
                      </Button>
                      <Button
                        type="submit"
                        variant="contained"
                        disabled={!isValid || isGenerating}
                        startIcon={isGenerating ? <CircularProgress size={20} /> : <AssignmentIcon />}
                      >
                        {isGenerating ? '生成中...' : '生成文档'}
                      </Button>
                    </Box>
                  </Grid>
                </Grid>
              </form>
            </StepContent>
          </Step>

          {/* 步骤3: 生成预览 */}
          <Step>
            <StepLabel>文档预览</StepLabel>
            <StepContent>
              {generatedDocument && (
                <Box>
                  <Alert severity="success" sx={{ mb: 2 }}>
                    文档生成成功！您可以预览内容并进入编辑模式进行调整。
                  </Alert>
                  
                  <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                    <Typography variant="h6" gutterBottom>
                      {generatedDocument.title}
                    </Typography>
                    <Typography variant="body2" color="textSecondary" gutterBottom>
                      基于模板: {templates.find(t => t.id === generatedDocument.templateUsed)?.name}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      生成时间: {generatedDocument.generatedAt.toLocaleString()}
                    </Typography>
                  </Paper>

                  <Box display="flex" gap={2} mb={2}>
                    <Button
                      variant="outlined"
                      startIcon={<PreviewIcon />}
                      onClick={() => setShowPreview(true)}
                    >
                      快速预览
                    </Button>
                    <Button
                      variant="contained"
                      startIcon={<EditIcon />}
                      onClick={handleNext}
                    >
                      进入编辑模式
                    </Button>
                    <Button onClick={handleBack}>
                      返回修改
                    </Button>
                  </Box>
                </Box>
              )}
            </StepContent>
          </Step>

          {/* 步骤4: 编辑完善 */}
          <Step>
            <StepLabel>编辑和完善</StepLabel>
            <StepContent>
              {generatedDocument && (
                <Box>
                  <Alert severity="info" sx={{ mb: 2 }}>
                    <Typography variant="body2">
                      在下方编辑器中完善文档内容。解析的字段已用不同颜色高亮显示，您可以直接编辑。
                      编辑器会自动保存您的更改。
                    </Typography>
                  </Alert>
                  
                  <Paper sx={{ mt: 2 }}>
                    <RichTextEditor
                      ref={editorRef}
                      defaultValue={generatedDocument.content}
                      onSave={handleSaveDocument}
                      enableAutoSave={true}
                      autoSaveInterval={10000}
                      showSaveButton={true}
                      saveButtonText="保存文档"
                      placeholder="编辑您的文档..."
                      contextInfo={{
                        title: '解析字段引用',
                        content: (
                          <Box>
                            <Typography variant="subtitle2" gutterBottom>
                              字段映射参考
                            </Typography>
                            <List dense>
                              {fieldMappings.filter(m => m.isIncluded).map((mapping, index) => (
                                <ListItem key={index}>
                                  <ListItemText
                                    primary={mapping.fieldDisplayName}
                                    secondary={mapping.placeholderText}
                                  />
                                </ListItem>
                              ))}
                            </List>
                          </Box>
                        ),
                        actions: [
                          {
                            label: '导出文档',
                            onClick: handleExportDocument,
                            icon: <DownloadIcon />,
                            color: 'primary' as const,
                          }
                        ]
                      }}
                    />
                  </Paper>
                </Box>
              )}
            </StepContent>
          </Step>
        </Stepper>

        {/* 快速预览对话框 */}
        <Dialog 
          open={showPreview} 
          onClose={() => setShowPreview(false)}
          maxWidth="md" 
          fullWidth
        >
          <DialogTitle>文档预览</DialogTitle>
          <DialogContent>
            {generatedDocument && (
              <Box>
                <Typography variant="h6" gutterBottom>
                  {generatedDocument.title}
                </Typography>
                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography>查看生成内容</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.875rem' }}>
                      {JSON.stringify(generatedDocument.content, null, 2)}
                    </pre>
                  </AccordionDetails>
                </Accordion>
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowPreview(false)}>关闭</Button>
            <Button variant="contained" onClick={() => {
              setShowPreview(false);
              handleNext();
            }}>
              进入编辑
            </Button>
          </DialogActions>
        </Dialog>

        {/* 自定义模板创建对话框 */}
        <Dialog 
          open={showTemplateDialog} 
          onClose={() => setShowTemplateDialog(false)}
          maxWidth="sm" 
          fullWidth
        >
          <DialogTitle>创建自定义模板</DialogTitle>
          <DialogContent>
            <Alert severity="info">
              自定义模板功能正在开发中，敬请期待。
            </Alert>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowTemplateDialog(false)}>关闭</Button>
          </DialogActions>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default DocumentGeneratorComponent;