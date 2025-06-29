import { useState, useEffect, useCallback } from 'react';
import { useSurreal } from '@/src/contexts/SurrealProvider';
import { RecordId } from 'surrealdb';

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
  role_name?: string;
  // type and group are hardcoded in the query or added during processing
}

interface RawCreditorParticipant {
  id: string | RecordId;
  name: string;
  // type and group are hardcoded in the query or added during processing
}

export function useCaseParticipants(caseId: string | null): { participants: Participant[], isLoading: boolean } {
  const { surreal, isSuccess } = useSurreal();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const fetchParticipants = useCallback(async (currentCaseId: string) => {
    if (!surreal || !isSuccess) {
      // console.warn('Surreal client not connected, skipping participant fetch.');
      setParticipants([]);
      return;
    }
    setIsLoading(true);
    try {
      // 使用图查询获取案件成员
      const usersQuery = `
        SELECT out.*, role_id.name as role_name 
        FROM $case_id->has_member
        ORDER BY assigned_at DESC
      `;

      const creditorsQuery = `SELECT id, name FROM creditor WHERE case_id = $case_id;`;

      const params = { case_id: currentCaseId };

      // Fetch users
      // Using a more robust way to handle potentially empty results or errors from individual queries.
      let fetchedUsers: Participant[] = [];
      try {
        const usersResult = await surreal.query<[RawUserParticipant[]]>(usersQuery, params);
        if (usersResult && usersResult[0]) {
          fetchedUsers = usersResult[0].map((u: RawUserParticipant) => ({ 
            id: u.id,
            name: u.name,
            type: 'user' as const, 
            group: '系统用户' as const 
          }));
        }
      } catch (userError) {
        console.error('Error fetching case users:', userError);
        // Decide if partial data is acceptable or if we should return empty/throw
      }
      
      // Fetch creditors
      let fetchedCreditors: Participant[] = [];
      try {
        const creditorsResult = await surreal.query<[RawCreditorParticipant[]]>(creditorsQuery, params);
        if (creditorsResult && creditorsResult[0]) {
          fetchedCreditors = creditorsResult[0].map((c: RawCreditorParticipant) => ({ 
            id: c.id,
            name: c.name,
            type: 'creditor' as const, 
            group: '债权人' as const 
          }));
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
  }, [surreal, isSuccess]);

  useEffect(() => {
    if (caseId && surreal && isSuccess) {
      fetchParticipants(caseId);
    } else {
      setParticipants([]); // Clear if no caseId or client not ready
      setIsLoading(false);
    }
  }, [caseId, surreal, isSuccess, fetchParticipants]);

  return { participants, isLoading };
}
