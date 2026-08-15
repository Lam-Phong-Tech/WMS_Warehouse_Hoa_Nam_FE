import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Input,
  Modal,
  Progress,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import {
  CheckCircleOutlined,
  DisconnectOutlined,
  PrinterOutlined,
  ScanOutlined,
  TagOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/shared/api/api-error";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import { useHasPermission } from "@/shared/components/permission";
import {
  applyPackingLabel,
  assignRfidToItem,
  cancelOutboundDocument,
  createPackingLabel,
  fetchOutboundDetail,
  fetchPackingLabels,
  fetchPrinterConfigs,
  postOutboundIssue,
  printLabelSnapshot,
  reprintLabelSnapshot,
  scanOutboundItem,
  unmatchOutboundItem,
  type IssueEvidence,
  type OutboundItemMatchRecord,
  type OutboundLineRecord,
  type PackingLabelRecord,
} from "@/modules/outbound/services/alignedOutboundService";

const { Text } = Typography;

type RfidTarget = { itemId: string; itemCode: string };

interface Props {
  documentId: string;
  onClose: () => void;
  onChanged?: () => void;
}

function makeKey(prefix: string): string {
  const random =
    globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  return `${prefix}-${random}`;
}

function short(value?: string | null): string {
  if (!value) return "-";
  return value.length > 18 ? `${value.slice(0, 14)}…` : value;
}

/** Scan -> aggregate -> exactly one Packing Label -> print/apply -> Post Issue. RFID is optional. */
export function AlignedOutboundDetailModal({
  documentId,
  onClose,
  onChanged,
}: Props) {
  const can = useHasPermission();
  const queryClient = useQueryClient();
  const [version, setVersion] = useState<number | null>(null);
  const [lineId, setLineId] = useState("");
  const [scanCode, setScanCode] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [printerId, setPrinterId] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [rfidTarget, setRfidTarget] = useState<RfidTarget | null>(null);
  const [rfidCode, setRfidCode] = useState("");
  const [rfidHardwareUid, setRfidHardwareUid] = useState("");
  const [evidence, setEvidence] = useState<IssueEvidence | null>(null);

  const detailQuery = useQuery({
    queryKey: ["mvp-outbound", "detail", documentId],
    queryFn: () => fetchOutboundDetail(documentId),
  });
  const labelQuery = useQuery({
    queryKey: ["mvp-outbound", "packing-labels"],
    queryFn: fetchPackingLabels,
  });
  const printerQuery = useQuery({
    queryKey: ["mvp-outbound", "printers"],
    queryFn: fetchPrinterConfigs,
  });

  const detail = detailQuery.data;
  const doc = detail?.document;
  const activeMatches = useMemo(
    () =>
      (detail?.itemMatches ?? []).filter((match) => match.status !== "REMOVED"),
    [detail],
  );
  const packingLabels = useMemo(
    () =>
      (labelQuery.data ?? []).filter(
        (label) => label.documentId === documentId,
      ),
    [documentId, labelQuery.data],
  );
  const packingLabel = packingLabels[0] ?? null;
  const activePrinters = (printerQuery.data ?? []).filter(
    (printer) => printer.status === "ACTIVE",
  );

  useEffect(() => {
    if (!detail) return;
    setVersion(detail.document.version);
    if (
      !detail.lines.some(
        (line) => line.id === lineId && line.scanned < line.expected,
      )
    ) {
      setLineId(
        detail.lines.find((line) => line.scanned < line.expected)?.id ??
          detail.lines[0]?.id ??
          "",
      );
    }
  }, [detail, lineId]);

  useEffect(() => {
    if (packingLabel?.customerPhone && !customerPhone)
      setCustomerPhone(packingLabel.customerPhone);
  }, [packingLabel, customerPhone]);

  useEffect(() => {
    if (!printerId && activePrinters[0]?.id) setPrinterId(activePrinters[0].id);
  }, [activePrinters, printerId]);

  const totalExpected =
    detail?.lines.reduce((sum, line) => sum + line.expected, 0) ?? 0;
  const totalScanned =
    detail?.lines.reduce((sum, line) => sum + line.scanned, 0) ?? 0;
  const fullScan = Boolean(
    detail?.lines.length &&
    detail.lines.every(
      (line) => line.expected > 0 && line.scanned === line.expected,
    ),
  );
  const mutable = doc?.status === "DRAFT" || doc?.status === "SCANNING";
  const labelPrinted = packingLabel?.status === "PRINTED";
  const labelApplied = Boolean(packingLabel?.applied);
  const postBlockReason = !doc
    ? ""
    : !doc.outboundRequestId
      ? "Phiếu thiếu toa/request nguồn."
      : !fullScan
        ? `Chưa scan đủ: ${totalScanned}/${totalExpected}.`
        : packingLabels.length !== 1
          ? packingLabels.length === 0
            ? "Chưa tạo Packing Label cho lô."
            : `Có ${packingLabels.length} Packing Label; phải reconcile về đúng 1.`
          : !labelPrinted
            ? "Packing Label chưa PRINTED."
            : !labelApplied
              ? "Chưa xác nhận đã dán Packing Label."
              : doc.status !== "SCANNING"
                ? "Chỉ phiếu SCANNING mới được Hoàn tất xuất."
                : "";
  const postReady = Boolean(doc && !postBlockReason);

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["mvp-outbound", "detail", documentId],
      }),
      queryClient.invalidateQueries({
        queryKey: ["mvp-outbound", "packing-labels"],
      }),
      queryClient.invalidateQueries({ queryKey: ["mvp-outbound", "list"] }),
    ]);
    onChanged?.();
  };

  const scanMutation = useMutation({
    mutationFn: async () => {
      if (!detail || !lineId || !scanCode.trim())
        throw new Error("Chọn dòng và nhập/quét mã item.");
      return scanOutboundItem({
        documentId,
        lineId,
        codeValue: scanCode.trim(),
        ifMatch: version ?? detail.document.version,
      });
    },
    onSuccess: async (result) => {
      setVersion(result.version || null);
      setScanCode("");
      toast.success("Đã match item. Scan không tạo nhãn và không trừ tồn.");
      await refresh();
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, "Scan/match thất bại.")),
  });

  const unmatchMutation = useMutation({
    mutationFn: async (matchId: string) => {
      if (!detail) throw new Error("Chưa tải phiếu.");
      return unmatchOutboundItem({
        documentId,
        matchId,
        ifMatch: version ?? detail.document.version,
      });
    },
    onSuccess: async (result) => {
      setVersion(result.version || null);
      toast.success("Đã gỡ match; stock-neutral.");
      await refresh();
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, "Gỡ match thất bại.")),
  });

  const createLabelMutation = useMutation({
    mutationFn: async () => {
      if (!fullScan)
        throw new Error("Phải scan đủ toàn bộ phiếu trước khi tạo nhãn.");
      if (!customerPhone.trim())
        throw new Error("SĐT khách hàng là bắt buộc trên Packing Label.");
      return createPackingLabel({ documentId, customerPhone });
    },
    onSuccess: async () => {
      toast.success("Đã tạo đúng 01 Packing Label cho phiếu/lô xuất.");
      await refresh();
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, "Không thể tạo Packing Label.")),
  });

  const printMutation = useMutation({
    mutationFn: async (label: PackingLabelRecord) => {
      if (!printerId) throw new Error("Chọn máy in ACTIVE.");
      return label.status === "PENDING_PRINT"
        ? printLabelSnapshot(label.id, printerId)
        : reprintLabelSnapshot(label.id, printerId);
    },
    onSuccess: async () => {
      toast.success("Đã gửi lệnh in/in lại Packing Label; tồn kho không đổi.");
      await refresh();
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, "In Packing Label thất bại.")),
  });

  const applyMutation = useMutation({
    mutationFn: (label: PackingLabelRecord) => applyPackingLabel(label.id),
    onSuccess: async () => {
      toast.success("Đã xác nhận dán Packing Label; tồn kho vẫn chưa đổi.");
      await refresh();
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, "Không thể xác nhận dán nhãn.")),
  });

  const rfidMutation = useMutation({
    mutationFn: async () => {
      if (!rfidTarget) throw new Error("Chưa chọn item.");
      if (!rfidCode.trim() || !rfidHardwareUid.trim())
        throw new Error("Nhập RFID code và hardware UID, hoặc bỏ qua RFID.");
      return assignRfidToItem({
        itemId: rfidTarget.itemId,
        codeValue: rfidCode.trim(),
        hardwareUid: rfidHardwareUid.trim(),
      });
    },
    onSuccess: async () => {
      toast.success("Đã map RFID tùy chọn; stock-neutral.");
      setRfidTarget(null);
      setRfidCode("");
      setRfidHardwareUid("");
      await refresh();
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, "Map RFID thất bại.")),
  });

  const postMutation = useMutation({
    mutationFn: async () => {
      if (!detail || !postReady)
        throw new Error(postBlockReason || "Phiếu chưa sẵn sàng.");
      return postOutboundIssue({
        documentId,
        ifMatch: version ?? detail.document.version,
        idempotencyKey: makeKey(`post-issue-${documentId}`),
      });
    },
    onSuccess: async (result) => {
      setEvidence(result);
      toast.success(
        "Hoàn tất xuất thành công. Tồn kho được trừ tại Post Issue.",
      );
      await refresh();
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, "Hoàn tất xuất thất bại.")),
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      if (!detail || !cancelReason.trim())
        throw new Error("Lý do hủy là bắt buộc.");
      return cancelOutboundDocument(
        documentId,
        cancelReason.trim(),
        version ?? detail.document.version,
      );
    },
    onSuccess: async () => {
      toast.success("Đã hủy phiếu; không phát sinh stock effect.");
      setCancelOpen(false);
      await refresh();
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, "Hủy phiếu thất bại.")),
  });

  const lineColumns: ColumnsType<OutboundLineRecord> = [
    {
      title: "SKU",
      dataIndex: "productId",
      width: 250,
      render: (value) => <Text code>{short(value)}</Text>,
    },
    { title: "Yêu cầu", dataIndex: "expected", width: 90, align: "right" },
    { title: "Đã scan", dataIndex: "scanned", width: 90, align: "right" },
    { title: "Còn lại", dataIndex: "remaining", width: 90, align: "right" },
    {
      title: "Kết quả",
      width: 100,
      render: (_, row) => (
        <Tag color={row.scanned === row.expected ? "success" : "warning"}>
          {row.scanned === row.expected ? "ĐỦ" : "CHƯA ĐỦ"}
        </Tag>
      ),
    },
  ];

  const matchColumns: ColumnsType<OutboundItemMatchRecord> = [
    {
      title: "Item",
      width: 190,
      render: (_, row) => row.itemCode ?? row.serialNumber ?? short(row.itemId),
    },
    {
      title: "SKU",
      dataIndex: "skuId",
      width: 160,
      render: (value) => short(value),
    },
    {
      title: "RFID (tùy chọn)",
      width: 190,
      render: (_, row) =>
        row.rfidCode ? (
          <Tag color="blue">{row.rfidCode}</Tag>
        ) : (
          <Tag>Không có · vẫn Post được</Tag>
        ),
    },
    {
      title: "Hành động",
      width: 210,
      render: (_, row) => (
        <Space size={4}>
          {can("physical_code.assign_rfid") &&
          row.itemId &&
          !row.rfidCode &&
          mutable ? (
            <Button
              size="small"
              onClick={() =>
                setRfidTarget({
                  itemId: row.itemId as string,
                  itemCode: row.itemCode ?? short(row.itemId),
                })
              }
            >
              RFID tùy chọn
            </Button>
          ) : null}
          {can("outbound.scan") &&
          mutable &&
          !packingLabel &&
          row.status === "ACTIVE" ? (
            <Button
              size="small"
              danger
              icon={<DisconnectOutlined />}
              loading={unmatchMutation.isPending}
              onClick={() => unmatchMutation.mutate(row.id)}
            >
              Gỡ
            </Button>
          ) : null}
        </Space>
      ),
    },
  ];

  if (detailQuery.isError) {
    return (
      <Modal
        open
        width={900}
        title="Chi tiết phiếu xuất"
        onCancel={onClose}
        footer={null}
      >
        <ApiErrorAlert
          error={detailQuery.error}
          title="Không tải được phiếu xuất"
          onRetry={() => detailQuery.refetch()}
        />
      </Modal>
    );
  }

  return (
    <Modal
      open
      width={1180}
      title="Chi tiết phiếu xuất · Scan → 1 Packing Label/lô → Hoàn tất xuất"
      onCancel={onClose}
      footer={null}
      destroyOnClose
    >
      <Space orientation="vertical" size={16} style={{ width: "100%" }}>
        <Alert
          type="info"
          showIcon
          title="Baseline hiện hành"
          description="Scan đủ → tổng hợp lô → tạo/preview/in/dán đúng 01 Packing Label → RFID tùy chọn → Hoàn tất xuất. Chỉ Post Issue mới trừ tồn."
        />

        <Descriptions bordered size="small" column={{ xs: 1, sm: 2, lg: 4 }}>
          <Descriptions.Item label="Phiếu">
            {doc?.code ?? "-"}
          </Descriptions.Item>
          <Descriptions.Item label="Trạng thái">
            <Tag>{doc?.status ?? "-"}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Người nhận">
            {doc?.recipientName ?? "-"}
          </Descriptions.Item>
          <Descriptions.Item label="Ngày">{doc?.date ?? "-"}</Descriptions.Item>
          <Descriptions.Item label="Địa chỉ" span={2}>
            {doc?.recipientAddress ?? "-"}
          </Descriptions.Item>
          <Descriptions.Item label="Request">
            {short(doc?.outboundRequestId)}
          </Descriptions.Item>
          <Descriptions.Item label="Version">
            {version ?? doc?.version ?? "-"}
          </Descriptions.Item>
        </Descriptions>

        <Card title="1 · Scan & match item — stock-neutral" size="small">
          <Space orientation="vertical" style={{ width: "100%" }} size={10}>
            <Progress
              percent={
                totalExpected > 0
                  ? Math.round((totalScanned / totalExpected) * 100)
                  : 0
              }
              status={fullScan ? "success" : "active"}
              format={() => `${totalScanned}/${totalExpected}`}
            />
            {mutable && can("outbound.scan") && !packingLabel ? (
              <Space wrap>
                <Select
                  style={{ width: 290 }}
                  value={lineId || undefined}
                  placeholder="Chọn dòng còn thiếu"
                  onChange={setLineId}
                  options={(detail?.lines ?? []).map((line) => ({
                    value: line.id,
                    label: `${short(line.productId)} · ${line.scanned}/${line.expected}`,
                    disabled: line.scanned >= line.expected,
                  }))}
                />
                <Input
                  style={{ width: 310 }}
                  value={scanCode}
                  placeholder="Barcode/QR hoặc mã item"
                  onChange={(event) => setScanCode(event.target.value)}
                  onPressEnter={() => scanMutation.mutate()}
                />
                <Button
                  type="primary"
                  icon={<ScanOutlined />}
                  loading={scanMutation.isPending}
                  disabled={!lineId || !scanCode.trim()}
                  onClick={() => scanMutation.mutate()}
                >
                  Match item
                </Button>
              </Space>
            ) : packingLabel ? (
              <Alert
                type="warning"
                showIcon
                title="Đã tạo Packing Label; match được khóa để bảo toàn snapshot nhãn."
              />
            ) : null}
            <Table
              rowKey="id"
              size="small"
              pagination={false}
              columns={lineColumns}
              dataSource={detail?.lines ?? []}
              scroll={{ x: 700 }}
            />
            <Table
              rowKey="id"
              size="small"
              pagination={false}
              columns={matchColumns}
              dataSource={activeMatches}
              scroll={{ x: 780 }}
            />
          </Space>
        </Card>

        <Card
          title="2 · Tổng hợp & Packing Label — đúng 01 nhãn/phiếu-lô"
          size="small"
        >
          {!packingLabel ? (
            <Space orientation="vertical" style={{ width: "100%" }}>
              <Alert
                type={fullScan ? "success" : "warning"}
                showIcon
                title={
                  fullScan
                    ? "Đã scan đủ. Có thể tạo Packing Label."
                    : "Chưa scan đủ. Chưa được tạo nhãn."
                }
              />
              <Space wrap>
                <Input
                  style={{ width: 300 }}
                  value={customerPhone}
                  placeholder="SĐT khách hàng trên Packing Label"
                  disabled={!fullScan}
                  onChange={(event) => setCustomerPhone(event.target.value)}
                />
                <Button
                  type="primary"
                  icon={<TagOutlined />}
                  disabled={
                    !fullScan || !can("label.print") || !customerPhone.trim()
                  }
                  loading={createLabelMutation.isPending}
                  onClick={() => createLabelMutation.mutate()}
                >
                  Tạo & preview 01 Packing Label
                </Button>
              </Space>
            </Space>
          ) : (
            <Space orientation="vertical" style={{ width: "100%" }} size={12}>
              {packingLabels.length > 1 ? (
                <Alert
                  type="error"
                  showIcon
                  title={`Có ${packingLabels.length} nhãn canonical cho cùng phiếu; không được Post.`}
                />
              ) : null}
              <div className="label-preview">
                <div className="label-head">
                  <div>
                    <div className="label-brand">HOA NAM · PACKING LABEL</div>
                    <div className="label-sub">
                      01 nhãn duy nhất cho phiếu/lô xuất
                    </div>
                  </div>
                  <Tag
                    color={
                      packingLabel.status === "PRINTED"
                        ? "success"
                        : packingLabel.status === "PRINT_FAILED"
                          ? "error"
                          : "warning"
                    }
                  >
                    {packingLabel.status}
                  </Tag>
                </div>
                <Descriptions bordered size="small" column={2}>
                  <Descriptions.Item label="Mã nhãn">
                    {packingLabel.labelCode}
                  </Descriptions.Item>
                  <Descriptions.Item label="Phiếu">
                    {packingLabel.outboundNo || doc?.code}
                  </Descriptions.Item>
                  <Descriptions.Item label="Người nhận">
                    {packingLabel.recipientName}
                  </Descriptions.Item>
                  <Descriptions.Item label="SĐT">
                    {packingLabel.customerPhone}
                  </Descriptions.Item>
                  <Descriptions.Item label="Địa chỉ" span={2}>
                    {packingLabel.recipientAddress}
                  </Descriptions.Item>
                  <Descriptions.Item label="Tổng item">
                    {packingLabel.itemCount}
                  </Descriptions.Item>
                  <Descriptions.Item label="Số SKU">
                    {packingLabel.skuCount}
                  </Descriptions.Item>
                </Descriptions>
                <Table
                  style={{ marginTop: 10 }}
                  rowKey={(row) => `${row.skuId}-${row.skuCode}`}
                  size="small"
                  pagination={false}
                  dataSource={packingLabel.skuSummary}
                  columns={[
                    { title: "SKU", dataIndex: "skuCode" },
                    { title: "Tên hàng", dataIndex: "skuName" },
                    {
                      title: "SL",
                      dataIndex: "quantity",
                      width: 80,
                      align: "right",
                    },
                  ]}
                />
              </div>
              <Space wrap>
                <Select
                  style={{ width: 300 }}
                  placeholder="Chọn máy in"
                  value={printerId || undefined}
                  onChange={setPrinterId}
                  options={activePrinters.map((printer) => ({
                    value: printer.id,
                    label: `${printer.code} · ${printer.name}`,
                  }))}
                />
                <Button
                  icon={<PrinterOutlined />}
                  disabled={
                    !printerId || (!can("label.print") && !can("label.reprint"))
                  }
                  loading={printMutation.isPending}
                  onClick={() => printMutation.mutate(packingLabel)}
                >
                  {packingLabel.status === "PENDING_PRINT"
                    ? "In Packing Label"
                    : "In lại Packing Label"}
                </Button>
                <Button
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  disabled={
                    !labelPrinted || labelApplied || !can("label.print")
                  }
                  loading={applyMutation.isPending}
                  onClick={() => applyMutation.mutate(packingLabel)}
                >
                  {labelApplied ? "Đã dán nhãn" : "Xác nhận đã dán nhãn"}
                </Button>
              </Space>
            </Space>
          )}
        </Card>

        <Card title="3 · RFID tùy chọn" size="small">
          <Alert
            type="info"
            showIcon
            title="RFID không phải gate Post Issue"
            description="Có thể map RFID nếu vận hành có tag. Không tạo RFID giả và không chặn Hoàn tất xuất khi thiếu RFID."
          />
        </Card>

        <Card title="4 · Hoàn tất xuất / Post Issue" size="small">
          <Space orientation="vertical" style={{ width: "100%" }}>
            {postBlockReason ? (
              <Alert type="warning" showIcon title={postBlockReason} />
            ) : (
              <Alert
                type="success"
                showIcon
                title="Đủ gate: scan đủ + đúng 01 Packing Label PRINTED + đã dán. RFID không nằm trong gate."
              />
            )}
            <Space wrap>
              <Button
                type="primary"
                size="large"
                disabled={!can("outbound.post") || !postReady}
                loading={postMutation.isPending}
                onClick={() =>
                  Modal.confirm({
                    title: "Hoàn tất xuất / Post Issue?",
                    content:
                      "Đây là thời điểm duy nhất tồn kho bị trừ. Phiếu POSTED là bất biến; sửa sai dùng Reversal.",
                    okText: "Hoàn tất xuất",
                    onOk: () => postMutation.mutateAsync(),
                  })
                }
              >
                Hoàn tất xuất · trừ tồn
              </Button>
              {can("outbound.cancel") && mutable ? (
                <Button danger onClick={() => setCancelOpen(true)}>
                  Hủy phiếu
                </Button>
              ) : null}
            </Space>
            {evidence ? (
              <Alert
                type="success"
                showIcon
                title="Post Issue thành công"
                description={`Document ${evidence.documentId} · ${evidence.movementRefs.length} movement · request ${evidence.requestId || "-"}`}
              />
            ) : null}
          </Space>
        </Card>
      </Space>

      <Modal
        open={Boolean(rfidTarget)}
        title={`Map RFID tùy chọn · ${rfidTarget?.itemCode ?? ""}`}
        onCancel={() => setRfidTarget(null)}
        onOk={() => rfidMutation.mutate()}
        okText="Map RFID"
        confirmLoading={rfidMutation.isPending}
      >
        <Alert
          style={{ marginBottom: 12 }}
          type="info"
          title="Có thể đóng và bỏ qua RFID; Post Issue vẫn hợp lệ."
        />
        <Space orientation="vertical" style={{ width: "100%" }}>
          <Input
            value={rfidCode}
            placeholder="RFID code"
            onChange={(event) => setRfidCode(event.target.value)}
          />
          <Input
            value={rfidHardwareUid}
            placeholder="Hardware UID"
            onChange={(event) => setRfidHardwareUid(event.target.value)}
          />
        </Space>
      </Modal>

      <Modal
        open={cancelOpen}
        title="Hủy phiếu xuất"
        onCancel={() => setCancelOpen(false)}
        onOk={() => cancelMutation.mutate()}
        okText="Hủy phiếu"
        okButtonProps={{ danger: true }}
        confirmLoading={cancelMutation.isPending}
      >
        <Input.TextArea
          rows={4}
          value={cancelReason}
          placeholder="Lý do hủy"
          onChange={(event) => setCancelReason(event.target.value)}
        />
      </Modal>
    </Modal>
  );
}
