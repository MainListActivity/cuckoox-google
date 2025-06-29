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
      currentUserCaseRoles: [],
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

  it('should check permissions for regular users', async () => {
    const mockQuery = vi.fn().mockResolvedValueOnce([[{ can_execute: true }]]);
    
    mockUseAuth.mockReturnValue({
      user: {
        id: new RecordId('user', 'test123'),
        github_id: 'test-user',
        name: 'Test User',
      },
      currentUserCaseRoles: [
        {
          id: new RecordId('role', 'case_manager'),
          name: 'case_manager',
        },
      ],
    });

    mockUseSurreal.mockReturnValue({
      surreal: { query: mockQuery },
    });

    const { result } = renderHook(() => useOperationPermission('case_create'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('role_operation_permission'),
      expect.any(Object)
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
      currentUserCaseRoles: [
        {
          id: new RecordId('role', 'case_manager'),
          name: 'case_manager',
        },
      ],
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
      currentUserCaseRoles: [],
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
      currentUserCaseRoles: [],
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

  it('should check menu permissions for regular users', async () => {
    const mockQuery = vi.fn().mockResolvedValueOnce([[{ can_access: true }]]);
    
    mockUseAuth.mockReturnValue({
      user: {
        id: new RecordId('user', 'test123'),
        github_id: 'test-user',
        name: 'Test User',
      },
      currentUserCaseRoles: [
        {
          id: new RecordId('role', 'case_manager'),
          name: 'case_manager',
        },
      ],
    });

    mockUseSurreal.mockReturnValue({
      surreal: { query: mockQuery },
    });

    const { result } = renderHook(() => useMenuPermission('cases'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('role_menu_permission'),
      expect.any(Object)
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
      currentUserCaseRoles: [],
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

  it('should check data permissions with rules', async () => {
    const mockQuery = vi.fn()
      // First call - global roles query
      .mockResolvedValueOnce([[]])
      // Second call - data permission rules query
      .mockResolvedValueOnce([[{ rule_expression: 'true' }]]);
    
    mockUseAuth.mockReturnValue({
      user: {
        id: new RecordId('user', 'test123'),
        github_id: 'test-user',
        name: 'Test User',
      },
      currentUserCaseRoles: [
        {
          id: new RecordId('role', 'case_manager'),
          name: 'case_manager',
        },
      ],
    });

    mockUseSurreal.mockReturnValue({
      surreal: { query: mockQuery },
    });

    const { result } = renderHook(() => useDataPermission('case', 'read'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('data_permission_rule'),
      expect.any(Object)
    );
    expect(result.current.hasPermission).toBe(true);
  });

  it('should evaluate rule expressions for specific records', async () => {
    const recordData = {
      created_by: new RecordId('user', 'test123'),
    };

    const mockQuery = vi.fn()
      // First call - global roles query
      .mockResolvedValueOnce([[]])
      // Second call - data permission rules query
      .mockResolvedValueOnce([[{ 
        rule_expression: 'created_by = $auth.id' 
      }]]);
    
    mockUseAuth.mockReturnValue({
      user: {
        id: new RecordId('user', 'test123'),
        github_id: 'test-user',
        name: 'Test User',
      },
      currentUserCaseRoles: [
        {
          id: new RecordId('role', 'case_manager'),
          name: 'case_manager',
        },
      ],
    });

    mockUseSurreal.mockReturnValue({
      surreal: { query: mockQuery },
    });

    const { result } = renderHook(
      () => useDataPermission('case', 'update', recordData)
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasPermission).toBe(true);
  });

  it('should return false when no matching rules', async () => {
    const mockQuery = vi.fn()
      // First call - global roles query
      .mockResolvedValueOnce([[]])
      // Second call - data permission rules query - no rules
      .mockResolvedValueOnce([[]]);
    
    mockUseAuth.mockReturnValue({
      user: {
        id: new RecordId('user', 'test123'),
        github_id: 'test-user',
        name: 'Test User',
      },
      currentUserCaseRoles: [
        {
          id: new RecordId('role', 'case_manager'),
          name: 'case_manager',
        },
      ],
    });

    mockUseSurreal.mockReturnValue({
      surreal: { query: mockQuery },
    });

    const { result } = renderHook(() => useDataPermission('case', 'delete'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasPermission).toBe(false);
  });
}); 