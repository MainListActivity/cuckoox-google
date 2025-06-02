import { CaseMember } from '@/src/types/caseMember';
// Assuming RecordId might be sourced from a central types file or directly from surrealdb.js
// For this mock, we'll treat it as a string, which is compatible with SurrealDB RecordId string format.

// Mock database for case members
const mockCaseMembersDB: CaseMember[] = [
  { id: 'user:001', caseId: 'case:abc', roleInCase: 'owner', userName: 'Alice Admin', userEmail: 'alice@example.com', avatarUrl: 'https://i.pravatar.cc/150?u=alice@example.com' },
  { id: 'user:002', caseId: 'case:abc', roleInCase: 'member', userName: 'Bob Lawyer', userEmail: 'bob@example.com', avatarUrl: 'https://i.pravatar.cc/150?u=bob@example.com' },
  { id: 'user:003', caseId: 'case:xyz', roleInCase: 'owner', userName: 'Charlie Owner', userEmail: 'charlie@example.com', avatarUrl: 'https://i.pravatar.cc/150?u=charlie@example.com' },
  { id: 'user:004', caseId: 'case:abc_example_with_owner', roleInCase: 'owner', userName: 'Default Owner', userEmail: 'owner@example.com', avatarUrl: 'https://i.pravatar.cc/150?u=owner@example.com' },

];

export const fetchCaseMembers = async (caseId: string): Promise<CaseMember[]> => {
  console.log(`[Mock API] Fetching members for case: ${caseId}`);
  await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay
  const members = mockCaseMembersDB.filter(member => member.caseId === caseId);

  // This specific logic for 'case:abc_example_with_owner' was in the prompt,
  // but it's already covered by the mockDB entry.
  // If no members are found for a case, it will correctly return an empty array.
  // A real API would determine the owner based on the actual case creator.
  return members;
};

export const addCaseMember = async (caseId: string, userId: string, userName: string, userEmail: string | undefined, avatarUrl: string | undefined, role: 'owner' | 'member'): Promise<CaseMember> => {
  console.log(`[Mock API] Adding user ${userId} (${userName}) to case ${caseId} as ${role}`);
  await new Promise(resolve => setTimeout(resolve, 500));

  const newMember: CaseMember = {
    id: userId, // This should be the user's RecordId, e.g., "user:00x"
    caseId,
    roleInCase: role,
    userName,
    userEmail,
    avatarUrl: avatarUrl || `https://i.pravatar.cc/150?u=${userEmail || userId}`
  };

  // Prevent adding duplicates
  if (!mockCaseMembersDB.find(m => m.id === userId && m.caseId === caseId)) {
    mockCaseMembersDB.push(newMember);
  } else {
    console.warn(`[Mock API] User ${userId} already exists in case ${caseId}.`);
    // Optionally, update the existing member's role or details if that's desired behavior
    // For now, we just return the existing member if found, or the new one if it was added.
    return mockCaseMembersDB.find(m => m.id === userId && m.caseId === caseId) || newMember;
  }
  return newMember;
};

export const removeCaseMember = async (caseId: string, userId: string): Promise<void> => {
  console.log(`[Mock API] Removing user ${userId} from case ${caseId}`);
  await new Promise(resolve => setTimeout(resolve, 500));

  const memberIndex = mockCaseMembersDB.findIndex(member => member.caseId === caseId && member.id === userId);

  if (memberIndex > -1) {
    const memberToRemove = mockCaseMembersDB[memberIndex];
    // Check if this user is the only owner in this specific case
    if (memberToRemove.roleInCase === 'owner') {
      const ownersInCase = mockCaseMembersDB.filter(m => m.caseId === caseId && m.roleInCase === 'owner');
      if (ownersInCase.length === 1) {
        console.warn(`[Mock API] Cannot remove the last owner (${userId}) from case ${caseId}.`);
        throw new Error('Cannot remove the last owner.');
      }
    }
    mockCaseMembersDB.splice(memberIndex, 1);
  } else {
    console.warn(`[Mock API] User ${userId} not found in case ${caseId} for removal.`);
    // Optionally, throw an error if the user not being found is problematic
    // throw new Error(`User ${userId} not found in case ${caseId}.`);
  }
  return;
};

// Mock service for searching users (to be used in Add Member Dialog)
// This would typically be in a userService.ts, but for simplicity in this subtask, it's here.
export interface SystemUser {
  id: string; // user recordId, e.g., "user:001"
  name: string;
  email?: string;
  avatarUrl?: string;
}

const mockSystemUsers: SystemUser[] = [
  { id: 'user:001', name: 'Alice Admin', email: 'alice@example.com', avatarUrl: 'https://i.pravatar.cc/150?u=alice@example.com' },
  { id: 'user:002', name: 'Bob Lawyer', email: 'bob@example.com', avatarUrl: 'https://i.pravatar.cc/150?u=bob@example.com' },
  { id: 'user:003', name: 'Charlie Owner', email: 'charlie@example.com', avatarUrl: 'https://i.pravatar.cc/150?u=charlie@example.com' },
  { id: 'user:004', name: 'David User', email: 'david@example.com', avatarUrl: 'https://i.pravatar.cc/150?u=david@example.com' },
  { id: 'user:005', name: 'Eve Member', email: 'eve@example.com', avatarUrl: 'https://i.pravatar.cc/150?u=eve@example.com' },
  { id: 'user:newSystemUser1', name: 'New User One', email: 'new1@example.com', avatarUrl: 'https://i.pravatar.cc/150?u=new1@example.com' },
  { id: 'user:newSystemUser2', name: 'New User Two (No Email)', avatarUrl: 'https://i.pravatar.cc/150?u=new2@example.com' },
];

export const searchSystemUsers = async (query: string): Promise<SystemUser[]> => {
  console.log(`[Mock API] Searching system users with query: ${query}`);
  await new Promise(resolve => setTimeout(resolve, 300));
  if (!query.trim()) {
    // Return all users if query is empty, or a subset, or none, depending on desired UX for empty search
    return mockSystemUsers; // Current: returns all users for empty search
  }
  return mockSystemUsers.filter(user =>
    user.name.toLowerCase().includes(query.toLowerCase()) ||
    (user.email && user.email.toLowerCase().includes(query.toLowerCase()))
  );
};

export const changeCaseOwner = async (caseId: string, newOwnerUserId: string, oldOwnerUserId: string): Promise<void> => {
  console.log(`[Mock API] Changing owner for case ${caseId}. New owner: ${newOwnerUserId}, Old owner: ${oldOwnerUserId}`);
  await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay

  // It's crucial to modify the actual objects in mockCaseMembersDB for changes to persist in the mock.
  let newOwnerFound = false;
  let oldOwnerDemoted = false;

  mockCaseMembersDB.forEach(member => {
    if (member.caseId === caseId) {
      if (member.id === newOwnerUserId) {
        if (member.roleInCase === 'owner') {
          // Target is already an owner, this shouldn't happen if UI is correct
          console.warn(`[Mock API] User ${newOwnerUserId} is already an owner of case ${caseId}. No change made to this user.`);
          // throw new Error('Target user is already an owner.'); // Or handle more gracefully
        }
        member.roleInCase = 'owner';
        newOwnerFound = true;
        console.log(`[Mock API] User ${newOwnerUserId} is now owner of case ${caseId}`);
      } else if (member.id === oldOwnerUserId) {
        if (member.roleInCase !== 'owner') {
          // This implies the current user (initiator) was not an owner, which UI should prevent.
          console.warn(`[Mock API] User ${oldOwnerUserId} was not an owner of case ${caseId}. Role changed to member anyway.`);
        }
        member.roleInCase = 'member'; // Demote old owner to member
        oldOwnerDemoted = true;
        console.log(`[Mock API] User ${oldOwnerUserId} is now member of case ${caseId}`);
      }
    }
  });

  if (!newOwnerFound) {
    console.error(`[Mock API] New owner (userId: ${newOwnerUserId}) not found in case ${caseId}.`);
    throw new Error('New potential owner not found in the case.');
  }
  if (!oldOwnerDemoted && oldOwnerUserId !== newOwnerUserId) { // oldOwnerUserId could be same if an admin is forcing an owner on a caseless user.
    // This case might be less critical if we allow an admin to force change owner,
    // but for user-initiated transfer, old owner must exist and be demoted.
    console.warn(`[Mock API] Old owner (userId: ${oldOwnerUserId}) was not found or not demoted in case ${caseId}. This might be an issue if it wasn't intended.`);
    // For a stricter mock, you might throw: throw new Error('Current owner not found or not demoted in the case.');
  }
  return;
};
