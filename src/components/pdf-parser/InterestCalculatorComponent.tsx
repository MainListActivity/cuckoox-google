import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  Typography,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Box,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  Chip,
  Checkbox,
  FormControlLabel,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Calculate as CalculateIcon,
  History as HistoryIcon,
  Info as InfoIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { zhCN } from 'date-fns/locale';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { formatCurrency, formatPercentage } from '@/src/utils/formatters';

// 利息计算参数验证schema
const interestCalculationSchema = z.object({
  principal: z.number().positive('本金必须大于0'),
  interestRate: z.number().positive('利率必须大于0'),
  rateType: z.enum(['daily', 'monthly', 'yearly']),
  startDate: z.date(),
  endDate: z.date(),
  isCompound: z.boolean(),
  compoundFrequency: z.enum(['daily', 'monthly', 'quarterly', 'yearly']).optional(),
});

type InterestCalculationForm = z.infer<typeof interestCalculationSchema>;

// 计算结果接口
interface CalculationResult {
  principal: number;
  interestRate: number;
  rateType: string;
  startDate: Date;
  endDate: Date;
  days: number;
  isCompound: boolean;
  compoundFrequency?: string;
  simpleInterest: number;
  compoundInterest?: number;
  totalAmount: number;
  dailyInterest: number;
  monthlyBreakdown: Array<{
    month: string;
    principalStart: number;
    interest: number;
    principalEnd: number;
  }>;
  formula: string;
  explanation: string;
}

// 计算历史记录接口
interface CalculationHistory {
  id: string;
  timestamp: Date;
  parameters: InterestCalculationForm;
  result: CalculationResult;
  description: string;
}

interface InterestCalculatorComponentProps {
  initialPrincipal?: number;
  initialRate?: number;
  onCalculationComplete?: (result: CalculationResult) => void;
}

const InterestCalculatorComponent: React.FC<InterestCalculatorComponentProps> = ({
  initialPrincipal,
  initialRate,
  onCalculationComplete,
}) => {
  const [calculationResult, setCalculationResult] = useState<CalculationResult | null>(null);
  const [calculationHistory, setCalculationHistory] = useState<CalculationHistory[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showFormula, setShowFormula] = useState(false);

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isValid },
  } = useForm<InterestCalculationForm>({
    resolver: zodResolver(interestCalculationSchema),
    defaultValues: {
      principal: initialPrincipal || 0,
      interestRate: initialRate || 0,
      rateType: 'yearly',
      startDate: new Date(),
      endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 一年后
      isCompound: false,
      compoundFrequency: 'monthly',
    },
    mode: 'onChange',
  });

  const watchedValues = watch();
  const { principal, interestRate, isCompound } = watchedValues;

  // 计算利息的核心函数
  const calculateInterest = (params: InterestCalculationForm): CalculationResult => {
    const days = Math.ceil((params.endDate.getTime() - params.startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // 将利率转换为日利率
    let dailyRate: number;
    switch (params.rateType) {
      case 'daily':
        dailyRate = params.interestRate / 100;
        break;
      case 'monthly':
        dailyRate = params.interestRate / 100 / 30;
        break;
      case 'yearly':
        dailyRate = params.interestRate / 100 / 365;
        break;
    }

    // 计算单利
    const simpleInterest = params.principal * dailyRate * days;
    const dailyInterest = params.principal * dailyRate;

    let compoundInterest: number | undefined;
    let totalAmount: number;
    let formula: string;
    let explanation: string;

    if (params.isCompound && params.compoundFrequency) {
      // 复利计算
      let compoundPeriods: number;
      let periodsPerYear: number;

      switch (params.compoundFrequency) {
        case 'daily':
          periodsPerYear = 365;
          compoundPeriods = days;
          break;
        case 'monthly':
          periodsPerYear = 12;
          compoundPeriods = days / 30;
          break;
        case 'quarterly':
          periodsPerYear = 4;
          compoundPeriods = days / 90;
          break;
        case 'yearly':
          periodsPerYear = 1;
          compoundPeriods = days / 365;
          break;
      }

      const yearlyRate = params.rateType === 'yearly' ? params.interestRate / 100 :
                        params.rateType === 'monthly' ? params.interestRate / 100 * 12 :
                        params.interestRate / 100 * 365;

      const compoundRate = yearlyRate / periodsPerYear;
      const finalAmount = params.principal * Math.pow(1 + compoundRate, compoundPeriods);
      compoundInterest = finalAmount - params.principal;
      totalAmount = finalAmount;

      formula = `A = P(1 + r/n)^(nt)`;
      explanation = `复利计算：本金 ${formatCurrency(params.principal)}，年利率 ${formatPercentage(yearlyRate)}，复利频率 ${params.compoundFrequency}，计算周期 ${days} 天`;
    } else {
      // 单利计算
      totalAmount = params.principal + simpleInterest;
      formula = `利息 = 本金 × 利率 × 时间`;
      explanation = `单利计算：本金 ${formatCurrency(params.principal)}，日利率 ${formatPercentage(dailyRate)}，计算天数 ${days} 天`;
    }

    // 生成月度分解
    const monthlyBreakdown: CalculationResult['monthlyBreakdown'] = [];
    let currentDate = new Date(params.startDate);
    let currentPrincipal = params.principal;

    while (currentDate < params.endDate) {
      const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      const actualMonthEnd = monthEnd > params.endDate ? params.endDate : monthEnd;
      const monthDays = Math.ceil((actualMonthEnd.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
      
      let monthInterest: number;
      if (params.isCompound) {
        const monthlyRate = dailyRate * 30; // 简化计算
        monthInterest = currentPrincipal * monthlyRate;
        currentPrincipal += monthInterest;
      } else {
        monthInterest = params.principal * dailyRate * monthDays;
      }

      monthlyBreakdown.push({
        month: `${currentDate.getFullYear()}年${currentDate.getMonth() + 1}月`,
        principalStart: params.isCompound ? currentPrincipal - monthInterest : params.principal,
        interest: monthInterest,
        principalEnd: currentPrincipal,
      });

      currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
    }

    return {
      principal: params.principal,
      interestRate: params.interestRate,
      rateType: params.rateType,
      startDate: params.startDate,
      endDate: params.endDate,
      days,
      isCompound: params.isCompound,
      compoundFrequency: params.compoundFrequency,
      simpleInterest,
      compoundInterest,
      totalAmount,
      dailyInterest,
      monthlyBreakdown,
      formula,
      explanation,
    };
  };

  // 实时计算
  useEffect(() => {
    if (isValid && principal > 0 && interestRate > 0) {
      try {
        const result = calculateInterest(watchedValues);
        setCalculationResult(result);
      } catch (error) {
        console.error('计算错误:', error);
        setCalculationResult(null);
      }
    } else {
      setCalculationResult(null);
    }
  }, [watchedValues, isValid, principal, interestRate]);

  // 提交计算并保存到历史记录
  const onSubmit = (data: InterestCalculationForm) => {
    const result = calculateInterest(data);
    
    const historyItem: CalculationHistory = {
      id: Date.now().toString(),
      timestamp: new Date(),
      parameters: data,
      result,
      description: `${formatCurrency(data.principal)} | ${data.interestRate}% | ${result.days}天`,
    };

    setCalculationHistory(prev => [historyItem, ...prev.slice(0, 9)]); // 保持最近10条记录
    onCalculationComplete?.(result);
  };

  // 加载历史计算参数
  const loadHistoryParameters = (history: CalculationHistory) => {
    Object.entries(history.parameters).forEach(([key, value]) => {
      setValue(key as keyof InterestCalculationForm, value);
    });
    setShowHistory(false);
  };

  // 导出计算结果
  const exportResult = () => {
    if (!calculationResult) return;

    const exportData = {
      计算参数: {
        本金: formatCurrency(calculationResult.principal),
        利率: `${calculationResult.interestRate}% (${calculationResult.rateType})`,
        计算期间: `${calculationResult.startDate.toLocaleDateString()} - ${calculationResult.endDate.toLocaleDateString()}`,
        计算天数: `${calculationResult.days}天`,
        计算方式: calculationResult.isCompound ? '复利' : '单利',
      },
      计算结果: {
        本金: formatCurrency(calculationResult.principal),
        利息: formatCurrency(calculationResult.isCompound ? calculationResult.compoundInterest! : calculationResult.simpleInterest),
        总计: formatCurrency(calculationResult.totalAmount),
        日利息: formatCurrency(calculationResult.dailyInterest),
      },
      计算公式: calculationResult.formula,
      计算说明: calculationResult.explanation,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `利息计算结果_${new Date().toLocaleDateString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getRateTypeLabel = (type: string) => {
    switch (type) {
      case 'daily': return '日利率';
      case 'monthly': return '月利率';
      case 'yearly': return '年利率';
      default: return type;
    }
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={zhCN}>
      <Card>
        <CardHeader
          title="利息计算器"
          action={
            <Box>
              <Tooltip title="计算历史">
                <IconButton onClick={() => setShowHistory(true)}>
                  <HistoryIcon />
                </IconButton>
              </Tooltip>
              {calculationResult && (
                <Tooltip title="导出结果">
                  <IconButton onClick={exportResult}>
                    <DownloadIcon />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          }
        />
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)}>
            <Grid container spacing={3}>
              {/* 计算参数输入 */}
              <Grid size={12}>
                <Typography variant="h6" gutterBottom>
                  计算参数
                </Typography>
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="principal"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="本金 (元)"
                      type="number"
                      fullWidth
                      error={!!errors.principal}
                      helperText={errors.principal?.message}
                      InputProps={{
                        inputProps: { min: 0, step: 0.01 }
                      }}
                    />
                  )}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="interestRate"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="利率 (%)"
                      type="number"
                      fullWidth
                      error={!!errors.interestRate}
                      helperText={errors.interestRate?.message}
                      InputProps={{
                        inputProps: { min: 0, step: 0.01 }
                      }}
                    />
                  )}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 4 }}>
                <Controller
                  name="rateType"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth>
                      <InputLabel>利率类型</InputLabel>
                      <Select {...field} label="利率类型">
                        <MenuItem value="daily">日利率</MenuItem>
                        <MenuItem value="monthly">月利率</MenuItem>
                        <MenuItem value="yearly">年利率</MenuItem>
                      </Select>
                    </FormControl>
                  )}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 4 }}>
                <Controller
                  name="startDate"
                  control={control}
                  render={({ field }) => (
                    <DatePicker
                      {...field}
                      label="开始日期"
                      slotProps={{
                        textField: {
                          fullWidth: true,
                          error: !!errors.startDate,
                          helperText: errors.startDate?.message,
                        }
                      }}
                    />
                  )}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 4 }}>
                <Controller
                  name="endDate"
                  control={control}
                  render={({ field }) => (
                    <DatePicker
                      {...field}
                      label="结束日期"
                      slotProps={{
                        textField: {
                          fullWidth: true,
                          error: !!errors.endDate,
                          helperText: errors.endDate?.message,
                        }
                      }}
                    />
                  )}
                />
              </Grid>

              {/* 复利选项 */}
              <Grid size={12}>
                <Box display="flex" alignItems="center" gap={2}>
                  <Controller
                    name="isCompound"
                    control={control}
                    render={({ field }) => (
                      <FormControlLabel
                        control={
                          <Checkbox
                            {...field}
                            checked={field.value}
                          />
                        }
                        label="使用复利计算"
                      />
                    )}
                  />

                  {isCompound && (
                    <Controller
                      name="compoundFrequency"
                      control={control}
                      render={({ field }) => (
                        <FormControl size="small" sx={{ minWidth: 120 }}>
                          <InputLabel>复利频率</InputLabel>
                          <Select {...field} label="复利频率">
                            <MenuItem value="daily">按日</MenuItem>
                            <MenuItem value="monthly">按月</MenuItem>
                            <MenuItem value="quarterly">按季度</MenuItem>
                            <MenuItem value="yearly">按年</MenuItem>
                          </Select>
                        </FormControl>
                      )}
                    />
                  )}
                </Box>
              </Grid>

              <Grid size={12}>
                <Box display="flex" gap={2}>
                  <Button
                    type="submit"
                    variant="contained"
                    startIcon={<CalculateIcon />}
                    disabled={!isValid}
                  >
                    计算并保存
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<InfoIcon />}
                    onClick={() => setShowFormula(true)}
                  >
                    查看公式说明
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </form>

          {/* 计算结果展示 */}
          {calculationResult && (
            <>
              <Divider sx={{ my: 3 }} />
              
              <Typography variant="h6" gutterBottom>
                计算结果
              </Typography>

              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 3 }}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography color="textSecondary" gutterBottom>
                        本金
                      </Typography>
                      <Typography variant="h6">
                        {formatCurrency(calculationResult.principal)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid size={{ xs: 12, md: 3 }}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography color="textSecondary" gutterBottom>
                        利息
                      </Typography>
                      <Typography variant="h6" color="primary">
                        {formatCurrency(
                          calculationResult.isCompound 
                            ? calculationResult.compoundInterest! 
                            : calculationResult.simpleInterest
                        )}
                      </Typography>
                      <Typography variant="caption">
                        {calculationResult.isCompound ? '复利' : '单利'}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid size={{ xs: 12, md: 3 }}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography color="textSecondary" gutterBottom>
                        总计
                      </Typography>
                      <Typography variant="h6" color="success.main">
                        {formatCurrency(calculationResult.totalAmount)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid size={{ xs: 12, md: 3 }}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography color="textSecondary" gutterBottom>
                        日利息
                      </Typography>
                      <Typography variant="h6">
                        {formatCurrency(calculationResult.dailyInterest)}
                      </Typography>
                      <Typography variant="caption">
                        {calculationResult.days} 天
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {/* 月度分解 */}
              <Accordion sx={{ mt: 2 }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography>月度分解明细</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>月份</TableCell>
                          <TableCell align="right">期初本金</TableCell>
                          <TableCell align="right">利息</TableCell>
                          <TableCell align="right">期末本金</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {calculationResult.monthlyBreakdown.map((month, index) => (
                          <TableRow key={index}>
                            <TableCell>{month.month}</TableCell>
                            <TableCell align="right">
                              {formatCurrency(month.principalStart)}
                            </TableCell>
                            <TableCell align="right">
                              {formatCurrency(month.interest)}
                            </TableCell>
                            <TableCell align="right">
                              {formatCurrency(month.principalEnd)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </AccordionDetails>
              </Accordion>

              {/* 计算说明 */}
              <Alert severity="info" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  <strong>计算公式：</strong> {calculationResult.formula}
                </Typography>
                <Typography variant="body2">
                  <strong>计算说明：</strong> {calculationResult.explanation}
                </Typography>
              </Alert>
            </>
          )}
        </CardContent>
      </Card>

      {/* 计算历史对话框 */}
      <Dialog open={showHistory} onClose={() => setShowHistory(false)} maxWidth="md" fullWidth>
        <DialogTitle>计算历史</DialogTitle>
        <DialogContent>
          {calculationHistory.length === 0 ? (
            <Typography color="textSecondary">暂无计算历史</Typography>
          ) : (
            <List>
              {calculationHistory.map((history) => (
                <ListItem
                  key={history.id}
                  component="button"
                  onClick={() => loadHistoryParameters(history)}
                >
                  <ListItemText
                    primary={history.description}
                    secondary={
                      <Box>
                        <Typography variant="caption" display="block">
                          {history.timestamp.toLocaleString()}
                        </Typography>
                        <Box display="flex" gap={1} mt={1}>
                          <Chip
                            label={getRateTypeLabel(history.parameters.rateType)}
                            size="small"
                          />
                          {history.parameters.isCompound && (
                            <Chip label="复利" size="small" color="primary" />
                          )}
                        </Box>
                      </Box>
                    }
                  />
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowHistory(false)}>关闭</Button>
        </DialogActions>
      </Dialog>

      {/* 公式说明对话框 */}
      <Dialog open={showFormula} onClose={() => setShowFormula(false)} maxWidth="sm" fullWidth>
        <DialogTitle>计算公式说明</DialogTitle>
        <DialogContent>
          <Typography variant="h6" gutterBottom>
            单利计算
          </Typography>
          <Typography variant="body2" paragraph>
            利息 = 本金 × 利率 × 时间
          </Typography>
          <Typography variant="body2" paragraph>
            总额 = 本金 + 利息
          </Typography>

          <Typography variant="h6" gutterBottom>
            复利计算
          </Typography>
          <Typography variant="body2" paragraph>
            A = P(1 + r/n)^(nt)
          </Typography>
          <Typography variant="body2" paragraph>
            其中：
            <br />
            A = 最终金额
            <br />
            P = 本金
            <br />
            r = 年利率
            <br />
            n = 每年复利次数
            <br />
            t = 时间（年）
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowFormula(false)}>关闭</Button>
        </DialogActions>
      </Dialog>
    </LocalizationProvider>
  );
};

export default InterestCalculatorComponent;