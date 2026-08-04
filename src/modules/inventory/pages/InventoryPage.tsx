/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Descriptions,
  Divider,
  Drawer,
  Input,
  Select,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Timeline,
  Tooltip,
  Typography,
} from "antd";
import {
  EyeOutlined,
  HistoryOutlined,
  ReloadOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import {
  fetchInventoryBalances,
  fetchStockMovement,
  fetchStockMovements,
  traceStockMovementSource,
  type InventoryBalanceRow,
  type StockMovementRow,
  type StockMovementTraceSource,
} from "../services/inventoryService";
import {
  InlineApiError,
  ResponsiveToolbar,
  tableEmptyText,
} from "@/shared/components/feedback/BusinessState";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import { useCanAny } from "@/shared/components/permission";

const numberFormatter = new Intl.NumberFormat("vi-VN");

function formatQty(value: number | null | undefined, uom = "") {
  if (value === null || value === undefined) return "-";
  return `${numberFormatter.format(value)}${uom ? ` ${uom}` : ""}`;
}

function reconcileColor(status: string) {
  if (status === "PASS") return "success";
  if (status === "FAIL") return "error";
  return "warning";
}

function JsonPreview({ value }: { value: unknown }) {
  return (
    <pre
      style={{
        background: "#f6f8fa",
        border: "1px solid #e5e7eb",
        borderRadius: 6,
        maxHeight: 220,
        overflow: "auto",
        padding: 12,
        whiteSpace: "pre-wrap",
      }}
    >
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

export default function InventoryPage() {
  const [activeTab, setActiveTab] = useState("stock");
  const [balances, setBalances] = useState<InventoryBalanceRow[]>([]);
  const [movements, setMovements] = useState<StockMovementRow[]>([]);
  const [stockSearch, setStockSearch] = useState("");
  const [stockStatus, setStockStatus] = useState<string>();
  const [movementSearch, setMovementSearch] = useState("");
  const [movementType, setMovementType] = useState<string>();
  const [stockLoading, setStockLoading] = useState(false);
  const [movementLoading, setMovementLoading] = useState(false);
  const [stockError, setStockError] = useState<unknown>(null);
  const [movementError, setMovementError] = useState<unknown>(null);
  const [selectedBalance, setSelectedBalance] =
    useState<InventoryBalanceRow | null>(null);
  const [selectedMovement, setSelectedMovement] =
    useState<StockMovementRow | null>(null);
  const [movementDetail, setMovementDetail] = useState<unknown>(null);
  const [movementDetailLoading, setMovementDetailLoading] = useState(false);
  const [movementDetailError, setMovementDetailError] = useState<unknown>(null);
  const [traceMovement, setTraceMovement] = useState<StockMovementRow | null>(
    null,
  );
  const [traceSource, setTraceSource] =
    useState<StockMovementTraceSource | null>(null);
  const [traceLoading, setTraceLoading] = useState(false);
  const [traceError, setTraceError] = useState<unknown>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const canTrace = useCanAny(["inventory.trace", "INVENTORY_TRACE"]);

  useEffect(() => {
    if (activeTab !== "stock") return;
    let cancelled = false;
    setStockLoading(true);
    setStockError(null);
    fetchInventoryBalances({
      search: stockSearch,
      status: stockStatus,
      limit: 20,
    })
      .then((data) => {
        if (!cancelled) setBalances(data);
      })
      .catch((fetchError: unknown) => {
        if (!cancelled) {
          setBalances([]);
          setStockError(fetchError);
        }
      })
      .finally(() => {
        if (!cancelled) setStockLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab, stockSearch, stockStatus, reloadKey]);

  useEffect(() => {
    if (activeTab !== "movement") return;
    let cancelled = false;
    setMovementLoading(true);
    setMovementError(null);
    fetchStockMovements({
      search: movementSearch,
      keyword: movementSearch,
      movement_type: movementType,
      per_page: 20,
    })
      .then((data) => {
        if (!cancelled) setMovements(data);
      })
      .catch((fetchError: unknown) => {
        if (!cancelled) {
          setMovements([]);
          setMovementError(fetchError);
        }
      })
      .finally(() => {
        if (!cancelled) setMovementLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab, movementSearch, movementType, reloadKey]);

  function openMovementDetail(row: StockMovementRow) {
    setSelectedMovement(row);
    setMovementDetail(null);
    setMovementDetailError(null);
    setMovementDetailLoading(true);
    fetchStockMovement(row.id)
      .then(setMovementDetail)
      .catch(setMovementDetailError)
      .finally(() => setMovementDetailLoading(false));
  }

  function openTrace(row: StockMovementRow) {
    if (!canTrace || !row.id) return;
    setTraceMovement(row);
    setTraceSource(null);
    setTraceError(null);
    setTraceLoading(true);
    traceStockMovementSource(row.id)
      .then(setTraceSource)
      .catch(setTraceError)
      .finally(() => setTraceLoading(false));
  }

  const relatedMovements = useMemo(() => {
    if (!selectedBalance) return [];
    return movements
      .filter(
        (movement) =>
          movement.sku === selectedBalance.sku ||
          movement.id === selectedBalance.lastMovementId ||
          movement.movementId === selectedBalance.lastMovementId,
      )
      .slice(0, 8);
  }, [movements, selectedBalance]);

  const stockColumns = [
    {
      title: "SKU",
      dataIndex: "sku",
      key: "sku",
      render: (value: string) => (
        <Typography.Text code copyable>
          {value || "-"}
        </Typography.Text>
      ),
    },
    {
      title: "Tên hàng",
      dataIndex: "name",
      key: "name",
      render: (value: string, row: InventoryBalanceRow) => (
        <Space direction="vertical" size={0}>
          <strong>{value || "-"}</strong>
          <Typography.Text type="secondary">{row.type}</Typography.Text>
        </Space>
      ),
    },
    { title: "Kho", dataIndex: "warehouse", key: "warehouse" },
    { title: "Lô", dataIndex: "lotNo", key: "lotNo" },
    {
      title: "Khả dụng",
      dataIndex: "available",
      key: "available",
      align: "right" as const,
      render: (value: number, row: InventoryBalanceRow) => (
        <strong>{formatQty(value, row.uom)}</strong>
      ),
    },
    {
      title: "On-hand",
      dataIndex: "onHand",
      key: "onHand",
      align: "right" as const,
      render: (value: number, row: InventoryBalanceRow) =>
        formatQty(value, row.uom),
    },
    {
      title: "Reserved",
      dataIndex: "reserved",
      key: "reserved",
      align: "right" as const,
      render: (value: number, row: InventoryBalanceRow) =>
        formatQty(value, row.uom),
    },
    {
      title: "In-transit",
      dataIndex: "inTransit",
      key: "inTransit",
      align: "right" as const,
      render: (value: number, row: InventoryBalanceRow) =>
        formatQty(value, row.uom),
    },
    { title: "Vị trí gợi ý", dataIndex: "location", key: "location" },
    {
      title: "Đối soát",
      dataIndex: "reconcile",
      key: "reconcile",
      render: (value: string, row: InventoryBalanceRow) => (
        <Tooltip
          title={row.reconcileNote || "Trạng thái đối soát do backend trả về"}
        >
          <Tag color={reconcileColor(value)}>{value}</Tag>
        </Tooltip>
      ),
    },
    {
      title: "Cập nhật",
      dataIndex: "updatedAt",
      key: "updatedAt",
      render: (value: string, row: InventoryBalanceRow) =>
        value || row.dataAsOf || "-",
    },
    {
      title: "Hành động",
      key: "action",
      fixed: "right" as const,
      render: (_: unknown, row: InventoryBalanceRow) => (
        <Space>
          <Tooltip title="Chi tiết tồn kho">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => setSelectedBalance(row)}
            />
          </Tooltip>
          <Tooltip title="Xem movement liên quan theo SKU">
            <Button
              type="text"
              icon={<HistoryOutlined />}
              onClick={() => {
                setMovementSearch(row.sku);
                setActiveTab("movement");
              }}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const movementColumns = [
    {
      title: "Mã dịch chuyển",
      dataIndex: "movementId",
      key: "movementId",
      render: (value: string) => (
        <Typography.Text code>{value || "-"}</Typography.Text>
      ),
    },
    { title: "Thời gian", dataIndex: "time", key: "time" },
    {
      title: "Loại",
      dataIndex: "type",
      key: "type",
      render: (value: string, row: StockMovementRow) => (
        <Space direction="vertical" size={0}>
          <Tag>{value || "-"}</Tag>
          <Typography.Text type="secondary">{row.status}</Typography.Text>
        </Space>
      ),
    },
    { title: "SKU", dataIndex: "sku", key: "sku" },
    { title: "Kho", dataIndex: "warehouse", key: "warehouse" },
    {
      title: "SL thay đổi",
      dataIndex: "qty",
      key: "qty",
      align: "right" as const,
      render: (value: number) => (
        <Typography.Text
          style={{
            color: value >= 0 ? "#237804" : "#cf1322",
            fontVariantNumeric: "tabular-nums",
            fontWeight: 600,
          }}
        >
          {value >= 0
            ? `+${numberFormatter.format(value)}`
            : numberFormatter.format(value)}
        </Typography.Text>
      ),
    },
    {
      title: "Nguồn",
      dataIndex: "source",
      key: "source",
      render: (value: string, row: StockMovementRow) => (
        <Space direction="vertical" size={0}>
          <Typography.Text code>{value || "-"}</Typography.Text>
          <Typography.Text type="secondary">{row.sourceType}</Typography.Text>
        </Space>
      ),
    },
    { title: "Người thao tác", dataIndex: "actor", key: "actor" },
    { title: "Chuỗi", dataIndex: "chain", key: "chain" },
    {
      title: "Hành động",
      key: "action",
      fixed: "right" as const,
      render: (_: unknown, row: StockMovementRow) => (
        <Space>
          <Tooltip title="Chi tiết movement">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => openMovementDetail(row)}
            />
          </Tooltip>
          <Tooltip
            title={
              canTrace
                ? "Truy vết chứng từ nguồn"
                : "Cần quyền inventory.trace để truy vết"
            }
          >
            <Button
              type="text"
              disabled={!canTrace || !row.id}
              icon={<HistoryOutlined />}
              onClick={() => openTrace(row)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: "stock",
            label: "Tồn kho hiện tại",
            children: (
              <>
                <ResponsiveToolbar>
                  <Input.Search
                    placeholder="SKU, tên hàng, chứng từ..."
                    style={{ width: 300, maxWidth: "100%" }}
                    allowClear
                    enterButton={<SearchOutlined />}
                    onSearch={setStockSearch}
                  />
                  <Select
                    placeholder="Trạng thái tồn"
                    style={{ width: 170 }}
                    allowClear
                    value={stockStatus}
                    onChange={setStockStatus}
                    options={[
                      { value: "active", label: "Hoạt động" },
                      { value: "inactive", label: "Ngừng hoạt động" },
                      { value: "warning", label: "Cần đối soát" },
                    ]}
                  />
                  <Button
                    icon={<ReloadOutlined />}
                    onClick={() => setReloadKey((value) => value + 1)}
                  >
                    Tải lại
                  </Button>
                </ResponsiveToolbar>
                <InlineApiError
                  error={stockError}
                  title="Không thể tải tồn kho hiện tại"
                  onRetry={() => setReloadKey((value) => value + 1)}
                />
                <Table
                  dataSource={balances}
                  columns={stockColumns}
                  rowKey="id"
                  loading={stockLoading}
                  pagination={{ pageSize: 10, showSizeChanger: true }}
                  scroll={{ x: "max-content" }}
                  locale={{
                    emptyText: tableEmptyText(
                      stockError,
                      stockSearch || stockStatus
                        ? "Không có tồn kho khớp bộ lọc"
                        : "Chưa có dữ liệu tồn kho",
                    ),
                  }}
                />
                <div
                  style={{
                    marginTop: 12,
                    background: "#eef6ff",
                    border: "1px dashed #9cc7ef",
                    borderRadius: 6,
                    padding: 12,
                    color: "#214d73",
                  }}
                >
                  <b>Vị trí gợi ý/khay</b> chỉ giúp tìm hàng, không tham gia
                  công thức tồn và không tạo bucket tồn riêng.
                </div>
              </>
            ),
          },
          {
            key: "movement",
            label: "Lịch sử dịch chuyển",
            children: (
              <>
                <ResponsiveToolbar>
                  <Input.Search
                    placeholder="Movement, chứng từ, SKU..."
                    style={{ width: 300, maxWidth: "100%" }}
                    allowClear
                    enterButton={<SearchOutlined />}
                    value={movementSearch}
                    onChange={(event) => setMovementSearch(event.target.value)}
                    onSearch={setMovementSearch}
                  />
                  <Select
                    placeholder="Loại dịch chuyển"
                    style={{ width: 190 }}
                    allowClear
                    value={movementType}
                    onChange={setMovementType}
                    options={[
                      { value: "RECEIPT_IN", label: "Nhập kho" },
                      { value: "ISSUE_OUT", label: "Xuất kho" },
                      { value: "TRANSFER_OUT", label: "Chuyển đi" },
                      { value: "TRANSFER_IN", label: "Chuyển đến" },
                      { value: "ADJUST", label: "Điều chỉnh" },
                      { value: "REVERSAL", label: "Hoàn đảo" },
                    ]}
                  />
                  <Button
                    icon={<ReloadOutlined />}
                    onClick={() => setReloadKey((value) => value + 1)}
                  >
                    Tải lại
                  </Button>
                </ResponsiveToolbar>
                <InlineApiError
                  error={movementError}
                  title="Không thể tải lịch sử dịch chuyển"
                  onRetry={() => setReloadKey((value) => value + 1)}
                />
                <Table
                  dataSource={movements}
                  columns={movementColumns}
                  rowKey="id"
                  loading={movementLoading}
                  pagination={{ pageSize: 10, showSizeChanger: true }}
                  scroll={{ x: "max-content" }}
                  locale={{
                    emptyText: tableEmptyText(
                      movementError,
                      movementSearch || movementType
                        ? "Không có movement khớp bộ lọc"
                        : "Chưa có lịch sử dịch chuyển",
                    ),
                  }}
                />
              </>
            ),
          },
        ]}
      />

      <Drawer
        title="Chi tiết tồn kho"
        width={720}
        open={Boolean(selectedBalance)}
        onClose={() => setSelectedBalance(null)}
      >
        {selectedBalance && (
          <>
            <Space direction="vertical" size={16} style={{ width: "100%" }}>
              <Descriptions bordered column={1} size="small">
                <Descriptions.Item label="SKU">
                  <Typography.Text code copyable>
                    {selectedBalance.sku}
                  </Typography.Text>
                </Descriptions.Item>
                <Descriptions.Item label="Tên hàng">
                  {selectedBalance.name}
                </Descriptions.Item>
                <Descriptions.Item label="Kho / lô">
                  {selectedBalance.warehouse} / {selectedBalance.lotNo}
                </Descriptions.Item>
                <Descriptions.Item label="Đối soát">
                  <Tag color={reconcileColor(selectedBalance.reconcile)}>
                    {selectedBalance.reconcile}
                  </Tag>
                  {selectedBalance.reconcileNote || ""}
                </Descriptions.Item>
                <Descriptions.Item label="Data as of">
                  {selectedBalance.dataAsOf || selectedBalance.updatedAt || "-"}
                </Descriptions.Item>
              </Descriptions>

              <Space wrap size="middle">
                <Statistic
                  title="Available"
                  value={selectedBalance.available}
                  suffix={selectedBalance.uom}
                />
                <Statistic
                  title="On-hand"
                  value={selectedBalance.onHand}
                  suffix={selectedBalance.uom}
                />
                <Statistic
                  title="Reserved"
                  value={selectedBalance.reserved}
                  suffix={selectedBalance.uom}
                />
                <Statistic
                  title="In-transit"
                  value={selectedBalance.inTransit}
                  suffix={selectedBalance.uom}
                />
                <Statistic
                  title="Blocked/Hold"
                  value={selectedBalance.blocked}
                  suffix={selectedBalance.uom}
                />
              </Space>

              <Descriptions bordered column={1} size="small">
                <Descriptions.Item label="Serial qty">
                  {formatQty(selectedBalance.serialQty)}
                </Descriptions.Item>
                <Descriptions.Item label="Box qty">
                  {formatQty(selectedBalance.boxQty)}
                </Descriptions.Item>
                <Descriptions.Item label="Vị trí gợi ý">
                  {selectedBalance.location}
                </Descriptions.Item>
                <Descriptions.Item label="Movement gần nhất">
                  {selectedBalance.lastMovementId || "-"}
                </Descriptions.Item>
              </Descriptions>
            </Space>

            <Divider>Movement liên quan</Divider>
            <Table
              size="small"
              dataSource={relatedMovements}
              columns={movementColumns}
              rowKey="id"
              pagination={false}
              scroll={{ x: "max-content" }}
              locale={{
                emptyText: tableEmptyText(
                  null,
                  "Chưa tải được movement liên quan",
                ),
              }}
            />
          </>
        )}
      </Drawer>

      <Drawer
        title="Chi tiết movement"
        width={720}
        open={Boolean(selectedMovement)}
        onClose={() => setSelectedMovement(null)}
      >
        {selectedMovement && (
          <>
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="Movement">
                <Typography.Text code copyable>
                  {selectedMovement.movementId}
                </Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label="Thời gian">
                {selectedMovement.time || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Loại / trạng thái">
                <Tag>{selectedMovement.type}</Tag> {selectedMovement.status}
              </Descriptions.Item>
              <Descriptions.Item label="SKU / kho / lô">
                {selectedMovement.sku} / {selectedMovement.warehouse} /{" "}
                {selectedMovement.lotNo}
              </Descriptions.Item>
              <Descriptions.Item label="Số lượng thay đổi">
                {formatQty(selectedMovement.qty)}
              </Descriptions.Item>
              <Descriptions.Item label="Before / after">
                {formatQty(selectedMovement.beforeQty)} /{" "}
                {formatQty(selectedMovement.afterQty)}
              </Descriptions.Item>
              <Descriptions.Item label="Nguồn">
                {selectedMovement.sourceType} - {selectedMovement.source || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Actor">
                {selectedMovement.actor}
              </Descriptions.Item>
            </Descriptions>
            <ApiErrorAlert
              error={movementDetailError}
              title="Không thể tải chi tiết movement"
              onRetry={() => openMovementDetail(selectedMovement)}
              style={{ marginTop: 16 }}
            />
            {movementDetailLoading ? (
              <div style={{ padding: 24 }}>Đang tải chi tiết...</div>
            ) : movementDetail ? (
              <>
                <Divider>Payload chi tiết từ backend</Divider>
                <JsonPreview value={movementDetail} />
              </>
            ) : null}
          </>
        )}
      </Drawer>

      <Drawer
        title="Trace chứng từ nguồn"
        width={760}
        open={Boolean(traceMovement)}
        onClose={() => setTraceMovement(null)}
      >
        {traceMovement && (
          <>
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="Movement">
                <Typography.Text code>
                  {traceMovement.movementId}
                </Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label="SKU">
                {traceMovement.sku}
              </Descriptions.Item>
              <Descriptions.Item label="Số lượng">
                {formatQty(traceMovement.qty)}
              </Descriptions.Item>
            </Descriptions>
            <ApiErrorAlert
              error={traceError}
              title="Không thể truy vết nguồn movement"
              onRetry={() => openTrace(traceMovement)}
              style={{ marginTop: 16 }}
            />
            {traceLoading ? (
              <div style={{ padding: 24 }}>Đang tải trace-source...</div>
            ) : traceSource ? (
              <>
                <Divider>Chứng từ nguồn</Divider>
                <Descriptions bordered column={1} size="small">
                  <Descriptions.Item label="Loại nguồn">
                    {traceSource.sourceType}
                  </Descriptions.Item>
                  <Descriptions.Item label="Mã chứng từ">
                    <Typography.Text code copyable>
                      {traceSource.sourceCode}
                    </Typography.Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="Trạng thái">
                    {traceSource.status}
                  </Descriptions.Item>
                  <Descriptions.Item label="Posted at">
                    {traceSource.postedAt || "-"}
                  </Descriptions.Item>
                  <Descriptions.Item label="Actor">
                    {traceSource.actor}
                  </Descriptions.Item>
                  <Descriptions.Item label="Request ID">
                    {traceSource.requestId || "-"}
                  </Descriptions.Item>
                </Descriptions>

                <Divider>Timeline</Divider>
                {traceSource.timeline.length > 0 ? (
                  <Timeline
                    items={traceSource.timeline.map((item, index) => ({
                      children: (
                        <Typography.Text>
                          {String(
                            item.title ??
                              item.event ??
                              item.movement_no ??
                              item.code ??
                              `Bước ${index + 1}`,
                          )}
                        </Typography.Text>
                      ),
                    }))}
                  />
                ) : (
                  <Typography.Text type="secondary">
                    Backend chưa trả timeline/chain; FE không tự dựng chuỗi từ
                    document_code.
                  </Typography.Text>
                )}

                <Divider>Lines / raw contract</Divider>
                <JsonPreview
                  value={{
                    lines: traceSource.lines,
                    summary: traceSource.summary,
                  }}
                />
              </>
            ) : null}
          </>
        )}
      </Drawer>
    </div>
  );
}
