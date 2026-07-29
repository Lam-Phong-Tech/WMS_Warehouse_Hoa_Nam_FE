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

const sampleRows: CatalogRow[] = [
  { id: "1", code: "IN-260729-001", owner: "Inbound", status: "DRAFT" },
  { id: "2", code: "SCAN-260729-008", owner: "Scan", status: "SCANNING" },
  { id: "3", code: "OUT-260729-004", owner: "Outbound", status: "POSTED" },
];

const columns: ColumnsType<CatalogRow> = [
  { title: "Ma chung tu", dataIndex: "code", key: "code" },
  { title: "Module", dataIndex: "owner", key: "owner", responsive: ["sm"] },
  {
    title: "Trang thai",
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
        subtitle="Demo route noi bo cho BA/QA kiem tra UI states dung chung theo HN-FE-001."
        extra={
          <Space wrap>
            <Button onClick={() => toast.success("Toast success da san sang")}>
              Toast success
            </Button>
            <Button danger onClick={() => toast.error("Toast error theo API")}>
              Toast error
            </Button>
            <Button type="primary" onClick={() => setModalOpen(true)}>
              Mo modal
            </Button>
          </Space>
        }
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={14}>
          <Card title="Table + status + pagination" style={cardStyle}>
            <DataTable<CatalogRow>
              columns={columns}
              dataSource={sampleRows}
              serverPagination={{
                total: 24,
                current: 1,
                pageSize: 10,
                onChange: () => toast.info("Pagination callback da duoc goi"),
              }}
            />
          </Card>
        </Col>
        <Col xs={24} xl={10}>
          <Card title="Scan states" style={cardStyle}>
            <Space direction="vertical" size={12} style={{ width: "100%" }}>
              <ScanInput
                recentCodes={recentCodes}
                duplicateMessage="Ma vua scan bi trung trong batch hien tai"
                onScan={(code) => {
                  setRecentCodes((codes) => [code, ...codes].slice(0, 5));
                  toast.success(`Da nhan scan ${code}`);
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
            <LoadingState tip="Dang tai danh sach..." />
          </Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card title="Empty" style={cardStyle}>
            <EmptyState description="Khong co ban ghi phu hop bo loc." />
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
                      sku_id: ["SKU bat buoc"],
                      warehouse_id: ["Kho khong nam trong data scope"],
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
                title="Xac nhan thao tac"
                description="Demo confirm cho action co rui ro."
                onConfirm={() => toast.success("Da xac nhan thao tac")}
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
        title="Demo form modal"
        onOk={() => {
          toast.success("Submit callback da chay");
          setModalOpen(false);
        }}
        onCancel={() => setModalOpen(false)}
        width={560}
      >
        <Form.Item label="Ma chung tu" required>
          <Input placeholder="IN-260729-001" />
        </Form.Item>
        <Form.Item label="Ghi chu">
          <Input.TextArea rows={3} placeholder="Thong tin bo sung" />
        </Form.Item>
      </FormModal>
    </Space>
  );
}
