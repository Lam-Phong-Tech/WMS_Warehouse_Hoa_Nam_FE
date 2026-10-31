import { useState, type ReactNode } from "react";
import { Tooltip, UiIcon, UiIconButton } from "@/shared/ui";

/** Help stays hidden until hover, keyboard focus or click (including touch). */
export function NfcInfo({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Tooltip
      title={children}
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      arrow
    >
      <UiIconButton
        aria-label={label}
        aria-expanded={open}
        size="small"
        onClick={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
        }}
      >
        <UiIcon name="info" />
      </UiIconButton>
    </Tooltip>
  );
}
