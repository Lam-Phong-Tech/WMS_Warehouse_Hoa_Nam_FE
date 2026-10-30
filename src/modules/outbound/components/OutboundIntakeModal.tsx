import { useEffect, useState } from "react";
import dayjs from "dayjs";
import "./outbound-dialog.css";
import {
  Box,
  Grid,
  Stack,
  UiAddressField,
  // SKU sản phẩm và nơi nhận cần gõ-để-lọc trên toàn danh mục (catalog lớn,
  // không thể tải hết vào 1 dropdown). UiSelect không lọc từ xa, còn
  // UiFormAutocomplete gắn với react-hook-form mà form này giữ state thường —
  // nên dùng bản không-RHF.
  UiAutocomplete,
  UiDialog,
  UiFormField,
  UiVuexyDateField,
  UiNumberField,
  UiPagination,
  UiStatusBadge,
  UiTextField,
  type UiStatusTone,
} from "@/shared/ui";
import { toast } from "sonner";
import { useMutation, useQuery } from "@tanstack/react-query";
import { getApiErrorMessage } from "@/shared/api/api-error";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import {
  ResponsiveDataTable,
  type ResponsiveTableColumn,
} from "@/shared/components/data-display/ResponsiveDataTable";
import { CopyableId } from "@/shared/components/data-display/CopyableId";
import {
  useMvpAgencies,
  useMvpSkus,
} from "@/modules/master-data/hooks/use-mvp-master";
import { RecipientCreateDialog } from "@/modules/master-data/components/RecipientCreateDialog";
import type { AgencyRecord } from "@/modules/master-data/types/mvp-master.types";
import { useCan } from "@/shared/components/permission";
import { useDialogExit } from "@/shared/utils/useDialogExit";
import {
  AnimatedList,
  AnimatedListItem,
} from "@/shared/components/motion/AnimatedList";
import { createRowKey } from "@/shared/components/motion/row-key";
import {
  consumeOutboundImport,
  fetchAvailableQtyBySku,
  searchAvailableProductSkus,
  uploadOutboundRequestFile,
  validateOutboundRequestRows,
  type OutboundImportResult,
  type OutboundRequestRowInput,
} from "@/modules/outbound/services/mvpOutboundService";
import { ActionButton, ActionIconButton } from "@/shared/components/actions";
import { useT, type TranslateFn } from "@/shared/i18n/useT";
import type { MessageKey } from "@/shared/i18n/messages";
import { validatePhone } from "@/shared/constants/validation.constants";
import {
  FILE_RULES,
  acceptAttribute,
  checkFile,
} from "@/shared/validation/file-rules";
import { NUMBER_RULES, checkNumber } from "@/shared/validation/number-rules";
import { checkDate, pastDateBounds } from "@/shared/validation/date-rules";

/** Trần độ dài mã phiếu yêu cầu — khớp `import_no`/`request_no` max:80 của BE. */
const REQUEST_NO_MAX = 80;
/**
 * Luật tệp Excel lấy từ lớp dùng chung (file-rules.ts) — trước đây hai hằng số
 * chép tay ở đây, ở SkuImportModal và ở DocumentAttachmentsPanel, lệch nhau
 * lúc nào không hay.
 */
const EXCEL_FILE_RULE = FILE_RULES.excelImport;

type IntakeMode = "manual" | "excel";

interface LineInput {
  /** Khóa ổn định cho hiệu ứng thêm/xóa dòng — không gửi lên API. */
  key: string;
  product_id: string;
  /** Mã SKU tại thời điểm chọn. Gửi cùng ID để BE xác thực chéo/fallback khi danh mục vừa đồng bộ lại. */
  sku_code: string;
  /** Giữ CHUỖI đang gõ để báo lỗi thay vì ép về 1 im lặng; parse bằng checkNumber. */
  required_qty: string;
}

function createEmptyLine(): LineInput {
  return {
    key: createRowKey("outbound-line"),
    product_id: "",
    sku_code: "",
    required_qty: "1",
  };
}

type LineResolution = { sku_id?: string; required_qty?: number };

interface OutboundIntakeModalProps {
  open: boolean;
  canImport: boolean;
  onClose: () => void;
  onConsumed: (outboundDocumentIds: string[]) => void;
}

function makeKey(prefix: string): string {
  const random =
    globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  return `${prefix}-${random}`;
}

function text(value: unknown, fallback = ""): string {
  return value === undefined || value === null ? fallback : String(value);
}

type ImportRow = OutboundImportResult["rows"][number];

function rowErrorText(row: ImportRow, t: TranslateFn): string {
  return row.errors
    .map((error) => {
      const fieldLabels: Record<string, MessageKey> = {
        request_no: "outbound.intake.fieldRequestNo",
        recipient_name: "outbound.intake.fieldRecipient",
        recipient_contact_phone: "outbound.intake.fieldPhone",
        request_date: "outbound.intake.fieldRequestDate",
        required_qty: "outbound.intake.fieldQty",
        sku_code: "outbound.intake.fieldSku",
      };
      const field = error.field ? fieldLabels[error.field] : undefined;
      const sku = text(row.normalized.sku_code).trim();

      switch (error.error_code) {
        case "SKU_NOT_ACTIVE":
          return t("outbound.intake.errSkuUnavailable", { sku });
        case "SKU_REFERENCE_MISMATCH":
          return t("outbound.intake.errSkuReferenceMismatch");
        case "COMPONENT_OUTBOUND_FORBIDDEN":
          return t("outbound.intake.errComponentSku");
        case "INVALID_QUANTITY":
          return t("outbound.intake.errQuantity");
        case "INVALID_PHONE":
          return t("outbound.intake.errPhone");
        case "INVALID_REQUEST_DATE":
          return t("outbound.intake.errRequestDate");
        case "REQUIRED":
          return t("outbound.intake.errRequiredField", {
            field: field
              ? t(field)
              : t("outbound.intake.rowLabel", { row: error.row ?? row.rowNo }),
          });
        default:
          return t("outbound.intake.genericError");
      }
    })
    .join(" · ");
}

/** Tông màu soft-tint theo UiStatusBadge — "processing"/"default" (antd cũ) ⇒ info/neutral. */
const IMPORT_STATUS_TONE: Record<string, UiStatusTone> = {
  UPLOADED: "info",
  VALIDATED: "success",
  REJECTED: "error",
  CONSUMED: "neutral",
};

const IMPORT_STATUS_LABEL: Record<string, MessageKey> = {
  UPLOADED: "outbound.intake.statusUploaded",
  VALIDATED: "outbound.intake.statusValidated",
  REJECTED: "outbound.intake.statusRejected",
  CONSUMED: "outbound.intake.statusConsumed",
};

/**
 * Số lượng đã qua validateManualForm nên luôn hợp lệ ở đây; parse lại bằng
 * cùng checkNumber để không có hai đường parse lệch nhau.
 */
function parseRequiredQty(raw: string): number {
  const result = checkNumber(raw, NUMBER_RULES.quantity);
  return result.ok && result.value != null ? result.value : Number(raw);
}

/** Kiểm tra tệp Excel trước khi tải lên: đuôi tệp và dung lượng. */
function checkExcelFile(file: File, t: TranslateFn): string | null {
  // Luật (đuôi + MIME + dung lượng) ở file-rules; câu lỗi giữ nguyên chữ của
  // màn xuất kho nên chỉ đọc `reason` để chọn câu.
  const check = checkFile(file, EXCEL_FILE_RULE);
  if (check.ok) return null;
  return check.reason === "type"
    ? t("outbound.intake.errFileType")
    : t("outbound.intake.errFileSize", {
        max: Math.round(EXCEL_FILE_RULE.maxBytes / (1024 * 1024)),
      });
}

/** Bảng xem trước phân trang client-side như antd Table cũ (pageSize 10). */
const PREVIEW_PAGE_SIZE = 10;

// Dòng "+ Thêm nơi nhận" nay do `UiAutocomplete` dựng qua prop `onAddNew` —
// sentinel value nằm trong component đó, màn này không cần tự khai nữa.

export function OutboundIntakeModal({
  open,
  canImport,
  onClose,
  onConsumed,
}: OutboundIntakeModalProps) {
  const t = useT();
  const dialog = useDialogExit(onClose);
  // Chỉ người có quyền quản lý nơi nhận mới thấy dòng "+ Thêm nơi nhận" trong
  // dropdown (cùng quyền với nút trên màn Danh mục đại lý / nơi nhận).
  const canManageAgency = useCan("agency.manage");
  const [createAgencyOpen, setCreateAgencyOpen] = useState(false);
  const [mode, setMode] = useState<IntakeMode>("manual");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [preview, setPreview] = useState<OutboundImportResult | null>(null);
  const [previewPage, setPreviewPage] = useState(1);
  const [resolutions, setResolutions] = useState<
    Record<number, LineResolution>
  >({});
  // Ô "SL yêu cầu" ghi đè ở bảng xem trước: giữ chuỗi đang gõ + lỗi theo dòng,
  // để "-5"/"abc" hiện lỗi ngay và chặn nút tạo phiếu thay vì bị bỏ qua.
  const [overrideQtyDrafts, setOverrideQtyDrafts] = useState<
    Record<number, string>
  >({});
  const [overrideQtyErrors, setOverrideQtyErrors] = useState<
    Record<number, string>
  >({});
  const [recipientOverride, setRecipientOverride] = useState({
    receiver_name: "",
    receiver_address: "",
    receiver_contact_phone: "",
  });

  const [requestNo, setRequestNo] = useState("");
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [recipientName, setRecipientName] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [requestDate, setRequestDate] = useState("");
  const requestDateBounds = pastDateBounds();
  const parsedRequestDate = dayjs(requestDate);
  const requestDateValue =
    parsedRequestDate.isValid() &&
    parsedRequestDate.format("YYYY-MM-DD") === requestDate
      ? parsedRequestDate
      : null;
  const [lines, setLines] = useState<LineInput[]>([createEmptyLine()]);
  // Lỗi kiểm tra hiển thị INLINE ngay dưới từng ô (thay cho một khối lỗi tổng
  // data-ui-state="error"): người dùng thấy đúng ô nào cần sửa.
  const [fieldErrors, setFieldErrors] = useState<{
    requestNo?: string;
    recipientName?: string;
    recipientPhone?: string;
    requestDate?: string;
    lines: Record<number, { product_id?: string; required_qty?: string }>;
  }>({ lines: {} });

  const clearFieldError = (
    field: "requestNo" | "recipientName" | "recipientPhone" | "requestDate",
  ) =>
    setFieldErrors((prev) =>
      prev[field] ? { ...prev, [field]: undefined } : prev,
    );

  const clearLineError = (index: number) =>
    setFieldErrors((prev) => {
      if (!prev.lines[index]) return prev;
      const nextLines = { ...prev.lines };
      delete nextLines[index];
      return { ...prev, lines: nextLines };
    });

  const validateManualForm = () => {
    const errors: typeof fieldErrors = { lines: {} };
    if (!requestNo.trim()) {
      errors.requestNo = t("outbound.intake.errRequestNo");
    } else if (requestNo.trim().length > REQUEST_NO_MAX) {
      errors.requestNo = t("shared.validation.textMaxLength", {
        max: REQUEST_NO_MAX,
      });
    }
    if (!recipientName.trim())
      errors.recipientName = t("outbound.intake.errRecipient");
    if (recipientPhone) {
      const phone = validatePhone(recipientPhone);
      if (!phone.isValid) {
        errors.recipientPhone =
          phone.errorMessage ?? t("outbound.intake.errPhone");
      }
    }
    // Ngày yêu cầu là ngày đã xảy ra (tuỳ chọn): chỉ kiểm khi có nhập.
    if (requestDate) {
      const dateCheck = checkDate(requestDate, pastDateBounds());
      if (!dateCheck.ok) errors.requestDate = dateCheck.message;
    }
    lines.forEach((line, index) => {
      const lineError: { product_id?: string; required_qty?: string } = {};
      if (!line.product_id) lineError.product_id = t("outbound.intake.errSku");
      // Cùng NUMBER_RULES.quantity với ô nhập: nguyên, 1…1.000.000.
      const qtyCheck = checkNumber(line.required_qty, {
        ...NUMBER_RULES.quantity,
        required: true,
      });
      if (!qtyCheck.ok) {
        lineError.required_qty = qtyCheck.message;
      }
      if (lineError.product_id || lineError.required_qty) {
        errors.lines[index] = lineError;
      }
    });
    return errors;
  };

  const hasFieldErrors = (errors: typeof fieldErrors) =>
    Boolean(
      errors.requestNo ||
      errors.recipientName ||
      errors.recipientPhone ||
      errors.requestDate ||
      Object.keys(errors.lines).length > 0,
    );

  const skuQuery = useMvpSkus({
    status: "ACTIVE",
    sku_type: "PRODUCT",
    per_page: 100,
  });
  // Danh sách mặc định (chưa gõ) để gợi ý ban đầu + seed nhãn cho map bên dưới.
  const agencyQuery = useMvpAgencies({ status: "ACTIVE", per_page: 100 });
  const skuRows = skuQuery.data?.data ?? [];
  const skuOptions = skuRows.map((sku) => ({
    value: sku.sku_id,
    label: `${sku.sku_code} · ${sku.sku_name}`,
  }));

  /**
   * Ô "SKU sản phẩm" ở dòng nhập tay — gõ-để-lọc trên danh sách SKU CÒN TỒN
   * khả dụng (UAT TC_UX_01): trước đây gợi ý toàn catalog nên người dùng phải
   * chọn mò từng mã rồi bấm "Kiểm tra & xem trước" mới biết thiếu tồn. Nguồn
   * là /inventory/balances (một request, kèm số tồn tham khảo hiển thị ngay
   * trên option); catalog vẫn là fallback khi balances lỗi để ô không chết.
   */
  const [skuKeyword, setSkuKeyword] = useState("");
  const availableSkuQuery = useQuery({
    queryKey: ["mvp-outbound", "available-skus", skuKeyword.trim()],
    queryFn: () => searchAvailableProductSkus(skuKeyword.trim()),
    staleTime: 15_000,
    retry: false,
  });
  const skuSearchFallbackQuery = useMvpSkus(
    {
      status: "ACTIVE",
      sku_type: "PRODUCT",
      keyword: skuKeyword.trim(),
      per_page: 50,
    },
    { enabled: availableSkuQuery.isError },
  );
  const skuSearchQuery = availableSkuQuery.isError
    ? skuSearchFallbackQuery
    : availableSkuQuery;
  const skuSearchOptions = availableSkuQuery.isError
    ? (skuSearchFallbackQuery.data?.data ?? []).map((sku) => ({
        value: sku.sku_id,
        label: `${sku.sku_code} · ${sku.sku_name}`,
      }))
    : (availableSkuQuery.data ?? []).map((sku) => ({
        value: sku.sku_id,
        label: `${sku.sku_code} · ${sku.sku_name} — ${t("outbound.intake.optionAvailable", { qty: sku.available })}`,
      }));

  // Giữ mã đi cùng ID tại đúng thời điểm người dùng chọn. Không suy diễn từ
  // label vì label là nội dung hiển thị, có thể đổi theo ngôn ngữ/thiết kế.
  const skuCodeById = new Map<string, string>([
    ...skuRows.map((sku) => [sku.sku_id, sku.sku_code] as const),
    ...(availableSkuQuery.data ?? []).map(
      (sku) => [sku.sku_id, sku.sku_code] as const,
    ),
    ...(skuSearchFallbackQuery.data?.data ?? []).map(
      (sku) => [sku.sku_id, sku.sku_code] as const,
    ),
  ]);

  // Nhãn hiển thị của SKU ĐÃ CHỌN phải bền vững qua mọi lần gõ tìm — nếu chỉ
  // dựa vào skuSearchOptions (đổi theo keyword hiện tại), dòng đang không được
  // gõ sẽ mất nhãn ngay khi kết quả tìm kiếm của dòng khác không còn chứa SKU
  // đó (Autocomplete dùng chung 1 query keyword cho mọi dòng).
  const [skuLabelById, setSkuLabelById] = useState<Map<string, string>>(
    new Map(),
  );
  useEffect(() => {
    const merged = [...skuOptions, ...skuSearchOptions];
    if (merged.length === 0) return;
    setSkuLabelById((prev) => {
      let changed = false;
      const next = new Map(prev);
      for (const option of merged) {
        if (next.get(option.value) !== option.label) {
          next.set(option.value, option.label);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ cần re-run khi 2 danh sách nguồn đổi, không phải mọi lần skuOptions/skuSearchOptions tạo lại tham chiếu.
  }, [skuRows, availableSkuQuery.data, skuSearchFallbackQuery.data]);
  // Ô "Đại lý / nơi nhận" cũng gõ-để-lọc trên toàn danh mục đại lý (giống SKU):
  // danh sách per_page 100 phía trên chỉ đủ cho gợi ý ban đầu, không thể chứa hết
  // đại lý — gõ keyword gọi BE (AgencyRepository::$searchable = agency_code/
  // agency_name).
  const [agencyKeyword, setAgencyKeyword] = useState("");
  const agencySearchQuery = useMvpAgencies({
    status: "ACTIVE",
    keyword: agencyKeyword.trim(),
    per_page: 50,
  });
  const agencySearchRows = agencySearchQuery.data?.data ?? [];
  const agencyOptions = agencySearchRows.map((agency) => ({
    value: agency.agency_id,
    label: `${agency.agency_code} · ${agency.agency_name}`,
  }));

  // Bản ghi đại lý ĐÃ CHỌN phải bền vững qua mọi lần gõ tìm (giống skuLabelById):
  // dùng để giữ nhãn hiển thị và để tự điền người nhận / địa chỉ ngay cả khi đại
  // lý đó không còn nằm trong kết quả tìm kiếm hiện tại.
  const [agencyById, setAgencyById] = useState<Map<string, AgencyRecord>>(
    new Map(),
  );
  useEffect(() => {
    const merged = [
      ...(agencyQuery.data?.data ?? []),
      ...(agencySearchQuery.data?.data ?? []),
    ];
    if (merged.length === 0) return;
    setAgencyById((prev) => {
      let changed = false;
      const next = new Map(prev);
      for (const agency of merged) {
        if (next.get(agency.agency_id) !== agency) {
          next.set(agency.agency_id, agency);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [agencyQuery.data, agencySearchQuery.data]);
  const agencyLabel = (agency: AgencyRecord) =>
    `${agency.agency_code} · ${agency.agency_name}`;

  const previewSkuIds = [
    ...new Set([
      ...(preview?.rows ?? [])
        .map((row) => text(row.normalized.sku_id))
        .filter(Boolean),
      ...Object.values(resolutions)
        .map((resolution) => resolution.sku_id ?? "")
        .filter(Boolean),
    ]),
  ];
  const availabilityQuery = useQuery({
    queryKey: ["mvp-outbound", "availability", preview?.id, previewSkuIds],
    enabled: previewSkuIds.length > 0,
    retry: false,
    queryFn: () => fetchAvailableQtyBySku(previewSkuIds),
  });

  const rowSkuId = (row: ImportRow): string =>
    resolutions[row.rowNo]?.sku_id || text(row.normalized.sku_id);

  const rowRequiredQty = (row: ImportRow): number =>
    resolutions[row.rowNo]?.required_qty ??
    Number(row.normalized.required_qty ?? 0);

  const resetAll = () => {
    setPreview(null);
    setPreviewPage(1);
    setResolutions({});
    setOverrideQtyDrafts({});
    setOverrideQtyErrors({});
    setRecipientOverride({
      receiver_name: "",
      receiver_address: "",
      receiver_contact_phone: "",
    });
    setFile(null);
    setFileError(null);
    setFileInputKey((key) => key + 1);
    setMode("manual");
    setRequestNo("");
    setAgencyId(null);
    setAgencyKeyword("");
    setRecipientName("");
    setRecipientAddress("");
    setRecipientPhone("");
    setRequestDate("");
    setLines([createEmptyLine()]);
    setFieldErrors({ lines: {} });
  };

  const close = () => {
    resetAll();
    dialog.close();
  };

  const validateManualMutation = useMutation({
    mutationFn: async () => {
      // Validate client-side đã chạy TRƯỚC ở nút bấm (setFieldErrors) — ở đây
      // chỉ dựng dữ liệu và gọi dry-run BE.
      const rows: OutboundRequestRowInput[] = lines.map((line) => ({
        request_no: requestNo.trim(),
        request_date: requestDate || undefined,
        customer_name: recipientName.trim(),
        customer_address: recipientAddress.trim(),
        recipient_contact_phone: recipientPhone.trim() || undefined,
        sku_id: line.product_id,
        sku_code: line.sku_code || undefined,
        required_qty: parseRequiredQty(line.required_qty),
        agency_id: agencyId || null,
      }));
      return validateOutboundRequestRows(rows);
    },
    onSuccess: (result) => {
      setFieldErrors({ lines: {} });
      setPreview(result);
      setPreviewPage(1);
      if (result.status === "VALIDATED") {
        toast.success(t("outbound.intake.manualValid"));
      } else {
        toast.warning(t("outbound.intake.manualInvalid"));
      }
    },
    onError: (error) => {
      // Lỗi máy chủ/mạng (không phải lỗi từng ô) — báo qua toast, không dựng
      // lại khối lỗi tổng.
      toast.error(getApiErrorMessage(error, t("outbound.intake.manualError")));
    },
  });

  const handleValidateManual = () => {
    const errors = validateManualForm();
    setFieldErrors(errors);
    if (hasFieldErrors(errors)) return;
    validateManualMutation.mutate();
  };

  const validateFileMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error(t("outbound.intake.needFile"));
      return uploadOutboundRequestFile(file);
    },
    onSuccess: (result) => {
      setPreview(result);
      setPreviewPage(1);
      if (result.status === "VALIDATED") {
        toast.success(t("outbound.intake.excelValid"));
      } else {
        toast.warning(t("outbound.intake.excelInvalid"));
      }
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, t("outbound.intake.excelError")));
    },
  });

  const consumeMutation = useMutation({
    mutationFn: async () => {
      if (!preview) throw new Error(t("outbound.intake.needPreview"));
      // Không bao giờ gửi khi còn ô SL ghi đè sai — nút đã disable, đây là
      // chốt chặn cuối.
      const [badRow, badMessage] = Object.entries(overrideQtyErrors)[0] ?? [];
      if (badRow !== undefined) {
        throw new Error(
          t("outbound.intake.errOverrideQty", {
            row: badRow,
            message: badMessage,
          }),
        );
      }
      const consumeLines = Object.entries(resolutions)
        .map(([rowNo, value]) => ({
          row_no: Number(rowNo),
          ...(value.sku_id ? { sku_id: value.sku_id } : {}),
          ...(value.required_qty ? { required_qty: value.required_qty } : {}),
        }))
        .filter((line) => line.sku_id || line.required_qty);
      const recipient = Object.fromEntries(
        Object.entries(recipientOverride).filter(
          ([, value]) => value.trim() !== "",
        ),
      );
      return consumeOutboundImport(
        preview.id,
        makeKey("confirm-outbound"),
        preview.version,
        {
          ...(consumeLines.length ? { lines: consumeLines } : {}),
          ...recipient,
        },
      );
    },
    onSuccess: (result) => {
      toast.success(
        t("outbound.intake.created", {
          requests: result.outboundRequestIds.length,
          documents: result.outboundDocumentIds.length,
        }),
      );
      const ids = result.outboundDocumentIds;
      resetAll();
      onConsumed(ids);
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, t("outbound.intake.createError")));
    },
  });

  const handleAgencyChange = (nextAgencyId: string | null) => {
    setAgencyId(nextAgencyId);
    const agency: AgencyRecord | undefined = nextAgencyId
      ? agencyById.get(nextAgencyId)
      : undefined;
    if (!agency) return;
    setRecipientName(agency.agency_name);
    setRecipientAddress(agency.address ?? "");
  };

  // Nơi nhận vừa tạo trong dialog: nạp vào map (giữ nhãn + autofill), tự chọn và
  // điền người nhận / địa chỉ như khi chọn từ danh sách.
  const handleAgencyCreated = (record: AgencyRecord) => {
    setAgencyById((prev) => {
      const next = new Map(prev);
      next.set(record.agency_id, record);
      return next;
    });
    setAgencyId(record.agency_id);
    setRecipientName(record.agency_name);
    setRecipientAddress(record.address ?? "");
    setCreateAgencyOpen(false);
  };

  const updateLine = (index: number, patch: Partial<LineInput>) => {
    setLines((current) =>
      current.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    );
  };

  const previewColumns: ResponsiveTableColumn<ImportRow>[] = [
    {
      key: "rowNo",
      header: t("outbound.intake.colRow"),
      width: 70,
      render: (row) => row.rowNo,
    },
    {
      key: "request",
      header: t("outbound.intake.colRequestNo"),
      width: 150,
      render: (row) => text(row.normalized.request_no, "-"),
    },
    /*
     * UAT TC_UI_09 (Ảnh 2): tổng width khai cứng của 8 cột là 1440px — vượt xa
     * lòng dialog (~1050px) nên bảng bật table-layout: fixed rồi tràn ngang,
     * cột đầu bị đẩy khuất. Các cột CHỮ thả nổi (không khai width) để bảng về
     * auto-layout: chữ dài tự xuống dòng, cả 8 cột nằm gọn trong khung.
     */
    {
      key: "recipient",
      header: t("outbound.intake.colRecipient"),
      render: (row) =>
        text(
          row.normalized.recipient_name ?? row.normalized.customer_name,
          "-",
        ),
    },
    {
      key: "sku",
      header: "SKU",
      // Chỉ mã SKU đọc được (sku_code) mới in thẳng. Khi file nhập thiếu mã mà chỉ
      // có sku_id (UUID nội bộ), KHÔNG in nguyên chuỗi thô — dùng CopyableId (rút
      // gọn + nút sao chép) đúng quy ước không lộ UUID ở màn nghiệp vụ.
      render: (row) =>
        row.normalized.sku_code ? (
          text(row.normalized.sku_code)
        ) : row.normalized.sku_id ? (
          <CopyableId value={String(row.normalized.sku_id)} />
        ) : (
          "-"
        ),
    },
    {
      key: "sku_mapping",
      header: t("outbound.intake.colReassignSku"),
      width: 260,
      // Gõ-để-lọc trên TOÀN danh mục, giống ô SKU của dòng nhập tay. Trước đây ô
      // này dùng `skuOptions` — danh sách cắt cứng ở 100 dòng đầu; với danh mục
      // thật (955 mã sản phẩm ACTIVE) thì gần như không bao giờ chọn được đúng mã
      // mà dòng import đang cần gán lại.
      render: (row) => {
        const selected = resolutions[row.rowNo]?.sku_id ?? "";
        return (
          <UiAutocomplete
            sx={{ minWidth: 240 }}
            aria-label={t("outbound.intake.reassignAria", { row: row.rowNo })}
            placeholder={t("outbound.intake.keepAsIs")}
            options={
              // Giữ nhãn của SKU ĐANG CHỌN kể cả khi nó rơi ra ngoài kết quả tìm
              // kiếm hiện tại (mọi dòng dùng chung một keyword).
              selected &&
              !skuSearchOptions.some((option) => option.value === selected)
                ? [
                    {
                      value: selected,
                      label: skuLabelById.get(selected) ?? selected,
                    },
                    ...skuSearchOptions,
                  ]
                : skuSearchOptions
            }
            value={selected || null}
            onChange={(value) =>
              setResolutions((current) => ({
                ...current,
                [row.rowNo]: {
                  ...current[row.rowNo],
                  sku_id: value === null ? undefined : String(value),
                },
              }))
            }
            onInputChange={setSkuKeyword}
            loading={skuSearchQuery.isFetching}
            noOptionsText={
              skuKeyword.trim()
                ? t("outbound.intake.skuNoMatch")
                : t("outbound.intake.skuTypeToSearch")
            }
          />
        );
      },
    },
    {
      key: "qty",
      header: t("outbound.intake.colRequiredQty"),
      width: 140,
      render: (row) => (
        <UiNumberField
          sx={{ width: 130 }}
          rule={NUMBER_RULES.quantity}
          slotProps={{
            htmlInput: {
              "aria-label": t("outbound.intake.requiredQtyAria", {
                row: row.rowNo,
              }),
            },
          }}
          value={
            overrideQtyDrafts[row.rowNo] ??
            String(
              resolutions[row.rowNo]?.required_qty ??
                (Number(row.normalized.required_qty ?? 0) || ""),
            )
          }
          error={Boolean(overrideQtyErrors[row.rowNo])}
          helperText={overrideQtyErrors[row.rowNo]}
          onChange={(next) => {
            setOverrideQtyDrafts((current) => ({
              ...current,
              [row.rowNo]: next,
            }));
            const qtyCheck = checkNumber(next, NUMBER_RULES.quantity);
            setOverrideQtyErrors((current) => {
              const rest = { ...current };
              delete rest[row.rowNo];
              return qtyCheck.ok
                ? rest
                : { ...rest, [row.rowNo]: qtyCheck.message };
            });
            // Chỉ ghi vào resolutions khi giá trị hợp lệ; ô rỗng = giữ nguyên
            // như file. Sai thì giữ ghi đè cũ và chặn tạo phiếu bằng lỗi ở trên.
            if (!qtyCheck.ok) return;
            const parsed = qtyCheck.value ?? undefined;
            setResolutions((current) => ({
              ...current,
              [row.rowNo]: {
                ...current[row.rowNo],
                required_qty: parsed,
              },
            }));
          }}
        />
      ),
    },
    {
      key: "available",
      header: t("outbound.intake.colAvailable"),
      width: 150,
      render: (row) => {
        const skuId = rowSkuId(row);
        const available = skuId ? availabilityQuery.data?.[skuId] : undefined;
        if (available === undefined) {
          return (
            <Box sx={{ typography: "body2", color: "text.secondary" }}>
              {availabilityQuery.isLoading
                ? "…"
                : t("outbound.intake.noAvailability")}
            </Box>
          );
        }
        const required = rowRequiredQty(row);
        return (
          <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
            <span>{available}</span>
            {row.errors.length === 0 ? (
              <UiStatusBadge
                tone={available >= required ? "success" : "warning"}
                label={
                  available >= required
                    ? t("outbound.intake.enoughNow")
                    : t("outbound.intake.shortNow")
                }
              />
            ) : null}
          </Stack>
        );
      },
    },
    {
      key: "result",
      header: t("outbound.intake.colCheckResult"),
      render: (row) => {
        if (row.errors.length > 0) {
          return (
            <Box sx={{ typography: "body2", color: "error.main" }}>
              {rowErrorText(row, t)}
            </Box>
          );
        }

        const skuId = rowSkuId(row);
        const available = skuId ? availabilityQuery.data?.[skuId] : undefined;
        const required = rowRequiredQty(row);
        if (available !== undefined && available < required) {
          return (
            <UiStatusBadge
              tone="warning"
              label={t("outbound.intake.validButShort")}
            />
          );
        }

        return (
          <UiStatusBadge tone="success" label={t("outbound.intake.valid")} />
        );
      },
    },
  ];

  const overridePhoneValid =
    recipientOverride.receiver_contact_phone === "" ||
    validatePhone(recipientOverride.receiver_contact_phone).isValid;
  const hasOverrideQtyErrors = Object.keys(overrideQtyErrors).length > 0;

  const previewRows = preview?.rows ?? [];
  // Tồn không đủ ở BẤT KỲ dòng nào (khả dụng đã biết và < SL yêu cầu) thì CHẶN
  // tạo phiếu nháp — chỉ tính dòng không có lỗi dữ liệu và đã có số liệu tồn
  // (available === undefined nghĩa là chưa tra được, không kết luận thiếu).
  const hasShortStock = previewRows.some((row) => {
    if (row.errors.length > 0) return false;
    const skuId = rowSkuId(row);
    const available = skuId ? availabilityQuery.data?.[skuId] : undefined;
    if (available === undefined) return false;
    return available < rowRequiredQty(row);
  });
  const consumable =
    Boolean(preview) &&
    canImport &&
    overridePhoneValid &&
    !hasShortStock &&
    !hasOverrideQtyErrors;

  const previewPaged = previewRows.length > PREVIEW_PAGE_SIZE;
  const pagedPreviewRows = previewPaged
    ? previewRows.slice(
        (previewPage - 1) * PREVIEW_PAGE_SIZE,
        previewPage * PREVIEW_PAGE_SIZE,
      )
    : previewRows;

  return (
    <>
      <UiDialog
        className="hn-outbound-dialog hn-outbound-intake"
        {...dialog.dialogProps}
        open={open && dialog.open}
        onClose={close}
        maxWidth="lg"
        fullWidth
        title={
          <Box
            component="span"
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 1,
            }}
          >
            {t("outbound.intake.title")}
            <ActionIconButton
              kind="close"
              label={t("common.close")}
              onClick={close}
            />
          </Box>
        }
        actions={
          <ActionButton kind="close" onClick={close}>
            {t("common.close")}
          </ActionButton>
        }
      >
        <Stack spacing={2}>
          <Stack
            direction="row"
            spacing={1.5}
            className="hn-outbound-dialog__modes"
          >
            <ActionButton
              kind="edit"
              aria-pressed={mode === "manual"}
              onClick={() => {
                setMode("manual");
                setPreview(null);
              }}
            >
              {t("outbound.intake.tabManual")}
            </ActionButton>
            <ActionButton
              kind="import"
              aria-pressed={mode === "excel"}
              onClick={() => {
                setMode("excel");
                setPreview(null);
              }}
            >
              {t("outbound.intake.tabExcel")}
            </ActionButton>
          </Stack>

          {mode === "manual" ? (
            <Stack spacing={2}>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <UiTextField
                    required
                    fullWidth
                    label={t("outbound.intake.fieldRequestNo")}
                    placeholder="VD: REQ-20260813-001"
                    value={requestNo}
                    onChange={(event) => {
                      setRequestNo(event.target.value);
                      clearFieldError("requestNo");
                    }}
                    error={Boolean(fieldErrors.requestNo)}
                    helperText={fieldErrors.requestNo}
                    slotProps={{ htmlInput: { maxLength: REQUEST_NO_MAX } }}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <UiAutocomplete
                    options={
                      // Giữ nhãn của nơi nhận ĐANG CHỌN kể cả khi nó rơi ra ngoài
                      // kết quả tìm kiếm hiện tại (BE lọc theo keyword).
                      agencyId &&
                      !agencyOptions.some((option) => option.value === agencyId)
                        ? [
                            {
                              value: agencyId,
                              label: (() => {
                                const record = agencyById.get(agencyId);
                                return record ? agencyLabel(record) : agencyId;
                              })(),
                            },
                            ...agencyOptions,
                          ]
                        : agencyOptions
                    }
                    value={agencyId}
                    onChange={(next) =>
                      handleAgencyChange(next === null ? null : String(next))
                    }
                    onInputChange={setAgencyKeyword}
                    // Dòng "+ Thêm nơi nhận" nằm cuối dropdown; chọn nó chỉ mở
                    // dialog tạo mới, không set giá trị nào.
                    onAddNew={
                      canManageAgency
                        ? () => setCreateAgencyOpen(true)
                        : undefined
                    }
                    addNewLabel={t("outbound.intake.agencyCreate")}
                    loading={agencySearchQuery.isFetching}
                    noOptionsText={
                      agencyKeyword.trim()
                        ? t("outbound.intake.agencyNoMatch")
                        : t("outbound.intake.agencyTypeToSearch")
                    }
                    label={t("outbound.intake.fieldAgency")}
                    placeholder={t("outbound.intake.fieldAgencyPlaceholder")}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <UiTextField
                    required
                    fullWidth
                    label={t("outbound.intake.fieldRecipient")}
                    value={recipientName}
                    onChange={(event) => {
                      setRecipientName(event.target.value);
                      clearFieldError("recipientName");
                    }}
                    error={Boolean(fieldErrors.recipientName)}
                    helperText={fieldErrors.recipientName}
                    slotProps={{ htmlInput: { maxLength: 200 } }}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <UiTextField
                    fullWidth
                    label={t("outbound.intake.fieldPhone")}
                    placeholder="VD: 0901234567"
                    value={recipientPhone}
                    onChange={(event) => {
                      setRecipientPhone(
                        event.target.value.replace(/\D/g, "").slice(0, 10),
                      );
                      clearFieldError("recipientPhone");
                    }}
                    error={
                      Boolean(fieldErrors.recipientPhone) ||
                      (Boolean(recipientPhone) &&
                        !validatePhone(recipientPhone).isValid)
                    }
                    helperText={
                      fieldErrors.recipientPhone ??
                      (Boolean(recipientPhone) &&
                      !validatePhone(recipientPhone).isValid
                        ? (validatePhone(recipientPhone).errorMessage ??
                          t("outbound.intake.errPhone"))
                        : undefined)
                    }
                    slotProps={{
                      htmlInput: { maxLength: 10, inputMode: "numeric" },
                    }}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <UiFormField
                    label={t("outbound.intake.fieldRequestDate")}
                    htmlFor="outbound-request-date"
                    error={Boolean(fieldErrors.requestDate)}
                    helperText={
                      <span id="outbound-request-date-help">
                        {fieldErrors.requestDate ??
                          t("outbound.intake.dateHelper")}
                      </span>
                    }
                  >
                    <Box
                      className="hn-outbound-dialog__date"
                      role="group"
                      aria-label={t("outbound.intake.fieldRequestDate")}
                      aria-invalid={Boolean(fieldErrors.requestDate)}
                      aria-describedby="outbound-request-date-help"
                    >
                      <UiVuexyDateField
                        id="outbound-request-date"
                        field="outbound-request-date"
                        aria-label={t("outbound.intake.fieldRequestDate")}
                        value={requestDateValue}
                        onChange={(next) => {
                          setRequestDate(next?.format("YYYY-MM-DD") ?? "");
                          clearFieldError("requestDate");
                        }}
                        minDate={requestDateBounds.minDate}
                        maxDate={requestDateBounds.maxDate}
                      />
                      {requestDate ? (
                        <ActionIconButton
                          kind="close"
                          className="hn-outbound-dialog__date-clear"
                          label={`${t("shared.form.autocompleteClear")}: ${t("outbound.intake.fieldRequestDate")}`}
                          onClick={() => {
                            setRequestDate("");
                            clearFieldError("requestDate");
                          }}
                        />
                      ) : null}
                    </Box>
                  </UiFormField>
                </Grid>
                <Grid size={12}>
                  <UiAddressField
                    data-testid="outbound-recipient-address"
                    label={t("outbound.intake.fieldAddress")}
                    value={recipientAddress}
                    onChange={setRecipientAddress}
                    maxDetailLength={300}
                  />
                </Grid>
              </Grid>

              <Stack spacing={1.5}>
                <AnimatedList>
                  {lines.map((line, index) => (
                    <AnimatedListItem key={line.key} gap={12}>
                      <Stack
                        className="hn-outbound-dialog__line"
                        direction="row"
                        spacing={1.5}
                        sx={{
                          alignItems: "flex-start",
                          flexWrap: "wrap",
                          rowGap: 1,
                        }}
                      >
                        <UiAutocomplete
                          sx={{ width: { xs: "100%", sm: 380 }, minWidth: 0 }}
                          options={
                            // Giữ nhãn của SKU ĐANG CHỌN kể cả khi nó rơi ra ngoài
                            // kết quả tìm kiếm hiện tại.
                            line.product_id &&
                            !skuSearchOptions.some(
                              (option) => option.value === line.product_id,
                            )
                              ? [
                                  {
                                    value: line.product_id,
                                    label:
                                      skuLabelById.get(line.product_id) ??
                                      line.product_id,
                                  },
                                  ...skuSearchOptions,
                                ]
                              : skuSearchOptions
                          }
                          value={line.product_id || null}
                          onChange={(next) => {
                            const productId = next === null ? "" : String(next);
                            updateLine(index, {
                              product_id: productId,
                              sku_code: productId
                                ? (skuCodeById.get(productId) ?? "")
                                : "",
                            });
                            clearLineError(index);
                          }}
                          onInputChange={setSkuKeyword}
                          loading={skuSearchQuery.isFetching}
                          noOptionsText={
                            skuKeyword.trim()
                              ? t("outbound.intake.skuNoMatch")
                              : t("outbound.intake.skuTypeToSearch")
                          }
                          required
                          label={t("outbound.intake.fieldSku")}
                          placeholder={t("outbound.intake.fieldSkuPlaceholder")}
                          error={Boolean(fieldErrors.lines[index]?.product_id)}
                          helperText={
                            fieldErrors.lines[index]?.product_id ||
                            t("outbound.intake.skuHelper")
                          }
                        />
                        <UiNumberField
                          required
                          rule={NUMBER_RULES.quantity}
                          label={t("outbound.intake.fieldQty")}
                          value={line.required_qty}
                          onChange={(next) => {
                            updateLine(index, { required_qty: next });
                            clearLineError(index);
                          }}
                          error={Boolean(
                            fieldErrors.lines[index]?.required_qty,
                          )}
                          helperText={fieldErrors.lines[index]?.required_qty}
                          sx={{ width: 130 }}
                        />
                        <ActionButton
                          kind="delete"
                          disabled={lines.length === 1}
                          onClick={() =>
                            setLines((current) =>
                              current.filter((_, i) => i !== index),
                            )
                          }
                          sx={{ mt: "8px" }}
                        >
                          {t("outbound.intake.removeLine")}
                        </ActionButton>
                      </Stack>
                    </AnimatedListItem>
                  ))}
                </AnimatedList>
                <Box>
                  <ActionButton
                    kind="create"
                    onClick={() =>
                      setLines((current) => [...current, createEmptyLine()])
                    }
                  >
                    {t("outbound.intake.addLine")}
                  </ActionButton>
                </Box>
              </Stack>

              <Stack
                direction="row"
                spacing={1.5}
                sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 1 }}
              >
                <ActionButton
                  kind="view"
                  className="hn-outbound-dialog__primary"
                  disabled={!canImport || validateManualMutation.isPending}
                  onClick={handleValidateManual}
                >
                  {validateManualMutation.isPending
                    ? t("outbound.intake.validating")
                    : t("outbound.intake.validate")}
                </ActionButton>
                <Box sx={{ typography: "body2", color: "text.secondary" }}>
                  {t("outbound.intake.manualHint")}
                </Box>
              </Stack>
            </Stack>
          ) : (
            <Stack spacing={1.5}>
              <input
                key={fileInputKey}
                type="file"
                accept={acceptAttribute(EXCEL_FILE_RULE)}
                aria-label={t("outbound.intake.fileAria")}
                aria-invalid={Boolean(fileError)}
                onChange={(event) => {
                  const picked = event.target.files?.[0] ?? null;
                  setFile(picked);
                  setFileError(picked ? checkExcelFile(picked, t) : null);
                }}
              />
              {fileError ? (
                <Box
                  role="alert"
                  sx={{ typography: "body2", color: "error.main" }}
                >
                  {fileError}
                </Box>
              ) : null}
              <Box sx={{ typography: "body2", color: "text.secondary" }}>
                {t("outbound.intake.fileHint")}
              </Box>
              <Box>
                <ActionButton
                  kind="upload"
                  className="hn-outbound-dialog__primary"
                  disabled={
                    !canImport ||
                    !file ||
                    Boolean(fileError) ||
                    validateFileMutation.isPending
                  }
                  onClick={() => validateFileMutation.mutate()}
                >
                  {validateFileMutation.isPending
                    ? t("outbound.intake.uploading")
                    : t("outbound.intake.upload")}
                </ActionButton>
              </Box>
              <ApiErrorAlert
                error={validateFileMutation.error}
                title={t("outbound.intake.uploadErrorTitle")}
              />
            </Stack>
          )}

          {preview ? (
            <Box
              sx={{
                border: "1px solid",
                borderColor: "divider",
                borderRadius: "var(--ops-radius-card)",
                p: 2,
              }}
            >
              <Box
                sx={{
                  typography: "subtitle2",
                  fontWeight: 700,
                  mb: 1.5,
                  display: "flex",
                  alignItems: "center",
                  gap: 0.5,
                }}
              >
                {t("outbound.intake.previewTitle")}{" "}
                {preview.importNo || <CopyableId value={preview.id} />}
              </Box>
              <Stack spacing={1.5}>
                <Stack
                  direction="row"
                  spacing={1.5}
                  sx={{ flexWrap: "wrap", rowGap: 1, alignItems: "center" }}
                >
                  <UiStatusBadge
                    tone={IMPORT_STATUS_TONE[preview.status] ?? "neutral"}
                    label={
                      IMPORT_STATUS_LABEL[preview.status]
                        ? t(IMPORT_STATUS_LABEL[preview.status])
                        : t("outbound.intake.statusUnknown")
                    }
                  />
                  <Box sx={{ typography: "body2" }}>
                    {t("outbound.intake.previewTotal", {
                      count: preview.totalRows,
                    })}
                  </Box>
                  <Box sx={{ typography: "body2", color: "success.main" }}>
                    {t("outbound.intake.previewValid", {
                      count: preview.validRows,
                    })}
                  </Box>
                  <Box
                    sx={{
                      typography: "body2",
                      color:
                        preview.errorRows > 0 ? "error.main" : "text.primary",
                    }}
                  >
                    {t("outbound.intake.previewErrors", {
                      count: preview.errorRows,
                    })}
                  </Box>
                </Stack>
                {/* Bảng xem trước lấy từ kết quả kiểm tra (mutation, không phải
                  query) — hiện loading khi đang kiểm tra lại dữ liệu/tệp. */}
                <ResponsiveDataTable<ImportRow>
                  columns={previewColumns}
                  rows={pagedPreviewRows}
                  rowKey={(row) => row.id}
                  loading={
                    validateManualMutation.isPending ||
                    validateFileMutation.isPending
                  }
                  emptyText={t("outbound.intake.previewEmpty")}
                />
                {previewPaged ? (
                  <UiPagination
                    page={previewPage}
                    pageSize={PREVIEW_PAGE_SIZE}
                    total={previewRows.length}
                    showTotal={false}
                    onPageChange={setPreviewPage}
                  />
                ) : null}

                <Stack
                  direction="row"
                  spacing={1.5}
                  sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 1 }}
                >
                  <ActionButton
                    kind="confirm"
                    disabled={!consumable || consumeMutation.isPending}
                    onClick={() => consumeMutation.mutate()}
                  >
                    {consumeMutation.isPending
                      ? t("outbound.intake.confirming")
                      : t("outbound.intake.confirm")}
                  </ActionButton>
                  {!consumable ? (
                    <Box
                      sx={{
                        typography: "body2",
                        color: hasShortStock
                          ? "warning.main"
                          : "text.secondary",
                      }}
                    >
                      {!canImport
                        ? t("outbound.intake.noPermission")
                        : hasShortStock
                          ? t("outbound.intake.shortStockBlock")
                          : t("outbound.intake.stillInvalid")}
                    </Box>
                  ) : null}
                </Stack>
                <ApiErrorAlert
                  error={consumeMutation.error}
                  title={t("outbound.intake.confirmErrorTitle")}
                />
              </Stack>
            </Box>
          ) : null}
        </Stack>
      </UiDialog>
      <RecipientCreateDialog
        open={createAgencyOpen}
        onClose={() => setCreateAgencyOpen(false)}
        onCreated={handleAgencyCreated}
        initialName={agencyKeyword.trim()}
      />
    </>
  );
}
