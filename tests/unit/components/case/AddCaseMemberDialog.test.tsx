import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import AddCaseMemberDialog from '@/src/components/case/AddCaseMemberDialog';
import * as caseMemberService from '@/src/services/caseMemberService'; // To mock its functions
import { vi } from 'vitest';

// Mock the caseMemberService
vi.mock('@/src/services/caseMemberService');

const mockSearchSystemUsers = caseMemberService.searchSystemUsers as vi.Mock;
const mockAddCaseMember = caseMemberService.addCaseMember as vi.Mock;

const mockOnClose = vi.fn();
const mockOnMemberAdded = vi.fn();

const systemUsersMock: caseMemberService.SystemUser[] = [
  { id: 'user:001', name: 'Alice Admin', email: 'alice@example.com', avatarUrl: 'avatar_alice.png' },
  { id: 'user:002', name: 'Bob Lawyer', email: 'bob@example.com', avatarUrl: 'avatar_bob.png' },
];

describe('AddCaseMemberDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchSystemUsers.mockResolvedValue([]); // Default to no results
    mockAddCaseMember.mockResolvedValue({
      id: 'user:002',
      caseId: 'case:test123',
      roleInCase: 'member',
      userName: 'Bob Lawyer',
      userEmail: 'bob@example.com',
      avatarUrl: 'avatar_bob.png',
    });
  });

  test('renders correctly when open is true', () => {
    render(
      <AddCaseMemberDialog
        open={true}
        onClose={mockOnClose}
        caseId="case:test123"
        onMemberAdded={mockOnMemberAdded}
      />
    );
    expect(screen.getByRole('dialog')).toBeVisible();
    expect(screen.getByLabelText(/Search users/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add Selected User/i })).toBeInTheDocument();
  });

  test('does not render (or renders null) when open is false', () => {
    const { container } = render(
      <AddCaseMemberDialog
        open={false}
        onClose={mockOnClose}
        caseId="case:test123"
        onMemberAdded={mockOnMemberAdded}
      />
    );
    // Dialogs often render null or an empty fragment when not open,
    // so checking for the absence of its role or specific content is better.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    // Check if the container is empty (or only contains non-visible elements)
    expect(container.firstChild).toBeNull(); // MUI Dialogs often render null when closed
  });

  test('calls onClose when Cancel button is clicked', () => {
    render(
      <AddCaseMemberDialog
        open={true}
        onClose={mockOnClose}
        caseId="case:test123"
        onMemberAdded={mockOnMemberAdded}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  test('search input updates its value and calls searchSystemUsers', async () => {
    mockSearchSystemUsers.mockResolvedValueOnce(systemUsersMock);
    render(
      <AddCaseMemberDialog
        open={true}
        onClose={mockOnClose}
        caseId="case:test123"
        onMemberAdded={mockOnMemberAdded}
      />
    );
    const searchInput = screen.getByLabelText(/Search users/i);
    fireEvent.change(searchInput, { target: { value: 'Alice' } });
    expect(searchInput).toHaveValue('Alice');

    // Wait for debounce and API call
    await waitFor(() => {
      expect(mockSearchSystemUsers).toHaveBeenCalledWith('Alice');
    });

    // Check if results are displayed
    expect(await screen.findByText('Alice Admin')).toBeVisible();
  });

  test('displays search results correctly', async () => {
    mockSearchSystemUsers.mockResolvedValueOnce(systemUsersMock);
    render(
      <AddCaseMemberDialog
        open={true}
        onClose={mockOnClose}
        caseId="case:test123"
        onMemberAdded={mockOnMemberAdded}
      />
    );
    const searchInput = screen.getByLabelText(/Search users/i);
    fireEvent.change(searchInput, { target: { value: 'user' } }); // A query that matches both

    await waitFor(() => {
      expect(screen.getByText('Alice Admin')).toBeInTheDocument();
      expect(screen.getByText('Bob Lawyer')).toBeInTheDocument();
    });
  });

  test('shows "No users found" message if search yields no results', async () => {
    mockSearchSystemUsers.mockResolvedValueOnce([]);
     render(
      <AddCaseMemberDialog
        open={true}
        onClose={mockOnClose}
        caseId="case:test123"
        onMemberAdded={mockOnMemberAdded}
      />
    );
    const searchInput = screen.getByLabelText(/Search users/i);
    fireEvent.change(searchInput, { target: { value: 'NonExistentUser' } });

    await waitFor(() => {
      expect(screen.getByText(/No users found/i)).toBeInTheDocument();
    });
  });

  test('calls addCaseMember, onMemberAdded, and onClose when a user is selected and "Add" button is clicked', async () => {
    mockSearchSystemUsers.mockResolvedValueOnce([systemUsersMock[1]]); // Return Bob
    render(
      <AddCaseMemberDialog
        open={true}
        onClose={mockOnClose}
        caseId="case:test123"
        onMemberAdded={mockOnMemberAdded}
      />
    );
    const searchInput = screen.getByLabelText(/Search users/i);
    fireEvent.change(searchInput, { target: { value: 'Bob' } });

    await waitFor(() => {
      expect(screen.getByText('Bob Lawyer')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Bob Lawyer')); // Select Bob

    const addButton = screen.getByRole('button', { name: /Add Selected User/i });
    expect(addButton).not.toBeDisabled();
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(mockAddCaseMember).toHaveBeenCalledWith(
        'case:test123',
        systemUsersMock[1].id,
        systemUsersMock[1].name,
        systemUsersMock[1].email,
        systemUsersMock[1].avatarUrl,
        'member'
      );
    });

    await waitFor(() => {
        expect(mockOnMemberAdded).toHaveBeenCalledWith(expect.objectContaining({ id: systemUsersMock[1].id }));
    });

    await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  test('"Add" button is disabled if no user is selected', async () => {
    mockSearchSystemUsers.mockResolvedValueOnce(systemUsersMock);
     render(
      <AddCaseMemberDialog
        open={true}
        onClose={mockOnClose}
        caseId="case:test123"
        onMemberAdded={mockOnMemberAdded}
      />
    );
    const searchInput = screen.getByLabelText(/Search users/i);
    fireEvent.change(searchInput, { target: { value: 'Alice' } });

    await waitFor(() => {
        expect(screen.getByText('Alice Admin')).toBeInTheDocument();
    });

    const addButton = screen.getByRole('button', { name: /Add Selected User/i });
    expect(addButton).toBeDisabled(); // No user selected yet
  });

  test('displays loading indicator during search and add operations', async () => {
    mockSearchSystemUsers.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve(systemUsersMock), 100)));
    mockAddCaseMember.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({}), 100)));

    render(
      <AddCaseMemberDialog
        open={true}
        onClose={mockOnClose}
        caseId="case:test123"
        onMemberAdded={mockOnMemberAdded}
      />
    );
    const searchInput = screen.getByLabelText(/Search users/i);

    // Test search loading
    act(() => {
      fireEvent.change(searchInput, { target: { value: 'user' } });
    });
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()); // Search completes

    // Test add loading
    fireEvent.click(screen.getByText(systemUsersMock[0].name)); // Select a user
    const addButton = screen.getByRole('button', { name: /Add Selected User/i });
    act(() => {
      fireEvent.click(addButton);
    });
    expect(screen.getByRole('progressbar', {hidden: true})).toBeInTheDocument(); // MUI CircularProgress in button might be hidden visually but present
    await waitFor(() => expect(mockOnClose).toHaveBeenCalled()); // Wait for add to complete
  });
});
