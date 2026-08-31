import type { PvFreshness } from "@/modules/pv/types/pv.types";
import { EMPTY_TEXT } from "@/shared/constants/display";
import { formatDateTime } from "@/shared/utils/format-date";

/**
 * WWHN-252 / NFR-SRS-016 + §13.7 (PV cache): read model tồn kho của App PV có
 * max staleness <= 60s và PHẢI phát `data_as_of` để người xem biết số tồn được
 * chụp lúc nào.
 *
 * Tuổi dữ liệu được đo bằng `received_at` (mốc client nhận response, do
 * `publicHttp` đóng dấu ngay tại tầng transport) trừ `data_as_of` (mốc server
 * chụp số liệu) — KHÔNG so `data_as_of` với đồng hồ máy khách lúc render. Hai lý
 * do:
 *
 * 1. Máy khách lệch giờ vài phút là chuyện thường; so trực tiếp sẽ báo degraded
 *    giả, hoặc tệ hơn là giấu degraded thật.
 * 2. Đóng dấu ở tầng transport giữ hàm này THUẦN — component không được gọi
 *    Date.now() trong lúc render (react-hooks/purity).
 *
 * Cách đo này bắt đúng trường hợp cần cảnh báo: response bị một tầng cache trung
 * gian giữ lại lâu hơn ngưỡng cho phép.
 */
export interface PvFreshnessResult {
  ageSeconds: number | null;
  isDegraded: boolean;
  thresholdSeconds: number;
}

export function computeFreshness(
  meta: PvFreshness | undefined,
): PvFreshnessResult {
  const thresholdSeconds = meta?.max_staleness_seconds ?? 60;
  if (!meta?.data_as_of) {
    return { ageSeconds: null, isDegraded: false, thresholdSeconds };
  }

  const stampedAt = Date.parse(meta.data_as_of);
  if (Number.isNaN(stampedAt)) {
    return { ageSeconds: null, isDegraded: false, thresholdSeconds };
  }

  // Thiếu received_at (response dựng tay trong test, hoặc client cũ) thì coi như
  // vừa nhận: thà không cảnh báo còn hơn cảnh báo sai.
  const receivedAt = meta.received_at ?? stampedAt;
  const ageSeconds = Math.max(0, Math.round((receivedAt - stampedAt) / 1000));

  return {
    ageSeconds,
    isDegraded: ageSeconds > thresholdSeconds,
    thresholdSeconds,
  };
}

export function formatDataAsOf(value: string | undefined): string {
  if (!value) return EMPTY_TEXT;
  // formatDateTime đã trả EMPTY_TEXT khi rỗng/không hợp lệ (xem format-date.ts).
  return formatDateTime(value);
}
