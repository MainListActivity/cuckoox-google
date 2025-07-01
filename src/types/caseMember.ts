import { RecordId } from 'surrealdb';

export interface Role {
  id: RecordId;
  name: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: any; // 添加索引签名以满足SurrealDB的类型约束
}

export interface CaseMember {
  id: RecordId; // This would typically be the user's ID (e.g. "user:001")
  caseId: RecordId; // RecordId of the case (e.g. "case:abc")
  roles: Role[]; // Array of role objects from user->has_case_role relations
  userName: string;
  userEmail?: string; // Optional
  avatarUrl?: string; // Optional: For displaying user avatars
}
