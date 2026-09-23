import { Stack, type StackProps } from "@mui/material";

export type RowActionGroupProps = Omit<StackProps, "direction" | "spacing">;

/** Compact, unwrapped row actions matching the SKU list. */
export function RowActionGroup({ className, ...props }: RowActionGroupProps) {
  return (
    <Stack
      {...props}
      direction="row"
      className={["hn-row-actions", className].filter(Boolean).join(" ")}
    />
  );
}
