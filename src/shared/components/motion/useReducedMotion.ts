import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function getMediaQueryList(): MediaQueryList | null {
  if (typeof window === "undefined" || !window.matchMedia) return null;
  return window.matchMedia(QUERY);
}

function subscribe(onChange: () => void): () => void {
  const mql = getMediaQueryList();
  if (!mql) return () => {};
  // Safari cũ chỉ có addListener — giữ nhánh dự phòng để không vỡ trên iOS.
  if (mql.addEventListener) {
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }
  mql.addListener(onChange);
  return () => mql.removeListener(onChange);
}

function getSnapshot(): boolean {
  return getMediaQueryList()?.matches ?? false;
}

/**
 * `true` khi người dùng bật "giảm chuyển động" ở hệ điều hành/trình duyệt.
 *
 * Phần chuyển động chạy bằng CSS đã tắt sẵn bằng `@media
 * (prefers-reduced-motion: reduce)` trong src/styles/hn-motion.css. Hook này
 * dành cho phần chạy bằng JS (MUI Collapse/Dialog/Fade...) vì media query
 * không với tới thời lượng do JS điều khiển.
 *
 * Dùng useSyncExternalStore thay vì useState+useEffect: media query là nguồn
 * dữ liệu ngoài React, đọc-rồi-setState trong effect sẽ render thừa một lượt
 * ngay lần mount đầu.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
