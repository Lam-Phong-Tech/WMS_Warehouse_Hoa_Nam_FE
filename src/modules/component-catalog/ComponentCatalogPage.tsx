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
  SubmitButton,
} from "@/shared/components";

interface CatalogRow {
  id: string;
  code: string;
  owner: string;
  status: "DRAFT" | "SCANNING" | "POSTED" | "ERROR";
}

const columns: ColumnsType<CatalogRow> = [
  { title: "Mã chứng từ", dataIndex: "code", key: "code" },
  { title: "Phân hệ", dataIndex: "owner", key: "owner", responsive: ["sm"] },
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
          DRAFT: "Nháp",
          SCANNING: "Đang quét",
          POSTED: "Đã ghi nhận",
          ERROR: "Có lỗi",
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
    <Space orientation="vertical" size={20} style={{ width: "100%" }}>
      <PageHeader
        title="Thư viện thành phần giao diện"
        subtitle="Màn nội bộ để kiểm tra các trạng thái giao diện dùng chung."
        extra={
          <Space wrap>
            <Button onClick={() => toast.success("Thông báo thành công đã sẵn sàng")}>
              Thử thông báo thành công
            </Button>
            <Button danger onClick={() => toast.error("Thông báo lỗi đã sẵn sàng")}>
              Thử thông báo lỗi
            </Button>
            <Button type="primary" onClick={() => setModalOpen(true)}>
              Mở biểu mẫu
            </Button>
          </Space>
        }
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={14}>
          <Card title="Bảng dữ liệu, trạng thái và phân trang" style={cardStyle}>
            <DataTable<CatalogRow>
              columns={columns}
              dataSource={[]}
              serverPagination={{
                total: 0,
                current: 1,
                pageSize: 10,
                onChange: () => toast.info("Đã thay đổi trang"),
              }}
            />
          </Card>
        </Col>
        <Col xs={24} xl={10}>
          <Card title="Trạng thái quét mã" style={cardStyle}>
            <Space orientation="vertical" size={12} style={{ width: "100%" }}>
              <ScanInput
                recentCodes={recentCodes}
                duplicateMessage="Mã vừa quét đã có trong lô hiện tại"
                onScan={(code) => {
                  setRecentCodes((codes) => [code, ...codes].slice(0, 5));
                  toast.success(`Đã nhận mã ${code}`);
                }}
              />
              <Typography.Text type="secondary">
                Mã gần đây: {recentCodes.join(", ")}
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
          <Card title="Đang tải" style={cardStyle}>
            <LoadingState tip="Đang tải danh sách..." />
          </Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card title="Không có dữ liệu" style={cardStyle}>
            <EmptyState description="Không có bản ghi phù hợp bộ lọc." />
          </Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card title="Có lỗi" style={cardStyle}>
            <ErrorState onRetry={() => toast.info("Đang thử lại")} />
          </Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card title="Không có quyền" style={cardStyle}>
            <NoPermissionState />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="Lỗi dữ liệu và lỗi trường nhập" style={cardStyle}>
            <ApiErrorAlert
              error={{
                response: {
                  data: {
                    success: false,
                    message: "Dữ liệu chưa hợp lệ",
                    error_code: "WMS_VALIDATION_ERROR",
                    errors: {
                      sku_id: ["SKU bắt buộc"],
                      warehouse_id: ["Kho không nằm trong phạm vi dữ liệu"],
                    },
                  },
                },
              }}
              onRetry={() => toast.info("Đang tải lại dữ liệu")}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Xác nhận và hành động bị khóa" style={cardStyle}>
            <Space wrap>
              <ConfirmButton
                danger
                title="Xác nhận thao tác"
                description="Dùng xác nhận trước các thao tác có rủi ro."
                onConfirm={() => toast.success("Đã xác nhận thao tác")}
              >
                Xác nhận thao tác
              </ConfirmButton>
              <SubmitButton disabled>Chưa đủ điều kiện thực hiện</SubmitButton>
            </Space>
          </Card>
        </Col>
      </Row>

      <Card title="Khung tải trang">
        <PageSkeleton />
      </Card>

      <FormModal
        open={modalOpen}
        title="Biểu mẫu mẫu"
        onOk={() => {
          toast.success("Đã gửi biểu mẫu");
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
