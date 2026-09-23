import { ActionButton, type ActionButtonProps } from "./ActionButton";
import { ACTION_KINDS } from "./action-kinds";

export type RowActionButtonProps = Omit<ActionButtonProps, "icon" | "endIcon">;

/** SKU-style table action: a text link for viewing, canonical icons for other actions. */
export function RowActionButton({
  kind,
  label,
  children,
  iconOnly,
  className,
  title,
  loading,
  "aria-label": ariaLabel,
  ...props
}: RowActionButtonProps) {
  const text = label ?? children ?? ACTION_KINDS[kind].label;
  const isIconOnly = iconOnly ?? (kind !== "view" && kind !== "detail");
  const isView = !isIconOnly && (kind === "view" || kind === "detail");
  const accessibleLabel =
    ariaLabel ?? (typeof text === "string" ? text : ACTION_KINDS[kind].label);

  return (
    <ActionButton
      {...props}
      kind={kind}
      label={text}
      iconOnly={isIconOnly}
      loading={loading}
      className={["hn-row-action", className].filter(Boolean).join(" ")}
      data-row-action={isView ? "view" : isIconOnly ? "icon" : "label"}
      aria-label={accessibleLabel}
      title={title ?? accessibleLabel}
      endIcon={
        isView && !loading ? <span aria-hidden="true">›</span> : undefined
      }
    />
  );
}
