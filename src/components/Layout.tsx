import React, { useState, ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next'; // <-- IMPORT I18N

interface LayoutProps {
  children: ReactNode;
}

// navItems will be defined inside the component to use `t`

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { t } = useTranslation(); // <-- INITIALIZE T
  const [drawerOpen, setDrawerOpen] = useState(true);
  const { user, logout, hasRole } = useAuth();
  const navigate = useNavigate();

  // Define navItems inside the component so it can use `t`
  const navItems = [
    { path: '/dashboard', label: t('nav_dashboard'), icon: 'dashboard' },
    { path: '/cases', label: t('nav_case_management'), icon: 'gavel' },
    { path: '/creditors', label: t('nav_creditor_management'), icon: 'people' },
    { path: '/claims', label: t('nav_claim_management'), icon: 'assignment' },
    { path: '/claim-dashboard', label: t('nav_claim_dashboard'), icon: 'bar_chart' },
    { path: '/online-meetings', label: t('nav_online_meetings'), icon: 'videocam' },
    { path: '/messages', label: t('nav_message_center'), icon: 'chat' },
    { path: '/admin', label: t('nav_system_management'), icon: 'settings', adminOnly: true },
  ];

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
              {/* Removed user.role display as it's no longer globally relevant */}
            </div>
           )}
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center px-3 py-2.5 text-sm rounded-md bg-red-500 hover:bg-red-600 transition-colors"
            title={t('layout_logout_button')}
          >
            <span className="material-icons mr-0 md:mr-3">{drawerOpen ? 'logout' : 'logout'}</span>
            <span className={`${!drawerOpen && 'hidden'}`}>{t('layout_logout_button')}</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* App Bar (Header) */}
        <header className="bg-white shadow-md h-16 flex items-center justify-between px-6">
          <div>
            {/* Breadcrumbs or current page title could go here */}
            <h1 className="text-xl font-semibold text-gray-700">{t('layout_header_title')}</h1>
          </div>
          <div>
            {/* User menu, notifications, etc. */}
            {user && <span className="text-gray-600">{t('layout_header_welcome', { name: user.name })}</span>}
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