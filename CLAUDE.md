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
  - `incrementalSyncService.ts` - Incremental data synchronization service
  - `bidirectionalSyncService.ts` - Bidirectional data synchronization service
- `src/workers/` - service worker代码
  - `sw-surreal.ts` - Service Worker main file
  - `data-cache-manager.ts` - Universal data cache manager
  - `token-manager.ts` - Token management
- `src/hooks/` - Custom React hooks
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
- Custom path alias `@/*` maps to project root, example: `@/src/types/pdfParser`
- Strict TypeScript configuration with experimental decorators
- E2E tests require Playwright browser installation
- Uses CSS custom properties for theming integration MUI
- ts的类型错误尽量不要使用 `as any`来修复，应当在`typs.d.ts` 或 `index.d.ts` 中定义类型
- 永远不要在代码里添加`@ts-nocheck`来规避ts检查
- 在涉及到surreal的方法、存储代码中尽可能使用`RecordId`而不是`string`
- 不要尝试运行 bun run dev 判断代码是否可运行，lint检查通过并且单元测试通过就可完成任务
- 使用service worker在后台保持与surrealdb的连接状态，所有页面与service worker通信获取数据
- 数据库的权限全部由surrealdb数据库控制，这意味着当我们需要查询数据时，只需要加上用户输入的条件，比如查询案件时： `select * from case`，当用户输入关键字搜索： `select * form case where 'fox' IN name`;
- 已实现完整的智能数据缓存架构，通过service worker作为数据库代理，所有查询（query方法）都经过service worker的EnhancedQueryHandler进行智能缓存路由，支持多种缓存策略
- 支持增量数据同步，基于更新时间获取变更数据
- 支持双向数据同步，本地和远程数据库同时修改时自动同步
- 权限检查现在基于本地缓存的用户个人数据，提供更快的响应速度
- 系统中有一部分页面需要用户登录之后才能访问，否则会跳转到登录页面的，针对这种查询需要在查询的sql之前添加 当前认证状态的查询 例如查询案件： `return $auth;select * from case;`，返回的数据从返回数组中的索引位置1开始获取，先获取0位置的认证状态，如果没有认证则直接跳转登录页面（项目已封装该功能，在 `dataService.ts的queryWithAuth`中，使用queryWithAuth时 应在泛型中传入正确的类型，例如`queryWithAuth<ExtendedCase[]>(client, query)`）， 在service worker中判断如果命中缓存，则在远程执行`return $auth;`，后面的语句在本地执行
- **权限系统架构**：权限判断现在完全集中在 `AuthContext` 中，通过 `menuService` 作为权限查询的代理。所有权限相关的功能都通过 AuthContext 提供的方法获取：
  - `useOperationPermission(operationId)` - 检查操作权限
  - `useOperationPermissions(operationIds)` - 批量检查操作权限  
  - `useMenuPermission(menuId)` - 检查菜单访问权限
  - `useDataPermission(tableName, crudType)` - 检查数据CRUD权限
  - 所有权限检查都支持缓存，减少重复查询
  - 管理员（github_id === '--admin--'）自动拥有所有权限
- **Grid组件使用语法**:
```typescript
import { Grid } from '@mui/material';

<Grid container spacing={2}>
  <Grid size={8}>
    <Item>size=8</Item>
  </Grid>
  <Grid size={4}>
    <Item>size=4</Item>
  </Grid>
</Grid>
```

- **surrealdb全文检索**: SELECT text, title, search::highlight("->", "<-", 0) AS title, search::score(0) AS text_score, search::score(1) AS title_score FROM article WHERE text  @0@ "night" OR title @1@ "hound";

## 核心架构原则

### Service Worker中心化连接管理
- **所有SurrealDB连接管理都在Service Worker中处理**
- 前端(React应用)不应该感知或管理连接状态
- Service Worker负责：连接、重连、状态管理、错误处理、数据库对象重建

### 前端透明化原则
- 前端只与Service Worker通信获取数据
- 不感知isConnecting、isConnected、error等连接状态
- 用户离线时继续使用缓存内容，不阻塞UI
- 连接问题由Service Worker透明处理

### 离线优先设计
- 用户离线后依然可以正常使用系统
- 查看本地缓存的案件、债权人、申报信息
- 编辑数据，连接恢复后自动同步
- 不显示连接错误页面，不阻塞用户操作

## 重要提醒

### 开发原则
- **永远不要**在前端添加连接状态管理
- **永远不要**阻塞用户因为连接问题
- **永远使用**Service Worker处理连接逻辑
- **永远确保**离线时用户能访问缓存内容

### 代码影响最小化
- 尊重现有SW架构，在其基础上增强
- 前端修改最小化，主要是移除不必要逻辑
- 保持向后兼容，不破坏现有功能
- 渐进式改进，不做大规模重构

### 调试指南
- 连接问题看SW控制台，不看前端
- db.status状态不一致时自动重建会触发
- 重连失败3次后触发数据库重建
- 前端reconnect()调用SW的force_reconnect

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