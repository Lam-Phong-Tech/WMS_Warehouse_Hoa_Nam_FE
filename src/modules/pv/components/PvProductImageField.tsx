/**
 * MST-PV-01 — ô ẢNH SẢN PHẨM của hộp thoại thêm/sửa sản phẩm App PV.
 *
 * Ảnh được tải lên KHO LƯU TRỮ CỦA HỆ THỐNG qua API của mình (MinIO ở dev,
 * Cloudflare R2 ở deploy) — cùng lối với tệp đính kèm bảo hành; xem
 * `pv-image.service.ts`. Component này chỉ giữ DANH SÁCH URL đã upload cùng thứ
 * tự và cờ ảnh đại diện.
 *
 * Thứ tự trong mảng chính là `sort_order` mà BE ghi xuống `pv_product_images`,
 * nên "đưa lên trước / xuống sau" là thao tác nghiệp vụ thật chứ không phải
 * trang trí: thẻ sản phẩm trên App PV lấy ảnh đầu tiên khi không có ảnh đại diện.
 *
 * Vẫn giữ ô DÁN URL bên cạnh nút tải lên, cho ảnh đã nằm sẵn trên CDN khác.
 */
import { useEffect, useRef, useState, type DragEvent } from "react";
import { Box, Stack, UiAlert, UiTextField } from "@/shared/ui";
import { RADIUS, SEMANTIC_LIGHT as S } from "@/shared/ui/tokens";
import { ActionButton, ActionIconButton } from "@/shared/components/actions";
import { useT } from "@/shared/i18n/useT";
import { toast } from "sonner";
import { getMutationErrorMessage } from "@/shared/api/api-error";
import {
  PV_IMAGE_RULE,
  isValidImageUrl,
  uploadPvProductImage,
} from "@/modules/pv/services/pv-image.service";
import {
  acceptAttribute,
  checkFile,
  describeExtensions,
  formatFileSize,
} from "@/shared/validation/file-rules";
import type { PvImage } from "@/modules/pv/types/pv.types";

/** Khớp `PvAdminResourceController::PROFILE_IMAGE_MAX` — đổi thì đổi cả hai. */
export const PV_IMAGE_MAX = 8;

export interface PvProductImageFieldProps {
  value: PvImage[];
  onChange: (next: PvImage[]) => void;
  disabled?: boolean;
  /** Câu lỗi từ 422 của BE (khoá `images`). */
  error?: string;
}

/** Ảnh đại diện là DUY NHẤT: bật ảnh này thì mọi ảnh khác phải tắt. */
function withPrimaryAt(images: PvImage[], index: number): PvImage[] {
  return images.map((image, position) => ({
    ...image,
    is_primary: position === index,
  }));
}

/**
 * Sau khi xoá/đổi thứ tự, danh sách phải còn ĐÚNG MỘT ảnh đại diện — BE có
 * UNIQUE index trên (profile_id) WHERE is_primary, và mặt công khai luôn cần một
 * ảnh để vẽ thẻ sản phẩm.
 */
function normalizePrimary(images: PvImage[]): PvImage[] {
  if (images.length === 0) return images;
  const at = images.findIndex((image) => image.is_primary);
  return withPrimaryAt(images, at === -1 ? 0 : at);
}

export function PvProductImageField({
  value,
  onChange,
  disabled = false,
  error,
}: PvProductImageFieldProps) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [manualUrl, setManualUrl] = useState("");
  const [manualError, setManualError] = useState("");

  // Đóng hộp thoại giữa lúc upload: huỷ request đang bay, nếu không thì
  // `setUploading` chạy trên component đã unmount và tệp vẫn lặng lẽ lên bucket.
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => () => abortRef.current?.abort(), []);

  const slotsLeft = PV_IMAGE_MAX - value.length;
  const busy = disabled || uploading > 0;

  async function acceptFiles(files: File[]) {
    if (files.length === 0) return;
    if (slotsLeft <= 0) {
      toast.error(
        t("pv.productCatalog.imageMaxReached", { max: PV_IMAGE_MAX }),
      );
      return;
    }

    // Cắt theo số slot còn lại TRƯỚC khi upload: upload xong mới báo "quá số
    // ảnh" là đã tốn băng thông của người dùng và để lại ảnh rác trong bucket.
    const selected = files.slice(0, slotsLeft);
    if (files.length > selected.length) {
      toast.error(
        t("pv.productCatalog.imageMaxReached", { max: PV_IMAGE_MAX }),
      );
    }

    const valid: File[] = [];
    for (const file of selected) {
      const check = checkFile(file, PV_IMAGE_RULE);
      if (check.ok) valid.push(file);
      else toast.error(check.message);
    }
    if (valid.length === 0) return;

    const controller = new AbortController();
    abortRef.current = controller;
    setUploading((count) => count + valid.length);

    const uploaded: PvImage[] = [];
    for (const file of valid) {
      try {
        const result = await uploadPvProductImage(file, {
          signal: controller.signal,
        });
        uploaded.push({
          url: result.url,
          // alt mặc định lấy tên tệp (bỏ đuôi): trống hoàn toàn thì App PV mất
          // văn bản thay thế, còn tên tệp ít nhất mô tả được ảnh nào.
          alt_text: file.name.replace(/\.[^.]+$/, "").slice(0, 255) || null,
          is_primary: false,
        });
      } catch (uploadError) {
        if (
          (uploadError as Error)?.name === "AbortError" ||
          (uploadError as Error)?.name === "CanceledError"
        ) {
          break;
        }
        // BE trả câu lỗi tiếng Việt đúng ngữ cảnh (sai định dạng, quá nặng,
        // dính mã độc, bucket lỗi) — dùng nguyên thay vì tự viết câu chung.
        toast.error(getMutationErrorMessage(uploadError));
      } finally {
        setUploading((count) => Math.max(0, count - 1));
      }
    }

    if (uploaded.length > 0 && !controller.signal.aborted) {
      onChange(normalizePrimary([...value, ...uploaded]));
    }
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragOver(false);
    if (busy) return;
    // `accept` của <input type="file"> KHÔNG lọc được nhánh kéo-thả này —
    // acceptFiles tự kiểm bằng checkFile (xem shared/validation/file-rules.ts).
    void acceptFiles(Array.from(event.dataTransfer.files ?? []));
  }

  function addManualUrl() {
    const url = manualUrl.trim();
    if (!isValidImageUrl(url)) {
      setManualError(t("pv.productCatalog.imageUrlInvalid"));
      return;
    }
    if (value.some((image) => image.url === url)) {
      setManualError(t("pv.productCatalog.imageDuplicate"));
      return;
    }
    if (value.length >= PV_IMAGE_MAX) {
      setManualError(
        t("pv.productCatalog.imageMaxReached", { max: PV_IMAGE_MAX }),
      );
      return;
    }
    onChange(
      normalizePrimary([...value, { url, alt_text: null, is_primary: false }]),
    );
    setManualUrl("");
    setManualError("");
  }

  function removeAt(index: number) {
    onChange(normalizePrimary(value.filter((_, at) => at !== index)));
  }

  function moveBy(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <Stack spacing={1.25}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
          flexWrap: "wrap",
        }}
      >
        <Box
          component="span"
          sx={{ fontSize: 13, fontWeight: 600, color: S.textHigh }}
        >
          {t("pv.productCatalog.imagesLabel")}
        </Box>
        <Box component="span" sx={{ fontSize: 12, color: S.textMedium }}>
          {t("pv.productCatalog.imageCount", {
            count: value.length,
            max: PV_IMAGE_MAX,
          })}
        </Box>
      </Box>

      <Box
        data-testid="pv-image-dropzone"
        onDragOver={(event: DragEvent<HTMLDivElement>) => {
          event.preventDefault();
          if (!busy) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        sx={{
          border: `1px dashed ${dragOver ? S.primary : S.border}`,
          borderRadius: `${RADIUS.card}px`,
          backgroundColor: dragOver ? S.bgSubtle : "transparent",
          padding: "16px",
          display: "grid",
          gap: "8px",
          justifyItems: "center",
          textAlign: "center",
        }}
      >
        <Box sx={{ fontSize: 13, color: S.textMedium }}>
          {uploading > 0
            ? t("pv.productCatalog.imageUploading", { count: uploading })
            : t("pv.productCatalog.imageDropHint")}
        </Box>
        <ActionButton
          kind="upload"
          onClick={() => inputRef.current?.click()}
          disabled={busy || slotsLeft <= 0}
        >
          {t("pv.productCatalog.imagePick")}
        </ActionButton>
        <Box component="span" sx={{ fontSize: 12, color: S.textDisabled }}>
          {t("pv.productCatalog.imageRule", {
            list: describeExtensions(PV_IMAGE_RULE),
            max: formatFileSize(PV_IMAGE_RULE.maxBytes),
          })}
        </Box>
        <Box
          component="input"
          ref={inputRef}
          type="file"
          multiple
          accept={acceptAttribute(PV_IMAGE_RULE)}
          sx={{ display: "none" }}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
            void acceptFiles(Array.from(event.target.files ?? []));
            // Reset để chọn LẠI đúng tệp vừa xoá vẫn kích hoạt onChange.
            event.target.value = "";
          }}
        />
      </Box>

      <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
        <UiTextField
          fullWidth
          size="small"
          label={t("pv.productCatalog.imageUrlLabel")}
          placeholder="https://cdn.example.com/anh-san-pham.jpg"
          value={manualUrl}
          disabled={busy}
          onChange={(event) => {
            setManualUrl(event.target.value);
            if (manualError) setManualError("");
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addManualUrl();
            }
          }}
          error={Boolean(manualError)}
          helperText={manualError}
          slotProps={{ htmlInput: { maxLength: 500 } }}
        />
        <ActionButton
          kind="create"
          onClick={addManualUrl}
          disabled={busy || manualUrl.trim() === ""}
          sx={{ mt: 0.5, flexShrink: 0 }}
        >
          {t("pv.productCatalog.imageUrlAdd")}
        </ActionButton>
      </Box>

      {error ? <UiAlert tone="error">{error}</UiAlert> : null}

      {value.length === 0 ? (
        <Box component="span" sx={{ fontSize: 12, color: S.textDisabled }}>
          {t("pv.productCatalog.imageEmpty")}
        </Box>
      ) : (
        <Stack spacing={1} data-testid="pv-image-list">
          {value.map((image, index) => (
            <Box
              key={image.url}
              data-testid="pv-image-row"
              sx={{
                display: "flex",
                gap: 1.25,
                alignItems: "flex-start",
                border: `1px solid ${image.is_primary ? S.primary : S.border}`,
                borderRadius: `${RADIUS.card}px`,
                padding: "8px",
              }}
            >
              <Box
                component="img"
                src={image.url}
                alt={image.alt_text ?? ""}
                loading="lazy"
                sx={{
                  width: 72,
                  height: 72,
                  flexShrink: 0,
                  // `contain`: ô xem trước phải cho thấy ĐÚNG tấm ảnh sẽ lên App
                  // PV. `cover` cắt cụt ảnh dọc/ảnh ngang nên người dùng duyệt
                  // nhầm một tấm mà họ chưa từng nhìn thấy trọn vẹn.
                  objectFit: "contain",
                  borderRadius: `${RADIUS.control}px`,
                  backgroundColor: S.bgSubtle,
                }}
              />
              <Box sx={{ flex: 1, minWidth: 0, display: "grid", gap: "6px" }}>
                <UiTextField
                  fullWidth
                  size="small"
                  label={t("pv.productCatalog.imageAltLabel")}
                  value={image.alt_text ?? ""}
                  disabled={busy}
                  onChange={(event) => {
                    const alt = event.target.value;
                    onChange(
                      value.map((item, at) =>
                        at === index
                          ? {
                              ...item,
                              alt_text: alt.trim() === "" ? null : alt,
                            }
                          : item,
                      ),
                    );
                  }}
                  slotProps={{ htmlInput: { maxLength: 255 } }}
                />
                <Box
                  sx={{
                    display: "flex",
                    gap: 0.5,
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <ActionButton
                    kind={image.is_primary ? "confirm" : "view"}
                    disabled={busy || image.is_primary}
                    onClick={() => onChange(withPrimaryAt(value, index))}
                  >
                    {image.is_primary
                      ? t("pv.productCatalog.imageIsPrimary")
                      : t("pv.productCatalog.imageSetPrimary")}
                  </ActionButton>
                  <ActionIconButton
                    kind="back"
                    label={t("pv.productCatalog.imageMoveUp")}
                    disabled={busy || index === 0}
                    onClick={() => moveBy(index, -1)}
                  />
                  <ActionIconButton
                    kind="next"
                    label={t("pv.productCatalog.imageMoveDown")}
                    disabled={busy || index === value.length - 1}
                    onClick={() => moveBy(index, 1)}
                  />
                  <ActionIconButton
                    kind="remove"
                    label={t("pv.productCatalog.imageRemove")}
                    disabled={busy}
                    onClick={() => removeAt(index)}
                  />
                </Box>
              </Box>
            </Box>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
