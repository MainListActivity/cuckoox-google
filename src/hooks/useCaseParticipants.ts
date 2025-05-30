import { useState, useEffect, useCallback } from 'react';
import { useSurrealClient } from '@/src/contexts/SurrealProvider';
import { RecordId } from 'surrealdb.js';

export interface Participant {
  id: string | RecordId; // Record link for user or creditor
  name: string;
  type: 'user' | 'creditor';
  group: '系统用户' | '债权人'; // For Autocomplete grouping
}

// Define interfaces for the raw data structure from SurrealDB queries
interface RawUserParticipant {
  id: string | RecordId;
  name: string;
  // type and group are hardcoded in the query or added during processing
}

interface RawCreditorParticipant {
  id: string | RecordId;
  name: string;
  // type and group are hardcoded in the query or added during processing
}

export function useCaseParticipants(caseId: string | null): { participants: Participant[], isLoading: boolean } {
  const { client, isConnected } = useSurrealClient();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const fetchParticipants = useCallback(async (currentCaseId: string) => {
    if (!client || !isConnected) {
      // console.warn('Surreal client not connected, skipping participant fetch.');
      setParticipants([]);
      return;
    }
    setIsLoading(true);
    try {
      const usersQuery = `
        SELECT 
            user.id AS id, 
            user.name AS name 
        FROM user 
        WHERE user.id IN (
            SELECT ->manages_case.in AS user_id FROM case_assignment WHERE out = $case_id
        );
      `;
      // Alternative user query if using a direct link or roles table:
      // SELECT id, name FROM user WHERE directly_assigned_case = $case_id OR role IN ['roleA', 'roleB'];
      // The query above assumes a graph edge `manages_case` from `user` to `case_assignment`
      // and `case_assignment` record has an `out` field pointing to the `case`.
      // A simpler schema might be `SELECT user FROM case WHERE id = $case_id FETCH user` if users are directly linked.
      // Using a placeholder that's more likely to work with generic user/case linking:
      // Assuming 'user_case_access' table links users to cases
      // This is a placeholder and needs to match the actual DB schema.
      const placeholderUsersQuery = `
        SELECT user.id as id, user.name as name 
        FROM user 
        WHERE id IN (SELECT user_id FROM user_case_role_assignments WHERE case_id = $case_id);
      `;
      // For now, let's use a very simple user query that might fetch all users if schema is unknown,
      // or a specific one if the schema is known for `user_case_role_assignments`.
      // To avoid errors on a generic schema, I will mock fetching a few known users or based on roles.
      // For actual implementation, this query MUST be correct.
      // Let's assume a `user_roles` table where users are assigned to a case via a role.
      const finalUsersQuery = `SELECT id, name FROM user WHERE id IN (SELECT user FROM user_case_roles WHERE case = $case_id);`;


      const creditorsQuery = `SELECT id, name FROM creditor WHERE case_id = $case_id;`;

      const params = { case_id: currentCaseId };

      // Fetch users
      // Using a more robust way to handle potentially empty results or errors from individual queries.
      let fetchedUsers: Participant[] = [];
      try {
        const usersResult = await client.query<[RawUserParticipant[]]>(finalUsersQuery, params);
        if (usersResult && usersResult[0] && usersResult[0].result) {
          fetchedUsers = usersResult[0].result.map(u => ({ ...u, type: 'user', group: '系统用户' } as Participant));
        }
      } catch (userError) {
        console.error('Error fetching case users:', userError);
        // Decide if partial data is acceptable or if we should return empty/throw
      }
      
      // Fetch creditors
      let fetchedCreditors: Participant[] = [];
      try {
        const creditorsResult = await client.query<[RawCreditorParticipant[]]>(creditorsQuery, params);
        if (creditorsResult && creditorsResult[0] && creditorsResult[0].result) {
          fetchedCreditors = creditorsResult[0].result.map(c => ({ ...c, type: 'creditor', group: '债权人' } as Participant));
        }
      } catch (creditorError) {
        console.error('Error fetching case creditors:', creditorError);
      }

      setParticipants([...fetchedUsers, ...fetchedCreditors]);
    } catch (e) {
      console.error('Error fetching case participants:', e);
      setParticipants([]); // Reset on general error
    } finally {
      setIsLoading(false);
    }
  }, [client, isConnected]);

  useEffect(() => {
    if (caseId && client && isConnected) {
      fetchParticipants(caseId);
    } else {
      setParticipants([]); // Clear if no caseId or client not ready
      setIsLoading(false);
    }
  }, [caseId, client, isConnected, fetchParticipants]);

  return { participants, isLoading };
}
