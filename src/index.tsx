import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import './styles/main.css'; // Tailwind CSS and global styles
import { connectSurrealDB } from './lib/surreal'; // <-- IMPORT
import { I18nextProvider } from 'react-i18next'; // <-- IMPORT
import i18n from './i18n';                     // <-- IMPORT

// Call the connect function
connectSurrealDB().then(() => {
  console.log("Attempted SurrealDB connection from index.tsx.");
}).catch(error => {
  console.error("SurrealDB connection failed from index.tsx:", error);
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <I18nextProvider i18n={i18n}> {/* <-- WRAP HERE */}
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </I18nextProvider> {/* <-- CLOSE WRAPPER */}
  </React.StrictMode>
);