import { useState, useEffect, useRef, useCallback } from "react";
import { useSurreal } from "@/src/contexts/SurrealProvider";
import { RecordId, Table } from "surrealdb";
import {
  Message,
  ConversationSummary,
  CaseRobotReminderMessage,
  BusinessNotificationMessage,
} from "@/src/types/message";

// --- useConversationsList Hook ---
interface RawConversationParticipant {
  id: RecordId | string;
  name?: string; // Name might not be directly on the conversation participant link
}
interface RawConversationData {
  id: RecordId | string;
  participants: RawConversationParticipant[];
  // last_message_snippet, last_message_timestamp, last_message_sender_name will likely be arrays of single-object results from subqueries
  last_message_snippet: [{ content: string }] | string | null; // Adjust based on actual subquery result
  last_message_timestamp: [{ created_at: string }] | string | null;
  last_message_sender_name: [{ sender_name: string }] | string | null;
  unread_count: number; // Placeholder
  // Other fields from DB for conversation
  updated_at?: string; // For sorting conversations by recent activity
}

export function useConversationsList(userId: RecordId | null): {
  conversations: ConversationSummary[];
  isLoading: boolean;
  error: unknown;
  setConversations: React.Dispatch<React.SetStateAction<ConversationSummary[]>>; // Added setter
} {
  const { client, isConnected } = useSurreal();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<unknown>(null);
  const liveQueryRef = useRef<{ kill: () => Promise<void> } | null>(null);

  const fetchConversations = useCallback(
    async (currentUserId: RecordId) => {
      if (!client || !isConnected) return;

      // Check if client is ready by verifying it's not the dummy proxy
      if (typeof client.query !== "function") {
        console.log("Client not ready yet, waiting...");
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Placeholder Query: This is highly conceptual and needs schema alignment.
        // Fetching participant names might require additional queries or FETCH clauses if not denormalized.
        const _query = `
        SELECT
            id,
            participants, -- This would ideally be populated with user records using FETCH
            -- Subqueries to get last message details (conceptual, syntax might vary)
            (SELECT value content FROM message WHERE conversation_id = $parent.id ORDER BY created_at DESC LIMIT 1)[0] AS last_message_snippet,
            (SELECT value created_at FROM message WHERE conversation_id = $parent.id ORDER BY created_at DESC LIMIT 1)[0] AS last_message_timestamp,
            (SELECT value sender_name FROM message WHERE conversation_id = $parent.id ORDER BY created_at DESC LIMIT 1)[0] AS last_message_sender_name,
            0 AS unread_count, -- Placeholder
            updated_at -- Assuming conversation has an updated_at field that's touched on new message
        FROM conversation
        WHERE array::contains(participants.*.id, $userId) OR array::contains(participants, $userId) -- Check if current user is a participant
        ORDER BY updated_at DESC;
      `;
        // Simpler query if participants array stores direct user RecordIds
        // const query = `SELECT *, 0 AS unread_count FROM conversation WHERE $userId IN participants ORDER BY updated_at DESC;`;

        // 使用图查询语法替代 IN 子查询
        const placeholderQuery = `SELECT id, participants, updated_at, 0 AS unread_count FROM $userId->participates_in->conversation ORDER BY updated_at DESC;`;

        const result = await client.query<[RawConversationData[]]>(
          placeholderQuery,
          { userId: currentUserId },
        );

        const data = result?.[0];
        if (data) {
          const parsedConversations: ConversationSummary[] = data.map((raw) => {
            const id =
              typeof raw.id === "string"
                ? new RecordId(raw.id.split(":")[0], raw.id.split(":")[1])
                : raw.id;
            // Basic parsing, assuming participant names need fetching or are simplified
            const participantsSummary =
              raw.participants?.map((p) => ({
                id: p.id,
                name:
                  p.name ||
                  (typeof p.id === "string"
                    ? p.id.split(":")[1]
                    : "Unknown User"), // Very basic name assumption
              })) || [];

            // Extract last message details safely, considering subquery results might be arrays
            const snippet =
              typeof raw.last_message_snippet === "string"
                ? raw.last_message_snippet
                : Array.isArray(raw.last_message_snippet) &&
                    raw.last_message_snippet[0]
                  ? raw.last_message_snippet[0].content
                  : "No messages yet";
            const timestamp =
              typeof raw.last_message_timestamp === "string"
                ? raw.last_message_timestamp
                : Array.isArray(raw.last_message_timestamp) &&
                    raw.last_message_timestamp[0]
                  ? raw.last_message_timestamp[0].created_at
                  : raw.updated_at || new Date(0).toISOString();
            const senderName =
              typeof raw.last_message_sender_name === "string"
                ? raw.last_message_sender_name
                : Array.isArray(raw.last_message_sender_name) &&
                    raw.last_message_sender_name[0]
                  ? raw.last_message_sender_name[0].sender_name
                  : undefined;

            return {
              id: id,
              participants: participantsSummary,
              last_message_snippet: snippet,
              last_message_timestamp: timestamp,
              last_message_sender_name: senderName,
              unread_count: raw.unread_count || 0, // Placeholder
              // avatar_url and is_group_chat would depend on your schema
            };
          });
          setConversations(parsedConversations);
        } else {
          setConversations([]);
        }
      } catch (e) {
        console.error("Error fetching conversations:", e);
        setError(e);
        setConversations([]);
      } finally {
        setIsLoading(false);
      }
    },
    [client, isConnected],
  );

  useEffect(() => {
    if (userId && client && isConnected) {
      fetchConversations(userId);

      // Use new Live Query API to monitor message changes
      const setupLiveQueries = async () => {
        try {
          // Kill previous live query if any
          if (liveQueryRef.current) {
            await liveQueryRef.current.kill();
            liveQueryRef.current = null;
          }

          // Set up new live query using Table class and new API
          const messageTable = new Table("message");
          const live = await client.live(messageTable);
          
          // Subscribe to live events
          live.subscribe((_action, _result, _record) => {
            // Re-fetch conversations on any message change
            // This ensures we catch all relevant changes
            fetchConversations(userId);
          });

          liveQueryRef.current = live;
        } catch (e) {
          console.error("Error setting up live conversations query:", e);
        }
      };
      setupLiveQueries();
    } else {
      setConversations([]);
    }
    return () => {
      // Cleanup
      if (liveQueryRef.current) {
        liveQueryRef.current.kill().catch(/* ignore */);
        liveQueryRef.current = null;
      }
    };
  }, [userId, client, isConnected, fetchConversations]);

  return { conversations, isLoading, error, setConversations }; // Return setter
}

// --- useSystemNotifications Hook ---
export function useSystemNotifications(
  userId: RecordId | null,
  caseId?: RecordId | null,
): {
  notifications: (CaseRobotReminderMessage | BusinessNotificationMessage)[];
  isLoading: boolean;
  error: unknown;
  setNotifications: React.Dispatch<
    React.SetStateAction<
      (CaseRobotReminderMessage | BusinessNotificationMessage)[]
    >
  >; // Added setter
} {
  const { client, isConnected } = useSurreal();
  const [notifications, setNotifications] = useState<
    (CaseRobotReminderMessage | BusinessNotificationMessage)[]
  >([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<unknown>(null);
  const liveQueryRef = useRef<{ kill: () => Promise<void> } | null>(null);

  const fetchNotifications = useCallback(
    async (currentUserId: RecordId, currentCaseId?: RecordId | null) => {
      if (!client || !isConnected) return;

      // Check if client is ready by verifying it's not the dummy proxy
      if (typeof client.query !== "function") {
        console.log("Client not ready yet, waiting...");
        return;
      }

      setIsLoading(true);
      setError(null);
      try {
        const query = `
        SELECT * FROM message
        WHERE
          (type = 'CASE_ROBOT_REMINDER' AND (case_id = $caseId OR $caseId = NONE)) OR
          (type = 'BUSINESS_NOTIFICATION' AND target_user_id = $userId)
        ORDER BY created_at DESC
        LIMIT 50;
      `;
        // Note: $caseId = NONE (or $caseId = null) is how SurrealDB might handle optional null parameters
        // Ensure your SurrealDB version supports this or adjust the query (e.g. build parts conditionally).
        // If $caseId is null/undefined, the first part of OR should effectively be false for specific case_id matches.
        // A safer way for optional $caseId if it's not passed as null to DB:
        // const query = `
        //   SELECT * FROM message
        //   WHERE
        //     (type = 'CASE_ROBOT_REMINDER' ${currentCaseId ? 'AND case_id = $caseId' : ''}) OR
        //     (type = 'BUSINESS_NOTIFICATION' AND target_user_id = $userId)
        //   ORDER BY created_at DESC
        //   LIMIT 50;
        // `;
        // For simplicity, using the version that assumes $caseId can be null in DB query.

        const params: { userId: RecordId; caseId?: RecordId | null } = {
          userId: currentUserId,
        };
        if (caseId !== undefined) {
          // Pass caseId only if it's explicitly provided (even if null)
          params.caseId = currentCaseId;
        }

        const result = await client.query<[Message[]]>(query, params);

        const data = result?.[0];
        if (data) {
          const filteredNotifications = data.filter(
            (
              msg,
            ): msg is CaseRobotReminderMessage | BusinessNotificationMessage =>
              msg.type === "CASE_ROBOT_REMINDER" ||
              msg.type === "BUSINESS_NOTIFICATION",
          );
          setNotifications(filteredNotifications);
        } else {
          setNotifications([]);
        }
      } catch (e) {
        console.error("Error fetching system notifications:", e);
        setError(e);
        setNotifications([]);
      } finally {
        setIsLoading(false);
      }
    },
    [client, isConnected, caseId],
  ); // Added caseId to dependencies

  useEffect(() => {
    if (userId && client && isConnected) {
      fetchNotifications(userId, caseId); // Pass caseId here

      // Use new Live Query API to monitor message changes
      const setupLiveQuery = async () => {
        try {
          // Kill previous live query if any
          if (liveQueryRef.current) {
            await liveQueryRef.current.kill();
            liveQueryRef.current = null;
          }

          // Set up new live query using Table class and new API
          const messageTable = new Table("message");
          const live = await client.live(messageTable);
          
          // Subscribe to live events
          live.subscribe((action, data, record) => {
            // Filter relevant message changes on client side
            if (data && typeof data === "object" && "type" in data) {
              const isRelevant =
                (data.type === "CASE_ROBOT_REMINDER" &&
                  (!caseId || data.case_id === caseId)) ||
                (data.type === "BUSINESS_NOTIFICATION" &&
                  data.target_user_id === userId);

              if (isRelevant) {
                fetchNotifications(userId, caseId);
              }
            } else {
              // Fallback: refresh on any message change to be safe
              fetchNotifications(userId, caseId);
            }
          });

          liveQueryRef.current = live;
        } catch (e) {
          console.error("Error setting up live system notifications query:", e);
        }
      };
      setupLiveQuery();
    } else {
      setNotifications([]);
    }
    return () => {
      // Cleanup
      if (liveQueryRef.current) {
        liveQueryRef.current.kill().catch(/* ignore */);
        liveQueryRef.current = null;
      }
    };
  }, [userId, caseId, client, isConnected, fetchNotifications]);

  return { notifications, isLoading, error, setNotifications }; // Return setter
}