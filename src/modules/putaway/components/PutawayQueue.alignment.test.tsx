import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { renderWithProviders } from "@/test/test-utils";
import { cleanupTestState } from "@/test/setup";
import { useAuthStore } from "@/shared/store/auth.store";
import type { PutawayTask } from "../services/putawayService";
import { PutawayQueue } from "./PutawayQueue";

// Keep the real RowActionGroup and MUI Stack: a mock would miss the MUI 9
// regression where justifyContent is forwarded as an attribute, not CSS.
const task: PutawayTask = {
  id: "alignment-test-box",
  box_container_id: "alignment-test-box",
  box_code: "ALIGNMENT-TEST-BOX",
  sku_id: "alignment-test-sku",
  sku_code: "ALIGNMENT-TEST-SKU",
  sku_name: "Alignment test component",
  quantity: 1,
  status: "RECEIVED_PENDING_PUTAWAY",
  container_version: 1,
};

function renderQueue(
  overrides: Partial<ComponentProps<typeof PutawayQueue>> = {},
) {
  const props: ComponentProps<typeof PutawayQueue> = {
    tasks: [task],
    orders: false,
    loading: false,
    refreshing: false,
    error: null,
    canManage: true,
    search: "",
    onSearch: vi.fn(),
    onApplySearch: vi.fn(),
    onRefresh: vi.fn(),
    onView: vi.fn(),
    onCreate: vi.fn(),
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  };
  const view = renderWithProviders(
    <div className="hn-mvp-source-screen">
      <div className="putaway-page hn-putaway-page">
        <PutawayQueue {...props} />
      </div>
    </div>,
    ["/putaway?screen=PTW-00"],
  );
  const group = view.container.querySelector<HTMLElement>(
    "tbody td.ptw-action-col > .hn-row-actions",
  );
  if (!group) throw new Error("The putaway action group was not rendered");
  return { ...view, props, group };
}

describe("PTW action alignment with real MUI", () => {
  beforeEach(() => {
    useAuthStore.setState({ isSuperAdmin: true, permissionCodes: [] });
  });
  afterEach(cleanupTestState);

  it.each([true, false])(
    "centers the create action with canManage=%s",
    (canManage) => {
      const { group } = renderQueue({ canManage });
      expect(group).toHaveStyle({ justifyContent: "center", width: "100%" });
      expect(group).not.toHaveAttribute("justifycontent");
      const button = within(group).getByRole("button");
      if (canManage) expect(button).toBeEnabled();
      else expect(button).toBeDisabled();
    },
  );

  it.each([true, false])(
    "centers the draft menu with canManage=%s",
    (canManage) => {
      const { group } = renderQueue({
        orders: true,
        canManage,
        tasks: [{ ...task, draft_id: "alignment-test-draft", draft_version: 1 }],
      });
      expect(group).toHaveStyle({ justifyContent: "center", width: "100%" });
      expect(group).not.toHaveAttribute("justifycontent");
      expect(within(group).getByRole("button")).toBeInTheDocument();
    },
  );

  it("keeps the create callback bound to the selected row", () => {
    const { group, props } = renderQueue();
    fireEvent.click(within(group).getByRole("button"));
    expect(props.onCreate).toHaveBeenCalledExactlyOnceWith(task);
  });
});
