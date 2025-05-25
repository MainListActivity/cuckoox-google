import React from 'react';

const AdminPage: React.FC = () => {
  // TODO: Implement admin functionalities:
  // - User management
  // - Role management (defining roles and their menu/action permissions)
  // - System configuration (e.g., SurrealDB connection if exposed, OIDC settings)
  // - Audit status management (for claim reviews)
  // - Case stage notification rule configuration
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-gray-800 mb-6">系统管理</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow">
          <h2 className="text-xl font-semibold text-blue-700 mb-3">用户管理</h2>
          <p className="text-gray-600 text-sm mb-4">管理系统用户账户、分配全局角色。</p>
          <button className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors">
            管理用户
          </button>
        </div>

        <div className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow">
          <h2 className="text-xl font-semibold text-green-700 mb-3">身份与权限管理</h2>
          <p className="text-gray-600 text-sm mb-4">定义用户身份（角色）及其可操作的菜单和功能权限。</p>
          <button className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors">
            管理身份权限
          </button>
        </div>

        <div className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow">
          <h2 className="text-xl font-semibold text-yellow-700 mb-3">审核状态维护</h2>
          <p className="text-gray-600 text-sm mb-4">配置债权审核时可选的审核状态列表。</p>
          <button className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 transition-colors">
            维护审核状态
          </button>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow">
          <h2 className="text-xl font-semibold text-purple-700 mb-3">案件通知规则</h2>
          <p className="text-gray-600 text-sm mb-4">配置案件机器人基于案件阶段发送通知的规则和模板。</p>
          <button className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 transition-colors">
            配置通知规则
          </button>
        </div>

        <div className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow">
          <h2 className="text-xl font-semibold text-red-700 mb-3">系统配置</h2>
          <p className="text-gray-600 text-sm mb-4">管理系统级参数，如数据库连接（概念性）、OIDC客户端设置等。</p>
          <button className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors">
            系统配置
          </button>
        </div>
      </div>
      <p className="mt-8 text-sm text-gray-500">
        系统管理页面，仅限管理员访问。用于配置和维护应用的核心参数和元数据。
      </p>
    </div>
  );
};

export default AdminPage;