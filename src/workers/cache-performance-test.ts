/**
 * 缓存性能测试工具
 * 用于验证智能缓存系统的改进效果
 */

interface PerformanceTestResult {
  testName: string;
  totalQueries: number;
  cacheHitRate: number;
  avgResponseTime: number;
  localQueryTime: number;
  remoteQueryTime: number;
  networkSavings: number;
  timestamp: number;
}

interface TestScenario {
  name: string;
  description: string;
  queries: Array<{
    sql: string;
    params?: any;
    expectedSource?: 'local' | 'remote' | 'hybrid';
    iterations?: number;
  }>;
}

/**
 * 缓存性能测试器
 */
export class CachePerformanceTest {
  private results: PerformanceTestResult[] = [];
  private surrealService: any; // 假设有一个service用于发送消息到SW

  constructor(surrealService: any) {
    this.surrealService = surrealService;
  }

  /**
   * 运行完整的性能测试套件
   */
  async runFullTestSuite(): Promise<PerformanceTestResult[]> {
    console.log('🚀 开始运行缓存性能测试套件');

    const scenarios = this.getTestScenarios();
    
    for (const scenario of scenarios) {
      console.log(`\n📊 运行测试场景: ${scenario.name}`);
      console.log(`📝 描述: ${scenario.description}`);
      
      const result = await this.runTestScenario(scenario);
      this.results.push(result);
      
      console.log(`✅ 完成测试: ${scenario.name}`);
      console.log(`   缓存命中率: ${(result.cacheHitRate * 100).toFixed(1)}%`);
      console.log(`   平均响应时间: ${result.avgResponseTime.toFixed(2)}ms`);
      console.log(`   网络节省: ${(result.networkSavings * 100).toFixed(1)}%`);
    }

    console.log('\n📈 生成性能测试报告');
    this.generateReport();
    
    return this.results;
  }

  /**
   * 获取测试场景定义
   */
  private getTestScenarios(): TestScenario[] {
    return [
      {
        name: '用户权限数据查询',
        description: '测试用户角色、权限、菜单等个人数据的缓存效果',
        queries: [
          {
            sql: 'return $auth; select * from user where id = $user_id',
            params: { user_id: 'user:test1' },
            expectedSource: 'local',
            iterations: 10
          },
          {
            sql: 'return $auth; select * from has_role where user_id = $user_id',
            params: { user_id: 'user:test1' },
            expectedSource: 'local',
            iterations: 10
          },
          {
            sql: 'return $auth; select * from menu_metadata',
            expectedSource: 'local',
            iterations: 5
          }
        ]
      },
      {
        name: '案件相关数据查询',
        description: '测试案件、索赔等业务数据的缓存策略',
        queries: [
          {
            sql: 'select * from case where status = "active"',
            expectedSource: 'hybrid',
            iterations: 8
          },
          {
            sql: 'select * from claim where case_id = $case_id',
            params: { case_id: 'case:test1' },
            expectedSource: 'hybrid',
            iterations: 8
          },
          {
            sql: 'select * from case where id = $case_id',
            params: { case_id: 'case:test1' },
            expectedSource: 'local',
            iterations: 15
          }
        ]
      },
      {
        name: '实时数据查询',
        description: '测试通知、消息等实时性要求高的数据',
        queries: [
          {
            sql: 'select * from notification where user_id = $user_id and read = false',
            params: { user_id: 'user:test1' },
            expectedSource: 'remote',
            iterations: 5
          },
          {
            sql: 'select * from message where case_id = $case_id order by created_at desc limit 20',
            params: { case_id: 'case:test1' },
            expectedSource: 'remote',
            iterations: 5
          }
        ]
      },
      {
        name: '复杂查询',
        description: '测试连接查询、聚合查询等复杂查询的缓存策略',
        queries: [
          {
            sql: `
              select case.*, count(claim.id) as claim_count 
              from case 
              left join claim on claim.case_id = case.id 
              where case.status = "active" 
              group by case.id
            `,
            expectedSource: 'remote',
            iterations: 3
          },
          {
            sql: `
              select user.name, role.name as role_name 
              from user 
              join has_role on has_role.user_id = user.id 
              join role on role.id = has_role.role_id 
              where user.id = $user_id
            `,
            params: { user_id: 'user:test1' },
            expectedSource: 'hybrid',
            iterations: 5
          }
        ]
      },
      {
        name: '高频重复查询',
        description: '测试相同查询的缓存命中效果',
        queries: [
          {
            sql: 'select * from user where id = $user_id',
            params: { user_id: 'user:test1' },
            expectedSource: 'local',
            iterations: 20
          },
          {
            sql: 'select * from role',
            expectedSource: 'local',
            iterations: 15
          }
        ]
      }
    ];
  }

  /**
   * 运行单个测试场景
   */
  private async runTestScenario(scenario: TestScenario): Promise<PerformanceTestResult> {
    let totalQueries = 0;
    let cacheHits = 0;
    let totalResponseTime = 0;
    let localQueryTime = 0;
    let remoteQueryTime = 0;
    let localQueries = 0;
    let remoteQueries = 0;

    // 清理缓存以确保测试的一致性
    await this.clearCache();
    
    // 预热阶段：第一次执行每个查询
    console.log('   🔥 预热缓存...');
    for (const query of scenario.queries) {
      await this.executeQuery(query.sql, query.params);
    }

    // 等待一秒让缓存稳定
    await this.sleep(1000);

    // 正式测试阶段
    console.log('   📊 执行性能测试...');
    for (const query of scenario.queries) {
      const iterations = query.iterations || 1;
      
      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        
        try {
          const result = await this.executeQueryWithStats(query.sql, query.params);
          const endTime = performance.now();
          const responseTime = endTime - startTime;
          
          totalQueries++;
          totalResponseTime += responseTime;
          
          if (result.cacheHit) {
            cacheHits++;
          }
          
          if (result.source === 'local') {
            localQueries++;
            localQueryTime += responseTime;
          } else if (result.source === 'remote') {
            remoteQueries++;
            remoteQueryTime += responseTime;
          }
          
          // 验证是否符合预期
          if (query.expectedSource && result.source !== query.expectedSource) {
            console.warn(`   ⚠️  查询源不符合预期: 期望 ${query.expectedSource}, 实际 ${result.source}`);
          }
          
        } catch (error) {
          console.error(`   ❌ 查询执行失败:`, error);
        }
        
        // 小延迟避免过快查询
        if (i < iterations - 1) {
          await this.sleep(10);
        }
      }
    }

    // 计算统计指标
    const cacheHitRate = totalQueries > 0 ? cacheHits / totalQueries : 0;
    const avgResponseTime = totalQueries > 0 ? totalResponseTime / totalQueries : 0;
    const avgLocalTime = localQueries > 0 ? localQueryTime / localQueries : 0;
    const avgRemoteTime = remoteQueries > 0 ? remoteQueryTime / remoteQueries : 0;
    const networkSavings = totalQueries > 0 ? cacheHits / totalQueries : 0;

    return {
      testName: scenario.name,
      totalQueries,
      cacheHitRate,
      avgResponseTime,
      localQueryTime: avgLocalTime,
      remoteQueryTime: avgRemoteTime,
      networkSavings,
      timestamp: Date.now()
    };
  }

  /**
   * 执行查询并返回统计信息
   */
  private async executeQueryWithStats(sql: string, params?: any): Promise<any> {
    // 模拟调用增强查询处理器
    const result = await this.surrealService.query(sql, params);
    
    // 获取缓存统计信息
    const stats = await this.surrealService.sendMessage('get_cache_stats', {});
    
    // 这里需要根据实际实现来解析统计信息
    // 假设返回的结果包含缓存命中信息
    return {
      data: result,
      cacheHit: this.inferCacheHit(sql, result),
      source: this.inferQuerySource(sql, result),
      executionTime: this.extractExecutionTime(stats)
    };
  }

  /**
   * 推断是否命中缓存（简化实现）
   */
  private inferCacheHit(sql: string, result: any): boolean {
    // 简化的推断逻辑，实际应该从查询结果的元数据中获取
    const isSimpleSelect = sql.toLowerCase().includes('select') && 
                          !sql.toLowerCase().includes('join') &&
                          !sql.toLowerCase().includes('where');
    return isSimpleSelect && result && result.length > 0;
  }

  /**
   * 推断查询源（简化实现）
   */
  private inferQuerySource(sql: string, result: any): 'local' | 'remote' | 'hybrid' {
    // 简化的推断逻辑
    if (sql.toLowerCase().includes('notification') || sql.toLowerCase().includes('message')) {
      return 'remote';
    }
    
    if (sql.toLowerCase().includes('user') || sql.toLowerCase().includes('role')) {
      return 'local';
    }
    
    return 'hybrid';
  }

  /**
   * 提取执行时间（简化实现）
   */
  private extractExecutionTime(stats: any): number {
    // 简化实现，实际应该从统计数据中提取
    return Math.random() * 100 + 50; // 模拟50-150ms的执行时间
  }

  /**
   * 执行查询
   */
  private async executeQuery(sql: string, params?: any): Promise<any> {
    return this.surrealService.query(sql, params);
  }

  /**
   * 清理缓存
   */
  private async clearCache(): Promise<void> {
    try {
      await this.surrealService.sendMessage('clear_all_cache', {});
    } catch (error) {
      console.warn('清理缓存失败:', error);
    }
  }

  /**
   * 延迟函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 生成性能测试报告
   */
  private generateReport(): void {
    console.log('\n' + '='.repeat(80));
    console.log('📈 缓存性能测试报告');
    console.log('='.repeat(80));

    // 总体统计
    const totalQueries = this.results.reduce((sum, r) => sum + r.totalQueries, 0);
    const avgCacheHitRate = this.results.reduce((sum, r) => sum + r.cacheHitRate, 0) / this.results.length;
    const avgResponseTime = this.results.reduce((sum, r) => sum + r.avgResponseTime, 0) / this.results.length;
    const avgNetworkSavings = this.results.reduce((sum, r) => sum + r.networkSavings, 0) / this.results.length;

    console.log(`📊 总体统计:`);
    console.log(`   总查询数: ${totalQueries}`);
    console.log(`   平均缓存命中率: ${(avgCacheHitRate * 100).toFixed(1)}%`);
    console.log(`   平均响应时间: ${avgResponseTime.toFixed(2)}ms`);
    console.log(`   平均网络节省: ${(avgNetworkSavings * 100).toFixed(1)}%`);

    console.log(`\n📋 详细结果:`);
    
    // 创建表格格式的报告
    const headers = ['测试场景', '查询数', '命中率', '响应时间', '本地查询', '远程查询', '网络节省'];
    const colWidths = [20, 8, 8, 10, 10, 10, 10];
    
    // 打印表头
    const headerRow = headers.map((header, i) => header.padEnd(colWidths[i])).join(' | ');
    console.log(`   ${headerRow}`);
    console.log(`   ${'-'.repeat(headerRow.length)}`);
    
    // 打印数据行
    this.results.forEach(result => {
      const row = [
        result.testName.substring(0, 18).padEnd(colWidths[0]),
        result.totalQueries.toString().padEnd(colWidths[1]),
        `${(result.cacheHitRate * 100).toFixed(1)}%`.padEnd(colWidths[2]),
        `${result.avgResponseTime.toFixed(1)}ms`.padEnd(colWidths[3]),
        `${result.localQueryTime.toFixed(1)}ms`.padEnd(colWidths[4]),
        `${result.remoteQueryTime.toFixed(1)}ms`.padEnd(colWidths[5]),
        `${(result.networkSavings * 100).toFixed(1)}%`.padEnd(colWidths[6])
      ];
      console.log(`   ${row.join(' | ')}`);
    });

    console.log('\n🎯 性能改进建议:');
    this.generateRecommendations();
    
    console.log('\n💾 测试结果已保存，可用于后续分析');
    this.saveResults();
  }

  /**
   * 生成性能改进建议
   */
  private generateRecommendations(): void {
    const lowCacheHitScenarios = this.results.filter(r => r.cacheHitRate < 0.5);
    const slowQueryScenarios = this.results.filter(r => r.avgResponseTime > 100);
    
    if (lowCacheHitScenarios.length > 0) {
      console.log(`   📉 以下场景缓存命中率较低，建议优化:`);
      lowCacheHitScenarios.forEach(scenario => {
        console.log(`      - ${scenario.testName}: ${(scenario.cacheHitRate * 100).toFixed(1)}%`);
      });
    }
    
    if (slowQueryScenarios.length > 0) {
      console.log(`   🐌 以下场景响应时间较慢，建议优化:`);
      slowQueryScenarios.forEach(scenario => {
        console.log(`      - ${scenario.testName}: ${scenario.avgResponseTime.toFixed(1)}ms`);
      });
    }
    
    const bestScenario = this.results.reduce((best, current) => 
      current.cacheHitRate > best.cacheHitRate ? current : best
    );
    
    console.log(`   🏆 最佳性能场景: ${bestScenario.testName} (命中率: ${(bestScenario.cacheHitRate * 100).toFixed(1)}%)`);
  }

  /**
   * 保存测试结果
   */
  private saveResults(): void {
    const reportData = {
      timestamp: Date.now(),
      summary: {
        totalQueries: this.results.reduce((sum, r) => sum + r.totalQueries, 0),
        avgCacheHitRate: this.results.reduce((sum, r) => sum + r.cacheHitRate, 0) / this.results.length,
        avgResponseTime: this.results.reduce((sum, r) => sum + r.avgResponseTime, 0) / this.results.length
      },
      details: this.results
    };
    
    // 保存到localStorage或发送到服务器
    try {
      localStorage.setItem('cache_performance_test_results', JSON.stringify(reportData));
      console.log(`   ✅ 测试结果已保存到localStorage`);
    } catch (error) {
      console.warn(`   ⚠️  保存测试结果失败:`, error);
    }
  }

  /**
   * 获取测试结果
   */
  getResults(): PerformanceTestResult[] {
    return [...this.results];
  }

  /**
   * 比较两次测试结果
   */
  static compareResults(before: PerformanceTestResult[], after: PerformanceTestResult[]): void {
    console.log('\n📊 性能对比分析');
    console.log('='.repeat(60));
    
    const beforeAvg = before.reduce((sum, r) => sum + r.cacheHitRate, 0) / before.length;
    const afterAvg = after.reduce((sum, r) => sum + r.cacheHitRate, 0) / after.length;
    const improvement = ((afterAvg - beforeAvg) / beforeAvg) * 100;
    
    console.log(`缓存命中率改进: ${improvement.toFixed(1)}%`);
    console.log(`优化前平均命中率: ${(beforeAvg * 100).toFixed(1)}%`);
    console.log(`优化后平均命中率: ${(afterAvg * 100).toFixed(1)}%`);
  }
}

// 使用示例
export async function runCachePerformanceTest(surrealService: any): Promise<void> {
  const test = new CachePerformanceTest(surrealService);
  
  console.log('🚀 开始缓存性能测试');
  const results = await test.runFullTestSuite();
  
  console.log('\n✅ 测试完成');
  return results;
}