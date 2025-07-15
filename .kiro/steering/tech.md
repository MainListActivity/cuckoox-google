# Technology Stack

## Build System & Package Management

- **Build Tool**: Vite 6.x with ESNext target
- **Package Manager**: Bun (preferred over npm/yarn)
- **TypeScript**: Strict mode enabled with experimental decorators

## Core Technologies

### Frontend Stack
- **Framework**: React 19 + TypeScript
- **UI Library**: Material-UI v7 (MUI)
- **Styling**: MUI + Tailwind CSS + CSS Variables
- **State Management**: React Context + TanStack Query
- **Routing**: React Router v6
- **Icons**: @mdi/js (Material Design Icons)
- **Rich Text**: Quill.js v2
- **Internationalization**: i18next + react-i18next

### Backend Integration
- **Database**: SurrealDB (real-time database)
- **File Storage**: MinIO (S3-compatible)
- **Authentication**: OIDC (OpenID Connect)
- **Real-time Communication**: WebSocket + Service Worker

### Testing
- **Unit Tests**: Vitest + Testing Library
- **E2E Tests**: Playwright
- **Test Environment**: jsdom

## Common Commands

### Development
```bash
# Install dependencies
bun install

# Start development server
bun run dev

# Build for production
bun run build

# Build Service Worker
bun run build:sw

# Preview production build
bun run preview
```

### Testing
```bash
# Run unit tests
bun run test

# Run tests with UI
bun run test:ui

# Run tests once
bun run test:run

# Run E2E tests
bun run test:e2e

# Install Playwright browsers
bunx playwright install --with-deps
```

### Code Quality
```bash
# Lint code
bun run lint

# Type check
bunx tsc --noEmit

# ESLint specific files
bunx eslint src/**/*.tsx
```

## Key Configuration

### Vite Configuration
- **Target**: ESNext with top-level await support
- **Optimizations**: Exclude @surrealdb/wasm from pre-bundling
- **Environment Variables**: Custom loading order (.env → .env.dev → .env.local)

### TypeScript Configuration
- **Strict Mode**: Enabled with unused locals/parameters checking
- **Module Resolution**: Bundler mode
- **Path Mapping**: `@/*` maps to project root

### Environment Variables
```bash
# Database access mode
VITE_DB_ACCESS_MODE=service-worker  # or 'direct'

# SurrealDB configuration
VITE_SURREALDB_WS_URL=ws://localhost:8000/rpc
VITE_SURREALDB_NS=ck_go
VITE_SURREALDB_DB=test

# OIDC configuration
VITE_OIDC_AUTHORITY=https://auth.example.com
VITE_OIDC_CLIENT_ID=your-client-id
```

## Architecture Patterns

- **Clean Architecture**: Layered architecture with dependency inversion
- **Service Worker Pattern**: Background data sync and caching
- **Context + Hook Pattern**: State management and business logic encapsulation
- **Component-Based Architecture**: Reusable component design

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
- 系统中有一部分页面需要用户登录之后才能访问，否则会跳转到登录页面的，针对这种查询需要在查询的sql之前添加 当前认证状态的查询 例如查询案件： `return $auth;select * from case;`，返回的数据从返回数组中的索引位置1开始获取，先获取0位置的认证状态，如果没有认证则直接跳转登录页面
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
