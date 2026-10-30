import { rowIndexOfBy } from "@/shared/components/data-display/row-index";
import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Grid,
  Stack,
  UiAlert,
  // SKU linh kiện cần gõ-để-lọc trên toàn danh mục (catalog lớn, không thể tải
  // hết vào 1 dropdown) — cùng cách OutboundIntakeModal.tsx đã làm.
  UiAutocomplete,
  UiDialog,
  UiNumberField,
  UiStatusBadge,
  UiText,
  UiTextField,
} from "@/shared/ui";
import {
  NUMBER_RULES,
  checkNumber,
  type NumberRule,
} from "@/shared/validation/number-rules";
import {
  TEXT_LIMITS,
  TEXT_RULES,
  checkText,
  type TextRule,
} from "@/shared/validation/text-rules";
import {
  ResponsiveDataTable,
  type ResponsiveTableColumn,
} from "@/shared/components/data-display/ResponsiveDataTable";
import { CopyableId } from "@/shared/components/data-display/CopyableId";

/**
 * Lý do hủy phiếu xuất linh kiện: bắt buộc + SÀN 5 ký tự như mọi lý do khác
 * trong dự án (xuất kho, đảo kho, đồng bộ quyền). Trước 06/09/2026 ô này chỉ
 * cần khác rỗng — gõ đúng một chữ "x" là hủy được hồ sơ. Trần giữ 2000 theo ô
 * cũ, không siết xuống 1000 để không từ chối lý do BE vẫn nhận.
 */
const CANCEL_REASON_MAX = TEXT_LIMITS.noteMax;
const CANCEL_REASON_RULE: TextRule = {
  ...TEXT_RULES.reason,
  max: CANCEL_REASON_MAX,
};
import { SkuLink } from "@/shared/components/data-display/SkuLink";
import { shortId } from "@/shared/utils/shortId";
import {
  AnimatedList,
  AnimatedListItem,
} from "@/shared/components/motion/AnimatedList";
import { createRowKey } from "@/shared/components/motion/row-key";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { useActiveWarehouses } from "@/shared/data/reference-queries";
import dayjs from "dayjs";
import { guardBackdropClose } from "@/shared/utils/dialogGuard";
import { useDialogExit } from "@/shared/utils/useDialogExit";
import { useT } from "@/shared/i18n/useT";
import { CameraScanModal } from "@/shared/components/forms/CameraScanModal";
import { ScanInput } from "@/shared/components/forms/ScanInput";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import {
  classifyConcurrencyError,
  isRetryableAfterReload,
} from "@/shared/api/concurrency-contract";
import { useCanAny } from "@/shared/components/permission";
import { useMvpSkus } from "@/modules/master-data/hooks/use-mvp-master";
import { fetchAvailableQtyBySku } from "@/modules/outbound/services/alignedOutboundService";
import {
  useCancelComponentIssue,
  useComponentIssueDetail,
  useCreateComponentIssue,
  usePostComponentIssue,
  useScanComponentIssue,
} from "@/modules/warranty/hooks/use-warranty";
import { makeWarrantyIdempotencyKey } from "@/modules/warranty/services/warrantyService";
import { COMPONENT_ISSUE_STATUS_BADGE } from "@/modules/warranty/constants";
import { EMPTY_TEXT } from "@/shared/constants/display";
import { formatDate } from "@/shared/utils/format-date";
import type {
  ComponentIssueDocument,
  ComponentIssueLine,
} from "@/modules/warranty/services/componentIssueService";
import {
  ActionButton,
  ActionIconButton,
  RowActionButton,
} from "@/shared/components/actions";

interface DraftLineValue {
  /** Danh tính ổn định của dòng (xem createRowKey) — không gửi lên API. */
  key: string;
  sku_id: string;
  /**
   * Giữ CHUỖI người dùng gõ (không ép Number ngay) để "abc", "1e9", "-3" bị
   * `checkNumber` báo lỗi trên ô thay vì âm thầm thành 0/NaN rồi lọt lên API.
   */
  required_qty: string;
}

function emptyDraftLine(): DraftLineValue {
  return { key: createRowKey("comp-line"), sku_id: "", required_qty: "" };
}

/** SL cần / SL mỗi lần quét: nguyên, 1…1.000.000, bắt buộc nhập. */
const REQUIRED_QTY_RULE: NumberRule = {
  ...NUMBER_RULES.quantity,
  required: true,
};

/** Parse SL cần của một dòng; null khi rỗng/sai (đã có message riêng khi validate). */
function parseRequiredQty(raw: string): number | null {
  const check = checkNumber(raw, NUMBER_RULES.quantity);
  return check.ok ? check.value : null;
}

interface ComponentIssueModalProps {
  /** Optional screen-local presentation; shared business flow stays unchanged. */
  className?: string;
  caseId: string;
  caseCode?: string;
  caseActive: boolean;
  documentId?: string | null;
  onClose: () => void;
  onChanged?: () => void;
}

/**
 * COMP-01 · Xuất linh kiện cho bảo hành (BP-WMS-06).
 * DRAFT → SCANNING → POSTED/CANCELLED; purpose luôn WARRANTY và bắt buộc
 * warranty case active; full-post (mọi line scanned = required) mới trừ tồn.
 */
export function ComponentIssueModal({
  className,
  caseId,
  caseCode,
  caseActive,
  documentId: initialDocumentId,
  onClose,
  onChanged,
}: ComponentIssueModalProps) {
  const dialog = useDialogExit(onClose);
  const t = useT();
  const canIssue = useCanAny(["warranty.component_issue"]);
  const [documentId, setDocumentId] = useState<string | null>(
    initialDocumentId ?? null,
  );
  const [localVersion, setLocalVersion] = useState<number | null>(null);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [scanQuantity, setScanQuantity] = useState("1");
  const [scanQuantityError, setScanQuantityError] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelReasonError, setCancelReasonError] = useState("");
  const [recentCodes, setRecentCodes] = useState<string[]>([]);
  const [postConfirmOpen, setPostConfirmOpen] = useState(false);

  const [draftLines, setDraftLines] = useState<DraftLineValue[]>(() => [
    emptyDraftLine(),
  ]);
  const [draftNote, setDraftNote] = useState("");
  const [lineErrors, setLineErrors] = useState<
    Record<number, { sku_id?: string; required_qty?: string }>
  >({});

  const detailQuery = useComponentIssueDetail(documentId);
  const detail = detailQuery.data;
  const version = localVersion ?? detail?.version ?? null;

  /**
   * Thua race (412 STALE_VERSION / 409 CONCURRENCY_CONFLICT): `localVersion`
   * đang che `detail.version` nên dù hook mutation đã tải lại phiếu, lần thao
   * tác sau vẫn gửi ĐÚNG version cũ và nhận lại đúng lỗi cũ. Quên nó đi để
   * version quay về nguồn duy nhất là bản vừa tải lại.
   */
  const forgetStaleLocalVersion = (error: unknown) => {
    const outcome = classifyConcurrencyError(error);
    if (outcome !== null && isRetryableAfterReload(outcome)) {
      setLocalVersion(null);
    }
  };

  const warehousesQuery = useActiveWarehouses({ enabled: !documentId });
  const warehouse = warehousesQuery.data?.[0];
  // Catalog COMPONENT có thể lên tới hàng trăm/nghìn SKU — không thể cắt cứng
  // ở per_page (per_page=100 cũ khiến SKU nằm ngoài trang đầu không bao giờ
  // chọn được). Gõ-để-lọc gọi BE theo keyword (ProductRepository::$searchable
  // = sku_code/sku_name, LIKE cả 2 cột), cùng cách OutboundIntakeModal.tsx.
  const [skuKeyword, setSkuKeyword] = useState("");
  const skusQuery = useMvpSkus({
    sku_type: "COMPONENT",
    status: "ACTIVE",
    keyword: skuKeyword.trim(),
    per_page: 50,
  });
  // Giữ nguyên tham chiếu mảng options giữa các lần render (mỗi ký tự gõ vào
  // form đều render lại cả modal) để danh sách chọn SKU không phải dựng lại.
  const skuOptions = useMemo(
    () =>
      (skusQuery.data?.data ?? []).map((sku) => ({
        value: sku.sku_id,
        label: `${sku.sku_code} · ${sku.sku_name}`,
      })),
    [skusQuery.data],
  );

  // Nhãn hiển thị của SKU ĐÃ CHỌN phải bền vững qua mọi lần gõ tìm — nếu chỉ
  // dựa vào skuOptions (đổi theo keyword hiện tại), dòng đang không được gõ sẽ
  // mất nhãn ngay khi kết quả tìm kiếm của dòng khác không còn chứa SKU đó
  // (mọi dòng dùng chung 1 query keyword).
  const [skuLabelById, setSkuLabelById] = useState<Map<string, string>>(
    new Map(),
  );
  useEffect(() => {
    if (skuOptions.length === 0) return;
    setSkuLabelById((prev) => {
      let changed = false;
      const next = new Map(prev);
      for (const option of skuOptions) {
        if (next.get(option.value) !== option.label) {
          next.set(option.value, option.label);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [skuOptions]);

  // Tồn khả dụng theo SKU đang chọn ở form tạo phiếu — chặn tạo phiếu khi SL
  // cần vượt tồn thực tế đang có (yêu cầu nghiệp vụ: không như xuất sản phẩm,
  // xuất linh kiện phải CHẶN CỨNG chứ không chỉ cảnh báo).
  const draftSkuIds = useMemo(
    () => [...new Set(draftLines.map((line) => line.sku_id).filter(Boolean))],
    [draftLines],
  );
  const availabilityQuery = useQuery({
    queryKey: ["warranty", "component-issue-availability", draftSkuIds],
    queryFn: () => fetchAvailableQtyBySku(draftSkuIds),
    enabled: !documentId && draftSkuIds.length > 0,
  });
  // Nhiều dòng có thể cùng chọn một SKU — phải cộng dồn SL cần theo SKU rồi
  // mới so với tồn khả dụng, không so từng dòng riêng lẻ (tránh lọt trường
  // hợp 2 dòng x 1 cái cùng SKU nhưng kho chỉ có 1). Dùng chung cho cả
  // validate lúc submit lẫn tô đỏ ô "Khả dụng" ngay lúc gõ.
  const requiredBySkuId = useMemo(() => {
    const result: Record<string, number> = {};
    draftLines.forEach((line) => {
      const qty = parseRequiredQty(line.required_qty);
      if (!line.sku_id || qty === null) return;
      result[line.sku_id] = (result[line.sku_id] ?? 0) + qty;
    });
    return result;
  }, [draftLines]);

  const createMutation = useCreateComponentIssue();
  const scanMutation = useScanComponentIssue();
  const cancelMutation = useCancelComponentIssue();
  const postMutation = usePostComponentIssue();

  useEffect(() => {
    if (!selectedLineId && detail?.lines.length) {
      const pending = detail.lines.find(
        (line) => line.scanned_qty < line.required_qty,
      );
      setSelectedLineId((pending ?? detail.lines[0]).id);
    }
  }, [detail, selectedLineId]);

  const allLinesComplete = useMemo(
    () =>
      Boolean(detail?.lines.length) &&
      (detail?.lines ?? []).every(
        (line) => line.scanned_qty === line.required_qty,
      ),
    [detail],
  );
  const isOpenDocument =
    detail?.status === "DRAFT" || detail?.status === "SCANNING";

  const updateDraftLine = (index: number, patch: Partial<DraftLineValue>) => {
    setDraftLines((current) =>
      current.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    );
    if (lineErrors[index]) {
      setLineErrors((current) => {
        const next = { ...current };
        const lineError = { ...next[index] };
        if (patch.sku_id !== undefined) delete lineError.sku_id;
        if (patch.required_qty !== undefined) delete lineError.required_qty;
        if (Object.keys(lineError).length > 0) {
          next[index] = lineError;
        } else {
          delete next[index];
        }
        return next;
      });
    }
  };

  const validateDraftLines = (): boolean => {
    const errors: Record<number, { sku_id?: string; required_qty?: string }> =
      {};
    draftLines.forEach((line, index) => {
      const lineError: { sku_id?: string; required_qty?: string } = {};
      if (!line.sku_id) {
        lineError.sku_id = t("warranty.componentIssue.errSku");
      }
      const qtyCheck = checkNumber(line.required_qty, REQUIRED_QTY_RULE);
      if (!qtyCheck.ok) {
        lineError.required_qty = qtyCheck.message;
      } else if (line.sku_id) {
        const available = availabilityQuery.data?.[line.sku_id];
        if (available === undefined) {
          lineError.required_qty = t(
            "warranty.componentIssue.errAvailabilityUnknown",
          );
        } else if (requiredBySkuId[line.sku_id] > available) {
          lineError.required_qty = t(
            "warranty.componentIssue.errOverAvailable",
            { available },
          );
        }
      }
      if (Object.keys(lineError).length > 0) {
        errors[index] = lineError;
      }
    });
    setLineErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreate = async () => {
    if (!validateDraftLines()) return;
    if (!warehouse?.id) {
      toast.error(t("warranty.componentIssue.errNoWarehouse"));
      return;
    }
    try {
      const created = await createMutation.mutateAsync({
        warehouse_id: String(warehouse.id),
        warranty_case_id: caseId,
        document_date: dayjs().format("YYYY-MM-DD"),
        note: draftNote.trim() || undefined,
        // Gửi số đã parse từ checkNumber (validateDraftLines đã chặn dòng sai).
        lines: draftLines
          .map((line) => ({
            sku_id: String(line.sku_id),
            required_qty: parseRequiredQty(line.required_qty),
          }))
          .filter(
            (line): line is { sku_id: string; required_qty: number } =>
              Boolean(line.sku_id) && line.required_qty !== null,
          ),
      });
      toast.success(
        t("warranty.componentIssue.created", {
          code: created.component_issue_no,
        }),
      );
      setDocumentId(created.id);
      setLocalVersion(created.version);
      onChanged?.();
    } catch (error) {
      forgetStaleLocalVersion(error);
      // Toast lỗi đã hiện qua onError của createMutation (use-warranty.ts) —
      // bắt ở đây chỉ để mutateAsync() không ném unhandled rejection.
    }
  };

  const handleScan = async (code: string) => {
    if (!detail || !documentId) return;
    const line = detail.lines.find((item) => item.id === selectedLineId);
    if (!line) {
      toast.warning(t("warranty.componentIssue.pickLineFirst"));
      return;
    }
    if (version === null) return;
    // SL mỗi lần quét phải hợp lệ trước khi gọi API — lỗi hiện trên ô, không
    // âm thầm ép về 1 như trước.
    const qtyCheck = checkNumber(scanQuantity, REQUIRED_QTY_RULE);
    if (!qtyCheck.ok || qtyCheck.value === null) {
      setScanQuantityError(
        qtyCheck.ok ? t("warranty.componentIssue.errQty") : qtyCheck.message,
      );
      return;
    }
    const quantity = qtyCheck.value;
    try {
      const result = await scanMutation.mutateAsync({
        documentId,
        lineId: line.id,
        codeValue: code,
        quantity,
        ifMatch: version,
      });
      setLocalVersion(result.version);
      setRecentCodes((current) => [code, ...current].slice(0, 30));
      toast.success(
        t("warranty.componentIssue.scanned", {
          qty: quantity,
          sku: line.sku_code,
          scanned: result.scanned_qty,
          required: line.required_qty,
        }),
      );
      onChanged?.();
    } catch (error) {
      forgetStaleLocalVersion(error);
      // Toast lỗi đã hiện qua onError của scanMutation (use-warranty.ts).
    }
  };

  const handleCancel = async () => {
    if (!documentId || version === null) return;
    const reasonCheck = checkText(cancelReason, CANCEL_REASON_RULE);
    if (!reasonCheck.ok) {
      const message =
        reasonCheck.reason === "required"
          ? t("warranty.componentIssue.needCancelReason")
          : t("warranty.componentIssue.cancelReasonShort", {
              min: TEXT_LIMITS.reasonMin,
            });
      setCancelReasonError(message);
      toast.warning(message);
      return;
    }
    try {
      const result = await cancelMutation.mutateAsync({
        documentId,
        // Chuỗi đã trim do checkText trả về — không trim lại lần hai.
        reason: reasonCheck.value,
        ifMatch: version,
      });
      setLocalVersion(result.version);
      setCancelOpen(false);
      toast.success(t("warranty.componentIssue.cancelled"));
      onChanged?.();
    } catch (error) {
      forgetStaleLocalVersion(error);
      // Toast lỗi đã hiện qua onError của cancelMutation (use-warranty.ts).
    }
  };

  const handlePost = async () => {
    if (!documentId || version === null) return;
    try {
      const result = await postMutation.mutateAsync({
        documentId,
        ifMatch: version,
        idempotencyKey: makeWarrantyIdempotencyKey(
          `component-post-${documentId}`,
        ),
      });
      setLocalVersion(result.version);
      setPostConfirmOpen(false);
      toast.success(
        t("warranty.componentIssue.posted", {
          count: result.movement_ids.length,
        }),
      );
      onChanged?.();
    } catch (error) {
      forgetStaleLocalVersion(error);
      // Toast lỗi đã hiện qua onError của postMutation (use-warranty.ts).
    }
  };

  // Bấm vào dòng để chọn dòng quét; dòng đang chọn tô màu primary ở cột "#"
  // và SKU (ResponsiveDataTable không có highlight nền cả dòng như antd Table).
  const lineColumns: ResponsiveTableColumn<ComponentIssueLine>[] = [
    {
      key: "line_no",
      header: "#",
      width: 48,
      render: (line) => (
        <Box
          component="span"
          sx={
            line.id === selectedLineId
              ? { fontWeight: 600, color: "primary.main" }
              : undefined
          }
        >
          {rowIndexOfBy(detail?.lines ?? [], line, (item) => item.id) + 1}
        </Box>
      ),
    },
    {
      key: "sku",
      header: t("warranty.componentIssue.colComponent"),
      render: (line) => (
        <Stack spacing={0}>
          <Box
            component="span"
            sx={{
              fontWeight: 600,
              color: line.id === selectedLineId ? "primary.main" : undefined,
            }}
          >
            <SkuLink id={line.sku_id} code={line.sku_code} />
          </Box>
          <UiText variant="secondary">{line.sku_name}</UiText>
        </Stack>
      ),
    },
    {
      key: "progress",
      header: t("warranty.componentIssue.colProgress"),
      width: 140,
      render: (line) => (
        <UiStatusBadge
          tone={line.scanned_qty === line.required_qty ? "success" : "info"}
          label={`${line.scanned_qty} / ${line.required_qty}`}
        />
      ),
    },
    {
      key: "items",
      header: t("warranty.componentIssue.colScanKind"),
      render: (line) => {
        const active = line.items.filter((item) => item.status !== "REMOVED");
        if (!active.length)
          return <UiText variant="secondary">{EMPTY_TEXT}</UiText>;
        return (
          <Stack spacing={0}>
            {active.map((item) => (
              <UiText key={item.id} variant="caption">
                {item.item_id
                  ? t("warranty.componentIssue.scanPerItem")
                  : t("warranty.componentIssue.scanPerBox")}{" "}
                × {item.quantity}
              </UiText>
            ))}
          </Stack>
        );
      },
    },
  ];

  return (
    <UiDialog
      className={className}
      {...dialog.dialogProps}
      maxWidth="md"
      title={
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
          }}
        >
          <Box component="span">
            {documentId
              ? t("warranty.componentIssue.titleExisting", {
                  code: detail?.component_issue_no ?? "",
                })
              : t("warranty.componentIssue.titleNew", {
                  code: caseCode ?? shortId(caseId),
                })}
          </Box>
          <ActionIconButton
            kind="close"
            label={t("common.close")}
            onClick={dialog.close}
          />
        </Box>
      }
      actions={
        documentId && !isOpenDocument ? null : (
          <>
            {documentId && isOpenDocument ? (
              <>
                <ActionButton
                  kind="deactivate"
                  disabled={!canIssue || cancelMutation.isPending}
                  onClick={() => setCancelOpen(true)}
                >
                  {t("warranty.componentIssue.cancelTrigger")}
                </ActionButton>
                <ActionButton
                  kind="approve"
                  disabled={
                    !canIssue || !allLinesComplete || postMutation.isPending
                  }
                  onClick={() => setPostConfirmOpen(true)}
                >
                  {t("warranty.componentIssue.postTrigger")}
                </ActionButton>
              </>
            ) : null}
            {!documentId ? (
              <ActionButton
                kind="create"
                disabled={!canIssue || !caseActive || createMutation.isPending}
                onClick={() => void handleCreate()}
              >
                {createMutation.isPending
                  ? t("warranty.componentIssue.creating")
                  : t("warranty.componentIssue.create")}
              </ActionButton>
            ) : null}
          </>
        )
      }
    >
      <Stack spacing={2} sx={{ mt: 0.5 }}>
        {!caseActive && !documentId ? (
          <UiAlert tone="error">
            {t("warranty.componentIssue.caseInactive")}
          </UiAlert>
        ) : null}

        {!documentId ? (
          <Stack spacing={2}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Box>
                  <UiText variant="caption">
                    {t("warranty.componentIssue.warehouse")}
                  </UiText>
                </Box>
                <UiText variant="body">
                  {warehouse
                    ? `${String(warehouse.code ?? warehouse.warehouse_code ?? "")} · ${String(
                        warehouse.name ?? warehouse.warehouse_name ?? "",
                      )}`
                    : warehousesQuery.isLoading
                      ? t("warranty.componentIssue.warehouseLoading")
                      : t("warranty.componentIssue.warehouseNone")}
                </UiText>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Box>
                  <UiText variant="caption">
                    {t("warranty.componentIssue.caseCode")}
                  </UiText>
                </Box>
                <UiText variant="body">
                  {caseCode ?? <CopyableId value={caseId} />}
                </UiText>
              </Grid>
            </Grid>

            <Stack spacing={1.25}>
              {/* Thêm/xóa dòng linh kiện chạy hiệu ứng trượt-mở/thu-gọn. */}
              <AnimatedList>
                {draftLines.map((line, index) => (
                  <AnimatedListItem key={line.key} gap={10}>
                    <Stack
                      direction="row"
                      spacing={1.5}
                      sx={{
                        alignItems: "flex-start",
                        flexWrap: "wrap",
                        rowGap: 1,
                      }}
                    >
                      <UiAutocomplete
                        sx={{ minWidth: 360 }}
                        options={
                          // Giữ nhãn của SKU ĐANG CHỌN kể cả khi nó rơi ra ngoài
                          // kết quả tìm kiếm hiện tại: UiAutocomplete tra nhãn
                          // từ chính mảng options, thiếu dòng này thì ô hiện
                          // trống ngay khi người dùng gõ một từ khoá khác.
                          line.sku_id &&
                          !skuOptions.some(
                            (option) => option.value === line.sku_id,
                          )
                            ? [
                                {
                                  value: line.sku_id,
                                  label:
                                    skuLabelById.get(line.sku_id) ??
                                    line.sku_id,
                                },
                                ...skuOptions,
                              ]
                            : skuOptions
                        }
                        value={line.sku_id || null}
                        onChange={(next) =>
                          updateDraftLine(index, {
                            sku_id: next === null ? "" : String(next),
                          })
                        }
                        onInputChange={setSkuKeyword}
                        required
                        label={t("warranty.componentIssue.skuLabel")}
                        placeholder={t(
                          "warranty.componentIssue.skuPlaceholder",
                        )}
                        error={Boolean(lineErrors[index]?.sku_id)}
                        helperText={lineErrors[index]?.sku_id}
                        loading={skusQuery.isFetching}
                        noOptionsText={
                          skuKeyword.trim()
                            ? t("warranty.componentIssue.skuNoMatch")
                            : t("warranty.componentIssue.skuTypeToSearch")
                        }
                      />
                      <UiNumberField
                        required
                        rule={NUMBER_RULES.quantity}
                        label={t("warranty.componentIssue.qtyLabel")}
                        value={line.required_qty}
                        onChange={(next) =>
                          updateDraftLine(index, { required_qty: next })
                        }
                        error={Boolean(lineErrors[index]?.required_qty)}
                        helperText={lineErrors[index]?.required_qty}
                        sx={{ width: 130 }}
                      />
                      {!documentId && line.sku_id
                        ? (() => {
                            const available =
                              availabilityQuery.data?.[line.sku_id];
                            const exceeds =
                              available !== undefined &&
                              (requiredBySkuId[line.sku_id] ?? 0) > available;
                            return (
                              <UiStatusBadge
                                tone={exceeds ? "error" : "neutral"}
                                label={t("warranty.componentIssue.available", {
                                  qty:
                                    available ??
                                    (availabilityQuery.isLoading
                                      ? "..."
                                      : EMPTY_TEXT),
                                })}
                                sx={{ fontWeight: 700, mt: "6px" }}
                              />
                            );
                          })()
                        : null}
                      <RowActionButton
                        kind="delete"
                        disabled={draftLines.length <= 1}
                        onClick={() =>
                          setDraftLines((current) =>
                            current.filter((_, i) => i !== index),
                          )
                        }
                        sx={{ mt: "6px" }}
                      />
                    </Stack>
                  </AnimatedListItem>
                ))}
              </AnimatedList>
              <ActionButton
                kind="create"
                onClick={() =>
                  setDraftLines((current) => [...current, emptyDraftLine()])
                }
              >
                {t("warranty.componentIssue.addLine")}
              </ActionButton>
            </Stack>

            <UiTextField
              fullWidth
              multiline
              minRows={2}
              label={t("warranty.componentIssue.note")}
              value={draftNote}
              onChange={(event) => setDraftNote(event.target.value)}
              slotProps={{ htmlInput: { maxLength: 2000 } }}
            />
          </Stack>
        ) : (
          <Stack spacing={1.5}>
            <ApiErrorAlert
              error={detailQuery.error}
              title={t("warranty.componentIssue.loadError")}
              onRetry={() => detailQuery.refetch()}
            />
            {detail ? (
              <Stack spacing={1.5}>
                <Box
                  sx={{
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: "var(--ops-radius-card)",
                    p: 2,
                  }}
                >
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, md: 4 }}>
                      <Box>
                        <UiText variant="caption">
                          {t("warranty.componentIssue.status")}
                        </UiText>
                      </Box>
                      <UiStatusBadge
                        tone={COMPONENT_ISSUE_STATUS_BADGE[detail.status].tone}
                        label={
                          COMPONENT_ISSUE_STATUS_BADGE[detail.status].label
                        }
                      />
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}>
                      <Box>
                        <UiText variant="caption">
                          {t("warranty.componentIssue.purpose")}
                        </UiText>
                      </Box>
                      <UiStatusBadge
                        tone="info"
                        label={t("warranty.componentIssue.purposeWarranty")}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}>
                      <Box>
                        <UiText variant="caption">
                          {t("warranty.componentIssue.documentDate")}
                        </UiText>
                      </Box>
                      <UiText variant="body">
                        {detail.document_date
                          ? formatDate(detail.document_date)
                          : EMPTY_TEXT}
                      </UiText>
                    </Grid>
                  </Grid>
                </Box>

                {detail.status === "CANCELLED" ? (
                  <UiAlert tone="warning">
                    {t("warranty.componentIssue.cancelledNote", {
                      reason: detail.cancel_reason
                        ? t("warranty.componentIssue.cancelledReason", {
                            reason: detail.cancel_reason,
                          })
                        : "",
                    })}
                  </UiAlert>
                ) : null}
                {detail.status === "POSTED" ? (
                  <UiAlert tone="success">
                    {t("warranty.componentIssue.postedNote")}
                  </UiAlert>
                ) : null}

                <ResponsiveDataTable<ComponentIssueLine>
                  columns={lineColumns}
                  rows={detail.lines}
                  rowKey={(line) => line.id}
                  loading={detailQuery.isFetching}
                  emptyText={t("warranty.componentIssue.linesEmpty")}
                  onRowClick={(line) => setSelectedLineId(line.id)}
                />

                {isOpenDocument ? (
                  <Box
                    sx={{
                      border: "1px solid",
                      borderColor: "divider",
                      borderRadius: "var(--ops-radius-card)",
                      p: 1.5,
                    }}
                  >
                    <Box sx={{ fontWeight: 700, mb: 1 }}>
                      {t("warranty.componentIssue.scanSectionTitle")}
                    </Box>
                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{
                        alignItems: "flex-start",
                        flexWrap: "wrap",
                        rowGap: 1,
                      }}
                    >
                      <UiNumberField
                        rule={NUMBER_RULES.quantity}
                        label={t("warranty.componentIssue.scanQtyLabel")}
                        value={scanQuantity}
                        onChange={(next) => {
                          setScanQuantity(next);
                          setScanQuantityError("");
                        }}
                        error={Boolean(scanQuantityError)}
                        helperText={scanQuantityError || undefined}
                        sx={{ width: 110 }}
                      />
                      <Box sx={{ flex: 1, minWidth: 220 }}>
                        <ScanInput
                          size="middle"
                          placeholder={t(
                            "warranty.componentIssue.scanPlaceholder",
                          )}
                          recentCodes={recentCodes}
                          disabled={!canIssue || scanMutation.isPending}
                          onScan={handleScan}
                        />
                      </Box>
                    </Stack>
                  </Box>
                ) : null}
              </Stack>
            ) : null}
          </Stack>
        )}
      </Stack>

      <UiDialog
        className={className}
        open={cancelOpen}
        onClose={guardBackdropClose(() => setCancelOpen(false))}
        maxWidth="xs"
        title={t("warranty.componentIssue.cancelTitle")}
        actions={
          <>
            <ActionButton
              kind="back"
              onClick={() => setCancelOpen(false)}
              disabled={cancelMutation.isPending}
            >
              {t("warranty.componentIssue.cancelBack")}
            </ActionButton>
            <ActionButton
              kind="confirm"
              onClick={() => void handleCancel()}
              disabled={cancelMutation.isPending}
            >
              {t("warranty.componentIssue.cancelConfirm")}
            </ActionButton>
          </>
        }
      >
        <Box sx={{ mt: 0.5 }}>
          <UiTextField
            fullWidth
            multiline
            minRows={3}
            label={t("warranty.componentIssue.cancelReasonLabel", {
              min: TEXT_LIMITS.reasonMin,
            })}
            value={cancelReason}
            onChange={(event) => {
              setCancelReason(event.target.value);
              setCancelReasonError("");
            }}
            error={Boolean(cancelReasonError)}
            helperText={cancelReasonError || undefined}
            slotProps={{ htmlInput: { maxLength: CANCEL_REASON_MAX } }}
          />
        </Box>
      </UiDialog>

      <UiDialog
        className={className}
        open={postConfirmOpen}
        onClose={() => setPostConfirmOpen(false)}
        maxWidth="xs"
        title={t("warranty.componentIssue.postTitle")}
        actions={
          <>
            <ActionButton
              kind="view"
              onClick={() => setPostConfirmOpen(false)}
              disabled={postMutation.isPending}
            >
              {t("warranty.componentIssue.postReview")}
            </ActionButton>
            <ActionButton
              kind="send"
              onClick={() => void handlePost()}
              disabled={postMutation.isPending}
            >
              {t("warranty.componentIssue.postConfirm")}
            </ActionButton>
          </>
        }
      >
        <UiText variant="body">{t("warranty.componentIssue.postBody")}</UiText>
      </UiDialog>

      <CameraScanModal
        open={cameraOpen}
        title={t("warranty.componentIssue.scanDialogTitle")}
        onDetected={(code) => {
          setCameraOpen(false);
          void handleScan(code.trim().toUpperCase());
        }}
        onClose={() => setCameraOpen(false)}
      />
    </UiDialog>
  );
}

export type { ComponentIssueDocument };
