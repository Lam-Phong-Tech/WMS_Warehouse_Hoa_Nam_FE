import { useState, type ReactNode } from "react";
import { Table, Tag, Typography as AntTypography } from "antd";
import { toast } from "sonner";
import type { TableProps } from "antd";
import dayjs from "dayjs";
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
  MenuItem,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  ThemeProvider,
  Typography,
} from "@mui/material";
import { muiTheme } from "@/app/mui-theme";
import {
  CloseOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  PaperClipOutlined,
  SyncOutlined,
  ToolOutlined,
  UploadOutlined,
} from "@/shared/components/icons";
import {
  extractFieldErrorsRaw,
  getApiErrorMessage,
  getErrorRequestId,
} from "@/shared/api/api-error";
import { ACTION_ICON_COLORS } from "@/shared/theme/actionIconColors";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import { useCanAny } from "@/shared/components/permission";
import { useMvpDefects } from "@/modules/master-data/hooks/use-mvp-master";
import { formatDate } from "@/shared/utils/format-date";
import {
  WARRANTY_ATTACHMENT_TYPE_LABELS,
  WARRANTY_BASELINE_STATUSES,
  WARRANTY_DIAGNOSIS_REQUIRED_TARGETS,
  WARRANTY_NEXT_STATUS,
  WARRANTY_NOTE_REQUIRED_LABELS,
  warrantyPiiText,
  WARRANTY_STATUS_COLORS,
  WARRANTY_STATUS_LABELS,
  WARRANTY_TERMINAL_STATUSES,
  formatWarrantyDateTime,
} from "@/modules/warranty/constants";
import {
  useComponentIssues,
  useDeleteWarrantyAttachment,
  useUpdateWarrantyCase,
  useUploadWarrantyAttachment,
  useWarrantyAttachments,
  useWarrantyCase,
  useWarrantyEvents,
} from "@/modules/warranty/hooks/use-warranty";
import { downloadWarrantyAttachment } from "@/modules/warranty/services/warrantyService";
import type { ComponentIssueDocument } from "@/modules/warranty/services/componentIssueService";
import type {
  WarrantyAttachment,
  WarrantyAttachmentType,
  WarrantyCaseStatus,
} from "@/modules/warranty/types";

const RETURN_ATTACHMENT_TYPES = Object.entries(
  WARRANTY_ATTACHMENT_TYPE_LABELS,
) as Array<[WarrantyAttachmentType, string]>;

function errorText(error: unknown, fallback: string): string {
  const requestId = getErrorRequestId(error);
  return `${getApiErrorMessage(error, fallback)}${
    requestId ? ` — Request ${requestId}` : ""
  }`;
}

/** Annex D SCR-WAR-01 field `images`: jpg/png/webp. */
const WARRANTY_IMAGE_MIMES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];

function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function DetailField({
  label,
  value,
  span2,
}: {
  label: string;
  value: ReactNode;
  span2?: boolean;
}) {
  return (
    <Grid size={{ xs: 12, md: span2 ? 12 : 6 }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
        {label}
      </Typography>
      <Typography variant="body2" component="div">
        {value}
      </Typography>
    </Grid>
  );
}

interface CorrectionFormValues {
  defect_ids: string[];
  estimated_completion_date: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  purchase_date: string;
  reason: string;
}

interface StatusFormValues {
  status: WarrantyCaseStatus | "";
  reason: string;
  confirmed_defect: string;
  cancel_reason: string;
}

interface WarrantyDetailModalProps {
  caseId: string;
  onClose: () => void;
  onOpenComponentIssue: (input: {
    caseId: string;
    caseCode?: string;
    caseActive: boolean;
    documentId?: string | null;
  }) => void;
}

/**
 * WAR-03 · Chi tiết bảo hành dạng modal (mở từ danh sách WAR-01, không chuyển trang).
 * Gồm: thông tin case (PII mask theo quyền), chẩn đoán, cập nhật trạng thái theo
 * state machine, tệp đính kèm và các phiếu xuất linh kiện gắn với case.
 */
export function WarrantyDetailModal({
  caseId,
  onClose,
  onOpenComponentIssue,
}: WarrantyDetailModalProps) {
  const canManage = useCanAny(["warranty.manage"]);
  const canIssue = useCanAny(["warranty.component_issue"]);
  const canViewPii = useCanAny(["warranty.pii.view"]);

  const detailQuery = useWarrantyCase(caseId);
  const eventsQuery = useWarrantyEvents(caseId);
  const attachmentsQuery = useWarrantyAttachments(caseId);
  const issuesQuery = useComponentIssues(
    { warranty_case_id: caseId, per_page: 50 },
    canIssue,
  );

  const updateMutation = useUpdateWarrantyCase();
  const uploadMutation = useUploadWarrantyAttachment();
  const deleteAttachmentMutation = useDeleteWarrantyAttachment();

  const [statusOpen, setStatusOpen] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [statusForm, setStatusForm] = useState<StatusFormValues>({
    status: "",
    reason: "",
    confirmed_defect: "",
    cancel_reason: "",
  });
  const [correctOpen, setCorrectOpen] = useState(false);
  const [correctError, setCorrectError] = useState<string | null>(null);
  const [correctForm, setCorrectForm] = useState<CorrectionFormValues>({
    defect_ids: [],
    estimated_completion_date: "",
    customer_name: "",
    customer_phone: "",
    customer_address: "",
    purchase_date: "",
    reason: "",
  });
  const defectsQuery = useMvpDefects({ status: "ACTIVE", per_page: 100 });
  const defectOptions = (defectsQuery.data?.data ?? []).map((defect) => ({
    value: defect.defect_id,
    label: `${defect.defect_code} · ${defect.defect_name}`,
  }));
  const [attachmentType, setAttachmentType] =
    useState<WarrantyAttachmentType>("INTAKE");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const statusValue = statusForm.status;

  const detail = detailQuery.data;
  const isTerminal = detail
    ? WARRANTY_TERMINAL_STATUSES.includes(detail.status)
    : true;
  const nextStatuses = detail
    ? (WARRANTY_NEXT_STATUS[detail.status] ?? [])
    : [];
  const caseActive = detail ? !isTerminal : false;
  // DEC-WAR-STATE-001: chan tai form thay vi de BE tra 422 sau moi lan submit.
  const diagnosisRequired = Boolean(
    detail &&
    detail.status === "CHECKING" &&
    statusValue &&
    WARRANTY_DIAGNOSIS_REQUIRED_TARGETS.includes(statusValue) &&
    !detail.confirmed_defect?.trim(),
  );
  const noteRequiredLabel = statusValue
    ? WARRANTY_NOTE_REQUIRED_LABELS[statusValue]
    : undefined;

  // GĐ1-REQ-024: thanh tiến trình 5 bước Tiếp nhận → Kiểm tra → Sửa chữa → Hoàn tất
  // → Trả khách. CANCELLED không phải một bước — hiển thị trạng thái error tại bước
  // đã đạt trước khi hủy (suy từ warranty_event) để không phá flow timeline.
  const stepStatuses = WARRANTY_BASELINE_STATUSES.filter(
    (status) => status !== "CANCELLED",
  );
  const isCancelled = detail?.status === "CANCELLED";
  const cancelEvent = (eventsQuery.data ?? []).find(
    (event) => event.to_status === "CANCELLED",
  );
  const progressStatus = isCancelled
    ? (cancelEvent?.from_status ?? "RECEIVED")
    : detail?.status;
  const stepIndex = Math.max(
    0,
    stepStatuses.indexOf(progressStatus as (typeof stepStatuses)[number]),
  );

  const submitStatus = async () => {
    if (!detail) return;
    setStatusError(null);
    if (!statusForm.status) {
      setStatusError("Chọn trạng thái mới.");
      return;
    }
    if (diagnosisRequired && !statusForm.confirmed_defect.trim()) {
      setStatusError(
        "Phải ghi kết quả kiểm tra trước khi rời trạng thái CHECKING.",
      );
      return;
    }
    if (statusForm.status === "CANCELLED" && !statusForm.cancel_reason.trim()) {
      setStatusError("Hủy case cần lý do/bằng chứng.");
      return;
    }
    if (noteRequiredLabel && !statusForm.reason.trim()) {
      setStatusError(noteRequiredLabel);
      return;
    }
    try {
      const updated = await updateMutation.mutateAsync({
        id: detail.id,
        request: {
          status: statusForm.status,
          reason: statusForm.reason.trim() || undefined,
          confirmed_defect: statusForm.confirmed_defect.trim() || undefined,
          cancel_reason: statusForm.cancel_reason.trim() || undefined,
          ifMatch: detail.version,
        },
      });
      toast.success(
        `Đã cập nhật case ${updated.case_code} → ${
          WARRANTY_STATUS_LABELS[updated.status] ?? updated.status
        }.`,
      );
      setStatusForm({ status: "", reason: "", confirmed_defect: "", cancel_reason: "" });
      setStatusOpen(false);
    } catch (error: unknown) {
      const fieldErrors = extractFieldErrorsRaw(error);
      const message = errorText(error, "Không cập nhật được trạng thái.");
      toast.error(
        fieldErrors
          ? `${message} (${Object.values(fieldErrors).flat().join("; ")})`
          : message,
      );
      setStatusError(message);
    }
  };

  /**
   * Annex D SCR-WAR-01: chẩn đoán và PII phải sửa được sau tiếp nhận (nhập sai lúc nhận
   * máy không được buộc mở case mới). PII chỉ gửi khi actor có warranty.pii.view — nếu
   * không, giá trị đang thấy là chuỗi mask và ghi lại sẽ phá dữ liệu thật.
   */
  const submitCorrection = async () => {
    if (!detail) return;
    setCorrectError(null);
    try {
      await updateMutation.mutateAsync({
        id: detail.id,
        request: {
          defect_ids: correctForm.defect_ids,
          estimated_completion_date:
            correctForm.estimated_completion_date || undefined,
          customer_name: canViewPii
            ? correctForm.customer_name.trim() || undefined
            : undefined,
          customer_phone: canViewPii
            ? correctForm.customer_phone.trim() || undefined
            : undefined,
          customer_address: canViewPii
            ? correctForm.customer_address.trim() || undefined
            : undefined,
          purchase_date: correctForm.purchase_date || undefined,
          reason: correctForm.reason.trim() || "Hiệu chỉnh dữ liệu tiếp nhận",
          ifMatch: detail.version,
        },
      });
      toast.success("Đã cập nhật thông tin case.");
      setCorrectOpen(false);
    } catch (error: unknown) {
      const fieldErrors = extractFieldErrorsRaw(error);
      const message = errorText(error, "Không cập nhật được thông tin case.");
      toast.error(
        fieldErrors
          ? `${message} (${Object.values(fieldErrors).flat().join("; ")})`
          : message,
      );
      setCorrectError(message);
    }
  };

  const handleFileSelected = (file: File | undefined) => {
    if (!file) return;
    if (!WARRANTY_IMAGE_MIMES.includes(file.type)) {
      toast.error(`${file.name}: chỉ nhận ảnh JPG/PNG/WEBP.`);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Tệp vượt quá 10MB.");
      return;
    }
    uploadMutation
      .mutateAsync({ caseId, file, attachmentType })
      .then(() => toast.success(`Đã tải lên ${file.name}.`))
      .catch((error: unknown) =>
        toast.error(errorText(error, "Tải tệp lên thất bại.")),
      );
  };

  const attachmentColumns: TableProps<WarrantyAttachment>["columns"] = [
    {
      title: "Tệp",
      key: "file",
      render: (_, row) => (
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <PaperClipOutlined />
          <Stack spacing={0}>
            <AntTypography.Text>{row.file_name}</AntTypography.Text>
            <AntTypography.Text type="secondary" style={{ fontSize: 12 }}>
              {formatBytes(row.file_size_bytes)} ·{" "}
              {WARRANTY_ATTACHMENT_TYPE_LABELS[row.attachment_type] ??
                row.attachment_type}
            </AntTypography.Text>
          </Stack>
        </Stack>
      ),
    },
    {
      title: "Tải lên",
      key: "uploaded_at",
      width: 150,
      render: (_, row) => formatWarrantyDateTime(row.uploaded_at),
    },
    {
      title: "",
      key: "actions",
      width: 90,
      render: (_, row) => (
        <Stack direction="row" spacing={0.5}>
          <IconButton
            size="small"
            onClick={() =>
              downloadWarrantyAttachment({
                attachmentId: row.id,
                fileName: row.file_name,
              }).catch((error: unknown) =>
                toast.error(errorText(error, "Tải tệp xuống thất bại.")),
              )
            }
          >
            <DownloadOutlined style={{ color: ACTION_ICON_COLORS.download }} />
          </IconButton>
          <IconButton
            size="small"
            color="error"
            disabled={!canManage}
            onClick={() => setDeleteConfirmId(row.id)}
          >
            <DeleteOutlined />
          </IconButton>
        </Stack>
      ),
    },
  ];

  const issueColumns: TableProps<ComponentIssueDocument>["columns"] = [
    {
      title: "Phiếu xuất linh kiện",
      dataIndex: "component_issue_no",
      key: "component_issue_no",
      render: (value: string, row) => (
        <Button
          variant="text"
          size="small"
          sx={{ p: 0, minWidth: 0 }}
          onClick={() =>
            onOpenComponentIssue({
              caseId,
              caseCode: detail?.case_code,
              caseActive,
              documentId: row.id,
            })
          }
        >
          {value}
        </Button>
      ),
    },
    {
      title: "Ngày chứng từ",
      dataIndex: "document_date",
      key: "document_date",
      width: 130,
      render: (document_date: string) => formatDate(document_date),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (value: string) => (
        <Tag
          color={
            value === "POSTED"
              ? "success"
              : value === "CANCELLED"
                ? "error"
                : "processing"
          }
        >
          {value}
        </Tag>
      ),
    },
  ];

  return (
    <ThemeProvider theme={muiTheme}>
      <Dialog
        open
        onClose={onClose}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle sx={{ pr: 6, position: "relative" }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 0.5 }}>
            <span>{detail?.case_code ?? "Chi tiết bảo hành"}</span>
            {detail ? (
              <Tag color={WARRANTY_STATUS_COLORS[detail.status]}>
                {WARRANTY_STATUS_LABELS[detail.status] ?? detail.status}
              </Tag>
            ) : null}
            {detail?.identification_type === "TEMP_ONLY" ? (
              <Tag color="warning">TEMP_ONLY</Tag>
            ) : null}
          </Stack>
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
            <ApiErrorAlert
              error={detailQuery.error}
              title="Không tải được chi tiết case"
              onRetry={() => detailQuery.refetch()}
            />

            {!canViewPii ? (
              <Alert severity="info">
                Thông tin khách hàng đang được che (mask) theo quyền
                warranty.pii.view.
              </Alert>
            ) : null}

            <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
                Timeline trạng thái
              </Typography>
              {detail ? (
                <>
                  <Stepper
                    activeStep={stepIndex}
                    alternativeLabel
                    sx={{ mb: 2 }}
                  >
                    {stepStatuses.map((status, index) => (
                      <Step key={status}>
                        <StepLabel error={isCancelled && index === stepIndex}>
                          {WARRANTY_STATUS_LABELS[status] ?? status}
                        </StepLabel>
                      </Step>
                    ))}
                  </Stepper>
                  {isCancelled ? (
                    <Alert severity="error" sx={{ mb: 2 }}>
                      {`Case đã hủy tại bước "${
                        WARRANTY_STATUS_LABELS[progressStatus ?? "RECEIVED"] ??
                        progressStatus
                      }". Lý do: ${detail.cancel_reason ?? "—"}`}
                    </Alert>
                  ) : null}
                </>
              ) : null}

              {(eventsQuery.data ?? []).length ? (
                <Stack spacing={1.25}>
                  {(eventsQuery.data ?? []).map((event, index) => (
                    <Stack
                      key={`${event.to_status}-${index}`}
                      direction="row"
                      spacing={1.25}
                      sx={{ alignItems: "flex-start" }}
                    >
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          bgcolor: `${WARRANTY_STATUS_COLORS[event.to_status] ?? "primary"}.main`,
                          mt: "6px",
                          flexShrink: 0,
                        }}
                      />
                      <Stack spacing={0}>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {event.event_type === "NOTE"
                            ? "Ghi chú xử lý"
                            : (WARRANTY_STATUS_LABELS[event.to_status] ??
                              event.to_status)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatWarrantyDateTime(event.performed_at)}
                          {event.performed_by && event.performed_by !== "-"
                            ? ` · ${event.performed_by}`
                            : ""}
                        </Typography>
                        <Typography variant="body2">{event.description}</Typography>
                      </Stack>
                    </Stack>
                  ))}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Chưa có lịch sử trạng thái cho case này.
                </Typography>
              )}
            </Box>

            {detail ? (
              <Stack spacing={2}>
                {detail.identification_type === "TEMP_ONLY" ? (
                  <Alert severity="warning">
                    {`Mã tạm: ${detail.temporary_item_code ?? "—"} · sales_trace_status = NOT_TRACEABLE. Không liên kết item gốc, không sinh stock movement.`}
                  </Alert>
                ) : null}

                <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 2 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
                    Khách hàng & tiếp nhận
                  </Typography>
                  <Grid container spacing={2}>
                    {/* §13.8: mask lại ở tầng render — không tin payload đã mask sẵn. */}
                    <DetailField
                      label="Khách gửi"
                      value={warrantyPiiText(detail.customer_name, canViewPii, "name") || "—"}
                    />
                    <DetailField
                      label="SĐT"
                      value={warrantyPiiText(detail.customer_phone, canViewPii, "phone") || "—"}
                    />
                    <DetailField
                      label="Địa chỉ"
                      value={warrantyPiiText(detail.customer_address, canViewPii, "address") || "—"}
                    />
                    <DetailField
                      label="Ngày mua"
                      value={detail.purchase_date ? formatDate(detail.purchase_date) : "—"}
                    />
                    <DetailField
                      label="Ngày tiếp nhận"
                      value={formatWarrantyDateTime(detail.received_at)}
                    />
                    <DetailField
                      label="Phụ kiện đi kèm"
                      value={detail.accessories_received ?? "—"}
                    />
                    <DetailField
                      label="Tình trạng tiếp nhận"
                      value={detail.received_condition ?? "—"}
                      span2
                    />
                  </Grid>
                </Box>

                <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 2 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
                    Máy & chẩn đoán
                  </Typography>
                  <Grid container spacing={2}>
                    <DetailField
                      label="Item / serial / mã tạm"
                      value={
                        detail.identification_type === "TEMP_ONLY"
                          ? (detail.temporary_item_code ?? "—")
                          : (detail.item_code ?? detail.serial_number ?? "—")
                      }
                    />
                    <DetailField
                      label="SKU / model"
                      value={detail.sku || detail.sku_name || "—"}
                    />
                    <DetailField label="Trạng thái item" value={detail.item_status ?? "—"} />
                    <DetailField
                      label="Bệnh / lỗi (danh mục)"
                      value={
                        detail.defects?.length ? (
                          <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap", rowGap: 0.5 }}>
                            {detail.defects.map((defect) => (
                              <Tag
                                key={defect.defect_id}
                                color={defect.is_primary ? "blue" : undefined}
                              >
                                {defect.defect_code
                                  ? `${defect.defect_code} · ${defect.defect_name}`
                                  : defect.defect_name}
                              </Tag>
                            ))}
                          </Stack>
                        ) : detail.defect_code ? (
                          `${detail.defect_code} · ${detail.defect}`
                        ) : (
                          (detail.defect ?? "—")
                        )
                      }
                    />
                    <DetailField
                      label="Khách phản ánh"
                      value={detail.reported_defect ?? "—"}
                      span2
                    />
                    <DetailField
                      label="Kết quả kiểm tra"
                      value={detail.confirmed_defect ?? "Chưa có kết luận"}
                      span2
                    />
                    {detail.identification_type === "TEMP_ONLY" ? (
                      <>
                        <DetailField
                          label="Lý do mất mã"
                          value={detail.missing_code_reason ?? "—"}
                        />
                        <DetailField
                          label="Mô tả nhận diện"
                          value={detail.manual_product_description ?? "—"}
                        />
                      </>
                    ) : null}
                    {detail.status === "CANCELLED" ? (
                      <DetailField
                        label="Lý do hủy"
                        value={detail.cancel_reason ?? "—"}
                        span2
                      />
                    ) : null}
                    <DetailField
                      label="Dự kiến hoàn thành"
                      value={
                        detail.estimated_completion_date
                          ? formatDate(detail.estimated_completion_date)
                          : "—"
                      }
                    />
                    <DetailField
                      label="Hoàn tất sửa"
                      value={formatWarrantyDateTime(detail.completed_at)}
                    />
                    <DetailField
                      label="Trả khách"
                      value={formatWarrantyDateTime(detail.returned_at)}
                    />
                  </Grid>
                </Box>

                <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 2 }}>
                  <Stack
                    direction="row"
                    sx={{ alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", rowGap: 1, mb: 1.5 }}
                  >
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      {`Tệp đính kèm (${attachmentsQuery.data?.length ?? 0})`}
                    </Typography>
                    <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                      <TextField
                        select
                        size="small"
                        value={attachmentType}
                        onChange={(event) =>
                          setAttachmentType(event.target.value as WarrantyAttachmentType)
                        }
                        sx={{ minWidth: 170 }}
                      >
                        {RETURN_ATTACHMENT_TYPES.map(([value, label]) => (
                          <MenuItem key={value} value={value}>
                            {label}
                          </MenuItem>
                        ))}
                      </TextField>
                      <Button
                        component="label"
                        size="small"
                        variant="outlined"
                        startIcon={<UploadOutlined style={{ color: ACTION_ICON_COLORS.upload }} />}
                        disabled={
                          !canManage ||
                          detail.status === "CANCELLED" ||
                          uploadMutation.isPending
                        }
                      >
                        {uploadMutation.isPending ? "Đang tải..." : "Tải tệp lên"}
                        <input
                          type="file"
                          accept=".jpg,.jpeg,.png,.webp"
                          hidden
                          onChange={(event) => {
                            handleFileSelected(event.target.files?.[0]);
                            event.target.value = "";
                          }}
                        />
                      </Button>
                    </Stack>
                  </Stack>
                  <Table
                    dataSource={attachmentsQuery.data ?? []}
                    columns={attachmentColumns}
                    rowKey="id"
                    size="small"
                    loading={attachmentsQuery.isLoading}
                    pagination={false}
                    locale={{ emptyText: "Chưa có ảnh/tệp đính kèm." }}
                    scroll={{ x: "max-content" }}
                  />
                </Box>

                {canIssue ? (
                  <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 2 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
                      {`Phiếu xuất linh kiện của case (${issuesQuery.data?.data.length ?? 0})`}
                    </Typography>
                    <Table
                      dataSource={issuesQuery.data?.data ?? []}
                      columns={issueColumns}
                      rowKey="id"
                      size="small"
                      loading={issuesQuery.isLoading}
                      pagination={false}
                      locale={{
                        emptyText:
                          "Chưa có phiếu xuất linh kiện — dùng nút “Xuất linh kiện” để tạo.",
                      }}
                      scroll={{ x: "max-content" }}
                    />
                  </Box>
                ) : null}
              </Stack>
            ) : null}
          </Stack>

          <Dialog open={deleteConfirmId !== null} onClose={() => setDeleteConfirmId(null)} maxWidth="xs" fullWidth>
            <DialogTitle>Xóa tệp đính kèm này?</DialogTitle>
            <DialogActions>
              <Button onClick={() => setDeleteConfirmId(null)} disabled={deleteAttachmentMutation.isPending}>
                Không
              </Button>
              <Button
                color="error"
                variant="contained"
                disabled={deleteAttachmentMutation.isPending}
                onClick={() => {
                  if (!deleteConfirmId) return;
                  deleteAttachmentMutation
                    .mutateAsync(deleteConfirmId)
                    .then(() => {
                      toast.success("Đã xóa tệp đính kèm.");
                      setDeleteConfirmId(null);
                    })
                    .catch((error: unknown) =>
                      toast.error(errorText(error, "Không xóa được tệp.")),
                    );
                }}
              >
                Xóa
              </Button>
            </DialogActions>
          </Dialog>

          <Dialog open={correctOpen} onClose={() => setCorrectOpen(false)} maxWidth="sm" fullWidth aria-label="Sửa thông tin case bảo hành">
            <DialogTitle>Sửa thông tin case bảo hành</DialogTitle>
            <DialogContent dividers>
              <Stack spacing={2}>
                {correctError ? <Alert severity="error">{correctError}</Alert> : null}
                <Alert severity="info">
                  {canViewPii
                    ? "Sửa thông tin là stock-neutral; mọi thay đổi được ghi audit (không lưu giá trị PII vào log) và tăng version."
                    : "Bạn không có quyền warranty.pii.view nên chỉ sửa được bệnh/lỗi và ngày mua; thông tin khách hàng bị khóa."}
                </Alert>
                <Autocomplete
                  multiple
                  options={defectOptions}
                  value={defectOptions.filter((option) =>
                    correctForm.defect_ids.includes(option.value),
                  )}
                  loading={defectsQuery.isLoading}
                  getOptionLabel={(option) => option.label}
                  isOptionEqualToValue={(option, value) => option.value === value.value}
                  onChange={(_event, options) =>
                    setCorrectForm((current) => ({
                      ...current,
                      defect_ids: options.map((option) => option.value),
                    }))
                  }
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Bệnh / lỗi (danh mục)"
                      placeholder="Chọn từ danh mục bệnh/lỗi ACTIVE"
                    />
                  )}
                />
                <TextField
                  fullWidth
                  type="date"
                  label="Ngày dự kiến sửa xong"
                  value={correctForm.estimated_completion_date}
                  onChange={(event) =>
                    setCorrectForm((current) => ({
                      ...current,
                      estimated_completion_date: event.target.value,
                    }))
                  }
                  slotProps={{
                    inputLabel: { shrink: true },
                    htmlInput: { min: dayjs().format("YYYY-MM-DD") },
                  }}
                />
                <TextField
                  fullWidth
                  type="date"
                  label="Ngày mua"
                  value={correctForm.purchase_date}
                  onChange={(event) =>
                    setCorrectForm((current) => ({
                      ...current,
                      purchase_date: event.target.value,
                    }))
                  }
                  slotProps={{
                    inputLabel: { shrink: true },
                    htmlInput: { max: dayjs().format("YYYY-MM-DD") },
                  }}
                />
                <TextField
                  fullWidth
                  label="Tên khách gửi (PII)"
                  value={correctForm.customer_name}
                  disabled={!canViewPii}
                  onChange={(event) =>
                    setCorrectForm((current) => ({ ...current, customer_name: event.target.value }))
                  }
                  slotProps={{ htmlInput: { maxLength: 200 } }}
                />
                <TextField
                  fullWidth
                  label="Số điện thoại (PII)"
                  value={correctForm.customer_phone}
                  disabled={!canViewPii}
                  // Rà soát validate định dạng input (Flow04 Warranty): SĐT khách VN —
                  // đủ 10 chữ số, bắt đầu bằng 0, không cho nhập chữ.
                  onChange={(event) =>
                    setCorrectForm((current) => ({
                      ...current,
                      customer_phone: event.target.value.replace(/\D/g, "").slice(0, 10),
                    }))
                  }
                  error={
                    Boolean(correctForm.customer_phone) &&
                    !/^0\d{9}$/.test(correctForm.customer_phone)
                  }
                  helperText={
                    Boolean(correctForm.customer_phone) &&
                    !/^0\d{9}$/.test(correctForm.customer_phone)
                      ? "Số điện thoại phải đủ 10 chữ số và bắt đầu bằng số 0."
                      : undefined
                  }
                  slotProps={{ htmlInput: { maxLength: 10, inputMode: "numeric" } }}
                />
                <TextField
                  fullWidth
                  label="Địa chỉ khách (PII)"
                  value={correctForm.customer_address}
                  disabled={!canViewPii}
                  onChange={(event) =>
                    setCorrectForm((current) => ({ ...current, customer_address: event.target.value }))
                  }
                  slotProps={{ htmlInput: { maxLength: 500 } }}
                />
                <TextField
                  fullWidth
                  multiline
                  minRows={2}
                  label="Lý do hiệu chỉnh (hiện trên timeline)"
                  value={correctForm.reason}
                  onChange={(event) =>
                    setCorrectForm((current) => ({ ...current, reason: event.target.value }))
                  }
                  slotProps={{ htmlInput: { maxLength: 2000 } }}
                  helperText={`${correctForm.reason.length}/2000`}
                />
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setCorrectOpen(false)} disabled={updateMutation.isPending}>
                Hủy
              </Button>
              <Button
                variant="contained"
                onClick={() => void submitCorrection()}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? "Đang lưu..." : "Lưu"}
              </Button>
            </DialogActions>
          </Dialog>

          <Dialog open={statusOpen} onClose={() => setStatusOpen(false)} maxWidth="sm" fullWidth aria-label="Cập nhật trạng thái bảo hành">
            <DialogTitle>Cập nhật trạng thái bảo hành</DialogTitle>
            <DialogContent dividers>
              <Stack spacing={2}>
                {statusError ? <Alert severity="error">{statusError}</Alert> : null}
                <Alert severity="info">
                  Cập nhật trạng thái là stock-neutral: item không tự quay lại
                  tồn bán; trả khách chuyển item sang RETURNED_TO_CUSTOMER.
                </Alert>
                <TextField
                  select
                  required
                  fullWidth
                  label="Trạng thái mới"
                  value={statusForm.status}
                  onChange={(event) =>
                    setStatusForm((current) => ({
                      ...current,
                      status: event.target.value as WarrantyCaseStatus,
                    }))
                  }
                >
                  {nextStatuses.map((value) => (
                    <MenuItem key={value} value={value}>
                      {WARRANTY_STATUS_LABELS[value] ?? value}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  fullWidth
                  multiline
                  minRows={2}
                  required={diagnosisRequired}
                  label={
                    diagnosisRequired
                      ? "Kết quả kiểm tra / bệnh xác nhận (bắt buộc)"
                      : "Kết quả kiểm tra / bệnh xác nhận"
                  }
                  value={statusForm.confirmed_defect}
                  onChange={(event) =>
                    setStatusForm((current) => ({ ...current, confirmed_defect: event.target.value }))
                  }
                  slotProps={{ htmlInput: { maxLength: 2000 } }}
                  helperText={`${statusForm.confirmed_defect.length}/2000`}
                />
                {statusValue === "CANCELLED" ? (
                  <TextField
                    fullWidth
                    multiline
                    minRows={2}
                    required
                    label="Lý do hủy (bắt buộc)"
                    value={statusForm.cancel_reason}
                    onChange={(event) =>
                      setStatusForm((current) => ({ ...current, cancel_reason: event.target.value }))
                    }
                    slotProps={{ htmlInput: { maxLength: 1000 } }}
                    helperText={`${statusForm.cancel_reason.length}/1000`}
                  />
                ) : null}
                <TextField
                  fullWidth
                  multiline
                  minRows={2}
                  required={Boolean(noteRequiredLabel)}
                  label={noteRequiredLabel ?? "Ghi chú xử lý (hiện trên timeline)"}
                  value={statusForm.reason}
                  onChange={(event) =>
                    setStatusForm((current) => ({ ...current, reason: event.target.value }))
                  }
                  slotProps={{ htmlInput: { maxLength: 2000 } }}
                  helperText={`${statusForm.reason.length}/2000`}
                />
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setStatusOpen(false)} disabled={updateMutation.isPending}>
                Hủy
              </Button>
              <Button
                variant="contained"
                onClick={() => void submitStatus()}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? "Đang cập nhật..." : "Cập nhật"}
              </Button>
            </DialogActions>
          </Dialog>
        </DialogContent>
        <DialogActions>
          <Button startIcon={<CloseOutlined />} onClick={onClose}>
            Đóng
          </Button>
          <Button
            startIcon={<EditOutlined style={{ color: ACTION_ICON_COLORS.edit }} />}
            disabled={!canManage || !detail || isTerminal}
            onClick={() => {
              if (!detail) return;
              setCorrectForm({
                defect_ids:
                  detail.defect_ids ??
                  (detail.defect_id ? [detail.defect_id] : []),
                estimated_completion_date: detail.estimated_completion_date ?? "",
                customer_name: canViewPii ? (detail.customer_name ?? "") : "",
                customer_phone: canViewPii ? (detail.customer_phone ?? "") : "",
                customer_address: canViewPii ? (detail.customer_address ?? "") : "",
                purchase_date: detail.purchase_date ?? "",
                reason: "",
              });
              setCorrectError(null);
              setCorrectOpen(true);
            }}
          >
            Sửa thông tin
          </Button>
          <Button
            startIcon={<ToolOutlined />}
            disabled={!canIssue || !detail}
            onClick={() =>
              detail &&
              onOpenComponentIssue({
                caseId,
                caseCode: detail.case_code,
                caseActive,
                documentId: null,
              })
            }
          >
            Xuất linh kiện
          </Button>
          <Button
            variant="contained"
            startIcon={<SyncOutlined />}
            disabled={!canManage || isTerminal || nextStatuses.length === 0}
            onClick={() => {
              setStatusForm({
                status: nextStatuses[0],
                reason: "",
                confirmed_defect: "",
                cancel_reason: "",
              });
              setStatusError(null);
              setStatusOpen(true);
            }}
          >
            Cập nhật trạng thái
          </Button>
        </DialogActions>
      </Dialog>
    </ThemeProvider>
  );
}
