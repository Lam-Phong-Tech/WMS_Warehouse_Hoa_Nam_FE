import { createRef } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ContentLoadingSkeleton } from "./ContentLoadingSkeleton";
import * as geometry from "./content-skeleton-geometry";

const snapshot: geometry.SkeletonGeometry = {
  width: 900, height: 700,
  shapes: [
    { x: 24, y: 100, width: 520, height: 220, radius: 10, kind: "surface" },
    { x: 40, y: 148, width: 488, height: 156, radius: 6, kind: "block" },
    { x: 610, y: 148, width: 144, height: 144, radius: 72, kind: "circle" },
  ],
};
let notify: (() => void)[];
let disconnects: ReturnType<typeof vi.fn>[];
let frames: Map<number, FrameRequestCallback>;
let sequence: number;

beforeEach(() => {
  notify = []; disconnects = []; frames = new Map(); sequence = 0;
  vi.spyOn(geometry, "measureSkeletonGeometry").mockReturnValue(snapshot);
  class Observer {
    disconnect = vi.fn();
    observe = vi.fn();
    constructor(callback: () => void) { notify.push(callback); disconnects.push(this.disconnect); }
  }
  vi.stubGlobal("MutationObserver", Observer);
  vi.stubGlobal("ResizeObserver", Observer);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.set(++sequence, callback); return sequence;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function mount() {
  const content = createRef<HTMLDivElement>();
  return render(<div>
    <div ref={content} style={{ visibility: "hidden" }}>
      <input defaultValue="source-only-private-value" /><div>source-only-title</div>
    </div>
    <ContentLoadingSkeleton contentRef={content} label="Đang tải dữ liệu"
      fallback={<div data-testid="eager">Eager route fallback</div>} />
  </div>);
}
function flushFrame() {
  act(() => { const work = [...frames.values()]; frames.clear(); work.forEach((callback) => callback(0)); });
}

it("renders exact supplied positions with one status and no copied controls or values", () => {
  mount();
  const skeleton = screen.getByTestId("content-matched-skeleton");
  expect(skeleton.querySelectorAll(".hn-content-skeleton__shape")).toHaveLength(3);
  expect(skeleton.querySelector(".hn-content-skeleton__shape--block")).toHaveStyle({ left: "40px", top: "148px", width: "488px", height: "156px" });
  expect(skeleton.querySelectorAll("input,button,a,select")).toHaveLength(0);
  expect(skeleton.innerHTML).not.toContain("source-only");
  expect(screen.getAllByRole("status")).toHaveLength(1);
});
it("uses the eager fallback only until an actual layout exists", () => {
  vi.mocked(geometry.measureSkeletonGeometry).mockReturnValue(null);
  mount(); expect(screen.getByTestId("eager")).toBeInTheDocument();
  vi.mocked(geometry.measureSkeletonGeometry).mockReturnValue(snapshot);
  act(() => notify[0]()); flushFrame();
  expect(screen.queryByTestId("eager")).not.toBeInTheDocument();
  expect(screen.getByTestId("content-matched-skeleton")).toBeInTheDocument();
});
it("batches simultaneous mutations and resize into a single read per animation frame", () => {
  mount(); const reads = vi.mocked(geometry.measureSkeletonGeometry).mock.calls.length;
  act(() => { notify.forEach((callback) => callback()); notify.forEach((callback) => callback()); });
  expect(frames.size).toBe(1); flushFrame();
  expect(vi.mocked(geometry.measureSkeletonGeometry).mock.calls.length).toBe(reads + 1);
});
it("updates resized chart positions without replacing the one animated parent", () => {
  mount(); const parent = screen.getByTestId("content-matched-skeleton").querySelector(".hn-skeleton__shapes");
  vi.mocked(geometry.measureSkeletonGeometry).mockReturnValue({ ...snapshot, shapes: snapshot.shapes.map((shape) => ({ ...shape, y: shape.y + 40 })) });
  act(() => notify[1]()); flushFrame();
  expect(screen.getByTestId("content-matched-skeleton").querySelector(".hn-skeleton__shapes")).toBe(parent);
  expect(screen.getByTestId("content-matched-skeleton").querySelector(".hn-content-skeleton__shape--block")).toHaveStyle({ top: "188px" });
});
it("disconnects all observers and ignores late callbacks on navigation or reveal", () => {
  const view = mount(); act(() => notify[0]()); view.unmount();
  expect(disconnects.every((disconnect) => disconnect.mock.calls.length === 1)).toBe(true);
  expect(frames.size).toBe(0);
  act(() => notify.forEach((callback) => callback())); expect(frames.size).toBe(0);
});
