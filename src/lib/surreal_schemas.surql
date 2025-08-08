-- ------------------------------
-- OPTION
-- ------------------------------

OPTION IMPORT;

-- ------------------------------
-- TABLE: case
-- ------------------------------

DEFINE TABLE case TYPE NORMAL SCHEMAFULL PERMISSIONS 
  FOR select WHERE $auth.id->has_role->role->can_execute_operation->operation_metadata[WHERE tables CONTAINS 'case' AND operation_type = 'read'] OR $auth.id->has_case_role->role->can_execute_operation->operation_metadata[WHERE tables CONTAINS 'case' AND operation_type = 'read'],
  FOR create WHERE $auth.id->has_role->role->can_execute_operation->operation_metadata[WHERE tables CONTAINS 'case' AND operation_type = 'create'] OR $auth.id->has_case_role->role->can_execute_operation->operation_metadata[WHERE tables CONTAINS 'case' AND operation_type = 'create'],
  FOR update WHERE $auth.id->has_role->role->can_execute_operation->operation_metadata[WHERE tables CONTAINS 'case' AND operation_type = 'update'] OR $auth.id->has_case_role->role->can_execute_operation->operation_metadata[WHERE tables CONTAINS 'case' AND operation_type = 'update'],
  FOR delete WHERE $auth.id->has_role->role->can_execute_operation->operation_metadata[WHERE tables CONTAINS 'case' AND operation_type = 'delete'] OR $auth.id->has_case_role->role->can_execute_operation->operation_metadata[WHERE tables CONTAINS 'case' AND operation_type = 'delete'];

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
-- TABLE: case_bot
-- ------------------------------

DEFINE TABLE case_bot TYPE NORMAL SCHEMAFULL PERMISSIONS 
  FOR select WHERE $auth.id->has_role->role->can_execute_operation->operation_metadata[WHERE tables CONTAINS 'case_bot' AND operation_type = 'read'] OR $auth.id->has_case_role->role->can_execute_operation->operation_metadata[WHERE tables CONTAINS 'case_bot' AND operation_type = 'read'],
  FOR create WHERE $auth.id->has_role->role->can_execute_operation->operation_metadata[WHERE tables CONTAINS 'case_bot' AND operation_type = 'create'] OR $auth.id->has_case_role->role->can_execute_operation->operation_metadata[WHERE tables CONTAINS 'case_bot' AND operation_type = 'create'],
  FOR update WHERE $auth.id->has_role->role->can_execute_operation->operation_metadata[WHERE tables CONTAINS 'case_bot' AND operation_type = 'update'] OR $auth.id->has_case_role->role->can_execute_operation->operation_metadata[WHERE tables CONTAINS 'case_bot' AND operation_type = 'update'],
  FOR delete WHERE $auth.id->has_role->role->can_execute_operation->operation_metadata[WHERE tables CONTAINS 'case_bot' AND operation_type = 'delete'] OR $auth.id->has_case_role->role->can_execute_operation->operation_metadata[WHERE tables CONTAINS 'case_bot' AND operation_type = 'delete'];

DEFINE FIELD case_id ON case_bot TYPE record<case> PERMISSIONS FULL;
DEFINE FIELD bot_user_id ON case_bot TYPE record<user> PERMISSIONS FULL;
DEFINE FIELD bot_name ON case_bot TYPE string PERMISSIONS FULL;
DEFINE FIELD avatar_url ON case_bot TYPE option<string> PERMISSIONS FULL;
DEFINE FIELD is_active ON case_bot TYPE bool DEFAULT true PERMISSIONS FULL;
DEFINE FIELD created_at ON case_bot TYPE datetime DEFAULT time::now() READONLY ASSERT $value != NONE PERMISSIONS FULL;
DEFINE FIELD updated_at ON case_bot TYPE datetime READONLY VALUE time::now() ASSERT $value != NONE PERMISSIONS FULL;

DEFINE INDEX case_bot_case_idx ON case_bot FIELDS case_id UNIQUE;
DEFINE INDEX case_bot_user_idx ON case_bot FIELDS bot_user_id UNIQUE;

-- ------------------------------
-- TABLE: case_bot_subscription
-- ------------------------------

DEFINE TABLE case_bot_subscription TYPE NORMAL SCHEMAFULL PERMISSIONS FOR select, create, delete WHERE user_id = $auth.id OR $auth.id->has_role->role.name CONTAINS 'admin', FOR update NONE;

DEFINE FIELD case_bot_id ON case_bot_subscription TYPE record<case_bot> PERMISSIONS FULL;
DEFINE FIELD user_id ON case_bot_subscription TYPE record<user> PERMISSIONS FULL;
DEFINE FIELD subscribed_at ON case_bot_subscription TYPE datetime DEFAULT time::now() PERMISSIONS FULL;

DEFINE INDEX user_case_bot_subscription_idx ON case_bot_subscription FIELDS user_id, case_bot_id UNIQUE;


-- ------------------------------
-- TABLE: claim
-- ------------------------------

DEFINE TABLE claim TYPE NORMAL SCHEMAFULL PERMISSIONS 
  FOR select WHERE $auth.id->has_role->role->can_execute_operation->operation_metadata[WHERE tables CONTAINS 'claim' AND operation_type = 'read'] OR $auth.id->has_case_role->role->can_execute_operation->operation_metadata[WHERE tables CONTAINS 'claim' AND operation_type = 'read'] OR (created_by = $auth.id),
  FOR create WHERE $auth.id->has_role->role->can_execute_operation->operation_metadata[WHERE tables CONTAINS 'claim' AND operation_type = 'create'] OR $auth.id->has_case_role->role->can_execute_operation->operation_metadata[WHERE tables CONTAINS 'claim' AND operation_type = 'create'],
  FOR update WHERE $auth.id->has_role->role->can_execute_operation->operation_metadata[WHERE tables CONTAINS 'claim' AND operation_type = 'update'] OR $auth.id->has_case_role->role->can_execute_operation->operation_metadata[WHERE tables CONTAINS 'claim' AND operation_type = 'update'] OR (created_by = $auth.id AND review_status_id.name = '待提交'),
  FOR delete WHERE $auth.id->has_role->role->can_execute_operation->operation_metadata[WHERE tables CONTAINS 'claim' AND operation_type = 'delete'] OR $auth.id->has_case_role->role->can_execute_operation->operation_metadata[WHERE tables CONTAINS 'claim' AND operation_type = 'delete'] OR (created_by = $auth.id AND review_status_id.name = '待提交');

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
DEFINE FIELD current_version ON claim TYPE int DEFAULT 1 PERMISSIONS FULL;
DEFINE FIELD last_operation_time ON claim TYPE datetime VALUE time::now() PERMISSIONS FULL;
DEFINE FIELD operation_count ON claim TYPE int DEFAULT 0 PERMISSIONS FULL;

DEFINE INDEX claim_case_creditor_idx ON claim FIELDS case_id, creditor_id;
DEFINE INDEX claim_case_number_idx ON claim FIELDS case_id, claim_number UNIQUE;
DEFINE INDEX claim_case_status_idx ON claim FIELDS case_id, review_status_id;

-- 债权金额聚合查询优化索引
DEFINE INDEX claim_creditor_amount_idx ON claim FIELDS creditor_id, status, asserted_claim_details.total_asserted_amount;
DEFINE INDEX claim_case_creditor_amount_idx ON claim FIELDS case_id, creditor_id, asserted_claim_details.total_asserted_amount;

-- 全文搜索分析器 - 支持债权高级搜索功能  
DEFINE ANALYZER claim_search_analyzer TOKENIZERS blank,punct,camel,class FILTERS lowercase,ascii;

-- 债权全文搜索索引
DEFINE INDEX claim_fulltext_claim_number_idx ON claim FIELDS claim_number SEARCH ANALYZER claim_search_analyzer BM25 HIGHLIGHTS;
DEFINE INDEX claim_fulltext_nature_idx ON claim FIELDS asserted_claim_details.nature SEARCH ANALYZER claim_search_analyzer BM25 HIGHLIGHTS;
DEFINE INDEX claim_fulltext_description_idx ON claim FIELDS asserted_claim_details.brief_description SEARCH ANALYZER claim_search_analyzer BM25 HIGHLIGHTS;

-- 优化债权搜索性能的复合索引
DEFINE INDEX claim_search_optimized_idx ON claim FIELDS case_id, status, created_at;
DEFINE INDEX claim_creditor_search_idx ON claim FIELDS case_id, creditor_id, status;

-- 版本控制和操作追踪相关索引
DEFINE INDEX claim_version_idx ON claim FIELDS id, current_version;
DEFINE INDEX claim_last_operation_idx ON claim FIELDS last_operation_time DESC;


-- ------------------------------
-- TABLE: claim_nature_definition
-- ------------------------------

DEFINE TABLE claim_nature_definition TYPE NORMAL SCHEMAFULL PERMISSIONS FOR select FULL, FOR create, update, delete WHERE $auth.id->has_role->(select * from role where name='admin');

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

DEFINE TABLE claim_review_status_definition TYPE NORMAL SCHEMAFULL PERMISSIONS FOR select FULL, FOR create, update, delete WHERE $auth.id->has_role->(select * from role where name='admin');

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

DEFINE TABLE creditor TYPE NORMAL SCHEMAFULL PERMISSIONS 
  FOR select WHERE $auth.id->has_role->role->can_execute_operation->operation_metadata[WHERE tables CONTAINS 'creditor' AND operation_type = 'read'] OR $auth.id->has_case_role->role->can_execute_operation->operation_metadata[WHERE tables CONTAINS 'creditor' AND operation_type = 'read'] OR (created_by = $auth.id),
  FOR create WHERE $auth.id->has_role->role->can_execute_operation->operation_metadata[WHERE tables CONTAINS 'creditor' AND operation_type = 'create'] OR $auth.id->has_case_role->role->can_execute_operation->operation_metadata[WHERE tables CONTAINS 'creditor' AND operation_type = 'create'],
  FOR update WHERE $auth.id->has_role->role->can_execute_operation->operation_metadata[WHERE tables CONTAINS 'creditor' AND operation_type = 'update'] OR $auth.id->has_case_role->role->can_execute_operation->operation_metadata[WHERE tables CONTAINS 'creditor' AND operation_type = 'update'] OR (created_by = $auth.id),
  FOR delete WHERE $auth.id->has_role->role->can_execute_operation->operation_metadata[WHERE tables CONTAINS 'creditor' AND operation_type = 'delete'] OR $auth.id->has_case_role->role->can_execute_operation->operation_metadata[WHERE tables CONTAINS 'creditor' AND operation_type = 'delete'] OR (created_by = $auth.id);

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

-- 全文搜索分析器 - 支持债权人高级搜索功能  
DEFINE ANALYZER creditor_search_analyzer TOKENIZERS blank,punct,camel,class FILTERS lowercase,ascii;

-- 债权人全文搜索索引
DEFINE INDEX creditor_fulltext_name_idx ON creditor FIELDS name SEARCH ANALYZER creditor_search_analyzer BM25 HIGHLIGHTS;
DEFINE INDEX creditor_fulltext_legal_id_idx ON creditor FIELDS legal_id SEARCH ANALYZER creditor_search_analyzer BM25 HIGHLIGHTS;
DEFINE INDEX creditor_fulltext_contact_person_idx ON creditor FIELDS contact_person_name SEARCH ANALYZER creditor_search_analyzer BM25 HIGHLIGHTS;
DEFINE INDEX creditor_fulltext_contact_phone_idx ON creditor FIELDS contact_phone SEARCH ANALYZER creditor_search_analyzer BM25 HIGHLIGHTS;
DEFINE INDEX creditor_fulltext_address_idx ON creditor FIELDS contact_address SEARCH ANALYZER creditor_search_analyzer BM25 HIGHLIGHTS;

-- 优化债权人搜索性能的复合索引
DEFINE INDEX creditor_search_optimized_idx ON creditor FIELDS case_id, type, created_at DESC;
DEFINE INDEX creditor_name_search_idx ON creditor FIELDS case_id, name;
DEFINE INDEX creditor_contact_search_idx ON creditor FIELDS case_id, contact_person_name, contact_phone;


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

DEFINE TABLE document_version TYPE NORMAL SCHEMAFULL PERMISSIONS FOR select, create WHERE $auth.id, FOR update, delete WHERE $auth.id->has_role->(select * from role where name='admin');

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

DEFINE TABLE meeting TYPE NORMAL SCHEMAFULL PERMISSIONS 
  FOR select WHERE $auth.id->has_role->role->can_execute_operation->operation_metadata[WHERE tables CONTAINS 'meeting' AND operation_type = 'read'] OR $auth.id->has_case_role->role->can_execute_operation->operation_metadata[WHERE tables CONTAINS 'meeting' AND operation_type = 'read'],
  FOR create WHERE $auth.id->has_role->role->can_execute_operation->operation_metadata[WHERE tables CONTAINS 'meeting' AND operation_type = 'create'] OR $auth.id->has_case_role->role->can_execute_operation->operation_metadata[WHERE tables CONTAINS 'meeting' AND operation_type = 'create'],
  FOR update WHERE $auth.id->has_role->role->can_execute_operation->operation_metadata[WHERE tables CONTAINS 'meeting' AND operation_type = 'update'] OR $auth.id->has_case_role->role->can_execute_operation->operation_metadata[WHERE tables CONTAINS 'meeting' AND operation_type = 'update'],
  FOR delete WHERE $auth.id->has_role->role->can_execute_operation->operation_metadata[WHERE tables CONTAINS 'meeting' AND operation_type = 'delete'] OR $auth.id->has_case_role->role->can_execute_operation->operation_metadata[WHERE tables CONTAINS 'meeting' AND operation_type = 'delete'];

DEFINE FIELD case_id ON meeting TYPE record<case> PERMISSIONS FULL;
DEFINE FIELD created_at ON meeting TYPE datetime DEFAULT time::now() READONLY ASSERT $value != NONE PERMISSIONS FULL;
DEFINE FIELD created_by ON meeting TYPE record<user> VALUE $auth.id PERMISSIONS FULL;
DEFINE FIELD meeting_agenda ON meeting TYPE option<string> PERMISSIONS FULL;
DEFINE FIELD meeting_link ON meeting TYPE option<string> PERMISSIONS FULL;
DEFINE FIELD meeting_name ON meeting TYPE string PERMISSIONS FULL;
DEFINE FIELD meeting_record_doc_id ON meeting TYPE option<record<document>> PERMISSIONS FULL;
DEFINE FIELD meeting_type ON meeting TYPE string PERMISSIONS FULL;
DEFINE FIELD participants ON meeting TYPE option<array<record<user>>> PERMISSIONS FULL;
DEFINE FIELD scheduled_end_date ON meeting TYPE datetime PERMISSIONS FULL;
DEFINE FIELD scheduled_start_date ON meeting TYPE datetime PERMISSIONS FULL;
DEFINE FIELD status ON meeting TYPE string DEFAULT 'SCHEDULED' PERMISSIONS FULL;
DEFINE FIELD updated_at ON meeting TYPE datetime READONLY VALUE time::now() ASSERT $value != NONE PERMISSIONS FULL;

DEFINE INDEX meeting_case_idx ON meeting FIELDS case_id;


-- ------------------------------
-- TABLE: message
-- ------------------------------

DEFINE TABLE message TYPE NORMAL SCHEMAFULL PERMISSIONS 
  FOR select WHERE $auth.id->has_role->role->can_execute_operation->operation_metadata[WHERE tables CONTAINS 'message' AND operation_type = 'read'] OR $auth.id->has_case_role->role->can_execute_operation->operation_metadata[WHERE tables CONTAINS 'message' AND operation_type = 'read'] OR sender_id = $auth.id OR target_user_id = $auth.id OR conversation_id.participants CONTAINS $auth.id,
  FOR create WHERE $auth.id->has_role->role->can_execute_operation->operation_metadata[WHERE tables CONTAINS 'message' AND operation_type = 'create'] OR $auth.id->has_case_role->role->can_execute_operation->operation_metadata[WHERE tables CONTAINS 'message' AND operation_type = 'create'],
  FOR update WHERE $auth.id->has_role->role->can_execute_operation->operation_metadata[WHERE tables CONTAINS 'message' AND operation_type = 'update'] OR $auth.id->has_case_role->role->can_execute_operation->operation_metadata[WHERE tables CONTAINS 'message' AND operation_type = 'update'] OR sender_id = $auth.id,
  FOR delete WHERE $auth.id->has_role->role->can_execute_operation->operation_metadata[WHERE tables CONTAINS 'message' AND operation_type = 'delete'] OR $auth.id->has_case_role->role->can_execute_operation->operation_metadata[WHERE tables CONTAINS 'message' AND operation_type = 'delete'] OR sender_id = $auth.id;

DEFINE FIELD type ON message TYPE string DEFAULT 'IM' ASSERT $value INSIDE ['IM', 'CASE_ROBOT_REMINDER', 'BUSINESS_NOTIFICATION', 'SYSTEM_NOTIFICATION'] PERMISSIONS FULL;
DEFINE FIELD conversation_id ON message TYPE option<record<conversation>> PERMISSIONS FULL;
DEFINE FIELD sender_id ON message TYPE record<user> PERMISSIONS FULL;
DEFINE FIELD sender_name ON message TYPE string PERMISSIONS FULL;
DEFINE FIELD target_user_id ON message TYPE option<record<user>> PERMISSIONS FULL;
DEFINE FIELD case_id ON message TYPE option<record<case>> PERMISSIONS FULL;
DEFINE FIELD content ON message TYPE string PERMISSIONS FULL;
DEFINE FIELD title ON message TYPE option<string> PERMISSIONS FULL;
DEFINE FIELD priority ON message TYPE string DEFAULT 'NORMAL' ASSERT $value INSIDE ['LOW', 'NORMAL', 'HIGH', 'URGENT'] PERMISSIONS FULL;
DEFINE FIELD action_link ON message TYPE option<string> PERMISSIONS FULL;
DEFINE FIELD is_read ON message TYPE bool DEFAULT false PERMISSIONS FULL;
DEFINE FIELD read_at ON message TYPE option<datetime> PERMISSIONS FULL;
DEFINE FIELD is_archived ON message TYPE bool DEFAULT false PERMISSIONS FULL;
DEFINE FIELD archived_at ON message TYPE option<datetime> PERMISSIONS FULL;
DEFINE FIELD created_at ON message TYPE datetime DEFAULT time::now() READONLY ASSERT $value != NONE PERMISSIONS FULL;
DEFINE FIELD updated_at ON message TYPE datetime READONLY VALUE time::now() ASSERT $value != NONE PERMISSIONS FULL;

-- WebRTC消息中心扩展字段
DEFINE FIELD message_type ON message TYPE string DEFAULT 'text' ASSERT $value INSIDE ['text', 'image', 'video', 'audio', 'file', 'call_request', 'call_end'] PERMISSIONS FULL;
DEFINE FIELD file_metadata ON message TYPE option<object> PERMISSIONS FULL;
DEFINE FIELD call_metadata ON message TYPE option<object> PERMISSIONS FULL;
DEFINE FIELD target_type ON message TYPE string DEFAULT 'user' ASSERT $value INSIDE ['user', 'group'] PERMISSIONS FULL;
DEFINE FIELD group_id ON message TYPE option<record<message_group>> PERMISSIONS FULL;
DEFINE FIELD reply_to ON message TYPE option<record<message>> PERMISSIONS FULL;
DEFINE FIELD is_pinned ON message TYPE bool DEFAULT false PERMISSIONS FULL;
DEFINE FIELD mentioned_users ON message TYPE option<array<record<user>>> PERMISSIONS FULL;

DEFINE INDEX message_conversation_created_idx ON message FIELDS conversation_id, created_at DESC;
DEFINE INDEX message_case_created_idx ON message FIELDS case_id, created_at DESC;
DEFINE INDEX message_target_user_idx ON message FIELDS target_user_id, is_read, created_at DESC;
DEFINE INDEX message_sender_idx ON message FIELDS sender_id, created_at DESC;

-- WebRTC消息中心相关索引
DEFINE INDEX message_group_idx ON message FIELDS group_id, created_at DESC;
DEFINE INDEX message_target_type_idx ON message FIELDS target_type, created_at DESC;
DEFINE INDEX message_type_idx ON message FIELDS message_type, created_at DESC;
DEFINE INDEX message_pinned_idx ON message FIELDS group_id, is_pinned, created_at DESC;
DEFINE INDEX message_reply_idx ON message FIELDS reply_to;

-- ------------------------------
-- TABLE: conversation
-- ------------------------------

DEFINE TABLE conversation TYPE NORMAL SCHEMAFULL PERMISSIONS 
  FOR select WHERE $auth.id IN participants OR $auth.id->has_role->role.name CONTAINS 'admin',
  FOR create WHERE $auth.id,
  FOR update WHERE $auth.id IN participants OR $auth.id->has_role->role.name CONTAINS 'admin',
  FOR delete WHERE $auth.id->has_role->role.name CONTAINS 'admin';

DEFINE FIELD type ON conversation TYPE string DEFAULT 'DIRECT' ASSERT $value INSIDE ['DIRECT', 'GROUP', 'SYSTEM'] PERMISSIONS FULL;
DEFINE FIELD name ON conversation TYPE option<string> PERMISSIONS FULL;
DEFINE FIELD description ON conversation TYPE option<string> PERMISSIONS FULL;
DEFINE FIELD avatar_url ON conversation TYPE option<string> PERMISSIONS FULL;
DEFINE FIELD case_id ON conversation TYPE option<record<case>> PERMISSIONS FULL;
DEFINE FIELD created_by ON conversation TYPE record<user> DEFAULT $auth.id PERMISSIONS FULL;
DEFINE FIELD participants ON conversation TYPE array<record<user>> PERMISSIONS FULL;
DEFINE FIELD is_archived ON conversation TYPE bool DEFAULT false PERMISSIONS FULL;
DEFINE FIELD last_message_at ON conversation TYPE option<datetime> PERMISSIONS FULL;
DEFINE FIELD created_at ON conversation TYPE datetime DEFAULT time::now() READONLY ASSERT $value != NONE PERMISSIONS FULL;
DEFINE FIELD updated_at ON conversation TYPE datetime READONLY VALUE time::now() ASSERT $value != NONE PERMISSIONS FULL;

DEFINE INDEX conversation_participants_idx ON conversation FIELDS participants;
DEFINE INDEX conversation_case_idx ON conversation FIELDS case_id;
DEFINE INDEX conversation_last_message_idx ON conversation FIELDS last_message_at DESC;

-- ------------------------------
-- TABLE: conversation_participant
-- ------------------------------

DEFINE TABLE conversation_participant TYPE NORMAL SCHEMAFULL PERMISSIONS 
  FOR select WHERE user_id = $auth.id OR $auth.id->has_role->role.name CONTAINS 'admin',
  FOR create WHERE $auth.id,
  FOR update WHERE user_id = $auth.id OR $auth.id->has_role->role.name CONTAINS 'admin',
  FOR delete WHERE $auth.id->has_role->role.name CONTAINS 'admin';

DEFINE FIELD conversation_id ON conversation_participant TYPE record<conversation> PERMISSIONS FULL;
DEFINE FIELD user_id ON conversation_participant TYPE record<user> PERMISSIONS FULL;
DEFINE FIELD role ON conversation_participant TYPE string DEFAULT 'MEMBER' ASSERT $value INSIDE ['MEMBER', 'ADMIN', 'OWNER'] PERMISSIONS FULL;
DEFINE FIELD joined_at ON conversation_participant TYPE datetime DEFAULT time::now() PERMISSIONS FULL;
DEFINE FIELD last_read_at ON conversation_participant TYPE option<datetime> PERMISSIONS FULL;
DEFINE FIELD unread_count ON conversation_participant TYPE int DEFAULT 0 PERMISSIONS FULL;
DEFINE FIELD is_muted ON conversation_participant TYPE bool DEFAULT false PERMISSIONS FULL;
DEFINE FIELD notification_preference ON conversation_participant TYPE string DEFAULT 'ALL' ASSERT $value INSIDE ['ALL', 'MENTIONS', 'NONE'] PERMISSIONS FULL;
DEFINE FIELD created_at ON conversation_participant TYPE datetime DEFAULT time::now() READONLY ASSERT $value != NONE PERMISSIONS FULL;
DEFINE FIELD updated_at ON conversation_participant TYPE datetime READONLY VALUE time::now() ASSERT $value != NONE PERMISSIONS FULL;

DEFINE INDEX conversation_participant_unique_idx ON conversation_participant FIELDS conversation_id, user_id UNIQUE;

-- ------------------------------
-- TABLE: message_group (WebRTC群组功能)
-- ------------------------------

DEFINE TABLE message_group TYPE NORMAL SCHEMAFULL PERMISSIONS 
  FOR select WHERE $auth.id IN (SELECT user_id FROM group_member WHERE group_id = $parent.id) OR $auth.id->has_role->role.name CONTAINS 'admin',
  FOR create WHERE $auth.id,
  FOR update WHERE $auth.id IN (SELECT user_id FROM group_member WHERE group_id = $parent.id AND role IN ['owner', 'admin']) OR $auth.id->has_role->role.name CONTAINS 'admin',
  FOR delete WHERE $auth.id IN (SELECT user_id FROM group_member WHERE group_id = $parent.id AND role = 'owner') OR $auth.id->has_role->role.name CONTAINS 'admin';

DEFINE FIELD group_name ON message_group TYPE string PERMISSIONS FULL;
DEFINE FIELD group_description ON message_group TYPE option<string> PERMISSIONS FULL;
DEFINE FIELD group_avatar ON message_group TYPE option<string> PERMISSIONS FULL;
DEFINE FIELD group_type ON message_group TYPE string DEFAULT 'normal' ASSERT $value INSIDE ['normal', 'case_related', 'department'] PERMISSIONS FULL;
DEFINE FIELD case_id ON message_group TYPE option<record<case>> PERMISSIONS FULL;
DEFINE FIELD created_by ON message_group TYPE record<user> DEFAULT $auth.id PERMISSIONS FULL;
DEFINE FIELD created_at ON message_group TYPE datetime DEFAULT time::now() READONLY ASSERT $value != NONE PERMISSIONS FULL;
DEFINE FIELD updated_at ON message_group TYPE datetime READONLY VALUE time::now() ASSERT $value != NONE PERMISSIONS FULL;
DEFINE FIELD is_active ON message_group TYPE bool DEFAULT true PERMISSIONS FULL;
DEFINE FIELD max_members ON message_group TYPE int DEFAULT 100 PERMISSIONS FULL;

DEFINE INDEX message_group_case_idx ON message_group FIELDS case_id;
DEFINE INDEX message_group_type_idx ON message_group FIELDS group_type;

-- ------------------------------
-- TABLE: group_member (WebRTC群组成员)
-- ------------------------------

DEFINE TABLE group_member TYPE NORMAL SCHEMAFULL PERMISSIONS 
  FOR select WHERE user_id = $auth.id OR $auth.id IN (SELECT user_id FROM group_member WHERE group_id = $parent.group_id AND role IN ['owner', 'admin']) OR $auth.id->has_role->role.name CONTAINS 'admin',
  FOR create WHERE $auth.id IN (SELECT user_id FROM group_member WHERE group_id = $parent.group_id AND role IN ['owner', 'admin']) OR $auth.id->has_role->role.name CONTAINS 'admin',
  FOR update WHERE user_id = $auth.id OR $auth.id IN (SELECT user_id FROM group_member WHERE group_id = $parent.group_id AND role IN ['owner', 'admin']) OR $auth.id->has_role->role.name CONTAINS 'admin',
  FOR delete WHERE $auth.id IN (SELECT user_id FROM group_member WHERE group_id = $parent.group_id AND role IN ['owner', 'admin']) OR $auth.id->has_role->role.name CONTAINS 'admin';

DEFINE FIELD group_id ON group_member TYPE record<message_group> PERMISSIONS FULL;
DEFINE FIELD user_id ON group_member TYPE record<user> PERMISSIONS FULL;
DEFINE FIELD role ON group_member TYPE string DEFAULT 'member' ASSERT $value INSIDE ['owner', 'admin', 'member'] PERMISSIONS FULL;
DEFINE FIELD joined_at ON group_member TYPE datetime DEFAULT time::now() PERMISSIONS FULL;
DEFINE FIELD last_read_at ON group_member TYPE option<datetime> PERMISSIONS FULL;
DEFINE FIELD is_muted ON group_member TYPE bool DEFAULT false PERMISSIONS FULL;
DEFINE FIELD nickname ON group_member TYPE option<string> PERMISSIONS FULL;
DEFINE FIELD created_at ON group_member TYPE datetime DEFAULT time::now() READONLY ASSERT $value != NONE PERMISSIONS FULL;
DEFINE FIELD updated_at ON group_member TYPE datetime READONLY VALUE time::now() ASSERT $value != NONE PERMISSIONS FULL;

DEFINE INDEX group_member_unique ON group_member FIELDS group_id, user_id UNIQUE;
DEFINE INDEX group_member_user_idx ON group_member FIELDS user_id;
DEFINE INDEX group_member_group_role_idx ON group_member FIELDS group_id, role;ant FIELDS conversation_id, user_id UNIQUE;
DEFINE INDEX conversation_participant_user_idx ON conversation_participant FIELDS user_id;
DEFINE INDEX conversation_participant_unread_idx ON conversation_participant FIELDS user_id, unread_count;

-- ------------------------------
-- TABLE: claim_operation_log
-- ------------------------------

DEFINE TABLE claim_operation_log TYPE NORMAL SCHEMAFULL PERMISSIONS 
  FOR select WHERE $auth.id->has_role->role->can_execute_operation->operation_metadata[WHERE tables CONTAINS 'claim_operation_log' AND operation_type = 'read'] OR $auth.id->has_case_role->role->can_execute_operation->operation_metadata[WHERE tables CONTAINS 'claim_operation_log' AND operation_type = 'read'],
  FOR create WHERE $auth.id->has_role->role->can_execute_operation->operation_metadata[WHERE tables CONTAINS 'claim_operation_log' AND operation_type = 'create'] OR $auth.id->has_case_role->role->can_execute_operation->operation_metadata[WHERE tables CONTAINS 'claim_operation_log' AND operation_type = 'create'],
  FOR update NONE,
  FOR delete WHERE $auth.id->has_role->role.name CONTAINS 'admin';

DEFINE FIELD claim_id ON claim_operation_log TYPE record<claim> PERMISSIONS FULL;
DEFINE FIELD operation_type ON claim_operation_log TYPE string ASSERT $value INSIDE ['create', 'update', 'submit', 'withdraw', 'review', 'approve', 'reject', 'supplement_request', 'delete', 'view'] PERMISSIONS FULL;
DEFINE FIELD operation_description ON claim_operation_log TYPE string PERMISSIONS FULL;
DEFINE FIELD operator_id ON claim_operation_log TYPE record<user> DEFAULT $auth.id PERMISSIONS FULL;
DEFINE FIELD operator_name ON claim_operation_log TYPE string PERMISSIONS FULL;
DEFINE FIELD operator_role ON claim_operation_log TYPE string PERMISSIONS FULL;
DEFINE FIELD operation_time ON claim_operation_log TYPE datetime DEFAULT time::now() READONLY PERMISSIONS FULL;
DEFINE FIELD ip_address ON claim_operation_log TYPE option<string> PERMISSIONS FULL;
DEFINE FIELD user_agent ON claim_operation_log TYPE option<string> PERMISSIONS FULL;
DEFINE FIELD operation_details ON claim_operation_log TYPE option<object> PERMISSIONS FULL;
DEFINE FIELD before_data ON claim_operation_log TYPE option<object> PERMISSIONS FULL;
DEFINE FIELD after_data ON claim_operation_log TYPE option<object> PERMISSIONS FULL;
DEFINE FIELD changed_fields ON claim_operation_log TYPE option<array<string>> PERMISSIONS FULL;
DEFINE FIELD operation_result ON claim_operation_log TYPE string DEFAULT 'success' ASSERT $value INSIDE ['success', 'failed', 'partial'] PERMISSIONS FULL;
DEFINE FIELD error_message ON claim_operation_log TYPE option<string> PERMISSIONS FULL;
DEFINE FIELD related_documents ON claim_operation_log TYPE option<array<record<document>>> PERMISSIONS FULL;
DEFINE FIELD business_context ON claim_operation_log TYPE option<object> PERMISSIONS FULL;

-- 索引优化
DEFINE INDEX claim_operation_claim_time_idx ON claim_operation_log FIELDS claim_id, operation_time DESC;
DEFINE INDEX claim_operation_operator_idx ON claim_operation_log FIELDS operator_id, operation_time DESC;
DEFINE INDEX claim_operation_type_idx ON claim_operation_log FIELDS operation_type, operation_time DESC;
DEFINE INDEX claim_operation_result_idx ON claim_operation_log FIELDS operation_result, operation_time DESC;


-- ------------------------------
-- TABLE: claim_version_history
-- ------------------------------

DEFINE TABLE claim_version_history TYPE NORMAL SCHEMAFULL PERMISSIONS 
  FOR select WHERE $auth.id->has_role->role->can_execute_operation->operation_metadata[WHERE tables CONTAINS 'claim_version_history' AND operation_type = 'read'] OR $auth.id->has_case_role->role->can_execute_operation->operation_metadata[WHERE tables CONTAINS 'claim_version_history' AND operation_type = 'read'],
  FOR create WHERE $auth.id->has_role->role->can_execute_operation->operation_metadata[WHERE tables CONTAINS 'claim_version_history' AND operation_type = 'create'] OR $auth.id->has_case_role->role->can_execute_operation->operation_metadata[WHERE tables CONTAINS 'claim_version_history' AND operation_type = 'create'],
  FOR update NONE,
  FOR delete WHERE $auth.id->has_role->role.name CONTAINS 'admin';

DEFINE FIELD claim_id ON claim_version_history TYPE record<claim> PERMISSIONS FULL;
DEFINE FIELD version_number ON claim_version_history TYPE int PERMISSIONS FULL;
DEFINE FIELD version_type ON claim_version_history TYPE string ASSERT $value INSIDE ['initial', 'draft_update', 'submission', 'review_update', 'approval', 'rejection'] PERMISSIONS FULL;
DEFINE FIELD snapshot_data ON claim_version_history TYPE object PERMISSIONS FULL;
DEFINE FIELD change_summary ON claim_version_history TYPE option<string> PERMISSIONS FULL;
DEFINE FIELD changed_by ON claim_version_history TYPE record<user> DEFAULT $auth.id PERMISSIONS FULL;
DEFINE FIELD change_reason ON claim_version_history TYPE option<string> PERMISSIONS FULL;
DEFINE FIELD created_at ON claim_version_history TYPE datetime DEFAULT time::now() READONLY PERMISSIONS FULL;
DEFINE FIELD related_operation_log_id ON claim_version_history TYPE option<record<claim_operation_log>> PERMISSIONS FULL;
DEFINE FIELD checksum ON claim_version_history TYPE option<string> PERMISSIONS FULL;

-- 索引优化
DEFINE INDEX claim_version_claim_version_idx ON claim_version_history FIELDS claim_id, version_number UNIQUE;
DEFINE INDEX claim_version_claim_time_idx ON claim_version_history FIELDS claim_id, created_at DESC;
DEFINE INDEX claim_version_type_idx ON claim_version_history FIELDS version_type, created_at DESC;


-- ------------------------------
-- TABLE: claim_status_flow
-- ------------------------------

DEFINE TABLE claim_status_flow TYPE NORMAL SCHEMAFULL PERMISSIONS 
  FOR select WHERE $auth.id->has_role->role->can_execute_operation->operation_metadata[WHERE tables CONTAINS 'claim_status_flow' AND operation_type = 'read'] OR $auth.id->has_case_role->role->can_execute_operation->operation_metadata[WHERE tables CONTAINS 'claim_status_flow' AND operation_type = 'read'],
  FOR create WHERE $auth.id->has_role->role->can_execute_operation->operation_metadata[WHERE tables CONTAINS 'claim_status_flow' AND operation_type = 'create'] OR $auth.id->has_case_role->role->can_execute_operation->operation_metadata[WHERE tables CONTAINS 'claim_status_flow' AND operation_type = 'create'],
  FOR update NONE,
  FOR delete WHERE $auth.id->has_role->role.name CONTAINS 'admin';

DEFINE FIELD claim_id ON claim_status_flow TYPE record<claim> PERMISSIONS FULL;
DEFINE FIELD from_status ON claim_status_flow TYPE option<record<claim_review_status_definition>> PERMISSIONS FULL;
DEFINE FIELD to_status ON claim_status_flow TYPE record<claim_review_status_definition> PERMISSIONS FULL;
DEFINE FIELD transition_type ON claim_status_flow TYPE string ASSERT $value INSIDE ['user_action', 'system_action', 'admin_action', 'auto_transition'] PERMISSIONS FULL;
DEFINE FIELD trigger_reason ON claim_status_flow TYPE string PERMISSIONS FULL;
DEFINE FIELD transition_time ON claim_status_flow TYPE datetime DEFAULT time::now() READONLY PERMISSIONS FULL;
DEFINE FIELD operator_id ON claim_status_flow TYPE record<user> DEFAULT $auth.id PERMISSIONS FULL;
DEFINE FIELD operator_role ON claim_status_flow TYPE string PERMISSIONS FULL;
DEFINE FIELD transition_notes ON claim_status_flow TYPE option<string> PERMISSIONS FULL;
DEFINE FIELD review_comments ON claim_status_flow TYPE option<string> PERMISSIONS FULL;
DEFINE FIELD duration_in_previous_status ON claim_status_flow TYPE option<duration> PERMISSIONS FULL;
DEFINE FIELD related_operation_log_id ON claim_status_flow TYPE option<record<claim_operation_log>> PERMISSIONS FULL;

-- 索引优化
DEFINE INDEX claim_status_flow_claim_time_idx ON claim_status_flow FIELDS claim_id, transition_time DESC;
DEFINE INDEX claim_status_flow_status_idx ON claim_status_flow FIELDS to_status, transition_time DESC;
DEFINE INDEX claim_status_flow_operator_idx ON claim_status_flow FIELDS operator_id, transition_time DESC;


-- ------------------------------
-- TABLE: claim_access_log
-- ------------------------------

DEFINE TABLE claim_access_log TYPE NORMAL SCHEMAFULL PERMISSIONS 
  FOR select WHERE $auth.id->has_role->role->can_execute_operation->operation_metadata[WHERE tables CONTAINS 'claim_access_log' AND operation_type = 'read'] OR $auth.id->has_case_role->role->can_execute_operation->operation_metadata[WHERE tables CONTAINS 'claim_access_log' AND operation_type = 'read'],
  FOR create WHERE $auth.id->has_role->role->can_execute_operation->operation_metadata[WHERE tables CONTAINS 'claim_access_log' AND operation_type = 'create'] OR $auth.id->has_case_role->role->can_execute_operation->operation_metadata[WHERE tables CONTAINS 'claim_access_log' AND operation_type = 'create'],
  FOR update NONE,
  FOR delete WHERE $auth.id->has_role->role.name CONTAINS 'admin';

DEFINE FIELD claim_id ON claim_access_log TYPE record<claim> PERMISSIONS FULL;
DEFINE FIELD access_type ON claim_access_log TYPE string ASSERT $value INSIDE ['view', 'download', 'export', 'print'] PERMISSIONS FULL;
DEFINE FIELD accessor_id ON claim_access_log TYPE record<user> DEFAULT $auth.id PERMISSIONS FULL;
DEFINE FIELD accessor_name ON claim_access_log TYPE string PERMISSIONS FULL;
DEFINE FIELD accessor_role ON claim_access_log TYPE string PERMISSIONS FULL;
DEFINE FIELD access_time ON claim_access_log TYPE datetime DEFAULT time::now() READONLY PERMISSIONS FULL;
DEFINE FIELD ip_address ON claim_access_log TYPE option<string> PERMISSIONS FULL;
DEFINE FIELD user_agent ON claim_access_log TYPE option<string> PERMISSIONS FULL;
DEFINE FIELD accessed_fields ON claim_access_log TYPE option<array<string>> PERMISSIONS FULL;
DEFINE FIELD access_duration ON claim_access_log TYPE option<duration> PERMISSIONS FULL;
DEFINE FIELD access_result ON claim_access_log TYPE string DEFAULT 'success' ASSERT $value INSIDE ['success', 'denied', 'error'] PERMISSIONS FULL;
DEFINE FIELD denial_reason ON claim_access_log TYPE option<string> PERMISSIONS FULL;

-- 索引优化
DEFINE INDEX claim_access_claim_time_idx ON claim_access_log FIELDS claim_id, access_time DESC;
DEFINE INDEX claim_access_accessor_idx ON claim_access_log FIELDS accessor_id, access_time DESC;
DEFINE INDEX claim_access_type_idx ON claim_access_log FIELDS access_type, access_time DESC;


-- ------------------------------
-- TABLE: message_attachment
-- ------------------------------

DEFINE TABLE message_attachment TYPE NORMAL SCHEMAFULL PERMISSIONS 
  FOR select WHERE message_id.sender_id = $auth.id OR message_id.receiver_id = $auth.id OR $auth.id->has_role->role.name CONTAINS 'admin',
  FOR create WHERE $auth.id,
  FOR update WHERE message_id.sender_id = $auth.id OR $auth.id->has_role->role.name CONTAINS 'admin',
  FOR delete WHERE message_id.sender_id = $auth.id OR $auth.id->has_role->role.name CONTAINS 'admin';

DEFINE FIELD message_id ON message_attachment TYPE record<message> PERMISSIONS FULL;
DEFINE FIELD file_name ON message_attachment TYPE string PERMISSIONS FULL;
DEFINE FIELD file_type ON message_attachment TYPE string PERMISSIONS FULL;
DEFINE FIELD file_size ON message_attachment TYPE int PERMISSIONS FULL;
DEFINE FIELD mime_type ON message_attachment TYPE string PERMISSIONS FULL;
DEFINE FIELD s3_object_key ON message_attachment TYPE string PERMISSIONS FULL;
DEFINE FIELD thumbnail_url ON message_attachment TYPE option<string> PERMISSIONS FULL;
DEFINE FIELD created_at ON message_attachment TYPE datetime DEFAULT time::now() READONLY ASSERT $value != NONE PERMISSIONS FULL;

DEFINE INDEX message_attachment_message_idx ON message_attachment FIELDS message_id;

-- ------------------------------
-- TABLE: notification_rule
-- ------------------------------

DEFINE TABLE notification_rule TYPE NORMAL SCHEMAFULL PERMISSIONS FOR select FULL, FOR create, update, delete WHERE $auth.id->has_role->(select * from role where name='admin');

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
-- TABLE: role
-- ------------------------------

DEFINE TABLE role TYPE NORMAL SCHEMAFULL PERMISSIONS FOR select FULL, FOR create, update, delete WHERE $auth.id->has_role->(select * from role where name='admin');

DEFINE FIELD created_at ON role TYPE datetime DEFAULT time::now() READONLY ASSERT $value != NONE PERMISSIONS FULL;
DEFINE FIELD description ON role TYPE option<string> PERMISSIONS FULL;
DEFINE FIELD name ON role TYPE string ASSERT $value != NONE AND string::len($value) > 0 PERMISSIONS FULL;
DEFINE FIELD updated_at ON role TYPE datetime READONLY VALUE time::now() ASSERT $value != NONE PERMISSIONS FULL;

DEFINE INDEX role_name_idx ON role FIELDS name UNIQUE;



-- ------------------------------
-- TABLE: user
-- ------------------------------

DEFINE TABLE user TYPE NORMAL SCHEMAFULL PERMISSIONS
  FOR select WHERE $auth.id->has_role->role->can_execute_operation->operation_metadata[WHERE tables CONTAINS 'user' AND operation_type = 'read'] OR $auth.id->has_case_role->role->can_execute_operation->operation_metadata[WHERE tables CONTAINS 'user' AND operation_type = 'read'] OR id = $auth.id,
  FOR create WHERE $auth.id->has_role->role->can_execute_operation->operation_metadata[WHERE tables CONTAINS 'user' AND operation_type = 'create'] OR $auth.id->has_case_role->role->can_execute_operation->operation_metadata[WHERE tables CONTAINS 'user' AND operation_type = 'create'],
  FOR update WHERE $auth.id->has_role->role->can_execute_operation->operation_metadata[WHERE tables CONTAINS 'user' AND operation_type = 'update'] OR $auth.id->has_case_role->role->can_execute_operation->operation_metadata[WHERE tables CONTAINS 'user' AND operation_type = 'update'] OR id = $auth.id,
  FOR delete WHERE $auth.id->has_role->role->can_execute_operation->operation_metadata[WHERE tables CONTAINS 'user' AND operation_type = 'delete'] OR $auth.id->has_case_role->role->can_execute_operation->operation_metadata[WHERE tables CONTAINS 'user' AND operation_type = 'delete'] OR id = $auth.id;


DEFINE FIELD created_at ON user TYPE datetime DEFAULT time::now() READONLY ASSERT $value != NONE PERMISSIONS FULL;
DEFINE FIELD email ON user TYPE option<string> ASSERT $value = NONE OR string::is::email($value) PERMISSIONS FULL;
DEFINE FIELD username ON user TYPE option<string> ASSERT $value = NONE OR string::len($value) >= 3 PERMISSIONS FULL;
DEFINE FIELD password_hash ON user TYPE option<string> PERMISSIONS FULL;
DEFINE FIELD github_id ON user TYPE option<string> PERMISSIONS FULL;
DEFINE FIELD last_login_case_id ON user TYPE option<record<case>> PERMISSIONS FULL;
DEFINE FIELD name ON user TYPE string PERMISSIONS FULL;
DEFINE FIELD updated_at ON user TYPE datetime READONLY VALUE time::now() ASSERT $value != NONE PERMISSIONS FULL;

DEFINE INDEX user_username_idx ON user COLUMNS username UNIQUE;


-- ------------------------------
-- TABLE: jwt_key_pair
-- ------------------------------

DEFINE TABLE jwt_key_pair TYPE NORMAL SCHEMAFULL PERMISSIONS FOR select, create, update, delete WHERE $auth.id->has_role->(select * from role where name='admin');

DEFINE FIELD kid ON jwt_key_pair TYPE string PERMISSIONS FULL;
DEFINE FIELD OVERWRITE private_key ON jwt_key_pair TYPE string PERMISSIONS FULL;
DEFINE FIELD OVERWRITE public_key ON jwt_key_pair TYPE string PERMISSIONS FULL;
DEFINE FIELD created_at ON jwt_key_pair TYPE datetime DEFAULT time::now() READONLY ASSERT $value != NONE PERMISSIONS FULL;
DEFINE FIELD is_active ON jwt_key_pair TYPE bool DEFAULT true PERMISSIONS FULL;

DEFINE INDEX jwt_key_pair_kid_idx ON jwt_key_pair FIELDS kid UNIQUE;
DEFINE INDEX jwt_key_pair_created_idx ON jwt_key_pair FIELDS created_at;


-- Set the name of the token
DEFINE ACCESS cuckoox_token ON DATABASE TYPE RECORD WITH JWT URL 'http://127.0.0.1:8080/.well-known/jwks.json' DURATION FOR TOKEN 1h, FOR SESSION 1h;

-- ======================================
-- 图数据库边表定义 (Graph Relations)
-- ======================================

-- ------------------------------
-- 用户拥有角色（全局角色）
-- ------------------------------
DEFINE TABLE has_role TYPE RELATION IN user OUT role SCHEMAFULL PERMISSIONS FULL;
DEFINE FIELD assigned_at ON has_role TYPE datetime VALUE time::now() PERMISSIONS FULL;
DEFINE INDEX unique_user_role ON has_role COLUMNS in, out UNIQUE;

-- ------------------------------
-- 用户在特定案件中拥有角色
-- ------------------------------
DEFINE TABLE has_case_role TYPE RELATION IN user OUT role SCHEMAFULL PERMISSIONS FULL;
DEFINE FIELD case_id ON has_case_role TYPE record<case> PERMISSIONS FULL;
DEFINE FIELD assigned_at ON has_case_role TYPE datetime VALUE time::now() PERMISSIONS FULL;
DEFINE INDEX unique_user_case_role ON has_case_role COLUMNS in, out, case_id UNIQUE;

-- ------------------------------
-- 案件拥有成员
-- ------------------------------
DEFINE TABLE has_member TYPE RELATION IN case OUT user SCHEMAFULL PERMISSIONS 
  FOR select WHERE $auth.id->has_role->role->can_execute_operation->operation_metadata[WHERE tables CONTAINS 'has_member' AND operation_type = 'read'] OR $auth.id->has_case_role->role->can_execute_operation->operation_metadata[WHERE tables CONTAINS 'has_member' AND operation_type = 'read'],
  FOR create WHERE $auth.id->has_role->role->can_execute_operation->operation_metadata[WHERE tables CONTAINS 'has_member' AND operation_type = 'create'] OR $auth.id->has_case_role->role->can_execute_operation->operation_metadata[WHERE tables CONTAINS 'has_member' AND operation_type = 'create'],
  FOR update WHERE $auth.id->has_role->role->can_execute_operation->operation_metadata[WHERE tables CONTAINS 'has_member' AND operation_type = 'update'] OR $auth.id->has_case_role->role->can_execute_operation->operation_metadata[WHERE tables CONTAINS 'has_member' AND operation_type = 'update'],
  FOR delete WHERE $auth.id->has_role->role->can_execute_operation->operation_metadata[WHERE tables CONTAINS 'has_member' AND operation_type = 'delete'] OR $auth.id->has_case_role->role->can_execute_operation->operation_metadata[WHERE tables CONTAINS 'has_member' AND operation_type = 'delete'];
DEFINE FIELD role_id ON has_member TYPE record<role> PERMISSIONS FULL;
DEFINE FIELD assigned_at ON has_member TYPE datetime VALUE time::now() PERMISSIONS FULL;
DEFINE INDEX unique_case_member ON has_member COLUMNS in, out, role_id UNIQUE;

-- ------------------------------
-- 债权人属于案件
-- ------------------------------
DEFINE TABLE belongs_to TYPE RELATION IN creditor OUT case SCHEMAFULL PERMISSIONS FULL;
DEFINE FIELD created_at ON belongs_to TYPE datetime VALUE time::now() PERMISSIONS FULL;
DEFINE INDEX unique_creditor_case ON belongs_to COLUMNS in, out UNIQUE;

-- ------------------------------
-- 菜单元数据表
-- ------------------------------
DEFINE TABLE menu_metadata TYPE NORMAL SCHEMAFULL PERMISSIONS FOR select WHERE $auth.id->(select * from has_case_role,has_role where case_id = $case_id or case_id =none)->role->(select * from can_access_menu where can_access=true) for create, update, delete none;

DEFINE FIELD menu_id ON menu_metadata TYPE string PERMISSIONS FULL;
DEFINE FIELD path ON menu_metadata TYPE string PERMISSIONS FULL;
DEFINE FIELD label_key ON menu_metadata TYPE string PERMISSIONS FULL;
DEFINE FIELD icon_name ON menu_metadata TYPE string PERMISSIONS FULL;
DEFINE FIELD parent_menu_id ON menu_metadata TYPE option<string> PERMISSIONS FULL;
DEFINE FIELD display_order ON menu_metadata TYPE int DEFAULT 0 PERMISSIONS FULL;
DEFINE FIELD is_active ON menu_metadata TYPE bool DEFAULT true PERMISSIONS FULL;
DEFINE FIELD created_at ON menu_metadata TYPE datetime DEFAULT time::now() READONLY PERMISSIONS FULL;
DEFINE FIELD updated_at ON menu_metadata TYPE datetime VALUE time::now() PERMISSIONS FULL;

DEFINE INDEX menu_metadata_menu_id_idx ON menu_metadata FIELDS menu_id UNIQUE;
DEFINE INDEX menu_metadata_path_idx ON menu_metadata FIELDS path UNIQUE;

-- ------------------------------
-- 操作元数据表
-- ------------------------------
DEFINE TABLE operation_metadata TYPE NORMAL SCHEMAFULL PERMISSIONS FOR select WHERE $auth.id->(select * from has_case_role,has_role where case_id = $case_id or case_id =none)->role->(select * from can_execute_operation where can_execute=true) for create, update, delete none;

DEFINE FIELD operation_id ON operation_metadata TYPE string PERMISSIONS FULL;
DEFINE FIELD menu_id ON operation_metadata TYPE string PERMISSIONS FULL;
DEFINE FIELD operation_name ON operation_metadata TYPE string PERMISSIONS FULL;
DEFINE FIELD operation_type ON operation_metadata TYPE string PERMISSIONS FULL;
DEFINE FIELD description ON operation_metadata TYPE option<string> PERMISSIONS FULL;
DEFINE FIELD tables ON operation_metadata TYPE array<string> DEFAULT [] PERMISSIONS FULL;
DEFINE FIELD is_active ON operation_metadata TYPE bool DEFAULT true PERMISSIONS FULL;
DEFINE FIELD created_at ON operation_metadata TYPE datetime DEFAULT time::now() READONLY PERMISSIONS FULL;
DEFINE FIELD updated_at ON operation_metadata TYPE datetime VALUE time::now() PERMISSIONS FULL;

DEFINE INDEX operation_metadata_id_idx ON operation_metadata FIELDS operation_id UNIQUE;
DEFINE INDEX operation_metadata_menu_idx ON operation_metadata FIELDS menu_id;

-- ------------------------------
-- 角色可以访问菜单
-- ------------------------------
DEFINE TABLE can_access_menu TYPE RELATION IN role OUT menu_metadata SCHEMAFULL PERMISSIONS FULL;
DEFINE FIELD can_access ON can_access_menu TYPE bool DEFAULT true PERMISSIONS FULL;
DEFINE FIELD assigned_at ON can_access_menu TYPE datetime VALUE time::now() PERMISSIONS FULL;
DEFINE INDEX unique_role_menu ON can_access_menu COLUMNS in, out UNIQUE;

-- ------------------------------
-- 角色可以执行操作
-- ------------------------------
DEFINE TABLE can_execute_operation TYPE RELATION IN role OUT operation_metadata SCHEMAFULL PERMISSIONS FULL;
DEFINE FIELD can_execute ON can_execute_operation TYPE bool DEFAULT true PERMISSIONS FULL;
DEFINE FIELD assigned_at ON can_execute_operation TYPE datetime VALUE time::now() PERMISSIONS FULL;
DEFINE INDEX unique_role_operation ON can_execute_operation COLUMNS in, out UNIQUE;

-- ------------------------------
-- 初始化基础数据
-- ------------------------------

-- 初始化角色
INSERT INTO role (id, name, description, created_at, updated_at) VALUES 
(role:admin, 'admin', '系统管理员，拥有所有权限', time::now(), time::now()),
(role:case_manager, 'case_manager', '案件管理人，负责案件的全面管理', time::now(), time::now()),
(role:creditor_representative, 'creditor_representative', '债权人代表，可以申报和查看债权', time::now(), time::now()),
(role:assistant_lawyer, 'assistant_lawyer', '协办律师，协助处理案件事务', time::now(), time::now()),
(role:claim_reviewer, 'claim_reviewer', '债权审核员，负责审核债权申报', time::now(), time::now());

-- 初始化菜单元数据
INSERT INTO menu_metadata (menu_id, path, label_key, icon_name, display_order, is_active, created_at, updated_at) VALUES 
('dashboard', '/dashboard', 'nav_dashboard', 'mdiViewDashboard', 1, true, time::now(), time::now()),
('cases', '/cases', 'nav_case_management', 'mdiBriefcase', 2, true, time::now(), time::now()),
('case_members', '/case-members', 'nav_case_member_management', 'mdiAccountGroup', 3, true, time::now(), time::now()),
('creditors', '/creditors', 'nav_creditor_management', 'mdiAccountCash', 4, true, time::now(), time::now()),
('claims_list', '/claims', 'nav_claim_management', 'mdiFileDocumentOutline', 5, true, time::now(), time::now()),
('my_claims', '/my-claims', 'nav_my_claims', 'mdiFileDocumentSearchOutline', 6, true, time::now(), time::now()),
('claims_submit', '/claims/submit', 'nav_claim_submission', 'mdiFileUploadOutline', 7, true, time::now(), time::now()),
('online_meetings', '/online-meetings', 'nav_online_meetings', 'mdiVideo', 8, true, time::now(), time::now()),
('messages', '/messages', 'nav_message_center', 'mdiMessageTextOutline', 9, true, time::now(), time::now()),
('admin_home', '/admin', 'nav_system_management', 'mdiCog', 10, true, time::now(), time::now()),
('pdf-parser', '/pdf-parser', 'nav_pdf-parser', 'mdiFileDocumentSearchOutline', 60, true, time::now(), time::now());
-- 初始化操作元数据
INSERT INTO operation_metadata (operation_id, menu_id, operation_name, operation_type, description, tables, is_active, created_at, updated_at) VALUES 
('case_list_view', 'cases', '查看案件列表', 'read', '查看所有案件的列表', ['case'], true, time::now(), time::now()),
('case_create', 'cases', '创建案件', 'create', '创建新的破产案件', ['case'], true, time::now(), time::now()),
('case_view_detail', 'cases', '查看案件详情', 'read', '查看案件的详细信息', ['case'], true, time::now(), time::now()),
('case_edit', 'cases', '编辑案件', 'update', '修改案件信息', ['case'], true, time::now(), time::now()),
('case_modify_status', 'cases', '修改案件状态', 'update', '修改案件的流程状态', ['case'], true, time::now(), time::now()),
('case_manage_members', 'cases', '管理案件成员', 'update', '添加或删除案件成员', ['case', 'has_member'], true, time::now(), time::now()),
('case_member_list_view', 'case_members', '查看案件成员列表', 'read', '查看案件成员列表', ['has_member'], true, time::now(), time::now()),
('case_member_add', 'case_members', '添加案件成员', 'create', '向案件添加新成员', ['has_member'], true, time::now(), time::now()),
('case_member_remove', 'case_members', '移除案件成员', 'delete', '从案件中移除成员', ['has_member'], true, time::now(), time::now()),
('case_member_change_owner', 'case_members', '变更案件负责人', 'update', '更改案件的负责人', ['has_member'], true, time::now(), time::now()),
('creditor_list_view', 'creditors', '查看债权人列表', 'read', '查看案件的债权人列表', ['creditor'], true, time::now(), time::now()),
('creditor_create', 'creditors', '添加债权人', 'create', '添加新的债权人', ['creditor'], true, time::now(), time::now()),
('creditor_edit', 'creditors', '编辑债权人', 'update', '修改债权人信息', ['creditor'], true, time::now(), time::now()),
('creditor_delete', 'creditors', '删除债权人', 'delete', '删除债权人记录', ['creditor'], true, time::now(), time::now()),
('creditor_batch_import', 'creditors', '批量导入', 'create', '批量导入债权人数据', ['creditor'], true, time::now(), time::now()),
('creditor_print_waybill', 'creditors', '打印快递单', 'read', '打印债权人快递单', ['creditor'], true, time::now(), time::now()),
('claim_list_view', 'claims_list', '查看债权列表', 'read', '查看所有债权申报记录', ['claim'], true, time::now(), time::now()),
('claim_create_admin', 'claims_list', '代为创建债权', 'create', '管理员代债权人创建债权', ['claim'], true, time::now(), time::now()),
('claim_review', 'claims_list', '审核债权', 'update', '审核债权申报', ['claim'], true, time::now(), time::now()),
('claim_batch_reject', 'claims_list', '批量驳回', 'update', '批量驳回债权申报', ['claim'], true, time::now(), time::now()),
('claim_submit', 'claims_submit', '提交债权', 'create', '债权人提交债权申报', ['claim'], true, time::now(), time::now()),
('claim_edit_draft', 'claims_submit', '编辑草稿', 'update', '编辑未提交的债权草稿', ['claim'], true, time::now(), time::now()),
('claim_view_own', 'my_claims', '查看自己的债权', 'read', '查看自己提交的债权', ['claim'], true, time::now(), time::now()),
('meeting_list_view', 'online_meetings', '查看会议列表', 'read', '查看会议安排', ['meeting'], true, time::now(), time::now()),
('meeting_create', 'online_meetings', '创建会议', 'create', '安排新会议', ['meeting'], true, time::now(), time::now()),
('meeting_edit', 'online_meetings', '编辑会议', 'update', '修改会议信息', ['meeting'], true, time::now(), time::now()),
('meeting_cancel', 'online_meetings', '取消会议', 'update', '取消已安排的会议', ['meeting'], true, time::now(), time::now()),
('meeting_minutes_edit', 'online_meetings', '编辑会议纪要', 'update', '编辑会议纪要', ['meeting'], true, time::now(), time::now()),
('message_view', 'messages', '查看消息', 'read', '查看消息列表', ['message'], true, time::now(), time::now()),
('message_send', 'messages', '发送消息', 'create', '发送新消息', ['message'], true, time::now(), time::now()),
('message_delete', 'messages', '删除消息', 'delete', '删除消息', ['message'], true, time::now(), time::now()),
-- 管理员操作权限
('user_list_view', 'admin_home', '查看用户列表', 'read', '查看所有用户列表', ['user'], true, time::now(), time::now()),
('user_create', 'admin_home', '创建用户', 'create', '创建新用户', ['user'], true, time::now(), time::now()),
('user_edit', 'admin_home', '编辑用户', 'update', '修改用户信息', ['user'], true, time::now(), time::now()),
('user_delete', 'admin_home', '删除用户', 'delete', '删除用户', ['user'], true, time::now(), time::now()),
('role_list_view', 'admin_home', '查看角色列表', 'read', '查看所有角色', ['role'], true, time::now(), time::now()),
('role_create', 'admin_home', '创建角色', 'create', '创建新角色', ['role'], true, time::now(), time::now()),
('role_edit', 'admin_home', '编辑角色', 'update', '修改角色信息', ['role'], true, time::now(), time::now()),
('role_delete', 'admin_home', '删除角色', 'delete', '删除角色', ['role'], true, time::now(), time::now()),
('role_assign', 'admin_home', '分配角色', 'create', '给用户分配角色', ['has_role', 'has_case_role'], true, time::now(), time::now()),
('role_revoke', 'admin_home', '撤销角色', 'delete', '撤销用户角色', ['has_role', 'has_case_role'], true, time::now(), time::now()),
('menu_permission_manage', 'admin_home', '管理菜单权限', 'update', '管理角色的菜单权限', ['can_access_menu'], true, time::now(), time::now()),
('operation_permission_manage', 'admin_home', '管理操作权限', 'update', '管理角色的操作权限', ['can_execute_operation'], true, time::now(), time::now());

-- 初始化角色菜单权限
-- admin 拥有所有菜单权限
FOR $menu IN (SELECT id FROM menu_metadata) {
    RELATE role:admin->can_access_menu->$menu SET can_access = true, assigned_at = time::now();
};

-- case_manager 菜单权限
FOR $menu_id IN ['dashboard', 'cases', 'case_members', 'creditors', 'claims_list', 'online_meetings', 'messages'] {
    LET $menu = (SELECT id FROM menu_metadata WHERE menu_id = $menu_id)[0];
    RELATE role:case_manager->can_access_menu->$menu SET can_access = true, assigned_at = time::now();
};

-- creditor_representative 菜单权限
FOR $menu_id IN ['dashboard', 'my_claims', 'claims_submit', 'online_meetings', 'messages'] {
    LET $menu = (SELECT id FROM menu_metadata WHERE menu_id = $menu_id)[0];
    RELATE role:creditor_representative->can_access_menu->$menu SET can_access = true, assigned_at = time::now();
};

-- assistant_lawyer 菜单权限
FOR $menu_id IN ['dashboard', 'cases', 'creditors', 'claims_list', 'online_meetings', 'messages'] {
    LET $menu = (SELECT id FROM menu_metadata WHERE menu_id = $menu_id)[0];
    RELATE role:assistant_lawyer->can_access_menu->$menu SET can_access = true, assigned_at = time::now();
};

-- claim_reviewer 菜单权限
FOR $menu_id IN ['dashboard', 'claims_list'] {
    LET $menu = (SELECT id FROM menu_metadata WHERE menu_id = $menu_id)[0];
    RELATE role:claim_reviewer->can_access_menu->$menu SET can_access = true, assigned_at = time::now();
};

-- 初始化角色操作权限
-- admin 拥有所有操作权限
FOR $operation IN (SELECT id FROM operation_metadata) {
    RELATE role:admin->can_execute_operation->$operation SET can_execute = true, assigned_at = time::now();
};

-- case_manager 操作权限
FOR $op_id IN ['case_list_view', 'case_create', 'case_view_detail', 'case_edit', 'case_modify_status', 'case_manage_members', 'case_member_list_view', 'case_member_add', 'case_member_remove', 'case_member_change_owner', 'creditor_list_view', 'creditor_create', 'creditor_edit', 'creditor_delete', 'creditor_batch_import', 'creditor_print_waybill', 'claim_list_view', 'claim_create_admin', 'claim_review', 'claim_batch_reject', 'meeting_list_view', 'meeting_create', 'meeting_edit', 'meeting_cancel', 'meeting_minutes_edit', 'message_view', 'message_send', 'message_delete'] {
    LET $operation = (SELECT id FROM operation_metadata WHERE operation_id = $op_id)[0];
    RELATE role:case_manager->can_execute_operation->$operation SET can_execute = true, assigned_at = time::now();
};

-- creditor_representative 操作权限
FOR $op_id IN ['claim_submit', 'claim_edit_draft', 'claim_view_own', 'meeting_list_view', 'message_view', 'message_send'] {
    LET $operation = (SELECT id FROM operation_metadata WHERE operation_id = $op_id)[0];
    RELATE role:creditor_representative->can_execute_operation->$operation SET can_execute = true, assigned_at = time::now();
};

-- assistant_lawyer 操作权限
FOR $op_id IN ['case_list_view', 'case_view_detail', 'creditor_list_view', 'claim_list_view', 'meeting_list_view', 'message_view', 'message_send'] {
    LET $operation = (SELECT id FROM operation_metadata WHERE operation_id = $op_id)[0];
    RELATE role:assistant_lawyer->can_execute_operation->$operation SET can_execute = true, assigned_at = time::now();
};

-- claim_reviewer 操作权限
FOR $op_id IN ['claim_list_view', 'claim_review'] {
    LET $operation = (SELECT id FROM operation_metadata WHERE operation_id = $op_id)[0];
    RELATE role:claim_reviewer->can_execute_operation->$operation SET can_execute = true, assigned_at = time::now();
};

-- ------------------------------
-- WebRTC 相关表结构
-- ------------------------------

-- 通话记录表
DEFINE TABLE call_record TYPE NORMAL SCHEMAFULL PERMISSIONS 
  FOR select WHERE $auth.id IN participants OR $auth.id->has_role->role.name CONTAINS 'admin',
  FOR create WHERE $auth.id,
  FOR update WHERE $auth.id = initiator OR $auth.id->has_role->role.name CONTAINS 'admin',
  FOR delete WHERE $auth.id->has_role->role.name CONTAINS 'admin';

DEFINE FIELD call_id ON call_record TYPE string PERMISSIONS FULL;
DEFINE FIELD call_type ON call_record TYPE string ASSERT $value INSIDE ['audio', 'video', 'conference'] PERMISSIONS FULL;
DEFINE FIELD call_context ON call_record TYPE string ASSERT $value INSIDE ['private', 'group'] PERMISSIONS FULL;
DEFINE FIELD group_id ON call_record TYPE option<record<message_group>> PERMISSIONS FULL;
DEFINE FIELD initiator ON call_record TYPE record<user> DEFAULT $auth.id PERMISSIONS FULL;
DEFINE FIELD participants ON call_record TYPE array<record<user>> PERMISSIONS FULL;
DEFINE FIELD start_time ON call_record TYPE datetime DEFAULT time::now() PERMISSIONS FULL;
DEFINE FIELD end_time ON call_record TYPE option<datetime> PERMISSIONS FULL;
DEFINE FIELD duration ON call_record TYPE option<int> PERMISSIONS FULL;
DEFINE FIELD status ON call_record TYPE string ASSERT $value INSIDE ['completed', 'missed', 'rejected', 'failed'] PERMISSIONS FULL;
DEFINE FIELD recording_url ON call_record TYPE option<string> PERMISSIONS FULL;
DEFINE FIELD case_id ON call_record TYPE option<record<case>> PERMISSIONS FULL;
DEFINE FIELD quality_metrics ON call_record TYPE option<object> PERMISSIONS FULL;
DEFINE FIELD created_at ON call_record TYPE datetime DEFAULT time::now() READONLY PERMISSIONS FULL;
DEFINE FIELD updated_at ON call_record TYPE datetime READONLY VALUE time::now() PERMISSIONS FULL;

DEFINE INDEX call_record_call_id ON call_record FIELDS call_id UNIQUE;
DEFINE INDEX call_record_initiator_idx ON call_record FIELDS initiator, start_time DESC;
DEFINE INDEX call_record_group_idx ON call_record FIELDS group_id, start_time DESC;
DEFINE INDEX call_record_case_idx ON call_record FIELDS case_id, start_time DESC;

-- WebRTC信令消息表
DEFINE TABLE webrtc_signal TYPE NORMAL SCHEMAFULL PERMISSIONS 
  FOR select WHERE from_user = $auth.id OR to_user = $auth.id OR $auth.id IN (SELECT user_id FROM group_member WHERE group_id = $parent.group_id) OR $auth.id->has_role->role.name CONTAINS 'admin',
  FOR create WHERE $auth.id,
  FOR update WHERE from_user = $auth.id,
  FOR delete WHERE from_user = $auth.id OR $auth.id->has_role->role.name CONTAINS 'admin';

DEFINE FIELD signal_type ON webrtc_signal TYPE string ASSERT $value INSIDE ['offer', 'answer', 'ice-candidate', 'call-request', 'call-accept', 'call-reject', 'call-end', 'conference-invite', 'group-call-request', 'group-call-join', 'group-call-leave'] PERMISSIONS FULL;
DEFINE FIELD from_user ON webrtc_signal TYPE record<user> DEFAULT $auth.id PERMISSIONS FULL;
DEFINE FIELD to_user ON webrtc_signal TYPE option<record<user>> PERMISSIONS FULL;
DEFINE FIELD group_id ON webrtc_signal TYPE option<record<message_group>> PERMISSIONS FULL;
DEFINE FIELD signal_data ON webrtc_signal TYPE object PERMISSIONS FULL;
DEFINE FIELD call_id ON webrtc_signal TYPE option<string> PERMISSIONS FULL;
DEFINE FIELD created_at ON webrtc_signal TYPE datetime DEFAULT time::now() READONLY PERMISSIONS FULL;
DEFINE FIELD expires_at ON webrtc_signal TYPE datetime VALUE (time::now() + 1h) PERMISSIONS FULL;
DEFINE FIELD processed ON webrtc_signal TYPE bool DEFAULT false PERMISSIONS FULL;

DEFINE INDEX webrtc_signal_to_user_idx ON webrtc_signal FIELDS to_user, created_at DESC;
DEFINE INDEX webrtc_signal_group_idx ON webrtc_signal FIELDS group_id, created_at DESC;
DEFINE INDEX webrtc_signal_call_idx ON webrtc_signal FIELDS call_id;
DEFINE INDEX webrtc_signal_expires_idx ON webrtc_signal FIELDS expires_at;

-- 用户WebRTC状态表
DEFINE TABLE user_webrtc_status TYPE NORMAL SCHEMAFULL PERMISSIONS 
  FOR select WHERE user_id = $auth.id OR $auth.id->has_role->role.name CONTAINS 'admin',
  FOR create, update WHERE user_id = $auth.id OR $auth.id->has_role->role.name CONTAINS 'admin',
  FOR delete WHERE $auth.id->has_role->role.name CONTAINS 'admin';

DEFINE FIELD user_id ON user_webrtc_status TYPE record<user> PERMISSIONS FULL;
DEFINE FIELD is_online ON user_webrtc_status TYPE bool DEFAULT false PERMISSIONS FULL;
DEFINE FIELD supports_video ON user_webrtc_status TYPE bool DEFAULT false PERMISSIONS FULL;
DEFINE FIELD supports_audio ON user_webrtc_status TYPE bool DEFAULT false PERMISSIONS FULL;
DEFINE FIELD current_call_id ON user_webrtc_status TYPE option<string> PERMISSIONS FULL;
DEFINE FIELD last_seen ON user_webrtc_status TYPE datetime VALUE time::now() PERMISSIONS FULL;
DEFINE FIELD device_info ON user_webrtc_status TYPE object PERMISSIONS FULL;
DEFINE FIELD created_at ON user_webrtc_status TYPE datetime DEFAULT time::now() READONLY PERMISSIONS FULL;
DEFINE FIELD updated_at ON user_webrtc_status TYPE datetime READONLY VALUE time::now() PERMISSIONS FULL;

DEFINE INDEX user_webrtc_status_user_idx ON user_webrtc_status FIELDS user_id UNIQUE;
DEFINE INDEX user_webrtc_status_online_idx ON user_webrtc_status FIELDS is_online, last_seen DESC;

-- 系统配置表
DEFINE TABLE system_config TYPE NORMAL SCHEMAFULL PERMISSIONS 
  FOR select FULL,
  FOR create, update, delete WHERE $auth.id->has_role->role.name CONTAINS 'admin';

DEFINE FIELD config_key ON system_config TYPE string PERMISSIONS FULL;
DEFINE FIELD config_value ON system_config TYPE object PERMISSIONS FULL;
DEFINE FIELD description ON system_config TYPE option<string> PERMISSIONS FULL;
DEFINE FIELD created_at ON system_config TYPE datetime DEFAULT time::now() READONLY PERMISSIONS FULL;
DEFINE FIELD updated_at ON system_config TYPE datetime READONLY VALUE time::now() PERMISSIONS FULL;

DEFINE INDEX system_config_key_idx ON system_config FIELDS config_key UNIQUE;
DEFINE INDEX system_config_value_idx ON system_config FIELDS config_value;
-- 群组消息已读状态表  
DEFINE TABLE message_read_status TYPE NORMAL SCHEMAFULL PERMISSIONS 
  FOR select WHERE user_id = $auth.id OR $auth.id IN (SELECT user_id FROM group_member WHERE group_id = $parent.group_id AND role IN ['owner', 'admin']) OR $auth.id->has_role->role.name CONTAINS 'admin',
  FOR create, update WHERE user_id = $auth.id,
  FOR delete WHERE $auth.id->has_role->role.name CONTAINS 'admin';

DEFINE FIELD message_id ON message_read_status TYPE record<message> PERMISSIONS FULL;
DEFINE FIELD user_id ON message_read_status TYPE record<user> DEFAULT $auth.id PERMISSIONS FULL;
DEFINE FIELD read_at ON message_read_status TYPE datetime DEFAULT time::now() PERMISSIONS FULL;
DEFINE FIELD group_id ON message_read_status TYPE record<message_group> PERMISSIONS FULL;

DEFINE INDEX message_read_unique ON message_read_status FIELDS message_id, user_id UNIQUE;
DEFINE INDEX message_read_group_user_idx ON message_read_status FIELDS group_id, user_id, read_at DESC;

-- 群组最后已读位置表（性能优化）
DEFINE TABLE group_read_position TYPE NORMAL SCHEMAFULL PERMISSIONS 
  FOR select WHERE user_id = $auth.id OR $auth.id IN (SELECT user_id FROM group_member WHERE group_id = $parent.group_id AND role IN ['owner', 'admin']) OR $auth.id->has_role->role.name CONTAINS 'admin',
  FOR create, update WHERE user_id = $auth.id,
  FOR delete WHERE $auth.id->has_role->role.name CONTAINS 'admin';

DEFINE FIELD group_id ON group_read_position TYPE record<message_group> PERMISSIONS FULL;
DEFINE FIELD user_id ON group_read_position TYPE record<user> DEFAULT $auth.id PERMISSIONS FULL;
DEFINE FIELD last_read_message_id ON group_read_position TYPE option<record<message>> PERMISSIONS FULL;
DEFINE FIELD last_read_time ON group_read_position TYPE datetime DEFAULT time::now() PERMISSIONS FULL;
DEFINE FIELD unread_count ON group_read_position TYPE int DEFAULT 0 PERMISSIONS FULL;

DEFINE INDEX group_read_position_unique ON group_read_position FIELDS group_id, user_id UNIQUE;

-- 给admin用户赋予admin角色（全局角色）
RELATE user:admin->has_role->role:admin SET assigned_at = time::now();

-- 初始化通知规则数据
INSERT INTO notification_rule (procedure_phase, trigger_condition, message_template, notification_frequency, notification_time, is_active, created_at, updated_at) VALUES 
('立案', '受理时间+25天-当前时间 <= 5天', '距离最迟公告时间仅有 {{days}} 天', 'DAILY', '10:00', true, time::now(), time::now()),
('公告', '公告时间+30天-当前时间 <= 3天', '距离开始债权申报时间还有 {{days}} 天', 'DAILY', '10:00', true, time::now(), time::now()),
('债权申报', '公告时间+3月-当前时间 <= 3天', '距离债权申报截止还有 {{days}} 天', 'DAILY', '10:00', true, time::now(), time::now()),
('债权人第一次会议', '债权申报截止时间+15日-当前时间 <= 3天', '距离第一次债权人会议截止时间还有 {{days}} 天', 'DAILY', '10:00', true, time::now(), time::now()),
('裁定重整', '裁定重整时间+6月-当前时间 <= 5天', '距离提交重整计划截止时间还有 {{days}} 天，超时未提交将宣告破产清算', 'DAILY', '10:00', true, time::now(), time::now()),
('延迟提交重整计划', '延迟提交重整计划时间+3月-当前时间 <= 5天', '距离提交重整计划截止时间还有 {{days}} 天，超时未提交将宣告破产清算', 'DAILY', '10:00', true, time::now(), time::now()),
('债权人第二次会议', '提交重整计划时间+15日-当前时间 <= 3天', '距离第二次债权人会议通知截止时间还有 {{days}} 天', 'DAILY', '10:00', true, time::now(), time::now());

-- ------------------------------
-- WebRTC 配置数据初始化
-- ------------------------------

-- 插入WebRTC默认配置
INSERT INTO system_config {
  config_key: 'rtc',
  config_value: {
    // WebRTC服务器配置
    stun_servers: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'],
    
    // P2P文件传输限制
    max_file_size: 104857600, // 100MB
    file_chunk_size: 65536,   // 64KB
    supported_image_types: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'],
    supported_video_types: ['mp4', 'webm', 'mov', 'avi', 'wmv'],
    supported_audio_types: ['mp3', 'wav', 'ogg', 'aac', 'm4a'],
    supported_document_types: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt'],
    
    // 功能开关
    enable_voice_call: true,
    enable_video_call: true,
    enable_screen_share: true,
    enable_file_transfer: true,
    enable_group_chat: true,
    enable_group_call: true,
    enable_message_recall: true,
    enable_message_edit: true,
    max_conference_participants: 8,
    max_group_members: 100,
    
    // 超时设置
    file_transfer_timeout: 300000, // 5分钟
    call_timeout: 30000,          // 30秒
    signal_expiry: 3600000,       // 信令1小时过期
    message_recall_timeout: 120,  // 消息撤回时限(秒)
    
    // 网络质量阈值
    network_quality_thresholds: {
      excellent: { bandwidth: 2000, latency: 50, packet_loss: 0.1 },
      good: { bandwidth: 1000, latency: 100, packet_loss: 0.5 },
      fair: { bandwidth: 500, latency: 200, packet_loss: 1.0 },
      poor: { bandwidth: 200, latency: 300, packet_loss: 2.0 }
    },
    
    // 质量设置
    video_quality: {
      low: { width: 320, height: 240, framerate: 15, bitrate: 150000 },
      medium: { width: 640, height: 480, framerate: 24, bitrate: 500000 },
      high: { width: 1280, height: 720, framerate: 30, bitrate: 1000000 },
      ultra: { width: 1920, height: 1080, framerate: 30, bitrate: 2000000 }
    },
    audio_quality: {
      low: { bitrate: 32000, sampleRate: 16000 },
      medium: { bitrate: 64000, sampleRate: 44100 },
      high: { bitrate: 128000, sampleRate: 48000 }
    },
    
    // 数据清理配置
    cleanup_config: {
      signal_retention_hours: 24,        // 信令消息保留24小时
      call_record_retention_days: 365,   // 通话记录保留1年
      file_cache_retention_days: 30,     // 文件缓存保留30天
      read_status_retention_days: 90     // 已读状态保留90天
    },
    
    // 性能优化配置
    performance_config: {
      message_batch_size: 50,            // 消息批量加载大小
      max_concurrent_transfers: 3,       // 最大并发文件传输数
      chunk_upload_concurrency: 2,      // 分片上传并发数
      enable_message_pagination: true,  // 启用消息分页
      cache_message_count: 100          // 本地缓存消息数量
    }
  },
  description: 'WebRTC功能配置项',
  created_at: time::now()
};

-- 添加数据清理定时任务配置
INSERT INTO system_config {
  config_key: 'cleanup_schedule',
  config_value: {
    enabled: true,
    schedules: [
      {
        name: 'clean_expired_signals',
        cron: '0 */6 * * *', // 每6小时清理一次过期信令
        query: 'DELETE webrtc_signal WHERE expires_at < time::now()',
        enabled: true
      },
      {
        name: 'clean_old_call_records',
        cron: '0 2 * * *', // 每天凌晨2点清理
        query: 'DELETE call_record WHERE start_time < (time::now() - 365d)',
        enabled: true
      },
      {
        name: 'optimize_read_status',
        cron: '0 3 * * 0', // 每周日凌晨3点优化已读状态
        query: 'DELETE message_read_status WHERE read_at < (time::now() - 90d)',
        enabled: true
      }
    ]
  },
  description: '数据清理定时任务配置',
  created_at: time::now()
};