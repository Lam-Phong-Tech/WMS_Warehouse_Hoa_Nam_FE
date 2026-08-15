import { useState } from "react";
import {
  Alert,
  Col,
  DatePicker,
  Form,
  Input,
  Modal,
  Radio,
  Row,
  Select,
  Space,
} from "antd";
import { toast } from "sonner";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import { CameraOutlined, CloseOutlined, SaveOutlined } from "@ant-design/icons";
import { Button } from "antd";
import {
  extractFieldErrorsRaw,
  getApiErrorMessage,
  getErrorRequestId,
} from "@/shared/api/api-error";
import { CameraScanModal } from "@/shared/components/forms/CameraScanModal";
import { ScanInput } from "@/shared/components/forms/ScanInput";
import { useMvpDefects } from "@/modules/master-data/hooks/use-mvp-master";
import { useCreateWarrantyCase } from "@/modules/warranty/hooks/use-warranty";
import type {
  WarrantyCase,
  WarrantyIdentificationType,
} from "@/modules/warranty/types";

interface IntakeFormValues {
  identification_type: WarrantyIdentificationType;
  item_code?: string;
  missing_code_reason?: string;
  manual_product_description?: string;
  customer_name: string;
  customer_phone: string;
  customer_address?: string;
  purchase_date?: Dayjs;
  defect_id?: string;
  reported_defect: string;
  accessories_received?: string;
  received_condition?: string;
}

interface WarrantyIntakeModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (created: WarrantyCase) => void;
}

/**
 * WAR-02 · Tiếp nhận bảo hành (BP-WMS-08 IDENTIFIED / BP-WMS-09 TEMP_ONLY).
 * Stock-neutral: tạo case không sinh movement; mã tạm do BE sinh.
 */
export function WarrantyIntakeModal({
  open,
  onClose,
  onCreated,
}: WarrantyIntakeModalProps) {
  const [form] = Form.useForm<IntakeFormValues>();
  const [formError, setFormError] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const identificationType = Form.useWatch("identification_type", form);
  const itemCode = Form.useWatch("item_code", form);
  const createMutation = useCreateWarrantyCase();
  const defectsQuery = useMvpDefects({ status: "ACTIVE", per_page: 100 });

  const submit = async () => {
    setFormError(null);
    let values: IntakeFormValues;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }

    try {
      const created = await createMutation.mutateAsync({
        identification_type: values.identification_type,
        item_code: values.item_code?.trim(),
        missing_code_reason: values.missing_code_reason?.trim(),
        manual_product_description: values.manual_product_description?.trim(),
        customer_name: values.customer_name.trim(),
        customer_phone: values.customer_phone.trim(),
        customer_address: values.customer_address?.trim(),
        purchase_date: values.purchase_date
          ? values.purchase_date.format("YYYY-MM-DD")
          : undefined,
        defect_id: values.defect_id,
        defect_description: values.reported_defect.trim(),
        reported_defect: values.reported_defect.trim(),
        accessories_received: values.accessories_received?.trim(),
        received_condition: values.received_condition?.trim(),
      });
      toast.success(
        created.identification_type === "TEMP_ONLY" &&
          created.temporary_item_code
          ? `Đã tạo case ${created.case_code} — mã tạm ${created.temporary_item_code}.`
          : `Đã tạo case bảo hành ${created.case_code}.`,
      );
      form.resetFields();
      onCreated(created);
    } catch (error: unknown) {
      const fieldErrors = extractFieldErrorsRaw(error);
      if (fieldErrors) {
        form.setFields(
          Object.entries(fieldErrors).map(([name, errors]) => ({
            name: [name] as never,
            errors: [errors],
          })),
        );
      }
      const requestId = getErrorRequestId(error);
      const errorMsg = `${getApiErrorMessage(error, "Không tạo được case bảo hành.")}${
        requestId ? ` — Request ${requestId}` : ""
      }`;
      toast.error(errorMsg);
      setFormError(errorMsg);
    }
  };

  return (
    <Modal
      title="Tiếp nhận bảo hành"
      open={open}
      onCancel={onClose}
      footer={
        <Space>
          <Button icon={<CloseOutlined />} onClick={onClose}>
            Hủy
          </Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={createMutation.isPending}
            onClick={submit}
          >
            Lưu tiếp nhận
          </Button>
        </Space>
      }
      width={860}
      centered
      mask={{ closable: false }}
      destroyOnHidden
    >
      {formError ? (
        <Alert
          type="error"
          showIcon
          title={formError}
          style={{ marginBottom: 12 }}
        />
      ) : null}
      <Form
        form={form}
        layout="vertical"
        initialValues={{ identification_type: "IDENTIFIED" }}
      >
        <Form.Item
          name="identification_type"
          label="Loại tiếp nhận"
          rules={[{ required: true, message: "Chọn loại tiếp nhận." }]}
        >
          <Radio.Group
            optionType="button"
            buttonStyle="solid"
            options={[
              { value: "IDENTIFIED", label: "Có mã máy (IDENTIFIED)" },
              { value: "TEMP_ONLY", label: "Mất mã (TEMP_ONLY)" },
            ]}
          />
        </Form.Item>

        {identificationType === "TEMP_ONLY" ? (
          <>
            <Alert
              type="warning"
              showIcon
              title="Case TEMP_ONLY không liên kết item gốc, không xác nhận lịch sử bán hàng (NOT_TRACEABLE) và không sinh stock movement. Mã tạm sẽ do hệ thống sinh sau khi lưu."
              style={{ marginBottom: 12 }}
            />
            <Form.Item
              name="missing_code_reason"
              label="Lý do mất/không có mã"
              rules={[{ required: true, message: "Nhập lý do bắt buộc." }]}
            >
              <Input.TextArea rows={2} maxLength={500} showCount />
            </Form.Item>
            <Form.Item
              name="manual_product_description"
              label="Mô tả nhận diện máy"
              rules={[{ required: true, message: "Nhập mô tả máy bắt buộc." }]}
            >
              <Input.TextArea rows={2} maxLength={2000} showCount />
            </Form.Item>
          </>
        ) : (
          <Form.Item
            name="item_code"
            label="Mã máy / serial / barcode item"
            rules={[
              {
                required: true,
                message: "Quét hoặc nhập mã máy cần bảo hành.",
              },
            ]}
            extra="Item phải đã xuất cho khách (ISSUED hoặc RETURNED_TO_CUSTOMER) và chưa có case bảo hành đang hoạt động."
          >
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1 }}>
                <ScanInput
                  value={itemCode ?? ""}
                  size="middle"
                  autoFocus={false}
                  placeholder="Quét Barcode/QR hoặc nhập serial"
                  onChange={(value) => form.setFieldValue("item_code", value)}
                  onScan={(code) => form.setFieldValue("item_code", code)}
                />
              </div>
              <Button
                icon={<CameraOutlined />}
                onClick={() => setCameraOpen(true)}
              >
                Camera
              </Button>
            </div>
          </Form.Item>
        )}

        <Row gutter={12}>
          <Col xs={24} md={12}>
            <Form.Item
              name="customer_name"
              label="Tên khách gửi"
              rules={[{ required: true, message: "Nhập tên khách gửi." }]}
            >
              <Input maxLength={200} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="customer_phone"
              label="Số điện thoại"
              rules={[
                { required: true, message: "Nhập số điện thoại." },
                {
                  pattern: /^[0-9+\-\s()]{8,20}$/,
                  message: "Số điện thoại chưa hợp lệ.",
                },
              ]}
            >
              <Input maxLength={30} />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={12}>
          <Col xs={24} md={16}>
            <Form.Item name="customer_address" label="Địa chỉ khách (PII)">
              <Input maxLength={1000} />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item name="purchase_date" label="Ngày mua (nếu có)">
              <DatePicker
                style={{ width: "100%" }}
                format="DD/MM/YYYY"
                disabledDate={(current) =>
                  current && current > dayjs().endOf("day")
                }
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={12}>
          <Col xs={24} md={12}>
            <Form.Item name="defect_id" label="Bệnh / lỗi (danh mục)">
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                loading={defectsQuery.isLoading}
                placeholder="Chọn từ danh mục bệnh/lỗi"
                options={(defectsQuery.data?.data ?? []).map((defect) => ({
                  value: defect.defect_id,
                  label: `${defect.defect_code} · ${defect.defect_name}`,
                }))}
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="accessories_received" label="Phụ kiện đi kèm">
              <Input maxLength={1000} placeholder="VD: Pin 20V, sạc, hộp" />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          name="reported_defect"
          label="Bệnh / lỗi khách phản ánh"
          rules={[
            { required: true, message: "Nhập mô tả lỗi khách phản ánh." },
          ]}
        >
          <Input.TextArea rows={3} maxLength={2000} showCount />
        </Form.Item>

        <Form.Item
          name="received_condition"
          label="Tình trạng máy khi tiếp nhận"
        >
          <Input.TextArea
            rows={2}
            maxLength={500}
            showCount
            placeholder="VD: Trầy xước nhẹ thân máy, còn nguyên tem"
          />
        </Form.Item>
      </Form>

      <CameraScanModal
        open={cameraOpen}
        title="Quét mã máy bảo hành"
        onDetected={(code) => {
          form.setFieldValue("item_code", code.trim().toUpperCase());
          setCameraOpen(false);
        }}
        onClose={() => setCameraOpen(false)}
      />
    </Modal>
  );
}
