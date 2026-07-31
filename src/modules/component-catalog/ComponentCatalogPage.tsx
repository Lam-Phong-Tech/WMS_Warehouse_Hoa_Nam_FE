import { useState } from "react";
import type { ColumnsType } from "antd/es/table";
import { Button, Card, Col, Form, Input, Row, Space, Typography } from "antd";
import { toast } from "sonner";
import {
  ApiErrorAlert,
  ConfirmButton,
  DataTable,
  EmptyState,
  ErrorState,
  FormModal,
  LoadingState,
  NoPermissionState,
  PageHeader,
  PageSkeleton,
  ScanInput,
  StatusTag,
} from "@/shared/components";

interface CatalogRow {
  id: string;
  code: string;
  owner: string;
  status: "DRAFT" | "SCANNING" | "POSTED" | "ERROR";
}

const columns: ColumnsType<CatalogRow> = [
  { title: "Mã chứng từ", dataIndex: "code", key: "code" },
  { title: "Module", dataIndex: "owner", key: "owner", responsive: ["sm"] },
  {
    title: "Trạng thái",
    dataIndex: "status",
    key: "status",
    render: (status: CatalogRow["status"]) => (
      <StatusTag
        status={status}
        colorMap={{
          DRAFT: "default",
          SCANNING: "processing",
          POSTED: "success",
          ERROR: "error",
        }}
        labelMap={{
          DRAFT: "Draft",
          SCANNING: "Scanning",
          POSTED: "Posted",
          ERROR: "Error",
        }}
      />
    ),
  },
];

const cardStyle = { height: "100%" };

export default function ComponentCatalogPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [recentCodes, setRecentCodes] = useState(["HN-QR-0001"]);

  return (
    <Space direction="vertical" size={20} style={{ width: "100%" }}>
      <PageHeader
        title="Component catalog"
        subtitle="Route nội bộ cho BA/QA kiểm tra UI states dùng chung theo HN-FE-001."
        extra={
          <Space wrap>
            <Button onClick={() => toast.success("Toast success đã sẵn sàng")}>
              Toast success
            </Button>
            <Button danger onClick={() => toast.error("Toast error theo API")}>
              Toast error
            </Button>
            <Button type="primary" onClick={() => setModalOpen(true)}>
              Mở modal
            </Button>
          </Space>
        }
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={14}>
          <Card title="Table + status + pagination" style={cardStyle}>
            <DataTable<CatalogRow>
              columns={columns}
              dataSource={[]}
              serverPagination={{
                total: 0,
                current: 1,
                pageSize: 10,
                onChange: () => toast.info("Pagination callback đã được gọi"),
              }}
            />
          </Card>
        </Col>
        <Col xs={24} xl={10}>
          <Card title="Scan states" style={cardStyle}>
            <Space direction="vertical" size={12} style={{ width: "100%" }}>
              <ScanInput
                recentCodes={recentCodes}
                duplicateMessage="Mã vừa scan bị trùng trong batch hiện tại"
                onScan={(code) => {
                  setRecentCodes((codes) => [code, ...codes].slice(0, 5));
                  toast.success(`Đã nhận scan ${code}`);
                }}
              />
              <Typography.Text type="secondary">
                Recent: {recentCodes.join(", ")}
              </Typography.Text>
              <ScanInput
                disabled
                value="HN-QR-DISABLED"
                onScan={() => undefined}
              />
            </Space>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={12} xl={6}>
          <Card title="Loading" style={cardStyle}>
            <LoadingState tip="Đang tải danh sách..." />
          </Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card title="Empty" style={cardStyle}>
            <EmptyState description="Không có bản ghi phù hợp bộ lọc." />
          </Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card title="Error" style={cardStyle}>
            <ErrorState onRetry={() => toast.info("Retry callback")} />
          </Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card title="No permission" style={cardStyle}>
            <NoPermissionState />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="API error + field errors" style={cardStyle}>
            <ApiErrorAlert
              error={{
                response: {
                  data: {
                    success: false,
                    message: "Validation failed",
                    error_code: "WMS_VALIDATION_ERROR",
                    errors: {
                      sku_id: ["SKU bắt buộc"],
                      warehouse_id: ["Kho không nằm trong data scope"],
                    },
                  },
                },
              }}
              onRetry={() => toast.info("Refetch callback")}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Confirm + disabled action" style={cardStyle}>
            <Space wrap>
              <ConfirmButton
                danger
                title="Xác nhận thao tác"
                description="Confirm cho action có rủi ro."
                onConfirm={() => toast.success("Đã xác nhận thao tác")}
              >
                Confirm action
              </ConfirmButton>
              <Button disabled>Disabled until valid</Button>
            </Space>
          </Card>
        </Col>
      </Row>

      <Card title="Page skeleton">
        <PageSkeleton />
      </Card>

      <FormModal
        open={modalOpen}
        title="Form modal"
        onOk={() => {
          toast.success("Submit callback đã chạy");
          setModalOpen(false);
        }}
        onCancel={() => setModalOpen(false)}
        width={560}
      >
        <Form.Item label="Mã chứng từ" required>
          <Input placeholder="IN-260729-001" />
        </Form.Item>
        <Form.Item label="Ghi chú">
          <Input.TextArea rows={3} placeholder="Thông tin bổ sung" />
        </Form.Item>
      </FormModal>
    </Space>
  );
}
