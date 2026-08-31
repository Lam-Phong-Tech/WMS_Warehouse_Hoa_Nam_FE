import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Box, UiStatusBadge } from "@/shared/ui";
import type { UiStatusTone } from "@/shared/ui";
import { ResponsiveDataTable } from "@/shared/components/data-display/ResponsiveDataTable";
import type { ResponsiveTableColumn } from "@/shared/components/data-display/ResponsiveDataTable";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import { ActionButton } from "@/shared/components/actions";
import { mvpRowNumber } from "@/shared/components/mvp/MvpSelectionCell";
import { ROUTES } from "@/shared/constants/routes";
import { EMPTY_TEXT } from "@/shared/constants/display";
import {
  fetchPendingEvidence,
  type DocumentAttachmentType,
  type PendingEvidenceItem,
} from "@/shared/api/documentAttachmentService";
import { fmtDateTime } from "./report-format";
import { ReportKpi, ReportKpiRow, ReportSectionHeading } from "./report-ui";
import { RPT_CARD_SX } from "./report-tokens";
import { ReportPaginationBar } from "./report-table";
import { useClientPagination } from "./report-columns";

/**
 * Yêu cầu vận hành mục 8 ("Chứng từ nhập/xuất/hoàn trả"): phiếu được phép tạo
 * trước rồi bổ sung chứng từ sau, nên cần một DANH SÁCH những phiếu đang thiếu
 * chứng từ để đối soát — trước đây trạng thái này chỉ xem được khi mở đúng từng
 * phiếu (DocumentAttachmentsPanel). Tab này đọc GET /document-attachments/
 * pending-evidence (đã có sẵn ở documentAttachmentService) và trỏ thẳng về đúng
 * màn chi tiết phiếu nhập / xuất / điều chỉnh để bổ sung.
 *
 * Deep-link `?screen=` dùng cùng hợp đồng URL với thông báo
 * (resolve-notification-link.ts): IN-03 / OUT-02 / REV-02.
 */
const DOC_META: Record<
  DocumentAttachmentType,
  { label: string; tone: UiStatusTone; link: (id: string) => string }
> = {
  INBOUND: {
    label: "Phiếu nhập",
    tone: "info",
    link: (id) => `${ROUTES.INBOUND}?screen=IN-03&id=${id}`,
  },
  OUTBOUND: {
    label: "Phiếu xuất",
    tone: "primary",
    link: (id) => `${ROUTES.OUTBOUND}?screen=OUT-02&id=${id}`,
  },
  REVERSAL: {
    label: "Phiếu điều chỉnh tồn",
    tone: "warning",
    link: (id) => `${ROUTES.REVERSE}?screen=REV-02&id=${id}`,
  },
};

export default function TabPendingEvidence() {
  const navigate = useNavigate();
  const query = useQuery({
    queryKey: ["reports", "pending-evidence"],
    queryFn: fetchPendingEvidence,
  });

  const rows = useMemo(() => query.data ?? [], [query.data]);
  const pagination = useClientPagination(rows, 15);

  const counts = useMemo(
    () => ({
      total: rows.length,
      inbound: rows.filter((row) => row.document_type === "INBOUND").length,
      outbound: rows.filter((row) => row.document_type === "OUTBOUND").length,
      reversal: rows.filter((row) => row.document_type === "REVERSAL").length,
    }),
    [rows],
  );

  const columns: ResponsiveTableColumn<PendingEvidenceItem>[] = [
    {
      key: "stt",
      header: "STT",
      align: "center",
      width: 56,
      hideOnMobile: true,
      render: (row) =>
        mvpRowNumber(
          pagination.page,
          pagination.perPage,
          pagination.pageRows.indexOf(row),
        ),
    },
    {
      key: "type",
      header: "Loại phiếu",
      width: 160,
      sortAccessor: (row) => DOC_META[row.document_type]?.label ?? "",
      render: (row) => (
        <UiStatusBadge
          size="small"
          tone={DOC_META[row.document_type]?.tone ?? "neutral"}
          label={DOC_META[row.document_type]?.label ?? row.document_type}
        />
      ),
    },
    {
      key: "docNo",
      header: "Số phiếu",
      width: 180,
      sortAccessor: (row) => row.document_no,
      render: (row) => (
        <Box sx={{ fontWeight: 700 }}>{row.document_no || EMPTY_TEXT}</Box>
      ),
    },
    {
      key: "reason",
      header: "Lý do thiếu chứng từ",
      sortAccessor: (row) => row.missing_reason,
      render: (row) => row.missing_reason || EMPTY_TEXT,
    },
    {
      key: "createdAt",
      header: "Ngày tạo phiếu",
      width: 170,
      hideOnMobile: true,
      sortAccessor: (row) => row.created_at,
      render: (row) => (row.created_at ? fmtDateTime(row.created_at) : EMPTY_TEXT),
    },
    {
      key: "action",
      header: "Thao tác",
      align: "center",
      width: 130,
      render: (row) => {
        const meta = DOC_META[row.document_type];
        return meta && row.document_id ? (
          <ActionButton
            kind="view"
            onClick={() => navigate(meta.link(row.document_id))}
          >
            Mở phiếu
          </ActionButton>
        ) : (
          EMPTY_TEXT
        );
      },
    },
  ];

  return (
    <Box data-testid="rpt-tab-pending-evidence">
      <ReportSectionHeading
        id="rpt-pending-evidence-heading"
        title="Danh sách chứng từ cần bổ sung"
        description="Phiếu nhập / xuất / điều chỉnh tồn đã tạo nhưng còn thiếu chứng từ đính kèm để đối soát. Bấm 'Mở phiếu' để bổ sung chứng từ cho đúng phiếu."
      />

      <ReportKpiRow>
        <ReportKpi
          label="Tổng phiếu thiếu chứng từ"
          value={String(counts.total)}
          tone="warning"
        />
        <ReportKpi
          label="Phiếu nhập"
          value={String(counts.inbound)}
          tone="info"
        />
        <ReportKpi
          label="Phiếu xuất"
          value={String(counts.outbound)}
          tone="primary"
        />
        <ReportKpi
          label="Phiếu điều chỉnh tồn"
          value={String(counts.reversal)}
          tone="neutral"
        />
      </ReportKpiRow>

      {query.isError ? (
        <Box sx={{ mb: 2, mt: 2 }}>
          <ApiErrorAlert
            error={query.error}
            title="Không tải được danh sách chứng từ cần bổ sung"
            onRetry={() => void query.refetch()}
          />
        </Box>
      ) : null}

      <Box sx={{ ...RPT_CARD_SX, mt: 2 }}>
        <ResponsiveDataTable<PendingEvidenceItem>
          columns={columns}
          rows={pagination.pageRows}
          rowKey={(row) => `${row.document_type}-${row.document_id}`}
          loading={query.isLoading}
          emptyText={
            query.isError
              ? EMPTY_TEXT
              : "Không có phiếu nào đang thiếu chứng từ. Mọi phiếu nhập/xuất/điều chỉnh đều đã đủ chứng từ."
          }
        />
        {rows.length > 0 ? (
          <ReportPaginationBar
            page={pagination.page}
            perPage={pagination.perPage}
            total={pagination.total}
            onPageChange={pagination.setPage}
            onPageSizeChange={pagination.setPerPage}
          />
        ) : null}
      </Box>
    </Box>
  );
}
