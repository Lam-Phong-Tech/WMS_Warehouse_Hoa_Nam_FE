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

/**
 * Sàn CHUNG của vùng vẽ biểu đồ. `.chart-plot` (khung), `.chart-svg` (nội dung)
 * và `.chart-empty` (ô trống) phải cùng đọc biến này — xem WWHN-341 bên dưới.
 */
const CHART_PLOT_MIN_VAR = "--hn-chart-plot-min";

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

      const emptyRaw = declaration(empty.body, "min-height");
      const plotRaw = declaration(plot.body, "min-height");
      if (emptyRaw === null || plotRaw === null) continue;

      /*
       * Từ WWHN-341 cả hai đọc chung `--hn-chart-plot-min`; khai qua biến là
       * ràng buộc CHẶT HƠN so sánh số, nên chấp nhận thẳng và không so px nữa.
       */
      if (emptyRaw === plotRaw && emptyRaw.includes(CHART_PLOT_MIN_VAR)) {
        continue;
      }

      const emptyMin = pxOf(emptyRaw);
      const plotMin = pxOf(plotRaw);
      expect(
        emptyMin,
        `${file}: .chart-empty (${emptyRaw}) và .chart-plot (${plotRaw}) không cùng một sàn — ô trống sẽ tràn khỏi vùng vẽ. Cho cả hai đọc ${CHART_PLOT_MIN_VAR}.`,
      ).not.toBeNull();
      expect(
        emptyMin,
        `${file}: .chart-empty (${emptyMin}px) cao hơn .chart-plot (${plotMin}px) nên ô trống sẽ tràn khỏi vùng vẽ`,
      ).toBeLessThanOrEqual(plotMin!);
    }
  });
});

/**
 * WWHN-341 · UAT TC_UI_14 — "Xem bảng dữ liệu thay thế" làm biểu đồ đè lên bảng.
 *
 * HIỆN TƯỢNG (ảnh bằng chứng của tester, màn Báo cáo nhập kho): bấm mở bảng thì
 * nét vẽ và nhãn trục của biểu đồ nằm ĐÈ lên các dòng của bảng vừa hiện ra.
 *
 * ĐO ĐƯỢC KHI TÁI HIỆN (viewport 1440×900, thẻ biểu đồ cao 370px):
 *   · `.chart-wrap` co từ 217px xuống 32px — đúng bằng phần đệm, tức là hết chỗ;
 *   · `.chart-plot` vẫn 180px và `.chart-svg` vẫn 220px vì có sàn riêng;
 *   · SVG do đó thò 204px xuống dưới đáy khung chứa, phủ lên khối `<details>`.
 *
 * HAI NGUYÊN NHÂN GỐC, mỗi cái được một luật dưới đây khoá lại:
 *
 *   1. SÀN KHAI HAI CHỖ RỒI TRÔI KHỎI NHAU. `.chart-plot` (khung) và
 *      `.chart-svg` (nội dung) là quan hệ chứa/bị chứa nên sàn phải là MỘT con
 *      số. Bản lỗi khai 180px cho khung và 220px cho nội dung ở hai luật khác
 *      nhau — chênh 40px đó chính là phần vẽ đè. Nay cả hai đọc
 *      `--hn-chart-plot-min`, không thể lệch.
 *
 *   2. KHUNG CHỨA ĐƯỢC PHÉP CO DƯỚI THỨ NÓ CHỨA. `min-height: 0` trên
 *      `.chart-wrap` (một `flex: 1`) cho phép nó nhường hết chỗ cho khối
 *      `<details>` đang mở, trong khi vùng vẽ bên trong không co theo.
 *
 * Luật 3 khoá hành vi đã chốt: mở bảng là THAY biểu đồ (đúng nghĩa "bảng dữ
 * liệu thay thế"), nên không còn hai khối tranh nhau một chỗ.
 */
describe("biểu đồ ↔ bảng dữ liệu thay thế · không được chồng lấn (WWHN-341)", () => {
  /** Mọi file CSS có cặp `.chart-plot` / `.chart-svg` + bảng thay thế. */
  const CHART_CSS = [
    "src/modules/reports/inventory-flow/inventory-flow-report.css",
    "src/modules/reports/stock-reconcile/stock-reconcile-report.css",
    "src/modules/dashboard/dashboard-overview.css",
  ] as const;

  it("sàn vùng vẽ khai đúng một lần: .chart-plot và .chart-svg cùng đọc biến", () => {
    for (const file of CHART_CSS) {
      const rules = rulesOf(read(file));

      // Biến phải được đặt ở chính thẻ, để mọi biến thể thẻ đều có giá trị.
      const declaresVar = rules.some(
        (rule) =>
          /\.chart-card\b/.test(rule.selector) &&
          declaration(rule.body, `\\${CHART_PLOT_MIN_VAR}`) !== null,
      );
      expect(
        declaresVar,
        `${file}: không thẻ nào khai ${CHART_PLOT_MIN_VAR} — sàn vùng vẽ phải đặt ở .chart-card`,
      ).toBe(true);

      // Và không luật nào được khai min-height bằng số cho ba lớp này nữa.
      const offenders = rules
        .filter((rule) =>
          /\.chart-(plot|svg|empty)\s*$/.test(
            rule.selector.split(",").at(-1)?.trim() ?? "",
          ),
        )
        .filter((rule) => {
          const value = declaration(rule.body, "min-height");
          return value !== null && !value.includes(CHART_PLOT_MIN_VAR);
        })
        .map(
          (rule) =>
            `${file} :: ${rule.selector} (${declaration(rule.body, "min-height")})`,
        );

      expect(
        offenders,
        `Sàn vùng vẽ phải đi qua ${CHART_PLOT_MIN_VAR} — khai số rời ở đây là cách WWHN-341 tái diễn\n(khung và nội dung trôi khỏi nhau, phần dôi vẽ đè xuống bảng):\n${offenders.join("\n")}`,
      ).toEqual([]);
    }
  });

  it("khung vùng vẽ không được co dưới thứ nó chứa (.chart-wrap ≠ min-height 0)", () => {
    const offenders: string[] = [];
    for (const file of CHART_CSS) {
      for (const rule of rulesOf(read(file))) {
        if (
          !/\.chart-wrap\s*$/.test(
            rule.selector.split(",").at(-1)?.trim() ?? "",
          )
        ) {
          continue;
        }
        const value = declaration(rule.body, "min-height");
        if (value === null) continue;
        if (/^0(px)?$/.test(value.trim())) {
          offenders.push(`${file} :: ${rule.selector}`);
        }
      }
    }
    expect(
      offenders,
      `\`.chart-wrap\` là flex: 1 — cho nó min-height: 0 là cho phép co về 0 trong khi\n\`.chart-plot\` bên trong vẫn giữ sàn riêng; phần chênh đó tràn ra và vẽ đè lên\nbảng dữ liệu thay thế (WWHN-341). Đặt sàn theo calc(${CHART_PLOT_MIN_VAR} + đệm dọc):\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  it("mở bảng thay thế là THAY biểu đồ, không chèn thêm vào dưới nó", () => {
    for (const file of CHART_CSS) {
      const css = read(file);
      expect(
        css,
        `${file}: thiếu luật chuyển sang chế độ bảng. Thẻ biểu đồ cao cố định không\nđủ chỗ cho cả biểu đồ lẫn bảng — thiếu luật này là hai khối lại tranh nhau một chỗ.`,
      ).toContain(".chart-card:has(> .chart-table[open])");
      expect(css).toContain(".chart-table[open]) > .chart-table");
    }
  });
});
/**
 * UAT TC_UI_04 — mốc responsive của dashboard tính theo BỀ RỘNG VÙNG NỘI DUNG
 * (container query 'hn-dash'), không theo viewport: shell chiếm 340px sidebar
 * (76px khi thu gọn rail) nên media query theo viewport từng cho iPad Pro
 * 1024px (nội dung ~640px) bố cục 2 cột của laptop — cặp thẻ chỉ còn ~300px,
 * tiêu đề tiếng Việt vỡ từng từ một (ảnh bằng chứng TC_UI_04).
 *
 * Guard đọc CSS nguồn và khoá 3 điều: (1) .hn-dash khai container inline-size;
 * (2) khối xếp chồng dùng :nth-child (độ đặc hiệu 0,3,0 — bản cũ dùng "> *"
 * 0,2,0 thua cascade của khối span-6 dù đứng sau); (3) KHÔNG được quay lại
 * media query theo kích thước trong file này (pointer/reduced-motion vẫn hợp
 * lệ vì không phụ thuộc bề rộng).
 */
describe("dashboard responsive · container query theo vùng nội dung (UAT TC_UI_04)", () => {
  const css = readFileSync(
    "src/modules/dashboard/dashboard-overview.css",
    "utf8",
  );

  it(".hn-dash là container inline-size tên hn-dash", () => {
    expect(css).toContain("container: hn-dash / inline-size");
  });

  it("khối xếp chồng ≤819.98px dùng :nth-child cho analysis-grid và insight-grid", () => {
    const block =
      css
        .split("@container hn-dash (max-width: 819.98px)")[1]
        ?.split("@container")[0] ?? "";
    expect(block).toContain("analysis-grid > :nth-child(n)");
    expect(block).toContain("insight-grid > :nth-child(n)");
    expect(block).toContain("grid-column: 1 / -1");
    expect(block).toContain(".hn-dash .filter-card {");
    expect(block).toContain("flex-wrap: wrap");
    // Thẻ lọc không được khai sàn cột vượt đáy dải (~640px nội dung).
    expect(block).not.toContain("minmax(380px");
    expect(block).not.toContain("minmax(300px");
  });

  it("không còn media query theo kích thước — chỉ container query", () => {
    // pointer: coarse / prefers-reduced-motion vẫn là @media hợp lệ; khối
    // fallback cho trình duyệt cũ nằm TRONG @supports not (container-type)
    // nên được cắt ra trước khi soát.
    const supportsStart = css.indexOf(
      "@supports not (container-type: inline-size)",
    );
    const supportsEnd = css.indexOf(
      String.fromCharCode(10) + "}" + String.fromCharCode(10),
      supportsStart,
    );
    const withoutFallback =
      supportsStart < 0
        ? css
        : css.slice(0, supportsStart) + css.slice(supportsEnd + 3);
    expect(withoutFallback).not.toMatch(/@media[^{]*(max-width|min-width)/);
    // Khối fallback phải tồn tại — điện thoại WebView cũ vẫn cần lưới an toàn.
    expect(css).toContain("@supports not (container-type: inline-size)");
  });

  it("khối điện thoại ≤639.98px vẫn xếp chồng bằng :nth-child", () => {
    const block =
      css
        .split("@container hn-dash (max-width: 639.98px)")[1]
        ?.split("@container")[0] ?? "";
    expect(block).toContain("analysis-grid > :nth-child(n)");
    expect(block).toContain("insight-grid > :nth-child(n)");
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
