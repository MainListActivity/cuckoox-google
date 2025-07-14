import { RecordId, jsonify } from 'surrealdb';
import type { AppUser } from '@/src/contexts/AuthContext';

/**
 * 用户缓存服务
 * 提供统一的用户数据缓存接口，封装Service Worker通信
 */
export class UserCacheService {
  private serviceWorkerComm: {
    sendMessage: (type: string, payload?: any) => Promise<any>;
    isAvailable: () => boolean;
    waitForReady: () => Promise<void>;
  } | null = null;

  /**
   * 设置Service Worker通信接口
   */
  setServiceWorkerComm(comm: {
    sendMessage: (type: string, payload?: any) => Promise<any>;
    isAvailable: () => boolean;
    waitForReady: () => Promise<void>;
  }) {
    this.serviceWorkerComm = comm;
  }

  /**
   * 从缓存获取用户数据（优先Service Worker，fallback到localStorage）
   */
  async getUserData(userId: string): Promise<AppUser | null> {
    try {
      // 首先尝试从Service Worker获取
      if (this.serviceWorkerComm?.isAvailable()) {
        await this.serviceWorkerComm.waitForReady();
        const result = await this.serviceWorkerComm.sendMessage('get_cached_record', {
          table: 'user',
          recordId: userId
        });

        if (result?.record) {
          console.log('UserCacheService: Found user data in Service Worker cache');
          return this.deserializeAppUser(result.record);
        }
      }

      // Fallback到localStorage（向后兼容）
      const storedUser = localStorage.getItem('cuckoox-user');
      if (storedUser) {
        console.log('UserCacheService: Found user data in localStorage (fallback)');
        return this.deserializeAppUserFromLocalStorage(storedUser);
      }

      return null;
    } catch (error) {
      console.error('UserCacheService: Error getting user data:', error);
      
      // 出错时仍然尝试localStorage fallback
      try {
        const storedUser = localStorage.getItem('cuckoox-user');
        if (storedUser) {
          return this.deserializeAppUserFromLocalStorage(storedUser);
        }
      } catch (fallbackError) {
        console.error('UserCacheService: Fallback to localStorage also failed:', fallbackError);
      }
      
      return null;
    }
  }

  /**
   * 保存用户数据到缓存
   */
  async saveUserData(user: AppUser): Promise<void> {
    try {
      // 保存到Service Worker缓存
      if (this.serviceWorkerComm?.isAvailable()) {
        await this.serviceWorkerComm.waitForReady();
        await this.serviceWorkerComm.sendMessage('cache_record', {
          table: 'user',
          recordId: user.id.toString(),
          record: this.serializeAppUser(user),
          cacheType: 'persistent'
        });
        console.log('UserCacheService: Saved user data to Service Worker cache');
      }

      // 同时保存到localStorage（向后兼容）
      localStorage.setItem('cuckoox-user', JSON.stringify(jsonify(user)));
      console.log('UserCacheService: Saved user data to localStorage (compatibility)');
      
    } catch (error) {
      console.error('UserCacheService: Error saving user data:', error);
      // 至少保存到localStorage作为fallback
      try {
        localStorage.setItem('cuckoox-user', JSON.stringify(jsonify(user)));
      } catch (fallbackError) {
        console.error('UserCacheService: Fallback save to localStorage failed:', fallbackError);
      }
    }
  }

  /**
   * 更新用户数据
   */
  async updateUserData(userId: string, updates: Partial<AppUser>): Promise<void> {
    try {
      // 先获取当前用户数据
      const currentUser = await this.getUserData(userId);
      if (!currentUser) {
        throw new Error(`User ${userId} not found in cache`);
      }

      // 合并更新
      const updatedUser: AppUser = { ...currentUser, ...updates };

      // 保存更新后的数据
      await this.saveUserData(updatedUser);
      
    } catch (error) {
      console.error('UserCacheService: Error updating user data:', error);
      throw error;
    }
  }

  /**
   * 清除用户数据缓存
   */
  async clearUserData(userId?: string): Promise<void> {
    try {
      // 清除Service Worker缓存
      if (this.serviceWorkerComm?.isAvailable() && userId) {
        await this.serviceWorkerComm.waitForReady();
        await this.serviceWorkerComm.sendMessage('clear_cached_record', {
          table: 'user',
          recordId: userId
        });
        console.log('UserCacheService: Cleared user data from Service Worker cache');
      }

      // 清除localStorage
      localStorage.removeItem('cuckoox-user');
      console.log('UserCacheService: Cleared user data from localStorage');
      
    } catch (error) {
      console.error('UserCacheService: Error clearing user data:', error);
      // 至少清除localStorage
      localStorage.removeItem('cuckoox-user');
    }
  }

  /**
   * 从localStorage迁移数据到Service Worker
   */
  async migrateFromLocalStorage(): Promise<void> {
    try {
      const storedUser = localStorage.getItem('cuckoox-user');
      if (!storedUser) return;

      const user = this.deserializeAppUserFromLocalStorage(storedUser);
      if (!user) return;

      // 检查Service Worker中是否已有数据
      if (this.serviceWorkerComm?.isAvailable()) {
        await this.serviceWorkerComm.waitForReady();
        const existingData = await this.serviceWorkerComm.sendMessage('get_cached_record', {
          table: 'user',
          recordId: user.id.toString()
        });

        if (!existingData?.record) {
          // Service Worker中没有数据，执行迁移
          await this.saveUserData(user);
          console.log('UserCacheService: Migrated user data from localStorage to Service Worker');
        }
      }
    } catch (error) {
      console.error('UserCacheService: Error migrating from localStorage:', error);
    }
  }

  /**
   * 序列化AppUser对象
   */
  private serializeAppUser(user: AppUser): any {
    return jsonify(user);
  }

  /**
   * 反序列化AppUser对象（从Service Worker缓存）
   */
  private deserializeAppUser(userData: any): AppUser {
    return {
      ...userData,
      id: typeof userData.id === 'string' 
        ? new RecordId(userData.id.split(':')[0], userData.id.split(':')[1]) 
        : userData.id,
      last_login_case_id: userData.last_login_case_id
        ? (typeof userData.last_login_case_id === 'string'
          ? new RecordId(userData.last_login_case_id.split(':')[0], userData.last_login_case_id.split(':')[1])
          : userData.last_login_case_id)
        : null
    };
  }

  /**
   * 反序列化AppUser对象（从localStorage）
   */
  private deserializeAppUserFromLocalStorage(userJson: string): AppUser {
    const parsed = JSON.parse(userJson);
    return {
      ...parsed,
      id: typeof parsed.id === 'string' 
        ? new RecordId(parsed.id.split(':')[0], parsed.id.split(':')[1]) 
        : parsed.id,
      last_login_case_id: parsed.last_login_case_id
        ? (typeof parsed.last_login_case_id === 'string'
          ? new RecordId(parsed.last_login_case_id.split(':')[0], parsed.last_login_case_id.split(':')[1])
          : parsed.last_login_case_id)
        : null
    };
  }

  /**
   * 检查Service Worker是否可用
   */
  isServiceWorkerAvailable(): boolean {
    return this.serviceWorkerComm?.isAvailable() ?? false;
  }
}

// 导出单例实例
export const userCacheService = new UserCacheService();