import type { IamRole } from "@/modules/iam/types/iam.types";

/** Preview only: route/scope authorization remains on the server. */
export function applicableIamRoles(
  assigned: IamRole[],
  catalog: IamRole[],
  now = Date.now(),
): IamRole[] {
  return assigned.filter((role) => {
    const current =
      catalog.find((item) => item.role_id === role.role_id) ?? role;
    if (current.status !== "ACTIVE") return false;
    const from = role.pivot?.effective_from;
    const to = role.pivot?.effective_to;
    // Date-only assignments use Vietnam business-day boundaries, as the form does.
    const start = from
      ? Date.parse(from.length === 10 ? `${from}T00:00:00+07:00` : from)
      : null;
    const end = to
      ? Date.parse(to.length === 10 ? `${to}T23:59:59.999+07:00` : to)
      : null;
    if (start !== null && (!Number.isFinite(start) || start > now))
      return false;
    if (end !== null && (!Number.isFinite(end) || end < now)) return false;
    return true;
  });
}
