# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository. 

Always respond in Chinese-simplified.



用户确认完成任务后务必确认单元测试用例全部通过，执行命令 `bun run test:e2e e2e/auth.e2e.test.ts`，并且确保 `bun run lint` 没有任何错误

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
- `bun run test:ui` - Run tests with Vitest UI
- `bun run test:run` - Run tests once (non-watch mode)
- `bun run test:integration` - Run integration tests once (non-watch mode)
- `bun run test:e2e` - Run Playwright E2E tests (快速返回，保留报告)
- `bun run test:e2e:report` - Run E2E tests and show report (运行测试并自动显示报告)
- `bun run show-report` - View existing test reports
- `bunx playwright install --with-deps` - Install Playwright browsers (first-time setup)

### Single Test Execution
- `bun run test:run -- tests/unit/path/to/specific.test.tsx` - Run specific unit test
- `bun run test:e2e e2e/specific.e2e.test.ts` - Run specific E2E test (快速返回)
- `bun run test:e2e:report e2e/specific.e2e.test.ts` - Run specific E2E test with report

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
- `tests/integration/` - 集成测试目录
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

## 集成测试架构&要求
- 使用页面测试，切换底层数据库为内嵌数据库引擎(@surrealdb/node)，完成对项目全链路的覆盖集成测试。
- 集成测试的数据不用清理，先运行的测试用例的产生数据在后面的测试用例中可以查询。
- **用例执行顺序**: admin账号创建->案件创建（渲染页面src/pages/cases/index.tsx输入表单点按钮保存数据）->管理人登录（通过mock的数据库对象SIGNIN方法登录）->案件查询（src/pages/cases/index.tsx）->添加案件成员（src/pages/case-members/index.tsx）->其他测试用例->案件成员登录（通过mock的数据库对象SIGNIN方法登录）->案件成员退出登录（点击右上角退出登录）。
- 测试过程只需切换底层数据库 -> 加载生产数据库schema -> 执行测试用例文件 -> 调用页面功能完成数据创建（案件、成员、权限） -> 开始单个用例测试
- 集成测试在测试业务逻辑时不允许直接执行任何sql语句,且应该通过操作页面来完成，**禁止任何sql**，禁止直接操作数据库
- 集成测试不允许mock除了fetch外的任何组件，包括hooks，provider，所有组件都是需要测试的内容，而数据库查询我们已经通过内嵌数据库实现了。

## Important Notes
- Uses Bun as package manager instead of npm/yarn
- Custom path alias `@/*` maps to project root, example: `@/src/types/pdfParser`，在代码中尽量使用@别名，而不是../../../
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
- **项目重构**重构时不要保留任何冗余代码，确保新的代码逻辑是精简且有效的

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

# 单元测试防污染规则

## 测试隔离规则
- **全局对象重置**：每个测试的 `afterEach` 中必须重置所有修改的全局对象（`window.matchMedia`、`HTMLVideoElement`、`document.requestFullscreen` 等）回原始值
- **完全清理机制**：必须执行 `vi.clearAllMocks()`、`vi.clearAllTimers()`、`vi.useRealTimers()`、`vi.resetModules()` 和 `document.body.innerHTML = ''`
- **异步操作处理**：对于有异步状态更新的操作，必须使用 `act()` 包装并适当增加 `waitFor` 超时时间，分离验证步骤避免竞态条件
- **Provider状态隔离**：在 testUtils 中为 `BrowserRouter` 使用唯一 key，确保每个测试有独立的 Provider 状态，避免组件重复渲染问题

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