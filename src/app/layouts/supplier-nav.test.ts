import { describe, expect, it } from "vitest";
import {
  NAV_GROUPS,
  canAccessPath,
  getBreadcrumbTrail,
  resolveScreenMeta,
} from "./nav-data";
import { ROUTES } from "@/shared/constants/routes";

describe("supplier directory navigation", () => {
  it("is a child of Danh mục and resolves breadcrumbs and title", () => {
    expect(
      NAV_GROUPS.find((group) => group.name === "Danh mục")?.items,
    ).toContainEqual(
      expect.objectContaining({
        path: ROUTES.SUPPLIERS,
        label: "Danh sách NCC",
      }),
    );
    expect(
      getBreadcrumbTrail(ROUTES.SUPPLIERS).map((part) => part.label),
    ).toEqual(["Trang chủ", "Danh mục", "Danh sách NCC"]);
    expect(resolveScreenMeta(ROUTES.SUPPLIERS, "").title).toBe("Danh sách NCC");
  });
  it("requires the directory read permission rather than just catalog write permission", () => {
    expect(canAccessPath(ROUTES.SUPPLIERS, ["supplier.view"], false)).toBe(
      true,
    );
    expect(canAccessPath(ROUTES.SUPPLIERS, ["catalog.manage"], false)).toBe(
      false,
    );
    expect(canAccessPath(ROUTES.SUPPLIERS, [], true)).toBe(true);
  });
});
