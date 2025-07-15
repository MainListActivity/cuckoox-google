import type { AppUser } from '@/src/contexts/AuthContext';
import { dataService } from './dataService';

/**
 * 用户数据服务
 * 直接使用dataService.query查询用户信息，依赖service worker的统一缓存机制
 */
export class UserDataService {
  /**
   * 直接从数据库查询用户数据（会自动使用service worker缓存）
   */
  async getUserData(userId: string): Promise<AppUser | null> {
    try {
      const result = await dataService.query<AppUser[]>('SELECT * FROM user WHERE id = $userId', { userId });
      return result && result.length > 0 ? result[0] : null;
    } catch (error) {
      console.error('UserDataService: Error getting user data:', error);
      return null;
    }
  }
}

// 导出单例实例
export const userDataService = new UserDataService();