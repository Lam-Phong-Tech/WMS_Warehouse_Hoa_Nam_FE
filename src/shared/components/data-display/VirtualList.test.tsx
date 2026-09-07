/**
 * Hàng rào cho `VirtualList` — bản cuộn ảo dành cho DANH SÁCH (dòng thời gian).
 *
 * Bất biến phải giữ, vì hỏng cái nào cũng làm mất dữ liệu trên màn chứ không chỉ
 * làm chậm:
 *  · không có khung cuộn riêng ⇒ giữ nguyên đường nới dần cũ (kèm nút Hiện thêm);
 *  · dòng đệm không được lọt vào cây trợ năng, nếu không `getAllByRole("listitem")`
 *    của test/màn hình đọc sẽ đếm cả khoảng trống;
 *  · `isLast` phải tính trên TOÀN tập, không phải trên phần đang vẽ — dòng thời
 *    gian dùng nó để bỏ nét nối cuối, tính sai thì nét nối đứt giữa danh sách;
 *  · `index` truyền cho nơi gọi phải là vị trí THẬT (cột "STT" của timeline).
 *
 * jsdom không bố cục nên phải cấp bố cục tối thiểu + ResizeObserver biết gọi lại
 * — cùng lý do đã ghi ở ResponsiveDataTable.virtual.test.tsx.
 */
import { render, screen } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { VirtualList } from "./VirtualList";
import { VIRTUAL_ROW_THRESHOLD } from "./useVirtualRows";

const SCROLLER_HEIGHT = 400;
const ROW_HEIGHT = 40;

function stubLayout() {
  const proto = HTMLElement.prototype;
  const saved = {
    clientHeight: Object.getOwnPropertyDescriptor(proto, "clientHeight"),
    getBoundingClientRect: proto.getBoundingClientRect,
    ResizeObserver: globalThis.ResizeObserver,
  };
  Object.defineProperty(proto, "clientHeight", {
    configurable: true,
    get(this: HTMLElement) {
      return this.tagName === "LI" ? ROW_HEIGHT : SCROLLER_HEIGHT;
    },
  });
  proto.getBoundingClientRect = function stubbed(this: HTMLElement) {
    const height = this.tagName === "LI" ? ROW_HEIGHT : SCROLLER_HEIGHT;
    return {
      x: 0, y: 0, top: 0, left: 0, right: 900, bottom: height,
      width: 900, height, toJSON: () => ({}),
    } as DOMRect;
  };
  class ImmediateResizeObserver {
    callback: ResizeObserverCallback;
    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
    }
    observe(target: Element) {
      const rect = target.getBoundingClientRect();
      this.callback(
        [
          {
            target,
            contentRect: rect,
            borderBoxSize: [{ inlineSize: rect.width, blockSize: rect.height }],
            contentBoxSize: [{ inlineSize: rect.width, blockSize: rect.height }],
            devicePixelContentBoxSize: [],
          } as unknown as ResizeObserverEntry,
        ],
        this as unknown as ResizeObserver,
      );
    }
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver =
    ImmediateResizeObserver as unknown as typeof ResizeObserver;
  return () => {
    if (saved.clientHeight) {
      Object.defineProperty(proto, "clientHeight", saved.clientHeight);
    } else {
      Reflect.deleteProperty(proto, "clientHeight");
    }
    proto.getBoundingClientRect = saved.getBoundingClientRect;
    globalThis.ResizeObserver = saved.ResizeObserver;
  };
}

let restoreLayout: () => void;
beforeAll(() => {
  restoreLayout = stubLayout();
});
afterAll(() => restoreLayout());

type Row = { id: number };
const makeRows = (count: number): Row[] =>
  Array.from({ length: count }, (_, id) => ({ id }));

/** Ghi lại `index`/`isLast` mà VirtualList truyền ra, để khẳng định chúng đúng. */
function renderList(rows: Row[], maxHeight?: number) {
  const seen: { index: number; isLast: boolean }[] = [];
  const utils = render(
    <VirtualList<Row>
      rows={rows}
      rowKey={(row) => row.id}
      maxHeight={maxHeight}
      data-testid="list"
      emptyText={<span>trống</span>}
      renderRow={(row, index, isLast) => {
        seen.push({ index, isLast });
        return <span>mục {row.id}</span>;
      }}
    />,
  );
  return { ...utils, seen };
}

describe("VirtualList", () => {
  it("tập rỗng hiện emptyText, không dựng danh sách", () => {
    renderList([], 400);
    expect(screen.getByText("trống")).toBeVisible();
    expect(screen.queryByTestId("list")).toBeNull();
  });

  it("không có khung cuộn riêng ⇒ giữ đường nới dần cũ", () => {
    const { container } = renderList(makeRows(VIRTUAL_ROW_THRESHOLD + 50));
    expect(container.querySelectorAll("[data-virtual-spacer]")).toHaveLength(0);
    expect(screen.getByRole("button", { name: /hiện thêm/i })).toBeVisible();
  });

  it("có khung cuộn + vượt ngưỡng ⇒ cuộn ảo, bỏ nút Hiện thêm", () => {
    const { container } = renderList(makeRows(VIRTUAL_ROW_THRESHOLD + 50), 400);
    expect(
      container.querySelectorAll("li[data-index]").length,
    ).toBeGreaterThan(0);
    // Chỉ vẽ một phần: cuộn ảo mà vẫn dựng đủ 200 mục là hỏng mất mục đích.
    expect(container.querySelectorAll("li[data-index]").length).toBeLessThan(
      VIRTUAL_ROW_THRESHOLD,
    );
    expect(screen.queryByRole("button", { name: /hiện thêm/i })).toBeNull();
  });

  it("dòng đệm bị ẩn khỏi cây trợ năng", () => {
    const { container } = renderList(makeRows(VIRTUAL_ROW_THRESHOLD + 50), 400);
    const spacers = container.querySelectorAll("li[data-virtual-spacer]");
    expect(spacers.length).toBeGreaterThan(0);
    for (const spacer of spacers) {
      expect(spacer.getAttribute("aria-hidden")).toBe("true");
    }
    // Mọi listitem "thật" đều phải là mục có dữ liệu.
    for (const item of screen.getAllByRole("listitem")) {
      expect(item.hasAttribute("data-virtual-spacer")).toBe(false);
    }
  });

  it("index là vị trí THẬT và isLast tính trên toàn tập", () => {
    const total = VIRTUAL_ROW_THRESHOLD + 50;
    const { seen } = renderList(makeRows(total), 400);
    // Cửa sổ đầu tiên bắt đầu từ 0 và không có mục nào là mục cuối của tập.
    expect(seen[0].index).toBe(0);
    expect(seen.every((entry) => entry.isLast === false)).toBe(true);
    // Nếu isLast tính theo phần ĐANG VẼ thì mục cuối cửa sổ sẽ bị đánh dấu true
    // và nét nối của dòng thời gian đứt ngay giữa danh sách.
    expect(seen.at(-1)!.index).toBeLessThan(total - 1);
  });

  /**
   * LỖI ĐÃ TÁI HIỆN TRONG APP THẬT (07/09/2026, /reports/traceability):
   * đang cuộn sâu trong 5.969 mục rồi lọc xuống còn vài mục thì cuộn ảo TẮT
   * (dưới ngưỡng) — nhưng khung cuộn vẫn giữ offset 361.777 px của tập cũ, nên
   * người dùng nhìn thấy một vùng TRẮNG và tưởng bộ lọc không ra kết quả.
   *
   * Việc kéo khung cuộn về đầu phải xảy ra ở CẢ hai chế độ, không chỉ khi cuộn
   * ảo đang bật.
   */
  it("đổi tập dòng thì kéo khung cuộn về đầu, kể cả khi rơi xuống dưới ngưỡng", () => {
    const many = makeRows(VIRTUAL_ROW_THRESHOLD + 50);
    const { container, rerender } = render(
      <VirtualList<Row>
        rows={many}
        rowKey={(row) => row.id}
        maxHeight={400}
        renderRow={(row) => <span>mục {row.id}</span>}
      />,
    );
    const scroller = container.firstElementChild as HTMLElement;
    scroller.scrollTop = 5000;

    // Lọc còn 3 mục -> cuộn ảo tắt, nhưng khung cuộn PHẢI về 0.
    rerender(
      <VirtualList<Row>
        rows={makeRows(3)}
        rowKey={(row) => row.id}
        maxHeight={400}
        renderRow={(row) => <span>mục {row.id}</span>}
      />,
    );
    expect(scroller.scrollTop).toBe(0);
    expect(container.querySelectorAll("li[data-index]")).toHaveLength(0);
  });

  /**
   * Mảng dòng được dựng lại MỖI LƯỢT RENDER ở các màn báo cáo
   * (`rows.filter(...)` ngay trong thân render). Nếu việc "quay về đầu" mốc theo
   * THAM CHIẾU mảng thì mọi lượt render đều bị coi là "đổi bộ lọc" và kéo khung
   * cuộn về 0 — triệu chứng trong app thật: cuộn mãi vẫn chỉ thấy mục đầu.
   */
  it("mảng dựng lại nhưng NỘI DUNG không đổi thì KHÔNG kéo khung cuộn về đầu", () => {
    const rows = makeRows(VIRTUAL_ROW_THRESHOLD + 50);
    const view = (list: Row[]) => (
      <VirtualList<Row>
        rows={list}
        rowKey={(row) => row.id}
        maxHeight={400}
        renderRow={(row) => <span>mục {row.id}</span>}
      />
    );
    const { container, rerender } = render(view(rows));
    const scroller = container.firstElementChild as HTMLElement;
    scroller.scrollTop = 5000;

    // Mảng MỚI, cùng các object dòng — đúng thứ `filter` trả về mỗi lượt render.
    rerender(view(rows.slice()));
    expect(scroller.scrollTop).toBe(5000);
  });

  it("tập nhỏ hơn ngưỡng vẫn vẽ đủ và đánh dấu đúng mục cuối", () => {
    const { seen, container } = renderList(makeRows(5), 400);
    expect(container.querySelectorAll("[data-virtual-spacer]")).toHaveLength(0);
    expect(seen).toHaveLength(5);
    expect(seen.at(-1)).toEqual({ index: 4, isLast: true });
  });
});
