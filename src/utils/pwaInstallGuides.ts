export interface BrowserInstallGuide {
  browserName: string;
  browserVersion: string;
  platform: 'ios' | 'android' | 'desktop';
  deviceType: 'phone' | 'tablet' | 'desktop';
  supportsNativeInstall: boolean;
  steps: InstallStepDetail[];
  tips: string[];
  warnings?: string[];
  images?: BrowserInstallImages;
  videoUrl?: string;
  troubleshooting?: TroubleshootingStep[];
}

export interface InstallStepDetail {
  id: string;
  title: string;
  description: string;
  detailedDescription?: string;
  icon: string;
  imageUrl?: string;
  imageAlt?: string;
  isInteractive: boolean;
  expectedElement?: string; // CSS选择器或元素描述
  expectedText?: string; // 用户应该看到的文本
  commonMistakes?: string[];
  alternativeMethod?: string;
}

export interface BrowserInstallImages {
  shareButton?: string;
  addToHomeScreen?: string;
  installDialog?: string;
  homeScreenIcon?: string;
}

export interface TroubleshootingStep {
  problem: string;
  solution: string;
  priority: 'high' | 'medium' | 'low';
}

class PWAInstallGuideManager {
  private guides: Map<string, BrowserInstallGuide> = new Map();

  constructor() {
    this.initializeGuides();
  }

  private initializeGuides() {
    // iOS Safari 指引
    this.guides.set('ios-safari', {
      browserName: 'Safari',
      browserVersion: '11.3+',
      platform: 'ios',
      deviceType: 'phone',
      supportsNativeInstall: false,
      steps: [
        {
          id: 'ios-safari-step-1',
          title: '找到分享按钮',
          description: '在Safari底部工具栏中找到分享按钮',
          detailedDescription: '分享按钮是一个方框中带有向上箭头的图标，通常位于屏幕底部工具栏的中间位置。',
          icon: 'share',
          imageUrl: '/images/pwa-install/ios-safari-share-button.png',
          imageAlt: 'iOS Safari分享按钮位置',
          isInteractive: true,
          expectedElement: '[data-testid="share-button"]',
          expectedText: '分享',
          commonMistakes: [
            '在顶部地址栏中查找分享按钮',
            '与其他按钮混淆'
          ],
          alternativeMethod: '如果看不到底部工具栏，请向上滑动页面'
        },
        {
          id: 'ios-safari-step-2',
          title: '点击分享按钮',
          description: '轻点分享按钮打开分享菜单',
          detailedDescription: '点击后会弹出一个包含多个选项的分享菜单，包括AirDrop、信息、邮件等选项。',
          icon: 'touch',
          imageUrl: '/images/pwa-install/ios-safari-share-menu.png',
          imageAlt: 'iOS Safari分享菜单',
          isInteractive: true,
          expectedElement: '.share-menu',
          expectedText: '分享菜单',
          commonMistakes: [
            '长按分享按钮而不是轻点',
            '分享菜单没有完全加载就进行下一步'
          ]
        },
        {
          id: 'ios-safari-step-3',
          title: '找到"添加到主屏幕"',
          description: '在分享菜单中向下滚动，找到"添加到主屏幕"选项',
          detailedDescription: '这个选项通常在菜单的下半部分，图标是一个方框中带有加号的图标。如果没有看到，请向下滚动查看更多选项。',
          icon: 'add_to_home_screen',
          imageUrl: '/images/pwa-install/ios-safari-add-to-home.png',
          imageAlt: 'iOS Safari添加到主屏幕选项',
          isInteractive: true,
          expectedElement: '[data-action="add-to-home-screen"]',
          expectedText: '添加到主屏幕',
          commonMistakes: [
            '没有向下滚动查看更多选项',
            '与"书签"选项混淆'
          ],
          alternativeMethod: '如果看不到此选项，请确保您访问的是支持PWA的网站'
        },
        {
          id: 'ios-safari-step-4',
          title: '点击"添加到主屏幕"',
          description: '轻点"添加到主屏幕"选项',
          detailedDescription: '点击后会进入应用信息确认页面，显示应用图标、名称和URL。',
          icon: 'tap',
          imageUrl: '/images/pwa-install/ios-safari-confirm-page.png',
          imageAlt: 'iOS Safari确认添加页面',
          isInteractive: true,
          expectedElement: '.add-to-home-confirmation',
          expectedText: '添加到主屏幕确认页面',
          commonMistakes: [
            '误点其他分享选项'
          ]
        },
        {
          id: 'ios-safari-step-5',
          title: '确认添加',
          description: '在确认页面点击右上角的"添加"按钮',
          detailedDescription: '您可以在此页面修改应用名称。确认无误后，点击"添加"按钮完成安装。',
          icon: 'check',
          imageUrl: '/images/pwa-install/ios-safari-final-add.png',
          imageAlt: 'iOS Safari最终添加按钮',
          isInteractive: true,
          expectedElement: '[data-action="confirm-add"]',
          expectedText: '添加',
          commonMistakes: [
            '忘记点击"添加"按钮',
            '意外点击"取消"'
          ]
        }
      ],
      tips: [
        '确保您使用的是Safari浏览器，其他浏览器在iOS上可能不支持添加到主屏幕',
        '添加后的应用图标将出现在您的主屏幕上',
        '首次打开已安装的应用时，可能需要稍等片刻来加载',
        '已安装的应用支持离线访问部分功能',
        'iOS 11.3以上版本才完全支持PWA功能'
      ],
      warnings: [
        '如果分享菜单中没有"添加到主屏幕"选项，说明该网站不支持PWA功能',
        'iOS设备需要连接互联网才能完成安装过程'
      ],
      troubleshooting: [
        {
          problem: '分享菜单中找不到"添加到主屏幕"选项',
          solution: '请确保您使用的是Safari浏览器，并且网站支持PWA功能。尝试刷新页面后重试。',
          priority: 'high'
        },
        {
          problem: '点击"添加"后没有反应',
          solution: '请检查设备存储空间是否充足，并确保主屏幕有足够的空间放置新图标。',
          priority: 'medium'
        },
        {
          problem: '应用图标没有出现在主屏幕',
          solution: '图标可能被添加到了其他页面，请左右滑动主屏幕查找，或使用搜索功能。',
          priority: 'low'
        }
      ]
    });

    // iPad Safari 指引
    this.guides.set('ios-safari-tablet', {
      browserName: 'Safari',
      browserVersion: '11.3+',
      platform: 'ios',
      deviceType: 'tablet',
      supportsNativeInstall: false,
      steps: [
        {
          id: 'ipad-safari-step-1',
          title: '找到分享按钮',
          description: '在Safari地址栏右侧找到分享按钮',
          detailedDescription: 'iPad上的分享按钮位于地址栏的右侧，是一个方框中带有向上箭头的图标。',
          icon: 'share',
          imageUrl: '/images/pwa-install/ipad-safari-share-button.png',
          imageAlt: 'iPad Safari分享按钮位置',
          isInteractive: true,
          expectedElement: '[data-testid="share-button"]',
          expectedText: '分享',
          commonMistakes: [
            '在底部工具栏中查找分享按钮（iPad Safari的分享按钮在顶部）'
          ]
        },
        // ... 其他步骤类似iPhone，但位置不同
      ],
      tips: [
        'iPad的分享按钮位于顶部地址栏，而不是底部工具栏',
        '其他安装步骤与iPhone相同',
        'iPad安装的应用将显示为主屏幕图标'
      ]
    } as BrowserInstallGuide);

    // Android Chrome 指引
    this.guides.set('android-chrome', {
      browserName: 'Chrome',
      browserVersion: '70+',
      platform: 'android',
      deviceType: 'phone',
      supportsNativeInstall: true,
      steps: [
        {
          id: 'android-chrome-step-1',
          title: '等待安装提示',
          description: 'Chrome会自动显示"添加到主屏幕"横幅',
          detailedDescription: '当Chrome检测到网站支持PWA时，会在页面底部显示安装横幅。如果没有看到，请尝试下一步的手动方法。',
          icon: 'notification',
          imageUrl: '/images/pwa-install/android-chrome-banner.png',
          imageAlt: 'Android Chrome安装横幅',
          isInteractive: false,
          commonMistakes: [
            '过早关闭安装横幅',
            '没有注意到页面底部的安装提示'
          ],
          alternativeMethod: '如果没有看到自动提示，请使用手动安装方法'
        },
        {
          id: 'android-chrome-step-2',
          title: '点击"安装"按钮',
          description: '在横幅上点击"安装"或"添加到主屏幕"按钮',
          detailedDescription: '点击安装按钮后，Chrome会显示安装确认对话框。',
          icon: 'download',
          imageUrl: '/images/pwa-install/android-chrome-install-button.png',
          imageAlt: 'Android Chrome安装按钮',
          isInteractive: true,
          expectedElement: '[data-action="install"]',
          expectedText: '安装',
          commonMistakes: [
            '点击了关闭按钮而不是安装按钮'
          ]
        },
        {
          id: 'android-chrome-step-3',
          title: '确认安装',
          description: '在确认对话框中点击"安装"',
          detailedDescription: '确认对话框会显示应用信息，包括名称、图标和权限。确认无误后点击"安装"。',
          icon: 'check',
          imageUrl: '/images/pwa-install/android-chrome-confirm-dialog.png',
          imageAlt: 'Android Chrome确认安装对话框',
          isInteractive: true,
          expectedElement: '[data-action="confirm-install"]',
          expectedText: '安装',
          commonMistakes: [
            '点击了"取消"按钮',
            '没有仔细查看应用权限'
          ]
        }
      ],
      tips: [
        '安装后应用将出现在应用抽屉和主屏幕中',
        '应用支持全屏显示，提供原生应用体验',
        '可以通过长按应用图标来卸载',
        '应用会自动更新，无需手动干预',
        '支持离线使用和推送通知'
      ],
      warnings: [
        '需要Android 5.0以上版本和Chrome 70以上版本',
        '某些设备制造商可能会修改安装流程'
      ],
      troubleshooting: [
        {
          problem: '没有看到安装横幅',
          solution: '请尝试手动安装：点击Chrome菜单（三个点）> "添加到主屏幕"',
          priority: 'high'
        },
        {
          problem: '点击安装后没有反应',
          solution: '请检查Chrome版本是否为70以上，并确保设备有足够的存储空间',
          priority: 'medium'
        }
      ]
    });

    // Android Chrome 手动安装指引
    this.guides.set('android-chrome-manual', {
      browserName: 'Chrome',
      browserVersion: '70+',
      platform: 'android',
      deviceType: 'phone',
      supportsNativeInstall: false, // 这里指的是没有自动横幅时的手动安装
      steps: [
        {
          id: 'android-chrome-manual-step-1',
          title: '打开Chrome菜单',
          description: '点击浏览器右上角的三个点按钮',
          detailedDescription: '菜单按钮位于地址栏的右侧，点击后会显示下拉菜单。',
          icon: 'menu',
          imageUrl: '/images/pwa-install/android-chrome-menu.png',
          imageAlt: 'Android Chrome菜单按钮',
          isInteractive: true,
          expectedElement: '[data-testid="chrome-menu"]',
          expectedText: '菜单',
          commonMistakes: [
            '点击了地址栏或其他按钮'
          ]
        },
        {
          id: 'android-chrome-manual-step-2',
          title: '选择"添加到主屏幕"',
          description: '在菜单中找到并点击"添加到主屏幕"选项',
          detailedDescription: '这个选项通常在菜单的中间位置，图标是一个手机屏幕加上加号的图标。',
          icon: 'add_to_home_screen',
          imageUrl: '/images/pwa-install/android-chrome-add-to-home.png',
          imageAlt: 'Android Chrome添加到主屏幕选项',
          isInteractive: true,
          expectedElement: '[data-action="add-to-home-screen"]',
          expectedText: '添加到主屏幕',
          commonMistakes: [
            '选择了"书签"或其他类似选项'
          ]
        },
        {
          id: 'android-chrome-manual-step-3',
          title: '确认添加',
          description: '在确认对话框中点击"添加"',
          detailedDescription: '对话框会显示应用图标和名称，您可以修改名称。确认后点击"添加"。',
          icon: 'check',
          imageUrl: '/images/pwa-install/android-chrome-manual-confirm.png',
          imageAlt: 'Android Chrome手动添加确认',
          isInteractive: true,
          expectedElement: '[data-action="confirm-add"]',
          expectedText: '添加',
          commonMistakes: [
            '点击了"取消"按钮'
          ]
        }
      ],
      tips: [
        '手动安装的应用功能与自动安装相同',
        '这种方法适用于没有看到自动安装横幅的情况',
        '安装后的应用图标会出现在主屏幕上'
      ]
    } as BrowserInstallGuide);

    // 桌面 Chrome 指引
    this.guides.set('desktop-chrome', {
      browserName: 'Chrome',
      browserVersion: '70+',
      platform: 'desktop',
      deviceType: 'desktop',
      supportsNativeInstall: true,
      steps: [
        {
          id: 'desktop-chrome-step-1',
          title: '查找安装图标',
          description: '在地址栏右侧查找安装图标',
          detailedDescription: '当Chrome检测到PWA时，会在地址栏右侧显示一个安装图标（通常是一个加号或下载图标）。',
          icon: 'install_desktop',
          imageUrl: '/images/pwa-install/desktop-chrome-install-icon.png',
          imageAlt: '桌面Chrome安装图标',
          isInteractive: true,
          expectedElement: '[data-testid="install-button"]',
          expectedText: '安装',
          commonMistakes: [
            '没有注意到地址栏中的小图标'
          ],
          alternativeMethod: '也可以通过Chrome菜单 > "安装应用" 来安装'
        },
        {
          id: 'desktop-chrome-step-2',
          title: '点击安装图标',
          description: '点击地址栏中的安装图标',
          detailedDescription: '点击后会弹出安装确认对话框。',
          icon: 'click',
          imageUrl: '/images/pwa-install/desktop-chrome-click-install.png',
          imageAlt: '桌面Chrome点击安装',
          isInteractive: true,
          expectedElement: '[data-action="click-install"]',
          expectedText: '点击安装',
          commonMistakes: [
            '点击了其他地址栏按钮'
          ]
        },
        {
          id: 'desktop-chrome-step-3',
          title: '确认安装',
          description: '在弹出的对话框中点击"安装"',
          detailedDescription: '对话框会显示应用信息和权限。确认无误后点击"安装"按钮。',
          icon: 'check',
          imageUrl: '/images/pwa-install/desktop-chrome-confirm-install.png',
          imageAlt: '桌面Chrome确认安装',
          isInteractive: true,
          expectedElement: '[data-action="confirm-install"]',
          expectedText: '安装',
          commonMistakes: [
            '点击了"取消"按钮'
          ]
        }
      ],
      tips: [
        '安装后应用会出现在开始菜单和桌面（如果选择）',
        '应用会在独立窗口中运行，提供更好的体验',
        '可以通过Chrome应用管理器卸载应用',
        '应用支持离线使用和通知功能',
        '启动速度比网页版更快'
      ],
      warnings: [
        '需要Chrome 70以上版本',
        'Windows 10或macOS系统获得最佳体验'
      ],
      troubleshooting: [
        {
          problem: '地址栏中没有安装图标',
          solution: '尝试刷新页面，或通过Chrome菜单手动安装',
          priority: 'high'
        },
        {
          problem: '安装后找不到应用',
          solution: '检查开始菜单或应用列表，也可以在Chrome设置中查看已安装的应用',
          priority: 'medium'
        }
      ]
    });
  }

  // 根据设备信息获取最合适的安装指引
  public getInstallGuide(platform: string, browser: string, deviceType: string = 'phone'): BrowserInstallGuide | null {
    const key = `${platform}-${browser}${deviceType === 'tablet' ? '-tablet' : ''}`;
    
    // 精确匹配
    if (this.guides.has(key)) {
      return this.guides.get(key)!;
    }

    // 模糊匹配
    const fallbackKey = `${platform}-${browser}`;
    if (this.guides.has(fallbackKey)) {
      return this.guides.get(fallbackKey)!;
    }

    // 平台匹配
    for (const [guideKey, guide] of this.guides) {
      if (guide.platform === platform && guide.browserName.toLowerCase() === browser.toLowerCase()) {
        return guide;
      }
    }

    return null;
  }

  // 获取所有可用的指引
  public getAllGuides(): BrowserInstallGuide[] {
    return Array.from(this.guides.values());
  }

  // 获取特定平台的指引
  public getGuidesByPlatform(platform: string): BrowserInstallGuide[] {
    return Array.from(this.guides.values()).filter(guide => guide.platform === platform);
  }

  // 获取支持原生安装的指引
  public getNativeInstallGuides(): BrowserInstallGuide[] {
    return Array.from(this.guides.values()).filter(guide => guide.supportsNativeInstall);
  }

  // 检查是否有适合的指引
  public hasGuideFor(platform: string, browser: string): boolean {
    return this.getInstallGuide(platform, browser) !== null;
  }

  // 获取安装成功率统计（基于常见问题和解决方案）
  public getSuccessRate(platform: string, browser: string): number {
    const guide = this.getInstallGuide(platform, browser);
    if (!guide) return 0;

    // 基于是否支持原生安装和故障排除步骤数量来估算成功率
    let baseRate = guide.supportsNativeInstall ? 0.85 : 0.70;
    
    // 根据故障排除步骤数量调整
    const troubleshootingCount = guide.troubleshooting?.length || 0;
    const adjustment = Math.max(0, (3 - troubleshootingCount) * 0.05);
    
    return Math.min(0.95, baseRate + adjustment);
  }

  // 获取推荐的安装方法
  public getRecommendedMethod(platform: string, browser: string): 'native' | 'manual' | 'unsupported' {
    const guide = this.getInstallGuide(platform, browser);
    if (!guide) return 'unsupported';
    
    return guide.supportsNativeInstall ? 'native' : 'manual';
  }
}

// 单例实例
export const pwaInstallGuideManager = new PWAInstallGuideManager();

// 便捷函数
export const getInstallGuide = (platform: string, browser: string, deviceType?: string) => 
  pwaInstallGuideManager.getInstallGuide(platform, browser, deviceType);

export const hasInstallGuide = (platform: string, browser: string) => 
  pwaInstallGuideManager.hasGuideFor(platform, browser);

export const getInstallSuccessRate = (platform: string, browser: string) => 
  pwaInstallGuideManager.getSuccessRate(platform, browser);

export const getRecommendedInstallMethod = (platform: string, browser: string) => 
  pwaInstallGuideManager.getRecommendedMethod(platform, browser);