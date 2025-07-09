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

// Register the service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw/sw-surreal.js')
      .then(registration => {
        console.log('ServiceWorker registration successful with scope: ', registration.scope);
      })
      .catch(error => {
        console.log('ServiceWorker registration failed: ', error);
      });
  });
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

// Define constants for SurrealDB connection from .env
const surrealEndpoint = import.meta.env.VITE_SURREALDB_WS_URL || 'ws://localhost:8000/rpc';
const surrealNamespace = import.meta.env.VITE_SURREALDB_NAMESPACE || 'ck_go';
const surrealDatabase = import.meta.env.VITE_SURREALDB_DATABASE || 'ck_go';

// REMOVED: renderApp, renderError functions, and connectSurrealDB() promise handling

const queryClient = new QueryClient(); // ADDED

// Authentication error handler (session/token expired)
const handleSessionExpired = () => {
  console.warn('Authentication error (session/token expired), clearing storage and redirecting to login...');
  // Clear all auth-related localStorage items
  localStorage.removeItem('cuckoox-isLoggedIn');
  localStorage.removeItem('cuckoox-user');
  localStorage.removeItem('cuckoox-selectedCaseId');
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('token_expires_at');
  
  // Redirect to login page by reloading
  window.location.href = '/login';
};

root.render(
  <React.StrictMode>
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}> {/* ADDED */}
        <SurrealProvider
          endpoint={surrealEndpoint}
          namespace={surrealNamespace}
          database={surrealDatabase}
          onSessionExpired={handleSessionExpired}
        >
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