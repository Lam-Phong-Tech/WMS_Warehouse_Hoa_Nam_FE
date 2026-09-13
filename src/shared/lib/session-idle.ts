/** Thời gian không thao tác trước khi yêu cầu người dùng xác nhận lại phiên. */
export const WORK_SESSION_IDLE_MS = 60 * 60 * 1000;

const LAST_ACTIVITY_KEY = "hn-wms.work-session.last-activity";

function canUseSessionStorage(): boolean {
  return typeof window !== "undefined";
}

export function readWorkSessionActivity(): number | null {
  if (!canUseSessionStorage()) return null;
  try {
    const value = Number(window.sessionStorage.getItem(LAST_ACTIVITY_KEY));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

export function noteWorkSessionActivity(at = Date.now()): void {
  if (!canUseSessionStorage()) return;
  try {
    window.sessionStorage.setItem(LAST_ACTIVITY_KEY, String(at));
  } catch {
    // Storage có thể bị chặn ở private mode; timer trong tab vẫn hoạt động.
  }
}

/** Bắt đầu lại mốc idle sau một lần đăng nhập mới hoặc xác nhận phiên. */
export function startWorkSession(at = Date.now()): void {
  noteWorkSessionActivity(at);
}

export function clearWorkSession(): void {
  if (!canUseSessionStorage()) return;
  try {
    window.sessionStorage.removeItem(LAST_ACTIVITY_KEY);
  } catch {
    // Không để lỗi storage cản trở logout.
  }
}
