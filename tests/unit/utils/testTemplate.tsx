import React from 'react';
import { render } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { vi } from 'vitest';

// 创建最小化的MUI主题
const testTheme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#1976d2' },
  },
  components: {
    // 简化MUI Dialog的样式以避免复杂的portal渲染
    MuiDialog: {
      styleOverrides: {
        root: {
          position: 'relative', // 避免portal问题
        },
      },
    },
  },
});

// 标准化的渲染函数，只包含必要的providers
export function renderWithMuiTheme(ui: React.ReactElement) {
  return render(
    <ThemeProvider theme={testTheme}>
      {ui}
    </ThemeProvider>
  );
}

// 通用mock配置
export const commonMocks = {
  // i18n mock
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'create_user_and_add_to_case': '创建用户并添加到案件',
        'username_label': '用户名',
        'cancel_button': '取消',
        'create_user_and_add': '创建用户并添加',
        'password_label': '密码',
        'email_label': '邮箱',
        'display_name_label': '显示姓名',
        'role_in_case_label': '在案件中的角色',
        'username_required': '用户名不能为空',
        'password_required': '密码不能为空',
        'email_required': '邮箱不能为空',
        'name_required': '姓名不能为空',
        'email_invalid': '邮箱格式不正确',
      };
      return translations[key] || key;
    },
  }),
  
  // Router mock
  useNavigate: vi.fn(),
  useLocation: () => ({ pathname: '/' }),
  useParams: () => ({}),
  
  // SurrealDB mock
  useSurrealClient: () => ({}),
};