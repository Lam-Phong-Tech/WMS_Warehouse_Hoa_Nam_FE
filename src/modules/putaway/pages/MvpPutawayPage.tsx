import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Box,
  Grid,
  Stack,
  UiAlert,
  UiCard,
  UiDialog,
  UiPagination,
  UiSelect,
  UiStatusBadge,
  UiTabs,
  UiTabPanel,
  UiTextField,
  FILTER_WIDTH,
} from "@/shared/ui";
import { guardBackdropClose } from "@/shared/utils/dialogGuard";
import {
  ResponsiveDataTable,
  type ResponsiveTableColumn,
} from "@/shared/components/data-display/ResponsiveDataTable";
import {
  useClientSort,
  type SortAccessor,
} from "@/shared/components/data-display/useClientSort";
import { SearchInput } from "@/shared/components/data-display/SearchInput";
import { SkuLink } from "@/shared/components/data-display/SkuLink";
import { toast } from "sonner";
import { HistoryOutlined, InboxOutlined } from "@/shared/components/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invalidateStockDerived } from "@/shared/cache/invalidation";
import { useSearchParams, Link as RouterLink } from "react-router-dom";
import { ROUTES } from "@/shared/constants/routes";
import {
  getApiErrorMessage,
  getErrorRequestId,
  normalizeError,
} from "@/shared/api/api-error";
import { ActionDropdown } from "@/shared/components/feedback/ActionDropdown";
import { CameraScanModal } from "@/shared/components/forms/CameraScanModal";
import { ScanInput } from "@/shared/components/forms/ScanInput";
import { TraySelectionGrid } from "@/modules/putaway/components/TraySelectionGrid";
import {
  hasAnyWmsPermission,
  WMS_PERMISSION_CATALOG as P,
} from "@/shared/constants/wms-permissions";
import { useAuthStore } from "@/shared/store/auth.store";
import { formatDateTime } from "@/shared/utils/format-date";
import { EMPTY_TEXT } from "@/shared/constants/display";
import { useT, type TranslateFn } from "@/shared/i18n/useT";
import {
  cancelPutawayTask,
  confirmPutawayTask,
  createPutawayTask,
  fetchPutawayHistory,
  fetchPutawayTasks,
  fetchPutawayTrays,
  resolvePutawayTrayByScanCode,
  type PutawayHistory,
  type PutawayTask,
} from "@/modules/putaway/services/putawayService";
import { ActionButton, ActionIconButton } from "@/shared/components/actions";
import { rowIndexOf } from "@/shared/components/data-display/row-index";

type PutawayFormValues = {
  to_tray_id: string;
  location_hint?: string;
  note?: string;
};

const PAGE_SIZE_OPTIONS = [10, 20, 50];
const SEARCH_DEBOUNCE_MS = 250;

const putawayKeys = {
  all: ["putaway"] as const,
  tasks: (search: string) => ["putaway", "tasks", search] as const,
  history: ["putaway", "history"] as const,
  trays: ["putaway", "trays"] as const,
};

function boxStatusLabel(t: TranslateFn, status: string): string {
  if (status === "RECEIVED_PENDING_PUTAWAY") {
    return t("putaway.page.boxStatusPending");
  }
  if (status === "STORED") return t("putaway.page.boxStatusStored");
  return t("putaway.page.boxStatusUnknown");
}

function boxStatusChipColor(status: string): "success" | "warning" {
  return status === "STORED" ? "success" : "warning";
}

/** Cặp nhãn/giá trị trong 2 Dialog xếp khay (thay antd Descriptions.Item). */
function PutawayDetailField({
  label,
  value,
  size = { xs: 12, sm: 6 },
}: {
  label: string;
  value: ReactNode;
  size?: { xs?: number; sm?: number; md?: number };
}) {
  return (
    <Grid size={size}>
      <Box sx={{ typography: "caption", color: "text.secondary" }}>{label}</Box>
      <Box sx={{ typography: "body2" }}>{value}</Box>
    </Grid>
  );
}

function ApiErrorAlert({
  error,
  fallback,
}: {
  error: unknown;
  fallback: string;
}) {
  const t = useT();
  const normalized = normalizeError(error);
  const requestId = getErrorRequestId(error);
  return (
    <UiAlert
      tone={normalized.status === 403 ? "warning" : "error"}
      title={
        normalized.status === 403
          ? t("putaway.page.forbidden")
          : getApiErrorMessage(error, fallback)
      }
    >
      {[
        normalized.status
          ? t("putaway.page.responseCode", { status: normalized.status })
          : undefined,
        normalized.code
          ? t("putaway.page.errorCode", { code: normalized.code })
          : undefined,
        requestId ? t("putaway.page.requestId", { requestId }) : undefined,
      ]
        .filter(Boolean)
        .join(" | ")}
    </UiAlert>
  );
}

/** Sort client-side toàn bộ danh sách (không chỉ trang hiện tại) — giữ đúng
 * hành vi sorter của antd Table trước migrate (Part 4 Vuexy sync). */
const TASK_SORT_ACCESSORS: Record<string, SortAccessor<PutawayTask>> = {
  box_code: (row) => row.box_code,
  sku_code: (row) => row.sku_code,
  quantity: (row) => row.quantity,
  status: (row) => row.status,
  draft: (row) => row.to_tray_code || "",
};

const HISTORY_SORT_ACCESSORS: Record<string, SortAccessor<PutawayHistory>> = {
  created_at: (row) => new Date(row.created_at),
  box_code: (row) => row.box_code,
  old_tray_code: (row) => row.old_tray_code || "",
  new_tray_code: (row) => row.new_tray_code || "",
  location_hint: (row) => row.location_hint || "",
  actor_name: (row) => row.actor_name || "",
};

export default function MvpPutawayPage() {
  const t = useT();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const permissionCodes = useAuthStore((state) => state.permissionCodes);
  const isSuperAdmin = useAuthStore((state) => state.isSuperAdmin);
  // SRS §3: Putaway create/confirm/cancel dùng permission key `putaway.manage`
  // (NV kho = A*). BE nhận `putaway.manage|container.manage` nên FE gate đúng bộ đó;
  // gate chỉ theo container.manage sẽ ẩn nút với chính nhân viên kho được phân quyền.
  const canManage = hasAnyWmsPermission(
    permissionCodes,
    [P.PUTAWAY_MANAGE, P.CONTAINER_MANAGE],
    isSuperAdmin,
  );

  const [activeTab, setActiveTab] = useState("pending");
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  // Lịch sử xếp khay là bảng tra cứu/đối soát — lọc phía FE trên dữ liệu đã tải
  // (không gọi thêm API) để đáp ứng tiêu chí filter cho bảng tra cứu.
  const [historySearchDraft, setHistorySearchDraft] = useState("");
  const [pendingPageSize, setPendingPageSize] = useState(10);
  const [historyPageSize, setHistoryPageSize] = useState(10);
  const [pendingPage, setPendingPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const [selected, setSelected] = useState<PutawayTask | null>(null);
  const [detailRow, setDetailRow] = useState<PutawayTask | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [trayScanValue, setTrayScanValue] = useState("");
  const [trayScanError, setTrayScanError] = useState<string | null>(null);
  const [putawayForm, setPutawayForm] = useState<PutawayFormValues>({
    to_tray_id: "",
    location_hint: "",
    note: "",
  });
  const [confirmPrompt, setConfirmPrompt] = useState<{
    title: string;
    content: string;
    okText: string;
    danger?: boolean;
    onOk: () => Promise<void>;
  } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const tasksQuery = useQuery({
    queryKey: putawayKeys.tasks(search),
    queryFn: () => fetchPutawayTasks(search ? { search } : {}),
  });
  const historyQuery = useQuery({
    queryKey: putawayKeys.history,
    queryFn: () => fetchPutawayHistory(),
  });
  const traysQuery = useQuery({
    queryKey: putawayKeys.trays,
    queryFn: fetchPutawayTrays,
  });

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: putawayKeys.all });
    // Cất hàng đổi vị trí/tồn theo vị trí -> báo cáo tồn và dashboard đọc số cũ
    // nếu chỉ làm mới cache của riêng màn cất hàng.
    await invalidateStockDerived(queryClient);
  };

  const createMutation = useMutation({
    mutationFn: createPutawayTask,
    onSuccess: invalidate,
  });
  const confirmMutation = useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) =>
      confirmPutawayTask(id, version),
    onSuccess: invalidate,
  });
  const cancelMutation = useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) =>
      cancelPutawayTask(id, version),
    onSuccess: invalidate,
  });

  const tasks = tasksQuery.data ?? [];
  const history = historyQuery.data ?? [];
  const trays = traysQuery.data ?? [];
  const loading =
    tasksQuery.isLoading || historyQuery.isLoading || traysQuery.isLoading;

  const filteredHistory = useMemo(() => {
    const keyword = historySearchDraft.trim().toLowerCase();
    if (!keyword) return history;
    return history.filter((row) =>
      [
        row.box_code,
        row.old_tray_code,
        row.new_tray_code,
        row.location_hint,
        row.actor_name,
      ].some((field) => (field ?? "").toLowerCase().includes(keyword)),
    );
  }, [history, historySearchDraft]);

  // Sort toàn danh sách rồi mới cắt trang (đúng hành vi antd Table cũ);
  // clamp trang khi dữ liệu co lại để không rơi vào trang rỗng.
  const taskSort = useClientSort(tasks, TASK_SORT_ACCESSORS);
  const historySort = useClientSort(filteredHistory, HISTORY_SORT_ACCESSORS);
  const pendingPageCount = Math.max(
    1,
    Math.ceil(tasks.length / pendingPageSize),
  );
  const safePendingPage = Math.min(pendingPage, pendingPageCount);
  const pagedTasks = taskSort.sortedRows.slice(
    (safePendingPage - 1) * pendingPageSize,
    safePendingPage * pendingPageSize,
  );
  const historyPageCount = Math.max(
    1,
    Math.ceil(filteredHistory.length / historyPageSize),
  );
  const safeHistoryPage = Math.min(historyPage, historyPageCount);
  const pagedHistory = historySort.sortedRows.slice(
    (safeHistoryPage - 1) * historyPageSize,
    safeHistoryPage * historyPageSize,
  );

  const resetTarget = () => {
    setTrayScanValue("");
    setTrayScanError(null);
    setCameraOpen(false);
  };

  const closePutaway = () => {
    setSelected(null);
    setPutawayForm({ to_tray_id: "", location_hint: "", note: "" });
    resetTarget();
  };

  const openPutaway = (row: PutawayTask) => {
    if (row.status !== "RECEIVED_PENDING_PUTAWAY") {
      toast.error(t("putaway.page.onlyPendingBox"));
      return;
    }
    setSelected(row);
    resetTarget();
    setPutawayForm({
      to_tray_id: row.to_tray_id ?? "",
      location_hint: row.location_hint ?? "",
      note: "",
    });
  };

  useEffect(() => {
    if (searchParams.get("screen") !== "PTW-01" || tasks.length === 0) {
      return;
    }
    const requestedBox = searchParams.get("box");
    const nextSelected =
      tasks.find(
        (task) =>
          task.box_code === requestedBox ||
          task.box_container_id === requestedBox,
      ) ?? tasks[0];
    if (nextSelected) openPutaway(nextSelected);

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("screen", "PTW-00");
    nextParams.delete("box");
    setSearchParams(nextParams, { replace: true });
    // openPutaway intentionally uses only current task/form state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, setSearchParams, tasks]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchDraft.trim());
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [searchDraft]);

  const applyTrayScan = (rawCode: string) => {
    try {
      const tray = resolvePutawayTrayByScanCode(trays, rawCode);
      setPutawayForm((current) => ({
        ...current,
        to_tray_id: tray.container_id,
      }));
      setTrayScanError(null);
      toast.success(
        t("putaway.page.trayAccepted", { code: tray.container_code }),
      );
    } catch (error) {
      setPutawayForm((current) => ({ ...current, to_tray_id: "" }));
      // Ưu tiên thông điệp thân thiện (BE / message nghiệp vụ); lỗi JS thô
      // không bao giờ lộ ra UI.
      setTrayScanError(
        getApiErrorMessage(error, t("putaway.page.trayInvalid")),
      );
    }
  };

  const createDraft = async () => {
    if (!selected || !canManage) return;
    if (selected.status !== "RECEIVED_PENDING_PUTAWAY") {
      toast.error(t("putaway.page.boxNotPending"));
      return;
    }
    if (!putawayForm.to_tray_id) {
      setTrayScanError(t("putaway.page.trayRequired"));
      return;
    }

    try {
      const targetTray = trays.find(
        (tray) => tray.container_id === putawayForm.to_tray_id,
      );
      if (!targetTray) {
        setPutawayForm((current) => ({ ...current, to_tray_id: "" }));
        toast.error(t("putaway.page.trayUnavailable"));
        return;
      }

      const result = await createMutation.mutateAsync({
        box_container_id: selected.box_container_id,
        to_tray_id: targetTray.container_id,
        location_hint: putawayForm.location_hint?.trim() || null,
        note: putawayForm.note?.trim() || null,
      });
      if (result.stock_effect !== "NONE" || result.movement_created !== false) {
        throw new Error(t("putaway.page.invariantCreate"));
      }
      toast.success(t("putaway.page.draftCreated"));
      closePutaway();
    } catch (error) {
      toast.error(getApiErrorMessage(error, t("putaway.page.createFailed")));
    }
  };

  const confirm = async (row: PutawayTask) => {
    if (!row.draft_id || !row.draft_version || !canManage) return;
    try {
      const result = await confirmMutation.mutateAsync({
        id: row.draft_id,
        version: row.draft_version,
      });
      if (result.stock_effect !== "NONE" || result.movement_created !== false) {
        throw new Error(t("putaway.page.invariantConfirm"));
      }
      toast.success(t("putaway.page.confirmSuccess"));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t("putaway.page.confirmFailed")));
      throw error;
    }
  };

  const cancel = async (row: PutawayTask) => {
    if (!row.draft_id || !row.draft_version || !canManage) return;
    try {
      const result = await cancelMutation.mutateAsync({
        id: row.draft_id,
        version: row.draft_version,
      });
      if (result.stock_effect !== "NONE" || result.movement_created !== false) {
        throw new Error(t("putaway.page.invariantCancel"));
      }
      toast.success(t("putaway.page.cancelSuccess"));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t("putaway.page.cancelFailed")));
      throw error;
    }
  };

  const confirmWithPrompt = (row: PutawayTask) => {
    setConfirmPrompt({
      title: t("putaway.page.confirmPromptTitle"),
      content: t("putaway.page.confirmPromptContent"),
      okText: t("putaway.page.confirmOk"),
      onOk: () => confirm(row),
    });
  };

  const cancelWithPrompt = (row: PutawayTask) => {
    setConfirmPrompt({
      title: t("putaway.page.cancelPromptTitle"),
      content: t("putaway.page.cancelPromptContent"),
      okText: t("putaway.page.cancelOk"),
      danger: true,
      onOk: () => cancel(row),
    });
  };

  const runConfirmPrompt = async () => {
    if (!confirmPrompt) return;
    setConfirmBusy(true);
    try {
      await confirmPrompt.onOk();
      setConfirmPrompt(null);
    } catch {
      // Lỗi đã toast trong confirm()/cancel(); giữ dialog mở để thử lại.
    } finally {
      setConfirmBusy(false);
    }
  };

  const taskColumns: ResponsiveTableColumn<PutawayTask>[] = [
    {
      key: "stt",
      header: "STT",
      align: "center",
      width: 56,
      hideOnMobile: true,
      // Vị trí trong danh sách GỐC (chưa sắp xếp) — số đi theo dòng.
      render: (row) => rowIndexOf(tasks, row) + 1,
    },
    {
      key: "box_code",
      header: t("putaway.page.colBox"),
      width: 170,
      sortable: true,
      render: (row) => <strong>{row.box_code}</strong>,
    },
    {
      key: "sku_code",
      header: t("putaway.page.colSku"),
      width: 170,
      sortable: true,
      render: (row) => <SkuLink code={row.sku_code} />,
    },
    {
      key: "quantity",
      header: t("putaway.page.colQuantity"),
      width: 100,
      align: "right",
      sortable: true,
      sortType: "value",
      render: (row) => row.quantity,
    },
    {
      key: "status",
      header: t("putaway.page.colBoxStatus"),
      width: 210,
      sortable: true,
      render: (row) => (
        <UiStatusBadge
          tone={row.status === "STORED" ? "success" : "warning"}
          label={boxStatusLabel(t, row.status)}
        />
      ),
    },
    {
      key: "draft",
      header: t("putaway.page.colDraft"),
      width: 180,
      sortable: true,
      render: (row) =>
        row.draft_id ? (
          <UiStatusBadge
            tone="info"
            label={row.to_tray_code || t("putaway.page.draftSelectedTray")}
          />
        ) : (
          <UiStatusBadge
            tone="neutral"
            label={t("putaway.page.draftNotCreated")}
          />
        ),
    },
    {
      key: "actions",
      // Cột nút: không bọc lớp cắt chữ, tránh xén mất nút.
      truncate: 0,
      header: t("putaway.page.colActions"),
      width: 260,
      render: (row) => {
        const canOpenPutaway =
          !row.draft_id && row.status === "RECEIVED_PENDING_PUTAWAY";
        const dropdownItems = row.draft_id
          ? [
              {
                key: "confirm",
                kind: "confirm" as const,
                label: t("putaway.page.actionConfirm"),
                disabled: !canManage,
                onClick: () => confirmWithPrompt(row),
              },
              {
                key: "cancel",
                kind: "cancel" as const,
                label: t("putaway.page.actionCancelDraft"),
                danger: true,
                disabled: !canManage,
                onClick: () => cancelWithPrompt(row),
              },
            ]
          : [];

        return (
          <Stack
            direction="row"
            sx={{ gap: 0.25, alignItems: "center", flexWrap: "wrap" }}
          >
            <ActionButton kind="view" onClick={() => setDetailRow(row)}>
              {t("putaway.page.actionView")}
            </ActionButton>
            {/* PTW-GRID: nút chính mở lưới chọn khay — trước đây ẩn trong dropdown
                "..." khiến người dùng không thấy giao diện chọn khay. */}
            {canOpenPutaway ? (
              <ActionButton
                kind="swap"
                disabled={!canManage}
                onClick={() => openPutaway(row)}
              >
                {t("putaway.page.actionPutaway")}
              </ActionButton>
            ) : null}
            {dropdownItems.length > 0 ? (
              <ActionDropdown
                tooltip={t("putaway.page.actionsTooltip")}
                items={dropdownItems}
              />
            ) : null}
          </Stack>
        );
      },
    },
  ];

  const historyColumns: ResponsiveTableColumn<PutawayHistory>[] = [
    {
      key: "stt",
      header: "STT",
      align: "center",
      width: 56,
      hideOnMobile: true,
      render: (row) => rowIndexOf(filteredHistory, row) + 1,
    },
    {
      key: "created_at",
      header: t("putaway.page.colTime"),
      width: 190,
      sortable: true,
      sortType: "value",
      render: (row) => formatDateTime(row.created_at),
    },
    {
      key: "box_code",
      header: t("putaway.page.colBox"),
      width: 170,
      sortable: true,
      render: (row) => row.box_code,
    },
    {
      key: "old_tray_code",
      header: t("putaway.page.colOldTray"),
      width: 150,
      sortable: true,
      render: (row) => row.old_tray_code || EMPTY_TEXT,
    },
    {
      key: "new_tray_code",
      header: t("putaway.page.colNewTray"),
      width: 150,
      sortable: true,
      render: (row) => row.new_tray_code || EMPTY_TEXT,
    },
    {
      key: "location_hint",
      header: t("putaway.page.colLocation"),
      width: 180,
      sortable: true,
      render: (row) => row.location_hint || EMPTY_TEXT,
    },
    {
      key: "actor_name",
      header: t("putaway.page.colActor"),
      width: 180,
      sortable: true,
      render: (row) => row.actor_name || EMPTY_TEXT,
    },
    {
      key: "stock_effect",
      header: t("putaway.page.colStockEffect"),
      width: 140,
      render: () => (
        <UiStatusBadge
          tone="success"
          label={t("putaway.page.stockUnchanged")}
        />
      ),
    },
  ];

  const firstError = tasksQuery.error ?? historyQuery.error ?? traysQuery.error;

  return (
    <div className="putaway-page master-data-page">
      {/* Tiêu đề màn do header chung của shell dựng (AppPageHeader); hàng này
          chỉ còn giữ hành động. Ô rỗng để nút vẫn nằm bên phải. */}
      <div className="page-heading">
        <div />
        {/* Mục 15: lối vào trực tiếp màn XEM tổng quan khay (read-only), tách
            khỏi thao tác chọn khay trong dialog tạo lệnh. */}
        <RouterLink
          to={ROUTES.PUTAWAY_TRAYS}
          style={{ textDecoration: "none" }}
        >
          <ActionButton
            kind="view"
            label={t("putaway.page.trayOverviewLink")}
          />
        </RouterLink>
      </div>

      <UiCard className="master-data-panel">
        <div className="master-data-contract-strip">
          <UiStatusBadge tone="info" label={t("putaway.page.stripTasks")} />
          <UiStatusBadge tone="info" label={t("putaway.page.stripConfirm")} />
          <UiStatusBadge
            tone="warning"
            label={t("putaway.page.stripPermission")}
          />
          <UiStatusBadge
            tone="success"
            label={t("putaway.page.stripStockNeutral")}
          />
        </div>

        <Box className="master-data-state-alert">
          <UiAlert tone="info" title={t("putaway.page.introTitle")}>
            {t("putaway.page.introBody")}
          </UiAlert>
        </Box>

        {firstError ? (
          <ApiErrorAlert
            error={firstError}
            fallback={t("putaway.page.loadFailed")}
          />
        ) : null}

        <>
          <Box sx={{ mb: 2 }}>
            <UiTabs
              value={activeTab}
              onChange={setActiveTab}
              items={[
                {
                  key: "pending",
                  label: (
                    <Stack
                      direction="row"
                      spacing={0.75}
                      sx={{ alignItems: "center" }}
                    >
                      <InboxOutlined style={{ fontSize: 15 }} />
                      <span>
                        {t("putaway.page.tabPending", { count: tasks.length })}
                      </span>
                    </Stack>
                  ),
                },
                {
                  key: "history",
                  label: (
                    <Stack
                      direction="row"
                      spacing={0.75}
                      sx={{ alignItems: "center" }}
                    >
                      <HistoryOutlined style={{ fontSize: 15 }} />
                      <span>{t("putaway.page.tabHistory")}</span>
                    </Stack>
                  ),
                },
              ]}
            />
          </Box>

          {/* Filter (tìm kiếm) và chọn số dòng/trang đặt cùng một hàng, ngay trên
              bảng — tránh để page-size lệch chỗ khỏi thanh filter/trạng thái. */}
          <Grid
            container
            spacing={1.5}
            className="filter-row"
            sx={{
              alignItems: "center",
              justifyContent: "space-between",
              mb: 1.5,
            }}
          >
            <Grid size={{ xs: 12, md: 4 }}>
              {activeTab === "pending" ? (
                <SearchInput
                  value={searchDraft}
                  placeholder={t("putaway.page.searchPendingPlaceholder")}
                  slotProps={{
                    htmlInput: {
                      "aria-label": t("putaway.page.searchPendingAria"),
                    },
                  }}
                  width="100%"
                  onChange={setSearchDraft}
                />
              ) : (
                <SearchInput
                  value={historySearchDraft}
                  placeholder={t("putaway.page.searchHistoryPlaceholder")}
                  slotProps={{
                    htmlInput: {
                      "aria-label": t("putaway.page.searchHistoryAria"),
                    },
                  }}
                  width="100%"
                  onChange={setHistorySearchDraft}
                />
              )}
            </Grid>
            <Grid>
              <UiSelect
                value={
                  activeTab === "pending" ? pendingPageSize : historyPageSize
                }
                aria-label={t("putaway.page.pageSizeAria")}
                options={PAGE_SIZE_OPTIONS.map((size) => ({
                  value: size,
                  label: t("putaway.page.pageSizeOption", { size }),
                }))}
                onChange={(value) => {
                  if (activeTab === "pending") {
                    setPendingPageSize(Number(value));
                  } else {
                    setHistoryPageSize(Number(value));
                  }
                }}
                minWidth={FILTER_WIDTH.pageSize}
              />
            </Grid>
          </Grid>
        </>

        {activeTab === "pending" ? (
          <UiTabPanel value={activeTab}>
            <ResponsiveDataTable<PutawayTask>
              columns={taskColumns}
              rows={pagedTasks}
              rowKey={(row) => row.id}
              loading={loading}
              sortState={taskSort.sortState}
              onSortChange={taskSort.requestSort}
              emptyText={t("putaway.page.emptyPending")}
            />
            <Stack
              direction="row"
              sx={{
                mt: 1.5,
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 1,
              }}
            >
              <Box sx={{ typography: "body2", color: "text.secondary" }}>
                {t("putaway.page.totalBoxes", { count: tasks.length })}
              </Box>
              <UiPagination
                page={safePendingPage}
                pageSize={pendingPageSize}
                total={tasks.length}
                onPageChange={setPendingPage}
                showTotal={false}
              />
            </Stack>
          </UiTabPanel>
        ) : (
          <UiTabPanel value={activeTab}>
            <ResponsiveDataTable<PutawayHistory>
              columns={historyColumns}
              rows={pagedHistory}
              rowKey={(row) => row.id}
              loading={loading}
              sortState={historySort.sortState}
              onSortChange={historySort.requestSort}
              emptyText={
                historySearchDraft.trim()
                  ? t("putaway.page.emptyHistoryFiltered")
                  : t("putaway.page.emptyHistory")
              }
            />
            <Stack
              direction="row"
              sx={{
                mt: 1.5,
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 1,
              }}
            >
              <Box sx={{ typography: "body2", color: "text.secondary" }}>
                {t("putaway.page.totalRecords", {
                  count: filteredHistory.length,
                })}
              </Box>
              <UiPagination
                page={safeHistoryPage}
                pageSize={historyPageSize}
                total={filteredHistory.length}
                onPageChange={setHistoryPage}
                showTotal={false}
              />
            </Stack>
          </UiTabPanel>
        )}
      </UiCard>

      <>
        <UiDialog
          open={Boolean(selected)}
          onClose={guardBackdropClose(closePutaway)}
          maxWidth="md"
          fullWidth
          title={
            <Stack
              direction="row"
              sx={{
                alignItems: "center",
                justifyContent: "space-between",
                gap: 1,
              }}
            >
              <span>
                {selected
                  ? t("putaway.page.dialogTitleWithBox", {
                      code: selected.box_code,
                    })
                  : t("putaway.page.dialogTitle")}
              </span>
              <ActionIconButton
                kind="close"
                label={t("common.close")}
                onClick={closePutaway}
              />
            </Stack>
          }
          actions={
            <>
              <ActionButton kind="close" onClick={closePutaway}>
                {t("common.close")}
              </ActionButton>
              <ActionButton
                kind="create"
                onClick={() => void createDraft()}
                disabled={
                  !canManage ||
                  selected?.status !== "RECEIVED_PENDING_PUTAWAY" ||
                  !putawayForm.to_tray_id ||
                  createMutation.isPending
                }
              >
                {createMutation.isPending
                  ? t("putaway.page.creating")
                  : t("putaway.page.createDraftButton")}
              </ActionButton>
            </>
          }
        >
          <>
            {selected ? (
              <Box
                sx={{
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 2,
                  p: 1.5,
                  mb: 2,
                }}
              >
                <Grid container spacing={2} sx={{ alignItems: "flex-start" }}>
                  <PutawayDetailField
                    label={t("putaway.page.colBox")}
                    value={selected.box_code}
                    size={{ xs: 6, sm: 3 }}
                  />
                  <PutawayDetailField
                    label={t("putaway.page.colSku")}
                    value={<SkuLink code={selected.sku_code} />}
                    size={{ xs: 6, sm: 3 }}
                  />
                  <PutawayDetailField
                    label={t("putaway.page.colQuantity")}
                    value={selected.quantity}
                    size={{ xs: 6, sm: 3 }}
                  />
                  <PutawayDetailField
                    label={t("putaway.page.fieldReceipt")}
                    value={selected.receipt_code || EMPTY_TEXT}
                    size={{ xs: 6, sm: 3 }}
                  />
                  <Grid size={{ xs: 12, sm: 3 }}>
                    <Box
                      sx={{ typography: "caption", color: "text.secondary" }}
                    >
                      {t("putaway.page.fieldStatus")}
                    </Box>
                    <UiStatusBadge
                      label={boxStatusLabel(t, selected.status)}
                      tone={boxStatusChipColor(selected.status)}
                      sx={{ mt: 0.25 }}
                    />
                  </Grid>
                </Grid>
              </Box>
            ) : null}

            <Box sx={{ mb: 2 }}>
              <UiAlert tone="warning" title={t("putaway.page.draftAlertTitle")}>
                {t("putaway.page.draftAlertBody")}
              </UiAlert>
            </Box>

            <Box sx={{ typography: "subtitle2", fontWeight: 700, mb: 1 }}>
              {t("putaway.page.chooseTrayTitle")}
            </Box>
            <Stack spacing={1.5} sx={{ mb: 2 }}>
              <Box>
                <Box sx={{ typography: "body2", fontWeight: 600, mb: 1 }}>
                  {t("putaway.page.scanTrayLabel")}
                </Box>
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ alignItems: "flex-start" }}
                >
                  <Box sx={{ flex: 1 }}>
                    <ScanInput
                      value={trayScanValue}
                      placeholder={t("putaway.page.scanTrayPlaceholder")}
                      error={trayScanError}
                      disabled={!canManage || traysQuery.isLoading}
                      onChange={(value) => {
                        setTrayScanValue(value);
                        if (trayScanError) setTrayScanError(null);
                      }}
                      onScan={applyTrayScan}
                    />
                  </Box>
                </Stack>
                <Box
                  sx={{
                    typography: "caption",
                    color: "text.secondary",
                    mt: 0.5,
                  }}
                >
                  {t("putaway.page.scanTrayHint")}
                </Box>
              </Box>

              <Box>
                <Box sx={{ typography: "body2", fontWeight: 600, mb: 1 }}>
                  {t("putaway.page.orPickOnGrid")}
                </Box>
                <TraySelectionGrid
                  trays={trays}
                  selectedTrayId={putawayForm.to_tray_id}
                  pendingQuantity={selected?.quantity}
                  onSelect={(tray) => {
                    setPutawayForm((current) => ({
                      ...current,
                      to_tray_id: tray.container_id,
                    }));
                    setTrayScanError(null);
                  }}
                  loading={traysQuery.isLoading}
                  disabled={!canManage}
                  onRefresh={() => void traysQuery.refetch()}
                />
              </Box>
            </Stack>

            <Stack spacing={2}>
              <UiTextField
                label={t("putaway.page.locationHintLabel")}
                fullWidth
                value={putawayForm.location_hint ?? ""}
                onChange={(event) =>
                  setPutawayForm((current) => ({
                    ...current,
                    location_hint: event.target.value,
                  }))
                }
                disabled={!canManage}
                slotProps={{ htmlInput: { maxLength: 255 } }}
                placeholder={t("putaway.page.locationHintPlaceholder")}
              />
              <UiTextField
                label={t("putaway.page.noteLabel")}
                fullWidth
                multiline
                minRows={3}
                value={putawayForm.note ?? ""}
                onChange={(event) =>
                  setPutawayForm((current) => ({
                    ...current,
                    note: event.target.value,
                  }))
                }
                disabled={!canManage}
                helperText={`${(putawayForm.note ?? "").length}/2000`}
                slotProps={{ htmlInput: { maxLength: 2000 } }}
              />
            </Stack>
          </>
        </UiDialog>

        <UiDialog
          open={Boolean(detailRow)}
          onClose={() => setDetailRow(null)}
          maxWidth="sm"
          fullWidth
          title={
            <Stack
              direction="row"
              sx={{
                alignItems: "center",
                justifyContent: "space-between",
                gap: 1,
              }}
            >
              <span>
                {detailRow
                  ? t("putaway.page.detailTitleWithBox", {
                      code: detailRow.box_code,
                    })
                  : t("putaway.page.detailTitle")}
              </span>
              <ActionIconButton
                kind="close"
                label={t("common.close")}
                onClick={() => setDetailRow(null)}
              />
            </Stack>
          }
          actions={
            <ActionButton kind="close" onClick={() => setDetailRow(null)}>
              {t("common.close")}
            </ActionButton>
          }
        >
          {detailRow ? (
            <Grid container spacing={2}>
              <PutawayDetailField
                label={t("putaway.page.colBox")}
                value={detailRow.box_code}
              />
              <PutawayDetailField
                label={t("putaway.page.colSku")}
                value={
                  <>
                    <SkuLink code={detailRow.sku_code} /> · {detailRow.sku_name}
                  </>
                }
              />
              <PutawayDetailField
                label={t("putaway.page.colQuantity")}
                value={detailRow.quantity}
              />
              <PutawayDetailField
                label={t("putaway.page.fieldReceipt")}
                value={detailRow.receipt_code || EMPTY_TEXT}
              />
              <PutawayDetailField
                label={t("putaway.page.fieldPlannedTray")}
                value={detailRow.to_tray_code || t("putaway.page.notChosen")}
              />
              <PutawayDetailField
                label={t("putaway.page.colLocation")}
                value={detailRow.location_hint || EMPTY_TEXT}
              />
              <PutawayDetailField
                label={t("putaway.page.colBoxStatus")}
                value={
                  <UiStatusBadge
                    label={boxStatusLabel(t, detailRow.status)}
                    tone={boxStatusChipColor(detailRow.status)}
                  />
                }
              />
              <PutawayDetailField
                label={t("putaway.page.colDraft")}
                value={
                  detailRow.draft_id
                    ? t("putaway.page.draftCreatedShort")
                    : t("putaway.page.draftNotCreated")
                }
              />
              <PutawayDetailField
                label={t("putaway.page.fieldStockEffect")}
                value={
                  <UiStatusBadge
                    tone="success"
                    label={t("putaway.page.stockUnchanged")}
                  />
                }
              />
            </Grid>
          ) : null}
        </UiDialog>

        <UiDialog
          open={Boolean(confirmPrompt)}
          onClose={() => setConfirmPrompt(null)}
          maxWidth="xs"
          fullWidth
          title={confirmPrompt?.title}
          actions={
            <>
              <ActionButton
                kind="back"
                onClick={() => setConfirmPrompt(null)}
                disabled={confirmBusy}
              >
                {t("putaway.page.back")}
              </ActionButton>
              <ActionButton
                kind="confirm"
                onClick={() => void runConfirmPrompt()}
                disabled={confirmBusy}
              >
                {confirmBusy
                  ? t("putaway.page.processing")
                  : confirmPrompt?.okText}
              </ActionButton>
            </>
          }
        >
          <Box sx={{ typography: "body2" }}>{confirmPrompt?.content}</Box>
        </UiDialog>
      </>

      <CameraScanModal
        open={cameraOpen}
        title={t("putaway.page.cameraTitle")}
        onClose={() => setCameraOpen(false)}
        onDetected={(code) => {
          setCameraOpen(false);
          applyTrayScan(code);
        }}
      />
    </div>
  );
}
