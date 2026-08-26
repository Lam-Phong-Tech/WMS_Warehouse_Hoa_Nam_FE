import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
  Upload,
} from "antd";
import type { UploadFile, UploadProps } from "antd";
import { toast } from "sonner";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import {
  CameraOutlined,
  CloseOutlined,
  SaveOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import { Button } from "antd";
import {
  extractFieldErrorsRaw,
  getApiErrorMessage,
  getErrorRequestId,
} from "@/shared/api/api-error";
import { CameraScanModal } from "@/shared/components/forms/CameraScanModal";
import { ScanInput } from "@/shared/components/forms/ScanInput";
import { useMvpDefects } from "@/modules/master-data/hooks/use-mvp-master";
import { fetchWarehouses } from "@/modules/master-data/services/warehouse.service";
import { classifyScanCodes } from "@/modules/scan/services/scanService";
import {
  useCreateWarrantyCase,
  useUploadWarrantyAttachment,
} from "@/modules/warranty/hooks/use-warranty";
import type {
  WarrantyCase,
  WarrantyIdentificationType,
} from "@/modules/warranty/types";

// Annex D SCR-WAR-01 field `images`: jpg/png/webp; <=10 files; <=10MB/file.
const MAX_INTAKE_IMAGES = 10;
const MAX_INTAKE_IMAGE_BYTES = 10 * 1024 * 1024;
const INTAKE_IMAGE_MIMES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];

interface IntakeFormValues {
  identification_type: WarrantyIdentificationType;
  item_code?: string;
  missing_code_reason?: string;
  manual_product_description?: string;
  customer_name: string;
  customer_phone: string;
  customer_address?: string;
  purchase_date?: Dayjs;
  defect_ids?: string[];
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
  const [imageFiles, setImageFiles] = useState<UploadFile[]>([]);
  const identificationType = Form.useWatch("identification_type", form);
  const itemCode = Form.useWatch("item_code", form);
  const createMutation = useCreateWarrantyCase();
  const uploadMutation = useUploadWarrantyAttachment();
  const defectsQuery = useMvpDefects({ status: "ACTIVE", per_page: 100 });
  // Change Pack QR/SKU (guide §13 WAR-02): quét raw QR -> classify(WARRANTY) ->
  // tự điền item/SKU; classify cần warehouse_id (REQ-SRS-001: một kho ACTIVE).
  const warehousesQuery = useQuery({
    queryKey: ["warranty", "intake-warehouse"],
    queryFn: () => fetchWarehouses({ status: "ACTIVE" }),
    enabled: open,
  });
  const warehouse = warehousesQuery.data?.[0];
  const [resolvedItem, setResolvedItem] = useState<{
    skuCode?: string;
    itemUnique?: string;
    objectStatus?: string;
  } | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);

  /**
   * AC-QR-06: backend là resolver authoritative — FE gửi RAW payload vào
   * classify, nhận normalized item_code + SKU để tự điền. Không resolve được thì
   * GIỮ nguyên mã đã quét (BE create sẽ revalidate) và gợi ý TEMP_ONLY, tuyệt
   * đối không auto-switch (guide §13: "không auto-switch silent").
   */
  const resolveScannedCode = async (rawCode: string) => {
    const code = rawCode.trim();
    if (!code) return;
    form.setFieldValue("item_code", code);
    setResolvedItem(null);
    setResolveError(null);
    if (!warehouse?.id) return;
    try {
      const classified = await classifyScanCodes({
        raw_code: code,
        context: "WARRANTY_RECEIVE",
        warehouse_id: String(warehouse.id),
      });
      form.setFieldValue("item_code", classified.normalized_code_value || code);
      setResolvedItem({
        skuCode: classified.sku_code,
        itemUnique: classified.item_unique,
        objectStatus: classified.object_status,
      });
    } catch (error) {
      setResolveError(
        getApiErrorMessage(
          error,
          "Không resolve được mã từ QR; kiểm tra lại hoặc chuyển TEMP_ONLY.",
        ),
      );
    }
  };

  // Ảnh chỉ được giữ lại ở client tới khi case có id; BE giới hạn 10 file ACTIVE
  // mỗi case, mimes jpg/jpeg/png/webp/heic/pdf và 10240KB mỗi file.
  const imageUploadProps: UploadProps = {
    multiple: true,
    listType: "picture",
    accept: ".jpg,.jpeg,.png,.webp",
    fileList: imageFiles,
    disabled: createMutation.isPending || uploadMutation.isPending,
    beforeUpload: (file, batch) => {
      if (!INTAKE_IMAGE_MIMES.includes(file.type)) {
        toast.error(`${file.name}: chỉ nhận ảnh JPG/PNG/WEBP.`);
        return Upload.LIST_IGNORE;
      }
      if (file.size > MAX_INTAKE_IMAGE_BYTES) {
        toast.error(`${file.name}: vượt quá 10MB.`);
        return Upload.LIST_IGNORE;
      }
      const slot = imageFiles.length + Math.max(0, batch.indexOf(file));
      if (slot >= MAX_INTAKE_IMAGES) {
        toast.error(`Tối đa ${MAX_INTAKE_IMAGES} ảnh cho một case bảo hành.`);
        return Upload.LIST_IGNORE;
      }
      return false;
    },
    onChange: (info) => setImageFiles(info.fileList),
  };

  // Annex D SCR-WAR-01: `images` chỉ lưu attachment IDs nên case phải tồn tại
  // trước mới đính kèm được. Lỗi upload không rollback case: case là bản ghi
  // nghiệp vụ chính, ảnh có thể bổ sung lại ở màn chi tiết case (WAR-03).
  const uploadIntakeImages = async (created: WarrantyCase) => {
    const files = imageFiles
      .map((item) => item.originFileObj)
      .filter((file): file is NonNullable<typeof file> => Boolean(file));
    if (files.length === 0) return;

    const results = await Promise.allSettled(
      files.map((file) =>
        uploadMutation.mutateAsync({
          caseId: created.id,
          file,
          attachmentType: "INTAKE",
        }),
      ),
    );
    const failed = results.filter((result) => result.status === "rejected");
    if (failed.length === 0) {
      toast.success(`Đã đính kèm ${files.length} ảnh tiếp nhận.`);
      return;
    }
    toast.error(
      `Đã tạo case ${created.case_code} nhưng ${failed.length}/${files.length} ảnh chưa tải lên được. Vào chi tiết case để đính kèm lại.`,
    );
  };

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
        defect_ids: values.defect_ids,
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
      await uploadIntakeImages(created);
      form.resetFields();
      setImageFiles([]);
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
        <Space wrap>
          <Button icon={<CloseOutlined />} onClick={onClose}>
            Hủy
          </Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={createMutation.isPending || uploadMutation.isPending}
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
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <div style={{ flex: 1 }}>
                <ScanInput
                  value={itemCode ?? ""}
                  size="middle"
                  // Annex D SCR-WAR-01 scan-focus: ô quét tự nhận focus khi mở WAR-02
                  // ở nhánh IDENTIFIED để đầu đọc bắn được ngay.
                  autoFocus
                  placeholder="Quét QR composite / Barcode hoặc nhập serial"
                  onChange={(value) => {
                    form.setFieldValue("item_code", value);
                    setResolvedItem(null);
                    setResolveError(null);
                  }}
                  onScan={(code) => void resolveScannedCode(code)}
                />
              </div>
              <Button
                icon={<CameraOutlined />}
                onClick={() => setCameraOpen(true)}
              >
                Camera
              </Button>
            </div>
            {resolvedItem ? (
              <Alert
                type="success"
                showIcon
                style={{ marginTop: 8 }}
                title={`Đã nhận diện item${
                  resolvedItem.skuCode ? ` · SKU ${resolvedItem.skuCode}` : ""
                }${resolvedItem.itemUnique ? ` · ${resolvedItem.itemUnique}` : ""}${
                  resolvedItem.objectStatus
                    ? ` · trạng thái ${resolvedItem.objectStatus}`
                    : ""
                }`}
              />
            ) : null}
            {resolveError ? (
              <Alert
                type="warning"
                showIcon
                style={{ marginTop: 8 }}
                title={resolveError}
                description="Nếu QR hỏng hoặc item không định danh được, chuyển sang tab “Mất mã (TEMP_ONLY)” — hệ thống không tự suy đoán liên kết item."
              />
            ) : null}
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
              // Rà soát validate định dạng input (Flow04 Warranty): SĐT khách VN —
              // bắt buộc 10 chữ số, bắt đầu bằng 0, không cho nhập chữ. normalize
              // strip mọi ký tự không phải số ngay lúc gõ (đồng bộ với IamUserScreen).
              normalize={(value: string | undefined) =>
                (value ?? "").replace(/\D/g, "").slice(0, 10)
              }
              rules={[
                { required: true, message: "Nhập số điện thoại." },
                {
                  pattern: /^0\d{9}$/,
                  message:
                    "Số điện thoại phải đủ 10 chữ số và bắt đầu bằng số 0.",
                },
              ]}
            >
              <Input inputMode="numeric" maxLength={10} />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={12}>
          <Col xs={24} md={16}>
            <Form.Item name="customer_address" label="Địa chỉ khách (PII)">
              {/* Annex A/D: customer_address tối đa 500 ký tự. */}
              <Input maxLength={500} />
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
            <Form.Item name="defect_ids" label="Bệnh / lỗi (danh mục)">
              <Select
                mode="multiple"
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

        <Form.Item
          label="Ảnh đính kèm"
          extra="JPG/PNG/WEBP, tối đa 10 ảnh, mỗi ảnh ≤ 10MB. Ảnh được tải lên sau khi case bảo hành được tạo."
        >
          <Upload {...imageUploadProps}>
            <Button
              icon={<UploadOutlined />}
              disabled={
                imageFiles.length >= MAX_INTAKE_IMAGES ||
                createMutation.isPending ||
                uploadMutation.isPending
              }
            >
              Chọn ảnh tiếp nhận ({imageFiles.length}/{MAX_INTAKE_IMAGES})
            </Button>
          </Upload>
        </Form.Item>
      </Form>

      <CameraScanModal
        open={cameraOpen}
        title="Quét mã máy bảo hành"
        onDetected={(code) => {
          // Change Pack QR/SKU: gửi RAW payload cho backend resolve — FE không
          // tự tách/parse; classify trả normalized item_code + SKU để tự điền.
          void resolveScannedCode(code);
          setCameraOpen(false);
        }}
        onClose={() => setCameraOpen(false)}
      />
    </Modal>
  );
}
