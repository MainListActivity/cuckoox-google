import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import Surreal from 'surrealdb.js';
import {
  getNotificationRules,
  createNotificationRule,
  updateNotificationRule,
  deleteNotificationRule,
  type NotificationRule,
  type NotificationRuleInput,
  type NotificationRuleTimingCondition,
} from './adminNotificationRuleService';

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

// Helper to create mock DB rule records
const createDbRuleRecord = (id: string, data: Partial<NotificationRuleInput>): NotificationRule => ({
  id: `notification_rule:${id}`,
  name: data.name || 'Test Rule',
  description: data.description,
  caseStatusTrigger: data.caseStatusTrigger || '立案',
  timingCondition: data.timingCondition || { triggerType: 'on_status_change' },
  frequencyDescription: data.frequencyDescription || 'Once',
  messageTemplate: data.messageTemplate || 'Message',
  isEnabled: data.isEnabled === undefined ? true : data.isEnabled,
  // created_at, updated_at would be set by DB
});


describe('adminNotificationRuleService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Default mock implementations
    mockDbInstance.select.mockResolvedValue([]);
    mockDbInstance.create.mockResolvedValue([]);
    mockDbInstance.merge.mockResolvedValue([]);
    mockDbInstance.delete.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getNotificationRules', () => {
    it('should return notification rules from DB, ordered by created_at DESC', async () => {
      const mockDbRules = [
        createDbRuleRecord('r1', { name: 'Rule 1', caseStatusTrigger: '立案' }),
        createDbRuleRecord('r2', { name: 'Rule 2', caseStatusTrigger: '公告' }),
      ];
      mockDbInstance.select.mockResolvedValueOnce(mockDbRules);

      const rules = await getNotificationRules();

      expect(mockDbInstance.select).toHaveBeenCalledWith('notification_rule', undefined, { order: ['created_at DESC'] });
      expect(rules.length).toBe(2);
      expect(rules).toEqual(mockDbRules); // Assuming NotificationRule type matches DB structure
    });
  });

  describe('createNotificationRule', () => {
    it('should create a new notification rule and return it', async () => {
      const newRuleData: NotificationRuleInput = {
        name: 'New Test Rule',
        caseStatusTrigger: '债权申报',
        timingCondition: { triggerType: 'daily_check_offset_from_date', caseDateField: '受理时间', offsetDays: 5 },
        frequencyDescription: 'Daily',
        messageTemplate: 'Hello {caseName}',
        isEnabled: true,
      };
      const createdDbRecord = createDbRuleRecord('newR1', newRuleData);
      mockDbInstance.create.mockResolvedValueOnce([createdDbRecord]);

      const rule = await createNotificationRule(newRuleData);

      expect(mockDbInstance.create).toHaveBeenCalledWith('notification_rule', newRuleData);
      expect(rule).toEqual(createdDbRecord);
    });

    it('should throw error if rule name is missing', async () => {
      const newRuleData = { name: '', caseStatusTrigger: '立案' } as NotificationRuleInput; // Cast to bypass stricter checks for test
      await expect(createNotificationRule(newRuleData)).rejects.toThrow('Notification rule name is required.');
    });
    
    it('should throw error if DB create fails', async () => {
      mockDbInstance.create.mockRejectedValueOnce(new Error('DB create error'));
      const newRuleData: NotificationRuleInput = {
        name: 'Fail Rule',
        caseStatusTrigger: '立案',
        timingCondition: { triggerType: 'on_status_change' },
        frequencyDescription: 'Once',
        messageTemplate: 'Msg',
        isEnabled: true,
      };
      await expect(createNotificationRule(newRuleData)).rejects.toThrow('Failed to create notification rule.');
    });
  });

  describe('updateNotificationRule', () => {
    const ruleId = 'notification_rule:upd1';
    it('should update an existing notification rule using merge', async () => {
      const updatePayload: Partial<NotificationRuleInput> = {
        name: 'Updated Rule Name',
        isEnabled: false,
        timingCondition: { triggerType: 'on_status_change' },
      };
      const mergedDbRecord = createDbRuleRecord('upd1', {
        name: 'Updated Rule Name',
        isEnabled: false,
        timingCondition: { triggerType: 'on_status_change' },
      });
      mockDbInstance.merge.mockResolvedValueOnce([mergedDbRecord]);

      const rule = await updateNotificationRule(ruleId, updatePayload);

      expect(mockDbInstance.merge).toHaveBeenCalledWith(ruleId, updatePayload);
      expect(rule).toEqual(mergedDbRecord);
    });

    it('should throw "Notification rule not found" if merge target does not exist', async () => {
      mockDbInstance.merge.mockResolvedValueOnce([]); // Simulate record not found by merge
      mockDbInstance.select.mockResolvedValueOnce([]); // Simulate record not found by select check
      await expect(updateNotificationRule('notification_rule:ghost', { name: 'Ghost' })).rejects.toThrow('Notification rule not found.');
    });
    
    it('should return existing record if merge results in no change/empty array but record exists', async () => {
      const existingRecord = createDbRuleRecord('upd1', { name: 'Existing Name'});
      mockDbInstance.merge.mockResolvedValueOnce([]); // Simulate merge returns empty (e.g. no change)
      mockDbInstance.select.mockResolvedValueOnce([existingRecord]); // Record exists

      const rule = await updateNotificationRule(ruleId, { name: 'Existing Name' });
      expect(rule).toEqual(existingRecord);
    });
  });

  describe('deleteNotificationRule', () => {
    const ruleId = 'notification_rule:del1';
    it('should delete an existing notification rule', async () => {
      const deletedRecord = createDbRuleRecord('del1', { name: 'Deleted Rule' });
      mockDbInstance.delete.mockResolvedValueOnce([deletedRecord]); // Simulate successful deletion

      await deleteNotificationRule(ruleId);
      expect(mockDbInstance.delete).toHaveBeenCalledWith(ruleId);
    });

    it('should not throw if rule to delete is not found (idempotent)', async () => {
      mockDbInstance.delete.mockResolvedValueOnce([]); // Simulate record not found
      await expect(deleteNotificationRule(ruleId)).resolves.toBeUndefined();
      expect(mockDbInstance.delete).toHaveBeenCalledWith(ruleId);
    });

    it('should throw error if DB call fails for deleteNotificationRule', async () => {
      mockDbInstance.delete.mockRejectedValueOnce(new Error('DB error'));
      await expect(deleteNotificationRule(ruleId)).rejects.toThrow(`Failed to delete notification rule ${ruleId}.`);
    });
  });
});
