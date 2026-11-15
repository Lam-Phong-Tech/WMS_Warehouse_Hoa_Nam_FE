import { act, cleanup, screen } from "@testing-library/react";
import { afterEach } from "vitest";
import { useLanguageStore } from "@/shared/i18n/language.store";
import { ensureEnglishMessages } from "@/shared/i18n/english-messages";
import { ensureChineseMessages } from "@/shared/i18n/chinese-messages";
import { localizeMessage } from "@/shared/i18n/localize-message";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/test-utils";
import { RecipientReturnPanel } from "./RecipientReturnPanel";

describe("RecipientReturnPanel", () => {
  afterEach(() => {
    cleanup();
    useLanguageStore.getState().setLanguage("vi");
  });
  it.each(["en", "zh"] as const)(
    "localizes cached server errors in %s while preserving recipient names",
    async (language) => {
      const message = "Không tìm thấy MODEL ACTIVE với code 4344SFDFS.";
      renderWithProviders(
        <RecipientReturnPanel
          recipientName={message}
          events={[]}
          reversalRows={[]}
          loading={false}
          error={new Error(message)}
          onRetry={vi.fn()}
        />,
      );
      await act(async () => {
        await Promise.all([ensureEnglishMessages(), ensureChineseMessages()]);
        useLanguageStore.getState().setLanguage(language);
      });
      expect(screen.getByRole("alert")).toHaveTextContent(
        localizeMessage(message),
      );
      expect(screen.getByRole("alert")).not.toHaveTextContent(message);
      expect(screen.getByRole("heading", { name: message })).toBeVisible();
    },
  );
  it("shows canonical return document linked to its outbound source and reconciled totals", () => {
    renderWithProviders(
      <RecipientReturnPanel
        recipientName="Đại lý Minh Anh"
        events={[
          {
            event_type: "ISSUE_POSTED",
            outbound_document_id: "out-1",
            outbound_no: "PX-001",
            occurred_at: "2026-10-24",
            quantity: 5,
          },
        ]}
        reversalRows={[
          {
            id: "rv-1",
            reversal_code: "RV-001",
            reference_document_id: "out-1",
            status: "POSTED",
            total_qty: 2,
            posted_at: "2026-10-28",
          },
        ]}
        loading={false}
        error={null}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByText("RV-001")).toBeInTheDocument();
    expect(screen.getAllByText("PX-001").length).toBeGreaterThan(0);
    expect(screen.getByTestId("return-net-total")).toHaveTextContent("3");
  });
});
