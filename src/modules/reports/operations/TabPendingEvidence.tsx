import type { MessageKey } from "@/shared/i18n/messages";
import { useT } from "@/shared/i18n/useT";
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
  { labelKey: MessageKey; tone: UiStatusTone; link: (id: string) => string }
> = {
  INBOUND: {
    labelKey: "reports.pendingEvidence.inbound",
    tone: "info",
    link: (id) => `${ROUTES.INBOUND}?screen=IN-03&id=${id}`,
  },
  OUTBOUND: {
    labelKey: "reports.pendingEvidence.outbound",
    tone: "primary",
    link: (id) => `${ROUTES.OUTBOUND}?screen=OUT-02&id=${id}`,
  },
  REVERSAL: {
    labelKey: "reports.pendingEvidence.reversal",
    tone: "warning",
    link: (id) => `${ROUTES.REVERSE}?screen=REV-02&id=${id}`,
  },
};

export default function TabPendingEvidence() {
  const t = useT();
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
      header: t("reports.pendingEvidence.colDocType"),
      width: 160,
      sortAccessor: (row) =>
        DOC_META[row.document_type]
          ? t(DOC_META[row.document_type].labelKey)
          : "",
      render: (row) => (
        <UiStatusBadge
          size="small"
          tone={DOC_META[row.document_type]?.tone ?? "neutral"}
          label={
            DOC_META[row.document_type]
              ? t(DOC_META[row.document_type].labelKey)
              : row.document_type
          }
        />
      ),
    },
    {
      key: "docNo",
      header: t("reports.pendingEvidence.colDocNo"),
      width: 180,
      sortAccessor: (row) => row.document_no,
      render: (row) => (
        <Box sx={{ fontWeight: 700 }}>{row.document_no || EMPTY_TEXT}</Box>
      ),
    },
    {
      key: "reason",
      header: t("reports.pendingEvidence.colReason"),
      sortAccessor: (row) => row.missing_reason,
      render: (row) => row.missing_reason || EMPTY_TEXT,
    },
    {
      key: "createdAt",
      header: t("reports.pendingEvidence.colCreatedAt"),
      width: 170,
      hideOnMobile: true,
      sortAccessor: (row) => row.created_at,
      render: (row) =>
        row.created_at ? fmtDateTime(row.created_at) : EMPTY_TEXT,
    },
    {
      key: "action",
      header: t("reports.pendingEvidence.colAction"),
      align: "center",
      width: 130,
      render: (row) => {
        const meta = DOC_META[row.document_type];
        return meta && row.document_id ? (
          <ActionButton
            kind="view"
            onClick={() => navigate(meta.link(row.document_id))}
          >
            {t("reports.pendingEvidence.openDocument")}
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
        title={t("reports.pendingEvidence.title")}
        description={t("reports.pendingEvidence.description")}
      />

      <ReportKpiRow>
        <ReportKpi
          label={t("reports.pendingEvidence.kpiTotal")}
          value={String(counts.total)}
          tone="warning"
        />
        <ReportKpi
          label={t("reports.pendingEvidence.inbound")}
          value={String(counts.inbound)}
          tone="info"
        />
        <ReportKpi
          label={t("reports.pendingEvidence.outbound")}
          value={String(counts.outbound)}
          tone="primary"
        />
        <ReportKpi
          label={t("reports.pendingEvidence.reversal")}
          value={String(counts.reversal)}
          tone="neutral"
        />
      </ReportKpiRow>

      {query.isError ? (
        <Box sx={{ mb: 2, mt: 2 }}>
          <ApiErrorAlert
            error={query.error}
            title={t("reports.pendingEvidence.loadError")}
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
            query.isError ? EMPTY_TEXT : t("reports.pendingEvidence.empty")
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
