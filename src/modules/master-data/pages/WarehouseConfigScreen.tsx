import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Form,
  Input,
  Popconfirm,
  Row,
  Select,
  Skeleton,
  Space,
  Tag,
  Typography,
} from "antd";
import { HomeOutlined, ReloadOutlined, SaveOutlined } from "@ant-design/icons";
import {
  fetchWarehouse,
  fetchWarehouses,
  updateWarehouse,
} from "@/modules/master-data/services/warehouse.service";
import type { MasterStatus } from "@/modules/master-data/types/mvp-master.types";
import { getApiErrorMessage, normalizeError } from "@/shared/api/api-error";
import { useCan } from "@/shared/components/permission";
import { WMS_PERMISSION_CATALOG as P } from "@/shared/constants/wms-permissions";

interface WarehouseRecord {
  id: string;
  code: string;
  name: string;
  address: string;
  contact_person: string;
  phone: string;
  status: MasterStatus;
}

interface WarehouseFormValues {
  name: string;
  address?: string;
  contact_person?: string;
  phone?: string;
  status: MasterStatus;
}

const STATUS_OPTIONS: Array<{ value: MasterStatus; label: string }> = [
  { value: "ACTIVE", label: "Đang hoạt động" },
  { value: "INACTIVE", label: "Ngừng hoạt động" },
];

function text(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

function toWarehouse(row: Record<string, unknown>): WarehouseRecord {
  const status = text(row.status).toUpperCase();
  return {
    id: text(row.id ?? row.warehouse_id),
    code: text(row.code ?? row.warehouse_code),
    name: text(row.name ?? row.warehouse_name),
    address: text(row.address),
    contact_person: text(row.contact_person),
    phone: text(row.phone),
    status: status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
  };
}

/** REQ-SRS-001: BE là nguồn thực thi rule "đúng 01 kho ACTIVE". */
function saveErrorMessage(error: unknown): string {
  const normalized = normalizeError(error);
  if (normalized.code === "STATE_CONFLICT") {
    return "Hệ thống chỉ cho phép đúng một kho ở trạng thái Đang hoạt động (REQ-SRS-001). Hãy chuyển kho đang hoạt động sang Ngừng hoạt động trước khi kích hoạt kho này.";
  }
  if (normalized.code === "ACCESS_DENIED") {
    return "Kho này nằm ngoài phạm vi dữ liệu của tài khoản. Liên hệ quản trị viên để được cấp scope.";
  }
  return getApiErrorMessage(error, "Không lưu được cấu hình kho.");
}

export function WarehouseConfigScreen() {
  const [form] = Form.useForm<WarehouseFormValues>();
  const queryClient = useQueryClient();
  const canManage = useCan(P.WAREHOUSE_MANAGE);

  const [selectedId, setSelectedId] = useState("");
  const [saveError, setSaveError] = useState("");
  const [savedAt, setSavedAt] = useState("");
  // Trạng thái đang chọn trên form (chưa lưu) để biết khi nào cần bước xác nhận.
  const draftStatus = Form.useWatch("status", form);

  const listQuery = useQuery({
    queryKey: ["warehouse", "list"],
    queryFn: () => fetchWarehouses({ per_page: 50 }),
  });

  const warehouses = useMemo(
    () => (listQuery.data ?? []).map(toWarehouse).filter((row) => row.id),
    [listQuery.data],
  );

  // Kho tổng duy nhất là mặc định; danh sách nhiều dòng chỉ xảy ra với dữ liệu
  // cũ nên vẫn cho chọn để người dùng ngừng kích hoạt kho thừa.
  const resolvedId =
    warehouses.find((row) => row.id === selectedId)?.id ??
    warehouses.find((row) => row.status === "ACTIVE")?.id ??
    warehouses[0]?.id ??
    "";

  const detailQuery = useQuery({
    queryKey: ["warehouse", "detail", resolvedId],
    queryFn: () => fetchWarehouse(resolvedId),
    enabled: Boolean(resolvedId),
  });

  const warehouse = useMemo(
    () => (detailQuery.data ? toWarehouse(detailQuery.data) : null),
    [detailQuery.data],
  );

  useEffect(() => {
    if (!warehouse) return;
    form.setFieldsValue({
      name: warehouse.name,
      address: warehouse.address,
      contact_person: warehouse.contact_person,
      phone: warehouse.phone,
      status: warehouse.status,
    });
  }, [form, warehouse]);

  const saveMutation = useMutation({
    mutationFn: (values: WarehouseFormValues) =>
      updateWarehouse(resolvedId, {
        name: values.name.trim(),
        address: values.address?.trim() || null,
        contact_person: values.contact_person?.trim() || null,
        phone: values.phone?.trim() || null,
        status: values.status,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["warehouse"] }),
  });

  const handleSubmit = async () => {
    setSaveError("");
    setSavedAt("");
    let values: WarehouseFormValues;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    try {
      await saveMutation.mutateAsync(values);
      setSavedAt(new Date().toLocaleString("vi-VN"));
    } catch (error) {
      setSaveError(saveErrorMessage(error));
    }
  };

  const listError = listQuery.error
    ? getApiErrorMessage(listQuery.error, "Không tải được danh sách kho.")
    : "";
  const detailError = detailQuery.error
    ? getApiErrorMessage(detailQuery.error, "Không tải được thông tin kho.")
    : "";

  const statusChanged =
    Boolean(warehouse) &&
    Boolean(draftStatus) &&
    draftStatus !== warehouse?.status;
  const saveButton = (
    <Button
      type="primary"
      icon={<SaveOutlined />}
      loading={saveMutation.isPending}
      disabled={!canManage || !resolvedId}
      onClick={statusChanged ? undefined : handleSubmit}
    >
      Lưu cấu hình
    </Button>
  );

  return (
    <Space orientation="vertical" size={16} style={{ width: "100%" }}>
      <Row justify="space-between" align="middle" gutter={[12, 12]}>
        <Col>
          <Space align="center">
            <HomeOutlined />
            <div>
              <Typography.Title level={3} style={{ margin: 0 }}>
                Cấu hình kho tổng
              </Typography.Title>
              <Typography.Text type="secondary">
                Thông tin, liên hệ và trạng thái của kho tổng duy nhất
                (REQ-SRS-001 · SCR-WH-01).
              </Typography.Text>
            </div>
          </Space>
        </Col>
        <Col>
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                void listQuery.refetch();
                void detailQuery.refetch();
              }}
            >
              Làm mới
            </Button>
            {statusChanged ? (
              <Popconfirm
                title="Đổi trạng thái kho?"
                description="Hệ thống chỉ cho phép đúng một kho Đang hoạt động. Thao tác này không sinh chứng từ và không làm thay đổi tồn kho (stock effect = 0)."
                okText="Đồng ý"
                cancelText="Huỷ"
                onConfirm={handleSubmit}
              >
                {saveButton}
              </Popconfirm>
            ) : (
              saveButton
            )}
          </Space>
        </Col>
      </Row>

      <Alert
        type="info"
        showIcon
        title="Phạm vi một kho tổng"
        description="Hệ thống vận hành đúng một kho tổng: API không mở tạo/xoá kho, chỉ cho xem và sửa thông tin. Bật Đang hoạt động cho kho thứ hai sẽ bị backend từ chối bằng lỗi 409 STATE_CONFLICT."
      />

      {listError && <Alert type="error" showIcon title={listError} />}
      {detailError && <Alert type="error" showIcon title={detailError} />}
      {saveError && <Alert type="error" showIcon title={saveError} />}
      {savedAt && (
        <Alert
          type="success"
          showIcon
          title="Đã lưu cấu hình kho"
          description={`Cập nhật lúc ${savedAt}.`}
        />
      )}

      {!listQuery.isLoading && warehouses.length === 0 && !listError && (
        <Alert
          type="warning"
          showIcon
          title="Chưa có kho tổng trong hệ thống"
          description="API không mở endpoint tạo kho; liên hệ quản trị hệ thống để khởi tạo kho tổng trước khi cấu hình."
        />
      )}

      {warehouses.length > 1 && (
        <Alert
          type="warning"
          showIcon
          title={`Đang có ${warehouses.length} kho trong dữ liệu`}
          description="Chỉ được giữ đúng một kho Đang hoạt động — chọn từng kho bên dưới để ngừng kích hoạt kho thừa."
        />
      )}

      <Card>
        {listQuery.isLoading || detailQuery.isLoading ? (
          <Skeleton active paragraph={{ rows: 6 }} />
        ) : !warehouse ? (
          <Typography.Text type="secondary">
            Chưa có kho để hiển thị.
          </Typography.Text>
        ) : (
          <>
            {warehouses.length > 1 && (
              <Row style={{ marginBottom: 16 }}>
                <Col xs={24} md={12}>
                  <Typography.Text type="secondary">Chọn kho</Typography.Text>
                  <Select
                    value={resolvedId}
                    style={{ width: "100%", marginTop: 6 }}
                    aria-label="Chọn kho"
                    onChange={(value: string) => {
                      setSelectedId(value);
                      setSaveError("");
                      setSavedAt("");
                    }}
                    options={warehouses.map((row) => ({
                      value: row.id,
                      label: `${row.code} · ${row.name}`,
                    }))}
                  />
                </Col>
              </Row>
            )}

            <Descriptions
              size="small"
              column={{ xs: 1, md: 2 }}
              style={{ marginBottom: 16 }}
              items={[
                { key: "code", label: "Mã kho", children: warehouse.code },
                {
                  key: "status",
                  label: "Trạng thái hiện tại",
                  children: (
                    <Tag
                      color={
                        warehouse.status === "ACTIVE" ? "success" : "default"
                      }
                    >
                      {warehouse.status === "ACTIVE"
                        ? "Đang hoạt động"
                        : "Ngừng hoạt động"}
                    </Tag>
                  ),
                },
              ]}
            />

            <Form
              form={form}
              layout="vertical"
              disabled={!canManage || saveMutation.isPending}
            >
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="name"
                    label="Tên kho"
                    rules={[
                      { required: true, message: "Nhập tên kho." },
                      { max: 200, message: "Tối đa 200 ký tự." },
                    ]}
                  >
                    <Input placeholder="Kho tổng Hòa Nam" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="status"
                    label="Trạng thái"
                    rules={[{ required: true, message: "Chọn trạng thái." }]}
                  >
                    <Select options={STATUS_OPTIONS} />
                  </Form.Item>
                </Col>
                <Col xs={24}>
                  <Form.Item
                    name="address"
                    label="Địa chỉ"
                    rules={[{ max: 500, message: "Tối đa 500 ký tự." }]}
                  >
                    <Input.TextArea rows={2} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="contact_person"
                    label="Người liên hệ"
                    rules={[{ max: 200, message: "Tối đa 200 ký tự." }]}
                  >
                    <Input />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="phone"
                    label="Số điện thoại"
                    rules={[{ max: 30, message: "Tối đa 30 ký tự." }]}
                  >
                    <Input inputMode="tel" />
                  </Form.Item>
                </Col>
              </Row>
            </Form>

            {!canManage && (
              <Typography.Text type="secondary">
                Tài khoản chỉ có quyền xem (warehouse.view) nên không sửa được
                cấu hình kho.
              </Typography.Text>
            )}
          </>
        )}
      </Card>
    </Space>
  );
}
