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