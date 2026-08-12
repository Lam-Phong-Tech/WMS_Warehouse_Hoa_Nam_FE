import { useNavigate } from "react-router-dom";
import { ROUTES } from "@/shared/constants/routes";

type FlowNode = {
  label: string;
  route?: string;
};

type FlowLane = {
  label: string;
  nodes: FlowNode[];
};

const FLOW_LANES: FlowLane[] = [
  {
    label: "Nhập kho",
    nodes: [
      { label: "Danh sách phiếu nhập", route: ROUTES.INBOUND },
      { label: "Tạo DRAFT", route: ROUTES.INBOUND },
      { label: "Quét / camera", route: ROUTES.INBOUND },
      { label: "Post toàn bộ", route: ROUTES.INBOUND },
      { label: "Linh kiện chờ xếp khay", route: ROUTES.PUTAWAY },
      { label: "Putaway", route: ROUTES.PUTAWAY },
    ],
  },
  {
    label: "Xuất kho",
    nodes: [
      { label: "Phiếu yêu cầu xuất", route: ROUTES.OUTBOUND },
      { label: "Import Excel / nhập tay", route: ROUTES.OUTBOUND },
      { label: "Danh sách phiếu xuất", route: ROUTES.OUTBOUND },
      { label: "Chi tiết phiếu xuất", route: ROUTES.OUTBOUND },
      { label: "Quét match", route: ROUTES.OUTBOUND },
      { label: "In nhãn", route: ROUTES.OUTBOUND },
      { label: "Map RFID / Post", route: ROUTES.OUTBOUND },
    ],
  },
  {
    label: "Bảo hành",
    nodes: [
      { label: "Danh sách bảo hành", route: ROUTES.WARRANTY },
      { label: "Tiếp nhận bảo hành", route: ROUTES.WARRANTY },
      { label: "Chi tiết bảo hành", route: ROUTES.WARRANTY },
      { label: "Xuất linh kiện", route: ROUTES.WARRANTY },
    ],
  },
  {
    label: "Kiểm soát",
    nodes: [
      { label: "Tra cứu tồn", route: ROUTES.INVENTORY },
      { label: "Truy vết", route: ROUTES.SCAN },
      { label: "Danh sách Reversal", route: ROUTES.REVERSE },
      { label: "Tạo Reversal", route: ROUTES.REVERSE },
    ],
  },
];

const MVP_NOTES = [
  "Không dựng App PV trong bộ wireframe này.",
  "Giao diện ưu tiên tiếng Việt cho người dùng vận hành kho.",
  "Camera điện thoại có thể thay máy quét Barcode / QR trong các màn nghiệp vụ.",
  "Luồng nhập / xuất vẫn bám nguyên tắc full-post, không partial.",
];

export default function DashboardPage() {
  const navigate = useNavigate();

  return (
    <div>
      <div className="hn-flow">
        {FLOW_LANES.map((lane) => (
          <div className="hn-lane" key={lane.label}>
            <div className="tag">{lane.label}</div>
            {lane.nodes.map((node, index) => (
              <span
                key={`${lane.label}-${node.label}`}
                style={{ display: "contents" }}
              >
                {index > 0 ? <span aria-hidden="true">→</span> : null}
                <button
                  type="button"
                  className="hn-node"
                  onClick={() => node.route && navigate(node.route)}
                  style={{ cursor: node.route ? "pointer" : "default" }}
                >
                  {node.label}
                </button>
              </span>
            ))}
          </div>
        ))}
      </div>

      <div className="hn-grid-2" style={{ marginTop: 16 }}>
        <div className="hn-card hn-soft">
          <div className="hn-section-title">Ghi chú phạm vi MVP</div>
          {MVP_NOTES.map((note) => (
            <div className="hn-rule" key={note}>
              <span className="hn-dot" aria-hidden="true" />
              <span>{note}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="hn-footer-note">
        Wireframe mức low-fi · Nguồn BA: BRD / SRS-FRD / BPD hiện tại.
      </div>
    </div>
  );
}
