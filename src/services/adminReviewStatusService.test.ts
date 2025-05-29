import { describe, it, expect, beforeEach } from 'vitest';
import {
  getReviewStatuses,
  createReviewStatus,
  updateReviewStatus,
  deleteReviewStatus,
  resetStateForTests, // Import the reset function
  type ReviewStatus,
} from './adminReviewStatusService';

// Initial state snapshot
const INITIAL_STATUSES_COUNT = 5;

describe('adminReviewStatusService', () => {
  beforeEach(() => {
    resetStateForTests(); // Reset state before each test
  });

  describe('getReviewStatuses', () => {
    it('should return initial review statuses', async () => {
      const statuses = await getReviewStatuses();
      expect(statuses).toBeInstanceOf(Array);
      expect(statuses.length).toBe(INITIAL_STATUSES_COUNT);
      expect(statuses[0].label).toBe('待审核');
    });
  });

  describe('createReviewStatus', () => {
    it('should create a new review status and assign an ID', async () => {
      const newStatusData = {
        label: '测试状态',
        description: '这是一个测试状态的描述。',
      };
      const createdStatus = await createReviewStatus(newStatusData);
      expect(createdStatus).toHaveProperty('id');
      expect(createdStatus.label).toBe(newStatusData.label);
      expect(createdStatus.description).toBe(newStatusData.description);

      const statuses = await getReviewStatuses();
      expect(statuses.length).toBe(INITIAL_STATUSES_COUNT + 1);
      const foundStatus = statuses.find(s => s.id === createdStatus.id);
      expect(foundStatus).toEqual(createdStatus);
    });

    it('should reject if status label is missing', async () => {
      const newStatusData = {
        label: '', // Empty label
        description: '测试描述',
      };
      await expect(createReviewStatus(newStatusData)).rejects.toThrow('Review status label is required.');
    });

    it('should reject if status label already exists', async () => {
      const existingStatus = (await getReviewStatuses())[0];
      const newStatusData = {
        label: existingStatus.label, // Duplicate label
        description: '测试描述',
      };
      await expect(createReviewStatus(newStatusData)).rejects.toThrow(`Review status with label "${existingStatus.label}" already exists.`);
    });
  });

  describe('updateReviewStatus', () => {
    it('should update an existing review status', async () => {
      const statusesBefore = await getReviewStatuses();
      const statusToUpdateId = statusesBefore[1].id; // '审核通过'
      
      const updateData = {
        label: '完全审核通过',
        description: '更新后的描述，表示已完全通过。',
      };

      const updatedStatus = await updateReviewStatus(statusToUpdateId, updateData);
      expect(updatedStatus.label).toBe(updateData.label);
      expect(updatedStatus.description).toBe(updateData.description);

      const statusAfterUpdate = (await getReviewStatuses()).find(s => s.id === statusToUpdateId);
      expect(statusAfterUpdate).toBeDefined();
      expect(statusAfterUpdate?.label).toBe(updateData.label);
    });

    it('should reject if status to update is not found', async () => {
      await expect(updateReviewStatus('non-existent-id', { label: 'test' })).rejects.toThrow('Review status not found.');
    });
    
    it('should reject if updated label already exists for another status', async () => {
      const statuses = await getReviewStatuses();
      const statusToUpdateId = statuses[0].id; // '待审核'
      const existingLabelForOther = statuses[1].label; // '审核通过'

      await expect(updateReviewStatus(statusToUpdateId, { label: existingLabelForOther })).rejects.toThrow(`Review status with label "${existingLabelForOther}" already exists.`);
    });
  });

  describe('deleteReviewStatus', () => {
    it('should delete an existing review status', async () => {
      const statusesBefore = await getReviewStatuses();
      const statusToDeleteId = statusesBefore[0].id;

      await deleteReviewStatus(statusToDeleteId);

      const statusesAfter = await getReviewStatuses();
      expect(statusesAfter.length).toBe(INITIAL_STATUSES_COUNT - 1);
      const foundStatus = statusesAfter.find(s => s.id === statusToDeleteId);
      expect(foundStatus).toBeUndefined();
    });

    it('should reject if status to delete is not found', async () => {
      await expect(deleteReviewStatus('non-existent-id')).rejects.toThrow('Review status not found for deletion.');
    });
  });
});
