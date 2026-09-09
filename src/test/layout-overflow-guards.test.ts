/**
 * HÀNG RÀO BỐ CỤC — chống tái diễn lỗi "chữ đè lên nhau" ở màn báo cáo
 * nhập/xuất kho, người dùng báo 07/09/2026 (khối "Lịch sử chứng từ").
 *
 * HIỆN TƯỢNG: thu nhỏ cửa sổ thì mã chứng từ, dòng đối tác và mốc thời gian
 * trong thẻ chồng lên nhau thành một đám chữ không đọc được.
 *
 * ĐO ĐƯỢC KHI TÁI HIỆN (thẻ rộng 238px):
 *   · `.insight-card-head` cao 95px trong khi chữ bên trong cần 186px;
 *   · hàng của lưới chốt ở 236px trong khi thẻ cần 344px.
 *
 * HAI NGUYÊN NHÂN GỐC, mỗi cái được một luật dưới đây khoá lại:
 *
 *   1. `min-height` khai trên một flex item THAY THẾ mức tối thiểu tự động theo
 *      nội dung (`min-height: auto`). Đầu thẻ vì thế được phép co xuống dưới
 *      chiều cao chữ của chính nó, phần dôi ra đè xuống thân thẻ. Phải kèm
 *      `flex-shrink: 0` thì `min-height` mới đúng nghĩa "sàn".
 *
 *   2. Lưới CSS chốt chiều cao hàng theo "phần đóng góp nội tại" của thẻ — đo
 *      khi chữ CHƯA phải xuống dòng. Tiêu đề thẻ là mã chứng từ dài không có
 *      chỗ ngắt, nên trong cột hẹp nó xuống 3 dòng và không còn vừa hàng đã
 *      chốt. Hàng flex bọc dòng lấy chiều cao theo kích thước ĐÃ bố trí nên
 *      không thể lệch — lưới thẻ phải giữ dạng flex.
 *
 * Luật 3 khoá một biến thể khác của cùng nguyên nhân: ô "chưa có dữ liệu" của
 * biểu đồ không được cao hơn vùng vẽ chứa nó.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPORT_CSS = [
  "src/modules/reports/inventory-flow/inventory-flow-report.css",
  "src/modules/reports/stock-reconcile/stock-reconcile-report.css",
  "src/modules/reports/io-history/io-history-report.css",
] as const;

const read = (file: string) => readFileSync(join(process.cwd(), file), "utf8");

/** Tách file CSS thành từng khối `selector { thân }` (đủ dùng cho guard này). */
function rulesOf(css: string): Array<{ selector: string; body: string }> {
  const out: Array<{ selector: string; body: string }> = [];
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(withoutComments)) !== null) {
    const selector = match[1].trim();
    if (selector.startsWith("@")) continue;
    out.push({ selector, body: match[2] });
  }
  return out;
}

function declaration(body: string, prop: string): string | null {
  const re = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, "i");
  const found = re.exec(body);
  return found ? found[1].trim() : null;
}

function pxOf(value: string | null): number | null {
  if (value === null) return null;
  const found = /(-?[\d.]+)px/.exec(value);
  return found ? Number(found[1]) : null;
}

describe("bố cục thẻ báo cáo — chống chữ đè lên nhau", () => {
  it("đầu thẻ khai min-height thì phải kèm flex-shrink: 0", () => {
    const offenders: string[] = [];

    const lastClassOf = (selector: string) =>
      /\.([A-Za-z0-9_-]+)\s*$/.exec(selector)?.[1] ?? null;

    for (const file of REPORT_CSS) {
      const rules = rulesOf(read(file));

      /*
       * Một phần tử thường bị nhiều luật cùng chạm tới (luật gốc
       * `.chart-card-head`, rồi luật ghi đè `.report-chart-card .chart-card-head`).
       * Chỉ cần MỘT trong số đó chặn co là phần tử đã an toàn, nên gom theo lớp
       * cuối của selector thay vì xét từng luật rời.
       */
      const shielded = new Set<string>();
      for (const rule of rules) {
        if (declaration(rule.body, "flex-shrink") !== "0") continue;
        const cls = lastClassOf(rule.selector);
        if (cls) shielded.add(cls);
      }

      for (const rule of rules) {
        // Chỉ xét ĐẦU thẻ (khối tiêu đề nằm trên cùng trong thẻ flex column).
        if (!/card-head|\.cardhead/.test(rule.selector)) continue;
        const minHeight = pxOf(declaration(rule.body, "min-height"));
        if (minHeight === null || minHeight === 0) continue;
        const cls = lastClassOf(rule.selector);
        if (cls !== null && shielded.has(cls)) continue;
        offenders.push(
          `${file} :: ${rule.selector} (min-height ${minHeight}px)`,
        );
      }
    }

    expect(
      offenders,
      `Đầu thẻ dưới đây khai min-height nhưng vẫn co được, nên tiêu đề dài sẽ\ntràn xuống đè phần thân. Thêm "flex-shrink: 0" vào đúng luật đó:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  it("lưới thẻ chứng từ phải là hàng flex bọc dòng, không phải grid", () => {
    const css = read(REPORT_CSS[0]);
    const grid = rulesOf(css).find(
      (rule) => rule.selector === ".hn-rpt01 .insight-grid",
    );

    expect(grid, "không còn luật .hn-rpt01 .insight-grid").toBeDefined();
    expect(declaration(grid!.body, "display")).toBe("flex");
    expect(declaration(grid!.body, "flex-wrap")).toBe("wrap");

    // Bề rộng thẻ phải tính từ biến số cột, không chép số px tay.
    const item = rulesOf(css).find(
      (rule) => rule.selector === ".hn-rpt01 .insight-grid > *",
    );
    expect(item, "không còn luật .hn-rpt01 .insight-grid > *").toBeDefined();
    expect(item!.body).toContain("--insight-cols");
    expect(item!.body).toContain("--insight-gap");
  });

  it("ô 'chưa có dữ liệu' của biểu đồ không cao hơn vùng vẽ", () => {
    for (const file of REPORT_CSS) {
      const rules = rulesOf(read(file));
      const empty = rules.find((rule) => /\.chart-empty$/.test(rule.selector));
      const plot = rules.find((rule) => /\.chart-plot$/.test(rule.selector));
      if (!empty || !plot) continue;

      const emptyMin = pxOf(declaration(empty.body, "min-height"));
      const plotMin = pxOf(declaration(plot.body, "min-height"));
      if (emptyMin === null || plotMin === null) continue;

      expect(
        emptyMin,
        `${file}: .chart-empty (${emptyMin}px) cao hơn .chart-plot (${plotMin}px) nên ô trống sẽ tràn khỏi vùng vẽ`,
      ).toBeLessThanOrEqual(plotMin);
    }
  });
});
/**
 * UAT TC_UI_04 — dashboard trên điện thoại (≤979px): khối ≤1279 khai span 6
 * cho cặp thẻ bằng :nth-child (độ đặc hiệu 0,3,0), nên rule xếp chồng của
 * khối ≤979 PHẢI cùng độ đặc hiệu trở lên (nth-child) — bản cũ dùng "> *"
 * (0,2,0) thua cascade dù đứng sau, hai thẻ đứng cạnh nhau chỉ rộng ~170px.
 * Guard đọc CSS nguồn: trong khối ≤979 phải còn selector :nth-child xếp chồng
 * cho cả analysis-grid lẫn insight-grid.
 */
describe("dashboard responsive · độ đặc hiệu khối xếp chồng (UAT TC_UI_04)", () => {
  const css = readFileSync(
    "src/modules/dashboard/dashboard-overview.css",
    "utf8",
  );

  it("khối ≤979 xếp chồng bằng :nth-child cho analysis-grid và insight-grid", () => {
    const block =
      css.split("@media (max-width: 979px)")[1]?.split("@media")[0] ?? "";
    expect(block).toContain("analysis-grid > :nth-child(n)");
    expect(block).toContain("insight-grid > :nth-child(n)");
    expect(block).toContain("grid-column: 1 / -1");
    // Thẻ lọc phải về MỘT cột — hai track minmax(380px)+minmax(260px) từng ép
    // bề rộng tối thiểu 692px vào khung điện thoại 390px.
    expect(block).not.toContain("minmax(380px");
  });

  it("khối ≤1279 có override cho thẻ lọc BẢN THƯỜNG (không chỉ biến thể Tùy chọn)", () => {
    const block =
      css.split("@media (max-width: 1279px)")[1]?.split("@media")[0] ?? "";
    expect(block).toContain(".hn-dash .filter-card {");
    expect(block).toContain("flex-wrap: wrap");
  });
});

describe("biểu đồ Apex không được chống/đè ô chứa (UAT 09/09 · RPT-04 bo nhỏ cửa sổ)", () => {
  it("host LazyApexChart khai contain: inline-size + width 100% để grid/flex item co được", () => {
    // Ô chứa chart là grid/flex item với min-width:auto; nếu host còn kích thước
    // nội tại theo canvas cũ thì item không co theo cột lưới, observer không bắn.
    const src = read("src/shared/components/charts/LazyApexChart.tsx");
    expect(src).toContain('contain: "inline-size"');
    expect(src).toContain('width: "100%"');
    expect(src).toContain("Math.min(props.width, hostWidth)");
  });

  it("hn-responsive.css kẹp .apexcharts-canvas theo ô chứa (lưới an toàn)", () => {
    const rule = rulesOf(read("src/styles/hn-responsive.css")).find(
      (item) => item.selector === ".apexcharts-canvas",
    );
    expect(rule).toBeDefined();
    expect(declaration(rule!.body, "max-width")).toBe("100%");
  });
});
