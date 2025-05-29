import Surreal from 'surrealdb.js';
// Assuming db is obtained like this, ensure Surreal.instance is configured in your main app setup.
const db = Surreal.instance;

export interface ReviewStatus {
  id: string; // Full SurrealDB record ID, e.g., "claim_review_status_definition:uuid"
  label: string; // Maps to 'name' in the database
  description?: string; // Optional, as in schema
  is_active?: boolean; // Added to reflect schema, optional in frontend type for simplicity
  display_order?: number; // Added to reflect schema, optional in frontend type for simplicity
}

// Type for data coming from the database, matching the schema
interface ClaimReviewStatusDefinitionFromDB {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
  display_order: number;
  // created_at, updated_at could also be here if needed
}

// Helper to transform DB result to frontend ReviewStatus type
const transformToReviewStatus = (dbRecord: ClaimReviewStatusDefinitionFromDB): ReviewStatus => {
  return {
    id: dbRecord.id,
    label: dbRecord.name,
    description: dbRecord.description,
    is_active: dbRecord.is_active,
    display_order: dbRecord.display_order,
  };
};

// --- Service Functions ---

export const getReviewStatuses = async (): Promise<ReviewStatus[]> => {
  try {
    const result = await db.query<[ClaimReviewStatusDefinitionFromDB[]]>(
      "SELECT id, name, description, is_active, display_order FROM claim_review_status_definition ORDER BY display_order ASC, name ASC;"
    );
    if (result && result[0] && result[0].result) {
      // Map 'name' from DB to 'label' for the frontend
      return result[0].result.map(transformToReviewStatus);
    }
    return [];
  } catch (error) {
    console.error('Error fetching review statuses:', error);
    throw new Error('Failed to fetch review statuses.');
  }
};

export const createReviewStatus = async (
  // Frontend provides 'label', we map to 'name' for DB
  statusData: Omit<ReviewStatus, 'id' | 'is_active' | 'display_order'> & { label: string; description?: string; is_active?: boolean; display_order?: number }
): Promise<ReviewStatus> => {
  if (!statusData.label) {
    throw new Error("Review status label is required.");
  }
  try {
    const dataForDb = {
      name: statusData.label,
      description: statusData.description,
      is_active: statusData.is_active === undefined ? true : statusData.is_active, // Default is_active to true
      display_order: statusData.display_order === undefined ? 0 : statusData.display_order, // Default display_order
    };

    // Check for uniqueness of 'name' (label) before creating
    const existingByName = await db.query<[ClaimReviewStatusDefinitionFromDB[]]>(
        `SELECT id FROM claim_review_status_definition WHERE name = $name;`, 
        { name: dataForDb.name }
    );
    if (existingByName && existingByName[0] && existingByName[0].result && existingByName[0].result.length > 0) {
        throw new Error(`Review status with label "${dataForDb.name}" already exists.`);
    }

    const createdRecords = await db.create<ClaimReviewStatusDefinitionFromDB>('claim_review_status_definition', dataForDb);
    
    if (!createdRecords || createdRecords.length === 0) {
      throw new Error('Review status creation failed, no record returned.');
    }
    // The created record from db.create() already includes the 'id'
    return transformToReviewStatus(createdRecords[0]);
  } catch (error) {
    console.error('Error creating review status:', error);
    if (error instanceof Error && error.message.includes("already exists")) {
        throw error;
    }
    throw new Error('Failed to create review status.');
  }
};

export const updateReviewStatus = async (
  statusId: string, // Full record ID, e.g., "claim_review_status_definition:xyz"
  statusData: Partial<Omit<ReviewStatus, 'id'>> // Frontend may send 'label'
): Promise<ReviewStatus> => {
  try {
    // Map 'label' to 'name' for the database if present
    const dataForDb: Partial<Omit<ClaimReviewStatusDefinitionFromDB, 'id'>> = {};
    if (statusData.label !== undefined) dataForDb.name = statusData.label;
    if (statusData.description !== undefined) dataForDb.description = statusData.description;
    if (statusData.is_active !== undefined) dataForDb.is_active = statusData.is_active;
    if (statusData.display_order !== undefined) dataForDb.display_order = statusData.display_order;

    if (Object.keys(dataForDb).length === 0) {
        // If nothing to update, fetch and return current record to avoid empty MERGE
        const currentRecordArray = await db.select<ClaimReviewStatusDefinitionFromDB>(statusId);
        if(!currentRecordArray || currentRecordArray.length === 0) throw new Error("Review status not found.");
        return transformToReviewStatus(currentRecordArray[0]);
    }
    
    // Check for uniqueness of 'name' (label) if it's being changed
    if (dataForDb.name) {
        const existingByName = await db.query<[ClaimReviewStatusDefinitionFromDB[]]>(
            `SELECT id FROM claim_review_status_definition WHERE name = $name AND id != $id;`, 
            { name: dataForDb.name, id: statusId }
        );
        if (existingByName && existingByName[0] && existingByName[0].result && existingByName[0].result.length > 0) {
            throw new Error(`Review status with label "${dataForDb.name}" already exists.`);
        }
    }

    const updatedRecords = await db.merge<ClaimReviewStatusDefinitionFromDB>(statusId, dataForDb);

    if (!updatedRecords || updatedRecords.length === 0) {
      // Check if the record exists first
      const existing = await db.select(statusId);
      if (!existing || existing.length === 0) throw new Error("Review status not found.");
      throw new Error('Review status update failed, no record returned.');
    }
    // The updated record from db.merge() should be the full object
    return transformToReviewStatus(updatedRecords[0]);
  } catch (error) {
    console.error(`Error updating review status ${statusId}:`, error);
     if (error instanceof Error && (error.message.includes("not found") || error.message.includes("already exists"))) {
        throw error;
    }
    throw new Error(`Failed to update review status ${statusId}.`);
  }
};

export const deleteReviewStatus = async (statusId: string): Promise<void> => {
  try {
    // db.delete returns the deleted record(s) or empty if not found.
    const result = await db.delete<ClaimReviewStatusDefinitionFromDB>(statusId);
    if (!result || result.length === 0) {
        // Consider if this should throw an error or be idempotent.
        // For now, throwing if not found, consistent with previous mock.
        console.warn(`Review status ${statusId} not found for deletion or already deleted.`);
        // throw new Error("Review status not found for deletion."); 
        // Making it idempotent for now, as delete is often expected to succeed if record is gone.
    }
  } catch (error) {
    console.error(`Error deleting review status ${statusId}:`, error);
    throw new Error(`Failed to delete review status ${statusId}.`);
  }
};

// Removed:
// - initialMockReviewStatuses
// - mockReviewStatuses
// - SIMULATED_DELAY
// - resetStateForTests
// All operations now target SurrealDB via 'claim_review_status_definition' table.
// The ReviewStatus interface now optionally includes is_active and display_order to better align with the schema
// and allow these to be passed from the frontend if the UI supports managing them.
// Create and Update functions now default these if not provided.
// Uniqueness constraint for 'name' (label) is checked in create and update.I have completed the refactoring of `src/services/adminReviewStatusService.ts` in the previous turn.

**Summary of changes made in the `overwrite_file_with_block`:**

1.  **SurrealDB Integration:** Imported `Surreal` and used `Surreal.instance` as `db`.
2.  **Type Alignment:**
    *   The `ReviewStatus` interface (used by the frontend) was updated to optionally include `is_active` and `display_order` to better align with the `claim_review_status_definition` schema.
    *   A new internal type `ClaimReviewStatusDefinitionFromDB` was introduced to represent data directly from the database.
    *   A `transformToReviewStatus` helper function was created to map database records (`name`, `is_active`, `display_order`) to the frontend `ReviewStatus` type (primarily `label`).
3.  **`getReviewStatuses()`:**
    *   Queries `SELECT id, name, description, is_active, display_order FROM claim_review_status_definition ORDER BY display_order ASC, name ASC;`.
    *   Transforms the results using `transformToReviewStatus`.
4.  **`createReviewStatus()`:**
    *   Maps the input `statusData.label` to `name` for the database.
    *   Defaults `is_active` to `true` and `display_order` to `0` if not provided in `statusData`.
    *   **Uniqueness Check:** Added a query to check if a status with the same `name` (label) already exists before attempting creation, throwing an error if it does.
    *   Uses `db.create('claim_review_status_definition', dbData)` to insert the new record.
    *   Transforms the created record using `transformToReviewStatus` for the return value.
5.  **`updateReviewStatus()`:**
    *   Maps `statusData.label` to `name` if provided in the partial update data. Other fields (`description`, `is_active`, `display_order`) are mapped directly.
    *   **Uniqueness Check:** If `name` (label) is being changed, it queries to ensure the new name doesn't conflict with another existing status, throwing an error if it does.
    *   Uses `db.merge(statusId, dbData)` to update the record.
    *   Transforms the updated record using `transformToReviewStatus`.
6.  **`deleteReviewStatus()`:**
    *   Uses `db.delete(statusId)` to remove the record.
    *   The implementation was made more idempotent (does not throw an error if the record was already deleted or not found, but logs a warning).
7.  **Error Handling:** All database operations are wrapped in `try/catch` blocks, and errors are re-thrown for the calling code to handle. Specific checks for "not found" or "already exists" errors are included.
8.  **Cleanup:** Removed `initialMockReviewStatuses`, `mockReviewStatuses`, `SIMULATED_DELAY`, and `resetStateForTests`.

The service now correctly interacts with the `claim_review_status_definition` table in SurrealDB for all CRUD operations, including handling the mapping between frontend field names (`label`) and database field names (`name`), and managing uniqueness constraints.
