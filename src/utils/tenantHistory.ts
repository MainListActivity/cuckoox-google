// 租户历史记录管理工具
const TENANT_HISTORY_KEY = 'tenant_history';
const MAX_TENANT_HISTORY = 10; // 最多保存10个租户历史记录

export interface TenantHistoryItem {
  code: string;
  name?: string;
  lastUsed: number; // 时间戳
}

export class TenantHistoryManager {
  /**
   * 获取所有租户历史记录
   */
  static getTenantHistory(): TenantHistoryItem[] {
    try {
      const history = localStorage.getItem(TENANT_HISTORY_KEY);
      if (!history) return [];
      
      const parsed = JSON.parse(history) as TenantHistoryItem[];
      // 按最后使用时间排序（最近使用的在前面）
      return parsed.sort((a, b) => b.lastUsed - a.lastUsed);
    } catch (error) {
      console.error('Failed to get tenant history:', error);
      return [];
    }
  }

  /**
   * 添加或更新租户历史记录
   */
  static addTenantToHistory(tenantCode: string, tenantName?: string): void {
    try {
      const history = this.getTenantHistory();
      const now = Date.now();
      
      // 查找是否已存在该租户
      const existingIndex = history.findIndex(item => item.code === tenantCode);
      
      if (existingIndex !== -1) {
        // 更新现有记录的时间戳
        history[existingIndex].lastUsed = now;
        if (tenantName) {
          history[existingIndex].name = tenantName;
        }
      } else {
        // 添加新记录
        history.unshift({
          code: tenantCode,
          name: tenantName,
          lastUsed: now
        });
      }

      // 限制历史记录数量
      const limitedHistory = history.slice(0, MAX_TENANT_HISTORY);
      
      localStorage.setItem(TENANT_HISTORY_KEY, JSON.stringify(limitedHistory));
    } catch (error) {
      console.error('Failed to add tenant to history:', error);
    }
  }

  /**
   * 获取最近使用的租户
   */
  static getLastUsedTenant(): string | null {
    const history = this.getTenantHistory();
    return history.length > 0 ? history[0].code : null;
  }

  /**
   * 移除特定租户历史记录
   */
  static removeTenantFromHistory(tenantCode: string): void {
    try {
      const history = this.getTenantHistory();
      const filteredHistory = history.filter(item => item.code !== tenantCode);
      localStorage.setItem(TENANT_HISTORY_KEY, JSON.stringify(filteredHistory));
    } catch (error) {
      console.error('Failed to remove tenant from history:', error);
    }
  }

  /**
   * 清空所有租户历史记录
   */
  static clearTenantHistory(): void {
    try {
      localStorage.removeItem(TENANT_HISTORY_KEY);
    } catch (error) {
      console.error('Failed to clear tenant history:', error);
    }
  }

  /**
   * 搜索租户历史记录
   */
  static searchTenantHistory(query: string): TenantHistoryItem[] {
    const history = this.getTenantHistory();
    if (!query.trim()) return history;
    
    const lowerQuery = query.toLowerCase();
    return history.filter(item => 
      item.code.toLowerCase().includes(lowerQuery) ||
      (item.name && item.name.toLowerCase().includes(lowerQuery))
    );
  }
}

export default TenantHistoryManager;