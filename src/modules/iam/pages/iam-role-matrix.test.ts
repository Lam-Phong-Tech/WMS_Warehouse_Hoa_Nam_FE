import { describe, expect, it } from "vitest";
import type { IamPermission } from "../types/iam.types";
import {
  buildPermissionMatrix,
  changeGroupPermissions,
  changedPermissionIds,
  canChangePermission,
} from "./iam-role-matrix";

const permission = (
  key: string,
  extra: Partial<IamPermission> = {},
): IamPermission => ({
  permission_id: key,
  permission_key: key,
  permission_name: key,
  status: "ACTIVE",
  ...extra,
});

describe("IAM role matrix contracts", () => {
  it("keeps every active action, including nested resources and unfamiliar operations", () => {
    const permissions = [
      permission("inbound.view"),
      permission("inbound.post"),
      permission("outbound.request.manual_create"),
      permission("iam.role.manage"),
      permission("old.view", { status: "INACTIVE" }),
    ];
    const matrix = buildPermissionMatrix(permissions);
    expect(
      matrix.flatMap((group) =>
        group.resources.flatMap((resource) => resource.permissions),
      ),
    ).toHaveLength(4);
    expect(
      matrix
        .flatMap((group) => group.resources)
        .find((resource) => resource.key === "outbound.request")?.permissions[0]
        .permission_key,
    ).toBe("outbound.request.manual_create");
  });
  it("bulk selection preserves locked existing assignments and never adds retired, inactive or undelegatable permissions", () => {
    const permissions = [
      permission("inbound.view"),
      permission("iam.role.manage"),
      permission("legacy.manage", { is_enforced: false }),
      permission("inactive.view", { status: "INACTIVE" }),
    ];
    const allowed = (p: IamPermission) =>
      canChangePermission(p, false, ["inbound.view"]);
    expect(
      changeGroupPermissions(["iam.role.manage"], permissions, true, allowed),
    ).toEqual(["iam.role.manage", "inbound.view"]);
    expect(
      changeGroupPermissions(
        ["inbound.view", "iam.role.manage"],
        permissions,
        false,
        allowed,
      ),
    ).toEqual(["iam.role.manage"]);
  });
  it("super administrators may delegate active enforced permissions only", () => {
    expect(canChangePermission(permission("iam.role.manage"), true, [])).toBe(
      true,
    );
    expect(
      canChangePermission(
        permission("old.view", { is_enforced: false }),
        true,
        [],
      ),
    ).toBe(false);
    expect(
      canChangePermission(
        permission("inactive.view", { status: "INACTIVE" }),
        true,
        [],
      ),
    ).toBe(false);
  });
  it("counts actual additions and removals independently of order or duplicate ids", () => {
    expect(changedPermissionIds(["a", "b", "a"], ["b", "c"])).toEqual([
      "a",
      "c",
    ]);
    expect(changedPermissionIds(["b", "a"], ["a", "b"])).toEqual([]);
  });
});
