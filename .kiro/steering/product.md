# Product Overview

CuckooX-Google is a comprehensive legal case management system specifically designed for enterprise bankruptcy case management. The system provides end-to-end workflow management for bankruptcy proceedings with real-time collaboration capabilities.


Always respond in Chinese-simplified.

## Core Features

- **Legal Case Management**: Complete enterprise bankruptcy case lifecycle management
- **Real-time Data Sync**: SurrealDB Live Query-based real-time updates
- **Smart Data Caching**: Service Worker-driven dual-layer caching architecture
- **Rich Text Collaboration**: QuillJS v2-powered collaborative editor
- **Permission Management**: Role-based fine-grained access control
- **Responsive Design**: Multi-device support (Android, iOS, PC fullscreen, PC 600x800)
- **PDF智能识别**: AI-powered PDF document parsing and entity extraction
- **破产企业主体管理**: Comprehensive bankruptcy entity management with relationship tracking

## Business Domain

The system manages the complete bankruptcy case workflow:
```
立案 → 公告 → 债权申报 → 债权人第一次会议 → 
├─ 破产清算
└─ 裁定重整 → 提交重整计划/延迟提交重整计划 → 债权人第二次会议 → 结案
```

## Key User Roles

- **ADMIN**: Super administrator
- **案件负责人**: Case manager with full case management permissions
- **协办律师**: Assistant lawyer for case processing
- **债权审核员**: Claim auditor with claim review permissions
- **债权人**: Creditor with claim submission permissions

## Authentication

- **Primary**: GitHub OIDC login via backend OIDC service
- **Admin**: Direct SurrealDB login (when URL contains `admin=true`)
- **Case Selection**: Automatic priority-based case selection after login

## PDF智能识别系统

系统集成了先进的PDF智能识别功能，支持法律文档的自动解析和信息提取：

### 支持的文档类型
- **破产立案书**: 自动识别立案对象企业信息，包括企业名称、统一社会信用代码、法定代表人、注册地址等
- **债权合同**: 智能提取合同双方信息、合同金额、利息计算方式、合同日期等关键债权信息
- **其他法律文档**: 可扩展支持更多类型的法律文档识别

### 交互式识别流程
1. **文档上传**: 用户在案件管理或债权申报页面上传PDF文档
2. **智能识别**: 系统自动识别文档类型并提取关键信息
3. **结果确认**: 向用户展示识别结果，支持手动修正和确认
4. **数据填充**: 将确认后的信息自动填充到相应的业务表单中
5. **关联建立**: 自动建立企业、案件、债权之间的关联关系

### 识别准确性保障
- **置信度评估**: 每个识别结果都包含置信度评分
- **人工审核**: 低置信度结果自动标记为需要人工审核
- **反馈学习**: 用户修正结果用于持续优化识别模型
- **统计监控**: 提供识别准确率统计和错误分析报告

## 破产企业主体管理

系统提供完整的破产企业主体管理功能，支持企业信息的结构化存储和关系管理：

### 企业主体信息
- **基本信息**: 企业名称、统一社会信用代码、法定代表人、注册地址等
- **业务信息**: 注册资本、成立日期、经营范围、企业类型等
- **识别信息**: 来源文档、识别置信度、验证状态等

### 关联关系管理
- **案件关联**: 企业与破产案件的关联关系，支持主要债务人、关联企业、担保人等类型
- **债权关联**: 债权与破产企业的关联关系，记录债务类型、合同日期等信息
- **关系查询**: 支持从企业查看相关案件和债权，从案件查看相关企业

### 冲突检测和处理
- **重复检测**: 自动检测重复的企业主体，避免数据冗余
- **案件合并**: 当企业已有在流程中的案件时，提供案件合并选项
- **身份验证**: 债权合同上传时验证合同双方身份的匹配性