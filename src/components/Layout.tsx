import React, { useState, ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface LayoutProps {
  children: ReactNode;
}

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { path: '/cases', label: '案件管理', icon: 'gavel' },
  { path: '/creditors', label: '债权人管理', icon: 'people' },
  { path: '/claims', label: '债权申报与审核', icon: 'assignment' },
  { path: '/claim-dashboard', label: '债权数据大屏', icon: 'bar_chart' },
  { path: '/online-meetings', label: '在线会议', icon: 'videocam' },
  { path: '/messages', label: '消息中心', icon: 'chat' },
  { path: '/admin', label: '系统管理', icon: 'settings', adminOnly: true },
];

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [drawerOpen, setDrawerOpen] = useState(true);
  const { user, logout, hasRole } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside
        className={`bg-blue-700 text-white transition-all duration-300 ease-in-out ${
          drawerOpen ? 'w-64' : 'w-20'
        } flex flex-col`}
      >
        <div className="flex items-center justify-between h-16 p-4 border-b border-blue-600">
          <span className={`font-semibold text-xl ${!drawerOpen && 'hidden'}`}>CuckooX</span>
          <button onClick={() => setDrawerOpen(!drawerOpen)} className="p-2 rounded hover:bg-blue-600 focus:outline-none focus:bg-blue-600">
            <span className="material-icons">{drawerOpen ? 'menu_open' : 'menu'}</span>
          </button>
        </div>
        <nav className="flex-grow p-2 space-y-1">
          {navItems.map((item) => 
            (!item.adminOnly || (item.adminOnly && hasRole('admin'))) && (
            <Link
              key={item.path}
              to={item.path}
              className="flex items-center px-3 py-2.5 text-sm rounded-md hover:bg-blue-600 transition-colors"
              title={item.label}
            >
              <span className="material-icons mr-3">{item.icon}</span>
              <span className={`${!drawerOpen && 'hidden'}`}>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-blue-600">
           {user && (
            <div className={`mb-2 ${!drawerOpen && 'hidden'}`}>
              <p className="text-sm font-medium">{user.name}</p>
              <p className="text-xs text-blue-200">{user.role}</p>
            </div>
           )}
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center px-3 py-2.5 text-sm rounded-md bg-red-500 hover:bg-red-600 transition-colors"
            title="Logout"
          >
            <span className="material-icons mr-0 md:mr-3">{drawerOpen ? 'logout' : 'logout'}</span>
            <span className={`${!drawerOpen && 'hidden'}`}>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* App Bar (Header) */}
        <header className="bg-white shadow-md h-16 flex items-center justify-between px-6">
          <div>
            {/* Breadcrumbs or current page title could go here */}
            <h1 className="text-xl font-semibold text-gray-700">Bankruptcy Management</h1>
          </div>
          <div>
            {/* User menu, notifications, etc. */}
            {user && <span className="text-gray-600">Welcome, {user.name}</span>}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-200 p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;