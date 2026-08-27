import { useMemo, useState } from "react";
import { InputNumber, Select as AntSelect, Table, Tag } from "antd";
import {
  Alert,
  Box,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  ThemeProvider,
  Typography,
} from "@mui/material";
import { toast } from "sonner";
import { muiTheme } from "@/app/mui-theme";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import { getApiErrorMessage, normalizeError } from "@/shared/api/api-error";
import {
  MOVEMENT_TYPE_LABELS,
  RETURN_CONDITION_LABELS,
  SOURCE_DOCUMENT_TYPE_LABELS,
  businessLabel,
} from "@/shared/constants/business-labels";
import {
  useReversibleMovements,
  useCreateReversal,
} from "../hooks/use-reversal";
import type {
  CreateReversalRequest,
  ReversalReturnCondition,
  ReversibleMovement,
  ReversibleMovementLine,
} from "../types";
import { isStockRestoringMovement } from "../types";
import { formatDateTime } from "@/shared/utils/format-date";
import { useDialogExit } from "@/shared/utils/useDialogExit";
import { ActionButton, ActionIconButton } from "@/shared/components/actions";

const RETURN_CONDITION_OPTIONS: Array<{
  value: ReversalReturnCondition;
  label: string;
}> = [
  { value: "SELLABLE", label: "Có thể bán/xuất lại" },
  { value: "DEFECTIVE", label: "Hàng lỗi" },
  { value: "NON_SELLABLE", label: "Không thể bán/xuất" },
];

type ReversalDraft = Record<
  string,
  { reversal_qty?: number; reason?: string; item_ids?: string[] }
>;

function idempotencyKey() {
  return `reversal-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

const numberFormatter = new Intl.NumberFormat("vi-VN");

function qty(value?: number) {
  return numberFormatter.format(Number(value ?? 0));
}

interface Props {
  onClose: () => void;
  onCreated: (reversalCode: string, reversalId: string) => void;
}

export function ReversalCreateModal({ onClose, onCreated }: Props) {
  const dialog = useDialogExit(onClose);
  const [search, setSearch] = useState("");
  const [selectedMovement, setSelectedMovement] =
    useState<ReversibleMovement>();
  const [reason, setReason] = useState("");
  const [draft, setDraft] = useState<ReversalDraft>({});
  const [returnCondition, setReturnCondition] =
    useState<ReversalReturnCondition>("SELLABLE");
  const [physicalConfirmed, setPhysicalConfirmed] = useState(false);
  const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false);
  const [submitBusy, setSubmitBusy] = useState(false);

  const movementsQuery = useReversibleMovements({
    search: search || undefined,
    reversible_only: true,
    per_page: 50,
  });
  const movements = movementsQuery.data ?? [];
  const createMutation = useCreateReversal();

  const selectedLines = useMemo(() => {
    if (!selectedMovement) return [];
    return selectedMovement.lines
      .filter((line) => line.can_reverse)
      .map((line) => ({
        sku: line.sku,
        reversal_qty: Number(draft[line.sku]?.reversal_qty ?? 0),
        reason: draft[line.sku]?.reason,
        max: line.reversible_qty,
        is_serial_tracked: Boolean(line.is_serial_tracked),
        item_ids: draft[line.sku]?.item_ids ?? [],
      }))
      .filter((line) => line.reversal_qty > 0);
  }, [draft, selectedMovement]);

  const serialLineMismatch = selectedLines.find(
    (line) =>
      line.is_serial_tracked && line.item_ids.length !== line.reversal_qty,
  );
  const totalQty = selectedLines.reduce(
    (sum, line) => sum + line.reversal_qty,
    0,
  );
  const invalidLine = selectedLines.find(
    (line) => line.reversal_qty > line.max,
  );
  const isIssueReversal = isStockRestoringMovement(
    selectedMovement?.movement_type,
  );
  const availableDelta =
    (isIssueReversal ? (returnCondition === "SELLABLE" ? 1 : 0) : -1) *
    totalQty;
  const missingReferenceVersion =
    Boolean(selectedMovement) && !selectedMovement?.version;
  const canSubmit =
    Boolean(selectedMovement?.can_reverse) &&
    !missingReferenceVersion &&
    selectedLines.length > 0 &&
    totalQty > 0 &&
    reason.trim().length >= 5 &&
    !invalidLine &&
    !serialLineMismatch &&
    (!isIssueReversal || (Boolean(returnCondition) && physicalConfirmed));

  function handleSelectMovement(movement: ReversibleMovement) {
    setSelectedMovement(movement);
    setReturnCondition("SELLABLE");
    setPhysicalConfirmed(false);
    setDraft(
      Object.fromEntries(
        movement.lines.map((line) => {
          const candidates = line.items ?? [];
          const defaultQty = line.can_reverse ? line.reversible_qty : 0;
          return [
            line.sku,
            {
              reversal_qty: defaultQty,
              reason: line.dependency_guard,
              item_ids: line.is_serial_tracked
                ? candidates
                    .slice(0, defaultQty)
                    .map((candidate) => candidate.item_id)
                : [],
            },
          ];
        }),
      ),
    );
  }

  async function doSubmit() {
    if (!selectedMovement) return;
    setSubmitBusy(true);
    const payload: CreateReversalRequest = {
      reference_document_id:
        selectedMovement.source_document_id || selectedMovement.id,
      reference_document_type:
        selectedMovement.source_document_type || selectedMovement.movement_type,
      reference_version: selectedMovement.version,
      reason,
      ...(isIssueReversal
        ? {
            return_condition: returnCondition,
            physical_return_confirmed: physicalConfirmed,
          }
        : {}),
      lines: selectedLines.flatMap(
        ({
          sku,
          reversal_qty,
          reason: lineReason,
          is_serial_tracked,
          item_ids,
        }) =>
          is_serial_tracked
            ? item_ids.map((item_id) => ({
                sku,
                reversal_qty: 1,
                reason: lineReason,
                item_id,
              }))
            : [{ sku, reversal_qty, reason: lineReason }],
      ),
      idempotency_key: idempotencyKey(),
    };
    try {
      const created = await createMutation.mutateAsync(payload);
      // "Chứng từ nhập/xuất/hoàn trả": phiếu điều chỉnh luôn dừng ở DRAFT sau khi
      // tạo — phải đính kèm chứng từ rồi bấm Hoàn tất điều chỉnh mới thật sự ghi
      // tồn kho (DocumentEvidenceGuard bắt buộc REVERSAL có chứng từ trước Post).
      toast.success(
        `Đã tạo phiếu điều chỉnh ${created.reversal_code} (nháp) — hãy đính kèm chứng từ rồi bấm Hoàn tất điều chỉnh.`,
      );
      setSubmitConfirmOpen(false);
      onCreated(created.reversal_code, created.id);
    } catch (submitError) {
      const normalized = normalizeError(submitError);
      toast.error(
        normalized.status === 409 ||
          normalized.status === 412 ||
          normalized.status === 428
          ? `${normalized.message}. Dữ liệu đã thay đổi; vui lòng tải lại danh sách và chọn lại giao dịch.`
          : getApiErrorMessage(
              submitError,
              "Không thể tạo phiếu điều chỉnh tồn kho",
            ),
      );
    } finally {
      setSubmitBusy(false);
    }
  }

  return (
    <ThemeProvider theme={muiTheme}>
      <Dialog {...dialog.dialogProps} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ pr: 6, position: "relative" }}>
          Tạo phiếu điều chỉnh tồn kho
          <ActionIconButton
            kind="close"
            label="Đóng"
            onClick={dialog.close}
            sx={{ position: "absolute", right: 10, top: 8 }}
          />
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Alert severity="info">
              <Typography
                component="strong"
                sx={{ fontWeight: 700, display: "block" }}
              >
                Giao dịch gốc luôn được giữ nguyên
              </Typography>
              <Typography variant="body2">
                Hệ thống tạo một giao dịch điều chỉnh đối ứng thay vì sửa hoặc
                xóa giao dịch gốc. Các giới hạn số lượng và điều kiện phụ thuộc
                được kiểm tra tự động trước khi ghi nhận.
              </Typography>
            </Alert>

            <TextField
              value={search}
              placeholder="Tìm mã biến động / chứng từ gốc..."
              slotProps={{
                htmlInput: { "aria-label": "Tìm giao dịch có thể điều chỉnh" },
              }}
              onChange={(event) => setSearch(event.target.value)}
              fullWidth
              size="small"
            />

            {movementsQuery.isError ? (
              <ApiErrorAlert
                error={movementsQuery.error}
                title="Không thể tải các giao dịch có thể điều chỉnh"
                onRetry={() => movementsQuery.refetch()}
              />
            ) : null}

            <Table
              dataSource={movements}
              rowKey="id"
              size="small"
              loading={movementsQuery.isLoading}
              pagination={{ pageSize: 5 }}
              scroll={{ x: "max-content" }}
              locale={{ emptyText: "Chưa có giao dịch nào có thể điều chỉnh" }}
              rowClassName={(record) =>
                record.id === selectedMovement?.id
                  ? "ant-table-row-selected"
                  : ""
              }
              onRow={(record) => ({
                onClick: () => handleSelectMovement(record),
                style: { cursor: "pointer" },
              })}
              columns={[
                {
                  title: "Mã biến động",
                  dataIndex: "movement_code",
                  width: 150,
                },
                {
                  title: "Loại",
                  dataIndex: "movement_type",
                  width: 170,
                  render: (value: string) =>
                    businessLabel(
                      MOVEMENT_TYPE_LABELS,
                      value,
                      "Biến động khác",
                    ),
                },
                {
                  title: "Chứng từ gốc",
                  width: 180,
                  render: (_: unknown, row: ReversibleMovement) => (
                    <Stack spacing={0}>
                      <span>
                        {row.source_document_code || row.source_document_id}
                      </span>
                      <Typography variant="caption" color="text.secondary">
                        {businessLabel(
                          SOURCE_DOCUMENT_TYPE_LABELS,
                          row.source_document_type,
                          "Chứng từ khác",
                        )}
                      </Typography>
                    </Stack>
                  ),
                },
                { title: "Kho", dataIndex: "warehouse_name", width: 140 },
                {
                  title: "Thời điểm ghi nhận",
                  dataIndex: "posted_at",
                  width: 160,
                  render: (posted_at: string) => formatDateTime(posted_at),
                },
                {
                  title: "Khả năng điều chỉnh",
                  width: 180,
                  render: (_: unknown, row: ReversibleMovement) => (
                    <Box
                      component="span"
                      sx={{
                        px: 1,
                        py: 0.25,
                        borderRadius: 1,
                        fontSize: 12,
                        color: row.dependency_guard
                          ? "error.main"
                          : "success.main",
                        bgcolor: row.dependency_guard
                          ? "error.50"
                          : "success.50",
                      }}
                    >
                      {row.dependency_guard
                        ? "Đang bị chặn bởi nghiệp vụ liên quan"
                        : "Có thể điều chỉnh"}
                    </Box>
                  ),
                },
              ]}
            />

            {selectedMovement ? (
              <Box
                sx={{
                  bgcolor: "action.hover",
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 2,
                  p: 2,
                }}
              >
                <Typography
                  variant="subtitle2"
                  sx={{ fontWeight: 700, mb: 1.5 }}
                >
                  Điều chỉnh từ {selectedMovement.movement_code}
                </Typography>

                <Grid container spacing={2} sx={{ mb: 1.5 }}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: "block" }}
                    >
                      Chứng từ nguồn
                    </Typography>
                    <Typography variant="body2">
                      {businessLabel(
                        SOURCE_DOCUMENT_TYPE_LABELS,
                        selectedMovement.source_document_type,
                        "Chứng từ khác",
                      )}{" "}
                      ·{" "}
                      {selectedMovement.source_document_code ||
                        selectedMovement.source_document_id}
                    </Typography>
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: "block" }}
                    >
                      Khả năng điều chỉnh
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        color: selectedMovement.can_reverse
                          ? "success.main"
                          : "error.main",
                      }}
                    >
                      {selectedMovement.can_reverse
                        ? "Có thể điều chỉnh"
                        : "Đang bị chặn"}
                    </Typography>
                  </Grid>
                </Grid>

                {selectedMovement.dependency_guard ? (
                  <Alert severity="warning" sx={{ mb: 1.5 }}>
                    <Typography
                      component="strong"
                      sx={{ fontWeight: 700, display: "block" }}
                    >
                      Còn nghiệp vụ phụ thuộc
                    </Typography>
                    <Typography variant="body2">
                      Giao dịch này chưa thể điều chỉnh ngay vì còn dữ liệu hoặc
                      nghiệp vụ phát sinh sau đó. Cần xử lý các nghiệp vụ liên
                      quan theo thứ tự ngược trước.
                    </Typography>
                  </Alert>
                ) : null}

                <Stack spacing={2} sx={{ mt: 1.5 }}>
                  <TextField
                    label="Lý do điều chỉnh"
                    required
                    fullWidth
                    multiline
                    minRows={2}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="Nhập lý do điều chỉnh (tối thiểu 5 ký tự)..."
                    error={Boolean(reason && reason.length < 5)}
                    helperText={
                      reason && reason.length < 5
                        ? "Nhập lý do tối thiểu 5 ký tự"
                        : undefined
                    }
                  />

                  {isIssueReversal ? (
                    <>
                      <FormControl sx={{ maxWidth: 420 }}>
                        <InputLabel id="reversal-create-return-condition-label">
                          Tình trạng hàng trả về
                        </InputLabel>
                        <Select
                          id="reversal-create-return-condition"
                          labelId="reversal-create-return-condition-label"
                          label="Tình trạng hàng trả về"
                          required
                          value={returnCondition}
                          onChange={(event) =>
                            setReturnCondition(
                              event.target.value as ReversalReturnCondition,
                            )
                          }
                        >
                          {RETURN_CONDITION_OPTIONS.map((option) => (
                            <MenuItem key={option.value} value={option.value}>
                              {option.label}
                            </MenuItem>
                          ))}
                        </Select>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ mt: 0.5 }}
                        >
                          Chỉ hàng có thể bán/xuất lại mới được cộng trở lại số
                          lượng khả dụng. Hàng lỗi hoặc không thể bán/xuất vẫn
                          được ghi nhận nhưng không cộng vào tồn khả dụng.
                        </Typography>
                      </FormControl>
                      <Box>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={physicalConfirmed}
                              onChange={(event) =>
                                setPhysicalConfirmed(event.target.checked)
                              }
                            />
                          }
                          label="Xác nhận hàng vật lý đã quay lại kho"
                        />
                        {!physicalConfirmed ? (
                          <Typography
                            variant="caption"
                            color="warning.main"
                            sx={{ display: "block" }}
                          >
                            Chỉ được hoàn tất điều chỉnh xuất kho khi hàng vật
                            lý đã quay lại kho.
                          </Typography>
                        ) : null}
                      </Box>
                    </>
                  ) : null}
                </Stack>

                <Box sx={{ mt: 2 }}>
                  <Table
                    size="small"
                    dataSource={selectedMovement.lines}
                    rowKey="id"
                    pagination={false}
                    scroll={{ x: "max-content" }}
                    columns={[
                      { title: "SKU", dataIndex: "sku", width: 130 },
                      { title: "Tên", dataIndex: "sku_name", width: 160 },
                      {
                        title: "Số lượng gốc",
                        dataIndex: "original_qty",
                        width: 110,
                        align: "right",
                        render: qty,
                      },
                      {
                        title: "Đã điều chỉnh",
                        dataIndex: "reversed_qty",
                        width: 110,
                        align: "right",
                        render: qty,
                      },
                      {
                        title: "Còn có thể điều chỉnh",
                        dataIndex: "reversible_qty",
                        width: 150,
                        align: "right",
                        render: (value: number) => (
                          <strong>{qty(value)}</strong>
                        ),
                      },
                      {
                        title: "Số lượng điều chỉnh",
                        width: 150,
                        render: (_: unknown, line: ReversibleMovementLine) => (
                          <InputNumber
                            min={0}
                            max={line.reversible_qty}
                            disabled={!line.can_reverse}
                            value={draft[line.sku]?.reversal_qty}
                            size="small"
                            style={{ width: "100%" }}
                            onChange={(value) =>
                              setDraft((current) => ({
                                ...current,
                                [line.sku]: {
                                  ...current[line.sku],
                                  reversal_qty: Number(value ?? 0),
                                },
                              }))
                            }
                          />
                        ),
                      },
                      {
                        title: "Sản phẩm theo số sê-ri",
                        width: 260,
                        render: (_: unknown, line: ReversibleMovementLine) =>
                          line.is_serial_tracked ? (
                            <AntSelect
                              mode="multiple"
                              size="small"
                              style={{ width: "100%" }}
                              placeholder="Chọn sản phẩm cần điều chỉnh"
                              disabled={!line.can_reverse}
                              value={draft[line.sku]?.item_ids ?? []}
                              options={(line.items ?? []).map((item) => ({
                                value: item.item_id,
                                label:
                                  item.serial_number ||
                                  item.item_code ||
                                  item.item_id.slice(0, 8),
                              }))}
                              onChange={(value) =>
                                setDraft((current) => ({
                                  ...current,
                                  [line.sku]: {
                                    ...current[line.sku],
                                    item_ids: value,
                                  },
                                }))
                              }
                            />
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              Không quản lý theo số sê-ri
                            </Typography>
                          ),
                      },
                      {
                        title: "Kiểm tra phụ thuộc",
                        width: 170,
                        render: (_: unknown, line: ReversibleMovementLine) => (
                          <Tag color={line.dependency_guard ? "red" : "green"}>
                            {line.dependency_guard ? "Đang bị chặn" : "Đạt"}
                          </Tag>
                        ),
                      },
                    ]}
                  />
                </Box>

                {serialLineMismatch ? (
                  <Alert severity="error" sx={{ mt: 1.5 }}>
                    {`SKU ${serialLineMismatch.sku}: phải chọn đúng ${serialLineMismatch.reversal_qty} sản phẩm theo số sê-ri (đang chọn ${serialLineMismatch.item_ids.length}).`}
                  </Alert>
                ) : null}

                {invalidLine ? (
                  <Alert severity="error" sx={{ mt: 1.5 }}>
                    {`Số lượng điều chỉnh của ${invalidLine.sku} vượt số lượng còn có thể điều chỉnh.`}
                  </Alert>
                ) : null}

                {missingReferenceVersion ? (
                  <Alert
                    severity="error"
                    sx={{ mt: 1.5 }}
                    data-testid="reversal-missing-version"
                  >
                    <Typography
                      component="strong"
                      sx={{ fontWeight: 700, display: "block" }}
                    >
                      Dữ liệu chứng từ gốc chưa đủ để tạo phiếu điều chỉnh
                    </Typography>
                    <Typography variant="body2">
                      Hãy làm mới danh sách và chọn lại giao dịch trước khi tiếp
                      tục.
                    </Typography>
                  </Alert>
                ) : null}

                <Alert
                  severity={selectedMovement.can_reverse ? "success" : "error"}
                  sx={{ mt: 1.5 }}
                >
                  <Typography
                    component="strong"
                    sx={{ fontWeight: 700, display: "block" }}
                  >
                    {selectedMovement.can_reverse
                      ? `Kiểm tra phụ thuộc: Đạt · tổng số lượng có thể điều chỉnh = ${qty(
                          selectedMovement.lines.reduce(
                            (sum, line) => sum + line.reversible_qty,
                            0,
                          ),
                        )}`
                      : "Kiểm tra phụ thuộc: Đang bị chặn"}
                  </Typography>
                  <Typography variant="body2">
                    {selectedMovement.can_reverse
                      ? `Ảnh hưởng dự kiến đến tồn khả dụng: ${
                          availableDelta === 0
                            ? "không thay đổi"
                            : `${availableDelta > 0 ? "+" : ""}${qty(availableDelta)}`
                        }. Giao dịch gốc vẫn được giữ nguyên.`
                      : "Cần xử lý các nghiệp vụ phụ thuộc theo thứ tự ngược trước khi điều chỉnh giao dịch này."}
                  </Typography>
                </Alert>

                <Stack
                  direction="row"
                  spacing={2}
                  sx={{
                    mt: 2,
                    alignItems: "center",
                    flexWrap: "wrap",
                    rowGap: 1.5,
                  }}
                >
                  <Box>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: "block" }}
                    >
                      Tổng số lượng điều chỉnh
                    </Typography>
                    <Typography variant="h6">{qty(totalQty)}</Typography>
                  </Box>
                  <ActionButton
                    kind="create"
                    disabled={!canSubmit || createMutation.isPending}
                    onClick={() => setSubmitConfirmOpen(true)}
                  >
                    {createMutation.isPending
                      ? "Đang tạo..."
                      : "Tạo phiếu điều chỉnh"}
                  </ActionButton>
                </Stack>
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary">
                Chọn giao dịch gốc ở bảng trên để xem số lượng còn có thể điều
                chỉnh và các điều kiện liên quan.
              </Typography>
            )}
          </Stack>
        </DialogContent>
      </Dialog>

      <Dialog
        open={submitConfirmOpen}
        onClose={() => setSubmitConfirmOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Tạo phiếu điều chỉnh tồn kho?</DialogTitle>
        <DialogContent>
          <Stack spacing={1}>
            <Typography variant="body2">
              Giao dịch gốc {selectedMovement?.movement_code} sẽ được giữ
              nguyên. Hệ thống tạo giao dịch đối ứng và kiểm tra các nghiệp vụ
              phụ thuộc trước khi thay đổi tồn kho.
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              {selectedLines.length} dòng, tổng số lượng {qty(totalQty)}
            </Typography>
            {isIssueReversal ? (
              <Typography variant="body2">
                Tình trạng hàng trả về:{" "}
                <strong>
                  {businessLabel(
                    RETURN_CONDITION_LABELS,
                    returnCondition,
                    "Chưa xác định",
                  )}
                </strong>
                . Đã xác nhận hàng vật lý quay lại kho.
              </Typography>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <ActionButton
            kind="refresh"
            onClick={() => setSubmitConfirmOpen(false)}
            disabled={submitBusy}
          >
            Kiểm tra lại
          </ActionButton>
          <ActionButton
            kind="create"
            onClick={() => void doSubmit()}
            disabled={submitBusy}
          >
            {submitBusy ? "Đang tạo..." : "Tạo phiếu điều chỉnh"}
          </ActionButton>
        </DialogActions>
      </Dialog>
    </ThemeProvider>
  );
}
