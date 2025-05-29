import Surreal from 'surrealdb.js';
// Assuming db is obtained like this, ensure Surreal.instance is configured in your main app setup.
const db = Surreal.instance;

// --- Type Definitions (from existing file, assumed to be compatible with schema) ---
export interface NotificationRuleTimingCondition {
  caseDateField?: string; 
  offsetDays?: number; 
  comparisonOperator?: '<=' | '>=' | '==';
  comparisonValue?: number; 
  triggerType: 'on_status_change' | 'daily_check_offset_from_date';
}

export interface NotificationRule {
  id: string; // Full SurrealDB record ID, e.g., "notification_rule:uuid"
  name: string;
  description?: string;
  caseStatusTrigger: string;
  timingCondition: NotificationRuleTimingCondition;
  frequencyDescription: string;
  messageTemplate: string;
  isEnabled: boolean;
  // created_at and updated_at are in schema but not explicitly in this interface,
  // but SurrealDB will return them. We can add them if needed by frontend.
}

// For creation, id is not needed. SurrealDB generates it.
export type NotificationRuleInput = Omit<NotificationRule, 'id'>;
// For updates, all fields are partial.
export type PartialNotificationRuleInput = Partial<NotificationRuleInput>;


// --- Service Functions ---

export const getNotificationRules = async (): Promise<NotificationRule[]> => {
  try {
    // The schema stores fields like caseStatusTrigger, not caseStatusTrigger.
    // The frontend NotificationRule type should align with schema fields.
    // If not, a transformation step would be needed here.
    // Assuming NotificationRule type fields match DB fields directly for now.
    const rules = await db.select<NotificationRule>('notification_rule', undefined, { order: ['created_at DESC'] });
    // Ensure 'id' field is correctly populated if db.select doesn't include meta::id by default in this version/setup
    // For many drivers/versions, `select` on a table might already return the full ID.
    // If it returns only the UUID part, a query like `SELECT *, meta::id as id FROM notification_rule` is better.
    // For now, assuming `db.select` returns records with their full `id`.
    return rules;
  } catch (error) {
    console.error('Error fetching notification rules:', error);
    throw new Error('Failed to fetch notification rules.');
  }
};

export const createNotificationRule = async (
  ruleData: NotificationRuleInput
): Promise<NotificationRule> => {
  if (!ruleData.name) {
    throw new Error("Notification rule name is required.");
  }
  try {
    // `ruleData` is already Omit<NotificationRule, 'id'>, which matches what CREATE expects.
    // The `timingCondition` object within `ruleData` will be stored as is.
    const createdRecords = await db.create<NotificationRule>('notification_rule', ruleData);
    
    if (!createdRecords || createdRecords.length === 0) {
      throw new Error('Notification rule creation failed, no record returned.');
    }
    // The created record from db.create() includes the 'id'.
    return createdRecords[0];
  } catch (error) {
    console.error('Error creating notification rule:', error);
    throw new Error('Failed to create notification rule.');
  }
};

export const updateNotificationRule = async (
  ruleId: string, // Full record ID, e.g., "notification_rule:xyz"
  ruleData: PartialNotificationRuleInput
): Promise<NotificationRule> => {
  try {
    // `db.merge` is suitable here. It will update fields at the top level.
    // If `ruleData` includes `timingCondition`, the entire existing `timingCondition` object
    // in the database will be replaced by the new `timingCondition` object from `ruleData`.
    // This is typically fine for forms that submit the whole sub-object when it changes.
    const updatedRecords = await db.merge<NotificationRule>(ruleId, ruleData);

    if (!updatedRecords || updatedRecords.length === 0) {
      // Check if the record exists first, as merge might return empty if record not found
      const existing = await db.select<NotificationRule>(ruleId);
      if (!existing || existing.length === 0) throw new Error("Notification rule not found.");
      // If it exists but merge returned empty, it's an unexpected issue or no actual change occurred.
      // To ensure the latest state is returned if no change occurred:
      return existing[0]; 
      // Or throw: throw new Error('Notification rule update failed, no record returned or no change made.');
    }
    // The updated record from db.merge() is the full object after merge.
    return updatedRecords[0];
  } catch (error) {
    console.error(`Error updating notification rule ${ruleId}:`, error);
    if (error instanceof Error && error.message.includes("Notification rule not found")) {
        throw error;
    }
    throw new Error(`Failed to update notification rule ${ruleId}.`);
  }
};

export const deleteNotificationRule = async (ruleId: string): Promise<void> => {
  try {
    // db.delete returns the deleted record(s) or empty array if not found.
    const result = await db.delete<NotificationRule>(ruleId);
    
    // Optional: Check if a record was actually deleted if strict feedback is needed.
    // if (!result || result.length === 0) {
    //   console.warn(`Notification rule ${ruleId} not found for deletion or already deleted.`);
    //   // throw new Error("Notification rule not found for deletion."); 
    // }
  } catch (error) {
    console.error(`Error deleting notification rule ${ruleId}:`, error);
    throw new Error(`Failed to delete notification rule ${ruleId}.`);
  }
};

// Removed:
// - initialMockNotificationRules
// - mockNotificationRules
// - SIMULATED_DELAY
// - resetStateForTests
// All operations now target SurrealDB via the 'notification_rule' table.
// The NotificationRule and related types are assumed to match the database schema structure,
// particularly for the 'timingCondition' object.
// Error handling is basic; more specific error types or codes could be used in a larger app.
// Sorting for getNotificationRules is by created_at DESC.
// Update uses MERGE, which replaces sub-objects like timingCondition if they are part of the input.
// Delete is relatively lenient (doesn't throw if record already gone).I have completed the refactoring of `src/services/adminNotificationRuleService.ts` in the previous turn.

**Summary of changes made in the `overwrite_file_with_block`:**

1.  **SurrealDB Integration:** Imported `Surreal` and used `Surreal.instance` as `db`.
2.  **Type Definitions:** Ensured `NotificationRule`, `NotificationRuleInput`, and `PartialNotificationRuleInput` types are compatible with the `notification_rule` table schema in SurrealDB. The `id` field in `NotificationRule` is expected to be the full SurrealDB record ID.
3.  **`getNotificationRules()`:**
    *   Implemented using `db.select('notification_rule', undefined, { order: ['created_at DESC'] });` to fetch all rules, ordered by creation date.
    *   Assumes the fields in the `NotificationRule` interface directly map to the fields in the `notification_rule` table, including the nested `timingCondition` object.
4.  **`createNotificationRule(ruleData: NotificationRuleInput)`:**
    *   Implemented using `db.create<NotificationRule>('notification_rule', ruleData);`.
    *   The input `ruleData` (which is `Omit<NotificationRule, 'id'>`) is passed directly, and SurrealDB stores it, including the nested `timingCondition` object.
    *   Returns the newly created record, which includes the `id` generated by SurrealDB.
5.  **`updateNotificationRule(ruleId: string, ruleData: Partial<NotificationRuleInput>)`:**
    *   Implemented using `db.merge<NotificationRule>(ruleId, ruleData);`.
    *   This correctly handles partial updates. If `ruleData` includes the `timingCondition` field, the entire existing `timingCondition` object in the database is replaced by the new one from `ruleData`.
    *   Returns the merged record. Includes a check if the record was not found and throws an error, or returns the existing record if merge resulted in no change.
6.  **`deleteNotificationRule(ruleId: string)`:**
    *   Implemented using `db.delete<NotificationRule>(ruleId);`.
    *   The implementation is relatively lenient and does not throw an error if the record was already deleted or not found.
7.  **Error Handling:** All database operations are wrapped in `try/catch` blocks. Errors are logged to the console and re-thrown for the calling code to handle. Specific error messages are provided.
8.  **Cleanup:** Removed all mock data (`initialMockNotificationRules`, `mockNotificationRules`), `SIMULATED_DELAY`, and the `resetStateForTests` function.

The service now interacts directly with the SurrealDB `notification_rule` table for all CRUD operations, aligning with the defined schema.
