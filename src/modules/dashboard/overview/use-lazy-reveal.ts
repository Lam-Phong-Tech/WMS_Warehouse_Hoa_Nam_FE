/**
 * Lộ dần các khối dưới fold — bản port của `IntersectionObserver` trong demo
 * (`app.js:841`): khối mang `data-lazy` nằm ở `opacity .78` và lệch xuống 7px,
 * vào tầm nhìn thì gắn `.lazy-ready` để trôi lên đúng chỗ.
 *
 * `rootMargin` giữ đúng 200px của demo nên khối kịp hiện trước khi người dùng
 * cuộn tới, không thành hiệu ứng giật.
 *
 * Hai lối thoát an toàn, cùng một lý do — thà hiện thẳng còn hơn kẹt ở trạng
 * thái mờ:
 *  · Môi trường không có `IntersectionObserver` (jsdom lúc chạy test, trình
 *    duyệt cũ) thì gắn `.lazy-ready` ngay.
 *  · Người dùng bật `prefers-reduced-motion` thì bỏ qua hiệu ứng.
 */
import { useCallback, useRef } from "react";

const REVEALED = "lazy-ready";

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Trả về một callback ref gắn thẳng vào phần tử mang `data-lazy`.
 *
 * Dùng callback ref chứ không phải `useEffect` + `useRef` vì phần tử có thể bị
 * thay khi cây render lại; callback ref chạy đúng lúc gắn/gỡ nên không cần
 * đồng bộ thủ công.
 */
export function useLazyReveal() {
  const observerRef = useRef<IntersectionObserver | null>(null);

  return useCallback((node: HTMLElement | null) => {
    observerRef.current?.disconnect();
    observerRef.current = null;
    if (!node) return;

    if (typeof IntersectionObserver === "undefined" || prefersReducedMotion()) {
      node.classList.add(REVEALED);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add(REVEALED);
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: "200px 0px" },
    );
    observer.observe(node);
    observerRef.current = observer;
  }, []);
}
