/** Geometry only. Never clone HTML, values, URLs, attributes or business text. */
export interface SkeletonRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly radius: number;
  readonly kind: "surface" | "block" | "text" | "circle";
}
export interface SkeletonGeometry {
  readonly width: number;
  readonly height: number;
  readonly shapes: readonly SkeletonRect[];
}
export interface Bounds {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/** Convert viewport measurements to content coordinates, including ancestor scale. */
export function localSkeletonRect(
  rect: Bounds,
  root: Bounds,
  width: number,
  height: number,
  kind: SkeletonRect["kind"],
  radius = 4,
): SkeletonRect | null {
  if (root.width <= 0 || root.height <= 0 || width <= 0 || height <= 0) return null;
  const sx = width / root.width;
  const sy = height / root.height;
  const left = Math.max(0, (rect.left - root.left) * sx);
  const top = Math.max(0, (rect.top - root.top) * sy);
  const right = Math.min(width, (rect.left + rect.width - root.left) * sx);
  const bottom = Math.min(height, (rect.top + rect.height - root.top) * sy);
  if (![left, top, right, bottom].every(Number.isFinite) || right - left < 2 || bottom - top < 2) return null;
  const round = (value: number) => Math.round(value * 2) / 2;
  return {
    x: round(left), y: round(top), width: round(right - left),
    height: round(bottom - top),
    radius: kind === "circle" ? Math.min(right - left, bottom - top) / 2
      : Number.isFinite(radius) ? Math.max(0, radius) : 0,
    kind,
  };
}

/** Intersect only overflowing axes; fixed-height horizontal scrollers need both. */
export function clipSkeletonBounds(rect: Bounds, clip: Bounds): Bounds {
  const left = Math.max(rect.left, clip.left);
  const top = Math.max(rect.top, clip.top);
  return { left, top,
    width: Math.max(0, Math.min(rect.left + rect.width, clip.left + clip.width) - left),
    height: Math.max(0, Math.min(rect.top + rect.height, clip.top + clip.height) - top) };
}

const OMIT = [
  "script", "style", "link", "template", "noscript", "[hidden]",
  '[data-skeleton-ignore="true"]', '[role="tooltip"]',
  ".hn-skeleton", ".hn-loading-boundary", ".hn-unified-loading",
].join(",");
const CONTROL = [
  "input", "select", "textarea", "button", '[role="combobox"]',
  '[role="tab"]', '[role="checkbox"]', ".MuiInputBase-root",
].join(",");
const PLOT = [
  "svg", "canvas", "img", "video", "iframe", '[role="img"]', '[data-chart-loading]',
  '[class*="chart-plot"]', '[class*="chart-skeleton"]',
  '[class*="bar-skeleton"]', '[class*="donut"]',
].join(",");
const SPINNER = '.hn-spinner, [class*="__spinner"], [class$="-spinner"]';

function hasPaint(value: string): boolean {
  return value !== "" && value !== "transparent" &&
    !/^rgba\([^)]*,\s*0(?:\.0+)?\s*\)$/.test(value) &&
    !/\/\s*0(?:\.0+)?%?\s*\)$/.test(value);
}

/**
 * Read the actual mounted layout, including its CSS breakpoints, hidden columns,
 * native loading placeholders and current tab. Loading content stays measurable
 * via visibility:hidden; that inherited visibility must NOT discard its boxes.
 * DOM work is bounded and runs only while this surface is waiting.
 */
export function measureSkeletonGeometry(root: HTMLElement): SkeletonGeometry | null {
  const view = root.ownerDocument.defaultView;
  if (!view || !root.isConnected) return null;
  const bounds = root.getBoundingClientRect();
  const width = root.offsetWidth || bounds.width;
  const height = root.offsetHeight || bounds.height;
  if (width < 40 || height < 40) return null;
  const surfaces: SkeletonRect[] = [];
  const blocks: SkeletonRect[] = [];
  const seen = new Set<string>();
  const controls: HTMLElement[] = [];
  let panels = 0;
  let contentEvidence = false;
  let visited = 0;
  const maxShapes = 600;
  const add = (rect: Bounds, kind: SkeletonRect["kind"], radius = 4, clip: Bounds = bounds) => {
    if (surfaces.length + blocks.length >= maxShapes) return;
    const shape = localSkeletonRect(clipSkeletonBounds(rect, clip), bounds, width, height, kind, radius);
    if (!shape) return;
    const key = [shape.x, shape.y, shape.width, shape.height, kind].join(":");
    if (seen.has(key)) return;
    seen.add(key);
    (kind === "surface" ? surfaces : blocks).push(shape);
  };
  const range = root.ownerDocument.createRange();
  const readText = (node: Node, style: CSSStyleDeclaration, clip: Bounds) => {
    // Only measure a text node. Its string is never retained in the result.
    if (node.nodeType !== 3 || !node.textContent?.trim()) return;
    range.selectNodeContents(node);
    const font = Number.parseFloat(style.fontSize) || 14;
    const lineHeight = Math.max(5, Math.min(22, font * 0.7)) * bounds.height / height;
    for (const rect of Array.from(range.getClientRects()).slice(0, 4)) {
      if (rect.width < 3 || rect.height < 3) continue;
      add({ left: rect.left, top: rect.top + (rect.height - lineHeight) / 2,
        width: rect.width, height: lineHeight }, "text", 3, clip);
    }
  };

  const visit = (node: HTMLElement, clip: Bounds) => {
    if (++visited > 2400 || surfaces.length + blocks.length >= maxShapes || node.matches(OMIT)) return;
    const rect = node.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return;
    const style = view.getComputedStyle(node);
    if (style.display === "none" || style.position === "fixed" || style.contentVisibility === "hidden") return;
    const visibleRect = clipSkeletonBounds(rect, clip);
    if (visibleRect.width < 2 || visibleRect.height < 2) return;
    const childClip = clipSkeletonBounds(clip, {
      left: /hidden|clip|auto|scroll/.test(style.overflowX) ? rect.left : clip.left,
      top: /hidden|clip|auto|scroll/.test(style.overflowY) ? rect.top : clip.top,
      width: /hidden|clip|auto|scroll/.test(style.overflowX) ? rect.width : clip.width,
      height: /hidden|clip|auto|scroll/.test(style.overflowY) ? rect.height : clip.height,
    });
    if (node.matches(SPINNER)) {
      // A chart/table waiting slot is represented by its measured content box,
      // never by another isolated spinner. Small button feedback stays local.
      const parent = node.parentElement;
      if (parent && parent !== root) {
        const slot = parent.getBoundingClientRect();
        if (slot.width >= 120 && slot.height >= 90) {
          add(slot, "block", 6, clip);
          contentEvidence = true;
        }
      }
      return;
    }
    const radius = Math.min(Number.parseFloat(style.borderTopLeftRadius) || 0, rect.width / 2, rect.height / 2);
    const isPlot = node.matches(PLOT) && rect.width > 70 && rect.height > 65;
    const isCircle = (Math.abs(rect.width - rect.height) < 4 &&
      (style.borderRadius.includes("50%") || radius >= Math.min(rect.width, rect.height) * 0.4 || node.className.toString().includes("donut")));
    if (isPlot || isCircle) {
      add(rect, isCircle ? "circle" : "block", isCircle ? Math.min(rect.width, rect.height) / 2 : Math.max(6, radius), clip);
      contentEvidence = true;
      return;
    }
    if (node.matches(CONTROL) && (rect.height <= 64 || node.matches("textarea"))) {
      add(rect, "block", Math.max(5, radius), clip);
      controls.push(node);
      return;
    }
    if (node.matches("table,[role=table],[role=grid]")) contentEvidence = true;
    const painted = hasPaint(style.backgroundColor) || Number.parseFloat(style.borderTopWidth) > 0 || style.boxShadow !== "none";
    // Preserve icon/avatar blocks, readonly fields and horizontal progress rails.
    // Do not collapse table headings or a whole toolbar into one rectangle.
    if (painted && rect.height <= 64 && rect.height >= 8 && rect.width >= 20 &&
        !node.matches("table,thead,tbody,tr,td,th") &&
        (rect.width <= 64 || /(?:bar|progress|readonly|chip|badge)/.test(node.className.toString()))) {
      add(rect, "block", Math.max(3, radius), clip);
      return;
    }
    const leaf = node.children.length === 0 && !node.textContent?.trim();
    if (leaf && (painted || node.matches('[class*="skeleton"],[class*="loading-bar"]'))) {
      add(rect, isCircle ? "circle" : "block", Math.max(3, radius), clip);
      return;
    }
    if (painted && rect.width >= 100 && rect.height >= 60 &&
        !node.matches("td,th,tr,thead,tbody,span,i")) {
      add(rect, "surface", radius, clip);
      panels += 1;
    }
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === 1) visit(child as HTMLElement, childClip);
      else readText(child, style, childClip);
    }
  };
  // Do not visit root itself: the surrounding page is not a data card.
  for (const child of Array.from(root.children)) visit(child as HTMLElement, bounds);
  range.detach();
  // Do not replace the eager route fallback with a lone heading/loader. Form
  // dialogs qualify via their actual fields even when they have no data panels.
  if (blocks.length < 4 || (!contentEvidence && panels < 3 && controls.length < 2)) return null;
  return { width, height, shapes: [...surfaces, ...blocks] };
}

export function equalSkeletonGeometry(a: SkeletonGeometry | null, b: SkeletonGeometry | null): boolean {
  if (a === b) return true;
  if (!a || !b || a.width !== b.width || a.height !== b.height || a.shapes.length !== b.shapes.length) return false;
  return a.shapes.every((item, index) => {
    const other = b.shapes[index];
    return item.x === other.x && item.y === other.y && item.width === other.width &&
      item.height === other.height && item.radius === other.radius && item.kind === other.kind;
  });
}
