/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Pagination, Space, Tag, Typography, message } from "antd";
import {
  MenuItem,
  Select,
  TextField,
  ThemeProvider,
  Typography as MuiTypography,
} from "@mui/material";
import { muiTheme } from "@/app/mui-theme";
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

/** Toolbar filter nhỏ gọn — đồng bộ chuẩn mui-theme.ts (xem gotcha #4/#5 memory pilot MUI). */
const TOOLBAR_SX = {
  "&, & .MuiOutlinedInput-root": { height: 35 },
  "& .MuiSelect-select, & .MuiInputBase-input": {
    paddingTop: "8px !important",
    paddingBottom: "8px !important",
    fontSize: "13.5px !important",
    boxSizing: "border-box",
  },
};

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
        message.info(
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
      header: "Case",
      width: 190,
      sortAccessor: (row) => row.case_code || row.id,
      render: (row) => <strong>{row.case_code || row.id}</strong>,
    },
    {
      key: "customer",
      header: "Khách hàng",
      width: 190,
      sortAccessor: (row) => row.customer_name || "",
      render: (row) => (
        <Space orientation="vertical" size={0}>
          {/* §13.8: mask lại ở tầng render — không tin payload đã mask sẵn. */}
          <Typography.Text>
            {warrantyPiiText(row.customer_name, canViewPii, "name") || "—"}
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {warrantyPiiText(row.customer_phone, canViewPii, "phone") || "—"}
          </Typography.Text>
        </Space>
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
      render: (row) => <Tag>{row.identification_type || "—"}</Tag>,
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
        <Tag color={WARRANTY_STATUS_COLORS[row.status]}>
          {WARRANTY_STATUS_LABELS[row.status] ?? row.status}
        </Tag>
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
    <ThemeProvider theme={muiTheme}>
      <div className="warranty-page hn-mvp-source-screen">
        {!canViewPii ? (
          <div className="footer-note" style={{ marginBottom: 8 }}>
            <ToolOutlined style={{ marginRight: 6 }} />
            Thông tin khách hàng (tên/SĐT/địa chỉ) đang được che theo quyền{" "}
            <b>warranty.pii.view</b>.
          </div>
        ) : null}

        <div className="toolbar">
          {/* Annex D SCR-WAR-01 scan-focus: auto-focus ô quét, Enter/đầu đọc submit ngay
            (không chờ debounce) và giữ focus sau khi tìm. §5.3 liệt kê camera là context
            hợp lệ cho cả "warranty receive/search" nên WAR-01 có nút camera fallback. */}
          <TextField
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
            sx={{ minWidth: 220, ...TOOLBAR_SX }}
          />
          <ActionButton
            kind="camera"
            aria-label="Quét mã máy bằng camera"
            onClick={() => setCameraOpen(true)}
          >
            Camera
          </ActionButton>
          <Select
            displayEmpty
            value={status}
            inputProps={{ "aria-label": "Lọc trạng thái bảo hành" }}
            onChange={(event) => {
              setStatus(event.target.value as WarrantyCaseStatus | "");
              setPage(1);
            }}
            sx={{ minWidth: 160, ...TOOLBAR_SX }}
          >
            <MenuItem value="">Trạng thái: Tất cả</MenuItem>
            {WARRANTY_BASELINE_STATUSES.map((value) => (
              <MenuItem key={value} value={value}>
                {WARRANTY_STATUS_LABELS[value]}
              </MenuItem>
            ))}
          </Select>
          <Select
            displayEmpty
            value={identification}
            inputProps={{ "aria-label": "Lọc loại nhận diện" }}
            onChange={(event) => {
              setIdentification(
                event.target.value as WarrantyIdentificationType | "",
              );
              setPage(1);
            }}
            sx={{ minWidth: 148, ...TOOLBAR_SX }}
          >
            <MenuItem value="">Nhận diện: Tất cả</MenuItem>
            <MenuItem value="IDENTIFIED">IDENTIFIED</MenuItem>
            <MenuItem value="TEMP_ONLY">TEMP_ONLY</MenuItem>
          </Select>
          <Select
            displayEmpty
            value={defectId}
            inputProps={{ "aria-label": "Lọc bệnh/lỗi" }}
            onChange={(event) => {
              setDefectId(event.target.value);
              setPage(1);
            }}
            sx={{ minWidth: 148, ...TOOLBAR_SX }}
          >
            <MenuItem value="">Bệnh/lỗi: Tất cả</MenuItem>
            {(defectsQuery.data?.data ?? []).map((defect) => (
              <MenuItem key={defect.defect_id} value={defect.defect_id}>
                {defect.defect_code} · {defect.defect_name}
              </MenuItem>
            ))}
          </Select>
          <Select
            value={perPage}
            inputProps={{ "aria-label": "Số dòng mỗi trang" }}
            onChange={(event) => {
              setPerPage(Number(event.target.value));
              setPage(1);
            }}
            sx={{ minWidth: 100, ...TOOLBAR_SX }}
          >
            {perPageOptions.map((size) => (
              <MenuItem key={size} value={size}>
                {size} / trang
              </MenuItem>
            ))}
          </Select>
          {/* Tổng số dòng đặt ngay trong toolbar (cạnh bộ lọc/số dòng mỗi trang) để
           * dễ thấy — thay vì chỉ hiện ở phần phân trang tít dưới bảng dài. */}
          <MuiTypography
            variant="body2"
            color="text.secondary"
            sx={{ whiteSpace: "nowrap" }}
          >
            Tổng {pagination.total} case bảo hành
          </MuiTypography>
          <div className="spacer" />
          {canManage ? (
            <ActionButton kind="create" onClick={() => setIntakeOpen(true)}>
              Tiếp nhận bảo hành
            </ActionButton>
          ) : null}
        </div>

        {listQuery.isError ? (
          <div style={{ marginBottom: 14 }}>
            <ApiErrorAlert
              error={listQuery.error}
              title="Không tải được danh sách bảo hành"
              onRetry={() => listQuery.refetch()}
            />
          </div>
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
            `Chọn case bảo hành ${row.case_code || row.id}`
          }
          loading={listQuery.isLoading || listQuery.isFetching}
          emptyText={tableEmptyText(
            listQuery.isError ? listQuery.error : null,
            "Không có case bảo hành theo bộ lọc hiện tại",
          )}
          onRowClick={(row) => setDetailId(row.id)}
          renderRowActions={renderRowActions}
        />
        <div
          style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}
        >
          <Pagination
            current={pagination.current}
            pageSize={perPage}
            total={pagination.total}
            showSizeChanger={false}
            onChange={(nextPage) => setPage(nextPage)}
          />
        </div>
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
    </ThemeProvider>
  );
}
