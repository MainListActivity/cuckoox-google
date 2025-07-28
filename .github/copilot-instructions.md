# GitHub Copilot Instructions for CuckooX

This is a **React 19 + TypeScript + SurrealDB** legal case management system for bankruptcy proceedings with PWA capabilities and a sophisticated Service Worker-based data caching architecture.

Always respond in Chinese-simplified.
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
- **Testing**: `bun run test` (Vitest), `bun run test:e2e` (Playwright)  
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

## Key Files to Understand
- `src/contexts/SurrealProvider.tsx` - Service Worker client setup
- `src/workers/sw-surreal.ts` - Main Service Worker with caching logic
- `src/utils/surrealAuth.ts` - Authentication-aware query utilities
- `src/contexts/AuthContext.tsx` - Authentication state management
- 系统中有一部分页面需要用户登录之后才能访问，否则会跳转到登录页面的，针对这种查询需要在查询的sql之前添加 当前认证状态的查询 例如查询案件： `return $auth;select * from case;`，返回的数据从返回数组中的索引位置1开始获取，先获取0位置的认证状态，如果没有认证则直接跳转登录页面（项目已封装该功能，在 `dataService.ts的queryWithAuth`中，使用queryWithAuth时 应在泛型中传入正确的类型，例如`queryWithAuth<ExtendedCase[]>(client, query)`）， 在service worker中判断如果命中缓存，则在远程执行`return $auth;`，后面的语句在本地执行
- `AGENTS.md` & `CLAUDE.md` - Additional AI assistant guidelines

This system prioritizes real-time collaboration, offline functionality, and comprehensive bankruptcy case lifecycle management through its unique Service Worker architecture.
