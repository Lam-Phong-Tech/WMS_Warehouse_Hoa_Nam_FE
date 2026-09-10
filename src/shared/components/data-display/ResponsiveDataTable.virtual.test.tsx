/**
 * HÀNG RÀO cho cuộn ảo của `ResponsiveDataTable`.
 *
 * Lớp lỗi được chặn — ĐÃ TÁI HIỆN ĐƯỢC trên bàn đo trước khi sửa
 * (scripts/perf/bench, 5.956 dòng, viewport 1440×900, CPU ×4):
 *
 *   · cuộn hết khung bảng chỉ tới được dòng thứ 60/5.956, vì sentinel của
 *     `WindowedMore` nằm NGOÀI hộp `overflowY: auto` nên không bao giờ đổi
 *     trạng thái giao nhau lần thứ hai;
 *   · một cú gõ vào ô lọc khoá luồng chính 160 ms (INP 184 ms).
 *
 * Sau khi bật cuộn ảo: tới được dòng 5.956/5.956, INP 40 ms, không còn long
 * task nào trong cú gõ đó.
 *
 * jsdom KHÔNG có layout thật (mọi `getBoundingClientRect` trả 0) nên ở đây
 * KHÔNG kiểm số dòng cụ thể mà kiểm những bất biến cấu trúc mà cuộn ảo phải
 * giữ. Phần số liệu do bàn đo lo — hai lớp bổ sung cho nhau, không thay nhau.
 */
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ResponsiveDataTable } from "./ResponsiveDataTable";
import { VIRTUAL_ROW_THRESHOLD } from "./useVirtualRows";

type Row = { id: number; code: string };

const makeRows = (count: number): Row[] =>
  Array.from({ length: count }, (_, index) => ({
    id: index,
    code: `SKU-${index}`,
  }));

const COLUMNS = [
  { key: "code", header: "Mã", width: 120, render: (row: Row) => row.code },
];

/**
 * jsdom KHÔNG bố cục: mọi phần tử có `clientHeight = 0` và
 * `getBoundingClientRect()` trả toàn số 0. Virtualizer vì thế không biết khung
 * nhìn cao bao nhiêu và trả về danh sách RỖNG — đường cuộn ảo không bao giờ
 * chạy trong unit test.
 *
 * Cấp cho jsdom một bố cục TỐI THIỂU (khung cuộn cao 400px, dòng cao 61px —
 * đúng chiều cao thật đo được trên bàn đo) để phần LOGIC của cuộn ảo kiểm được
 * ở đây. Phần số liệu (INP/DOM/heap) vẫn do bàn đo trình duyệt thật lo.
 */
const SCROLLER_HEIGHT = 400;
const ROW_HEIGHT = 61;

function stubLayout() {
  const proto = HTMLElement.prototype;
  const saved = {
    clientHeight: Object.getOwnPropertyDescriptor(proto, "clientHeight"),
    getBoundingClientRect: proto.getBoundingClientRect,
    ResizeObserver: globalThis.ResizeObserver,
  };
  /**
   * ResizeObserver trong src/test/setup.ts là bản CÂM: có đủ 3 phương thức
   * nhưng KHÔNG bao giờ gọi callback. Virtualizer dựa vào chính callback đó để
   * biết khung cuộn cao bao nhiêu, nên với bản câm nó mãi mãi trả về 0 dòng.
   * Bản dưới đây báo kích thước NGAY khi được observe.
   */
  class ImmediateResizeObserver {
    // Không dùng parameter property: tsconfig bật `erasableSyntaxOnly`.
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
            contentBoxSize: [
              { inlineSize: rect.width, blockSize: rect.height },
            ],
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
  Object.defineProperty(proto, "clientHeight", {
    configurable: true,
    get(this: HTMLElement) {
      return this.tagName === "TR" ? ROW_HEIGHT : SCROLLER_HEIGHT;
    },
  });
  proto.getBoundingClientRect = function stubbed(this: HTMLElement) {
    const height = this.tagName === "TR" ? ROW_HEIGHT : SCROLLER_HEIGHT;
    return {
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 900,
      bottom: height,
      width: 900,
      height,
      toJSON: () => ({}),
    } as DOMRect;
  };
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

function renderTable(rows: Row[], maxBodyHeight?: number) {
  return render(
    <ResponsiveDataTable<Row>
      columns={COLUMNS}
      rows={rows}
      rowKey={(row) => row.id}
      maxBodyHeight={maxBodyHeight}
    />,
  );
}

/** Dòng THẬT = dòng có `role="row"`; dòng đệm bị `aria-hidden` loại khỏi đây. */
const realRows = () => screen.getAllByRole("row");

describe("ResponsiveDataTable — cuộn ảo", () => {
  it("bảng nhỏ giữ nguyên đường cũ: không dòng đệm, không data-index", () => {
    const { container } = renderTable(makeRows(20), 400);
    expect(container.querySelectorAll("[data-virtual-spacer]")).toHaveLength(0);
    expect(container.querySelectorAll("tbody tr[data-index]")).toHaveLength(0);
    // 1 dòng tiêu đề + 20 dòng dữ liệu.
    expect(realRows()).toHaveLength(21);
  });

  it("bảng lớn KHÔNG có khung cuộn riêng vẫn đi đường cũ (sentinel còn đúng ở đó)", () => {
    const { container } = renderTable(makeRows(VIRTUAL_ROW_THRESHOLD + 50));
    expect(container.querySelectorAll("[data-virtual-spacer]")).toHaveLength(0);
    // Đường cũ cắt cửa sổ 60 dòng và kèm nút "Hiện thêm".
    expect(screen.getByRole("button", { name: /hiện thêm/i })).toBeVisible();
  });

  it("bảng lớn CÓ khung cuộn riêng bật cuộn ảo và bỏ nút Hiện thêm", () => {
    const { container } = renderTable(
      makeRows(VIRTUAL_ROW_THRESHOLD + 50),
      400,
    );
    expect(
      container.querySelectorAll("tbody tr[data-index]").length,
    ).toBeGreaterThan(0);
    // Nút "Hiện thêm" chính là chỗ hỏng — cuộn ảo phải thay thế nó hẳn.
    expect(screen.queryByRole("button", { name: /hiện thêm/i })).toBeNull();
  });

  it("dòng đệm không lọt vào cây trợ năng và phủ đủ số cột", () => {
    const { container } = renderTable(
      makeRows(VIRTUAL_ROW_THRESHOLD + 50),
      400,
    );
    const spacers = container.querySelectorAll("tbody tr[data-virtual-spacer]");
    expect(spacers.length).toBeGreaterThan(0);
    for (const spacer of spacers) {
      expect(spacer.getAttribute("aria-hidden")).toBe("true");
      const cell = spacer.querySelector("td");
      // Thiếu colSpan thì dòng đệm chỉ chiếm 1 ô và `<colgroup>` sẽ kéo lệch
      // bề rộng của cả bảng.
      expect(cell?.getAttribute("colspan")).toBe(String(COLUMNS.length));
    }
    // Dòng đệm KHÔNG được đếm là row: mọi test contract của dự án tìm dòng
    // bằng role/`closest('[role="row"]')`.
    for (const row of realRows()) {
      expect(row.hasAttribute("data-virtual-spacer")).toBe(false);
    }
  });

  it("giữ nguyên tiêu đề ghim khi bật cuộn ảo", () => {
    const { container } = renderTable(
      makeRows(VIRTUAL_ROW_THRESHOLD + 50),
      400,
    );
    const header = container.querySelector("thead th");
    expect(header).not.toBeNull();
    // `maxBodyHeight` là điều kiện của CẢ tiêu đề ghim lẫn cuộn ảo — nếu đường
    // cuộn ảo lỡ dựng lại `<thead>` khác đi thì test này đỏ.
    expect(container.querySelectorAll("thead tr")).toHaveLength(1);
  });

  it("sắp xếp vẫn chạy trên TOÀN tập chứ không chỉ phần đang vẽ", async () => {
    const user = userEvent.setup();
    const rows = makeRows(VIRTUAL_ROW_THRESHOLD + 50);
    const { container } = render(
      <ResponsiveDataTable<Row>
        columns={[
          {
            key: "code",
            header: "Mã",
            width: 120,
            sortAccessor: (row: Row) => row.id,
            render: (row: Row) => row.code,
          },
        ]}
        rows={rows}
        rowKey={(row) => row.id}
        maxBodyHeight={400}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Mã/ }));
    const firstDataRow = container.querySelector("tbody tr[data-index]");
    expect(firstDataRow).not.toBeNull();
    // Sắp xếp tăng dần: dòng đầu phải là SKU-0. Nếu sort chỉ chạy trên cửa sổ
    // đang vẽ thì thứ tự sẽ phụ thuộc vị trí cuộn — đúng lớp lỗi cần chặn.
    expect(
      within(firstDataRow as HTMLElement).getByText("SKU-0"),
    ).toBeVisible();
  });

  it("trạng thái rỗng/đang tải không đổi khi bật cuộn ảo", () => {
    const { rerender, container } = render(
      <ResponsiveDataTable<Row>
        columns={COLUMNS}
        rows={[]}
        rowKey={(row) => row.id}
        maxBodyHeight={400}
      />,
    );
    expect(screen.getByTestId("ui-state-empty-table")).toBeVisible();
    expect(container.querySelectorAll("[data-virtual-spacer]")).toHaveLength(0);

    rerender(
      <ResponsiveDataTable<Row>
        columns={COLUMNS}
        rows={makeRows(VIRTUAL_ROW_THRESHOLD + 50)}
        rowKey={(row) => row.id}
        loading
        maxBodyHeight={400}
      />,
    );
    expect(screen.getByTestId("ui-state-loading-table")).toBeVisible();
  });
});
