import { useEffect, useMemo, useRef, useState } from "react";
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
  CameraOutlined,
  CheckCircleOutlined,
  DisconnectOutlined,
  EyeOutlined,
  PrinterOutlined,
  ScanOutlined,
  TagOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getApiErrorMessage, normalizeError } from "@/shared/api/api-error";
import {
  classifyPostIssueError,
  shouldReuseIdempotencyKey,
} from "@/shared/api/post-issue-contract";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import { CameraScanModal } from "@/shared/components/forms/CameraScanModal";
import { useHasPermission } from "@/shared/components/permission";
import {
  OUTBOUND_STATUS_LABELS,
  businessLabel,
} from "@/shared/constants/business-labels";
import {
  applyPackingLabel,
  assignRfidToItem,
  cancelOutboundDocument,
  createPackingLabel,
  fetchAvailableQtyBySku,
  fetchOutboundDetail,
  fetchPackingLabels,
  fetchPrinterConfigs,
  postOutboundIssue,
  previewPackingLabel,
  printLabelSnapshot,
  readyPackingLabel,
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
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  return `${prefix}-${random}`;
}

function short(value?: string | null): string {
  if (!value) return "-";
  return value.length > 18 ? `${value.slice(0, 14)}…` : value;
}

const LABEL_STATUS_LABELS: Readonly<Record<string, string>> = {
  DRAFT: "Nháp",
  PENDING_PRINT: "Chờ in",
  PREVIEWED: "Đã xem trước",
  READY_TO_PRINT: "Sẵn sàng in",
  PRINTED: "Đã in",
  PRINT_FAILED: "In thất bại",
  APPLIED: "Đã dán",
};

function labelStatus(value?: string | null): string {
  return businessLabel(LABEL_STATUS_LABELS, value);
}

/**
 * BA baseline 2026-08-25:
 * 1) Quét/đối chiếu đủ hàng.
 * 2) Ghi nhận xuất kho (Post Issue) là transaction trừ tồn độc lập.
 * 3) Packing Label là transaction vận hành sau Post; lỗi in không rollback tồn.
 * RFID vẫn tùy chọn và không phải gate của Post Issue.
 */
export function AlignedOutboundDetailModal({ documentId, onClose, onChanged }: Props) {
  const can = useHasPermission();
  const queryClient = useQueryClient();
  const [version, setVersion] = useState<number | null>(null);
  const [lineId, setLineId] = useState("");
  const [scanCode, setScanCode] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [customerPhone, setCustomerPhone] = useState("");
  const [printerId, setPrinterId] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [rfidTarget, setRfidTarget] = useState<RfidTarget | null>(null);
  const [rfidCode, setRfidCode] = useState("");
  const [rfidHardwareUid, setRfidHardwareUid] = useState("");
  const [evidence, setEvidence] = useState<IssueEvidence | null>(null);
  const postKeyRef = useRef<string | null>(null);
  const [scanRejects, setScanRejects] = useState({ wrongSku: 0, duplicate: 0, unknown: 0 });

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
  const lineSkuIds = useMemo(
    () => [...new Set((detail?.lines ?? []).map((line) => line.productId).filter(Boolean))],
    [detail],
  );
  const availabilityQuery = useQuery({
    queryKey: ["mvp-outbound", "availability", documentId, lineSkuIds],
    enabled: lineSkuIds.length > 0,
    retry: false,
    queryFn: () => fetchAvailableQtyBySku(lineSkuIds),
  });

  const activeMatches = useMemo(
    () => (detail?.itemMatches ?? []).filter((match) => match.status !== "REMOVED"),
    [detail],
  );
  const packingLabels = useMemo(
    () => (labelQuery.data ?? []).filter((label) => label.documentId === documentId),
    [documentId, labelQuery.data],
  );
  const packingLabel = packingLabels[0] ?? null;
  const activePrinters = (printerQuery.data ?? []).filter((printer) => printer.status === "ACTIVE");

  useEffect(() => {
    if (!detail) return;
    setVersion(detail.document.version);
    if (lineId && !detail.lines.some((line) => line.id === lineId && line.scanned < line.expected)) {
      setLineId("");
    }
  }, [detail, lineId]);

  useEffect(() => {
    postKeyRef.current = null;
  }, [documentId]);

  useEffect(() => {
    if (packingLabel?.customerPhone && !customerPhone) setCustomerPhone(packingLabel.customerPhone);
  }, [packingLabel, customerPhone]);

  useEffect(() => {
    if (!printerId && activePrinters[0]?.id) setPrinterId(activePrinters[0].id);
  }, [activePrinters, printerId]);

  const totalExpected = detail?.lines.reduce((sum, line) => sum + line.expected, 0) ?? 0;
  const totalScanned = detail?.lines.reduce((sum, line) => sum + line.scanned, 0) ?? 0;
  const fullScan = Boolean(
    detail?.lines.length && detail.lines.every((line) => line.expected > 0 && line.scanned === line.expected),
  );
  const mutable = doc?.status === "DRAFT" || doc?.status === "SCANNING";
  const posted = doc?.status === "POSTED";
  const rfidMappedCount = activeMatches.filter((match) => match.rfidCode).length;
  const customerPhoneValid = customerPhone === "" || /^0\d{9}$/.test(customerPhone);

  // Critical BA fix: Packing Label is deliberately NOT part of this gate.
  const postBlockReason = !doc
    ? ""
    : !doc.outboundRequestId
      ? "Phiếu thiếu yêu cầu xuất nguồn."
      : !fullScan
        ? `Chưa quét đủ: ${totalScanned}/${totalExpected}.`
        : doc.status !== "SCANNING"
          ? "Chỉ phiếu đang quét xuất hàng mới được ghi nhận xuất kho."
          : "";
  const postReady = Boolean(doc && !postBlockReason);

  const labelPrinted = packingLabel?.status === "PRINTED";
  const labelApplied = Boolean(packingLabel?.applied);
  const labelReadyToPrint = packingLabel?.status === "READY_TO_PRINT";
  const labelPrintFailed = packingLabel?.status === "PRINT_FAILED";
  const canPreviewLabel = Boolean(
    packingLabel && ["DRAFT", "PENDING_PRINT", "PREVIEWED"].includes(packingLabel.status),
  );
  const canReadyLabel = canPreviewLabel;
  const canSendPrint = labelReadyToPrint || labelPrintFailed;
  const canReprint = labelPrinted || labelPrintFailed;

  const availability = availabilityQuery.data ?? {};
  const shortStockLines = (detail?.lines ?? []).filter(
    (line) => availabilityQuery.isSuccess && (availability[line.productId] ?? 0) < line.expected,
  );

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["mvp-outbound", "detail", documentId] }),
      queryClient.invalidateQueries({ queryKey: ["mvp-outbound", "packing-labels"] }),
      queryClient.invalidateQueries({ queryKey: ["mvp-outbound", "list"] }),
    ]);
    onChanged?.();
  };

  const scanMutation = useMutation({
    mutationFn: async (input: { rawCode: string; scanSource: "CAMERA" | "MANUAL" }) => {
      const codeValue = input.rawCode.trim();
      if (!detail || !codeValue) throw new Error("Nhập hoặc quét mã sản phẩm trước.");
      return scanOutboundItem({
        documentId,
        lineId: lineId || undefined,
        codeValue,
        scanSource: input.scanSource,
        ifMatch: version ?? detail.document.version,
      });
    },
    onSuccess: async (result) => {
      setVersion(result.version || null);
      setScanCode("");
      toast.success("Đã đối chiếu sản phẩm. Quét không tạo nhãn và không trừ tồn kho.");
      await refresh();
    },
    onError: (error) => {
      const code = normalizeError(error).code ?? "";
      setScanRejects((current) =>
        code.includes("DUPLICATE")
          ? { ...current, duplicate: current.duplicate + 1 }
          : code === "WRONG_SKU" || code.includes("SKU") || code.includes("MISMATCH")
            ? { ...current, wrongSku: current.wrongSku + 1 }
            : { ...current, unknown: current.unknown + 1 },
      );
      toast.error(getApiErrorMessage(error, "Quét/đối chiếu thất bại."));
    },
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
      toast.success("Đã gỡ đối chiếu; tồn kho không thay đổi.");
      await refresh();
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Gỡ đối chiếu thất bại.")),
  });

  const postMutation = useMutation({
    mutationFn: async () => {
      if (!detail || !postReady) throw new Error(postBlockReason || "Phiếu chưa sẵn sàng.");
      const idempotencyKey = postKeyRef.current ?? makeKey(`post-issue-${documentId}`);
      postKeyRef.current = idempotencyKey;
      return postOutboundIssue({
        documentId,
        ifMatch: version ?? detail.document.version,
        idempotencyKey,
      });
    },
    onSuccess: async (result) => {
      postKeyRef.current = null;
      setEvidence(result);
      toast.success(
        result.replayed
          ? "Phiếu đã được ghi nhận xuất kho trước đó; tồn không bị trừ thêm."
          : "Ghi nhận xuất kho thành công. Tồn kho đã trừ đúng một lần. Có thể tiếp tục tạo/in nhãn.",
      );
      await refresh();
    },
    onError: async (error) => {
      if (!shouldReuseIdempotencyKey(error)) postKeyRef.current = null;
      const outcome = classifyPostIssueError(error);
      toast.error(outcome?.message ?? getApiErrorMessage(error, "Ghi nhận xuất kho thất bại."));
      if (outcome !== null) await refresh();
    },
  });

  const createLabelMutation = useMutation({
    mutationFn: async () => {
      if (!posted) throw new Error("Chỉ tạo nhãn sau khi đã ghi nhận xuất kho.");
      return createPackingLabel({ documentId, customerPhone });
    },
    onSuccess: async () => {
      toast.success("Đã tạo đúng 01 nhãn đóng gói cho phiếu/lô đã xuất.");
      await refresh();
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Không thể tạo nhãn đóng gói.")),
  });

  const previewMutation = useMutation({
    mutationFn: (label: PackingLabelRecord) =>
      previewPackingLabel({ documentId, labelId: label.id, ifMatch: label.version }),
    onSuccess: refresh,
    onError: (error) => toast.error(getApiErrorMessage(error, "Xem trước nhãn thất bại.")),
  });
  const readyMutation = useMutation({
    mutationFn: (label: PackingLabelRecord) =>
      readyPackingLabel({
        documentId,
        labelId: label.id,
        ifMatch: label.version,
        idempotencyKey: makeKey(`label-ready-${label.id}`),
      }),
    onSuccess: refresh,
    onError: (error) => toast.error(getApiErrorMessage(error, "Đưa nhãn về trạng thái sẵn sàng thất bại.")),
  });
  const printMutation = useMutation({
    mutationFn: async (label: PackingLabelRecord) => {
      if (!printerId) throw new Error("Chọn máy in đang hoạt động.");
      const payload = {
        documentId,
        labelId: label.id,
        printerConfigId: printerId,
        ifMatch: label.version,
        idempotencyKey: makeKey(`label-print-${label.id}`),
      };
      return label.status === "PRINTED" ? reprintLabelSnapshot(payload) : printLabelSnapshot(payload);
    },
    onSuccess: async () => {
      toast.success("Đã gửi lệnh in/in lại nhãn. Kết quả in không làm thay đổi transaction tồn kho đã Post.");
      await refresh();
    },
    onError: async (error) => {
      toast.error(getApiErrorMessage(error, "In nhãn đóng gói thất bại. Phiếu xuất kho vẫn giữ trạng thái đã Post."));
      await refresh();
    },
  });
  const applyMutation = useMutation({
    mutationFn: (label: PackingLabelRecord) => applyPackingLabel(label.id, label.version),
    onSuccess: refresh,
    onError: (error) => toast.error(getApiErrorMessage(error, "Không thể xác nhận dán nhãn.")),
  });

  const rfidMutation = useMutation({
    mutationFn: async () => {
      if (!rfidTarget || !detail) throw new Error("Chưa chọn sản phẩm.");
      if (!rfidHardwareUid.trim()) throw new Error("Nhập UID phần cứng của thẻ, hoặc bỏ qua RFID.");
      return assignRfidToItem({
        documentId,
        itemId: rfidTarget.itemId,
        codeValue: rfidCode.trim() || rfidHardwareUid.trim(),
        hardwareUid: rfidHardwareUid.trim(),
        ifMatch: version ?? detail.document.version,
      });
    },
    onSuccess: async () => {
      setRfidTarget(null);
      setRfidCode("");
      setRfidHardwareUid("");
      toast.success("Đã gán RFID tùy chọn; tồn kho không thay đổi.");
      await refresh();
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Gán RFID thất bại.")),
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      if (!detail || !cancelReason.trim()) throw new Error("Lý do hủy là bắt buộc.");
      return cancelOutboundDocument(documentId, cancelReason.trim(), version ?? detail.document.version);
    },
    onSuccess: async () => {
      setCancelOpen(false);
      toast.success("Đã hủy phiếu; không làm thay đổi tồn kho.");
      await refresh();
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Hủy phiếu thất bại.")),
  });

  const lineColumns: ColumnsType<OutboundLineRecord> = [
    { title: "SKU", dataIndex: "productId", width: 220, render: (value) => <Text code>{short(value)}</Text> },
    { title: "Yêu cầu", dataIndex: "expected", width: 90, align: "right" },
    { title: "Đã quét", dataIndex: "scanned", width: 90, align: "right" },
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
    { title: "Sản phẩm", width: 180, render: (_, row) => row.itemCode ?? row.serialNumber ?? short(row.itemId) },
    { title: "SKU", dataIndex: "skuId", width: 150, render: (value) => short(value) },
    {
      title: "RFID",
      width: 180,
      render: (_, row) => (row.rfidCode ? <Tag color="blue">{row.rfidCode}</Tag> : <Tag>Tùy chọn</Tag>),
    },
    {
      title: "Hành động",
      width: 220,
      render: (_, row) => (
        <Space size={4}>
          {can("physical_code.assign_rfid") && row.itemId && !row.rfidCode && mutable ? (
            <Button size="small" onClick={() => setRfidTarget({ itemId: row.itemId as string, itemCode: row.itemCode ?? short(row.itemId) })}>
              Gán RFID
            </Button>
          ) : null}
          {can("outbound.scan") && mutable && row.status === "ACTIVE" ? (
            <Button size="small" danger icon={<DisconnectOutlined />} onClick={() => unmatchMutation.mutate(row.id)}>
              Gỡ
            </Button>
          ) : null}
        </Space>
      ),
    },
  ];

  if (detailQuery.isError) {
    return (
      <Modal open width={900} title="Chi tiết phiếu xuất" onCancel={onClose} footer={null}>
        <ApiErrorAlert error={detailQuery.error} title="Không tải được phiếu xuất" onRetry={() => detailQuery.refetch()} />
      </Modal>
    );
  }

  return (
    <Modal open width={1180} title="Chi tiết phiếu xuất · Quét → Ghi nhận xuất kho → In nhãn" onCancel={onClose} footer={null} destroyOnClose>
      <Space orientation="vertical" size={16} style={{ width: "100%" }}>
        <Alert
          type="info"
          showIcon
          title="Luồng nghiệp vụ hiện hành"
          description="Quét đủ hàng → Ghi nhận xuất kho (trừ tồn) → tạo/xem trước/in/dán nhãn đóng gói. Lỗi in nhãn không rollback hoặc chặn transaction xuất kho. RFID là tùy chọn."
        />

        <Descriptions bordered size="small" column={{ xs: 1, sm: 2, lg: 4 }}>
          <Descriptions.Item label="Phiếu">{doc?.code ?? "-"}</Descriptions.Item>
          <Descriptions.Item label="Trạng thái"><Tag>{businessLabel(OUTBOUND_STATUS_LABELS, doc?.status)}</Tag></Descriptions.Item>
          <Descriptions.Item label="Người nhận">{doc?.recipientName ?? "-"}</Descriptions.Item>
          <Descriptions.Item label="Yêu cầu xuất">{short(doc?.outboundRequestId)}</Descriptions.Item>
          <Descriptions.Item label="Địa chỉ" span={2}>{doc?.recipientAddress ?? "-"}</Descriptions.Item>
          <Descriptions.Item label="Phiên bản">{version ?? doc?.version ?? "-"}</Descriptions.Item>
          <Descriptions.Item label="RFID">{rfidMappedCount}/{activeMatches.length} · tùy chọn</Descriptions.Item>
        </Descriptions>

        <Card title="1 · Quét & đối chiếu sản phẩm — stock-neutral" size="small">
          <Space orientation="vertical" style={{ width: "100%" }} size={10}>
            <Space wrap>
              <Tag color="success">Đã quét: {totalScanned}/{totalExpected}</Tag>
              <Tag color={scanRejects.wrongSku ? "error" : "default"}>Sai SKU: {scanRejects.wrongSku}</Tag>
              <Tag color={scanRejects.duplicate ? "error" : "default"}>Trùng: {scanRejects.duplicate}</Tag>
              <Tag color={scanRejects.unknown ? "error" : "default"}>Không nhận diện: {scanRejects.unknown}</Tag>
            </Space>
            <Progress percent={totalExpected ? Math.round((totalScanned / totalExpected) * 100) : 0} status={fullScan ? "success" : "active"} format={() => `${totalScanned}/${totalExpected}`} />
            {mutable && can("outbound.scan") ? (
              <Space wrap>
                <Select
                  style={{ width: 300 }}
                  value={lineId}
                  onChange={setLineId}
                  options={[
                    { value: "", label: "Tự động theo QR/SKU" },
                    ...(detail?.lines ?? []).map((line) => ({ value: line.id, label: `${short(line.productId)} · ${line.scanned}/${line.expected}`, disabled: line.scanned >= line.expected })),
                  ]}
                />
                <Input style={{ width: 300 }} value={scanCode} placeholder="Quét mã vạch / QR" onChange={(event) => setScanCode(event.target.value)} />
                <Button icon={<CameraOutlined />} onClick={() => setCameraOpen(true)}>Camera</Button>
                <Button type="primary" icon={<ScanOutlined />} disabled={!scanCode.trim()} loading={scanMutation.isPending} onClick={() => scanMutation.mutate({ rawCode: scanCode, scanSource: "MANUAL" })}>
                  Đối chiếu
                </Button>
              </Space>
            ) : null}
            <Table rowKey="id" size="small" pagination={false} columns={lineColumns} dataSource={detail?.lines ?? []} scroll={{ x: "max-content" }} />
            <Table rowKey="id" size="small" pagination={false} columns={matchColumns} dataSource={activeMatches} scroll={{ x: 760 }} />
          </Space>
        </Card>

        <Card title="2 · Ghi nhận xuất kho — transaction trừ tồn" size="small">
          <Space orientation="vertical" style={{ width: "100%" }}>
            {shortStockLines.length ? (
              <Alert type="warning" showIcon title="Tồn khả dụng hiện thấp hơn số lượng cần xuất" description={`Các SKU thiếu: ${shortStockLines.map((line) => short(line.productId)).join(", ")}. BE sẽ kiểm tra lại atomically tại Post Issue.`} />
            ) : null}
            {posted ? (
              <Alert type="success" showIcon title="Phiếu đã ghi nhận xuất kho. Packing Label được xử lý độc lập ở bước 3." />
            ) : postBlockReason ? (
              <Alert type="warning" showIcon title={postBlockReason} />
            ) : (
              <Alert type="success" showIcon title="Đủ điều kiện Post Issue: đã quét đủ và có yêu cầu xuất nguồn. Nhãn/RFID không phải điều kiện chặn." />
            )}
            <Space wrap>
              <Button
                type="primary"
                size="large"
                disabled={!can("outbound.post") || !postReady}
                loading={postMutation.isPending}
                onClick={() => Modal.confirm({
                  title: "Ghi nhận xuất kho?",
                  content: "Đây là thời điểm tồn kho bị trừ. Việc tạo/in nhãn được thực hiện độc lập sau khi Post thành công.",
                  okText: "Ghi nhận xuất kho",
                  onOk: () => postMutation.mutateAsync(),
                })}
              >
                Ghi nhận xuất kho · trừ tồn
              </Button>
              {can("outbound.cancel") && mutable ? <Button danger onClick={() => setCancelOpen(true)}>Hủy phiếu</Button> : null}
            </Space>
            {evidence ? <Alert type="success" showIcon title="Ghi nhận xuất kho thành công" description={`Phiếu ${evidence.documentId} · ${evidence.movementRefs.length} movement · request ${evidence.requestId || "-"}`} /> : null}
          </Space>
        </Card>

        <Card title="3 · Packing Label — transaction độc lập sau xuất kho" size="small">
          {!posted ? (
            <Alert type="info" showIcon title="Ghi nhận xuất kho trước. Sau khi Post thành công, thao tác nhãn mới được mở." />
          ) : !packingLabel ? (
            <Space orientation="vertical" style={{ width: "100%" }}>
              <Alert type="info" showIcon title="Phiếu đã Post. Có thể tạo nhãn; nếu in lỗi, tồn kho không bị rollback." />
              <Space wrap>
                <Input
                  style={{ width: 300 }}
                  value={customerPhone}
                  placeholder="SĐT người nhận (tùy chọn)"
                  maxLength={10}
                  inputMode="numeric"
                  status={customerPhoneValid ? undefined : "error"}
                  onChange={(event) => setCustomerPhone(event.target.value.replace(/\D/g, "").slice(0, 10))}
                />
                <Button type="primary" icon={<TagOutlined />} disabled={!customerPhoneValid || (!can("packing_label.preview") && !can("label.print"))} loading={createLabelMutation.isPending} onClick={() => createLabelMutation.mutate()}>
                  Tạo 01 nhãn đóng gói
                </Button>
              </Space>
            </Space>
          ) : (
            <Space orientation="vertical" style={{ width: "100%" }} size={12}>
              {packingLabels.length > 1 ? <Alert type="error" showIcon title={`Có ${packingLabels.length} nhãn cho cùng phiếu; cần xử lý về một nhãn chính thức.`} /> : null}
              <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }}>
                <Descriptions.Item label="Mã nhãn">{packingLabel.labelCode}</Descriptions.Item>
                <Descriptions.Item label="Trạng thái"><Tag color={labelPrinted ? "success" : "warning"}>{labelStatus(packingLabel.status)}</Tag></Descriptions.Item>
                <Descriptions.Item label="Người nhận">{packingLabel.recipientName}</Descriptions.Item>
                <Descriptions.Item label="Tổng hàng">{packingLabel.skuCount} SKU · {packingLabel.itemCount} sản phẩm</Descriptions.Item>
              </Descriptions>
              <Space wrap>
                <Button icon={<EyeOutlined />} disabled={!canPreviewLabel || (!can("packing_label.preview") && !can("label.print"))} loading={previewMutation.isPending} onClick={() => previewMutation.mutate(packingLabel)}>Xem trước</Button>
                <Button disabled={!canReadyLabel || (!can("packing_label.ready") && !can("label.print"))} loading={readyMutation.isPending} onClick={() => readyMutation.mutate(packingLabel)}>Sẵn sàng in</Button>
                <Select style={{ width: 260 }} placeholder="Chọn máy in" value={printerId || undefined} onChange={setPrinterId} options={activePrinters.map((printer) => ({ value: printer.id, label: `${printer.code} · ${printer.name}` }))} />
                <Button icon={<PrinterOutlined />} disabled={!printerId || !(canSendPrint || canReprint) || (!can("packing_label.print") && !can("packing_label.reprint") && !can("label.print") && !can("label.reprint"))} loading={printMutation.isPending} onClick={() => printMutation.mutate(packingLabel)}>
                  {labelPrinted ? "In lại nhãn" : labelPrintFailed ? "Thử in lại" : "In nhãn"}
                </Button>
                <Button type="primary" icon={<CheckCircleOutlined />} disabled={!labelPrinted || labelApplied || (!can("packing_label.print") && !can("label.print"))} loading={applyMutation.isPending} onClick={() => applyMutation.mutate(packingLabel)}>
                  {labelApplied ? "Đã dán nhãn" : "Xác nhận đã dán"}
                </Button>
              </Space>
              <Alert type="info" showIcon title="In nhãn không có stock effect" description="Lỗi máy in hoặc in lại chỉ tác động nghiệp vụ nhãn; phiếu xuất và stock movements đã Post không bị rollback." />
            </Space>
          )}
        </Card>

        <Card title="4 · RFID tùy chọn" size="small">
          <Alert type="info" showIcon title="RFID không chặn Ghi nhận xuất kho" description={`Đã gán ${rfidMappedCount}/${activeMatches.length}. Có thể bỏ qua hoàn toàn nếu vận hành không dùng thẻ.`} />
        </Card>
      </Space>

      <CameraScanModal
        open={cameraOpen}
        title="Quét sản phẩm xuất kho bằng camera"
        onClose={() => setCameraOpen(false)}
        onDetected={(code) => {
          setCameraOpen(false);
          setScanCode(code);
          scanMutation.mutate({ rawCode: code, scanSource: "CAMERA" });
        }}
      />

      <Modal open={Boolean(rfidTarget)} title={`Gán RFID tùy chọn · ${rfidTarget?.itemCode ?? ""}`} onCancel={() => setRfidTarget(null)} onOk={() => rfidMutation.mutate()} okText="Gán RFID" confirmLoading={rfidMutation.isPending}>
        <Space orientation="vertical" style={{ width: "100%" }}>
          <Input value={rfidCode} placeholder="Mã RFID" onChange={(event) => setRfidCode(event.target.value)} />
          <Input value={rfidHardwareUid} placeholder="UID phần cứng" onChange={(event) => setRfidHardwareUid(event.target.value)} />
        </Space>
      </Modal>

      <Modal open={cancelOpen} title="Hủy phiếu xuất" onCancel={() => setCancelOpen(false)} onOk={() => cancelMutation.mutate()} okText="Hủy phiếu" okButtonProps={{ danger: true }} confirmLoading={cancelMutation.isPending}>
        <Input.TextArea rows={4} value={cancelReason} placeholder="Lý do hủy" onChange={(event) => setCancelReason(event.target.value)} />
      </Modal>
    </Modal>
  );
}
