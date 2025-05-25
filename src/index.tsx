import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import './styles/main.css'; // Tailwind CSS and global styles
import { connectSurrealDB } from './lib/surreal'; // <-- IMPORT

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
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);