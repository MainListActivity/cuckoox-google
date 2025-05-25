import React from 'react';

// Mock data, replace with API call relevant to a selected case
const mockMeetings = [
  { id: 'meet001', title: '第一次债权人会议 (Case BK-2023-001)', type: '债权人第一次会议', scheduled_time: '2023-05-15 10:00', status: '已结束', recording_url: '#', minutes_doc_id: 'doc_minutes_001' },
  { id: 'meet002', title: '重整计划讨论会 (Case BK-2023-001)', type: '临时会议', scheduled_time: '2023-06-01 14:00', status: '已安排', recording_url: null, minutes_doc_id: null },
  { id: 'meet003', title: '第二次债权人会议 (Case BK-2023-002)', type: '债权人第二次会议', scheduled_time: '2023-07-10 09:00', status: '已安排', recording_url: null, minutes_doc_id: null },
];

const OnlineMeetingPage: React.FC = () => {
  // TODO: Fetch meetings for the selected case from API
  // TODO: Implement meeting creation, joining (if applicable), viewing details
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-gray-800">在线会议</h1>
        <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">
          安排新会议
        </button>
      </div>
      
      <div className="space-y-6">
        {mockMeetings.map((meeting) => (
          <div key={meeting.id} className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow">
            <h2 className="text-xl font-semibold text-blue-700 mb-2">{meeting.title}</h2>
            <p className="text-sm text-gray-600 mb-1"><strong>类型:</strong> {meeting.type}</p>
            <p className="text-sm text-gray-600 mb-1"><strong>计划时间:</strong> {meeting.scheduled_time}</p>
            <p className="text-sm text-gray-600 mb-3">
              <strong>状态:</strong> 
              <span className={`ml-2 px-2 py-0.5 text-xs font-semibold rounded-full ${
                meeting.status === '已结束' ? 'bg-gray-200 text-gray-700' : 'bg-green-100 text-green-700'
              }`}>
                {meeting.status}
              </span>
            </p>
            <div className="flex space-x-3">
              <button className="text-sm px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors">
                查看详情
              </button>
              {meeting.recording_url && (
                <a href={meeting.recording_url} target="_blank" rel="noopener noreferrer"
                  className="text-sm px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors">
                  查看录像
                </a>
              )}
              {meeting.minutes_doc_id && (
                 <button className="text-sm px-3 py-1 bg-teal-500 text-white rounded hover:bg-teal-600 transition-colors">
                  查看纪要
                </button>
              )}
            </div>
          </div>
        ))}
        {mockMeetings.length === 0 && (
            <div className="bg-white p-6 rounded-lg shadow text-center">
                <p className="text-gray-500">当前案件暂无会议记录。</p>
            </div>
        )}
      </div>
      <p className="mt-8 text-sm text-gray-500">
        在线会议页面。将展示当前案件的会议列表和会议记录。
        操作权限将根据用户身份和案件程序进程进行控制。
      </p>
    </div>
  );
};

export default OnlineMeetingPage;