/* eslint-disable react-hooks/set-state-in-effect */
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
} from "@/shared/ui";
import {
  ResponsiveDataTable,
  type ResponsiveTableColumn,
} from "@/shared/components/data-display/ResponsiveDataTable";
import { ToolOutlined } from "@/shared/components/icons";
import { useQueryClient } from "@tanstack/react-query";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
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
import { useRowSelection } from "@/shared/hooks/useRowSelection";
import { useMvpDefects } from "@/modules/master-data/hooks/use-mvp-master";
import {
  WARRANTY_BASELINE_STATUSES,
  WARRANTY_STATUS_COLORS,
  WARRANTY_STATUS_LABELS,
  formatWarrantyDateTime,
  warrantyPiiText,
} from "@/modules/warranty/constants";
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
  const rowSelection = useRowSelection(rows, (row) => row.id);
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
        toast.info(
          "Chọn một case bảo hành trong danh sách rồi bấm “Xuất linh kiện”.",
        );
      }
    } else {
      return;
    }
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("screen", "WAR-01");
    nextParams.delete("id");
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

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
          rows.findIndex((item) => item.id === row.id),
        ),
    },
    {
      key: "case_code",
      header: "Phiếu",
      width: 190,
      sortAccessor: (row) => row.case_code || "",
      // KHÔNG fallback sang row.id: cột này là MÃ PHIẾU bảo hành đọc được.
      render: (row) => <strong>{row.case_code || "—"}</strong>,
    },
    {
      key: "customer",
      header: "Khách hàng",
      width: 190,
      sortAccessor: (row) => row.customer_name || "",
      render: (row) => (
        <Stack spacing={0}>
          {/* §13.8: mask lại ở tầng render — không tin payload đã mask sẵn. */}
          <UiText variant="body">
            {warrantyPiiText(row.customer_name, canViewPii, "name") || "—"}
          </UiText>
          <UiText variant="caption">
            {warrantyPiiText(row.customer_phone, canViewPii, "phone") || "—"}
          </UiText>
        </Stack>
      ),
    },
    {
      key: "sku",
      header: "Sản phẩm",
      width: 170,
      sortAccessor: (row) => row.sku || row.sku_name || "",
      render: (row) =>
        row.identification_type === "TEMP_ONLY" && !row.sku
          ? "Mô tả thủ công"
          : row.sku || row.sku_name || "—",
    },
    {
      key: "defect",
      header: "Bệnh/lỗi",
      width: 170,
      hideOnMobile: true,
      sortAccessor: (row) => row.defect_code || row.defect || "",
      render: (row) => {
        const names = (row.defects ?? [])
          .map((defect) => defect.defect_name)
          .filter(Boolean);
        return names.length ? names.join(", ") : row.defect || "—";
      },
    },
    {
      key: "identification_type",
      header: "Nhận diện",
      width: 130,
      hideOnMobile: true,
      sortAccessor: (row) => row.identification_type || "",
      render: (row) => (
        <UiStatusBadge tone="neutral" label={row.identification_type || "—"} />
      ),
    },
    {
      key: "received_at",
      header: "Ngày nhận",
      width: 150,
      sortType: "value",
      hideOnMobile: true,
      sortAccessor: (row) => row.received_at || "",
      render: (row) => formatWarrantyDateTime(row.received_at),
    },
    {
      key: "status",
      header: "Trạng thái",
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
      Sửa
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
            Thông tin khách hàng (tên/SĐT/địa chỉ) đang được che theo quyền{" "}
            <b>warranty.pii.view</b>.
          </Box>
        ) : null}

        <div className="toolbar">
          {/* Annex D SCR-WAR-01 scan-focus: auto-focus ô quét, Enter/đầu đọc submit ngay
            (không chờ debounce) và giữ focus sau khi tìm. §5.3 liệt kê camera là context
            hợp lệ cho cả "warranty receive/search" nên WAR-01 có nút camera fallback. */}
          <UiTextField
            value={searchInput}
            placeholder="Quét hoặc nhập case / mã máy / mã tạm / SĐT..."
            slotProps={{
              htmlInput: { "aria-label": "Tìm case bảo hành" },
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
            sx={{ minWidth: 220 }}
          />
          
          <UiSelect
            value={status}
            aria-label="Lọc trạng thái bảo hành"
            placeholder="Trạng thái: Tất cả"
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
            aria-label="Lọc loại nhận diện"
            placeholder="Nhận diện: Tất cả"
            minWidth={148}
            options={[
              { value: "IDENTIFIED", label: "Đã xác định sản phẩm" },
              {
                value: "TEMP_ONLY",
                label: "Tiếp nhận tạm, chưa xác định sản phẩm",
              },
            ]}
            onChange={(value) => {
              setIdentification(value as WarrantyIdentificationType | "");
              setPage(1);
            }}
          />
          <UiSelect
            value={defectId}
            aria-label="Lọc bệnh/lỗi"
            placeholder="Bệnh/lỗi: Tất cả"
            minWidth={148}
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
            aria-label="Số dòng mỗi trang"
            minWidth={100}
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
              Tổng {pagination.total} phiếu bảo hành
            </UiText>
          </Box>
          <div className="spacer" />
          {canManage ? (
            <ActionButton kind="create" onClick={() => setIntakeOpen(true)}>
              Tiếp nhận bảo hành
            </ActionButton>
          ) : null}
        </div>

        {listQuery.isError ? (
          <Box sx={{ mb: "14px" }}>
            <ApiErrorAlert
              error={listQuery.error}
              title="Không tải được danh sách bảo hành"
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
          rowSelection={rowSelection}
          selectionLabel={(row) =>
            `Chọn case bảo hành ${row.case_code || "chưa có mã"}`
          }
          loading={listQuery.isLoading || listQuery.isFetching}
          emptyText={tableEmptyText(
            listQuery.isError ? listQuery.error : null,
            "Không có phiếu bảo hành theo bộ lọc hiện tại",
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
          title="Quét mã máy / mã tạm để tra cứu case"
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
