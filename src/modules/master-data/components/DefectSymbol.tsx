import type { ReactNode } from "react";

type SymbolName =
  | "clipboard"
  | "warehouse"
  | "plus"
  | "edit"
  | "refresh"
  | "search"
  | "close"
  | "filter"
  | "eye"
  | "info";
export function DefectSymbol({
  name,
  className = "",
}: {
  name: SymbolName;
  className?: string;
}) {
  const shapes: Record<SymbolName, ReactNode> = {
    clipboard: (
      <>
        <rect x="5" y="4" width="14" height="18" rx="2" />
        <rect x="9" y="2" width="6" height="4" rx="1" />
        <path d="M8 10h.01M11 10h5M8 14h.01M11 14h5M8 18h.01M11 18h5" />
      </>
    ),
    warehouse: (
      <>
        <path d="m3 8 9-5 9 5v13H3Z" />
        <path d="M6 21V10h12v11M9 13h6m-6 4h6" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    edit: (
      <>
        <path d="m15 4 5 5M4 20l5-1L21 7a2 2 0 0 0-5-5L4 14Z" />
      </>
    ),
    refresh: (
      <>
        <path d="M20 7a9 9 0 0 0-15-2L2 9m0-6v6h6M4 17a9 9 0 0 0 15 2l3-4m0 6v-6h-6" />
      </>
    ),
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="7.5" />
        <path d="m16 16 5 5" />
      </>
    ),
    close: <path d="m6 6 12 12M18 6 6 18" />,
    filter: <path d="M3 4h18l-7 8v8l-4-2v-6Z" />,
    eye: (
      <>
        <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    info: (
      <>
        <circle cx="12" cy="12" r="9.5" />
        <path d="M12 11v6m0-10v.1" />
      </>
    ),
  };
  return (
    <svg
      className={`hn-defect-symbol ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {shapes[name]}
    </svg>
  );
}
