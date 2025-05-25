import Surreal from 'surrealdb';

const VITE_SURREALDB_WS_URL = import.meta.env.VITE_SURREALDB_WS_URL || 'ws://localhost:8000/rpc';
const VITE_SURREALDB_NAMESPACE = import.meta.env.VITE_SURREALDB_NAMESPACE || 'test';
const VITE_SURREALDB_DATABASE = import.meta.env.VITE_SURREALDB_DATABASE || 'test';

const MAX_RECONNECT_ATTEMPTS = 5;
const INITIAL_RECONNECT_DELAY_MS = 1000; // 1 second
const MAX_RECONNECT_DELAY_MS = 30000; // 30 seconds

export const db = new Surreal();
let reconnectAttempts = 0;
let currentReconnectDelay = INITIAL_RECONNECT_DELAY_MS;
let connectionPromise: Promise<void> | null = null;

// Connection status - you can expand this
let isDbConnected = false; 

// SurrealDB v1.x events are on db.emitter
// Example: db.emitter.on('connected', () => { ... });
// db.emitter.on('disconnected', () => { ... });
// db.emitter.on('reconnected', () => { ... });

async function tryConnect(): Promise<void> {
  try {
    // The connect options are now part of the connect method itself in v1.x
    // await db.connect(VITE_SURREALDB_WS_URL, {
    //   namespace: VITE_SURREALDB_NAMESPACE,
    //   database: VITE_SURREALDB_DATABASE,
    // });
    // For surrealdb@1.x, the connect method is simpler:
    await db.connect(VITE_SURREALDB_WS_URL);
    
    // After connecting, you might need to use USE NS/DB or signin if not covered by connection string/options
    // However, for WS, often namespace and database are part of URL or handled by client library post-connect.
    // The library aims to make this simpler. If your URL is just ws://host:port/rpc,
    // you might need to explicitly call use or signin.
    // Let's assume for now the URL or subsequent signin (e.g. db.signin({NS, DB})) handles this.
    // For this step, focus on connect. If NS/DB are needed with connect for WS, add them.
    // Based on documentation, namespace/database are typically handled by db.use() or db.signin() after connect.
    // Let's add db.use() for clarity after connection.
    await db.use(VITE_SURREALDB_NAMESPACE, VITE_SURREALDB_DATABASE);

    console.log('Connected to SurrealDB via WebSocket successfully!');
    isDbConnected = true;
    reconnectAttempts = 0; // Reset attempts on successful connection
    currentReconnectDelay = INITIAL_RECONNECT_DELAY_MS; // Reset delay

    // Handle disconnection
    db.emitter.once('close', () => {
      isDbConnected = false;
      console.warn('SurrealDB WebSocket connection closed. Attempting to reconnect...');
      // Clear the previous promise to allow a new connection attempt
      connectionPromise = null; 
      scheduleReconnect();
    });

  } catch (e) {
    isDbConnected = false;
    // This error is from the current attempt within tryConnect, not the overall reconnectAttempts for the public connectSurrealDB call
    // console.error(`Error connecting to SurrealDB (attempt ${reconnectAttempts}):`, e);
    // The retry logic is now primarily managed by the scheduleReconnect calling connectSurrealDB
    throw e; // Re-throw to be handled by connectSurrealDB's catch block
  }
}

function scheduleReconnect() {
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS && !isDbConnected && !connectionPromise) {
        const delay = Math.min(currentReconnectDelay, MAX_RECONNECT_DELAY_MS);
        console.log(`Scheduling reconnect in ${delay / 1000} seconds... (Overall attempt ${reconnectAttempts + 1})`);
        
        setTimeout(() => {
            // Increment attempts here as this is where a new cycle of connectSurrealDB is initiated
            reconnectAttempts++; 
            currentReconnectDelay = Math.min(currentReconnectDelay * 2, MAX_RECONNECT_DELAY_MS); // Exponential backoff for next potential failure
            
            // Reset connectionPromise before calling connectSurrealDB to allow it to set a new one
            connectionPromise = null; 
            connectSurrealDB().catch(() => {
                // This catch is important if the scheduled connectSurrealDB call itself fails after all its internal retries.
                // If it has already reached max attempts from this scheduled call, it will log inside connectSurrealDB.
                // If not, it might schedule another reconnect if the 'close' event fires again or if its own retry logic continues.
            });
        }, delay);
    } else if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
         console.error('Max reconnection attempts reached. Not scheduling further reconnects from scheduleReconnect.');
    }
}


export async function connectSurrealDB(): Promise<void> {
  if (isDbConnected) {
    return Promise.resolve();
  }

  // If a connection attempt is already in progress, return that promise
  if (connectionPromise) {
    return connectionPromise;
  }
  
  console.log(`Attempting to connect to SurrealDB... (Overall attempt ${reconnectAttempts + 1})`);
  
  connectionPromise = tryConnect()
    .then(() => {
      // Successfully connected in this call to connectSurrealDB
      connectionPromise = null; // Clear promise on success
      // reconnectAttempts and currentReconnectDelay are reset inside tryConnect on success
    })
    .catch((error) => {
      connectionPromise = null; // Clear promise on failure of this attempt cycle
      console.error(`connectSurrealDB: Failed attempt ${reconnectAttempts} for initial connection. Error: ${error.message}`);
      
      if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
         // This error is from an initial connection attempt failing in tryConnect.
         // scheduleReconnect will handle the next attempt.
         // We need to make sure scheduleReconnect is called if it's not a 'close' event initiated retry.
         // The 'close' event handler is for established connections that drop.
         // For initial connection failures, we schedule directly.
         if (!isDbConnected) { // Check as 'close' event might not have fired for initial failure
            scheduleReconnect(); // This will increment reconnectAttempts for the *next* scheduled call
         }
      } else {
        console.error('connectSurrealDB: Max reconnection attempts reached after error. Giving up.', error.message);
        // Re-throw the final error if all attempts failed
        throw new Error(`Failed to connect to SurrealDB after ${MAX_RECONNECT_ATTEMPTS} attempts. Last error: ${error.message}`);
      }
      // Re-throw the error from the current failed attempt to signal failure of this connectSurrealDB call
      throw error; 
    });
  
  return connectionPromise;
}

// Expose a way to check connection status if needed by UI
export const getDbConnectionStatus = (): boolean => {
  return isDbConnected;
};

// Initial connection attempt when app loads (as done in src/index.tsx)
// The call in src/index.tsx will use this new connectSurrealDB.
