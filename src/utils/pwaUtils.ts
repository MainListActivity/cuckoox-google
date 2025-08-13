import { Workbox } from 'workbox-window';

export interface PWAUpdateInfo {
  isUpdateAvailable: boolean;
  skipWaiting: () => Promise<void>;
  registration: ServiceWorkerRegistration | null;
}

export interface PWAInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

class PWAManager {
  private workbox: Workbox | null = null;
  private installPrompt: PWAInstallPromptEvent | null = null;
  private updateCallbacks: Set<(info: PWAUpdateInfo) => void> = new Set();
  private installCallbacks: Set<(canInstall: boolean) => void> = new Set();

  constructor() {
    this.initializeWorkbox();
    this.setupInstallPromptListener();
  }

  private initializeWorkbox() {
    if ('serviceWorker' in navigator) {
      // 使用 Vite PWA 插件生成的 service worker
      const url = import.meta.env.DEV ? '/dev-sw.js?dev-sw' : '/sw-surreal.js';
      this.workbox = new Workbox(url, {
        scope: '/',
        type: 'module'
      });

      this.setupWorkboxListeners();
    }
  }

  private setupWorkboxListeners() {
    if (!this.workbox) return;

    // 监听 service worker 更新
    this.workbox.addEventListener('waiting', (event) => {
      const updateInfo: PWAUpdateInfo = {
        isUpdateAvailable: true,
        skipWaiting: async () => {
          if (event.sw) {
            // 先通知新Service Worker跳过等待
            event.sw.postMessage({ type: 'SKIP_WAITING' });
            
            // 等待新的 service worker 激活
            await new Promise<void>((resolve, reject) => {
              const timeout = setTimeout(() => {
                this.workbox?.removeEventListener('controlling', handleControlling);
                reject(new Error('Service Worker activation timeout'));
              }, 10000);

              const handleControlling = () => {
                clearTimeout(timeout);
                this.workbox?.removeEventListener('controlling', handleControlling);
                console.log('PWA: Service Worker activated and now controlling');
                resolve();
              };
              this.workbox?.addEventListener('controlling', handleControlling);
            });
            
            // 对于我们的应用，不需要强制刷新页面
            // ServiceWorkerEngine会自动更新引用并继续使用新的Service Worker
            console.log('PWA: Service Worker已更新，ServiceWorkerEngine将处理引用更新');
          }
        },
        registration: event.sw?.scriptURL ? 
          navigator.serviceWorker.getRegistration(event.sw.scriptURL) as any : null
      };

      this.notifyUpdateCallbacks(updateInfo);
    });

    // 监听 service worker 控制变化
    this.workbox.addEventListener('controlling', () => {
      console.log('New service worker is now controlling the page');
    });

    // 注册 service worker
    this.workbox.register().then((registration) => {
      console.log('PWA Service Worker registered successfully:', registration);
    }).catch((error) => {
      console.error('PWA Service Worker registration failed:', error);
    });
  }

  private setupInstallPromptListener() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.installPrompt = e as PWAInstallPromptEvent;
      this.notifyInstallCallbacks(true);
    });

    window.addEventListener('appinstalled', () => {
      console.log('PWA was installed');
      this.installPrompt = null;
      this.notifyInstallCallbacks(false);
    });
  }

  private notifyUpdateCallbacks(info: PWAUpdateInfo) {
    this.updateCallbacks.forEach(callback => callback(info));
  }

  private notifyInstallCallbacks(canInstall: boolean) {
    this.installCallbacks.forEach(callback => callback(canInstall));
  }

  // 公共方法
  public async showInstallPrompt(): Promise<boolean> {
    if (!this.installPrompt) {
      return false;
    }

    try {
      await this.installPrompt.prompt();
      const choiceResult = await this.installPrompt.userChoice;
      
      if (choiceResult.outcome === 'accepted') {
        console.log('User accepted the install prompt');
        return true;
      } else {
        console.log('User dismissed the install prompt');
        return false;
      }
    } catch (error) {
      console.error('Error showing install prompt:', error);
      return false;
    }
  }

  public canInstall(): boolean {
    return this.installPrompt !== null;
  }

  public isInstalled(): boolean {
    return window.matchMedia('(display-mode: standalone)').matches ||
           (window.navigator as any).standalone === true;
  }

  public onUpdateAvailable(callback: (info: PWAUpdateInfo) => void): () => void {
    this.updateCallbacks.add(callback);
    return () => this.updateCallbacks.delete(callback);
  }

  public onInstallPromptChange(callback: (canInstall: boolean) => void): () => void {
    this.installCallbacks.add(callback);
    return () => this.installCallbacks.delete(callback);
  }

  public async checkForUpdates(): Promise<void> {
    if (this.workbox) {
      await this.workbox.update();
    }
  }

  public getInstallPromptPlatforms(): string[] {
    return this.installPrompt?.platforms || [];
  }
}

// 单例实例
export const pwaManager = new PWAManager();

// 便捷函数
export const showPWAInstallPrompt = () => pwaManager.showInstallPrompt();
export const isPWAInstalled = () => pwaManager.isInstalled();
export const canInstallPWA = () => pwaManager.canInstall();
export const checkForPWAUpdates = () => pwaManager.checkForUpdates();

// React Hook 支持
export const usePWAInstall = () => {
  const [canInstall, setCanInstall] = React.useState(pwaManager.canInstall());
  const [isInstalled, setIsInstalled] = React.useState(pwaManager.isInstalled());

  React.useEffect(() => {
    const unsubscribe = pwaManager.onInstallPromptChange((canInstall) => {
      setCanInstall(canInstall);
      setIsInstalled(pwaManager.isInstalled());
    });

    return unsubscribe;
  }, []);

  return {
    canInstall,
    isInstalled,
    showInstallPrompt: pwaManager.showInstallPrompt.bind(pwaManager),
    platforms: pwaManager.getInstallPromptPlatforms()
  };
};

export const usePWAUpdate = () => {
  const [updateInfo, setUpdateInfo] = React.useState<PWAUpdateInfo | null>(null);

  React.useEffect(() => {
    const unsubscribe = pwaManager.onUpdateAvailable(setUpdateInfo);
    return unsubscribe;
  }, []);

  return {
    updateInfo,
    checkForUpdates: pwaManager.checkForUpdates.bind(pwaManager)
  };
};

// 添加 React 导入（如果在 React 环境中使用）
import React from 'react';