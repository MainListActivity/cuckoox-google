import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach, type MockedFunction, afterEach } from 'vitest';
import AddCaseMemberDialog from '@/src/components/case/AddCaseMemberDialog';
import * as caseMemberService from '@/src/services/caseMemberService';

// Mock the caseMemberService
vi.mock('@/src/services/caseMemberService');

const mockSearchSystemUsers = caseMemberService.searchSystemUsers as MockedFunction<typeof caseMemberService.searchSystemUsers>;
const mockAddCaseMember = caseMemberService.addCaseMember as MockedFunction<typeof caseMemberService.addCaseMember>;

const mockOnClose = vi.fn();
const mockOnMemberAdded = vi.fn();

const systemUsersMock: caseMemberService.SystemUser[] = [
  { id: 'user:001', name: 'Alice Admin', email: 'alice@example.com', avatarUrl: 'avatar_alice.png' },
  { id: 'user:002', name: 'Bob Lawyer', email: 'bob@example.com', avatarUrl: 'avatar_bob.png' },
  { id: 'user:003', name: 'Charlie Owner', email: 'charlie@example.com', avatarUrl: 'avatar_charlie.png' },
  { id: 'user:004', name: 'David User', email: 'david@example.com', avatarUrl: 'avatar_david.png' },
  { id: 'user:005', name: 'Eve Member' }, // 测试没有email的用户
];

describe('AddCaseMemberDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set default successful add member response
    mockAddCaseMember.mockResolvedValue({
      id: 'user:002',
      caseId: 'case:test123',
      roleInCase: 'member',
      userName: 'Bob Lawyer',
      userEmail: 'bob@example.com',
      avatarUrl: 'avatar_bob.png',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders correctly when open is true', () => {
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

  it('does not render (or renders null) when open is false', () => {
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

  it('calls onClose when Cancel button is clicked', () => {
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

  it('search input updates its value and calls searchSystemUsers', async () => {
    mockSearchSystemUsers.mockResolvedValue([systemUsersMock[0]]);
    
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

    // Check if results are displayed
    expect(await screen.findByText('Alice Admin')).toBeVisible();
    // Ensure the mock was called
    await waitFor(() => {
      expect(mockSearchSystemUsers).toHaveBeenCalledWith('Alice');
    });
  });

  it('displays search results correctly', async () => {
    mockSearchSystemUsers.mockResolvedValue(systemUsersMock);
    
    render(
      <AddCaseMemberDialog
        open={true}
        onClose={mockOnClose}
        caseId="case:test123"
        onMemberAdded={mockOnMemberAdded}
      />
    );
    const searchInput = screen.getByLabelText(/Search users/i);
    fireEvent.change(searchInput, { target: { value: 'user' } }); 

    expect(await screen.findByText('Alice Admin')).toBeInTheDocument();
    expect(await screen.findByText('Bob Lawyer')).toBeInTheDocument();
  });

  it('shows "No users found" message if search yields no results', async () => {
    mockSearchSystemUsers.mockResolvedValue([]);
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

    expect(await screen.findByText(/No users found/i)).toBeInTheDocument();
  });

  it('calls addCaseMember, onMemberAdded, and onClose when a user is selected and "Add" button is clicked', async () => {
    mockSearchSystemUsers.mockResolvedValue([systemUsersMock[1]]);
    
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

    // Use findByText to wait for the user to appear
    const userItem = await screen.findByText('Bob Lawyer');
    fireEvent.click(userItem); // Select Bob

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

  it('"Add" button shows error if no user is selected', async () => {
    render(
      <AddCaseMemberDialog
        open={true}
        onClose={mockOnClose}
        caseId="case:test123"
        onMemberAdded={mockOnMemberAdded}
      />
    );
    
    const addButton = screen.getByRole('button', { name: /Add Selected User/i });
    fireEvent.click(addButton);
    
    expect(await screen.findByText('Please select a user to add.')).toBeInTheDocument();
  });

  it('displays loading indicator during search operations', async () => {
    let resolveSearch: (value: caseMemberService.SystemUser[]) => void;
    const searchPromise = new Promise<caseMemberService.SystemUser[]>(resolve => {
      resolveSearch = resolve;
    });
    mockSearchSystemUsers.mockReturnValue(searchPromise);

    render(
      <AddCaseMemberDialog
        open={true}
        onClose={mockOnClose}
        caseId="case:test123"
        onMemberAdded={mockOnMemberAdded}
      />
    );

    const searchInput = screen.getByLabelText(/Search users/i);
    fireEvent.change(searchInput, { target: { value: 'user' } });
    
    expect(await screen.findByRole('progressbar')).toBeInTheDocument();
    
    await act(async () => {
      resolveSearch!(systemUsersMock);
    });
    
    await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument());
    expect(await screen.findByText('Alice Admin')).toBeInTheDocument();
  });

  it('does not search when query is less than 2 characters', async () => {
    render(
      <AddCaseMemberDialog
        open={true}
        onClose={mockOnClose}
        caseId="case:test123"
        onMemberAdded={mockOnMemberAdded}
      />
    );
    const searchInput = screen.getByLabelText(/Search users/i);
    
    fireEvent.change(searchInput, { target: { value: 'A' } });
    
    // Give debounce a moment, but expect no call
    await new Promise(r => setTimeout(r, 600));
    
    expect(mockSearchSystemUsers).not.toHaveBeenCalled();
  });

  it('clears search results when query becomes empty', async () => {
    mockSearchSystemUsers.mockResolvedValue([systemUsersMock[0]]);
    
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
    expect(await screen.findByText('Alice Admin')).toBeInTheDocument();
    
    fireEvent.change(searchInput, { target: { value: '' } });
    await waitFor(() => {
      expect(screen.queryByText('Alice Admin')).not.toBeInTheDocument();
    });
  });

  it('displays user without email correctly', async () => {
    mockSearchSystemUsers.mockResolvedValue([systemUsersMock[4]]); // Eve Member without email
    render(
      <AddCaseMemberDialog
        open={true}
        onClose={mockOnClose}
        caseId="case:test123"
        onMemberAdded={mockOnMemberAdded}
      />
    );
    const searchInput = screen.getByLabelText(/Search users/i);
    fireEvent.change(searchInput, { target: { value: 'Eve' } });

    expect(await screen.findByText('Eve Member')).toBeInTheDocument();
    expect(await screen.findByText('No email')).toBeInTheDocument();
  });

  it('handles search error gracefully', async () => {
    mockSearchSystemUsers.mockRejectedValue(new Error('Search failed'));
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

    expect(await screen.findByText('Failed to search users. Please try again.')).toBeInTheDocument();
  });

  it('handles add member error gracefully', async () => {
    mockSearchSystemUsers.mockResolvedValue([systemUsersMock[0]]);
    mockAddCaseMember.mockRejectedValueOnce(new Error('User already exists in case'));
    
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

    const userItem = await screen.findByText('Alice Admin');
    fireEvent.click(userItem);

    const addButton = screen.getByRole('button', { name: /Add Selected User/i });
    fireEvent.click(addButton);

    expect(await screen.findByText('User already exists in case')).toBeInTheDocument();
    
    expect(mockOnClose).not.toHaveBeenCalled();
    expect(mockOnMemberAdded).not.toHaveBeenCalled();
  });

  it('resets state when dialog is closed and reopened', async () => {
    mockSearchSystemUsers.mockResolvedValue([systemUsersMock[0]]);
    
    const { rerender } = render(
      <AddCaseMemberDialog
        open={true}
        onClose={mockOnClose}
        caseId="case:test123"
        onMemberAdded={mockOnMemberAdded}
      />
    );
    
    const searchInput = screen.getByLabelText(/Search users/i);
    fireEvent.change(searchInput, { target: { value: 'Alice' } });
    
    expect(await screen.findByText('Alice Admin')).toBeInTheDocument();
    
    fireEvent.click(screen.getByText('Alice Admin'));
    
    rerender(
      <AddCaseMemberDialog
        open={false}
        onClose={mockOnClose}
        caseId="case:test123"
        onMemberAdded={mockOnMemberAdded}
      />
    );
    
    rerender(
      <AddCaseMemberDialog
        open={true}
        onClose={mockOnClose}
        caseId="case:test123"
        onMemberAdded={mockOnMemberAdded}
      />
    );
    
    const newSearchInput = screen.getByLabelText(/Search users/i);
    expect(newSearchInput).toHaveValue('');
    expect(screen.queryByText('Alice Admin')).not.toBeInTheDocument();
  });

  it('debounces search input correctly', async () => {
    mockSearchSystemUsers.mockResolvedValue([systemUsersMock[0]]);
    
    render(
      <AddCaseMemberDialog
        open={true}
        onClose={mockOnClose}
        caseId="case:test123"
        onMemberAdded={mockOnMemberAdded}
      />
    );
    
    const searchInput = screen.getByLabelText(/Search users/i);
    
    fireEvent.change(searchInput, { target: { value: 'A' } });
    fireEvent.change(searchInput, { target: { value: 'Al' } });
    fireEvent.change(searchInput, { target: { value: 'Ali' } });
    fireEvent.change(searchInput, { target: { value: 'Alic' } });
    fireEvent.change(searchInput, { target: { value: 'Alice' } });
    
    await waitFor(() => {
      expect(mockSearchSystemUsers).toHaveBeenCalledTimes(1);
      expect(mockSearchSystemUsers).toHaveBeenCalledWith('Alice');
    });
  });

  it('displays avatar correctly for users with and without avatarUrl', async () => {
    const usersWithAndWithoutAvatar = [
      { id: 'user:001', name: 'Alice Admin', email: 'alice@example.com', avatarUrl: 'avatar_alice.png' },
      { id: 'user:006', name: 'Frank User', email: 'frank@example.com' }, // No avatarUrl
    ];
    mockSearchSystemUsers.mockResolvedValue(usersWithAndWithoutAvatar);
    
    render(
      <AddCaseMemberDialog
        open={true}
        onClose={mockOnClose}
        caseId="case:test123"
        onMemberAdded={mockOnMemberAdded}
      />
    );
    
    const searchInput = screen.getByLabelText(/Search users/i);
    fireEvent.change(searchInput, { target: { value: 'user' } });

    expect(await screen.findByText('Alice Admin')).toBeInTheDocument();
    expect(await screen.findByText('Frank User')).toBeInTheDocument();
    
    const aliceImg = screen.getByRole('img');
    expect(aliceImg).toHaveAttribute('src', 'avatar_alice.png');
    
    const frankAvatar = screen.getByText('F');
    expect(frankAvatar).toBeInTheDocument();
  });

  it('calls addCaseMember with correct parameters', async () => {
    mockSearchSystemUsers.mockResolvedValue([systemUsersMock[1]]);
    
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

    const userItem = await screen.findByText('Bob Lawyer');
    fireEvent.click(userItem);
    
    const addButton = screen.getByRole('button', { name: /Add Selected User/i });
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(mockAddCaseMember).toHaveBeenCalledWith(
        'case:test123',
        'user:002',
        'Bob Lawyer',
        'bob@example.com',
        'avatar_bob.png',
        'member'
      );
    });
  });
});
