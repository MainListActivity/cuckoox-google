# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository. 

Always respond in Chinese-simplified.

## Development Commands

This is a React + TypeScript + Vite application using Bun as the package manager.

### Core Commands
- `bun install` - Install dependencies
- `bun run dev` - Start development server
- `bun run build` - Build for production (runs TypeScript compilation + Vite build)
- `bun run lint` - Run ESLint with TypeScript support
- `bun run preview` - Preview production build
- `bun run build:sw` - Build for service worker

### Testing Commands
- `bun run test` - Run unit tests with Vitest
- `bun run test:ui` - Run tests with Vitest UI
- `bun run test:run` - Run tests once (non-watch mode)
- `bun run test:e2e` - Run Playwright E2E tests
- `bunx playwright install --with-deps` - Install Playwright browsers (first-time setup)
- `bunx playwright show-report` - View test reports

### Single Test Execution
- `bun run test -- tests/unit/path/to/specific.test.tsx` - Run specific unit test
- `bunx playwright test e2e/specific.e2e.test.ts` - Run specific E2E test

## Architecture Overview

This is a legal case management system with the following key architectural components:

### Core Structure
- **Frontend**: React 19 + TypeScript + Vite
- **UI Framework**: Material-UI (MUI) for styling
- **Database**: SurrealDB for real-time data
- **Authentication**: OIDC (OpenID Connect)
- **State Management**: React Context + TanStack Query
- **Rich Text Editor**: Quill.js-based custom editor with collaboration features
- **Data Caching**: Service Worker-based universal data table caching system

### Key Directories
- `src/components/` - Reusable UI components
  - `RichTextEditor/` - Core rich text editing functionality with collaborative features
  - `admin/` - Administrative interface components
  - `case/`, `claim/`, `creditors/` - Domain-specific components
- `src/pages/` - Route-based page components following file-based routing
- `src/contexts/` - React Context providers (Auth, Theme, Layout, etc.)
- `src/services/` - API service layers
  - `userPersonalDataService.ts` - User personal data management service
  - `pageDataCacheService.ts` - Page data caching service
  - `incrementalSyncService.ts` - Incremental data synchronization service
  - `bidirectionalSyncService.ts` - Bidirectional data synchronization service
- `src/workers/` - service worker代码
  - `sw-surreal.ts` - Service Worker main file
  - `data-cache-manager.ts` - Universal data cache manager
  - `token-manager.ts` - Token management
- `src/hooks/` - Custom React hooks
  - `useUserPersonalData.ts` - User personal data hooks
  - `usePageDataCache.ts` - Page data caching hooks
  - `usePageCacheManager.ts` - Page cache manager hooks
  - `usePermission.ts` - Permission checking hooks (based on new cache architecture)
- `tests/unit/` - Unit tests (Vitest + Testing Library)
- `e2e/` - End-to-end tests (Playwright)

### Technology Stack Details
- **Build Tool**: Vite with React plugin
- **Testing**: Vitest (unit) + Playwright (E2E) + Testing Library
- **Styling**: Material-UI with CSS custom properties
- **Routing**: React Router v6
- **Internationalization**: i18next + react-i18next
- **Type Safety**: Strict TypeScript configuration with path aliases (`@/*`)

### Key Features
- Real-time collaborative rich text editor
- Case and claim management workflow
- Role-based access control (implemented through data caching system)
- Document collaboration and version control
- Multi-language support
- Responsive design with theming support
- Intelligent data caching and synchronization system

## Important Notes
- Uses Bun as package manager instead of npm/yarn
- Custom path alias `@/*` maps to project root
- Strict TypeScript configuration with experimental decorators
- E2E tests require Playwright browser installation
- Uses CSS custom properties for theming integration MUI
- ts的类型错误尽量不要使用 `as any`来修复，应当在`typs.d.ts` 或 `index.d.ts` 中定义类型
- 在涉及到surreal的方法、存储代码中尽可能使用`RecordId`而不是`string`
- 不要尝试运行 bun run dev 判断代码是否可运行，lint检查通过并且单元测试通过就可完成任务
- 使用service worker在后台保持与surrealdb的连接状态，所有页面与service worker通信获取数据
- 数据库的权限全部由surrealdb数据库控制，这意味着当我们需要查询数据时，只需要加上用户输入的条件，比如查询案件时： `select * from case`，当用户输入关键字搜索： `select * form case where 'fox' IN name`;
- 已实现完整的数据缓存架构，包含两种缓存策略：
  - 持久化缓存：用户个人信息（权限、菜单、操作按钮等），登录时缓存，退出时清除
  - 临时缓存：页面数据，进入页面时订阅，离开页面时取消订阅
- 支持增量数据同步，基于更新时间获取变更数据
- 支持双向数据同步，本地和远程数据库同时修改时自动同步
- 权限检查现在基于本地缓存的用户个人数据，提供更快的响应速度


# CuckooX Rust 项目结构指南

## 项目概述
CuckooX-Rust 是一个采用干净架构（Clean Architecture）的 Rust 异步 Web 应用程序，使用 Actix-Web 框架和 SurrealDB 数据库。

`cuckoox-rust` 主要是IDP的指责，对surrealdb和minio服务提供auth provider。

*cuckoox-google*  是`cuckoox-rust`项目的前端工程。
## 核心架构层次

### Domain 层 (`src/domain/`)
- **实体 (Entities)**: [health_status.rs](mdc:cuckoox-rust/src/domain/entities/health_status.rs) - 核心业务实体
- **值对象 (Value Objects)**: `src/domain/value_objects/` - 不可变的值类型
- **仓储接口 (Repositories)**: `src/domain/repositories/` - 数据访问接口定义

### Application 层 (`src/application/`)
- **用例 (Use Cases)**: [health_check.rs](mdc:cuckoox-rust/src/application/use_cases/health_check.rs) - 业务逻辑实现
- **服务 (Services)**: `src/application/services/` - 应用服务层

### Infrastructure 层 (`src/infrastructure/`)
- **数据库**: `src/infrastructure/database/` - SurrealDB 连接和实现
- **Web 服务器**: [server.rs](mdc:cuckoox-rust/src/infrastructure/web/server.rs) - Actix-Web 服务器配置

### Presentation 层 (`src/presentation/`)
- **控制器**: [health_controller.rs](mdc:cuckoox-rust/src/presentation/controllers/health_controller.rs) - HTTP 端点处理

## 主要文件

- **入口点**: [main.rs](mdc:cuckoox-rust/src/main.rs) - 应用程序启动和配置
- **库模块**: [lib.rs](mdc:cuckoox-rust/src/lib.rs) - 模块导出定义
- **项目配置**: [Cargo.toml](mdc:cuckoox-rust/Cargo.toml) - 依赖和项目元数据

## 架构原则

1. **依赖倒置**: 外层依赖内层，内层不依赖外层
2. **关注点分离**: 每层负责特定职责
3. **可选依赖**: 数据库连接是可选的，支持无数据库启动
4. **异步优先**: 全面使用 Tokio 异步运行时

## 配置

所有配置必须同时支持toml配置文件和环境变量
- `SURREALDB_URL`: 数据库连接地址（可选）
- `SERVER_HOST`: 服务器主机地址（默认: 127.0.0.1）
- `SERVER_PORT`: 服务器端口（默认: 8080）

toml配置文件按照分类，例如数据层： [db]: surrealdb.url

# CuckooX-Rust 开发指南

## 代码风格

### 错误处理
- 使用 `anyhow::Result<T>` 作为函数返回类型
- 在 [main.rs](mdc:src/main.rs) 中优雅处理错误和日志记录
- 数据库连接失败时给出友好提示而不是崩溃

### 异步编程
- 所有 I/O 操作必须是异步的
- 使用 `tokio::main` 作为程序入口点
- 在控制器中使用 `async fn` 处理请求

### 日志记录
- 使用 `log` crate 进行日志记录
- 在 [main.rs](mdc:src/main.rs) 中初始化 `env_logger`
- 支持中文日志信息，提供友好的用户体验

## 依赖注入模式

### AppState 模式
如 [server.rs](mdc:src/infrastructure/web/server.rs) 所示：
```rust
pub struct AppState {
    pub database_service: Option<Arc<DatabaseService>>,
}
```

### 用例模式
如 [health_controller.rs](mdc:src/presentation/controllers/health_controller.rs) 所示：
```rust
let use_case = HealthCheckUseCase::new(database_service);
let result = use_case.execute().await;
```

## 数据库集成

### 可选连接
- 数据库连接是可选的，通过环境变量 `SURREALDB_URL` 配置
- 应用程序可以在没有数据库的情况下运行
- 使用 `Option<Arc<DatabaseService>>` 模式处理可选依赖

### 连接管理
- 在启动时建立数据库连接
- 连接失败时记录警告但继续启动
- 在 AppState 中共享数据库服务实例

## API 设计

### 端点命名
- 使用 camelCase，如 `/healthCheck`
- 保持 RESTful 风格

### 响应格式
- 健康状态使用标准化的 JSON 响应
- 包含时间戳、版本和状态信息
- 如 [health_status.rs](mdc:src/domain/entities/health_status.rs) 所示

## 测试策略

### 单元测试
- 每个用例都应有相应的单元测试
- 使用 mock 对象测试业务逻辑
- 测试异常情况和边界条件

### 集成测试
- 测试完整的 HTTP 请求-响应流程
- 验证数据库集成功能
- 测试配置和环境变量处理

# surrreal查询语法

#### IF-ELSE 语句必须用 `END` 结尾
```sql

-- ✅ 正确写法
LET $case_roles = IF $case_id THEN 
    (SELECT out.name FROM $user_id->has_case_role WHERE case_id = $case_id)
ELSE [];
END;  -- 必须有 END
```

#### 子查询中的排序需要特殊语法
```sql

-- ✅ 正确写法
FROM $case_id->(select * from has_member ORDER BY assigned_at DESC)
```

#### RELATE 语句中应该只选择 ID 字段
```sql

-- ✅ 正确写法
FOR $menu IN (SELECT id FROM menu_metadata) {
    RELATE role:admin->can_access_menu->$menu SET ...
};
```