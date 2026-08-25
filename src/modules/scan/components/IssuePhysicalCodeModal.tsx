import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert, Descriptions, Form, Input, Modal, Select, Tag } from "antd";
import { toast } from "sonner";
import { useMvpSkus } from "@/modules/master-data/hooks/use-mvp-master";
import { getApiErrorMessage } from "@/shared/api/api-error";
import {
  ITEM_STATUS_LABELS,
  MASTER_STATUS_LABELS,
  businessLabel,
} from "@/shared/constants/business-labels";
import { issueItemPhysicalCode } from "../services/scanService";
import type {
  IssueItemPhysicalCodeResult,
  IssuePhysicalCodeCarrierType,
} from "../types";

interface IssuePhysicalCodeModalProps {
  open: boolean;
  onClose: () => void;
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
  { value: "BARCODE", label: "Mã vạch" },
];

function carrierLabel(value: IssuePhysicalCodeCarrierType) {
  return value === "BARCODE" ? "Mã vạch" : "QR";
}

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
      toast.success(`Đã tạo mã ${result.code_value} cho sản phẩm mới.`);
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
        message="Tạo mã không làm thay đổi tồn kho"
        description="Hệ thống tạo một sản phẩm cụ thể kèm mã vật lý mới. Thao tác này chỉ tạo thông tin nhận diện, chưa làm tăng hoặc giảm tồn kho. Chỉ áp dụng cho SKU sản phẩm có quản lý số sê-ri."
      />
      {result ? (
        <Descriptions bordered size="small" column={1}>
          <Descriptions.Item label="Mã sản phẩm">
            {result.item_id}
          </Descriptions.Item>
          <Descriptions.Item label="Giá trị mã">
            <Tag color="blue">{result.code_value}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Hình thức mã">
            {carrierLabel(result.carrier_type)}
          </Descriptions.Item>
          <Descriptions.Item label="Số sê-ri">
            {result.serial_number}
          </Descriptions.Item>
          <Descriptions.Item label="Trạng thái sản phẩm">
            {businessLabel(
              ITEM_STATUS_LABELS,
              result.item_status,
              "Trạng thái khác",
            )}
          </Descriptions.Item>
          <Descriptions.Item label="Trạng thái mã">
            {businessLabel(
              MASTER_STATUS_LABELS,
              result.status,
              "Trạng thái khác",
            )}
          </Descriptions.Item>
        </Descriptions>
      ) : (
        <Form<IssueFormValues>
          form={form}
          layout="vertical"
          initialValues={{ carrier_type: "QR" }}
        >
          <Form.Item
            label="SKU sản phẩm có quản lý số sê-ri"
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
                  : "Không có SKU sản phẩm đang sử dụng và có quản lý số sê-ri"
              }
            />
          </Form.Item>
          <Form.Item
            label="Hình thức mã"
            name="carrier_type"
            rules={[{ required: true }]}
          >
            <Select options={CARRIER_OPTIONS} />
          </Form.Item>
          <Form.Item
            label="Giá trị mã (bỏ trống để hệ thống tự sinh)"
            name="code_value"
            rules={[{ max: 200, message: "Tối đa 200 ký tự" }]}
          >
            <Input placeholder="Ví dụ: SP-0001-20260822-AB12" />
          </Form.Item>
          <Form.Item
            label="Số sê-ri (bỏ trống để hệ thống tự sinh)"
            name="serial_number"
            rules={[{ max: 100, message: "Tối đa 100 ký tự" }]}
          >
            <Input placeholder="Ví dụ: SN-SP-0001-8F3C1A2B" />
          </Form.Item>
        </Form>
      )}
    </Modal>
  );
}
