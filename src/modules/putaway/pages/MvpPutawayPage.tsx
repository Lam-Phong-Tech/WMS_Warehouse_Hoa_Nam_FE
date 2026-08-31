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
import { useRowSelection } from "@/shared/hooks/useRowSelection";
import { toast } from "sonner";
import { HistoryOutlined, InboxOutlined } from "@/shared/components/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

const BOX_STATUS_LABEL: Record<string, string> = {
  RECEIVED_PENDING_PUTAWAY: "Chờ xếp khay",
  STORED: "Đã xếp khay",
};

function boxStatusLabel(status: string): string {
  return BOX_STATUS_LABEL[status] ?? "Chưa xác định";
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
  const normalized = normalizeError(error);
  const requestId = getErrorRequestId(error);
  return (
    <UiAlert
      tone={normalized.status === 403 ? "warning" : "error"}
      title={
        normalized.status === 403
          ? "Không có quyền truy cập"
          : getApiErrorMessage(error, fallback)
      }
    >
      {[
        normalized.status ? `Mã phản hồi ${normalized.status}` : undefined,
        normalized.code ? `Mã lỗi: ${normalized.code}` : undefined,
        requestId ? `Mã yêu cầu: ${requestId}` : undefined,
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
  const pendingSelection = useRowSelection(pagedTasks, (row) => row.id);
  const historySelection = useRowSelection(pagedHistory, (row) => row.id);

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
      toast.error("Chỉ hộp đang chờ xếp khay mới được thực hiện thao tác này.");
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
      toast.success(`Đã nhận khay ${tray.container_code}.`);
    } catch (error) {
      setPutawayForm((current) => ({ ...current, to_tray_id: "" }));
      // Ưu tiên thông điệp thân thiện (BE / message nghiệp vụ); lỗi JS thô
      // không bao giờ lộ ra UI.
      setTrayScanError(getApiErrorMessage(error, "Mã khay không hợp lệ."));
    }
  };

  const createDraft = async () => {
    if (!selected || !canManage) return;
    if (selected.status !== "RECEIVED_PENDING_PUTAWAY") {
      toast.error(
        "Hộp không còn ở trạng thái chờ xếp khay. Hãy làm mới dữ liệu.",
      );
      return;
    }
    if (!putawayForm.to_tray_id) {
      setTrayScanError("Quét hoặc chọn khay đích.");
      return;
    }

    try {
      const targetTray = trays.find(
        (tray) => tray.container_id === putawayForm.to_tray_id,
      );
      if (!targetTray) {
        setPutawayForm((current) => ({ ...current, to_tray_id: "" }));
        toast.error("Khay đích không còn khả dụng. Hãy quét/chọn lại.");
        return;
      }

      const result = await createMutation.mutateAsync({
        box_container_id: selected.box_container_id,
        to_tray_id: targetTray.container_id,
        location_hint: putawayForm.location_hint?.trim() || null,
        note: putawayForm.note?.trim() || null,
      });
      if (result.stock_effect !== "NONE" || result.movement_created !== false) {
        throw new Error(
          "Lỗi bất biến: tạo lệnh xếp khay không được thay đổi tồn kho.",
        );
      }
      toast.success(
        "Đã tạo lệnh xếp khay nháp. Xác nhận trên danh sách để hoàn tất gán hộp vào khay.",
      );
      closePutaway();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không tạo được lệnh xếp khay."));
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
        throw new Error(
          "Lỗi bất biến: xác nhận xếp khay không được tạo biến động tồn.",
        );
      }
      toast.success(
        "Xếp khay thành công. Hộp đã được gán vào khay; số lượng tồn không đổi.",
      );
    } catch (error) {
      toast.error(
        getApiErrorMessage(error, "Không xác nhận được việc xếp khay."),
      );
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
        throw new Error(
          "Lỗi bất biến: hủy lệnh xếp khay không được thay đổi tồn kho.",
        );
      }
      toast.success(
        "Đã hủy lệnh xếp khay nháp. Hộp vẫn ở trạng thái chờ xếp khay; tồn kho không đổi.",
      );
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không hủy được lệnh xếp khay."));
      throw error;
    }
  };

  const confirmWithPrompt = (row: PutawayTask) => {
    setConfirmPrompt({
      title: "Xác nhận xếp khay?",
      content:
        "Hộp sẽ được gán vào khay đã chọn. Thao tác này không thay đổi số lượng tồn.",
      okText: "Xác nhận",
      onOk: () => confirm(row),
    });
  };

  const cancelWithPrompt = (row: PutawayTask) => {
    setConfirmPrompt({
      title: "Hủy lệnh xếp khay nháp?",
      content: "Hộp sẽ quay lại trạng thái chờ xếp khay; tồn kho không đổi.",
      okText: "Hủy lệnh",
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
      key: "box_code",
      header: "Hộp",
      width: 170,
      sortable: true,
      render: (row) => <strong>{row.box_code}</strong>,
    },
    {
      key: "sku_code",
      header: "SKU",
      width: 170,
      sortable: true,
      render: (row) => row.sku_code,
    },
    {
      key: "quantity",
      header: "Số lượng",
      width: 100,
      align: "right",
      sortable: true,
      sortType: "value",
      render: (row) => row.quantity,
    },
    {
      key: "status",
      header: "Trạng thái hộp",
      width: 210,
      sortable: true,
      render: (row) => (
        <UiStatusBadge
          tone={row.status === "STORED" ? "success" : "warning"}
          label={boxStatusLabel(row.status)}
        />
      ),
    },
    {
      key: "draft",
      header: "Lệnh xếp khay",
      width: 180,
      sortable: true,
      render: (row) =>
        row.draft_id ? (
          <UiStatusBadge
            tone="info"
            label={row.to_tray_code || "Đã chọn khay"}
          />
        ) : (
          <UiStatusBadge tone="neutral" label="Chưa tạo" />
        ),
    },
    {
      key: "actions",
      header: "Hành động",
      width: 260,
      render: (row) => {
        const canOpenPutaway =
          !row.draft_id && row.status === "RECEIVED_PENDING_PUTAWAY";
        const dropdownItems = row.draft_id
          ? [
              {
                key: "confirm",
                kind: "confirm" as const,
                label: "Xác nhận xếp khay",
                disabled: !canManage,
                onClick: () => confirmWithPrompt(row),
              },
              {
                key: "cancel",
                kind: "cancel" as const,
                label: "Hủy lệnh nháp",
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
              Xem
            </ActionButton>
            {/* PTW-GRID: nút chính mở lưới chọn khay — trước đây ẩn trong dropdown
                "..." khiến người dùng không thấy giao diện chọn khay. */}
            {canOpenPutaway ? (
              <ActionButton
                kind="swap"
                disabled={!canManage}
                onClick={() => openPutaway(row)}
              >
                Xếp khay
              </ActionButton>
            ) : null}
            {dropdownItems.length > 0 ? (
              <ActionDropdown
                tooltip="Thao tác xếp khay"
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
      key: "created_at",
      header: "Thời gian",
      width: 190,
      sortable: true,
      sortType: "value",
      render: (row) => formatDateTime(row.created_at),
    },
    {
      key: "box_code",
      header: "Hộp",
      width: 170,
      sortable: true,
      render: (row) => row.box_code,
    },
    {
      key: "old_tray_code",
      header: "Khay cũ",
      width: 150,
      sortable: true,
      render: (row) => row.old_tray_code || EMPTY_TEXT,
    },
    {
      key: "new_tray_code",
      header: "Khay mới",
      width: 150,
      sortable: true,
      render: (row) => row.new_tray_code || EMPTY_TEXT,
    },
    {
      key: "location_hint",
      header: "Vị trí",
      width: 180,
      sortable: true,
      render: (row) => row.location_hint || EMPTY_TEXT,
    },
    {
      key: "actor_name",
      header: "Người thao tác",
      width: 180,
      sortable: true,
      render: (row) => row.actor_name || EMPTY_TEXT,
    },
    {
      key: "stock_effect",
      header: "Ảnh hưởng tồn",
      width: 140,
      render: () => <UiStatusBadge tone="success" label="Không đổi tồn" />,
    },
  ];

  const firstError = tasksQuery.error ?? historyQuery.error ?? traysQuery.error;

  return (
    <div className="putaway-page master-data-page">
      <div className="page-heading">
        <div>
          <h1>Danh sách linh kiện chờ xếp khay</h1>
        </div>
        {/* Mục 15: lối vào trực tiếp màn XEM tổng quan khay (read-only), tách
            khỏi thao tác chọn khay trong dialog tạo lệnh. */}
        <RouterLink
          to={ROUTES.PUTAWAY_TRAYS}
          style={{ textDecoration: "none" }}
        >
          <ActionButton kind="view" label="Tổng quan tình trạng khay" />
        </RouterLink>
      </div>

      <UiCard className="master-data-panel">
        <div className="master-data-contract-strip">
          <UiStatusBadge tone="info" label="Danh sách và lệnh xếp khay" />
          <UiStatusBadge tone="info" label="Xác nhận vị trí lưu trữ" />
          <UiStatusBadge
            tone="warning"
            label="Yêu cầu quyền xếp khay hoặc quản lý vật chứa"
          />
          <UiStatusBadge tone="success" label="Không thay đổi tồn kho" />
        </div>

        <Box className="master-data-state-alert">
          <UiAlert
            tone="info"
            title="Xếp khay là bước định vị sau khi đã hoàn tất nhập kho"
          >
            Linh kiện đã tăng tồn ở bước hoàn tất nhập kho. Màn này chỉ gán hộp
            vào khay/vị trí; tạo, xác nhận hoặc hủy lệnh xếp khay đều không làm
            thay đổi số lượng tồn.
          </UiAlert>
        </Box>

        {firstError ? (
          <ApiErrorAlert
            error={firstError}
            fallback="Không tải được dữ liệu xếp khay."
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
                      <span>{`Chờ xếp khay (${tasks.length})`}</span>
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
                      <span>Lịch sử xếp khay</span>
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
                  placeholder="Tìm hộp / SKU..."
                  slotProps={{
                    htmlInput: {
                      "aria-label": "Tìm hộp hoặc SKU chờ xếp khay",
                    },
                  }}
                  width="100%"
                  onChange={setSearchDraft}
                />
              ) : (
                <SearchInput
                  value={historySearchDraft}
                  placeholder="Tìm hộp / khay / người thao tác..."
                  slotProps={{
                    htmlInput: { "aria-label": "Tìm trong lịch sử xếp khay" },
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
                aria-label="Số dòng mỗi trang"
                options={PAGE_SIZE_OPTIONS.map((size) => ({
                  value: size,
                  label: `${size} / trang`,
                }))}
                onChange={(value) => {
                  if (activeTab === "pending") {
                    setPendingPageSize(Number(value));
                  } else {
                    setHistoryPageSize(Number(value));
                  }
                }}
                minWidth={100}
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
              rowSelection={pendingSelection}
              selectionLabel={(row) => `Chọn hộp ${row.box_code}`}
              sortState={taskSort.sortState}
              onSortChange={taskSort.requestSort}
              emptyText="Không có hộp linh kiện chờ xếp khay"
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
                {`Tổng ${tasks.length} hộp`}
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
              rowSelection={historySelection}
              selectionLabel={(row) => `Chọn bản ghi ${row.box_code}`}
              sortState={historySort.sortState}
              onSortChange={historySort.requestSort}
              emptyText={
                historySearchDraft.trim()
                  ? "Không tìm thấy lịch sử xếp khay phù hợp"
                  : "Chưa có lịch sử xếp khay"
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
                {`Tổng ${filteredHistory.length} bản ghi`}
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
                  ? `PTW-01 · Xếp ${selected.box_code} vào khay`
                  : "PTW-01 · Xếp vào khay"}
              </span>
              <ActionIconButton
                kind="close"
                label="Đóng"
                onClick={closePutaway}
              />
            </Stack>
          }
          actions={
            <>
              <ActionButton kind="close" onClick={closePutaway}>
                Đóng
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
                {createMutation.isPending ? "Đang tạo..." : "Tạo lệnh xếp khay"}
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
                    label="Hộp"
                    value={selected.box_code}
                    size={{ xs: 6, sm: 3 }}
                  />
                  <PutawayDetailField
                    label="SKU"
                    value={selected.sku_code}
                    size={{ xs: 6, sm: 3 }}
                  />
                  <PutawayDetailField
                    label="Số lượng"
                    value={selected.quantity}
                    size={{ xs: 6, sm: 3 }}
                  />
                  <PutawayDetailField
                    label="Phiếu nhập"
                    value={selected.receipt_code || EMPTY_TEXT}
                    size={{ xs: 6, sm: 3 }}
                  />
                  <Grid size={{ xs: 12, sm: 3 }}>
                    <Box
                      sx={{ typography: "caption", color: "text.secondary" }}
                    >
                      Trạng thái
                    </Box>
                    <UiStatusBadge
                      label={boxStatusLabel(selected.status)}
                      tone={boxStatusChipColor(selected.status)}
                      sx={{ mt: 0.25 }}
                    />
                  </Grid>
                </Grid>
              </Box>
            ) : null}

            <Box sx={{ mb: 2 }}>
              <UiAlert
                tone="warning"
                title="Tạo lệnh nháp chưa thay đổi vị trí vật lý"
              >
                Chỉ khi xác nhận, hộp mới được gán vào khay. Cả bước tạo lệnh và
                bước xác nhận đều không làm thay đổi số lượng tồn kho.
              </UiAlert>
            </Box>

            <Box sx={{ typography: "subtitle2", fontWeight: 700, mb: 1 }}>
              Chọn khay đích
            </Box>
            <Stack spacing={1.5} sx={{ mb: 2 }}>
              <Box>
                <Box sx={{ typography: "body2", fontWeight: 600, mb: 1 }}>
                  Quét mã vạch/QR của khay
                </Box>
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ alignItems: "flex-start" }}
                >
                  <Box sx={{ flex: 1 }}>
                    <ScanInput
                      value={trayScanValue}
                      placeholder="Quét/nhập mã khay, VD: TRAY-A-01"
                      error={trayScanError}
                      disabled={!canManage || traysQuery.isLoading}
                      onChange={(value) => {
                        setTrayScanValue(value);
                        if (trayScanError) setTrayScanError(null);
                      }}
                      onScan={applyTrayScan}
                    />
                  </Box>
                  <ActionButton
                    kind="camera"
                    disabled={!canManage || traysQuery.isLoading}
                    onClick={() => setCameraOpen(true)}
                  >
                    Quét bằng camera
                  </ActionButton>
                </Stack>
                <Box
                  sx={{
                    typography: "caption",
                    color: "text.secondary",
                    mt: 0.5,
                  }}
                >
                  Ưu tiên camera/máy quét. Nhập mã thủ công là phương án dự
                  phòng; mã phải xác định đúng một khay khả dụng.
                </Box>
              </Box>

              <Box>
                <Box sx={{ typography: "body2", fontWeight: 600, mb: 1 }}>
                  Hoặc chọn khay trên lưới
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
                label="Vị trí gợi ý"
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
                placeholder="VD: Dãy trái khu linh kiện"
              />
              <UiTextField
                label="Ghi chú"
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
                  ? `Chi tiết xếp khay · ${detailRow.box_code}`
                  : "Chi tiết xếp khay"}
              </span>
              <ActionIconButton
                kind="close"
                label="Đóng"
                onClick={() => setDetailRow(null)}
              />
            </Stack>
          }
          actions={
            <ActionButton kind="close" onClick={() => setDetailRow(null)}>
              Đóng
            </ActionButton>
          }
        >
          {detailRow ? (
            <Grid container spacing={2}>
              <PutawayDetailField label="Hộp" value={detailRow.box_code} />
              <PutawayDetailField
                label="SKU"
                value={`${detailRow.sku_code} · ${detailRow.sku_name}`}
              />
              <PutawayDetailField label="Số lượng" value={detailRow.quantity} />
              <PutawayDetailField
                label="Phiếu nhập"
                value={detailRow.receipt_code || EMPTY_TEXT}
              />
              <PutawayDetailField
                label="Khay dự kiến"
                value={detailRow.to_tray_code || "Chưa chọn"}
              />
              <PutawayDetailField
                label="Vị trí"
                value={detailRow.location_hint || EMPTY_TEXT}
              />
              <PutawayDetailField
                label="Trạng thái hộp"
                value={
                  <UiStatusBadge
                    label={boxStatusLabel(detailRow.status)}
                    tone={boxStatusChipColor(detailRow.status)}
                  />
                }
              />
              <PutawayDetailField
                label="Lệnh xếp khay"
                value={detailRow.draft_id ? "Đã tạo lệnh nháp" : "Chưa tạo"}
              />
              <PutawayDetailField
                label="Ảnh hưởng tồn kho"
                value={<UiStatusBadge tone="success" label="Không đổi tồn" />}
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
                Quay lại
              </ActionButton>
              <ActionButton
                kind="confirm"
                onClick={() => void runConfirmPrompt()}
                disabled={confirmBusy}
              >
                {confirmBusy ? "Đang xử lý..." : confirmPrompt?.okText}
              </ActionButton>
            </>
          }
        >
          <Box sx={{ typography: "body2" }}>{confirmPrompt?.content}</Box>
        </UiDialog>
      </>

      <CameraScanModal
        open={cameraOpen}
        title="Quét mã vạch/QR khay đích bằng camera"
        onClose={() => setCameraOpen(false)}
        onDetected={(code) => {
          setCameraOpen(false);
          applyTrayScan(code);
        }}
      />
    </div>
  );
}
