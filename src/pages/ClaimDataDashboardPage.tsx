import React from 'react';
// You would typically use a charting library like Chart.js, Recharts, Nivo, etc.
// import { Bar } from 'react-chartjs-2'; (Example)

const ClaimDataDashboardPage: React.FC = () => {
  // TODO: Fetch real-time data from SurrealDB for the selected case
  // TODO: Implement actual charts and visualizations

  // Mock data for placeholders
  const mockData = {
    usersLoggedIn: { admin: 2, manager: 5, creditor_user: 50 },
    claimsSubmitted: 120,
    claimsApproved: 80,
    claimsRejected: 15,
    claimsPending: 25,
    totalClaimAmount: 15000000,
    approvedClaimAmount: 9500000,
    pendingClaimAmount: 3000000,
    creditorCount: 95,
  };

  return (
    <div className="p-6 bg-gray-900 text-white min-h-full"> {/* Techy background */}
      <h1 className="text-3xl font-bold mb-8 text-center text-blue-400 tracking-wider">债权申报数据大屏</h1>
      <p className="text-center text-gray-400 mb-10">实时监控案件ID: [Selected Case ID] 的债权申报与审核动态</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Example Stat Cards - these would be styled much more impressively */}
        <div className="bg-gray-800 p-6 rounded-lg shadow-xl border border-blue-500 transform hover:scale-105 transition-transform">
          <h2 className="text-lg font-semibold text-blue-300 mb-2">当前申请总笔数</h2>
          <p className="text-4xl font-bold text-cyan-400">{mockData.claimsSubmitted}</p>
        </div>
        <div className="bg-gray-800 p-6 rounded-lg shadow-xl border border-green-500 transform hover:scale-105 transition-transform">
          <h2 className="text-lg font-semibold text-green-300 mb-2">当前已审批总笔数</h2>
          <p className="text-4xl font-bold text-green-400">{mockData.claimsApproved}</p>
        </div>
        <div className="bg-gray-800 p-6 rounded-lg shadow-xl border border-yellow-500 transform hover:scale-105 transition-transform">
          <h2 className="text-lg font-semibold text-yellow-300 mb-2">当前待审总笔数</h2>
          <p className="text-4xl font-bold text-yellow-400">{mockData.claimsPending}</p>
        </div>
        <div className="bg-gray-800 p-6 rounded-lg shadow-xl border border-purple-500 transform hover:scale-105 transition-transform">
          <h2 className="text-lg font-semibold text-purple-300 mb-2">当前申请债权人数量</h2>
          <p className="text-4xl font-bold text-purple-400">{mockData.creditorCount}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-gray-800 p-6 rounded-lg shadow-xl">
          <h2 className="text-xl font-semibold text-blue-300 mb-3">当前申请总金额</h2>
          <p className="text-3xl font-bold text-cyan-400">{mockData.totalClaimAmount.toLocaleString()} 元</p>
        </div>
        <div className="bg-gray-800 p-6 rounded-lg shadow-xl">
          <h2 className="text-xl font-semibold text-green-300 mb-3">当前已审批总金额</h2>
          <p className="text-3xl font-bold text-green-400">{mockData.approvedClaimAmount.toLocaleString()} 元</p>
        </div>
         <div className="bg-gray-800 p-6 rounded-lg shadow-xl">
          <h2 className="text-xl font-semibold text-yellow-300 mb-3">当前待审总金额</h2>
          <p className="text-3xl font-bold text-yellow-400">{mockData.pendingClaimAmount.toLocaleString()} 元</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-800 p-6 rounded-lg shadow-xl min-h-[300px]">
          <h2 className="text-xl font-semibold text-teal-300 mb-4">债权状态分布 (Placeholder Chart)</h2>
          {/* Placeholder for a pie or bar chart */}
          <div className="flex items-center justify-center h-full text-gray-500">
            Chart: Approved vs. Pending vs. Rejected Claims
          </div>
        </div>
        <div className="bg-gray-800 p-6 rounded-lg shadow-xl min-h-[300px]">
          <h2 className="text-xl font-semibold text-indigo-300 mb-4">用户活动 (Placeholder Chart)</h2>
           {/* Placeholder for a bar chart */}
          <div className="flex items-center justify-center h-full text-gray-500">
            Chart: Logged-in users by role (Admin, Manager, Creditor)
          </div>
        </div>
      </div>
      
      <p className="mt-10 text-center text-sm text-gray-500">
        此数据大屏将关联到具体案件，通过SurrealDB实时消息监控债权申报和审核变化。
        需要使用图表库（如Chart.js, Recharts, ECharts）来实现大气、美观、科技感十足的可视化效果。
        当前为样式和布局占位。
      </p>
    </div>
  );
};

export default ClaimDataDashboardPage;