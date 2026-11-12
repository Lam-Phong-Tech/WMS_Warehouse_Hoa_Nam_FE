import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("warranty detail drawer date clear", () => {
  it("neo nút bỏ chọn vào đúng ô ngày, không để MUI đổi về relative", () => {
    const css = readFileSync(
      join(__dirname, "warranty-detail-drawer.css"),
      "utf8",
    );
    expect(css).toMatch(
      /\.hn-war-detail-date \.hn-war-detail-date-clear\s*\{[^}]*position:\s*absolute/s,
    );
  });
});
