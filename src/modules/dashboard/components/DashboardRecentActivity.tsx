import { useQuery } from "@tanstack/react-query";
import {
  Box,
  Stack,
  UiStatusBadge,
  type UiStatusTone,
  SEMANTIC_LIGHT as S,
  RADIUS,
  TYPOGRAPHY,
} from "@/shared/ui";
import { useCan } from "@/shared/components/permission";
import { http } from "@/shared/api/http";
import { API_ENDPOINTS } from "@/shared/api/endpoints";
import { ImportOutlined, ExportOutlined } from "@/shared/components/icons";
import { formatDate } from "@/shared/utils/format-date";

type DocumentHistoryRow = {
  document_no: unknown;
  doc_type: unknown;
  counterpart: unknown;
  document_date: unknown;
  status: unknown;
};

type DocumentHistoryResponse = {
  rows?: DocumentHistoryRow[];
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Nháp",
  SCANNING: "Đang quét",
  POSTED: "Đã ghi nhận",
  CANCELLED: "Đã hủy",
};

// Map màu antd/MUI cũ (default/warning/success/error) → tone UiStatusBadge.
const STATUS_TONES: Record<string, UiStatusTone> = {
  DRAFT: "neutral",
  SCANNING: "warning",
  POSTED: "success",
  CANCELLED: "error",
};

const RECENT_ACTIVITY_LIMIT = 6;

/** Cắt 1 dòng với ellipsis (thay prop noWrap của Typography). */
const NOWRAP_SX = {
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
} as const;

/**
 * "Hoạt động gần đây" chỉ gồm phiếu Nhập/Xuất (report_document_history),
 * KHÔNG gồm sự kiện bảo hành — đó là API/luồng riêng, gộp 2 nguồn để sắp xếp
 * chung theo thời gian là việc phức tạp hơn, không làm ở bước này.
 *
 * Thứ tự "mới nhất trước" dựa trên hành vi mặc định hiện tại của
 * GET /reports/document-history khi gọi page=1 không kèm sort — đã kiểm
 * chứng qua network request thực tế (không có tham số sort tường minh trong
 * OpenAPI). Nếu BE đổi thứ tự mặc định sau này, phần này cần xem lại.
 */
export function DashboardRecentActivity() {
  const canView = useCan("report.view");

  const query = useQuery({
    queryKey: ["dashboard", "recent-activity"],
    queryFn: () =>
      http.get<DocumentHistoryResponse>(
        API_ENDPOINTS.REPORTS_DOCUMENT_HISTORY,
        {
          params: { page: 1, per_page: RECENT_ACTIVITY_LIMIT, doc_type: "all" },
        },
      ),
    enabled: canView,
    staleTime: 30_000,
  });

  if (!canView) return null;

  const rows = (query.data?.rows ?? []).slice(0, RECENT_ACTIVITY_LIMIT);

  return (
    <Box
      sx={{
        p: 2,
        bgcolor: S.bgSurface,
        border: `1px solid ${S.border}`,
        borderRadius: `${RADIUS.card}px`,
      }}
    >
      <Box
        component="h3"
        sx={{
          m: 0,
          fontSize: TYPOGRAPHY.fontSizeBody,
          fontWeight: 700,
          color: S.textHigh,
        }}
      >
        Hoạt động gần đây
      </Box>
      <Box sx={{ fontSize: 12, color: S.textMedium }}>
        Phiếu nhập/xuất mới nhất (chưa gồm bảo hành)
      </Box>
      {rows.length === 0 ? (
        <Box
          sx={{
            mt: 1.5,
            fontSize: TYPOGRAPHY.fontSizeSecondary,
            color: S.textMedium,
          }}
        >
          {query.isLoading ? "Đang tải…" : "Chưa có hoạt động nào."}
        </Box>
      ) : (
        <Stack sx={{ mt: 1 }}>
          {rows.map((row, index) => {
            const status = String(row.status ?? "");
            const docType = String(row.doc_type ?? "");
            return (
              <Stack
                key={`${String(row.document_no ?? index)}-${index}`}
                direction="row"
                spacing={1.5}
                sx={{
                  alignItems: "center",
                  py: 1,
                  borderBottom: `1px solid ${S.border}`,
                  "&:last-child": { borderBottom: 0 },
                }}
              >
                <Box
                  sx={{
                    width: 34,
                    height: 34,
                    flex: "none",
                    borderRadius: `${RADIUS.card}px`,
                    display: "grid",
                    placeItems: "center",
                    color: docType === "INBOUND" ? S.success : S.primary,
                    bgcolor:
                      docType === "INBOUND" ? S.successSoft : S.primarySoft,
                  }}
                  aria-hidden="true"
                >
                  {docType === "INBOUND" ? (
                    <ImportOutlined />
                  ) : (
                    <ExportOutlined />
                  )}
                </Box>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Box
                    sx={{
                      ...NOWRAP_SX,
                      fontSize: TYPOGRAPHY.fontSizeSecondary,
                      fontWeight: 700,
                      color: S.textHigh,
                    }}
                  >
                    {String(row.document_no ?? "")}
                  </Box>
                  <Box sx={{ ...NOWRAP_SX, fontSize: 12, color: S.textMedium }}>
                    {formatDate(String(row.document_date ?? ""))}
                    {row.counterpart ? ` · ${String(row.counterpart)}` : ""}
                  </Box>
                </Box>
                <UiStatusBadge
                  tone={STATUS_TONES[status] ?? "neutral"}
                  label={STATUS_LABELS[status] ?? status}
                />
              </Stack>
            );
          })}
        </Stack>
      )}
    </Box>
  );
}
