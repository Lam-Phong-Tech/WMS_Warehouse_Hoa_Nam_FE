import { useMemo, useState } from "react";
import {
  Box,
  Checkbox,
  FormControlLabel,
  Grid,
  Menu,
  MenuItem,
  Stack,
  UiAlert,
  UiButton,
  UiDialog,
  UiPagination,
  UiSelect,
  UiStatusBadge,
  UiTextField,
} from "@/shared/ui";
import { toast } from "sonner";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import { getApiErrorMessage, normalizeError } from "@/shared/api/api-error";
import {
  MOVEMENT_TYPE_LABELS,
  RETURN_CONDITION_LABELS,
  SOURCE_DOCUMENT_TYPE_LABELS,
  businessLabel,
} from "@/shared/constants/business-labels";
import {
  ResponsiveDataTable,
  type ResponsiveTableColumn,
} from "@/shared/components/data-display/ResponsiveDataTable";
import { DownOutlined } from "@/shared/components/icons";
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

const MOVEMENTS_PAGE_SIZE = 5;

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

/**
 * Chọn nhiều sản phẩm theo số sê-ri cho một dòng — thay antd Select
 * mode="multiple" (design system chưa có multi-select điều khiển trực tiếp):
 * nút mở Menu + Checkbox từng sản phẩm, value contract string[] giữ nguyên.
 */
function SerialItemsSelect({
  value,
  onChange,
  options,
  disabled,
  placeholder,
  ariaLabel,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  options: Array<{ value: string; label: string }>;
  disabled?: boolean;
  placeholder: string;
  ariaLabel: string;
}) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const selected = options.filter((option) => value.includes(option.value));
  const summary =
    selected.length === 0
      ? placeholder
      : selected.length <= 2
        ? selected.map((option) => option.label).join(", ")
        : `Đã chọn ${selected.length} sản phẩm`;

  const toggle = (optionValue: string) => {
    onChange(
      value.includes(optionValue)
        ? value.filter((item) => item !== optionValue)
        : [...value, optionValue],
    );
  };

  return (
    <>
      <UiButton
        appearance="outlined"
        color="secondary"
        size="small"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        endIcon={<DownOutlined style={{ fontSize: 12 }} />}
        onClick={(event) => setAnchorEl(event.currentTarget)}
        sx={{
          width: "100%",
          justifyContent: "space-between",
          fontWeight: 400,
          textAlign: "left",
          color: selected.length === 0 ? "text.disabled" : "text.primary",
        }}
      >
        {summary}
      </UiButton>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        {options.length === 0 ? (
          <MenuItem disabled>Không có sản phẩm khả dụng</MenuItem>
        ) : (
          options.map((option) => (
            <MenuItem
              key={option.value}
              dense
              onClick={() => toggle(option.value)}
            >
              <Checkbox
                size="small"
                checked={value.includes(option.value)}
                tabIndex={-1}
                sx={{ p: 0.5, mr: 1 }}
              />
              {option.label}
            </MenuItem>
          ))
        )}
      </Menu>
    </>
  );
}

interface Props {
  onClose: () => void;
  onCreated: (reversalCode: string, reversalId: string) => void;
}

export function ReversalCreateModal({ onClose, onCreated }: Props) {
  const dialog = useDialogExit(onClose);
  const [search, setSearch] = useState("");
  const [movementsPage, setMovementsPage] = useState(1);
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

  // Phân trang client 5 dòng/trang — giữ đúng pageSize của antd Table cũ.
  const movementsPageCount = Math.max(
    1,
    Math.ceil(movements.length / MOVEMENTS_PAGE_SIZE),
  );
  const safeMovementsPage = Math.min(movementsPage, movementsPageCount);
  const pagedMovements = movements.slice(
    (safeMovementsPage - 1) * MOVEMENTS_PAGE_SIZE,
    safeMovementsPage * MOVEMENTS_PAGE_SIZE,
  );

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

  const movementColumns: ResponsiveTableColumn<ReversibleMovement>[] = [
    {
      key: "selected",
      header: "",
      width: 90,
      hideOnMobile: true,
      // antd cũ tô nền dòng đang chọn qua rowClassName; ResponsiveDataTable
      // không có API tương đương nên đánh dấu bằng badge trong dòng.
      render: (row) =>
        row.id === selectedMovement?.id ? (
          <UiStatusBadge tone="primary" label="Đang chọn" />
        ) : null,
    },
    {
      key: "movement_code",
      header: "Mã biến động",
      width: 150,
      render: (row) => row.movement_code,
    },
    {
      key: "movement_type",
      header: "Loại",
      width: 170,
      render: (row) =>
        businessLabel(
          MOVEMENT_TYPE_LABELS,
          row.movement_type,
          "Biến động khác",
        ),
    },
    {
      key: "source",
      header: "Chứng từ gốc",
      width: 180,
      render: (row) => (
        <Stack spacing={0}>
          <span>{row.source_document_code || row.source_document_id}</span>
          <Box sx={{ typography: "caption", color: "text.secondary" }}>
            {businessLabel(
              SOURCE_DOCUMENT_TYPE_LABELS,
              row.source_document_type,
              "Chứng từ khác",
            )}
          </Box>
        </Stack>
      ),
    },
    {
      key: "warehouse_name",
      header: "Kho",
      width: 140,
      render: (row) => row.warehouse_name,
    },
    {
      key: "posted_at",
      header: "Thời điểm ghi nhận",
      width: 160,
      render: (row) => formatDateTime(row.posted_at),
    },
    {
      key: "reversibility",
      header: "Khả năng điều chỉnh",
      width: 180,
      render: (row) => (
        <Box
          component="span"
          sx={{
            px: 1,
            py: 0.25,
            borderRadius: 1,
            fontSize: 12,
            color: row.dependency_guard ? "error.main" : "success.main",
            bgcolor: row.dependency_guard ? "error.50" : "success.50",
          }}
        >
          {row.dependency_guard
            ? "Đang bị chặn bởi nghiệp vụ liên quan"
            : "Có thể điều chỉnh"}
        </Box>
      ),
    },
  ];

  const lineColumns: ResponsiveTableColumn<ReversibleMovementLine>[] = [
    { key: "sku", header: "SKU", width: 130, render: (line) => line.sku },
    {
      key: "sku_name",
      header: "Tên",
      width: 160,
      render: (line) => line.sku_name,
    },
    {
      key: "original_qty",
      header: "Số lượng gốc",
      width: 110,
      align: "right",
      render: (line) => qty(line.original_qty),
    },
    {
      key: "reversed_qty",
      header: "Đã điều chỉnh",
      width: 110,
      align: "right",
      render: (line) => qty(line.reversed_qty),
    },
    {
      key: "reversible_qty",
      header: "Còn có thể điều chỉnh",
      width: 150,
      align: "right",
      render: (line) => <strong>{qty(line.reversible_qty)}</strong>,
    },
    {
      key: "reversal_qty",
      header: "Số lượng điều chỉnh",
      width: 150,
      render: (line) => (
        <UiTextField
          type="number"
          size="small"
          fullWidth
          disabled={!line.can_reverse}
          value={draft[line.sku]?.reversal_qty ?? 0}
          slotProps={{
            htmlInput: {
              min: 0,
              max: line.reversible_qty,
              "aria-label": `Số lượng điều chỉnh ${line.sku}`,
            },
          }}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              [line.sku]: {
                ...current[line.sku],
                reversal_qty: Number(event.target.value || 0),
              },
            }))
          }
        />
      ),
    },
    {
      key: "serial_items",
      header: "Sản phẩm theo số sê-ri",
      width: 260,
      render: (line) =>
        line.is_serial_tracked ? (
          <SerialItemsSelect
            value={draft[line.sku]?.item_ids ?? []}
            options={(line.items ?? []).map((item) => ({
              value: item.item_id,
              label:
                item.serial_number ||
                item.item_code ||
                item.item_id.slice(0, 8),
            }))}
            disabled={!line.can_reverse}
            placeholder="Chọn sản phẩm cần điều chỉnh"
            ariaLabel={`Chọn sản phẩm theo số sê-ri ${line.sku}`}
            onChange={(nextItemIds) =>
              setDraft((current) => ({
                ...current,
                [line.sku]: {
                  ...current[line.sku],
                  item_ids: nextItemIds,
                },
              }))
            }
          />
        ) : (
          <Box sx={{ typography: "body2", color: "text.secondary" }}>
            Không quản lý theo số sê-ri
          </Box>
        ),
    },
    {
      key: "dependency",
      header: "Kiểm tra phụ thuộc",
      width: 170,
      render: (line) => (
        <UiStatusBadge
          tone={line.dependency_guard ? "error" : "success"}
          label={line.dependency_guard ? "Đang bị chặn" : "Đạt"}
        />
      ),
    },
  ];

  return (
    <>
      <UiDialog
        {...dialog.dialogProps}
        maxWidth="lg"
        fullWidth
        title={
          <Box sx={{ position: "relative", pr: 6 }}>
            Tạo phiếu điều chỉnh tồn kho
            <ActionIconButton
              kind="close"
              label="Đóng"
              onClick={dialog.close}
              sx={{ position: "absolute", right: -8, top: -4 }}
            />
          </Box>
        }
      >
        <Stack spacing={2}>
          <UiAlert tone="info" title="Giao dịch gốc luôn được giữ nguyên">
            Hệ thống tạo một giao dịch điều chỉnh đối ứng thay vì sửa hoặc xóa
            giao dịch gốc. Các giới hạn số lượng và điều kiện phụ thuộc được
            kiểm tra tự động trước khi ghi nhận.
          </UiAlert>

          <UiTextField
            value={search}
            placeholder="Tìm mã biến động / chứng từ gốc..."
            slotProps={{
              htmlInput: { "aria-label": "Tìm giao dịch có thể điều chỉnh" },
            }}
            onChange={(event) => {
              setSearch(event.target.value);
              setMovementsPage(1);
            }}
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

          <Box>
            <ResponsiveDataTable<ReversibleMovement>
              columns={movementColumns}
              rows={pagedMovements}
              rowKey={(row) => row.id}
              loading={movementsQuery.isLoading}
              emptyText="Chưa có giao dịch nào có thể điều chỉnh"
              onRowClick={(row) => handleSelectMovement(row)}
            />
            {movementsPageCount > 1 ? (
              <Box sx={{ mt: 1 }}>
                <UiPagination
                  page={safeMovementsPage}
                  pageSize={MOVEMENTS_PAGE_SIZE}
                  total={movements.length}
                  onPageChange={setMovementsPage}
                />
              </Box>
            ) : null}
          </Box>

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
              <Box sx={{ typography: "subtitle2", fontWeight: 700, mb: 1.5 }}>
                Điều chỉnh từ {selectedMovement.movement_code}
              </Box>

              <Grid container spacing={2} sx={{ mb: 1.5 }}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Box
                    sx={{
                      typography: "caption",
                      color: "text.secondary",
                      display: "block",
                    }}
                  >
                    Chứng từ nguồn
                  </Box>
                  <Box sx={{ typography: "body2" }}>
                    {businessLabel(
                      SOURCE_DOCUMENT_TYPE_LABELS,
                      selectedMovement.source_document_type,
                      "Chứng từ khác",
                    )}{" "}
                    ·{" "}
                    {selectedMovement.source_document_code ||
                      selectedMovement.source_document_id}
                  </Box>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Box
                    sx={{
                      typography: "caption",
                      color: "text.secondary",
                      display: "block",
                    }}
                  >
                    Khả năng điều chỉnh
                  </Box>
                  <Box
                    sx={{
                      typography: "body2",
                      color: selectedMovement.can_reverse
                        ? "success.main"
                        : "error.main",
                    }}
                  >
                    {selectedMovement.can_reverse
                      ? "Có thể điều chỉnh"
                      : "Đang bị chặn"}
                  </Box>
                </Grid>
              </Grid>

              {selectedMovement.dependency_guard ? (
                <Box sx={{ mb: 1.5 }}>
                  <UiAlert tone="warning" title="Còn nghiệp vụ phụ thuộc">
                    Giao dịch này chưa thể điều chỉnh ngay vì còn dữ liệu hoặc
                    nghiệp vụ phát sinh sau đó. Cần xử lý các nghiệp vụ liên
                    quan theo thứ tự ngược trước.
                  </UiAlert>
                </Box>
              ) : null}

              <Stack spacing={2} sx={{ mt: 1.5 }}>
                <UiTextField
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
                    <Box sx={{ maxWidth: 420 }}>
                      <UiSelect
                        fullWidth
                        label="Tình trạng hàng trả về"
                        value={returnCondition}
                        data-testid="reversal-create-return-condition"
                        options={RETURN_CONDITION_OPTIONS}
                        onChange={(value) =>
                          setReturnCondition(value as ReversalReturnCondition)
                        }
                      />
                      <Box
                        sx={{
                          typography: "caption",
                          color: "text.secondary",
                          display: "block",
                          mt: 0.5,
                        }}
                      >
                        Chỉ hàng có thể bán/xuất lại mới được cộng trở lại số
                        lượng khả dụng. Hàng lỗi hoặc không thể bán/xuất vẫn
                        được ghi nhận nhưng không cộng vào tồn khả dụng.
                      </Box>
                    </Box>
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
                        <Box
                          sx={{
                            typography: "caption",
                            color: "warning.main",
                            display: "block",
                          }}
                        >
                          Chỉ được hoàn tất điều chỉnh xuất kho khi hàng vật lý
                          đã quay lại kho.
                        </Box>
                      ) : null}
                    </Box>
                  </>
                ) : null}
              </Stack>

              <Box sx={{ mt: 2 }}>
                <ResponsiveDataTable<ReversibleMovementLine>
                  columns={lineColumns}
                  rows={selectedMovement.lines}
                  rowKey={(line) => line.id}
                  emptyText="Chưa có dòng nào"
                />
              </Box>

              {serialLineMismatch ? (
                <Box sx={{ mt: 1.5 }}>
                  <UiAlert tone="error">
                    {`SKU ${serialLineMismatch.sku}: phải chọn đúng ${serialLineMismatch.reversal_qty} sản phẩm theo số sê-ri (đang chọn ${serialLineMismatch.item_ids.length}).`}
                  </UiAlert>
                </Box>
              ) : null}

              {invalidLine ? (
                <Box sx={{ mt: 1.5 }}>
                  <UiAlert tone="error">
                    {`Số lượng điều chỉnh của ${invalidLine.sku} vượt số lượng còn có thể điều chỉnh.`}
                  </UiAlert>
                </Box>
              ) : null}

              {missingReferenceVersion ? (
                <Box sx={{ mt: 1.5 }} data-testid="reversal-missing-version">
                  <UiAlert
                    tone="error"
                    title="Dữ liệu chứng từ gốc chưa đủ để tạo phiếu điều chỉnh"
                  >
                    Hãy làm mới danh sách và chọn lại giao dịch trước khi tiếp
                    tục.
                  </UiAlert>
                </Box>
              ) : null}

              <Box sx={{ mt: 1.5 }}>
                <UiAlert
                  tone={selectedMovement.can_reverse ? "success" : "error"}
                  title={
                    selectedMovement.can_reverse
                      ? `Kiểm tra phụ thuộc: Đạt · tổng số lượng có thể điều chỉnh = ${qty(
                          selectedMovement.lines.reduce(
                            (sum, line) => sum + line.reversible_qty,
                            0,
                          ),
                        )}`
                      : "Kiểm tra phụ thuộc: Đang bị chặn"
                  }
                >
                  {selectedMovement.can_reverse
                    ? `Ảnh hưởng dự kiến đến tồn khả dụng: ${
                        availableDelta === 0
                          ? "không thay đổi"
                          : `${availableDelta > 0 ? "+" : ""}${qty(availableDelta)}`
                      }. Giao dịch gốc vẫn được giữ nguyên.`
                    : "Cần xử lý các nghiệp vụ phụ thuộc theo thứ tự ngược trước khi điều chỉnh giao dịch này."}
                </UiAlert>
              </Box>

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
                  <Box
                    sx={{
                      typography: "caption",
                      color: "text.secondary",
                      display: "block",
                    }}
                  >
                    Tổng số lượng điều chỉnh
                  </Box>
                  <Box sx={{ typography: "h6" }}>{qty(totalQty)}</Box>
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
            <Box sx={{ typography: "body2", color: "text.secondary" }}>
              Chọn giao dịch gốc ở bảng trên để xem số lượng còn có thể điều
              chỉnh và các điều kiện liên quan.
            </Box>
          )}
        </Stack>
      </UiDialog>

      <UiDialog
        open={submitConfirmOpen}
        onClose={() => setSubmitConfirmOpen(false)}
        maxWidth="xs"
        fullWidth
        title="Tạo phiếu điều chỉnh tồn kho?"
        actions={
          <>
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
          </>
        }
      >
        <Stack spacing={1}>
          <Box sx={{ typography: "body2" }}>
            Giao dịch gốc {selectedMovement?.movement_code} sẽ được giữ nguyên.
            Hệ thống tạo giao dịch đối ứng và kiểm tra các nghiệp vụ phụ thuộc
            trước khi thay đổi tồn kho.
          </Box>
          <Box sx={{ typography: "body2", fontWeight: 700 }}>
            {selectedLines.length} dòng, tổng số lượng {qty(totalQty)}
          </Box>
          {isIssueReversal ? (
            <Box sx={{ typography: "body2" }}>
              Tình trạng hàng trả về:{" "}
              <strong>
                {businessLabel(
                  RETURN_CONDITION_LABELS,
                  returnCondition,
                  "Chưa xác định",
                )}
              </strong>
              . Đã xác nhận hàng vật lý quay lại kho.
            </Box>
          ) : null}
        </Stack>
      </UiDialog>
    </>
  );
}
