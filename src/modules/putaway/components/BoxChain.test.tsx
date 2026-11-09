import { afterEach, describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import { cleanupTestState } from "@/test/setup";
import type {
  PutawayTask,
  TrayOption,
} from "../services/putawayService";
import { BoxChain } from "./BoxChain";

const box = (id: number, overrides: Partial<PutawayTask> = {}): PutawayTask => ({
  id: `TASK-${id}`,
  box_container_id: `container-${id}`,
  box_code: `BOX-${String(id).padStart(2, "0")}`,
  sku_id: `SKU-${id}`,
  sku_code: `LK-${id}`,
  sku_name: `Linh kiện ${id}`,
  quantity: id * 10,
  receipt_code: `PN-0${id}`,
  status: "RECEIVED_PENDING_PUTAWAY",
  container_version: 1,
  ...overrides,
});

const tray: TrayOption = {
  container_id: "tray-1",
  container_code: "TRAY-A-01",
  status: "EMPTY",
  version: 1,
};

afterEach(cleanupTestState);

describe("BoxChain", () => {
  it("shows each box, its transfer data and the destination tray in order", () => {
    renderWithProviders(
      <BoxChain boxes={[box(1), box(2)]} selectedTray={tray} />,
    );

    expect(
      screen.getByRole("list", { name: "Luồng xếp các hộp vào khay" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Hộp 1")).toBeInTheDocument();
    expect(screen.getByText("Hộp 2")).toBeInTheDocument();
    expect(screen.getByText("BOX-01")).toBeInTheDocument();
    expect(screen.getByText("BOX-02")).toBeInTheDocument();
    expect(screen.getByText("PN-01")).toBeInTheDocument();
    expect(screen.getByText("PN-02")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("20")).toBeInTheDocument();
    expect(screen.getByText("Khay đích")).toBeInTheDocument();
    expect(screen.getByText("TRAY-A-01")).toBeInTheDocument();
  });

  it("marks the destination as not chosen until a tray is selected", () => {
    renderWithProviders(<BoxChain boxes={[box(1)]} selectedTray={null} />);
    expect(screen.getByText("Chưa chọn")).toBeInTheDocument();
  });
});
