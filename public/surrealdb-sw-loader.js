// Simple SurrealDB Engine Mock for Service Worker
// This provides basic functionality without WASM dependencies

(function() {
  'use strict';
  
  // Create a mock engine implementation that works in Service Worker
  const createMockEngine = () => {
    // Simple in-memory storage
    const memoryStorage = new Map();
    
    // Mock SurrealDB connection class
    class MockSurrealConnection {
      constructor(type) {
        this.type = type;
        this.connected = false;
        this.namespace = null;
        this.database = null;
      }
      
      async connect(url) {
        console.log(`[MockEngine] Connecting to ${url} using ${this.type} engine`);
        this.connected = true;
        return Promise.resolve();
      }
      
      async use({ namespace, database }) {
        this.namespace = namespace;
        this.database = database;
        console.log(`[MockEngine] Using namespace: ${namespace}, database: ${database}`);
      }
      
      async authenticate(token) {
        console.log(`[MockEngine] Authenticated with token`);
        return true;
      }
      
      async create(thing, data) {
        const key = `${this.namespace}:${this.database}:${thing}`;
        const record = { id: thing, ...data, _created: Date.now() };
        memoryStorage.set(key, record);
        return record;
      }
      
      async select(thing) {
        const key = `${this.namespace}:${this.database}:${thing}`;
        return memoryStorage.get(key) || null;
      }
      
      async update(thing, data) {
        const key = `${this.namespace}:${this.database}:${thing}`;
        const existing = memoryStorage.get(key) || {};
        const record = { ...existing, ...data, _updated: Date.now() };
        memoryStorage.set(key, record);
        return record;
      }
      
      async upsert(thing, data) {
        return this.update(thing, data);
      }
      
      async delete(thing) {
        const key = `${this.namespace}:${this.database}:${thing}`;
        const record = memoryStorage.get(key);
        memoryStorage.delete(key);
        return record || null;
      }
      
      async query(sql, vars) {
        console.log(`[MockEngine] Query: ${sql}`, vars);
        // Return empty result for now
        return [];
      }
      
      async close() {
        this.connected = false;
        console.log(`[MockEngine] Connection closed`);
      }
    }
    
    // Return engine configuration
    return {
      mem: {
        name: 'mem',
        type: 'memory',
        instance: null,
        async connect(url) {
          this.instance = new MockSurrealConnection('memory');
          await this.instance.connect(url);
          return this.instance;
        }
      },
      indxdb: {
        name: 'indxdb', 
        type: 'indexeddb',
        instance: null,
        async connect(url) {
          // For IndexedDB, we'll use the same mock for now
          // In a real implementation, this would use IndexedDB API
          this.instance = new MockSurrealConnection('indexeddb');
          await this.instance.connect(url);
          return this.instance;
        }
      }
    };
  };
  
  // Expose the engine creator function globally
  self.surrealdbWasmEngines = function() {
    console.log('[SW Loader] Creating mock SurrealDB engines (WASM-free)');
    return createMockEngine();
  };
  
  // Also provide the fallback function
  self.createSurrealEnginesFallback = function() {
    console.log('[SW Loader] Creating fallback engines');
    return createMockEngine();
  };
  
  console.log('[SW Loader] SurrealDB mock engine loader initialized');
})();