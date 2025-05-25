-- Define Users Table
DEFINE TABLE user SCHEMAFULL
  PERMISSIONS
    FOR select FULL
    FOR create, update, delete WHERE id = $auth.id OR $auth.roles CONTAINS 'admin';

DEFINE FIELD github_id ON user TYPE string;
DEFINE FIELD name ON user TYPE string;
DEFINE FIELD email ON user TYPE string ASSERT is::email($value);
DEFINE FIELD created_at ON user TYPE datetime VALUE $before OR time::now();
DEFINE FIELD updated_at ON user TYPE datetime VALUE time::now();
DEFINE FIELD last_login_case_id ON user TYPE option<record<case>>; -- Optional link to the last case

-- Define Cases Table
DEFINE TABLE case SCHEMAFULL
  PERMISSIONS
    FOR select FULL -- Or more restrictive based on user_case_role
    FOR create, update, delete WHERE $auth.roles CONTAINS 'admin' OR $auth.id = admin_id;

DEFINE FIELD name ON case TYPE string;
DEFINE FIELD case_number ON case TYPE string;
DEFINE FIELD details ON case TYPE string;
DEFINE FIELD created_at ON case TYPE datetime VALUE $before OR time::now();
DEFINE FIELD updated_at ON case TYPE datetime VALUE time::now();
DEFINE FIELD status ON case TYPE string; -- e.g., 'open', 'closed', 'archived'
DEFINE FIELD admin_id ON case TYPE record<user>; -- Link to a user who administers the case
DEFINE FIELD filing_material_doc_id ON case TYPE option<record<document>>; -- ADD THIS LINE for QuillJS content

-- Define Roles Table
DEFINE TABLE role SCHEMAFULL
  PERMISSIONS
    FOR select FULL
    FOR create, update, delete WHERE $auth.roles CONTAINS 'admin';

DEFINE FIELD name ON role TYPE string ASSERT $value != NONE AND string::len($value) > 0;
DEFINE FIELD description ON role TYPE string;

-- Define User Case Role Table (Link between users, cases, and their role in that case)
DEFINE TABLE user_case_role SCHEMAFULL
  PERMISSIONS
    FOR select WHERE $auth.roles CONTAINS 'admin' OR user_id = $auth.id OR case_id.admin_id = $auth.id
    FOR create, update, delete WHERE $auth.roles CONTAINS 'admin' OR case_id.admin_id = $auth.id;

DEFINE FIELD user_id ON user_case_role TYPE record<user>;
DEFINE FIELD case_id ON user_case_role TYPE record<case>;
DEFINE FIELD role_id ON user_case_role TYPE record<role>;
DEFINE INDEX user_case_idx ON user_case_role COLUMNS user_id, case_id UNIQUE;

-- Define Permissions Table (More granular, if needed beyond simple role names)
DEFINE TABLE permission SCHEMAFULL
  PERMISSIONS
    FOR select FULL
    FOR create, update, delete WHERE $auth.roles CONTAINS 'admin';

DEFINE FIELD action ON permission TYPE string; -- e.g., 'create', 'read', 'update', 'delete'
DEFINE FIELD resource ON permission TYPE string; -- e.g., 'case', 'document', 'claim'
DEFINE INDEX permission_idx ON permission COLUMNS action, resource UNIQUE;

-- Define Role Permission Table (Link roles to granular permissions)
DEFINE TABLE role_permission SCHEMAFULL
  PERMISSIONS
    FOR select FULL
    FOR create, update, delete WHERE $auth.roles CONTAINS 'admin';

DEFINE FIELD role_id ON role_permission TYPE record<role>;
DEFINE FIELD permission_id ON role_permission TYPE record<permission>;
DEFINE INDEX role_permission_idx ON role_permission COLUMNS role_id, permission_id UNIQUE;

-- Define Menu Items Table
DEFINE TABLE menu_item SCHEMAFULL
  PERMISSIONS
    FOR select FULL
    FOR create, update, delete WHERE $auth.roles CONTAINS 'admin';

DEFINE FIELD path ON menu_item TYPE string UNIQUE; -- e.g., '/dashboard', '/cases'
DEFINE FIELD label ON menu_item TYPE string; -- e.g., 'Dashboard', '案件管理'
DEFINE FIELD icon ON menu_item TYPE option<string>; -- e.g., 'dashboard', 'gavel'
DEFINE FIELD parent_id ON menu_item TYPE option<record<menu_item>>; -- For sub-menus
DEFINE FIELD display_order ON menu_item TYPE int DEFAULT 0; -- To control menu order

-- Define Role Menu Item Table (Link roles to menu items they can see)
DEFINE TABLE role_menu_item SCHEMAFULL
  PERMISSIONS
    FOR select FULL
    FOR create, update, delete WHERE $auth.roles CONTAINS 'admin';

DEFINE FIELD role_id ON role_menu_item TYPE record<role>;
DEFINE FIELD menu_item_id ON role_menu_item TYPE record<menu_item>;
DEFINE INDEX role_menu_item_idx ON role_menu_item COLUMNS role_id, menu_item_id UNIQUE;

-- Example of setting up default roles (can be run once manually or via a seeding script)
-- INSERT INTO role (name, description) VALUES ('admin', 'System Administrator'), ('manager', 'Case Manager'), ('creditor_representative', 'Creditor Representative');

-- Define Document Table (for QuillJS content)
DEFINE TABLE document SCHEMAFULL
  PERMISSIONS
    FOR select FULL -- More specific permissions can be applied when linking from other tables
    FOR create WHERE $auth.id -- Any authenticated user can create a document
    FOR update WHERE $auth.id = created_by OR $auth.id = last_edited_by OR $auth.roles CONTAINS 'admin' -- Example: creator or last editor
    FOR delete WHERE $auth.id = created_by OR $auth.roles CONTAINS 'admin'; -- Example: only creator or admin

DEFINE FIELD content ON document TYPE string DEFAULT ''; -- Stores HTML or JSON (e.g. Quill Delta)
DEFINE FIELD created_at ON document TYPE datetime VALUE $before OR time::now();
DEFINE FIELD updated_at ON document TYPE datetime VALUE time::now() ON DUPLICATE KEY UPDATE updated_at = time::now();
DEFINE FIELD created_by ON document TYPE record<user> VALUE $auth.id DEFAULT $auth.id;
DEFINE FIELD last_edited_by ON document TYPE option<record<user>>;
DEFINE FIELD version ON document TYPE int DEFAULT 1;
DEFINE FIELD locked_by ON document TYPE option<record<user>>; -- For simple optimistic locking if needed for real-time
DEFINE FIELD locked_at ON document TYPE option<datetime>;

-- Example of how to update updated_at and last_edited_by on content change (using event or within application logic)
-- DEFINE EVENT content_changed ON document WHEN $event = "UPDATE" AND $before.content != $after.content THEN {
--   UPDATE $after.id SET updated_at = time::now(), last_edited_by = $auth.id, version = $before.version + 1;
-- };
-- Note: SurrealDB events might not be ideal for frequent updates like collaborative editing.
-- Application-level logic for updating these fields on save is more common.
-- For now, the `ON DUPLICATE KEY UPDATE` on `updated_at` and explicit setting of `last_edited_by` by the app is fine.
