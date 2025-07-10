import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TokenManager, TokenInfo } from '../../../src/workers/token-manager';
import { RecordId } from 'surrealdb';

// Mock SurrealDB
const mockLocalDb = {
  query: vi.fn(),
  upsert: vi.fn(),
  select: vi.fn(),
  delete: vi.fn(),
  close: vi.fn(),
};

describe('TokenManager', () => {
  let tokenManager: TokenManager;

  beforeEach(() => {
    vi.clearAllMocks();
    tokenManager = new TokenManager({
      apiUrl: 'http://localhost:8082',
    });
  });

  it('should initialize with local database and start token refresh', async () => {
    await tokenManager.initialize(mockLocalDb as any);
    
    // Should call query to create table structure
    expect(mockLocalDb.query).toHaveBeenCalledWith(
      expect.stringContaining('DEFINE TABLE IF NOT EXISTS tokens')
    );
    
    // Token refresh timer should be set up automatically
    // (we can't easily test the timer itself in unit tests)
  });

  it('should store token information', async () => {
    await tokenManager.initialize(mockLocalDb as any);
    
    const tokenInfo: Partial<TokenInfo> = {
      access_token: 'test-access-token',
      refresh_token: 'test-refresh-token',
      tenant_code: 'test-tenant',
    };

    await tokenManager.storeToken(tokenInfo);

    expect(mockLocalDb.upsert).toHaveBeenCalledWith(
      new RecordId('tokens', 'current'),
      expect.objectContaining({
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        tenant_code: 'test-tenant',
      })
    );
  });

  it('should get token information', async () => {
    await tokenManager.initialize(mockLocalDb as any);
    
    const mockTokenData = {
      access_token: 'test-access-token',
      refresh_token: 'test-refresh-token',
      tenant_code: 'test-tenant',
      created_at: Date.now(),
      updated_at: Date.now(),
    };

    mockLocalDb.select.mockResolvedValue(mockTokenData);

    const result = await tokenManager.getToken();

    expect(mockLocalDb.select).toHaveBeenCalledWith(new RecordId('tokens', 'current'));
    expect(result).toEqual(mockTokenData);
  });

  it('should clear token information', async () => {
    await tokenManager.initialize(mockLocalDb as any);
    
    await tokenManager.clearToken();

    expect(mockLocalDb.delete).toHaveBeenCalledWith(new RecordId('tokens', 'current'));
  });

  it('should get specific token field', async () => {
    await tokenManager.initialize(mockLocalDb as any);
    
    const mockTokenData = {
      access_token: 'test-access-token',
      refresh_token: 'test-refresh-token',
      tenant_code: 'test-tenant',
      created_at: Date.now(),
      updated_at: Date.now(),
    };

    mockLocalDb.select.mockResolvedValue(mockTokenData);

    const accessToken = await tokenManager.getToken();
    expect(accessToken?.access_token).toBe('test-access-token');

    expect(accessToken?.tenant_code).toBe('test-tenant');
  });

  it('should check if token is expired', async () => {
    await tokenManager.initialize(mockLocalDb as any);
    
    // Mock expired token
    const expiredTokenData = {
      access_token: 'test-access-token',
      token_expires_at: Date.now() - 10000, // 10 seconds ago
      created_at: Date.now(),
      updated_at: Date.now(),
    };

    mockLocalDb.select.mockResolvedValue(expiredTokenData);

    const isExpired = await tokenManager.isTokenExpired();
    expect(isExpired).toBe(true);
  });

  it('should check if token is expiring soon', async () => {
    await tokenManager.initialize(mockLocalDb as any);
    
    // Mock token expiring in 5 minutes
    const expiringSoonTokenData = {
      access_token: 'test-access-token',
      token_expires_at: Date.now() + (5 * 60 * 1000), // 5 minutes from now
      created_at: Date.now(),
      updated_at: Date.now(),
    };

    mockLocalDb.select.mockResolvedValue(expiringSoonTokenData);

    const isExpiringSoon = await tokenManager.isTokenExpiringsoon(10 * 60 * 1000); // 10 minutes
    expect(isExpiringSoon).toBe(true);
  });

  it('should check if tenant code exists', async () => {
    await tokenManager.initialize(mockLocalDb as any);
    
    const tokenDataWithTenant = {
      access_token: 'test-access-token',
      tenant_code: 'test-tenant',
      created_at: Date.now(),
      updated_at: Date.now(),
    };

    mockLocalDb.select.mockResolvedValue(tokenDataWithTenant);

    const hasTenantCode = await tokenManager.hasTenantCode();
    expect(hasTenantCode).toBe(true);
  });

  it('should handle no token data gracefully', async () => {
    await tokenManager.initialize(mockLocalDb as any);
    
    mockLocalDb.select.mockResolvedValue(null);

    const result = await tokenManager.getToken();
    expect(result).toBeNull();

    const isExpired = await tokenManager.isTokenExpired();
    expect(isExpired).toBe(true);

    const hasTenantCode = await tokenManager.hasTenantCode();
    expect(hasTenantCode).toBe(false);
  });
});