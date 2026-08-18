/**
 * WWHN-268 — Hợp đồng trạng thái UI dùng chung cho toàn bộ màn hình MVP.
 *
 * Lý do tồn tại (root cause của defect FE268-D01):
 * SRS/FRD v1.12 Annex D quy định mỗi màn hình phải có trạng thái Loading /
 * Empty / Error / Success / Disabled / Confirm / Permission-denied, nhưng
 * FE không có bất kỳ test hook ổn định nào cho các trạng thái đó. Bằng chứng
 * QA2 (screenshot/video theo từng trạng thái) vì vậy phải dò theo chuỗi tiếng
 * Việt hiển thị trên UI — vỡ ngay khi đổi copy, và không thể chứng minh
 * "đã chụp đúng trạng thái nào".
 *
 * Hợp đồng: mọi surface trạng thái dùng chung phải phát ra đồng thời
 *   data-ui-state="<key>"  (thuộc tính ngữ nghĩa, dùng cho CSS/QA/analytics)
 *   data-testid="ui-state-<key>"  (selector ổn định cho Playwright/Vitest)
 * qua helper {@link uiStateProps}. Không hard-code chuỗi testid ở nơi khác.
 */

export const UI_STATE = {
  LOADING: "loading",
  EMPTY: "empty",
  ERROR: "error",
  SUCCESS: "success",
  DISABLED: "disabled",
  CONFIRM: "confirm",
  PERMISSION_DENIED: "permission-denied",
} as const;

export type UiStateKey = (typeof UI_STATE)[keyof typeof UI_STATE];

/** Thứ tự chuẩn dùng cho ma trận bằng chứng QA2 của WWHN-268. */
export const UI_STATE_ORDER: readonly UiStateKey[] = [
  UI_STATE.LOADING,
  UI_STATE.EMPTY,
  UI_STATE.ERROR,
  UI_STATE.SUCCESS,
  UI_STATE.DISABLED,
  UI_STATE.CONFIRM,
  UI_STATE.PERMISSION_DENIED,
] as const;

export function uiStateTestId(state: UiStateKey): string {
  return `ui-state-${state}`;
}

export interface UiStateAttributes {
  "data-ui-state": UiStateKey;
  "data-testid": string;
}

/**
 * Trả về cặp thuộc tính chuẩn cho một surface trạng thái.
 *
 * `testId` chỉ được truyền khi component đã có testid riêng do màn nghiệp vụ
 * chỉ định; khi đó `data-ui-state` vẫn giữ nguyên để ma trận bằng chứng nhận ra
 * đúng loại trạng thái.
 */
export function uiStateProps(
  state: UiStateKey,
  testId?: string,
): UiStateAttributes {
  return {
    "data-ui-state": state,
    "data-testid": testId ?? uiStateTestId(state),
  };
}

/**
 * Selector chuẩn để bằng chứng QA2 định vị từng trạng thái.
 *
 * SUCCESS không có surface dùng chung trong FE: phản hồi thành công đi qua
 * toast của `sonner`, thư viện này phát `data-sonner-toast` + `data-type` trên
 * chính phần tử toast. Vì vậy hợp đồng ánh xạ SUCCESS sang selector của sonner
 * thay vì bọc thêm một lớp DOM chỉ để phục vụ test.
 */
export const UI_STATE_SELECTOR: Record<UiStateKey, string> = {
  [UI_STATE.LOADING]: '[data-ui-state="loading"]',
  [UI_STATE.EMPTY]: '[data-ui-state="empty"]',
  [UI_STATE.ERROR]: '[data-ui-state="error"]',
  [UI_STATE.SUCCESS]: '[data-sonner-toast][data-type="success"]',
  [UI_STATE.DISABLED]: '[data-ui-state="disabled"]',
  [UI_STATE.CONFIRM]: '[data-ui-state="confirm"]',
  [UI_STATE.PERMISSION_DENIED]: '[data-ui-state="permission-denied"]',
};
