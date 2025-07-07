import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createUnifiedSurrealClient, getUnifiedSurrealClient, resetUnifiedSurrealClient } from '@/src/lib/surrealUnifiedClient';

// Mock the environment variables
vi.mock('@env', () => ({
  VITE_DB_ACCESS_MODE: 'service-worker'
}));

// Mock the Surreal client and Service Worker client
vi.mock('surrealdb', () => ({
  Surreal: vi.fn(() => ({
    connect: vi.fn(),
    use: vi.fn(),
    authenticate: vi.fn(),
    query: vi.fn(),
    create: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
    merge: vi.fn(),
    delete: vi.fn(),
    live: vi.fn(),
    kill: vi.fn(),
    invalidate: vi.fn(),
    close: vi.fn()
  })),
  RecordId: vi.fn()
}));

vi.mock('@/src/lib/surrealClient', () => ({
  surrealClient: vi.fn(() => Promise.resolve({
    query: vi.fn(),
    mutate: vi.fn(),
    create: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
    merge: vi.fn(),
    delete: vi.fn(),
    live: vi.fn(),
    kill: vi.fn(),
    authenticate: vi.fn(),
    invalidate: vi.fn(),
    close: vi.fn()
  }))
}));

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});

describe('surrealUnifiedClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetUnifiedSurrealClient();
    mockLocalStorage.getItem.mockClear();
  });

  it('should create a unified client', () => {
    const client = createUnifiedSurrealClient();
    expect(client).toBeDefined();
    expect(typeof client.query).toBe('function');
    expect(typeof client.create).toBe('function');
    expect(typeof client.select).toBe('function');
  });

  it('should return the same instance when called multiple times', () => {
    const client1 = getUnifiedSurrealClient();
    const client2 = getUnifiedSurrealClient();
    expect(client1).toBe(client2);
  });

  it('should reset the client instance', async () => {
    const client1 = getUnifiedSurrealClient();
    resetUnifiedSurrealClient();
    const client2 = getUnifiedSurrealClient();
    expect(client1).not.toBe(client2);
  });

  it('should create service worker client by default', () => {
    vi.stubEnv('VITE_DB_ACCESS_MODE', 'service-worker');
    const client = createUnifiedSurrealClient();
    expect(client).toBeDefined();
  });

  it('should create direct client when configured', () => {
    vi.stubEnv('VITE_DB_ACCESS_MODE', 'direct');
    const client = createUnifiedSurrealClient();
    expect(client).toBeDefined();
  });
});