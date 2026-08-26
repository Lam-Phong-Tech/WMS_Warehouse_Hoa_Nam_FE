import { useEffect, useMemo, useState } from "react";
import type { Key } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Tabs,
  Tag,
} from "antd";
import { DataTable } from "@/shared/components";
import { toast } from "sonner";
import {
  CameraOutlined,
  CheckCircleOutlined,
  CheckOutlined,
  CloseOutlined,
  EyeOutlined,
  MoreOutlined,
  SwapOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
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
  type TrayOption,
} from "@/modules/putaway/services/putawayService";

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

function trayLabel(tray: TrayOption) {
  return `${tray.container_code}${tray.zone_code ? ` · ${tray.zone_code}` : ""}${
    tray.location_hint ? ` · ${tray.location_hint}` : ""
  }`;
}

function PageSizeSelector({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="table-page-size">
      <Select
        size="small"
        value={value}
        style={{ width: 110 }}
        showSearch={false}
        labelRender={({ value: selectedValue }) => `${selectedValue} / trang`}
        options={PAGE_SIZE_OPTIONS.map((size) => ({
          value: size,
          label: `${size} / trang`,
        }))}
        onChange={onChange}
      />
    </div>
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
  const [form] = Form.useForm<PutawayFormValues>();

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

  const resetTarget = () => {
    setTrayScanValue("");
    setTrayScanError(null);
    setCameraOpen(false);
  };

  const closePutaway = () => {
    setSelected(null);
    form.resetFields();
    resetTarget();
  };

  const openPutaway = (row: PutawayTask) => {
    if (row.status !== "RECEIVED_PENDING_PUTAWAY") {
      toast.error("Chỉ hộp đang chờ xếp khay mới được thực hiện thao tác này.");
      return;
    }
    setSelected(row);
    form.resetFields();
    resetTarget();
    form.setFieldsValue({
      to_tray_id: row.to_tray_id ?? undefined,
      location_hint: row.location_hint ?? undefined,
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

  const trayOptions = useMemo(
    () =>
      trays.map((tray) => ({
        value: tray.container_id,
        label: trayLabel(tray),
      })),
    [trays],
  );

  const applyTrayScan = (rawCode: string) => {
    try {
      const tray = resolvePutawayTrayByScanCode(trays, rawCode);
      form.setFieldValue("to_tray_id", tray.container_id);
      setTrayScanError(null);
      toast.success(`Đã nhận khay ${tray.container_code}.`);
    } catch (error) {
      form.setFieldValue("to_tray_id", undefined);
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

    try {
      const values = await form.validateFields();
      const targetTray = trays.find(
        (tray) => tray.container_id === values.to_tray_id,
      );
      if (!targetTray) {
        form.setFieldValue("to_tray_id", undefined);
        toast.error("Khay đích không còn khả dụng. Hãy quét/chọn lại.");
        return;
      }

      const result = await createMutation.mutateAsync({
        box_container_id: selected.box_container_id,
        to_tray_id: targetTray.container_id,
        location_hint: values.location_hint?.trim() || null,
        note: values.note?.trim() || null,
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
      if ((error as { errorFields?: unknown }).errorFields) return;
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
    Modal.confirm({
      title: "Xác nhận xếp khay?",
      content:
        "Hộp sẽ được gán vào khay đã chọn. Thao tác này không thay đổi số lượng tồn.",
      okText: "Xác nhận",
      cancelText: "Quay lại",
      onOk: () => confirm(row),
    });
  };

  const cancelWithPrompt = (row: PutawayTask) => {
    Modal.confirm({
      title: "Hủy lệnh xếp khay nháp?",
      content: "Hộp sẽ quay lại trạng thái chờ xếp khay; tồn kho không đổi.",
      okText: "Hủy lệnh",
      okButtonProps: { danger: true },
      cancelText: "Quay lại",
      onOk: () => cancel(row),
    });
  };

  const taskColumns: ColumnsType<PutawayTask> = [
    {
      title: "Hộp",
      dataIndex: "box_code",
      fixed: "left",
      width: 170,
      render: (value: string) => <strong>{value}</strong>,
    },
    { title: "SKU", dataIndex: "sku_code", width: 170 },
    { title: "Tên SKU", dataIndex: "sku_name", width: 240 },
    {
      title: "Số lượng",
      dataIndex: "quantity",
      width: 100,
      align: "right",
    },
    {
      title: "Phiếu nhập",
      dataIndex: "receipt_code",
      width: 170,
      render: (value) => value || "-",
    },
    {
      title: "Trạng thái hộp",
      dataIndex: "status",
      width: 210,
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
      width: 150,
      render: (_, row) => {
        const actionItems = row.draft_id
          ? [
              {
                key: "confirm",
                label: "Xác nhận xếp khay",
                icon: <CheckOutlined />,
                disabled: !canManage,
                onClick: () => confirmWithPrompt(row),
              },
              {
                key: "cancel",
                label: "Hủy lệnh nháp",
                icon: <CloseOutlined />,
                danger: true,
                disabled: !canManage,
                onClick: () => cancelWithPrompt(row),
              },
            ]
          : row.status === "RECEIVED_PENDING_PUTAWAY"
            ? [
                {
                  key: "putaway",
                  label: "Xếp vào khay",
                  icon: <SwapOutlined />,
                  disabled: !canManage,
                  onClick: () => openPutaway(row),
                },
              ]
            : [];

        return (
          <Space size={2}>
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => setDetailRow(row)}
            >
              Xem
            </Button>
            {actionItems.length > 0 ? (
              <ActionDropdown
                tooltip="Thao tác xếp khay"
                icon={<MoreOutlined />}
                items={actionItems}
              />
            ) : null}
          </Space>
        );
      },
    },
  ];

  const historyColumns: ColumnsType<PutawayHistory> = [
    {
      title: "Thời gian",
      dataIndex: "created_at",
      width: 190,
      render: (created_at: string) => formatDateTime(created_at),
    },
    { title: "Hộp", dataIndex: "box_code", width: 170 },
    {
      title: "Khay cũ",
      dataIndex: "old_tray_code",
      width: 150,
      render: (value) => value || "-",
    },
    {
      title: "Khay mới",
      dataIndex: "new_tray_code",
      width: 150,
      render: (value) => value || "-",
    },
    {
      title: "Vị trí",
      dataIndex: "location_hint",
      width: 180,
      render: (value) => value || "-",
    },
    {
      title: "Người thao tác",
      dataIndex: "actor_name",
      width: 180,
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

        {activeTab === "pending" ? (
          <Row
            gutter={[12, 12]}
            className="filter-row"
            align="middle"
            justify="space-between"
          >
            <Col xs={24} md={8}>
              <Input
                value={searchDraft}
                placeholder="Tìm hộp / SKU..."
                allowClear
                aria-label="Tìm hộp hoặc SKU chờ xếp khay"
                onChange={(event) => setSearchDraft(event.target.value)}
              />
            </Col>
            <Col>
              <PageSizeSelector
                value={pendingPageSize}
                onChange={setPendingPageSize}
              />
            </Col>
          </Row>
        ) : (
          <Row justify="end" className="filter-row">
            <Col>
              <PageSizeSelector
                value={historyPageSize}
                onChange={setHistoryPageSize}
              />
            </Col>
          </Row>
        )}

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

        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: "pending",
              label: `Chờ xếp khay (${tasks.length})`,
              children: (
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
              ),
            },
            {
              key: "history",
              label: "Lịch sử xếp khay",
              children: (
                <DataTable<PutawayHistory>
                  rowKey="id"
                  dataSource={history}
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
                  locale={{ emptyText: "Chưa có lịch sử xếp khay" }}
                  scroll={{ x: 1180 }}
                />
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title={
          selected
            ? `PTW-01 · Xếp ${selected.box_code} vào khay`
            : "PTW-01 · Xếp vào khay"
        }
        open={Boolean(selected)}
        onCancel={closePutaway}
        onOk={() => void createDraft()}
        okText="Tạo lệnh xếp khay"
        okButtonProps={{
          icon: <CheckCircleOutlined />,
          loading: createMutation.isPending,
          disabled:
            !canManage || selected?.status !== "RECEIVED_PENDING_PUTAWAY",
        }}
        width={760}
        centered
        mask={{ closable: false }}
      >
        {selected ? (
          <>
            <Descriptions
              bordered
              size="small"
              column={{ xs: 1, sm: 2 }}
              style={{ marginBottom: 14 }}
            >
              <Descriptions.Item label="Hộp">
                {selected.box_code}
              </Descriptions.Item>
              <Descriptions.Item label="SKU">
                {selected.sku_code}
              </Descriptions.Item>
              <Descriptions.Item label="Số lượng">
                {selected.quantity}
              </Descriptions.Item>
              <Descriptions.Item label="Phiếu nhập">
                {selected.receipt_code || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Trạng thái" span={2}>
                <Tag color="warning">{boxStatusLabel(selected.status)}</Tag>
              </Descriptions.Item>
            </Descriptions>
            <Alert
              showIcon
              type="warning"
              className="master-data-state-alert"
              title="Tạo lệnh nháp chưa thay đổi vị trí vật lý"
              description="Chỉ khi xác nhận, hộp mới được gán vào khay. Cả bước tạo lệnh và bước xác nhận đều không làm thay đổi số lượng tồn kho."
            />
          </>
        ) : null}

        <Form form={form} layout="vertical">
          <Form.Item
            label="Quét mã vạch/QR của khay đích"
            extra="Ưu tiên camera/máy quét. Nhập mã thủ công là phương án dự phòng; mã phải xác định đúng một khay khả dụng."
          >
            <Row gutter={8} align="top">
              <Col flex="auto">
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
              </Col>
              <Col>
                <Button
                  size="large"
                  icon={<CameraOutlined />}
                  disabled={!canManage || traysQuery.isLoading}
                  onClick={() => setCameraOpen(true)}
                >
                  Quét bằng camera
                </Button>
              </Col>
            </Row>
          </Form.Item>

          <Form.Item
            name="to_tray_id"
            label="Khay đã nhận diện / chọn thủ công"
            rules={[{ required: true, message: "Quét hoặc chọn khay đích." }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              options={trayOptions}
              loading={traysQuery.isLoading}
              placeholder="Chọn khay khả dụng"
              onChange={() => setTrayScanError(null)}
            />
          </Form.Item>
          <Form.Item name="location_hint" label="Vị trí gợi ý">
            <Input maxLength={255} placeholder="VD: Dãy trái khu linh kiện" />
          </Form.Item>
          <Form.Item name="note" label="Ghi chú">
            <Input.TextArea rows={3} maxLength={2000} showCount />
          </Form.Item>
        </Form>
      </Modal>

      <CameraScanModal
        open={cameraOpen}
        title="Quét mã vạch/QR khay đích bằng camera"
        onClose={() => setCameraOpen(false)}
        onDetected={(code) => {
          setCameraOpen(false);
          applyTrayScan(code);
        }}
      />

      <Modal
        title={
          detailRow
            ? `Chi tiết xếp khay · ${detailRow.box_code}`
            : "Chi tiết xếp khay"
        }
        open={Boolean(detailRow)}
        onCancel={() => setDetailRow(null)}
        footer={
          <Button icon={<CloseOutlined />} onClick={() => setDetailRow(null)}>
            Đóng
          </Button>
        }
        width={680}
      >
        {detailRow ? (
          <Descriptions bordered size="small" column={1}>
            <Descriptions.Item label="Hộp">
              {detailRow.box_code}
            </Descriptions.Item>
            <Descriptions.Item label="SKU">
              {detailRow.sku_code} · {detailRow.sku_name}
            </Descriptions.Item>
            <Descriptions.Item label="Số lượng">
              {detailRow.quantity}
            </Descriptions.Item>
            <Descriptions.Item label="Phiếu nhập">
              {detailRow.receipt_code || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Khay dự kiến">
              {detailRow.to_tray_code || "Chưa chọn"}
            </Descriptions.Item>
            <Descriptions.Item label="Vị trí">
              {detailRow.location_hint || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Trạng thái hộp">
              <Tag
                color={detailRow.status === "STORED" ? "success" : "warning"}
              >
                {boxStatusLabel(detailRow.status)}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Lệnh xếp khay">
              {detailRow.draft_id ? "Đã tạo lệnh nháp" : "Chưa tạo"}
            </Descriptions.Item>
            <Descriptions.Item label="Ảnh hưởng tồn kho">
              <Tag color="success">Không đổi tồn</Tag>
            </Descriptions.Item>
          </Descriptions>
        ) : null}
      </Modal>
    </div>
  );
}
