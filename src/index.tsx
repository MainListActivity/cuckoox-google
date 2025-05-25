import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import './styles/main.css'; // Tailwind CSS and global styles
import { connectSurrealDB } from './lib/surreal'; // <-- IMPORT
import { I18nextProvider } from 'react-i18next'; // <-- IMPORT
import i18n from './i18n';                     // <-- IMPORT

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

const renderApp = () => {
  root.render(
    <React.StrictMode>
      <I18nextProvider i18n={i18n}>
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </I18nextProvider>
    </React.StrictMode>
  );
};

const renderError = (message: string) => {
  root.render(
    <React.StrictMode>
      <div style={{ textAlign: 'center', marginTop: '50px', fontFamily: 'sans-serif', color: 'red' }}>
        <h1>Application Error</h1>
        <p>Could not initialize application: {message}</p>
        <p>Please ensure the database is running and accessible, then refresh the page.</p>
      </div>
    </React.StrictMode>
  );
};

// Attempt to connect to SurrealDB and then render the app or an error message
connectSurrealDB()
  .then(() => {
    console.log("SurrealDB connection successful from index.tsx. Rendering app...");
    renderApp();
  })
  .catch(error => {
    console.error("Critical SurrealDB connection failure from index.tsx after all retries:", error);
    renderError(`Failed to connect to SurrealDB. ${error.message}`);
  });