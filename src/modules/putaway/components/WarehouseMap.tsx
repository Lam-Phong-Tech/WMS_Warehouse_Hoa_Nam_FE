/**
 * SVG mặt bằng kho (bản dịch của mockup "Sơ đồ khu vực khay"): rack theo từng
 * khu + khay + placeholder. Thành phần đánh dấu tương tác được gắn class để
 * `tray-overview.css` kiểm soát (hover/focus/selected/dimmed). Không state.
 */
import { Fragment } from "react";
import {
  BAYS,
  bucketOfStatus,
  rackOriginX,
  VIEW_W,
  type TrayBucket,
  type WarehouseLayout,
  type WarehouseRack,
  type WarehouseSlot,
} from "./warehouse-map";
import type { TrayOption } from "@/modules/putaway/services/putawayService";
import { useT } from "@/shared/i18n/useT";
import "./warehouse-map.css";

const TRAY_W = 218;
const TRAY_H = 168;
const SLOT_PITCH = 242;
const RACK_WIDTH = BAYS * SLOT_PITCH + 18;
const RACK_X = rackOriginX();
const RACK_RAIL_H = 13;
const RACK_FRONT_RAIL_Y = 194;
const RACK_FRONT_RAIL_H = 14;

interface WarehouseMapProps {
  layout: WarehouseLayout;
  /** Khay KHÔNG khớp bộ lọc hiện tại — bị làm mờ, mất tương tác, không tab tới được. */
  dimmedIds: ReadonlySet<string>;
  selectedId: string | null;
  onSelect: (tray: TrayOption) => void;
}

const MATERIAL: Record<TrayBucket, "neutral" | "blue" | "amber"> = {
  EMPTY: "neutral",
  PARTIAL: "blue",
  ATTENTION: "amber",
};

function fastener(x: number, y: number) {
  return (
    <Fragment key={`${x},${y}`}>
      <circle cx={x} cy={y} r={2.25} fill="#73818a" />
      <circle cx={x - 0.35} cy={y - 0.45} r={1.1} fill="#e9eef0" />
      <path
        d={`M${x - 1.1} ${y + 0.7}l1.8-1.8`}
        stroke="#52616b"
        strokeWidth={0.65}
      />
    </Fragment>
  );
}

function StatusSymbol({ bucket }: { bucket: TrayBucket }) {
  if (bucket === "ATTENTION") {
    return (
      <Fragment>
        <path
          d="M30.9 65.5a2 2 0 0 1 3.5 0l8.1 14.1a2 2 0 0 1-1.7 3H24.5a2 2 0 0 1-1.7-3z"
          fill="#D99517"
          stroke="#bf7d0b"
          strokeWidth={0.6}
        />
        <path
          d="M32.6 70v5.9"
          stroke="#fffdf3"
          strokeWidth={1.9}
          strokeLinecap="round"
        />
        <circle cx={32.6} cy={79.1} r={1.05} fill="#fffdf3" />
      </Fragment>
    );
  }
  if (bucket === "PARTIAL") {
    return (
      <Fragment>
        <circle cx={32.5} cy={74.5} r={8.1} fill="#1668c4" />
        <path
          d="M28.1 69.5a6.7 6.7 0 0 1 5.9-1.4"
          fill="none"
          stroke="#fff"
          strokeOpacity={0.35}
          strokeWidth={1.3}
          strokeLinecap="round"
        />
      </Fragment>
    );
  }
  return (
    <rect
      x={25.4}
      y={67.4}
      width={14.2}
      height={14.2}
      rx={2.5}
      fill="#f9fcf9"
      stroke="#338566"
      strokeWidth={1.8}
    />
  );
}

function Ribs() {
  const ribs = [];
  for (let index = 0; index < 11; index += 1) {
    const ribX = 22 + index * 18;
    ribs.push(
      <Fragment key={ribX}>
        <path
          d={`M${ribX} 19v126`}
          stroke="#4d514b"
          strokeOpacity={0.12}
          strokeWidth={1.35}
        />
        <path
          d={`M${ribX + 1.8} 19v126`}
          stroke="#fff"
          strokeOpacity={0.32}
          strokeWidth={1.35}
        />
      </Fragment>,
    );
  }
  return <Fragment>{ribs}</Fragment>;
}

interface TrayProps {
  slot: WarehouseSlot;
  railY: number;
  zone: string;
  dimmed: boolean;
  selected: boolean;
  onSelect: (tray: TrayOption) => void;
}

function Tray({ slot, railY, zone, dimmed, selected, onSelect }: TrayProps) {
  const t = useT();
  const x = RACK_X + 18 + slot.index * SLOT_PITCH;
  const y = railY + 18;
  const tray = slot.tray;

  if (!tray) {
    const indexLabel = String(slot.index + 1).padStart(2, "0");
    return (
      <g
        className="slot-placeholder"
        role="img"
        aria-label={t("putaway.overview.slotUnassigned", { index: indexLabel })}
        transform={`translate(${x} ${y})`}
      >
        <title>{t("putaway.overview.slotPlaceholderTitle")}</title>
        <rect
          x={8}
          y={8}
          width={202}
          height={152}
          rx={11}
          fill="#aeb6ba"
          fillOpacity={0.16}
          stroke="#8d969c"
          strokeDasharray="6 7"
          strokeWidth={1.6}
        />
        <rect
          x={12}
          y={12}
          width={194}
          height={144}
          rx={8}
          fill="none"
          stroke="#8d969c"
          strokeDasharray="6 7"
          strokeWidth={1.2}
          strokeOpacity={0.8}
        />
        <text
          x={112}
          y={98}
          textAnchor="middle"
          fill="#62686c"
          fontSize={14.2}
          fontWeight={550}
        >
          {t("putaway.overview.slotPlaceholderTitle")}
        </text>
        <text
          x={112}
          y={122}
          textAnchor="middle"
          fill="#767d80"
          fontSize={12.1}
          fontWeight={450}
        >
          {t("putaway.overview.slotPlaceholderLocation", { index: indexLabel })}
        </text>
      </g>
    );
  }

  const bucket = bucketOfStatus(tray.status);
  const material = MATERIAL[bucket];
  const statusName =
    bucket === "EMPTY"
      ? t("putaway.trayStatus.empty")
      : bucket === "PARTIAL"
        ? t("putaway.trayStatus.partial")
        : t("putaway.overview.bucketAttention");
  const code = tray.container_code;
  const location = tray.location_hint?.trim() || "—";
  const labelSize = code.length > 16 ? 12.3 : 14.2;
  const classes = ["tray-object"];
  if (dimmed) classes.push("is-dimmed");
  if (selected) classes.push("is-selected");

  const activate = () => {
    if (!dimmed) onSelect(tray);
  };

  return (
    <g
      className={classes.join(" ")}
      data-tray={code}
      data-bucket={bucket}
      data-testid="ptw-tray-cell"
      role="button"
      tabIndex={dimmed ? -1 : 0}
      aria-disabled={dimmed ? "true" : undefined}
      aria-label={`${code}, ${zone}, ${statusName}`}
      transform={`translate(${x} ${y})`}
      onClick={activate}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          activate();
        }
      }}
    >
      <title>{`${code} — ${zone} · ${location} · ${statusName}`}</title>
      <rect
        className="selection-ring"
        x={-6}
        y={-6}
        width={TRAY_W + 18}
        height={TRAY_H + 16}
        rx={21}
        fill="none"
        strokeWidth={3}
        stroke="transparent"
      />
      <rect
        x={3}
        y={8}
        width={TRAY_W}
        height={TRAY_H - 4}
        rx={16}
        fill="#24333d"
        opacity={0.2}
        filter="url(#wm-contact-shadow)"
        aria-hidden="true"
      />
      <g className="tray-body" aria-hidden="true">
        <path
          d="M17 0h190c10.5 0 17 6.5 17 17v132c0 10.5-6.5 17-17 17h-65l-5 5H87l-5-5H17c-10.5 0-17-6.5-17-17V17C0 6.5 6.5 0 17 0z"
          fill={`url(#wm-${material}-rim)`}
          stroke={`url(#wm-${material}-edge)`}
          strokeWidth={1.35}
        />
        <rect
          x={8}
          y={8}
          width={208}
          height={146}
          rx={11}
          fill={`url(#wm-${material}-basin)`}
          stroke="#4c534e"
          strokeOpacity={0.2}
          strokeWidth={1.2}
        />
        <rect
          x={12}
          y={12}
          width={200}
          height={138}
          rx={8}
          fill="url(#wm-basin-depth)"
        />
        <Ribs />
        <path
          d="M18 4h188c8.6 0 14 5.4 14 14v130c0 8.7-5.4 14-14 14h-62M80 162H18c-8.7 0-14-5.3-14-14V18C4 9.4 9.3 4 18 4"
          fill="none"
          stroke="#fff"
          strokeOpacity={0.69}
          strokeWidth={3.2}
        />
        <path
          d="M19 12h186c4.5 0 7 2.5 7 7"
          fill="none"
          stroke="#fff"
          strokeOpacity={0.22}
          strokeWidth={1.5}
        />
        <path
          d="M13 150h198"
          stroke="#fff"
          strokeOpacity={0.37}
          strokeWidth={2}
        />
        <path
          d="M80 154h64l-4 11c-1.1 3.5-4.2 5.5-8 5.5H92c-3.8 0-6.9-2-8-5.5z"
          fill={`url(#wm-${material}-rim)`}
          stroke="#fff"
          strokeOpacity={0.62}
          strokeWidth={1.4}
        />
        <rect
          x={88}
          y={157.5}
          width={48}
          height={8}
          rx={4}
          fill="url(#wm-handle-inset)"
          stroke="#4e5a60"
          strokeOpacity={0.35}
          strokeWidth={0.8}
        />
        <path
          d="M92 164h40"
          stroke="#fff"
          strokeOpacity={0.38}
          strokeWidth={1}
          strokeLinecap="round"
        />
      </g>
      <g className="tray-label" aria-hidden="true">
        <rect
          x={16}
          y={56}
          width={192}
          height={57}
          rx={5}
          fill="url(#wm-label-plate)"
          stroke="#b7bfc2"
          strokeOpacity={0.7}
          strokeWidth={0.8}
          filter="url(#wm-label-shadow)"
        />
        <path
          d="M22 57.5h180"
          stroke="#fff"
          strokeOpacity={0.9}
          strokeWidth={1}
        />
        <StatusSymbol bucket={bucket} />
        <text
          x={125}
          y={80}
          textAnchor="middle"
          fill="#172331"
          fontSize={labelSize}
          fontWeight={650}
          letterSpacing={-0.25}
        >
          {code}
        </text>
        <text
          x={112}
          y={100.5}
          textAnchor="middle"
          fill="#33414d"
          fontSize={12.1}
          fontWeight={450}
        >
          {location}
        </text>
      </g>
    </g>
  );
}

function RackBank({
  rack,
  dimmedIds,
  selectedId,
  onSelect,
}: {
  rack: WarehouseRack;
  dimmedIds: ReadonlySet<string>;
  selectedId: string | null;
  onSelect: (tray: TrayOption) => void;
}) {
  const railY = rack.y;
  const frontY = railY + RACK_FRONT_RAIL_Y;
  const signY = railY - 36;
  const postCenters = Array.from(
    { length: BAYS + 1 },
    (_, index) => 9 + index * SLOT_PITCH,
  );

  return (
    <g
      className="rack-bank"
      data-rack={rack.zone}
      transform={`translate(${RACK_X} 0)`}
    >
      <g aria-hidden="true" filter="url(#wm-rack-shadow)">
        {postCenters.map((center) => (
          <Fragment key={center}>
            <rect
              x={center - 5}
              y={railY + 4}
              width={10}
              height={204}
              rx={1.5}
              fill="url(#wm-upright)"
              stroke="#677680"
              strokeWidth={0.8}
            />
            <path
              d={`M${center + 3} ${railY + 15}v180`}
              stroke="#edf2f3"
              strokeOpacity={0.65}
              strokeWidth={1.2}
            />
            <path
              d={`M${center - 9} ${frontY + 10}h18l2 13h-22z`}
              fill="url(#wm-foot)"
              stroke="#72818a"
              strokeWidth={0.85}
            />
            <path
              d={`M${center - 8} ${frontY + 20}h16`}
              stroke="#e6ebed"
              strokeWidth={1}
            />
            {fastener(center - 6, frontY + 19)}
            {fastener(center + 6, frontY + 19)}
          </Fragment>
        ))}
        <rect
          x={0}
          y={railY}
          width={RACK_WIDTH}
          height={RACK_RAIL_H}
          rx={2}
          fill="url(#wm-steel-rail)"
          stroke="#7a8790"
          strokeWidth={0.8}
        />
        <path
          d={`M2 ${railY + 2}h${RACK_WIDTH - 4}`}
          stroke="#fff"
          strokeOpacity={0.84}
          strokeWidth={1.3}
        />
        <path
          d={`M2 ${railY + 11}h${RACK_WIDTH - 4}`}
          stroke="#64747e"
          strokeOpacity={0.7}
          strokeWidth={1}
        />
        <rect
          x={1}
          y={frontY + 1}
          width={RACK_WIDTH - 2}
          height={RACK_FRONT_RAIL_H}
          rx={2}
          fill="#7d8b94"
        />
      </g>
      {rack.slots.map((slot) => (
        <Tray
          key={slot.index}
          slot={slot}
          railY={railY}
          zone={rack.zone}
          dimmed={slot.tray ? dimmedIds.has(slot.tray.container_id) : false}
          selected={
            Boolean(slot.tray) && selectedId === slot.tray?.container_id
          }
          onSelect={onSelect}
        />
      ))}
      <g aria-hidden="true">
        <rect
          x={0}
          y={frontY}
          width={RACK_WIDTH}
          height={RACK_FRONT_RAIL_H}
          rx={2}
          fill="url(#wm-steel-rail)"
          stroke="#7a8790"
          strokeWidth={0.8}
        />
        <path
          d={`M2 ${frontY + 2}h${RACK_WIDTH - 4}`}
          stroke="#f9fcfc"
          strokeWidth={1.4}
        />
        <path
          d={`M2 ${frontY + 12}h${RACK_WIDTH - 4}`}
          stroke="#667680"
          strokeWidth={0.9}
        />
        {postCenters.map((center) => (
          <Fragment key={center}>
            <rect
              x={center - 8.5}
              y={railY - 4}
              width={17}
              height={18}
              rx={1.6}
              fill="url(#wm-joint)"
              stroke="#7b8991"
              strokeWidth={0.9}
            />
            {fastener(center - 3.6, railY + 4.5)}
            {fastener(center + 3.6, railY + 4.5)}
            <rect
              x={center - 8.5}
              y={frontY - 3}
              width={17}
              height={18}
              rx={1.6}
              fill="url(#wm-joint)"
              stroke="#7b8991"
              strokeWidth={0.9}
            />
            {fastener(center - 3.6, frontY + 5)}
            {fastener(center + 3.6, frontY + 5)}
          </Fragment>
        ))}
        <path
          d={`M36 ${signY + 26}v11m73-11v11`}
          stroke="#82919a"
          strokeWidth={4}
        />
        <rect
          x={23}
          y={signY}
          width={100}
          height={29}
          rx={4}
          fill="url(#wm-sign-plate)"
          stroke="#87929a"
          strokeWidth={1}
          filter="url(#wm-label-shadow)"
        />
        <text
          x={73}
          y={signY + 19.4}
          textAnchor="middle"
          fontSize={14}
          fontWeight={750}
          letterSpacing={0.65}
          fill="#293744"
        >
          {rack.label}
        </text>
        {fastener(29, signY + 6)}
        {fastener(117, signY + 6)}
        {fastener(29, signY + 23)}
        {fastener(117, signY + 23)}
      </g>
    </g>
  );
}

export function WarehouseMap({
  layout,
  dimmedIds,
  selectedId,
  onSelect,
}: WarehouseMapProps) {
  const t = useT();
  const height = Math.round(layout.aspect * VIEW_W);
  const aisles = layout.racks.slice(0, -1).map((rack) => rack.y + 227);

  return (
    <svg
      className="warehouse-map"
      viewBox={layout.viewBox}
      width="100%"
      role="group"
      aria-label={t("putaway.overview.mapAriaLabel")}
      preserveAspectRatio="xMidYMid meet"
      fontFamily="Inter, 'Segoe UI', Arial, sans-serif"
    >
      <defs>
        <linearGradient id="wm-steel-rail" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#dfe6e8" />
          <stop offset={0.23} stopColor="#fafcfc" />
          <stop offset={0.43} stopColor="#a7b3ba" />
          <stop offset={0.59} stopColor="#83929b" />
          <stop offset={0.79} stopColor="#cbd4d8" />
          <stop offset={1} stopColor="#aab6bd" />
        </linearGradient>
        <linearGradient id="wm-upright" x1="0" y1="0" x2="1" y2="0">
          <stop stopColor="#7d8c95" />
          <stop offset={0.36} stopColor="#d2dbe0" />
          <stop offset={0.62} stopColor="#edf2f3" />
          <stop offset={1} stopColor="#8b9aa3" />
        </linearGradient>
        <linearGradient id="wm-joint" x1="0" y1="0" x2="0.7" y2="1">
          <stop stopColor="#f2f5f5" />
          <stop offset={0.55} stopColor="#c9d2d6" />
          <stop offset={1} stopColor="#a8b5bc" />
        </linearGradient>
        <linearGradient id="wm-foot" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#aebbc2" />
          <stop offset={1} stopColor="#778791" />
        </linearGradient>
        <linearGradient id="wm-sign-plate" x1="0" y1="0" x2="0.15" y2="1">
          <stop stopColor="#fff" />
          <stop offset={0.52} stopColor="#e9edef" />
          <stop offset={1} stopColor="#cdd6db" />
        </linearGradient>
        <linearGradient id="wm-label-plate" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#fffefb" />
          <stop offset={1} stopColor="#f4f6f4" />
        </linearGradient>
        <linearGradient id="wm-amber-rim" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#fff2cb" />
          <stop offset={0.5} stopColor="#efd79b" />
          <stop offset={0.9} stopColor="#e4c47e" />
          <stop offset={1} stopColor="#b79a61" />
        </linearGradient>
        <linearGradient id="wm-amber-edge" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#c9af77" />
          <stop offset={1} stopColor="#9a8455" />
        </linearGradient>
        <linearGradient id="wm-amber-basin" x1="0" y1="0" x2="0.15" y2="1">
          <stop stopColor="#d9b66e" />
          <stop offset={0.3} stopColor="#eacf91" />
          <stop offset={1} stopColor="#efd8a2" />
        </linearGradient>
        <linearGradient id="wm-blue-rim" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#d9eafd" />
          <stop offset={0.48} stopColor="#aacbef" />
          <stop offset={0.9} stopColor="#8db3dc" />
          <stop offset={1} stopColor="#6689b0" />
        </linearGradient>
        <linearGradient id="wm-blue-edge" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#8ca9c6" />
          <stop offset={1} stopColor="#577c9e" />
        </linearGradient>
        <linearGradient id="wm-blue-basin" x1="0" y1="0" x2="0.15" y2="1">
          <stop stopColor="#85aacf" />
          <stop offset={0.3} stopColor="#a5c8e9" />
          <stop offset={1} stopColor="#bfdaf3" />
        </linearGradient>
        <linearGradient id="wm-neutral-rim" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#e7e9e8" />
          <stop offset={0.5} stopColor="#ced2d2" />
          <stop offset={1} stopColor="#9aa2a5" />
        </linearGradient>
        <linearGradient id="wm-neutral-edge" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#b8bec0" />
          <stop offset={1} stopColor="#7e898f" />
        </linearGradient>
        <linearGradient id="wm-neutral-basin" x1="0" y1="0" x2="0.15" y2="1">
          <stop stopColor="#aeb6ba" />
          <stop offset={1} stopColor="#d4d9db" />
        </linearGradient>
        <linearGradient id="wm-basin-depth" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#363d42" stopOpacity={0.16} />
          <stop offset={0.22} stopColor="#363d42" stopOpacity={0} />
          <stop offset={0.8} stopColor="#fff" stopOpacity={0} />
          <stop offset={1} stopColor="#fff" stopOpacity={0.12} />
        </linearGradient>
        <linearGradient id="wm-handle-inset" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#3e4f59" />
          <stop offset={1} stopColor="#65767b" />
        </linearGradient>
        <filter
          id="wm-rack-shadow"
          x="-12%"
          y="-15%"
          width="124%"
          height="140%"
        >
          <feDropShadow
            dx={0}
            dy={5}
            stdDeviation={4}
            floodColor="#304049"
            floodOpacity={0.18}
          />
        </filter>
        <filter
          id="wm-contact-shadow"
          x="-12%"
          y="-12%"
          width="124%"
          height="130%"
        >
          <feGaussianBlur stdDeviation={3} />
        </filter>
        <filter
          id="wm-label-shadow"
          x="-10%"
          y="-20%"
          width="120%"
          height="150%"
        >
          <feDropShadow
            dx={0}
            dy={1.6}
            stdDeviation={1.8}
            floodColor="#263541"
            floodOpacity={0.16}
          />
        </filter>
      </defs>
      <g aria-hidden="true">
        <path
          d={`M32 53V32h21m1334 0h21v21M32 ${height - 53}v21h21m1334 0h21v-21`}
          fill="none"
          stroke="#ddb85e"
          strokeOpacity={0.85}
          strokeWidth={5}
        />
        {aisles.map((top) => (
          <Fragment key={top}>
            <path
              d={`M44 ${top}h1352M44 ${top + 54}h1352`}
              fill="none"
              stroke="#dbb45c"
              strokeOpacity={0.86}
              strokeWidth={4}
            />
            <text
              x={720}
              y={top + 33}
              textAnchor="middle"
              fontSize={16}
              fontWeight={600}
              letterSpacing={4}
              fill="#757773"
            >
              {t("putaway.overview.aisleLabel")}
            </text>
            <path
              d={`M526 ${top + 27}h-22m0 0 5-5m-5 5 5 5m405-5h22m0 0-5-5m5 5-5 5`}
              fill="none"
              stroke="#92958e"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Fragment>
        ))}
      </g>
      {layout.racks.map((rack, index) => (
        <RackBank
          key={`${rack.zone}-${index}`}
          rack={rack}
          dimmedIds={dimmedIds}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ))}
    </svg>
  );
}
