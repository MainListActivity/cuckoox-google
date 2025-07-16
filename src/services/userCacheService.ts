import type { AppUser } from '@/src/contexts/AuthContext';
import { queryWithAuth } from '@/src/utils/surrealAuth';
import type { SurrealWorkerAPI } from '@/src/lib/surrealServiceWorkerClient';

/**
 * 直接从数据库查询用户数据（会自动使用service worker缓存）
 */
export async function getUserData(client: SurrealWorkerAPI, userId: string): Promise<AppUser | null> {
    try {
      const result = await queryWithAuth<AppUser[]>(client, 'SELECT * FROM user WHERE id = $userId', { userId });
      return result && result.length > 0 ? result[0] : null;
    } catch (error) {
      console.error('UserDataService: Error getting user data:', error);
      return null;
    }
}

// Backward compatibility: create a service object with methods that require client to be passed
export const userDataService = {
  getUserData,
  // Legacy methods for compatibility - will be removed later
  setDataService: () => {
    console.warn('userDataService.setDataService is deprecated. Use direct function calls instead.');
  }
};