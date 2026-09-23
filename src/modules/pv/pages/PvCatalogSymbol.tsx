/** Line symbols from the supplied catalog reference; purely decorative. */
export function PvCatalogSymbol({
  name,
}: {
  name: "grid" | "eye" | "eye-off" | "image" | "info";
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {name === "grid" && (
        <>
          <rect x="3" y="3" width="6" height="6" rx="1" />
          <rect x="15" y="3" width="6" height="6" rx="1" />
          <rect x="3" y="15" width="6" height="6" rx="1" />
          <rect x="15" y="15" width="6" height="6" rx="1" />
        </>
      )}
      {(name === "eye" || name === "eye-off") && (
        <>
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
          <circle cx="12" cy="12" r="3" />
          {name === "eye-off" && <path d="m3 3 18 18" />}
        </>
      )}
      {name === "image" && (
        <>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8" cy="8" r="1" />
          <path d="m3 17 5-5 4 4 4-7 5 8" />
        </>
      )}
      {name === "info" && (
        <>
          <circle cx="12" cy="12" r="10" fill="currentColor" stroke="none" />
          <path
            d="M12 11v6M12 7h.01"
            stroke="var(--wms-on-primary)"
            strokeWidth="2"
          />
        </>
      )}
    </svg>
  );
}
