import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import {
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import { useHasPermission } from "@/shared/components/permission";
import {
  useMvpAgencies,
  useMvpSkus,
} from "@/modules/master-data/hooks/use-mvp-master";
import type {
  AgencyRecord,
  SkuRecord,
} from "@/modules/master-data/types/mvp-master.types";
import {
  assignRfidToItem,
  cancelOutboundDocument,
  consumeOutboundImport,
  fetchActiveRfidCodes,
  fetchLabelSnapshots,
  fetchOutboundDetail,
  fetchOutboundDocuments,
  fetchPrinterConfigs,
  postOutboundIssue,
  reprintLabelSnapshot,
  scanOutboundItem,
  updateOutboundDocument,
  uploadOutboundRequestFile,
  validateOutboundRequestRows,
  type LabelSnapshotRecord,
  type OutboundDocumentRecord,
  type OutboundImportResult,
  type OutboundRequestRowInput,
  type OutboundScanResult,
  type OutboundStatus,
} from "@/modules/outbound/services/mvpOutboundService";

type IntakeForm = {
  request_no: string;
  agency_id?: string;
  recipient_name: string;
  recipient_address: string;
  lines: Array<{ product_id: string; required_qty: number }>;
};

type EditForm = {
  agency_id?: string;
  recipient_name: string;
  recipient_address: string;
  doc_date?: string;
  note?: string;
};

type RfidForm = {
  code_value: string;
  hardware_uid: string;
};

const statusColor: Record<OutboundStatus, string> = {
  DRAFT: "default",
  SCANNING: "processing",
  POSTED: "success",
  CANCELLED: "error",
};

const statusLabel: Record<OutboundStatus, string> = {
  DRAFT: "DRAFT",
  SCANNING: "ĐANG QUÉT",
  POSTED: "ĐÃ POST",
  CANCELLED: "ĐÃ HỦY",
};

function text(value: unknown, fallback = ""): string {
  return value === undefined || value === null ? fallback : String(value);
}

function makeKey(prefix: string): string {
  const random =
    globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  return `${prefix}-${random}`;
}

function progress(document: OutboundDocumentRecord): string {
  return `${document.scanned} / ${document.expected}`;
}

function importErrorText(
  row: OutboundImportResult["rows"][number],
): string {
  return row.errors
    .map(
      (error) =>
        `${error.field ?? "row"}: ${error.message ?? error.error_code ?? "Lỗi"}`,
    )
    .join(" · ");
}

export default function MvpOutboundPage() {
  const can = useHasPermission();
  const queryClient = useQueryClient();
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<OutboundStatus | "">("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [intakeMode, setIntakeMode] = useState<"manual" | "excel">("manual");
  const [intakeFile, setIntakeFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] =
    useState<OutboundImportResult | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [lineId, setLineId] = useState("");
  const [scanCode, setScanCode] = useState("");
  const [printerId, setPrinterId] = useState("");
  const [lastScan, setLastScan] = useState<OutboundScanResult | null>(null);
  const [rfidItemId, setRfidItemId] = useState<string | null>(null);
  const [intakeForm] = Form.useForm<IntakeForm>();
  const [editForm] = Form.useForm<EditForm>();
  const [rfidForm] = Form.useForm<RfidForm>();

  const canCreate = can("outbound.create");
  const canScan = can("outbound.scan") || can("scan.outbound");
  const canPost = can("outbound.post");
  const canCancel = can("outbound.cancel");
  const canImport = can("outbound.import");
  const canReprint = can("label.reprint");
  const canAssignRfid = can("physical_code.assign_rfid");

  const documentsQuery = useQuery({
    queryKey: ["mvp-outbound", "list", search, status],
    queryFn: () =>
      fetchOutboundDocuments({
        search,
        status: status || undefined,
        per_page: 100,
      }),
  });

  const detailQuery = useQuery({
    queryKey: ["mvp-outbound", "detail", selectedId],
    queryFn: () => fetchOutboundDetail(selectedId ?? ""),
    enabled: Boolean(selectedId && detailOpen),
  });

  const skuQuery = useMvpSkus({
    status: "ACTIVE",
    sku_type: "PRODUCT",
    per_page: 100,
  });
  const agencyQuery = useMvpAgencies({ status: "ACTIVE", per_page: 100 });
  const labelsQuery = useQuery({
    queryKey: ["mvp-outbound", "labels", selectedId],
    queryFn: fetchLabelSnapshots,
    enabled: Boolean(selectedId && detailOpen),
  });
  const rfidQuery = useQuery({
    queryKey: ["mvp-outbound", "rfids", selectedId],
    queryFn: fetchActiveRfidCodes,
    enabled: Boolean(selectedId && detailOpen),
  });
  const printersQuery = useQuery({
    queryKey: ["mvp-outbound", "printers"],
    queryFn: fetchPrinterConfigs,
  });

  const detail = detailQuery.data;
  const skuRows = skuQuery.data?.data ?? [];
  const agencyRows = agencyQuery.data?.data ?? [];
  const activePrinters = (printersQuery.data ?? []).filter(
    (printer) => printer.status === "ACTIVE",
  );

  const skuById = useMemo(
    () => new Map<string, SkuRecord>(skuRows.map((sku) => [sku.sku_id, sku])),
    [skuRows],
  );
  const agencyById = useMemo(
    () =>
      new Map<string, AgencyRecord>(
        agencyRows.map((agency) => [agency.agency_id, agency]),
      ),
    [agencyRows],
  );

  const labelsForDocument = useMemo(() => {
    if (!detail) return [];
    return (labelsQuery.data ?? []).filter(
      (snapshot) => snapshot.outboundNo === detail.document.code,
    );
  }, [detail, labelsQuery.data]);

  const activeRfidByItem = useMemo(() => {
    const map = new Map<string, string>();
    for (const code of rfidQuery.data ?? []) {
      if (code.itemId) map.set(code.itemId, code.codeValue);
    }
    return map;
  }, [rfidQuery.data]);

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
  const itemLabels = labelsForDocument.filter((snapshot) => snapshot.itemId);
  const allLabelsPrinted =
    totalExpected > 0 &&
    itemLabels.length >= totalExpected &&
    itemLabels.every((snapshot) => snapshot.status === "PRINTED");
  const allRfidMapped =
    totalExpected > 0 &&
    itemLabels.length >= totalExpected &&
    itemLabels.every((snapshot) =>
      Boolean(snapshot.itemId && activeRfidByItem.has(snapshot.itemId)),
    );
  const postReady = Boolean(
    detail?.document.status === "SCANNING" &&
      detail.document.outboundRequestId &&
      fullScan &&
      allLabelsPrinted &&
      allRfidMapped,
  );

  useEffect(() => {
    if (!detail) return;
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

  const refreshOutbound = async () => {
    await queryClient.invalidateQueries({ queryKey: ["mvp-outbound"] });
  };

  const openDetail = (id: string) => {
    setSelectedId(id);
    setLastScan(null);
    setScanCode("");
    setDetailOpen(true);
  };

  const closeDetail = () => {
    setDetailOpen(false);
    setSelectedId(null);
    setLineId("");
    setScanCode("");
    setLastScan(null);
  };

  const resetIntake = () => {
    setImportPreview(null);
    setIntakeFile(null);
    setIntakeMode("manual");
    intakeForm.resetFields();
  };

  const validateManualMutation = useMutation({
    mutationFn: async () => {
      const values = await intakeForm.validateFields();
      const rows: OutboundRequestRowInput[] = values.lines.map((line) => ({
        request_no: values.request_no.trim(),
        customer_name: values.recipient_name.trim(),
        customer_address: values.recipient_address.trim(),
        sku_id: line.product_id,
        required_qty: Number(line.required_qty),
        agency_id: values.agency_id || null,
      }));
      return validateOutboundRequestRows(rows);
    },
    onSuccess: (result) => {
      setImportPreview(result);
      if (result.status === "VALIDATED") {
        message.success(
          "Dữ liệu yêu cầu xuất hợp lệ. Hãy xác nhận để tạo Outbound DRAFT.",
        );
      } else {
        message.warning(
          "Dữ liệu còn lỗi blocking. Kiểm tra preview trước khi xác nhận.",
        );
      }
    },
  });

  const validateFileMutation = useMutation({
    mutationFn: async () => {
      if (!intakeFile) throw new Error("Chọn file Excel trước khi kiểm tra.");
      return uploadOutboundRequestFile(intakeFile);
    },
    onSuccess: (result) => {
      setImportPreview(result);
      if (result.status === "VALIDATED") {
        message.success(
          "File Excel đã VALIDATED. Hãy xác nhận tạo Outbound DRAFT.",
        );
      } else {
        message.warning(
          "File có row lỗi. Không thể consume cho đến khi dữ liệu hợp lệ.",
        );
      }
    },
  });

  const consumeMutation = useMutation({
    mutationFn: async () => {
      if (!importPreview) throw new Error("Chưa có import để consume.");
      return consumeOutboundImport(
        importPreview.id,
        makeKey("consume-outbound"),
      );
    },
    onSuccess: async (result) => {
      message.success(
        `Đã tạo ${result.outboundDocumentIds.length} phiếu xuất DRAFT từ request.`,
      );
      setIntakeOpen(false);
      resetIntake();
      await refreshOutbound();
      if (result.outboundDocumentIds[0]) openDetail(result.outboundDocumentIds[0]);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (values: EditForm) => {
      if (!detail) throw new Error("Chưa chọn phiếu xuất.");
      return updateOutboundDocument(
        detail.document.id,
        {
          agency_id: values.agency_id || null,
          recipient_name: values.recipient_name.trim() || null,
          recipient_address: values.recipient_address.trim() || null,
          doc_date: values.doc_date || null,
          note: values.note?.trim() || null,
        },
        detail.document.version,
      );
    },
    onSuccess: async () => {
      message.success("Đã cập nhật phiếu xuất DRAFT trên backend.");
      setEditOpen(false);
      await refreshOutbound();
    },
  });

  const scanMutation = useMutation({
    mutationFn: async () => {
      if (!detail || !lineId || !scanCode.trim()) {
        throw new Error("Chọn dòng và nhập Barcode/QR cần quét.");
      }
      return scanOutboundItem({
        documentId: detail.document.id,
        lineId,
        codeValue: scanCode.trim(),
        ifMatch: detail.document.version,
        printerConfigId: printerId || undefined,
      });
    },
    onSuccess: async (result) => {
      setLastScan(result);
      setScanCode("");
      if (result.labelStatus === "PRINT_FAILED") {
        message.warning(
          "Match thành công nhưng in nhãn thất bại. Hãy In lại trước khi Post Issue.",
        );
      } else {
        message.success(
          "Item đã match; scan stock-neutral và nhãn đã được xử lý trên backend.",
        );
      }
      await refreshOutbound();
    },
  });

  const reprintMutation = useMutation({
    mutationFn: async (snapshot: LabelSnapshotRecord) => {
      if (!printerId) throw new Error("Chọn printer ACTIVE để In lại.");
      return reprintLabelSnapshot(snapshot.id, printerId);
    },
    onSuccess: async () => {
      message.success("In lại nhãn thành công.");
      await queryClient.invalidateQueries({
        queryKey: ["mvp-outbound", "labels", selectedId],
      });
    },
  });

  const rfidMutation = useMutation({
    mutationFn: async () => {
      if (!rfidItemId)
        throw new Error("Không xác định được item cần map RFID.");
      const values = await rfidForm.validateFields();
      return assignRfidToItem({
        itemId: rfidItemId,
        codeValue: values.code_value.trim(),
        hardwareUid: values.hardware_uid.trim(),
      });
    },
    onSuccess: async () => {
      message.success(
        "Đã map RFID vào đúng item. Thao tác này không đổi tồn kho.",
      );
      setRfidItemId(null);
      rfidForm.resetFields();
      await queryClient.invalidateQueries({
        queryKey: ["mvp-outbound", "rfids", selectedId],
      });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      if (!detail || !cancelReason.trim())
        throw new Error("Lý do hủy là bắt buộc.");
      return cancelOutboundDocument(
        detail.document.id,
        cancelReason.trim(),
        detail.document.version,
      );
    },
    onSuccess: async () => {
      message.success("Đã hủy phiếu xuất.");
      setCancelOpen(false);
      setCancelReason("");
      await refreshOutbound();
    },
  });

  const postMutation = useMutation({
    mutationFn: async () => {
      if (!detail) throw new Error("Chưa chọn phiếu xuất.");
      return postOutboundIssue({
        documentId: detail.document.id,
        ifMatch: detail.document.version,
        idempotencyKey: makeKey(`post-issue-${detail.document.id}`),
      });
    },
    onSuccess: async (evidence) => {
      message.success(
        `Post Issue thành công · ${evidence.movementRefs.length} movement · Request ${evidence.requestId || "-"}`,
      );
      await refreshOutbound();
    },
  });

  const openEdit = () => {
    if (!detail) return;
    editForm.setFieldsValue({
      agency_id: detail.document.agencyId ?? undefined,
      recipient_name:
        detail.document.recipientName === "-" ? "" : detail.document.recipientName,
      recipient_address:
        detail.document.recipientAddress === "-"
          ? ""
          : detail.document.recipientAddress,
      doc_date: detail.document.date?.slice(0, 10),
      note: detail.document.note ?? undefined,
    });
    setEditOpen(true);
  };

  const handleAgencyChange = (agencyId?: string) => {
    const agency = agencyId ? agencyById.get(agencyId) : undefined;
    if (!agency) return;
    intakeForm.setFieldsValue({
      agency_id: agency.agency_id,
      recipient_name: agency.agency_name,
      recipient_address: agency.address ?? "",
    });
  };

  const listColumns = [
    { title: "Phiếu xuất", dataIndex: "code", key: "code" },
    {
      title: "Người nhận",
      dataIndex: "recipientName",
      key: "recipientName",
    },
    {
      title: "Request nguồn",
      dataIndex: "outboundRequestId",
      key: "outboundRequestId",
      render: (value: string | null | undefined) =>
        value || <Tag color="warning">Thiếu request</Tag>,
    },
    {
      title: "Tiến độ",
      key: "progress",
      render: (_: unknown, row: OutboundDocumentRecord) => progress(row),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      render: (value: OutboundStatus) => (
        <Tag color={statusColor[value]}>{statusLabel[value]}</Tag>
      ),
    },
    { title: "Cập nhật", dataIndex: "updatedAt", key: "updatedAt" },
    {
      title: "",
      key: "action",
      render: (_: unknown, row: OutboundDocumentRecord) => (
        <Space>
          {row.status === "DRAFT" && canCreate && (
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => {
                openDetail(row.id);
                window.setTimeout(() => {
                  void queryClient
                    .fetchQuery({
                      queryKey: ["mvp-outbound", "detail", row.id],
                      queryFn: () => fetchOutboundDetail(row.id),
                    })
                    .then((loaded) => {
                      editForm.setFieldsValue({
                        agency_id: loaded.document.agencyId ?? undefined,
                        recipient_name:
                          loaded.document.recipientName === "-"
                            ? ""
                            : loaded.document.recipientName,
                        recipient_address:
                          loaded.document.recipientAddress === "-"
                            ? ""
                            : loaded.document.recipientAddress,
                        doc_date: loaded.document.date?.slice(0, 10),
                        note: loaded.document.note ?? undefined,
                      });
                      setEditOpen(true);
                    });
                }, 0);
              }}
            >
              Sửa
            </Button>
          )}
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => openDetail(row.id)}
          >
            {row.status === "POSTED" || row.status === "CANCELLED"
              ? "Xem"
              : "Mở"}
          </Button>
        </Space>
      ),
    },
  ];

  const lineColumns = [
    {
      title: "SKU",
      key: "sku",
      render: (
        _: unknown,
        line: NonNullable<typeof detail>["lines"][number],
      ) => skuById.get(line.productId)?.sku_code ?? line.productId,
    },
    {
      title: "Tên hàng",
      key: "name",
      render: (
        _: unknown,
        line: NonNullable<typeof detail>["lines"][number],
      ) => skuById.get(line.productId)?.sku_name ?? "-",
    },
    {
      title: "Yêu cầu",
      dataIndex: "expected",
      key: "expected",
      align: "right" as const,
    },
    {
      title: "Đã match",
      dataIndex: "scanned",
      key: "scanned",
      align: "right" as const,
    },
    {
      title: "Còn lại",
      dataIndex: "remaining",
      key: "remaining",
      align: "right" as const,
    },
    {
      title: "Kết quả",
      key: "result",
      render: (
        _: unknown,
        line: NonNullable<typeof detail>["lines"][number],
      ) => (
        <Tag color={line.scanned === line.expected ? "success" : "warning"}>
          {line.scanned === line.expected ? "ĐỦ" : "CHƯA ĐỦ"}
        </Tag>
      ),
    },
  ];

  const labelColumns = [
    {
      title: "Item",
      dataIndex: "itemId",
      key: "itemId",
      render: (value: string | null | undefined) => value || "-",
    },
    {
      title: "Nhãn",
      dataIndex: "status",
      key: "status",
      render: (value: string) => (
        <Tag color={value === "PRINTED" ? "success" : "error"}>
          {value || "-"}
        </Tag>
      ),
    },
    {
      title: "RFID",
      key: "rfid",
      render: (_: unknown, snapshot: LabelSnapshotRecord) => {
        const code = snapshot.itemId
          ? activeRfidByItem.get(snapshot.itemId)
          : undefined;
        return code ? (
          <Tag color="success">{code}</Tag>
        ) : (
          <Tag color="warning">CHƯA MAP</Tag>
        );
      },
    },
    {
      title: "Hành động",
      key: "actions",
      render: (_: unknown, snapshot: LabelSnapshotRecord) => (
        <Space>
          {snapshot.status !== "PRINTED" && canReprint && (
            <Button
              size="small"
              loading={reprintMutation.isPending}
              onClick={() => reprintMutation.mutate(snapshot)}
            >
              In lại
            </Button>
          )}
          {snapshot.itemId &&
            !activeRfidByItem.has(snapshot.itemId) &&
            canAssignRfid && (
              <Button
                size="small"
                onClick={() => {
                  setRfidItemId(snapshot.itemId ?? null);
                  rfidForm.resetFields();
                }}
              >
                Map RFID
              </Button>
            )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card
        title="Danh sách phiếu xuất"
        extra={
          <Space wrap>
            <Input
              value={searchDraft}
              placeholder="Tìm mã phiếu / ghi chú"
              style={{ width: 260 }}
              allowClear
              onChange={(event) => {
                setSearchDraft(event.target.value);
                if (!event.target.value) setSearch("");
              }}
              onPressEnter={() => setSearch(searchDraft.trim())}
            />
            <Select
              value={status || undefined}
              allowClear
              placeholder="Trạng thái"
              style={{ width: 170 }}
              onChange={(value) =>
                setStatus((value ?? "") as OutboundStatus | "")
              }
              options={Object.entries(statusLabel).map(([value, label]) => ({
                value,
                label,
              }))}
            />
            <Button
              icon={<ReloadOutlined />}
              onClick={() => documentsQuery.refetch()}
            >
              Làm mới
            </Button>
            {canImport && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  resetIntake();
                  setIntakeOpen(true);
                }}
              >
                Tiếp nhận yêu cầu xuất
              </Button>
            )}
          </Space>
        }
      >
        <ApiErrorAlert
          error={documentsQuery.error}
          title="Không tải được danh sách phiếu xuất"
          onRetry={() => documentsQuery.refetch()}
          style={{ marginBottom: 16 }}
        />
        <Table
          rowKey="id"
          size="small"
          loading={documentsQuery.isLoading}
          dataSource={documentsQuery.data ?? []}
          columns={listColumns}
          pagination={false}
          scroll={{ x: 1050 }}
        />
      </Card>

      <Modal
        title={
          detail
            ? `Chi tiết phiếu xuất · ${detail.document.code}`
            : "Chi tiết phiếu xuất"
        }
        open={detailOpen}
        width={1180}
        onCancel={closeDetail}
        footer={
          detail ? (
            <Space wrap>
              <Button onClick={closeDetail}>Đóng</Button>
              {detail.document.status === "DRAFT" && canCreate && (
                <Button icon={<EditOutlined />} onClick={openEdit}>
                  Sửa DRAFT
                </Button>
              )}
              {canCancel &&
                (detail.document.status === "DRAFT" ||
                  detail.document.status === "SCANNING") && (
                  <Button danger onClick={() => setCancelOpen(true)}>
                    Hủy phiếu
                  </Button>
                )}
              <Button
                type="primary"
                disabled={!canPost || !postReady || postMutation.isPending}
                loading={postMutation.isPending}
                onClick={() => {
                  Modal.confirm({
                    title: "Xác nhận Post Issue toàn bộ",
                    content:
                      "Post Issue sẽ giảm tồn kho thật đúng một lần. Tất cả line, nhãn và RFID phải hoàn tất.",
                    okText: "Post Issue",
                    cancelText: "Kiểm tra lại",
                    onOk: () => postMutation.mutateAsync(),
                  });
                }}
              >
                Post Issue toàn bộ
              </Button>
            </Space>
          ) : null
        }
      >
        <ApiErrorAlert
          error={detailQuery.error}
          title="Không tải được chi tiết phiếu xuất"
        />
        {detail && (
          <Space direction="vertical" size={14} style={{ width: "100%" }}>
            <div className="grid-2">
              <div className="card">
                <div className="section-title">Thông tin chung</div>
                <div className="kpi">
                  <span>Phiếu xuất</span>
                  <b>{detail.document.code}</b>
                </div>
                <div className="kpi">
                  <span>Người nhận</span>
                  <b>{detail.document.recipientName}</b>
                </div>
                <div className="kpi">
                  <span>Địa chỉ</span>
                  <b>{detail.document.recipientAddress}</b>
                </div>
                <div className="kpi">
                  <span>Request nguồn</span>
                  <b>{detail.document.outboundRequestId || "-"}</b>
                </div>
                <div className="kpi">
                  <span>Version</span>
                  <b>{detail.document.version}</b>
                </div>
              </div>
              <div className="card soft">
                <div className="section-title">Gate Full Post</div>
                <div className="rule">
                  <span
                    className="dot"
                    style={{ background: fullScan ? "#16a34a" : "#d97706" }}
                  />
                  <span>
                    Match: {totalScanned}/{totalExpected}
                  </span>
                </div>
                <div className="rule">
                  <span
                    className="dot"
                    style={{
                      background: allLabelsPrinted ? "#16a34a" : "#d97706",
                    }}
                  />
                  <span>
                    Nhãn: {allLabelsPrinted ? "Đã PRINTED đủ" : "Chưa đủ / còn lỗi in"}
                  </span>
                </div>
                <div className="rule">
                  <span
                    className="dot"
                    style={{
                      background: allRfidMapped ? "#16a34a" : "#d97706",
                    }}
                  />
                  <span>
                    RFID: {allRfidMapped ? "Đã map đủ" : "Chưa map đủ item"}
                  </span>
                </div>
                <div className="rule">
                  <span
                    className="dot"
                    style={{
                      background: detail.document.outboundRequestId
                        ? "#16a34a"
                        : "#dc2626",
                    }}
                  />
                  <span>
                    Request nguồn: {detail.document.outboundRequestId ? "Có" : "Thiếu - backend sẽ chặn scan/post"}
                  </span>
                </div>
              </div>
            </div>

            {!detail.document.outboundRequestId && (
              <Alert
                type="error"
                showIcon
                message="Phiếu legacy không có outbound_request_id. Theo baseline hiện hành, hãy hủy và tạo lại từ Tiếp nhận yêu cầu xuất/Excel; backend không cho scan phiếu này."
              />
            )}

            <Table
              rowKey="id"
              size="small"
              dataSource={detail.lines}
              columns={lineColumns}
              pagination={false}
            />

            {(detail.document.status === "DRAFT" ||
              detail.document.status === "SCANNING") && (
              <Card size="small" title="Quét & match Item · Barcode/QR">
                <Space direction="vertical" style={{ width: "100%" }}>
                  <Space wrap>
                    <Select
                      value={lineId || undefined}
                      placeholder="Chọn dòng còn thiếu"
                      style={{ minWidth: 360 }}
                      disabled={!canScan || !detail.document.outboundRequestId}
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
                      placeholder="Printer ACTIVE (tùy chọn)"
                      style={{ minWidth: 260 }}
                      onChange={(value) => setPrinterId(value ?? "")}
                      options={activePrinters.map((printer) => ({
                        value: printer.id,
                        label: `${printer.code} · ${printer.name}`,
                      }))}
                    />
                  </Space>
                  <Space.Compact style={{ width: "100%" }}>
                    <Input
                      value={scanCode}
                      placeholder="Quét / nhập Barcode hoặc QR của Item"
                      disabled={
                        !canScan ||
                        !lineId ||
                        !detail.document.outboundRequestId
                      }
                      onChange={(event) => setScanCode(event.target.value)}
                      onPressEnter={() => {
                        if (scanCode.trim()) scanMutation.mutate();
                      }}
                    />
                    <Button
                      type="primary"
                      loading={scanMutation.isPending}
                      disabled={
                        !canScan ||
                        !lineId ||
                        !scanCode.trim() ||
                        !detail.document.outboundRequestId
                      }
                      onClick={() => scanMutation.mutate()}
                    >
                      Match Item
                    </Button>
                  </Space.Compact>
                  <ApiErrorAlert
                    error={scanMutation.error}
                    title="Scan/match không thành công"
                  />
                  {lastScan && (
                    <Alert
                      type={
                        lastScan.labelStatus === "PRINT_FAILED"
                          ? "warning"
                          : "success"
                      }
                      showIcon
                      message={`Item ${lastScan.itemId || "-"} · ${lastScan.scanned}/${lastScan.expected} · Label ${lastScan.labelStatus || "N/A"}`}
                      description={
                        lastScan.printError ||
                        "Scan stock_effect=NONE; version đã được backend tăng."
                      }
                    />
                  )}
                </Space>
              </Card>
            )}

            <Card size="small" title="Nhãn từng Item & RFID">
              <Space direction="vertical" style={{ width: "100%" }}>
                <Alert
                  type="info"
                  showIcon
                  message="Scan PRODUCT tự tạo/dispatch label. Nếu PRINT_FAILED phải In lại. RFID map vào cùng item và không tạo movement."
                />
                <Select
                  value={printerId || undefined}
                  allowClear
                  placeholder="Chọn printer cho In lại"
                  style={{ width: 320 }}
                  onChange={(value) => setPrinterId(value ?? "")}
                  options={activePrinters.map((printer) => ({
                    value: printer.id,
                    label: `${printer.code} · ${printer.name}`,
                  }))}
                />
                <ApiErrorAlert
                  error={labelsQuery.error}
                  title="Không tải được trạng thái nhãn"
                />
                <ApiErrorAlert
                  error={rfidQuery.error}
                  title="Không tải được trạng thái RFID"
                />
                <Table
                  rowKey="id"
                  size="small"
                  loading={labelsQuery.isLoading || rfidQuery.isLoading}
                  dataSource={labelsForDocument}
                  columns={labelColumns}
                  pagination={false}
                />
              </Space>
            </Card>

            <ApiErrorAlert
              error={postMutation.error}
              title="Post Issue không thành công"
            />
          </Space>
        )}
      </Modal>

      <Modal
        title="Tiếp nhận yêu cầu xuất"
        open={intakeOpen}
        width={1040}
        footer={null}
        onCancel={() => {
          setIntakeOpen(false);
          resetIntake();
        }}
      >
        <Space direction="vertical" size={14} style={{ width: "100%" }}>
          <Alert
            type="info"
            showIcon
            message="Luồng chuẩn: validate request/Excel → preview row lỗi → consume → backend tự tạo Outbound DRAFT. Không tạo stock movement ở bước này."
          />
          <Space>
            <Button
              type={intakeMode === "manual" ? "primary" : "default"}
              onClick={() => {
                setIntakeMode("manual");
                setImportPreview(null);
              }}
            >
              Nhập tay
            </Button>
            <Button
              type={intakeMode === "excel" ? "primary" : "default"}
              onClick={() => {
                setIntakeMode("excel");
                setImportPreview(null);
              }}
            >
              Import Excel
            </Button>
          </Space>

          {intakeMode === "manual" ? (
            <Form<IntakeForm>
              form={intakeForm}
              layout="vertical"
              initialValues={{
                lines: [{ product_id: "", required_qty: 1 }],
              }}
            >
              <div className="grid-2">
                <Form.Item
                  name="request_no"
                  label="Mã phiếu yêu cầu xuất *"
                  rules={[{ required: true, message: "Nhập request_no" }]}
                >
                  <Input placeholder="VD: REQ-20260811-001" />
                </Form.Item>
                <Form.Item name="agency_id" label="Đại lý / nơi nhận">
                  <Select
                    allowClear
                    showSearch
                    optionFilterProp="label"
                    placeholder="Chọn đại lý nếu có"
                    onChange={handleAgencyChange}
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
                  <Input />
                </Form.Item>
                <Form.Item
                  name="recipient_address"
                  label="Địa chỉ nhận *"
                  rules={[{ required: true, message: "Nhập địa chỉ" }]}
                >
                  <Input />
                </Form.Item>
              </div>
              <Form.List name="lines">
                {(fields, { add, remove }) => (
                  <Space direction="vertical" style={{ width: "100%" }}>
                    {fields.map((field) => (
                      <Space key={field.key} align="baseline" wrap>
                        <Form.Item
                          {...field}
                          name={[field.name, "product_id"]}
                          label="SKU PRODUCT *"
                          rules={[{ required: true, message: "Chọn SKU" }]}
                        >
                          <Select
                            showSearch
                            optionFilterProp="label"
                            style={{ width: 440 }}
                            options={skuRows.map((sku) => ({
                              value: sku.sku_id,
                              label: `${sku.sku_code} · ${sku.sku_name}`,
                            }))}
                          />
                        </Form.Item>
                        <Form.Item
                          {...field}
                          name={[field.name, "required_qty"]}
                          label="Số lượng *"
                          rules={[
                            { required: true, message: "Nhập số lượng" },
                          ]}
                        >
                          <InputNumber min={1} precision={0} style={{ width: 140 }} />
                        </Form.Item>
                        <Button
                          danger
                          disabled={fields.length === 1}
                          onClick={() => remove(field.name)}
                        >
                          Xóa dòng
                        </Button>
                      </Space>
                    ))}
                    <Button
                      type="dashed"
                      onClick={() =>
                        add({ product_id: "", required_qty: 1 })
                      }
                    >
                      + Thêm dòng SKU
                    </Button>
                  </Space>
                )}
              </Form.List>
              <Button
                type="primary"
                loading={validateManualMutation.isPending}
                disabled={!canImport}
                onClick={() => validateManualMutation.mutate()}
              >
                Kiểm tra & Preview
              </Button>
              <ApiErrorAlert
                error={validateManualMutation.error}
                title="Không validate được yêu cầu xuất"
                style={{ marginTop: 12 }}
              />
            </Form>
          ) : (
            <Space direction="vertical" style={{ width: "100%" }}>
              <Input
                type="file"
                accept=".xlsx,.xls"
                onChange={(event) =>
                  setIntakeFile(event.target.files?.[0] ?? null)
                }
              />
              <Typography.Text type="secondary">
                Backend validate tối đa 10.000 dòng; row lỗi sẽ không được
                consume một phần.
              </Typography.Text>
              <Button
                type="primary"
                loading={validateFileMutation.isPending}
                disabled={!canImport || !intakeFile}
                onClick={() => validateFileMutation.mutate()}
              >
                Upload & Preview
              </Button>
              <ApiErrorAlert
                error={validateFileMutation.error}
                title="Không validate được file Excel"
              />
            </Space>
          )}

          {importPreview && (
            <Card
              size="small"
              title={`Preview · ${importPreview.importNo || importPreview.id}`}
            >
              <Space direction="vertical" style={{ width: "100%" }}>
                <Space wrap>
                  <Tag
                    color={
                      importPreview.status === "VALIDATED" ? "success" : "error"
                    }
                  >
                    {importPreview.status}
                  </Tag>
                  <Typography.Text>
                    Tổng: {importPreview.totalRows}
                  </Typography.Text>
                  <Typography.Text>
                    Hợp lệ: {importPreview.validRows}
                  </Typography.Text>
                  <Typography.Text>
                    Lỗi: {importPreview.errorRows}
                  </Typography.Text>
                </Space>
                <Table
                  rowKey="id"
                  size="small"
                  pagination={false}
                  dataSource={importPreview.rows}
                  columns={[
                    { title: "Row", dataIndex: "rowNo", key: "rowNo" },
                    {
                      title: "Request",
                      key: "request",
                      render: (
                        _: unknown,
                        row: OutboundImportResult["rows"][number],
                      ) => text(row.normalized.request_no),
                    },
                    {
                      title: "SKU",
                      key: "sku",
                      render: (
                        _: unknown,
                        row: OutboundImportResult["rows"][number],
                      ) =>
                        text(
                          row.normalized.sku_code ?? row.normalized.sku_id,
                        ),
                    },
                    {
                      title: "SL",
                      key: "qty",
                      render: (
                        _: unknown,
                        row: OutboundImportResult["rows"][number],
                      ) => text(row.normalized.required_qty),
                    },
                    {
                      title: "Kết quả",
                      key: "result",
                      render: (
                        _: unknown,
                        row: OutboundImportResult["rows"][number],
                      ) =>
                        row.errors.length === 0 ? (
                          <Tag color="success">VALID</Tag>
                        ) : (
                          <Typography.Text type="danger">
                            {importErrorText(row)}
                          </Typography.Text>
                        ),
                    },
                  ]}
                />
                <Button
                  type="primary"
                  disabled={
                    importPreview.status !== "VALIDATED" ||
                    importPreview.errorRows > 0 ||
                    !canImport
                  }
                  loading={consumeMutation.isPending}
                  onClick={() => consumeMutation.mutate()}
                >
                  Confirm & tạo Outbound DRAFT
                </Button>
                <ApiErrorAlert
                  error={consumeMutation.error}
                  title="Không consume được request"
                />
              </Space>
            </Card>
          )}
        </Space>
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
          message="Phiếu sinh từ request/Excel không được thay line nguồn. Muốn đổi SKU/số lượng: hủy phiếu và tạo request mới để giữ traceability."
          style={{ marginBottom: 14 }}
        />
        <Form<EditForm> form={editForm} layout="vertical">
          <Form.Item name="agency_id" label="Đại lý / nơi nhận">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
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
            <Input />
          </Form.Item>
          <Form.Item
            name="recipient_address"
            label="Địa chỉ nhận *"
            rules={[{ required: true, message: "Nhập địa chỉ" }]}
          >
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="doc_date" label="Ngày phiếu">
            <Input type="date" />
          </Form.Item>
          <Form.Item name="note" label="Ghi chú">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
        <ApiErrorAlert
          error={updateMutation.error}
          title="Không cập nhật được phiếu xuất"
        />
      </Modal>

      <Modal
        title="Map RFID cho Item"
        open={Boolean(rfidItemId)}
        okText="Map RFID"
        cancelText="Hủy"
        confirmLoading={rfidMutation.isPending}
        onCancel={() => {
          setRfidItemId(null);
          rfidForm.resetFields();
        }}
        onOk={() => rfidMutation.mutate()}
      >
        <Typography.Paragraph>
          Item: <Typography.Text code>{rfidItemId}</Typography.Text>
        </Typography.Paragraph>
        <Form<RfidForm> form={rfidForm} layout="vertical">
          <Form.Item
            name="code_value"
            label="RFID code *"
            rules={[{ required: true, message: "Nhập RFID code" }]}
          >
            <Input placeholder="VD: RFID-E200-000001" />
          </Form.Item>
          <Form.Item
            name="hardware_uid"
            label="Hardware UID *"
            rules={[{ required: true, message: "Nhập hardware UID" }]}
          >
            <Input placeholder="UID thật từ thiết bị RFID" />
          </Form.Item>
        </Form>
        <ApiErrorAlert
          error={rfidMutation.error}
          title="Không map được RFID"
        />
      </Modal>

      <Modal
        title="Hủy phiếu xuất"
        open={cancelOpen}
        okText="Xác nhận hủy"
        cancelText="Đóng"
        okButtonProps={{ danger: true, disabled: !cancelReason.trim() }}
        confirmLoading={cancelMutation.isPending}
        onCancel={() => setCancelOpen(false)}
        onOk={() => cancelMutation.mutate()}
      >
        <Input.TextArea
          value={cancelReason}
          rows={4}
          placeholder="Lý do hủy *"
          onChange={(event) => setCancelReason(event.target.value)}
        />
        <ApiErrorAlert
          error={cancelMutation.error}
          title="Không hủy được phiếu xuất"
          style={{ marginTop: 12 }}
        />
      </Modal>
    </div>
  );
}
