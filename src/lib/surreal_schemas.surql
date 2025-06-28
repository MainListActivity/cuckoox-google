-- ------------------------------
-- OPTION
-- ------------------------------

OPTION IMPORT;

-- ------------------------------
-- TABLE: case
-- ------------------------------

DEFINE TABLE case TYPE NORMAL SCHEMAFULL PERMISSIONS FOR select FULL, FOR create WHERE $auth.roles CONTAINS 'admin' OR $auth.roles CONTAINS 'case_manager', FOR update, delete WHERE $auth.roles CONTAINS 'admin' OR ($auth.roles CONTAINS 'case_manager' AND created_by_user = $auth.id OR case_lead_user_id = $auth.id);

DEFINE FIELD acceptance_date ON case TYPE datetime PERMISSIONS FULL;
DEFINE FIELD announcement_date ON case TYPE option<datetime> PERMISSIONS FULL;
DEFINE FIELD case_lead_user_id ON case TYPE option<record<user>> PERMISSIONS FULL;
DEFINE FIELD case_manager_name ON case TYPE string PERMISSIONS FULL;
DEFINE FIELD case_number ON case TYPE string PERMISSIONS FULL;
DEFINE FIELD case_procedure ON case TYPE string DEFAULT '破产' PERMISSIONS FULL;
DEFINE FIELD claim_submission_end_date ON case TYPE option<datetime> PERMISSIONS FULL;
DEFINE FIELD claim_submission_start_date ON case TYPE option<datetime> PERMISSIONS FULL;
DEFINE FIELD closing_date ON case TYPE option<datetime> PERMISSIONS FULL;
DEFINE FIELD created_at ON case TYPE datetime DEFAULT time::now() READONLY ASSERT $value != NONE PERMISSIONS FULL;
DEFINE FIELD created_by_user ON case TYPE record<user> DEFAULT $auth.id PERMISSIONS FULL;
DEFINE FIELD delayed_reorganization_plan_submission_date ON case TYPE option<datetime> PERMISSIONS FULL;
DEFINE FIELD filing_material_doc_id ON case TYPE option<record<document>> PERMISSIONS FULL;
DEFINE FIELD first_creditor_meeting_date ON case TYPE option<datetime> PERMISSIONS FULL;
DEFINE FIELD name ON case TYPE string PERMISSIONS FULL;
DEFINE FIELD procedure_phase ON case TYPE string DEFAULT '立案' PERMISSIONS FULL;
DEFINE FIELD reorganization_plan_doc_id ON case TYPE option<record<document>> PERMISSIONS FULL;
DEFINE FIELD reorganization_plan_submission_date ON case TYPE option<datetime> PERMISSIONS FULL;
DEFINE FIELD reorganization_ruling_announcement_doc_id ON case TYPE option<record<document>> PERMISSIONS FULL;
DEFINE FIELD reorganization_ruling_date ON case TYPE option<datetime> PERMISSIONS FULL;
DEFINE FIELD second_creditor_meeting_date ON case TYPE option<datetime> PERMISSIONS FULL;
DEFINE FIELD selected_theme_name ON case TYPE option<string> PERMISSIONS FULL;
DEFINE FIELD updated_at ON case TYPE datetime READONLY VALUE time::now() ASSERT $value != NONE PERMISSIONS FULL;



-- ------------------------------
-- TABLE: case_bot_subscription
-- ------------------------------

DEFINE TABLE case_bot_subscription TYPE NORMAL SCHEMAFULL PERMISSIONS FOR select, create, delete WHERE user_id = $auth.id OR $auth.roles CONTAINS 'admin', FOR update NONE;

DEFINE FIELD case_id ON case_bot_subscription TYPE record<case> PERMISSIONS FULL;
DEFINE FIELD subscribed_at ON case_bot_subscription TYPE datetime VALUE time::now() PERMISSIONS FULL;
DEFINE FIELD user_id ON case_bot_subscription TYPE record<user> PERMISSIONS FULL;

DEFINE INDEX user_case_subscription_idx ON case_bot_subscription FIELDS user_id, case_id UNIQUE;


-- ------------------------------
-- TABLE: claim
-- ------------------------------

DEFINE TABLE claim TYPE NORMAL SCHEMAFULL PERMISSIONS FOR select WHERE $auth.roles CONTAINS 'admin' OR $auth.roles CONTAINS 'case_manager' OR creditor_id.created_by = $auth.id OR created_by = $auth.id, FOR create WHERE $auth.id, FOR update WHERE $auth.roles CONTAINS 'admin' OR ($auth.roles CONTAINS 'case_manager' AND review_status_id.name = '待审核') OR (created_by = $auth.id AND review_status_id.name = '待提交'), FOR delete WHERE $auth.roles CONTAINS 'admin' OR (created_by = $auth.id AND review_status_id.name = '待提交');

DEFINE FIELD approved_claim_details ON claim TYPE option<object> PERMISSIONS FULL;
DEFINE FIELD approved_claim_details.approved_attachment_doc_id ON claim TYPE option<record<document>> PERMISSIONS FULL;
DEFINE FIELD approved_claim_details.currency ON claim TYPE string DEFAULT 'CNY' PERMISSIONS FULL;
DEFINE FIELD approved_claim_details.interest ON claim TYPE decimal PERMISSIONS FULL;
DEFINE FIELD approved_claim_details.nature ON claim TYPE string PERMISSIONS FULL;
DEFINE FIELD approved_claim_details.other_amount ON claim TYPE option<decimal> PERMISSIONS FULL;
DEFINE FIELD approved_claim_details.principal ON claim TYPE decimal PERMISSIONS FULL;
DEFINE FIELD approved_claim_details.total_approved_amount ON claim TYPE decimal PERMISSIONS FULL;
DEFINE FIELD asserted_claim_details ON claim TYPE object PERMISSIONS FULL;
DEFINE FIELD asserted_claim_details.attachment_doc_id ON claim TYPE record<document> PERMISSIONS FULL;
DEFINE FIELD asserted_claim_details.brief_description ON claim TYPE option<string> PERMISSIONS FULL;
DEFINE FIELD asserted_claim_details.currency ON claim TYPE string DEFAULT 'CNY' PERMISSIONS FULL;
DEFINE FIELD asserted_claim_details.interest ON claim TYPE decimal PERMISSIONS FULL;
DEFINE FIELD asserted_claim_details.nature ON claim TYPE string PERMISSIONS FULL;
DEFINE FIELD asserted_claim_details.other_amount ON claim TYPE option<decimal> PERMISSIONS FULL;
DEFINE FIELD asserted_claim_details.principal ON claim TYPE decimal PERMISSIONS FULL;
DEFINE FIELD asserted_claim_details.total_asserted_amount ON claim TYPE decimal PERMISSIONS FULL;
DEFINE FIELD case_id ON claim TYPE record<case> PERMISSIONS FULL;
DEFINE FIELD claim_number ON claim TYPE string PERMISSIONS FULL;
DEFINE FIELD comments_doc_id ON claim TYPE option<record<document>> PERMISSIONS FULL;
DEFINE FIELD created_at ON claim TYPE datetime DEFAULT time::now() READONLY ASSERT $value != NONE PERMISSIONS FULL;
DEFINE FIELD created_by ON claim TYPE record<user> VALUE $auth.id PERMISSIONS FULL;
DEFINE FIELD creditor_id ON claim TYPE record<creditor> PERMISSIONS FULL;
DEFINE FIELD review_comments ON claim TYPE option<string> PERMISSIONS FULL;
DEFINE FIELD review_status_id ON claim TYPE option<record<claim_review_status_definition>> PERMISSIONS FULL;
DEFINE FIELD review_time ON claim TYPE option<datetime> PERMISSIONS FULL;
DEFINE FIELD reviewer_id ON claim TYPE option<record<user>> PERMISSIONS FULL;
DEFINE FIELD status ON claim TYPE string DEFAULT '草稿' PERMISSIONS FULL;
DEFINE FIELD submission_time ON claim TYPE datetime VALUE $before OR time::now() PERMISSIONS FULL;
DEFINE FIELD updated_at ON claim TYPE datetime READONLY VALUE time::now() ASSERT $value != NONE PERMISSIONS FULL;

DEFINE INDEX claim_case_creditor_idx ON claim FIELDS case_id, creditor_id;
DEFINE INDEX claim_case_number_idx ON claim FIELDS case_id, claim_number UNIQUE;
DEFINE INDEX claim_case_status_idx ON claim FIELDS case_id, review_status_id;


-- ------------------------------
-- TABLE: claim_nature_definition
-- ------------------------------

DEFINE TABLE claim_nature_definition TYPE NORMAL SCHEMAFULL PERMISSIONS FOR select FULL, FOR create, update, delete WHERE $auth.roles CONTAINS 'admin';

DEFINE FIELD created_at ON claim_nature_definition TYPE datetime DEFAULT time::now() READONLY ASSERT $value != NONE PERMISSIONS FULL;
DEFINE FIELD description ON claim_nature_definition TYPE option<string> PERMISSIONS FULL;
DEFINE FIELD display_order ON claim_nature_definition TYPE int DEFAULT 0 PERMISSIONS FULL;
DEFINE FIELD is_active ON claim_nature_definition TYPE bool DEFAULT true PERMISSIONS FULL;
DEFINE FIELD name ON claim_nature_definition TYPE string PERMISSIONS FULL;
DEFINE FIELD updated_at ON claim_nature_definition TYPE datetime READONLY VALUE time::now() ASSERT $value != NONE PERMISSIONS FULL;

DEFINE INDEX claim_nature_name_idx ON claim_nature_definition FIELDS name UNIQUE;


-- ------------------------------
-- TABLE: claim_review_status_definition
-- ------------------------------

DEFINE TABLE claim_review_status_definition TYPE NORMAL SCHEMAFULL PERMISSIONS FOR select FULL, FOR create, update, delete WHERE $auth.roles CONTAINS 'admin';

DEFINE FIELD created_at ON claim_review_status_definition TYPE datetime DEFAULT time::now() READONLY ASSERT $value != NONE PERMISSIONS FULL;
DEFINE FIELD description ON claim_review_status_definition TYPE option<string> PERMISSIONS FULL;
DEFINE FIELD display_order ON claim_review_status_definition TYPE int DEFAULT 0 PERMISSIONS FULL;
DEFINE FIELD is_active ON claim_review_status_definition TYPE bool DEFAULT true PERMISSIONS FULL;
DEFINE FIELD name ON claim_review_status_definition TYPE string PERMISSIONS FULL;
DEFINE FIELD updated_at ON claim_review_status_definition TYPE datetime READONLY VALUE time::now() ASSERT $value != NONE PERMISSIONS FULL;

DEFINE INDEX claim_review_status_name_idx ON claim_review_status_definition FIELDS name UNIQUE;


-- ------------------------------
-- TABLE: creditor
-- ------------------------------

DEFINE TABLE creditor TYPE NORMAL SCHEMAFULL PERMISSIONS FOR select WHERE $auth.roles CONTAINS 'admin' OR $auth.roles CONTAINS 'case_manager' OR ($auth.id = created_by AND case_id = $this.case_id), FOR create WHERE $auth.id, FOR update, delete WHERE $auth.roles CONTAINS 'admin' OR ($auth.id = created_by AND case_id = $this.case_id);

DEFINE FIELD case_id ON creditor TYPE record<case> PERMISSIONS FULL;
DEFINE FIELD contact_address ON creditor TYPE option<string> PERMISSIONS FULL;
DEFINE FIELD contact_email ON creditor TYPE option<string> PERMISSIONS FULL;
DEFINE FIELD contact_person_name ON creditor TYPE option<string> PERMISSIONS FULL;
DEFINE FIELD contact_phone ON creditor TYPE option<string> PERMISSIONS FULL;
DEFINE FIELD created_at ON creditor TYPE datetime DEFAULT time::now() READONLY ASSERT $value != NONE PERMISSIONS FULL;
DEFINE FIELD created_by ON creditor TYPE record<user> VALUE $auth.id PERMISSIONS FULL;
DEFINE FIELD legal_id ON creditor TYPE string PERMISSIONS FULL;
DEFINE FIELD name ON creditor TYPE string PERMISSIONS FULL;
DEFINE FIELD type ON creditor TYPE string ASSERT $value INSIDE ['organization', 'individual'] PERMISSIONS FULL;
DEFINE FIELD updated_at ON creditor TYPE datetime READONLY VALUE time::now() ASSERT $value != NONE PERMISSIONS FULL;

DEFINE INDEX creditor_case_legal_id_idx ON creditor FIELDS case_id, legal_id UNIQUE;


-- ------------------------------
-- TABLE: cursor
-- ------------------------------

DEFINE TABLE cursor TYPE ANY SCHEMALESS PERMISSIONS NONE;




-- ------------------------------
-- TABLE: delta
-- ------------------------------

DEFINE TABLE delta TYPE ANY SCHEMALESS PERMISSIONS FULL;




-- ------------------------------
-- TABLE: document
-- ------------------------------

DEFINE TABLE document TYPE NORMAL SCHEMALESS PERMISSIONS FOR select, create FULL, FOR update, delete WHERE $auth.id = created_by OR $auth.roles CONTAINS 'admin';

DEFINE FIELD created_at ON document TYPE datetime DEFAULT time::now() READONLY ASSERT $value != NONE PERMISSIONS FULL;
DEFINE FIELD created_by ON document TYPE record<user> READONLY VALUE user:root PERMISSIONS FULL;
DEFINE FIELD file_size ON document TYPE option<int> PERMISSIONS FULL;
DEFINE FIELD last_edited_by ON document TYPE option<record<user>> PERMISSIONS FULL;
DEFINE FIELD locked_at ON document TYPE option<datetime> PERMISSIONS FULL;
DEFINE FIELD locked_by ON document TYPE option<record<user>> PERMISSIONS FULL;
DEFINE FIELD mime_type ON document TYPE option<string> PERMISSIONS FULL;
DEFINE FIELD original_file_name ON document TYPE option<string> PERMISSIONS FULL;
DEFINE FIELD s3_object_key ON document TYPE option<string> PERMISSIONS FULL;
DEFINE FIELD updated_at ON document TYPE datetime VALUE time::now() ASSERT $value != NONE PERMISSIONS FULL;
DEFINE FIELD version ON document TYPE int DEFAULT 1 PERMISSIONS FULL;


-- ------------------------------
-- TABLE: document_comment
-- ------------------------------

DEFINE TABLE document_comment TYPE NORMAL SCHEMAFULL PERMISSIONS FOR select, create WHERE $auth.id, FOR update, delete WHERE $auth.id = user_id OR $auth.roles CONTAINS 'admin';

DEFINE FIELD comment_text ON document_comment TYPE string PERMISSIONS FULL;
DEFINE FIELD created_at ON document_comment TYPE datetime DEFAULT time::now() READONLY ASSERT $value != NONE PERMISSIONS FULL;
DEFINE FIELD document_id ON document_comment TYPE record<document> PERMISSIONS FULL;
DEFINE FIELD resolved_at ON document_comment TYPE option<datetime> PERMISSIONS FULL;
DEFINE FIELD resolved_by ON document_comment TYPE option<record<user>> PERMISSIONS FULL;
DEFINE FIELD selection_details ON document_comment TYPE option<object> PERMISSIONS FULL;
DEFINE FIELD updated_at ON document_comment TYPE datetime READONLY VALUE time::now() ASSERT $value != NONE PERMISSIONS FULL;
DEFINE FIELD user_id ON document_comment TYPE record<user> DEFAULT $auth.id PERMISSIONS FULL;

DEFINE INDEX doc_comment_doc_idx ON document_comment FIELDS document_id;


-- ------------------------------
-- TABLE: document_version
-- ------------------------------

DEFINE TABLE document_version TYPE NORMAL SCHEMAFULL PERMISSIONS FOR select, create WHERE $auth.id, FOR update, delete WHERE $auth.roles CONTAINS 'admin';

DEFINE FIELD change_summary ON document_version TYPE option<string> PERMISSIONS FULL;
DEFINE FIELD content ON document_version TYPE string PERMISSIONS FULL;
DEFINE FIELD created_at ON document_version TYPE datetime DEFAULT time::now() READONLY ASSERT $value != NONE PERMISSIONS FULL;
DEFINE FIELD created_by ON document_version TYPE record<user> PERMISSIONS FULL;
DEFINE FIELD document_id ON document_version TYPE record<document> PERMISSIONS FULL;
DEFINE FIELD version_number ON document_version TYPE int PERMISSIONS FULL;

DEFINE INDEX doc_version_idx ON document_version FIELDS document_id, version_number UNIQUE;


-- ------------------------------
-- TABLE: meeting
-- ------------------------------

DEFINE TABLE meeting TYPE NORMAL SCHEMAFULL PERMISSIONS FOR select, create, update, delete WHERE $auth.roles CONTAINS 'admin' OR $auth.roles CONTAINS 'case_manager';

DEFINE FIELD case_id ON meeting TYPE record<case> PERMISSIONS FULL;
DEFINE FIELD created_at ON meeting TYPE datetime DEFAULT time::now() READONLY ASSERT $value != NONE PERMISSIONS FULL;
DEFINE FIELD created_by ON meeting TYPE record<user> VALUE $auth.id PERMISSIONS FULL;
DEFINE FIELD meeting_agenda ON meeting TYPE option<string> PERMISSIONS FULL;
DEFINE FIELD meeting_link ON meeting TYPE option<string> PERMISSIONS FULL;
DEFINE FIELD meeting_name ON meeting TYPE string PERMISSIONS FULL;
DEFINE FIELD meeting_record_doc_id ON meeting TYPE option<record<document>> PERMISSIONS FULL;
DEFINE FIELD meeting_type ON meeting TYPE string PERMISSIONS FULL;
DEFINE FIELD participants ON meeting TYPE option<array<record<user>>> PERMISSIONS FULL;
DEFINE FIELD participants[*] ON meeting TYPE record<user> PERMISSIONS FULL;
DEFINE FIELD scheduled_end_date ON meeting TYPE datetime PERMISSIONS FULL;
DEFINE FIELD scheduled_start_date ON meeting TYPE datetime PERMISSIONS FULL;
DEFINE FIELD status ON meeting TYPE string DEFAULT 'SCHEDULED' PERMISSIONS FULL;
DEFINE FIELD updated_at ON meeting TYPE datetime READONLY VALUE time::now() ASSERT $value != NONE PERMISSIONS FULL;

DEFINE INDEX meeting_case_idx ON meeting FIELDS case_id;


-- ------------------------------
-- TABLE: menu_item
-- ------------------------------

DEFINE TABLE menu_item TYPE NORMAL SCHEMAFULL PERMISSIONS FOR select FULL, FOR create, update, delete WHERE $auth.roles CONTAINS 'admin';

DEFINE FIELD created_at ON menu_item TYPE datetime DEFAULT time::now() READONLY ASSERT $value != NONE PERMISSIONS FULL;
DEFINE FIELD display_order ON menu_item TYPE int DEFAULT 0 PERMISSIONS FULL;
DEFINE FIELD icon ON menu_item TYPE option<string> PERMISSIONS FULL;
DEFINE FIELD label_key ON menu_item TYPE string PERMISSIONS FULL;
DEFINE FIELD parent_id ON menu_item TYPE option<record<menu_item>> PERMISSIONS FULL;
DEFINE FIELD path ON menu_item TYPE string PERMISSIONS FULL;
DEFINE FIELD required_permission ON menu_item TYPE option<record<permission>> PERMISSIONS FULL;
DEFINE FIELD updated_at ON menu_item TYPE datetime READONLY VALUE time::now() ASSERT $value != NONE PERMISSIONS FULL;

DEFINE INDEX menu_item_path_idx ON menu_item FIELDS path UNIQUE;


-- ------------------------------
-- TABLE: message
-- ------------------------------

DEFINE TABLE message TYPE NORMAL SCHEMAFULL PERMISSIONS FOR select WHERE $auth.id = sender_id OR $auth.id = receiver_id OR ($auth.roles CONTAINS 'admin') OR ($auth.roles CONTAINS 'case_manager' AND case_id = $this.case_id), FOR create WHERE $auth.id = sender_id OR ($auth.roles CONTAINS 'admin' AND sender_id = 'system'), FOR update, delete WHERE $auth.id = sender_id OR $auth.roles CONTAINS 'admin';

DEFINE FIELD case_id ON message TYPE option<record<case>> PERMISSIONS FULL;
DEFINE FIELD chat_id ON message TYPE string PERMISSIONS FULL;
DEFINE FIELD content ON message TYPE any PERMISSIONS FULL;
DEFINE FIELD created_at ON message TYPE datetime DEFAULT time::now() READONLY ASSERT $value != NONE PERMISSIONS FULL;
DEFINE FIELD message_type ON message TYPE string DEFAULT 'USER_CHAT' PERMISSIONS FULL;
DEFINE FIELD read_at ON message TYPE option<datetime> PERMISSIONS FULL;
DEFINE FIELD receiver_id ON message TYPE option<string> PERMISSIONS FULL;
DEFINE FIELD sender_id ON message TYPE string PERMISSIONS FULL;
DEFINE FIELD updated_at ON message TYPE datetime READONLY VALUE time::now() ASSERT $value != NONE PERMISSIONS FULL;

DEFINE INDEX message_case_created_idx ON message FIELDS case_id, created_at;
DEFINE INDEX message_chat_created_idx ON message FIELDS chat_id, created_at;


-- ------------------------------
-- TABLE: notification_rule
-- ------------------------------

DEFINE TABLE notification_rule TYPE NORMAL SCHEMAFULL PERMISSIONS FOR select FULL, FOR create, update, delete WHERE $auth.roles CONTAINS 'admin';

DEFINE FIELD created_at ON notification_rule TYPE datetime DEFAULT time::now() READONLY ASSERT $value != NONE PERMISSIONS FULL;
DEFINE FIELD is_active ON notification_rule TYPE bool DEFAULT true PERMISSIONS FULL;
DEFINE FIELD message_template ON notification_rule TYPE string PERMISSIONS FULL;
DEFINE FIELD notification_frequency ON notification_rule TYPE string DEFAULT 'DAILY' PERMISSIONS FULL;
DEFINE FIELD notification_time ON notification_rule TYPE string DEFAULT '10:00' PERMISSIONS FULL;
DEFINE FIELD procedure_phase ON notification_rule TYPE string PERMISSIONS FULL;
DEFINE FIELD trigger_condition ON notification_rule TYPE string PERMISSIONS FULL;
DEFINE FIELD updated_at ON notification_rule TYPE datetime READONLY VALUE time::now() ASSERT $value != NONE PERMISSIONS FULL;

DEFINE INDEX notification_rule_phase_idx ON notification_rule FIELDS procedure_phase;


-- ------------------------------
-- TABLE: permission
-- ------------------------------

DEFINE TABLE permission TYPE NORMAL SCHEMAFULL PERMISSIONS FOR select FULL, FOR create, update, delete WHERE $auth.roles CONTAINS 'admin';

DEFINE FIELD action ON permission TYPE string PERMISSIONS FULL;
DEFINE FIELD created_at ON permission TYPE datetime DEFAULT time::now() READONLY ASSERT $value != NONE PERMISSIONS FULL;
DEFINE FIELD resource ON permission TYPE string PERMISSIONS FULL;

DEFINE INDEX permission_idx ON permission FIELDS action, resource UNIQUE;


-- ------------------------------
-- TABLE: role
-- ------------------------------

DEFINE TABLE role TYPE NORMAL SCHEMAFULL PERMISSIONS FOR select FULL, FOR create, update, delete WHERE $auth.roles CONTAINS 'admin';

DEFINE FIELD created_at ON role TYPE datetime DEFAULT time::now() READONLY ASSERT $value != NONE PERMISSIONS FULL;
DEFINE FIELD description ON role TYPE option<string> PERMISSIONS FULL;
DEFINE FIELD name ON role TYPE string ASSERT $value != NONE AND string::len($value) > 0 PERMISSIONS FULL;
DEFINE FIELD updated_at ON role TYPE datetime READONLY VALUE time::now() ASSERT $value != NONE PERMISSIONS FULL;

DEFINE INDEX role_name_idx ON role FIELDS name UNIQUE;


-- ------------------------------
-- TABLE: role_menu_item
-- ------------------------------

DEFINE TABLE role_menu_item TYPE NORMAL SCHEMAFULL PERMISSIONS FOR select FULL, FOR create, update, delete WHERE $auth.roles CONTAINS 'admin';

DEFINE FIELD assigned_at ON role_menu_item TYPE datetime VALUE time::now() PERMISSIONS FULL;
DEFINE FIELD menu_item_id ON role_menu_item TYPE record<menu_item> PERMISSIONS FULL;
DEFINE FIELD role_id ON role_menu_item TYPE record<role> PERMISSIONS FULL;

DEFINE INDEX role_menu_item_idx ON role_menu_item FIELDS role_id, menu_item_id UNIQUE;


-- ------------------------------
-- TABLE: role_permission
-- ------------------------------

DEFINE TABLE role_permission TYPE NORMAL SCHEMAFULL PERMISSIONS FOR select FULL, FOR create, update, delete WHERE $auth.roles CONTAINS 'admin';

DEFINE FIELD assigned_at ON role_permission TYPE datetime VALUE time::now() PERMISSIONS FULL;
DEFINE FIELD permission_id ON role_permission TYPE record<permission> PERMISSIONS FULL;
DEFINE FIELD role_id ON role_permission TYPE record<role> PERMISSIONS FULL;

DEFINE INDEX role_permission_idx ON role_permission FIELDS role_id, permission_id UNIQUE;


-- ------------------------------
-- TABLE: user
-- ------------------------------

DEFINE TABLE user TYPE NORMAL SCHEMAFULL PERMISSIONS FOR select FULL, FOR create, update, delete WHERE id = $auth.id OR ($auth.roles CONTAINS 'admin');

DEFINE FIELD created_at ON user TYPE datetime DEFAULT time::now() READONLY ASSERT $value != NONE PERMISSIONS FULL;
DEFINE FIELD email ON user TYPE option<string> ASSERT $value = NONE OR string::is::email($value) PERMISSIONS FULL;
DEFINE FIELD username ON user TYPE option<string> ASSERT $value = NONE OR string::len($value) >= 3; -- 新增：用户名
DEFINE FIELD password_hash ON user TYPE option<string>; -- 新增：密码哈希
DEFINE FIELD github_id ON user TYPE string PERMISSIONS FULL;
DEFINE FIELD last_login_case_id ON user TYPE option<record<case>> PERMISSIONS FULL;
DEFINE FIELD name ON user TYPE string PERMISSIONS FULL;
DEFINE FIELD updated_at ON user TYPE datetime READONLY VALUE time::now() ASSERT $value != NONE PERMISSIONS FULL;


-- 创建username的唯一索引
DEFINE INDEX user_username_idx ON user COLUMNS username UNIQUE;

-- ------------------------------
-- TABLE: user_case_role
-- ------------------------------

DEFINE TABLE user_case_role TYPE NORMAL SCHEMAFULL PERMISSIONS FOR select WHERE $auth.roles CONTAINS 'admin' OR user_id = $auth.id OR case_id.case_lead_user_id = $auth.id OR case_id.created_by_user = $auth.id, FOR create, update, delete WHERE $auth.roles CONTAINS 'admin' OR case_id.case_lead_user_id = $auth.id OR case_id.created_by_user = $auth.id;

DEFINE FIELD assigned_at ON user_case_role TYPE datetime VALUE time::now() PERMISSIONS FULL;
DEFINE FIELD case_id ON user_case_role TYPE record<case> PERMISSIONS FULL;
DEFINE FIELD role_id ON user_case_role TYPE record<role> PERMISSIONS FULL;
DEFINE FIELD user_id ON user_case_role TYPE record<user> PERMISSIONS FULL;

DEFINE INDEX user_case_idx ON user_case_role FIELDS user_id, case_id, role_id UNIQUE;


