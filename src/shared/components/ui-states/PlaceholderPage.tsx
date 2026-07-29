import { Typography, Card, List, Tag } from "antd";
import { FileTextOutlined } from "@ant-design/icons";

const { Title, Paragraph, Text } = Typography;

interface PlaceholderPageProps {
  title: string;
  description: string;
  features: string[];
}

/**
 * Component placeholder cho các trang chưa triển khai
 * Hiển thị thông báo "đang phát triển" với danh sách tính năng dự kiến
 */
export function PlaceholderPage({
  title,
  description,
  features,
}: PlaceholderPageProps) {
  return (
    <div style={{ padding: 24 }}>
      <Card style={{ maxWidth: 800, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <FileTextOutlined style={{ fontSize: 48, color: "#356fa3" }} />
        </div>
        <Title level={2} style={{ textAlign: "center", marginBottom: 8 }}>
          {title}
        </Title>
        <Paragraph
          style={{ textAlign: "center", color: "#7a766c", marginBottom: 24 }}
        >
          {description}
        </Paragraph>
        <div style={{ marginBottom: 16 }}>
          <Text strong>Tính năng dự kiến:</Text>
        </div>
        <List
          dataSource={features}
          renderItem={(item) => (
            <List.Item style={{ padding: "8px 0", border: "none" }}>
              <Tag color="blue" style={{ marginRight: 8 }}>
                ★
              </Tag>
              {item}
            </List.Item>
          )}
        />
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
          <Text type="secondary">
            Đang phát triển · Sẽ triển khai trong phase tiếp theo
          </Text>
        </div>
      </Card>
    </div>
  );
}
