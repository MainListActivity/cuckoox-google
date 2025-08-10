/**
 * 内存管理和测试稳定性工具
 * 帮助避免内存泄漏和提高测试稳定性
 */

export class MemoryTestUtils {
  private static memoryCheckInterval: NodeJS.Timeout | null = null;
  private static memoryThreshold = 500 * 1024 * 1024; // 500MB 阈值

  /**
   * 启动内存监控
   */
  static startMemoryMonitoring(): void {
    if (this.memoryCheckInterval) return;

    this.memoryCheckInterval = setInterval(() => {
      const usage = process.memoryUsage();
      const heapUsed = usage.heapUsed;
      
      if (heapUsed > this.memoryThreshold) {
        console.warn(`⚠️ 内存使用较高: ${Math.round(heapUsed / 1024 / 1024)}MB`);
        
        // 强制垃圾回收（如果可用）
        if (global.gc) {
          console.log('🧹 执行垃圾回收');
          global.gc();
        }
      }
    }, 5000); // 每5秒检查一次
  }

  /**
   * 停止内存监控
   */
  static stopMemoryMonitoring(): void {
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
      this.memoryCheckInterval = null;
    }
  }

  /**
   * 强制清理内存
   */
  static forceMemoryCleanup(): void {
    // 执行垃圾回收
    if (global.gc) {
      global.gc();
    }

    // 清理任何悬空的定时器
    const nodeVersion = process.version;
    if (nodeVersion && global.clearImmediate) {
      // 清理任何 setImmediate 回调
    }
  }

  /**
   * 等待内存稳定
   */
  static async waitForMemoryStable(timeoutMs: number = 5000): Promise<void> {
    const startTime = Date.now();
    let previousHeap = process.memoryUsage().heapUsed;

    while (Date.now() - startTime < timeoutMs) {
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const currentHeap = process.memoryUsage().heapUsed;
      const change = Math.abs(currentHeap - previousHeap);
      
      // 如果内存变化小于1MB，认为已稳定
      if (change < 1024 * 1024) {
        return;
      }
      
      previousHeap = currentHeap;
    }
  }

  /**
   * 获取内存使用报告
   */
  static getMemoryReport(): string {
    const usage = process.memoryUsage();
    return `内存使用: RSS=${Math.round(usage.rss / 1024 / 1024)}MB, Heap=${Math.round(usage.heapUsed / 1024 / 1024)}MB/${Math.round(usage.heapTotal / 1024 / 1024)}MB, External=${Math.round(usage.external / 1024 / 1024)}MB`;
  }

  /**
   * 安全地执行异步操作，带超时和错误恢复
   */
  static async safeAsyncOperation<T>(
    operation: () => Promise<T>,
    timeoutMs: number = 10000,
    retries: number = 2
  ): Promise<T | null> {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const result = await Promise.race([
          operation(),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('操作超时')), timeoutMs)
          )
        ]);
        
        return result;
      } catch (error) {
        console.warn(`⚠️ 操作失败 (尝试 ${attempt + 1}/${retries}):`, error);
        
        if (attempt < retries - 1) {
          // 等待一段时间后重试
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // 尝试清理内存
          this.forceMemoryCleanup();
        }
      }
    }
    
    return null;
  }

  /**
   * 包装测试函数，提供内存保护
   */
  static wrapTestWithMemoryProtection<T extends any[], R>(
    testFn: (...args: T) => Promise<R>
  ): (...args: T) => Promise<R> {
    return async (...args: T): Promise<R> => {
      const startMemory = process.memoryUsage().heapUsed;
      
      try {
        const result = await this.safeAsyncOperation(() => testFn(...args));
        
        if (result === null) {
          throw new Error('测试操作失败或超时');
        }
        
        return result;
      } finally {
        // 清理内存
        this.forceMemoryCleanup();
        
        // 等待内存稳定
        await this.waitForMemoryStable(2000);
        
        const endMemory = process.memoryUsage().heapUsed;
        const memoryDiff = endMemory - startMemory;
        
        if (memoryDiff > 50 * 1024 * 1024) { // 50MB 增长警告
          console.warn(`⚠️ 测试后内存增长: ${Math.round(memoryDiff / 1024 / 1024)}MB`);
        }
      }
    };
  }
}

export default MemoryTestUtils;