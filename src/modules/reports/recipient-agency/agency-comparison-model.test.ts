/**
 * Bộ tính của tab "So sánh đối tượng nhận hàng".
 *
 * File này khoá những gì typecheck không bắt được và cũng không nhìn ra được
 * bằng mắt trên trình duyệt:
 *  · xuất thuần = ghi sổ − hoàn tác (phải khớp tab lát cắt);
 *  · kỳ trước là kỳ CÙNG ĐỘ DÀI liền trước, và cửa sổ tải phải phủ trọn tháng;
 *  · đại lý mở giữa kỳ bị đánh dấu không tương đương, KHÔNG bị kết luận là kém;
 *  · kỳ trước bằng 0 thì `delta = null` chứ không phải +100%;
 *  · "bán chậm" tách được ba nhóm khác nhau về hành động.
 */
import dayjs from "dayjs";
import { describe, expect, it } from "vitest";
import {
  analysisWindowOf,
  bucketsOf,
  buildComparison,
  granularityOf,
  previousWindowOf,
  type ComparisonContext,
  type ComparisonFilters,
} from "./agency-comparison-model";
import type { RecipientAgencyLedgerEvent } from "./recipient-agency-api";

const PALETTE = ["c1", "c2", "c3", "c4", "c5", "c6"];

type EventSpec = {
  party: string;
  sku: string;
  date: string;
  qty: number;
  reversed?: boolean;
  doc?: string;
};

let sequence = 0;

function event({
  party,
  sku,
  date,
  qty,
  reversed = false,
  doc,
}: EventSpec): RecipientAgencyLedgerEvent {
  sequence += 1;
  const documentId = doc ?? `doc-${sequence}`;
  return {
    event_id: `${documentId}#${sequence}:${reversed ? "REVERSED" : "POSTED"}`,
    event_type: reversed ? "ISSUE_REVERSED" : "ISSUE_POSTED",
    occurred_at: `${date}T08:00:00+07:00`,
    outbound_document_id: documentId,
    outbound_no: documentId.toUpperCase(),
    source_request_no: null,
    reversal_of_event_id: null,
    posted_quantity: qty,
    reversed_quantity: reversed ? qty : 0,
    quantity: qty,
    recipient: {
      id: party,
      code: party.toUpperCase(),
      name: `Đại lý ${party.toUpperCase()}`,
      type: "AGENCY",
    },
    agency: { id: party, code: party.toUpperCase(), name: `Đại lý ${party}` },
    requesting_department: null,
    sku: {
      id: sku,
      code: sku.toUpperCase(),
      name: `Hàng ${sku.toUpperCase()}`,
      product_type: "PRODUCT",
    },
    pii: null,
    cross_period_reversal: false,
  };
}

const context: ComparisonContext = {
  categoryOfSku: (skuId) => (skuId === "s1" ? "cat-machine" : "cat-other"),
  marketOfParty: () => ({ market: "Miền Nam", region: "TP.HCM" }),
  palette: PALETTE,
  // Cố định "hôm nay" để cột `complete` của từng mốc không đổi theo ngày chạy CI.
  today: dayjs("2026-09-30"),
};

function filtersFor(
  overrides: Partial<ComparisonFilters> = {},
): ComparisonFilters {
  return {
    from: "2026-08-01",
    to: "2026-09-30",
    recipientTypes: [],
    markets: [],
    regions: [],
    partyIds: [],
    categoryIds: [],
    skuIds: [],
    skuScope: "TOP10",
    matrixSortBy: "TOTAL",
    trendMetric: "ALL",
    ...overrides,
  };
}

describe("khoảng thời gian", () => {
  it("kỳ trước có cùng độ dài và kết thúc ngay trước kỳ đang xem", () => {
    expect(previousWindowOf({ from: "2026-09-01", to: "2026-09-30" })).toEqual({
      from: "2026-08-02",
      to: "2026-08-31",
    });
  });

  it("cửa sổ tải mở về đầu tháng của kỳ trước để tháng nào cũng phủ trọn", () => {
    // Kỳ trước bắt đầu 02/08 — thiếu đúng ngày 01/08 thì nhận xét "tháng 8 so
    // với tháng 7" đã sai ngay từ số liệu đầu vào.
    expect(analysisWindowOf({ from: "2026-09-01", to: "2026-09-30" })).toEqual({
      from: "2026-08-01",
      to: "2026-09-30",
    });
  });

  it("chọn mốc theo độ dài kỳ chứ không theo số điểm", () => {
    expect(granularityOf({ from: "2026-09-01", to: "2026-09-20" })).toBe("day");
    expect(granularityOf({ from: "2026-06-01", to: "2026-09-01" })).toBe(
      "week",
    );
    expect(granularityOf({ from: "2025-09-01", to: "2026-09-01" })).toBe(
      "month",
    );
  });

  it("mốc chưa kết thúc trong kỳ bị đánh dấu chưa đầy đủ", () => {
    const buckets = bucketsOf(
      { from: "2026-08-01", to: "2026-09-15" },
      "month",
      dayjs("2026-09-15"),
    );
    expect(buckets.map((bucket) => bucket.key)).toEqual(["2026-08", "2026-09"]);
    expect(buckets[0].complete).toBe(true);
    expect(buckets[1].complete).toBe(false);
  });
});

describe("buildComparison", () => {
  it("cộng xuất thuần (ghi sổ − hoàn tác) và xếp hạng đúng theo số thuần", () => {
    const events = [
      event({ party: "a", sku: "s1", date: "2026-09-05", qty: 100, doc: "d1" }),
      event({
        party: "a",
        sku: "s1",
        date: "2026-09-06",
        qty: 30,
        reversed: true,
        doc: "d1",
      }),
      event({ party: "b", sku: "s1", date: "2026-09-05", qty: 90 }),
    ];

    const model = buildComparison(
      events,
      filtersFor({ from: "2026-09-01", to: "2026-09-30" }),
      context,
    );

    const a = model.parties.find((party) => party.id === "a");
    expect(a?.qty).toBe(70);
    expect(model.totals.qty).toBe(160);
    // Chưa chọn đối tượng nào ⇒ tự lấy top theo sản lượng THUẦN. 90 > 70 nên B
    // đứng trước A; bỏ quên dòng hoàn tác thì A (100) sẽ nhảy lên đầu.
    expect(model.parties.map((party) => party.id)).toEqual(["b", "a"]);
  });

  it("mỗi đối tượng giữ nguyên một màu theo thứ tự đã chọn", () => {
    const events = [
      event({ party: "a", sku: "s1", date: "2026-09-05", qty: 10 }),
      event({ party: "b", sku: "s1", date: "2026-09-05", qty: 20 }),
    ];
    const model = buildComparison(
      events,
      filtersFor({
        from: "2026-09-01",
        to: "2026-09-30",
        partyIds: ["b", "a"],
      }),
      context,
    );
    expect(model.parties.map((party) => party.color)).toEqual([
      PALETTE[0],
      PALETTE[1],
    ]);
  });

  it("kỳ trước không phát sinh thì delta là null, không phải +100%", () => {
    const events = [
      event({ party: "a", sku: "s1", date: "2026-09-10", qty: 50 }),
      event({ party: "b", sku: "s1", date: "2026-08-10", qty: 40 }),
      event({ party: "b", sku: "s1", date: "2026-09-10", qty: 60 }),
    ];
    const model = buildComparison(
      events,
      filtersFor({ from: "2026-09-01", to: "2026-09-30" }),
      context,
    );

    expect(model.parties.find((party) => party.id === "a")?.delta).toBeNull();
    // B: kỳ trước 02/08–31/08 có 40, kỳ này 60 ⇒ +50%.
    expect(model.parties.find((party) => party.id === "b")?.delta).toBeCloseTo(
      50,
      5,
    );
  });

  it("đại lý mở giữa kỳ bị đánh dấu không tương đương và sinh cảnh báo dữ liệu", () => {
    const events = [
      event({ party: "a", sku: "s1", date: "2026-07-05", qty: 100 }),
      event({ party: "a", sku: "s1", date: "2026-08-05", qty: 120 }),
      event({ party: "a", sku: "s1", date: "2026-09-05", qty: 130 }),
      // B chỉ bắt đầu từ tháng 9 — không được kết luận B kém A vì số tuyệt đối.
      event({ party: "b", sku: "s1", date: "2026-09-05", qty: 40 }),
    ];
    const model = buildComparison(
      events,
      filtersFor({ from: "2026-08-01", to: "2026-09-30" }),
      context,
    );

    const a = model.parties.find((party) => party.id === "a");
    const b = model.parties.find((party) => party.id === "b");
    expect(a?.comparable).toBe(true);
    expect(b?.comparable).toBe(false);
    expect(b?.coverageMonth).toBe("2026-09");
    expect(model.hasCoverageGap).toBe(true);

    const warning = model.insights.find((insight) => insight.kind === "data");
    expect(warning?.messageKey).toBe(
      "reports.agencyComparison.insightCoverageGap",
    );
    // Chỉ B bị nêu, và nêu kèm ĐÚNG mốc của B.
    expect(warning?.values.details).toBe("Đại lý B (09/2026)");
    expect(warning?.values.periodMonth).toBe("08/2026");
    // Cảnh báo dữ liệu phải đứng ĐẦU danh sách, không nằm cuối sau khi người
    // đọc đã tin vào mấy nhận xét xếp hạng phía trên.
    expect(model.insights[0]?.kind).toBe("data");
  });

  it("dựng ma trận SKU × đối tượng và chỉ ra ai nhận nhiều nhất từng dòng", () => {
    const events = [
      event({ party: "a", sku: "s1", date: "2026-09-05", qty: 120 }),
      event({ party: "b", sku: "s1", date: "2026-09-05", qty: 150 }),
      event({ party: "a", sku: "s2", date: "2026-09-05", qty: 90 }),
      event({ party: "b", sku: "s2", date: "2026-09-05", qty: 40 }),
    ];
    const model = buildComparison(
      events,
      filtersFor({
        from: "2026-09-01",
        to: "2026-09-30",
        partyIds: ["a", "b"],
      }),
      context,
    );

    const s1 = model.skus.find((sku) => sku.id === "s1");
    expect(s1?.byParty).toEqual([120, 150]);
    expect(s1?.qty).toBe(270);
    expect(s1?.topPartyId).toBe("b");
    expect(model.skus.find((sku) => sku.id === "s2")?.topPartyId).toBe("a");
  });

  it("sắp ma trận theo một đối tượng cụ thể khi được yêu cầu", () => {
    const events = [
      event({ party: "a", sku: "s1", date: "2026-09-05", qty: 10 }),
      event({ party: "b", sku: "s1", date: "2026-09-05", qty: 200 }),
      event({ party: "a", sku: "s2", date: "2026-09-05", qty: 150 }),
      event({ party: "b", sku: "s2", date: "2026-09-05", qty: 5 }),
    ];
    const base = filtersFor({
      from: "2026-09-01",
      to: "2026-09-30",
      partyIds: ["a", "b"],
    });

    expect(
      buildComparison(events, base, context).scopedSkus.map((sku) => sku.id),
    ).toEqual(["s1", "s2"]);
    expect(
      buildComparison(
        events,
        { ...base, matrixSortBy: "a" },
        context,
      ).scopedSkus.map((sku) => sku.id),
    ).toEqual(["s2", "s1"]);
  });

  it("tách ba nhóm bán chậm thay vì chỉ lấy SKU bằng 0", () => {
    const events = [
      // s1: kỳ trước có, kỳ này đứng hẳn.
      event({ party: "a", sku: "s1", date: "2026-08-05", qty: 80 }),
      // s2: vẫn chạy nhưng rơi mạnh.
      event({ party: "a", sku: "s2", date: "2026-08-05", qty: 200 }),
      event({ party: "a", sku: "s2", date: "2026-09-05", qty: 20 }),
      // s3: nền cao để s4 rơi xuống nhóm đáy theo phân vị.
      event({ party: "a", sku: "s3", date: "2026-09-05", qty: 500 }),
      event({ party: "b", sku: "s3", date: "2026-09-05", qty: 400 }),
      event({ party: "b", sku: "s4", date: "2026-09-05", qty: 3 }),
    ];
    const model = buildComparison(
      events,
      filtersFor({
        from: "2026-09-01",
        to: "2026-09-30",
        partyIds: ["a", "b"],
      }),
      context,
    );

    const reasonOf = (id: string) =>
      model.slowMovers.find((sku) => sku.id === id)?.reason;
    expect(reasonOf("s1")).toBe("NO_MOVEMENT");
    expect(reasonOf("s2")).toBe("DECLINED");
    expect(reasonOf("s4")).toBe("LOW_VOLUME");
    expect(model.slowMovers.some((sku) => sku.id === "s3")).toBe(false);
  });

  it("chuỗi xu hướng đổi theo chỉ số đang chọn, bảng xếp hạng thì không", () => {
    const events = [
      event({ party: "a", sku: "s1", date: "2026-08-10", qty: 10 }),
      event({ party: "a", sku: "s2", date: "2026-08-10", qty: 90 }),
      event({ party: "a", sku: "s1", date: "2026-09-10", qty: 40 }),
    ];
    const base = filtersFor({
      from: "2026-08-01",
      to: "2026-09-30",
      partyIds: ["a"],
    });

    const all = buildComparison(events, base, context);
    // Kỳ 2 tháng ⇒ mốc TUẦN; tổng của cả chuỗi mới là con số đem đối chiếu.
    expect(all.granularity).toBe("week");
    expect(all.metricTrend[0].reduce((sum, value) => sum + value, 0)).toBe(140);

    const onlyS1 = buildComparison(
      events,
      { ...base, trendMetric: "sku:s1" },
      context,
    );
    expect(onlyS1.metricTrend[0].reduce((sum, value) => sum + value, 0)).toBe(
      50,
    );
    // Chỉ số chỉ đổi đường vẽ — tổng của đối tượng trong bảng giữ nguyên.
    expect(onlyS1.parties[0].qty).toBe(140);
    expect(onlyS1.parties[0].trend.reduce((sum, value) => sum + value, 0)).toBe(
      140,
    );
  });

  it("chỉ số theo nhóm hàng gom đúng các SKU của nhóm đó", () => {
    const events = [
      event({ party: "a", sku: "s1", date: "2026-09-10", qty: 25 }),
      event({ party: "a", sku: "s9", date: "2026-09-10", qty: 70 }),
    ];
    const model = buildComparison(
      events,
      filtersFor({
        from: "2026-09-01",
        to: "2026-09-30",
        partyIds: ["a"],
        trendMetric: "cat:cat-machine",
      }),
      context,
    );
    expect(model.metricTrend[0].reduce((sum, value) => sum + value, 0)).toBe(
      25,
    );
  });

  it("lọc theo nhóm hàng thu hẹp cả mô hình", () => {
    const events = [
      event({ party: "a", sku: "s1", date: "2026-09-10", qty: 25 }),
      event({ party: "a", sku: "s9", date: "2026-09-10", qty: 70 }),
    ];
    const model = buildComparison(
      events,
      filtersFor({
        from: "2026-09-01",
        to: "2026-09-30",
        categoryIds: ["cat-machine"],
      }),
      context,
    );
    expect(model.totals.qty).toBe(25);
    expect(model.skus.map((sku) => sku.id)).toEqual(["s1"]);
  });

  it("so tháng này với tháng trước theo THÁNG, không theo mốc của biểu đồ", () => {
    const events = [
      event({ party: "a", sku: "s1", date: "2026-08-10", qty: 100 }),
      event({ party: "b", sku: "s1", date: "2026-08-20", qty: 100 }),
      event({ party: "a", sku: "s1", date: "2026-09-10", qty: 150 }),
      event({ party: "b", sku: "s1", date: "2026-09-20", qty: 86 }),
    ];
    const model = buildComparison(
      events,
      // Kỳ 2 tháng ⇒ biểu đồ vẽ theo TUẦN, nhưng nhận xét vẫn phải nói theo tháng.
      filtersFor({
        from: "2026-08-01",
        to: "2026-09-30",
        partyIds: ["a", "b"],
      }),
      context,
    );

    expect(model.granularity).toBe("week");
    expect(model.monthOverMonth).toMatchObject({
      currentKey: "2026-09",
      previousKey: "2026-08",
      currentQty: 236,
      previousQty: 200,
      partial: false,
    });
    expect(model.monthOverMonth?.delta).toBeCloseTo(18, 5);
    expect(
      model.insights.find((insight) => insight.id === "month-over-month")
        ?.messageKey,
    ).toBe("reports.agencyComparison.insightMonthChange");
  });

  it("tháng chưa hết thì cắt tháng trước ở cùng số ngày, không so nửa với cả", () => {
    const events = [
      // Tháng 8: 60 trong 6 ngày đầu, thêm 400 ở phần sau tháng.
      event({ party: "a", sku: "s1", date: "2026-08-03", qty: 60 }),
      event({ party: "a", sku: "s1", date: "2026-08-25", qty: 400 }),
      event({ party: "b", sku: "s1", date: "2026-08-04", qty: 40 }),
      // Tháng 9 mới tới ngày 6.
      event({ party: "a", sku: "s1", date: "2026-09-03", qty: 80 }),
      event({ party: "b", sku: "s1", date: "2026-09-05", qty: 45 }),
    ];
    const model = buildComparison(
      events,
      filtersFor({
        from: "2026-09-01",
        to: "2026-09-06",
        partyIds: ["a", "b"],
      }),
      context,
    );

    // 01–06/09 = 125 so với 01–06/08 = 100 ⇒ +25%. Nếu lấy CẢ tháng 8 (500) thì
    // con số sẽ thành −75% — đúng ca sai mà phép cắt theo ngày sinh ra để chặn.
    expect(model.monthOverMonth).toMatchObject({
      currentQty: 125,
      previousQty: 100,
      partial: true,
      throughDay: 6,
    });
    expect(model.monthOverMonth?.delta).toBeCloseTo(25, 5);
    expect(
      model.insights.find((insight) => insight.id === "month-over-month")
        ?.messageKey,
    ).toBe("reports.agencyComparison.insightMonthChangePartial");
  });

  it("chưa đủ 2 đối tượng có phát sinh thì không sinh nhận xét nào", () => {
    const events = [
      event({ party: "a", sku: "s1", date: "2026-09-10", qty: 999 }),
    ];
    const model = buildComparison(
      events,
      filtersFor({ from: "2026-09-01", to: "2026-09-30" }),
      context,
    );
    expect(model.totals.activePartyCount).toBe(1);
    expect(model.insights).toEqual([]);
  });

  it("nhận xét dẫn đầu mang đúng số và tỷ trọng của nhóm đang so sánh", () => {
    const events = [
      event({ party: "a", sku: "s1", date: "2026-09-10", qty: 750 }),
      event({ party: "b", sku: "s1", date: "2026-09-10", qty: 250 }),
    ];
    const model = buildComparison(
      events,
      filtersFor({
        from: "2026-09-01",
        to: "2026-09-30",
        partyIds: ["a", "b"],
      }),
      context,
    );

    const leader = model.insights.find((insight) => insight.id === "leader");
    expect(leader?.values).toMatchObject({ qty: 750, share: 75 });
    expect(leader?.values.name).toContain("A");
  });

  it("không sinh nhận xét tăng/giảm cho đối tượng chưa đủ kỳ", () => {
    const events = [
      // A đủ kỳ, giảm nhẹ (không tới ngưỡng ±10%).
      event({ party: "a", sku: "s1", date: "2026-08-10", qty: 100 }),
      event({ party: "a", sku: "s1", date: "2026-09-10", qty: 98 }),
      // B mở giữa kỳ, kỳ trước bằng 0 ⇒ delta null ⇒ không được vào nhận xét.
      event({ party: "b", sku: "s1", date: "2026-09-10", qty: 5000 }),
    ];
    const model = buildComparison(
      events,
      filtersFor({
        from: "2026-09-01",
        to: "2026-09-30",
        partyIds: ["a", "b"],
      }),
      context,
    );
    expect(
      model.insights.filter((insight) => insight.kind === "growth"),
    ).toEqual([]);
    // B mới mở trong tháng 9 nên bị loại khỏi phép so tháng: nếu cộng cả B vào,
    // nhóm sẽ "tăng ~5.000%" chỉ vì danh sách đối tượng đổi, không phải vì bán
    // được nhiều hơn.
    expect(model.monthOverMonth?.partyCount).toBe(1);
    expect(model.monthOverMonth?.excludedPartyCount).toBe(1);
    expect(model.monthOverMonth?.delta).toBeCloseTo(-2, 5);
  });

  it("giới hạn còn tối đa 6 nhận xét dù có nhiều tín hiệu", () => {
    const events = [
      event({ party: "a", sku: "s1", date: "2026-08-10", qty: 400 }),
      event({ party: "a", sku: "s1", date: "2026-09-10", qty: 900 }),
      event({ party: "b", sku: "s2", date: "2026-08-10", qty: 800 }),
      event({ party: "b", sku: "s2", date: "2026-09-10", qty: 200 }),
      event({ party: "c", sku: "s3", date: "2026-08-10", qty: 300 }),
      event({ party: "c", sku: "s4", date: "2026-09-10", qty: 60 }),
    ];
    const model = buildComparison(
      events,
      filtersFor({ from: "2026-09-01", to: "2026-09-30" }),
      context,
    );
    expect(model.insights.length).toBeLessThanOrEqual(6);
    expect(model.insights.length).toBeGreaterThan(0);
  });
});
