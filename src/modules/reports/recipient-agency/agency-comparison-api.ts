/**
 * Lớp dữ liệu của tab "So sánh đối tượng nhận hàng" (RPT-07 · tab 2).
 *
 * Không có endpoint so sánh nào ở backend và tab này KHÔNG cần một cái: mọi
 * chiều so sánh (đại lý × SKU, đại lý × mốc thời gian, kỳ này × kỳ trước) đều
 * suy được từ CHÍNH sổ xuất mà tab lát cắt đang đọc. Việc cần làm ở đây chỉ là:
 *
 *   1. tải sổ trên cửa sổ RỘNG HƠN kỳ đang xem (kỳ này + kỳ liền trước, xem
 *      `analysisWindowOf`) để có mốc so sánh và mốc bắt đầu có dữ liệu;
 *   2. ghép thêm danh mục (SKU → nhóm hàng, đại lý → thị trường/khu vực) mà
 *      dòng báo cáo không mang theo;
 *   3. giao cho `buildComparison` — bộ tính thuần tuý, có unit test riêng.
 *
 * Danh mục lựa chọn cho bộ lọc lấy từ ĐÚNG cửa sổ đang tải: chỉ hiện đối tượng
 * và SKU thật sự có phát sinh, thay vì đổ cả master data rồi để người dùng chọn
 * trúng một đại lý không có dòng nào trong kỳ.
 */
import { useCallback, useMemo } from "react";
import {
  useAgencyOptions,
  useCategoryOptions,
  useSkuCatalog,
} from "@/modules/reports/operations/report-data";
import { CATEGORICAL_PALETTE } from "@/shared/components/charts/chart-theme";
import {
  agencyPlaceLabel,
  agencyPlaceLine,
} from "@/shared/constants/agency-place-labels";
import {
  useRecipientAgencyLedger,
  type RecipientAgencyLedgerEvent,
} from "./recipient-agency-api";
import {
  analysisWindowOf,
  buildComparison,
  type ComparisonFilters,
  type ComparisonModel,
} from "./agency-comparison-model";

export type ComparisonOption = {
  value: string;
  label: string;
  /** Dòng phụ trên chip/menu — thị trường & khu vực, hoặc nhóm hàng. */
  hint?: string;
  /** Sản lượng thuần trong kỳ, dùng để xếp danh sách theo mức độ liên quan. */
  qty?: number;
};

export type ComparisonOptions = {
  parties: ComparisonOption[];
  recipientTypes: string[];
  markets: ComparisonOption[];
  regions: ComparisonOption[];
  categories: ComparisonOption[];
  skus: ComparisonOption[];
};

export type AgencyComparisonResult = {
  model: ComparisonModel | undefined;
  options: ComparisonOptions;
  /**
   * Sổ thô của cửa sổ đang tải — drill-down đọc lại từ đây thay vì gọi thêm
   * một hook nữa; cùng một mảng thì bảng chi tiết chắc chắn khớp với ô vừa bấm.
   */
  events: RecipientAgencyLedgerEvent[];
  window: { from: string; to: string };
  isLoading: boolean;
  isFetching: boolean;
  error: unknown;
  /** true = sổ bị cắt ở trần trang ⇒ mọi con số đang thiếu, phải nói ra. */
  truncated: boolean;
  serverRowTotal: number;
  loadedRowCount: number;
  refetch: () => Promise<void>;
};

const EMPTY_OPTIONS: ComparisonOptions = {
  parties: [],
  recipientTypes: [],
  markets: [],
  regions: [],
  categories: [],
  skus: [],
};

function byLabel(left: ComparisonOption, right: ComparisonOption): number {
  return left.label.localeCompare(right.label, "vi");
}

/** Xếp theo sản lượng giảm dần, hoà thì theo tên — danh sách dài vẫn đọc được. */
function byQtyThenLabel(
  left: ComparisonOption,
  right: ComparisonOption,
): number {
  const gap = (right.qty ?? 0) - (left.qty ?? 0);
  return gap !== 0 ? gap : byLabel(left, right);
}

export function useAgencyComparison(
  filters: ComparisonFilters,
): AgencyComparisonResult {
  const window = useMemo(
    () => analysisWindowOf({ from: filters.from, to: filters.to }),
    [filters.from, filters.to],
  );

  const ledger = useRecipientAgencyLedger({
    from: window.from,
    to: window.to,
    enabled: Boolean(filters.from && filters.to),
  });
  const catalog = useSkuCatalog();
  const agencies = useAgencyOptions();
  const categories = useCategoryOptions();

  /**
   * Dòng báo cáo mang `market`/`region` của đại lý nhưng sổ sự kiện đã bỏ hai
   * trường đó (tab lát cắt không dùng tới), nên tra ngược qua master data —
   * cùng một nguồn với hai ô lọc Thị trường / Khu vực để hai bên không lệch.
   */
  const placeOfParty = useMemo(() => {
    const map = new Map<string, { market: string; region: string }>();
    for (const entry of agencies.entries) {
      if (!entry.agency_id) continue;
      map.set(entry.agency_id, {
        market: entry.market,
        region: entry.region,
      });
    }
    return map;
  }, [agencies.entries]);

  const categoryNameById = useMemo(
    () => new Map(categories.options.map((item) => [item.value, item.label])),
    [categories.options],
  );

  const context = useMemo(
    () => ({
      categoryOfSku: (skuId: string) =>
        catalog.byId.get(skuId)?.category_id ?? null,
      marketOfParty: (partyId: string) =>
        placeOfParty.get(partyId) ?? { market: "", region: "" },
      palette: CATEGORICAL_PALETTE,
    }),
    [catalog.byId, placeOfParty],
  );

  const model = useMemo(() => {
    if (!filters.from || !filters.to) return undefined;
    // Trước khi lượt dữ liệu ĐẦU TIÊN về, `events` rỗng và mô hình dựng ra
    // toàn số 0 — màn hình sẽ hiện "không có dữ liệu" trong khi thật ra đang
    // tải. Trả undefined để tầng trên giữ trạng thái loading.
    if (ledger.isLoading) return undefined;
    return buildComparison(ledger.events, filters, context);
  }, [ledger.events, ledger.isLoading, filters, context]);

  const options = useMemo<ComparisonOptions>(() => {
    if (ledger.events.length === 0) return EMPTY_OPTIONS;

    const period = { from: filters.from, to: filters.to };
    const parties = new Map<string, ComparisonOption>();
    const skus = new Map<string, ComparisonOption>();
    const recipientTypes = new Set<string>();
    const markets = new Map<string, ComparisonOption>();
    const regions = new Map<string, ComparisonOption>();
    const usedCategories = new Set<string>();

    const addQty = (
      target: Map<string, ComparisonOption>,
      key: string,
      option: ComparisonOption,
      qty: number,
    ) => {
      const current = target.get(key);
      if (current) current.qty = (current.qty ?? 0) + qty;
      else target.set(key, { ...option, qty });
    };

    for (const event of ledger.events) {
      const day = event.occurred_at.slice(0, 10);
      // Danh sách lựa chọn mô tả KỲ ĐANG XEM. Cửa sổ tải rộng hơn kỳ (có cả kỳ
      // trước) nên nếu đếm cả cửa sổ thì một đại lý đã ngừng nhận hàng vẫn hiện
      // như đang hoạt động.
      const inPeriod = day >= period.from && day <= period.to;
      const qty =
        event.event_type === "ISSUE_POSTED" ? event.quantity : -event.quantity;

      if (event.recipient.type) recipientTypes.add(event.recipient.type);

      const partyId = event.recipient.id;
      if (partyId) {
        const place = placeOfParty.get(partyId);
        addQty(
          parties,
          partyId,
          {
            value: partyId,
            label: event.recipient.code
              ? `${event.recipient.code} · ${event.recipient.name ?? ""}`
              : (event.recipient.name ?? ""),
            hint: agencyPlaceLine(place?.market, place?.region),
          },
          inPeriod ? qty : 0,
        );
        if (place?.market) {
          addQty(
            markets,
            place.market,
            { value: place.market, label: agencyPlaceLabel(place.market) },
            inPeriod ? qty : 0,
          );
        }
        if (place?.region) {
          addQty(
            regions,
            place.region,
            { value: place.region, label: agencyPlaceLabel(place.region) },
            inPeriod ? qty : 0,
          );
        }
      }

      if (event.sku.id) {
        const categoryId = catalog.byId.get(event.sku.id)?.category_id ?? null;
        if (categoryId) usedCategories.add(categoryId);
        addQty(
          skus,
          event.sku.id,
          {
            value: event.sku.id,
            label: event.sku.code
              ? `${event.sku.code} · ${event.sku.name ?? ""}`
              : (event.sku.name ?? ""),
            hint: categoryId ? (categoryNameById.get(categoryId) ?? "") : "",
          },
          inPeriod ? qty : 0,
        );
      }
    }

    return {
      parties: [...parties.values()].sort(byQtyThenLabel),
      recipientTypes: [...recipientTypes].sort(),
      markets: [...markets.values()].sort(byLabel),
      regions: [...regions.values()].sort(byLabel),
      // Nhóm hàng lấy từ master data nhưng CHỈ giữ nhóm có phát sinh trong cửa
      // sổ — chọn một nhóm rỗng rồi nhìn màn hình trắng là lỗi trải nghiệm.
      categories: categories.options
        .filter((option) => usedCategories.has(option.value))
        .map((option) => ({ value: option.value, label: option.label }))
        .sort(byLabel),
      skus: [...skus.values()].sort(byQtyThenLabel),
    };
  }, [
    ledger.events,
    filters.from,
    filters.to,
    placeOfParty,
    catalog.byId,
    categories.options,
    categoryNameById,
  ]);

  const refetch = useCallback(async () => {
    await ledger.refetch();
  }, [ledger]);

  return {
    model,
    options,
    events: ledger.events,
    window,
    isLoading: ledger.isLoading || catalog.loading,
    isFetching: ledger.isFetching,
    error: ledger.error,
    truncated: ledger.truncated,
    serverRowTotal: ledger.serverRowTotal,
    loadedRowCount: ledger.loadedRowCount,
    refetch,
  };
}

/**
 * Chứng từ nguồn của một ô đang bấm (đối tượng × SKU, hoặc đối tượng × mốc).
 *
 * Drill-down đọc thẳng sổ đang hiển thị chứ không gọi thêm mạng: người dùng
 * luôn thấy đúng những dòng đã tạo nên con số vừa bấm, kể cả khi query nền đã
 * refetch xong một lát cắt mới.
 */
export type ComparisonDrillRow = {
  eventId: string;
  occurredAt: string;
  outboundNo: string;
  documentId: string;
  partyName: string;
  skuCode: string;
  skuName: string;
  eventType: RecipientAgencyLedgerEvent["event_type"];
  quantity: number;
};

export function drillRowsOf(
  events: RecipientAgencyLedgerEvent[],
  scope: {
    partyId?: string;
    skuId?: string;
    from: string;
    to: string;
  },
): ComparisonDrillRow[] {
  return events
    .filter((event) => {
      const day = event.occurred_at.slice(0, 10);
      if (day < scope.from || day > scope.to) return false;
      if (scope.partyId && event.recipient.id !== scope.partyId) return false;
      if (scope.skuId && event.sku.id !== scope.skuId) return false;
      return true;
    })
    .map((event) => ({
      eventId: event.event_id,
      occurredAt: event.occurred_at,
      outboundNo: event.outbound_no,
      documentId: event.outbound_document_id,
      partyName: event.recipient.name ?? "",
      skuCode: event.sku.code ?? "",
      skuName: event.sku.name ?? "",
      eventType: event.event_type,
      quantity: event.quantity,
    }))
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));
}
