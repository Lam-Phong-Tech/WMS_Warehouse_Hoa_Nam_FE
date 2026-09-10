import {
  Activity,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { useLocation, useOutlet } from "react-router-dom";
import { Box } from "@/shared/ui";
import {
  PageVisibilityContext,
  isKeepAlivePath,
} from "@/app/layouts/keep-alive";

/**
 * GIỮ SỐNG các màn báo cáo đã mở — quay lại là hiện ngay, không dựng lại.
 *
 * ĐO ĐƯỢC (Playwright, build production, CPU x4 ≈ máy văn phòng): quay lại một
 * màn báo cáo đã mở — dữ liệu còn trong cache React Query, chunk đã có — vẫn mất
 * 0,7–0,9 s với 200–400 ms khoá luồng chính, và chuyển qua lại hai màn báo cáo
 * thì lần nào cũng như lần đầu. Lý do: `MainLayout` remount toàn bộ trang trên
 * mỗi lần điều hướng (`key` theo pathname), nên một component ~1.500 dòng với vài
 * nghìn node DOM phải dựng lại từ đầu dù không có gì đổi.
 *
 * CÁCH LÀM — đúng thứ `<keep-alive>` của Vue và tab của trình duyệt làm: màn đã
 * mở được giữ trong cây React ở trạng thái ẩn bằng `<Activity mode="hidden">`
 * (React 19.2). Ẩn = `display:none` + effect được gỡ, nhưng STATE và DOM còn
 * nguyên; hiện lại = React bật lại effect và lật display. Bộ lọc, tab đang chọn
 * — tất cả còn y chỗ cũ. Đo sau khi sửa (CPU x1): quay lại màn Truy vết từ
 * ~318 ms xuống 146 ms luồng chính, không request nào.
 *
 * `useOutlet()` trả về phần tử route con hiện tại; ta nhớ phần tử đó theo
 * pathname và render TẤT CẢ phần tử đã nhớ, chỉ một cái ở chế độ visible. Không
 * cần đụng tới cấu hình router.
 *
 * BA CHI TIẾT QUYẾT ĐỊNH:
 *  · CHỈ nhớ phần tử ở LẦN ĐẦU. `useOutlet()` trả object mới mỗi lần render; thay
 *    bằng object mới là React coi "props đổi" và render lại cả cây khi quay về —
 *    mất sạch lợi ích (đã đo: vẫn 400–900 ms). Giữ đúng object cũ ⇒ React bail-out;
 *    state từ context (router, query, store) vẫn cập nhật vì context lan truyền
 *    xuyên qua bail-out.
 *  · Bộ nhớ đệm là STATE, cập nhật theo mẫu "chỉnh state ngay trong lúc render"
 *    (React docs: storing information from previous renders) — không ghi ref
 *    trong render, đúng luật `react-hooks/refs` của React Compiler.
 *  · VỊ TRÍ CUỘN nằm ở khung `main` của UiAppShell — NGOÀI phần tử bị ẩn — nên
 *    Activity không tự giữ được. `KeptPage` ghi lại scrollTop khi người dùng cuộn
 *    và đặt lại lúc trang hiện (layout effect chạy lại khi Activity bật). Trang
 *    KHÔNG keep-alive (`FreshPage`, remount theo key) thì về đầu trang — trước
 *    đây scrollTop của `main` "dính" từ trang trước sang trang sau, mở một màn
 *    mới mà đang ở lưng chừng.
 *
 * Overlay portal (Dialog/Drawer/Menu/Popover) nằm ngoài cây DOM của trang: xem
 * `usePageVisible` ở shared/ui — chúng tự không render khi trang ẩn.
 *
 * GIỚI HẠN CÓ CHỦ ĐÍCH: tối đa `MAX_KEPT` màn, đuổi màn lâu chưa xem nhất (mỗi
 * màn ẩn giữ vài nghìn node DOM). Đăng xuất ⇒ `MainLayout` unmount ⇒ bộ nhớ đệm
 * mất theo, không có chuyện màn của người trước lộ sang người sau.
 */
const MAX_KEPT = 6;

type Kept = { element: ReactElement; lastSeen: number };

function remember(
  kept: ReadonlyMap<string, Kept>,
  pathname: string,
  outlet: ReactElement,
  now: number,
): Map<string, Kept> {
  const next = new Map(kept);
  const existing = kept.get(pathname);
  next.set(pathname, { element: existing?.element ?? outlet, lastSeen: now });
  if (next.size > MAX_KEPT) {
    const oldest = [...next.entries()]
      .filter(([p]) => p !== pathname)
      .sort((a, b) => a[1].lastSeen - b[1].lastSeen)[0];
    if (oldest) next.delete(oldest[0]);
  }
  return next;
}

/** Khung cuộn gần nhất bao quanh phần tử (`main` của UiAppShell). */
function scrollParentOf(node: HTMLElement): HTMLElement | null {
  let el = node.parentElement;
  while (el) {
    const { overflowY } = getComputedStyle(el);
    if (overflowY === "auto" || overflowY === "scroll") return el;
    el = el.parentElement;
  }
  return null;
}

type PageProps = { className: string; children: ReactNode };

/** Trang giữ sống: nhớ và khôi phục vị trí cuộn qua mỗi lần ẩn/hiện. */
function KeptPage({ className, children }: PageProps) {
  const ref = useRef<HTMLElement | null>(null);
  const savedTop = useRef(0);

  // Chạy lúc mount VÀ mỗi lần Activity bật lại (React gỡ effect khi ẩn, chạy
  // lại khi hiện). Cleanup lúc ẩn chỉ gỡ listener; giá trị cuối đã nằm trong ref.
  useLayoutEffect(() => {
    const section = ref.current;
    if (!section) return;
    const scroller = scrollParentOf(section);
    if (!scroller) return;
    scroller.scrollTop = savedTop.current;
    const onScroll = () => {
      savedTop.current = scroller.scrollTop;
    };
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => scroller.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <Box
      ref={ref}
      component="section"
      className={className}
      sx={{ minWidth: 0 }}
    >
      {children}
    </Box>
  );
}

/** Trang không keep-alive: mount mới theo key ⇒ về đầu khung cuộn. */
function FreshPage({ className, children }: PageProps) {
  const ref = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const section = ref.current;
    if (!section) return;
    const scroller = scrollParentOf(section);
    if (scroller) scroller.scrollTop = 0;
  }, []);

  return (
    <Box
      ref={ref}
      component="section"
      className={className}
      sx={{ minWidth: 0 }}
    >
      {children}
    </Box>
  );
}

export function KeepAliveOutlet({
  transitionKey,
  className,
}: {
  /** Key remount cho trang KHÔNG keep-alive — giữ nguyên hành vi cũ của layout. */
  transitionKey: string;
  className: string;
}) {
  const { pathname } = useLocation();
  const outlet = useOutlet();
  const keep = isKeepAlivePath(pathname);

  const [kept, setKept] = useState<ReadonlyMap<string, Kept>>(() => new Map());
  const [seenPath, setSeenPath] = useState<string | null>(null);
  // Đồng hồ logic cho LRU: tăng mỗi lần ghi nhớ. Không dùng Date.now() trong
  // render — React Compiler coi đó là hàm không thuần.
  const [clock, setClock] = useState(0);

  // "Chỉnh state trong lúc render": chỉ chạy ĐÚNG MỘT LẦN cho mỗi lần đổi
  // pathname; React render lại ngay với state mới trước khi commit.
  if (keep && outlet && seenPath !== pathname) {
    setSeenPath(pathname);
    setClock(clock + 1);
    setKept(remember(kept, pathname, outlet, clock + 1));
  } else if (!keep && seenPath !== null) {
    setSeenPath(null);
  }

  return (
    <>
      {[...kept.entries()].map(([path, entry]) => {
        const visible = keep && path === pathname;
        return (
          <Activity key={path} mode={visible ? "visible" : "hidden"}>
            <PageVisibilityContext.Provider value={visible}>
              <KeptPage className={className}>{entry.element}</KeptPage>
            </PageVisibilityContext.Provider>
          </Activity>
        );
      })}
      {!keep ? (
        <FreshPage key={transitionKey} className={className}>
          {outlet as ReactNode}
        </FreshPage>
      ) : null}
    </>
  );
}
