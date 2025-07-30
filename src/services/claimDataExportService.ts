/**
 * 债权数据导出服务
 * 支持Excel和PDF格式的报告生成
 */

import { RecordId } from 'surrealdb';
import { claimStatisticsService } from './claimStatisticsService';
import type {
  ProcessingEfficiencyStats,
  QualityIndicatorStats,
  WorkloadStats,
  StatusFlowStats,
  BottleneckAnalysis,
  TimeSeriesData
} from './claimStatisticsService';

// 导出格式类型
export type ExportFormat = 'excel' | 'pdf' | 'csv';

// 导出任务状态
export enum ExportStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

// 导出任务信息
export interface ExportTask {
  id: string;
  format: ExportFormat;
  status: ExportStatus;
  progress: number;
  downloadUrl?: string;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}

// 导出配置
export interface ExportConfig {
  format: ExportFormat;
  includeCharts: boolean;
  caseId?: RecordId | string;
  dateRange?: { start: Date; end: Date };
  sections: {
    overview: boolean;
    efficiency: boolean;
    quality: boolean;
    workload: boolean;
    statusFlow: boolean;
    bottleneck: boolean;
    timeSeries: boolean;
    rawData: boolean;
  };
}

class ClaimDataExportService {
  private exportTasks = new Map<string, ExportTask>();
  
  /**
   * 创建导出任务
   */
  async createExportTask(config: ExportConfig): Promise<ExportTask> {
    const taskId = `export_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const task: ExportTask = {
      id: taskId,
      format: config.format,
      status: ExportStatus.PENDING,
      progress: 0,
      createdAt: new Date()
    };
    
    this.exportTasks.set(taskId, task);
    
    // 异步执行导出
    this.executeExportTask(taskId, config).catch(error => {
      const failedTask = this.exportTasks.get(taskId);
      if (failedTask) {
        failedTask.status = ExportStatus.FAILED;
        failedTask.error = error.message;
        this.exportTasks.set(taskId, failedTask);
      }
    });
    
    return task;
  }
  
  /**
   * 获取导出任务状态
   */
  getExportTask(taskId: string): ExportTask | null {
    return this.exportTasks.get(taskId) || null;
  }
  
  /**
   * 获取所有导出任务
   */
  getAllExportTasks(): ExportTask[] {
    return Array.from(this.exportTasks.values()).sort((a, b) => 
      b.createdAt.getTime() - a.createdAt.getTime()
    );
  }
  
  /**
   * 执行导出任务
   */
  private async executeExportTask(taskId: string, config: ExportConfig): Promise<void> {
    const task = this.exportTasks.get(taskId);
    if (!task) throw new Error('Task not found');
    
    try {
      task.status = ExportStatus.IN_PROGRESS;
      task.progress = 10;
      this.exportTasks.set(taskId, task);
      
      // 收集数据
      const data = await this.collectExportData(config);
      task.progress = 50;
      this.exportTasks.set(taskId, task);
      
      // 生成文件
      const downloadUrl = await this.generateExportFile(data, config);
      task.progress = 90;
      this.exportTasks.set(taskId, task);
      
      // 完成
      task.status = ExportStatus.COMPLETED;
      task.progress = 100;
      task.downloadUrl = downloadUrl;
      task.completedAt = new Date();
      this.exportTasks.set(taskId, task);
      
    } catch (error) {
      task.status = ExportStatus.FAILED;
      task.error = error instanceof Error ? error.message : 'Unknown error';
      this.exportTasks.set(taskId, task);
      throw error;
    }
  }
  
  /**
   * 收集导出数据
   */
  private async collectExportData(config: ExportConfig): Promise<{
    overview?: any;
    efficiency?: ProcessingEfficiencyStats;
    quality?: QualityIndicatorStats;
    workload?: WorkloadStats;
    statusFlow?: StatusFlowStats;
    bottleneck?: BottleneckAnalysis;
    timeSeries?: TimeSeriesData[];
    rawData?: any[];
  }> {
    const data: any = {};
    
    if (config.sections.efficiency || config.sections.overview) {
      data.efficiency = await claimStatisticsService.getProcessingEfficiencyStats(
        config.caseId, 
        config.dateRange
      );
    }
    
    if (config.sections.quality || config.sections.overview) {
      data.quality = await claimStatisticsService.getQualityIndicatorStats(
        config.caseId, 
        config.dateRange
      );
    }
    
    if (config.sections.workload || config.sections.overview) {
      data.workload = await claimStatisticsService.getWorkloadStats(
        config.caseId, 
        config.dateRange
      );
    }
    
    if (config.sections.statusFlow || config.sections.overview) {
      data.statusFlow = await claimStatisticsService.getStatusFlowStats(
        config.caseId, 
        config.dateRange
      );
    }
    
    if (config.sections.bottleneck || config.sections.overview) {
      data.bottleneck = await claimStatisticsService.getBottleneckAnalysis(config.caseId);
    }
    
    if (config.sections.timeSeries || config.sections.overview) {
      data.timeSeries = await claimStatisticsService.getTimeSeriesData(config.caseId, 30);
    }
    
    // 生成概览数据
    if (config.sections.overview && data.efficiency && data.quality) {
      data.overview = {
        reportTitle: '债权申报统计分析报告',
        generatedAt: new Date().toLocaleString('zh-CN'),
        dateRange: config.dateRange ? {
          start: config.dateRange.start.toLocaleDateString('zh-CN'),
          end: config.dateRange.end.toLocaleDateString('zh-CN')
        } : '全部时间',
        summary: {
          totalClaims: data.efficiency.totalClaims,
          pendingClaims: data.efficiency.pendingClaims,
          processedClaims: data.efficiency.processedClaims,
          avgProcessingDays: data.efficiency.avgProcessingDays,
          onePassRate: data.quality.onePassRate,
          rejectionRate: data.quality.rejectionRate,
          supplementRequestRate: data.quality.supplementRequestRate,
          avgReviewRounds: data.quality.avgReviewRounds
        }
      };
    }
    
    return data;
  }
  
  /**
   * 生成导出文件
   */
  private async generateExportFile(data: any, config: ExportConfig): Promise<string> {
    switch (config.format) {
      case 'excel':
        return await this.generateExcelFile(data, config);
      case 'pdf':
        return await this.generatePdfFile(data, config);
      case 'csv':
        return await this.generateCsvFile(data, config);
      default:
        throw new Error(`Unsupported export format: ${config.format}`);
    }
  }
  
  /**
   * 生成Excel文件
   */
  private async generateExcelFile(data: any, config: ExportConfig): Promise<string> {
    try {
      // 这里应该使用一个Excel生成库，如 xlsx 或 exceljs
      // 由于项目环境限制，这里提供一个模拟实现
      const workbookData = this.prepareExcelData(data, config);
      
      // 模拟文件生成和上传
      const fileName = `claim_statistics_${Date.now()}.xlsx`;
      const fileUrl = await this.uploadFile(workbookData, fileName);
      
      return fileUrl;
    } catch (error) {
      throw new Error(`Excel generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * 生成PDF文件
   */
  private async generatePdfFile(data: any, config: ExportConfig): Promise<string> {
    try {
      // 这里应该使用一个PDF生成库，如 jsPDF 或 puppeteer
      // 由于项目环境限制，这里提供一个模拟实现
      const pdfContent = this.preparePdfContent(data, config);
      
      // 模拟文件生成和上传
      const fileName = `claim_statistics_${Date.now()}.pdf`;
      const fileUrl = await this.uploadFile(pdfContent, fileName);
      
      return fileUrl;
    } catch (error) {
      throw new Error(`PDF generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * 生成CSV文件
   */
  private async generateCsvFile(data: any, config: ExportConfig): Promise<string> {
    try {
      const csvContent = this.prepareCsvContent(data, config);
      
      // 模拟文件生成和上传
      const fileName = `claim_statistics_${Date.now()}.csv`;
      const fileUrl = await this.uploadFile(csvContent, fileName);
      
      return fileUrl;
    } catch (error) {
      throw new Error(`CSV generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * 准备Excel数据
   */
  private prepareExcelData(data: any, config: ExportConfig): any {
    const workbook = {
      sheets: [] as any[]
    };
    
    // 概览表
    if (config.sections.overview && data.overview) {
      workbook.sheets.push({
        name: '概览',
        data: this.formatOverviewForExcel(data.overview)
      });
    }
    
    // 效率统计表
    if (config.sections.efficiency && data.efficiency) {
      workbook.sheets.push({
        name: '处理效率',
        data: this.formatEfficiencyForExcel(data.efficiency)
      });
    }
    
    // 质量指标表
    if (config.sections.quality && data.quality) {
      workbook.sheets.push({
        name: '质量指标',
        data: this.formatQualityForExcel(data.quality)
      });
    }
    
    // 工作量统计表
    if (config.sections.workload && data.workload) {
      workbook.sheets.push({
        name: '工作量统计',
        data: this.formatWorkloadForExcel(data.workload)
      });
    }
    
    // 状态流转表
    if (config.sections.statusFlow && data.statusFlow) {
      workbook.sheets.push({
        name: '状态流转',
        data: this.formatStatusFlowForExcel(data.statusFlow)
      });
    }
    
    // 瓶颈分析表
    if (config.sections.bottleneck && data.bottleneck) {
      workbook.sheets.push({
        name: '瓶颈分析',
        data: this.formatBottleneckForExcel(data.bottleneck)
      });
    }
    
    // 时间序列表
    if (config.sections.timeSeries && data.timeSeries) {
      workbook.sheets.push({
        name: '时间趋势',
        data: this.formatTimeSeriesForExcel(data.timeSeries)
      });
    }
    
    return workbook;
  }
  
  /**
   * 准备PDF内容
   */
  private preparePdfContent(data: any, config: ExportConfig): string {
    let content = `<!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>债权申报统计分析报告</title>
      <style>
        body { font-family: 'Microsoft YaHei', sans-serif; margin: 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .section { margin-bottom: 30px; }
        .section h2 { color: #333; border-bottom: 2px solid #ddd; padding-bottom: 5px; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f5f5f5; }
        .summary-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
        .summary-card { border: 1px solid #ddd; padding: 15px; border-radius: 5px; }
        .number { font-size: 24px; font-weight: bold; color: #1976d2; }
      </style>
    </head>
    <body>`;
    
    // 添加标题
    if (data.overview) {
      content += `
      <div class="header">
        <h1>${data.overview.reportTitle}</h1>
        <p>生成时间: ${data.overview.generatedAt}</p>
        <p>统计时间范围: ${data.overview.dateRange}</p>
      </div>`;
    }
    
    // 添加各个部分的内容
    if (config.sections.overview && data.overview) {
      content += this.generateOverviewSection(data.overview);
    }
    
    if (config.sections.efficiency && data.efficiency) {
      content += this.generateEfficiencySection(data.efficiency);
    }
    
    if (config.sections.quality && data.quality) {
      content += this.generateQualitySection(data.quality);
    }
    
    if (config.sections.workload && data.workload) {
      content += this.generateWorkloadSection(data.workload);
    }
    
    if (config.sections.statusFlow && data.statusFlow) {
      content += this.generateStatusFlowSection(data.statusFlow);
    }
    
    if (config.sections.bottleneck && data.bottleneck) {
      content += this.generateBottleneckSection(data.bottleneck);
    }
    
    content += '</body></html>';
    
    return content;
  }
  
  /**
   * 准备CSV内容
   */
  private prepareCsvContent(data: any, config: ExportConfig): string {
    let csvContent = '\ufeff'; // BOM for UTF-8
    
    // 时间序列数据最适合CSV格式
    if (data.timeSeries && data.timeSeries.length > 0) {
      csvContent += '日期,提交数量,审核通过,审核驳回,补充材料\\n';
      data.timeSeries.forEach((item: TimeSeriesData) => {
        csvContent += `${item.date},${item.submissions},${item.approvals},${item.rejections},${item.supplements}\\n`;
      });
    }
    
    return csvContent;
  }
  
  // Excel格式化辅助方法
  private formatOverviewForExcel(overview: any): any[][] {
    return [
      ['报告标题', overview.reportTitle],
      ['生成时间', overview.generatedAt],
      ['统计时间范围', overview.dateRange],
      [''],
      ['指标', '数值'],
      ['总申报数量', overview.summary.totalClaims],
      ['待审核数量', overview.summary.pendingClaims],
      ['已处理数量', overview.summary.processedClaims],
      ['平均处理天数', overview.summary.avgProcessingDays],
      ['一次通过率', `${overview.summary.onePassRate}%`],
      ['驳回率', `${overview.summary.rejectionRate}%`],
      ['补充材料率', `${overview.summary.supplementRequestRate}%`],
      ['平均审核轮次', overview.summary.avgReviewRounds]
    ];
  }
  
  private formatEfficiencyForExcel(efficiency: ProcessingEfficiencyStats): any[][] {
    const data = [
      ['处理效率统计'],
      [''],
      ['指标', '数值'],
      ['总申报数量', efficiency.totalClaims],
      ['待审核数量', efficiency.pendingClaims],
      ['已处理数量', efficiency.processedClaims],
      ['平均处理天数', efficiency.avgProcessingDays],
      [''],
      ['时长分布', '数量', '占比']
    ];
    
    efficiency.timeRanges.forEach(range => {
      data.push([range.range, range.count, `${range.percentage}%`]);
    });
    
    return data;
  }
  
  private formatQualityForExcel(quality: QualityIndicatorStats): any[][] {
    return [
      ['质量指标统计'],
      [''],
      ['指标', '数值'],
      ['总审核数量', quality.totalReviewed],
      ['一次通过率', `${quality.onePassRate}%`],
      ['驳回率', `${quality.rejectionRate}%`],
      ['补充材料率', `${quality.supplementRequestRate}%`],
      ['平均审核轮次', quality.avgReviewRounds]
    ];
  }
  
  private formatWorkloadForExcel(workload: WorkloadStats): any[][] {
    const data = [
      ['工作量统计'],
      [''],
      ['审核人员工作量'],
      ['审核人员', '审核数量', '平均处理时长(天)', '效率指数']
    ];
    
    workload.reviewerStats.forEach(reviewer => {
      data.push([
        reviewer.reviewerName,
        reviewer.totalReviewed,
        reviewer.avgProcessingTime,
        reviewer.efficiency
      ]);
    });
    
    data.push([''], ['每日工作量'], ['日期', '操作数量', '审核数量']);
    
    workload.dailyWorkload.forEach(day => {
      data.push([day.date, day.operationsCount, day.reviewsCount]);
    });
    
    return data;
  }
  
  private formatStatusFlowForExcel(statusFlow: StatusFlowStats): any[][] {
    const data = [
      ['状态流转统计'],
      [''],
      ['状态分布'],
      ['状态', '数量', '占比']
    ];
    
    statusFlow.statusDistribution.forEach(status => {
      data.push([status.status, status.count, `${status.percentage}%`]);
    });
    
    data.push([''], ['流转分析'], ['原状态', '目标状态', '次数', '平均时长(天)']);
    
    statusFlow.flowAnalysis.forEach(flow => {
      data.push([flow.fromStatus, flow.toStatus, flow.count, flow.avgDuration]);
    });
    
    return data;
  }
  
  private formatBottleneckForExcel(bottleneck: BottleneckAnalysis): any[][] {
    const data = [
      ['瓶颈分析'],
      [''],
      ['瓶颈阶段'],
      ['阶段', '平均时长(天)', '影响案件数', '严重程度']
    ];
    
    bottleneck.bottleneckStages.forEach(stage => {
      data.push([stage.stage, stage.avgDuration, stage.claimCount, stage.severity]);
    });
    
    data.push([''], ['处理缓慢案件'], ['债权编号', '停留天数', '当前状态', '提交日期']);
    
    bottleneck.slowClaims.forEach(claim => {
      data.push([claim.claimNumber, claim.daysInStatus, claim.currentStatus, claim.submissionDate]);
    });
    
    return data;
  }
  
  private formatTimeSeriesForExcel(timeSeries: TimeSeriesData[]): any[][] {
    const data = [
      ['时间序列数据'],
      [''],
      ['日期', '提交数量', '审核通过', '审核驳回', '补充材料']
    ];
    
    timeSeries.forEach(item => {
      data.push([item.date, item.submissions, item.approvals, item.rejections, item.supplements]);
    });
    
    return data;
  }
  
  // PDF内容生成辅助方法
  private generateOverviewSection(overview: any): string {
    return `
    <div class="section">
      <h2>概览</h2>
      <div class="summary-grid">
        <div class="summary-card">
          <div class="number">${overview.summary.totalClaims}</div>
          <div>总申报数量</div>
        </div>
        <div class="summary-card">
          <div class="number">${overview.summary.avgProcessingDays}</div>
          <div>平均处理天数</div>
        </div>
        <div class="summary-card">
          <div class="number">${overview.summary.onePassRate}%</div>
          <div>一次通过率</div>
        </div>
        <div class="summary-card">
          <div class="number">${overview.summary.avgReviewRounds}</div>
          <div>平均审核轮次</div>
        </div>
      </div>
    </div>`;
  }
  
  private generateEfficiencySection(efficiency: ProcessingEfficiencyStats): string {
    let timeRangeRows = '';
    efficiency.timeRanges.forEach(range => {
      timeRangeRows += `<tr><td>${range.range}</td><td>${range.count}</td><td>${range.percentage}%</td></tr>`;
    });
    
    return `
    <div class="section">
      <h2>处理效率统计</h2>
      <table>
        <tr><th>时长分布</th><th>数量</th><th>占比</th></tr>
        ${timeRangeRows}
      </table>
    </div>`;
  }
  
  private generateQualitySection(quality: QualityIndicatorStats): string {
    return `
    <div class="section">
      <h2>质量指标统计</h2>
      <table>
        <tr><th>指标</th><th>数值</th></tr>
        <tr><td>总审核数量</td><td>${quality.totalReviewed}</td></tr>
        <tr><td>一次通过率</td><td>${quality.onePassRate}%</td></tr>
        <tr><td>驳回率</td><td>${quality.rejectionRate}%</td></tr>
        <tr><td>补充材料率</td><td>${quality.supplementRequestRate}%</td></tr>
        <tr><td>平均审核轮次</td><td>${quality.avgReviewRounds}</td></tr>
      </table>
    </div>`;
  }
  
  private generateWorkloadSection(workload: WorkloadStats): string {
    let reviewerRows = '';
    workload.reviewerStats.slice(0, 10).forEach(reviewer => {
      reviewerRows += `<tr><td>${reviewer.reviewerName}</td><td>${reviewer.totalReviewed}</td><td>${reviewer.avgProcessingTime}</td><td>${reviewer.efficiency}</td></tr>`;
    });
    
    return `
    <div class="section">
      <h2>工作量统计</h2>
      <h3>审核人员工作量 (Top 10)</h3>
      <table>
        <tr><th>审核人员</th><th>审核数量</th><th>平均处理时长(天)</th><th>效率指数</th></tr>
        ${reviewerRows}
      </table>
    </div>`;
  }
  
  private generateStatusFlowSection(statusFlow: StatusFlowStats): string {
    let statusRows = '';
    statusFlow.statusDistribution.forEach(status => {
      statusRows += `<tr><td>${status.status}</td><td>${status.count}</td><td>${status.percentage}%</td></tr>`;
    });
    
    return `
    <div class="section">
      <h2>状态流转统计</h2>
      <h3>状态分布</h3>
      <table>
        <tr><th>状态</th><th>数量</th><th>占比</th></tr>
        ${statusRows}
      </table>
    </div>`;
  }
  
  private generateBottleneckSection(bottleneck: BottleneckAnalysis): string {
    let stageRows = '';
    bottleneck.bottleneckStages.forEach(stage => {
      stageRows += `<tr><td>${stage.stage}</td><td>${stage.avgDuration}</td><td>${stage.claimCount}</td><td>${stage.severity}</td></tr>`;
    });
    
    let slowClaimRows = '';
    bottleneck.slowClaims.slice(0, 10).forEach(claim => {
      slowClaimRows += `<tr><td>${claim.claimNumber}</td><td>${claim.daysInStatus}</td><td>${claim.currentStatus}</td><td>${claim.submissionDate}</td></tr>`;
    });
    
    return `
    <div class="section">
      <h2>瓶颈分析</h2>
      <h3>瓶颈阶段</h3>
      <table>
        <tr><th>阶段</th><th>平均时长(天)</th><th>影响案件数</th><th>严重程度</th></tr>
        ${stageRows}
      </table>
      <h3>处理缓慢案件 (Top 10)</h3>
      <table>
        <tr><th>债权编号</th><th>停留天数</th><th>当前状态</th><th>提交日期</th></tr>
        ${slowClaimRows}
      </table>
    </div>`;
  }
  
  /**
   * 模拟文件上传
   */
  private async uploadFile(content: any, fileName: string): Promise<string> {
    // 这里应该实现实际的文件上传逻辑
    // 可以上传到云存储服务或本地服务器
    
    // 模拟异步上传
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 返回模拟的下载URL
    return `/downloads/${fileName}`;
  }
  
  /**
   * 清理过期的导出任务
   */
  cleanupExpiredTasks(maxAgeHours: number = 24): void {
    const now = Date.now();
    const maxAge = maxAgeHours * 60 * 60 * 1000;
    
    for (const [taskId, task] of this.exportTasks.entries()) {
      const age = now - task.createdAt.getTime();
      if (age > maxAge) {
        this.exportTasks.delete(taskId);
      }
    }
  }
}

export const claimDataExportService = new ClaimDataExportService();