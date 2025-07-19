import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
// import LanguageDetector from 'i18next-browser-languagedetector'; // Optional: for language detection

// For now, we will define translations directly here.
// In a larger app, you would import them from JSON files in a `locales` directory.
// e.g., import translationZH from './locales/zh-CN/translation.json';
// For this step, we'll create a basic structure for Chinese translations.

const resources = {
  zh: { // Use 'zh' or 'zh-CN'. 'zh' is simpler if you don't plan regional variations initially.
    translation: {
      // Common
      "loading_session": "正在加载会话...",
      "loading_info": "正在加载您的信息...",
      "loading_case_info": "正在加载案件信息...",
      "authenticating": "正在进行身份验证...",
      "redirecting": "已登录，正在跳转...",
      "error_login_failed": "登录失败，请重试。",
      "error_admin_login_failed": "管理员直接登录失败: {{message}}", // Example with interpolation
      "check_credentials_and_connection": "请检查凭据和数据库连接。",
      "error_oidc_init_failed": "OIDC 登录启动失败，请重试。",
      "platform_name": "CuckooX 平台", // App name if it needs translation, otherwise keep as CuckooX
      "copyright_platform": "CuckooX 平台 © {{year}}",
      "administrator_name": "管理员", // ADDED
      "admin_login_attempt_loading": "正在尝试管理员登录...", // ADDED


      // LoginPage
      "login_page_title": "CuckooX", // Title on login page
      "login_page_subtitle": "破产案件管理平台", // Subtitle on login page
      "login_page_subtitle_admin": "管理员登录", // Subtitle on login page
      "login_page_subtitle_user": "用户登录", // Subtitle on login page
      "login_subtitle": "欢迎登陆", // Subtitle on login page
      "or": "或", // Subtitle on login page
      "admin_login_link": "使用 admin 登录",
      "login_github_prompt": "请使用您的 GitHub 帐号登录以继续。",
      "login_github_button": "使用 GitHub 登录",
      "login_github_redirect_info": "您将被重定向到 GitHub进行身份验证。",

      // CaseSelectionPage
      "case_selection_title": "选择案件",
      "case_selection_welcome": "欢迎，{{name}}。请选择一个案件以继续。",
      "case_selection_no_cases": "当前没有为您分配任何案件或没有可供选择的案件。",
      "case_selection_no_cases_contact_support": "如果您认为这是一个错误，请联系支持人员。",
      "case_selection_case_number_label": "案件编号：{{caseNumber}}",

      // Layout
      "layout_sidebar_app_name": "CuckooX",
      "layout_logout_button": "登出",
      "layout_header_title": "破产案件管理", // Bankruptcy Management
      "layout_header_welcome": "欢迎，{{name}}",
      "nav_dashboard": "仪表盘",
      "nav_case_management": "案件管理",
      "nav_creditor_management": "债权人管理",
      "nav_claim_management": "债权申报与审核",
      "nav_online_meetings": "在线会议",
      "nav_message_center": "消息中心",
      "nav_system_management": "系统管理",
      "nav_case_member_management": "成员管理",
      "nav_my_claims": "我的债权",
      "nav_claim_submission": "债权申报",

      // ProtectedRoute (already covered by common)

      // OidcCallbackPage
      "oidc_callback_loading_session": "正在加载用户会话...",
      // error_login_failed is already defined in common

      // CaseDetailPage
      "case_detail_page_title_prefix": "案件详情", // e.g., "案件详情: BK-123"
      "case_detail_id_label": "案件ID",
      "case_detail_back_to_list_link": "返回案件列表",
      "case_detail_basic_info_title": "基本信息",
      "case_detail_name_label": "案件名称",
      "case_detail_lead_label": "案件负责人",
      "case_detail_acceptance_time_label": "受理时间",
      "case_detail_current_stage_label": "当前阶段",
      "case_detail_status_label": "案件状态", // ADDED
      "case_detail_details_label": "案件详情", // ADDED
      "case_detail_timeline_title": "时间轴", // Keep placeholder or translate
      "case_detail_timeline_event1": "立案: 2023-01-10", // ADDED (example, can be made dynamic)
      "case_detail_timeline_event2": "公告: 2023-01-15", // ADDED
      "case_detail_timeline_event3": "债权申报开始: 2023-02-15", // ADDED
      "case_detail_filing_material_title": "立案材料",
      "case_detail_filing_material_empty": "（当前无立案材料内容）",
      "case_detail_actions_meeting_minutes_button": "填写会议纪要",
      "case_detail_actions_change_status_button": "修改状态",
      "case_detail_footer_info_1": "此页面将展示案件的详细信息，包括左侧固定的基本信息和时间轴，主区域展示立案材料。",
      "case_detail_footer_info_2": "操作（如修改状态、填写会议纪要）将根据案件阶段和用户权限显示。",
      "case_detail_error_not_found": "案件未找到。",
      "case_detail_error_fetch_failed": "获取案件详情失败。请稍后重试。",
      "case_detail_loading": "正在加载案件详情...",
      "case_detail_unspecified_case": "未找到指定案件。",
      "case_detail_unnamed_case": "未命名案件", // ADDED
      "case_detail_to_be_assigned": "待分配", // ADDED
      "case_detail_date_unknown": "日期未知", // ADDED
      "case_detail_stage_unknown": "阶段未知", // ADDED
      "case_detail_status_unknown": "状态未知", // ADDED
      "case_detail_no_details": "暂无详细信息。", // ADDED
      "case_detail_content_loaded": "内容已加载", // May not be needed if editor shows content directly
      "case_detail_no_filing_material": "无立案材料内容。",
      "case_detail_filing_material_not_found": "（立案材料内容未找到）", // ADDED
      "case_detail_no_associated_filing_material": "（无关联立案材料文档）", // ADDED


      // CreateCasePage
      "create_case_page_title": "创建新案件",
      "create_case_back_to_list_link": "返回案件列表",
      "create_case_intro_p1": "此页面用于填写新案件的详细信息，包括案件基本情况和立案材料。",
      "create_case_intro_p2": "(表单字段，如案件名称、案件编号等，将在此处添加)",
      "create_case_filing_material_title": "立案材料",
      "create_case_filing_material_editor_placeholder": "（此处将集成可编辑的 RichTextEditor 用于撰写立案材料）",
      "create_case_filing_material_editor_area_placeholder": "[富文本编辑器区域]",
      "create_case_save_button": "保存案件",
      
      // RichTextEditor (placeholder for editor itself)
      "richtexteditor_placeholder": "撰写内容...",

      // CreateCasePage (new additions for real-time)
      "create_case_error_no_filing_doc": "立案材料文档未准备好。",
      "create_case_success": "案件创建成功！",
      "create_case_error_generic": "创建案件失败。",
      "create_case_editor_loading_new_doc": "正在准备编辑器...",
      "saving_document": "正在保存文档...",
      "saving_case_button_saving": "正在保存案件...",

      // RichTextEditor保存相关
      "save": "保存",
      "saving": "保存中...",
      "document_saved": "文档已保存",
      "document_save_failed": "文档保存失败",
      "auto_save_enabled": "已启用自动保存",
      "unsaved_changes": "有未保存的更改",

      // CaseMemberTab
      "case_members_title": "成员管理",
      "add_member_button": "添加成员",
      "no_members_added": "暂无成员",
      "remove_member_action": "移除成员",
      "confirm_change_owner_title": "确认变更负责人",
      "confirm_change_owner_text": "确认将{userName}设为新的负责人？您将成为普通成员。",
      "confirm_change_button": "确认变更",
      "confirm_removal_title": "确认移除",
      "confirm_removal_text": "确认移除{userName}？",
      "remove_button": "移除",
      "cancel_button": "取消",
      "add_selected_user": "添加选中用户",
      "add_member_dialog_title": "添加新成员到案件",
      "search_users_label": "搜索用户（按姓名或邮箱）",
      "search_users_helper_text": "请输入至少2个字符进行搜索。",
      "no_users_found": "未找到匹配的用户。",
      "search_users_error": "搜索用户失败。请重试。",
      "please_select_user": "请选择一个用户。",
      "add_member_error": "添加成员失败。请重试。",
    }
  }
};

i18n
  // .use(LanguageDetector) // Optional: To detect user language from browser settings/localStorage
  .use(initReactI18next) // Passes i18n down to react-i18next
  .init({
    resources,
    lng: 'zh', // Default language to Chinese
    fallbackLng: 'zh', // Fallback language if a translation is missing in a specific regional dialect (e.g., zh-CN)
    interpolation: {
      escapeValue: false // React already safes from xss
    },
    // detection: { // Optional LanguageDetector options
    //   order: ['queryString', 'cookie', 'localStorage', 'navigator', 'htmlTag', 'path', 'subdomain'],
    //   caches: ['localStorage', 'cookie'],
    // }
  });

export default i18n;
