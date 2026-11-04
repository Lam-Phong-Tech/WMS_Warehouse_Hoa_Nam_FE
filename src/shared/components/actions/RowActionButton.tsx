import { ActionButton, type ActionButtonProps } from "./ActionButton";
import { ACTION_KINDS } from "./action-kinds";
import { UiIcon } from "@/shared/ui/components/UiIcon";

export type RowActionButtonProps = Omit<ActionButtonProps, "icon" | "endIcon">;

/** SKU-style detail arrow; accessible labels stay available without visible text. */
export function RowActionButton({
  kind,
  label,
  children,
  iconOnly,
  className,
  title,
  loading,
  sx,
  appearance,
  "aria-label": ariaLabel,
  ...props
}: RowActionButtonProps) {
  const text = label ?? children ?? ACTION_KINDS[kind].label;
  const isView = kind === "view" || kind === "detail";
  const isIconOnly = isView || (iconOnly ?? true);
  const accessibleLabel =
    ariaLabel ?? (typeof text === "string" ? text : ACTION_KINDS[kind].label);

  return (
    <ActionButton
      {...props}
      kind={kind}
      label={text}
      iconOnly={isIconOnly}
      loading={loading}
      appearance={isView ? "flat" : appearance}
      icon={isView ? <UiIcon name="arrow-right" /> : undefined}
      className={["hn-row-action", className].filter(Boolean).join(" ")}
      data-row-action={isView ? "view" : isIconOnly ? "icon" : "label"}
      aria-label={accessibleLabel}
      title={title ?? accessibleLabel}
      sx={
        isView
          ? [
              ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
              {
                width: 40,
                minWidth: 40,
                height: 40,
                p: 0,
                color: "var(--ops-link)",
                backgroundColor: "transparent",
                border: 0,
                borderRadius: "var(--ops-radius-control)",
                "&:hover": { backgroundColor: "var(--ops-pale)" },
                "&.Mui-focusVisible": {
                  outline: "2px solid var(--ops-link)",
                  outlineOffset: 2,
                },
                "&.Mui-disabled": {
                  color: "text.disabled",
                  backgroundColor: "transparent",
                },
                "@media (pointer: coarse)": {
                  width: 44,
                  minWidth: 44,
                  height: 44,
                },
              },
            ]
          : sx
      }
    />
  );
}
