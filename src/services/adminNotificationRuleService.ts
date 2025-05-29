// --- Type Definitions ---
export interface NotificationRuleTimingCondition {
  caseDateField?: string; // Example: '受理时间', '公告时间', '债权申报截止时间'
  offsetDays?: number; // Example: '+25', '-5', '+30', '+90' (days)
  comparisonOperator?: '<=' | '>=' | '=='; // Example: '<=', '>=', '==' (comparison for 'days_remaining_is')
  comparisonValue?: number; // Value for comparison, e.g., 5 (for 'days_remaining_is <= 5')
  triggerType: 'on_status_change' | 'daily_check_offset_from_date'; // Specific type of trigger
}

export interface NotificationRule {
  id: string;
  name: string; // For admin identification
  description?: string;
  caseStatusTrigger: string; // e.g., '立案', '公告', '债权申报'
  timingCondition: NotificationRuleTimingCondition;
  frequencyDescription: string; // e.g., "每天上午10点" or "Once when condition met"
  messageTemplate: string; // e.g., "距离最迟公告时间仅有 {x} 天"
  isEnabled: boolean;
}

// For creation, id is optional. For updates, all fields in NotificationRuleInput are partial.
export type NotificationRuleInput = Omit<NotificationRule, 'id'>;
export type PartialNotificationRuleInput = Partial<NotificationRuleInput>;


// --- Mock Data ---
const initialMockNotificationRules: NotificationRule[] = [
  {
    id: 'rule-1',
    name: '受理后25日未公告提醒',
    description: '案件受理后，若25日内未发布公告，则提醒承办人。',
    caseStatusTrigger: '立案', // Assuming '立案' is the status when '受理时间' is set
    timingCondition: {
      caseDateField: '受理时间',
      offsetDays: 25,
      triggerType: 'daily_check_offset_from_date', // This implies a check runs daily, and triggers if condition (25 days passed since 受理时间 AND not公告) met
    },
    frequencyDescription: '每日检查', // The check happens daily, notification if condition met
    messageTemplate: '案件 {caseName} 已受理 {daysSince受理} 天，请及时完成公告。',
    isEnabled: true,
  },
  {
    id: 'rule-2',
    name: '公告后5日未导入债权人清单提醒',
    description: '案件公告后，若5日内未导入债权人清单，则提醒承办人。',
    caseStatusTrigger: '公告', // Assuming '公告' is the status when '公告时间' is set
    timingCondition: {
      caseDateField: '公告时间',
      offsetDays: 5,
      triggerType: 'daily_check_offset_from_date',
    },
    frequencyDescription: '每日检查',
    messageTemplate: '案件 {caseName} 已公告 {daysSince公告} 天，请及时导入债权人清单。',
    isEnabled: true,
  },
  {
    id: 'rule-3',
    name: '债权申报截止前30日提醒',
    description: '在债权申报截止时间前的第30天提醒承办人。',
    caseStatusTrigger: '债权申报', // This rule is relevant during '债权申报' stage
    timingCondition: {
      caseDateField: '债权申报截止时间',
      offsetDays: -30, // Negative offset means "before"
      triggerType: 'daily_check_offset_from_date',
    },
    frequencyDescription: '特定日期检查 (截止前30天)',
    messageTemplate: '案件 {caseName} 距离债权申报截止日期还有 {daysRemaining} 天。',
    isEnabled: true,
  },
   {
    id: 'rule-4',
    name: '债权申报截止前90日提醒',
    description: '在债权申报截止时间前的第90天提醒承办人。',
    caseStatusTrigger: '债权申报',
    timingCondition: {
      caseDateField: '债权申报截止时间',
      offsetDays: -90,
      triggerType: 'daily_check_offset_from_date',
    },
    frequencyDescription: '特定日期检查 (截止前90天)',
    messageTemplate: '案件 {caseName} 距离债权申报截止日期还有 {daysRemaining} 天。',
    isEnabled: false,
  },
  {
    id: 'rule-5',
    name: '立案即可启动债权申报提醒',
    description: '案件状态变更为“立案”后，提醒管理人可以启动债权申报流程。',
    caseStatusTrigger: '立案',
    timingCondition: {
        triggerType: 'on_status_change', // Trigger immediately when status becomes '立案'
    },
    frequencyDescription: '状态变更时一次性',
    messageTemplate: '案件 {caseName} 已立案，请及时评估是否启动债权申报流程。',
    isEnabled: true,
  }
];

let mockNotificationRules: NotificationRule[] = JSON.parse(JSON.stringify(initialMockNotificationRules));

const SIMULATED_DELAY = 0; // Use 0 for tests

// --- Test Utilities ---
/**
 * Resets the mock data to its initial state.
 * IMPORTANT: This function should only be used in test environments.
 */
export const resetStateForTests = () => {
  mockNotificationRules = JSON.parse(JSON.stringify(initialMockNotificationRules));
  console.log('adminNotificationRuleService state has been reset for tests.');
};

// --- Service Functions ---

export const getNotificationRules = (): Promise<NotificationRule[]> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(JSON.parse(JSON.stringify(mockNotificationRules))); // Deep copy
    }, SIMULATED_DELAY);
  });
};

export const createNotificationRule = (
  ruleData: NotificationRuleInput
): Promise<NotificationRule> => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (!ruleData.name) {
        reject(new Error("Notification rule name is required."));
        return;
      }
      if (mockNotificationRules.some(r => r.name === ruleData.name)) {
         // Allowing duplicate names for now, but in a real system, this might be a constraint
        // reject(new Error(`Notification rule with name "${ruleData.name}" already exists.`));
        // return;
      }
      const newRule: NotificationRule = {
        ...ruleData,
        id: `rule-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      };
      mockNotificationRules.push(newRule);
      resolve(JSON.parse(JSON.stringify(newRule)));
    }, SIMULATED_DELAY);
  });
};

export const updateNotificationRule = (
  ruleId: string,
  ruleData: PartialNotificationRuleInput
): Promise<NotificationRule> => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const ruleIndex = mockNotificationRules.findIndex(r => r.id === ruleId);
      if (ruleIndex === -1) {
        reject(new Error("Notification rule not found."));
        return;
      }
      // if (ruleData.name && mockNotificationRules.some(r => r.name === ruleData.name && r.id !== ruleId)) {
      //   reject(new Error(`Notification rule with name "${ruleData.name}" already exists.`));
      //   return;
      // }
      const existingRule = mockNotificationRules[ruleIndex];
      const updatedRule = { ...existingRule, ...ruleData };
      mockNotificationRules[ruleIndex] = updatedRule;
      resolve(JSON.parse(JSON.stringify(updatedRule)));
    }, SIMULATED_DELAY);
  });
};

export const deleteNotificationRule = (ruleId: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const initialLength = mockNotificationRules.length;
      mockNotificationRules = mockNotificationRules.filter(r => r.id !== ruleId);
      if (mockNotificationRules.length === initialLength) {
        reject(new Error("Notification rule not found for deletion."));
        return;
      }
      resolve();
    }, SIMULATED_DELAY);
  });
};
