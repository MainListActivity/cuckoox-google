import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useOperationPermission, useMenuPermission, useDataPermission } from '@/src/hooks/usePermission';
import React from 'react';
import { RecordId } from 'surrealdb';

// Mock the contexts
const mockUseOperationPermission = vi.fn();
const mockUseMenuPermission = vi.fn();
const mockUseDataPermission = vi.fn();

vi.mock('@/src/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    useOperationPermission: mockUseOperationPermission,
    useMenuPermission: mockUseMenuPermission,
    useDataPermission: mockUseDataPermission,
    user: {
      id: new RecordId('user', 'test'),
      github_id: 'test-user',
      name: 'Test User',
    },
    selectedCaseId: null,
  })),
}));

const mockUseAuth = vi.hoisted(() => vi.fn());
const mockUseSurreal = vi.hoisted(() => vi.fn());

// Import after mocking
import { useAuth } from '@/src/contexts/AuthContext';

describe('useOperationPermission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should proxy to AuthContext useOperationPermission', () => {
    mockUseOperationPermission.mockReturnValue({
      hasPermission: true,
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useOperationPermission('case_create'));

    expect(mockUseOperationPermission).toHaveBeenCalledWith('case_create');
    expect(result.current.hasPermission).toBe(true);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe(null);
  });

  it('should handle loading state', () => {
    mockUseOperationPermission.mockReturnValue({
      hasPermission: false,
      isLoading: true,
      error: null,
    });

    const { result } = renderHook(() => useOperationPermission('case_create'));

    expect(result.current.hasPermission).toBe(false);
    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBe(null);
  });

  it('should handle error state', () => {
    mockUseOperationPermission.mockReturnValue({
      hasPermission: false,
      isLoading: false,
      error: 'Permission check failed',
    });

    const { result } = renderHook(() => useOperationPermission('case_create'));

    expect(result.current.hasPermission).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe('Permission check failed');
  });
});

describe('useMenuPermission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should proxy to AuthContext useMenuPermission', () => {
    mockUseMenuPermission.mockReturnValue({
      hasPermission: true,
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useMenuPermission('cases'));

    expect(mockUseMenuPermission).toHaveBeenCalledWith('cases');
    expect(result.current.hasPermission).toBe(true);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe(null);
  });
});

describe('useDataPermission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should proxy to AuthContext useDataPermission', () => {
    mockUseDataPermission.mockReturnValue({
      hasPermission: true,
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useDataPermission('case', 'read'));

    expect(mockUseDataPermission).toHaveBeenCalledWith('case', 'read');
    expect(result.current.hasPermission).toBe(true);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe(null);
  });
}); 