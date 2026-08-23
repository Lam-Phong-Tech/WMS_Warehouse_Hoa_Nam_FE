import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert, Descriptions, Form, Input, Modal, Select, Tag } from "antd";
import { toast } from "sonner";
import { useMvpSkus } from "@/modules/master-data/hooks/use-mvp-master";
import { getApiErrorMessage } from "@/shared/api/api-error";
import { issueItemPhysicalCode } from "../services/scanService";
import type {
  IssueItemPhysicalCodeResult,
  IssuePhysicalCodeCarrierType,
} from "../types";

interface IssuePhysicalCodeModalProps {
  open: boolean;
  onClose: () => void;
  /** Gọi sau khi tạo thành công để trang danh sách refetch. */
  onIssued?: (result: IssueItemPhysicalCodeResult) => void;
}

interface IssueFormValues {
  sku_id: string;
  carrier_type: IssuePhysicalCodeCarrierType;
  code_value?: string;
  serial_number?: string;
}

const CARRIER_OPTIONS: Array<{
  value: IssuePhysicalCodeCarrierType;
  label: string;
}> = [
  { value: "QR", label: "QR" },
  { value: "BARCODE", label: "Barcode" },
];

/**
 * "Tạo mã" trên PhysicalCodesPage — trước đây nút này bị disabled cứng vì
 * chưa từng có API tạo Item_Instance + Physical_Code MỚI cùng lúc (chỉ có
 * API gán mã cho item đã tồn tại sẵn). Gọi POST /skus/{id}/items
 * (CurrentBaselineItemIdentityController@issue), permission physical_code.create.
 * Chỉ liệt kê SKU sku_type=PRODUCT + is_serial_tracked=true — đúng điều kiện
 * BE yêu cầu (SKU_NOT_SERIAL_TRACKED nếu sai).
 */
export function IssuePhysicalCodeModal({
  open,
  onClose,
  onIssued,
}: IssuePhysicalCodeModalProps) {
  const [form] = Form.useForm<IssueFormValues>();
  const queryClient = useQueryClient();

  const skuQuery = useMvpSkus({
    status: "ACTIVE",
    sku_type: "PRODUCT",
    per_page: 200,
  });
  const skuOptions = useMemo(
    () =>
      (skuQuery.data?.data ?? [])
        .filter((sku) => sku.is_serial_tracked)
        .map((sku) => ({
          value: sku.sku_id,
          label: `${sku.sku_code} — ${sku.sku_name}`,
        })),
    [skuQuery.data],
  );

  const issueMutation = useMutation({
    mutationFn: (values: IssueFormValues) =>
      issueItemPhysicalCode({
        skuId: values.sku_id,
        carrier_type: values.carrier_type,
        code_value: values.code_value,
        serial_number: values.serial_number,
      }),
    onSuccess: (result) => {
      toast.success(`Đã tạo mã ${result.code_value} cho item mới.`);
      queryClient.invalidateQueries({ queryKey: ["scan"] });
      onIssued?.(result);
      form.resetFields();
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, "Không thể tạo mã vật lý mới."));
    },
  });

  const handleClose = () => {
    if (issueMutation.isPending) return;
    issueMutation.reset();
    form.resetFields();
    onClose();
  };

  const handleSubmit = async () => {
    let values: IssueFormValues;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    issueMutation.mutate(values);
  };

  const result = issueMutation.data;

  return (
    <Modal
      title="Tạo mã vật lý mới"
      open={open}
      onCancel={handleClose}
      onOk={result ? handleClose : handleSubmit}
      okText={result ? "Đóng" : "Tạo mã"}
      cancelButtonProps={{ style: result ? { display: "none" } : undefined }}
      confirmLoading={issueMutation.isPending}
      destroyOnClose
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="Stock-neutral"
        description="Tạo một Item_Instance mới (item_status=NEW) kèm Physical_Code mới (ACTIVE, is_primary=true). Không phát sinh biến động tồn kho. Chỉ áp dụng cho SKU loại PRODUCT đang theo dõi serial."
      />
      {result ? (
        <Descriptions bordered size="small" column={1}>
          <Descriptions.Item label="Item ID">
            {result.item_id}
          </Descriptions.Item>
          <Descriptions.Item label="Giá trị mã">
            <Tag color="blue">{result.code_value}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Vật mang">
            {result.carrier_type}
          </Descriptions.Item>
          <Descriptions.Item label="Serial number">
            {result.serial_number}
          </Descriptions.Item>
          <Descriptions.Item label="Trạng thái item">
            {result.item_status}
          </Descriptions.Item>
          <Descriptions.Item label="Trạng thái mã">
            {result.status}
          </Descriptions.Item>
        </Descriptions>
      ) : (
        <Form<IssueFormValues>
          form={form}
          layout="vertical"
          initialValues={{ carrier_type: "QR" }}
        >
          <Form.Item
            label="SKU (PRODUCT, theo dõi serial)"
            name="sku_id"
            rules={[{ required: true, message: "Vui lòng chọn SKU" }]}
          >
            <Select
              showSearch
              placeholder="Chọn SKU..."
              loading={skuQuery.isLoading}
              options={skuOptions}
              optionFilterProp="label"
              notFoundContent={
                skuQuery.isLoading
                  ? "Đang tải..."
                  : "Không có SKU PRODUCT theo dõi serial nào đang ACTIVE"
              }
            />
          </Form.Item>
          <Form.Item
            label="Vật mang mã"
            name="carrier_type"
            rules={[{ required: true }]}
          >
            <Select options={CARRIER_OPTIONS} />
          </Form.Item>
          <Form.Item
            label="Giá trị mã (bỏ trống để tự sinh)"
            name="code_value"
            rules={[{ max: 200, message: "Tối đa 200 ký tự" }]}
          >
            <Input placeholder="VD: SP-0001-20260822-AB12" />
          </Form.Item>
          <Form.Item
            label="Serial number (bỏ trống để tự sinh)"
            name="serial_number"
            rules={[{ max: 100, message: "Tối đa 100 ký tự" }]}
          >
            <Input placeholder="VD: SN-SP-0001-8F3C1A2B" />
          </Form.Item>
        </Form>
      )}
    </Modal>
  );
}
