export interface ClaimType {
  label: string;
  value: number;
  amount: number;
}

export interface ReviewStatus {
  name: string;
  value: number;
  color: string;
}

export interface Activity {
  id: number;
  type: string;
  creditor: string;
  amount: number;
  time: string;
}

export interface MockData {
  summary: {
    totalClaimAmount: number;
    approvedAmount: number;
    pendingAmount: number;
    totalClaims: number;
    approvedClaims: number;
    pendingClaims: number;
    totalCreditors: number;
  };
  trends: Array<{ date: string; claims: number; amount: number }>;
  claimTypes: ClaimType[];
  reviewStatus: ReviewStatus[];
  recentActivities: Activity[];
  onlineUsers: {
    administrators: number;
    creditors: number;
  };
}

export const mockData: MockData = {
  summary: {
    totalClaimAmount: 125680000,
    approvedAmount: 98560000,
    pendingAmount: 27120000,
    totalClaims: 156,
    approvedClaims: 98,
    pendingClaims: 58,
    totalCreditors: 89,
  },
  trends: [
    { date: '2024-01', claims: 12, amount: 8500000 },
    { date: '2024-02', claims: 25, amount: 15600000 },
    { date: '2024-03', claims: 45, amount: 32400000 },
    { date: '2024-04', claims: 68, amount: 48900000 },
    { date: '2024-05', claims: 92, amount: 68700000 },
    { date: '2024-06', claims: 115, amount: 89200000 },
    { date: '2024-07', claims: 138, amount: 108500000 },
    { date: '2024-08', claims: 156, amount: 125680000 },
  ],
  claimTypes: [
    { label: '普通债权', value: 45, amount: 56700000 },
    { label: '有财产担保债权', value: 25, amount: 38900000 },
    { label: '劳动报酬', value: 20, amount: 15600000 },
    { label: '税款债权', value: 10, amount: 14480000 },
  ],
  reviewStatus: [
    { name: '审核通过', value: 98, color: '#4caf50' },
    { name: '部分通过', value: 12, color: '#ff9800' },
    { name: '待审核', value: 38, color: '#2196f3' },
    { name: '已驳回', value: 8, color: '#f44336' },
  ],
  recentActivities: [
    { id: 1, type: 'submit', creditor: '张三', amount: 1250000, time: '10分钟前' },
    { id: 2, type: 'approve', creditor: '李四', amount: 890000, time: '25分钟前' },
    { id: 3, type: 'reject', creditor: '王五', amount: 560000, time: '1小时前' },
    { id: 4, type: 'submit', creditor: '赵六', amount: 2340000, time: '2小时前' },
    { id: 5, type: 'approve', creditor: '钱七', amount: 1780000, time: '3小时前' },
  ],
  onlineUsers: {
    administrators: 5,
    creditors: 23,
  },
}; 