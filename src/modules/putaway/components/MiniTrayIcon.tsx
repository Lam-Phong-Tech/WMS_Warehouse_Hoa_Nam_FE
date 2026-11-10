import type { TrayBucket } from "./warehouse-map";

/** SVG mini-khay minh họa theo nhóm trạng thái (dùng trong dải "Chưa gán"
 *  và dialog chi tiết). Trên sàn sáng nên giữ palette cố định. */
const PALETTE: Record<TrayBucket, { fill: string; rim: string }> = {
  EMPTY: { fill: "#e4ece8", rim: "#b9c9c0" },
  PARTIAL: { fill: "#dce9f7", rim: "#a7c2e0" },
  ATTENTION: { fill: "#f0e4ca", rim: "#d9bf8e" },
};

export function MiniTrayIcon({
  bucket,
  className,
}: {
  bucket: TrayBucket;
  className?: string;
}) {
  const { fill, rim } = PALETTE[bucket];
  return (
    <svg
      className={className}
      viewBox="0 0 180 120"
      fill="none"
      aria-hidden="true"
    >
      <ellipse cx={90} cy={104} rx={73} ry={6} fill="#2e425112" />
      <rect
        x={10}
        y={10}
        width={160}
        height={96}
        rx={10}
        fill={rim}
        stroke="#95a2ac"
      />
      <rect
        x={17}
        y={17}
        width={146}
        height={78}
        rx={6}
        fill={fill}
        stroke="#ffffffcc"
        strokeWidth={3}
      />
      <path
        d="M38 21v69M64 21v69M90 21v69M116 21v69M142 21v69"
        stroke={rim}
        strokeWidth={1.2}
        opacity={0.7}
      />
      <path
        d="M66 99h48l-5 8H71z"
        fill="#8797a4"
        stroke="#f5f7f6"
        strokeWidth={2}
      />
    </svg>
  );
}
