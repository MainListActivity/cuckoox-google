/**
 * 移动端PWA安装检测与管理系统
 * 提供智能的移动端检测、安装状态判断和个性化引导逻辑
 */

export interface DeviceInfo {
  isMobile: boolean;
  isTablet: boolean;
  platform: "ios" | "android" | "desktop" | "unknown";
  browser: "safari" | "chrome" | "firefox" | "edge" | "samsung" | "unknown";
  osVersion: string;
  browserVersion: string;
  canInstallPWA: boolean;
  supportsNativeInstall: boolean;
  deviceName: string;
  screenSize: "small" | "medium" | "large";
  networkType: string;
  isLowEndDevice: boolean;
}

export interface PWAInstallState {
  isInstalled: boolean;
  canShowInstallPrompt: boolean;
  installMethod: "native" | "manual" | "unsupported";
  lastPromptTime: number;
  dismissCount: number;
  userInteractionLevel: "none" | "viewed" | "engaged" | "dismissed";
  installationHistory: InstallationHistoryEntry[];
}

export interface InstallationHistoryEntry {
  timestamp: number;
  action:
    | "prompt_shown"
    | "prompt_accepted"
    | "prompt_dismissed"
    | "manual_guide_viewed";
  platform: string;
  browser: string;
  result?: "success" | "failed" | "cancelled";
}

export interface InstallGuidance {
  title: string;
  description: string;
  steps: InstallStep[];
  videoUrl?: string;
  alternativeMethod?: InstallStep[];
  tips: string[];
  warnings?: string[];
}

export interface InstallStep {
  title: string;
  description: string;
  icon?: string;
  image?: string;
  isInteractive?: boolean;
  expectedAction?: string;
}

class MobilePWADetector {
  private deviceInfo: DeviceInfo | null = null;
  private installState: PWAInstallState | null = null;
  private storageKey = "cuckoox_pwa_install_state";
  private observers: Set<(state: PWAInstallState) => void> = new Set();

  constructor() {
    this.detectDevice();
    this.loadInstallState();
    this.setupEventListeners();
  }

  /**
   * 检测设备信息
   */
  private detectDevice(): DeviceInfo {
    const userAgent = navigator.userAgent.toLowerCase();
    const screenWidth = window.screen.width;
    const screenHeight = window.screen.height;
    const maxDimension = Math.max(screenWidth, screenHeight);
    const minDimension = Math.min(screenWidth, screenHeight);

    // 平台检测
    let platform: DeviceInfo["platform"] = "unknown";
    let osVersion = "";

    if (/iphone|ipad|ipod/.test(userAgent)) {
      platform = "ios";
      const match = userAgent.match(/os (\d+)_(\d+)/);
      if (match) osVersion = `${match[1]}.${match[2]}`;
    } else if (/android/.test(userAgent)) {
      platform = "android";
      const match = userAgent.match(/android (\d+(?:\.\d+)?)/);
      if (match) osVersion = match[1];
    } else if (!/mobile|tablet/.test(userAgent)) {
      platform = "desktop";
    }

    // 浏览器检测
    let browser: DeviceInfo["browser"] = "unknown";
    let browserVersion = "";

    if (/safari/.test(userAgent) && !/chrome/.test(userAgent)) {
      browser = "safari";
      const match = userAgent.match(/version\/(\d+(?:\.\d+)?)/);
      if (match) browserVersion = match[1];
    } else if (/chrome/.test(userAgent)) {
      if (/samsungbrowser/.test(userAgent)) {
        browser = "samsung";
        const match = userAgent.match(/samsungbrowser\/(\d+(?:\.\d+)?)/);
        if (match) browserVersion = match[1];
      } else {
        browser = "chrome";
        const match = userAgent.match(/chrome\/(\d+(?:\.\d+)?)/);
        if (match) browserVersion = match[1];
      }
    } else if (/firefox/.test(userAgent)) {
      browser = "firefox";
      const match = userAgent.match(/firefox\/(\d+(?:\.\d+)?)/);
      if (match) browserVersion = match[1];
    } else if (/edge/.test(userAgent)) {
      browser = "edge";
      const match = userAgent.match(/edge\/(\d+(?:\.\d+)?)/);
      if (match) browserVersion = match[1];
    }

    // 设备类型检测
    const isMobile = /mobile/.test(userAgent) || maxDimension < 768;
    const isTablet =
      !isMobile &&
      (/tablet|ipad/.test(userAgent) ||
        (maxDimension >= 768 && maxDimension < 1024));

    // 屏幕尺寸分类
    let screenSize: DeviceInfo["screenSize"] = "medium";
    if (minDimension < 360) screenSize = "small";
    else if (minDimension > 414) screenSize = "large";

    // PWA安装能力检测
    const canInstallPWA = this.checkPWAInstallCapability(
      platform,
      browser,
      browserVersion,
    );
    const supportsNativeInstall = this.checkNativeInstallSupport(
      platform,
      browser,
    );

    // 设备性能检测
    const isLowEndDevice = this.detectLowEndDevice();

    // 网络类型检测
    const networkType = this.getNetworkType();

    // 设备名称
    const deviceName = this.getDeviceName(platform, userAgent);

    this.deviceInfo = {
      isMobile,
      isTablet,
      platform,
      browser,
      osVersion,
      browserVersion,
      canInstallPWA,
      supportsNativeInstall,
      deviceName,
      screenSize,
      networkType,
      isLowEndDevice,
    };

    return this.deviceInfo;
  }

  /**
   * 检查PWA安装能力
   */
  private checkPWAInstallCapability(
    platform: DeviceInfo["platform"],
    browser: DeviceInfo["browser"],
    version: string,
  ): boolean {
    // 预先声明临时变量，避免在 switch case 中使用块级声明
    let iosVersion: number;
    let chromeVersion: number;
    let samsungVersion: number;

    switch (platform) {
      case "ios":
        // iOS 11.3+ 支持PWA
        iosVersion = parseFloat(version);
        return iosVersion >= 11.3;

      case "android":
        // Android Chrome 70+ 支持原生安装
        if (browser === "chrome") {
          chromeVersion = parseInt(version);
          return chromeVersion >= 70;
        }
        // Samsung Browser 支持
        if (browser === "samsung") {
          samsungVersion = parseInt(version);
          return samsungVersion >= 7.2;
        }
        return false;

      case "desktop":
        return ["chrome", "edge"].includes(browser);

      default:
        return false;
    }
  }

  /**
   * 检查原生安装支持
   */
  private checkNativeInstallSupport(
    platform: DeviceInfo["platform"],
    browser: DeviceInfo["browser"],
  ): boolean {
    if (platform === "ios") return false; // iOS不支持原生安装提示
    if (platform === "android" && ["chrome", "samsung"].includes(browser))
      return true;
    if (platform === "desktop" && ["chrome", "edge"].includes(browser))
      return true;
    return false;
  }

  /**
   * 检测低端设备
   */
  private detectLowEndDevice(): boolean {
    // 基于内存和硬件并发检测
    const memory = (navigator as any).deviceMemory;
    const cores = navigator.hardwareConcurrency;

    if (memory && memory < 2) return true; // 内存小于2GB
    if (cores && cores < 4) return true; // CPU核心数少于4

    return false;
  }

  /**
   * 获取网络类型
   */
  private getNetworkType(): string {
    const connection =
      (navigator as any).connection ||
      (navigator as any).mozConnection ||
      (navigator as any).webkitConnection;

    if (connection) {
      return connection.effectiveType || connection.type || "unknown";
    }

    return "unknown";
  }

  /**
   * 获取设备名称
   */
  private getDeviceName(
    platform: DeviceInfo["platform"],
    userAgent: string,
  ): string {
    if (platform === "ios") {
      if (/ipad/.test(userAgent)) return "iPad";
      if (/iphone/.test(userAgent)) return "iPhone";
      if (/ipod/.test(userAgent)) return "iPod Touch";
    } else if (platform === "android") {
      // 尝试提取Android设备型号
      const match = userAgent.match(/\(([^)]*android[^)]*)\)/i);
      if (match) {
        const parts = match[1].split(";");
        for (const part of parts) {
          const trimmed = part.trim();
          if (trimmed && !trimmed.match(/android|mobile|build|wv/i)) {
            return trimmed;
          }
        }
      }
      return "Android设备";
    }

    return "设备";
  }

  /**
   * 加载安装状态
   */
  private loadInstallState(): PWAInstallState {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        this.installState = JSON.parse(stored);
      }
    } catch (error) {
      console.warn("Failed to load PWA install state:", error);
    }

    if (!this.installState) {
      this.installState = {
        isInstalled: this.checkCurrentInstallStatus(),
        canShowInstallPrompt: true,
        installMethod: "unsupported",
        lastPromptTime: 0,
        dismissCount: 0,
        userInteractionLevel: "none",
        installationHistory: [],
      };
    }

    return this.installState;
  }

  /**
   * 保存安装状态
   */
  private saveInstallState(): void {
    if (this.installState) {
      try {
        localStorage.setItem(
          this.storageKey,
          JSON.stringify(this.installState),
        );
        this.notifyObservers();
      } catch (error) {
        console.warn("Failed to save PWA install state:", error);
      }
    }
  }

  /**
   * 检查当前安装状态
   */
  private checkCurrentInstallStatus(): boolean {
    // 检查PWA显示模式
    const isStandalone = window.matchMedia(
      "(display-mode: standalone)",
    ).matches;
    const isFullscreen = window.matchMedia(
      "(display-mode: fullscreen)",
    ).matches;
    const isMinimalUI = window.matchMedia("(display-mode: minimal-ui)").matches;

    // iOS Safari standalone 模式检测
    const isIOSStandalone = (window.navigator as any).standalone === true;

    return isStandalone || isFullscreen || isMinimalUI || isIOSStandalone;
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    // 监听显示模式变化
    const mediaQuery = window.matchMedia("(display-mode: standalone)");
    mediaQuery.addEventListener("change", (e) => {
      if (this.installState) {
        this.installState.isInstalled = e.matches;
        this.saveInstallState();
      }
    });

    // 监听网络状态变化
    window.addEventListener("online", this.handleNetworkChange.bind(this));
    window.addEventListener("offline", this.handleNetworkChange.bind(this));
  }

  /**
   * 处理网络状态变化
   */
  private handleNetworkChange(): void {
    if (this.deviceInfo) {
      this.deviceInfo.networkType = this.getNetworkType();
    }
  }

  /**
   * 通知观察者
   */
  private notifyObservers(): void {
    if (this.installState) {
      this.observers.forEach((callback) => callback(this.installState!));
    }
  }

  /**
   * 记录用户行为
   */
  private recordUserAction(
    action: InstallationHistoryEntry["action"],
    result?: InstallationHistoryEntry["result"],
  ): void {
    if (!this.installState || !this.deviceInfo) return;

    const entry: InstallationHistoryEntry = {
      timestamp: Date.now(),
      action,
      platform: this.deviceInfo.platform,
      browser: this.deviceInfo.browser,
      result,
    };

    this.installState.installationHistory.push(entry);

    // 保持历史记录在合理范围内
    if (this.installState.installationHistory.length > 50) {
      this.installState.installationHistory =
        this.installState.installationHistory.slice(-30);
    }

    this.saveInstallState();
  }

  // 公共方法

  /**
   * 获取设备信息
   */
  public getDeviceInfo(): DeviceInfo {
    return this.deviceInfo || this.detectDevice();
  }

  /**
   * 获取安装状态
   */
  public getInstallState(): PWAInstallState {
    return this.installState || this.loadInstallState();
  }

  /**
   * 检查是否应该显示安装提示
   */
  public shouldShowInstallPrompt(): boolean {
    const device = this.getDeviceInfo();
    const state = this.getInstallState();

    // 基本条件检查
    if (
      state.isInstalled ||
      !device.canInstallPWA ||
      !state.canShowInstallPrompt
    ) {
      return false;
    }

    // 防骚扰逻辑
    const now = Date.now();
    const timeSinceLastPrompt = now - state.lastPromptTime;
    const daysSinceLastPrompt = timeSinceLastPrompt / (1000 * 60 * 60 * 24);

    // 根据拒绝次数调整显示间隔
    const minimumDaysBetweenPrompts = Math.min(1 + state.dismissCount * 2, 30);

    if (daysSinceLastPrompt < minimumDaysBetweenPrompts) {
      return false;
    }

    // 网络状态检查（低网速时不显示）
    if (device.networkType === "slow-2g" || device.networkType === "2g") {
      return false;
    }

    return true;
  }

  /**
   * 获取安装指导
   */
  public getInstallGuidance(): InstallGuidance {
    const device = this.getDeviceInfo();

    switch (device.platform) {
      case "ios":
        return this.getIOSInstallGuidance(device);
      case "android":
        return this.getAndroidInstallGuidance(device);
      default:
        return this.getDesktopInstallGuidance(device);
    }
  }

  /**
   * iOS安装指导
   */
  private getIOSInstallGuidance(device: DeviceInfo): InstallGuidance {
    const isIPad = device.deviceName === "iPad";

    return {
      title: `在${device.deviceName}上安装CuckooX`,
      description: "将应用添加到主屏幕，获得原生应用体验",
      steps: [
        {
          title: "打开分享菜单",
          description: isIPad
            ? "点击地址栏中的分享按钮 ⎋"
            : "点击底部工具栏的分享按钮 ⎋",
          icon: "share",
          isInteractive: true,
          expectedAction: "tap_share_button",
        },
        {
          title: "找到添加选项",
          description: '在分享菜单中找到"添加到主屏幕"选项',
          icon: "add_to_home_screen",
          image: "/images/ios-add-to-home.png",
        },
        {
          title: "确认添加",
          description: '点击"添加"按钮完成安装',
          icon: "check",
          expectedAction: "confirm_add",
        },
      ],
      tips: [
        "确保您使用的是Safari浏览器",
        "添加后可以像普通应用一样使用",
        "支持离线访问和推送通知",
      ],
      warnings:
        device.osVersion && parseFloat(device.osVersion) < 11.3
          ? ["您的iOS版本可能不完全支持PWA功能，建议更新系统"]
          : undefined,
    };
  }

  /**
   * Android安装指导
   */
  private getAndroidInstallGuidance(device: DeviceInfo): InstallGuidance {
    if (device.supportsNativeInstall) {
      return {
        title: "在Android设备上安装CuckooX",
        description: "一键安装到桌面，获得原生应用体验",
        steps: [
          {
            title: "点击安装按钮",
            description: '点击下方的"安装应用"按钮',
            icon: "download",
            isInteractive: true,
            expectedAction: "tap_install_button",
          },
          {
            title: "确认安装",
            description: '在弹出的对话框中点击"安装"',
            icon: "check",
            expectedAction: "confirm_install",
          },
        ],
        tips: [
          "安装后将出现在应用抽屉中",
          "支持全屏显示和离线使用",
          "可以接收推送通知",
        ],
      };
    } else {
      return {
        title: "手动添加到桌面",
        description: "通过浏览器菜单添加到桌面",
        steps: [
          {
            title: "打开菜单",
            description: "点击浏览器右上角的菜单按钮（三个点）",
            icon: "menu",
          },
          {
            title: "添加到桌面",
            description: '选择"添加到主屏幕"或"安装应用"',
            icon: "add_to_home_screen",
          },
          {
            title: "确认添加",
            description: '点击"添加"或"安装"完成',
            icon: "check",
          },
        ],
        tips: [
          "不同浏览器的菜单位置可能略有不同",
          "建议在Chrome或Samsung Browser中使用",
        ],
      };
    }
  }

  /**
   * 桌面端安装指导
   */
  private getDesktopInstallGuidance(device: DeviceInfo): InstallGuidance {
    return {
      title: "安装到桌面",
      description: "将应用安装到桌面，快速访问",
      steps: [
        {
          title: "点击安装按钮",
          description: "点击地址栏右侧的安装图标或下方的安装按钮",
          icon: "download",
          isInteractive: true,
        },
        {
          title: "确认安装",
          description: '在弹出的对话框中点击"安装"',
          icon: "check",
        },
      ],
      tips: [
        "安装后可在开始菜单中找到",
        "支持独立窗口运行",
        "享受更快的启动速度",
      ],
    };
  }

  /**
   * 标记提示已显示
   */
  public markPromptShown(): void {
    const state = this.getInstallState();
    state.lastPromptTime = Date.now();
    state.userInteractionLevel = "viewed";
    this.recordUserAction("prompt_shown");
  }

  /**
   * 标记用户接受安装
   */
  public markInstallAccepted(): void {
    const state = this.getInstallState();
    state.userInteractionLevel = "engaged";
    this.recordUserAction("prompt_accepted", "success");
  }

  /**
   * 标记用户拒绝安装
   */
  public markInstallDismissed(): void {
    const state = this.getInstallState();
    state.dismissCount += 1;
    state.userInteractionLevel = "dismissed";

    // 根据拒绝次数调整后续显示策略
    if (state.dismissCount >= 3) {
      state.canShowInstallPrompt = false;
    }

    this.recordUserAction("prompt_dismissed");
  }

  /**
   * 重置安装状态（用于测试或重新启用）
   */
  public resetInstallState(): void {
    localStorage.removeItem(this.storageKey);
    this.installState = null;
    this.loadInstallState();
  }

  /**
   * 订阅状态变化
   */
  public subscribe(callback: (state: PWAInstallState) => void): () => void {
    this.observers.add(callback);
    return () => this.observers.delete(callback);
  }

  /**
   * 获取安装统计
   */
  public getInstallStats() {
    const state = this.getInstallState();
    const device = this.getDeviceInfo();

    return {
      device,
      state,
      history: state.installationHistory,
      recommendations: this.getInstallRecommendations(),
    };
  }

  /**
   * 获取安装建议
   */
  private getInstallRecommendations(): string[] {
    const device = this.getDeviceInfo();
    const state = this.getInstallState();
    const recommendations: string[] = [];

    if (device.isLowEndDevice) {
      recommendations.push("检测到设备性能较低，PWA版本将提供更流畅的体验");
    }

    if (device.networkType === "slow-2g" || device.networkType === "2g") {
      recommendations.push("当前网络较慢，安装PWA后可离线使用缓存功能");
    }

    if (state.dismissCount > 0) {
      recommendations.push("PWA版本启动更快，占用存储空间更小");
    }

    if (device.platform === "ios" && !state.isInstalled) {
      recommendations.push("在iOS设备上，PWA提供与原生应用相似的体验");
    }

    return recommendations;
  }
}

// 单例实例
export const mobilePWADetector = new MobilePWADetector();

// 便捷函数
export const getDeviceInfo = () => mobilePWADetector.getDeviceInfo();
export const getInstallState = () => mobilePWADetector.getInstallState();
export const shouldShowInstallPrompt = () =>
  mobilePWADetector.shouldShowInstallPrompt();
export const getInstallGuidance = () => mobilePWADetector.getInstallGuidance();
