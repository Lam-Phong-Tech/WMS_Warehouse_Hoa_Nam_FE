import { Card, Typography } from "antd";
import { ExportOutlined } from "@ant-design/icons";

const { Title, Paragraph } = Typography;

/**
 * OutboundPage - Module skeleton
 * Thay thế bằng page thực tế khi triển khai nghiệp vụ xuất kho
 */
export default function OutboundPage() {
  return (
    <div style={{ padding: 24 }}>
      <Card style={{ maxWidth: 800, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <ExportOutlined style={{ fontSize: 48, color: "#356fa3" }} />
        </div>
        <Title level={2} style={{ textAlign: "center", marginBottom: 8 }}>
          Xuất kho
        </Title>
        <Paragraph style={{ textAlign: "center", color: "#7a766c", marginBottom: 24 }}>
          Module quản lý xuất kho
        </Paragraph>
        <div
          style={{
            marginTop: 24,
            padding: 16,
            background: "#fff4cf",
            border: "1px dashed #c9a227",
            borderRadius: 4,
            textAlign: "center",
          }}
        >
          <Typography.Text type="secondary">
            Module skeleton · Sẵn sàng để triển khai nghiệp vụ
          </Typography.Text>
        </div>
      </Card>
    </div>
  );
}