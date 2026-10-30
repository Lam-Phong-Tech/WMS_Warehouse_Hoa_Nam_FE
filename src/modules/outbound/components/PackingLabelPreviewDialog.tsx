import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import JsBarcode from "jsbarcode";
import { Box, Stack, UiDialog } from "@/shared/ui";
import { ActionButton } from "@/shared/components/actions";
import { EMPTY_TEXT } from "@/shared/constants/display";
import { useT } from "@/shared/i18n/useT";
import type { PackingLabelRecord } from "@/modules/outbound/services/alignedOutboundService";

interface PackingLabelPreviewDialogProps {
  open: boolean;
  label: PackingLabelRecord | null;
  onClose: () => void;
}

/**
 * Bản xem trước TRỰC QUAN của tem xuất kho, mô phỏng bố cục một tem vận
 * chuyển chuyên nghiệp (khung góc đóng dấu, banner tiêu đề, mã vạch + QR,
 * khu vực chỉ dùng nội bộ kho) — nội dung hoàn toàn của Hoa Nam WMS, không
 * dùng thương hiệu/bưu hiệu của bất kỳ đơn vị vận chuyển nào.
 *
 * In thật đi qua một agent máy in bên ngoài (dispatchLabelOnce ở BE gửi JSON
 * label_payload tới printer.agent_endpoint — chính agent đó mới dàn trang và
 * in ra tem vật lý); WMS không nhận lại được bản render từ phía đó. Component
 * này tự dựng lại đúng nội dung sẽ gửi đi để người dùng biết trước tem trông
 * ra sao — không phải bản in thật, có thể lệch nhẹ bố cục so với tem vật lý.
 */
export function PackingLabelPreviewDialog({
  open,
  label,
  onClose,
}: PackingLabelPreviewDialogProps) {
  const t = useT();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !label) {
      setQrDataUrl(null);
      return;
    }
    // KHÔNG fallback sang label.id: mã QR/vạch được DÁN LÊN KIỆN HÀNG và quét
    // lại ở khâu sau. Encode UUID nội bộ vào đó tạo ra nhãn quét-được-nhưng-vô-
    // nghĩa (khâu sau quét ra không tra được gì) — tệ hơn hẳn việc không có mã.
    // Thiếu labelCode thì bỏ trống, phần chữ bên dưới đã báo "chưa có mã".
    const qrValue = label.labelCode;
    if (!qrValue) {
      setQrDataUrl(null);
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(qrValue, { margin: 0, width: 120 })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [open, label]);

  // Callback ref thay vì useEffect + useRef: UiDialog mount nội dung ở một
  // commit riêng (transition/portal), nên một effect khoá theo [open, label]
  // có thể chạy TRƯỚC khi <svg> thật sự gắn vào DOM và sẽ không chạy lại khi
  // nó xuất hiện. Callback ref được React gọi đúng thời điểm node gắn/gỡ, và
  // useCallback với cùng dependency ép React gỡ-gắn lại (gọi callback với
  // node hiện tại) mỗi khi label đổi.
  const attachBarcode = useCallback(
    (node: SVGSVGElement | null) => {
      if (!node || !label) return;
      // Cùng lý do với QR ở trên: không encode UUID nội bộ vào mã vạch in ra.
      const value = label.labelCode;
      if (!value) return;
      try {
        JsBarcode(node, value, {
          format: "CODE128",
          displayValue: false,
          margin: 0,
          width: 1.6,
          height: 46,
        });
      } catch {
        // Mã chứa ký tự CODE128 không mã hoá được — để khung mã vạch trống
        // thay vì để lỗi phá cả bản xem trước.
      }
    },
    [label],
  );

  if (!label) return null;

  // Tổng số lượng khớp đúng những gì bảng bên dưới liệt kê (cộng trực tiếp
  // từ các dòng đang hiển thị) thay vì đọc lại itemCount riêng — tránh lệch
  // nếu hai con số này có lúc khác nhau.
  const totalQuantity = label.skuSummary.reduce(
    (sum, item) => sum + item.quantity,
    0,
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

  return (
    <UiDialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      title={t("outbound.label.previewTitle")}
      actions={
        <ActionButton kind="close" onClick={onClose}>
          {t("common.close")}
        </ActionButton>
      }
    >
      <Stack spacing={1.5} sx={{ alignItems: "center" }}>
        {/* Khung mô phỏng tem: khổ đứng ~10x15cm, viền đậm như tem thật. */}
        <Box
          sx={{
            width: "100%",
            maxWidth: 340,
            aspectRatio: "2 / 3",
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
                {t("outbound.label.brandLine")}
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
                {t("outbound.label.stamp")}
              </Box>
              <Box
                sx={{
                  typography: "h6",
                  fontWeight: 800,
                  lineHeight: 1,
                  fontFamily: "var(--wms-font-family)",
                }}
              >
                XK
              </Box>
              {qrDataUrl ? (
                <Box
                  component="img"
                  src={qrDataUrl}
                  alt={`QR ${label.labelCode}`}
                  sx={{ width: 44, height: 44 }}
                />
              ) : (
                <Box sx={{ width: 44, height: 44, bgcolor: "action.hover" }} />
              )}
            </Stack>
          </Stack>

          {/* Banner tiêu đề: mã phiếu xuất, to đậm như headline dịch vụ. */}
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
              {label.outboundNo || EMPTY_TEXT}
            </Box>
            <Stack
              direction="row"
              sx={{
                typography: "caption",
                justifyContent: "space-between",
                color: "text.secondary",
              }}
            >
              <Box>
                {t("outbound.label.sourceRequest", {
                  code: label.sourceRequestNo || EMPTY_TEXT,
                })}
              </Box>
              <Box>
                {t("outbound.label.counts", {
                  skuCount: label.skuCount,
                  itemCount: label.itemCount,
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
            {t("outbound.label.warnCheck")}
            <br />
            {t("outbound.label.warnNoReturn")}
          </Box>

          {/* Người nhận. */}
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
                typography: "caption",
                color: "text.secondary",
                mb: 0.25,
              }}
            >
              {t("outbound.label.recipient")}
            </Box>
            <Box sx={{ typography: "body2", fontWeight: 700 }}>
              {label.recipientName || EMPTY_TEXT}
            </Box>
            {label.recipientAddress ? (
              <Box sx={{ typography: "caption" }}>{label.recipientAddress}</Box>
            ) : null}
            {label.customerPhone ? (
              <Box sx={{ typography: "caption" }}>
                {t("outbound.label.phone", { phone: label.customerPhone })}
              </Box>
            ) : null}
          </Box>

          {/* Sản phẩm. */}
          <Box
            sx={{
              px: 1,
              py: 0.75,
              borderBottom: "1px solid",
              borderColor: "divider",
              flex: 1,
              minHeight: 0,
              overflow: "auto",
            }}
          >
            <Box
              sx={{
                typography: "caption",
                color: "text.secondary",
                mb: 0.25,
              }}
            >
              {t("outbound.label.products")}
            </Box>
            {label.skuSummary.length ? (
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
                    {t("outbound.label.colProductName")}
                  </Box>
                  <Box sx={headerCellSx}>SKU</Box>
                  <Box sx={{ ...headerCellSx, textAlign: "right" }}>SL</Box>
                  {label.skuSummary.map((item) => (
                    // display:"contents" giữ 3 ô là item trực tiếp của grid
                    // cha thay vì bị bọc thêm một hàng — cần để 3 cột thẳng
                    // hàng đúng theo header.
                    <Box
                      key={item.skuId || item.skuCode}
                      sx={{ display: "contents" }}
                    >
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
                        sx={{
                          ...cellSx,
                          fontWeight: 700,
                          textAlign: "right",
                        }}
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
                    {t("outbound.label.totalQty")}
                  </Box>
                  <Box sx={{ typography: "subtitle2", fontWeight: 800 }}>
                    {totalQuantity}
                  </Box>
                </Stack>
              </>
            ) : (
              <Box sx={{ typography: "caption", color: "text.secondary" }}>
                {t("outbound.label.emptyLines")}
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
              data-testid="packing-label-barcode"
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
              {label.labelCode}
            </Box>
          </Box>

          {/* Chỉ dùng nội bộ kho — khung ô tích như phiếu giao nhận thật. */}
          <Box sx={{ px: 1, py: 0.75 }}>
            <Box
              sx={{
                typography: "caption",
                fontWeight: 700,
                mb: 0.5,
              }}
            >
              {t("outbound.label.internalUse")}
            </Box>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 0.5,
              }}
            >
              {[t("outbound.label.packed"), t("outbound.label.inspected")].map(
                (cell) => (
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
                    {/* Ô tích vẽ bằng viền CSS — không dùng ký tự checkbox
                      Unicode làm icon (ui:icons chỉ cho phép glyph Flaticon). */}
                    <Box
                      sx={{
                        width: 9,
                        height: 9,
                        border: "1px solid",
                        borderColor: "text.primary",
                        flexShrink: 0,
                      }}
                    />
                    <Box sx={{ typography: "caption", fontSize: 9 }}>
                      {cell}
                    </Box>
                  </Stack>
                ),
              )}
              {[
                t("outbound.label.dateLine"),
                t("outbound.label.ownerLine"),
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
      </Stack>
    </UiDialog>
  );
}
