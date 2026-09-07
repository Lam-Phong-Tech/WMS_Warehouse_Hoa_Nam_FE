/* eslint-disable react-hooks/set-state-in-effect */
import { rowIndexOfBy } from "@/shared/components/data-display/row-index";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  Box,
  Stack,
  UiPagination,
  UiSelect,
  UiStatusBadge,
  UiText,
  UiTextField,
  type UiStatusTone,
  FILTER_WIDTH,
  TOOLBAR_SEARCH_SX,
} from "@/shared/ui";
import {
  ResponsiveDataTable,
  type ResponsiveTableColumn,
} from "@/shared/components/data-display/ResponsiveDataTable";
import { ToolOutlined } from "@/shared/components/icons";
import { useQueryClient } from "@tanstack/react-query";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import { SkuLink } from "@/shared/components/data-display/SkuLink";
import {
  TableLoadingBanner,
  tableEmptyText,
} from "@/shared/components/feedback/BusinessState";
import { CameraScanModal } from "@/shared/components/forms/CameraScanModal";
import {
  MVP_PAGE_SIZE_OPTIONS,
  resolveApiPagination,
} from "@/shared/components/mvp/mvp-pagination";
import { mvpRowNumber } from "@/shared/components/mvp/MvpSelectionCell";
import { useHasPermission } from "@/shared/components/permission";
import { useMvpDefects } from "@/modules/master-data/hooks/use-mvp-master";
import {
  WARRANTY_BASELINE_STATUSES,
  WARRANTY_IDENTIFICATION_STATUS_SHORT_LABELS,
  WARRANTY_STATUS_COLORS,
  WARRANTY_STATUS_LABELS,
  formatWarrantyDateTime,
  warrantyPiiText,
} from "@/modules/warranty/constants";
import { businessLabel } from "@/shared/constants/business-labels";
import { EMPTY_TEXT } from "@/shared/constants/display";
import { useT } from "@/shared/i18n/useT";
import {
  useWarrantyCases,
  warrantyKeys,
} from "@/modules/warranty/hooks/use-warranty";
import { ComponentIssueModal } from "@/modules/warranty/components/ComponentIssueModal";
import { WarrantyDetailModal } from "@/modules/warranty/components/WarrantyDetailModal";
import { WarrantyIntakeModal } from "@/modules/warranty/components/WarrantyIntakeModal";
import type {
  WarrantyCase,
  WarrantyCaseStatus,
  WarrantyIdentificationType,
} from "@/modules/warranty/types";
import { ActionButton } from "@/shared/components/actions";

const SEARCH_DEBOUNCE_MS = 250;
const DETAIL_SCREENS = new Set(["WAR-03"]);

/** antd Tag color (WARRANTY_STATUS_COLORS) → tone soft-tint của UiStatusBadge. */
const TAG_TONE_MAP: Record<string, UiStatusTone> = {
  green: "success",
  success: "success",
  red: "error",
  error: "error",
  volcano: "error",
  orange: "warning",
  gold: "warning",
  warning: "warning",
  blue: "info",
  processing: "info",
  geekblue: "info",
  cyan: "info",
  purple: "primary",
};

const statusTone = (color?: string): UiStatusTone =>
  TAG_TONE_MAP[color ?? ""] ?? "neutral";

interface ComponentIssueTarget {
  caseId: string;
  caseCode?: string;
  caseActive: boolean;
  documentId?: string | null;
}

/**
 * WAR-01 · Danh sách bảo hành — màn hub của luồng 04 · Bảo hành & linh kiện.
 * Tiếp nhận (WAR-02), Chi tiết (WAR-03) và Xuất linh kiện (COMP-01) đều mở
 * modal ngay trên danh sách, không chuyển trang — đồng bộ pattern luồng 02/03.
 */
export default function WarrantyPage() {
  const t = useT();
  const can = useHasPermission();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const searchRef = useRef<HTMLInputElement>(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [status, setStatus] = useState<WarrantyCaseStatus | "">("");
  const [identification, setIdentification] = useState<
    WarrantyIdentificationType | ""
  >("");
  const [defectId, setDefectId] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [componentTarget, setComponentTarget] =
    useState<ComponentIssueTarget | null>(null);

  const canManage = can("warranty.manage");
  const canViewPii = can("warranty.pii.view");

  const listQuery = useWarrantyCases({
    search: search || undefined,
    status: status || undefined,
    identification_status: identification || undefined,
    defect_id: defectId || undefined,
    page,
    per_page: perPage,
  });
  const defectsQuery = useMvpDefects({ status: "ACTIVE", per_page: 100 });

  const rows = listQuery.data?.data ?? [];
  const pagination = resolveApiPagination(listQuery.data?.meta, {
    page,
    pageSize: perPage,
    rowCount: rows.length,
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  // Deep-link các màn wireframe: ?screen=WAR-02 mở tiếp nhận, ?screen=WAR-03&id=...
  // mở chi tiết, ?screen=COMP-01&id=<caseId> mở xuất linh kiện. URL trở về WAR-01.
  useEffect(() => {
    const screen = searchParams.get("screen");
    if (!screen || screen === "WAR-01") return;
    if (screen === "WAR-02") {
      setIntakeOpen(true);
    } else if (DETAIL_SCREENS.has(screen)) {
      const id = searchParams.get("id");
      if (id) setDetailId(id);
    } else if (screen === "COMP-01") {
      const id = searchParams.get("id");
      if (id) {
        setComponentTarget({ caseId: id, caseActive: true, documentId: null });
      } else {
        toast.info(t("warranty.list.pickCaseFirst"));
      }
    } else {
      return;
    }
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("screen", "WAR-01");
    nextParams.delete("id");
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams, t]);

  const refreshAll = () => {
    void queryClient.invalidateQueries({ queryKey: warrantyKeys.all });
  };

  const columns: ResponsiveTableColumn<WarrantyCase>[] = [
    {
      key: "stt",
      header: "STT",
      width: 60,
      hideOnMobile: true,
      render: (row) =>
        mvpRowNumber(
          page,
          perPage,
          rowIndexOfBy(rows, row, (item) => item.id),
        ),
    },
    {
      key: "case_code",
      header: t("warranty.list.colCase"),
      width: 190,
      sortAccessor: (row) => row.case_code || "",
      // KHÔNG fallback sang row.id: cột này là MÃ PHIẾU bảo hành đọc được.
      render: (row) => <strong>{row.case_code || EMPTY_TEXT}</strong>,
    },
    {
      key: "customer",
      header: t("warranty.list.colCustomer"),
      width: 190,
      sortAccessor: (row) => row.customer_name || "",
      render: (row) => (
        <Stack spacing={0}>
          {/* §13.8: mask lại ở tầng render — không tin payload đã mask sẵn. */}
          <UiText variant="body">
            {warrantyPiiText(row.customer_name, canViewPii, "name") ||
              EMPTY_TEXT}
          </UiText>
          <UiText variant="caption">
            {warrantyPiiText(row.customer_phone, canViewPii, "phone") ||
              EMPTY_TEXT}
          </UiText>
        </Stack>
      ),
    },
    {
      key: "sku",
      header: t("warranty.list.colProduct"),
      width: 170,
      sortAccessor: (row) => row.sku || row.sku_name || "",
      render: (row) =>
        row.identification_type === "TEMP_ONLY" && !row.sku ? (
          t("warranty.list.manualDescription")
        ) : row.sku ? (
          <SkuLink code={row.sku} />
        ) : (
          row.sku_name || EMPTY_TEXT
        ),
    },
    {
      key: "defect",
      header: t("warranty.list.colDefect"),
      width: 170,
      hideOnMobile: true,
      sortAccessor: (row) => row.defect_code || row.defect || "",
      render: (row) => {
        const names = (row.defects ?? [])
          .map((defect) => defect.defect_name)
          .filter(Boolean);
        return names.length ? names.join(", ") : row.defect || EMPTY_TEXT;
      },
    },
    {
      key: "identification_type",
      header: t("warranty.list.colIdentification"),
      width: 130,
      hideOnMobile: true,
      sortAccessor: (row) => row.identification_type || "",
      render: (row) => (
        <UiStatusBadge
          tone="neutral"
          label={businessLabel(
            WARRANTY_IDENTIFICATION_STATUS_SHORT_LABELS,
            row.identification_type,
            EMPTY_TEXT,
          )}
        />
      ),
    },
    {
      key: "received_at",
      header: t("warranty.list.colReceivedAt"),
      width: 150,
      sortType: "value",
      hideOnMobile: true,
      sortAccessor: (row) => row.received_at || "",
      render: (row) => formatWarrantyDateTime(row.received_at),
    },
    {
      key: "status",
      header: t("warranty.list.colStatus"),
      width: 150,
      sortType: "value",
      sortAccessor: (row) => row.status,
      render: (row) => (
        <UiStatusBadge
          tone={statusTone(WARRANTY_STATUS_COLORS[row.status])}
          label={WARRANTY_STATUS_LABELS[row.status] ?? row.status}
        />
      ),
    },
  ];

  const renderRowActions = (row: WarrantyCase) => (
    <ActionButton
      kind="edit"
      sx={{ whiteSpace: "nowrap" }}
      onClick={() => setDetailId(row.id)}
    >
      {t("warranty.list.edit")}
    </ActionButton>
  );

  const perPageOptions = MVP_PAGE_SIZE_OPTIONS.includes(
    perPage as (typeof MVP_PAGE_SIZE_OPTIONS)[number],
  )
    ? MVP_PAGE_SIZE_OPTIONS
    : [...MVP_PAGE_SIZE_OPTIONS, perPage].sort((a, b) => a - b);

  return (
    <>
      <div className="warranty-page hn-mvp-source-screen">
        {!canViewPii ? (
          <Box className="footer-note" sx={{ mb: 1 }}>
            <ToolOutlined style={{ marginRight: 6 }} />
            {t("warranty.list.maskedNotice")} <b>warranty.pii.view</b>.
          </Box>
        ) : null}

        <div className="toolbar">
          {/* Annex D SCR-WAR-01 scan-focus: auto-focus ô quét, Enter/đầu đọc submit ngay
            (không chờ debounce) và giữ focus sau khi tìm. §5.3 liệt kê camera là context
            hợp lệ cho cả "warranty receive/search" nên WAR-01 có nút camera fallback. */}
          <UiTextField
            value={searchInput}
            placeholder={t("warranty.list.searchPlaceholder")}
            slotProps={{
              htmlInput: { "aria-label": t("warranty.list.searchAria") },
              input: { inputRef: searchRef, autoFocus: true },
            }}
            onChange={(event) => setSearchInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              setSearch(searchInput.trim());
              setPage(1);
              searchRef.current?.focus();
            }}
            sx={TOOLBAR_SEARCH_SX}
          />

          <UiSelect
            value={status}
            aria-label={t("warranty.list.statusFilterAria")}
            placeholder={t("warranty.list.statusFilterPlaceholder")}
            minWidth={160}
            options={WARRANTY_BASELINE_STATUSES.map((value) => ({
              value,
              label: WARRANTY_STATUS_LABELS[value],
            }))}
            onChange={(value) => {
              setStatus(value as WarrantyCaseStatus | "");
              setPage(1);
            }}
          />
          <UiSelect
            value={identification}
            aria-label={t("warranty.list.identificationFilterAria")}
            placeholder={t("warranty.list.identificationFilterPlaceholder")}
            minWidth={FILTER_WIDTH.select}
            options={[
              { value: "IDENTIFIED", label: t("warranty.list.identified") },
              {
                value: "TEMP_ONLY",
                label: t("warranty.list.temporary"),
              },
            ]}
            onChange={(value) => {
              setIdentification(value as WarrantyIdentificationType | "");
              setPage(1);
            }}
          />
          <UiSelect
            value={defectId}
            aria-label={t("warranty.list.defectFilterAria")}
            placeholder={t("warranty.list.defectFilterPlaceholder")}
            // Nhãn lựa chọn là "DEF-013 · Chập điện / cháy mô-tơ" — ô hẹp làm
            // menu gãy dòng giữa tên bệnh/lỗi (phản hồi người dùng 07/09/2026).
            minWidth={FILTER_WIDTH.selectWide}
            options={(defectsQuery.data?.data ?? []).map((defect) => ({
              value: defect.defect_id,
              label: `${defect.defect_code} · ${defect.defect_name}`,
            }))}
            onChange={(value) => {
              setDefectId(value);
              setPage(1);
            }}
          />
          <UiSelect
            value={perPage}
            aria-label={t("warranty.list.pageSizeAria")}
            minWidth={FILTER_WIDTH.pageSize}
            options={perPageOptions.map((size) => ({
              value: size,
              label: `${size} / trang`,
            }))}
            onChange={(value) => {
              setPerPage(Number(value));
              setPage(1);
            }}
          />
          {/* Tổng số dòng đặt ngay trong toolbar (cạnh bộ lọc/số dòng mỗi trang) để
           * dễ thấy — thay vì chỉ hiện ở phần phân trang tít dưới bảng dài. */}
          <Box component="span" sx={{ whiteSpace: "nowrap" }}>
            <UiText variant="secondary">
              {t("warranty.list.total", { count: pagination.total })}
            </UiText>
          </Box>
          <div className="spacer" />
          {canManage ? (
            <ActionButton kind="create" onClick={() => setIntakeOpen(true)}>
              {t("warranty.list.intake")}
            </ActionButton>
          ) : null}
        </div>

        {listQuery.isError ? (
          <Box sx={{ mb: "14px" }}>
            <ApiErrorAlert
              error={listQuery.error}
              title={t("warranty.list.loadError")}
              onRetry={() => listQuery.refetch()}
            />
          </Box>
        ) : null}

        <TableLoadingBanner
          loading={listQuery.isLoading || listQuery.isFetching}
        />
        <ResponsiveDataTable<WarrantyCase>
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          loading={listQuery.isLoading || listQuery.isFetching}
          emptyText={tableEmptyText(
            listQuery.isError ? listQuery.error : null,
            t("warranty.list.empty"),
          )}
          onRowClick={(row) => setDetailId(row.id)}
          renderRowActions={renderRowActions}
        />
        <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 1.5 }}>
          {/* Tổng số đã hiện trong toolbar → showTotal=false, tránh lặp. */}
          <UiPagination
            page={pagination.current}
            pageSize={perPage}
            total={pagination.total}
            showTotal={false}
            onPageChange={(nextPage) => setPage(nextPage)}
          />
        </Box>
        {intakeOpen ? (
          <WarrantyIntakeModal
            open
            onClose={() => setIntakeOpen(false)}
            onCreated={(created) => {
              setIntakeOpen(false);
              refreshAll();
              setDetailId(created.id);
            }}
          />
        ) : null}

        {detailId ? (
          <WarrantyDetailModal
            caseId={detailId}
            onClose={() => setDetailId(null)}
            onOpenComponentIssue={(target) => setComponentTarget(target)}
          />
        ) : null}

        <CameraScanModal
          open={cameraOpen}
          title={t("warranty.list.scanTitle")}
          onDetected={(code) => {
            setSearchInput(code.trim());
            setSearch(code.trim());
            setPage(1);
            setCameraOpen(false);
          }}
          onClose={() => setCameraOpen(false)}
        />

        {componentTarget ? (
          <ComponentIssueModal
            caseId={componentTarget.caseId}
            caseCode={componentTarget.caseCode}
            caseActive={componentTarget.caseActive}
            documentId={componentTarget.documentId}
            onClose={() => setComponentTarget(null)}
            onChanged={refreshAll}
          />
        ) : null}
      </div>
    </>
  );
}
