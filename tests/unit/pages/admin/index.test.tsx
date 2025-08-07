import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import AdminPage from '@/src/pages/admin/index';
import { ThemeProvider, createTheme } from '@mui/material/styles'; // For Theme context
import { adminSections } from '@/src/pages/admin/index'; // Import adminSections if it's exported, otherwise redefine or mock

// Mock SvgIcon if it causes issues in tests, or ensure it's handled by the testing environment
// jest.mock('@mui/material/SvgIcon', () => (props: any) => <svg data-testid="mock-svg-icon" {...props} />);

// It's better if adminSections is exported from the component file,
// but if not, we can redefine it here for test verification.
// If it's not exported from the original file, you might need to copy its definition:
/*
const adminSectionsForTest = [
  { title: '用户管理', description: '管理系统用户账户、分配全局角色。', buttonText: '管理用户', iconPath: 'mdiAccountGroupOutline' }, // Assuming icon path is what's important for test
  { title: '身份与权限管理', description: '定义用户身份（角色）及其可操作的菜单和功能权限。', buttonText: '管理身份权限', iconPath: 'mdiSecurity' },
  { title: '审核状态维护', description: '配置债权审核时可选的审核状态列表。', buttonText: '维护审核状态', iconPath: 'mdiPlaylistCheck' },
  { title: '案件通知规则', description: '配置案件机器人基于案件阶段发送通知的规则和模板。', buttonText: '配置通知规则', iconPath: 'mdiBellRingOutline' },
  { title: '系统配置', description: '管理系统级参数，如数据库连接（概念性）、OIDC客户端设置等。', buttonText: '系统配置', iconPath: 'mdiCogOutline' },
];
*/
// However, the provided AdminPage source shows adminSections is defined locally and not exported.
// The test will need to rely on the structure of how it's used or make assumptions.
// For a more robust test, it would be ideal if adminSections or its relevant parts were testable.
// Let's assume for now we can test by checking the rendered text content.

const theme = createTheme(); // Basic theme for rendering MUI components

describe('AdminPage', () => {
  beforeEach(() => {
    render(
      <BrowserRouter>
        <ThemeProvider theme={theme}>
          <AdminPage />
        </ThemeProvider>
      </BrowserRouter>
    );
  });

  test('renders the main title "系统管理"', () => {
    expect(screen.getByText('系统管理', { selector: 'h1' })).toBeInTheDocument();
  });

  // Dynamically create tests for each admin section based on the local definition if possible,
  // or by using the actual definition from the component file if it were exported.
  // Since it's not exported, we'll use the one defined in the component.
  // This means if the component's adminSections changes, this test needs to be updated.
  const sections = [
    { title: '用户管理', description: '管理系统用户账户、分配全局角色。', buttonText: '管理用户' },
    { title: '身份与权限管理', description: '定义用户身份（角色）及其可操作的菜单和功能权限。', buttonText: '管理身份权限' },
    { title: '审核状态维护', description: '配置债权审核时可选的审核状态列表。', buttonText: '维护审核状态' },
    { title: '案件通知规则', description: '配置案件机器人基于案件阶段发送通知的规则和模板。', buttonText: '配置通知规则' },
    { title: '系统配置', description: '管理系统级参数，如数据库连接（概念性）、OIDC客户端设置等。', buttonText: '系统配置' },
  ];

  sections.forEach(section => {
    test(`renders card for "${section.title}"`, () => {
      // Check for section title
      expect(screen.getByText(section.title, { selector: 'h2' })).toBeInTheDocument();
      // Check for section description
      expect(screen.getByText(section.description)).toBeInTheDocument();
      // Check for section button
      expect(screen.getByRole('button', { name: section.buttonText })).toBeInTheDocument();
      // Check for an icon in the card. Since SvgIcon is complex to test directly without specific test IDs on icons,
      // we can check if an SVG element is rendered within the card containing the title.
      const titleElement = screen.getByText(section.title, { selector: 'h2' });
      const cardElement = titleElement.closest('.MuiCard-root'); // Find the parent card
      expect(cardElement).not.toBeNull();
      if (cardElement) {
        const svgElement = cardElement.querySelector('svg');
        expect(svgElement).toBeInTheDocument();
      }
    });
  });

  test('renders the footer text', () => {
    expect(screen.getByText(/系统管理页面，仅限管理员访问。/)).toBeInTheDocument();
  });
});
