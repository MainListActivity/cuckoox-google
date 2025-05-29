import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import Surreal from 'surrealdb.js';
import {
  getReviewStatuses,
  createReviewStatus,
  updateReviewStatus,
  deleteReviewStatus,
  type ReviewStatus,
} from './adminReviewStatusService';

// Mock SurrealDB instance
const mockDbInstance = {
  select: vi.fn(),
  query: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  merge: vi.fn(),
};

// Spy on the static getter 'instance' of the Surreal class
vi.spyOn(Surreal, 'instance', 'get').mockReturnValue(mockDbInstance);

// Helper to simulate DB records for claim_review_status_definition
const createDbStatusRecord = (id: string, label: string, description: string, is_active = true, display_order = 0) => ({
  id: `claim_review_status_definition:${id}`,
  name: label, // DB uses 'name' for 'label'
  description,
  is_active,
  display_order,
});

describe('adminReviewStatusService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Default mock implementations
    mockDbInstance.query.mockResolvedValue([[]]);
    mockDbInstance.create.mockResolvedValue([]);
    mockDbInstance.merge.mockResolvedValue([]);
    mockDbInstance.delete.mockResolvedValue([]);
    mockDbInstance.select.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getReviewStatuses', () => {
    it('should return review statuses from DB, ordered and transformed', async () => {
      const mockDbData = [
        createDbStatusRecord('s1', '待审核', 'Pending review', true, 1),
        createDbStatusRecord('s2', '审核通过', 'Approved', true, 0),
      ];
      mockDbInstance.query.mockResolvedValueOnce([{ result: [mockDbData[1], mockDbData[0]] }]); // Simulate DB ordering

      const statuses = await getReviewStatuses();

      expect(mockDbInstance.query).toHaveBeenCalledWith(
        "SELECT id, name, description, is_active, display_order FROM claim_review_status_definition ORDER BY display_order ASC, name ASC;"
      );
      expect(statuses.length).toBe(2);
      expect(statuses[0]).toEqual(expect.objectContaining({ id: mockDbData[1].id, label: '审核通过', display_order: 0 }));
      expect(statuses[1]).toEqual(expect.objectContaining({ id: mockDbData[0].id, label: '待审核', display_order: 1 }));
    });
     it('should return empty array if DB query returns no results', async () => {
      mockDbInstance.query.mockResolvedValueOnce([{ result: [] }]);
      const statuses = await getReviewStatuses();
      expect(statuses).toEqual([]);
    });
  });

  describe('createReviewStatus', () => {
    it('should create a new review status, checking for uniqueness and transforming response', async () => {
      const newStatusData = { label: '新状态', description: 'New status desc' };
      const dbRecordId = 'claim_review_status_definition:new1';
      const createdDbRecord = createDbStatusRecord('new1', newStatusData.label, newStatusData.description);
      
      mockDbInstance.query.mockResolvedValueOnce([{ result: [] }]); // For uniqueness check (no existing)
      mockDbInstance.create.mockResolvedValueOnce([createdDbRecord]); // For db.create

      const status = await createReviewStatus(newStatusData);

      expect(mockDbInstance.query).toHaveBeenCalledWith(
        `SELECT id FROM claim_review_status_definition WHERE name = $name;`,
        { name: newStatusData.label }
      );
      expect(mockDbInstance.create).toHaveBeenCalledWith('claim_review_status_definition', {
        name: newStatusData.label,
        description: newStatusData.description,
        is_active: true, // Default
        display_order: 0, // Default
      });
      expect(status).toEqual({
        id: dbRecordId,
        label: newStatusData.label,
        description: newStatusData.description,
        is_active: true,
        display_order: 0,
      });
    });

    it('should throw error if status label is missing', async () => {
      await expect(createReviewStatus({ label: '', description: 'desc' })).rejects.toThrow('Review status label is required.');
    });

    it('should throw error if status label (name) already exists', async () => {
      const newStatusData = { label: '已存在', description: 'desc' };
      mockDbInstance.query.mockResolvedValueOnce([{ result: [{ id: 'claim_review_status_definition:existing1' }] }]); // Uniqueness check fails

      await expect(createReviewStatus(newStatusData)).rejects.toThrow(`Review status with label "${newStatusData.label}" already exists.`);
    });
  });

  describe('updateReviewStatus', () => {
    const statusId = 'claim_review_status_definition:sUpd1';
    it('should update an existing review status and transform response', async () => {
      const updateData = { label: 'Updated Label', description: 'Updated desc', is_active: false };
      const mergedDbRecord = createDbStatusRecord('sUpd1', updateData.label, updateData.description, false, 0);

      mockDbInstance.query.mockResolvedValueOnce([{ result: [] }]); // Uniqueness check (if label changes)
      mockDbInstance.merge.mockResolvedValueOnce([mergedDbRecord]);

      const status = await updateReviewStatus(statusId, updateData);

      expect(mockDbInstance.query).toHaveBeenCalledWith(
        `SELECT id FROM claim_review_status_definition WHERE name = $name AND id != $id;`,
        { name: updateData.label, id: statusId }
      );
      expect(mockDbInstance.merge).toHaveBeenCalledWith(statusId, {
        name: updateData.label,
        description: updateData.description,
        is_active: false,
      });
      expect(status).toEqual({
        id: statusId,
        label: updateData.label,
        description: updateData.description,
        is_active: false,
        display_order: 0, // from createDbStatusRecord mock structure
      });
    });
    
    it('should return current record if update payload is empty', async () => {
      const currentDbRecord = createDbStatusRecord('sUpd1', 'Current Label', 'Current Desc');
      mockDbInstance.select.mockResolvedValueOnce([currentDbRecord]);

      const status = await updateReviewStatus(statusId, {}); // Empty update data

      expect(mockDbInstance.select).toHaveBeenCalledWith(statusId);
      expect(mockDbInstance.merge).not.toHaveBeenCalled();
      expect(status.label).toBe('Current Label');
    });

    it('should throw "Review status not found" if record does not exist for update', async () => {
      mockDbInstance.merge.mockResolvedValueOnce([]); // Simulate record not found by merge
      mockDbInstance.select.mockResolvedValueOnce([]); // Simulate record not found by select check
      await expect(updateReviewStatus('claim_review_status_definition:ghost', { label: 'Ghost' })).rejects.toThrow('Review status not found.');
    });
    
    it('should throw error if updated label (name) conflicts with another status', async () => {
      const updateData = { label: 'Conflicting Label' };
      mockDbInstance.query.mockResolvedValueOnce([{ result: [{ id: 'claim_review_status_definition:otherExisting' }] }]); // Uniqueness check fails
      
      await expect(updateReviewStatus(statusId, updateData)).rejects.toThrow(`Review status with label "${updateData.label}" already exists.`);
    });
  });

  describe('deleteReviewStatus', () => {
    const statusId = 'claim_review_status_definition:sDel1';
    it('should delete an existing review status', async () => {
      const deletedRecord = createDbStatusRecord('sDel1', 'Deleted', 'Will be gone');
      mockDbInstance.delete.mockResolvedValueOnce([deletedRecord]); // Simulate successful deletion

      await deleteReviewStatus(statusId);
      expect(mockDbInstance.delete).toHaveBeenCalledWith(statusId);
    });

    it('should not throw if status to delete is not found (idempotent)', async () => {
      mockDbInstance.delete.mockResolvedValueOnce([]); // Simulate record not found
      
      // Spy on console.warn
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      await expect(deleteReviewStatus(statusId)).resolves.toBeUndefined();
      expect(mockDbInstance.delete).toHaveBeenCalledWith(statusId);
      expect(consoleWarnSpy).toHaveBeenCalledWith(`Review status ${statusId} not found for deletion or already deleted.`);
      
      consoleWarnSpy.mockRestore();
    });

    it('should throw error if DB call fails for deleteReviewStatus', async () => {
      mockDbInstance.delete.mockRejectedValueOnce(new Error('DB error'));
      await expect(deleteReviewStatus(statusId)).rejects.toThrow(`Failed to delete review status ${statusId}.`);
    });
  });
});
