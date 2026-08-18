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

/** SRS §6 Packing_Label state model. */
const LABEL_LIFECYCLE = [
  "DRAFT",
  "PREVIEWED",
  "READY_TO_PRINT",
  "PRINTED",
  "ĐÃ DÁN",
] as const;

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
  // SRS §5.3: outbound là camera context hợp lệ; camera chỉ decode ra code_value,
  // validation nghiệp vụ vẫn chạy trên cùng API như nhập tay.
  const [cameraOpen, setCameraOpen] = useState(false);
  const [customerPhone, setCustomerPhone] = useState("");
  const [printerId, setPrinterId] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [rfidTarget, setRfidTarget] = useState<RfidTarget | null>(null);
  const [rfidCode, setRfidCode] = useState("");
  const [rfidHardwareUid, setRfidHardwareUid] = useState("");
  const [evidence, setEvidence] = useState<IssueEvidence | null>(null);
  /**
   * WWHN-201: Idempotency-Key dính của Post Issue. Giữ nguyên qua các lần thử lại
   * an toàn (412/409 CONCURRENCY/lỗi mạng) để lần gửi lại là REPLAY, không phải lần
   * Post thứ hai. Chỉ nhả khi thao tác đã có kết quả cuối cùng hoặc khi §8.2 yêu cầu
   * key mới.
   */
  const postKeyRef = useRef<string | null>(null);
  // OUT-02: đếm lỗi scan trong phiên (sai SKU / trùng / unknown) — chỉ hiển thị, không phải state nghiệp vụ.
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
  // Annex D SCR-OUT-01 field available_qty: "Refresh at commit; stale warning".
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

  // Đổi phiếu thì thao tác Post cũ không còn ý nghĩa: nhả key để không mang key của
  // phiếu này sang phiếu khác.
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
  // §6: chỉ được gửi lệnh in khi nhãn đã READY_TO_PRINT (hoặc retry sau PRINT_FAILED).
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
    mutationFn: async (rawCode: string) => {
      const codeValue = rawCode.trim();
      if (!detail || !lineId || !codeValue)
        throw new Error("Chọn dòng và nhập/quét mã item.");
      return scanOutboundItem({
        documentId,
        lineId,
        codeValue,
        ifMatch: version ?? detail.document.version,
      });
    },
    onSuccess: async (result) => {
      setVersion(result.version || null);
      setScanCode("");
      toast.success("Đã match item. Scan không tạo nhãn và không trừ tồn.");
      await refresh();
    },
    onError: (error) => {
      const code = normalizeError(error).code ?? "";
      setScanRejects((current) =>
        code.includes("DUPLICATE")
          ? { ...current, duplicate: current.duplicate + 1 }
          : code.includes("SKU") || code.includes("MISMATCH")
            ? { ...current, wrongSku: current.wrongSku + 1 }
            : { ...current, unknown: current.unknown + 1 },
      );
      toast.error(getApiErrorMessage(error, "Scan/match thất bại."));
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
      // SRS §5.2 + §15 + AC-GWT-OUTBOUND-REQUEST-001: address/phone optional,
      // thiếu thì nhãn render blank — không chặn tạo nhãn (REQ-SRS-014).
      return createPackingLabel({ documentId, customerPhone });
    },
    onSuccess: async () => {
      toast.success("Đã tạo đúng 01 Packing Label cho phiếu/lô xuất.");
      await refresh();
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, "Không thể tạo Packing Label.")),
  });

  const previewMutation = useMutation({
    mutationFn: (label: PackingLabelRecord) =>
      previewPackingLabel({
        documentId,
        labelId: label.id,
        ifMatch: label.version,
      }),
    onSuccess: async () => {
      toast.success("Đã Preview Packing Label; snapshot chưa đóng băng.");
      await refresh();
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, "Preview Packing Label thất bại.")),
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
        "Đã Ready — snapshot Packing Label được đóng băng, sẵn sàng in.",
      );
      await refresh();
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, "Ready Packing Label thất bại.")),
  });

  const printMutation = useMutation({
    mutationFn: async (label: PackingLabelRecord) => {
      if (!printerId) throw new Error("Chọn máy in ACTIVE.");
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
      toast.success("Đã gửi lệnh in/in lại Packing Label; tồn kho không đổi.");
      await refresh();
    },
    onError: async (error) => {
      // §5.2: print failure đặt nhãn về PRINT_FAILED và chặn hoàn tất xuất.
      toast.error(getApiErrorMessage(error, "In Packing Label thất bại."));
      await refresh();
    },
  });

  const applyMutation = useMutation({
    mutationFn: (label: PackingLabelRecord) =>
      applyPackingLabel(label.id, label.version),
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
      if (!rfidHardwareUid.trim())
        throw new Error("Nhập hardware UID của tag, hoặc bỏ qua RFID.");
      if (!detail) throw new Error("Chưa tải phiếu.");
      // Annex C assignItemRfid: RFID gắn theo item của đúng phiếu xuất này.
      return assignRfidToItem({
        documentId,
        itemId: rfidTarget.itemId,
        codeValue: rfidCode.trim() || rfidHardwareUid.trim(),
        hardwareUid: rfidHardwareUid.trim(),
        ifMatch: version ?? detail.document.version,
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
      // WWHN-201 / DEV201-P1-01R (kịch bản "stale If-Match" và "forced rollback"):
      // Idempotency-Key phải DÍNH theo phiếu qua các lần thử lại. Sinh key mới ở mỗi
      // lần bấm biến một retry sau 412/timeout thành một lệnh Post THẬT thứ hai —
      // đúng nghĩa double-post. Đây là cùng pattern postKeyRef của luồng nhập
      // (MvpInboundScreens) nay áp cho luồng xuất.
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
      // Thao tác đã có kết quả nghiệp vụ cuối cùng → nhả key, lần Post sau (nếu có)
      // là một thao tác mới thật sự.
      postKeyRef.current = null;
      setEvidence(result);
      toast.success(
        result.replayed
          ? "Phiếu đã được Post trước đó. Hệ thống trả lại kết quả cũ (replay); tồn kho KHÔNG bị trừ thêm lần nữa."
          : "Hoàn tất xuất thành công. Tồn kho được trừ tại Post Issue.",
      );
      await refresh();
    },
    onError: async (error) => {
      // §8.2: chỉ giữ key khi lần gửi lại phải là REPLAY của đúng thao tác cũ
      // (412 STALE_VERSION, 409 CONCURRENCY_CONFLICT, lỗi mạng/5xx không rõ kết quả).
      // 409 IDEMPOTENCY_CONFLICT / STATE_CONFLICT và 422 thiếu tồn phải bắt đầu lại
      // bằng key mới.
      if (!shouldReuseIdempotencyKey(error)) postKeyRef.current = null;
      const outcome = classifyPostIssueError(error);
      toast.error(
        outcome?.message ??
          getApiErrorMessage(error, "Hoàn tất xuất thất bại."),
      );
      // Sau mọi xung đột, trạng thái/version dưới chân người dùng đã đổi: nạp lại để
      // If-Match của lần sau là bản mới nhất.
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
      toast.success("Đã hủy phiếu; không phát sinh stock effect.");
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
    { title: "Đã scan", dataIndex: "scanned", width: 90, align: "right" },
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
          <Descriptions.Item label="SĐT">
            {packingLabel?.customerPhone || customerPhone || "-"}
          </Descriptions.Item>
          <Descriptions.Item label="Request">
            {short(doc?.outboundRequestId)}
          </Descriptions.Item>
          <Descriptions.Item label="Version">
            {version ?? doc?.version ?? "-"}
          </Descriptions.Item>
        </Descriptions>

        <Card title="Tiến độ & gate" size="small">
          <Descriptions bordered size="small" column={{ xs: 1, sm: 2, lg: 3 }}>
            <Descriptions.Item label="Match Item">
              {totalScanned} / {totalExpected}
            </Descriptions.Item>
            <Descriptions.Item label="Tổng hợp lô">
              {packingLabel
                ? `${packingLabel.skuCount} SKU · ${packingLabel.itemCount} Item`
                : `${detail?.lines.length ?? 0} SKU · ${totalScanned} Item`}
            </Descriptions.Item>
            <Descriptions.Item label="Packing Label">
              {packingLabels.length} / 1
              {packingLabel ? ` · ${packingLabel.status}` : ""}
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
            <Descriptions.Item label="RFID đã map">
              {rfidMappedCount} / {activeMatches.length} · tùy chọn
            </Descriptions.Item>
            <Descriptions.Item label="Có thể Hoàn tất xuất">
              <Tag color={postReady ? "success" : "warning"}>
                {postReady
                  ? "Có · thiếu RFID không chặn"
                  : "Chưa · xem lý do ở mục 4"}
              </Tag>
            </Descriptions.Item>
          </Descriptions>
        </Card>

        <Card title="1 · Scan & match item — stock-neutral" size="small">
          <Space orientation="vertical" style={{ width: "100%" }} size={10}>
            <Space wrap size={6}>
              <Tag color="success">
                Item đã match: {totalScanned} / {totalExpected}
              </Tag>
              <Tag color={scanRejects.wrongSku ? "error" : "default"}>
                Mã sai SKU (phiên): {scanRejects.wrongSku}
              </Tag>
              <Tag color={scanRejects.duplicate ? "error" : "default"}>
                Mã trùng (phiên): {scanRejects.duplicate}
              </Tag>
              <Tag color={scanRejects.unknown ? "error" : "default"}>
                Unknown (phiên): {scanRejects.unknown}
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
                  placeholder="Quét Barcode / QR item"
                  onChange={(event) => setScanCode(event.target.value)}
                  onPressEnter={() => scanMutation.mutate(scanCode)}
                />
                <Button
                  icon={<CameraOutlined />}
                  disabled={!lineId || scanMutation.isPending}
                  onClick={() => setCameraOpen(true)}
                >
                  Quét bằng camera
                </Button>
                <Button
                  type="primary"
                  icon={<ScanOutlined />}
                  loading={scanMutation.isPending}
                  disabled={!lineId || !scanCode.trim()}
                  onClick={() => scanMutation.mutate(scanCode)}
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
                type={fullScan ? "warning" : "info"}
                showIcon
                title={
                  fullScan
                    ? "Đã scan đủ nhưng chưa thấy nhãn — bấm để tạo/đảm bảo lại 01 Packing Label."
                    : "Chưa scan đủ. Hệ thống sẽ tự tổng hợp lô và tạo 01 Packing Label DRAFT ngay khi full match."
                }
              />
              <Space wrap>
                <Input
                  style={{ width: 300 }}
                  value={customerPhone}
                  placeholder="SĐT người nhận (tùy chọn) in trên nhãn"
                  disabled={!fullScan}
                  onChange={(event) => setCustomerPhone(event.target.value)}
                />
                <Button
                  type="primary"
                  icon={<TagOutlined />}
                  disabled={
                    !fullScan ||
                    (!can("packing_label.preview") && !can("label.print"))
                  }
                  loading={createLabelMutation.isPending}
                  onClick={() => createLabelMutation.mutate()}
                >
                  Tạo/đảm bảo 01 Packing Label
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
                  <Descriptions.Item label="Phiếu xuất">
                    {packingLabel.outboundNo || doc?.code}
                  </Descriptions.Item>
                  <Descriptions.Item label="Phiếu toa / Request">
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
                  <Descriptions.Item label="Tổng Item">
                    {packingLabel.itemCount}
                  </Descriptions.Item>
                  <Descriptions.Item label="Snapshot" span={2}>
                    {short(packingLabel.id)} · immutable/current
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
                  title="QR/Barcode đại diện cho kiện/phiếu xuất. Không dùng Barcode của từng Item làm Packing Label."
                />
              </div>
              <Alert
                type="info"
                showIcon
                title={`Lifecycle §6: ${LABEL_LIFECYCLE.join(" → ")} (PRINT_FAILED nếu in lỗi)`}
                description="Ready đóng băng immutable Packing_Label_Snapshot; Print/Retry/Reprint dùng lại đúng snapshot đó và không đổi tồn."
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
                  Preview
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
                  Ready · đóng băng snapshot
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
                    ? "In lại Packing Label"
                    : labelPrintFailed
                      ? "In lại sau lỗi máy in"
                      : "In Packing Label"}
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
                  title="Phải Preview → Ready trước khi gửi lệnh in (§6)."
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
              title="RFID không phải gate Post Issue"
              description="Có thể map RFID nếu vận hành có tag. Không tạo RFID giả và không chặn Hoàn tất xuất khi thiếu RFID."
            />
            <Text>
              Đã map RFID: <b>{rfidMappedCount}</b> / {activeMatches.length} ·
              tùy chọn. Item không có tag dùng Barcode/QR fallback (nút map ở
              bảng item mục 1). RFID mapping là stock-neutral.
            </Text>
          </Space>
        </Card>

        <Card title="4 · Hoàn tất xuất / Post Issue" size="small">
          <Space orientation="vertical" style={{ width: "100%" }}>
            {shortStockLines.length ? (
              <Alert
                type="warning"
                showIcon
                title="Tồn khả dụng hiện thấp hơn số lượng cần xuất"
                description={`BE kiểm tra lại tồn tại thời điểm Post; các SKU thiếu: ${shortStockLines
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

      {/* SRS §5.3: camera trả đúng một code_value vào field đang hoạt động;
          permission denied / no camera / unsupported browser rơi về nhập tay. */}
      <CameraScanModal
        open={cameraOpen}
        title="Camera Barcode/QR · Quét item xuất kho"
        onClose={() => setCameraOpen(false)}
        onDetected={(code) => {
          setCameraOpen(false);
          setScanCode(code);
          scanMutation.mutate(code);
        }}
      />

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
