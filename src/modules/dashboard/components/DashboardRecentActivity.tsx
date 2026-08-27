import { useQuery } from "@tanstack/react-query";
import { Box, Card, Chip, Stack, Typography } from "@mui/material";
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

const STATUS_COLORS: Record<
  string,
  "default" | "success" | "warning" | "error"
> = {
  DRAFT: "default",
  SCANNING: "warning",
  POSTED: "success",
  CANCELLED: "error",
};

const RECENT_ACTIVITY_LIMIT = 6;

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
    <Card variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
        Hoạt động gần đây
      </Typography>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: "block" }}
      >
        Phiếu nhập/xuất mới nhất (chưa gồm bảo hành)
      </Typography>
      {rows.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          {query.isLoading ? "Đang tải…" : "Chưa có hoạt động nào."}
        </Typography>
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
                  borderBottom: "1px solid",
                  borderColor: "divider",
                  "&:last-child": { borderBottom: 0 },
                }}
              >
                <Box
                  sx={{
                    width: 34,
                    height: 34,
                    flex: "none",
                    borderRadius: 2,
                    display: "grid",
                    placeItems: "center",
                    color:
                      docType === "INBOUND" ? "success.main" : "primary.main",
                    bgcolor:
                      docType === "INBOUND" ? "success.light" : "primary.light",
                    opacity: 0.9,
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
                  <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
                    {String(row.document_no ?? "")}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {formatDate(String(row.document_date ?? ""))}
                    {row.counterpart ? ` · ${String(row.counterpart)}` : ""}
                  </Typography>
                </Box>
                <Chip
                  label={STATUS_LABELS[status] ?? status}
                  size="small"
                  color={STATUS_COLORS[status] ?? "default"}
                />
              </Stack>
            );
          })}
        </Stack>
      )}
    </Card>
  );
}
