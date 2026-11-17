import { afterEach, expect, it, vi } from "vitest";
import { measureSkeletonGeometry } from "./content-skeleton-geometry";

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

// JSDOM has no layout engine. Supply only rectangles; exercise the real DOM
// traversal and computed styles, including inherited visibility and opacity.
function fixture(extra: string) {
  const root = document.createElement("div");
  root.style.visibility = "hidden";
  root.innerHTML = `<input><input><input><input>${extra}`;
  document.body.append(root);
  vi.spyOn(root, "getBoundingClientRect").mockReturnValue(
    new DOMRect(0, 0, 800, 600),
  );
  for (const [index, element] of Array.from(
    root.querySelectorAll("*"),
  ).entries()) {
    // Explicit defaults: JSDOM returns an empty boxShadow instead of "none".
    Object.assign((element as HTMLElement).style, {
      boxShadow: "none",
      borderTopWidth: "0px",
      backgroundColor: "transparent",
    });
    vi.spyOn(element, "getBoundingClientRect").mockReturnValue(
      new DOMRect(20, 20 + index * 45, 300, 38),
    );
  }
  return root;
}

it("does not project controls from a closed transparent dropdown onto the report", () => {
  const root = fixture(
    '<div style="opacity:0;visibility:hidden" aria-hidden="true"><input><button></button><button></button></div>',
  );
  expect(measureSkeletonGeometry(root)?.shapes).toHaveLength(4);
});

it("keeps only the summary of collapsed advanced filters, even if descendants have boxes", () => {
  const root = fixture(
    "<details><summary><input></summary><div><input><button></button></div></details>",
  );
  expect(measureSkeletonGeometry(root)?.shapes).toHaveLength(5);
});

it("still measures the hidden page and expanded advanced filters", () => {
  const root = fixture(
    "<details open><summary><input></summary><div><input><button></button></div></details>",
  );
  expect(measureSkeletonGeometry(root)?.shapes).toHaveLength(7);
});

it("retains opaque controls, including decorative aria-hidden icons", () => {
  const root = fixture(
    '<div style="opacity:1"><input><button aria-hidden="true"></button></div>',
  );
  expect(measureSkeletonGeometry(root)?.shapes).toHaveLength(6);
});

it("preserves gradient-only native table placeholders without a background color", () => {
  const root = fixture(
    '<i style="background-image:linear-gradient(90deg,#eee,#fff)"></i>',
  );
  expect(measureSkeletonGeometry(root)?.shapes).toHaveLength(5);
});
