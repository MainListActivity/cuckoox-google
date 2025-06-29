import { RecordId } from 'surrealdb'; // Assuming RecordId is appropriately typed elsewhere or use string

export interface CaseMember {
  id: RecordId; // This would typically be the user's ID (e.g. "user:001")
  caseId: RecordId; // RecordId of the case (e.g. "case:abc")
  roleInCase: 'owner' | 'member';
  userName: string;
  userEmail?: string; // Optional
  avatarUrl?: string; // Optional: For displaying user avatars
}
