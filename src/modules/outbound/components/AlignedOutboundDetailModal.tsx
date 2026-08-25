import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import {
  CameraOutlined,
  DeleteOutlined,
  PrinterOutlined,
  ScanOutlined,
  WifiOutlined,
} from "@ant-design/icons";
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
  const labels: Record<string, string> = {
    DRAFT: "Nháp",
    PENDING_PRINT: "Chờ chuẩn bị",
    PREVIEWED: "Đã xem trước",
    READY_TO_PRINT: "Sẵn sàng in",
    PRINTED: "Đã in",
    PRINT_FAILED: "In thất bại",
  };
  return value ? labels[value] ?? value : "Chưa tạo";
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
  const [preparedLabel, setPreparedLabel] =
    useState<PackingLabelRecord | null>(null);
  const [labelWarning, setLabelWarning] = useState<string | null>(null);
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
  const customerPhoneValid = customerPhone === "" || /^0\d{9}$/.test(customerPhone);
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
        <Space size={4}>
          {mutable && can("outbound.scan") ? (
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => unmatchMutation.mutate(match.id)}
            >
              Gỡ
            </Button>
          ) : null}
          {match.itemId && can("physical_code.assign_rfid") ? (
            <Button
              size="small"
              icon={<WifiOutlined />}
              onClick={() =>
                setRfidTarget({
                  itemId: match.itemId as string,
                  itemCode:
                    match.itemCode ||
                    match.serialNumber ||
                    short(match.itemId),
                })
              }
            >
              RFID
            </Button>
          ) : null}
        </Space>
      ),
    },
  ];

  if (detailQuery.isLoading) {
    return (
      <Modal
        open
        title="Chi tiết phiếu xuất"
        footer={null}
        onCancel={onClose}
      >
        Đang tải...
      </Modal>
    );
  }

  if (detailQuery.isError || !detail || !doc) {
    return (
      <Modal
        open
        title="Chi tiết phiếu xuất"
        footer={null}
        onCancel={onClose}
      >
        <Alert
          type="error"
          showIcon
          title={getApiErrorMessage(
            detailQuery.error,
            "Không tải được phiếu xuất.",
          )}
        />
      </Modal>
    );
  }

  return (
    <Modal
      open
      width={1180}
      title="Chi tiết phiếu xuất"
      onCancel={onClose}
      footer={null}
      destroyOnClose
    >
      <Space orientation="vertical" size={16} style={{ width: "100%" }}>
        <Descriptions
          bordered
          size="small"
          column={{ xs: 1, sm: 2, lg: 4 }}
        >
          <Descriptions.Item label="Phiếu">{doc.code}</Descriptions.Item>
          <Descriptions.Item label="Trạng thái">
            <Tag>{businessLabel(OUTBOUND_STATUS_LABELS, doc.status)}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Nơi nhận">
            {doc.recipientName || "—"}
          </Descriptions.Item>
          <Descriptions.Item label="Đã quét">
            {totalScanned}/{totalExpected}
          </Descriptions.Item>
        </Descriptions>

        <Card title="1 · Quét và đối chiếu hàng" size="small">
          <Space orientation="vertical" style={{ width: "100%" }}>
            <Space wrap>
              <Select
                allowClear
                style={{ width: 300 }}
                placeholder="Tự nhận SKU từ mã quét"
                value={lineId || undefined}
                onChange={(value) => setLineId(value ?? "")}
                options={detail.lines
                  .filter((line) => line.scanned < line.expected)
                  .map((line) => ({
                    value: line.id,
                    label: `${short(line.productId)} · ${line.scanned}/${line.expected}`,
                  }))}
              />
              <Input
                style={{ width: 330 }}
                value={scanCode}
                placeholder="Quét QR/Barcode sản phẩm"
                onChange={(event) => setScanCode(event.target.value)}
                onPressEnter={() =>
                  scanMutation.mutate({
                    rawCode: scanCode,
                    scanSource: "MANUAL",
                  })
                }
                disabled={!mutable || !can("outbound.scan")}
              />
              <Button
                type="primary"
                icon={<ScanOutlined />}
                disabled={
                  !mutable || !can("outbound.scan") || !scanCode.trim()
                }
                loading={scanMutation.isPending}
                onClick={() =>
                  scanMutation.mutate({
                    rawCode: scanCode,
                    scanSource: "MANUAL",
                  })
                }
              >
                Quét
              </Button>
              <Button
                icon={<CameraOutlined />}
                disabled={!mutable || !can("outbound.scan")}
                onClick={() => setCameraOpen(true)}
              >
                Camera
              </Button>
            </Space>
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
          </Space>
        </Card>

        <Card title="2 · Ghi nhận xuất kho & In nhãn" size="small">
          <Space orientation="vertical" style={{ width: "100%" }}>
            {shortStockLines.length ? (
              <Alert
                type="warning"
                showIcon
                title="Tồn khả dụng hiện thấp hơn số lượng cần xuất"
                description={`SKU thiếu: ${shortStockLines
                  .map((line) => short(line.productId))
                  .join(", ")}. Hệ thống sẽ kiểm tra lại tại thời điểm ghi nhận.`}
              />
            ) : null}
            {!posted ? (
              <Space wrap>
                <Input
                  style={{ width: 260 }}
                  value={customerPhone}
                  placeholder="SĐT trên nhãn (tùy chọn)"
                  maxLength={10}
                  onChange={(event) =>
                    setCustomerPhone(
                      event.target.value.replace(/\D/g, "").slice(0, 10),
                    )
                  }
                  status={customerPhoneValid ? undefined : "error"}
                />
                <Button
                  type="primary"
                  size="large"
                  icon={<PrinterOutlined />}
                  disabled={!can("outbound.post") || !postReady}
                  loading={postAndLabelMutation.isPending}
                  onClick={() =>
                    Modal.confirm({
                      title: "Ghi nhận xuất kho & In nhãn?",
                      content:
                        "Tồn kho sẽ được trừ ngay khi ghi nhận. Sau đó hệ thống chuẩn bị bản xem trước nhãn để in.",
                      okText: "Ghi nhận",
                      onOk: () => postAndLabelMutation.mutateAsync(),
                    })
                  }
                >
                  Ghi nhận xuất kho & In nhãn
                </Button>
                {can("outbound.cancel") && mutable ? (
                  <Button danger onClick={() => setCancelOpen(true)}>
                    Hủy phiếu
                  </Button>
                ) : null}
              </Space>
            ) : (
              <Alert
                type="success"
                showIcon
                title="Phiếu đã ghi nhận xuất kho"
                description="Tồn kho đã được trừ. Việc in/in lại nhãn không làm thay đổi tồn kho."
              />
            )}
            {postBlockReason && !posted ? (
              <Text type="secondary">{postBlockReason}</Text>
            ) : null}
            {evidence ? (
              <Text type="secondary">
                {evidence.movementRefs.length} movement · Request{" "}
                {evidence.requestId || "—"}
              </Text>
            ) : null}
          </Space>
        </Card>

        <Card title="3 · Xem và in nhãn" size="small">
          <Space orientation="vertical" style={{ width: "100%" }}>
            {labelWarning ? (
              <Alert type="warning" showIcon title={labelWarning} />
            ) : null}
            {!posted ? (
              <Text type="secondary">
                Nhãn được chuẩn bị sau khi ghi nhận xuất kho.
              </Text>
            ) : packingLabel ? (
              <>
                <Descriptions
                  bordered
                  size="small"
                  column={{ xs: 1, sm: 2, lg: 3 }}
                >
                  <Descriptions.Item label="Mã nhãn">
                    {packingLabel.labelCode}
                  </Descriptions.Item>
                  <Descriptions.Item label="Trạng thái">
                    {labelStatus(packingLabel.status)}
                  </Descriptions.Item>
                  <Descriptions.Item label="Nơi nhận">
                    {packingLabel.recipientName || doc.recipientName || "—"}
                  </Descriptions.Item>
                  <Descriptions.Item label="Số sản phẩm">
                    {packingLabel.itemCount}
                  </Descriptions.Item>
                  <Descriptions.Item label="Số SKU">
                    {packingLabel.skuCount}
                  </Descriptions.Item>
                  <Descriptions.Item label="Toa nguồn">
                    {packingLabel.sourceRequestNo || "—"}
                  </Descriptions.Item>
                </Descriptions>
                <Space wrap>
                  <Select
                    style={{ width: 280 }}
                    placeholder="Chọn máy in"
                    value={printerId || undefined}
                    onChange={setPrinterId}
                    options={activePrinters.map((printer) => ({
                      value: printer.id,
                      label: `${printer.code} · ${printer.name}`,
                    }))}
                  />
                  <Button
                    type="primary"
                    icon={<PrinterOutlined />}
                    disabled={
                      !printerId ||
                      (!can("packing_label.print") &&
                        !can("label.print") &&
                        !can("packing_label.reprint") &&
                        !can("label.reprint"))
                    }
                    loading={printMutation.isPending}
                    onClick={() => printMutation.mutate()}
                  >
                    {packingLabel.status === "PRINTED"
                      ? "In lại nhãn"
                      : "In nhãn"}
                  </Button>
                </Space>
              </>
            ) : (
              <Button
                icon={<PrinterOutlined />}
                loading={labelPrepareMutation.isPending}
                onClick={() => labelPrepareMutation.mutate()}
              >
                Chuẩn bị lại nhãn
              </Button>
            )}
          </Space>
        </Card>

        <Card title="RFID (tùy chọn)" size="small">
          <Text type="secondary">
            Có thể gán RFID cho từng sản phẩm nếu vận hành sử dụng. RFID không
            phải điều kiện để ghi nhận xuất kho.
          </Text>
        </Card>
      </Space>

      <CameraScanModal
        open={cameraOpen}
        title="Quét sản phẩm xuất kho"
        onDetected={(code) => {
          setCameraOpen(false);
          scanMutation.mutate({ rawCode: code, scanSource: "CAMERA" });
        }}
        onClose={() => setCameraOpen(false)}
      />

      <Modal
        open={cancelOpen}
        title="Hủy phiếu xuất"
        okText="Hủy phiếu"
        okButtonProps={{
          danger: true,
          loading: cancelMutation.isPending,
          disabled: !cancelReason.trim(),
        }}
        onOk={() => cancelMutation.mutate()}
        onCancel={() => setCancelOpen(false)}
      >
        <Input.TextArea
          rows={3}
          value={cancelReason}
          onChange={(event) => setCancelReason(event.target.value)}
          placeholder="Lý do hủy"
        />
      </Modal>

      <Modal
        open={Boolean(rfidTarget)}
        title={`Gán RFID · ${rfidTarget?.itemCode ?? ""}`}
        okText="Gán RFID"
        okButtonProps={{
          loading: rfidMutation.isPending,
          disabled: !rfidCode.trim() || !rfidHardwareUid.trim(),
        }}
        onOk={() => rfidMutation.mutate()}
        onCancel={() => setRfidTarget(null)}
      >
        <Space orientation="vertical" style={{ width: "100%" }}>
          <Input
            value={rfidCode}
            onChange={(event) => setRfidCode(event.target.value)}
            placeholder="Mã RFID"
          />
          <Input
            value={rfidHardwareUid}
            onChange={(event) => setRfidHardwareUid(event.target.value)}
            placeholder="Hardware UID"
          />
        </Space>
      </Modal>
    </Modal>
  );
}
