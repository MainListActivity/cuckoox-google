/// <reference lib="WebWorker" />
import { Surreal, RecordId } from 'surrealdb';

// Define AnyAuth type based on SurrealDB
export type AnyAuth = {
  username: string;
  password: string;
} | {
  token: string;
} | {
  namespace: string;
  database: string;
  scope: string;
  [key: string]: unknown;
};

// Extend the global scope to include ServiceWorker-specific types
declare const self: ServiceWorkerGlobalScope;

// --- Global State ---
let db: Surreal | null = null;
let isConnected = false;
let isInitialized = false;
let connectionConfig: {
  endpoint: string;
  namespace: string;
  database: string;
  auth?: AnyAuth;
} | null = null;

// In-memory storage to replace localStorage
const memoryStore: Record<string, string> = {};

// Live query management
const liveQuerySubscriptions = new Map<string, {
  query: string;
  vars?: Record<string, unknown>;
  clients: Set<string>; // Set of client IDs
}>();

// --- Helper Functions ---

function storageSet(key: string, val: string | null) {
  if (val === null) {
    delete memoryStore[key];
  } else {
    memoryStore[key] = val;
  }
}

function storageGet(key: string): string | null {
  return memoryStore[key] ?? null;
}

async function postMessageToClient(clientId: string, message: any) {
  const client = await self.clients.get(clientId);
  if (client) {
    client.postMessage(message);
  } else {
    console.warn(`ServiceWorker: Client with ID ${clientId} not found.`);
  }
}

async function broadcastToClients(message: any, clientIds: Set<string>) {
  for (const clientId of clientIds) {
    await postMessageToClient(clientId, message);
  }
}

// --- SurrealDB Logic ---

async function initializeSurreal(): Promise<void> {
  if (isInitialized) return;

  try {
    // Create a new SurrealDB instance
    db = new Surreal();
    isInitialized = true;
    console.log("ServiceWorker: SurrealDB initialized successfully");
  } catch (error) {
    console.error("ServiceWorker: Failed to initialize SurrealDB:", error);
    throw error;
  }
}

async function ensureConnection(newConfig?: typeof connectionConfig): Promise<boolean> {
  // Ensure SurrealDB is initialized first
  await initializeSurreal();
  if (newConfig) {
    const configChanged = JSON.stringify(connectionConfig) !== JSON.stringify(newConfig);
    if (configChanged) {
      console.log("ServiceWorker: Configuration changed, reconnecting...", connectionConfig, '->', newConfig);
      if (isConnected && db) {
        try {
          await db.close();
        } catch (e) {
          console.warn("ServiceWorker: Error closing connection:", e);
        }
      }
      isConnected = false;
      connectionConfig = newConfig;
    }
  }

  if (!connectionConfig) {
    console.error("ServiceWorker: Connection config not set.");
    return false;
  }

  if (!isConnected) {
    try {
      console.log(`ServiceWorker: Connecting to ${connectionConfig.endpoint}...`);
      await db!.connect(connectionConfig.endpoint);
      await db!.use({ namespace: connectionConfig.namespace, database: connectionConfig.database });

      // Re-authenticate if token is available
      const token = storageGet('access_token');
      if (token) {
        try {
          await db!.authenticate(token);
          console.log("ServiceWorker: Re-authenticated successfully with stored token.");
        } catch (e) {
          console.warn("ServiceWorker: Stored token authentication failed.", e);
          storageSet('access_token', null); // Clear invalid token
        }
      }

      isConnected = true;
      console.log("ServiceWorker: Connection established.");

      // Resubscribe to all live queries
      await resubscribeAllLiveQueries();

    } catch (e) {
      console.error("ServiceWorker: Connection failed.", e);
      isConnected = false;
      return false;
    }
  }
  return true;
}

async function resubscribeAllLiveQueries() {
  console.log("ServiceWorker: Resubscribing to all live queries...");
  for (const [uuid, sub] of liveQuerySubscriptions.entries()) {
    try {
      if (!db) throw new Error("Database not initialized");
      await db.live(sub.query, (action, result) => {
        broadcastToClients({
          type: 'live_update',
          payload: { uuid, action, result }
        }, sub.clients);
      }, sub.vars || {});
      console.log(`ServiceWorker: Successfully resubscribed to live query ${uuid}`);
    } catch (e) {
      console.error(`ServiceWorker: Failed to resubscribe to live query ${uuid}`, e);
    }
  }
}

// --- Service Worker Event Handlers ---

self.addEventListener('install', (event) => {
  console.log("Service Worker installing");
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  console.log("Service Worker activating");
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', async (event) => {
  if (!event.data || !event.data.type) {
    return;
  }

  const { type, payload, messageId } = event.data;
  const clientId = (event.source as any)?.id;

  if (!clientId) return;

  const respond = (responsePayload: any) => postMessageToClient(clientId, {
    type: `${type}_response`,
    messageId,
    payload: responsePayload
  });

  const respondError = (error: any) => postMessageToClient(clientId, {
    type: `${type}_error`,
    messageId,
    payload: { message: error.message, stack: error.stack }
  });

  try {
    switch (type) {
      case 'connect':
        await ensureConnection(payload);
        respond({ status: isConnected ? 'connected' : 'disconnected' });
        break;

      case 'authenticate':
        storageSet('access_token', payload.token);
        await ensureConnection();
        if (isConnected) {
          await db!.authenticate(payload.token);
          respond({ success: true });
        } else {
          throw new Error("Connection not established.");
        }
        break;

      case 'invalidate':
        storageSet('access_token', null);
        if (isConnected) await db!.invalidate();
        respond({ success: true });
        break;

      case 'query':
      case 'mutate': {
        await ensureConnection();
        if (!db) throw new Error("Database not initialized");
        const [result] = await db.query(payload.sql, payload.vars);
        respond(result);
        break;
      }

      case 'create': {
        await ensureConnection();
        if (!db) throw new Error("Database not initialized");
        const createResult = await db.create(payload.thing, payload.data);
        respond(createResult);
        break;
      }

      case 'select': {
        await ensureConnection();
        if (!db) throw new Error("Database not initialized");
        const selectResult = await db.select(payload.thing as string | RecordId);
        respond(selectResult);
        break;
      }

      case 'update': {
        await ensureConnection();
        if (!db) throw new Error("Database not initialized");
        const updateResult = await db.update(payload.thing as string | RecordId, payload.data);
        respond(updateResult);
        break;
      }

      case 'merge': {
        await ensureConnection();
        if (!db) throw new Error("Database not initialized");
        const mergeResult = await db.merge(payload.thing as string | RecordId, payload.data);
        respond(mergeResult);
        break;
      }

      case 'delete': {
        await ensureConnection();
        if (!db) throw new Error("Database not initialized");
        const deleteResult = await db.delete(payload.thing as string | RecordId);
        respond(deleteResult);
        break;
      }

      case 'live': {
        await ensureConnection();
        if (!db) throw new Error("Database not initialized");
        const { query, vars } = payload;

        const uuid = await db.live(query, (action, result) => {
          const sub = liveQuerySubscriptions.get(String(uuid));
          if (sub) {
            broadcastToClients({
              type: 'live_update',
              payload: { uuid: String(uuid), action, result }
            }, sub.clients);
          }
        }, vars);

        const uuidStr = String(uuid);
        if (!liveQuerySubscriptions.has(uuidStr)) {
          liveQuerySubscriptions.set(uuidStr, { query, vars, clients: new Set() });
        }
        liveQuerySubscriptions.get(uuidStr)!.clients.add(clientId);

        respond({ uuid: uuidStr });
        break;
      }

      case 'kill': {
        const { uuid: killUuid } = payload;
        const subscription = liveQuerySubscriptions.get(killUuid);
        if (subscription) {
          subscription.clients.delete(clientId);
          if (subscription.clients.size === 0 && db) {
            await db.kill(killUuid);
            liveQuerySubscriptions.delete(killUuid);
            console.log(`ServiceWorker: Killed live query ${killUuid} as no clients are listening.`);
          }
        }
        respond({ success: true });
        break;
      }

      default:
        console.warn(`ServiceWorker: Unknown message type received: ${type}`);
        respondError(new Error(`Unknown message type: ${type}`));
    }
  } catch (e: any) {
    console.error(`ServiceWorker: Error processing message type ${type}:`, e);
    respondError(e);
  }
});

console.log("Service Worker loaded");