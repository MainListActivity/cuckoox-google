# GitHub Copilot Instructions for CuckooX

This is a **React 19 + TypeScript + SurrealDB** legal case management system for bankruptcy proceedings with PWA capabilities and a sophisticated Service Worker-based data caching architecture.

Always respond in Chinese-simplified.

执行任务过程中如果没有特别要求，则将结果文档按类别存储在 `docs/` 下的子目录中。

## Architecture Overview

### Service Worker-First Data Architecture
- **Core Pattern**: All database operations go through a Service Worker (`src/workers/sw-surreal.ts`) that acts as a proxy to SurrealDB
- **Client Interface**: Components use `SurrealWorkerAPI` from `SurrealProvider` instead of direct SurrealDB client
- **Authentication**: Use `queryWithAuth<T>(client, sql, vars)` from `@/src/utils/surrealAuth` for protected queries - it prepends `return $auth;` and validates authentication automatically
- **Data Flow**: React Components → SurrealProvider → Service Worker → SurrealDB

### Key Service Worker Features
- **Intelligent Caching**: `EnhancedQueryHandler` with multi-level caching strategies
- **Offline Support**: `OfflineManager` queues operations when disconnected
- **Real-time Sync**: Live queries and incremental data synchronization
- **Connection Recovery**: Automatic reconnection with exponential backoff
- **Token Management**: Handles authentication tokens and refresh automatically

### Project Structure Patterns
```
src/
├── workers/           # Service Worker implementation
├── contexts/          # React Context providers (Auth, Theme, Surreal)
├── components/        # Domain-organized components
│   ├── case/         # Case management components
│   ├── claim/        # Claim processing components
│   ├── RichTextEditor/ # Collaborative editor
├── services/         # Business logic services with dependency injection
├── utils/            # Including surrealAuth.ts for authenticated queries
├── pages/            # File-based routing structure
├── tests/            # 单元测试目录
```

## Development Guidelines

### Database Operations
```typescript
// ✅ CORRECT: Use queryWithAuth for protected endpoints
const cases = await queryWithAuth<ExtendedCase[]>(client, 
  'SELECT * FROM case WHERE name CONTAINS $keyword', 
  { keyword: searchTerm }
);

// ✅ CORRECT: Service injection pattern
class SomeService {
  setDataService(dataService: DataServiceInterface) {
    this.dataService = dataService;
  }
}
```

### Essential Commands
- **Package Manager**: Uses `bun` (not npm/yarn)
- **Development**: `bun run dev` (includes Service Worker hot reload)
- **Testing**: `bun run test:run` (Vitest), `bun run test:e2e` (Playwright)  , 运行单个测试文件：`bun run test:run -- src/tests/unit/your-test-file.ts`
- **Type Checking**: Strict TypeScript with `@/*` path aliases mapping to project root

### Technology Stack Specifics
- **UI Framework**: Material-UI v7 with custom theming (`src/theme.ts`)
- **State Management**: React Context + TanStack Query (no Redux)
- **Rich Text**: QuillJS v2 with collaborative features in `src/components/RichTextEditor/`
- **Icons**: Use `@mdi/js` vector icons (not Material-UI icons)
- **Testing**: Vitest + Testing Library + Playwright E2E

### Critical Development Patterns
- **No TypeScript Bypasses**: Never use `@ts-nocheck` or `as any` - define proper types in `.d.ts` files
- **RecordId Usage**: Use SurrealDB's `RecordId` type instead of strings for database IDs
- **Service Worker Communication**: Services communicate with SW via `serviceWorkerComm` interface
- **PWA Integration**: App uses Service Worker for offline capabilities and caching

### Authentication & Permissions
- **Auth Flow**: OIDC (GitHub) + JWT + SurrealDB scope-based permissions
- **Permission Checking**: Use `useOperationPermission(operationId)` from `AuthContext`
- **Database Security**: All queries inherit user permissions from SurrealDB scopes automatically

### Internationalization
- **Language**: All user-facing content and code comments in **Chinese (Simplified)**
- **i18n**: Uses `react-i18next` with `src/i18n.ts` configuration

### Testing Strategy
- **Unit Tests**: Focus on business logic and service layer (`tests/unit/`)
- **E2E Tests**: Critical user journeys with Playwright (`e2e/`)
- **Service Worker Testing**: Mock SW communication in unit tests
- **Coverage**: Aim for 90%+ coverage on critical paths
- **测试要求**: 先将修复后的测试文件覆盖到原来的测试文件，请记住，非必要不能新增重复的单元测试文件，请在原来的测试文件中修改，如果必须创建新的测试文件，需要确保测试用例的完善，在测试通过后需要覆盖原来的测试文件

## Key Files to Understand
- `src/contexts/SurrealProvider.tsx` - Service Worker client setup
- `src/workers/sw-surreal.ts` - Main Service Worker with caching logic
- `src/utils/surrealAuth.ts` - Authentication-aware query utilities
- `src/contexts/AuthContext.tsx` - Authentication state management
- 系统中有一部分页面需要用户登录之后才能访问，否则会跳转到登录页面的，针对这种查询需要在查询的sql之前添加 当前认证状态的查询 例如查询案件： `return $auth;select * from case;`，返回的数据从返回数组中的索引位置1开始获取，先获取0位置的认证状态，如果没有认证则直接跳转登录页面（项目已封装该功能，在 `dataService.ts的queryWithAuth`中，使用queryWithAuth时 应在泛型中传入正确的类型，例如`queryWithAuth<ExtendedCase[]>(client, query)`）， 在service worker中判断如果命中缓存，则在远程执行`return $auth;`，后面的语句在本地执行
- `AGENTS.md` & `CLAUDE.md` - Additional AI assistant guidelines

This system prioritizes real-time collaboration, offline functionality, and comprehensive bankruptcy case lifecycle management through its unique Service Worker architecture.

# 单元测试
## 单元测试技术架构
- Vitest
- service worker

## 单元测试方案
- 对于surraldb的查询 **只允许** mock service worker，**永远不要**mock上层服务代码
- fetch可以直接mock

## 重要约定
- **永远不要**修改超时时间配置，当前配置的超时时间完全够用。
- 你需要确保修改后的代码能够通过所有单元测试。
- 在终端运行命令后务必等待命令执行结束再获取结果。

