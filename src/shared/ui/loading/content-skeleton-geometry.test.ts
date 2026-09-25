import { it as test } from "vitest";
import assert from "node:assert/strict";
import {
  clipSkeletonBounds,
  equalSkeletonGeometry,
  localSkeletonRect,
  type SkeletonGeometry,
} from "./content-skeleton-geometry";

const root = { left: 240, top: 80, width: 1000, height: 900 };
const input = { left: 260, top: 180, width: 300, height: 38 };

test("field skeleton uses the field's actual origin and dimensions", () => {
  assert.deepEqual(localSkeletonRect(input, root, 1000, 900, "block", 6), {
    x: 20, y: 100, width: 300, height: 38, radius: 6, kind: "block",
  });
});
test("does not add the eager template's second page padding", () => {
  assert.equal(localSkeletonRect(root, root, 1000, 900, "surface")?.x, 0);
  assert.equal(localSkeletonRect(root, root, 1000, 900, "surface")?.y, 0);
});
test("scaled modal ancestors are converted to local content pixels", () => {
  const r = { left: 100, top: 50, width: 500, height: 450 };
  assert.deepEqual(localSkeletonRect({ left: 110, top: 100, width: 150, height: 19 }, r, 1000, 900, "block", 6), {
    x: 20, y: 100, width: 300, height: 38, radius: 6, kind: "block",
  });
});
test("right edge of a scrolled table is clipped, not painted over another card", () => {
  const r = localSkeletonRect({ left: 1190, top: 100, width: 200, height: 20 }, root, 1000, 900, "text");
  assert.equal(r?.width, 50);
  assert.equal(r?.x, 950);
});
test("left edge of a scrolled table is clipped", () => {
  const r = localSkeletonRect({ left: 220, top: 100, width: 100, height: 20 }, root, 1000, 900, "text");
  assert.equal(r?.x, 0);
  assert.equal(r?.width, 80);
});
test("offscreen, empty and inaccessible zero-size elements do not create boxes", () => {
  assert.equal(localSkeletonRect({ ...input, left: 2000 }, root, 1000, 900, "block"), null);
  assert.equal(localSkeletonRect({ ...input, height: 0 }, root, 1000, 900, "block"), null);
  assert.equal(localSkeletonRect(input, { ...root, width: 0 }, 1000, 900, "block"), null);
});
test("invalid numbers cannot enter inline styles", () => {
  assert.equal(localSkeletonRect({ ...input, width: NaN }, root, 1000, 900, "block"), null);
  assert.equal(localSkeletonRect(input, root, 1000, 900, "block", NaN)?.radius, 0);
});
test("round placeholders retain their local radius under a parent scale", () => {
  const r = localSkeletonRect({ left: 260, top: 100, width: 72, height: 72 }, { ...root, width: 500, height: 450 }, 1000, 900, "circle", 36);
  assert.equal(r?.width, 144); assert.equal(r?.radius, 72);
});
test("nested scroll containers clip against their own viewport, not only the page", () => {
  assert.deepEqual(clipSkeletonBounds({ left: 300, top: 0, width: 100, height: 60 }, { left: 320, top: 10, width: 40, height: 30 }), {
    left: 320, top: 10, width: 40, height: 30,
  });
});
test("stable geometry does not restart the shared pulse through redundant updates", () => {
  const shape = localSkeletonRect(input, root, 1000, 900, "block")!;
  const g: SkeletonGeometry = { width: 1000, height: 900, shapes: [shape] };
  assert.equal(equalSkeletonGeometry(g, { ...g, shapes: [{ ...shape }] }), true);
  assert.equal(equalSkeletonGeometry(null, null), true);
});
test("responsive column position changes invalidate the projection", () => {
  const shape = localSkeletonRect(input, root, 1000, 900, "block")!;
  const g: SkeletonGeometry = { width: 1000, height: 900, shapes: [shape] };
  assert.equal(equalSkeletonGeometry(g, { ...g, shapes: [{ ...shape, x: 60 }] }), false);
  assert.equal(equalSkeletonGeometry(g, { ...g, width: 500 }), false);
  assert.equal(equalSkeletonGeometry(g, null), false);
});
test("measurements contain only numeric geometry and a neutral shape kind", () => {
  assert.deepEqual(Object.keys(localSkeletonRect(input, root, 1000, 900, "block")!).sort(), ["height", "kind", "radius", "width", "x", "y"]);
});
