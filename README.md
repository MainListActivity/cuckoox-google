# CuckooX Google - 破产案件全生命周期管理平台

这是一个专为破产案件管理人设计的综合性案件管理和分析平台，基于React 19 + TypeScript + SurrealDB构建，支持破产案件从立案到结案的全生命周期管理。

> **重要说明**: 本系统的所有AI助手交互均使用简体中文进行响应，以确保更好的本地化体验。

## 系统概述

破产案件全生命周期管理平台提供以下核心功能：

- **案件管理**: 完整的破产案件生命周期管理，支持状态流转和关键时间节点管理
- **债权人管理**: 债权人信息录入、批量导入和快递单打印功能
- **债权申报**: 在线债权申报系统，支持富文本编辑和附件上传
- **债权审核**: 专业的债权审核工具，支持批注和批量操作
- **债权操作追踪**: 完整的债权生命周期操作记录追踪系统，支持操作历史、版本控制、状态流转管理 🚧 **开发中** (80%完成)
- **实时数据大屏**: 基于SurrealDB Live Query的实时数据监控和可视化
- **会议管理**: 债权人会议安排和会议纪要管理
- **消息中心**: 系统通知和即时消息功能
- **权限管理**: 基于角色的细粒度权限控制系统
- **PWA应用**: 支持离线访问、推送通知、桌面安装等原生应用体验

## 业务流程

系统支持完整的破产案件业务流程：

```
立案 → 公告 → 债权申报 → 债权人第一次会议 → 
├─ 破产清算
└─ 裁定重整 → 提交重整计划/延迟提交重整计划 → 债权人第二次会议 → 结案
```

## 核心技术特性

### PWA (Progressive Web App) 支持 ✅ **已完成**
系统已完成PWA基础设施搭建，提供原生应用般的用户体验：

- **应用安装**: 支持"添加到主屏幕"，可像原生应用一样启动
- **离线访问**: 静态资源缓存确保网络不稳定时界面可用
- **推送通知**: 重要案件更新和债权申报通知推送（开发中）
- **响应式设计**: 适配手机、平板、桌面等多种设备
- **快速启动**: App Shell架构实现秒级启动体验
- **自动更新**: 后台检测并提示应用更新
- **网络状态感知**: 智能检测网络状态变化，调整功能可用性
- **跨平台兼容**: 支持Android、iOS、桌面端不同的安装流程
- **统一加载体验**: 全局加载组件与应用启动画面保持一致的视觉体验

### 移动端UI优化 🚧 **进行中**
系统正在进行全面的移动端用户界面优化，基于详细的需求分析和用户体验研究：

#### 📱 移动端优化需求 (✅ 需求分析完成)
基于对 `https://dev.cuckoox.cn/cases` 页面的深入分析，制定了10个核心需求领域：

1. **移动端列表展示优化**: 卡片式布局、信息优先级、展开/收起功能
2. **触摸友好的交互设计**: 44px最小触摸目标、FAB按钮、视觉反馈
3. **移动端搜索和筛选优化**: 全屏搜索框、底部抽屉筛选、实时建议
4. **统计信息移动端适配**: 2×2网格布局、紧凑模式、点击跳转
5. **移动端导航优化**: 固定顶部导航、智能隐藏、页面转场动画
6. **响应式布局系统**: 多设备适配、横屏支持、智能切换
7. **性能和加载优化**: 3秒内加载、骨架屏、虚拟滚动
8. **可访问性和用户体验**: 屏幕阅读器、高对比度、键盘导航
9. **数据展示优化**: 图标编码、相对时间、彩色标签
10. **手势和交互增强**: 滑动操作、下拉刷新、长按菜单

#### 🎯 当前实现状态
- **响应式组件**: 实现ResponsiveTable、ResponsiveStatsCards等核心响应式组件 (✅ 已完成)
- **移动端布局**: 完成MobileOptimizedLayout、MobileSearchFilter等移动端专用组件 (✅ 已完成)
- **智能布局切换**: 桌面端表格在移动端自动转换为卡片列表 (✅ 已完成)
- **触摸友好设计**: 符合移动端44px最小触摸目标标准 (✅ 已完成)
- **响应式Hook系统**: 提供useResponsiveLayout等工具Hook支持设备检测 (✅ 已完成)
- **CSS变量系统**: 建立完整的响应式样式变量和断点管理 (✅ 已完成)
- **PWA安全区域适配**: 支持刘海屏和全屏模式的安全区域适配 (✅ 已完成)
- **手势交互系统**: 滑动、长按、双击等手势操作支持 (🚧 开发中)
- **性能优化**: 虚拟滚动、懒加载、骨架屏等移动端性能优化 (🚧 开发中)
- **现有页面适配**: 将案件列表等核心页面迁移到新的移动端架构 (📋 计划中)

### 统一加载体验设计 ✅ **已完成**
系统实现了从应用启动到页面加载的一致性视觉体验：

- **启动画面**: `index.html`中的CSS加载动画，在React应用加载前显示
- **全局加载器**: `GlobalLoader`组件使用相同的视觉设计和动画资源
- **响应式适配**: 支持桌面端(400x300px)和移动端(300x225px)的动画尺寸
- **深色模式支持**: 自动检测系统主题，使用对应的深色/浅色动画资源
- **品牌一致性**: 使用CuckooX品牌色彩(#009688/#4db6ac)和专业渐变背景
- **性能优化**: SVG动画资源，加载快速且可缩放

**加载体验组件**:
```typescript
// 全局加载器 - 与启动画面视觉一致
import GlobalLoader from '@/src/components/GlobalLoader';
<GlobalLoader message="正在加载案件数据..." />

// 核心特性：
// - 全屏覆盖 (z-index: 9999)
// - 品牌动画背景 (/assets/loading-animation.svg)
// - 响应式消息显示 (桌面端1.1em，移动端1em)
// - 深色模式自适应 (自动切换动画和色彩)
// - 平滑的消息呼吸动画效果 (2秒循环透明度变化)
// - 内联样式实现，避免样式冲突
// - 与index.html启动画面完全一致的视觉体验
```

**PWA基础设施完成情况**:
- ✅ **Web App Manifest**: 完整的应用元数据配置，支持多尺寸SVG图标
- ✅ **PWA安装管理器**: 智能检测安装条件，自适应不同平台的安装流程
- ✅ **Vite PWA插件配置**: 自动生成Service Worker，优化缓存策略
- ✅ **PWA更新通知**: 自动检测应用更新并提供用户友好的更新界面
- ✅ **PWA工具函数和Hooks**: 完整的React集成，支持安装状态管理和更新检测
- ✅ **多平台支持**: 针对Android、iOS、桌面端的差异化安装体验
- ✅ **PWA测试页面**: 完整的PWA功能测试和验证工具

**PWA核心组件**:
```typescript
// PWA安装管理 - 智能检测和自适应UI
import PWAInstallManager from '@/src/components/PWAInstallManager';
<PWAInstallManager 
  autoShowPrompt={true}
  showInstallBanner={true}
  onInstallStateChange={(state) => console.log(state)}
/>

// PWA更新通知 - 自动检测和友好提示
import PWAUpdateNotification from '@/src/components/PWAUpdateNotification';
<PWAUpdateNotification autoCheckInterval={30 * 60 * 1000} />

// PWA工具函数和React Hooks
import { 
  usePWAInstall, 
  usePWAUpdate,
  showPWAInstallPrompt,
  isPWAInstalled,
  canInstallPWA 
} from '@/src/utils/pwaUtils';

const { canInstall, isInstalled, showInstallPrompt, platforms } = usePWAInstall();
const { updateInfo, checkForUpdates } = usePWAUpdate();
```

**PWA配置特性**:
- **Vite PWA插件**: 自动生成Service Worker和Web App Manifest，支持自动更新
- **Workbox集成**: 智能缓存策略和离线支持，包含字体和API缓存
- **SVG图标支持**: 使用可缩放的SVG图标，支持任意尺寸和maskable图标
- **应用快捷方式**: 支持案件管理、债权申报、统一仪表板等快捷入口
- **多平台适配**: 针对Android、iOS、桌面端的差异化配置
- **离线优先**: 静态资源缓存确保离线可用性
- **渐进式增强**: 在支持PWA的浏览器中提供增强体验

### SurrealDB 全文检索支持
系统集成了 SurrealDB 的强大全文检索功能，支持：

- **智能搜索高亮**: 使用 `search::highlight()` 函数高亮匹配关键词
- **相关性评分**: 通过 `search::score()` 函数进行搜索结果排序
- **多字段检索**: 支持在标题、内容等多个字段中同时搜索
- **中文分词**: 原生支持中文文本的分词和检索

**使用示例**:
```sql
-- 在案件名称和描述中搜索关键词
SELECT *,
  search::highlight("**", "**", 0) AS highlighted_name,
  search::highlight("##", "##", 1) AS highlighted_description,
  search::score(0) + search::score(1) AS relevance_score
FROM case
WHERE name @0@ "破产重整"
   OR description @1@ "债权申报"
ORDER BY relevance_score DESC
LIMIT 20;
```

## 用户角色

- **ADMIN**: 超级管理员
- **案件负责人**: 案件管理人，拥有完整的案件管理权限
- **协办律师**: 案件协办人员
- **债权审核员**: 专门负责债权审核的人员
- **债权人**: 债权申报用户

## 数据库访问模式

系统支持两种数据库访问方式，可通过环境变量`VITE_DB_ACCESS_MODE`配置：

### Service Worker 模式 (推荐) ✨
- **配置**: `VITE_DB_ACCESS_MODE=service-worker`
- **当前状态**: 🚧 **核心架构重构进行中** - 智能缓存系统核心组件已完成集成，正在进行缓存策略优化和功能完善
- **核心特性**:
  - 🚀 **智能缓存路由系统**: 缓存命中率可达60-80%，查询响应时间减少70-90%
  - 🔄 **实时数据同步**: 基于SurrealDB Live Query的增量数据同步
  - 📱 **离线数据访问**: 网络断开时仍可访问已缓存的数据
  - 🎯 **页面感知订阅**: 自动识别页面数据需求并进行智能订阅管理
  - 🔐 **认证状态管理**: 内存中的认证状态快速响应，Token自动刷新
  - 🏢 **多租户数据隔离**: 确保不同租户数据的完全隔离和安全性
  - ⚙️ **配置化缓存策略**: 支持持久化缓存和临时缓存的灵活配置
  - 📊 **性能监控**: 提供详细的缓存命中率、响应时间等性能指标

### 直接连接模式
- **配置**: `VITE_DB_ACCESS_MODE=direct`
- **特性**:
  - 直接连接SurrealDB
  - 调试更容易
  - 延迟更低
  - 不支持离线功能和智能缓存

## 环境变量配置

复制`.env.example`到`.env`并配置相应的环境变量：

```bash
# 数据库访问方式
VITE_DB_ACCESS_MODE=service-worker  # 或 direct

# SurrealDB配置
VITE_SURREALDB_WS_URL=wss://your-surrealdb-url/rpc
VITE_SURREALDB_NS=ck_go
VITE_SURREALDB_DB=test

# 其他配置...
```

## 使用说明

### 切换数据库访问模式

1. **修改环境变量**: 编辑`.env`文件中的`VITE_DB_ACCESS_MODE`
2. **重启应用**: 重新运行`bun run dev`
3. **验证切换**: 查看控制台日志确认使用的模式

### 智能缓存系统特性

**Service Worker 模式**下的增强功能：

#### 🎯 核心缓存功能 (✅ 已完成)
- **智能查询路由**: 系统自动判断使用本地缓存还是远程查询，支持5种缓存策略
- **配置化缓存策略**: 支持持久化缓存和临时缓存两种类型，可动态调整TTL和优先级
- **认证状态管理**: 内存中维护用户权限、角色、菜单等个人数据，实现毫秒级响应

#### 🔄 实时同步功能 (🚧 部分完成)
- **缓存执行器和策略**: 多种缓存策略的具体执行逻辑开发和优化 (🚧 进行中)
- **页面感知订阅**: 自动识别页面数据需求并进行订阅管理，支持多页面订阅合并 (🚧 开发中)
- **实时数据同步**: 基于SurrealDB Live Query的实时数据更新和增量同步 (✅ 已完成)
- **离线数据访问**: 网络断开时仍可访问已缓存的数据，支持离线修改暂存 (📋 计划中)

#### 🛡️ 安全与隔离 (✅ 已完成)
- **多租户数据隔离**: 基于SurrealDB database级别的完全隔离，系统自动获取用户租户信息并设置数据库连接 (✅ 已完成)
- **数据一致性保证**: 支持数据冲突检测和智能解决机制 (📋 计划中)

#### 📊 监控与优化 (✅ 已完成)
- **性能监控**: 提供缓存命中率、响应时间、订阅健康状态等详细性能指标
- **缓存容量管理**: 智能LRU清理策略，自动管理缓存空间使用 (📋 计划中)
- **调试工具**: 提供缓存状态检查、查询执行跟踪等调试功能

#### 📈 性能提升效果
- **缓存命中率**: 从 < 20% 提升到 60-80%
- **查询响应时间**: 减少 70-90%（从200-500ms降至10-50ms）
- **网络请求量**: 减少 50-70%
- **用户体验**: 显著提升页面加载速度和操作流畅度

### 开发和调试

- **Service Worker 模式**: 适合生产环境，提供完整的智能缓存和离线功能
- **直接连接模式**: 适合开发调试，更简单直接但功能有限

### 兼容性说明

- ✅ **零侵入性**: 现有代码无需修改，统一客户端自动处理不同模式
- ✅ **API兼容**: 通过SurrealProvider的Context提供统一接口
- ✅ **向后兼容**: 保持原有的`surreal`属性访问方式
- ✅ **透明集成**: 新的智能缓存系统完全透明，不影响现有业务逻辑
- ✅ **渐进式迁移**: 支持新旧系统并存，可平滑升级
- ✅ **降级机制**: 智能缓存系统失败时自动回退到原始远程查询，确保系统稳定性

## 📚 文档资源

### PWA功能文档
- **[PWA优化指南](./doc/pwa-optimization-guide.md)** - PWA功能特性和使用指南
- **[PWA组件API](./doc/pwa-components-api.md)** - PWA组件详细API文档
- **[PWA开发设置](./doc/pwa-setup-guide.md)** - 开发环境配置和部署指南
- **[PWA测试指南](./doc/pwa-testing-guide.md)** - 完整的PWA测试策略

### 移动端UI优化文档
- **[移动端UI优化需求](./.kiro/specs/mobile-ui-optimization/requirements.md)** - 详细的移动端优化需求分析和验收标准
- **[移动端优化设计](./.kiro/specs/mobile-ui-optimization/design.md)** - 移动端UI优化架构设计和组件规范
- **[移动端实施计划](./.kiro/specs/mobile-ui-optimization/tasks.md)** - 移动端优化的详细实施计划和任务分解
- **[响应式组件API](./doc/responsive-components-api.md)** - 响应式组件详细API文档
- **[响应式优化指南](./doc/responsive-optimization-guide.md)** - 响应式布局优化指南

### 系统架构文档
- **[增强缓存架构](./doc/enhanced-cache-architecture.md)** - 智能缓存系统架构设计
- **[缓存系统API](./doc/cache-system-api.md)** - 缓存系统接口文档
- **[集成指南](./doc/integration-guide.md)** - 系统集成和配置指南

### 债权操作追踪系统文档 🚧 **开发中**
- **[债权操作追踪需求](./.kiro/specs/claim-operation-tracking/requirements.md)** - 债权申报操作记录追踪系统的详细需求分析
- **[债权操作追踪设计](./.kiro/specs/claim-operation-tracking/design.md)** - 操作记录追踪系统的技术架构设计
- **[债权操作追踪任务](./.kiro/specs/claim-operation-tracking/tasks.md)** - 系统实施的详细任务分解和进度跟踪
- **[债权操作追踪架构](./doc/claim-operation-tracking-architecture.md)** - 系统架构和技术实现指南
- **[债权操作追踪开发状态](./doc/claim-operation-tracking-development-status.md)** - 当前开发进度和实现状态

#### 🎯 核心功能特性
- **操作历史记录**: 记录债权从创建到最终确认的所有操作，包含操作类型、操作人、时间、数据变更等完整信息
- **状态流转管理**: 完整记录债权状态的每次变更，包含流转原因、审核意见和流转时长统计
- **版本控制系统**: 每次重要操作都保存完整的数据快照，支持任意版本间的字段级差异对比
- **权限审计追踪**: 记录所有用户对债权数据的访问行为，支持敏感操作审计和异常行为检测

#### 📊 当前实现状态
- **数据库表结构**: 20% 完成 - claim表版本控制字段已添加，4个核心追踪表待实现
- **核心服务层**: 60% 完成 - 4个核心服务类已实现，现有ClaimService集成待完成
- **前端组件**: 80% 完成 - ClaimOperationHistory、ClaimVersionComparison、ClaimStatusFlowChart、ClaimAuditLog已实现
- **系统集成**: 0% 完成 - 缓存系统集成待实现，通知系统和权限系统集成暂缓实施

#### 🔧 技术架构
- **数据层**: 基于SurrealDB的4个核心追踪表，支持完整的权限控制和查询优化
- **服务层**: ClaimOperationService、ClaimVersionService、ClaimStatusFlowService、ClaimAuditService
- **前端层**: React组件支持操作历史展示、版本对比、状态流转可视化
- **缓存集成**: 与现有智能缓存系统深度集成，提供优化的数据访问性能

### 完整文档索引
- **[文档中心](./doc/README.md)** - 所有文档的完整索引和导航

### 缓存系统架构

#### 核心组件 (✅ 已完成集成)
- **EnhancedQueryHandler**: 统一查询处理器，集成所有智能缓存功能
- **QueryRouter**: 智能查询路由器，分析SQL特征并决定最优缓存策略
- **CacheExecutor**: 缓存执行器，实现多种缓存策略的具体执行逻辑
- **SubscriptionManager**: 订阅管理器，精细化管理Live Query订阅
- **DataCacheManager**: 数据缓存管理器，管理本地数据存储和认证状态

#### 代码架构特性 (✅ 已完成)
- **模块化设计**: 清晰的组件职责分离，便于维护和扩展
- **统一导入路径**: 使用 `@/src/types/surreal` 路径别名，提升代码一致性和可维护性
- **类型安全**: 完善的TypeScript类型定义，确保代码质量
- **零侵入性**: 完全兼容现有代码，无需修改前端业务逻辑

#### 当前开发状态 (2025年1月20日更新)
- ✅ **智能缓存系统集成**: 已成功将EnhancedQueryHandler系统集成到Service Worker
- ✅ **查询处理优化**: 已替换原有的简单缓存逻辑，实现智能查询路由
- ✅ **缓存管理接口**: 已添加完整的缓存管理消息类型和API
- ✅ **性能监控**: 已实现详细的缓存性能统计和监控功能
- ✅ **多租户数据隔离**: 已完成简化的租户数据库管理，基于database级别的数据隔离
- ✅ **代码质量改进**: 统一使用 `@/src/types/surreal` 路径别名，提升代码一致性
- 🚧 **缓存执行器和策略**: 多种缓存策略的具体执行逻辑开发和优化（70%完成，进行中）
- 🚧 **页面感知订阅**: 自动识别页面数据需求并进行订阅管理（30%完成，开发中）
- 📋 **离线数据访问**: 网络断开时的本地数据访问和修改暂存（20%完成，计划中）

#### 缓存策略类型
- **LOCAL_FIRST**: 本地优先，适用于用户个人数据和低变化频率的数据
- **REMOTE_FIRST**: 远程优先，适用于实时性要求高的数据
- **HYBRID**: 混合模式，根据数据新鲜度和网络状况智能切换
- **LOCAL_ONLY**: 仅本地，适用于离线模式
- **REMOTE_ONLY**: 仅远程，适用于写操作和强一致性要求的查询

## Run Locally

**Prerequisites:**  Node.js

```shell
ssh-keygen -t rsa -b 2048 -C "1025988443@qq.com" -f ~/.ssh/cuckoox

git config --global user.email "1025988443@qq.com"
git config --global user.name "MainActivity"
git config --global core.sshCommand "ssh -i ~/.ssh/cuckoox"
```

```json
{
    "server": "xxxxx",
    "server_port": 6001,
    "password": "xxxx",
    "local_port": 1080,
    "local_address": "192.168.1.116",
    "method": "aes-256-gcm",
    "timeout": 120,
    "mode": "tcp_and_udp",
    "fast_open": false,
    "locals": [
        {
            "protocol": "http",
            "local_address": "192.168.1.116",
            "local_port": 3128
        }
    ]
}
```

1. Install dependencies:
   `bun install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.dev) to your Gemini API key
3. Run the app:
   `bun run dev`

### PWA开发和测试命令

```bash
# 开发模式（支持PWA功能）
bun run dev

# 构建生产版本（包含PWA资源）
bun run build

# 预览生产版本（测试PWA功能）
bun run preview

# 运行PWA相关测试
bun run test -- PWAInstallManager
bun run test -- PWAUpdateNotification
bun run test -- pwaUtils

# PWA功能验证
# 访问 http://localhost:4173/pwa-test.html 进行PWA功能测试
```

**PWA开发注意事项**:
- **HTTPS要求**: PWA功能需要HTTPS环境，开发时Vite已配置支持PWA开发模式
- **Service Worker**: 开发模式下Service Worker自动注册，支持热更新
- **图标资源**: 使用SVG图标确保在所有设备上的清晰显示
- **测试页面**: 提供专门的PWA测试页面验证安装、更新等功能
- **浏览器兼容**: 在Chrome、Edge、Safari等主流浏览器中测试PWA功能

git config --global http.proxy socks5://127.0.0.1:7891

git config --global --unset http.proxy

## E2E Testing

This project uses [Playwright](https://playwright.dev/) for End-to-End (E2E) testing. Playwright allows for testing user interactions and application behavior in real browser environments.

### Setup

If you haven't already, or if you're setting up the project on a new machine, you may need to install the browser binaries required by Playwright:

```bash
bunx playwright install --with-deps
```
This command downloads the necessary browser executables (Chromium, Firefox, WebKit) and installs any required system dependencies.

### Running E2E Tests

To run the E2E tests, use the following bun script:

```bash
bun run test:e2e
```
(If using pbun, use `pbun test:e2e`)

This command will execute all test files located in the `e2e/` directory using the Playwright test runner.

### Test Reports

After the tests complete, an HTML report will be generated in the `playwright-report` directory. You can open the `index.html` file in this directory to view a detailed report of the test execution:

```bash
bunx playwright show-report
```
Alternatively, you can directly open `playwright-report/index.html` in your browser.

### Test Location

E2E test files are located in the `e2e/` directory at the root of the project. The example test file `e2e/auth.e2e.test.ts` demonstrates the basic structure of a Playwright test.
