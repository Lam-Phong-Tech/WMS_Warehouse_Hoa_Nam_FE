/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useMemo, useState } from "react";
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
  Tooltip,
  Typography,
  message,
} from "antd";
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExportOutlined,
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import { useHasPermission } from "@/shared/components/permission";
import type {
  OutboundDocument,
  OutboundLine,
  OutboundScanResult,
} from "../types";
import {
  closeOutboundRemainder,
  createOutboundDocument,
  fetchOutboundDocument,
  fetchOutboundDocuments,
  fetchOutboundLines,
  postOutboundIssue,
  scanOutboundDocument,
} from "../services/shippingService";

const statusColorMap: Record<OutboundDocument["status"], string> = {
  DRAFT: "default",
  SCANNING: "processing",
  PARTIALLY_POSTED: "warning",
  POSTED: "success",
  CLOSED: "default",
  CANCELLED: "error",
};

const statusOptions = [
  { value: "DRAFT", label: "Nhap" },
  { value: "SCANNING", label: "Dang quet" },
  { value: "PARTIALLY_POSTED", label: "Da xuat mot phan" },
  { value: "POSTED", label: "Da xuat het" },
  { value: "CLOSED", label: "Da dong" },
  { value: "CANCELLED", label: "Da huy" },
];

const mutableStatuses: OutboundDocument["status"][] = [
  "DRAFT",
  "SCANNING",
  "PARTIALLY_POSTED",
];

function makeIdempotencyKey(prefix: string, documentId: string): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${documentId}-${random}`;
}

function getRemaining(line: OutboundLine): number {
  return Math.max(0, line.planned - line.issued);
}

function applyScanResults(
  currentLines: OutboundLine[],
  results: OutboundScanResult[],
): OutboundLine[] {
  if (results.length === 0) return currentLines;

  const next = currentLines.map((line) => ({ ...line }));
  for (const result of results) {
    const target = next.find(
      (line) =>
        line.id === result.line_id ||
        (!!result.sku && line.sku.toLowerCase() === result.sku.toLowerCase()),
    );
    if (!target) continue;

    target.validation =
      result.status === "VALID"
        ? "VALID"
        : result.status === "UNKNOWN"
          ? "UNKNOWN"
          : "INVALID";
    target.validationMessage = result.message;

    if (result.status === "VALID") {
      target.selected = true;
      target.subsetNew = Math.min(
        getRemaining(target),
        Math.max(1, target.subsetNew || 0) + 1,
      );
    }
  }
  return next;
}

export default function ShippingPage() {
  const can = useHasPermission();
  const [docs, setDocs] = useState<OutboundDocument[]>([]);
  const [lines, setLines] = useState<OutboundLine[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<OutboundDocument["status"]>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [lineLoading, setLineLoading] = useState(false);
  const [lineError, setLineError] = useState<unknown>(null);
  const [actionError, setActionError] = useState<unknown>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<OutboundDocument | null>(null);
  const [scanCodes, setScanCodes] = useState("");
  const [scanResults, setScanResults] = useState<OutboundScanResult[]>([]);
  const [scanning, setScanning] = useState(false);
  const [posting, setPosting] = useState(false);
  const [closing, setClosing] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [closeReason, setCloseReason] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<unknown>(null);
  const [createForm] = Form.useForm();

  const canCreate = can("outbound.create");
  const canPost = can("outbound.post");
  const canCloseRemainder = can("outbound.close_remainder");

  const loadDocuments = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchOutboundDocuments({ search, status, per_page: 20 })
      .then(setDocs)
      .catch((err: unknown) => {
        setDocs([]);
        setError(err);
      })
      .finally(() => setLoading(false));
  }, [search, status]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const loadDetail = async (doc: OutboundDocument) => {
    setSelectedDoc(doc);
    setLines([]);
    setScanResults([]);
    setScanCodes("");
    setLineError(null);
    setActionError(null);
    setLineLoading(true);
    setModalOpen(true);
    try {
      const [freshDoc, freshLines] = await Promise.all([
        fetchOutboundDocument(doc.id).catch(() => doc),
        fetchOutboundLines(doc.id),
      ]);
      setSelectedDoc(freshDoc);
      setLines(freshLines.map((line) => ({ ...line, subsetNew: 0 })));
    } catch (err: unknown) {
      setLineError(err);
    } finally {
      setLineLoading(false);
    }
  };

  const refreshSelectedDocument = async () => {
    if (!selectedDoc) return;
    const [freshDoc, freshLines] = await Promise.all([
      fetchOutboundDocument(selectedDoc.id).catch(() => selectedDoc),
      fetchOutboundLines(selectedDoc.id),
    ]);
    setSelectedDoc(freshDoc);
    setLines(freshLines.map((line) => ({ ...line, subsetNew: 0 })));
    loadDocuments();
  };

  const selectedLines = useMemo(
    () =>
      lines.filter(
        (line) =>
          line.selected &&
          line.validation === "VALID" &&
          line.subsetNew > 0 &&
          line.subsetNew <= getRemaining(line),
      ),
    [lines],
  );

  const selectedQty = selectedLines.reduce(
    (sum, line) => sum + line.subsetNew,
    0,
  );
  const canMutateDoc =
    !!selectedDoc &&
    mutableStatuses.includes(selectedDoc.status) &&
    selectedDoc.remaining > 0;
  const postDisabled =
    !selectedDoc ||
    !canPost ||
    !canMutateDoc ||
    selectedLines.length === 0 ||
    posting ||
    closing;
  const closeDisabled =
    !selectedDoc || !canCloseRemainder || !canMutateDoc || posting || closing;

  const handleScan = async () => {
    if (!selectedDoc) return;
    const codes = scanCodes
      .split(/[\n,;\s]+/)
      .map((code) => code.trim())
      .filter(Boolean);
    if (codes.length === 0) {
      message.warning("Nhap hoac quet it nhat mot ma hang.");
      return;
    }
    setScanning(true);
    setActionError(null);
    try {
      const results = await scanOutboundDocument(selectedDoc.id, codes);
      setScanResults(results);
      setLines((current) => applyScanResults(current, results));
      setScanCodes("");
      message.success("Da kiem tra ma quet.");
    } catch (err: unknown) {
      setActionError(err);
    } finally {
      setScanning(false);
    }
  };

  const handlePostIssue = () => {
    if (!selectedDoc || postDisabled) return;
    const idempotencyKey = makeIdempotencyKey("outbound-post", selectedDoc.id);
    Modal.confirm({
      title: "Ghi nhan xuat kho",
      okText: "Ghi nhan",
      cancelText: "Kiem tra lai",
      content: (
        <Space direction="vertical" size={8}>
          <Typography.Text>
            Phieu <strong>{selectedDoc.code}</strong> se ghi nhan{" "}
            {selectedLines.length} dong, tong so luong{" "}
            <strong>{selectedQty}</strong>.
          </Typography.Text>
          <Alert
            type="warning"
            showIcon
            message="Sau khi post, Available cua kho giam. FE khong tao ton dai ly va khong tu tru ton local."
          />
          <Typography.Text code>{idempotencyKey}</Typography.Text>
        </Space>
      ),
      onOk: async () => {
        setPosting(true);
        setActionError(null);
        try {
          await postOutboundIssue({
            documentId: selectedDoc.id,
            lines: selectedLines.map((line) => ({
              lineId: line.id,
              quantity: line.subsetNew,
            })),
            idempotencyKey,
            ifMatch: selectedDoc.version,
          });
          message.success("Da ghi nhan xuat kho.");
          await refreshSelectedDocument();
        } catch (err: unknown) {
          setActionError(err);
          throw err;
        } finally {
          setPosting(false);
        }
      },
    });
  };

  const handleCloseRemainder = async () => {
    if (!selectedDoc || closeDisabled) return;
    if (!closeReason.trim()) {
      message.warning("Nhap ly do dong phan con lai.");
      return;
    }
    setClosing(true);
    setActionError(null);
    try {
      await closeOutboundRemainder({
        documentId: selectedDoc.id,
        reason: closeReason.trim(),
        idempotencyKey: makeIdempotencyKey("outbound-close", selectedDoc.id),
        ifMatch: selectedDoc.version,
      });
      message.success("Da dong phan con lai.");
      setCloseOpen(false);
      setCloseReason("");
      await refreshSelectedDocument();
    } catch (err: unknown) {
      setActionError(err);
    } finally {
      setClosing(false);
    }
  };

  const handleCreateDocument = async () => {
    try {
      const values = await createForm.validateFields();
      setCreating(true);
      setCreateError(null);
      const created = await createOutboundDocument({
        receiver_type: values.receiver_type,
        receiver_id: values.receiver_id,
        receiver_name: values.receiver_name,
        warehouse_id: values.warehouse_id,
        doc_date: values.doc_date,
        note: values.note,
        lines: values.lines.map(
          (line: { sku: string; quantity: number; note?: string }) => ({
            sku: line.sku,
            quantity: Number(line.quantity),
            note: line.note,
          }),
        ),
      });
      message.success(`Da tao phieu xuat ${created.code || ""}`.trim());
      setCreateOpen(false);
      createForm.resetFields();
      loadDocuments();
      void loadDetail(created);
    } catch (err: unknown) {
      if (err && typeof err === "object" && "errorFields" in err) return;
      setCreateError(err);
    } finally {
      setCreating(false);
    }
  };

  const columns = [
    { title: "Ma phieu", dataIndex: "code", key: "code" },
    { title: "Noi nhan", dataIndex: "receiverName", key: "receiverName" },
    { title: "Ngay", dataIndex: "date", key: "date" },
    {
      title: "Du kien",
      dataIndex: "planned",
      key: "planned",
      align: "right" as const,
    },
    {
      title: "Da xuat",
      dataIndex: "issued",
      key: "issued",
      align: "right" as const,
    },
    {
      title: "Con lai",
      key: "remaining",
      align: "right" as const,
      render: (_: unknown, record: OutboundDocument) => (
        <strong>{record.remaining}</strong>
      ),
    },
    {
      title: "Trang thai",
      dataIndex: "status",
      key: "status",
      render: (value: OutboundDocument["status"]) => (
        <Tag color={statusColorMap[value]}>{value}</Tag>
      ),
    },
    { title: "Nguoi tao", dataIndex: "createdBy", key: "createdBy" },
    {
      title: "Hanh dong",
      key: "action",
      render: (_: unknown, record: OutboundDocument) => (
        <Space>
          <Tooltip title="Mo chi tiet">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => void loadDetail(record)}
            />
          </Tooltip>
          <Tooltip
            title={canPost ? "Quet va ghi nhan" : "Thieu quyen outbound.post"}
          >
            <Button
              type="text"
              icon={<CheckCircleOutlined />}
              disabled={!canPost || !mutableStatuses.includes(record.status)}
              onClick={() => void loadDetail(record)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const lineColumns = [
    {
      title: "",
      key: "selected",
      width: 48,
      render: (_: unknown, line: OutboundLine) => (
        <Input
          type="checkbox"
          checked={line.selected}
          disabled={!canMutateDoc || getRemaining(line) <= 0}
          onChange={(event) =>
            setLines((current) =>
              current.map((item) =>
                item.id === line.id
                  ? { ...item, selected: event.target.checked }
                  : item,
              ),
            )
          }
        />
      ),
    },
    { title: "SKU", dataIndex: "sku", key: "sku" },
    { title: "Ten hang", dataIndex: "skuName", key: "skuName" },
    { title: "Nguon quet", dataIndex: "scanSource", key: "scanSource" },
    {
      title: "Kha dung",
      dataIndex: "available",
      key: "available",
      align: "right" as const,
    },
    {
      title: "Du kien",
      dataIndex: "planned",
      key: "planned",
      align: "right" as const,
    },
    {
      title: "Da xuat",
      dataIndex: "issued",
      key: "issued",
      align: "right" as const,
    },
    {
      title: "So luong post",
      key: "subsetNew",
      align: "right" as const,
      render: (_: unknown, line: OutboundLine) => (
        <InputNumber
          min={0}
          max={getRemaining(line)}
          value={line.subsetNew}
          disabled={!canMutateDoc || getRemaining(line) <= 0}
          onChange={(value) =>
            setLines((current) =>
              current.map((item) =>
                item.id === line.id
                  ? {
                      ...item,
                      selected: Number(value ?? 0) > 0,
                      subsetNew: Math.min(
                        getRemaining(item),
                        Number(value ?? 0),
                      ),
                    }
                  : item,
              ),
            )
          }
        />
      ),
    },
    {
      title: "Kiem tra",
      dataIndex: "validation",
      key: "validation",
      render: (value: OutboundLine["validation"], line: OutboundLine) => (
        <Tooltip title={line.validationMessage}>
          <Tag
            color={
              value === "VALID"
                ? "success"
                : value === "UNKNOWN"
                  ? "warning"
                  : "error"
            }
          >
            {value}
          </Tag>
        </Tooltip>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card
        title="Phieu xuat kho"
        extra={
          <Space wrap>
            <Input.Search
              prefix={<SearchOutlined />}
              placeholder="Ma phieu/noi nhan/SKU..."
              style={{ width: 260 }}
              allowClear
              enterButton
              onSearch={setSearch}
            />
            <Select
              value={status}
              style={{ width: 180 }}
              allowClear
              placeholder="Trang thai"
              onChange={setStatus}
              options={statusOptions}
            />
            <Button icon={<ReloadOutlined />} onClick={loadDocuments}>
              Tai lai
            </Button>
            <Button icon={<ExportOutlined />}>Xuat file</Button>
            <Tooltip title={canCreate ? "" : "Thieu quyen outbound.create"}>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                disabled={!canCreate}
                onClick={() => setCreateOpen(true)}
              >
                Tao phieu xuat
              </Button>
            </Tooltip>
          </Space>
        }
      >
        <ApiErrorAlert
          error={error}
          title="Khong tai duoc danh sach phieu xuat"
          onRetry={loadDocuments}
          style={{ marginBottom: 16 }}
        />
        {!loading && !error && docs.length === 0 && (
          <Alert
            type="info"
            showIcon
            message="Khong co phieu xuat theo bo loc hien tai."
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
          scroll={{ x: 980 }}
        />
      </Card>

      <Modal
        title={
          selectedDoc ? `Phieu xuat ${selectedDoc.code}` : "Chi tiet phieu xuat"
        }
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        width={1040}
        footer={[
          <Button key="back" onClick={() => setModalOpen(false)}>
            Quay lai
          </Button>,
          <Tooltip
            key="post-tip"
            title={!canPost ? "Thieu quyen outbound.post" : undefined}
          >
            <Button
              key="post"
              type="primary"
              icon={<CheckCircleOutlined />}
              disabled={postDisabled}
              loading={posting}
              onClick={handlePostIssue}
            >
              Ghi nhan xuat kho
            </Button>
          </Tooltip>,
          <Tooltip
            key="close-tip"
            title={
              !canCloseRemainder
                ? "Thieu quyen outbound.close_remainder"
                : undefined
            }
          >
            <Button
              key="close"
              danger
              icon={<CloseCircleOutlined />}
              disabled={closeDisabled}
              loading={closing}
              onClick={() => setCloseOpen(true)}
            >
              Dong phan con lai
            </Button>
          </Tooltip>,
        ]}
      >
        {selectedDoc && (
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <ApiErrorAlert
              error={lineError}
              title="Khong tai duoc dong phieu xuat"
            />
            <ApiErrorAlert
              error={actionError}
              title="Thao tac xuat kho khong thanh cong"
            />

            <Form layout="inline">
              <Form.Item label="Noi nhan">
                <strong>{selectedDoc.receiverName}</strong>
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
              <Form.Item label="Con lai">
                <strong>{selectedDoc.remaining}</strong>
              </Form.Item>
            </Form>

            <Alert
              message="Sau khi ghi nhan chi giam Available cua kho tong. Khong sinh so du hay movement tang cho dai ly."
              type="warning"
              showIcon
            />

            <Card size="small" title="Quet va validate subset">
              <Space direction="vertical" style={{ width: "100%" }}>
                <Space.Compact style={{ width: "100%" }}>
                  <Input.TextArea
                    value={scanCodes}
                    autoSize={{ minRows: 1, maxRows: 3 }}
                    disabled={!canMutateDoc || scanning}
                    placeholder="Nhap/quet ma hang, SKU hoac line code. Co the cach nhau bang xuong dong, dau phay hoac khoang trang."
                    onChange={(event) => setScanCodes(event.target.value)}
                    onPressEnter={(event) => {
                      if (!event.shiftKey) {
                        event.preventDefault();
                        void handleScan();
                      }
                    }}
                  />
                  <Button
                    type="primary"
                    loading={scanning}
                    disabled={!canMutateDoc}
                    onClick={() => void handleScan()}
                  >
                    Kiem tra
                  </Button>
                </Space.Compact>
                {scanResults.length > 0 && (
                  <Space wrap>
                    {scanResults.map((result, index) => (
                      <Tag
                        key={`${result.code_value}-${index}`}
                        color={result.status === "VALID" ? "success" : "error"}
                      >
                        {result.code_value}: {result.status}
                      </Tag>
                    ))}
                  </Space>
                )}
              </Space>
            </Card>

            <Table
              dataSource={lines}
              columns={lineColumns}
              rowKey="id"
              loading={lineLoading}
              pagination={false}
              size="small"
              scroll={{ x: 980 }}
              summary={() => (
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={7}>
                    Da chon {selectedLines.length} dong hop le
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={7} align="right">
                    <strong>{selectedQty}</strong>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={8} />
                </Table.Summary.Row>
              )}
            />
          </Space>
        )}
      </Modal>

      <Modal
        title="Tao phieu xuat kho"
        open={createOpen}
        okText="Tao phieu"
        cancelText="Huy"
        confirmLoading={creating}
        onCancel={() => {
          setCreateOpen(false);
          setCreateError(null);
        }}
        onOk={() => void handleCreateDocument()}
        width={860}
      >
        <ApiErrorAlert
          error={createError}
          title="Khong tao duoc phieu xuat"
          style={{ marginBottom: 16 }}
        />
        <Form
          form={createForm}
          layout="vertical"
          initialValues={{
            receiver_type: "AGENCY",
            lines: [{ sku: "", quantity: 1 }],
          }}
        >
          <Space style={{ width: "100%" }} size={12} align="start" wrap>
            <Form.Item
              name="receiver_type"
              label="Loai noi nhan"
              rules={[{ required: true, message: "Chon loai noi nhan" }]}
            >
              <Select
                style={{ width: 180 }}
                options={[
                  { value: "AGENCY", label: "Dai ly" },
                  { value: "OTHER", label: "Khac" },
                ]}
              />
            </Form.Item>
            <Form.Item
              name="receiver_id"
              label="Ma noi nhan"
              rules={[{ required: true, message: "Nhap ma noi nhan" }]}
            >
              <Input style={{ width: 180 }} />
            </Form.Item>
            <Form.Item
              name="receiver_name"
              label="Ten noi nhan"
              rules={[{ required: true, message: "Nhap ten noi nhan" }]}
            >
              <Input style={{ width: 240 }} />
            </Form.Item>
            <Form.Item
              name="warehouse_id"
              label="Kho xuat"
              rules={[{ required: true, message: "Nhap kho xuat" }]}
            >
              <Input style={{ width: 160 }} />
            </Form.Item>
            <Form.Item
              name="doc_date"
              label="Ngay phieu"
              rules={[{ required: true, message: "Nhap ngay phieu" }]}
            >
              <Input type="date" style={{ width: 180 }} />
            </Form.Item>
          </Space>

          <Form.List name="lines">
            {(fields, { add, remove }) => (
              <Space direction="vertical" style={{ width: "100%" }}>
                {fields.map((field) => (
                  <Space key={field.key} align="baseline" wrap>
                    <Form.Item
                      {...field}
                      name={[field.name, "sku"]}
                      label="SKU"
                      rules={[{ required: true, message: "Nhap SKU" }]}
                    >
                      <Input style={{ width: 220 }} />
                    </Form.Item>
                    <Form.Item
                      {...field}
                      name={[field.name, "quantity"]}
                      label="So luong"
                      rules={[
                        { required: true, message: "Nhap so luong" },
                        {
                          type: "number",
                          min: 1,
                          message: "So luong phai lon hon 0",
                        },
                      ]}
                    >
                      <InputNumber min={1} style={{ width: 140 }} />
                    </Form.Item>
                    <Form.Item
                      {...field}
                      name={[field.name, "note"]}
                      label="Ghi chu dong"
                    >
                      <Input style={{ width: 220 }} />
                    </Form.Item>
                    <Button
                      danger
                      disabled={fields.length === 1}
                      onClick={() => remove(field.name)}
                    >
                      Xoa dong
                    </Button>
                  </Space>
                ))}
                <Button
                  type="dashed"
                  onClick={() => add({ sku: "", quantity: 1 })}
                >
                  Them dong hang
                </Button>
              </Space>
            )}
          </Form.List>

          <Form.Item name="note" label="Ghi chu">
            <Input.TextArea rows={3} maxLength={500} showCount />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Dong phan con lai"
        open={closeOpen}
        okText="Xac nhan dong"
        cancelText="Quay lai"
        confirmLoading={closing}
        okButtonProps={{ danger: true, disabled: !closeReason.trim() }}
        onCancel={() => setCloseOpen(false)}
        onOk={() => void handleCloseRemainder()}
      >
        <Space direction="vertical" style={{ width: "100%" }}>
          <Alert
            type="warning"
            showIcon
            message={`Thao tac nay chi dong phan con lai${
              selectedDoc ? ` (${selectedDoc.remaining})` : ""
            }, khong lam thay doi ton kho.`}
          />
          <Input.TextArea
            value={closeReason}
            rows={4}
            maxLength={500}
            showCount
            placeholder="Nhap ly do dong phan con lai"
            onChange={(event) => setCloseReason(event.target.value)}
          />
        </Space>
      </Modal>
    </div>
  );
}
