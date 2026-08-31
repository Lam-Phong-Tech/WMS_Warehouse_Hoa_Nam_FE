/**
 * GOLDEN CATALOG của design system (Part 2 foundation + Part 3 unification).
 *
 * - Dùng CHÍNH production exports (@/shared/ui + adapter ResponsiveDataTable) —
 *   không component demo-only.
 * - Dữ liệu cố định, tiếng Việt dài, có case dense/empty — không phụ thuộc
 *   API/locale/timezone runtime (deterministic cho visual golden).
 * - Route DEV-only: /ui-foundation (/component-catalog redirect về đây).
 *   E2E computed-style + golden + responsive: e2e/ui-foundation.spec.ts.
 * - Light theme only — dark chưa thuộc baseline (semantic-dark.ts).
 * - Keyboard/focus: mọi control trong trang tab được theo thứ tự DOM; focus
 *   ring dùng token --wms-focus-ring (kiểm bằng E2E + test ARIA từng component).
 */
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import {
  Box,
  Stack,
  SEMANTIC_LIGHT as S,
  UiAlert,
  UiAvatar,
  UiBreadcrumb,
  UiButton,
  UiCard,
  UiConfirmDialog,
  UiDescriptions,
  UiDialog,
  UiDrawer,
  UiFormAutocomplete,
  UiFormCheckbox,
  UiFormDate,
  UiFormField,
  UiFormNumber,
  UiFormRadioGroup,
  UiFormSelect,
  UiFormSwitch,
  UiFormText,
  UiIcon,
  UiIconButton,
  UiKpiCard,
  UiPagination,
  UiAppShell,
  UiFooter,
  UiPageContainer,
  UiSidebarNav,
  UiStateSurface,
  UiStatusBadge,
  UiTabs,
  UiText,
  UiTextField,
  UiTimeline,
  UiTopbar,
  useUiConfirm,
} from "@/shared/ui";
import { ResponsiveDataTable } from "@/shared/components/data-display/ResponsiveDataTable";
import { EMPTY_TEXT } from "@/shared/constants/display";

const LONG_VI =
  "Phiếu xuất kho số XK-2026-000123 của Đại lý Trần Nguyễn Bách Hóa Tổng Hợp Miền Đông Nam Bộ — kiểm tra xuống dòng, không tràn ngang.";

const TOKEN_SWATCHES: Array<{ name: string; value: string }> = [
  { name: "primary", value: S.primary },
  { name: "primary-dark", value: S.primaryDark },
  { name: "secondary", value: S.secondary },
  { name: "success", value: S.success },
  { name: "warning", value: S.warning },
  { name: "error", value: S.error },
  { name: "info", value: S.info },
  { name: "bg-canvas", value: S.bgCanvas },
];

interface CatalogRow {
  id: string;
  code: string;
  agency: string;
  qty: number;
  status: "DRAFT" | "POSTED" | "ERROR";
}

const TABLE_ROWS: CatalogRow[] = [
  {
    id: "r1",
    code: "XK-2026-000123",
    agency: "Đại lý Trần Nguyễn Bách Hóa Tổng Hợp Miền Đông Nam Bộ",
    qty: 1280,
    status: "POSTED",
  },
  {
    id: "r2",
    code: "XK-2026-000124",
    agency: "Đại lý Minh Phát",
    qty: 64,
    status: "DRAFT",
  },
  {
    id: "r3",
    code: "NK-2026-00088",
    agency: "Kho tổng Hoa Nam",
    qty: 4096,
    status: "POSTED",
  },
  {
    id: "r4",
    code: "XK-2026-000125",
    agency: "Đại lý Hồng Hà",
    qty: 12,
    status: "ERROR",
  },
  {
    id: "r5",
    code: "NK-2026-00089",
    agency: "Đại lý Sài Gòn Chợ Lớn",
    qty: 730,
    status: "DRAFT",
  },
];

const STATUS_TONE = {
  DRAFT: "neutral",
  POSTED: "success",
  ERROR: "error",
} as const;

interface CatalogFormValues {
  code: string;
  password: string;
  search: string;
  qty: number | null;
  agency: string;
  brand: string;
  note: string;
  accept: boolean;
  active: boolean;
  mode: string;
  date: unknown;
}

/** Form showcase — có field lỗi cưỡng bức để soi state validation (fixture). */
function FormsSection() {
  const { control, setError } = useForm<CatalogFormValues>({
    defaultValues: {
      code: "",
      password: "",
      search: "",
      qty: null,
      agency: "",
      brand: "",
      note: LONG_VI,
      accept: false,
      active: true,
      mode: "barcode",
      date: null,
    },
  });

  useEffect(() => {
    setError("qty", {
      message: "Số lượng phải lớn hơn 0 (request_id: 9f2c-fixture).",
    });
    setError("agency", { message: "Bắt buộc chọn nơi nhận." });
  }, [setError]);

  const options = useMemo(
    () => [
      { value: "hn", label: "Kho tổng Hoa Nam" },
      { value: "mp", label: "Đại lý Minh Phát" },
      {
        value: "dn",
        label: "Đại lý Trần Nguyễn Bách Hóa Tổng Hợp Miền Đông Nam Bộ",
      },
      { value: "off", label: "Đại lý ngừng hợp tác", disabled: true },
    ],
    [],
  );

  return (
    <UiCard title="Forms — lớp field canonical (RHF + token)">
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
          gap: 2,
          maxWidth: 900,
        }}
      >
        <UiFormText
          control={control}
          name="code"
          label="Mã phiếu"
          required
          placeholder="VD: XK-2026-000123"
          helperText="Nhập đúng định dạng phiếu."
          startIcon="barcode-read"
          data-testid="form-text"
        />
        <UiFormText
          control={control}
          name="password"
          label="Mật khẩu"
          type="password"
          placeholder="Nhập mật khẩu"
        />
        <UiFormText
          control={control}
          name="search"
          label="Tìm kiếm"
          type="search"
          placeholder="Tìm theo mã / tên đại lý"
        />
        <UiFormNumber
          control={control}
          name="qty"
          label="Số lượng"
          suffix="cái"
          min={0}
          data-testid="form-number"
        />
        <UiFormSelect
          control={control}
          name="agency"
          label="Nơi nhận"
          required
          options={options}
          placeholder="Chọn nơi nhận"
          data-testid="form-select"
        />
        <UiFormAutocomplete
          control={control}
          name="brand"
          label="Nhãn hàng (autocomplete)"
          options={[
            { value: "b1", label: "Bảo Việt Electric" },
            { value: "b2", label: "Hoà Phát Home" },
            { value: "b3", label: "Điện cơ Thống Nhất" },
          ]}
        />
        <UiFormDate
          control={control}
          name="date"
          label="Ngày chứng từ"
          placeholder="Chọn ngày"
        />
        <UiFormText
          control={control}
          name="note"
          label="Ghi chú dài"
          multiline
          rows={3}
        />
        <UiFormCheckbox
          control={control}
          name="accept"
          label="Tôi xác nhận đã kiểm đủ hàng trước khi hoàn tất."
        />
        <UiFormSwitch
          control={control}
          name="active"
          label="Kích hoạt SKU sau khi lưu"
        />
        <UiFormRadioGroup
          control={control}
          name="mode"
          label="Chế độ quét"
          row
          options={[
            { value: "barcode", label: "Barcode/QR" },
            { value: "rfid", label: "RFID (tuỳ chọn)" },
            { value: "manual", label: "Nhập tay" },
          ]}
        />
        <UiTextField
          label="Bị khóa (read-only adapter)"
          disabled
          defaultValue="Không sửa được"
        />
      </Box>
    </UiCard>
  );
}

function LayoutSection({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <UiCard
      title="Layout — UiAppShell / UiSidebarNav / UiTopbar (Vuexy sáng 260px)"
      disablePadding
    >
      <Box
        sx={{
          height: 420,
          overflow: "hidden",
          borderTop: `1px solid ${S.border}`,
        }}
        data-testid="layout-demo"
      >
        <UiAppShell
          collapsed={collapsed}
          sidebar={
            <UiSidebarNav
              collapsed={collapsed}
              header={
                <Stack
                  direction="row"
                  sx={{ alignItems: "center", gap: 1, px: 1, py: 1.5 }}
                >
                  <UiIcon name="box" color={S.primary} size="lg" />
                  {!collapsed ? (
                    <UiText variant="cardTitle">Hoa Nam WMS</UiText>
                  ) : null}
                </Stack>
              }
              groups={[
                {
                  label: "Vận hành",
                  items: [
                    {
                      key: "dashboard",
                      label: "Bảng điều khiển",
                      icon: "dashboard",
                      active: true,
                    },
                    { key: "inbound", label: "Nhập kho", icon: "inbox-in" },
                    { key: "outbound", label: "Xuất kho", icon: "inbox-out" },
                  ],
                },
                {
                  label: "Quản trị",
                  items: [
                    {
                      key: "master",
                      label: "Danh mục SKU và đại lý phân phối toàn quốc",
                      icon: "boxes",
                    },
                    { key: "iam", label: "Người dùng", icon: "user" },
                  ],
                },
              ]}
            />
          }
          topbar={
            <UiTopbar
              left={<UiText variant="cardTitle">Bảng điều khiển</UiText>}
              right={
                <Stack direction="row" sx={{ alignItems: "center", gap: 1.5 }}>
                  <UiIconButton
                    aria-label="Thu gọn sidebar"
                    onClick={onToggle}
                    data-testid="collapse-toggle"
                  >
                    <UiIcon name="menu-burger" />
                  </UiIconButton>
                  <UiAvatar name="Trần Tùng Lâm" />
                </Stack>
              }
            />
          }
          footer={<UiFooter>Hoa Nam Tools — nội bộ</UiFooter>}
        >
          <UiPageContainer
            breadcrumb={
              <UiBreadcrumb
                items={[
                  { label: "Trang chủ" },
                  { label: "Vận hành" },
                  { label: "Bảng điều khiển" },
                ]}
              />
            }
            title="Bảng điều khiển"
            subtitle="Số liệu cố định — fixture catalog"
            actions={
              <UiButton startIcon={<UiIcon name="plus" color="currentColor" />}>
                Tạo phiếu
              </UiButton>
            }
          >
            <UiText variant="body">{LONG_VI}</UiText>
          </UiPageContainer>
        </UiAppShell>
      </Box>
    </UiCard>
  );
}

export default function FoundationCatalogPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [tab, setTab] = useState("all");
  const [page, setPage] = useState(3);
  const [pageSize, setPageSize] = useState(20);
  const [collapsed, setCollapsed] = useState(false);
  const { confirm, confirmDialog } = useUiConfirm();
  const [lastConfirm, setLastConfirm] = useState<string>("(chưa hỏi)");

  return (
    <Box
      data-testid="ui-foundation-root"
      sx={{ display: "grid", gap: 3, maxWidth: 1080 }}
    >
      <UiText variant="pageTitle">Foundation catalog (Vuexy baseline)</UiText>

      <UiCard title="Tokens — màu chuẩn (DEC-UI-BASELINE-01)">
        <Stack direction="row" sx={{ flexWrap: "wrap", gap: 2 }}>
          {TOKEN_SWATCHES.map((swatch) => (
            <Stack sx={{ alignItems: "center", gap: 0.5 }} key={swatch.name}>
              <Box
                data-testid={`swatch-${swatch.name}`}
                sx={{
                  width: 56,
                  height: 40,
                  borderRadius: 1,
                  backgroundColor: swatch.value,
                  border: `1px solid ${S.border}`,
                }}
              />
              <UiText variant="caption">{swatch.name}</UiText>
            </Stack>
          ))}
        </Stack>
      </UiCard>

      <UiCard title="Typography">
        <Stack sx={{ gap: 1 }}>
          <UiText variant="pageTitle">Tiêu đề trang 24/500</UiText>
          <UiText variant="cardTitle">Tiêu đề card 18/600</UiText>
          <UiText variant="body">Nội dung body 15px — {LONG_VI}</UiText>
          <UiText variant="secondary">Chữ phụ 13px — nhãn, mô tả cột.</UiText>
          <UiText variant="caption">Caption 12px — ghi chú mờ.</UiText>
        </Stack>
      </UiCard>

      <UiCard title="Button / IconButton">
        <Stack sx={{ gap: 2 }}>
          <Stack
            direction="row"
            sx={{ flexWrap: "wrap", gap: 1.5, alignItems: "center" }}
          >
            <UiButton data-testid="btn-filled">Nút chính</UiButton>
            <UiButton appearance="tonal">Nút tonal</UiButton>
            <UiButton appearance="outlined">Nút viền</UiButton>
            <UiButton appearance="text">Nút chữ</UiButton>
            <UiButton color="error">Nguy hiểm</UiButton>
            {/* WWHN-268: nút bị chặn phát hook data-ui-state="disabled". */}
            <UiButton disabled data-ui-state="disabled">
              Vô hiệu
            </UiButton>
            <UiButton loading>Đang lưu…</UiButton>
            <UiIconButton aria-label="Làm mới" data-testid="icon-btn">
              <UiIcon name="refresh" />
            </UiIconButton>
          </Stack>
          <UiText variant="secondary">
            Hover nhấc 1px, active lún 0.97 — motion contract; focus-visible
            dùng token focus ring khi điều hướng bàn phím (Tab).
          </UiText>
        </Stack>
      </UiCard>

      <FormsSection />

      <UiCard title="Status badge">
        <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1 }}>
          <UiStatusBadge
            tone="primary"
            label="ĐANG XỬ LÝ"
            data-testid="badge-primary"
          />
          <UiStatusBadge tone="success" label="ĐÃ DUYỆT" />
          <UiStatusBadge tone="warning" label="CHỜ DUYỆT" />
          <UiStatusBadge tone="error" label="TỪ CHỐI" />
          <UiStatusBadge tone="info" label="ĐANG QUÉT" />
          <UiStatusBadge tone="neutral" label="NHÁP" />
        </Stack>
      </UiCard>

      <UiCard title="KPI card">
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              sm: "1fr 1fr",
              lg: "repeat(4, 1fr)",
            },
            gap: 2,
          }}
        >
          <UiKpiCard
            label="Tồn khả dụng"
            value="1.284.560"
            icon="box"
            tone="primary"
            hint="Cập nhật 5 phút trước"
          />
          <UiKpiCard
            label="Phiếu chờ duyệt"
            value="27"
            icon="time-quarter-past"
            tone="warning"
          />
          <UiKpiCard
            label="Đã xuất hôm nay"
            value="312"
            icon="inbox-out"
            tone="success"
            data-testid="kpi-success"
          />
          <UiKpiCard
            label="Lỗi cần xử lý"
            value="3"
            icon="cross-circle"
            tone="error"
          />
        </Box>
      </UiCard>

      <UiCard title="Tabs / Pagination">
        <Stack sx={{ gap: 2 }}>
          <UiTabs
            aria-label="Bộ lọc trạng thái"
            value={tab}
            onChange={setTab}
            items={[
              { key: "all", label: "Tất cả" },
              { key: "draft", label: "Nháp" },
              { key: "posted", label: "Đã ghi sổ" },
              { key: "locked", label: "Đã khóa (vô hiệu)", disabled: true },
            ]}
          />
          <UiPagination
            page={page}
            pageSize={pageSize}
            total={137}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </Stack>
      </UiCard>

      <UiCard
        title="Bảng dữ liệu (ResponsiveDataTable — canonical, dense + empty)"
        disablePadding
      >
        <Box sx={{ display: "grid", gap: 3, p: 3 }}>
          <ResponsiveDataTable<CatalogRow>
            columns={[
              {
                key: "code",
                header: "Mã chứng từ",
                render: (r) => r.code,
                sortAccessor: (r) => r.code,
              },
              {
                key: "agency",
                header: "Đại lý / nơi nhận",
                render: (r) => r.agency,
              },
              {
                key: "qty",
                header: "Số lượng",
                align: "right",
                render: (r) => r.qty.toLocaleString("vi-VN"),
                sortAccessor: (r) => r.qty,
              },
              {
                key: "status",
                header: "Trạng thái",
                render: (r) => (
                  <UiStatusBadge
                    tone={STATUS_TONE[r.status]}
                    label={r.status}
                  />
                ),
              },
            ]}
            rows={TABLE_ROWS}
            rowKey={(r) => r.id}
          />
          <ResponsiveDataTable<CatalogRow>
            columns={[
              { key: "code", header: "Mã chứng từ", render: (r) => r.code },
            ]}
            rows={[]}
            rowKey={(r) => r.id}
            emptyText="Không có phiếu nào trong bộ lọc hiện tại."
          />
        </Box>
      </UiCard>

      <UiCard title="Descriptions / Timeline / Avatar / Alert">
        <Stack sx={{ gap: 3 }}>
          <UiDescriptions
            items={[
              { label: "Mã điều chỉnh", value: "REV-20260818-0001" },
              {
                label: "Trạng thái",
                value: <UiStatusBadge tone="success" label="ĐÃ DUYỆT" />,
              },
              { label: "Người lập", value: "Trần Tùng Lâm" },
              { label: "Nơi nhận", value: LONG_VI, span: 3 },
              { label: "Ghi chú", value: EMPTY_TEXT },
            ]}
          />
          <UiTimeline
            items={[
              { title: "Tạo phiếu", time: "08:00 18/08/2026", tone: "primary" },
              {
                title: "Quét đủ 128/128 thùng",
                description: "Người quét: NV kho 02",
                time: "08:41",
                tone: "info",
              },
              { title: "In Packing Label", time: "08:45", tone: "success" },
              {
                title: "Chờ hoàn tất xuất",
                description: "Cần xác nhận đã dán nhãn.",
                time: EMPTY_TEXT,
                tone: "warning",
              },
            ]}
          />
          <Stack direction="row" sx={{ gap: 1.5, alignItems: "center" }}>
            <UiAvatar name="Trần Tùng Lâm" size="lg" />
            <UiAvatar name="Nguyễn Văn An" />
            <UiAvatar name="Kho" size="sm" />
          </Stack>
          <Stack sx={{ gap: 1.5 }}>
            <UiAlert
              tone="success"
              title="Đã ghi sổ"
              data-testid="alert-success"
            >
              Phiếu XK-2026-000123 đã trừ tồn thành công.
            </UiAlert>
            <UiAlert tone="info">Dữ liệu tồn kho làm mới mỗi 60 giây.</UiAlert>
            <UiAlert tone="warning" title="Sắp hết hạn phiên">
              {LONG_VI}
            </UiAlert>
            <UiAlert
              tone="error"
              title="Không thể hoàn tất"
              onClose={() => undefined}
              action={
                <UiButton appearance="text" color="error">
                  Thử lại
                </UiButton>
              }
            >
              Máy chủ trả lỗi 500 (request_id: a1b2c3-fixture).
            </UiAlert>
          </Stack>
        </Stack>
      </UiCard>

      <UiCard title="Overlay — Dialog / Drawer / Confirm">
        <Stack direction="row" sx={{ gap: 1.5, flexWrap: "wrap" }}>
          <UiButton
            data-testid="open-dialog"
            onClick={() => setDialogOpen(true)}
          >
            Mở dialog
          </UiButton>
          <UiButton appearance="outlined" onClick={() => setDrawerOpen(true)}>
            Mở drawer
          </UiButton>
          <UiButton
            color="error"
            appearance="tonal"
            data-testid="open-confirm"
            onClick={() => setConfirmOpen(true)}
          >
            Confirm nguy hiểm
          </UiButton>
          <UiButton
            appearance="outlined"
            onClick={() => {
              void confirm({
                title: "Đổi trạng thái SKU?",
                content: "Promise-API useUiConfirm — thay Modal.confirm.",
                confirmText: "Đồng ý",
              }).then((ok) => {
                setLastConfirm(ok ? "Đồng ý" : "Hủy");
                // WWHN-268: xác nhận thành công sinh toast success thật —
                // demo giữ nguyên hành vi chuẩn của flow confirm nghiệp vụ.
                if (ok) toast.success("Đã xác nhận thao tác (fixture).");
              });
            }}
          >
            useUiConfirm()
          </UiButton>
          <UiText variant="secondary">
            Kết quả confirm gần nhất:{" "}
            {/* WWHN-268: kết quả xác nhận thành công phát hook "success". */}
            <Box
              component="span"
              data-ui-state={lastConfirm === "Đồng ý" ? "success" : undefined}
            >
              {lastConfirm}
            </Box>
          </UiText>
        </Stack>
        <UiDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          title="Xác nhận hoàn tất xuất kho"
          actions={
            <>
              <UiButton appearance="text" onClick={() => setDialogOpen(false)}>
                Hủy
              </UiButton>
              <UiButton onClick={() => setDialogOpen(false)}>Xác nhận</UiButton>
            </>
          }
        >
          <UiText variant="body">
            Hành động này sẽ trừ tồn kho (fixture — không gọi API). {LONG_VI}
          </UiText>
        </UiDialog>
        <UiDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          title="Chi tiết phiếu (drawer)"
        >
          <UiText variant="body">{LONG_VI}</UiText>
        </UiDrawer>
        <UiConfirmDialog
          open={confirmOpen}
          tone="danger"
          title="Xóa phiếu nháp?"
          confirmText="Xóa"
          onConfirm={() => setConfirmOpen(false)}
          onClose={() => setConfirmOpen(false)}
        >
          Hành động không thể hoàn tác (fixture).
        </UiConfirmDialog>
        {confirmDialog}
      </UiCard>

      <LayoutSection
        collapsed={collapsed}
        onToggle={() => setCollapsed((v) => !v)}
      />

      <UiCard title="State surfaces">
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
            gap: 2,
          }}
        >
          <UiStateSurface kind="loading" />
          <UiStateSurface
            kind="empty"
            description="Chưa có phiếu nào trong bộ lọc hiện tại."
            action={<UiButton appearance="outlined">Tạo phiếu mới</UiButton>}
          />
          <UiStateSurface
            kind="error"
            description="Máy chủ trả lỗi 500 (request_id: a1b2c3-fixture)."
            action={<UiButton>Thử lại</UiButton>}
          />
          <UiStateSurface
            kind="no-permission"
            description="Cần quyền inventory.view."
          />
        </Box>
      </UiCard>

      <UiCard title="FormField shell (control tùy ý)">
        <Box sx={{ maxWidth: 420 }}>
          <UiFormField
            label="FormField shell"
            required
            helperText="Dùng khi control không phải TextField."
          >
            <UiTextField placeholder="Control bên trong shell" />
          </UiFormField>
        </Box>
      </UiCard>
    </Box>
  );
}
