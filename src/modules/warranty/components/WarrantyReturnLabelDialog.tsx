import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import JsBarcode from "jsbarcode";
import { toast } from "sonner";
import { Box, Stack, UiAlert, UiDialog } from "@/shared/ui";
import { ActionButton } from "@/shared/components/actions";
import { EMPTY_TEXT } from "@/shared/constants/display";
import { useT } from "@/shared/i18n/useT";
import { formatDate } from "@/shared/utils/format-date";
import { printElement } from "@/shared/utils/print-html";
import { useCanAny } from "@/shared/components/permission";
import { warrantyPiiText } from "@/modules/warranty/constants";
import {
  useComponentIssueDetails,
  useComponentIssues,
} from "@/modules/warranty/hooks/use-warranty";
import type { WarrantyCase } from "@/modules/warranty/types";

/**
 * Khổ nhãn in: 100×150mm — cùng cỡ tem vận chuyển phổ thông mà tem đóng gói
 * xuất kho đang dùng, để dùng chung một cuộn decal và một máy in.
 */
const LABEL_PAGE = { widthMm: 100, heightMm: 150, marginMm: 4 } as const;

/**
 * Class bám vào khung nhãn để bản in nới hết bề ngang khổ giấy (bản xem trước
 * bị `maxWidth` giữ lại cho vừa hộp thoại). Ghép SAU bảng style của trang nên
 * cùng độ đặc hiệu vẫn thắng — xem printElement(). KHÔNG dùng cho styling màn
 * hình, mọi thứ nhìn thấy trên UI vẫn đi qua `sx`.
 */
const LABEL_PRINT_CLASS = "hn-warranty-return-label";
const LABEL_PRINT_CSS = `.${LABEL_PRINT_CLASS}{width:100%;max-width:none;}`;

export interface WarrantyReturnLabelDialogProps {
  open: boolean;
  /** Hồ sơ bảo hành đang mở — đã tải sẵn ở modal chi tiết, không tải lại. */
  detail: WarrantyCase | null;
  onClose: () => void;
}

type ReplacedComponent = {
  key: string;
  skuCode: string;
  skuName: string;
  quantity: number;
};

/**
 * WAR-05 · Nhãn trả máy bảo hành (in trước khi giao lại máy cho khách).
 *
 * Cùng bố cục với tem đóng gói xuất kho (PackingLabelPreviewDialog) — cùng
 * khung, cùng khổ, cùng vị trí QR/mã vạch — vì hai loại nhãn dán lên cùng một
 * loại kiện hàng và cùng đưa cho đơn vị vận chuyển. Khác ở hai khối mà chỉ
 * bảo hành mới có: BỆNH / LỖI và LINH KIỆN ĐÃ THAY.
 *
 * KHÔNG BẮT BUỘC in: khách đến lấy tận nơi thì không cần nhãn. Nhãn dành cho ca
 * gửi chuyển phát — dán lên máy để bên vận chuyển và khách đối chiếu.
 *
 * In đi thẳng ra máy in của trình duyệt (printElement dựng iframe riêng), KHÔNG
 * qua agent máy in như tem đóng gói: tem đóng gói bắt buộc phải có bản lưu bất
 * biến + nhật ký in để đối soát phiếu xuất, còn nhãn này là giấy tờ bàn giao
 * kèm máy, không phải chứng từ kho.
 */
export function WarrantyReturnLabelDialog({
  open,
  detail,
  onClose,
}: WarrantyReturnLabelDialogProps) {
  const t = useT();
  const canViewPii = useCanAny(["warranty.pii.view"]);
  const canIssue = useCanAny(["warranty.component_issue"]);
  const labelRef = useRef<HTMLDivElement | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);

  const caseId = detail?.id ?? "";
  const caseCode = detail?.case_code ?? "";

  // Cùng tham số với tab "Phiếu linh kiện" của modal chi tiết → cùng queryKey →
  // dùng lại đúng response đã có trong cache, không gọi thêm một lượt nào.
  const issuesQuery = useComponentIssues(
    { warranty_case_id: caseId, per_page: 50 },
    open && canIssue && caseId !== "",
  );

  // CHỈ phiếu đã ghi sổ mới là linh kiện THẬT SỰ đã thay: DRAFT/SCANNING mới là
  // dự kiến (chưa trừ tồn), CANCELLED thì không bao giờ ra khỏi kho.
  const postedIds = useMemo(
    () =>
      (issuesQuery.data?.data ?? [])
        .filter((document) => document.status === "POSTED")
        .map((document) => document.id)
        .filter((id) => id !== ""),
    [issuesQuery.data],
  );

  const detailQueries = useComponentIssueDetails(
    postedIds,
    open && canIssue && postedIds.length > 0,
  );
  const componentsLoading = detailQueries.some((query) => query.isPending);

  /**
   * Gộp theo SKU: một hồ sơ có thể xuất linh kiện làm nhiều đợt (thay thử một
   * lần chưa hết bệnh), khách chỉ cần biết TỔNG đã thay bao nhiêu cái.
   */
  const components = useMemo<ReplacedComponent[]>(() => {
    const merged = new Map<string, ReplacedComponent>();
    for (const query of detailQueries) {
      for (const line of query.data?.lines ?? []) {
        // Sau khi Post, `scanned_qty` luôn bằng `required_qty` (điều kiện ghi
        // sổ); giữ nhánh dự phòng để dữ liệu cũ thiếu scan không hiện số 0.
        const quantity =
          line.scanned_qty > 0 ? line.scanned_qty : line.required_qty;
        if (quantity <= 0) continue;
        const key = line.sku_id || line.sku_code || line.id;
        const current = merged.get(key);
        if (current) {
          current.quantity += quantity;
          continue;
        }
        merged.set(key, {
          key,
          skuCode: line.sku_code,
          // normalizeLine đặt mặc định "-" cho tên thiếu; quy về ô rỗng chuẩn
          // của dự án thay vì in dấu gạch lên nhãn giao khách.
          skuName: line.sku_name === "-" ? "" : line.sku_name,
          quantity,
        });
      }
    }
    return [...merged.values()].sort((left, right) =>
      (left.skuName || left.skuCode).localeCompare(
        right.skuName || right.skuCode,
        "vi",
      ),
    );
  }, [detailQueries]);

  const totalQuantity = components.reduce(
    (sum, item) => sum + item.quantity,
    0,
  );

  useEffect(() => {
    if (!open || caseCode === "") {
      setQrDataUrl(null);
      return;
    }
    // Cùng lý do với tem đóng gói: KHÔNG rơi về UUID nội bộ. Mã QR dán lên máy
    // để khâu sau quét tra cứu — encode UUID vào đó tạo ra nhãn quét được mà
    // không tra được gì, tệ hơn hẳn việc bỏ trống ô QR.
    let cancelled = false;
    QRCode.toDataURL(caseCode, { margin: 0, width: 120 })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [open, caseCode]);

  // Callback ref (không phải useEffect + useRef): UiDialog mount nội dung ở một
  // commit riêng qua portal, một effect khoá theo [open] có thể chạy TRƯỚC khi
  // <svg> gắn vào DOM và sẽ không chạy lại lúc nó xuất hiện.
  const attachBarcode = useCallback(
    (node: SVGSVGElement | null) => {
      if (!node || caseCode === "") return;
      try {
        JsBarcode(node, caseCode, {
          format: "CODE128",
          displayValue: false,
          margin: 0,
          width: 1.6,
          height: 46,
        });
      } catch {
        // Mã chứa ký tự CODE128 không mã hoá được — để trống khung mã vạch,
        // không để lỗi phá cả hộp thoại.
      }
    },
    [caseCode],
  );

  const handlePrint = () => {
    const node = labelRef.current;
    if (!node) return;
    setPrinting(true);
    printElement(node, {
      title: caseCode || t("warranty.returnLabel.title"),
      page: LABEL_PAGE,
      extraCss: LABEL_PRINT_CSS,
    })
      .catch(() => toast.error(t("warranty.returnLabel.printError")))
      .finally(() => setPrinting(false));
  };

  if (!detail) return null;

  const itemCode =
    detail.identification_type === "TEMP_ONLY"
      ? detail.temporary_item_code
      : (detail.item_code ?? detail.serial_number);

  // Bệnh/lỗi theo danh mục (BA M1 cho nhiều bệnh trên một hồ sơ); dữ liệu cũ
  // chỉ có một cặp defect_code/defect thì vẫn hiện đúng một dòng.
  const defectLines = detail.defects?.length
    ? detail.defects.map((defect) =>
        defect.defect_code
          ? `${defect.defect_code} · ${defect.defect_name}`
          : defect.defect_name,
      )
    : detail.defect_code
      ? [`${detail.defect_code} · ${detail.defect}`]
      : detail.defect
        ? [detail.defect]
        : [];

  const customerName = warrantyPiiText(
    detail.customer_name,
    canViewPii,
    "name",
  );
  const customerPhone = warrantyPiiText(
    detail.customer_phone,
    canViewPii,
    "phone",
  );
  const customerAddress = warrantyPiiText(
    detail.customer_address,
    canViewPii,
    "address",
  );

  const headerCellSx = {
    typography: "caption",
    fontWeight: 700,
    fontSize: 9,
    color: "text.secondary",
    borderBottom: "1px solid",
    borderColor: "text.primary",
    pb: 0.25,
  } as const;
  const cellSx = { typography: "caption", fontSize: 9 } as const;
  const sectionSx = {
    px: 1,
    py: 0.75,
    borderBottom: "1px solid",
    borderColor: "divider",
  } as const;
  const sectionTitleSx = {
    typography: "caption",
    color: "text.secondary",
    mb: 0.25,
  } as const;

  return (
    <UiDialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      title={t("warranty.returnLabel.title")}
      actions={
        <>
          <ActionButton kind="close" onClick={onClose}>
            {t("common.close")}
          </ActionButton>
          <ActionButton
            kind="print"
            disabled={printing || componentsLoading}
            onClick={handlePrint}
          >
            {printing
              ? t("warranty.returnLabel.printing")
              : t("warranty.returnLabel.print")}
          </ActionButton>
        </>
      }
    >
      <Stack spacing={1.5} sx={{ alignItems: "center" }}>
        {!canViewPii ? (
          <UiAlert tone="warning">
            {t("warranty.returnLabel.piiMaskedWarning")}
          </UiAlert>
        ) : null}
        {canIssue && componentsLoading ? (
          <UiAlert tone="info">
            {t("warranty.returnLabel.loadingComponents")}
          </UiAlert>
        ) : null}

        {/* Khung nhãn: khổ đứng 10×15cm, viền đậm như tem thật. */}
        <Box
          ref={labelRef}
          className={LABEL_PRINT_CLASS}
          data-testid="warranty-return-label"
          sx={{
            width: "100%",
            maxWidth: 340,
            border: "2px solid",
            borderColor: "text.primary",
            borderRadius: 1,
            bgcolor: "background.paper",
            fontFamily: "var(--wms-font-family)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Header: thương hiệu kho + khung góc đóng dấu (badge + QR). */}
          <Stack
            direction="row"
            sx={{
              p: 1,
              borderBottom: "2px solid",
              borderColor: "text.primary",
              alignItems: "stretch",
              gap: 1,
            }}
          >
            <Stack spacing={0.25} sx={{ flex: 1, justifyContent: "center" }}>
              <Box sx={{ typography: "caption", fontWeight: 700 }}>
                HOA NAM WMS
              </Box>
              <Box sx={{ typography: "caption", color: "text.secondary" }}>
                {t("warranty.returnLabel.brandLine")}
              </Box>
            </Stack>
            <Stack
              spacing={0.25}
              sx={{
                alignItems: "center",
                border: "1px solid",
                borderColor: "text.primary",
                borderRadius: 0.5,
                px: 0.75,
                py: 0.5,
              }}
            >
              <Box
                sx={{
                  typography: "caption",
                  fontSize: 8,
                  lineHeight: 1.1,
                  textAlign: "center",
                }}
              >
                {t("warranty.returnLabel.stamp")}
              </Box>
              <Box
                sx={{
                  typography: "h6",
                  fontWeight: 800,
                  lineHeight: 1,
                  fontFamily: "var(--wms-font-family)",
                }}
              >
                BH
              </Box>
              {qrDataUrl ? (
                <Box
                  component="img"
                  src={qrDataUrl}
                  alt={`QR ${caseCode}`}
                  sx={{ width: 44, height: 44 }}
                />
              ) : (
                <Box sx={{ width: 44, height: 44, bgcolor: "action.hover" }} />
              )}
            </Stack>
          </Stack>

          {/* Banner: mã hồ sơ bảo hành + mốc nhận / sửa xong. */}
          <Box
            sx={{
              px: 1,
              py: 0.75,
              borderBottom: "1px solid",
              borderColor: "divider",
            }}
          >
            <Box
              sx={{
                typography: "subtitle1",
                fontWeight: 800,
                lineHeight: 1.15,
                wordBreak: "break-all",
              }}
            >
              {caseCode || EMPTY_TEXT}
            </Box>
            <Stack
              direction="row"
              sx={{
                typography: "caption",
                justifyContent: "space-between",
                color: "text.secondary",
                columnGap: 1,
              }}
            >
              <Box>
                {t("warranty.returnLabel.receivedAt", {
                  date: detail.received_at
                    ? formatDate(detail.received_at)
                    : EMPTY_TEXT,
                })}
              </Box>
              <Box>
                {t("warranty.returnLabel.completedAt", {
                  date: detail.completed_at
                    ? formatDate(detail.completed_at)
                    : EMPTY_TEXT,
                })}
              </Box>
            </Stack>
          </Box>

          {/* Cảnh báo nghiệp vụ — nội dung của Hoa Nam, không phải bưu hiệu. */}
          <Box
            sx={{
              px: 1,
              py: 0.5,
              borderBottom: "1px solid",
              borderColor: "divider",
              bgcolor: "action.hover",
              typography: "caption",
              fontWeight: 700,
              textAlign: "center",
              fontSize: 9.5,
              lineHeight: 1.4,
            }}
          >
            {t("warranty.returnLabel.warnCheck")}
            <br />
            {t("warranty.returnLabel.warnKeep")}
          </Box>

          {/* Người nhận lại máy. */}
          <Box sx={sectionSx}>
            <Box sx={sectionTitleSx}>{t("warranty.returnLabel.recipient")}</Box>
            <Box sx={{ typography: "body2", fontWeight: 700 }}>
              {customerName || EMPTY_TEXT}
            </Box>
            {customerAddress ? (
              <Box sx={{ typography: "caption" }}>{customerAddress}</Box>
            ) : null}
            {customerPhone ? (
              <Box sx={{ typography: "caption" }}>
                {t("warranty.returnLabel.phone", { phone: customerPhone })}
              </Box>
            ) : null}
          </Box>

          {/* Máy đang trả. */}
          <Box sx={sectionSx}>
            <Box sx={sectionTitleSx}>{t("warranty.returnLabel.device")}</Box>
            <Box sx={{ typography: "body2", fontWeight: 700 }}>
              {detail.sku || detail.sku_name || EMPTY_TEXT}
            </Box>
            {detail.sku && detail.sku_name && detail.sku !== detail.sku_name ? (
              <Box sx={{ typography: "caption" }}>{detail.sku_name}</Box>
            ) : null}
            <Box sx={{ typography: "caption" }}>
              {t("warranty.returnLabel.itemCode", {
                code: itemCode || EMPTY_TEXT,
              })}
            </Box>
          </Box>

          {/* Bệnh / lỗi — khối riêng của nhãn bảo hành. */}
          <Box sx={sectionSx}>
            <Box sx={sectionTitleSx}>{t("warranty.returnLabel.defects")}</Box>
            {defectLines.length ? (
              <Stack spacing={0.15}>
                {defectLines.map((line) => (
                  <Box key={line} sx={{ ...cellSx, fontWeight: 700 }}>
                    {line}
                  </Box>
                ))}
              </Stack>
            ) : (
              <Box sx={{ ...cellSx, color: "text.secondary" }}>
                {t("warranty.returnLabel.noDefect")}
              </Box>
            )}
            {detail.confirmed_defect?.trim() ? (
              <Box sx={{ ...cellSx, mt: 0.35 }}>
                {t("warranty.returnLabel.checkResult", {
                  result: detail.confirmed_defect.trim(),
                })}
              </Box>
            ) : null}
          </Box>

          {/* Linh kiện đã thay — khối riêng của nhãn bảo hành. */}
          <Box sx={sectionSx}>
            <Box sx={sectionTitleSx}>
              {t("warranty.returnLabel.components")}
            </Box>
            {!canIssue ? (
              <Box sx={{ ...cellSx, color: "text.secondary" }}>
                {t("warranty.returnLabel.componentsNoPermission")}
              </Box>
            ) : components.length ? (
              <>
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto auto",
                    columnGap: 0.75,
                    rowGap: 0.35,
                  }}
                >
                  <Box sx={headerCellSx}>
                    {t("warranty.returnLabel.colComponentName")}
                  </Box>
                  <Box sx={headerCellSx}>SKU</Box>
                  <Box sx={{ ...headerCellSx, textAlign: "right" }}>SL</Box>
                  {components.map((item) => (
                    // display:"contents" giữ 3 ô là item trực tiếp của grid cha
                    // thay vì bị bọc thêm một hàng — cần để 3 cột thẳng header.
                    <Box key={item.key} sx={{ display: "contents" }}>
                      <Box
                        sx={{
                          ...cellSx,
                          minWidth: 0,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {item.skuName || EMPTY_TEXT}
                      </Box>
                      <Box
                        sx={{
                          ...cellSx,
                          fontWeight: 700,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {item.skuCode || EMPTY_TEXT}
                      </Box>
                      <Box
                        sx={{ ...cellSx, fontWeight: 700, textAlign: "right" }}
                      >
                        {item.quantity}
                      </Box>
                    </Box>
                  ))}
                </Box>
                <Stack
                  direction="row"
                  sx={{
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    mt: 0.5,
                    pt: 0.35,
                    borderTop: "1px solid",
                    borderColor: "text.primary",
                  }}
                >
                  <Box
                    sx={{ typography: "caption", fontWeight: 700, fontSize: 9 }}
                  >
                    {t("warranty.returnLabel.totalQty")}
                  </Box>
                  <Box sx={{ typography: "subtitle2", fontWeight: 800 }}>
                    {totalQuantity}
                  </Box>
                </Stack>
              </>
            ) : (
              <Box sx={{ ...cellSx, color: "text.secondary" }}>
                {t("warranty.returnLabel.componentsEmpty")}
              </Box>
            )}
          </Box>

          {/* Mã vạch tra cứu. */}
          <Box
            sx={{
              px: 1,
              py: 0.75,
              borderBottom: "2px solid",
              borderColor: "text.primary",
              textAlign: "center",
            }}
          >
            <Box
              component="svg"
              ref={attachBarcode}
              data-testid="warranty-return-label-barcode"
              sx={{ width: "100%", height: 46, display: "block" }}
            />
            <Box
              sx={{
                typography: "caption",
                fontSize: 9,
                wordBreak: "break-all",
                mt: 0.25,
              }}
            >
              {caseCode || EMPTY_TEXT}
            </Box>
          </Box>

          {/* Ký nhận bàn giao — ô tích vẽ bằng viền CSS, không dùng ký tự
              checkbox Unicode làm icon (ui:icons chỉ cho phép glyph Flaticon). */}
          <Box sx={{ px: 1, py: 0.75 }}>
            <Box sx={{ typography: "caption", fontWeight: 700, mb: 0.5 }}>
              {t("warranty.returnLabel.internalUse")}
            </Box>
            <Box
              sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0.5 }}
            >
              {[
                t("warranty.returnLabel.repaired"),
                t("warranty.returnLabel.inspected"),
              ].map((cell) => (
                <Stack
                  key={cell}
                  direction="row"
                  spacing={0.5}
                  sx={{
                    alignItems: "center",
                    border: "1px solid",
                    borderColor: "divider",
                    px: 0.5,
                    py: 0.25,
                  }}
                >
                  <Box
                    sx={{
                      width: 9,
                      height: 9,
                      border: "1px solid",
                      borderColor: "text.primary",
                      flexShrink: 0,
                    }}
                  />
                  <Box sx={{ typography: "caption", fontSize: 9 }}>{cell}</Box>
                </Stack>
              ))}
              {[
                t("warranty.returnLabel.dateLine"),
                t("warranty.returnLabel.handoverLine"),
              ].map((cell) => (
                <Box
                  key={cell}
                  sx={{
                    border: "1px solid",
                    borderColor: "divider",
                    px: 0.5,
                    py: 0.25,
                    typography: "caption",
                    fontSize: 9,
                  }}
                >
                  {cell}
                </Box>
              ))}
            </Box>
          </Box>
        </Box>

        <Box
          sx={{
            typography: "caption",
            color: "text.secondary",
            textAlign: "center",
          }}
        >
          {t("warranty.returnLabel.hint")}
        </Box>
      </Stack>
    </UiDialog>
  );
}
