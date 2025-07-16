import { vi } from 'vitest';
import { SurrealContextValue } from '@/src/contexts/SurrealProvider';

// Create mock functions for all SurrealProvider hooks
export const mockUseSurreal = vi.fn();
export const mockUseSurrealClient = vi.fn();
export const mockUseServiceWorkerComm = vi.fn();
export const mockUseTenantCodeCheck = vi.fn();
export const mockUseSurrealClientDisposal = vi.fn();
export const mockUseSurrealClientSingleton = vi.fn();

// Create default mock implementations
export const createMockSurrealClient = () => ({
  query: vi.fn().mockResolvedValue([{ success: true }, []]),  // Default queryWithAuth format
  mutate: vi.fn().mockResolvedValue([]),
  select: vi.fn().mockResolvedValue([]),
  create: vi.fn().mockResolvedValue({}),
  update: vi.fn().mockResolvedValue({}),
  merge: vi.fn().mockResolvedValue({}),
  delete: vi.fn().mockResolvedValue({}),
  live: vi.fn().mockResolvedValue('live-query-uuid'),
  subscribeLive: vi.fn().mockResolvedValue(undefined),
  kill: vi.fn().mockResolvedValue(undefined),
  connect: vi.fn().mockResolvedValue(true),
  authenticate: vi.fn().mockResolvedValue(undefined),
  invalidate: vi.fn().mockResolvedValue(undefined),
  setConfig: vi.fn().mockResolvedValue(undefined),
  close: vi.fn().mockResolvedValue(undefined),
  recoverTokens: vi.fn().mockResolvedValue(undefined),
  getConnectionState: vi.fn().mockResolvedValue({
    state: 'connected',
    isConnected: true,
    isReconnecting: false,
    reconnectAttempts: 0,
  }),
  forceReconnect: vi.fn().mockResolvedValue(undefined),
});

export const createMockSurrealContextValue = (overrides?: Partial<SurrealContextValue>): SurrealContextValue => {
  const mockClient = createMockSurrealClient();
  
  return {
    client: mockClient,
    surreal: mockClient,
    isConnected: true,
    isConnecting: false,
    error: null,
    isSuccess: true,
    reconnect: vi.fn().mockResolvedValue(undefined),
    sendServiceWorkerMessage: vi.fn().mockResolvedValue({}),
    isServiceWorkerAvailable: vi.fn().mockReturnValue(true),
    waitForServiceWorkerReady: vi.fn().mockResolvedValue(undefined),
    getAuthStatus: vi.fn().mockResolvedValue(true),
    checkTenantCodeAndRedirect: vi.fn().mockReturnValue(true),
    disposeSurrealClient: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
};

export const setupSurrealProviderMocks = (contextValue?: Partial<SurrealContextValue>) => {
  const mockContextValue = createMockSurrealContextValue(contextValue);
  
  mockUseSurreal.mockReturnValue(mockContextValue);
  mockUseSurrealClient.mockReturnValue(mockContextValue.client);
  mockUseServiceWorkerComm.mockReturnValue({
    sendMessage: mockContextValue.sendServiceWorkerMessage,
    isAvailable: mockContextValue.isServiceWorkerAvailable,
    waitForReady: mockContextValue.waitForServiceWorkerReady,
  });
  mockUseTenantCodeCheck.mockReturnValue(mockContextValue.checkTenantCodeAndRedirect);
  mockUseSurrealClientDisposal.mockReturnValue(mockContextValue.disposeSurrealClient);
  mockUseSurrealClientSingleton.mockReturnValue({
    surrealClient: vi.fn().mockResolvedValue(mockContextValue.client),
    surrealClientSafe: vi.fn().mockResolvedValue(mockContextValue.client),
  });
  
  return mockContextValue;
};

// Mock module for SurrealProvider
export const surrealProviderMock = {
  useSurreal: () => mockUseSurreal(),
  useSurrealClient: () => mockUseSurrealClient(),
  useSurrealContext: () => mockUseSurreal(),
  useServiceWorkerComm: () => mockUseServiceWorkerComm(),
  useTenantCodeCheck: () => mockUseTenantCodeCheck(),
  useSurrealClientDisposal: () => mockUseSurrealClientDisposal(),
  useSurrealClientSingleton: () => mockUseSurrealClientSingleton(),
};