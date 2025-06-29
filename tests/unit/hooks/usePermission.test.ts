import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useOperationPermission, useMenuPermission, useDataPermission } from '@/src/hooks/usePermission';
import React from 'react';
import { RecordId } from 'surrealdb';

// Mock the contexts
vi.mock('@/src/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/src/contexts/SurrealProvider', () => ({
  useSurreal: vi.fn(),
}));

const mockUseAuth = vi.hoisted(() => vi.fn());
const mockUseSurreal = vi.hoisted(() => vi.fn());

// Import after mocking
import { useAuth } from '@/src/contexts/AuthContext';
import { useSurreal } from '@/src/contexts/SurrealProvider';

describe('useOperationPermission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useAuth as any).mockImplementation(mockUseAuth);
    (useSurreal as any).mockImplementation(mockUseSurreal);
  });

  it('should return true for admin users', async () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: new RecordId('user', 'admin'),
        github_id: '--admin--',
        name: 'Admin User',
      },
      selectedCaseId: null,
    });

    mockUseSurreal.mockReturnValue({
      surreal: { query: vi.fn() },
    });

    const { result } = renderHook(() => useOperationPermission('case_create'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasPermission).toBe(true);
  });

  it('should check permissions for regular users using graph queries', async () => {
    const mockQuery = vi.fn().mockResolvedValueOnce([[{ can_execute: true }]]);
    
    mockUseAuth.mockReturnValue({
      user: {
        id: new RecordId('user', 'test123'),
        github_id: 'test-user',
        name: 'Test User',
      },
      selectedCaseId: new RecordId('case', 'case123'),
    });

    mockUseSurreal.mockReturnValue({
      surreal: { query: mockQuery },
    });

    const { result } = renderHook(() => useOperationPermission('case_create'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('can_execute_operation'),
      {
        user_id: new RecordId('user', 'test123'),
        case_id: new RecordId('case', 'case123'),
        operation_id: 'case_create'
      }
    );
    expect(result.current.hasPermission).toBe(true);
  });

  it('should return false when no permission found', async () => {
    const mockQuery = vi.fn().mockResolvedValueOnce([[]]);
    
    mockUseAuth.mockReturnValue({
      user: {
        id: new RecordId('user', 'test123'),
        github_id: 'test-user',
        name: 'Test User',
      },
      selectedCaseId: null,
    });

    mockUseSurreal.mockReturnValue({
      surreal: { query: mockQuery },
    });

    const { result } = renderHook(() => useOperationPermission('case_delete'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasPermission).toBe(false);
  });

  it('should handle errors gracefully', async () => {
    const mockQuery = vi.fn().mockRejectedValueOnce(new Error('Database error'));
    
    mockUseAuth.mockReturnValue({
      user: {
        id: new RecordId('user', 'test123'),
        github_id: 'test-user',
        name: 'Test User',
      },
      selectedCaseId: null,
    });

    mockUseSurreal.mockReturnValue({
      surreal: { query: mockQuery },
    });

    const { result } = renderHook(() => useOperationPermission('case_create'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasPermission).toBe(false);
    expect(result.current.error).toBe('Database error');
  });
});

describe('useMenuPermission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useAuth as any).mockImplementation(mockUseAuth);
    (useSurreal as any).mockImplementation(mockUseSurreal);
  });

  it('should return true for admin users', async () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: new RecordId('user', 'admin'),
        github_id: '--admin--',
        name: 'Admin User',
      },
      selectedCaseId: null,
    });

    mockUseSurreal.mockReturnValue({
      surreal: { query: vi.fn() },
    });

    const { result } = renderHook(() => useMenuPermission('cases'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasPermission).toBe(true);
  });

  it('should check menu permissions for regular users using graph queries', async () => {
    const mockQuery = vi.fn().mockResolvedValueOnce([[{ can_access: true }]]);
    
    mockUseAuth.mockReturnValue({
      user: {
        id: new RecordId('user', 'test123'),
        github_id: 'test-user',
        name: 'Test User',
      },
      selectedCaseId: new RecordId('case', 'case123'),
    });

    mockUseSurreal.mockReturnValue({
      surreal: { query: mockQuery },
    });

    const { result } = renderHook(() => useMenuPermission('cases'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('can_access_menu'),
      {
        user_id: new RecordId('user', 'test123'),
        case_id: new RecordId('case', 'case123'),
        menu_id: 'cases'
      }
    );
    expect(result.current.hasPermission).toBe(true);
  });
});

describe('useDataPermission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useAuth as any).mockImplementation(mockUseAuth);
    (useSurreal as any).mockImplementation(mockUseSurreal);
  });

  it('should return true for admin users', async () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: new RecordId('user', 'admin'),
        github_id: '--admin--',
        name: 'Admin User',
      },
      selectedCaseId: null,
    });

    mockUseSurreal.mockReturnValue({
      surreal: { query: vi.fn() },
    });

    const { result } = renderHook(() => useDataPermission('case', 'read'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasPermission).toBe(true);
  });

  it('should check data permissions using SurrealDB built-in permissions', async () => {
    const mockQuery = vi.fn().mockResolvedValueOnce([[]]);
    
    mockUseAuth.mockReturnValue({
      user: {
        id: new RecordId('user', 'test123'),
        github_id: 'test-user',
        name: 'Test User',
      },
      selectedCaseId: new RecordId('case', 'case123'),
    });

    mockUseSurreal.mockReturnValue({
      surreal: { query: mockQuery },
    });

    const { result } = renderHook(() => useDataPermission('case', 'read'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM case WHERE false LIMIT 0');
    expect(result.current.hasPermission).toBe(true);
  });

  it('should handle permission errors correctly', async () => {
    const mockQuery = vi.fn().mockRejectedValueOnce(new Error('permission denied'));
    
    mockUseAuth.mockReturnValue({
      user: {
        id: new RecordId('user', 'test123'),
        github_id: 'test-user',
        name: 'Test User',
      },
      selectedCaseId: null,
    });

    mockUseSurreal.mockReturnValue({
      surreal: { query: mockQuery },
    });

    const { result } = renderHook(() => useDataPermission('case', 'read'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasPermission).toBe(false);
  });

  it('should return false when no user is provided', async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      selectedCaseId: null,
    });

    mockUseSurreal.mockReturnValue({
      surreal: { query: vi.fn() },
    });

    const { result } = renderHook(() => useDataPermission('case', 'delete'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasPermission).toBe(false);
  });
}); 