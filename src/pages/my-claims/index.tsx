import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useSnackbar } from "@/src/contexts/SnackbarContext";
import {
  useSurrealClient,
  AuthenticationRequiredError,
} from "@/src/contexts/SurrealProvider";
import { useAuth } from "@/src/contexts/AuthContext";
import { useOperationPermission } from "@/src/hooks/usePermission";
import { queryWithAuth } from "@/src/utils/surrealAuth";
import PageContainer from "@/src/components/PageContainer";
import type { RecordId } from "surrealdb";
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Tooltip,
  LinearProgress,
} from "@mui/material";
import SvgIcon from "@mui/material/SvgIcon";
import { mdiEye, mdiUndo, mdiPencil, mdiPlus } from "@mdi/js";

// Import mobile components
import MobileOptimizedLayout from "@/src/components/mobile/MobileOptimizedLayout";
import MyClaimsMobileCard from "@/src/components/mobile/MyClaimsMobileCard";
import ResponsiveTable from "@/src/components/common/ResponsiveTable";
import { useResponsiveLayout } from "@/src/hooks/useResponsiveLayout";

// 数据库原始数据接口
interface RawClaimData {
  id: RecordId | string;
  claim_number: string;
  case_id: RecordId | string;
  creditor_id: RecordId | string;
  status: string;
  submission_time?: string;
  review_status_id?: RecordId | string;
  review_time?: string;
  reviewer_id?: RecordId | string;
  review_comments?: string;
  created_at: string;
  updated_at: string;
  created_by: RecordId | string;
  asserted_claim_details: {
    nature: string;
    principal: number;
    interest: number;
    other_amount?: number;
    total_asserted_amount: number;
    currency: string;
    brief_description?: string;
    attachment_doc_id?: RecordId | string;
  };
  approved_claim_details?: {
    nature: string;
    principal: number;
    interest: number;
    other_amount?: number;
    total_approved_amount: number;
    currency: string;
    approved_attachment_doc_id?: RecordId | string;
  };
}

// 审核状态定义接口
interface ReviewStatusDefinition {
  id: RecordId | string;
  name: string;
  description?: string;
  display_order: number;
  is_active: boolean;
}

// 前端展示用的债权接口
interface Claim {
  id: string;
  claimNumber: string;
  submissionDate: string;
  claimNature: string;
  totalAmount: number;
  currency: string;
  reviewStatus:
    | "待审核"
    | "审核通过"
    | "已驳回"
    | "审核不通过"
    | "需要补充"
    | "部分通过";
  reviewOpinion?: string;
  canWithdraw: boolean;
  canEdit: boolean;
  approvedAmount?: number;
}

// 将数据库原始数据转换为前端展示格式
const transformClaimData = (
  rawClaim: RawClaimData,
  reviewStatus?: ReviewStatusDefinition,
): Claim => {
  const statusName = reviewStatus?.name || rawClaim.status;
  const mappedStatus = mapReviewStatus(statusName);

  return {
    id: String(rawClaim.id),
    claimNumber: rawClaim.claim_number,
    submissionDate: rawClaim.submission_time
      ? new Date(rawClaim.submission_time).toLocaleDateString("zh-CN")
      : new Date(rawClaim.created_at).toLocaleDateString("zh-CN"),
    claimNature: rawClaim.asserted_claim_details.nature,
    totalAmount: rawClaim.asserted_claim_details.total_asserted_amount,
    currency: rawClaim.asserted_claim_details.currency,
    reviewStatus: mappedStatus,
    reviewOpinion: rawClaim.review_comments,
    canWithdraw: mappedStatus === "待审核",
    canEdit: ["已驳回", "需要补充"].includes(mappedStatus),
    approvedAmount: rawClaim.approved_claim_details?.total_approved_amount,
  };
};

// 映射数据库状态到前端状态
const mapReviewStatus = (dbStatus: string): Claim["reviewStatus"] => {
  const statusMap: Record<string, Claim["reviewStatus"]> = {
    草稿: "待审核",
    待提交: "待审核",
    已提交: "待审核",
    待审核: "待审核",
    审核中: "待审核",
    审核通过: "审核通过",
    已驳回: "已驳回",
    需要补充: "需要补充",
    部分通过: "部分通过",
  };
  return statusMap[dbStatus] || "待审核";
};

const MyClaimsPage: React.FC = () => {
  const navigate = useNavigate();
  const { showSuccess, showError, showWarning } = useSnackbar();
  const client = useSurrealClient();
  const { user, selectedCaseId } = useAuth();
  const { hasPermission: canSubmitClaim } =
    useOperationPermission("claim_submit");
  const { hasPermission: canEditClaim } =
    useOperationPermission("claim_edit_draft");
  const { isMobile } = useResponsiveLayout();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [claims, setClaims] = useState<Claim[]>([]);

  // 获取我的债权数据
  const fetchMyClaims = useCallback(async () => {
    if (!client || !user) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // 查询当前用户的债权
      let whereClause = "created_by = $auth.id";
      const queryParams: Record<string, any> = {};

      // 如果有选中的案件，只显示该案件的债权
      if (selectedCaseId) {
        whereClause += " AND case_id = $caseId";
        queryParams.caseId = selectedCaseId;
      }

      const dataQuery = `
        SELECT
          id,
          claim_number,
          case_id,
          creditor_id,
          status,
          submission_time,
          review_status_id,
          review_time,
          reviewer_id,
          review_comments,
          created_at,
          updated_at,
          created_by,
          asserted_claim_details,
          approved_claim_details
        FROM claim
        WHERE ${whereClause}
        ORDER BY created_at DESC
      `;

      const results = await queryWithAuth<any[]>(
        client,
        dataQuery,
        queryParams,
      );
      const rawClaims: RawClaimData[] = results[0] || [];

      // 获取审核状态定义
      const reviewStatusIds = [
        ...new Set(
          rawClaims.map((claim) => claim.review_status_id).filter(Boolean),
        ),
      ];
      let reviewStatuses: ReviewStatusDefinition[] = [];

      if (reviewStatusIds.length > 0) {
        const statusQuery = `
          SELECT id, name, description, display_order, is_active
          FROM claim_review_status_definition
          WHERE id IN $statusIds
        `;
        const statusResults = await queryWithAuth<any[]>(client, statusQuery, {
          statusIds: reviewStatusIds,
        });
        reviewStatuses = statusResults[0] || [];
      }

      // 转换数据格式
      const transformedClaims = rawClaims.map((rawClaim) => {
        const reviewStatus = reviewStatuses.find(
          (rs) => String(rs.id) === String(rawClaim.review_status_id),
        );
        return transformClaimData(rawClaim, reviewStatus);
      });

      setClaims(transformedClaims);
    } catch (err) {
      console.error("Error fetching my claims:", err);
      if (err instanceof AuthenticationRequiredError) {
        navigate("/login");
        showError(err.message);
      } else {
        const errorMessage =
          err instanceof Error ? err.message : "加载债权列表失败";
        setError(errorMessage);
        showError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  }, [client, user, selectedCaseId, navigate, showError]);

  // 初始化加载数据
  useEffect(() => {
    fetchMyClaims();
  }, [fetchMyClaims]);

  const formatCurrencyDisplay = (amount: number, currency: string) => {
    return amount.toLocaleString("zh-CN", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const getStatusChipProps = (status: Claim["reviewStatus"]) => {
    switch (status) {
      case "待审核":
        return { color: "warning" as const, variant: "outlined" as const };
      case "审核通过":
        return { color: "success" as const, variant: "outlined" as const };
      case "已驳回":
      case "审核不通过":
        return { color: "error" as const, variant: "outlined" as const };
      case "需要补充":
        return { color: "info" as const, variant: "outlined" as const };
      case "部分通过":
        return { color: "warning" as const, variant: "filled" as const };
      default:
        return { color: "default" as const, variant: "outlined" as const };
    }
  };

  const handleWithdraw = async (claimId: string, claim: Claim) => {
    if (!claim.canWithdraw) {
      showWarning('只有"待审核"状态的债权才能撤回。');
      return;
    }

    if (!client) {
      showError("缺少必要的连接信息");
      return;
    }

    try {
      // 获取草稿状态ID
      const statusQuery = `
        SELECT id FROM claim_review_status_definition
        WHERE name = '待提交' AND is_active = true
        LIMIT 1
      `;

      const statusResults = await queryWithAuth<any[]>(client, statusQuery, {});
      const draftStatus = statusResults[0]?.[0];

      if (!draftStatus) {
        showError("未找到草稿状态定义");
        return;
      }

      const updateQuery = `
        UPDATE $claimId SET
          status = '草稿',
          review_status_id = $reviewStatusId,
          updated_at = time::now()
      `;

      await queryWithAuth(client, updateQuery, {
        claimId,
        reviewStatusId: draftStatus.id,
      });

      showSuccess(`债权 ${claim.claimNumber} 已成功撤回。`);

      // 刷新数据
      await fetchMyClaims();
    } catch (err) {
      console.error("Failed to withdraw claim:", err);
      if (err instanceof AuthenticationRequiredError) {
        navigate("/login");
        showError(err.message);
      } else {
        showError("撤回失败，请稍后重试。");
      }
    }
  };

  // Prepare table columns for ResponsiveTable
  const tableColumns = [
    { id: "claimNumber", label: "债权编号", priority: "high" as const },
    { id: "submissionDate", label: "申报时间", priority: "medium" as const },
    { id: "claimNature", label: "债权性质", priority: "low" as const },
    { id: "totalAmount", label: "主张债权总额", priority: "high" as const },
    {
      id: "approvedAmount",
      label: "认定债权总额",
      priority: "medium" as const,
    },
    { id: "reviewStatus", label: "审核状态", priority: "high" as const },
    { id: "reviewOpinion", label: "审核意见", priority: "low" as const },
    { id: "actions", label: "操作", priority: "high" as const },
  ];

  // Transform claims data for ResponsiveTable
  const tableData = claims.map((claim) => ({
    id: claim.id,
    claimNumber: claim.claimNumber,
    submissionDate: claim.submissionDate,
    claimNature: claim.claimNature,
    totalAmount: formatCurrencyDisplay(claim.totalAmount, claim.currency),
    approvedAmount:
      claim.approvedAmount !== undefined
        ? formatCurrencyDisplay(claim.approvedAmount, claim.currency)
        : "-",
    reviewStatus: (
      <Chip
        label={claim.reviewStatus}
        size="small"
        {...getStatusChipProps(claim.reviewStatus)}
      />
    ),
    reviewOpinion: (
      <Tooltip title={claim.reviewOpinion || "-"}>
        <Typography
          variant="body2"
          sx={{
            maxWidth: 200,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {claim.reviewOpinion || "-"}
        </Typography>
      </Tooltip>
    ),
    actions: (
      <Box sx={{ display: "flex", gap: 1, justifyContent: "center" }}>
        <Tooltip title="查看详情">
          <IconButton
            size="small"
            color="primary"
            data-testid="view-details-button"
            onClick={() => navigate(`/my-claims/${claim.id}`)}
          >
            <SvgIcon fontSize="small">
              <path d={mdiEye} />
            </SvgIcon>
          </IconButton>
        </Tooltip>

        {claim.canWithdraw && (
          <Tooltip title="撤回">
            <IconButton
              size="small"
              color="warning"
              data-testid="withdraw-button"
              onClick={() => handleWithdraw(claim.id, claim)}
            >
              <SvgIcon fontSize="small">
                <path d={mdiUndo} />
              </SvgIcon>
            </IconButton>
          </Tooltip>
        )}

        {claim.canEdit && canEditClaim && (
          <Tooltip title="编辑">
            <IconButton
              size="small"
              color="success"
              data-testid="edit-button"
              onClick={() => navigate(`/claims/submit/${claim.id}`)}
            >
              <SvgIcon fontSize="small">
                <path d={mdiPencil} />
              </SvgIcon>
            </IconButton>
          </Tooltip>
        )}
      </Box>
    ),
    _original: claim, // Keep original claim data for mobile cards
  }));

  // Mobile rendering
  if (isMobile) {
    return (
      <MobileOptimizedLayout
        title="我的债权申报"
        showBackButton={false}
        fabConfig={
          canSubmitClaim
            ? {
                icon: mdiPlus,
                action: () => navigate("/claims/submit"),
                ariaLabel: "发起新的债权申报",
              }
            : undefined
        }
      >
        <Box sx={{ p: 2 }}>
          {isLoading && (
            <Box sx={{ textAlign: "center", py: 3 }}>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
                正在加载债权列表...
              </Typography>
              <LinearProgress />
            </Box>
          )}

          {error && (
            <Paper
              sx={{
                p: 2,
                mb: 2,
                bgcolor: "error.light",
                color: "error.contrastText",
              }}
            >
              <Typography variant="body2">{error}</Typography>
            </Paper>
          )}

          {!isLoading && !error && (
            <>
              {claims.length === 0 ? (
                <Box sx={{ textAlign: "center", py: 6 }}>
                  <Typography variant="body1" color="text.secondary">
                    暂无债权申报记录
                  </Typography>
                  {canSubmitClaim && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mt: 1 }}
                    >
                      点击右下角按钮发起新的债权申报
                    </Typography>
                  )}
                </Box>
              ) : (
                <Box>
                  {claims.map((claim) => (
                    <MyClaimsMobileCard
                      key={claim.id}
                      claim={claim}
                      onViewDetails={(claimId) =>
                        navigate(`/my-claims/${claimId}`)
                      }
                      onWithdraw={handleWithdraw}
                      onEdit={(claimId) =>
                        navigate(`/claims/submit/${claimId}`)
                      }
                      formatCurrencyDisplay={formatCurrencyDisplay}
                      canEditClaim={canEditClaim}
                    />
                  ))}
                </Box>
              )}
            </>
          )}
        </Box>
      </MobileOptimizedLayout>
    );
  }

  // Desktop rendering
  return (
    <PageContainer>
      <Box sx={{ p: 3 }}>
        <Box
          sx={{
            mb: 3,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Typography variant="h4" component="h1">
            我的债权申报
          </Typography>
          {canSubmitClaim && (
            <Button
              variant="contained"
              color="primary"
              onClick={() => navigate("/claims/submit")}
              startIcon={
                <SvgIcon>
                  <path d={mdiPlus} />
                </SvgIcon>
              }
            >
              发起新的债权申报
            </Button>
          )}
        </Box>

        {isLoading && (
          <Box sx={{ textAlign: "center", py: 3 }}>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
              正在加载债权列表...
            </Typography>
            <LinearProgress />
          </Box>
        )}

        {error && (
          <Paper
            sx={{
              p: 2,
              mb: 2,
              bgcolor: "error.light",
              color: "error.contrastText",
            }}
          >
            <Typography variant="body2">{error}</Typography>
          </Paper>
        )}

        {!isLoading && !error && (
          <ResponsiveTable
            columns={tableColumns}
            data={tableData}
            loading={isLoading}
            emptyMessage="暂无债权申报记录"
            stickyHeader={true}
          />
        )}
      </Box>
    </PageContainer>
  );
};

export default MyClaimsPage;
