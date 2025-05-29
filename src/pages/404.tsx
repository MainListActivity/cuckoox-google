import React from 'react';
import { Link } from 'react-router-dom';

const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-[calc(100vh-theme(spacing.16))] flex flex-col items-center justify-center text-center p-6 bg-gray-100">
      {/* Assuming header height is 4rem (16 in Tailwind's spacing scale) */}
      <span className="material-icons text-9xl text-blue-500 mb-6">error_outline</span>
      <h1 className="text-6xl font-bold text-gray-800 mb-4">404</h1>
      <p className="text-2xl text-gray-600 mb-8">Oops! Page Not Found.</p>
      <p className="text-gray-500 mb-8">
        The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
      </p>
      <Link
        to="/"
        className="px-8 py-3 bg-blue-600 text-white text-lg font-medium rounded-md hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        Go to Homepage
      </Link>
    </div>
  );
};

export default NotFoundPage;