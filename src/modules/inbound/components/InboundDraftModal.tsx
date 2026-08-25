import { useEffect, useRef } from "react";
import { Alert, Button, Col, Form, Input, Modal, Row, Select, Space } from "antd";
import { SaveOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { getApiErrorMessage, normalizeError } from "@/shared/api/api-error";
import {
  hasAnyWmsPermission,
  WMS_PERMISSION_CATALOG as P,
} from "@/shared/constants/wms-permissions";
import { useAuthStore } from "@/shared/store/auth.store";
import { fetchWarehouses } from "@/modules/master-data/services/warehouse.service";
import {
  useCreateInbound,
  useInboundDetail,
  useUpdateInbound,
} from "@/modules/inbound/hooks/use-inbound";
import type {
  CreateInboundPayload,
  UpdateInboundPayload,
} from "@/modules/inbound/types";

interface FormValues {
  warehouseId: string;
  documentDate: string;
  sourceName?: string;
  note?: string;
}

export interface InboundDraftModalProps {
  documentId: string | null;
  onClose: () => void;
  onSaved: (documentId: string) => void;
}

function localToday(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function text(value: unknown): string {
  return value === undefined || value === null ? "" : String(value);
}

function useInboundPermission(code: string) {
  const permissionCodes = useAuthStore((state) => state.permissionCodes);
  const isSuperAdmin = useAuthStore((state) => state.isSuperAdmin);
  return hasAnyWmsPermission(permissionCodes, [code], isSuperAdmin);
}

/**
 * GĐ1 IN-02 — create/edit only the receipt header.
 * SKU and quantity are never entered here; scan is the authoritative source.
 */
export function InboundDraftModal({
  documentId,
  onClose,
  onSaved,
}: InboundDraftModalProps) {
  const [form] = Form.useForm<FormValues>();
  const initializedRef = useRef<string | null>(null);
  const detailQuery = useInboundDetail(documentId);
  const warehousesQuery = useQuery({
    queryKey: ["warehouses", "inbound-active"],
    queryFn: () => fetchWarehouses({ status: "ACTIVE", per_page: 100 }),
  });
  const createMutation = useCreateInbound();
  const updateMutation = useUpdateInbound();
  const canCreate = useInboundPermission(P.INBOUND_CREATE);
  const detail = detailQuery.data;
  const status = detail?.document.status;
  const mutable = !documentId || status === "DRAFT" || status === "SCANNING";
  const saving = createMutation.isPending || updateMutation.isPending;

  useEffect(() => {
    if (!documentId) {
      const firstWarehouse = warehousesQuery.data?.[0] as
        | Record<string, unknown>
        | undefined;
      form.setFieldsValue({
        documentDate: localToday(),
        warehouseId: text(firstWarehouse?.id ?? firstWarehouse?.warehouse_id),
        sourceName: "",
        note: "",
      });
      return;
    }
    if (!detail || initializedRef.current === documentId) return;
    form.setFieldsValue({
      documentDate: detail.document.date?.slice(0, 10) || localToday(),
      warehouseId: detail.document.warehouseId,
      sourceName: detail.document.source === "-" ? "" : detail.document.source,
      note: detail.document.note ?? "",
    });
    initializedRef.current = documentId;
  }, [detail, documentId, form, warehousesQuery.data]);

  const warehouseOptions = (warehousesQuery.data ?? []).map(
    (warehouse: Record<string, unknown>) => {
      const id = text(warehouse.id ?? warehouse.warehouse_id);
      const label = [text(warehouse.code), text(warehouse.name)]
        .filter(Boolean)
        .join(" · ");
      return { value: id, label: label || id };
    },
  );

  const handleSave = async (values: FormValues) => {
    if (!canCreate || !mutable) return;
    try {
      if (documentId) {
        if (!detail) return;
        const payload: UpdateInboundPayload = {
          doc_date: values.documentDate || null,
          source_reference: values.sourceName?.trim() || null,
          note: values.note?.trim() || null,
        };
        const updated = await updateMutation.mutateAsync({
          id: documentId,
          payload,
          ifMatch: detail.document.version,
        });
        toast.success("Đã cập nhật thông tin phiếu nhập.");
        onSaved(updated.id);
        return;
      }

      const payload: CreateInboundPayload = {
        doc_date: values.documentDate || null,
        dst_warehouse_id: values.warehouseId,
        source_reference: values.sourceName?.trim() || null,
        note: values.note?.trim() || null,
      };
      const created = await createMutation.mutateAsync(payload);
      toast.success("Đã tạo phiếu nhập. Quét hàng để hệ thống tự nhận SKU và số lượng.");
      onSaved(created.id);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không lưu được phiếu nhập."));
      if (documentId) {
        initializedRef.current = null;
        await detailQuery.refetch();
      }
    }
  };

  return (
    <Modal
      title={documentId ? "Thông tin phiếu nhập" : "Tạo phiếu nhập"}
      open
      width={760}
      footer={null}
      onCancel={onClose}
      centered
      mask={{ closable: false }}
      closable={!saving}
      destroyOnHidden
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        title="Phiếu nhập theo số lượng quét thực tế"
        description="Không nhập SKU hoặc số lượng dự kiến. Sau khi tạo phiếu, quét QR/Barcode sản phẩm; hệ thống tự nhận SKU, tự cộng số lượng theo SKU và chỉ tăng tồn khi bấm Ghi nhận nhập."
      />

      {detailQuery.isError ? (
        <Alert
          showIcon
          type={normalizeError(detailQuery.error).status === 403 ? "warning" : "error"}
          title={getApiErrorMessage(detailQuery.error, "Không tải được phiếu nhập.")}
          style={{ marginBottom: 16 }}
        />
      ) : null}

      {documentId && !mutable ? (
        <Alert
          showIcon
          type="info"
          title="Phiếu đã kết thúc và chỉ được xem"
          style={{ marginBottom: 16 }}
        />
      ) : null}

      <Form<FormValues>
        form={form}
        layout="vertical"
        onFinish={(values) => void handleSave(values)}
      >
        <Row gutter={12}>
          <Col xs={24} md={12}>
            <Form.Item
              label="Ngày chứng từ"
              name="documentDate"
              rules={[{ required: true, message: "Chọn ngày chứng từ." }]}
            >
              <Input type="date" disabled={!mutable} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              label="Kho nhận"
              name="warehouseId"
              rules={[{ required: true, message: "Chọn kho nhận." }]}
            >
              <Select
                showSearch
                optionFilterProp="label"
                loading={warehousesQuery.isLoading}
                options={warehouseOptions}
                disabled={!mutable || Boolean(documentId)}
                placeholder="Chọn kho nhận"
              />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item label="Nguồn / tham chiếu" name="sourceName">
          <Input
            maxLength={200}
            disabled={!mutable}
            placeholder="Chứng từ vận chuyển / nhà cung cấp (tùy chọn)"
          />
        </Form.Item>

        <Form.Item label="Ghi chú" name="note">
          <Input.TextArea rows={3} maxLength={1000} showCount disabled={!mutable} />
        </Form.Item>

        <Space style={{ width: "100%", justifyContent: "flex-end" }}>
          <Button onClick={onClose}>Đóng</Button>
          {mutable && canCreate ? (
            <Button
              type="primary"
              htmlType="submit"
              icon={<SaveOutlined />}
              loading={saving}
            >
              {documentId ? "Lưu thông tin" : "Tạo phiếu & quét hàng"}
            </Button>
          ) : null}
        </Space>
      </Form>
    </Modal>
  );
}
