# AGENTS.md

This file provides guidance to Jules Code (Jules) when working with code in this repository. Always use Chinese output.

## Development Commands

This is a React + TypeScript + Vite application using npm as the package manager.

### Core Commands
- `npm install` - Install dependencies
- `npm run dev` - Start development server
- `npm run build` - Build for production (runs TypeScript compilation + Vite build)
- `npm run lint` - Run ESLint with TypeScript support
- `npm run preview` - Preview production build

### Testing Commands
- `npm run test` - Run unit tests with Vitest
- `npm run test:run` - Run tests once (non-watch mode)

### Single Test Execution
- `npm run test -- tests/unit/path/to/specific.test.tsx` - Run specific unit test

## Architecture Overview

This is a legal case management system with the following key architectural components:

### Core Structure
- **Frontend**: React 19 + TypeScript + Vite
- **UI Framework**: Material-UI (MUI) for styling
- **Database**: SurrealDB for real-time data
- **Authentication**: OIDC (OpenID Connect)
- **State Management**: React Context + TanStack Query
- **Rich Text Editor**: Quill.js-based custom editor with collaboration features

### Key Directories
- `src/components/` - Reusable UI components
  - `RichTextEditor/` - Core rich text editing functionality with collaborative features
  - `admin/` - Administrative interface components
  - `case/`, `claim/`, `creditors/` - Domain-specific components
- `src/pages/` - Route-based page components following file-based routing
- `src/contexts/` - React Context providers (Auth, Theme, Layout, etc.)
- `src/services/` - API service layers
- `src/hooks/` - Custom React hooks
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
- Role-based access control
- Document collaboration and version control
- Multi-language support
- Responsive design with theming support

## Important Notes
- Uses Bun as package manager instead of npm/yarn
- Custom path alias `@/*` maps to project root
- Strict TypeScript configuration with experimental decorators
- E2E tests require Playwright browser installation
- Uses CSS custom properties for theming integration MUI
