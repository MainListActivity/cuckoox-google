# Project Structure

执行任务过程中如果没有特别要求，则将结果文档按类别存储在 `docs/` 下的子目录中。

## Root Directory Organization

```
cuckoox-google/
├── src/                    # Source code
├── tests/                  # Test files
├── doc/                    # Project documentation
├── public/                 # Static assets
├── e2e/                    # End-to-end tests
├── .cursor/                # Cursor IDE configuration
├── .kiro/                  # Kiro steering rules
└── config files...         # Build and tool configurations
```

## Source Code Structure (`src/`)

### Core Application
- **`App.tsx`**: Main application component
- **`index.tsx`**: Application entry point
- **`theme.ts`**: MUI theme configuration
- **`i18n.ts`**: Internationalization setup

### Components (`src/components/`)
```
components/
├── common/                 # Reusable UI components
├── admin/                  # Admin-specific components
├── case/                   # Case management components
├── claim/                  # Claim-related components
├── creditors/              # Creditor management components
├── dashboard/              # Dashboard components
├── messages/               # Messaging components
├── RichTextEditor/         # Rich text editor components
├── Logo/                   # Logo components
├── Layout.tsx              # Main layout component
├── ProtectedRoute.tsx      # Route protection
└── ...
```

### Pages (`src/pages/`)
```
pages/
├── admin/                  # Admin pages
├── cases/                  # Case management pages
├── claims/                 # Claim pages
├── creditors/              # Creditor pages
├── dashboard/              # Dashboard pages
├── my-claims/              # User's claims pages
├── root-admin/             # Root admin pages
├── documents/              # Document pages
├── index.tsx               # Home page
├── login.tsx               # Login page
└── ...
```

### Business Logic Layer
```
src/
├── contexts/               # React Context providers
│   ├── AuthContext.tsx     # Authentication state
│   ├── ThemeContext.tsx    # Theme management
│   ├── SurrealProvider.tsx # Database connection
│   └── ...
├── hooks/                  # Custom React hooks
│   ├── usePermission.ts    # Permission checking
│   ├── usePageDataCache.ts # Data caching
│   └── ...
├── services/               # Business services
│   ├── authService.ts      # Authentication logic
│   ├── dataService.ts      # Data operations
│   ├── messageService.ts   # Messaging
│   └── ...
```

### Data & Infrastructure
```
src/
├── lib/                    # Core libraries
│   ├── surrealClient.ts    # SurrealDB client
│   ├── surreal_schemas.surql # Database schemas
│   └── ...
├── workers/                # Service Workers
│   ├── sw-surreal.ts       # SurrealDB Service Worker
│   ├── data-cache-manager.ts # Cache management
│   └── ...
├── types/                  # TypeScript type definitions
│   ├── db.ts              # Database types
│   ├── surreal.d.ts       # SurrealDB types
│   └── ...
├── utils/                  # Utility functions
│   ├── apiClient.ts       # API client utilities
│   ├── formatters.ts      # Data formatters
│   └── ...
```

## Test Structure (`tests/`)

```
tests/
├── unit/                   # Unit tests
│   ├── components/         # Component tests
│   ├── contexts/           # Context tests
│   ├── hooks/              # Hook tests
│   ├── pages/              # Page tests
│   ├── services/           # Service tests
│   └── utils/              # Utility tests
├── integration/            # Integration tests
├── setup.ts               # Test setup configuration
└── jest-dom.d.ts          # Jest DOM types
```

## Configuration Files

### Build & Development
- **`vite.config.ts`**: Main Vite configuration
- **`vite.sw.config.ts`**: Service Worker build config
- **`tsconfig.json`**: TypeScript configuration
- **`tailwind.config.js`**: Tailwind CSS configuration
- **`playwright.config.ts`**: E2E test configuration

### Code Quality
- **`.eslintrc.json`**: ESLint configuration
- **Package management**: `package.json`, `bun.lock`, `bun.lockb`

### Environment
- **`.env.example`**: Environment variable template
- **`.env`**: Base environment variables
- **`.env.dev`**: Development environment variables
- **`.env.local`**: Local overrides (gitignored)

## Naming Conventions

### Files & Directories
- **Components**: PascalCase (e.g., `UserProfile.tsx`)
- **Pages**: kebab-case for routes (e.g., `my-claims/`)
- **Hooks**: camelCase starting with 'use' (e.g., `usePermission.ts`)
- **Services**: camelCase ending with 'Service' (e.g., `authService.ts`)
- **Types**: camelCase (e.g., `caseMember.ts`)
- **Utils**: camelCase (e.g., `formatters.ts`)

### Code Structure
- **Interfaces**: PascalCase (e.g., `UserProfile`)
- **Enums**: PascalCase (e.g., `UserRole`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `AUTO_SYNC_TABLES`)
- **Functions**: camelCase (e.g., `getUserData`)

## Import Patterns

### Path Aliases
- Use `@/` for root-relative imports
- Prefer relative imports for nearby files
- Use absolute imports for cross-domain imports

### Import Order
1. External libraries (React, MUI, etc.)
2. Internal utilities and types
3. Components and hooks
4. Relative imports

## Key Architectural Decisions

- **Service Worker Architecture**: Background data sync and caching
- **Context-based State**: Avoid prop drilling with React Context
- **Hook-based Logic**: Encapsulate business logic in custom hooks
- **Type-safe Database**: Strict TypeScript types for SurrealDB operations
- **Component Composition**: Prefer composition over inheritance