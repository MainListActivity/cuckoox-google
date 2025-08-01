import React from 'react';
import { useTheme } from '@/src/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';

const AdminThemePage: React.FC = () => {
  const { t } = useTranslation();
  const { themeMode, toggleThemeMode, muiTheme } = useTheme();

  return (
    <div className="p-6 bg-background text-textOnBackground">
      <h1 className="text-2xl font-semibold mb-4 text-primary">{t('admin_theme_page.title', '主题管理')}</h1>
      
      <div className="mb-6">
        <p className="mb-4">
          {t('admin_theme_page.current_theme', `当前主题模式: ${themeMode === 'dark' ? '深色模式' : '浅色模式'}`)}
        </p>
        
        <button
          onClick={toggleThemeMode}
          className="px-4 py-2 bg-primary text-textOnPrimary rounded hover:opacity-80"
        >
          {t('admin_theme_page.toggle_theme', `切换到${themeMode === 'dark' ? '浅色' : '深色'}模式`)}
        </button>
      </div>

      <div className="mt-8 p-4 border border-gray-200 rounded bg-surface text-textOnSurface">
        <h3 className="text-lg font-semibold mb-2">{t('admin_theme_page.theme_preview_title', '主题预览')}</h3>
        <p style={{ color: muiTheme.palette.primary.main }} className="p-2 rounded">
          {t('admin_theme_page.primary_color_text_example', '这是主色调文本示例。')} (Primary: {muiTheme.palette.primary.main})
        </p>
        <p style={{ color: muiTheme.palette.secondary.main }} className="p-2 mt-2 rounded">
          {t('admin_theme_page.secondary_color_text_example', '这是次要色调文本示例。')} (Secondary: {muiTheme.palette.secondary.main})
        </p>
        <div style={{ backgroundColor: muiTheme.palette.primary.main, color: muiTheme.palette.primary.contrastText }} className="w-full h-10 mt-2 rounded flex items-center justify-center">
            {t('admin_theme_page.primary_bg_example', '主色调背景')}
        </div>
        <div style={{ backgroundColor: muiTheme.palette.secondary.main, color: muiTheme.palette.secondary.contrastText }} className="w-full h-10 mt-2 rounded flex items-center justify-center">
            {t('admin_theme_page.secondary_bg_example', '次要色调背景')}
        </div>
         <div style={{ backgroundColor: muiTheme.palette.error.main, color: muiTheme.palette.error.contrastText }} className="w-full h-10 mt-2 rounded flex items-center justify-center">
            {t('admin_theme_page.error_bg_example', '错误状态背景')}
        </div>
        <div style={{ backgroundColor: muiTheme.palette.background.default, color: muiTheme.palette.text.primary }} className="w-full h-10 mt-2 rounded flex items-center justify-center border">
            {t('admin_theme_page.background_bg_example', '常规背景')}
        </div>
        <div style={{ backgroundColor: muiTheme.palette.background.paper, color: muiTheme.palette.text.primary }} className="w-full h-10 mt-2 rounded flex items-center justify-center border">
            {t('admin_theme_page.surface_bg_example', '卡片背景')}
        </div>
      </div>
    </div>
  );
};

export default AdminThemePage;
