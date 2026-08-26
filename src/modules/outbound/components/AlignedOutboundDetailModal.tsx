import { useEffect, useMemo, useRef, useState } from "react";
import { Table, Tag } from "antd";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  Stack,
  TextField,
  ThemeProvider,
  Typography,
} from "@mui/material";
import { muiTheme } from "@/app/mui-theme";
import {
  CameraOutlined,
  CloseOutlined,
  DeleteOutlined,
  PrinterOutlined,
  ScanOutlined,
  WifiOutlined,
} from "@/shared/components/icons";
import { ACTION_ICON_COLORS } from "@/shared/theme/actionIconColors";
import type { ColumnsType } from "antd/es/table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/shared/api/api-error";
import {
  classifyPostIssueError,
  shouldReuseIdempotencyKey,
} from "@/shared/api/post-issue-contract";
import { CameraScanModal } from "@/shared/components/forms/CameraScanModal";
import { useHasPermission } from "@/shared/components/permission";
import {
  OUTBOUND_STATUS_LABELS,
  businessLabel,
} from "@/shared/constants/business-labels";
import {
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
import type { ReactNode } from "react";

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
  const labels: Record<string, string> = {
    DRAFT: "Nháp",
    PENDING_PRINT: "Chờ chuẩn bị",
    PREVIEWED: "Đã xem trước",
    READY_TO_PRINT: "Sẵn sàng in",
    PRINTED: "Đã in",
    PRINT_FAILED: "In thất bại",
  };
  return value ? (labels[value] ?? value) : "Chưa tạo";
}

function DetailField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
        {label}
      </Typography>
      <Typography variant="body2" component="div">
        {value}
      </Typography>
    </Grid>
  );
}

/**
 * GĐ1: Quét đủ -> Ghi nhận xuất kho & In nhãn -> Post Issue trừ tồn đúng một
 * lần -> chuẩn bị preview nhãn. In/in lại là thao tác vận hành độc lập và không
 * tồn tại trạng thái nghiệp vụ "đã dán".
 */
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
  const [printerId, setPrinterId] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [rfidTarget, setRfidTarget] = useState<RfidTarget | null>(null);
  const [rfidCode, setRfidCode] = useState("");
  const [rfidHardwareUid, setRfidHardwareUid] = useState("");
  const [evidence, setEvidence] = useState<IssueEvidence | null>(null);
  const [preparedLabel, setPreparedLabel] = useState<PackingLabelRecord | null>(
    null,
  );
  const [labelWarning, setLabelWarning] = useState<string | null>(null);
  const [postConfirmOpen, setPostConfirmOpen] = useState(false);
  const postKeyRef = useRef<string | null>(null);

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
    () => [
      ...new Set(
        (detail?.lines ?? []).map((line) => line.productId).filter(Boolean),
      ),
    ],
    [detail],
  );
  const availabilityQuery = useQuery({
    queryKey: ["mvp-outbound", "availability", documentId, lineSkuIds],
    enabled: lineSkuIds.length > 0,
    retry: false,
    queryFn: () => fetchAvailableQtyBySku(lineSkuIds),
  });

  const activeMatches = useMemo(
    () =>
      (detail?.itemMatches ?? []).filter((match) => match.status !== "REMOVED"),
    [detail],
  );
  const serverLabel = useMemo(
    () =>
      (labelQuery.data ?? []).find(
        (label) => label.documentId === documentId,
      ) ?? null,
    [documentId, labelQuery.data],
  );
  const packingLabel = preparedLabel ?? serverLabel;
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
    setPreparedLabel(null);
    setLabelWarning(null);
  }, [documentId]);

  useEffect(() => {
    if (!printerId && activePrinters[0]?.id) {
      setPrinterId(activePrinters[0].id);
    }
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
  const posted = doc?.status === "POSTED";
  const customerPhoneValid =
    customerPhone === "" || /^0\d{9}$/.test(customerPhone);
  const availability = availabilityQuery.data ?? {};
  const shortStockLines = (detail?.lines ?? []).filter(
    (line) =>
      availabilityQuery.isSuccess &&
      (availability[line.productId] ?? 0) < line.expected,
  );

  const postBlockReason = !doc
    ? ""
    : !doc.outboundRequestId
      ? "Phiếu thiếu yêu cầu xuất nguồn."
      : !fullScan
        ? `Chưa quét đủ: ${totalScanned}/${totalExpected}.`
        : doc.status !== "SCANNING"
          ? "Phiếu không ở trạng thái sẵn sàng ghi nhận xuất kho."
          : !customerPhoneValid
            ? "Số điện thoại phải để trống hoặc gồm 10 chữ số, bắt đầu bằng 0."
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

  const prepareLabel = async (
    existing?: PackingLabelRecord | null,
  ): Promise<PackingLabelRecord> => {
    let label = existing ?? packingLabel;
    if (!label) {
      label = await createPackingLabel({ documentId, customerPhone });
    }
    if (["DRAFT", "PENDING_PRINT"].includes(label.status)) {
      label = await previewPackingLabel({
        documentId,
        labelId: label.id,
        ifMatch: label.version,
      });
    }
    if (label.status === "PREVIEWED") {
      label = await readyPackingLabel({
        documentId,
        labelId: label.id,
        ifMatch: label.version,
        idempotencyKey: makeKey(`label-ready-${label.id}`),
      });
    }
    setPreparedLabel(label);
    return label;
  };

  const scanMutation = useMutation({
    mutationFn: async (input: {
      rawCode: string;
      scanSource: "CAMERA" | "MANUAL";
    }) => {
      const codeValue = input.rawCode.trim();
      if (!detail || !codeValue) {
        throw new Error("Nhập hoặc quét mã sản phẩm trước.");
      }
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
      toast.success("Đã đối chiếu sản phẩm.");
      await refresh();
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, "Quét/đối chiếu thất bại.")),
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
      toast.success("Đã gỡ sản phẩm khỏi danh sách đối chiếu.");
      await refresh();
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, "Gỡ đối chiếu thất bại.")),
  });

  const postAndLabelMutation = useMutation({
    mutationFn: async () => {
      if (!detail || !postReady) {
        throw new Error(postBlockReason || "Phiếu chưa sẵn sàng.");
      }
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
      setVersion(result.version || null);
      setLabelWarning(null);
      try {
        await prepareLabel();
        toast.success(
          result.replayed
            ? "Phiếu đã được ghi nhận trước đó. Nhãn đã sẵn sàng để in."
            : "Đã ghi nhận xuất kho. Nhãn đã sẵn sàng để xem và in.",
        );
      } catch (error) {
        const message = getApiErrorMessage(
          error,
          "Xuất kho đã thành công nhưng chưa chuẩn bị được nhãn. Có thể thử tạo nhãn lại; tồn kho không bị rollback.",
        );
        setLabelWarning(message);
        toast.warning(message);
      }
      await refresh();
    },
    onError: async (error) => {
      if (!shouldReuseIdempotencyKey(error)) postKeyRef.current = null;
      const outcome = classifyPostIssueError(error);
      toast.error(
        outcome?.message ??
          getApiErrorMessage(error, "Ghi nhận xuất kho thất bại."),
      );
      if (outcome !== null) await refresh();
    },
  });

  const labelPrepareMutation = useMutation({
    mutationFn: () => prepareLabel(),
    onSuccess: async () => {
      setLabelWarning(null);
      toast.success("Nhãn đã sẵn sàng để in.");
      await refresh();
    },
    onError: (error) => {
      const message = getApiErrorMessage(error, "Không chuẩn bị được nhãn.");
      setLabelWarning(message);
      toast.error(message);
    },
  });

  const printMutation = useMutation({
    mutationFn: async () => {
      if (!printerId) throw new Error("Chọn máy in đang hoạt động.");
      let label = packingLabel;
      if (
        !label ||
        !["READY_TO_PRINT", "PRINT_FAILED", "PRINTED"].includes(label.status)
      ) {
        label = await prepareLabel(label);
      }
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
      toast.success("Đã gửi lệnh in nhãn.");
      setPreparedLabel(null);
      await refresh();
    },
    onError: async (error) => {
      toast.error(
        `${getApiErrorMessage(error, "In nhãn thất bại.")} Phiếu xuất kho vẫn giữ trạng thái đã ghi nhận.`,
      );
      // BE bump version của label_snapshot kể cả khi PRINT_FAILED; giữ preparedLabel
      // cũ sẽ làm lần in lại kế tiếp gửi If-Match version lỗi thời → 412.
      setPreparedLabel(null);
      await refresh();
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      if (!detail || !cancelReason.trim()) throw new Error("Nhập lý do hủy.");
      return cancelOutboundDocument(
        documentId,
        cancelReason.trim(),
        version ?? detail.document.version,
      );
    },
    onSuccess: async () => {
      toast.success("Đã hủy phiếu xuất.");
      setCancelOpen(false);
      await refresh();
      onClose();
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, "Hủy phiếu thất bại.")),
  });

  const rfidMutation = useMutation({
    mutationFn: async () => {
      if (!rfidTarget || !detail) throw new Error("Chưa chọn sản phẩm.");
      if (!rfidCode.trim() || !rfidHardwareUid.trim()) {
        throw new Error("Nhập đủ mã RFID và hardware UID.");
      }
      return assignRfidToItem({
        documentId,
        itemId: rfidTarget.itemId,
        codeValue: rfidCode.trim(),
        hardwareUid: rfidHardwareUid.trim(),
        ifMatch: version ?? detail.document.version,
      });
    },
    onSuccess: async () => {
      toast.success("Đã gán RFID cho sản phẩm.");
      setRfidTarget(null);
      setRfidCode("");
      setRfidHardwareUid("");
      await refresh();
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, "Gán RFID thất bại.")),
  });

  const lineColumns: ColumnsType<OutboundLineRecord> = [
    {
      title: "SKU",
      dataIndex: "productId",
      render: (value) => short(value),
      width: 180,
    },
    {
      title: "Cần xuất",
      dataIndex: "expected",
      width: 100,
      align: "right",
    },
    {
      title: "Đã quét",
      dataIndex: "scanned",
      width: 100,
      align: "right",
    },
  ];

  const matchColumns: ColumnsType<OutboundItemMatchRecord> = [
    {
      title: "Sản phẩm",
      key: "item",
      render: (_, match) =>
        match.itemCode || match.serialNumber || short(match.itemId),
    },
    {
      title: "RFID",
      dataIndex: "rfidCode",
      render: (value) => value || "—",
      width: 150,
    },
    {
      title: "",
      key: "actions",
      width: 190,
      render: (_, match) => (
        <Stack direction="row" spacing={0.5}>
          {mutable && can("outbound.scan") ? (
            <Button
              size="small"
              color="error"
              variant="outlined"
              startIcon={<DeleteOutlined />}
              onClick={() => unmatchMutation.mutate(match.id)}
            >
              Gỡ
            </Button>
          ) : null}
          {match.itemId && can("physical_code.assign_rfid") ? (
            <Button
              size="small"
              variant="outlined"
              startIcon={<WifiOutlined style={{ color: ACTION_ICON_COLORS.edit }} />}
              onClick={() =>
                setRfidTarget({
                  itemId: match.itemId as string,
                  itemCode:
                    match.itemCode || match.serialNumber || short(match.itemId),
                })
              }
            >
              RFID
            </Button>
          ) : null}
        </Stack>
      ),
    },
  ];

  if (detailQuery.isLoading) {
    return (
      <ThemeProvider theme={muiTheme}>
        <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
          <DialogTitle>Chi tiết phiếu xuất</DialogTitle>
          <DialogContent dividers>Đang tải...</DialogContent>
        </Dialog>
      </ThemeProvider>
    );
  }

  if (detailQuery.isError || !detail || !doc) {
    return (
      <ThemeProvider theme={muiTheme}>
        <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
          <DialogTitle>Chi tiết phiếu xuất</DialogTitle>
          <DialogContent dividers>
            <Alert severity="error">
              {getApiErrorMessage(detailQuery.error, "Không tải được phiếu xuất.")}
            </Alert>
          </DialogContent>
        </Dialog>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={muiTheme}>
      <Dialog
        open
        onClose={onClose}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle sx={{ pr: 6, position: "relative" }}>
          Chi tiết phiếu xuất
          <IconButton
            aria-label="Đóng"
            onClick={onClose}
            sx={{ position: "absolute", right: 10, top: 8 }}
          >
            <CloseOutlined style={{ fontSize: 15 }} />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 2 }}>
              <Grid container spacing={2}>
                <DetailField label="Phiếu" value={doc.code} />
                <DetailField
                  label="Trạng thái"
                  value={<Tag>{businessLabel(OUTBOUND_STATUS_LABELS, doc.status)}</Tag>}
                />
                <DetailField label="Nơi nhận" value={doc.recipientName || "—"} />
                <DetailField label="Đã quét" value={`${totalScanned}/${totalExpected}`} />
              </Grid>
            </Box>

            <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
                1 · Quét và đối chiếu hàng
              </Typography>
              <Stack spacing={1.5}>
                <Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap", rowGap: 1 }}>
                  <Autocomplete
                    sx={{ width: 300 }}
                    options={detail.lines
                      .filter((line) => line.scanned < line.expected)
                      .map((line) => ({
                        value: line.id,
                        label: `${short(line.productId)} · ${line.scanned}/${line.expected}`,
                      }))}
                    value={
                      lineId
                        ? {
                            value: lineId,
                            label:
                              detail.lines
                                .filter((line) => line.scanned < line.expected)
                                .find((line) => line.id === lineId)?.productId ?? lineId,
                          }
                        : null
                    }
                    getOptionLabel={(option) => option.label}
                    isOptionEqualToValue={(option, value) => option.value === value.value}
                    onChange={(_event, option) => setLineId(option?.value ?? "")}
                    renderInput={(params) => (
                      <TextField {...params} placeholder="Tự nhận SKU từ mã quét" />
                    )}
                  />
                  <TextField
                    sx={{ width: 330 }}
                    value={scanCode}
                    placeholder="Quét QR/Barcode sản phẩm"
                    onChange={(event) => setScanCode(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        scanMutation.mutate({ rawCode: scanCode, scanSource: "MANUAL" });
                      }
                    }}
                    disabled={!mutable || !can("outbound.scan")}
                  />
                  <Button
                    variant="contained"
                    startIcon={<ScanOutlined />}
                    disabled={
                      !mutable ||
                      !can("outbound.scan") ||
                      !scanCode.trim() ||
                      scanMutation.isPending
                    }
                    onClick={() =>
                      scanMutation.mutate({ rawCode: scanCode, scanSource: "MANUAL" })
                    }
                  >
                    {scanMutation.isPending ? "Đang quét..." : "Quét"}
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<CameraOutlined style={{ color: ACTION_ICON_COLORS.sync }} />}
                    disabled={!mutable || !can("outbound.scan")}
                    onClick={() => setCameraOpen(true)}
                  >
                    Camera
                  </Button>
                </Stack>
                <Table
                  rowKey="id"
                  size="small"
                  pagination={false}
                  columns={lineColumns}
                  dataSource={detail.lines}
                  scroll={{ x: 520 }}
                />
                <Table
                  rowKey="id"
                  size="small"
                  pagination={false}
                  columns={matchColumns}
                  dataSource={activeMatches}
                  scroll={{ x: 760 }}
                />
              </Stack>
            </Box>

            <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
                2 · Ghi nhận xuất kho & In nhãn
              </Typography>
              <Stack spacing={1.5}>
                {shortStockLines.length ? (
                  <Alert severity="warning">
                    <Typography sx={{ fontWeight: 700 }}>
                      Tồn khả dụng hiện thấp hơn số lượng cần xuất
                    </Typography>
                    <Typography variant="body2">
                      {`SKU thiếu: ${shortStockLines
                        .map((line) => short(line.productId))
                        .join(", ")}. Hệ thống sẽ kiểm tra lại tại thời điểm ghi nhận.`}
                    </Typography>
                  </Alert>
                ) : null}
                {!posted ? (
                  <Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap", rowGap: 1, alignItems: "center" }}>
                    <TextField
                      sx={{ width: 260 }}
                      value={customerPhone}
                      placeholder="SĐT trên nhãn (tùy chọn)"
                      slotProps={{ htmlInput: { maxLength: 10 } }}
                      onChange={(event) =>
                        setCustomerPhone(event.target.value.replace(/\D/g, "").slice(0, 10))
                      }
                      error={!customerPhoneValid}
                    />
                    <Button
                      variant="contained"
                      size="large"
                      startIcon={<PrinterOutlined />}
                      disabled={!can("outbound.post") || !postReady || postAndLabelMutation.isPending}
                      onClick={() => setPostConfirmOpen(true)}
                    >
                      Ghi nhận xuất kho & In nhãn
                    </Button>
                    {can("outbound.cancel") && mutable ? (
                      <Button color="error" variant="outlined" onClick={() => setCancelOpen(true)}>
                        Hủy phiếu
                      </Button>
                    ) : null}
                  </Stack>
                ) : (
                  <Alert severity="success">
                    <Typography sx={{ fontWeight: 700 }}>Phiếu đã ghi nhận xuất kho</Typography>
                    <Typography variant="body2">
                      Tồn kho đã được trừ. Việc in/in lại nhãn không làm thay đổi tồn kho.
                    </Typography>
                  </Alert>
                )}
                {postBlockReason && !posted ? (
                  <Typography variant="body2" color="text.secondary">
                    {postBlockReason}
                  </Typography>
                ) : null}
                {evidence ? (
                  <Typography variant="body2" color="text.secondary">
                    {evidence.movementRefs.length} movement · Request{" "}
                    {evidence.requestId || "—"}
                  </Typography>
                ) : null}
              </Stack>
            </Box>

            <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
                3 · Xem và in nhãn
              </Typography>
              <Stack spacing={1.5}>
                {labelWarning ? <Alert severity="warning">{labelWarning}</Alert> : null}
                {!posted ? (
                  <Typography variant="body2" color="text.secondary">
                    Nhãn được chuẩn bị sau khi ghi nhận xuất kho.
                  </Typography>
                ) : packingLabel ? (
                  <>
                    <Grid container spacing={2}>
                      <DetailField label="Mã nhãn" value={packingLabel.labelCode} />
                      <DetailField label="Trạng thái" value={labelStatus(packingLabel.status)} />
                      <DetailField
                        label="Nơi nhận"
                        value={packingLabel.recipientName || doc.recipientName || "—"}
                      />
                      <DetailField label="Số sản phẩm" value={packingLabel.itemCount} />
                      <DetailField label="Số SKU" value={packingLabel.skuCount} />
                      <DetailField label="Toa nguồn" value={packingLabel.sourceRequestNo || "—"} />
                    </Grid>
                    <Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap", rowGap: 1, alignItems: "center" }}>
                      <TextField
                        select
                        sx={{ width: 280 }}
                        value={printerId}
                        onChange={(event) => setPrinterId(event.target.value)}
                        slotProps={{ select: { native: true } }}
                      >
                        <option value="" disabled>
                          Chọn máy in
                        </option>
                        {activePrinters.map((printer) => (
                          <option key={printer.id} value={printer.id}>
                            {`${printer.code} · ${printer.name}`}
                          </option>
                        ))}
                      </TextField>
                      <Button
                        variant="contained"
                        startIcon={<PrinterOutlined />}
                        disabled={
                          !printerId ||
                          (!can("packing_label.print") &&
                            !can("label.print") &&
                            !can("packing_label.reprint") &&
                            !can("label.reprint")) ||
                          printMutation.isPending
                        }
                        onClick={() => printMutation.mutate()}
                      >
                        {printMutation.isPending
                          ? "Đang gửi lệnh in..."
                          : packingLabel.status === "PRINTED"
                            ? "In lại nhãn"
                            : "In nhãn"}
                      </Button>
                    </Stack>
                  </>
                ) : (
                  <Box>
                    <Button
                      variant="outlined"
                      startIcon={<PrinterOutlined style={{ color: ACTION_ICON_COLORS.download }} />}
                      disabled={labelPrepareMutation.isPending}
                      onClick={() => labelPrepareMutation.mutate()}
                    >
                      {labelPrepareMutation.isPending ? "Đang chuẩn bị..." : "Chuẩn bị lại nhãn"}
                    </Button>
                  </Box>
                )}
              </Stack>
            </Box>

            <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                RFID (tùy chọn)
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Có thể gán RFID cho từng sản phẩm nếu vận hành sử dụng. RFID
                không phải điều kiện để ghi nhận xuất kho.
              </Typography>
            </Box>
          </Stack>

          <CameraScanModal
            open={cameraOpen}
            title="Quét sản phẩm xuất kho"
            onDetected={(code) => {
              setCameraOpen(false);
              scanMutation.mutate({ rawCode: code, scanSource: "CAMERA" });
            }}
            onClose={() => setCameraOpen(false)}
          />

          <Dialog open={postConfirmOpen} onClose={() => setPostConfirmOpen(false)} maxWidth="xs" fullWidth>
            <DialogTitle>Ghi nhận xuất kho & In nhãn?</DialogTitle>
            <DialogContent dividers>
              <Typography variant="body2">
                Tồn kho sẽ được trừ ngay khi ghi nhận. Sau đó hệ thống chuẩn bị
                bản xem trước nhãn để in.
              </Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setPostConfirmOpen(false)} disabled={postAndLabelMutation.isPending}>
                Hủy
              </Button>
              <Button
                variant="contained"
                disabled={postAndLabelMutation.isPending}
                onClick={() =>
                  postAndLabelMutation.mutateAsync().then(() => setPostConfirmOpen(false))
                }
              >
                {postAndLabelMutation.isPending ? "Đang ghi nhận..." : "Ghi nhận"}
              </Button>
            </DialogActions>
          </Dialog>

          <Dialog open={cancelOpen} onClose={() => setCancelOpen(false)} maxWidth="xs" fullWidth>
            <DialogTitle>Hủy phiếu xuất</DialogTitle>
            <DialogContent dividers>
              <TextField
                fullWidth
                multiline
                minRows={3}
                value={cancelReason}
                onChange={(event) => setCancelReason(event.target.value)}
                placeholder="Lý do hủy"
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setCancelOpen(false)}>Đóng</Button>
              <Button
                color="error"
                variant="contained"
                disabled={cancelMutation.isPending || !cancelReason.trim()}
                onClick={() => cancelMutation.mutate()}
              >
                {cancelMutation.isPending ? "Đang hủy..." : "Hủy phiếu"}
              </Button>
            </DialogActions>
          </Dialog>

          <Dialog open={Boolean(rfidTarget)} onClose={() => setRfidTarget(null)} maxWidth="xs" fullWidth>
            <DialogTitle>{`Gán RFID · ${rfidTarget?.itemCode ?? ""}`}</DialogTitle>
            <DialogContent dividers>
              <Stack spacing={2}>
                <TextField
                  fullWidth
                  value={rfidCode}
                  onChange={(event) => setRfidCode(event.target.value)}
                  placeholder="Mã RFID"
                />
                <TextField
                  fullWidth
                  value={rfidHardwareUid}
                  onChange={(event) => setRfidHardwareUid(event.target.value)}
                  placeholder="Hardware UID"
                />
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setRfidTarget(null)}>Đóng</Button>
              <Button
                variant="contained"
                disabled={rfidMutation.isPending || !rfidCode.trim() || !rfidHardwareUid.trim()}
                onClick={() => rfidMutation.mutate()}
              >
                {rfidMutation.isPending ? "Đang gán..." : "Gán RFID"}
              </Button>
            </DialogActions>
          </Dialog>
        </DialogContent>
      </Dialog>
    </ThemeProvider>
  );
}
