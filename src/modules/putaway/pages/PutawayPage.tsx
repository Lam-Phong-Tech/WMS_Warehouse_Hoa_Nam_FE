import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Form,
  Input,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Tooltip,
  message,
} from "antd";
import {
  CheckOutlined,
  CloseOutlined,
  EyeOutlined,
  ReloadOutlined,
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
import { useAuthStore } from "@/shared/store/auth.store";
import {
  hasAnyWmsPermission,
  WMS_PERMISSION_CATALOG as P,
} from "@/shared/constants/wms-permissions";
import {
  cancelPutawayTask,
  confirmPutawayTask,
  createPutawayTask,
  fetchPutawayHistory,
  fetchPutawayTasks,
  fetchPutawayTrays,
  type PutawayHistory,
  type PutawayTask,
  type TrayOption,
} from "@/modules/putaway/services/putawayService";

type PutawayFormValues = {
  to_tray_id: string;
  location_hint?: string;
  note?: string;
};

const putawayKeys = {
  all: ["putaway"] as const,
  tasks: (search: string) => ["putaway", "tasks", search] as const,
  history: ["putaway", "history"] as const,
  trays: ["putaway", "trays"] as const,
};

function ApiErrorAlert({ error, fallback }: { error: unknown; fallback: string }) {
  const normalized = normalizeError(error);
  const requestId = getErrorRequestId(error);
  return (
    <Alert
      showIcon
      type={normalized.status === 403 ? "warning" : "error"}
      message={normalized.status === 403 ? "Không có quyền truy cập" : getApiErrorMessage(error, fallback)}
      description={[
        normalized.status ? `HTTP ${normalized.status}` : undefined,
        normalized.code ? `Mã lỗi: ${normalized.code}` : undefined,
        requestId ? `Mã yêu cầu: ${requestId}` : undefined,
      ]
        .filter(Boolean)
        .join(" | ")}
    />
  );
}

export default function PutawayPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const permissionCodes = useAuthStore((state) => state.permissionCodes);
  const isSuperAdmin = useAuthStore((state) => state.isSuperAdmin);
  const canManage = hasAnyWmsPermission(permissionCodes, [P.CONTAINER_MANAGE], isSuperAdmin);
  const [activeTab, setActiveTab] = useState("pending");
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<PutawayTask | null>(null);
  const [detailRow, setDetailRow] = useState<PutawayTask | null>(null);
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
    mutationFn: ({ id, version }: { id: string; version: number }) => confirmPutawayTask(id, version),
    onSuccess: invalidate,
  });
  const cancelMutation = useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) => cancelPutawayTask(id, version),
    onSuccess: invalidate,
  });

  const tasks = tasksQuery.data ?? [];
  const history = historyQuery.data ?? [];
  const trays = traysQuery.data ?? [];
  const loading = tasksQuery.isLoading || historyQuery.isLoading || traysQuery.isLoading;

  useEffect(() => {
    if (searchParams.get("screen") !== "PTW-01" || tasks.length === 0) return;
    const requestedBox = searchParams.get("box");
    const nextSelected =
      tasks.find((task) => task.box_code === requestedBox || task.box_container_id === requestedBox) ??
      tasks[0];
    if (nextSelected) {
      setSelected(nextSelected);
      form.setFieldsValue({ location_hint: nextSelected.location_hint ?? undefined });
    }
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("screen", "PTW-00");
    nextParams.delete("box");
    setSearchParams(nextParams, { replace: true });
  }, [form, searchParams, setSearchParams, tasks]);

  const trayOptions = useMemo(
    () =>
      trays.map((tray: TrayOption) => ({
        value: tray.container_id,
        label: `${tray.container_code}${tray.zone_code ? ` · ${tray.zone_code}` : ""}${tray.location_hint ? ` · ${tray.location_hint}` : ""}`,
      })),
    [trays],
  );

  const openPutaway = (row: PutawayTask) => {
    setSelected(row);
    form.resetFields();
    form.setFieldsValue({
      to_tray_id: row.to_tray_id ?? undefined,
      location_hint: row.location_hint ?? undefined,
    });
  };

  const createDraft = async () => {
    if (!selected || !canManage) return;
    try {
      const values = await form.validateFields();
      const result = await createMutation.mutateAsync({
        box_container_id: selected.box_container_id,
        to_tray_id: values.to_tray_id,
        location_hint: values.location_hint?.trim() || null,
        note: values.note?.trim() || null,
      });
      if (result.stock_effect !== "NONE" || result.movement_created !== false) {
        throw new Error("Invariant lỗi: tạo putaway DRAFT không được ảnh hưởng tồn kho.");
      }
      message.success("Đã tạo putaway DRAFT. Kiểm tra dòng tác vụ và Xác nhận để hoàn tất BOX → TRAY.");
      setSelected(null);
      form.resetFields();
    } catch (error) {
      if ((error as { errorFields?: unknown }).errorFields) return;
      message.error(getApiErrorMessage(error, "Không tạo được putaway DRAFT."));
    }
  };

  const confirm = async (row: PutawayTask) => {
    if (!row.draft_id || !row.draft_version || !canManage) return;
    try {
      const result = await confirmMutation.mutateAsync({ id: row.draft_id, version: row.draft_version });
      if (result.stock_effect !== "NONE" || result.movement_created !== false) {
        throw new Error("Invariant lỗi: Confirm Putaway không được tạo stock movement.");
      }
      message.success("Putaway thành công. BOX đã được map vào TRAY; available_qty không đổi.");
    } catch (error) {
      message.error(getApiErrorMessage(error, "Không xác nhận được putaway."));
    }
  };

  const cancel = async (row: PutawayTask) => {
    if (!row.draft_id || !row.draft_version || !canManage) return;
    try {
      const result = await cancelMutation.mutateAsync({ id: row.draft_id, version: row.draft_version });
      if (result.stock_effect !== "NONE" || result.movement_created !== false) {
        throw new Error("Invariant lỗi: Cancel Putaway không được ảnh hưởng tồn kho.");
      }
      message.success("Đã hủy putaway DRAFT. BOX vẫn chờ xếp khay và tồn kho không đổi.");
    } catch (error) {
      message.error(getApiErrorMessage(error, "Không hủy được putaway DRAFT."));
    }
  };

  const taskColumns: ColumnsType<PutawayTask> = [
    {
      title: "BOX",
      dataIndex: "box_code",
      fixed: "left",
      width: 170,
      render: (value: string) => <strong>{value}</strong>,
    },
    { title: "SKU", dataIndex: "sku_code", width: 170 },
    { title: "Tên SKU", dataIndex: "sku_name", width: 240 },
    { title: "Số lượng", dataIndex: "quantity", width: 100, align: "right" },
    { title: "Phiếu nhập", dataIndex: "receipt_code", width: 170, render: (value) => value || "-" },
    {
      title: "Trạng thái BOX",
      dataIndex: "status",
      width: 210,
      render: (value: string) => <Tag color={value === "STORED" ? "success" : "warning"}>{value}</Tag>,
    },
    {
      title: "Putaway DRAFT",
      key: "draft",
      width: 180,
      render: (_, row) =>
        row.draft_id ? <Tag color="processing">{row.to_tray_code || "Đã chọn TRAY"}</Tag> : <Tag>Chưa tạo</Tag>,
    },
    {
      title: "Hành động",
      key: "actions",
      fixed: "right",
      width: 300,
      render: (_, row) => (
        <Space size={4} wrap>
          <Button size="small" icon={<EyeOutlined />} onClick={() => setDetailRow(row)}>
            Xem
          </Button>
          {row.draft_id ? (
            <>
              <Popconfirm
                title="Xác nhận Putaway?"
                description="BOX sẽ được map sang TRAY đã chọn. Thao tác này không tạo stock movement."
                okText="Xác nhận"
                cancelText="Quay lại"
                onConfirm={() => void confirm(row)}
              >
                <Button
                  size="small"
                  type="primary"
                  icon={<CheckOutlined />}
                  disabled={!canManage}
                  loading={confirmMutation.isPending}
                >
                  Xác nhận
                </Button>
              </Popconfirm>
              <Popconfirm
                title="Hủy putaway DRAFT?"
                description="BOX sẽ quay lại trạng thái chờ xếp khay; tồn kho không đổi."
                okText="Hủy DRAFT"
                okButtonProps={{ danger: true }}
                cancelText="Quay lại"
                onConfirm={() => void cancel(row)}
              >
                <Button
                  size="small"
                  danger
                  icon={<CloseOutlined />}
                  disabled={!canManage}
                  loading={cancelMutation.isPending}
                >
                  Hủy DRAFT
                </Button>
              </Popconfirm>
            </>
          ) : (
            <Tooltip title={canManage ? "Tạo PTW-01 DRAFT" : "Bạn không có container.manage"}>
              <Button
                icon={<SwapOutlined />}
                size="small"
                type="primary"
                disabled={!canManage}
                onClick={() => openPutaway(row)}
              >
                Xếp vào khay
              </Button>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  const historyColumns: ColumnsType<PutawayHistory> = [
    { title: "Thời gian", dataIndex: "created_at", width: 190 },
    { title: "BOX", dataIndex: "box_code", width: 170 },
    { title: "Khay cũ", dataIndex: "old_tray_code", width: 150, render: (value) => value || "-" },
    { title: "Khay mới", dataIndex: "new_tray_code", width: 150, render: (value) => value || "-" },
    { title: "Vị trí", dataIndex: "location_hint", width: 180, render: (value) => value || "-" },
    { title: "Người thao tác", dataIndex: "actor_name", width: 180, render: (value) => value || "-" },
    { title: "Ảnh hưởng tồn", width: 140, render: () => <Tag color="success">NONE</Tag> },
  ];

  const firstError = tasksQuery.error ?? historyQuery.error ?? traysQuery.error;

  return (
    <div className="putaway-page">
      <div className="page-heading">
        <div><h1>Danh sách linh kiện chờ xếp khay</h1></div>
        <Space wrap>
          <Button
            icon={<ReloadOutlined />}
            loading={tasksQuery.isFetching || historyQuery.isFetching || traysQuery.isFetching}
            onClick={() => void invalidate()}
          >
            Làm mới
          </Button>
        </Space>
      </div>

      <Card className="master-data-panel">
        <Space wrap style={{ marginBottom: 12 }}>
          <Tag color="blue">GET/POST /putaway/tasks</Tag>
          <Tag color="blue">POST /putaway/tasks/:id/confirm</Tag>
          <Tag color="gold">container.view / container.manage</Tag>
          <Tag color="green">stock_effect=NONE</Tag>
        </Space>

        <Row gutter={[12, 12]} style={{ marginBottom: 14 }}>
          <Col xs={24} md={10}>
            <Input.Search
              value={searchDraft}
              placeholder="Tìm BOX / SKU"
              allowClear
              onChange={(event) => {
                const value = event.target.value;
                setSearchDraft(value);
                if (!value) setSearch("");
              }}
              onSearch={(value) => setSearch(value.trim())}
            />
          </Col>
          <Col xs={12} md={4}>
            <Button
              className="full-width"
              onClick={() => {
                setSearchDraft("");
                setSearch("");
              }}
            >
              Xóa lọc
            </Button>
          </Col>
        </Row>

        <Alert
          showIcon
          type="info"
          style={{ marginBottom: 14 }}
          message="Putaway là bước định vị sau Full Post Receipt, không phải bước nhập tồn"
          description="COMPONENT đã tăng tồn tại Post Receipt. PTW-00/PTW-01 chỉ map BOX → TRAY/location; create/confirm/cancel Putaway đều phải stock-neutral và không tạo Inventory Movement."
        />

        {firstError ? (
          <div style={{ marginBottom: 14 }}>
            <ApiErrorAlert error={firstError} fallback="Không tải được dữ liệu Putaway." />
          </div>
        ) : null}

        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: "pending",
              label: `Chờ xếp khay (${tasks.length})`,
              children: (
                <Table<PutawayTask>
                  rowKey="id"
                  dataSource={tasks}
                  loading={loading}
                  columns={taskColumns}
                  pagination={{
                    pageSize: 15,
                    showSizeChanger: true,
                    pageSizeOptions: ["15", "20", "50", "100"],
                    showTotal: (total, range) => `${range[0]}-${range[1]} / ${total} BOX`,
                  }}
                  locale={{ emptyText: "Không có BOX COMPONENT chờ xếp khay" }}
                  scroll={{ x: 1420 }}
                />
              ),
            },
            {
              key: "history",
              label: "Lịch sử Putaway",
              children: (
                <Table<PutawayHistory>
                  rowKey="id"
                  dataSource={history}
                  loading={loading}
                  columns={historyColumns}
                  pagination={{ pageSize: 15, showSizeChanger: true, pageSizeOptions: ["15", "20", "50", "100"] }}
                  locale={{ emptyText: "Chưa có lịch sử Putaway" }}
                  scroll={{ x: 1180 }}
                />
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title={selected ? `PTW-01 · Xếp ${selected.box_code} vào khay` : "PTW-01 · Xếp vào khay"}
        open={Boolean(selected)}
        onCancel={() => {
          setSelected(null);
          form.resetFields();
        }}
        onOk={() => void createDraft()}
        okText="Tạo Putaway DRAFT"
        confirmLoading={createMutation.isPending}
        okButtonProps={{ disabled: !canManage }}
        width={720}
        centered
        maskClosable={false}
      >
        {selected ? (
          <>
            <Descriptions bordered size="small" column={2} style={{ marginBottom: 14 }}>
              <Descriptions.Item label="BOX">{selected.box_code}</Descriptions.Item>
              <Descriptions.Item label="SKU">{selected.sku_code}</Descriptions.Item>
              <Descriptions.Item label="Số lượng">{selected.quantity}</Descriptions.Item>
              <Descriptions.Item label="Phiếu nhập">{selected.receipt_code || "-"}</Descriptions.Item>
              <Descriptions.Item label="Trạng thái" span={2}><Tag color="warning">{selected.status}</Tag></Descriptions.Item>
            </Descriptions>
            <Alert
              showIcon
              type="warning"
              style={{ marginBottom: 14 }}
              message="Tạo DRAFT chưa thay đổi mapping vật lý"
              description="Sau khi tạo DRAFT, người dùng phải Xác nhận trên danh sách. Chỉ Confirm mới cập nhật BOX → TRAY; cả hai bước đều không đổi tồn."
            />
          </>
        ) : null}
        <Form form={form} layout="vertical">
          <Form.Item
            name="to_tray_id"
            label="Khay đích"
            rules={[{ required: true, message: "Chọn TRAY đích." }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              options={trayOptions}
              loading={traysQuery.isLoading}
              placeholder="Chọn TRAY khả dụng"
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

      <Modal
        title={detailRow ? `Chi tiết Putaway · ${detailRow.box_code}` : "Chi tiết Putaway"}
        open={Boolean(detailRow)}
        onCancel={() => setDetailRow(null)}
        footer={<Button onClick={() => setDetailRow(null)}>Đóng</Button>}
        width={680}
      >
        {detailRow ? (
          <Descriptions bordered size="small" column={1}>
            <Descriptions.Item label="BOX">{detailRow.box_code}</Descriptions.Item>
            <Descriptions.Item label="SKU">{detailRow.sku_code} · {detailRow.sku_name}</Descriptions.Item>
            <Descriptions.Item label="Số lượng">{detailRow.quantity}</Descriptions.Item>
            <Descriptions.Item label="Phiếu nhập">{detailRow.receipt_code || "-"}</Descriptions.Item>
            <Descriptions.Item label="Khay dự kiến">{detailRow.to_tray_code || "Chưa chọn"}</Descriptions.Item>
            <Descriptions.Item label="Vị trí">{detailRow.location_hint || "-"}</Descriptions.Item>
            <Descriptions.Item label="Trạng thái BOX"><Tag color="warning">{detailRow.status}</Tag></Descriptions.Item>
            <Descriptions.Item label="Putaway DRAFT">{detailRow.draft_id || "Chưa tạo"}</Descriptions.Item>
            <Descriptions.Item label="Stock effect"><Tag color="success">NONE</Tag></Descriptions.Item>
          </Descriptions>
        ) : null}
      </Modal>
    </div>
  );
}
