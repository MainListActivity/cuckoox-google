import Surreal from 'surrealdb';

// Environment variables should be used for actual connection details
// For Vite, it's VITE_. We will use VITE_SURREALDB_URL, VITE_SURREALDB_NAMESPACE, VITE_SURREALDB_DATABASE

const db = new Surreal();

async function connectSurrealDB() {
  try {
    const dbUrl = import.meta.env.VITE_SURREALDB_URL || 'http://localhost:8000/rpc'; // Default to localhost RPC endpoint
    const namespace = import.meta.env.VITE_SURREALDB_NAMESPACE || 'test';
    const database = import.meta.env.VITE_SURREALDB_DATABASE || 'test';

    await db.connect(dbUrl, {
      namespace: namespace,
      database: database,
      // auth: credentials, // We will handle auth separately, potentially per query or when user logs in.
                           // For now, let's assume DB allows connection without root/ns/db auth initially,
                           // or these are handled by the connection string/environment setup.
    });
    console.log('Connected to SurrealDB successfully!');
    // You might want to sign in with a default scope or user here if your DB rules require it
    // For example: await db.signin({ user: 'root', pass: 'root' }); if that's your setup.
    // Or: await db.use({namespace, database}); // This is implicitly handled by connect in surrealdb v1.x
    
  } catch (e) {
    console.error('Error connecting to SurrealDB:', e);
    // Optionally rethrow the error or handle it as needed by the application
    // throw e; 
  }
}

// Call connect on app initialization (e.g. in main.tsx or App.tsx)
// For now, we can export the function and the db instance.
// Actual connection might be better initiated in App.tsx or index.tsx.
// We will call connectSurrealDB() from src/index.tsx later.

export { db, connectSurrealDB };
