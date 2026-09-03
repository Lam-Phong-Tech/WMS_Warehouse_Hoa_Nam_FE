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
import { useT, type TranslateFn } from "@/shared/i18n/useT";

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

function catalogRows(t: TranslateFn): CatalogRow[] {
  return [
    {
      id: "r1",
      code: "XK-2026-000123",
      agency: t("catalog.data.agencyLong"),
      qty: 1280,
      status: "POSTED",
    },
    {
      id: "r2",
      code: "XK-2026-000124",
      agency: t("catalog.data.agencyMinhPhat"),
      qty: 64,
      status: "DRAFT",
    },
    {
      id: "r3",
      code: "NK-2026-00088",
      agency: t("catalog.data.warehouseCentral"),
      qty: 4096,
      status: "POSTED",
    },
    {
      id: "r4",
      code: "XK-2026-000125",
      agency: t("catalog.data.agencyHongHa"),
      qty: 12,
      status: "ERROR",
    },
    {
      id: "r5",
      code: "NK-2026-00089",
      agency: t("catalog.data.agencySaiGon"),
      qty: 730,
      status: "DRAFT",
    },
  ];
}

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
  const t = useT();
  const { control, setError } = useForm<CatalogFormValues>({
    defaultValues: {
      code: "",
      password: "",
      search: "",
      qty: null,
      agency: "",
      brand: "",
      note: t("catalog.longText"),
      accept: false,
      active: true,
      mode: "barcode",
      date: null,
    },
  });

  useEffect(() => {
    setError("qty", {
      message: t("catalog.forms.errQty"),
    });
    setError("agency", { message: t("catalog.forms.errAgency") });
  }, [setError, t]);

  const options = useMemo(
    () => [
      { value: "hn", label: t("catalog.data.warehouseCentral") },
      { value: "mp", label: t("catalog.data.agencyMinhPhat") },
      {
        value: "dn",
        label: t("catalog.data.agencyLong"),
      },
      {
        value: "off",
        label: t("catalog.forms.agencyInactive"),
        disabled: true,
      },
    ],
    [t],
  );

  return (
    <UiCard title={t("catalog.forms.sectionTitle")}>
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
          label={t("catalog.forms.code")}
          required
          placeholder={t("catalog.forms.codePlaceholder")}
          helperText={t("catalog.forms.codeHelper")}
          startIcon="barcode-read"
          data-testid="form-text"
        />
        <UiFormText
          control={control}
          name="password"
          label={t("catalog.forms.password")}
          type="password"
          placeholder={t("catalog.forms.passwordPlaceholder")}
        />
        <UiFormText
          control={control}
          name="search"
          label={t("catalog.forms.search")}
          type="search"
          placeholder={t("catalog.forms.searchPlaceholder")}
        />
        <UiFormNumber
          control={control}
          name="qty"
          label={t("catalog.common.qty")}
          suffix={t("catalog.forms.qtySuffix")}
          min={0}
          data-testid="form-number"
        />
        <UiFormSelect
          control={control}
          name="agency"
          label={t("catalog.common.recipient")}
          required
          options={options}
          placeholder={t("catalog.forms.recipientPlaceholder")}
          data-testid="form-select"
        />
        <UiFormAutocomplete
          control={control}
          name="brand"
          label={t("catalog.forms.brand")}
          options={[
            { value: "b1", label: t("catalog.data.brandBaoViet") },
            { value: "b2", label: t("catalog.data.brandHoaPhat") },
            { value: "b3", label: t("catalog.data.brandThongNhat") },
          ]}
        />
        <UiFormDate
          control={control}
          name="date"
          label={t("catalog.forms.docDate")}
          placeholder={t("catalog.forms.docDatePlaceholder")}
        />
        <UiFormText
          control={control}
          name="note"
          label={t("catalog.forms.longNote")}
          multiline
          rows={3}
        />
        <UiFormCheckbox
          control={control}
          name="accept"
          label={t("catalog.forms.accept")}
        />
        <UiFormSwitch
          control={control}
          name="active"
          label={t("catalog.forms.activeSku")}
        />
        <UiFormRadioGroup
          control={control}
          name="mode"
          label={t("catalog.forms.scanMode")}
          row
          options={[
            { value: "barcode", label: "Barcode/QR" },
            { value: "rfid", label: t("catalog.forms.scanModeRfid") },
            { value: "manual", label: t("catalog.forms.scanModeManual") },
          ]}
        />
        <UiTextField
          label={t("catalog.forms.locked")}
          disabled
          defaultValue={t("catalog.forms.lockedValue")}
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
  const t = useT();

  return (
    <UiCard title={t("catalog.layout.sectionTitle")} disablePadding>
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
                  label: t("catalog.layout.groupOperations"),
                  items: [
                    {
                      key: "dashboard",
                      label: t("catalog.layout.navDashboard"),
                      icon: "dashboard",
                      active: true,
                    },
                    {
                      key: "inbound",
                      label: t("catalog.layout.navInbound"),
                      icon: "inbox-in",
                    },
                    {
                      key: "outbound",
                      label: t("catalog.layout.navOutbound"),
                      icon: "inbox-out",
                    },
                  ],
                },
                {
                  label: t("catalog.layout.groupAdmin"),
                  items: [
                    {
                      key: "master",
                      label: t("catalog.layout.navMasterData"),
                      icon: "boxes",
                    },
                    {
                      key: "iam",
                      label: t("catalog.layout.navUsers"),
                      icon: "user",
                    },
                  ],
                },
              ]}
            />
          }
          topbar={
            <UiTopbar
              left={
                <UiText variant="cardTitle">
                  {t("catalog.layout.navDashboard")}
                </UiText>
              }
              right={
                <Stack direction="row" sx={{ alignItems: "center", gap: 1.5 }}>
                  <UiIconButton
                    aria-label={t("catalog.layout.collapseSidebar")}
                    onClick={onToggle}
                    data-testid="collapse-toggle"
                  >
                    <UiIcon name="menu-burger" />
                  </UiIconButton>
                  <UiAvatar name={t("catalog.data.userLam")} />
                </Stack>
              }
            />
          }
          footer={<UiFooter>{t("catalog.layout.footer")}</UiFooter>}
        >
          <UiPageContainer
            breadcrumb={
              <UiBreadcrumb
                items={[
                  { label: t("catalog.layout.breadcrumbHome") },
                  { label: t("catalog.layout.groupOperations") },
                  { label: t("catalog.layout.navDashboard") },
                ]}
              />
            }
            title={t("catalog.layout.navDashboard")}
            subtitle={t("catalog.layout.pageSubtitle")}
            actions={
              <UiButton startIcon={<UiIcon name="plus" color="currentColor" />}>
                {t("catalog.common.createDoc")}
              </UiButton>
            }
          >
            <UiText variant="body">{t("catalog.longText")}</UiText>
          </UiPageContainer>
        </UiAppShell>
      </Box>
    </UiCard>
  );
}

export default function FoundationCatalogPage() {
  const t = useT();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [tab, setTab] = useState("all");
  const [page, setPage] = useState(3);
  const [pageSize, setPageSize] = useState(20);
  const [collapsed, setCollapsed] = useState(false);
  const { confirm, confirmDialog } = useUiConfirm();
  const [lastConfirm, setLastConfirm] = useState<string>(
    t("catalog.overlays.notAsked"),
  );
  const rows = useMemo(() => catalogRows(t), [t]);

  return (
    <Box
      data-testid="ui-foundation-root"
      sx={{ display: "grid", gap: 3, maxWidth: 1080 }}
    >
      <UiText variant="pageTitle">Foundation catalog (Vuexy baseline)</UiText>

      <UiCard title={t("catalog.tokens.sectionTitle")}>
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
          <UiText variant="pageTitle">
            {t("catalog.typography.pageTitle")}
          </UiText>
          <UiText variant="cardTitle">
            {t("catalog.typography.cardTitle")}
          </UiText>
          <UiText variant="body">
            {t("catalog.typography.body", { text: t("catalog.longText") })}
          </UiText>
          <UiText variant="secondary">
            {t("catalog.typography.secondary")}
          </UiText>
          <UiText variant="caption">{t("catalog.typography.caption")}</UiText>
        </Stack>
      </UiCard>

      <UiCard title="Button / IconButton">
        <Stack sx={{ gap: 2 }}>
          <Stack
            direction="row"
            sx={{ flexWrap: "wrap", gap: 1.5, alignItems: "center" }}
          >
            <UiButton data-testid="btn-filled">
              {t("catalog.buttons.filled")}
            </UiButton>
            <UiButton appearance="tonal">{t("catalog.buttons.tonal")}</UiButton>
            <UiButton appearance="outlined">
              {t("catalog.buttons.outlined")}
            </UiButton>
            <UiButton appearance="text">{t("catalog.buttons.text")}</UiButton>
            <UiButton color="error">{t("catalog.buttons.danger")}</UiButton>
            {/* WWHN-268: nút bị chặn phát hook data-ui-state="disabled". */}
            <UiButton disabled data-ui-state="disabled">
              {t("catalog.buttons.disabled")}
            </UiButton>
            <UiButton loading>{t("catalog.buttons.saving")}</UiButton>
            <UiIconButton
              aria-label={t("catalog.buttons.refresh")}
              data-testid="icon-btn"
            >
              <UiIcon name="refresh" />
            </UiIconButton>
          </Stack>
          <UiText variant="secondary">{t("catalog.buttons.motionNote")}</UiText>
        </Stack>
      </UiCard>

      <FormsSection />

      <UiCard title={t("catalog.badges.sectionTitle")}>
        <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1 }}>
          <UiStatusBadge
            tone="primary"
            label={t("catalog.badges.processing")}
            data-testid="badge-primary"
          />
          <UiStatusBadge tone="success" label={t("catalog.badges.approved")} />
          <UiStatusBadge tone="warning" label={t("catalog.badges.waiting")} />
          <UiStatusBadge tone="error" label={t("catalog.badges.rejected")} />
          <UiStatusBadge tone="info" label={t("catalog.badges.scanning")} />
          <UiStatusBadge tone="neutral" label={t("catalog.badges.draft")} />
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
            label={t("catalog.kpi.available")}
            value="1.284.560"
            icon="box"
            tone="primary"
            hint={t("catalog.kpi.availableHint")}
          />
          <UiKpiCard
            label={t("catalog.kpi.pendingDocs")}
            value="27"
            icon="time-quarter-past"
            tone="warning"
          />
          <UiKpiCard
            label={t("catalog.kpi.issuedToday")}
            value="312"
            icon="inbox-out"
            tone="success"
            data-testid="kpi-success"
          />
          <UiKpiCard
            label={t("catalog.kpi.errors")}
            value="3"
            icon="cross-circle"
            tone="error"
          />
        </Box>
      </UiCard>

      <UiCard title="Tabs / Pagination">
        <Stack sx={{ gap: 2 }}>
          <UiTabs
            aria-label={t("catalog.tabs.filterAria")}
            value={tab}
            onChange={setTab}
            items={[
              { key: "all", label: t("catalog.tabs.all") },
              { key: "draft", label: t("catalog.tabs.draft") },
              { key: "posted", label: t("catalog.common.posted") },
              {
                key: "locked",
                label: t("catalog.tabs.locked"),
                disabled: true,
              },
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

      <UiCard title={t("catalog.table.sectionTitle")} disablePadding>
        <Box sx={{ display: "grid", gap: 3, p: 3 }}>
          <ResponsiveDataTable<CatalogRow>
            columns={[
              {
                key: "code",
                header: t("catalog.table.colCode"),
                render: (r) => r.code,
                sortAccessor: (r) => r.code,
              },
              {
                key: "agency",
                header: t("catalog.table.colAgency"),
                render: (r) => r.agency,
              },
              {
                key: "qty",
                header: t("catalog.common.qty"),
                align: "right",
                render: (r) => r.qty.toLocaleString("vi-VN"),
                sortAccessor: (r) => r.qty,
              },
              {
                key: "status",
                header: t("catalog.common.status"),
                render: (r) => (
                  <UiStatusBadge
                    tone={STATUS_TONE[r.status]}
                    label={r.status}
                  />
                ),
              },
            ]}
            rows={rows}
            rowKey={(r) => r.id}
          />
          <ResponsiveDataTable<CatalogRow>
            columns={[
              {
                key: "code",
                header: t("catalog.table.colCode"),
                render: (r) => r.code,
              },
            ]}
            rows={[]}
            rowKey={(r) => r.id}
            emptyText={t("catalog.table.emptyText")}
          />
        </Box>
      </UiCard>

      <UiCard title="Descriptions / Timeline / Avatar / Alert">
        <Stack sx={{ gap: 3 }}>
          <UiDescriptions
            items={[
              {
                label: t("catalog.descriptions.adjustCode"),
                value: "REV-20260818-0001",
              },
              {
                label: t("catalog.common.status"),
                value: (
                  <UiStatusBadge
                    tone="success"
                    label={t("catalog.badges.approved")}
                  />
                ),
              },
              {
                label: t("catalog.descriptions.createdBy"),
                value: t("catalog.data.userLam"),
              },
              {
                label: t("catalog.common.recipient"),
                value: t("catalog.longText"),
                span: 3,
              },
              { label: t("catalog.descriptions.note"), value: EMPTY_TEXT },
            ]}
          />
          <UiTimeline
            items={[
              {
                title: t("catalog.common.createDoc"),
                time: "08:00 18/08/2026",
                tone: "primary",
              },
              {
                title: t("catalog.timeline.scanned"),
                description: t("catalog.timeline.scannedBy"),
                time: "08:41",
                tone: "info",
              },
              {
                title: t("catalog.timeline.printed"),
                time: "08:45",
                tone: "success",
              },
              {
                title: t("catalog.timeline.pendingIssue"),
                description: t("catalog.timeline.pendingIssueDesc"),
                time: EMPTY_TEXT,
                tone: "warning",
              },
            ]}
          />
          <Stack direction="row" sx={{ gap: 1.5, alignItems: "center" }}>
            <UiAvatar name={t("catalog.data.userLam")} size="lg" />
            <UiAvatar name={t("catalog.data.userAn")} />
            <UiAvatar name={t("catalog.data.warehouseShort")} size="sm" />
          </Stack>
          <Stack sx={{ gap: 1.5 }}>
            <UiAlert
              tone="success"
              title={t("catalog.common.posted")}
              data-testid="alert-success"
            >
              {t("catalog.alerts.successBody")}
            </UiAlert>
            <UiAlert tone="info">{t("catalog.alerts.infoBody")}</UiAlert>
            <UiAlert tone="warning" title={t("catalog.alerts.warningTitle")}>
              {t("catalog.longText")}
            </UiAlert>
            <UiAlert
              tone="error"
              title={t("catalog.alerts.errorTitle")}
              onClose={() => undefined}
              action={
                <UiButton appearance="text" color="error">
                  {t("common.retry")}
                </UiButton>
              }
            >
              {t("catalog.common.serverError")}
            </UiAlert>
          </Stack>
        </Stack>
      </UiCard>

      <UiCard title={t("catalog.overlays.sectionTitle")}>
        <Stack direction="row" sx={{ gap: 1.5, flexWrap: "wrap" }}>
          <UiButton
            data-testid="open-dialog"
            onClick={() => setDialogOpen(true)}
          >
            {t("catalog.overlays.openDialog")}
          </UiButton>
          <UiButton appearance="outlined" onClick={() => setDrawerOpen(true)}>
            {t("catalog.overlays.openDrawer")}
          </UiButton>
          <UiButton
            color="error"
            appearance="tonal"
            data-testid="open-confirm"
            onClick={() => setConfirmOpen(true)}
          >
            {t("catalog.overlays.openConfirm")}
          </UiButton>
          <UiButton
            appearance="outlined"
            onClick={() => {
              void confirm({
                title: t("catalog.overlays.confirmTitle"),
                content: t("catalog.overlays.confirmContent"),
                confirmText: t("catalog.overlays.agree"),
              }).then((ok) => {
                setLastConfirm(
                  ok
                    ? t("catalog.overlays.agree")
                    : t("catalog.overlays.cancel"),
                );
                // WWHN-268: xác nhận thành công sinh toast success thật —
                // demo giữ nguyên hành vi chuẩn của flow confirm nghiệp vụ.
                if (ok) toast.success(t("catalog.overlays.confirmedToast"));
              });
            }}
          >
            useUiConfirm()
          </UiButton>
          <UiText variant="secondary">
            {t("catalog.overlays.lastConfirmLabel")}{" "}
            {/* WWHN-268: kết quả xác nhận thành công phát hook "success". */}
            <Box
              component="span"
              data-ui-state={
                lastConfirm === t("catalog.overlays.agree")
                  ? "success"
                  : undefined
              }
            >
              {lastConfirm}
            </Box>
          </UiText>
        </Stack>
        <UiDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          title={t("catalog.overlays.dialogTitle")}
          actions={
            <>
              <UiButton appearance="text" onClick={() => setDialogOpen(false)}>
                {t("catalog.overlays.cancel")}
              </UiButton>
              <UiButton onClick={() => setDialogOpen(false)}>
                {t("catalog.overlays.confirm")}
              </UiButton>
            </>
          }
        >
          <UiText variant="body">
            {t("catalog.overlays.dialogBody", {
              text: t("catalog.longText"),
            })}
          </UiText>
        </UiDialog>
        <UiDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          title={t("catalog.overlays.drawerTitle")}
        >
          <UiText variant="body">{t("catalog.longText")}</UiText>
        </UiDrawer>
        <UiConfirmDialog
          open={confirmOpen}
          tone="danger"
          title={t("catalog.overlays.deleteDraftTitle")}
          confirmText={t("catalog.overlays.delete")}
          onConfirm={() => setConfirmOpen(false)}
          onClose={() => setConfirmOpen(false)}
        >
          {t("catalog.overlays.deleteDraftBody")}
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
            description={t("catalog.states.emptyDesc")}
            action={
              <UiButton appearance="outlined">
                {t("catalog.states.emptyAction")}
              </UiButton>
            }
          />
          <UiStateSurface
            kind="error"
            description={t("catalog.common.serverError")}
            action={<UiButton>{t("common.retry")}</UiButton>}
          />
          <UiStateSurface
            kind="no-permission"
            description={t("catalog.states.noPermission")}
          />
        </Box>
      </UiCard>

      <UiCard title={t("catalog.formField.sectionTitle")}>
        <Box sx={{ maxWidth: 420 }}>
          <UiFormField
            label="FormField shell"
            required
            helperText={t("catalog.formField.helper")}
          >
            <UiTextField placeholder={t("catalog.formField.placeholder")} />
          </UiFormField>
        </Box>
      </UiCard>
    </Box>
  );
}
