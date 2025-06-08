import { RecordId } from 'surrealdb';

// Define Creditor type for clarity
export interface Creditor {
  id: RecordId; // RecordId as string e.g. "creditor:xxxx"
  type: '组织' | '个人';
  name: string;
  identifier: string;
  contact_person_name: string;
  contact_person_phone: string;
  address: string;
  case_id?: RecordId; // Added
  created_at?: string; // Added
  updated_at?: string; // Added
}

// Form data type with camelCase property names for form handling
export type CreditorFormData = {
  id?: RecordId;
  category: string; // Maps to Creditor.type
  name: string;
  identifier: string;
  contactPersonName: string; // Maps to Creditor.contact_person_name
  contactInfo: string; // Maps to Creditor.contact_person_phone
  address: string;
};
