import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useLanguageStore, ensureEnglishMessages } from "@/shared/i18n";
import { BoxReadDetailDialog } from "./BoxReadDetailDialog";

vi.mock("../hooks/use-inventory", () => ({
  useBoxReadProjection: () => ({
    data: {
      container_code: "BOX-01",
      sku: null,
      status: "ACTIVE",
      contained_qty: null,
      location_hint: "Vị trí người dùng",
      parent_container_id: "TRAY-01",
    },
    isLoading: false,
    isError: false,
  }),
  useContainerRegisterDetail: () => ({
    data: {
      container_type: "TRAY",
      container_code: "TRAY-01",
      status: "ACTIVE",
      location_hint: null,
    },
    isLoading: false,
    isError: false,
  }),
}));
afterEach(() => {
  cleanup();
  useLanguageStore.getState().setLanguage("vi");
});
it("updates BOX labels, fallbacks and linked tray details when switching to English", async () => {
  render(
    <BoxReadDetailDialog
      containerId="box-1"
      warehouseId="w1"
      code="BOX-01"
      onClose={vi.fn()}
    />,
  );
  await act(async () => {
    useLanguageStore.getState().setLanguage("en");
    await ensureEnglishMessages();
  });
  expect(
    screen.getByRole("dialog", { name: "Details for BOX-01" }),
  ).toBeInTheDocument();
  expect(screen.getByText("Unassigned")).toBeInTheDocument();
  expect(screen.getByText("Not recorded")).toBeInTheDocument();
  expect(screen.getByText("Vị trí người dùng")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "View linked tray" }));
  expect(
    screen.getByRole("heading", { name: "Tray register details" }),
  ).toBeInTheDocument();
  expect(screen.getByText("Not available")).toBeInTheDocument();
});
