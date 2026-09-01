/**
 * `stateBox()` của demo: khối trạng thái dùng chung cho MỌI widget khi không có
 * dữ liệu — giữ đúng chiều cao để bố cục không nhảy khi đổi trạng thái.
 */
import { DashIcon } from "../components/DashIcon";
import type { DashboardIconName } from "../components/DashIcon";

export type StateKind =
  | "loading"
  | "empty"
  | "unavailable"
  | "forbidden"
  | "retrying"
  | "info";

const STATE_ICON: Record<StateKind, DashboardIconName> = {
  loading: "loader-circle",
  empty: "inbox",
  unavailable: "triangle-alert",
  forbidden: "lock",
  retrying: "refresh-cw",
  info: "info",
};

export function OverviewStateBox({
  kind,
  title,
  copy,
}: {
  kind: StateKind;
  title: string;
  copy: string;
}) {
  const busy = kind === "loading" || kind === "retrying";
  return (
    <div
      className={`state-box ${busy ? "is-busy" : ""}`}
      role="status"
      aria-busy={busy || undefined}
    >
      <span className="state-icon" aria-hidden="true">
        <DashIcon name={STATE_ICON[kind]} />
      </span>
      <strong>{title}</strong>
      <span>{copy}</span>
    </div>
  );
}
