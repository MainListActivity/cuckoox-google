import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useSurrealClient } from '../contexts/SurrealProvider'; // For future save operation
import { useTranslation } from 'react-i18next';

const AdminThemePage: React.FC = () => {
  const { t } = useTranslation();
  const { selectedCaseId, selectedCase, refreshUserCasesAndRoles } = useAuth(); // Ensure refreshUserCasesAndRoles is destructured
  const { availableThemes, currentTheme, setCurrentThemeByName } = useTheme();
  const client = useSurrealClient();

  const [chosenThemeName, setChosenThemeName] = useState<string>(currentTheme.name);

  const handleThemeSelection = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setChosenThemeName(event.target.value);
    // Optionally apply theme preview immediately:
    // setCurrentThemeByName(event.target.value); 
  };

  const handleSaveTheme = async () => {
    if (!selectedCaseId || !chosenThemeName) {
      alert(t('admin_theme_page.alert_no_case_or_theme', 'Please select a case and a theme.'));
      return;
    }
    try {
      await client.merge(selectedCaseId, { selected_theme_name: chosenThemeName });
      setCurrentThemeByName(chosenThemeName); // Update ThemeContext
      if (refreshUserCasesAndRoles) { // Check if the function exists
        await refreshUserCasesAndRoles(); // Update AuthContext
      }
      alert(t('admin_theme_page.alert_theme_saved_success', `Theme "${chosenThemeName}" saved successfully for case ${selectedCaseId}.`));
    } catch (error: any) {
      console.error("Error saving theme:", error);
      alert(t('admin_theme_page.alert_save_error_detail', `Error saving theme: ${error.message || 'Unknown error'}`));
    }
  };

  if (!selectedCaseId) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold mb-4">{t('admin_theme_page.title', 'Theme Management')}</h1>
        <p>{t('admin_theme_page.no_case_selected', 'No case selected. Please select a case to manage its theme.')}</p>
      </div>
    );
  }
  
  // Try to get current theme from selectedCase if available from AuthContext
  // This depends on selectedCase in AuthContext being populated with selected_theme_name
  const currentCaseThemeNameFromDb = (selectedCase as any)?.selected_theme_name || currentTheme.name;
  // Sync chosenThemeName if currentCaseThemeNameFromDb changes and is different from current selection
  React.useEffect(() => {
    // Only update chosenThemeName if it's different from what's in DB, to avoid disrupting user selection
    // And also make sure it's different from the current actual theme applied by context
    if (chosenThemeName !== currentCaseThemeNameFromDb ) {
        // If the theme from DB is different than the currently applied theme (currentTheme.name)
        // and also different from what user might have just picked (chosenThemeName),
        // then it means the DB value has updated, so sync our selector.
        // Or, if the selectedCase has changed, sync to its theme.
         setChosenThemeName(currentCaseThemeNameFromDb);
    }
  }, [currentCaseThemeNameFromDb, selectedCaseId]); // Re-run if selectedCaseId changes (new case selected)


  return (
    <div className="p-6 bg-background text-textOnBackground">
      <h1 className="text-2xl font-semibold mb-4 text-primary">{t('admin_theme_page.title', 'Theme Management')}</h1>
      <p className="mb-2">
        {t('admin_theme_page.managing_theme_for_case', `Managing theme for case: ${selectedCaseId}`)}
      </p>
      <p className="mb-4">
        {t('admin_theme_page.current_db_theme', `Current theme in database for this case: ${currentCaseThemeNameFromDb || t('admin_theme_page.not_set', 'Not set')}`)}
      </p>
      <p className="mb-4">
        {t('admin_theme_page.current_active_theme_preview', `Current active theme (preview): ${currentTheme.name}`)}
      </p>

      <div className="mb-6">
        <label htmlFor="themeSelector" className="block text-sm font-medium text-textOnSurface mb-1">
          {t('admin_theme_page.select_theme_label', 'Select a new theme:')}
        </label>
        <select
          id="themeSelector"
          value={chosenThemeName}
          onChange={handleThemeSelection}
          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md bg-surface text-textOnSurface"
        >
          {availableThemes.map(theme => (
            <option key={theme.name} value={theme.name}>
              {theme.name}
            </option>
          ))}
        </select>
        <button 
            onClick={() => setCurrentThemeByName(chosenThemeName)}
            className="mt-2 px-3 py-1 bg-accent text-textOnPrimary rounded hover:opacity-80 text-sm"
        >
            {t('admin_theme_page.preview_button', 'Preview Selected Theme')}
        </button>
      </div>

      <button
        onClick={handleSaveTheme}
        className="px-4 py-2 bg-primary text-textOnPrimary rounded hover:opacity-80"
      >
        {t('admin_theme_page.save_button', 'Save Theme to Case')}
      </button>

      <div className="mt-8 p-4 border border-gray-200 rounded bg-surface text-textOnSurface">
        <h3 className="text-lg font-semibold mb-2">{t('admin_theme_page.theme_preview_title', 'Live Theme Preview (reflects currently applied theme)')}</h3>
        <p style={{ color: currentTheme.colors.primary }} className="p-2 rounded">
          {t('admin_theme_page.primary_color_text_example', 'This text uses the primary color.')} (Primary: {currentTheme.colors.primary})
        </p>
        <p style={{ color: currentTheme.colors.secondary }} className="p-2 mt-2 rounded">
          {t('admin_theme_page.secondary_color_text_example', 'This text uses the secondary color.')} (Secondary: {currentTheme.colors.secondary})
        </p>
        <div style={{ backgroundColor: currentTheme.colors.primary, color: currentTheme.colors.textOnPrimary }} className="w-full h-10 mt-2 rounded flex items-center justify-center">
            {t('admin_theme_page.primary_bg_example', 'Primary Background')}
        </div>
        <div style={{ backgroundColor: currentTheme.colors.secondary, color: currentTheme.colors.textOnSecondary }} className="w-full h-10 mt-2 rounded flex items-center justify-center">
            {t('admin_theme_page.secondary_bg_example', 'Secondary Background')}
        </div>
         <div style={{ backgroundColor: currentTheme.colors.error, color: currentTheme.colors.textOnError }} className="w-full h-10 mt-2 rounded flex items-center justify-center">
            {t('admin_theme_page.error_bg_example', 'Error Background')}
        </div>
        <div style={{ backgroundColor: currentTheme.colors.background, color: currentTheme.colors.textOnBackground }} className="w-full h-10 mt-2 rounded flex items-center justify-center border">
            {t('admin_theme_page.background_bg_example', 'General Background')}
        </div>
        <div style={{ backgroundColor: currentTheme.colors.surface, color: currentTheme.colors.textOnSurface }} className="w-full h-10 mt-2 rounded flex items-center justify-center border">
            {t('admin_theme_page.surface_bg_example', 'Surface Background')}
        </div>
      </div>
    </div>
  );
};

export default AdminThemePage;
