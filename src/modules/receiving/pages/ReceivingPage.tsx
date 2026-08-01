/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from "antd";
import type { InputRef } from "antd/es/input";
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExportOutlined,
  EyeOutlined,
  PlusOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { useCanAny } from "@/shared/components/permission";
import {
  getApiErrorMessage,
  getErrorRequestId,
  normalizeError,
} from "@/shared/api/api-error";
import type { InboundDocument, InboundLine, ReceiptEvidence } from "../types";
import {
  closeInboundRemainder,
  fetchInboundDocument,
  fetchInboundDocuments,
  fetchInboundLines,
  postInboundReceipt,
  scanInboundDocument,
} from "../services/receivingService";

const statusColorMap: Record<InboundDocument["status"], string> = {
  DRAFT: "default",
  SCANNING: "processing",
  PARTIALLY_POSTED: "warning",
  POSTED: "success",
  CLOSED: "default",
  CANCELLED: "error",
};

const editableStatuses: InboundDocument["status"][] = [
  "DRAFT",
  "SCANNING",
  "PARTIALLY_POSTED",
];

function makeIdempotencyKey(documentId: string) {
  return globalThis.crypto?.randomUUID?.() ?? `${documentId}-${Date.now()}`;
}

export default function ReceivingPage() {
  const [docs, setDocs] = useState<InboundDocument[]>([]);
  const [lines, setLines] = useState<InboundLine[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<InboundDocument["status"]>();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [lineLoading, setLineLoading] = useState(false);
  const [lineErrorMessage, setLineErrorMessage] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<InboundDocument | null>(null);
  const [scanCode, setScanCode] = useState("");
  const [scanLoading, setScanLoading] = useState(false);
  const [scanFeedback, setScanFeedback] = useState<{
    type: "success" | "warning" | "error";
    message: string;
  }>();
  const [posting, setPosting] = useState(false);
  const [closing, setClosing] = useState(false);
  const [closeReason, setCloseReason] = useState("");
  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [receiptEvidence, setReceiptEvidence] = useState<ReceiptEvidence>();
  const postIntentKeyRef = useRef<string | undefined>(undefined);
  const scanInputRef = useRef<InputRef>(null);
  const canPostInbound = useCanAny(["inbound.post"]);

  const loadDocuments = useCallback(() => {
    let active = true;
    setLoading(true);
    setErrorMessage("");
    fetchInboundDocuments({ search, status, per_page: 20 })
      .then((data) => {
        if (active) setDocs(data);
      })
      .catch((error: unknown) => {
        if (active) {
          setDocs([]);
          setErrorMessage(
            getApiErrorMessage(error, "Khong tai duoc danh sach phieu nhap."),
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [search, status]);

  useEffect(() => loadDocuments(), [loadDocuments]);

  const refreshSelectedDetail = useCallback(async () => {
    if (!selectedDoc) return;
    const [freshDoc, freshLines] = await Promise.all([
      fetchInboundDocument(selectedDoc.id),
      fetchInboundLines(selectedDoc.id),
    ]);
    setSelectedDoc(freshDoc);
    setLines(freshLines);
    setDocs((current) =>
      current.map((doc) => (doc.id === freshDoc.id ? freshDoc : doc)),
    );
  }, [selectedDoc]);

  const loadDocumentDetail = useCallback((doc: InboundDocument) => {
    setSelectedDoc(doc);
    setLines([]);
    setLineErrorMessage("");
    setReceiptEvidence(undefined);
    setScanFeedback(undefined);
    setLineLoading(true);
    setModalOpen(true);
    Promise.all([fetchInboundDocument(doc.id), fetchInboundLines(doc.id)])
      .then(([freshDoc, freshLines]) => {
        setSelectedDoc(freshDoc);
        setLines(freshLines);
      })
      .catch((error: unknown) => {
        setLineErrorMessage(
          getApiErrorMessage(error, "Khong tai duoc dong phieu nhap."),
        );
      })
      .finally(() => {
        setLineLoading(false);
        window.setTimeout(() => scanInputRef.current?.focus(), 0);
      });
  }, []);

  const postableLines = useMemo(
    () =>
      lines
        .map((line) => ({
          lineId: line.id,
          quantity: Math.min(
            Math.max(line.scanned - line.posted, 0),
            line.remaining,
          ),
        }))
        .filter((line) => line.quantity > 0),
    [lines],
  );

  const postSummary = useMemo(
    () => ({
      lineCount: postableLines.length,
      quantity: postableLines.reduce((sum, line) => sum + line.quantity, 0),
    }),
    [postableLines],
  );

  const canPostSelected =
    Boolean(selectedDoc) &&
    canPostInbound &&
    !lineLoading &&
    !posting &&
    postableLines.length > 0 &&
    editableStatuses.includes(selectedDoc?.status ?? "CANCELLED") &&
    Number.isFinite(selectedDoc?.version);

  const handleScan = async () => {
    if (!selectedDoc || scanLoading) return;
    const code = scanCode.trim();
    if (!code) return;
    setScanLoading(true);
    setScanFeedback(undefined);
    try {
      const results = await scanInboundDocument(selectedDoc.id, [code]);
      const result = results[0];
      if (!result || result.status === "VALID") {
        setScanFeedback({ type: "success", message: `Ma ${code} hop le.` });
      } else {
        setScanFeedback({
          type: result.status === "DUPLICATE" ? "warning" : "error",
          message: result.message ?? `${code}: ${result.status}`,
        });
      }
      setScanCode("");
      await refreshSelectedDetail();
    } catch (error) {
      const normalized = normalizeError(error);
      const requestId = getErrorRequestId(error);
      setScanFeedback({
        type: "error",
        message: `${normalized.message}${requestId ? ` - Request ${requestId}` : ""}`,
      });
    } finally {
      setScanLoading(false);
      window.setTimeout(() => scanInputRef.current?.focus(), 0);
    }
  };

  const handlePostReceipt = () => {
    if (!selectedDoc || !canPostSelected) return;
    const idempotencyKey =
      postIntentKeyRef.current ?? makeIdempotencyKey(selectedDoc.id);
    postIntentKeyRef.current = idempotencyKey;
    Modal.confirm({
      title: "Xac nhan ghi nhan nhap kho",
      content: (
        <Space direction="vertical" size={4}>
          <Typography.Text>
            Phieu {selectedDoc.code}: {postSummary.lineCount} dong, tong{" "}
            {postSummary.quantity} don vi se sinh receipt/movement tren backend.
          </Typography.Text>
          <Typography.Text type="secondary">
            Retry cung intent giu nguyen Idempotency-Key; FE khong tu cap nhat
            ton cuc bo.
          </Typography.Text>
          <Typography.Text code>{idempotencyKey}</Typography.Text>
        </Space>
      ),
      okText: "Ghi nhan",
      cancelText: "Huy",
      onOk: async () => {
        setPosting(true);
        setLineErrorMessage("");
        try {
          const result = await postInboundReceipt({
            documentId: selectedDoc.id,
            lines: postableLines,
            idempotencyKey,
            ifMatch: selectedDoc.version,
          });
          setReceiptEvidence(result);
          postIntentKeyRef.current = undefined;
          message.success("Da ghi nhan nhap kho.");
          await refreshSelectedDetail();
          loadDocuments();
        } catch (error) {
          const normalized = normalizeError(error);
          const requestId = getErrorRequestId(error);
          setLineErrorMessage(
            `${normalized.message}${requestId ? ` - Request ${requestId}` : ""}`,
          );
          throw error;
        } finally {
          setPosting(false);
        }
      },
    });
  };

  const handleCloseRemainder = async () => {
    if (!selectedDoc || !closeReason.trim()) return;
    setClosing(true);
    setLineErrorMessage("");
    try {
      await closeInboundRemainder({
        documentId: selectedDoc.id,
        reason: closeReason.trim(),
      });
      setCloseModalOpen(false);
      setCloseReason("");
      message.success("Da dong phan con lai.");
      await refreshSelectedDetail();
      loadDocuments();
    } catch (error) {
      setLineErrorMessage(
        getApiErrorMessage(error, "Khong dong duoc phan con lai."),
      );
    } finally {
      setClosing(false);
    }
  };

  const columns = [
    { title: "Ma phieu", dataIndex: "code", key: "code" },
    { title: "Nguon hang", dataIndex: "source", key: "source" },
    { title: "Ngay", dataIndex: "date", key: "date" },
    {
      title: "Du kien",
      dataIndex: "expected",
      key: "expected",
      align: "right" as const,
    },
    {
      title: "Da ghi nhan",
      dataIndex: "posted",
      key: "posted",
      align: "right" as const,
    },
    {
      title: "Con lai",
      key: "remaining",
      align: "right" as const,
      render: (_: unknown, r: InboundDocument) => (
        <strong>{r.remaining}</strong>
      ),
    },
    {
      title: "Trang thai",
      dataIndex: "status",
      key: "status",
      render: (value: InboundDocument["status"]) => (
        <Tag color={statusColorMap[value]}>{value}</Tag>
      ),
    },
    { title: "Nguoi tao", dataIndex: "createdBy", key: "createdBy" },
    {
      title: "Hanh dong",
      key: "action",
      render: (_: unknown, record: InboundDocument) => (
        <Space>
          <Tooltip title="Mo chi tiet">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => loadDocumentDetail(record)}
            />
          </Tooltip>
          <Tooltip title="Ghi nhan tiep">
            <Button
              type="text"
              icon={<CheckCircleOutlined />}
              disabled={
                !canPostInbound || !editableStatuses.includes(record.status)
              }
              onClick={() => loadDocumentDetail(record)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const lineColumns = [
    { title: "SKU", dataIndex: "sku", key: "sku" },
    { title: "Ten SKU", dataIndex: "skuName", key: "skuName" },
    { title: "Doi tuong quet", dataIndex: "scanTarget", key: "scanTarget" },
    {
      title: "Du kien",
      dataIndex: "expected",
      key: "expected",
      align: "right" as const,
    },
    {
      title: "Da quet",
      dataIndex: "scanned",
      key: "scanned",
      align: "right" as const,
    },
    {
      title: "Da ghi nhan",
      dataIndex: "posted",
      key: "posted",
      align: "right" as const,
    },
    {
      title: "Con lai",
      dataIndex: "remaining",
      key: "remaining",
      align: "right" as const,
      render: (value: number) => <strong>{value}</strong>,
    },
    {
      title: "Kiem tra",
      dataIndex: "validation",
      key: "validation",
      render: (value: string) => (
        <Tag
          color={
            value === "VALID"
              ? "success"
              : value === "UNKNOWN"
                ? "error"
                : "warning"
          }
        >
          {value}
        </Tag>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card
        title="Phieu nhap kho"
        extra={
          <Space wrap>
            <Input
              prefix={<SearchOutlined />}
              placeholder="Ma phieu/nguon/SKU..."
              style={{ width: 250 }}
              allowClear
              onPressEnter={(event) => setSearch(event.currentTarget.value)}
              onChange={(event) => {
                if (!event.target.value) setSearch("");
              }}
            />
            <Select
              value={status}
              style={{ width: 180 }}
              allowClear
              placeholder="Trang thai"
              onChange={setStatus}
              options={[
                { value: "DRAFT", label: "DRAFT" },
                { value: "SCANNING", label: "SCANNING" },
                { value: "PARTIALLY_POSTED", label: "PARTIALLY_POSTED" },
                { value: "POSTED", label: "POSTED" },
                { value: "CLOSED", label: "CLOSED" },
                { value: "CANCELLED", label: "CANCELLED" },
              ]}
            />
            <Button icon={<ExportOutlined />}>Xuat file</Button>
            <Button type="primary" icon={<PlusOutlined />} disabled>
              Tao phieu nhap
            </Button>
          </Space>
        }
      >
        {errorMessage && (
          <Alert
            type="error"
            message={errorMessage}
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}
        <Table
          dataSource={docs}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={false}
          size="small"
          scroll={{ x: 900 }}
        />
      </Card>

      <Modal
        title={selectedDoc?.code}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        width={960}
        footer={[
          <Button key="back" onClick={() => setModalOpen(false)}>
            Quay lai
          </Button>,
          <Button
            key="post"
            type="primary"
            loading={posting}
            disabled={!canPostSelected}
            onClick={handlePostReceipt}
          >
            Ghi nhan mot phan phieu nhap
          </Button>,
          <Button
            key="close"
            danger
            icon={<CloseCircleOutlined />}
            disabled={
              !canPostInbound ||
              posting ||
              selectedDoc?.status !== "PARTIALLY_POSTED"
            }
            onClick={() => setCloseModalOpen(true)}
          >
            Dong phan con lai
          </Button>,
        ]}
      >
        {selectedDoc && (
          <>
            {lineErrorMessage && (
              <Alert
                type="error"
                message={lineErrorMessage}
                showIcon
                style={{ marginBottom: 16 }}
              />
            )}
            <Form layout="inline" style={{ marginBottom: 16 }}>
              <Form.Item label="Nguon hang">
                <strong>{selectedDoc.source}</strong>
              </Form.Item>
              <Form.Item label="Ngay">
                <strong>{selectedDoc.date}</strong>
              </Form.Item>
              <Form.Item label="Trang thai">
                <Tag color={statusColorMap[selectedDoc.status]}>
                  {selectedDoc.status}
                </Tag>
              </Form.Item>
              <Form.Item label="Phien ban">
                <Typography.Text code>v{selectedDoc.version}</Typography.Text>
              </Form.Item>
            </Form>

            <Space.Compact style={{ width: "100%", marginBottom: 12 }}>
              <Input
                ref={scanInputRef}
                value={scanCode}
                placeholder="Quet hoac nhap ma roi Enter"
                disabled={
                  !canPostInbound ||
                  scanLoading ||
                  !editableStatuses.includes(selectedDoc.status)
                }
                onChange={(event) => setScanCode(event.target.value)}
                onPressEnter={handleScan}
              />
              <Button
                type="primary"
                loading={scanLoading}
                disabled={!scanCode.trim() || scanLoading || !canPostInbound}
                onClick={handleScan}
              >
                Quet
              </Button>
            </Space.Compact>
            {scanFeedback && (
              <Alert
                type={scanFeedback.type}
                message={scanFeedback.message}
                showIcon
                style={{ marginBottom: 12 }}
              />
            )}

            {receiptEvidence && (
              <Card size="small" style={{ marginBottom: 12 }}>
                <Space wrap>
                  <Statistic
                    title="Receipt"
                    value={receiptEvidence.receiptId ?? "-"}
                  />
                  <Statistic
                    title="Movement"
                    value={receiptEvidence.movementRef ?? "-"}
                  />
                  <Statistic
                    title="Request"
                    value={receiptEvidence.requestId ?? "-"}
                  />
                  {receiptEvidence.traceSource && (
                    <Typography.Text code>
                      {receiptEvidence.traceSource}
                    </Typography.Text>
                  )}
                  {receiptEvidence.replayed && (
                    <Tag color="warning">IDEMPOTENCY_REPLAY</Tag>
                  )}
                </Space>
              </Card>
            )}

            <Table
              dataSource={lines}
              columns={lineColumns}
              rowKey="id"
              loading={lineLoading}
              pagination={false}
              size="small"
              scroll={{ x: 900 }}
            />
          </>
        )}
      </Modal>

      <Modal
        title="Dong phan con lai"
        open={closeModalOpen}
        okText="Dong phan con lai"
        cancelText="Huy"
        okButtonProps={{
          danger: true,
          disabled: !closeReason.trim(),
          loading: closing,
        }}
        onOk={handleCloseRemainder}
        onCancel={() => setCloseModalOpen(false)}
      >
        <Alert
          type="warning"
          showIcon
          message="Thao tac nay khong sinh movement ton kho; chi khoa phan con lai cua phieu."
          style={{ marginBottom: 12 }}
        />
        <Input.TextArea
          value={closeReason}
          rows={3}
          placeholder="Nhap ly do bat buoc"
          maxLength={500}
          showCount
          onChange={(event) => setCloseReason(event.target.value)}
        />
      </Modal>
    </div>
  );
}
