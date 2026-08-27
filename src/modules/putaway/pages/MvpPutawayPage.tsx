import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { Key } from "react";
import { Alert, Card, Col, Input, Row, Space, Tag } from "antd";
import {
  Alert as MuiAlert,
  Box,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  MenuItem,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { guardBackdropClose } from "@/shared/utils/dialogGuard";
import { DataTable } from "@/shared/components";
import type { ColumnWithSortType } from "@/shared/components";
import { toast } from "sonner";
import { HistoryOutlined, InboxOutlined } from "@/shared/components/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
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
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: "block" }}
      >
        {label}
      </Typography>
      <Typography variant="body2" component="div">
        {value}
      </Typography>
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
    <Alert
      showIcon
      type={normalized.status === 403 ? "warning" : "error"}
      title={
        normalized.status === 403
          ? "Không có quyền truy cập"
          : getApiErrorMessage(error, fallback)
      }
      description={[
        normalized.status ? `Mã phản hồi ${normalized.status}` : undefined,
        normalized.code ? `Mã lỗi: ${normalized.code}` : undefined,
        requestId ? `Mã yêu cầu: ${requestId}` : undefined,
      ]
        .filter(Boolean)
        .join(" | ")}
    />
  );
}

/** Đồng bộ kích thước với select "10 / trang" ở Danh sách phiếu xuất (xem TOOLBAR_SX AlignedMvpOutboundPage.tsx). */
const PAGE_SIZE_SELECT_SX = {
  minWidth: 100,
  "&, & .MuiOutlinedInput-root": { height: 35 },
  "& .MuiSelect-select, & .MuiInputBase-input": {
    paddingTop: "8px !important",
    paddingBottom: "8px !important",
    fontSize: "13.5px !important",
    boxSizing: "border-box",
  },
};

function PageSizeSelector({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <Select
      value={value}
      inputProps={{ "aria-label": "Số dòng mỗi trang" }}
      onChange={(event) => onChange(Number(event.target.value))}
      sx={PAGE_SIZE_SELECT_SX}
    >
      {PAGE_SIZE_OPTIONS.map((size) => (
        <MenuItem key={size} value={size}>
          {size} / trang
        </MenuItem>
      ))}
    </Select>
  );
}

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
  const [selectedPendingRowKeys, setSelectedPendingRowKeys] = useState<Key[]>(
    [],
  );
  const [selectedHistoryRowKeys, setSelectedHistoryRowKeys] = useState<Key[]>(
    [],
  );
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
      setTrayScanError(
        error instanceof Error ? error.message : "Mã khay không hợp lệ.",
      );
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

  const taskColumns: ColumnWithSortType<PutawayTask> = [
    {
      title: "Hộp",
      dataIndex: "box_code",
      fixed: "left",
      width: 170,
      sorter: (a, b) => a.box_code.localeCompare(b.box_code, "vi"),
      render: (value: string) => <strong>{value}</strong>,
    },
    {
      title: "SKU",
      dataIndex: "sku_code",
      width: 170,
      sorter: (a, b) => a.sku_code.localeCompare(b.sku_code, "vi"),
    },
    {
      title: "Số lượng",
      dataIndex: "quantity",
      width: 100,
      align: "right",
      sortType: "value",
      sorter: (a, b) => a.quantity - b.quantity,
    },
    {
      title: "Trạng thái hộp",
      dataIndex: "status",
      width: 210,
      sorter: (a, b) => a.status.localeCompare(b.status, "vi"),
      render: (value: string) => (
        <Tag color={value === "STORED" ? "success" : "warning"}>
          {boxStatusLabel(value)}
        </Tag>
      ),
    },
    {
      title: "Lệnh xếp khay",
      key: "draft",
      width: 180,
      sorter: (a, b) =>
        (a.to_tray_code || "").localeCompare(b.to_tray_code || "", "vi"),
      render: (_, row) =>
        row.draft_id ? (
          <Tag color="processing">{row.to_tray_code || "Đã chọn khay"}</Tag>
        ) : (
          <Tag>Chưa tạo</Tag>
        ),
    },
    {
      title: "Hành động",
      key: "actions",
      fixed: "right",
      width: 260,
      render: (_, row) => {
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
          <Space size={2}>
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
          </Space>
        );
      },
    },
  ];

  const historyColumns: ColumnWithSortType<PutawayHistory> = [
    {
      title: "Thời gian",
      dataIndex: "created_at",
      width: 190,
      sortType: "value",
      sorter: (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      render: (created_at: string) => formatDateTime(created_at),
    },
    {
      title: "Hộp",
      dataIndex: "box_code",
      width: 170,
      sorter: (a, b) => a.box_code.localeCompare(b.box_code, "vi"),
    },
    {
      title: "Khay cũ",
      dataIndex: "old_tray_code",
      width: 150,
      sorter: (a, b) =>
        (a.old_tray_code || "").localeCompare(b.old_tray_code || "", "vi"),
      render: (value) => value || "-",
    },
    {
      title: "Khay mới",
      dataIndex: "new_tray_code",
      width: 150,
      sorter: (a, b) =>
        (a.new_tray_code || "").localeCompare(b.new_tray_code || "", "vi"),
      render: (value) => value || "-",
    },
    {
      title: "Vị trí",
      dataIndex: "location_hint",
      width: 180,
      sorter: (a, b) =>
        (a.location_hint || "").localeCompare(b.location_hint || "", "vi"),
      render: (value) => value || "-",
    },
    {
      title: "Người thao tác",
      dataIndex: "actor_name",
      width: 180,
      sorter: (a, b) =>
        (a.actor_name || "").localeCompare(b.actor_name || "", "vi"),
      render: (value) => value || "-",
    },
    {
      title: "Ảnh hưởng tồn",
      width: 140,
      render: () => <Tag color="success">Không đổi tồn</Tag>,
    },
  ];

  const firstError = tasksQuery.error ?? historyQuery.error ?? traysQuery.error;

  return (
    <div className="putaway-page master-data-page">
      <div className="page-heading">
        <div>
          <h1>Danh sách linh kiện chờ xếp khay</h1>
        </div>
      </div>

      <Card className="master-data-panel" variant="borderless">
        <div className="master-data-contract-strip">
          <Tag color="blue">Danh sách và lệnh xếp khay</Tag>
          <Tag color="blue">Xác nhận vị trí lưu trữ</Tag>
          <Tag color="gold">Yêu cầu quyền xếp khay hoặc quản lý vật chứa</Tag>
          <Tag color="green">Không thay đổi tồn kho</Tag>
        </div>

        <Alert
          showIcon
          type="info"
          className="master-data-state-alert"
          title="Xếp khay là bước định vị sau khi đã hoàn tất nhập kho, không phải bước tăng tồn"
          description="Linh kiện đã tăng tồn ở bước hoàn tất nhập kho. Màn này chỉ gán hộp vào khay/vị trí; tạo, xác nhận hoặc hủy lệnh xếp khay đều không làm thay đổi số lượng tồn."
        />

        {firstError ? (
          <ApiErrorAlert
            error={firstError}
            fallback="Không tải được dữ liệu xếp khay."
          />
        ) : null}

        <>
          <Tabs
            value={activeTab}
            onChange={(_event, value: string) => setActiveTab(value)}
            sx={{ marginBottom: 2 }}
          >
            <Tab
              value="pending"
              icon={<InboxOutlined style={{ fontSize: 15 }} />}
              iconPosition="start"
              label={`Chờ xếp khay (${tasks.length})`}
              sx={{ minHeight: 40, textTransform: "none" }}
            />
            <Tab
              value="history"
              icon={<HistoryOutlined style={{ fontSize: 15 }} />}
              iconPosition="start"
              label="Lịch sử xếp khay"
              sx={{ minHeight: 40, textTransform: "none" }}
            />
          </Tabs>

          {/* Filter (tìm kiếm) và chọn số dòng/trang đặt cùng một hàng, ngay trên
              bảng — tránh để page-size lệch chỗ khỏi thanh filter/trạng thái. */}
          <Row
            gutter={[12, 12]}
            className="filter-row"
            align="middle"
            justify="space-between"
            style={{ marginBottom: 12 }}
          >
            <Col xs={24} md={8}>
              {activeTab === "pending" ? (
                <Input
                  value={searchDraft}
                  placeholder="Tìm hộp / SKU..."
                  allowClear
                  aria-label="Tìm hộp hoặc SKU chờ xếp khay"
                  onChange={(event) => setSearchDraft(event.target.value)}
                />
              ) : (
                <Input
                  value={historySearchDraft}
                  placeholder="Tìm hộp / khay / người thao tác..."
                  allowClear
                  aria-label="Tìm trong lịch sử xếp khay"
                  onChange={(event) =>
                    setHistorySearchDraft(event.target.value)
                  }
                />
              )}
            </Col>
            <Col>
              <PageSizeSelector
                value={
                  activeTab === "pending" ? pendingPageSize : historyPageSize
                }
                onChange={
                  activeTab === "pending"
                    ? setPendingPageSize
                    : setHistoryPageSize
                }
              />
            </Col>
          </Row>
        </>

        {activeTab === "pending" ? (
          <DataTable<PutawayTask>
            rowKey="id"
            dataSource={tasks}
            loading={loading}
            columns={taskColumns}
            rowSelection={{
              type: "checkbox",
              selectedRowKeys: selectedPendingRowKeys,
              onChange: setSelectedPendingRowKeys,
            }}
            pagination={{
              pageSize: pendingPageSize,
              showSizeChanger: false,
              showTotal: (total) => `Tổng ${total} hộp`,
            }}
            locale={{
              emptyText: "Không có hộp linh kiện chờ xếp khay",
            }}
            scroll={{ x: "max-content" }}
          />
        ) : (
          <DataTable<PutawayHistory>
            rowKey="id"
            dataSource={filteredHistory}
            loading={loading}
            columns={historyColumns}
            rowSelection={{
              type: "checkbox",
              selectedRowKeys: selectedHistoryRowKeys,
              onChange: setSelectedHistoryRowKeys,
            }}
            pagination={{
              pageSize: historyPageSize,
              showSizeChanger: false,
              showTotal: (total) => `Tổng ${total} bản ghi`,
            }}
            locale={{
              emptyText: historySearchDraft.trim()
                ? "Không tìm thấy lịch sử xếp khay phù hợp"
                : "Chưa có lịch sử xếp khay",
            }}
            scroll={{ x: 1180 }}
          />
        )}
      </Card>

      <>
        <Dialog
          open={Boolean(selected)}
          onClose={guardBackdropClose(closePutaway)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle sx={{ pr: 6, position: "relative" }}>
            {selected
              ? `PTW-01 · Xếp ${selected.box_code} vào khay`
              : "PTW-01 · Xếp vào khay"}
            <ActionIconButton
              kind="close"
              label="Đóng"
              onClick={closePutaway}
              sx={{ position: "absolute", right: 10, top: 8 }}
            />
          </DialogTitle>
          <DialogContent dividers>
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
                    value={selected.receipt_code || "-"}
                    size={{ xs: 6, sm: 3 }}
                  />
                  <Grid size={{ xs: 12, sm: 3 }}>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: "block" }}
                    >
                      Trạng thái
                    </Typography>
                    <Chip
                      label={boxStatusLabel(selected.status)}
                      color={boxStatusChipColor(selected.status)}
                      size="small"
                      sx={{ mt: 0.25 }}
                    />
                  </Grid>
                </Grid>
              </Box>
            ) : null}

            <MuiAlert severity="warning" sx={{ mb: 2 }}>
              <Typography
                component="strong"
                sx={{ fontWeight: 700, display: "block" }}
              >
                Tạo lệnh nháp chưa thay đổi vị trí vật lý
              </Typography>
              <Typography variant="body2">
                Chỉ khi xác nhận, hộp mới được gán vào khay. Cả bước tạo lệnh và
                bước xác nhận đều không làm thay đổi số lượng tồn kho.
              </Typography>
            </MuiAlert>

            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
              Chọn khay đích
            </Typography>
            <Stack spacing={1.5} sx={{ mb: 2 }}>
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                  Quét mã vạch/QR của khay
                </Typography>
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
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: "block", mt: 0.5 }}
                >
                  Ưu tiên camera/máy quét. Nhập mã thủ công là phương án dự
                  phòng; mã phải xác định đúng một khay khả dụng.
                </Typography>
              </Box>

              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                  Hoặc chọn khay trên lưới
                </Typography>
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
              <TextField
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
              <TextField
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
          </DialogContent>
          <DialogActions>
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
          </DialogActions>
        </Dialog>

        <Dialog
          open={Boolean(detailRow)}
          onClose={() => setDetailRow(null)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle sx={{ pr: 6, position: "relative" }}>
            {detailRow
              ? `Chi tiết xếp khay · ${detailRow.box_code}`
              : "Chi tiết xếp khay"}
            <ActionIconButton
              kind="close"
              label="Đóng"
              onClick={() => setDetailRow(null)}
              sx={{ position: "absolute", right: 10, top: 8 }}
            />
          </DialogTitle>
          <DialogContent dividers>
            {detailRow ? (
              <Grid container spacing={2}>
                <PutawayDetailField label="Hộp" value={detailRow.box_code} />
                <PutawayDetailField
                  label="SKU"
                  value={`${detailRow.sku_code} · ${detailRow.sku_name}`}
                />
                <PutawayDetailField
                  label="Số lượng"
                  value={detailRow.quantity}
                />
                <PutawayDetailField
                  label="Phiếu nhập"
                  value={detailRow.receipt_code || "-"}
                />
                <PutawayDetailField
                  label="Khay dự kiến"
                  value={detailRow.to_tray_code || "Chưa chọn"}
                />
                <PutawayDetailField
                  label="Vị trí"
                  value={detailRow.location_hint || "-"}
                />
                <PutawayDetailField
                  label="Trạng thái hộp"
                  value={
                    <Chip
                      label={boxStatusLabel(detailRow.status)}
                      color={boxStatusChipColor(detailRow.status)}
                      size="small"
                    />
                  }
                />
                <PutawayDetailField
                  label="Lệnh xếp khay"
                  value={detailRow.draft_id ? "Đã tạo lệnh nháp" : "Chưa tạo"}
                />
                <PutawayDetailField
                  label="Ảnh hưởng tồn kho"
                  value={
                    <Chip label="Không đổi tồn" color="success" size="small" />
                  }
                />
              </Grid>
            ) : null}
          </DialogContent>
          <DialogActions>
            <ActionButton kind="close" onClick={() => setDetailRow(null)}>
              Đóng
            </ActionButton>
          </DialogActions>
        </Dialog>

        <Dialog
          open={Boolean(confirmPrompt)}
          onClose={() => setConfirmPrompt(null)}
          maxWidth="xs"
          fullWidth
        >
          <DialogTitle>{confirmPrompt?.title}</DialogTitle>
          <DialogContent>
            <Typography variant="body2">{confirmPrompt?.content}</Typography>
          </DialogContent>
          <DialogActions>
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
          </DialogActions>
        </Dialog>
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
