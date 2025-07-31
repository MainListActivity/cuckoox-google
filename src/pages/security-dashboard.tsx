/**
 * 安全监控仪表板页面
 * 集中展示系统安全状态、审计信息和风险分析
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  Paper,
  Alert,
  AlertTitle,
  Chip,
  IconButton,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  LinearProgress,
  Divider,
  Stack,
  Tooltip,
  Badge
} from '@mui/material';
import {
  Security as SecurityIcon,
  Warning as WarningIcon,
  Shield as ShieldIcon,
  Assessment as AssessmentIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  TrendingUp as TrendingUpIcon,
  People as PeopleIcon,
  Lock as LockIcon,
  Visibility as VisibilityIcon,
  Timeline as TimelineIcon
} from '@mui/icons-material';
import { format, subDays, subHours } from 'date-fns';
import { zhCN } from 'date-fns/locale';

import ClaimAuditMonitor from '../components/claim/ClaimAuditMonitor';
import {
  claimTrackingAuditService,
  type AuditStatistics,
  type AnomalyDetectionResult,
  AuditEventType,
  RiskLevel
} from '../services/claimTrackingAuditService';
import { useAuth } from '../contexts/AuthContext';
import { useSurrealClient } from '../contexts/SurrealProvider';

interface SecurityMetrics {
  totalUsers: number;
  activeUsers: number;
  failedLogins: number;
  permissionDenials: number;
  suspiciousActivities: number;
  dataExports: number;
  systemErrors: number;
  riskScore: number;
}

interface SecurityTrend {
  date: string;
  events: number;
  risks: number;
  anomalies: number;
}

const SecurityDashboard: React.FC = () => {
  const { user, selectedCaseId } = useAuth();
  const client = useSurrealClient();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d' | '30d'>('24h');
  
  // 安全指标数据
  const [securityMetrics, setSecurityMetrics] = useState<SecurityMetrics>({
    totalUsers: 0,
    activeUsers: 0,
    failedLogins: 0,
    permissionDenials: 0,
    suspiciousActivities: 0,
    dataExports: 0,
    systemErrors: 0,
    riskScore: 0
  });
  
  const [auditStats, setAuditStats] = useState<AuditStatistics | null>(null);
  const [anomalies, setAnomalies] = useState<AnomalyDetectionResult[]>([]);
  const [securityTrends, setSecurityTrends] = useState<SecurityTrend[]>([]);

  // 初始化服务
  useEffect(() => {
    if (client) {
      claimTrackingAuditService.setClientGetter(client);
    }
  }, [client]);

  /**
   * 获取时间范围
   */
  const getTimeRange = useCallback(() => {
    const now = new Date();
    switch (timeRange) {
      case '1h':
        return { start: subHours(now, 1), end: now };
      case '24h':
        return { start: subHours(now, 24), end: now };
      case '7d':
        return { start: subDays(now, 7), end: now };
      case '30d':
        return { start: subDays(now, 30), end: now };
      default:
        return { start: subHours(now, 24), end: now };
    }
  }, [timeRange]);

  /**
   * 加载安全指标数据
   */
  const loadSecurityData = useCallback(async () => {
    if (!client || !user) return;

    setLoading(true);
    setError(null);

    try {
      const { start, end } = getTimeRange();

      // 并行加载各种数据
      const [statsResult] = await Promise.all([
        claimTrackingAuditService.getAuditStatistics({
          startTime: start,
          endTime: end,
          caseId: selectedCaseId || undefined
        })
      ]);

      setAuditStats(statsResult);

      // 计算安全指标
      const metrics: SecurityMetrics = {
        totalUsers: statsResult.unique_users,
        activeUsers: statsResult.unique_users, // 简化实现
        failedLogins: statsResult.events_by_type[AuditEventType.LOGIN] || 0,
        permissionDenials: statsResult.permission_denials,
        suspiciousActivities: statsResult.events_by_risk[RiskLevel.HIGH] || 0,
        dataExports: statsResult.events_by_type[AuditEventType.DATA_EXPORT] || 0,
        systemErrors: statsResult.events_by_type[AuditEventType.SYSTEM_ERROR] || 0,
        riskScore: calculateRiskScore(statsResult)
      };

      setSecurityMetrics(metrics);

      // 模拟异常检测结果
      setAnomalies([]);

      // 生成趋势数据
      setSecurityTrends(generateTrendData(timeRange));

    } catch (err) {
      console.error('Failed to load security data:', err);
      setError(err instanceof Error ? err.message : '加载安全数据失败');
    } finally {
      setLoading(false);
    }
  }, [client, user, selectedCaseId, timeRange, getTimeRange]);

  // 初始加载和定时刷新
  useEffect(() => {
    loadSecurityData();
    
    // 设置定时刷新（每5分钟）
    const interval = setInterval(loadSecurityData, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [loadSecurityData]);

  /**
   * 计算整体风险评分
   */
  const calculateRiskScore = (stats: AuditStatistics): number => {
    const weights = {
      failed_operations: 0.3,
      permission_denials: 0.25,
      high_risk_events: 0.25,
      critical_risk_events: 0.2
    };

    const totalEvents = stats.total_events || 1;
    const failedRatio = stats.failed_operations / totalEvents;
    const denialRatio = stats.permission_denials / totalEvents;
    const highRiskRatio = (stats.events_by_risk[RiskLevel.HIGH] || 0) / totalEvents;
    const criticalRiskRatio = (stats.events_by_risk[RiskLevel.CRITICAL] || 0) / totalEvents;

    const score = (
      failedRatio * weights.failed_operations +
      denialRatio * weights.permission_denials +
      highRiskRatio * weights.high_risk_events +
      criticalRiskRatio * weights.critical_risk_events
    ) * 100;

    return Math.min(100, Math.max(0, score));
  };

  /**
   * 生成趋势数据
   */
  const generateTrendData = (range: string): SecurityTrend[] => {
    // 简化实现，实际项目中应从数据库查询
    const days = range === '1h' ? 1 : range === '24h' ? 7 : range === '7d' ? 7 : 30;
    const trends: SecurityTrend[] = [];
    
    for (let i = days - 1; i >= 0; i--) {
      const date = format(subDays(new Date(), i), 'MM-dd');
      trends.push({
        date,
        events: Math.floor(Math.random() * 100) + 50,
        risks: Math.floor(Math.random() * 20) + 5,
        anomalies: Math.floor(Math.random() * 5)
      });
    }
    
    return trends;
  };

  /**
   * 获取风险级别颜色
   */
  const getRiskColor = (score: number): 'success' | 'warning' | 'error' => {
    if (score < 30) return 'success';
    if (score < 70) return 'warning';
    return 'error';
  };

  /**
   * 获取风险级别文本
   */
  const getRiskText = (score: number): string => {
    if (score < 30) return '低风险';
    if (score < 70) return '中风险';
    return '高风险';
  };

  /**
   * 导出安全报告
   */
  const handleExportReport = async () => {
    try {
      setLoading(true);
      const { start, end } = getTimeRange();
      
      const report = await claimTrackingAuditService.exportAuditReport({
        startTime: start,
        endTime: end,
        caseId: selectedCaseId || undefined,
        includeStatistics: true
      });

      // 添加安全指标到报告
      const securityReport = {
        ...report,
        security_metrics: securityMetrics,
        anomalies,
        trends: securityTrends,
        risk_assessment: {
          overall_score: securityMetrics.riskScore,
          risk_level: getRiskText(securityMetrics.riskScore),
          generated_at: new Date()
        }
      };

      // 创建下载链接
      const blob = new Blob([JSON.stringify(securityReport, null, 2)], {
        type: 'application/json'
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `security-report-${format(new Date(), 'yyyy-MM-dd-HH-mm')}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

    } catch (err) {
      setError(err instanceof Error ? err.message : '导出报告失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      {/* 页面标题 */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <SecurityIcon fontSize="large" />
          安全监控仪表板
        </Typography>
        
        <Stack direction="row" spacing={1} alignItems="center">
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>时间范围</InputLabel>
            <Select
              value={timeRange}
              label="时间范围"
              onChange={(e) => setTimeRange(e.target.value as any)}
            >
              <MenuItem value="1h">1小时</MenuItem>
              <MenuItem value="24h">24小时</MenuItem>
              <MenuItem value="7d">7天</MenuItem>
              <MenuItem value="30d">30天</MenuItem>
            </Select>
          </FormControl>
          
          <Tooltip title="导出安全报告">
            <IconButton onClick={handleExportReport} disabled={loading}>
              <DownloadIcon />
            </IconButton>
          </Tooltip>
          
          <Tooltip title="刷新数据">
            <IconButton onClick={loadSecurityData} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          <AlertTitle>加载失败</AlertTitle>
          {error}
        </Alert>
      )}

      {/* 安全概览卡片 */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {/* 总体风险评分 */}
        <Grid item xs={12} md={3}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <ShieldIcon 
                sx={{ 
                  fontSize: 48, 
                  color: `${getRiskColor(securityMetrics.riskScore)}.main`,
                  mb: 1 
                }} 
              />
              <Typography variant="h3" color={`${getRiskColor(securityMetrics.riskScore)}.main`}>
                {securityMetrics.riskScore.toFixed(0)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {getRiskText(securityMetrics.riskScore)}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                整体安全评分
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* 活跃用户 */}
        <Grid item xs={12} md={3}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="h4">{securityMetrics.activeUsers}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    活跃用户
                  </Typography>
                </Box>
                <PeopleIcon color="primary" sx={{ fontSize: 40 }} />
              </Box>
              <Typography variant="caption" color="text.secondary">
                总用户: {securityMetrics.totalUsers}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* 失败登录 */}
        <Grid item xs={12} md={3}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="h4" color="error.main">
                    {securityMetrics.failedLogins}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    失败登录
                  </Typography>
                </Box>
                <LockIcon color="error" sx={{ fontSize: 40 }} />
              </Box>
              <Typography variant="caption" color="text.secondary">
                权限拒绝: {securityMetrics.permissionDenials}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* 可疑活动 */}
        <Grid item xs={12} md={3}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="h4" color="warning.main">
                    {securityMetrics.suspiciousActivities}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    可疑活动
                  </Typography>
                </Box>
                <WarningIcon color="warning" sx={{ fontSize: 40 }} />
              </Box>
              <Typography variant="caption" color="text.secondary">
                数据导出: {securityMetrics.dataExports}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* 异常告警 */}
      {anomalies.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <WarningIcon color="warning" />
              安全异常告警
              <Badge badgeContent={anomalies.length} color="error" />
            </Typography>
            <Stack spacing={2}>
              {anomalies.slice(0, 3).map((anomaly, index) => (
                <Alert 
                  key={index} 
                  severity={anomaly.risk_level === RiskLevel.CRITICAL ? 'error' : 'warning'}
                >
                  <AlertTitle>{anomaly.rule_name}</AlertTitle>
                  {anomaly.description}
                  <Typography variant="caption" sx={{ display: 'block', mt: 1 }}>
                    风险评分: {anomaly.score} | 触发时间: {format(anomaly.triggered_at, 'HH:mm:ss')}
                  </Typography>
                </Alert>
              ))}
              {anomalies.length > 3 && (
                <Button variant="outlined" size="small">
                  查看全部 {anomalies.length} 个异常
                </Button>
              )}
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* 统计概览 */}
      {auditStats && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AssessmentIcon />
                  事件统计
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">总事件数</Typography>
                    <Typography variant="h5">{auditStats.total_events}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">独立用户</Typography>
                    <Typography variant="h5">{auditStats.unique_users}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">失败操作</Typography>
                    <Typography variant="h5" color="error.main">{auditStats.failed_operations}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">平均处理时间</Typography>
                    <Typography variant="h5">{auditStats.avg_processing_time.toFixed(0)}ms</Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TimelineIcon />
                  风险分布
                </Typography>
                <Stack spacing={1}>
                  {Object.entries(auditStats.events_by_risk).map(([level, count]) => (
                    <Box key={level} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Chip 
                        label={level === RiskLevel.LOW ? '低风险' : 
                              level === RiskLevel.MEDIUM ? '中风险' : 
                              level === RiskLevel.HIGH ? '高风险' : '严重风险'}
                        size="small"
                        color={
                          level === RiskLevel.LOW ? 'success' :
                          level === RiskLevel.MEDIUM ? 'warning' : 'error'
                        }
                      />
                      <Typography variant="h6">{count}</Typography>
                    </Box>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* 审计监控组件 */}
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <ClaimAuditMonitor 
            caseId={selectedCaseId || undefined}
            height={600}
          />
        </Grid>
      </Grid>
    </Container>
  );
};

export default SecurityDashboard;