export interface ReviewStatus {
  id: string;
  label: string;
  description: string;
}

// --- Mock Data ---
const initialMockReviewStatuses: ReviewStatus[] = [
  { id: 'status-1', label: '待审核', description: '债权申报已提交，等待管理人审核。' },
  { id: 'status-2', label: '审核通过', description: '债权申报材料符合要求，已通过审核。' },
  { id: 'status-3', label: '审核驳回', description: '债权申报材料不符合要求或信息有误，已驳回。' },
  { id: 'status-4', label: '补充材料', description: '需要债权人补充额外材料以便进一步审核。' },
  { id: 'status-5', label: '已确认', description: '债权金额和性质已最终确认，无异议。' },
];

let mockReviewStatuses: ReviewStatus[] = JSON.parse(JSON.stringify(initialMockReviewStatuses));

const SIMULATED_DELAY = 0; // Use 0 for tests

// --- Test Utilities ---
/**
 * Resets the mock data to its initial state.
 * IMPORTANT: This function should only be used in test environments.
 */
export const resetStateForTests = () => {
  mockReviewStatuses = JSON.parse(JSON.stringify(initialMockReviewStatuses));
  console.log('adminReviewStatusService state has been reset for tests.');
};

// --- Service Functions ---

export const getReviewStatuses = (): Promise<ReviewStatus[]> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(JSON.parse(JSON.stringify(mockReviewStatuses))); // Deep copy
    }, SIMULATED_DELAY);
  });
};

export const createReviewStatus = (
  statusData: Omit<ReviewStatus, 'id'>
): Promise<ReviewStatus> => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (!statusData.label) {
        reject(new Error("Review status label is required."));
        return;
      }
      if (mockReviewStatuses.some(s => s.label === statusData.label)) {
        reject(new Error(`Review status with label "${statusData.label}" already exists.`));
        return;
      }
      const newStatus: ReviewStatus = {
        ...statusData,
        id: `status-${Date.now()}`,
      };
      mockReviewStatuses.push(newStatus);
      resolve(JSON.parse(JSON.stringify(newStatus)));
    }, SIMULATED_DELAY);
  });
};

export const updateReviewStatus = (
  statusId: string,
  statusData: Partial<Omit<ReviewStatus, 'id'>>
): Promise<ReviewStatus> => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const statusIndex = mockReviewStatuses.findIndex(s => s.id === statusId);
      if (statusIndex === -1) {
        reject(new Error("Review status not found."));
        return;
      }
      if (statusData.label && mockReviewStatuses.some(s => s.label === statusData.label && s.id !== statusId)) {
        reject(new Error(`Review status with label "${statusData.label}" already exists.`));
        return;
      }
      const existingStatus = mockReviewStatuses[statusIndex];
      const updatedStatus = { ...existingStatus, ...statusData };
      mockReviewStatuses[statusIndex] = updatedStatus;
      resolve(JSON.parse(JSON.stringify(updatedStatus)));
    }, SIMULATED_DELAY);
  });
};

export const deleteReviewStatus = (statusId: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const initialLength = mockReviewStatuses.length;
      mockReviewStatuses = mockReviewStatuses.filter(s => s.id !== statusId);
      if (mockReviewStatuses.length === initialLength) {
        reject(new Error("Review status not found for deletion."));
        return;
      }
      resolve();
    }, SIMULATED_DELAY);
  });
};
