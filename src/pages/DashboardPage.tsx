import React from 'react';
import { useAuth } from '../contexts/AuthContext';

const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  // TODO: Fetch and display actual dashboard data
  // For now, a placeholder:
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-gray-800 mb-4">Dashboard</h1>
      {user && <p className="text-gray-600 mb-6">Welcome back, {user.name}!</p>}
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Example Stat Card */}
        <div className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow">
          <h2 className="text-lg font-semibold text-blue-600 mb-2">Active Cases</h2>
          <p className="text-3xl font-bold text-gray-700">5</p>
          <p className="text-sm text-gray-500 mt-1">Placeholder Data</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow">
          <h2 className="text-lg font-semibold text-green-600 mb-2">Claims Pending Review</h2>
          <p className="text-3xl font-bold text-gray-700">12</p>
          <p className="text-sm text-gray-500 mt-1">Placeholder Data</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow">
          <h2 className="text-lg font-semibold text-yellow-600 mb-2">Upcoming Meetings</h2>
          <p className="text-3xl font-bold text-gray-700">2</p>
          <p className="text-sm text-gray-500 mt-1">Placeholder Data</p>
        </div>
      </div>

      <div className="mt-8 bg-white p-6 rounded-lg shadow">
        <h3 className="text-xl font-semibold text-gray-700 mb-4">Recent Activity</h3>
        <ul className="space-y-3">
          <li className="text-gray-600 text-sm">Case #1023: New claim submitted. (Placeholder)</li>
          <li className="text-gray-600 text-sm">Meeting: Creditor Meeting for Case #998 scheduled. (Placeholder)</li>
          <li className="text-gray-600 text-sm">User 'john.doe' logged in. (Placeholder)</li>
        </ul>
      </div>
       <p className="mt-8 text-gray-500">
        This is a placeholder dashboard. Actual data and visualizations related to cases, claims, and user activity will be displayed here based on the selected case and user permissions.
      </p>
    </div>
  );
};

export default DashboardPage;