# 项目文档索引

## 概述

本目录包含CuckooX-Google破产案件管理平台的所有技术文档、设计文档和使用指南。

## 📚 文档分类

### 🚀 增强缓存系统 (核心功能)

#### 架构和设计
- **[enhanced-cache-architecture.md](./enhanced-cache-architecture.md)** - 增强缓存系统架构文档
  - 系统概述和当前开发状态
  - 核心组件详解和数据流设计
  - 性能优化策略和错误处理机制

#### API和集成
- **[cache-system-api.md](./cache-system-api.md)** - 缓存系统API文档
  - 完整的API接口说明
  - 使用示例和最佳实践
  - 性能监控和调试工具

- **[enhanced-cache-integration-guide.md](./enhanced-cache-integration-guide.md)** - 缓存系统集成指南
  - 集成步骤和配置说明
  - 兼容性和迁移指南

#### 开发记录
- **[cache-system-development-status.md](./cache-system-development-status.md)** - 缓存系统开发状态报告
  - 当前开发进度和完成情况
  - 近期开发重点和计划
  - 性能改进效果和技术债务

- **[cache-system-changelog.md](./cache-system-changelog.md)** - 缓存系统开发日志
  - 版本历史和开发里程碑
  - 性能基准和未来规划
  - 最新开发状态和文档更新记录

- **[INTELLIGENT_CACHE_SYSTEM_SUMMARY.md](./INTELLIGENT_CACHE_SYSTEM_SUMMARY.md)** - 智能缓存系统总结
  - 系统特性和技术优势
  - 实施效果和性能提升

- **[DOCUMENTATION_UPDATE_SUMMARY.md](./DOCUMENTATION_UPDATE_SUMMARY.md)** - 文档更新总结
  - 文档同步更新记录
  - 开发状态信息维护

### 🏗️ 系统架构

#### 集成指南
- **[integration-guide.md](./integration-guide.md)** - 系统集成指南
  - 第三方服务集成
  - 数据库连接和配置

#### 数据库功能
- **[surrealdb-fulltext-search-guide.md](./surrealdb-fulltext-search-guide.md)** - SurrealDB全文检索使用指南
  - 全文检索语法和函数详解
  - 实际应用示例和TypeScript集成
  - 智能缓存系统集成和性能优化

### 🌐 PWA 和用户体验

#### PWA 功能文档
- **[pwa-loading-experience.md](./pwa-loading-experience.md)** - PWA 统一加载体验设计
  - 从应用启动到页面加载的一致性视觉体验
  - 响应式设计和深色模式支持
  - 品牌色彩体系和动画规范
  - 性能优化和可访问性设计

#### 移动端UI优化
- **[移动端UI优化需求](../.kiro/specs/mobile-ui-optimization/requirements.md)** - 移动端优化需求分析
  - 基于实际页面分析的10个核心需求领域
  - 详细的用户故事和验收标准
  - 涵盖列表展示、触摸交互、搜索筛选等关键功能
  - 性能、可访问性和用户体验要求

- **[移动端优化设计](../.kiro/specs/mobile-ui-optimization/design.md)** - 移动端UI优化架构设计
  - 完整的组件架构和数据模型设计
  - 手势交互系统和动画设计
  - 样式设计系统和性能优化策略
  - 错误处理和测试策略

- **[移动端实施计划](../.kiro/specs/mobile-ui-optimization/tasks.md)** - 移动端优化实施计划
  - 15个详细任务的分解和优先级
  - 4个阶段的实施路线图
  - 成功指标和质量保证标准
  - 用户体验、技术和业务指标

#### 响应式布局优化
- **[responsive-optimization-guide.md](./responsive-optimization-guide.md)** - PWA响应式布局优化指南
  - 移动优先设计原则和断点设计
  - 核心响应式组件使用指南
  - 性能优化和PWA特定优化
  - 测试策略和最佳实践

- **[responsive-components-api.md](./responsive-components-api.md)** - 响应式组件API文档
  - ResponsiveTable、ResponsiveStatsCards等核心组件API
  - useResponsiveLayout等响应式Hook详解
  - CSS变量系统和工具类使用
  - 故障排除和调试指南

### 🎨 产品设计

#### 产品说明
- **[产品说明文档-jules.md](./产品说明文档-jules.md)** - 产品功能说明
- **[文档中心模式产品说明.md](./文档中心模式产品说明.md)** - 文档中心模式说明

#### UI设计
- **[UI设计.md](./UI设计.md)** - 用户界面设计规范
- **[文档中心模式UI设计.md](./文档中心模式UI设计.md)** - 文档中心UI设计

#### 设计资源
- **[design/](./design/)** - 设计相关文档
  - Logo设计和使用指南
  - 品牌设计规范

### 🔧 功能模块

#### 债权操作追踪系统
- **[债权操作追踪需求](../.kiro/specs/claim-operation-tracking/requirements.md)** - 债权申报操作记录追踪系统需求
  - 8个核心需求领域的详细分析
  - 操作历史记录、状态流转管理、版本控制
  - 权限审计、统计分析、通知机制
  - 数据导出和性能优化要求

- **[债权操作追踪设计](../.kiro/specs/claim-operation-tracking/design.md)** - 操作记录追踪系统技术设计
  - 完整的数据模型和表结构设计
  - 核心服务组件和前端组件架构
  - 缓存策略、通知机制、性能优化
  - 安全考虑和测试策略

- **[债权操作追踪任务](../.kiro/specs/claim-operation-tracking/tasks.md)** - 系统实施任务分解
  - 10个主要任务模块的详细分解
  - 数据库表结构、服务层、前端组件实现
  - 缓存同步、通知系统、统计分析功能
  - 权限控制、测试和文档准备

- **[债权操作追踪架构](./claim-operation-tracking-architecture.md)** - 系统架构和技术实现指南
  - 完整的技术架构设计和数据模型
  - 服务层和前端组件的详细设计
  - 缓存策略集成和性能优化方案
  - 安全性设计和测试策略

- **[债权操作追踪开发状态](./claim-operation-tracking-development-status.md)** - 开发进度和状态跟踪
  - 详细的开发进度和里程碑规划
  - 性能目标和测试策略
  - 风险评估和成功指标
  - 项目时间线和资源分配

#### 组件文档
- **[components/](./components/)** - 组件文档目录
  - **[GlobalLoader.md](./components/GlobalLoader.md)** - 全局加载组件文档
    - 统一加载体验设计
    - 响应式和深色模式支持
    - API接口和使用示例

#### 多租户系统
- **多租户数据库隔离**: 已集成到增强缓存系统中
  - 基于SurrealDB database级别的完全隔离
  - 系统自动获取用户租户信息并设置数据库连接
  - 无需手动切换，确保数据安全和隐私

#### 富文本编辑器
- **[富文本编辑器使用示例.md](./富文本编辑器使用示例.md)** - 富文本编辑器使用指南
- **[document/](./document/)** - 文档编辑器相关
  - 编辑器架构设计
  - 产品文档编辑器

#### 权限系统
- **[权限系统设计文档.md](./权限系统设计文档.md)** - 权限系统设计
  - 角色权限模型
  - 访问控制机制

### 🌐 国际化

#### 多语言支持
- **[ai_assistant_localization.md](./ai_assistant_localization.md)** - AI助手本地化
  - 多语言配置
  - 本地化最佳实践

### 📋 开发规范

#### 代码规范
- **[规范.md](./规范.md)** - 开发规范和标准
  - 代码风格指南
  - 最佳实践

## 🚧 当前开发状态

### 增强缓存系统 - 核心架构重构进行中

**最新更新**: 2025年1月20日

#### ✅ 已完成 (约70%核心功能)
- 智能缓存系统集成到Service Worker
- 查询处理优化和智能路由
- 缓存管理接口和性能监控
- 统一导入路径和代码质量改进
- 多租户数据隔离（基于database级别）
- 性能监控和调试工具（PerformanceMonitor、CacheDebugger、CacheLogger）

#### 🚧 正在开发 (当前重点)
- 缓存执行器和策略实现（70%完成，进行中）
- 页面感知订阅系统（30%完成，设计阶段）
- 离线数据访问支持（20%完成，规划阶段）
- 缓存容量管理（0%完成，计划2月开始）

#### 📋 计划中
- 完善测试覆盖（40%完成）
- 性能基准测试
- 用户体验测试
- 文档完善

## 📖 快速导航

### 新手入门
1. 阅读 [项目README](../README.md) 了解项目概述
2. 查看 [enhanced-cache-architecture.md](./enhanced-cache-architecture.md) 了解核心架构
3. 参考 [cache-system-api.md](./cache-system-api.md) 学习API使用
4. 查看 [surrealdb-fulltext-search-guide.md](./surrealdb-fulltext-search-guide.md) 学习全文检索功能
5. 了解 [claim-operation-tracking-architecture.md](./claim-operation-tracking-architecture.md) 债权操作追踪系统

### 开发者指南
1. 查看 [规范.md](./规范.md) 了解开发规范
2. 阅读 [integration-guide.md](./integration-guide.md) 了解集成方法
3. 参考 [cache-system-changelog.md](./cache-system-changelog.md) 了解最新进展

### 产品经理
1. 阅读 [产品说明文档-jules.md](./产品说明文档-jules.md) 了解产品功能
2. 查看 [UI设计.md](./UI设计.md) 了解界面设计
3. 参考 [权限系统设计文档.md](./权限系统设计文档.md) 了解权限模型

### 运维人员
1. 查看 [integration-guide.md](./integration-guide.md) 了解部署配置
2. 阅读 [cache-system-api.md](./cache-system-api.md) 了解监控接口
3. 参考 [enhanced-cache-architecture.md](./enhanced-cache-architecture.md) 了解系统架构

## 🔄 文档更新

### 更新频率
- **架构文档**: 随系统重大变更更新
- **API文档**: 随接口变更实时更新
- **开发日志**: 每个开发里程碑更新
- **使用指南**: 根据用户反馈定期更新

### 贡献指南
1. 文档使用Markdown格式编写
2. 保持文档结构清晰，使用适当的标题层级
3. 包含代码示例和使用场景
4. 及时更新文档索引

### 文档维护
- 定期检查文档的准确性和时效性
- 根据系统变更及时更新相关文档
- 收集用户反馈，持续改进文档质量

## 📞 联系方式

如有文档相关问题或建议，请通过以下方式联系：

- **GitHub Issues**: 提交文档问题或改进建议
- **开发团队**: 技术问题讨论
- **产品团队**: 产品功能相关问题

---

*本文档索引持续更新，确保开发者能够快速找到所需的技术文档。*