import { describe, it, expect, beforeEach } from 'vitest';
import {
  getNotificationRules,
  createNotificationRule,
  updateNotificationRule,
  deleteNotificationRule,
  resetStateForTests, // Import the reset function
  type NotificationRule,
  type NotificationRuleInput,
  type NotificationRuleTimingCondition,
} from './adminNotificationRuleService';

// Initial state snapshot
const INITIAL_RULES_COUNT = 5;

describe('adminNotificationRuleService', () => {
  beforeEach(() => {
    resetStateForTests(); // Reset state before each test
  });

  describe('getNotificationRules', () => {
    it('should return initial notification rules', async () => {
      const rules = await getNotificationRules();
      expect(rules).toBeInstanceOf(Array);
      expect(rules.length).toBe(INITIAL_RULES_COUNT);
      expect(rules[0].name).toBe('受理后25日未公告提醒');
    });
  });

  describe('createNotificationRule', () => {
    it('should create a new notification rule and assign an ID', async () => {
      const newRuleData: NotificationRuleInput = {
        name: '测试规则',
        description: '这是一个测试规则的描述。',
        caseStatusTrigger: '立案',
        timingCondition: {
          triggerType: 'on_status_change',
        },
        frequencyDescription: '状态变更时一次性',
        messageTemplate: '案件 {caseName} 已触发测试规则。',
        isEnabled: true,
      };
      const createdRule = await createNotificationRule(newRuleData);
      expect(createdRule).toHaveProperty('id');
      expect(createdRule.name).toBe(newRuleData.name);
      expect(createdRule.isEnabled).toBe(true);

      const rules = await getNotificationRules();
      expect(rules.length).toBe(INITIAL_RULES_COUNT + 1);
      const foundRule = rules.find(r => r.id === createdRule.id);
      expect(foundRule).toEqual(createdRule);
    });

    it('should reject if rule name is missing', async () => {
      const newRuleData: NotificationRuleInput = {
        name: '', // Empty name
        caseStatusTrigger: '公告',
        timingCondition: { triggerType: 'on_status_change' },
        frequencyDescription: 'N/A',
        messageTemplate: 'Test',
        isEnabled: true,
      };
      await expect(createNotificationRule(newRuleData)).rejects.toThrow('Notification rule name is required.');
    });
    
    // Note: Duplicate name check is currently commented out in service, so this test would fail if enabled.
    // it('should reject if rule name already exists', async () => {
    //   const existingRule = (await getNotificationRules())[0];
    //   const newRuleData: NotificationRuleInput = {
    //     name: existingRule.name, // Duplicate name
    //     caseStatusTrigger: '公告',
    //     timingCondition: { triggerType: 'on_status_change' },
    //     frequencyDescription: 'N/A',
    //     messageTemplate: 'Test',
    //     isEnabled: true,
    //   };
    //   await expect(createNotificationRule(newRuleData)).rejects.toThrow(`Notification rule with name "${existingRule.name}" already exists.`);
    // });
  });

  describe('updateNotificationRule', () => {
    it('should update an existing notification rule', async () => {
      const rulesBefore = await getNotificationRules();
      const ruleToUpdateId = rulesBefore[1].id; // '公告后5日未导入债权人清单提醒'
      
      const updateData: Partial<NotificationRuleInput> = {
        name: '高级公告后提醒',
        description: '更新后的描述',
        isEnabled: false,
        timingCondition: {
            triggerType: 'daily_check_offset_from_date',
            caseDateField: '公告时间',
            offsetDays: 10
        }
      };

      const updatedRule = await updateNotificationRule(ruleToUpdateId, updateData);
      expect(updatedRule.name).toBe(updateData.name);
      expect(updatedRule.description).toBe(updateData.description);
      expect(updatedRule.isEnabled).toBe(false);
      expect(updatedRule.timingCondition.offsetDays).toBe(10);


      const ruleAfterUpdate = (await getNotificationRules()).find(r => r.id === ruleToUpdateId);
      expect(ruleAfterUpdate).toBeDefined();
      expect(ruleAfterUpdate?.name).toBe(updateData.name);
      expect(ruleAfterUpdate?.isEnabled).toBe(false);
    });

    it('should reject if rule to update is not found', async () => {
      await expect(updateNotificationRule('non-existent-id', { name: 'test' })).rejects.toThrow('Notification rule not found.');
    });
  });

  describe('deleteNotificationRule', () => {
    it('should delete an existing notification rule', async () => {
      const rulesBefore = await getNotificationRules();
      const ruleToDeleteId = rulesBefore[0].id;

      await deleteNotificationRule(ruleToDeleteId);

      const rulesAfter = await getNotificationRules();
      expect(rulesAfter.length).toBe(INITIAL_RULES_COUNT - 1);
      const foundRule = rulesAfter.find(r => r.id === ruleToDeleteId);
      expect(foundRule).toBeUndefined();
    });

    it('should reject if rule to delete is not found', async () => {
      await expect(deleteNotificationRule('non-existent-id')).rejects.toThrow('Notification rule not found for deletion.');
    });
  });
});
