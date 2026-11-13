import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import { cleanupTestState } from "@/test/setup";

const mocks = vi.hoisted(() => ({ users: vi.fn(), logs: vi.fn() }));
vi.mock("@/modules/iam/hooks/use-iam", () => ({ useIamUsers: mocks.users }));
vi.mock("@/modules/audit-logs/hooks/use-audit-logs", () => ({
  useAuditLogs: mocks.logs,
}));
import { AuditLogsPage } from "./AuditLogsPage";

describe("audit actor server lookup", () => {
  afterEach(cleanupTestState);

  it("searches beyond the initial result page and retains a selected actor outside later results", async () => {
    mocks.logs.mockReturnValue({ data: { data: [], meta: { total: 0 } } });
    mocks.users.mockImplementation((params) => ({
      data: {
        data:
          params.keyword === "later@example.com"
            ? [
                {
                  user_id: "later",
                  display_name: "Later actor",
                  email: "later@example.com",
                },
              ]
            : [],
        meta: { total: 1 },
      },
      isFetching: false,
    }));
    renderWithProviders(<AuditLogsPage />);
    fireEvent.click(screen.getByRole("button", { name: "Bộ lọc" }));
    const picker = screen.getByRole("combobox", {
      name: "Lọc theo người thực hiện",
    });
    fireEvent.change(picker, { target: { value: "later@example.com" } });
    await waitFor(() =>
      expect(mocks.users).toHaveBeenLastCalledWith({
        keyword: "later@example.com",
        page: 1,
        per_page: 20,
      }),
    );
    fireEvent.keyDown(picker, { key: "ArrowDown" });
    fireEvent.click(
      await screen.findByRole("option", {
        name: "Later actor (later@example.com)",
      }),
    );
    expect(mocks.logs).toHaveBeenLastCalledWith(
      expect.objectContaining({ user_id: "later" }),
    );
    fireEvent.change(picker, { target: { value: "absent" } });
    await waitFor(() =>
      expect(mocks.users).toHaveBeenLastCalledWith({
        keyword: "absent",
        page: 1,
        per_page: 20,
      }),
    );
    expect(mocks.logs).toHaveBeenLastCalledWith(
      expect.objectContaining({ user_id: "later" }),
    );
    fireEvent.blur(picker);
    expect(picker).toHaveValue("Later actor (later@example.com)");
  });
});
