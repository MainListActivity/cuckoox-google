import Surreal from 'surrealdb';

// Re-export the Surreal class for any parts of the application that might need direct access
// to the Surreal class itself (e.g., for type definitions or utility functions not related to the provider).
// However, the primary way to interact with SurrealDB should be through the SurrealProvider and its hooks.
export default Surreal;
export { Surreal }; // Also export as named export for flexibility
