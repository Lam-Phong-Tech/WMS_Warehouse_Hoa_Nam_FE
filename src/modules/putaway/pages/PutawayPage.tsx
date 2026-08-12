import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Form, Input, Modal, Select, Space, Table, Tabs, Tag, message } from "antd";
import { ReloadOutlined, SwapOutlined } from "@ant-design/icons";
import { getApiErrorMessage } from "@/shared/api/api-error";
import { useAuthStore } from "@/shared/store/auth.store";
import { hasAnyWmsPermission, WMS_PERMISSION_CATALOG as P } from "@/shared/constants/wms-permissions";
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

export default function PutawayPage() {
  const permissionCodes = useAuthStore((state) => state.permissionCodes);
  const isSuperAdmin = useAuthStore((state) => state.isSuperAdmin);
  const canManage = hasAnyWmsPermission(permissionCodes, [P.CONTAINER_MANAGE], isSuperAdmin);
  const [activeTab, setActiveTab] = useState("pending");
  const [search, setSearch] = useState("");
  const [tasks, setTasks] = useState<PutawayTask[]>([]);
  const [history, setHistory] = useState<PutawayHistory[]>([]);
  const [trays, setTrays] = useState<TrayOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<PutawayTask | null>(null);
  const [form] = Form.useForm<{ to_tray_id: string; location_hint?: string; note?: string }>();

  const load = async () => {
    setLoading(true);
    try {
      const [nextTasks, nextHistory, nextTrays] = await Promise.all([
        fetchPutawayTasks(search.trim() ? { search: search.trim() } : {}),
        fetchPutawayHistory(),
        fetchPutawayTrays(),
      ]);
      setTasks(nextTasks);
      setHistory(nextHistory);
      setTrays(nextTrays);
    } catch (error) {
      message.error(getApiErrorMessage(error, "Không tải được dữ liệu putaway."));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []);

  const trayOptions = useMemo(() => trays.map((tray) => ({
    value: tray.container_id,
    label: `${tray.container_code}${tray.location_hint ? ` · ${tray.location_hint}` : ""}`,
  })), [trays]);

  const createDraft = async () => {
    if (!selected || !canManage) return;
    try {
      const values = await form.validateFields();
      await createPutawayTask({
        box_container_id: selected.box_container_id,
        to_tray_id: values.to_tray_id,
        location_hint: values.location_hint?.trim() || null,
        note: values.note?.trim() || null,
      });
      message.success("Đã tạo putaway DRAFT. Kiểm tra lại và bấm Xác nhận để hoàn tất.");
      setSelected(null);
      form.resetFields();
      await load();
    } catch (error) {
      if ((error as { errorFields?: unknown }).errorFields) return;
      message.error(getApiErrorMessage(error, "Không tạo được tác vụ putaway."));
    }
  };

  const confirm = async (row: PutawayTask) => {
    if (!row.draft_id || !row.draft_version || !canManage) return;
    try {
      const result = await confirmPutawayTask(row.draft_id, row.draft_version);
      if (result.stock_effect !== "NONE" || result.movement_created !== false) {
        throw new Error("Putaway invariant failed: response báo có ảnh hưởng tồn kho.");
      }
      message.success("Putaway thành công. Box đã STORED và không phát sinh stock movement.");
      await load();
    } catch (error) {
      message.error(getApiErrorMessage(error, "Không xác nhận được putaway."));
    }
  };

  const cancel = async (row: PutawayTask) => {
    if (!row.draft_id || !row.draft_version || !canManage) return;
    try {
      await cancelPutawayTask(row.draft_id, row.draft_version);
      message.success("Đã hủy putaway DRAFT.");
      await load();
    } catch (error) {
      message.error(getApiErrorMessage(error, "Không hủy được putaway."));
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <div className="toolbar" style={{ marginBottom: 16 }}>
        <Input.Search
          placeholder="Box / SKU / tray..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onSearch={() => void load()}
          allowClear
          style={{ maxWidth: 360 }}
        />
        <Button icon={<ReloadOutlined />} onClick={() => void load()} loading={loading}>Làm mới</Button>
      </div>
      <Alert
        showIcon
        type="info"
        style={{ marginBottom: 16 }}
        message="PTW-00 / PTW-01 · Putaway là thao tác vị trí, tuyệt đối không làm thay đổi tồn kho."
      />
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
                pagination={{ pageSize: 15 }}
                scroll={{ x: 1100 }}
                columns={[
                  { title: "Box", dataIndex: "box_code", fixed: "left", width: 160 },
                  { title: "SKU", dataIndex: "sku_code", width: 140 },
                  { title: "Tên SKU", dataIndex: "sku_name", width: 220 },
                  { title: "SL", dataIndex: "quantity", width: 80, align: "right" },
                  { title: "Phiếu nhập", dataIndex: "receipt_code", width: 150, render: (v) => v || "-" },
                  { title: "Trạng thái", dataIndex: "status", width: 190, render: (v) => <Tag color="warning">{v}</Tag> },
                  { title: "Khay dự kiến", dataIndex: "to_tray_code", width: 150, render: (v) => v || "-" },
                  {
                    title: "Thao tác",
                    key: "actions",
                    fixed: "right",
                    width: 230,
                    render: (_, row) => row.draft_id ? (
                      <Space>
                        <Button type="primary" size="small" disabled={!canManage} onClick={() => void confirm(row)}>Xác nhận</Button>
                        <Button size="small" danger disabled={!canManage} onClick={() => void cancel(row)}>Hủy DRAFT</Button>
                      </Space>
                    ) : (
                      <Button icon={<SwapOutlined />} size="small" type="primary" disabled={!canManage} onClick={() => {
                        setSelected(row);
                        form.setFieldsValue({ location_hint: row.location_hint ?? undefined });
                      }}>
                        Xếp vào khay
                      </Button>
                    ),
                  },
                ]}
              />
            ),
          },
          {
            key: "history",
            label: "Lịch sử",
            children: (
              <Table<PutawayHistory>
                rowKey="id"
                dataSource={history}
                loading={loading}
                pagination={{ pageSize: 15 }}
                columns={[
                  { title: "Thời gian", dataIndex: "created_at" },
                  { title: "Box", dataIndex: "box_code" },
                  { title: "Khay cũ", dataIndex: "old_tray_code", render: (v) => v || "-" },
                  { title: "Khay mới", dataIndex: "new_tray_code", render: (v) => v || "-" },
                  { title: "Người thao tác", dataIndex: "actor_name", render: (v) => v || "-" },
                  { title: "Ảnh hưởng tồn", render: () => <Tag color="success">NONE</Tag> },
                ]}
              />
            ),
          },
        ]}
      />
      <Modal
        title={selected ? `PTW-01 · Xếp ${selected.box_code} vào khay` : "PTW-01 · Xếp vào khay"}
        open={Boolean(selected)}
        onCancel={() => { setSelected(null); form.resetFields(); }}
        onOk={() => void createDraft()}
        okText="Tạo DRAFT"
        okButtonProps={{ disabled: !canManage }}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="to_tray_id" label="Khay đích" rules={[{ required: true, message: "Chọn khay đích." }]}>
            <Select showSearch optionFilterProp="label" options={trayOptions} placeholder="Chọn TRAY khả dụng" />
          </Form.Item>
          <Form.Item name="location_hint" label="Vị trí gợi ý"><Input placeholder="VD: A-01-02" /></Form.Item>
          <Form.Item name="note" label="Ghi chú"><Input.TextArea rows={3} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
