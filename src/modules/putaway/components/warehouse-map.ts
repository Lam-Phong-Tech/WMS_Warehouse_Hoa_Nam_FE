/**
 * Bố cục mặt bằng kho cho trang Tổng quan khay — bản dịch thuần của
 * `buildWarehouseSvg` trong mockup UIUX_V2: 5 ngăn mỗi rack, mỗi khu một rack,
 * khu trên 5 khay sinh rack thứ hai cùng nhãn. Dữ liệu thật lấy từ API; vị trí
 * chỉ là minh họa (không phải sơ đồ vị trí thực).
 */
import type { TrayOption } from "@/modules/putaway/services/putawayService";

export type TrayBucket = "EMPTY" | "PARTIAL" | "ATTENTION";

/** Trạng thái khay thật → 3 nhóm hiển thị; còn lại (CLOSED/ISSUED…) gom vào
 *  "Cần chú ý" để người quản lý rà nhanh. */
export function bucketOfStatus(status: string | null | undefined): TrayBucket {
  const normalized = (status ?? "").trim().toUpperCase();
  if (normalized === "EMPTY") return "EMPTY";
  if (normalized === "PARTIAL") return "PARTIAL";
  return "ATTENTION";
}

export interface WarehouseSlot {
  index: number;
  tray: TrayOption | null;
}

export interface WarehouseRack {
  zone: string;
  label: string;
  y: number;
  slots: WarehouseSlot[];
}

export interface WarehouseLayout {
  racks: WarehouseRack[];
  unassigned: TrayOption[];
  /** `0 0 1440 H` theo viewBox cuối cùng. */
  viewBox: string;
  /** H / 1440 — dùng để đồng bộ `height` của viewport khi cuộn/zoom. */
  aspect: number;
}

export const VIEW_W = 1440;
export const TRAY_PITCH = 242;
export const BAYS = 5;
const RACK_WIDTH = BAYS * TRAY_PITCH + 18;
const RACK_X = (VIEW_W - RACK_WIDTH) / 2;
const TOP0 = 100;
const RACK_PITCH = 325;
/** Khoảng trống dọc của một rack + lối đi. */
const RACK_END = 288;

export function rackOriginX(): number {
  return RACK_X;
}

export function buildWarehouseLayout(
  trays: readonly TrayOption[],
): WarehouseLayout {
  const grouped = new Map<string, TrayOption[]>();
  const unassigned: TrayOption[] = [];
  for (const tray of trays) {
    const zone = tray.zone_code?.trim() ?? "";
    if (!zone) {
      unassigned.push(tray);
      continue;
    }
    const bucket = grouped.get(zone);
    if (bucket) bucket.push(tray);
    else grouped.set(zone, [tray]);
  }

  const zones = [...grouped.keys()].sort((a, b) =>
    a.localeCompare(b, "vi", { numeric: true }),
  );

  const racks: WarehouseRack[] = [];
  let y = TOP0;
  for (const zone of zones) {
    const zoneTrays = grouped.get(zone) ?? [];
    for (let offset = 0; offset < zoneTrays.length; offset += BAYS) {
      const chunk = zoneTrays.slice(offset, offset + BAYS);
      racks.push({
        zone,
        label: zone,
        y,
        slots: Array.from({ length: BAYS }, (_, index) => ({
          index,
          tray: chunk[index] ?? null,
        })),
      });
      y += RACK_PITCH;
    }
  }

  const height =
    racks.length === 0 ? TOP0 + RACK_END : racks[racks.length - 1].y + RACK_END;
  return {
    racks,
    unassigned,
    viewBox: `0 0 ${VIEW_W} ${height}`,
    aspect: height / VIEW_W,
  };
}
