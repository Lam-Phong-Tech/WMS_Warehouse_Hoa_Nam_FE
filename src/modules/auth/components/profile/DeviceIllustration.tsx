import { useId } from "react";

export function DevicePlatformMark({ platform }: { platform: string }) {
  if (/windows/i.test(platform))
    return (
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
        <path
          d="M1 3l6-1v6H1zm7-1.2L15 .5V8H8zM1 9h6v5l-6-1zm7 0h7v6.5L8 14.2z"
          fill="currentColor"
        />
      </svg>
    );
  if (/android/i.test(platform))
    return (
      <svg viewBox="0 0 18 20" width="14" height="16" aria-hidden="true">
        <g fill="currentColor">
          <path d="M3 7h12v8H3zM3 6a6 6 0 0112 0z" />
          <rect x=".5" y="7" width="2" height="7" rx="1" />
          <rect x="15.5" y="7" width="2" height="7" rx="1" />
          <rect x="5" y="14" width="2" height="5" rx="1" />
          <rect x="11" y="14" width="2" height="5" rx="1" />
        </g>
        <path d="M5 2L3.5.5M13 2L14.5.5" stroke="currentColor" />
        <g fill="white">
          <circle cx="6" cy="4" r=".6" />
          <circle cx="12" cy="4" r=".6" />
        </g>
      </svg>
    );
  return null;
}

export function DeviceIllustration({
  kind,
}: {
  kind: "desktop" | "phone" | "tablet";
}) {
  const id = useId().replace(/:/g, "");
  return (
    <svg
      viewBox="0 0 150 100"
      className="hn-device-illustration"
      data-device-kind={kind}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`${id}-bg`} x2="1" y2="1">
          <stop stopColor="#e1f4f6" />
          <stop offset="1" stopColor="#bce4e9" />
        </linearGradient>
        <linearGradient id={`${id}-screen`} x2="1" y2="1">
          <stop stopColor="#a7e8e9" />
          <stop offset=".4" stopColor="#1597b2" />
          <stop offset="1" stopColor="#004b78" />
        </linearGradient>
        <linearGradient id={`${id}-metal`} x2="0" y2="1">
          <stop stopColor="#26758c" />
          <stop offset="1" stopColor="#103e53" />
        </linearGradient>
        <filter id={`${id}-shadow`}>
          <feGaussianBlur stdDeviation="2" />
        </filter>
      </defs>
      <rect width="150" height="100" rx="17" fill={`url(#${id}-bg)`} />
      <ellipse
        cx="77"
        cy="88"
        rx={kind === "phone" ? 23 : 51}
        ry="4"
        fill="#3b899d"
        opacity=".2"
        filter={`url(#${id}-shadow)`}
      />
      {kind === "desktop" ? (
        <>
          <path d="M69 69h13l3 13H66z" fill={`url(#${id}-metal)`} />
          <rect x="36" y="14" width="83" height="58" rx="3" fill="#153e52" />
          <rect
            x="39"
            y="17"
            width="77"
            height="49"
            rx="1"
            fill={`url(#${id}-screen)`}
          />
          <path
            d="M40 62C56 36 74 53 94 18h22v48H40"
            fill="#00628c"
            opacity=".5"
          />
          <path d="M40 51C61 23 78 39 101 18H40z" fill="#8bdee2" opacity=".3" />
          <rect x="36" y="66" width="83" height="6" rx="1" fill="#225c73" />
          <path d="M63 80h25l5 4H58z" fill="#287f99" />
          <path d="M44 87h57l4 5H39z" fill="#327d98" />
          <rect x="109" y="88" width="9" height="5" rx="2.5" fill="#3885a1" />
        </>
      ) : (
        <g
          transform={
            kind === "tablet"
              ? "translate(36 10) skewX(-10)"
              : "translate(61 8) rotate(10 20 40)"
          }
        >
          <rect
            width={kind === "tablet" ? 82 : 39}
            height="80"
            rx={kind === "tablet" ? 5 : 6}
            fill="#103b4d"
          />
          <rect
            x="3"
            y="3"
            width={kind === "tablet" ? 76 : 33}
            height="74"
            rx="3"
            fill={`url(#${id}-screen)`}
          />
          <path
            d={
              kind === "tablet"
                ? "M3 70C22 34 44 63 79 8v69H3z"
                : "M3 69C13 40 22 43 36 12v65H3z"
            }
            fill="#046e91"
            opacity=".55"
          />
          <path
            d={
              kind === "tablet"
                ? "M3 50C25 20 48 37 72 3H3z"
                : "M3 46C13 24 25 36 36 4H3z"
            }
            fill="#b0f0ea"
            opacity=".4"
          />
          <circle
            cx={kind === "tablet" ? 41 : 19.5}
            cy="5"
            r="1"
            fill="#102b39"
          />
        </g>
      )}
    </svg>
  );
}
