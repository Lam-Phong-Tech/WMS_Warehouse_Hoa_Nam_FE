/* eslint-disable @typescript-eslint/no-explicit-any -- `ComponentType<any>` là
   ràng buộc DUY NHẤT suy được props của mọi màn (`ComponentProps<T>`); dùng
   `unknown`/`never` ở đây làm TypeScript suy props thành `never` và mọi route có
   prop (vd `<IamUsersGd1Page openCreateOnMount />`) hết biên dịch được. Phạm vi
   `any` gói gọn trong ràng buộc generic của file hạ tầng này, không rò ra API. */
import {
  createElement,
  lazy,
  useRef,
  type ComponentProps,
  type ComponentType,
  type ReactNode,
} from "react";

/**
 * `lazy()` có nạp trước — và KHÔNG treo (suspend) khi chunk đã nằm sẵn.
 *
 * ĐO ĐƯỢC (CDP Profiler, build production, 07/09/2026): sau khi `/auth/refresh`
 * về, luồng chính RẢNH ~270 ms trước khi request dữ liệu đầu tiên của trang được
 * bắn ra. Không phải CPU, không phải mạng — là React chờ. Cơ chế:
 *
 *  1. `React.lazy` LUÔN treo ở lần render đầu, kể cả khi module đã có trong bộ
 *     nhớ (một `import()` gọi trước đó đã xong): nó chỉ bắt đầu gọi loader lúc
 *     render lần đầu, nhận về một promise, rồi ném promise đó ra — dù promise sẽ
 *     resolve ngay ở microtask kế tiếp. Suspense vì vậy commit fallback.
 *  2. React 19 THROTTLE mọi lần "hiện lại nội dung" đến từ retry của Suspense:
 *     commit bị hoãn tới `globalMostRecentFallbackTime + 300 ms`
 *     (react-dom-client.production.js: `globalMostRecentFallbackTime + 300 - now()`).
 *     Hai boundary lồng nhau (MainLayout → trang) nhân thêm số lần chờ.
 *
 * Hệ quả trên đường tới hạn F5: skeleton đứng ~300 ms rồi trang mới hiện, và chỉ
 * lúc đó các `useQuery` của trang mới mount và mới gọi API. Với chunk ĐÃ nạp
 * trước (main.tsx nạp shell + trang đích ngay lúc boot, song song với vòng mạng
 * refresh), 300 ms đó là phí thuần tuý.
 *
 * CÁCH LÀM: giữ nguyên `React.lazy` cho đường "chưa nạp" (vẫn có skeleton như cũ),
 * nhưng nếu `preload()` đã hoàn tất thì render THẲNG component thật — không ném
 * promise, không fallback, không throttle. Mỗi instance chốt đường đi MỘT LẦN lúc
 * mount (ref) để một lần `preload()` xảy ra giữa chừng không đổi kiểu phần tử và
 * làm remount trang đang mở.
 *
 * Dùng cho mọi màn trong `route-components.ts`; `route-preload.ts` gọi
 * `.preload()` (rê chuột vào menu, lúc app rảnh, và lúc boot cho trang đích).
 */
export type PreloadableComponent<P> = ((props: P) => ReactNode) & {
  /** Nạp chunk. Gọi lặp vô hại; lỗi mạng được nuốt để lần render thật tự tải lại. */
  preload: () => Promise<void>;
  /** Chunk đã sẵn trong bộ nhớ chưa (render sẽ không treo). */
  isLoaded: () => boolean;
};

/** Phần giao diện mà `route-preload` cần — không phụ thuộc kiểu props của màn. */
export interface RoutePreloadable {
  preload: () => Promise<void>;
  isLoaded: () => boolean;
}

export function lazyRoute<T extends ComponentType<any>>(
  loader: () => Promise<{ default: T }>,
): PreloadableComponent<ComponentProps<T>> {
  type P = ComponentProps<T>;
  let loaded: T | null = null;
  let pending: Promise<void> | null = null;

  const preload = (): Promise<void> => {
    if (loaded) return Promise.resolve();
    if (!pending) {
      pending = loader()
        .then((module) => {
          loaded = module.default;
        })
        .catch(() => {
          // Để lần gọi sau (hoặc chính React.lazy) thử lại, thay vì kẹt ở "đang nạp".
          pending = null;
        });
    }
    return pending;
  };

  // Đường "chưa nạp": React.lazy bình thường. Loader của nó đi qua `preload()` để
  // hai đường dùng chung một promise và cùng ghi vào `loaded`.
  const Lazy = lazy(async () => {
    await preload();
    if (loaded) return { default: loaded };
    // `preload` nuốt lỗi; muốn React.lazy nhận lỗi thật thì gọi loader trực tiếp.
    const module = await loader();
    loaded = module.default;
    return { default: loaded };
  });

  function Preloadable(props: P): ReactNode {
    // Chốt một lần cho cả vòng đời instance (xem ghi chú ở đầu file).
    const direct = useRef<boolean | null>(null);
    if (direct.current === null) direct.current = loaded !== null;
    if (direct.current && loaded) return createElement(loaded, props);
    return createElement(Lazy, props);
  }

  const component = Preloadable as PreloadableComponent<P>;
  component.preload = preload;
  component.isLoaded = () => loaded !== null;
  return component;
}
