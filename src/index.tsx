import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import { SurrealProvider } from './contexts/SurrealProvider'; // <-- IMPORT NEW PROVIDER
import './styles/main.css'; // Tailwind CSS and global styles
// REMOVED: import { connectSurrealDB } from './lib/surreal';
import { I18nextProvider } from 'react-i18next';
import i18n from './i18n';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

// Define constants for SurrealDB connection from .env
const surrealEndpoint = import.meta.env.VITE_SURREALDB_WS_URL || 'ws://localhost:8000/rpc';
const surrealNamespace = import.meta.env.VITE_SURREALDB_NAMESPACE || 'test';
const surrealDatabase = import.meta.env.VITE_SURREALDB_DATABASE || 'test';

// REMOVED: renderApp, renderError functions, and connectSurrealDB() promise handling

root.render(
  <React.StrictMode>
    <I18nextProvider i18n={i18n}>
      <SurrealProvider
        endpoint={surrealEndpoint}
        namespace={surrealNamespace}
        database={surrealDatabase}
        // autoConnect is typically handled by the provider's useEffect internally based on props.
        // If your SurrealProvider implementation from the previous step explicitly uses an autoConnect prop,
        // you can set it here. Otherwise, it will likely attempt connection on mount.
        // For the example SurrealProvider provided earlier, it attempts connection on mount if endpoint/ns/db are present.
        // Let's assume autoConnect={true} behavior is default or managed by an effect in SurrealProvider.
        // If an explicit prop is needed, add it: autoConnect={true}
      >
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </SurrealProvider>
    </I18nextProvider>
  </React.StrictMode>
);