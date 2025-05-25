import React from 'react';

// Mock data, replace with API call (potentially WebSocket for real-time)
const mockMessages = [
  { id: 'msg001', type: 'IM', sender: '案件机器人 (BK-2023-001)', content: '距离最迟公告时间仅有3天。', timestamp: '2023-04-20 10:00', is_read: false, case_id: 'case001' },
  { id: 'msg002', type: 'SystemAlert', sender: '系统管理员', content: '服务器将于今晚2点进行维护。', timestamp: '2023-04-19 15:30', is_read: true },
  { id: 'msg003', type: 'IM', sender: '张三 (债权人)', content: '关于我的债权申报，有几个问题想咨询一下...', timestamp: '2023-04-18 09:15', is_read: false, case_id: 'case001' },
];

const MessageCenterPage: React.FC = () => {
  // TODO: Fetch messages from API (IM, system alerts, notifications)
  // TODO: Implement real-time updates via WebSocket/SurrealDB live queries
  // TODO: Implement message sending, conversation views
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-gray-800 mb-6">消息中心</h1>
      
      <div className="bg-white shadow-md rounded-lg">
        {/* Tabs for IM / System Alerts could go here */}
        <div className="p-4 border-b">
            <h2 className="text-lg font-medium text-gray-700">所有消息</h2>
        </div>
        <ul className="divide-y divide-gray-200">
          {mockMessages.map((message) => (
            <li key={message.id} className={`p-4 hover:bg-gray-50 transition-colors ${!message.is_read ? 'bg-blue-50 font-semibold' : ''}`}>
              <div className="flex justify-between items-start">
                <div>
                  <p className={`text-sm ${!message.is_read ? 'text-blue-700' : 'text-gray-800'}`}>
                    {message.sender}
                    {message.type === 'IM' && <span className="ml-2 text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full">IM</span>}
                    {message.type === 'SystemAlert' && <span className="ml-2 text-xs px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded-full">提醒</span>}
                  </p>
                  <p className={`mt-1 text-sm ${!message.is_read ? 'text-gray-700' : 'text-gray-600'}`}>{message.content}</p>
                </div>
                <span className={`text-xs ${!message.is_read ? 'text-blue-600' : 'text-gray-400'}`}>{message.timestamp}</span>
              </div>
              {message.case_id && <p className="mt-1 text-xs text-gray-400">相关案件: {message.case_id}</p>}
            </li>
          ))}
          {mockMessages.length === 0 && (
             <li className="p-6 text-center text-sm text-gray-500">暂无消息</li>
          )}
        </ul>
      </div>
      <p className="mt-6 text-sm text-gray-500">
        消息中心。展示IM聊天消息和系统提醒。
        案件机器人将根据案件状态和预设条件在此发送提醒卡片。
      </p>
    </div>
  );
};

export default MessageCenterPage;