import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { TrayOption } from "@/modules/putaway/services/putawayService";
import { buildWarehouseLayout, bucketOfStatus } from "./warehouse-map";
import { WarehouseMap } from "./WarehouseMap";

const TRAYS: TrayOption[] = [
  {
    container_id: "a1",
    container_code: "TRAY-A1",
    status: "EMPTY",
    zone_code: "ZONE-A",
    location_hint: "Kệ 01",
    version: 1,
  },
  {
    container_id: "a2",
    container_code: "TRAY-A2",
    status: "PARTIAL",
    zone_code: "ZONE-A",
    location_hint: "Khay A-02",
    version: 1,
  },
  {
    container_id: "b1",
    container_code: "TRAY-B1",
    status: "CLOSED",
    zone_code: "ZONE-B",
    location_hint: "Kệ 02",
    version: 1,
  },
  {
    container_id: "x1",
    container_code: "TRAY-XXX",
    status: "EMPTY",
    zone_code: null,
    location_hint: "Khu mẫu",
    version: 1,
  },
];

describe("bucketOfStatus", () => {
  it("maps EMPTY/PARTIAL and everything else to ATTENTION", () => {
    expect(bucketOfStatus("EMPTY")).toBe("EMPTY");
    expect(bucketOfStatus("partial")).toBe("PARTIAL");
    expect(bucketOfStatus("CLOSED")).toBe("ATTENTION");
    expect(bucketOfStatus("SOME_UNKNOWN_STATUS")).toBe("ATTENTION");
  });
});

describe("buildWarehouseLayout", () => {
  it("groups trays by zone, keeps placeholders, and pulls unassigned trays out", () => {
    const layout = buildWarehouseLayout(TRAYS);
    expect(layout.racks.map((rack) => rack.zone)).toEqual(["ZONE-A", "ZONE-B"]);
    expect(layout.unassigned.map((tray) => tray.container_id)).toEqual(["x1"]);
    expect(layout.racks[0].slots).toHaveLength(5);
    expect(
      layout.racks[0].slots.filter((slot) => slot.tray === null),
    ).toHaveLength(3);
    expect(layout.aspect).toBeGreaterThan(0);
    expect(layout.viewBox).toMatch(/^0 0 1440 \d+$/);
  });

  it("spills a second rack for a zone with more than five trays", () => {
    const many: TrayOption[] = Array.from({ length: 7 }, (_, index) => ({
      container_id: `m${index}`,
      container_code: `TRAY-M${index}`,
      status: "PARTIAL",
      zone_code: "ZONE-X",
      location_hint: `Vị trí ${index}`,
      version: 1,
    }));
    const layout = buildWarehouseLayout(many);
    expect(layout.racks).toHaveLength(2);
    expect(layout.racks.every((rack) => rack.zone === "ZONE-X")).toBe(true);
    expect(layout.racks.flatMap((rack) => rack.slots)).toHaveLength(10);
  });

  it("keeps empty zones out of the rack list", () => {
    expect(buildWarehouseLayout([])).toEqual(
      expect.objectContaining({ racks: [], unassigned: [] }),
    );
  });
});

describe("WarehouseMap", () => {
  it("renders filled trays as focusable cells and keeps unassigned trays out of the SVG", () => {
    const layout = buildWarehouseLayout(TRAYS);
    render(
      <WarehouseMap
        layout={layout}
        dimmedIds={new Set()}
        selectedId={null}
        onSelect={() => {}}
      />,
    );

    expect(screen.getAllByTestId("ptw-tray-cell")).toHaveLength(3);
    expect(screen.queryByText("TRAY-XXX")).toBeNull();
    expect(screen.getByText("ZONE-A")).toBeInTheDocument();
    expect(screen.getByText("ZONE-B")).toBeInTheDocument();
    const zoneA = document.querySelector('[data-rack="ZONE-A"]');
    expect(zoneA).not.toBeNull();
    expect(
      within(zoneA as unknown as HTMLElement).getByLabelText(
        "Vị trí 03, Chưa gán khay",
      ),
    ).toBeInTheDocument();
  });

  it("emits onSelect for the clicked tray and keyboard activation", async () => {
    const onSelect = vi.fn();
    const layout = buildWarehouseLayout(TRAYS);
    render(
      <WarehouseMap
        layout={layout}
        dimmedIds={new Set()}
        selectedId={null}
        onSelect={onSelect}
      />,
    );

    const cellA1 = screen
      .getAllByTestId("ptw-tray-cell")
      .find((node) => node.textContent?.includes("TRAY-A1"));
    expect(cellA1).toBeDefined();
    await userEvent.click(cellA1 as Element);
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ container_id: "a1" }),
    );
  });

  it("dims non-matching trays beyond interaction", () => {
    const layout = buildWarehouseLayout(TRAYS);
    render(
      <WarehouseMap
        layout={layout}
        dimmedIds={new Set(["a1"])}
        selectedId="b1"
        onSelect={() => {}}
      />,
    );

    const [cellA1, cellA2, cellB1] = screen.getAllByTestId("ptw-tray-cell");
    expect(cellA1).toHaveClass("is-dimmed");
    expect(cellA1).toHaveAttribute("aria-disabled", "true");
    expect(cellA1).toHaveAttribute("tabindex", "-1");
    expect(cellA2).not.toHaveClass("is-dimmed");
    expect(cellB1).toHaveClass("is-selected");
  });
});
