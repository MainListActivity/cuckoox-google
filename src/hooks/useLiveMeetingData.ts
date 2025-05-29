import { useState, useEffect, useRef, useCallback } from 'react';
import { useSurrealClient } from '../contexts/SurrealProvider'; // Adjust path as needed
import { RecordId } from 'surrealdb.js'; // For typing RecordId

// Interface for Meeting data, aligning with expected DB structure
export interface Meeting {
  id: RecordId | string; // SurrealDB record ID
  case_id: RecordId | string; // Link to the case
  title: string;
  type: string; // e.g., '债权人第一次会议', '临时会议'
  scheduled_time: string; // ISO 8601 string (e.g., "2023-10-26T10:00:00Z")
  duration_minutes?: number;
  status: '已安排' | '进行中' | '已结束' | '已取消';
  conference_link: string;
  agenda?: string;
  recording_url?: string | null;
  minutes_exist: boolean;
  minutes_delta_json?: string | null;
  created_at?: string;
  updated_at?: string;
  attendees?: MeetingAttendee[]; // Added attendees field
  attendee_ids?: (RecordId | string)[]; // Field to store attendee IDs in DB
}

// Define MeetingAttendee interface
export interface MeetingAttendee {
  id: string; // Record link for user or creditor
  name: string;
  type: 'user' | 'creditor'; // To distinguish attendee type
  // 'group' property will be added by useCaseParticipants hook, not part of DB model for MeetingAttendee directly
}


export function useLiveMeetings(caseId: string | null): Meeting[] {
  const { client, isConnected } = useSurrealClient();
  const [meetingsList, setMeetingsList] = useState<Meeting[]>([]);
  const [error, setError] = useState<any>(null);
  const liveQueryIdRef = useRef<string | null>(null);

  const fetchMeetings = useCallback(async (currentCaseId: string) => {
    if (!client || !isConnected) {
      // console.warn('Surreal client not connected, skipping meeting fetch.');
      return;
    }
    try {
      // console.log(`Fetching meetings for case_id: ${currentCaseId}`);
      const result = await client.select<Meeting[]>(`meeting:(WHERE case_id = '${currentCaseId}' ORDER BY scheduled_time DESC)`);
      // console.log('Raw meetings result:', result);
      setMeetingsList(result || []);
      setError(null);
    } catch (e) {
      console.error('Error fetching meetings:', e);
      setError(e);
      setMeetingsList([]);
    }
  }, [client, isConnected]);

  useEffect(() => {
    if (!client || !isConnected || !caseId) {
      setMeetingsList([]);
      if (liveQueryIdRef.current) {
        client.kill(liveQueryIdRef.current).then(() => {
          liveQueryIdRef.current = null;
        }).catch(killError => {
          console.error(`Error killing live query ${liveQueryIdRef.current}:`, killError);
        });
      }
      return;
    }

    fetchMeetings(caseId); // Initial fetch

    const setupLiveQuery = async () => {
      if (liveQueryIdRef.current) { // Kill previous query if caseId changes
        try {
          await client.kill(liveQueryIdRef.current);
          liveQueryIdRef.current = null;
        } catch (killError) {
          console.error(`Error killing previous live query ${liveQueryIdRef.current}:`, killError);
        }
      }

      try {
        const liveSelectQuery = `LIVE SELECT * FROM meeting WHERE case_id = '${caseId}';`;
        const queryResponse = await client.query<[{ result: string }]>(liveSelectQuery);
        const qid = queryResponse && queryResponse[0] && queryResponse[0].result;

        if (qid && typeof qid === 'string') {
          liveQueryIdRef.current = qid;
          client.listenLive<Meeting>(liveQueryIdRef.current, (actionEvent) => {
            const { action, result: meetingData } = actionEvent;
            // console.log(`Live event on meeting query ${liveQueryIdRef.current}:`, action, meetingData);
            
            setMeetingsList(prevMeetings => {
              let newMeetings = [...prevMeetings];
              switch (action) {
                case 'CREATE':
                  // Add if not already present (SurrealDB might send create for initial data sometimes)
                  if (!newMeetings.find(m => m.id === meetingData.id)) {
                    newMeetings.push(meetingData);
                  }
                  break;
                case 'UPDATE':
                  newMeetings = newMeetings.map(m => (m.id === meetingData.id ? meetingData : m));
                  break;
                case 'DELETE':
                  newMeetings = newMeetings.filter(m => m.id !== meetingData.id);
                  break;
                default:
                  break;
              }
              // Re-sort after modification as order might change or new item added
              return newMeetings.sort((a, b) => new Date(b.scheduled_time).getTime() - new Date(a.scheduled_time).getTime());
            });
          });
        } else {
          console.error("Failed to get live query ID for meetings. Response:", queryResponse);
        }
      } catch (e) {
        console.error('Error setting up live meetings query:', e);
        setError(e);
      }
    };

    setupLiveQuery();

    return () => { // Cleanup
      if (liveQueryIdRef.current && client && client.isConnected) {
        client.kill(liveQueryIdRef.current).then(() => {
          liveQueryIdRef.current = null;
        }).catch(killError => {
          console.error(`Error killing live meetings query ${liveQueryIdRef.current} on cleanup:`, killError);
        });
      }
    };
  }, [client, isConnected, caseId, fetchMeetings]);
  
  if(error) {
    // console.error("useLiveMeetings error state:", error)
  }

  return meetingsList;
}
