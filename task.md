# Bankruptcy Management System UI/UX Overhaul Tasks

## Phase 1: Setup and Core Styling

- [ ] **1. Create `task.md` File** (This task!)
- [ ] **2. Integrate Material Design Component Library (MUI) and Icons (MDI):**
    - [ ] Add MUI (Material-UI) and its dependencies.
    - [ ] Add Material Design Icons (MDI) (e.g., `@mdi/js`, `@mdi/react`).
    - [ ] Configure Tailwind CSS and MUI to coexist (address style conflicts).
- [ ] **3. Define and Apply Core Material Design Theme (Teal Variant):**
    - [ ] Define MUI theme (Teal primary, `#f6f6f6` background).
    - [ ] Update `src/styles/main.css` and `tailwind.config.js` with Teal palette.
    - [ ] Ensure Roboto font is correctly applied.

## Phase 2: Layout and Global Components

- [ ] **4. Update Overall Application Layout (`src/components/Layout.tsx`):**
    - [ ] Refactor `Layout.tsx` and `App.tsx` with MUI layout components (AppBar, Drawer, etc.).
    - [ ] Implement Material Design navigation, spacing, and responsiveness.
    - [ ] Integrate MDI icons in navigation.
    - [ ] Ensure "elegant清新主义" aesthetic.

## Phase 3: Page-by-Page Refactoring

- [ ] **5. Systematically Refactor Existing Pages to Material Design:**
    - [x] **DashboardPage.tsx** (`src/pages/DashboardPage.tsx`)
        - [x] Replace elements with MUI components.
        - [x] Apply Material Design styling (hierarchy, cards, icons).
        - [x] Ensure responsiveness. (MUI Grid and Card components provide good baseline responsiveness)
    - [x] **CaseListPage.tsx** (`src/pages/CaseListPage.tsx`)
        - [x] Replace elements with MUI components.
        - [x] Apply Material Design styling.
        - [x] Ensure responsiveness.
    - [x] **CaseDetailPage.tsx** (`src/pages/CaseDetailPage.tsx`)
        - [x] Replace elements with MUI components.
        - [x] Apply Material Design styling.
        - [x] Ensure responsiveness.
    - [x] **CreateCasePage.tsx** (`src/pages/CreateCasePage.tsx`)
        - [x] Replace elements with MUI components.
        - [x] Apply Material Design styling.
        - [x] Ensure responsiveness.
    - [x] **ClaimListPage.tsx** (`src/pages/ClaimListPage.tsx`)
        - [x] Replace elements with MUI components.
        - [x] Apply Material Design styling.
        - [x] Ensure responsiveness.
    - [x] **ClaimDataDashboardPage.tsx** (`src/pages/ClaimDataDashboardPage.tsx`)
        - [x] Replace elements with MUI components.
        - [x] Apply Material Design styling (大气、美观、科技感).
        - [x] Ensure responsiveness.
    - [ ] **CreditorListPage.tsx** (`src/pages/CreditorListPage.tsx`)
        - [ ] Replace elements with MUI components.
        - [ ] Apply Material Design styling.
        - [ ] Ensure responsiveness.
    - [ ] **LoginPage.tsx** (`src/pages/LoginPage.tsx`)
        - [ ] Replace elements with MUI components.
        - [ ] Apply Material Design styling.
        - [ ] Ensure responsiveness.
    - [ ] **AdminPage.tsx** (`src/pages/AdminPage.tsx`)
        - [ ] Replace elements with MUI components.
        - [ ] Apply Material Design styling.
        - [ ] Ensure responsiveness.
    - [ ] **MessageCenterPage.tsx** (`src/pages/MessageCenterPage.tsx`)
        - [ ] Replace elements with MUI components.
        - [ ] Apply Material Design styling.
        - [ ] Ensure responsiveness.
    - [ ] **OnlineMeetingPage.tsx** (`src/pages/OnlineMeetingPage.tsx`)
        - [ ] Replace elements with MUI components.
        - [ ] Apply Material Design styling.
        - [ ] Ensure responsiveness.
    - [ ] *Add other pages as identified...*

## Phase 4: Specific UI Style Requirements & Verification

- [ ] **6. Implement Specific UI Style Requirements:**
    - [ ] Introduce soft gradients with Teal brand color.
    - [ ] Ensure subtle shadows and modular card layouts.
    - [ ] Verify polished rounded corners.
    - [ ] Confirm Material Design spacing and proportions.
    - [ ] Use Unsplash image links where new images are needed.
- [ ] **7. Mock Data and Verify Styles:**
    - [ ] Implement/use mock data for relevant pages.
    - [ ] Review all refactored pages against design requirements.

## Phase 5: Completion

- [ ] **8. Final Review and `task.md` Completion:**
    - [ ] Ensure all tasks in `task.md` are ✅.
    - [ ] Final application consistency check.
- [ ] **9. Submit Changes**
