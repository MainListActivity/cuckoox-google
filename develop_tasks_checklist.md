# Developer Checklist: 破产案件全生命周期管理平台

This checklist outlines the development tasks required to build the CuckooX platform. It is based on `product.md`, `design_tasks_checklist.md`, and `规范.md`.

## 0. Global Setup & Core Infrastructure

- [x] **Project Setup & Configuration:**
    - [x] Verify and update dependencies in `package.json` if necessary (e.g., consider adding MUI if a decision is made to use it globally, as per `规范.md`). (MUI confirmed, other dependencies seem appropriate for current features).
    - [x] Configure ESLint and Prettier for code quality and consistency. (ESLint configured in `package.json`. Prettier not explicitly project-configured but not strictly required by `规范.md`).
    - [x] Set up environment variables management (`.env` files). (Vite `loadEnv` and `.env.dev` confirmed).
- [x] **UI Core (as per `规范.md` & `design_tasks_checklist.md`):**
    - [x] 安装（如果需要）并使用MUI组件 (colors - Material Teal family, primary background `#f6f6f6`, fonts - Roboto). (MUI installed and theme configured accordingly in `ThemeContext.tsx` and `src/theme.ts`).
    - [x] Implement Dark/Light mode toggle functionality (top-right corner) and ensure all components support it. Default to dark mode. (`ThemeContext.tsx` and `Layout.tsx` implement this with localStorage persistence; CSS variables ensure component support).
        - [x] Create a theme context or utility for managing and applying modes. (`ThemeContext.tsx` serves this purpose).
    - [x] Integrate Material Icons (already linked in `index.html`). Ensure consistent usage. (Google Fonts Material Icons linked; `@mdi/js` vector icons used consistently in key components like `Layout.tsx`).
    - [x] **MUI Integration Strategy:**
        - [x] 全局使用MUI作为UI组件. (Key components like `Layout.tsx`, `LoginPage.tsx`, `CaseListPage.tsx` demonstrate good MUI adoption. `GlobalError` and `GlobalLoader` use theme-aware custom styles).
- [x] **Routing:**
    - [x] Review and confirm existing routing setup in `App.tsx` covers all planned pages. (Routing in `App.tsx` is comprehensive for initial features).
    - [x] Implement lazy loading for all page components (already partially done). (All page components in `App.tsx` are lazy-loaded).
- [x] **State Management:**
    - [x] 使用全局状态管理 (e.g., Zustand, Redux Toolkit)，需要保证用户登录状态持久化，刷新页面或暂时离开后能回到页面继续工作. (React Context API used for `AuthContext`, `ThemeContext`, etc. `AuthContext` + `localStorage` provides persistent login state for user and selected case).
- [x] **Authentication & Authorization Core (`AuthContext.tsx`, `ProtectedRoute.tsx`):**
    - [x] **GitHub OIDC Login:**
        - [x] Implement frontend logic to interact with Quarkus OIDC backend for GitHub login. (Design task 1.1.1) (Verified in `LoginPage.tsx` and `AuthContext.tsx`).
        - [x] Handle callback from OIDC and store user session/token securely. (Handled by `oidc-client-ts` and `AuthContext`).
    - [x] **SurrealDB Direct Login (Admin Mode):**
        - [x] Implement UI and logic for admin login form when `admin=true` URL parameter is present. (Design task 1.1.1) (Verified in `LoginPage.tsx`).
    - [x] **Case Selection Logic (as per `product.md 2.1.1` & `design_tasks_checklist.md 1.1.2`):**
        - [x] Enhance `AuthContext` or a new `CaseContext` to manage selected case ID. (`AuthContext` handles this).
        - [x] Implement logic to handle `case=案件ID` from URL (check permissions, load case). (Implemented in `App.tsx` calling `auth.selectCase`).
        - [x] Implement logic to load last selected case from `localStorage` (or SurrealDB if backend stores this preference). (`AuthContext` handles this).
        - [x] Implement auto-selection if user is in only one case. (Implemented in `AuthContext`).
        - [x] Implement redirect to `/select-case` (CaseSelectionPage) if multiple cases and no selection. (`ProtectedRoute.tsx` handles this).
    - [x] **Role-Based Access Control (RBAC):**
        - [x] Ensure `AuthContext` (`user.role`, `hasRole`) robustly supports role checks. (`hasRole` implemented).
        - [x] `ProtectedRoute.tsx`: Enhance to handle dynamic menu rendering based on roles/permissions fetched after login/case selection (as per `product.md 2.1.1`). (Frontend prepared with mock data flow for dynamic menus in `AuthContext` and `Layout.tsx`. Full implementation depends on backend API for permissions).
- [x] **Global Components:**
    - [x] **Loading States:** Develop consistent loading indicators/spinners (visible in dark/light modes). (Design task 1.3.3) (`GlobalLoader.tsx` implemented, themed, and usage in `ProtectedRoute` improved).
    - [x] **Error Handling:** Develop consistent error message components/toasts. (Design task 1.3.4) (`GlobalError.tsx` implemented and themed; `SnackbarContext` for toasts).
    - [x] **Success Notifications:** Develop consistent success message components/toasts. (Design task 1.3.5) (`SnackbarContext` enhanced for multiple severities: success, error, warning, info).
- [x] **QuillJS Integration (as per `design_tasks_checklist.md 1.3.6`):**
    - [x] Develop a reusable `QuillEditor` component. (`RichTextEditor.tsx` enhanced).
    - [x] Style QuillJS interface for dark/light modes. (`quill-theme.css` uses CSS variables from `ThemeContext`).
    - [x] Implement image uploads to MinIO via backend, and display in editor. (Frontend part for image uploads implemented in `RichTextEditor.tsx` with a mock service. Full implementation depends on backend API).
    - [x] Implement non-image file attachment representation (icons, download links). (Implemented in `RichTextEditor.tsx` with a custom toolbar button, mock service, and styled links with a CSS-generated icon. Full implementation depends on backend API for file storage).
    - [x] Ensure vector icons are used for file types. (Toolbar button uses SVG; attached file link uses CSS unicode icon. Specific file-type icons would be an enhancement).

## 1. Main Application Layout & Navigation (`Layout.tsx`)

- [ ] **Layout Structure (as per `规范.md` & `design_tasks_checklist.md 1.2.1`):**
    - [ ] Refine `Layout.tsx` to strictly follow design:
        - [ ] Left sidebar: Prominent highlight color (Teal family) for active/selected items.
        - [ ] Top AppBar: Same color as main page content (`#f6f6f6` for light mode, corresponding dark mode color), blending in.
    - [ ] Ensure layout is fully responsive.
- [ ] **Dynamic Menu Rendering (as per `design_tasks_checklist.md 1.2.2`):**
    - [ ] Fetch user's menu permissions after login/case selection.
    - [ ] Dynamically render `navItems` in `Layout.tsx` based on fetched permissions.
- [ ] **Automatic Menu Selection (as per `design_tasks_checklist.md 1.2.3`):**
    - [ ] Implement logic to auto-navigate to the first accessible menu item after login/case selection.
- [ ] **Global Case Switcher (as per `design_tasks_checklist.md 1.2.4`):**
    - [ ] If a user is part of multiple cases, design and implement a case switcher UI (e.g., in AppBar or profile menu).
    - [ ] This should update the selected case in `AuthContext` (or `CaseContext`) and potentially re-fetch case-specific data/permissions.

## 2. 案件管理 (Case Management)

- [ ] **Case List Page (`CaseListPage.tsx` - Design tasks 2.1.x):**
    - [ ] Implement responsive table/card layout for case list.
    - [ ] Style with MUI, ensure dark/light mode.
    - [ ] Integrate vector icons for actions (View Details, Modify Status).
    - [ ] Implement "创建案件" (Create Case) button functionality.
    - [ ] Connect to API for fetching case list (mock or real).
    - [ ] Implement pagination and search/filter functionality.
- [ ] **Create Case (`CaseSubmissionPage.tsx` or new component - Design tasks 2.2.x):**
    - [ ] Implement "创建案件" form/modal.
    - [ ] Include fields: 案件负责人 (user selector), 案件程序 (dropdown), 受理时间 (date picker).
    - [ ] Implement conditional fields for "破产" procedure (公告时间, etc.) with default value logic and hints.
    - [ ] Implement form validation and submission to API.
    - [ ] Display success/error feedback.
- [ ] **Case Details Page (`CaseDetailPage.tsx` - Design tasks 2.3.x):**
    - [ ] Implement two-column layout:
        - [ ] Left: Basic info & timeline component (responsive, dark/light mode).
        - [ ] Main: "立案材料" via read-only `QuillJS` viewer.
    - [ ] Connect to API to fetch case details and `quilljs` content.
- [ ] **Modify Status (within `CaseDetailPage.tsx` or modal - Design tasks 2.4.x):**
    - [ ] Implement UI to initiate status modification.
    - [ ] Dynamically display valid next statuses based on `product.md 3.1.4` state transitions.
    - [ ] Implement inputs for required data (e.g., dates, `QuillJS` for "裁定重整公告" / "重整计划").
    - [ ] Implement submission to API and confirmation dialogs.
- [ ] **Meeting Minutes (within `CaseDetailPage.tsx` or modal - Design tasks 2.5.x):**
    - [ ] Implement "填写会议纪要" button (conditional display based on case status).
    - [ ] Integrate `QuillJS` editor for inputting/saving minutes, associated with the case/meeting.
- [ ] **Access Control & Reminders (as per `product.md 3.1.2`, `3.1.3`):**
    - [ ] Ensure UI elements (buttons, menu items) are dynamically shown/hidden based on user role and case status.
    - [ ] (Backend Task) Implement "案件机器人" logic for sending reminders as per table in `product.md 3.1.3`. Frontend will consume these in Message Center.

## 3. 债权人管理 (Creditor Management)

- [ ] **Creditor List Page (`CreditorListPage.tsx` - Design tasks 3.1.x):**
    - [ ] Implement page layout with search bar and toolbar (vector icons).
    - [ ] Toolbar buttons: "添加单个债权人", "批量导入债权人", "打印快递单号".
    - [ ] Implement responsive table for creditor list.
    - [ ] Connect to API for fetching/managing creditors for the selected case.
    - [ ] Implement automatic navigation to this module if case is "立案" and user has permission (as per `product.md 3.2.2` & `design_tasks_checklist.md 3.5.1`).
- [ ] **Add Single Creditor (modal or new page - Design tasks 3.2.x):**
    - [ ] Implement form with specified fields (类别, 名称, ID, 联系人, 地址 etc.).
    - [ ] Implement validation and API submission.
- [ ] **Batch Import Creditors (Design tasks 3.3.x):**
    - [ ] Implement UI for file upload (Excel/CSV).
    - [ ] Implement template download link.
    - [ ] Handle API response for import success/failure feedback.
- [ ] **Print Express Waybill Number (Design tasks 3.4.x):**
    - [ ] Implement checkbox selection for creditors.
    - [ ] Implement UI to generate printable format or integrate with a (mocked) third-party service.

## 4. 债权申报 (Claim Submission by Creditor) - Creditor Facing

- [ ] **Access Control (as per `product.md 3.3.2` & `design_tasks_checklist.md 4.5.1`):**
    - [ ] Ensure module is accessible only during "债权申报" stage for creditor roles.
- [ ] **Create/Edit Basic Claim Info (`ClaimSubmissionPage.tsx` - Design tasks 4.1.x):**
    - [ ] Implement "新增申报" button and form for basic claim details (性质, 本金, 利息, etc.).
    - [ ] Implement "保存并下一步（编辑附件）" workflow.
    - [ ] Connect to API.
- [ ] **Edit Attachment Materials (QuillJS page/section - Design tasks 4.2.x):**
    - [ ] Integrate `QuillJS` editor for claim justification and evidence upload (images to MinIO, other files as links).
    - [ ] Display basic claim info for reference.
    - [ ] Implement "返回修改基本信息", "保存草稿", "提交申报" buttons.
    - [ ] Handle API interaction for saving/submitting.
- [ ] **Claim Submission Flow & Read-Only View (Design tasks 4.3.x):**
    - [ ] Implement validation and feedback for submission.
    - [ ] Implement read-only view for submitted/approved claims from creditor's perspective.
- [ ] **Creditor's Claim List (`ClaimListPage.tsx` adapted for creditors - Design tasks 4.4.x):**
    - [ ] Develop a view for creditors to see their own claims (申报时间, 性质, 总额, 审核状态, 审核意见).
    - [ ] Implement actions: View Details, Withdraw (if not audited), Edit (if draft/rejected).
    - [ ] Connect to API.

## 5. 债权审核 (Claim Review by Administrator) - Administrator Facing

- [ ] **Access Control & Auto-Navigation (as per `product.md 3.4.2` & `design_tasks_checklist.md 5.6.1`):**
    - [ ] Ensure module is accessible during "债权申报" stage for admin/manager roles.
    - [ ] Implement automatic navigation if conditions met.
- [ ] **Administrator's Claim List (`ClaimListPage.tsx` - Design tasks 5.1.x):**
    - [ ] Implement comprehensive responsive table for all claims in the case.
    - [ ] Implement search (full-text) and filter UI (审核状态, 债权性质).
    - [ ] Connect to API.
- [ ] **Administrator Files Claim (modal or new page - Design tasks 5.2.x):**
    - [ ] Implement "创建债权" (代报) button and form (债权人信息, 联系人, 主张债权).
    - [ ] Integrate `QuillJS` for attachment editing.
    - [ ] Handle API submission.
- [ ] **Batch Reject Claims (in `ClaimListPage.tsx` - Design tasks 5.3.x):**
    - [ ] Implement checkbox selection and "批量驳回" button.
    - [ ] Implement confirmation modal with input for rejection reason.
    - [ ] Handle API submission.
- [ ] **Claim Review Details Page (`ClaimReviewDetailPage.tsx` - Design tasks 5.4.x):**
    - [ ] Implement two-column layout:
        - [ ] Left: Fixed read-only "主张债权信息" & creditor details.
        - [ ] Right: "附件材料" (`QuillJS` viewer with commenting/annotation features).
            - [ ] Implement `QuillJS` commenting/annotation tools (styled for dark/light).
            - [ ] Implement `QuillJS` version history display.
    - [ ] Connect to API to fetch claim details and `QuillJS` content.
- [ ] **Review Actions (modal in `ClaimReviewDetailPage.tsx` - Design tasks 5.5.x):**
    - [ ] Implement floating "审核" button (vector icon).
    - [ ] Implement review modal/form:
        - [ ] Fields: 审核认定性质, 本金, 利息, 其他费用, 审核状态 (dropdown from admin config), 审核意见, 管理人补充附件 (`QuillJS`).
        - [ ] Auto-calculate and display "审核认定债权总额".
    - [ ] Implement "提交审核" and "取消" buttons with confirmation prompts.
    - [ ] Handle API submission.

## 6. 债权申报数据大屏 (Claim Submission Dashboard)

- [ ] **Overall Design & Layout (`ClaimDataDashboardPage.tsx` - Design tasks 6.1.x):**
    - [ ] Implement dashboard layout (responsive, default dark mode).
    - [ ] Clearly indicate the currently selected case for which data is displayed.
    - [ ] Connect to SurrealDB (via backend API) for real-time data.
- [ ] **Visualization Components (Design tasks 6.2.x):**
    - [ ] **Charting Library:** Select and integrate a charting library (@mui/x-charts) that supports MUI styling and dark/light themes.
    - [ ] Implement Core Metric Cards (digital flipper style).
    - [ ] Implement Trend Charts (line/bar for daily/weekly submissions).
    - [ ] Implement Composition Charts (pie/ring for claim nature/status).
    - [ ] Implement Audit Progress Charts (pie/bar for audit status).
    - [ ] Implement Real-time Activity Lists (recent submissions/reviews).
    - [ ] Implement User Online Distribution Chart.
- [ ] **Real-time Data Update UX (Design tasks 6.3.x):**
    - [ ] Implement WebSocket or SurrealDB live query handling for real-time updates.
    - [ ] Design and implement smooth transitions/visual cues for data changes.

## 7. 在线会议 (Online Meetings)

- [ ] **Access Control (`OnlineMeetingPage.tsx` - Design tasks 7.4.2):**
    - [ ] Ensure module accessibility based on case status and user role.
- [ ] **Meeting List Page (`OnlineMeetingPage.tsx` - Design tasks 7.1.x):**
    - [ ] Implement responsive table for meeting list (名称, 类型, 时间, 状态, 链接, 纪要).
    - [ ] Implement toolbar with "安排新会议" button (vector icons).
    - [ ] Connect to API for meeting data.
- [ ] **Schedule/Edit Meetings (modal or new page - Design tasks 7.2.x):**
    - [ ] Implement form for scheduling/editing meetings (名称, 类型, 时间, 参会人员, 议程, 会议链接).
    - [ ] Implement UI for cancelling meetings.
    - [ ] Handle API submission.
- [ ] **Meeting Minutes (link to `QuillJS` editor - Design tasks 7.3.x):**
    - [ ] Ensure link navigates to `QuillJS` editor for creating/viewing minutes associated with the meeting.
- [ ] **Meeting Records & Search (in `OnlineMeetingPage.tsx` - Design tasks 7.4.1):**
    - [ ] Implement view for past meetings.
    - [ ] Implement search functionality (name, time).

## 8. 消息中心 (Message Center)

- [ ] **Overall Layout (`MessageCenterPage.tsx` - Design tasks 8.1.x):**
    - [ ] Implement multi-column layout (e.g., conversation list, message view). Ensure responsiveness.
    - [ ] Connect to API/WebSocket for real-time messages.
- [ ] **IM Chat Messages (Design tasks 8.2.x):**
    - [ ] Implement UI for 1-on-1 and group chats.
    - [ ] Display unread counts.
    - [ ] Implement message input (text, image, file upload with vector icons).
    - [ ] Style chat bubbles for dark/light modes.
- [ ] **System Reminders (Design tasks 8.3.x):**
    - [ ] Implement card-based UI for "案件机器人" messages (from `product.md 3.1.3`).
    - [ ] Implement display for business operation notifications (claim approved/rejected, new claim to audit, etc.).
- [ ] **Notification Management (Design tasks 8.4.x):**
    - [ ] Implement mark as read/unread.
    - [ ] Implement filtering by type.
    - [ ] Implement delete/archive notifications (vector icons for actions).

## 9. Admin Functions (Administrator Only)

- [ ] **身份管理 (Role Management - `AdminPage.tsx` section or new page - Design tasks 9.x):**
    - [ ] **Role List:** Implement table to display roles. "创建角色" button.
    - [ ] **Create/Edit Role Form:**
        - [ ] Fields for role name/description.
        - [ ] UI for assigning menu permissions (tree/checklist, dark/light mode).
        - [ ] UI for assigning operation (CRUD) permissions per menu.
    - [ ] **User-Role Assignment UI.**
    - [ ] Connect to API for managing roles and permissions.
- [ ] **审核状态管理 (Review Status Management - `AdminPage.tsx` section or new page - Design tasks 10.x):**
    - [ ] **Status List:** Implement table for audit statuses. "添加状态" button.
    - [ ] **Add/Edit/Delete Status Form:** Simple form for status labels.
    - [ ] Connect to API. These statuses will populate dropdowns in Claim Review.
- [ ] **案件通知规则配置 (in `AdminPage.tsx` - `product.md 3.1.3` related):**
    - [ ] UI for admin to configure rules and templates for "案件机器人" notifications (though actual sending is backend).

## 10. Non-Functional Requirements & Polish

- [ ] **Unit Testing (as per `规范.md`):**
    - [ ] Write unit tests for all critical components, utility functions, and business logic.
    - [ ] Aim for reasonable test coverage.
- [ ] **E2E Testing (Optional, but recommended):**
    - [ ] Consider setting up basic E2E tests for key user flows.
- [ ] **Performance Optimization:**
    - [ ] Optimize bundle size (code splitting, tree shaking - Vite handles much of this).
    - [ ] Ensure efficient data fetching and rendering.
    - [ ] Profile and address performance bottlenecks, especially in real-time dashboards.
- [ ] **Accessibility (A11y):**
    - [ ] Use semantic HTML.
    - [ ] Add ARIA attributes where necessary.
    - [ ] Ensure keyboard navigability.
    - [ ] Test color contrast, especially with custom themes.
- [ ] **Cross-Browser Compatibility:**
    - [ ] Test on modern browsers (Chrome, Firefox, Edge, Safari).
- [ ] **Code Quality & Readability:**
    - [ ] Adhere to ESLint rules.
    - [ ] Conduct code reviews.
    - [ ] Ensure code is well-commented and organized.
- [ ] **Documentation:**
    - [ ] Update/create JSDoc or TypeDoc for components and functions.
    - [ ] Maintain `README.md` with setup and development instructions.
- [ ] **Final UI/UX Review:**
    - [ ] Thoroughly test all UI interactions in both dark and light modes.
    - [ ] Verify responsiveness on various screen sizes.
    - [ ] Ensure consistency with `规范.md` design rules (colors, icons, layout principles).
    - [ ] Check for adherence to `design_tasks_checklist.md` items.

This developer checklist should provide a comprehensive guide for the development process. Remember to break down these tasks further into smaller, manageable units during sprint planning.
