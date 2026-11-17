import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { cleanupTestState } from "@/test/setup";
import { useLanguageStore } from "@/shared/i18n/language.store";
import { ensureEnglishMessages } from "@/shared/i18n/english-messages";
import { ensureChineseMessages } from "@/shared/i18n/chinese-messages";
import { localizeMessage } from "@/shared/i18n/localize-message";
import type { ImportQualityIssue } from "./import-quality-api";

const fixture = vi.hoisted(() => ({
  rows: null as ImportQualityIssue[] | null,
}));

vi.mock("./import-quality-api", () => ({
  useImportQualityIssues: () => ({
    data: {
      rows: fixture.rows ?? [
        {
          rowNo: 32,
          field: "sku_name",
          code: "REQUIRED",
          message: "Thiếu tên SKU",
          rawValue: "",
          severity: "ERROR",
          suggestedAction: "Bổ sung tên trong tệp nguồn.",
        },
        {
          rowNo: 45,
          field: "sku_code",
          code: "DUPLICATE",
          message: "Mã SKU trùng trong tệp",
          rawValue: "HN-DRV-001",
          severity: "WARNING",
          suggestedAction: "Đổi mã SKU bị trùng.",
        },
      ],
      total: 2,
      lastPage: 1,
    },
    isLoading: false,
    error: null,
  }),
}));

import { ImportQualityIssuePanel } from "./ImportQualityIssuePanel";

beforeEach(() => useLanguageStore.getState().setLanguage("vi"));

afterEach(() => {
  fixture.rows = null;
  cleanupTestState();
});

describe("Import quality issue detail", () => {
  it("discloses severity and allows an open issue to collapse", async () => {
    const user = userEvent.setup();
    render(<ImportQualityIssuePanel batchId="batch-1" sourceFile="sku.xlsx" />);
    const row = screen.getByRole("button", { name: /Dòng 32:/ });
    expect(row).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Mức độ")).toBeVisible();
    await user.click(row);
    expect(row).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByRole("region", { name: "Chi tiết dòng 32" }),
    ).not.toBeInTheDocument();
  });
  it.each(["en", "zh"] as const)(
    "localizes server prose in %s summaries, accessible names, details and hints without changing source data",
    async (language) => {
      fixture.rows = ["BRAND", "CATEGORY", "MODEL"].map((kind, index) => ({
        rowNo: index + 2,
        field: `${kind.toLowerCase()}_code`,
        code: `${kind}_NOT_FOUND`,
        message: `Không tìm thấy ${kind} ACTIVE với code 4344SFDFS.`,
        rawValue: "Không tìm thấy BRAND ACTIVE với code 4344SFDFS.",
        severity: "ERROR",
        suggestedAction:
          "Kiểm tra mã danh mục (brand/category/model) đã tồn tại và đang ACTIVE.",
      }));
      await Promise.all([ensureEnglishMessages(), ensureChineseMessages()]);
      const user = userEvent.setup();
      const sourceFile = "Danh mục tiếng Việt.xlsx";
      render(
        <ImportQualityIssuePanel batchId="batch-1" sourceFile={sourceFile} />,
      );
      await act(async () => useLanguageStore.getState().setLanguage(language));
      for (const issue of fixture.rows) {
        const translatedMessage = localizeMessage(issue.message);
        const translatedHint = localizeMessage(issue.suggestedAction);
        expect(translatedMessage).not.toBe(issue.message);
        expect(translatedHint).not.toBe(issue.suggestedAction);
        const rowButton = screen.getByRole("button", {
          name: `${language === "en" ? `Row ${issue.rowNo}: ` : `第 ${issue.rowNo} 行：`}${translatedMessage}`,
        });
        expect(within(rowButton).getByText(translatedMessage)).toBeVisible();
        if (rowButton.getAttribute("aria-expanded") !== "true")
          await user.click(rowButton);
        const detail = screen.getByRole("region", {
          name:
            language === "en"
              ? `Row ${issue.rowNo} details`
              : `第 ${issue.rowNo} 行详情`,
        });
        expect(
          within(detail).getByText(translatedMessage, { selector: "strong" }),
        ).toBeVisible();
        expect(within(detail).getByText(translatedHint)).toBeVisible();
        expect(within(detail).getByText(issue.rawValue)).toBeVisible();
        expect(within(detail).getByText(issue.field)).toBeVisible();
        expect(within(detail).getByText(issue.code)).toBeVisible();
        expect(detail).toHaveTextContent(sourceFile);
      }
    },
  );

  it("shows source rows and changes the detail panel with the selected issue", async () => {
    const user = userEvent.setup();
    render(
      <ImportQualityIssuePanel
        batchId="batch-1"
        sourceFile="danh-muc-sku.xlsx"
      />,
    );
    expect(screen.getByText("Dòng 32")).toBeInTheDocument();
    expect(screen.getByText("Dòng 45")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Chi tiết dòng cần kiểm tra" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Bổ sung tên trong tệp nguồn."),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Dòng 45/ }));
    expect(screen.getByText("Đổi mã SKU bị trùng.")).toBeInTheDocument();
    expect(screen.getByText("HN-DRV-001")).toBeInTheDocument();
  });
});
