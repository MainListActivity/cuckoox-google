# 失败的测试文件列表

以下是从测试输出中提取的所有包含失败用例的测试文件：

## 组件测试 (Components)
-  [x] AudioCallInterface.test.tsx
-  [x] BatchImportCreditorsDialog.test.tsx

-  [x] ClaimAuditLog.test.tsx
-  [x] ClaimOperationHistory.test.tsx

-  [x] ClaimStatusFlowChart.test.tsx
- ClaimVersionComparison.test.tsx
-  [x] CreditorMobileCard.test.tsx
-  [x] MeetingMinutesDialog.test.tsx
- MobilePWAManager.test.tsx
- ModifyCaseStatusDialog.test.tsx
- MyClaimsMobileCard.test.tsx
- PrintWaybillsDialog.test.tsx
- RichTextEditor.test.tsx
- Turnstile.test.tsx

## 页面测试 (Pages)
- [claimId].test.tsx
- attachment.test.tsx
- create-claim-attachments.test.tsx
- create.test.tsx
- creditors.test.tsx
- index.test.tsx
- login.test.tsx
- messages.test.tsx
- review.test.tsx
- select-case.test.tsx
- submit.test.tsx

## 上下文测试 (Contexts)
- AdminMenuTest.test.tsx
- AuthContext.test.tsx

## Hook测试 (Hooks)
- useCaseParticipants.test.ts
- useLiveDashboardData.test.ts
- useLiveMeetingData.test.ts
- useMessageCenterData.test.ts
- usePermission.test.ts

## 服务测试 (Services)
- callManager.test.ts
- caseMemberService.test.ts
- claimAuditService.test.ts
- claimOperationService.test.ts
- claimStatusFlowService.test.ts
- claimVersionService.test.ts
- groupManager.test.ts
- mediaFileHandler.test.ts
- menuService-fixed.test.ts
- messageService.test.ts
- networkAdaptation.test.ts
- roleService.test.ts
- rtcConfigManager.test.ts
- rtcConfigService.test.ts
- signalingService.test.ts
- webrtc-core.test.ts
- webrtcErrorHandler.test.ts
- webrtcManager-fixed.test.ts

## Worker测试 (Workers)
- cache-logger.test.ts
- data-cache-manager-auth-variables.test.ts
- data-cache-manager-autosync.test.ts
- enhanced-query-handler.test.ts
- offline-manager.test.ts
- page-aware-subscription-manager.test.ts
- performance-monitor.test.ts
- simple-test.test.ts
- sw-surreal-token-refresh.test.ts
- tenant-database-manager.test.ts
- token-manager.test.ts

## 工具测试 (Utils)
- tenantHistory.test.ts
- touchTargetUtils.test.ts

## 测试统计
- 总测试套件数: 396
- 通过的测试套件: 99
- 失败的测试套件: 297
- 总测试用例数: 985
- 通过的测试用例: 323
- 失败的测试用例: 660
- 待处理的测试用例: 2

## 说明
此列表基于测试输出文件 `test-output.json` 生成，包含所有存在失败测试用例的文件。需要逐个检查和修复这些测试文件中的失败用例。