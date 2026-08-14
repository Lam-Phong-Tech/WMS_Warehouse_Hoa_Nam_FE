/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Form,
  Input,
  Modal,
  Progress,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import { toast } from "sonner";
import {
  CameraOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  EditOutlined,
  EyeOutlined,
  PrinterOutlined,
  TagOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getApiErrorMessage, normalizeError } from "@/shared/api/api-error";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import { CameraScanModal } from "@/shared/components/forms/CameraScanModal";
import { ScanInput } from "@/shared/components/forms/ScanInput";
import { useHasPermission } from "@/shared/components/permission";
import {
  useMvpAgencies,
  useMvpSkus,
} from "@/modules/master-data/hooks/use-mvp-master";
import type { SkuRecord } from "@/modules/master-data/types/mvp-master.types";
import {
  assignRfidToItem,
  cancelOutboundDocument,
  fetchActiveRfidCodes,
  fetchLabelSnapshots,
  fetchOutboundDetail,
  fetchPrinterConfigs,
  postOutboundIssue,
  printLabelSnapshot,
  reprintLabelSnapshot,
  scanOutboundItem,
  unmatchOutboundItem,
  updateOutboundDocument,
  type IssueEvidence,
  type LabelSnapshotRecord,
  type OutboundItemMatchRecord,
  type OutboundLineRecord,
  type OutboundMovementRecord,
  type OutboundStatus,
  type OutboundStatusHistoryRecord,
} from "@/modules/outbound/services/mvpOutboundService";

/** Một dòng trong bảng "Nhãn từng Item & RFID" (nguồn ưu tiên: item_matches BE). */
type ItemTableRow = {
  key: string;
  matchId?: string;
  matchStatus?: OutboundItemMatchRecord["status"];
  snapshot?: LabelSnapshotRecord;
  itemId?: string | null;
  itemCode?: string | null;
  skuCode?: string | null;
  labelCode?: string | null;
  labelSnapshotId?: string | null;
  labelStatus?: string | null;
  reprintCount: number;
  rfidCode?: string | null;
};

const STATUS_COLOR: Record<OutboundStatus, string> = {
  DRAFT: "warning",
  SCANNING: "processing",
  POSTED: "success",
  CANCELLED: "error",
};

const STATUS_LABEL: Record<OutboundStatus, string> = {
  DRAFT: "DRAFT",
  SCANNING: "ĐANG QUÉT",
  POSTED: "ĐÃ POST",
  CANCELLED: "ĐÃ HỦY",
};

type ScanSource = "CAMERA" | "NHẬP TAY";

type ScanLogRow = {
  key: string;
  code: string;
  expectedSku: string;
  result: string;
  success: boolean;
  bucket: "matched" | "wrong_sku" | "duplicate" | "unknown";
  source: ScanSource;
};

type EditFormValues = {
  agency_id?: string;
  recipient_name: string;
  recipient_address: string;
  doc_date?: string;
  note?: string;
};

type RfidFormValues = {
  code_value: string;
  hardware_uid: string;
};

interface OutboundDetailModalProps {
  documentId: string;
  onClose: () => void;
  onChanged?: () => void;
}

function makeKey(prefix: string): string {
  const random =
    globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  return `${prefix}-${random}`;
}

function classifyScanError(error: unknown): ScanLogRow["bucket"] {
  const { code, message: msg } = normalizeError(error);
  const haystack = `${code ?? ""} ${msg ?? ""}`.toUpperCase();
  // Khớp mã lỗi BE: DUPLICATE_ITEM_IN_DOCUMENT / DUPLICATE_ITEM_MATCH /
  // ITEM_ALREADY_MATCHED → trùng; ITEM_SKU_MISMATCH / PRODUCT_SKU_REQUIRED → sai SKU.
  if (haystack.includes("DUPLICATE") || haystack.includes("ALREADY_MATCHED")) {
    return "duplicate";
  }
  if (haystack.includes("SKU")) return "wrong_sku";
  return "unknown";
}

function shortId(value?: string | null): string {
  if (!value) return "-";
  return value.length > 12 ? `${value.slice(0, 8)}…` : value;
}

/**
 * OUT-03 · Chi tiết phiếu xuất — hub duy nhất gộp các màn wireframe:
 * OUT-02 (Quét & match Item), LBL-01 (Nhãn từng Item + xem trước),
 * RFID-01 (Map RFID & Full Post Issue). Mọi thao tác trước Post đều
 * stock-neutral; Post Issue giảm tồn atomic đúng một lần.
 */
export function OutboundDetailModal({
  documentId,
  onClose,
  onChanged,
}: OutboundDetailModalProps) {
  const can = useHasPermission();
  const queryClient = useQueryClient();

  const canEdit = can("outbound.create");
  const canScan = can("outbound.scan");
  const canPost = can("outbound.post");
  const canCancel = can("outbound.cancel");
  const canPrint = can("label.print");
  const canReprint = can("label.reprint");
  const canAssignRfid = can("physical_code.assign_rfid");

  const [version, setVersion] = useState<number | null>(null);
  const [lineId, setLineId] = useState("");
  const [printerId, setPrinterId] = useState("");
  const [scanDraft, setScanDraft] = useState("");
  const [scanLog, setScanLog] = useState<ScanLogRow[]>([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [previewSnapshot, setPreviewSnapshot] =
    useState<LabelSnapshotRecord | null>(null);
  const [rfidTarget, setRfidTarget] = useState<LabelSnapshotRecord | null>(
    null,
  );
  const [editOpen, setEditOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [evidence, setEvidence] = useState<IssueEvidence | null>(null);
  const [editForm] = Form.useForm<EditFormValues>();
  const [rfidForm] = Form.useForm<RfidFormValues>();

  const detailQuery = useQuery({
    queryKey: ["mvp-outbound", "detail", documentId],
    queryFn: () => fetchOutboundDetail(documentId),
  });
  const skuQuery = useMvpSkus({
    status: "ACTIVE",
    sku_type: "PRODUCT",
    per_page: 100,
  });
  const agencyQuery = useMvpAgencies({ status: "ACTIVE", per_page: 100 });
  const labelsQuery = useQuery({
    queryKey: ["mvp-outbound", "labels"],
    queryFn: fetchLabelSnapshots,
  });
  const rfidQuery = useQuery({
    queryKey: ["mvp-outbound", "rfids"],
    queryFn: fetchActiveRfidCodes,
  });
  const printersQuery = useQuery({
    queryKey: ["mvp-outbound", "printers"],
    queryFn: fetchPrinterConfigs,
  });

  const detail = detailQuery.data;
  const doc = detail?.document;
  const skuRows = useMemo(() => skuQuery.data?.data ?? [], [skuQuery.data]);
  const agencyRows = agencyQuery.data?.data ?? [];
  const activePrinters = (printersQuery.data ?? []).filter(
    (printer) => printer.status === "ACTIVE",
  );

  const skuById = useMemo(
    () => new Map<string, SkuRecord>(skuRows.map((sku) => [sku.sku_id, sku])),
    [skuRows],
  );

  const labelsForDocument = useMemo(() => {
    if (!detail) return [];
    return (labelsQuery.data ?? []).filter(
      (snapshot) =>
        (snapshot.documentId && snapshot.documentId === detail.document.id) ||
        (snapshot.outboundNo && snapshot.outboundNo === detail.document.code),
    );
  }, [detail, labelsQuery.data]);

  const activeRfidByItem = useMemo(() => {
    const map = new Map<string, string>();
    for (const code of rfidQuery.data ?? []) {
      if (code.itemId) map.set(code.itemId, code.codeValue);
    }
    return map;
  }, [rfidQuery.data]);

  // Nguồn item-level ưu tiên: item_matches BE trả kèm chi tiết phiếu
  // (chỉ match chưa REMOVED mới tính vào gate Post).
  const activeMatches = useMemo(
    () =>
      (detail?.itemMatches ?? []).filter((match) => match.status !== "REMOVED"),
    [detail],
  );
  const matchDriven = activeMatches.length > 0;

  const itemRows = useMemo((): ItemTableRow[] => {
    const snapshotById = new Map(
      labelsForDocument.map((snapshot) => [snapshot.id, snapshot]),
    );
    const snapshotByMatchId = new Map(
      labelsForDocument
        .filter((snapshot) => snapshot.itemMatchId)
        .map((snapshot) => [snapshot.itemMatchId as string, snapshot]),
    );
    if (matchDriven) {
      return activeMatches.map((match): ItemTableRow => {
        const snapshot =
          (match.labelSnapshotId
            ? snapshotById.get(match.labelSnapshotId)
            : undefined) ?? snapshotByMatchId.get(match.id);
        return {
          key: match.id,
          matchId: match.id,
          matchStatus: match.status,
          snapshot,
          itemId: match.itemId,
          itemCode: match.itemCode ?? snapshot?.itemCodeValue ?? null,
          skuCode:
            skuById.get(match.skuId)?.sku_code ??
            snapshot?.skuCode ??
            match.skuId,
          labelCode: snapshot?.labelCode ?? null,
          labelSnapshotId: match.labelSnapshotId ?? snapshot?.id ?? null,
          labelStatus: match.labelStatus ?? snapshot?.status ?? null,
          reprintCount: snapshot?.reprintCount ?? 0,
          rfidCode:
            match.rfidCode ??
            (match.itemId
              ? (activeRfidByItem.get(match.itemId) ?? null)
              : null),
        };
      });
    }
    return labelsForDocument.map(
      (snapshot): ItemTableRow => ({
        key: snapshot.id,
        snapshot,
        itemId: snapshot.itemId,
        itemCode: snapshot.itemCodeValue,
        skuCode:
          snapshot.skuCode ??
          (snapshot.skuId ? skuById.get(snapshot.skuId)?.sku_code : null) ??
          null,
        labelCode: snapshot.labelCode ?? null,
        labelSnapshotId: snapshot.id,
        labelStatus: snapshot.status,
        reprintCount: snapshot.reprintCount,
        rfidCode: snapshot.itemId
          ? (activeRfidByItem.get(snapshot.itemId) ?? null)
          : null,
      }),
    );
  }, [
    matchDriven,
    activeMatches,
    labelsForDocument,
    skuById,
    activeRfidByItem,
  ]);

  useEffect(() => {
    if (!detail) return;
    setVersion(detail.document.version);
    const current = detail.lines.find(
      (line) => line.id === lineId && line.scanned < line.expected,
    );
    if (!current) {
      setLineId(
        detail.lines.find((line) => line.scanned < line.expected)?.id ?? "",
      );
    }
  }, [detail, lineId]);

  useEffect(() => {
    if (!printerId && activePrinters.length > 0) {
      setPrinterId(activePrinters[0].id);
    }
  }, [activePrinters, printerId]);

  const totalExpected =
    detail?.lines.reduce((sum, line) => sum + line.expected, 0) ?? 0;
  const totalScanned =
    detail?.lines.reduce((sum, line) => sum + line.scanned, 0) ?? 0;
  const fullScan = Boolean(
    detail &&
    detail.lines.length > 0 &&
    detail.lines.every(
      (line) => line.expected > 0 && line.scanned === line.expected,
    ),
  );
  const labeledItemRows = itemRows.filter((row) => row.itemId);
  const printedCount = labeledItemRows.filter(
    (row) => row.labelStatus === "PRINTED",
  ).length;
  const rfidCount = labeledItemRows.filter((row) =>
    Boolean(row.rfidCode),
  ).length;
  const allLabelsPrinted =
    totalExpected > 0 &&
    labeledItemRows.length >= totalExpected &&
    printedCount >= totalExpected;
  const allRfidMapped =
    totalExpected > 0 &&
    labeledItemRows.length >= totalExpected &&
    rfidCount >= totalExpected;

  const hasRequest = Boolean(doc?.outboundRequestId);
  const isMutable = doc?.status === "DRAFT" || doc?.status === "SCANNING";

  const postBlockReason = !doc
    ? ""
    : !hasRequest
      ? "Phiếu thiếu request nguồn — backend chặn scan/post."
      : !fullScan
        ? `Match chưa đủ: ${totalScanned}/${totalExpected} item.`
        : !allLabelsPrinted
          ? `Nhãn chưa PRINTED đủ: ${printedCount}/${totalExpected}.`
          : !allRfidMapped
            ? `RFID chưa map đủ: ${rfidCount}/${totalExpected} item.`
            : doc.status !== "SCANNING"
              ? `Trạng thái hiện tại ${STATUS_LABEL[doc.status]} — Post chỉ chạy khi ĐANG QUÉT.`
              : "";
  const postReady = Boolean(doc && postBlockReason === "");

  const sessionStats = useMemo(() => {
    let wrongSku = 0;
    let duplicate = 0;
    let unknown = 0;
    for (const row of scanLog) {
      if (row.bucket === "wrong_sku") wrongSku += 1;
      else if (row.bucket === "duplicate") duplicate += 1;
      else if (row.bucket === "unknown") unknown += 1;
    }
    return { wrongSku, duplicate, unknown };
  }, [scanLog]);

  const refreshAll = async () => {
    await queryClient.invalidateQueries({ queryKey: ["mvp-outbound"] });
    onChanged?.();
  };

  const scanMutation = useMutation({
    mutationFn: async ({ code }: { code: string; source: ScanSource }) => {
      if (!detail || !lineId) {
        throw new Error("Chọn dòng SKU còn thiếu trước khi quét.");
      }
      return scanOutboundItem({
        documentId: detail.document.id,
        lineId,
        codeValue: code,
        ifMatch: version ?? detail.document.version,
        printerConfigId: printerId || undefined,
      });
    },
    onSuccess: async (result, variables) => {
      setVersion(result.version || null);
      const line = detail?.lines.find((row) => row.id === result.lineId);
      const sku = line ? skuById.get(line.productId) : undefined;
      setScanLog((current) =>
        [
          {
            key: makeKey("scan"),
            code: variables.code,
            expectedSku: sku?.sku_code ?? line?.productId ?? "-",
            result:
              result.labelStatus === "PRINT_FAILED"
                ? `Match ${result.scanned}/${result.expected} · nhãn PRINT_FAILED`
                : `Match ${result.scanned}/${result.expected} · nhãn ${result.labelStatus ?? "N/A"}`,
            success: true,
            bucket: "matched" as const,
            source: variables.source,
          },
          ...current,
        ].slice(0, 30),
      );
      if (result.labelStatus === "PRINT_FAILED") {
        toast.warning(
          "Item đã match nhưng in nhãn thất bại (PRINT_FAILED). Hãy In lại trước khi Post Issue.",
        );
      } else {
        toast.success(
          "Item đã match; scan stock-neutral, nhãn được BE tạo & in trực tiếp.",
        );
      }
      await refreshAll();
    },
    onError: async (error, variables) => {
      const line = detail?.lines.find((row) => row.id === lineId);
      const sku = line ? skuById.get(line.productId) : undefined;
      setScanLog((current) =>
        [
          {
            key: makeKey("scan-error"),
            code: variables.code,
            expectedSku: sku?.sku_code ?? line?.productId ?? "-",
            result: getApiErrorMessage(error, "Scan bị backend từ chối."),
            success: false,
            bucket: classifyScanError(error),
            source: variables.source,
          },
          ...current,
        ].slice(0, 30),
      );
      await detailQuery.refetch();
    },
  });

  const submitScan = (code: string, source: ScanSource) => {
    if (!canScan || !isMutable || !hasRequest) return;
    scanMutation.mutate({ code, source });
  };

  const printMutation = useMutation({
    mutationFn: async (snapshot: LabelSnapshotRecord) => {
      if (!printerId) throw new Error("Chọn printer ACTIVE trước khi in.");
      return snapshot.status === "PENDING_PRINT"
        ? printLabelSnapshot(snapshot.id, printerId)
        : reprintLabelSnapshot(snapshot.id, printerId);
    },
    onSuccess: async () => {
      toast.success("Đã gửi lệnh in nhãn. In/in lại là stock-neutral.");
      await queryClient.invalidateQueries({
        queryKey: ["mvp-outbound", "labels"],
      });
    },
    onError: (error) => {
      toast.error(
        getApiErrorMessage(
          error,
          "In nhãn thất bại. Kiểm tra printer agent rồi In lại.",
        ),
      );
      void queryClient.invalidateQueries({
        queryKey: ["mvp-outbound", "labels"],
      });
    },
  });

  const rfidMutation = useMutation({
    mutationFn: async () => {
      if (!rfidTarget?.itemId) {
        throw new Error("Không xác định được item cần map RFID.");
      }
      const values = await rfidForm.validateFields();
      return assignRfidToItem({
        itemId: rfidTarget.itemId,
        codeValue: values.code_value.trim(),
        hardwareUid: values.hardware_uid.trim(),
      });
    },
    onSuccess: async () => {
      toast.success("Đã map RFID vào item. Thao tác không tạo movement.");
      setRfidTarget(null);
      rfidForm.resetFields();
      await queryClient.invalidateQueries({
        queryKey: ["mvp-outbound", "rfids"],
      });
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Map RFID thất bại."));
    },
  });

  const unmatchMutation = useMutation({
    mutationFn: async (matchId: string) => {
      if (!detail) throw new Error("Chưa tải được phiếu xuất.");
      return unmatchOutboundItem({
        documentId: detail.document.id,
        matchId,
        ifMatch: version ?? detail.document.version,
      });
    },
    onSuccess: async (result) => {
      setVersion(result.version || null);
      toast.success(
        "Đã gỡ item khỏi phiếu (stock-neutral). Item có thể được quét lại.",
      );
      await refreshAll();
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Gỡ match thất bại."));
    },
  });

  const confirmUnmatch = (row: ItemTableRow) => {
    if (!row.matchId) return;
    const matchId = row.matchId;
    Modal.confirm({
      title: "Gỡ item đã match?",
      content: `Item ${row.itemCode ?? shortId(row.itemId)} sẽ chuyển REMOVED và scanned_qty giảm tương ứng. Thao tác stock-neutral; nhãn/RFID của match này không còn tính vào gate Post.`,
      okText: "Gỡ match",
      okButtonProps: { danger: true },
      cancelText: "Quay lại",
      onOk: () => unmatchMutation.mutateAsync(matchId),
    });
  };

  /** Dựng LabelSnapshotRecord tối thiểu khi list nhãn toàn cục chưa tải tới snapshot này. */
  const snapshotFromRow = (row: ItemTableRow): LabelSnapshotRecord | null => {
    if (row.snapshot) return row.snapshot;
    if (!row.labelSnapshotId) return null;
    return {
      id: row.labelSnapshotId,
      labelCode: row.labelCode ?? null,
      itemId: row.itemId ?? null,
      itemCodeValue: row.itemCode ?? null,
      skuCode: row.skuCode ?? null,
      status: row.labelStatus ?? "",
      reprintCount: row.reprintCount,
      payload: {},
    };
  };

  const updateMutation = useMutation({
    mutationFn: async (values: EditFormValues) => {
      if (!detail) throw new Error("Chưa tải được phiếu xuất.");
      return updateOutboundDocument(
        detail.document.id,
        {
          agency_id: values.agency_id || null,
          recipient_name: values.recipient_name.trim() || null,
          recipient_address: values.recipient_address.trim() || null,
          doc_date: values.doc_date || null,
          note: values.note?.trim() || null,
        },
        version ?? detail.document.version,
      );
    },
    onSuccess: async () => {
      toast.success("Đã cập nhật phiếu xuất DRAFT.");
      setEditOpen(false);
      await refreshAll();
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Không thể cập nhật phiếu xuất."));
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      if (!detail || !cancelReason.trim()) {
        throw new Error("Lý do hủy là bắt buộc.");
      }
      return cancelOutboundDocument(
        detail.document.id,
        cancelReason.trim(),
        version ?? detail.document.version,
      );
    },
    onSuccess: async () => {
      toast.success(
        "Đã hủy phiếu xuất. CANCELLED là trạng thái kết thúc, không có stock effect.",
      );
      setCancelOpen(false);
      setCancelReason("");
      await refreshAll();
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Không thể hủy phiếu xuất."));
    },
  });

  const postMutation = useMutation({
    mutationFn: async () => {
      if (!detail) throw new Error("Chưa tải được phiếu xuất.");
      return postOutboundIssue({
        documentId: detail.document.id,
        ifMatch: version ?? detail.document.version,
        idempotencyKey: makeKey(`post-issue-${detail.document.id}`),
      });
    },
    onSuccess: async (result) => {
      setEvidence(result);
      toast.success(
        `Full Post Issue thành công · ${result.movementRefs.length} movement · tồn kho giảm đúng một lần.`,
      );
      await refreshAll();
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Post Issue thất bại."));
    },
  });

  const openEdit = () => {
    if (!doc) return;
    editForm.setFieldsValue({
      agency_id: doc.agencyId ?? undefined,
      recipient_name: doc.recipientName === "-" ? "" : doc.recipientName,
      recipient_address:
        doc.recipientAddress === "-" ? "" : doc.recipientAddress,
      doc_date: doc.date?.slice(0, 10),
      note: doc.note ?? undefined,
    });
    setEditOpen(true);
  };

  const confirmPost = () => {
    Modal.confirm({
      title: "Xác nhận Full Post Issue?",
      content:
        "Tồn kho sẽ giảm atomic đúng một lần (If-Match + Idempotency-Key). Phiếu POSTED là bất biến; sửa sai sau Post phải dùng Reversal.",
      okText: "Full Post Issue",
      cancelText: "Kiểm tra lại",
      onOk: () => postMutation.mutateAsync(),
    });
  };

  const lineColumns: ColumnsType<OutboundLineRecord> = [
    {
      title: "SKU",
      key: "sku",
      width: 230,
      render: (_, line) => (
        <strong>
          {skuById.get(line.productId)?.sku_code ?? line.productId}
        </strong>
      ),
    },
    {
      title: "Tên hàng",
      key: "name",
      width: 240,
      render: (_, line) => skuById.get(line.productId)?.sku_name ?? "-",
    },
    { title: "Yêu cầu", dataIndex: "expected", width: 100, align: "right" },
    { title: "Đã match", dataIndex: "scanned", width: 100, align: "right" },
    { title: "Còn lại", dataIndex: "remaining", width: 100, align: "right" },
    {
      title: "Kết quả",
      key: "result",
      width: 110,
      render: (_, line) => (
        <Tag color={line.scanned === line.expected ? "success" : "warning"}>
          {line.scanned === line.expected ? "ĐỦ" : "CHƯA ĐỦ"}
        </Tag>
      ),
    },
  ];

  const itemColumns: ColumnsType<ItemTableRow> = [
    {
      title: "Nhãn",
      key: "label",
      width: 150,
      render: (_, row) => (
        <strong>{row.labelCode || shortId(row.labelSnapshotId)}</strong>
      ),
    },
    {
      title: "Item",
      key: "item",
      width: 170,
      render: (_, row) => row.itemCode || shortId(row.itemId),
    },
    {
      title: "SKU",
      key: "sku",
      width: 200,
      render: (_, row) => row.skuCode ?? "-",
    },
    {
      title: "Trạng thái in",
      key: "status",
      width: 160,
      render: (_, row) => (
        <Space size={4}>
          <Tag
            color={
              row.labelStatus === "PRINTED"
                ? "success"
                : row.labelStatus === "PRINT_FAILED"
                  ? "error"
                  : "warning"
            }
          >
            {row.labelStatus || "CHƯA CÓ NHÃN"}
          </Tag>
          {row.reprintCount > 0 ? (
            <Typography.Text type="secondary">
              in lại ×{row.reprintCount}
            </Typography.Text>
          ) : null}
        </Space>
      ),
    },
    {
      title: "RFID",
      key: "rfid",
      width: 190,
      render: (_, row) =>
        row.rfidCode ? (
          <Tag color="success">{row.rfidCode}</Tag>
        ) : (
          <Tag color="warning">CHƯA MAP</Tag>
        ),
    },
    {
      title: "Hành động",
      key: "actions",
      width: 300,
      render: (_, row) => {
        const snapshot = snapshotFromRow(row);
        const canSendPrint =
          row.labelStatus === "PENDING_PRINT" ? canPrint : canReprint;
        return (
          <Space wrap size={4}>
            {snapshot ? (
              <Button
                size="small"
                icon={<EyeOutlined />}
                onClick={() => setPreviewSnapshot(snapshot)}
              >
                Xem trước
              </Button>
            ) : null}
            {snapshot && canSendPrint && doc?.status !== "CANCELLED" ? (
              <Button
                size="small"
                icon={<PrinterOutlined />}
                loading={printMutation.isPending}
                onClick={() => printMutation.mutate(snapshot)}
              >
                {row.labelStatus === "PENDING_PRINT" ? "In nhãn" : "In lại"}
              </Button>
            ) : null}
            {row.itemId && !row.rfidCode && canAssignRfid && isMutable ? (
              <Button
                size="small"
                icon={<TagOutlined />}
                onClick={() => {
                  setRfidTarget(
                    snapshot ?? {
                      id: row.matchId ?? row.key,
                      itemId: row.itemId,
                      itemCodeValue: row.itemCode ?? null,
                      status: row.labelStatus ?? "",
                      reprintCount: row.reprintCount,
                      payload: {},
                    },
                  );
                  rfidForm.resetFields();
                }}
              >
                Map RFID
              </Button>
            ) : null}
            {row.matchId &&
            row.matchStatus === "ACTIVE" &&
            isMutable &&
            canScan ? (
              <Button
                size="small"
                danger
                loading={unmatchMutation.isPending}
                onClick={() => confirmUnmatch(row)}
              >
                Gỡ match
              </Button>
            ) : null}
          </Space>
        );
      },
    },
  ];

  const scanLogColumns: ColumnsType<ScanLogRow> = [
    { title: "Mã quét", dataIndex: "code", width: 200 },
    { title: "SKU kỳ vọng", dataIndex: "expectedSku", width: 200 },
    {
      title: "Kết quả",
      dataIndex: "result",
      render: (value: string, row) => (
        <Space>
          {row.success ? (
            <CheckCircleOutlined style={{ color: "#16a34a" }} />
          ) : (
            <CloseCircleOutlined style={{ color: "#dc2626" }} />
          )}
          <span>{value}</span>
        </Space>
      ),
    },
    { title: "Nguồn", dataIndex: "source", width: 110 },
  ];

  const progressPercent = totalExpected
    ? Math.min(100, Math.round((totalScanned / totalExpected) * 100))
    : 0;

  const previewRecipientName =
    previewSnapshot?.recipientName ?? doc?.recipientName ?? "-";
  const previewRecipientAddress =
    previewSnapshot?.recipientAddress ?? doc?.recipientAddress ?? "-";
  const previewBarcode =
    previewSnapshot?.itemCodeValue ??
    previewSnapshot?.itemId ??
    previewSnapshot?.labelCode ??
    "-";

  return (
    <>
      <Modal
        title={
          doc
            ? `OUT-03 · Chi tiết phiếu xuất · ${doc.code}`
            : "OUT-03 · Chi tiết phiếu xuất"
        }
        open
        width={1220}
        onCancel={onClose}
        centered
        maskClosable={false}
        destroyOnHidden
        footer={
          doc ? (
            <Space wrap>
              <Button onClick={onClose}>Đóng</Button>
              {doc.status === "DRAFT" && canEdit ? (
                <Button icon={<EditOutlined />} onClick={openEdit}>
                  Sửa DRAFT
                </Button>
              ) : null}
              {canCancel && isMutable ? (
                <Button danger onClick={() => setCancelOpen(true)}>
                  Hủy phiếu
                </Button>
              ) : null}
              {isMutable ? (
                <Button
                  type="primary"
                  disabled={!canPost || !postReady || postMutation.isPending}
                  loading={postMutation.isPending}
                  onClick={confirmPost}
                >
                  Full Post Issue
                </Button>
              ) : null}
            </Space>
          ) : null
        }
      >
        <Space wrap style={{ marginBottom: 12 }}>
          <Tag color="blue">POST /outbound-documents/:id/scan</Tag>
          <Tag color="blue">POST /outbound-documents/:id/post-issue</Tag>
          <Tag color="gold">If-Match</Tag>
          <Tag color="gold">Idempotency-Key khi Post</Tag>
        </Space>

        {detailQuery.isLoading ? <Card loading /> : null}
        <ApiErrorAlert
          error={detailQuery.error}
          title="Không tải được chi tiết phiếu xuất"
          onRetry={() => detailQuery.refetch()}
        />

        {detail && doc ? (
          <Space direction="vertical" size={14} style={{ width: "100%" }}>
            <Descriptions
              bordered
              size="small"
              column={{ xs: 1, sm: 2, lg: 3 }}
            >
              <Descriptions.Item label="Phiếu xuất">
                <strong>{doc.code}</strong>
              </Descriptions.Item>
              <Descriptions.Item label="Phiếu yêu cầu xuất">
                {doc.outboundRequestId ? (
                  shortId(doc.outboundRequestId)
                ) : (
                  <Tag color="error">Thiếu request</Tag>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Trạng thái">
                <Tag color={STATUS_COLOR[doc.status]}>
                  {STATUS_LABEL[doc.status]}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Người nhận">
                {doc.recipientName}
              </Descriptions.Item>
              <Descriptions.Item label="Địa chỉ">
                {doc.recipientAddress}
              </Descriptions.Item>
              <Descriptions.Item label="Ngày phiếu">
                {doc.date?.slice(0, 10) || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Ghi chú">
                {doc.note || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Cập nhật">
                {doc.updatedAt || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Version / If-Match">
                {version ?? doc.version}
              </Descriptions.Item>
            </Descriptions>

            <Row gutter={[12, 12]}>
              <Col xs={12} md={6}>
                <Card size="small">
                  <div style={{ fontSize: 12, color: "#6b7280" }}>
                    Match Item
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>
                    {totalScanned} / {totalExpected}
                  </div>
                </Card>
              </Col>
              <Col xs={12} md={6}>
                <Card size="small">
                  <div style={{ fontSize: 12, color: "#6b7280" }}>
                    Nhãn đã in
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>
                    {printedCount} / {totalExpected}
                  </div>
                </Card>
              </Col>
              <Col xs={12} md={6}>
                <Card size="small">
                  <div style={{ fontSize: 12, color: "#6b7280" }}>
                    RFID đã map
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>
                    {rfidCount} / {totalExpected}
                  </div>
                </Card>
              </Col>
              <Col xs={12} md={6}>
                <Card size="small">
                  <div style={{ fontSize: 12, color: "#6b7280" }}>
                    Có thể Post
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>
                    {doc.status === "POSTED"
                      ? "ĐÃ POST"
                      : postReady
                        ? "SẴN SÀNG"
                        : "CHƯA"}
                  </div>
                </Card>
              </Col>
            </Row>

            <Card size="small" title="Tiến độ & điều kiện Full Post Issue">
              <Progress
                percent={progressPercent}
                status={fullScan ? "success" : "active"}
              />
              <Space direction="vertical" size={6} style={{ marginTop: 10 }}>
                <div>
                  {hasRequest ? "✅" : "⛔"} Request nguồn:{" "}
                  {hasRequest
                    ? "Có — phiếu sinh từ toa/Excel."
                    : "Thiếu — backend từ chối scan/post phiếu legacy."}
                </div>
                <div>
                  {fullScan ? "✅" : "⚠️"} Match: {totalScanned}/{totalExpected}{" "}
                  (mọi dòng phải scanned = required, không xuất một phần).
                </div>
                <div>
                  {allLabelsPrinted ? "✅" : "⚠️"} Nhãn: {printedCount}/
                  {totalExpected} PRINTED (PRINT_FAILED phải In lại, không báo
                  thành công im lặng).
                </div>
                <div>
                  {allRfidMapped ? "✅" : "⚠️"} RFID: {rfidCount}/
                  {totalExpected} (PRODUCT bắt buộc active RFID trước Post
                  Issue).
                </div>
                {doc.status !== "POSTED" && postBlockReason ? (
                  <Typography.Text type="warning">
                    Lý do chưa Post được: {postBlockReason}
                  </Typography.Text>
                ) : null}
              </Space>
            </Card>

            {!hasRequest ? (
              <Alert
                type="error"
                showIcon
                message="Phiếu legacy không có outbound_request_id"
                description="Theo baseline, hãy hủy phiếu này và tạo lại từ Tiếp nhận yêu cầu xuất / Import Excel để giữ traceability."
              />
            ) : null}

            <Card size="small" title="Đối soát từng dòng SKU">
              <Table
                rowKey="id"
                size="small"
                dataSource={detail.lines}
                columns={lineColumns}
                pagination={false}
                scroll={{ x: 880 }}
                locale={{ emptyText: "Phiếu chưa có dòng SKU" }}
              />
            </Card>

            {isMutable ? (
              <Card
                size="small"
                title="OUT-02 · Quét & match Item (Barcode/QR)"
              >
                <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
                  <Col xs={12} md={6}>
                    <Card size="small">
                      <div style={{ fontSize: 12, color: "#6b7280" }}>
                        Item đã match
                      </div>
                      <div style={{ fontSize: 20, fontWeight: 700 }}>
                        {totalScanned} / {totalExpected}
                      </div>
                    </Card>
                  </Col>
                  <Col xs={12} md={6}>
                    <Card size="small">
                      <div style={{ fontSize: 12, color: "#6b7280" }}>
                        Mã sai SKU
                      </div>
                      <div style={{ fontSize: 20, fontWeight: 700 }}>
                        {sessionStats.wrongSku}
                      </div>
                    </Card>
                  </Col>
                  <Col xs={12} md={6}>
                    <Card size="small">
                      <div style={{ fontSize: 12, color: "#6b7280" }}>
                        Mã trùng
                      </div>
                      <div style={{ fontSize: 20, fontWeight: 700 }}>
                        {sessionStats.duplicate}
                      </div>
                    </Card>
                  </Col>
                  <Col xs={12} md={6}>
                    <Card size="small">
                      <div style={{ fontSize: 12, color: "#6b7280" }}>
                        Lỗi khác / Unknown
                      </div>
                      <div style={{ fontSize: 20, fontWeight: 700 }}>
                        {sessionStats.unknown}
                      </div>
                    </Card>
                  </Col>
                </Row>

                <Space wrap style={{ marginBottom: 10 }}>
                  <Select
                    value={lineId || undefined}
                    placeholder="Chọn dòng SKU còn thiếu"
                    style={{ minWidth: 340 }}
                    disabled={!canScan || !hasRequest}
                    onChange={setLineId}
                    options={detail.lines.map((line) => ({
                      value: line.id,
                      disabled: line.scanned >= line.expected,
                      label: `${skuById.get(line.productId)?.sku_code ?? line.productId} · ${line.scanned}/${line.expected}`,
                    }))}
                  />
                  <Select
                    value={printerId || undefined}
                    allowClear
                    placeholder="Printer ACTIVE (in nhãn khi match)"
                    style={{ minWidth: 260 }}
                    loading={printersQuery.isLoading}
                    onChange={(value) => setPrinterId(value ?? "")}
                    options={activePrinters.map((printer) => ({
                      value: printer.id,
                      label: `${printer.code} · ${printer.name}`,
                    }))}
                  />
                  <Button
                    icon={<CameraOutlined />}
                    disabled={
                      !canScan ||
                      !lineId ||
                      !hasRequest ||
                      scanMutation.isPending
                    }
                    onClick={() => setCameraOpen(true)}
                  >
                    Quét bằng camera
                  </Button>
                </Space>

                <ScanInput
                  value={scanDraft}
                  placeholder="Quét / nhập Barcode hoặc QR của Item rồi Enter"
                  disabled={
                    !canScan || !lineId || !hasRequest || scanMutation.isPending
                  }
                  onChange={setScanDraft}
                  onScan={(code) => submitScan(code, "NHẬP TAY")}
                />

                {(printersQuery.data ?? []).length > 0 ? (
                  <Typography.Paragraph
                    type="secondary"
                    style={{ marginTop: 8, marginBottom: 0, fontSize: 12 }}
                  >
                    Printer health:{" "}
                    {(printersQuery.data ?? []).map((printer, index) => (
                      <span key={printer.id}>
                        {index > 0 ? " · " : ""}
                        <Tag
                          color={
                            printer.status === "ACTIVE"
                              ? "success"
                              : printer.status === "UNHEALTHY"
                                ? "error"
                                : "default"
                          }
                          style={{ marginInlineEnd: 0 }}
                        >
                          {printer.code} {printer.status}
                        </Tag>
                        {printer.lastHealthAt
                          ? ` (health ${printer.lastHealthAt}${
                              printer.lastHealthResult
                                ? ` · ${printer.lastHealthResult}`
                                : ""
                            })`
                          : ""}
                      </span>
                    ))}
                  </Typography.Paragraph>
                ) : null}

                {activePrinters.length === 0 && !printersQuery.isLoading ? (
                  <Alert
                    style={{ marginTop: 10 }}
                    type="warning"
                    showIcon
                    message="Chưa có printer ACTIVE"
                    description="Scan vẫn match item nhưng nhãn sẽ không in trực tiếp được; kết quả PRINT_FAILED phải In lại trước khi Post."
                  />
                ) : null}

                <ApiErrorAlert
                  error={scanMutation.error}
                  title="Scan / match không thành công"
                  style={{ marginTop: 10 }}
                />

                {scanLog.length > 0 ? (
                  <Table<ScanLogRow>
                    style={{ marginTop: 12 }}
                    rowKey="key"
                    size="small"
                    dataSource={scanLog}
                    columns={scanLogColumns}
                    pagination={{ pageSize: 6, hideOnSinglePage: true }}
                  />
                ) : (
                  <Typography.Paragraph
                    type="secondary"
                    style={{ marginTop: 10, marginBottom: 0 }}
                  >
                    Camera và nhập tay đi qua cùng validation/API. Backend từ
                    chối mã sai SKU / trùng / đã ISSUED trước khi tạo nhãn. Quét
                    nhầm item thì dùng nút <b>Gỡ match</b> ở bảng bên dưới
                    (stock-neutral) rồi quét lại mã đúng.
                  </Typography.Paragraph>
                )}
              </Card>
            ) : null}

            <Card
              size="small"
              title="LBL-01 & RFID-01 · Nhãn từng Item + Map RFID"
            >
              <Space direction="vertical" size={10} style={{ width: "100%" }}>
                <Alert
                  type="info"
                  showIcon
                  message="Nhãn snapshot là bất biến và không in SĐT; RFID phải quét bằng đầu đọc RFID (camera không đọc được RFID)."
                  description="Scan PRODUCT hợp lệ tự tạo Label_Snapshot và in trực tiếp. Map RFID gắn vào đúng item, không tạo movement."
                />
                <ApiErrorAlert
                  error={labelsQuery.error}
                  title="Không tải được trạng thái nhãn"
                  onRetry={() => labelsQuery.refetch()}
                />
                <ApiErrorAlert
                  error={rfidQuery.error}
                  title="Không tải được trạng thái RFID"
                  onRetry={() => rfidQuery.refetch()}
                />
                <ApiErrorAlert
                  error={unmatchMutation.error}
                  title="Không gỡ được item match"
                />
                <Table<ItemTableRow>
                  rowKey="key"
                  size="small"
                  loading={labelsQuery.isLoading || rfidQuery.isLoading}
                  dataSource={itemRows}
                  columns={itemColumns}
                  pagination={
                    itemRows.length > 8
                      ? { pageSize: 8, showSizeChanger: false }
                      : false
                  }
                  scroll={{ x: 1170 }}
                  locale={{
                    emptyText:
                      "Chưa có item match — nhãn được tạo tự động khi quét match item.",
                  }}
                />
              </Space>
            </Card>

            {evidence ? (
              <Alert
                type="success"
                showIcon
                message="Evidence Full Post Issue"
                description={
                  <div>
                    <div>
                      Request ID: <strong>{evidence.requestId || "-"}</strong>
                    </div>
                    <div>
                      Movement:{" "}
                      {evidence.movementRefs.length > 0
                        ? evidence.movementRefs.join(", ")
                        : "-"}
                    </div>
                    <div>Version sau Post: {evidence.version}</div>
                  </div>
                }
              />
            ) : null}

            {doc.status === "POSTED" && detail.movements.length > 0 ? (
              <Card size="small" title="Movement đã ghi sổ (append-only)">
                <Table
                  rowKey="id"
                  size="small"
                  dataSource={detail.movements}
                  pagination={false}
                  columns={[
                    {
                      title: "Movement",
                      dataIndex: "id",
                      width: 260,
                      render: (value: string) => shortId(value),
                    },
                    { title: "Loại", dataIndex: "movementType", width: 160 },
                    {
                      title: "SKU",
                      key: "sku",
                      render: (_, row: OutboundMovementRecord) =>
                        (row.productId &&
                          skuById.get(row.productId)?.sku_code) ??
                        shortId(row.productId),
                    },
                    {
                      title: "Số lượng",
                      dataIndex: "quantity",
                      width: 110,
                      align: "right" as const,
                    },
                    { title: "Thời điểm", dataIndex: "createdAt", width: 190 },
                  ]}
                />
              </Card>
            ) : null}

            {detail.statusHistory.length > 0 ? (
              <Card size="small" title="Lịch sử trạng thái phiếu">
                <Table
                  rowKey="id"
                  size="small"
                  dataSource={detail.statusHistory}
                  pagination={false}
                  columns={[
                    {
                      title: "Chuyển trạng thái",
                      key: "transition",
                      render: (_, row: OutboundStatusHistoryRecord) =>
                        row.fromStatus
                          ? `${row.fromStatus} → ${row.toStatus}`
                          : row.toStatus,
                    },
                    { title: "Thời điểm", dataIndex: "changedAt", width: 190 },
                    {
                      title: "Người thao tác",
                      dataIndex: "changedBy",
                      width: 180,
                    },
                    { title: "Ghi chú", dataIndex: "note" },
                  ]}
                />
              </Card>
            ) : null}

            <ApiErrorAlert
              error={postMutation.error}
              title="Post Issue không thành công"
            />
          </Space>
        ) : null}
      </Modal>

      <CameraScanModal
        open={cameraOpen}
        title="Camera Barcode/QR · Quét item xuất kho"
        onClose={() => setCameraOpen(false)}
        onDetected={(code) => {
          setCameraOpen(false);
          submitScan(code, "CAMERA");
        }}
      />

      <Modal
        title={
          previewSnapshot
            ? `LBL-01 · Xem trước nhãn · ${previewSnapshot.labelCode || shortId(previewSnapshot.id)}`
            : "LBL-01 · Xem trước nhãn"
        }
        open={Boolean(previewSnapshot)}
        onCancel={() => setPreviewSnapshot(null)}
        width={560}
        footer={
          <Space wrap>
            <Button onClick={() => setPreviewSnapshot(null)}>Đóng</Button>
            {previewSnapshot &&
            (previewSnapshot.status === "PENDING_PRINT"
              ? canPrint
              : canReprint) ? (
              <Button
                type="primary"
                icon={<PrinterOutlined />}
                loading={printMutation.isPending}
                disabled={!printerId}
                onClick={() => {
                  if (previewSnapshot) printMutation.mutate(previewSnapshot);
                }}
              >
                {previewSnapshot.status === "PENDING_PRINT"
                  ? "In nhãn"
                  : "In lại"}
              </Button>
            ) : null}
          </Space>
        }
      >
        {previewSnapshot ? (
          <div className="print-sheet">
            <div className="label-preview" style={{ margin: "0 auto" }}>
              <div className="label-head">
                <div>
                  <div className="label-brand">HOA NAM</div>
                  <div className="label-sub">
                    Nhãn dán sản phẩm khi xuất kho
                  </div>
                </div>
                <Tag
                  color={
                    previewSnapshot.status === "PRINTED"
                      ? "success"
                      : previewSnapshot.status === "PRINT_FAILED"
                        ? "error"
                        : "warning"
                  }
                >
                  {previewSnapshot.status || "-"}
                </Tag>
              </div>
              <div className="label-grid">
                <div className="label-cell">
                  <b>Mã nhãn</b>
                  <span>
                    {previewSnapshot.labelCode || shortId(previewSnapshot.id)}
                  </span>
                </div>
                <div className="label-cell">
                  <b>Phiếu xuất</b>
                  <span>{previewSnapshot.outboundNo || doc?.code || "-"}</span>
                </div>
                <div className="label-cell">
                  <b>SKU</b>
                  <span>{previewSnapshot.skuCode || "-"}</span>
                </div>
                <div className="label-cell">
                  <b>Tên sản phẩm</b>
                  <span>{previewSnapshot.skuName || "-"}</span>
                </div>
                <div className="label-cell">
                  <b>Người nhận</b>
                  <span>{previewRecipientName}</span>
                </div>
                <div className="label-cell">
                  <b>Item</b>
                  <span>
                    {previewSnapshot.itemCodeValue ||
                      shortId(previewSnapshot.itemId)}
                  </span>
                </div>
                <div className="label-cell" style={{ gridColumn: "1 / -1" }}>
                  <b>Địa chỉ giao</b>
                  <span>{previewRecipientAddress}</span>
                </div>
              </div>
              <div className="barcode-box">
                <div className="barcode-bars" />
                <div className="barcode-text">{previewBarcode}</div>
              </div>
            </div>
            <Alert
              style={{ marginTop: 12 }}
              type="info"
              showIcon
              message="Nhãn không in SĐT theo baseline PII; nội dung snapshot là bất biến sau khi tạo."
            />
          </div>
        ) : null}
      </Modal>

      <Modal
        title={
          rfidTarget
            ? `RFID-01 · Map RFID cho item ${rfidTarget.itemCodeValue || shortId(rfidTarget.itemId)}`
            : "RFID-01 · Map RFID"
        }
        open={Boolean(rfidTarget)}
        okText="Map RFID"
        cancelText="Hủy"
        confirmLoading={rfidMutation.isPending}
        onCancel={() => {
          setRfidTarget(null);
          rfidForm.resetFields();
        }}
        onOk={() => rfidMutation.mutate()}
      >
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message="RFID quét bằng đầu đọc chuyên dụng — camera không đọc được RFID."
          description="hardware_uid là UID thật của tag và phải duy nhất. Map RFID không tạo movement, không đổi tồn."
        />
        <Form<RfidFormValues> form={rfidForm} layout="vertical">
          <Form.Item
            name="code_value"
            label="RFID code / EPC *"
            rules={[{ required: true, message: "Quét / nhập RFID code" }]}
          >
            <Input placeholder="VD: RFID-E200-000001" maxLength={200} />
          </Form.Item>
          <Form.Item
            name="hardware_uid"
            label="Hardware UID *"
            rules={[{ required: true, message: "Nhập hardware UID của tag" }]}
          >
            <Input
              placeholder="UID phần cứng từ đầu đọc RFID"
              maxLength={200}
            />
          </Form.Item>
        </Form>
        <ApiErrorAlert error={rfidMutation.error} title="Không map được RFID" />
      </Modal>

      <Modal
        title="Sửa phiếu xuất DRAFT"
        open={editOpen}
        okText="Lưu thay đổi"
        cancelText="Hủy"
        confirmLoading={updateMutation.isPending}
        onCancel={() => setEditOpen(false)}
        onOk={() =>
          editForm
            .validateFields()
            .then((values) => updateMutation.mutate(values))
        }
      >
        <Alert
          type="warning"
          showIcon
          message="Phiếu sinh từ request/Excel không được sửa dòng SKU/số lượng"
          description="Muốn đổi hàng hóa: hủy phiếu và tạo request mới để giữ traceability (backend chặn SOURCE_REQUEST_IMMUTABLE)."
          style={{ marginBottom: 14 }}
        />
        <Form<EditFormValues> form={editForm} layout="vertical">
          <Form.Item name="agency_id" label="Đại lý / nơi nhận">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              loading={agencyQuery.isLoading}
              options={agencyRows.map((agency) => ({
                value: agency.agency_id,
                label: `${agency.agency_code} · ${agency.agency_name}`,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="recipient_name"
            label="Người / nơi nhận *"
            rules={[{ required: true, message: "Nhập người nhận" }]}
          >
            <Input maxLength={200} />
          </Form.Item>
          <Form.Item
            name="recipient_address"
            label="Địa chỉ nhận *"
            rules={[{ required: true, message: "Nhập địa chỉ" }]}
          >
            <Input.TextArea rows={2} maxLength={2000} />
          </Form.Item>
          <Form.Item name="doc_date" label="Ngày phiếu">
            <Input type="date" />
          </Form.Item>
          <Form.Item name="note" label="Ghi chú">
            <Input.TextArea rows={3} maxLength={2000} showCount />
          </Form.Item>
        </Form>
        <ApiErrorAlert
          error={updateMutation.error}
          title="Không cập nhật được phiếu xuất"
        />
      </Modal>

      <Modal
        title="Hủy phiếu xuất"
        open={cancelOpen}
        okText="Xác nhận hủy"
        cancelText="Quay lại"
        okButtonProps={{ danger: true, disabled: !cancelReason.trim() }}
        confirmLoading={cancelMutation.isPending}
        onCancel={() => setCancelOpen(false)}
        onOk={() => cancelMutation.mutate()}
      >
        <Alert
          type="warning"
          showIcon
          message="CANCELLED là trạng thái kết thúc và stock-neutral"
          description="Phiếu đã hủy không thể tiếp tục quét/Post. Muốn xuất lại phải tạo request mới."
          style={{ marginBottom: 12 }}
        />
        <Input.TextArea
          value={cancelReason}
          rows={4}
          placeholder="Lý do hủy (bắt buộc)"
          maxLength={2000}
          showCount
          onChange={(event) => setCancelReason(event.target.value)}
        />
        <ApiErrorAlert
          error={cancelMutation.error}
          title="Không hủy được phiếu xuất"
          style={{ marginTop: 12 }}
        />
      </Modal>
    </>
  );
}
