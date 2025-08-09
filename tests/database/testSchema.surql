-- =======================================
-- 测试数据库 Schema - 精简版本
-- =======================================

-- 去掉复杂权限控制，专门用于单元测试
OPTION IMPORT;

-- ------------------------------
-- TABLE: user (测试用户)
-- ------------------------------

DEFINE TABLE user TYPE NORMAL SCHEMAFULL PERMISSIONS FULL;

DEFINE FIELD github_id ON user TYPE string PERMISSIONS FULL;
DEFINE FIELD name ON user TYPE string PERMISSIONS FULL;
DEFINE FIELD email ON user TYPE string PERMISSIONS FULL;
DEFINE FIELD avatar_url ON user TYPE option<string> PERMISSIONS FULL;
DEFINE FIELD created_at ON user TYPE datetime DEFAULT time::now() PERMISSIONS FULL;
DEFINE FIELD updated_at ON user TYPE datetime VALUE time::now() PERMISSIONS FULL;

DEFINE INDEX user_github_id_idx ON user FIELDS github_id UNIQUE;
DEFINE INDEX user_email_idx ON user FIELDS email UNIQUE;

-- ------------------------------
-- TABLE: case (破产案件)
-- ------------------------------

DEFINE TABLE case TYPE NORMAL SCHEMAFULL PERMISSIONS FULL;

DEFINE FIELD acceptance_date ON case TYPE datetime PERMISSIONS FULL;
DEFINE FIELD announcement_date ON case TYPE option<datetime> PERMISSIONS FULL;
DEFINE FIELD case_lead_user_id ON case TYPE option<record<user>> PERMISSIONS FULL;
DEFINE FIELD case_manager_name ON case TYPE string PERMISSIONS FULL;
DEFINE FIELD case_number ON case TYPE string PERMISSIONS FULL;
DEFINE FIELD case_procedure ON case TYPE string DEFAULT '破产' PERMISSIONS FULL;
DEFINE FIELD claim_submission_end_date ON case TYPE option<datetime> PERMISSIONS FULL;
DEFINE FIELD claim_submission_start_date ON case TYPE option<datetime> PERMISSIONS FULL;
DEFINE FIELD closing_date ON case TYPE option<datetime> PERMISSIONS FULL;
DEFINE FIELD created_at ON case TYPE datetime DEFAULT time::now() PERMISSIONS FULL;
DEFINE FIELD created_by_user ON case TYPE record<user> PERMISSIONS FULL;
DEFINE FIELD name ON case TYPE string PERMISSIONS FULL;
DEFINE FIELD procedure_phase ON case TYPE string DEFAULT '立案' PERMISSIONS FULL;
DEFINE FIELD selected_theme_name ON case TYPE option<string> PERMISSIONS FULL;
DEFINE FIELD updated_at ON case TYPE datetime VALUE time::now() PERMISSIONS FULL;

DEFINE INDEX case_case_number_idx ON case FIELDS case_number UNIQUE;

-- ------------------------------
-- TABLE: document (文档)
-- ------------------------------

DEFINE TABLE document TYPE NORMAL SCHEMAFULL PERMISSIONS FULL;

DEFINE FIELD content ON document TYPE string PERMISSIONS FULL;
DEFINE FIELD created_at ON document TYPE datetime DEFAULT time::now() PERMISSIONS FULL;
DEFINE FIELD created_by ON document TYPE record<user> PERMISSIONS FULL;
DEFINE FIELD last_edited_by ON document TYPE record<user> PERMISSIONS FULL;
DEFINE FIELD updated_at ON document TYPE datetime VALUE time::now() PERMISSIONS FULL;

-- ------------------------------
-- TABLE: creditor (债权人)
-- ------------------------------

DEFINE TABLE creditor TYPE NORMAL SCHEMAFULL PERMISSIONS FULL;

DEFINE FIELD case_id ON creditor TYPE record<case> PERMISSIONS FULL;
DEFINE FIELD name ON creditor TYPE string PERMISSIONS FULL;
DEFINE FIELD phone ON creditor TYPE option<string> PERMISSIONS FULL;
DEFINE FIELD email ON creditor TYPE option<string> PERMISSIONS FULL;
DEFINE FIELD address ON creditor TYPE option<string> PERMISSIONS FULL;
DEFINE FIELD organization_code ON creditor TYPE option<string> PERMISSIONS FULL;
DEFINE FIELD id_number ON creditor TYPE option<string> PERMISSIONS FULL;
DEFINE FIELD creditor_type ON creditor TYPE string DEFAULT 'individual' PERMISSIONS FULL;
DEFINE FIELD created_at ON creditor TYPE datetime DEFAULT time::now() PERMISSIONS FULL;
DEFINE FIELD updated_at ON creditor TYPE datetime VALUE time::now() PERMISSIONS FULL;

DEFINE INDEX creditor_case_idx ON creditor FIELDS case_id;

-- ------------------------------
-- TABLE: claim (债权申报)
-- ------------------------------

DEFINE TABLE claim TYPE NORMAL SCHEMAFULL PERMISSIONS FULL;

DEFINE FIELD case_id ON claim TYPE record<case> PERMISSIONS FULL;
DEFINE FIELD creditor_id ON claim TYPE record<creditor> PERMISSIONS FULL;
DEFINE FIELD created_by ON claim TYPE record<user> PERMISSIONS FULL;
DEFINE FIELD claim_amount ON claim TYPE decimal PERMISSIONS FULL;
DEFINE FIELD claim_nature ON claim TYPE string DEFAULT 'ordinary' PERMISSIONS FULL;
DEFINE FIELD claim_description ON claim TYPE option<string> PERMISSIONS FULL;
DEFINE FIELD review_status ON claim TYPE string DEFAULT '待提交' PERMISSIONS FULL;
DEFINE FIELD created_at ON claim TYPE datetime DEFAULT time::now() PERMISSIONS FULL;
DEFINE FIELD updated_at ON claim TYPE datetime VALUE time::now() PERMISSIONS FULL;

DEFINE INDEX claim_case_idx ON claim FIELDS case_id;
DEFINE INDEX claim_creditor_idx ON claim FIELDS creditor_id;

-- ------------------------------
-- TABLE: role (角色)
-- ------------------------------

DEFINE TABLE role TYPE NORMAL SCHEMAFULL PERMISSIONS FULL;

DEFINE FIELD name ON role TYPE string PERMISSIONS FULL;
DEFINE FIELD display_name ON role TYPE string PERMISSIONS FULL;
DEFINE FIELD description ON role TYPE option<string> PERMISSIONS FULL;
DEFINE FIELD created_at ON role TYPE datetime DEFAULT time::now() PERMISSIONS FULL;
DEFINE FIELD updated_at ON role TYPE datetime VALUE time::now() PERMISSIONS FULL;

DEFINE INDEX role_name_idx ON role FIELDS name UNIQUE;

-- ------------------------------
-- TABLE: operation_metadata (操作元数据)
-- ------------------------------

DEFINE TABLE operation_metadata TYPE NORMAL SCHEMAFULL PERMISSIONS FULL;

DEFINE FIELD name ON operation_metadata TYPE string PERMISSIONS FULL;
DEFINE FIELD display_name ON operation_metadata TYPE string PERMISSIONS FULL;
DEFINE FIELD operation_type ON operation_metadata TYPE string PERMISSIONS FULL;
DEFINE FIELD tables ON operation_metadata TYPE array<string> PERMISSIONS FULL;
DEFINE FIELD description ON operation_metadata TYPE option<string> PERMISSIONS FULL;
DEFINE FIELD created_at ON operation_metadata TYPE datetime DEFAULT time::now() PERMISSIONS FULL;

DEFINE INDEX operation_metadata_name_idx ON operation_metadata FIELDS name UNIQUE;

-- ------------------------------
-- TABLE: menu_metadata (菜单元数据)
-- ------------------------------

DEFINE TABLE menu_metadata TYPE NORMAL SCHEMAFULL PERMISSIONS FULL;

DEFINE FIELD name ON menu_metadata TYPE string PERMISSIONS FULL;
DEFINE FIELD display_name ON menu_metadata TYPE string PERMISSIONS FULL;
DEFINE FIELD path ON menu_metadata TYPE option<string> PERMISSIONS FULL;
DEFINE FIELD icon ON menu_metadata TYPE option<string> PERMISSIONS FULL;
DEFINE FIELD parent_id ON menu_metadata TYPE option<record<menu_metadata>> PERMISSIONS FULL;
DEFINE FIELD sort_order ON menu_metadata TYPE int DEFAULT 0 PERMISSIONS FULL;
DEFINE FIELD is_active ON menu_metadata TYPE bool DEFAULT true PERMISSIONS FULL;
DEFINE FIELD created_at ON menu_metadata TYPE datetime DEFAULT time::now() PERMISSIONS FULL;

DEFINE INDEX menu_metadata_name_idx ON menu_metadata FIELDS name UNIQUE;

-- ------------------------------
-- RELATION TABLES (关系表)
-- ------------------------------

-- 用户角色关系
DEFINE TABLE has_role TYPE RELATION IN user OUT role SCHEMAFULL PERMISSIONS FULL;
DEFINE FIELD assigned_at ON has_role TYPE datetime DEFAULT time::now() PERMISSIONS FULL;
DEFINE FIELD assigned_by ON has_role TYPE record<user> PERMISSIONS FULL;

-- 用户案件角色关系
DEFINE TABLE has_case_role TYPE RELATION IN user OUT role SCHEMAFULL PERMISSIONS FULL;
DEFINE FIELD case_id ON has_case_role TYPE record<case> PERMISSIONS FULL;
DEFINE FIELD assigned_at ON has_case_role TYPE datetime DEFAULT time::now() PERMISSIONS FULL;
DEFINE FIELD assigned_by ON has_case_role TYPE record<user> PERMISSIONS FULL;

-- 角色操作权限关系
DEFINE TABLE can_execute_operation TYPE RELATION IN role OUT operation_metadata SCHEMAFULL PERMISSIONS FULL;
DEFINE FIELD granted_at ON can_execute_operation TYPE datetime DEFAULT time::now() PERMISSIONS FULL;
DEFINE FIELD granted_by ON can_execute_operation TYPE record<user> PERMISSIONS FULL;

-- 角色菜单访问权限关系
DEFINE TABLE can_access_menu TYPE RELATION IN role OUT menu_metadata SCHEMAFULL PERMISSIONS FULL;
DEFINE FIELD granted_at ON can_access_menu TYPE datetime DEFAULT time::now() PERMISSIONS FULL;
DEFINE FIELD granted_by ON can_access_menu TYPE record<user> PERMISSIONS FULL;

-- 案件成员关系
DEFINE TABLE has_member TYPE RELATION IN case OUT user SCHEMAFULL PERMISSIONS FULL;
DEFINE FIELD role_name ON has_member TYPE string PERMISSIONS FULL;
DEFINE FIELD assigned_at ON has_member TYPE datetime DEFAULT time::now() PERMISSIONS FULL;
DEFINE FIELD assigned_by ON has_member TYPE record<user> PERMISSIONS FULL;