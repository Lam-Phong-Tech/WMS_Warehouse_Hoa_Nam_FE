import { useEffect, useRef, useState } from "react";
import { Tooltip } from "@/shared/ui";
import { PvCatalogSymbol } from "./PvCatalogSymbol";

type PvCatalogOverviewInfoProps = {
  label: string;
  scopeText: string;
  stockText: string;
};

export function PvCatalogOverviewInfo({
  label,
  scopeText,
  stockText,
}: PvCatalogOverviewInfoProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const touchPointerRef = useRef(false);

  useEffect(() => {
    if (!open) return;

    const closeOutside = (event: PointerEvent) => {
      if (!buttonRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <Tooltip
      title={
        <span className="pv-catalog-overview-tooltip">
          <span>{scopeText}</span>
          <span>{stockText}</span>
        </span>
      }
      placement="top"
      open={open}
      describeChild
      disableHoverListener
      disableFocusListener
      disableTouchListener
    >
      <button
        ref={buttonRef}
        type="button"
        className="pv-catalog-overview-help"
        aria-label={label}
        aria-expanded={open}
        onPointerEnter={(event) => {
          if (event.pointerType === "mouse") setOpen(true);
        }}
        onPointerLeave={(event) => {
          if (event.pointerType === "mouse") setOpen(false);
        }}
        onPointerDown={(event) => {
          touchPointerRef.current = event.pointerType !== "mouse";
        }}
        onFocus={() => {
          if (!touchPointerRef.current) setOpen(true);
        }}
        onBlur={() => setOpen(false)}
        onClick={(event) => {
          if (touchPointerRef.current) setOpen((current) => !current);
          else if (event.detail === 0) setOpen(true);
          touchPointerRef.current = false;
        }}
      >
        <PvCatalogSymbol name="info" />
      </button>
    </Tooltip>
  );
}
