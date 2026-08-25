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
  LockOutlined,
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

const LABEL_LIFECYCLE = [
  "DRAFT",
  "PREVIEWED",
  "READY_TO_PRINT",
  "PRINTED",
  "APPLIED",
] as const;

const LABEL_STATUS_LABELS: Readonly<Record<string, string>> = {
  DRAFT: "Nháp",
  PENDING_PRINT: "Chờ in",
  PREVIEWED: "Đã xem trước",
  READY_TO_PRINT: "Sẵn sàng in",
  PRINTED: "Đã in",
  PRINT_FAILED: "In thất bại",
  APPLIED: "Đã dán",
};

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

function labelStatus(value?: string | null): string {
  return businessLabel(LABEL_STATUS_LABELS, value);
}

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
  const [cameraOpen, setCameraOpen] = useState(false);
  const [customerPhone, setCustomerPhone] = useState("");
  const customerPhoneValid =
    customerPhone === "" || /^0\d{9}$/.test(customerPhone);
  const [printerId, setPrinterId] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [rfidTarget, setRfidTarget] = useState<RfidTarget | null>(null);
  const [rfidCode, setRfidCode] = useState("");
  const [rfidHardwareUid, setRfidHardwareUid] = useState("");
  const [evidence, setEvidence] = useState<IssueEvidence | null>(null);
  const postKeyRef = useRef<string | null>(null);
  const [scanRejects, setScanRejects] = useState({
    wrongSku: 0,
    duplicate: 0,
    unknown: 0,
  });

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
  const lineSkuIds = useMemo(
    () => [
      ...new Set(
        (detailQuery.data?.lines ?? [])
          .map((line) => line.productId)
          .filter(Boolean),
      ),
    ],
    [detailQuery.data],
  );
  const availabilityQuery = useQuery({
    queryKey: ["mvp-outbound", "availability", documentId, lineSkuIds],
    enabled: lineSkuIds.length > 0,
    retry: false,
    queryFn: () => fetchAvailableQtyBySku(lineSkuIds),
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
      lineId &&
      !detail.lines.some(
        (line) => line.id === lineId && line.scanned < line.expected,
      )
    ) {
      setLineId("");
    }
  }, [detail, lineId]);

  useEffect(() => {
    postKeyRef.current = null;
  }, [documentId]);

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
  const rfidMappedCount = activeMatches.filter((m) => m.rfidCode).length;
  const mutable = doc?.status === "DRAFT" || doc?.status === "SCANNING";
  const labelPrinted = packingLabel?.status === "PRINTED";
  const labelApplied = Boolean(packingLabel?.applied);
  const labelReadyToPrint = packingLabel?.status === "READY_TO_PRINT";
  const labelPrintFailed = packingLabel?.status === "PRINT_FAILED";
  const canPreviewLabel =
    packingLabel !== null &&
    ["DRAFT", "PENDING_PRINT", "PREVIEWED"].includes(packingLabel.status);
  const canReadyLabel =
    packingLabel !== null &&
    ["DRAFT", "PENDING_PRINT", "PREVIEWED"].includes(packingLabel.status);
  const canSendPrint = labelReadyToPrint || labelPrintFailed;
  const canReprint = labelPrinted || labelPrintFailed;
  const postBlockReason = !doc
    ? ""
    : !doc.outboundRequestId
      ? "Phiếu thiếu yêu cầu xuất nguồn."
      : !fullScan
        ? `Chưa quét đủ: ${totalScanned}/${totalExpected}.`
        : packingLabels.length !== 1
          ? packingLabels.length === 0
            ? "Chưa tạo nhãn đóng gói cho lô."
            : `Có ${packingLabels.length} nhãn đóng gói; phải đối chiếu về đúng 1 nhãn.`
          : !labelPrinted
            ? "Nhãn đóng gói chưa được in."
            : !labelApplied
              ? "Chưa xác nhận đã dán nhãn đóng gói."
              : doc.status !== "SCANNING"
                ? "Chỉ phiếu đang quét xuất hàng mới được hoàn tất xuất kho."
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
    mutationFn: async (input: {
      rawCode: string;
      scanSource: "CAMERA" | "MANUAL";
    }) => {
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
      const identity = [
        result.skuCode ? `SKU ${result.skuCode}` : "",
        result.itemUnique ?? "",
      ]
        .filter(Boolean)
        .join(" · ");
      toast.success(
        `${
          result.scanSource === "CAMERA"
            ? "Đã đối chiếu sản phẩm bằng camera."
            : "Đã đối chiếu sản phẩm nhập tay."
        }${identity ? ` ${identity}.` : ""} Quét không tạo nhãn và không trừ tồn kho.`,
      );
      await refresh();
    },
    onError: (error) => {
      const code = normalizeError(error).code ?? "";
      setScanRejects((current) =>
        code.includes("DUPLICATE")
          ? { ...current, duplicate: current.duplicate + 1 }
          : code === "WRONG_SKU" ||
              code.includes("SKU") ||
              code.includes("MISMATCH")
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
    onError: (error) =>
      toast.error(getApiErrorMessage(error, "Gỡ đối chiếu thất bại.")),
  });

  const createLabelMutation = useMutation({
    mutationFn: async () => {
      if (!fullScan)
        throw new Error("Phải quét đủ toàn bộ phiếu trước khi tạo nhãn.");
      return createPackingLabel({ documentId, customerPhone });
    },
    onSuccess: async () => {
      toast.success("Đã tạo đúng 01 nhãn đóng gói cho phiếu/lô xuất.");
      await refresh();
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, "Không thể tạo nhãn đóng gói.")),
  });

  const previewMutation = useMutation({
    mutationFn: (label: PackingLabelRecord) =>
      previewPackingLabel({
        documentId,
        labelId: label.id,
        ifMatch: label.version,
      }),
    onSuccess: async () => {
      toast.success("Đã xem trước nhãn đóng gói; bản lưu nhãn chưa được khóa.");
      await refresh();
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, "Xem trước nhãn đóng gói thất bại.")),
  });

  const readyMutation = useMutation({
    mutationFn: (label: PackingLabelRecord) =>
      readyPackingLabel({
        documentId,
        labelId: label.id,
        ifMatch: label.version,
        idempotencyKey: makeKey(`label-ready-${label.id}`),
      }),
    onSuccess: async () => {
      toast.success(
        "Nhãn đã sẵn sàng — bản lưu nhãn được khóa và có thể gửi lệnh in.",
      );
      await refresh();
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, "Đưa nhãn về trạng thái sẵn sàng thất bại.")),
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
      return label.status === "PRINTED"
        ? reprintLabelSnapshot(payload)
        : printLabelSnapshot(payload);
    },
    onSuccess: async () => {
      toast.success("Đã gửi lệnh in/in lại nhãn đóng gói; tồn kho không đổi.");
      await refresh();
    },
    onError: async (error) => {
      toast.error(getApiErrorMessage(error, "In nhãn đóng gói thất bại."));
      await refresh();
    },
  });

  const applyMutation = useMutation({
    mutationFn: (label: PackingLabelRecord) =>
      applyPackingLabel(label.id, label.version),
    onSuccess: async () => {
      toast.success("Đã xác nhận dán nhãn đóng gói; tồn kho vẫn chưa đổi.");
      await refresh();
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, "Không thể xác nhận dán nhãn.")),
  });

  const rfidMutation = useMutation({
    mutationFn: async () => {
      if (!rfidTarget) throw new Error("Chưa chọn sản phẩm.");
      if (!rfidHardwareUid.trim())
        throw new Error("Nhập UID phần cứng của thẻ, hoặc bỏ qua RFID.");
      if (!detail) throw new Error("Chưa tải phiếu.");
      return assignRfidToItem({
        documentId,
        itemId: rfidTarget.itemId,
        codeValue: rfidCode.trim() || rfidHardwareUid.trim(),
        hardwareUid: rfidHardwareUid.trim(),
        ifMatch: version ?? detail.document.version,
      });
    },
    onSuccess: async () => {
      toast.success("Đã gán RFID tùy chọn; tồn kho không thay đổi.");
      setRfidTarget(null);
      setRfidCode("");
      setRfidHardwareUid("");
      await refresh();
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, "Gán RFID thất bại.")),
  });

  const postMutation = useMutation({
    mutationFn: async () => {
      if (!detail || !postReady)
        throw new Error(postBlockReason || "Phiếu chưa sẵn sàng.");
      const idempotencyKey =
        postKeyRef.current ?? makeKey(`post-issue-${documentId}`);
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
          ? "Phiếu đã được hoàn tất xuất kho trước đó. Hệ thống trả lại kết quả cũ; tồn kho không bị trừ thêm lần nữa."
          : "Hoàn tất xuất kho thành công. Tồn kho đã được trừ đúng một lần.",
      );
      await refresh();
    },
    onError: async (error) => {
      if (!shouldReuseIdempotencyKey(error)) postKeyRef.current = null;
      const outcome = classifyPostIssueError(error);
      toast.error(
        outcome?.message ??
          getApiErrorMessage(error, "Hoàn tất xuất kho thất bại."),
      );
      if (outcome !== null) await refresh();
    },
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
      toast.success("Đã hủy phiếu; không làm thay đổi tồn kho.");
      setCancelOpen(false);
      await refresh();
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, "Hủy phiếu thất bại.")),
  });

  const availability = availabilityQuery.data ?? {};
  const shortStockLines = (detail?.lines ?? []).filter(
    (line) =>
      availabilityQuery.isSuccess &&
      (availability[line.productId] ?? 0) < line.expected,
  );

  const lineColumns: ColumnsType<OutboundLineRecord> = [
    {
      title: "SKU",
      dataIndex: "productId",
      width: 250,
      render: (value) => <Text code>{short(value)}</Text>,
    },
    { title: "Yêu cầu", dataIndex: "expected", width: 90, align: "right" },
    { title: "Đã quét", dataIndex: "scanned", width: 90, align: "right" },
    { title: "Còn lại", dataIndex: "remaining", width: 90, align: "right" },
    {
      title: "Khả dụng",
      key: "available",
      width: 110,
      align: "right",
      render: (_, row) => {
        if (!availabilityQuery.isSuccess) return "-";
        const qty = availability[row.productId] ?? 0;
        return (
          <Text type={qty < row.expected ? "danger" : undefined}>{qty}</Text>
        );
      },
    },
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
      title: "Sản phẩm",
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
          <Tag>Không có · vẫn hoàn tất xuất được</Tag>
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
              Gán RFID tùy chọn
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
      title="Chi tiết phiếu xuất · Quét → 1 nhãn đóng gói/lô → Hoàn tất xuất kho"
      onCancel={onClose}
      footer={null}
      destroyOnClose
    >
      <Space orientation="vertical" size={16} style={{ width: "100%" }}>
        <Alert
          type="info"
          showIcon
          title="Quy trình hiện hành"
          description="Quét đủ → tổng hợp lô → tạo/xem trước/in/dán đúng 01 nhãn đóng gói → RFID tùy chọn → hoàn tất xuất kho. Chỉ bước hoàn tất xuất kho mới trừ tồn."
        />

        <Descriptions bordered size="small" column={{ xs: 1, sm: 2, lg: 4 }}>
          <Descriptions.Item label="Phiếu">
            {doc?.code ?? "-"}
          </Descriptions.Item>
          <Descriptions.Item label="Trạng thái">
            <Tag>{businessLabel(OUTBOUND_STATUS_LABELS, doc?.status)}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Người nhận">
            {doc?.recipientName ?? "-"}
          </Descriptions.Item>
          <Descriptions.Item label="Ngày">{doc?.date ?? "-"}</Descriptions.Item>
          <Descriptions.Item label="Địa chỉ" span={2}>
            {doc?.recipientAddress ?? "-"}
          </Descriptions.Item>
          <Descriptions.Item label="SĐT">
            {packingLabel?.customerPhone || customerPhone || "-"}
          </Descriptions.Item>
          <Descriptions.Item label="Yêu cầu xuất">
            {short(doc?.outboundRequestId)}
          </Descriptions.Item>
          <Descriptions.Item label="Phiên bản dữ liệu">
            {version ?? doc?.version ?? "-"}
          </Descriptions.Item>
        </Descriptions>

        <Card title="Tiến độ & điều kiện hoàn tất" size="small">
          <Descriptions bordered size="small" column={{ xs: 1, sm: 2, lg: 3 }}>
            <Descriptions.Item label="Sản phẩm đã đối chiếu">
              {totalScanned} / {totalExpected}
            </Descriptions.Item>
            <Descriptions.Item label="Tổng hợp lô">
              {packingLabel
                ? `${packingLabel.skuCount} SKU · ${packingLabel.itemCount} sản phẩm`
                : `${detail?.lines.length ?? 0} SKU · ${totalScanned} sản phẩm`}
            </Descriptions.Item>
            <Descriptions.Item label="Nhãn đóng gói">
              {packingLabels.length} / 1
              {packingLabel ? ` · ${labelStatus(packingLabel.status)}` : ""}
            </Descriptions.Item>
            <Descriptions.Item label="Tồn khả dụng">
              {availabilityQuery.isSuccess ? (
                <Tag color={shortStockLines.length ? "error" : "success"}>
                  {shortStockLines.length
                    ? `${shortStockLines.length} SKU thiếu tồn`
                    : "Đủ tồn cho toàn phiếu"}
                </Tag>
              ) : (
                <Tag>Chưa kiểm tra</Tag>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Xác nhận đã dán nhãn">
              <Tag color={labelApplied ? "success" : "warning"}>
                {labelApplied ? "Có" : "Chưa"}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="RFID đã gán">
              {rfidMappedCount} / {activeMatches.length} · tùy chọn
            </Descriptions.Item>
            <Descriptions.Item label="Có thể hoàn tất xuất kho">
              <Tag color={postReady ? "success" : "warning"}>
                {postReady
                  ? "Có · thiếu RFID không chặn"
                  : "Chưa · xem lý do ở mục 4"}
              </Tag>
            </Descriptions.Item>
          </Descriptions>
        </Card>

        <Card title="1 · Quét & đối chiếu sản phẩm — không đổi tồn kho" size="small">
          <Space orientation="vertical" style={{ width: "100%" }} size={10}>
            <Space wrap size={6}>
              <Tag color="success">
                Sản phẩm đã đối chiếu: {totalScanned} / {totalExpected}
              </Tag>
              <Tag color={scanRejects.wrongSku ? "error" : "default"}>
                Mã sai SKU (phiên): {scanRejects.wrongSku}
              </Tag>
              <Tag color={scanRejects.duplicate ? "error" : "default"}>
                Mã trùng (phiên): {scanRejects.duplicate}
              </Tag>
              <Tag color={scanRejects.unknown ? "error" : "default"}>
                Không nhận diện (phiên): {scanRejects.unknown}
              </Tag>
            </Space>
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
                  style={{ width: 310 }}
                  value={lineId || ""}
                  onChange={setLineId}
                  options={[
                    {
                      value: "",
                      label: "Tự động theo QR (hệ thống tự đối chiếu SKU)",
                    },
                    ...(detail?.lines ?? []).map((line) => ({
                      value: line.id,
                      label: `${short(line.productId)} · ${line.scanned}/${line.expected}`,
                      disabled: line.scanned >= line.expected,
                    })),
                  ]}
                />
                <Input
                  style={{ width: 310 }}
                  value={scanCode}
                  placeholder="Quét mã vạch / QR sản phẩm"
                  onChange={(event) => setScanCode(event.target.value)}
                  onPressEnter={() =>
                    scanMutation.mutate({
                      rawCode: scanCode,
                      scanSource: "MANUAL",
                    })
                  }
                />
                <Button
                  icon={<CameraOutlined />}
                  disabled={scanMutation.isPending}
                  onClick={() => setCameraOpen(true)}
                >
                  Quét bằng camera
                </Button>
                <Button
                  type="primary"
                  icon={<ScanOutlined />}
                  loading={scanMutation.isPending}
                  disabled={!scanCode.trim()}
                  onClick={() =>
                    scanMutation.mutate({
                      rawCode: scanCode,
                      scanSource: "MANUAL",
                    })
                  }
                >
                  Đối chiếu sản phẩm
                </Button>
              </Space>
            ) : packingLabel ? (
              <Alert
                type="warning"
                showIcon
                title="Đã tạo nhãn đóng gói; việc đối chiếu sản phẩm được khóa để bảo toàn nội dung nhãn."
              />
            ) : null}
            <Table
              rowKey="id"
              size="small"
              pagination={false}
              columns={lineColumns}
              dataSource={detail?.lines ?? []}
              scroll={{ x: "max-content" }}
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
          title="2 · Tổng hợp & nhãn đóng gói — đúng 01 nhãn/phiếu-lô"
          size="small"
        >
          {!packingLabel ? (
            <Space orientation="vertical" style={{ width: "100%" }}>
              <Alert
                type={fullScan ? "warning" : "info"}
                showIcon
                title={
                  fullScan
                    ? "Đã quét đủ nhưng chưa thấy nhãn — bấm để tạo/đảm bảo lại 01 nhãn đóng gói."
                    : "Chưa quét đủ. Hệ thống sẽ tự tổng hợp lô và tạo 01 nhãn đóng gói nháp ngay khi đối chiếu đủ."
                }
              />
              <Space orientation="vertical" style={{ width: "100%" }} size={4}>
                <Space wrap>
                  <Input
                    style={{ width: 300 }}
                    value={customerPhone}
                    placeholder="SĐT người nhận (tùy chọn) in trên nhãn"
                    disabled={!fullScan}
                    maxLength={10}
                    inputMode="numeric"
                    status={customerPhoneValid ? undefined : "error"}
                    onChange={(event) =>
                      setCustomerPhone(
                        event.target.value.replace(/\D/g, "").slice(0, 10),
                      )
                    }
                  />
                  <Button
                    type="primary"
                    icon={<TagOutlined />}
                    disabled={
                      !fullScan ||
                      !customerPhoneValid ||
                      (!can("packing_label.preview") && !can("label.print"))
                    }
                    loading={createLabelMutation.isPending}
                    onClick={() => createLabelMutation.mutate()}
                  >
                    Tạo/đảm bảo 01 nhãn đóng gói
                  </Button>
                </Space>
                {!customerPhoneValid && (
                  <Typography.Text type="danger">
                    Số điện thoại phải gồm đúng 10 chữ số và bắt đầu bằng số 0.
                  </Typography.Text>
                )}
              </Space>
            </Space>
          ) : (
            <Space orientation="vertical" style={{ width: "100%" }} size={12}>
              {packingLabels.length > 1 ? (
                <Alert
                  type="error"
                  showIcon
                  title={`Có ${packingLabels.length} nhãn chính thức cho cùng phiếu; chưa thể hoàn tất xuất kho.`}
                />
              ) : null}
              <div className="label-preview">
                <div className="label-head">
                  <div>
                    <div className="label-brand">HOA NAM · NHÃN ĐÓNG GÓI</div>
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
                    {labelStatus(packingLabel.status)}
                  </Tag>
                </div>
                <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }}>
                  <Descriptions.Item label="Mã nhãn">
                    {packingLabel.labelCode}
                  </Descriptions.Item>
                  <Descriptions.Item label="Phiếu xuất">
                    {packingLabel.outboundNo || doc?.code}
                  </Descriptions.Item>
                  <Descriptions.Item label="Phiếu toa / Yêu cầu xuất">
                    {packingLabel.sourceRequestNo ||
                      short(doc?.outboundRequestId)}
                  </Descriptions.Item>
                  <Descriptions.Item label="Ngày giờ">
                    {String(
                      packingLabel.payload.created_at ?? doc?.date ?? "-",
                    )}
                  </Descriptions.Item>
                  <Descriptions.Item label="Người nhận">
                    {packingLabel.recipientName}
                  </Descriptions.Item>
                  <Descriptions.Item label="SĐT">
                    {packingLabel.customerPhone || "-"}
                  </Descriptions.Item>
                  <Descriptions.Item label="Địa chỉ giao" span={2}>
                    {packingLabel.recipientAddress || "-"}
                  </Descriptions.Item>
                  <Descriptions.Item label="Tổng SKU">
                    {packingLabel.skuCount}
                  </Descriptions.Item>
                  <Descriptions.Item label="Tổng sản phẩm">
                    {packingLabel.itemCount}
                  </Descriptions.Item>
                  <Descriptions.Item label="Bản lưu nhãn" span={2}>
                    {short(packingLabel.id)} · bản hiện hành không chỉnh sửa trực tiếp
                  </Descriptions.Item>
                  <Descriptions.Item label="Tóm tắt hàng" span={2}>
                    {packingLabel.skuSummary.length
                      ? packingLabel.skuSummary
                          .map((row) => `${row.skuCode} × ${row.quantity}`)
                          .join(" · ")
                      : "-"}
                  </Descriptions.Item>
                </Descriptions>
                <Table
                  style={{ marginTop: 10 }}
                  rowKey={(row) => `${row.skuId}-${row.skuCode}`}
                  size="small"
                  pagination={false}
                  scroll={{ x: "max-content" }}
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
                <div className="barcode-box">
                  <div className="barcode-bars" />
                  <div className="barcode-text">
                    {packingLabel.outboundNo || doc?.code}
                  </div>
                </div>
                <Alert
                  style={{ marginTop: 10 }}
                  type="info"
                  showIcon
                  title="QR/mã vạch này đại diện cho kiện/phiếu xuất. Không dùng mã vạch của từng sản phẩm làm nhãn đóng gói."
                />
              </div>
              <Alert
                type="info"
                showIcon
                title={`Vòng đời nhãn: ${LABEL_LIFECYCLE.map((status) => labelStatus(status)).join(" → ")} (In thất bại nếu máy in lỗi)`}
                description="Khi chuyển sang Sẵn sàng in, bản lưu nhãn được khóa. In, thử lại hoặc in lại đều dùng đúng bản lưu đó và không làm thay đổi tồn kho."
              />
              <Space wrap>
                <Button
                  icon={<EyeOutlined />}
                  disabled={
                    !canPreviewLabel ||
                    !mutable ||
                    (!can("packing_label.preview") && !can("label.print"))
                  }
                  loading={previewMutation.isPending}
                  onClick={() => previewMutation.mutate(packingLabel)}
                >
                  Xem trước
                </Button>
                <Button
                  icon={<LockOutlined />}
                  disabled={
                    !canReadyLabel ||
                    !mutable ||
                    (!can("packing_label.ready") && !can("label.print"))
                  }
                  loading={readyMutation.isPending}
                  onClick={() => readyMutation.mutate(packingLabel)}
                >
                  Sẵn sàng in · khóa bản lưu nhãn
                </Button>
                <Select
                  style={{ width: 260 }}
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
                    !printerId ||
                    !(canSendPrint || canReprint) ||
                    (!can("packing_label.print") &&
                      !can("packing_label.reprint") &&
                      !can("label.print") &&
                      !can("label.reprint"))
                  }
                  loading={printMutation.isPending}
                  onClick={() => printMutation.mutate(packingLabel)}
                >
                  {labelPrinted
                    ? "In lại nhãn đóng gói"
                    : labelPrintFailed
                      ? "In lại sau lỗi máy in"
                      : "In nhãn đóng gói"}
                </Button>
                <Button
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  disabled={
                    !labelPrinted ||
                    labelApplied ||
                    (!can("packing_label.print") && !can("label.print"))
                  }
                  loading={applyMutation.isPending}
                  onClick={() => applyMutation.mutate(packingLabel)}
                >
                  {labelApplied ? "Đã dán nhãn" : "Xác nhận đã dán nhãn"}
                </Button>
              </Space>
              {!canSendPrint && !labelPrinted ? (
                <Alert
                  type="warning"
                  showIcon
                  title="Phải xem trước rồi chuyển sang Sẵn sàng in trước khi gửi lệnh in."
                />
              ) : null}
            </Space>
          )}
        </Card>

        <Card title="3 · RFID tùy chọn" size="small">
          <Space orientation="vertical" style={{ width: "100%" }} size={8}>
            <Alert
              type="info"
              showIcon
              title="RFID không phải điều kiện bắt buộc để hoàn tất xuất kho"
              description="Có thể gán RFID nếu vận hành có thẻ. Không tạo RFID giả và không chặn hoàn tất xuất kho khi thiếu RFID."
            />
            <Text>
              Đã gán RFID: <b>{rfidMappedCount}</b> / {activeMatches.length} ·
              tùy chọn. Sản phẩm không có thẻ dùng mã vạch/QR; nút gán nằm ở
              bảng sản phẩm mục 1. Việc gán RFID không làm thay đổi tồn kho.
            </Text>
          </Space>
        </Card>

        <Card title="4 · Hoàn tất xuất kho" size="small">
          <Space orientation="vertical" style={{ width: "100%" }}>
            {shortStockLines.length ? (
              <Alert
                type="warning"
                showIcon
                title="Tồn khả dụng hiện thấp hơn số lượng cần xuất"
                description={`Hệ thống kiểm tra lại tồn tại thời điểm hoàn tất xuất kho; các SKU thiếu: ${shortStockLines
                  .map((line) => short(line.productId))
                  .join(", ")}.`}
              />
            ) : null}
            {postBlockReason ? (
              <Alert type="warning" showIcon title={postBlockReason} />
            ) : (
              <Alert
                type="success"
                showIcon
                title="Đủ điều kiện: quét đủ + đúng 01 nhãn đóng gói đã in + đã dán. RFID không phải điều kiện bắt buộc."
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
                    title: "Hoàn tất xuất kho?",
                    content:
                      "Đây là thời điểm duy nhất tồn kho bị trừ. Phiếu đã xuất kho không được chỉnh sửa trực tiếp; sửa sai dùng Điều chỉnh tồn kho.",
                    okText: "Hoàn tất xuất kho",
                    onOk: () => postMutation.mutateAsync(),
                  })
                }
              >
                Hoàn tất xuất kho · trừ tồn
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
                title="Hoàn tất xuất kho thành công"
                description={`Phiếu ${evidence.documentId} · ${evidence.movementRefs.length} biến động tồn kho · mã yêu cầu ${evidence.requestId || "-"}`}
              />
            ) : null}
          </Space>
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

      <Modal
        open={Boolean(rfidTarget)}
        title={`Gán RFID tùy chọn · ${rfidTarget?.itemCode ?? ""}`}
        onCancel={() => setRfidTarget(null)}
        onOk={() => rfidMutation.mutate()}
        okText="Gán RFID"
        confirmLoading={rfidMutation.isPending}
      >
        <Alert
          style={{ marginBottom: 12 }}
          type="info"
          title="Có thể đóng và bỏ qua RFID; phiếu vẫn có thể hoàn tất xuất kho."
        />
        <Space orientation="vertical" style={{ width: "100%" }}>
          <Input
            value={rfidCode}
            placeholder="Mã RFID"
            onChange={(event) => setRfidCode(event.target.value)}
          />
          <Input
            value={rfidHardwareUid}
            placeholder="UID phần cứng"
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