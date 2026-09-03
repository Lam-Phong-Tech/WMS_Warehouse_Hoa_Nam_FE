import { useLanguageStore } from "@/shared/i18n/language.store";

/**
 * Chuỗi hiển thị chuẩn khi một trường CHƯA CÓ dữ liệu.
 *
 * Quy ước toàn hệ thống (yêu cầu người dùng 2026-08-31): ô/giá trị rỗng phải hiển
 * thị rõ ràng là "Chưa có" — TUYỆT ĐỐI không để dấu gạch ("—" / "-") vì người dùng
 * không phân biệt được "rỗng" với "lỗi". Mọi placeholder rỗng nên tham chiếu hằng
 * này thay vì gõ lại chuỗi gạch inline.
 *
 * Song ngữ (yêu cầu 2026-09-03: đổi EN là đổi đủ 100%): `EMPTY_TEXT` là
 * `export let` — ESM live binding, mọi nơi import đọc GIÁ TRỊ HIỆN TẠI tại thời
 * điểm render, và App remount theo `key={language}` nên đổi ngôn ngữ là mọi ô
 * rỗng đổi theo. Không chuyển sang hàm vì ~350 call site đang dùng như hằng, kể
 * cả để SO SÁNH (`formatted === EMPTY_TEXT`) — live binding giữ cả hai phía so
 * sánh cùng một giá trị trong cùng một render nên phép so sánh vẫn đúng. KHÔNG
 * chép giá trị này ra hằng cấp module ở nơi khác (`const X = EMPTY_TEXT`) — sẽ
 * đóng băng theo ngôn ngữ lúc import.
 */
const EMPTY_TEXT_BY_LANGUAGE = { vi: "Chưa có", en: "None yet" } as const;

export let EMPTY_TEXT: string =
  EMPTY_TEXT_BY_LANGUAGE[useLanguageStore.getState().language] ??
  EMPTY_TEXT_BY_LANGUAGE.vi;

useLanguageStore.subscribe((state) => {
  EMPTY_TEXT =
    EMPTY_TEXT_BY_LANGUAGE[state.language] ?? EMPTY_TEXT_BY_LANGUAGE.vi;
});

/**
 * Trả về text hiển thị cho một giá trị có thể rỗng: null / undefined / chuỗi rỗng
 * (đã trim) đều coi là "chưa có". Số 0 và false là giá trị THẬT nên giữ nguyên.
 */
export function orEmpty(value: unknown, fallback?: string): string {
  const empty = fallback ?? EMPTY_TEXT;
  if (value === null || value === undefined) return empty;
  if (typeof value === "string" && value.trim() === "") return empty;
  return String(value);
}
