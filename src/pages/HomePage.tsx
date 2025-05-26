import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const HomePage: React.FC = () => {
  const { isLoggedIn } = useAuth();
  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <h1 className="text-3xl font-bold text-gray-800 mb-4">Welcome to CuckooX Bankruptcy Management</h1>
      <p className="text-gray-600 mb-6">
        This is the central platform for managing bankruptcy cases, creditor information, claims, and more.
      </p>
      {isLoggedIn ? (
        <div>
          <p className="mb-4">You are logged in. Navigate using the sidebar or go to your dashboard.</p>
          <Link to="/dashboard" className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">
            Go to Dashboard
          </Link>
        </div>
      ) : (
        <div>
          <p className="mb-4">Please log in to access the system features.</p>
          <Link to="/login" className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors">
            Login
          </Link>
        </div>
      )}
       <div className="mt-8 p-4 border border-blue-200 rounded bg-blue-50">
          <h2 className="text-xl font-semibold text-blue-700 mb-2">Note on Material Design</h2>
          <p className="text-blue-600">
            This application is being refactored to React. While basic Material Design principles are followed using Tailwind CSS,
            for a richer set of Material Design components (like those in Vuetify), integrating a library such as Material-UI (MUI)
            is recommended as a next step.
          </p>
        </div>
    </div>
  );
};

export default HomePage;