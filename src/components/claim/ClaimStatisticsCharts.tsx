/**
 * 债权统计图表组件
 * 使用图表库展示统计数据，支持交互式数据探索和钻取
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  DatePicker,
  Button,
  CircularProgress,
  Alert,
  Chip,
  Paper,
  useTheme,
  Stack,
  Divider
} from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { zhCN } from 'date-fns/locale';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';
import { RecordId } from 'surrealdb';
import { claimStatisticsService } from '../../services/claimStatisticsService';
import type {
  ProcessingEfficiencyStats,
  QualityIndicatorStats,
  WorkloadStats,
  StatusFlowStats,
  BottleneckAnalysis,
  TimeSeriesData
} from '../../services/claimStatisticsService';

// 图表颜色配置
const CHART_COLORS = [
  '#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00ff00',
  '#0000ff', '#ff1493', '#00ced1', '#ffd700', '#ff69b4'
];

const SEVERITY_COLORS = {
  low: '#4caf50',    // 绿色
  medium: '#ff9800', // 橙色
  high: '#f44336'    // 红色
};

interface ClaimStatisticsChartsProps {
  caseId?: RecordId | string;
  defaultDateRange?: { start: Date; end: Date };
  onExportData?: (data: any) => void;
}

const ClaimStatisticsCharts: React.FC<ClaimStatisticsChartsProps> = ({
  caseId,
  defaultDateRange,
  onExportData
}) => {
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // 数据状态
  const [efficiency, setEfficiency] = useState<ProcessingEfficiencyStats | null>(null);
  const [quality, setQuality] = useState<QualityIndicatorStats | null>(null);
  const [workload, setWorkload] = useState<WorkloadStats | null>(null);
  const [statusFlow, setStatusFlow] = useState<StatusFlowStats | null>(null);
  const [bottleneck, setBottleneck] = useState<BottleneckAnalysis | null>(null);
  const [timeSeries, setTimeSeries] = useState<TimeSeriesData[]>([]);
  
  // 筛选状态
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date } | undefined>(
    defaultDateRange || {
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30天前
      end: new Date()
    }
  );
  const [selectedMetric, setSelectedMetric] = useState<string>('overview');

  // 加载统计数据
  const loadStatisticsData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [efficiencyData, qualityData, workloadData, statusFlowData, bottleneckData, timeSeriesData] = 
        await Promise.all([
          claimStatisticsService.getProcessingEfficiencyStats(caseId, dateRange),
          claimStatisticsService.getQualityIndicatorStats(caseId, dateRange),
          claimStatisticsService.getWorkloadStats(caseId, dateRange),
          claimStatisticsService.getStatusFlowStats(caseId, dateRange),
          claimStatisticsService.getBottleneckAnalysis(caseId),
          claimStatisticsService.getTimeSeriesData(caseId, 30)
        ]);

      setEfficiency(efficiencyData);
      setQuality(qualityData);
      setWorkload(workloadData);
      setStatusFlow(statusFlowData);
      setBottleneck(bottleneckData);
      setTimeSeries(timeSeriesData);

    } catch (err) {
      setError(err instanceof Error ? err.message : '加载统计数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 导出数据
  const handleExportData = async () => {
    try {
      const exportData = await claimStatisticsService.exportStatisticsReport(caseId, dateRange);
      onExportData?.(exportData);
    } catch (err) {
      setError(err instanceof Error ? err.message : '导出数据失败');
    }
  };

  useEffect(() => {
    loadStatisticsData();
  }, [caseId, dateRange]);

  // 格式化图表数据
  const chartData = useMemo(() => {
    if (!efficiency || !quality || !workload || !statusFlow) return null;

    return {
      efficiencyTimeRanges: efficiency.timeRanges,
      qualityMetrics: [
        { name: '一次通过率', value: quality.onePassRate, color: CHART_COLORS[0] },
        { name: '驳回率', value: quality.rejectionRate, color: CHART_COLORS[1] },
        { name: '补充材料率', value: quality.supplementRequestRate, color: CHART_COLORS[2] }
      ],
      reviewerWorkload: workload.reviewerStats.slice(0, 10), // 前10名
      statusDistribution: statusFlow.statusDistribution,
      dailyTrend: timeSeries.slice(0, 15).reverse() // 最近15天，时间正序
    };
  }, [efficiency, quality, workload, statusFlow, timeSeries]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
        <Button onClick={loadStatisticsData} sx={{ ml: 2 }}>
          重新加载
        </Button>
      </Alert>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={zhCN}>
      <Box>
        {/* 筛选条件 */}
        <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>统计维度</InputLabel>
              <Select
                value={selectedMetric}
                onChange={(e) => setSelectedMetric(e.target.value)}
                label="统计维度"
              >
                <MenuItem value="overview">总览</MenuItem>
                <MenuItem value="efficiency">处理效率</MenuItem>
                <MenuItem value="quality">质量指标</MenuItem>
                <MenuItem value="workload">工作量</MenuItem>
                <MenuItem value="bottleneck">瓶颈分析</MenuItem>
              </Select>
            </FormControl>
            
            <DatePicker
              label="开始日期"
              value={dateRange?.start}
              onChange={(date) => date && setDateRange(prev => ({ ...prev!, start: date }))}
              slotProps={{ textField: { size: 'small' } }}
            />
            
            <DatePicker
              label="结束日期"
              value={dateRange?.end}
              onChange={(date) => date && setDateRange(prev => ({ ...prev!, end: date }))}
              slotProps={{ textField: { size: 'small' } }}
            />
            
            <Button variant="outlined" onClick={loadStatisticsData}>
              刷新数据
            </Button>
            
            <Button variant="contained" onClick={handleExportData}>
              导出报告
            </Button>
          </Stack>
        </Paper>

        {/* 概览卡片 */}
        {efficiency && quality && (
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom variant="overline">
                    总申报数量
                  </Typography>
                  <Typography variant="h4" component="div">
                    {efficiency.totalClaims}
                  </Typography>
                  <Typography color="textSecondary">
                    待审核: {efficiency.pendingClaims}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom variant="overline">
                    平均处理时长
                  </Typography>
                  <Typography variant="h4" component="div">
                    {efficiency.avgProcessingDays}
                  </Typography>
                  <Typography color="textSecondary">
                    天
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom variant="overline">
                    一次通过率
                  </Typography>
                  <Typography variant="h4" component="div" color="success.main">
                    {quality.onePassRate}%
                  </Typography>
                  <Typography color="textSecondary">
                    共审核 {quality.totalReviewed} 笔
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom variant="overline">
                    平均审核轮次
                  </Typography>
                  <Typography variant="h4" component="div">
                    {quality.avgReviewRounds}
                  </Typography>
                  <Typography color="textSecondary">
                    轮
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {/* 图表区域 */}
        <Grid container spacing={3}>
          {/* 处理时长分布 */}
          {chartData?.efficiencyTimeRanges && (selectedMetric === 'overview' || selectedMetric === 'efficiency') && (
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    处理时长分布
                  </Typography>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartData.efficiencyTimeRanges}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="range" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill={CHART_COLORS[0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </Grid>
          )}

          {/* 质量指标 */}
          {chartData?.qualityMetrics && (selectedMetric === 'overview' || selectedMetric === 'quality') && (
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    质量指标分布
                  </Typography>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={chartData.qualityMetrics}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value }) => `${name}: ${value}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {chartData.qualityMetrics.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </Grid>
          )}

          {/* 审核人员工作量 */}
          {chartData?.reviewerWorkload && (selectedMetric === 'overview' || selectedMetric === 'workload') && (
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    审核人员工作量 (Top 10)
                  </Typography>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartData.reviewerWorkload}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="reviewerName" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="totalReviewed" fill={CHART_COLORS[0]} name="审核数量" />
                      <Bar dataKey="avgProcessingTime" fill={CHART_COLORS[1]} name="平均处理时长(天)" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </Grid>
          )}

          {/* 状态分布 */}
          {chartData?.statusDistribution && (selectedMetric === 'overview' || selectedMetric === 'efficiency') && (
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    债权状态分布
                  </Typography>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={chartData.statusDistribution}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ status, percentage }) => `${status}: ${percentage}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="count"
                      >
                        {chartData.statusDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </Grid>
          )}

          {/* 每日趋势 */}
          {chartData?.dailyTrend && (selectedMetric === 'overview' || selectedMetric === 'efficiency') && (
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    每日申报趋势
                  </Typography>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={chartData.dailyTrend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="submissions" stroke={CHART_COLORS[0]} name="提交数量" />
                      <Line type="monotone" dataKey="approvals" stroke={CHART_COLORS[1]} name="审核通过" />
                      <Line type="monotone" dataKey="rejections" stroke={CHART_COLORS[3]} name="审核驳回" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </Grid>
          )}

          {/* 瓶颈分析 */}
          {bottleneck && (selectedMetric === 'overview' || selectedMetric === 'bottleneck') && (
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    处理瓶颈分析
                  </Typography>
                  
                  <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                    瓶颈阶段
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 2 }}>
                    {bottleneck.bottleneckStages.map((stage, index) => (
                      <Chip
                        key={index}
                        label={`${stage.stage}: ${stage.avgDuration}天`}
                        color={stage.severity === 'high' ? 'error' : stage.severity === 'medium' ? 'warning' : 'success'}
                        size="small"
                      />
                    ))}
                  </Stack>
                  
                  <Typography variant="subtitle2" gutterBottom>
                    处理缓慢的债权 (Top 10)
                  </Typography>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={bottleneck.slowClaims.slice(0, 10)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="claimNumber" angle={-45} textAnchor="end" height={80} />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="daysInStatus" fill={CHART_COLORS[3]} name="停留天数" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </Grid>
          )}
        </Grid>
      </Box>
    </LocalizationProvider>
  );
};

export default ClaimStatisticsCharts;