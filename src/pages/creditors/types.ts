import { RecordId } from 'surrealdb';

// Define Creditor type for clarity
export interface Creditor {
  id: RecordId | string; // RecordId or string e.g. "creditor:xxxx"
  type: '组织' | '个人';
  name: string;
  identifier: string;
  contact_person_name: string;
  contact_person_phone: string;
  address: string;
  case_id?: RecordId | string; // Added
  created_at?: string; // Added
  updated_at?: string; // Added
  total_claim_amount?: number; // 债权人在当前案件中的总债权金额
  claim_count?: number; // 债权人在当前案件中的债权数量
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

// Raw creditor data from database
export interface RawCreditorData {
  id: RecordId | string;
  type: 'organization' | 'individual';
  name: string;
  legal_id: string;
  contact_person_name: string;
  contact_phone: string;
  contact_address: string;
  case_id: RecordId | string;
  created_at?: string;
  updated_at?: string;
  total_claim_amount?: number; // 总债权金额
  claim_count?: number; // 债权数量
}

// Count query result type
export interface CountResult {
  total: number;
}

// CSV import row type
export interface CsvRowData {
  '类别': string;
  '名称': string;
  'ID/统一码': string;
  '联系人姓名': string;
  '联系方式': string;
  '地址': string;
  [key: string]: string | undefined;
}
