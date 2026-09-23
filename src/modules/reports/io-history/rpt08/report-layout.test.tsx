import { readFileSync } from "node:fs";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useLanguageStore } from "@/shared/i18n/language.store";
import { ensureEnglishMessages } from "@/shared/i18n/english-messages";
import { HistoryTable } from "./widgets";
import { PAGE_SIZE, type HistoryRow } from "./model";

const rows: HistoryRow[] = Array.from({ length: PAGE_SIZE }, (_, index) => ({
  id: `fixture-${index + 1}`,
  timestamp: `2026-09-23T${String(9 + index).padStart(2, "0")}:00:00+07:00`,
  documentNo: `DOC-${String(index + 1).padStart(4, "0")}`,
  type: index % 2 === 0 ? "INBOUND" : "OUTBOUND",
  objectPrimary: `SKU-${String(index + 1).padStart(3, "0")}`,
  objectSecondary: "Test fixture",
  quantity: index + 1,
  actor: "Test User",
}));
function mountTable(page = 1, total = 42, extra = {}) {
  const onPageChange = vi.fn();
  const onOpenRow = vi.fn();
  const onSearch = vi.fn();
  const result = render(
    <HistoryTable
      rows={rows.slice(0, PAGE_SIZE)}
      total={total}
      page={page}
      search=""
      empty={false}
      noResult={false}
      range={{ from: "2026-09-17", to: "2026-09-23", type: "ALL", actor: "" }}
      onSearch={onSearch}
      onPageChange={onPageChange}
      onOpenRow={onOpenRow}
      onAdjustRange={() => {}}
      {...extra}
    />,
  );
  return { ...result, onPageChange, onOpenRow, onSearch };
}

afterEach(() => {
  cleanup();
  useLanguageStore.setState({ language: "vi" });
});

describe("RPT-08 shared report presentation", () => {
  it("uses the existing title and pager contracts, not a new global override", () => {
    const root = "src/modules/reports/io-history/";
    const page = readFileSync(root + "rpt08/Rpt08HistoryReport.tsx", "utf8");
    const entry = readFileSync(root + "io-history-report.css", "utf8");
    const css = readFileSync(root + "rpt08/alignment.css", "utf8");
    expect(page).toContain('className="hn-report-page-title"');
    const imports = entry.trim().split(/\r?\n/);
    const responsive = imports.indexOf('@import "./rpt08/responsive.css";');
    const alignment = imports.indexOf('@import "./rpt08/alignment.css";');
    const controls = imports.indexOf('@import "./rpt08/controls.css";');
    expect(responsive).toBeGreaterThanOrEqual(0);
    expect(alignment).toBeGreaterThan(responsive);
    expect(controls).toBeGreaterThan(alignment);
    expect(readFileSync(root + "rpt08/controls.css", "utf8")).not.toMatch(
      /\.hn-topbar|\.header-control|!important/,
    );
    expect(css).not.toMatch(/\.hn-topbar|\.header-control|!important/);
    const { container } = mountTable();
    expect(container.querySelector(".rpt08-table-footer")).toHaveClass(
      "hn-report-pagination-footer",
    );
    expect(container.querySelector(".rpt08-pagination")).toHaveClass(
      "hn-report-pagination",
    );
  });
  it("keeps page numbers functional and disables previous on page one", () => {
    const { container, onPageChange } = mountTable();
    const previous = container.querySelector(
      '[data-page-direction="previous"]',
    )!;
    expect(previous).toBeDisabled();
    fireEvent.click(previous);
    expect(onPageChange).not.toHaveBeenCalled();
    fireEvent.click(container.querySelector('[data-page-direction="next"]')!);
    expect(onPageChange).toHaveBeenLastCalledWith(2);
    fireEvent.click(screen.getByRole("button", { name: "3" }));
    expect(onPageChange).toHaveBeenLastCalledWith(3);
  });
  it("disables next on the last page and permits returning to the previous page", () => {
    const { container, onPageChange } = mountTable(9);
    const next = container.querySelector('[data-page-direction="next"]')!;
    expect(next).toBeDisabled();
    fireEvent.click(next);
    expect(onPageChange).not.toHaveBeenCalled();
    fireEvent.click(
      container.querySelector('[data-page-direction="previous"]')!,
    );
    expect(onPageChange).toHaveBeenLastCalledWith(8);
  });
  it("keeps both page-boundary actions disabled for a single page", () => {
    const { container } = mountTable(1, 5);
    expect(
      container.querySelector('[data-page-direction="previous"]'),
    ).toBeDisabled();
    expect(
      container.querySelector('[data-page-direction="next"]'),
    ).toBeDisabled();
  });
  it.each(["empty", "noResult"])(
    "preserves the existing %s table behavior",
    (state) => {
      const { container } = mountTable(1, 0, { [state]: true, rows: [] });
      expect(container.querySelector(".rpt08-pagination")).toBeNull();
      expect(container.querySelector(".rpt08-table-empty")).not.toBeNull();
    },
  );
  it("keeps row details and search callbacks unchanged", () => {
    const { container, onOpenRow, onSearch } = mountTable();
    fireEvent.click(container.querySelector(".rpt08-view-button")!);
    expect(onOpenRow).toHaveBeenCalledWith(rows[0]);
    fireEvent.change(container.querySelector(".rpt08-search-box input")!, {
      target: { value: "PN-001" },
    });
    expect(onSearch).toHaveBeenCalledWith("PN-001");
  });
  it("keeps the shared pagination labels in English", async () => {
    await ensureEnglishMessages();
    useLanguageStore.setState({ language: "en" });
    const { container } = mountTable();
    for (const button of container.querySelectorAll("[data-page-direction]")) {
      expect(button.getAttribute("aria-label")).toBeTruthy();
      expect(button.getAttribute("aria-label")).not.toMatch(/[À-ỹ]/u);
    }
  });
});
