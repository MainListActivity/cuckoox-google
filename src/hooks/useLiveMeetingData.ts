import { useState, useEffect } from 'react';
import { useSurrealContext } from '@/src/contexts/SurrealProvider'; // Adjust path as needed
import { RecordId, Uuid } from 'surrealdb';

// Interface for Meeting data, aligning with expected DB structure
export interface Meeting extends Record<string, any> {
  id: RecordId;
  case_id: RecordId;
  title: string;
  type: string;
  scheduled_time: string;
  duration_minutes?: number;
  status: '已安排' | '进行中' | '已结束' | '已取消';
  conference_link: string;
  agenda?: string;
  recording_url?: string | null;
  minutes_exist: boolean;
  minutes_delta_json?: string | null;
  created_at?: string;
  updated_at?: string;
  attendees?: MeetingAttendee[];
  attendee_ids?: RecordId[];
}

// Define MeetingAttendee interface
export interface MeetingAttendee {
  id: RecordId;
  name: string;
  type: 'user' | 'creditor';
}

export function useLiveMeetings(caseId: string | null): Meeting[] {
  const { client, isConnected } = useSurrealContext();
  const [meetingsList, setMeetingsList] = useState<Meeting[]>([]);
  const [error, setError] = useState<any>(null);

  const sortMeetings = (meetings: Meeting[]): Meeting[] => {
    return [...meetings].sort((a, b) => new Date(b.scheduled_time).getTime() - new Date(a.scheduled_time).getTime());
  };

  useEffect(() => {
    if (!client || !isConnected || !caseId) {
      setMeetingsList([]);
      return;
    }

    // Check if client is ready by verifying it's a real client, not the dummy proxy
    try {
      // Try to access a property to see if it's the real client
      if (!client.query || typeof client.query !== 'function') {
        console.log('Client not ready yet, waiting...');
        return;
      }
    } catch (e) {
      console.log('Client proxy error, waiting for real client...');
      return;
    }

    let isMounted = true;
    let liveQueryId: Uuid | null = null;
    const setupLiveSubscription = async () => {
      try {
        // Step 1: Fetch initial data and sort it
        const queryResult = await client.query<[Meeting[]]>('SELECT * FROM meeting WHERE case_id = $caseId', { caseId });
        if (!isMounted) return;
        const initialMeetings = queryResult && queryResult[0] ? queryResult[0] : [];
        setMeetingsList(sortMeetings(initialMeetings));
        setError(null);

        // Step 2: Set up the live query for entire meeting table (no parameters allowed)
        const liveQueryResult = await client.query<[Uuid]>('LIVE SELECT * FROM meeting;');
        if (!isMounted || !liveQueryResult || !liveQueryResult[0]) return;
        liveQueryId = liveQueryResult[0];
        if (!isMounted) return;

        // Step 3: Subscribe to live events with case filtering
        client.subscribeLive<Meeting>(liveQueryId, (action, result) => {
          if (!isMounted || result === "killed" || result === "disconnected") return;

          // Filter for relevant case_id changes
          if (result && typeof result === 'object' && 'case_id' in result) {
            const recordCaseId = result.case_id;
            if (recordCaseId?.toString() !== caseId && String(recordCaseId) !== String(caseId)) {
              return; // Ignore changes for different cases
            }
          } else {
            // If no case_id info, refresh data to be safe
            const refetchData = async () => {
              try {
                const queryResult = await client.query<[Meeting[]]>('SELECT * FROM meeting WHERE case_id = $caseId', { caseId });
                if (isMounted && queryResult && queryResult[0]) {
                  setMeetingsList(sortMeetings(queryResult[0]));
                }
              } catch (err) {
                console.error('Error refetching meetings data:', err);
              }
            };
            refetchData();
            return;
          }

          setMeetingsList(prevMeetings => {
            const meetingIdStr = result.id.toString();
            let newMeetings;

            switch (action) {
              case 'CREATE':
                newMeetings = prevMeetings.find(m => m.id.toString() === meetingIdStr) ? prevMeetings : [...prevMeetings, result];
                break;
              case 'UPDATE':
                newMeetings = prevMeetings.map(m => (m.id.toString() === meetingIdStr ? result : m));
                break;
              case 'DELETE':
                newMeetings = prevMeetings.filter(m => m.id.toString() !== meetingIdStr);
                break;
              default:
                newMeetings = prevMeetings;
                break;
            }
            return sortMeetings(newMeetings);
          });
        });
      } catch (err) {
        if (!isMounted) return;
        console.error("Error setting up live meetings subscription:", err);
        setError(err);
        setMeetingsList([]);
      }
    };

    setupLiveSubscription();

    // Step 4: Cleanup function
    return () => {
      isMounted = false;
      if (liveQueryId && client) {
        client.kill(liveQueryId).catch(killError => {
          console.error(`Error killing live query ${liveQueryId} on cleanup:`, killError);
        });
      }
    };
  }, [caseId, client, isConnected]);

  if (error) {
    // console.error("useLiveMeetings error state:", error);
  }

  return meetingsList;
}
