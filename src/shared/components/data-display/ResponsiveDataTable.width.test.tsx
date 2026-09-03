/**
 * Hợp đồng BỀ RỘNG CỘT của bảng dùng chung.
 *
 * VÌ SAO CÓ (phản hồi người dùng 2026-09-03: "cột không đều với dữ liệu"):
 * `column.width` trước đây chỉ được gắn vào ô `<th>`, ô `<td>` không nhận gì.
 * Với `table-layout: auto` (mặc định), bề rộng đặt trên MỘT ô chỉ là đề nghị —
 * trình duyệt thương lượng lại theo nội dung các ô còn lại trong cột. Hệ quả:
 * cột khai 80px vẫn phình theo dữ liệu, cột chữ dài lại bị bóp, và tiêu đề
 * không nằm trên đúng dải dữ liệu của nó.
 *
 * Toàn dự án có 60+ chỗ dựng bảng này và hơn 300 cột khai `width`, nên lỗi ở
 * đây là lỗi hệ thống chứ không phải lỗi một màn. Bộ test này chốt cơ chế sửa:
 * bề rộng đi qua `<colgroup>` (áp cho CẢ cột) và bảng khai đủ bề rộng thì khoá
 * bố cục lại.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ResponsiveDataTable } from "./ResponsiveDataTable";

type Row = { id: string; name: string; qty: number };

const ROWS: Row[] = [
  { id: "1", name: "Đại lý Hoa Nam Cần Thơ", qty: 2 },
  { id: "2", name: "Đại lý Hoa Nam Hà Nội", qty: 11 },
];

function colWidths(): (string | null)[] {
  const table = screen.getByRole("table");
  return Array.from(table.querySelectorAll("col")).map(
    (col) => col.style.width || null,
  );
}

describe("ResponsiveDataTable · bề rộng cột", () => {
  it("phát <colgroup> theo đúng thứ tự cột đã khai", () => {
    render(
      <ResponsiveDataTable<Row>
        columns={[
          {
            key: "name",
            header: "Người nhận",
            width: 175,
            render: (r) => r.name,
          },
          {
            key: "qty",
            header: "Tổng xuất",
            width: 80,
            render: (r) => String(r.qty),
          },
        ]}
        rows={ROWS}
        rowKey={(r) => r.id}
      />,
    );
    expect(colWidths()).toEqual(["175px", "80px"]);
  });

  it("cột chọn dòng và cột Thao tác cũng có bề rộng riêng, đúng vị trí đầu/cuối", () => {
    render(
      <ResponsiveDataTable<Row>
        columns={[
          {
            key: "name",
            header: "Người nhận",
            width: 175,
            render: (r) => r.name,
          },
        ]}
        rows={ROWS}
        rowKey={(r) => r.id}
        renderRowActions={() => <button type="button">Đối soát</button>}
      />,
    );
    // [cột dữ liệu, cột Thao tác]
    expect(colWidths()).toEqual(["175px", "96px"]);
  });

  it("khai đủ bề rộng cho MỌI cột ⇒ khoá bố cục (table-layout: fixed)", () => {
    render(
      <ResponsiveDataTable<Row>
        columns={[
          {
            key: "name",
            header: "Người nhận",
            width: "23%",
            render: (r) => r.name,
          },
          {
            key: "qty",
            header: "Tổng xuất",
            width: "10%",
            render: (r) => String(r.qty),
          },
        ]}
        rows={ROWS}
        rowKey={(r) => r.id}
      />,
    );
    expect(getComputedStyle(screen.getByRole("table")).tableLayout).toBe(
      "fixed",
    );
    expect(colWidths()).toEqual(["23%", "10%"]);
  });

  it("còn cột chưa khai bề rộng ⇒ KHÔNG khoá bố cục, cột đó vẫn co giãn theo nội dung", () => {
    // Khoá bố cục khi bản thiết kế còn thiếu sẽ chia đều phần dư một cách máy
    // móc và bóp mất cột chữ dài — tệ hơn hiện trạng.
    render(
      <ResponsiveDataTable<Row>
        columns={[
          { key: "name", header: "Người nhận", render: (r) => r.name },
          {
            key: "qty",
            header: "Tổng xuất",
            width: 80,
            render: (r) => String(r.qty),
          },
        ]}
        rows={ROWS}
        rowKey={(r) => r.id}
      />,
    );
    expect(getComputedStyle(screen.getByRole("table")).tableLayout).not.toBe(
      "fixed",
    );
    expect(colWidths()).toEqual([null, "80px"]);
  });

  it("tiêu đề và dữ liệu của cùng một cột luôn cùng căn lề", () => {
    render(
      <ResponsiveDataTable<Row>
        columns={[
          {
            key: "name",
            header: "Người nhận",
            width: 175,
            render: (r) => r.name,
          },
          {
            key: "qty",
            header: "Tổng xuất",
            width: 80,
            align: "right",
            render: (r) => String(r.qty),
          },
        ]}
        rows={ROWS}
        rowKey={(r) => r.id}
      />,
    );
    const table = screen.getByRole("table");
    const ths = Array.from(table.querySelectorAll("thead th"));
    const firstRowTds = Array.from(
      table.querySelectorAll("tbody tr:first-of-type td"),
    );
    expect(ths).toHaveLength(firstRowTds.length);
    ths.forEach((th, index) => {
      expect(getComputedStyle(th).textAlign).toBe(
        getComputedStyle(firstRowTds[index]).textAlign,
      );
    });
  });
});

/**
 * BẪY CASCADE — 17 màn của dự án còn bọc trong `.hn-mvp-source-screen`, mà lớp
 * đó có sẵn:
 *
 *     .hn-mvp-source-screen th, .hn-mvp-source-screen td { text-align: left }
 *
 * Độ đặc hiệu 0-1-1, CAO HƠN class emotion mà `sx` của từng ô sinh ra (0-1-0),
 * nên nó đè căn lề của ô `<td>`. Riêng ô tiêu đề thoát vì `SortableTh` dùng
 * inline style (luôn thắng). Kết quả trên trình duyệt: tiêu đề cột số căn phải
 * còn con số bị kéo về trái — hai thứ không thẳng hàng, đúng phản hồi người
 * dùng 2026-09-03.
 *
 * Bài học để test này tồn tại: bộ test render component TRẦN, không nạp CSS
 * toàn cục, nên phép đo trong jsdom "sạch" báo PASS trong khi trình duyệt vẫn
 * sai. Vì vậy test dưới đây CHÈN THẲNG rule đó vào document rồi mới đo — tái
 * hiện đúng cascade thật thay vì môi trường lý tưởng.
 */
describe("ResponsiveDataTable · căn lề không bị trang bọc ngoài đè", () => {
  const LEGACY_RULE =
    ".hn-mvp-source-screen th,.hn-mvp-source-screen td" +
    "{padding:10px;vertical-align:top;text-align:left}";

  beforeEach(() => {
    const style = document.createElement("style");
    style.dataset.testStyle = "legacy-source-screen";
    style.textContent = LEGACY_RULE;
    document.head.appendChild(style);
  });

  afterEach(() => {
    document
      .querySelectorAll('style[data-test-style="legacy-source-screen"]')
      .forEach((node) => node.remove());
  });

  it("trong .hn-mvp-source-screen, tiêu đề và dữ liệu vẫn cùng căn lề", () => {
    render(
      <div className="hn-mvp-source-screen">
        <ResponsiveDataTable<Row>
          columns={[
            {
              key: "name",
              header: "Người nhận",
              width: 175,
              sortable: true,
              render: (r) => r.name,
            },
            {
              key: "qty",
              header: "Tổng xuất",
              width: 80,
              align: "right",
              sortable: true,
              render: (r) => String(r.qty),
            },
            {
              // Cột KHÔNG sortable: ô tiêu đề là Box+sx nên cũng bị rule cũ đè.
              key: "qty2",
              header: "Hoàn tác",
              width: 80,
              align: "right",
              render: (r) => String(r.qty),
            },
          ]}
          rows={ROWS}
          rowKey={(r) => r.id}
          sortState={{ direction: undefined }}
          onSortChange={() => {}}
        />
      </div>,
    );

    const table = screen.getByRole("table");
    const ths = Array.from(table.querySelectorAll("thead th"));
    const tds = Array.from(table.querySelectorAll("tbody tr:first-of-type td"));
    expect(ths).toHaveLength(tds.length);

    // Cột số phải căn PHẢI ở cả hai hàng — không được rơi về left.
    expect(getComputedStyle(ths[1]).textAlign).toBe("right");
    expect(getComputedStyle(tds[1]).textAlign).toBe("right");
    expect(getComputedStyle(ths[2]).textAlign).toBe("right");
    expect(getComputedStyle(tds[2]).textAlign).toBe("right");

    ths.forEach((th, index) => {
      expect(getComputedStyle(th).textAlign).toBe(
        getComputedStyle(tds[index]).textAlign,
      );
    });
  });
});
