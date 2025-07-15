# CuckooX Google - 破产案件全生命周期管理平台

这是一个专为破产案件管理人设计的综合性案件管理和分析平台，基于React 19 + TypeScript + SurrealDB构建，支持破产案件从立案到结案的全生命周期管理。

> **重要说明**: 本系统的所有AI助手交互均使用简体中文进行响应，以确保更好的本地化体验。

## 系统概述

破产案件全生命周期管理平台提供以下核心功能：

- **案件管理**: 完整的破产案件生命周期管理，支持状态流转和关键时间节点管理
- **债权人管理**: 债权人信息录入、批量导入和快递单打印功能
- **债权申报**: 在线债权申报系统，支持富文本编辑和附件上传
- **债权审核**: 专业的债权审核工具，支持批注和批量操作
- **实时数据大屏**: 基于SurrealDB Live Query的实时数据监控和可视化
- **会议管理**: 债权人会议安排和会议纪要管理
- **消息中心**: 系统通知和即时消息功能
- **权限管理**: 基于角色的细粒度权限控制系统

## 业务流程

系统支持完整的破产案件业务流程：

```
立案 → 公告 → 债权申报 → 债权人第一次会议 → 
├─ 破产清算
└─ 裁定重整 → 提交重整计划/延迟提交重整计划 → 债权人第二次会议 → 结案
```

## 用户角色

- **ADMIN**: 超级管理员
- **案件负责人**: 案件管理人，拥有完整的案件管理权限
- **协办律师**: 案件协办人员
- **债权审核员**: 专门负责债权审核的人员
- **债权人**: 债权申报用户

## 数据库访问模式

系统支持两种数据库访问方式，可通过环境变量`VITE_DB_ACCESS_MODE`配置：

### Service Worker 模式 (推荐)
- **配置**: `VITE_DB_ACCESS_MODE=service-worker`
- **特性**:
  - 支持离线操作
  - 后台数据同步
  - Token自动刷新
  - 跨标签页共享连接
  - 更好的用户体验

### 直接连接模式
- **配置**: `VITE_DB_ACCESS_MODE=direct`
- **特性**:
  - 直接连接SurrealDB
  - 调试更容易
  - 延迟更低
  - 不支持离线功能

## 环境变量配置

复制`.env.example`到`.env`并配置相应的环境变量：

```bash
# 数据库访问方式
VITE_DB_ACCESS_MODE=service-worker  # 或 direct

# SurrealDB配置
VITE_SURREALDB_WS_URL=wss://your-surrealdb-url/rpc
VITE_SURREALDB_NS=ck_go
VITE_SURREALDB_DB=test

# 其他配置...
```

## 使用说明

### 切换数据库访问模式

1. **修改环境变量**: 编辑`.env`文件中的`VITE_DB_ACCESS_MODE`
2. **重启应用**: 重新运行`bun run dev`
3. **验证切换**: 查看控制台日志确认使用的模式

### 开发和调试

- **Service Worker 模式**: 适合生产环境，支持离线功能
- **直接连接模式**: 适合开发调试，更简单直接

### 兼容性说明

- 现有代码无需修改，统一客户端自动处理不同模式
- 通过SurrealProvider的Context提供统一接口
- 向后兼容原有的`surreal`属性访问方式

## Run Locally

**Prerequisites:**  Node.js

```shell
ssh-keygen -t rsa -b 2048 -C "1025988443@qq.com" -f ~/.ssh/cuckoox

git config --global user.email "1025988443@qq.com"
git config --global user.name "MainActivity"
git config --global core.sshCommand "ssh -i ~/.ssh/cuckoox"
```

```json
{
    "server": "xxxxx",
    "server_port": 6001,
    "password": "xxxx",
    "local_port": 1080,
    "local_address": "192.168.1.116",
    "method": "aes-256-gcm",
    "timeout": 120,
    "mode": "tcp_and_udp",
    "fast_open": false,
    "locals": [
        {
            "protocol": "http",
            "local_address": "192.168.1.116",
            "local_port": 3128
        }
    ]
}
```

1. Install dependencies:
   `bun install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.dev) to your Gemini API key
3. Run the app:
   `bun run dev`

git config --global http.proxy socks5://127.0.0.1:7891

git config --global --unset http.proxy

## E2E Testing

This project uses [Playwright](https://playwright.dev/) for End-to-End (E2E) testing. Playwright allows for testing user interactions and application behavior in real browser environments.

### Setup

If you haven't already, or if you're setting up the project on a new machine, you may need to install the browser binaries required by Playwright:

```bash
bunx playwright install --with-deps
```
This command downloads the necessary browser executables (Chromium, Firefox, WebKit) and installs any required system dependencies.

### Running E2E Tests

To run the E2E tests, use the following bun script:

```bash
bun run test:e2e
```
(If using pbun, use `pbun test:e2e`)

This command will execute all test files located in the `e2e/` directory using the Playwright test runner.

### Test Reports

After the tests complete, an HTML report will be generated in the `playwright-report` directory. You can open the `index.html` file in this directory to view a detailed report of the test execution:

```bash
bunx playwright show-report
```
Alternatively, you can directly open `playwright-report/index.html` in your browser.

### Test Location

E2E test files are located in the `e2e/` directory at the root of the project. The example test file `e2e/auth.e2e.test.ts` demonstrates the basic structure of a Playwright test.
