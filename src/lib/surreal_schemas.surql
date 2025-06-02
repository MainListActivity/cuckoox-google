-- ============================================================================
-- SurrealDB Schema for CuckooX Application
-- Version: 2.0
-- ============================================================================

-- ==========================
-- Core Tables
-- ==========================

-- Define Users Table
DEFINE TABLE user SCHEMAFULL
  PERMISSIONS
    FOR select FULL -- Kept simple as per instruction, access control via linked data
    FOR create, update, delete WHERE id = $auth.id OR ($auth.roles CONTAINS 'admin');

DEFINE FIELD github_id ON user TYPE string; -- Can be special value like '--admin--'
DEFINE FIELD name ON user TYPE string;
DEFINE FIELD email ON user TYPE option<string> ASSERT $value = NONE OR string::is::email($value);
DEFINE FIELD OVERWRITE created_at ON user TYPE datetime DEFAULT time::now() READONLY ASSERT $value != NONE;
DEFINE FIELD OVERWRITE updated_at ON user TYPE datetime VALUE time::now() READONLY ASSERT $value != NONE;
DEFINE FIELD last_login_case_id ON user TYPE option<record<case>>;

-- Define Cases Table
DEFINE TABLE case SCHEMAFULL
  PERMISSIONS
    FOR select WHERE ($auth.roles CONTAINS 'admin') OR
                      EXISTS(
                        SELECT value id FROM user_case_role WHERE user_id = $auth.id AND case_id = id LIMIT 1
                      )
    FOR create WHERE $auth.roles CONTAINS 'admin' OR $auth.roles CONTAINS 'case_manager' -- Example roles
    FOR update, delete WHERE $auth.roles CONTAINS 'admin' OR ($auth.roles CONTAINS 'case_manager' AND (created_by_user = $auth.id OR case_lead_user_id = $auth.id));

DEFINE FIELD name ON case TYPE string;
DEFINE FIELD case_number ON case TYPE string;
DEFINE FIELD case_manager_name ON case TYPE string;
DEFINE FIELD case_procedure ON case TYPE string DEFAULT '破产'; -- e.g. 破产, 和解, 重整
DEFINE FIELD acceptance_date ON case TYPE datetime;
DEFINE FIELD procedure_phase ON case TYPE string DEFAULT '立案'; -- e.g., '立案', '公告', '债权申报', '债权人第一次会议', '裁定重整', '提交重整计划', '延迟提交重整计划', '债权人第二次会议', '破产清算', '结案'
DEFINE FIELD created_by_user ON case TYPE record<user> DEFAULT $auth.id;
DEFINE FIELD case_lead_user_id ON case TYPE option<record<user>>; -- Renamed from admin_id
DEFINE FIELD filing_material_doc_id ON case TYPE option<record<document>>;
DEFINE FIELD announcement_date ON case TYPE option<datetime>;
DEFINE FIELD claim_submission_start_date ON case TYPE option<datetime>;
DEFINE FIELD claim_submission_end_date ON case TYPE option<datetime>;
DEFINE FIELD first_creditor_meeting_date ON case TYPE option<datetime>; -- ADDED
DEFINE FIELD second_creditor_meeting_date ON case TYPE option<datetime>; -- ADDED
DEFINE FIELD reorganization_ruling_date ON case TYPE option<datetime>;
DEFINE FIELD reorganization_plan_submission_date ON case TYPE option<datetime>;
DEFINE FIELD delayed_reorganization_plan_submission_date ON case TYPE option<datetime>;
DEFINE FIELD closing_date ON case TYPE option<datetime>;
DEFINE FIELD reorganization_ruling_announcement_doc_id ON case TYPE option<record<document>>;
DEFINE FIELD reorganization_plan_doc_id ON case TYPE option<record<document>>;
DEFINE FIELD selected_theme_name ON case TYPE option<string>; -- ADDED
DEFINE FIELD OVERWRITE created_at ON case TYPE datetime DEFAULT time::now() READONLY ASSERT $value != NONE;
DEFINE FIELD OVERWRITE updated_at ON case TYPE datetime VALUE time::now() READONLY ASSERT $value != NONE;
-- Removed 'status' and 'details' as per instruction, assuming covered by procedure_phase and specific doc links.

-- Define Roles Table
DEFINE TABLE role SCHEMAFULL
  PERMISSIONS
    FOR select FULL
    FOR create, update, delete WHERE $auth.roles CONTAINS 'admin';

DEFINE FIELD name ON role TYPE string ASSERT $value != NONE AND string::len($value) > 0;
DEFINE INDEX role_name_idx ON role COLUMNS name UNIQUE;
DEFINE FIELD description ON role TYPE option<string>;
DEFINE FIELD OVERWRITE created_at ON role TYPE datetime DEFAULT time::now() READONLY ASSERT $value != NONE;
DEFINE FIELD OVERWRITE updated_at ON role TYPE datetime VALUE time::now() READONLY ASSERT $value != NONE;

-- Define User Case Role Table (Link between users, cases, and their role in that case)
DEFINE TABLE user_case_role SCHEMAFULL
  PERMISSIONS
    FOR select WHERE $auth.roles CONTAINS 'admin' OR user_id = $auth.id OR case_id.case_lead_user_id = $auth.id OR case_id.created_by_user = $auth.id
    FOR create, update, delete WHERE $auth.roles CONTAINS 'admin' OR case_id.case_lead_user_id = $auth.id OR case_id.created_by_user = $auth.id;

DEFINE FIELD user_id ON user_case_role TYPE record<user>;
DEFINE FIELD case_id ON user_case_role TYPE record<case>;
DEFINE FIELD role_id ON user_case_role TYPE record<role>;
DEFINE FIELD assigned_at ON user_case_role TYPE datetime VALUE time::now();
DEFINE INDEX user_case_idx ON user_case_role COLUMNS user_id, case_id, role_id UNIQUE;

-- ==========================
-- Case Management Specific Tables
-- ==========================

-- Define Creditor Table
DEFINE TABLE creditor SCHEMAFULL
  PERMISSIONS
    FOR select WHERE $auth.roles CONTAINS 'admin' OR $auth.roles CONTAINS 'case_manager' OR ($auth.id = created_by AND case_id = $this.case_id) -- TODO: Refine based on user_case_role
    FOR create WHERE $auth.id
    FOR update, delete WHERE $auth.roles CONTAINS 'admin' OR ($auth.id = created_by AND case_id = $this.case_id);

DEFINE FIELD type ON creditor TYPE string ASSERT $value IN ['organization', 'individual'];
DEFINE FIELD name ON creditor TYPE string;
DEFINE FIELD legal_id ON creditor TYPE string; -- Company registration or personal ID
DEFINE FIELD contact_person_name ON creditor TYPE option<string>;
DEFINE FIELD contact_phone ON creditor TYPE option<string>;
DEFINE FIELD contact_email ON creditor TYPE option<string>;
DEFINE FIELD contact_address ON creditor TYPE option<string>;
DEFINE FIELD case_id ON creditor TYPE record<case>;
DEFINE FIELD OVERWRITE created_at ON creditor TYPE datetime DEFAULT time::now() READONLY ASSERT $value != NONE;
DEFINE FIELD OVERWRITE updated_at ON creditor TYPE datetime VALUE time::now() READONLY ASSERT $value != NONE;
DEFINE FIELD created_by ON creditor TYPE record<user> DEFAULT $auth.id;
DEFINE INDEX creditor_case_legal_id_idx ON creditor COLUMNS case_id, legal_id UNIQUE;

-- Define Claim Review Status Definition Table
DEFINE TABLE claim_review_status_definition SCHEMAFULL
  PERMISSIONS
    FOR select FULL
    FOR create, update, delete WHERE $auth.roles CONTAINS 'admin';

DEFINE FIELD name ON claim_review_status_definition TYPE string;
DEFINE INDEX claim_review_status_name_idx ON claim_review_status_definition COLUMNS name UNIQUE;
DEFINE FIELD description ON claim_review_status_definition TYPE option<string>;
DEFINE FIELD is_active ON claim_review_status_definition TYPE bool DEFAULT true;
DEFINE FIELD display_order ON claim_review_status_definition TYPE int DEFAULT 0;
DEFINE FIELD OVERWRITE created_at ON claim_review_status_definition TYPE datetime DEFAULT time::now() READONLY ASSERT $value != NONE;
DEFINE FIELD OVERWRITE updated_at ON claim_review_status_definition TYPE datetime VALUE time::now() READONLY ASSERT $value != NONE;

-- Define Claim Table
DEFINE TABLE claim SCHEMAFULL
  PERMISSIONS
    FOR select WHERE $auth.roles CONTAINS 'admin' OR $auth.roles CONTAINS 'case_manager' OR creditor_id.created_by = $auth.id OR created_by = $auth.id -- TODO: Refine
    FOR create WHERE $auth.id -- Typically creditor representative or case manager inputs this
    FOR update WHERE $auth.roles CONTAINS 'admin' OR ($auth.roles CONTAINS 'case_manager' AND review_status_id.name = '待审核') OR (created_by = $auth.id AND review_status_id.name = '待提交') -- Example logic
    FOR delete WHERE $auth.roles CONTAINS 'admin' OR (created_by = $auth.id AND review_status_id.name = '待提交');

DEFINE FIELD creditor_id ON claim TYPE record<creditor>;
DEFINE FIELD case_id ON claim TYPE record<case>;
DEFINE FIELD claim_number ON claim TYPE string; -- Should be unique per case, enforced by application
DEFINE FIELD asserted_claim_details ON claim TYPE object;
DEFINE FIELD asserted_claim_details.nature ON claim TYPE string;
DEFINE FIELD asserted_claim_details.principal ON claim TYPE decimal;
DEFINE FIELD asserted_claim_details.interest ON claim TYPE decimal;
DEFINE FIELD asserted_claim_details.other_amount ON claim TYPE option<decimal>;
DEFINE FIELD asserted_claim_details.total_asserted_amount ON claim TYPE decimal;
DEFINE FIELD asserted_claim_details.attachment_doc_id ON claim TYPE record<document>;
DEFINE FIELD asserted_claim_details.currency ON claim TYPE string DEFAULT 'CNY'; -- ADDED
DEFINE FIELD asserted_claim_details.brief_description ON claim TYPE option<string>; -- ADDED

DEFINE FIELD approved_claim_details ON claim TYPE option<object>;
DEFINE FIELD approved_claim_details.nature ON claim TYPE string;
DEFINE FIELD approved_claim_details.principal ON claim TYPE decimal;
DEFINE FIELD approved_claim_details.interest ON claim TYPE decimal;
DEFINE FIELD approved_claim_details.other_amount ON claim TYPE option<decimal>;
DEFINE FIELD approved_claim_details.total_approved_amount ON claim TYPE decimal;
DEFINE FIELD approved_claim_details.approved_attachment_doc_id ON claim TYPE option<record<document>>;
DEFINE FIELD approved_claim_details.currency ON claim TYPE string DEFAULT 'CNY'; -- ADDED
DEFINE FIELD reviewer_id ON claim TYPE option<record<user>>;
DEFINE FIELD review_status_id ON claim TYPE option<record<claim_review_status_definition>>;
DEFINE FIELD review_time ON claim TYPE option<datetime>;
DEFINE FIELD submission_time ON claim TYPE datetime VALUE $before OR time::now();
DEFINE FIELD OVERWRITE created_at ON claim TYPE datetime DEFAULT time::now() READONLY ASSERT $value != NONE;
DEFINE FIELD OVERWRITE updated_at ON claim TYPE datetime VALUE time::now() READONLY ASSERT $value != NONE;
DEFINE FIELD created_by ON claim TYPE record<user> DEFAULT $auth.id;
DEFINE FIELD comments_doc_id ON claim TYPE option<record<document>>; -- For general review discussion
DEFINE FIELD review_comments ON claim TYPE option<string>; -- ADDED for review notes
DEFINE FIELD status ON claim TYPE string DEFAULT '草稿'; -- ADDED: 草稿, 待审核, etc.
DEFINE INDEX claim_case_number_idx ON claim COLUMNS case_id, claim_number UNIQUE;
DEFINE INDEX claim_case_creditor_idx ON claim COLUMNS case_id, creditor_id;
DEFINE INDEX claim_case_status_idx ON claim COLUMNS case_id, review_status_id;


-- ==========================
-- Document and Communication Tables
-- ==========================

-- Define Document Table (for QuillJS content, S3 file links, etc.)
DEFINE TABLE document SCHEMAFULL
  PERMISSIONS
    FOR select FULL -- Permissions often context-dependent, e.g., linked from a case or claim
    FOR create WHERE $auth.id -- Any authenticated user can create a document
    FOR update WHERE $auth.id = created_by OR $auth.roles CONTAINS 'admin' -- More complex logic might be needed
    FOR delete WHERE $auth.id = created_by OR $auth.roles CONTAINS 'admin';

DEFINE FIELD content ON document TYPE option<string>; -- Stores HTML, JSON (Quill Delta), or reference to S3 for large files
DEFINE FIELD original_file_name ON document TYPE option<string>; -- If it's an uploaded file
DEFINE FIELD s3_object_key ON document TYPE option<string>;    -- Key for S3 object if stored there
DEFINE FIELD file_size ON document TYPE option<int>;           -- File size in bytes
DEFINE FIELD mime_type ON document TYPE option<string>;        -- MIME type of the file
DEFINE FIELD OVERWRITE created_at ON document TYPE datetime DEFAULT time::now() READONLY ASSERT $value != NONE;
DEFINE FIELD OVERWRITE updated_at ON document TYPE datetime VALUE time::now() READONLY ASSERT $value != NONE;
DEFINE FIELD created_by ON document TYPE record<user> DEFAULT $auth.id;
DEFINE FIELD last_edited_by ON document TYPE option<record<user>>;
DEFINE FIELD version ON document TYPE int DEFAULT 1;
DEFINE FIELD locked_by ON document TYPE option<record<user>>;
DEFINE FIELD locked_at ON document TYPE option<datetime>;

-- Define Document Comment Table
DEFINE TABLE document_comment SCHEMAFULL
  PERMISSIONS
    FOR select WHERE $auth.id -- Further context through document_id
    FOR create WHERE $auth.id
    FOR update, delete WHERE $auth.id = user_id OR $auth.roles CONTAINS 'admin';

DEFINE FIELD document_id ON document_comment TYPE record<document>;
DEFINE FIELD user_id ON document_comment TYPE record<user> DEFAULT $auth.id;
DEFINE FIELD comment_text ON document_comment TYPE string;
DEFINE FIELD selection_details ON document_comment TYPE option<object>; -- e.g., { type: 'text', start: 10, length: 5 }
DEFINE FIELD OVERWRITE created_at ON document_comment TYPE datetime DEFAULT time::now() READONLY ASSERT $value != NONE;
DEFINE FIELD OVERWRITE updated_at ON document_comment TYPE datetime VALUE time::now() READONLY ASSERT $value != NONE;
DEFINE FIELD resolved_at ON document_comment TYPE option<datetime>;
DEFINE FIELD resolved_by ON document_comment TYPE option<record<user>>;
DEFINE INDEX doc_comment_doc_idx ON document_comment COLUMNS document_id;

-- Define Meeting Table
DEFINE TABLE meeting SCHEMAFULL
  PERMISSIONS
    FOR select WHERE $auth.roles CONTAINS 'admin' OR $auth.roles CONTAINS 'case_manager' -- TODO: Refine with user_case_role
    FOR create, update, delete WHERE $auth.roles CONTAINS 'admin' OR $auth.roles CONTAINS 'case_manager';

DEFINE FIELD case_id ON meeting TYPE record<case>;
DEFINE FIELD meeting_name ON meeting TYPE string; -- ADDED
DEFINE FIELD meeting_type ON meeting TYPE string; -- e.g., 'FIRST_CREDITOR_MEETING', 'SECOND_CREDITOR_MEETING', 'INTERNAL_MEETING'
DEFINE FIELD scheduled_start_date ON meeting TYPE datetime;
DEFINE FIELD scheduled_end_date ON meeting TYPE datetime; -- ADDED
DEFINE FIELD status ON meeting TYPE string DEFAULT 'SCHEDULED'; -- e.g., 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'POSTPONED'
DEFINE FIELD meeting_agenda ON meeting TYPE option<string>; -- ADDED
DEFINE FIELD meeting_link ON meeting TYPE option<string>; -- ADDED for online meeting URL
DEFINE FIELD meeting_record_doc_id ON meeting TYPE option<record<document>>; -- For minutes or recordings
DEFINE FIELD participants ON meeting TYPE option<array<record<user>>>; -- ADDED
DEFINE FIELD OVERWRITE created_at ON meeting TYPE datetime DEFAULT time::now() READONLY ASSERT $value != NONE;
DEFINE FIELD OVERWRITE updated_at ON meeting TYPE datetime VALUE time::now() READONLY ASSERT $value != NONE;
DEFINE FIELD created_by ON meeting TYPE record<user> DEFAULT $auth.id;
DEFINE INDEX meeting_case_idx ON meeting COLUMNS case_id;

-- Define Message Table (For IM and system reminders)
DEFINE TABLE message SCHEMAFULL
  PERMISSIONS
    FOR select WHERE $auth.id = sender_id OR $auth.id = receiver_id OR ($auth.roles CONTAINS 'admin') OR ($auth.roles CONTAINS 'case_manager' AND case_id = $this.case_id)
    FOR create WHERE $auth.id = sender_id OR ($auth.roles CONTAINS 'admin' AND sender_id = 'system') -- System can send messages
    FOR update, delete WHERE $auth.id = sender_id OR $auth.roles CONTAINS 'admin'; -- Generally messages are immutable, but admin might need to delete

DEFINE FIELD chat_id ON message TYPE string; -- e.g., 'case:<uuid>', 'user_pair:<user1_uuid>_<user2_uuid>', 'user:<user_uuid_for_system_reminders>'
DEFINE FIELD sender_id ON message TYPE string; -- e.g., 'user:<uuid>', 'system:notifications', 'bot:case_<case_uuid>'
DEFINE FIELD receiver_id ON message TYPE option<string>; -- e.g., 'user:<uuid>' for DMs, null for group/case chats
DEFINE FIELD content ON message TYPE any; -- Flexible: text, JSON for cards, etc.
DEFINE FIELD message_type ON message TYPE string DEFAULT 'USER_CHAT'; -- e.g., 'USER_CHAT', 'SYSTEM_REMINDER', 'BOT_MESSAGE', 'FILE_UPLOAD'
DEFINE FIELD case_id ON message TYPE option<record<case>>; -- Link to case if relevant
DEFINE FIELD OVERWRITE created_at ON message TYPE datetime DEFAULT time::now() READONLY ASSERT $value != NONE;
DEFINE FIELD OVERWRITE updated_at ON message TYPE datetime VALUE time::now() READONLY ASSERT $value != NONE;
DEFINE FIELD read_at ON message TYPE option<datetime>; -- Simplified: last read time by receiver (for DMs). Groups need per-user status.
DEFINE INDEX message_chat_created_idx ON message COLUMNS chat_id, created_at;
DEFINE INDEX message_case_created_idx ON message COLUMNS case_id, created_at;

-- ==========================
-- Configuration & System Tables
-- ==========================

-- Define Permissions Table (More granular, if needed beyond simple role names)
DEFINE TABLE permission SCHEMAFULL
  PERMISSIONS
    FOR select FULL
    FOR create, update, delete WHERE $auth.roles CONTAINS 'admin';

DEFINE FIELD action ON permission TYPE string; -- e.g., 'create', 'read', 'update', 'delete'
DEFINE FIELD resource ON permission TYPE string; -- e.g., 'case', 'document', 'claim'
DEFINE FIELD OVERWRITE created_at ON permission TYPE datetime DEFAULT time::now() READONLY ASSERT $value != NONE;
DEFINE INDEX permission_idx ON permission COLUMNS action, resource UNIQUE;

-- Define Role Permission Table (Link roles to granular permissions)
DEFINE TABLE role_permission SCHEMAFULL
  PERMISSIONS
    FOR select FULL
    FOR create, update, delete WHERE $auth.roles CONTAINS 'admin';

DEFINE FIELD role_id ON role_permission TYPE record<role>;
DEFINE FIELD permission_id ON role_permission TYPE record<permission>;
DEFINE FIELD assigned_at ON role_permission TYPE datetime VALUE time::now();
DEFINE INDEX role_permission_idx ON role_permission COLUMNS role_id, permission_id UNIQUE;

-- Define Menu Items Table
DEFINE TABLE menu_item SCHEMAFULL
  PERMISSIONS
    FOR select FULL
    FOR create, update, delete WHERE $auth.roles CONTAINS 'admin';

DEFINE FIELD path ON menu_item TYPE string; -- e.g., '/dashboard', '/cases'
DEFINE INDEX menu_item_path_idx ON menu_item COLUMNS path UNIQUE;
DEFINE FIELD label_key ON menu_item TYPE string; -- Translation key, e.g., 'menu.dashboard', 'menu.cases'
DEFINE FIELD icon ON menu_item TYPE option<string>; -- e.g., 'dashboard', 'gavel'
DEFINE FIELD parent_id ON menu_item TYPE option<record<menu_item>>; -- For sub-menus
DEFINE FIELD display_order ON menu_item TYPE int DEFAULT 0;
DEFINE FIELD required_permission ON menu_item TYPE option<record<permission>>; -- Optional link to a specific permission
DEFINE FIELD OVERWRITE created_at ON menu_item TYPE datetime DEFAULT time::now() READONLY ASSERT $value != NONE;
DEFINE FIELD OVERWRITE updated_at ON menu_item TYPE datetime VALUE time::now() READONLY ASSERT $value != NONE;

-- Define Role Menu Item Table (Link roles to menu items they can see)
-- This table can be used if menu visibility isn't solely driven by permissions on resources.
DEFINE TABLE role_menu_item SCHEMAFULL
  PERMISSIONS
    FOR select FULL
    FOR create, update, delete WHERE $auth.roles CONTAINS 'admin';

DEFINE FIELD role_id ON role_menu_item TYPE record<role>;
DEFINE FIELD menu_item_id ON role_menu_item TYPE record<menu_item>;
DEFINE FIELD assigned_at ON role_menu_item TYPE datetime VALUE time::now();
DEFINE INDEX role_menu_item_idx ON role_menu_item COLUMNS role_id, menu_item_id UNIQUE;


-- Define Case Bot Subscription Table
DEFINE TABLE case_bot_subscription SCHEMAFULL
  PERMISSIONS
    FOR select WHERE user_id = $auth.id OR $auth.roles CONTAINS 'admin'
    FOR create, delete WHERE user_id = $auth.id OR $auth.roles CONTAINS 'admin';

DEFINE FIELD user_id ON case_bot_subscription TYPE record<user>;
DEFINE FIELD case_id ON case_bot_subscription TYPE record<case>;
DEFINE FIELD subscribed_at ON case_bot_subscription TYPE datetime VALUE time::now();
DEFINE INDEX user_case_subscription_idx ON case_bot_subscription COLUMNS user_id, case_id UNIQUE;

-- Define Notification Rule Table (for case bot reminders)
DEFINE TABLE notification_rule SCHEMAFULL
  PERMISSIONS
    FOR select FULL
    FOR create, update, delete WHERE $auth.roles CONTAINS 'admin';

DEFINE FIELD procedure_phase ON notification_rule TYPE string; -- e.g., '立案', '公告', etc.
DEFINE FIELD trigger_condition ON notification_rule TYPE string; -- e.g., 'acceptance_date + 25 days - now() <= 5'
DEFINE FIELD notification_frequency ON notification_rule TYPE string DEFAULT 'DAILY'; -- e.g., 'DAILY', 'ONCE'
DEFINE FIELD notification_time ON notification_rule TYPE string DEFAULT '10:00'; -- e.g., '10:00' for 10 AM
DEFINE FIELD message_template ON notification_rule TYPE string; -- e.g., '距离最迟公告时间仅有 {days} 天'
DEFINE FIELD is_active ON notification_rule TYPE bool DEFAULT true;
DEFINE FIELD OVERWRITE created_at ON notification_rule TYPE datetime DEFAULT time::now() READONLY ASSERT $value != NONE;
DEFINE FIELD OVERWRITE updated_at ON notification_rule TYPE datetime VALUE time::now() READONLY ASSERT $value != NONE;
DEFINE INDEX notification_rule_phase_idx ON notification_rule COLUMNS procedure_phase;

-- Define Document Version Table (for tracking document history)
DEFINE TABLE document_version SCHEMAFULL
  PERMISSIONS
    FOR select WHERE $auth.id -- Access controlled through parent document
    FOR create WHERE $auth.id
    FOR update, delete WHERE $auth.roles CONTAINS 'admin'; -- Versions should be immutable

DEFINE FIELD document_id ON document_version TYPE record<document>;
DEFINE FIELD version_number ON document_version TYPE int;
DEFINE FIELD content ON document_version TYPE string; -- Snapshot of content at this version
DEFINE FIELD change_summary ON document_version TYPE option<string>;
DEFINE FIELD created_by ON document_version TYPE record<user>;
DEFINE FIELD OVERWRITE created_at ON document_version TYPE datetime DEFAULT time::now() READONLY ASSERT $value != NONE;
DEFINE INDEX doc_version_idx ON document_version COLUMNS document_id, version_number UNIQUE;

-- Define Claim Nature Definition Table (for dropdown options)
DEFINE TABLE claim_nature_definition SCHEMAFULL
  PERMISSIONS
    FOR select FULL
    FOR create, update, delete WHERE $auth.roles CONTAINS 'admin';

DEFINE FIELD name ON claim_nature_definition TYPE string;
DEFINE INDEX claim_nature_name_idx ON claim_nature_definition COLUMNS name UNIQUE;
DEFINE FIELD description ON claim_nature_definition TYPE option<string>;
DEFINE FIELD is_active ON claim_nature_definition TYPE bool DEFAULT true;
DEFINE FIELD display_order ON claim_nature_definition TYPE int DEFAULT 0;
DEFINE FIELD OVERWRITE created_at ON claim_nature_definition TYPE datetime DEFAULT time::now() READONLY ASSERT $value != NONE;
DEFINE FIELD OVERWRITE updated_at ON claim_nature_definition TYPE datetime VALUE time::now() READONLY ASSERT $value != NONE;


-- ==========================
-- Seed Data (Optional Examples - typically run manually or via a script)
-- ==========================
/*
-- Example Roles
INSERT INTO role (name, description) VALUES 
  ('admin', 'System Administrator with full access'),
  ('case_manager', 'Manages specific bankruptcy cases'),
  ('creditor_representative', 'Represents a creditor, can submit and view claims for their organization'),
  ('debtor_representative', 'Represents the debtor company/individual'),
  ('viewer', 'Read-only access to certain case information');

-- Example Claim Review Statuses
INSERT INTO claim_review_status_definition (name, description, display_order) VALUES
  ('待提交', 'Claim saved but not yet submitted by creditor representative.', 0),
  ('待审核', 'Claim submitted by creditor, pending review by case manager.', 1),
  ('审核中', 'Case manager is actively reviewing the claim.', 2),
  ('补充材料', 'Further materials or clarifications required from creditor.', 3),
  ('已确认', 'Claim approved by case manager.', 4),
  ('部分确认', 'Claim partially approved by case manager.', 5),
  ('未确认', 'Claim rejected by case manager.', 6),
  ('异议处理中', 'Objection raised against the claim, under resolution.', 7);

-- Example Claim Natures
INSERT INTO claim_nature_definition (name, description, display_order) VALUES
  ('普通债权', 'General unsecured claims', 0),
  ('有财产担保债权', 'Secured claims with property collateral', 1),
  ('劳动报酬', 'Employee wages and benefits', 2),
  ('税款债权', 'Tax claims', 3),
  ('其他优先债权', 'Other priority claims', 4);

-- Example Notification Rules (based on product document)
INSERT INTO notification_rule (procedure_phase, trigger_condition, message_template) VALUES
  ('立案', 'acceptance_date + 25 days - now() <= 5', '距离最迟公告时间仅有 {days} 天'),
  ('公告', 'announcement_date + 30 days - now() <= 3', '距离开始债权申报时间还有 {days} 天'),
  ('债权申报', 'announcement_date + 3 months - now() <= 3', '距离债权申报截止还有 {days} 天'),
  ('债权人第一次会议', 'claim_submission_end_date + 15 days - now() <= 3', '距离第一次债权人会议截止时间还有 {days} 天'),
  ('裁定重整', 'reorganization_ruling_date + 6 months - now() <= 5', '距离提交重整计划截止时间还有 {days} 天，超时未提交将宣告破产清算'),
  ('延迟提交重整计划', 'delayed_reorganization_plan_submission_date + 3 months - now() <= 5', '距离提交重整计划截止时间还有 {days} 天，超时未提交将宣告破产清算'),
  ('债权人第二次会议', 'reorganization_plan_submission_date + 15 days - now() <= 3', '距离第二次债权人会议通知截止时间还有 {days} 天');

-- Example Menu Items (label_key would be used for i18n)
INSERT INTO menu_item (path, label_key, icon, display_order) VALUES
  ('/dashboard', 'menu.dashboard', 'dashboard', 0),
  ('/cases', 'menu.cases', 'folder-open', 10),
  ('/creditors', 'menu.creditors', 'users', 20),
  ('/claims', 'menu.claims', 'file-text', 30),
  ('/claim-review', 'menu.claim_review', 'check-circle', 40),
  ('/claim-dashboard', 'menu.claim_dashboard', 'bar-chart', 50),
  ('/meetings', 'menu.meetings', 'calendar', 60),
  ('/messages', 'menu.messages', 'message-circle', 70),
  ('/admin/roles', 'menu.admin.roles', 'shield', 100),
  ('/admin/review-statuses', 'menu.admin.review_statuses', 'list', 110);

-- Example Sub-menu Items (needs separate INSERT for parent_id)
INSERT INTO menu_item (path, label_key, icon, display_order, parent_id) VALUES
  ('/cases/new', 'menu.cases.new', 'plus-circle', 0, (SELECT id FROM menu_item WHERE path = '/cases' LIMIT 1)),
  ('/claims/submit', 'menu.claims.submit', 'send', 0, (SELECT id FROM menu_item WHERE path = '/claims' LIMIT 1)),
  ('/claims/my-claims', 'menu.claims.my_claims', 'folder', 1, (SELECT id FROM menu_item WHERE path = '/claims' LIMIT 1));
*/

-- End of Schema --
