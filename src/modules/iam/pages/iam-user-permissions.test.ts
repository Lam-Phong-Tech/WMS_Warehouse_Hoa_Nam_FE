import { describe, expect, it } from "vitest";
import { applicableIamRoles } from "./iam-user-permissions";
import type { IamRole } from "@/modules/iam/types/iam.types";
const base: IamRole = {
  role_id: "r",
  role_code: "R",
  role_name: "Role",
  status: "ACTIVE",
};
describe("IAM permission source preview", () => {
  it("excludes expired, future, inactive and malformed assignments", () => {
    const roles: IamRole[] = [
      base,
      { ...base, role_id: "expired", pivot: { effective_to: "2026-11-03" } },
      { ...base, role_id: "future", pivot: { effective_from: "2026-11-05" } },
      { ...base, role_id: "inactive", status: "INACTIVE" },
      { ...base, role_id: "bad", pivot: { effective_to: "invalid" } },
    ];
    expect(
      applicableIamRoles(
        roles,
        [],
        Date.parse("2026-11-04T12:00:00+07:00"),
      ).map((role) => role.role_id),
    ).toEqual(["r"]);
  });
  it("keeps a date-only assignment through the Vietnam end of day", () => {
    const role = {
      ...base,
      pivot: { effective_from: "2026-11-04", effective_to: "2026-11-04" },
    };
    expect(
      applicableIamRoles([role], [], Date.parse("2026-11-04T23:59:59+07:00")),
    ).toHaveLength(1);
    expect(
      applicableIamRoles([role], [], Date.parse("2026-11-05T00:00:00+07:00")),
    ).toHaveLength(0);
  });
  it("uses latest catalog status and preserves assignment scope metadata", () => {
    const role = { ...base, pivot: { scope_ref: "warehouse-1" } };
    expect(
      applicableIamRoles([role], [{ ...base, status: "INACTIVE" }]),
    ).toEqual([]);
    expect(applicableIamRoles([role], [base])[0].pivot?.scope_ref).toBe(
      "warehouse-1",
    );
  });
});
