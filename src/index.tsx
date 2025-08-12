import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from '@/src/App';
import { AuthProvider } from '@/src/contexts/AuthContext';
import { SurrealProvider } from '@/src/contexts/SurrealProvider';
import '@/src/styles/main.css'; // Tailwind CSS and global styles
// REMOVED: import { connectSurrealDB } from './lib/surreal';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/src/i18n';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'; // ADDED
import { CustomThemeProvider } from '@/src/contexts/ThemeContext'; // ADDED
import { StyledEngineProvider } from '@mui/material/styles'; // ADDED


const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

// REMOVED: renderApp, renderError functions, and connectSurrealDB() promise handling

const queryClient = new QueryClient(); // ADDED

root.render(
  <React.StrictMode>
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}> {/* ADDED */}
        <SurrealProvider autoConnect >
          {/* SurrealWorkerProvider does not yet expose sessionExpired handler; can extend later */}
          <StyledEngineProvider injectFirst> {/* ADDED */}
            <BrowserRouter>
              <AuthProvider>
                <CustomThemeProvider> {/* ADDED */}
                  <App />
                </CustomThemeProvider> {/* ADDED */}
              </AuthProvider>
            </BrowserRouter>
          </StyledEngineProvider> {/* ADDED */}
        </SurrealProvider>
      </QueryClientProvider> {/* ADDED */}
    </I18nextProvider>
  </React.StrictMode>
);