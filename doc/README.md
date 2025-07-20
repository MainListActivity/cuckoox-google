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