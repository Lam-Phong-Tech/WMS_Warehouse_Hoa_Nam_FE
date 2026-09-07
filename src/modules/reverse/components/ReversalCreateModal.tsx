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
  UiNumberField,
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
import { formatQuantity } from "@/shared/utils/format-number";
import { useDialogExit } from "@/shared/utils/useDialogExit";
import { ActionButton, ActionIconButton } from "@/shared/components/actions";
import { EMPTY_TEXT } from "@/shared/constants/display";
import { useT, type TranslateFn } from "@/shared/i18n/useT";
import { checkNumber, type NumberRule } from "@/shared/validation/number-rules";
import { TEXT_RULES, checkText } from "@/shared/validation/text-rules";

/**
 * Lý do điều chỉnh: luật lấy từ lớp dùng chung (bắt buộc, 5…1000 ký tự, đếm
 * SAU KHI TRIM). Trước 06/09/2026 ô này đo `reason.length` còn nút Tạo đo
 * `reason.trim().length` — gõ 5 dấu cách thì ô sạch mà nút vẫn xám.
 */
const REASON_RULE = TEXT_RULES.reason;
const REASON_MAX = REASON_RULE.max;

/** Luật số lượng đảo theo từng dòng: nguyên, 0 … còn có thể điều chỉnh. */
function reversalQtyRule(reversibleQty: number): NumberRule {
  return { min: 0, max: reversibleQty, integer: true };
}

const returnConditionOptions = (
  t: TranslateFn,
): Array<{
  value: ReversalReturnCondition;
  label: string;
}> => [
  { value: "SELLABLE", label: t("reverse.returnCondition.sellable") },
  { value: "DEFECTIVE", label: t("reverse.returnCondition.defective") },
  { value: "NON_SELLABLE", label: t("reverse.returnCondition.nonSellable") },
];

const MOVEMENTS_PAGE_SIZE = 5;

type ReversalDraft = Record<
  string,
  // reversal_qty giữ CHUỖI đang gõ: "-1"/"1.5" phải hiện lỗi trên dòng thay vì
  // bị Number() ép về 0 rồi rơi khỏi danh sách trong im lặng.
  { reversal_qty?: string; reason?: string; item_ids?: string[] }
>;

function idempotencyKey() {
  return `reversal-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function qty(value?: number) {
  return formatQuantity(Number(value ?? 0));
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
  const t = useT();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const selected = options.filter((option) => value.includes(option.value));
  const summary =
    selected.length === 0
      ? placeholder
      : selected.length <= 2
        ? selected.map((option) => option.label).join(", ")
        : t("reverse.create.selectedCount", { count: selected.length });

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
          <MenuItem disabled>{t("reverse.create.noAvailableItems")}</MenuItem>
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
  const t = useT();
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

  // Trạng thái từng dòng có thể đảo: số đã parse qua checkNumber + lỗi (nếu có).
  const lineStates = useMemo(() => {
    if (!selectedMovement) return [];
    return selectedMovement.lines
      .filter((line) => line.can_reverse)
      .map((line) => {
        const raw = draft[line.sku]?.reversal_qty ?? "";
        const check = checkNumber(raw, reversalQtyRule(line.reversible_qty));
        return {
          sku: line.sku,
          reversal_qty: check.ok ? (check.value ?? 0) : 0,
          qty_error: check.ok ? undefined : check.message,
          // Ô sai nhưng vẫn là số (vd "99" > còn lại): giữ câu "vượt" quen thuộc.
          qty_exceeds: !check.ok && Number(raw) > line.reversible_qty,
          reason: draft[line.sku]?.reason,
          max: line.reversible_qty,
          item_scoped: Boolean(line.item_scoped),
          item_ids: draft[line.sku]?.item_ids ?? [],
        };
      });
  }, [draft, selectedMovement]);
  const lineStateBySku = useMemo(
    () => new Map(lineStates.map((state) => [state.sku, state])),
    [lineStates],
  );
  const selectedLines = useMemo(
    () => lineStates.filter((line) => line.reversal_qty > 0),
    [lineStates],
  );

  // Item-scoped (PRODUCT hoặc serial): phải chọn đúng số Item = số lượng đảo.
  const itemLineMismatch = selectedLines.find(
    (line) => line.item_scoped && line.item_ids.length !== line.reversal_qty,
  );
  const totalQty = selectedLines.reduce(
    (sum, line) => sum + line.reversal_qty,
    0,
  );
  // Dòng nhập sai (âm, thập phân, vượt còn lại) chặn gửi kể cả khi không được
  // tính vào selectedLines — không bao giờ "bỏ qua" ô sai.
  const invalidLine = lineStates.find((line) => line.qty_error);
  const isIssueReversal = isStockRestoringMovement(
    selectedMovement?.movement_type,
  );
  const availableDelta =
    (isIssueReversal ? (returnCondition === "SELLABLE" ? 1 : 0) : -1) *
    totalQty;
  const missingReferenceVersion =
    Boolean(selectedMovement) && !selectedMovement?.version;
  // MỘT phép kiểm duy nhất cho cả câu lỗi dưới ô lẫn trạng thái nút lưu.
  const reasonCheck = checkText(reason, REASON_RULE);
  const canSubmit =
    Boolean(selectedMovement?.can_reverse) &&
    !missingReferenceVersion &&
    selectedLines.length > 0 &&
    totalQty > 0 &&
    reasonCheck.ok &&
    !invalidLine &&
    !itemLineMismatch &&
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
              reversal_qty: String(defaultQty),
              reason: line.dependency_guard,
              item_ids: line.item_scoped
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
      // Gửi chuỗi đã trim — cùng chuỗi mà checkText đã đo, không để BE nhận
      // "  lý do  " trong khi FE đếm 5 ký tự trên bản đã cắt.
      reason: reason.trim(),
      ...(isIssueReversal
        ? {
            return_condition: returnCondition,
            physical_return_confirmed: physicalConfirmed,
          }
        : {}),
      lines: selectedLines.flatMap(
        ({ sku, reversal_qty, reason: lineReason, item_scoped, item_ids }) =>
          item_scoped
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
        t("reverse.create.created", { code: created.reversal_code }),
      );
      setSubmitConfirmOpen(false);
      onCreated(created.reversal_code, created.id);
    } catch (submitError) {
      const normalized = normalizeError(submitError);
      toast.error(
        normalized.status === 409 ||
          normalized.status === 412 ||
          normalized.status === 428
          ? t("reverse.create.staleError", { message: normalized.message })
          : getApiErrorMessage(submitError, t("reverse.create.createError")),
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
          <UiStatusBadge tone="primary" label={t("reverse.create.selecting")} />
        ) : null,
    },
    {
      key: "movement_code",
      header: t("reverse.create.colMovementCode"),
      width: 150,
      render: (row) => row.movement_code,
    },
    {
      key: "movement_type",
      header: t("reverse.create.colType"),
      width: 170,
      render: (row) =>
        businessLabel(
          MOVEMENT_TYPE_LABELS,
          row.movement_type,
          t("reverse.create.movementOther"),
        ),
    },
    {
      key: "source",
      header: t("reverse.create.colSourceDoc"),
      width: 180,
      render: (row) => (
        <Stack spacing={0}>
          {/* KHÔNG fallback sang source_document_id (UUID) — thiếu mã thì "—". */}
          <span>{row.source_document_code || EMPTY_TEXT}</span>
          <Box sx={{ typography: "caption", color: "text.secondary" }}>
            {businessLabel(
              SOURCE_DOCUMENT_TYPE_LABELS,
              row.source_document_type,
              t("reverse.common.docTypeOther"),
            )}
          </Box>
        </Stack>
      ),
    },
    {
      key: "warehouse_name",
      header: t("reverse.create.colWarehouse"),
      width: 140,
      render: (row) => row.warehouse_name,
    },
    {
      key: "posted_at",
      header: t("reverse.create.colPostedAt"),
      width: 160,
      render: (row) => formatDateTime(row.posted_at),
    },
    {
      key: "reversibility",
      header: t("reverse.create.colReversibility"),
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
            ? t("reverse.create.blockedByDependency")
            : t("reverse.create.canReverse")}
        </Box>
      ),
    },
  ];

  const lineColumns: ResponsiveTableColumn<ReversibleMovementLine>[] = [
    { key: "sku", header: "SKU", width: 130, render: (line) => line.sku },
    {
      key: "sku_name",
      header: t("reverse.columns.name"),
      width: 160,
      render: (line) => line.sku_name,
    },
    {
      key: "original_qty",
      header: t("reverse.columns.originalQty"),
      width: 110,
      align: "right",
      render: (line) => qty(line.original_qty),
    },
    {
      key: "reversed_qty",
      header: t("reverse.columns.reversedQty"),
      width: 110,
      align: "right",
      render: (line) => qty(line.reversed_qty),
    },
    {
      key: "reversible_qty",
      header: t("reverse.columns.reversibleQty"),
      width: 150,
      align: "right",
      render: (line) => <strong>{qty(line.reversible_qty)}</strong>,
    },
    {
      key: "reversal_qty",
      header: t("reverse.columns.reversalQty"),
      width: 150,
      render: (line) => (
        <UiNumberField
          size="small"
          fullWidth
          disabled={!line.can_reverse}
          rule={reversalQtyRule(line.reversible_qty)}
          value={draft[line.sku]?.reversal_qty ?? "0"}
          error={Boolean(lineStateBySku.get(line.sku)?.qty_error)}
          helperText={lineStateBySku.get(line.sku)?.qty_error}
          slotProps={{
            htmlInput: {
              "aria-label": t("reverse.create.qtyAria", { sku: line.sku }),
            },
          }}
          onChange={(next) =>
            setDraft((current) => ({
              ...current,
              [line.sku]: {
                ...current[line.sku],
                reversal_qty: next,
              },
            }))
          }
        />
      ),
    },
    {
      key: "serial_items",
      // PRODUCT (kể cả non-serial) đảo theo từng Item/máy; nhãn item lấy số sê-ri
      // nếu có, không thì mã vật lý (physical code).
      header: t("reverse.create.colItems"),
      width: 260,
      render: (line) =>
        line.item_scoped ? (
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
            placeholder={t("reverse.create.itemsPlaceholder")}
            ariaLabel={t("reverse.create.itemsAria", { sku: line.sku })}
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
            {t("reverse.create.byQty")}
          </Box>
        ),
    },
    {
      key: "dependency",
      header: t("reverse.create.colDependency"),
      width: 170,
      render: (line) => (
        <UiStatusBadge
          tone={line.dependency_guard ? "error" : "success"}
          label={
            line.dependency_guard
              ? t("reverse.create.blocked")
              : t("reverse.create.pass")
          }
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
            {t("reverse.create.title")}
            <ActionIconButton
              kind="close"
              label={t("common.close")}
              onClick={dialog.close}
              sx={{ position: "absolute", right: -8, top: -4 }}
            />
          </Box>
        }
      >
        <Stack spacing={2}>
          <UiAlert tone="info" title={t("reverse.create.alertKeptTitle")}>
            {t("reverse.create.alertKeptBody")}
          </UiAlert>

          <UiTextField
            value={search}
            placeholder={t("reverse.create.searchPlaceholder")}
            slotProps={{
              htmlInput: { "aria-label": t("reverse.create.searchAria") },
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
              title={t("reverse.create.loadError")}
              onRetry={() => movementsQuery.refetch()}
            />
          ) : null}

          <Box>
            <ResponsiveDataTable<ReversibleMovement>
              columns={movementColumns}
              rows={pagedMovements}
              rowKey={(row) => row.id}
              loading={movementsQuery.isLoading}
              emptyText={t("reverse.create.movementsEmpty")}
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
                {t("reverse.create.fromMovement", {
                  code: selectedMovement.movement_code,
                })}
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
                    {t("reverse.create.sourceDocLabel")}
                  </Box>
                  <Box sx={{ typography: "body2" }}>
                    {businessLabel(
                      SOURCE_DOCUMENT_TYPE_LABELS,
                      selectedMovement.source_document_type,
                      t("reverse.common.docTypeOther"),
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
                    {t("reverse.create.colReversibility")}
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
                      ? t("reverse.create.canReverse")
                      : t("reverse.create.blocked")}
                  </Box>
                </Grid>
              </Grid>

              {selectedMovement.dependency_guard ? (
                <Box sx={{ mb: 1.5 }}>
                  <UiAlert
                    tone="warning"
                    title={t("reverse.create.dependencyAlertTitle")}
                  >
                    {t("reverse.create.dependencyAlertBody")}
                  </UiAlert>
                </Box>
              ) : null}

              <Stack spacing={2} sx={{ mt: 1.5 }}>
                <UiTextField
                  label={t("reverse.create.reasonLabel")}
                  required
                  fullWidth
                  multiline
                  minRows={2}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder={t("reverse.create.reasonPlaceholder")}
                  slotProps={{ htmlInput: { maxLength: REASON_MAX } }}
                  error={Boolean(reason) && !reasonCheck.ok}
                  helperText={
                    reason && !reasonCheck.ok
                      ? t("reverse.create.reasonHelper")
                      : undefined
                  }
                />

                {isIssueReversal ? (
                  <>
                    <Box sx={{ maxWidth: 420 }}>
                      <UiSelect
                        fullWidth
                        label={t("reverse.create.returnConditionLabel")}
                        value={returnCondition}
                        data-testid="reversal-create-return-condition"
                        options={returnConditionOptions(t)}
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
                        {t("reverse.create.returnConditionHint")}
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
                        label={t("reverse.create.physicalConfirm")}
                      />
                      {!physicalConfirmed ? (
                        <Box
                          sx={{
                            typography: "caption",
                            color: "warning.main",
                            display: "block",
                          }}
                        >
                          {t("reverse.create.physicalWarn")}
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
                  loading={movementsQuery.isFetching}
                  emptyText={t("reverse.create.linesEmpty")}
                />
              </Box>

              {itemLineMismatch ? (
                <Box sx={{ mt: 1.5 }}>
                  <UiAlert tone="error">
                    {t("reverse.create.itemMismatch", {
                      sku: itemLineMismatch.sku,
                      qty: itemLineMismatch.reversal_qty,
                      selected: itemLineMismatch.item_ids.length,
                    })}
                  </UiAlert>
                </Box>
              ) : null}

              {invalidLine ? (
                <Box sx={{ mt: 1.5 }}>
                  <UiAlert tone="error">
                    {invalidLine.qty_exceeds
                      ? t("reverse.create.qtyExceeds", { sku: invalidLine.sku })
                      : t("reverse.create.qtyInvalid", {
                          sku: invalidLine.sku,
                          message: invalidLine.qty_error ?? "",
                        })}
                  </UiAlert>
                </Box>
              ) : null}

              {missingReferenceVersion ? (
                <Box sx={{ mt: 1.5 }} data-testid="reversal-missing-version">
                  <UiAlert
                    tone="error"
                    title={t("reverse.create.missingVersionTitle")}
                  >
                    {t("reverse.create.missingVersionBody")}
                  </UiAlert>
                </Box>
              ) : null}

              <Box sx={{ mt: 1.5 }}>
                <UiAlert
                  tone={selectedMovement.can_reverse ? "success" : "error"}
                  title={
                    selectedMovement.can_reverse
                      ? t("reverse.create.depPassTitle", {
                          total: qty(
                            selectedMovement.lines.reduce(
                              (sum, line) => sum + line.reversible_qty,
                              0,
                            ),
                          ),
                        })
                      : t("reverse.create.depBlockedTitle")
                  }
                >
                  {selectedMovement.can_reverse
                    ? t("reverse.create.impactBody", {
                        delta:
                          availableDelta === 0
                            ? t("reverse.create.noChange")
                            : `${availableDelta > 0 ? "+" : ""}${qty(availableDelta)}`,
                      })
                    : t("reverse.create.depBlockedBody")}
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
                    {t("reverse.create.totalQtyLabel")}
                  </Box>
                  <Box sx={{ typography: "h6" }}>{qty(totalQty)}</Box>
                </Box>
                <ActionButton
                  kind="create"
                  disabled={!canSubmit || createMutation.isPending}
                  onClick={() => setSubmitConfirmOpen(true)}
                >
                  {createMutation.isPending
                    ? t("reverse.create.creating")
                    : t("reverse.create.submit")}
                </ActionButton>
              </Stack>
            </Box>
          ) : (
            <Box sx={{ typography: "body2", color: "text.secondary" }}>
              {t("reverse.create.pickHint")}
            </Box>
          )}
        </Stack>
      </UiDialog>

      <UiDialog
        open={submitConfirmOpen}
        onClose={() => setSubmitConfirmOpen(false)}
        maxWidth="xs"
        fullWidth
        title={t("reverse.create.confirmTitle")}
        actions={
          <>
            <ActionButton
              kind="refresh"
              onClick={() => setSubmitConfirmOpen(false)}
              disabled={submitBusy}
            >
              {t("reverse.common.recheck")}
            </ActionButton>
            <ActionButton
              kind="create"
              onClick={() => void doSubmit()}
              disabled={submitBusy}
            >
              {submitBusy
                ? t("reverse.create.creating")
                : t("reverse.create.submit")}
            </ActionButton>
          </>
        }
      >
        <Stack spacing={1}>
          <Box sx={{ typography: "body2" }}>
            {t("reverse.create.confirmBody", {
              code: selectedMovement?.movement_code ?? "",
            })}
          </Box>
          <Box sx={{ typography: "body2", fontWeight: 700 }}>
            {t("reverse.create.confirmSummary", {
              lines: selectedLines.length,
              qty: qty(totalQty),
            })}
          </Box>
          {isIssueReversal ? (
            <Box sx={{ typography: "body2" }}>
              {t("reverse.create.returnConditionLine")}{" "}
              <strong>
                {businessLabel(
                  RETURN_CONDITION_LABELS,
                  returnCondition,
                  t("reverse.common.unknown"),
                )}
              </strong>
              {t("reverse.create.physicalConfirmedNote")}
            </Box>
          ) : null}
        </Stack>
      </UiDialog>
    </>
  );
}
