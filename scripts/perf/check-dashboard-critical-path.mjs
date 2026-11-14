import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Inspect emitted static imports, not source imports: shared chunks can pull
// detail-only dependencies back onto the initial dashboard request graph.
const assets = fileURLToPath(new URL("../../dist/assets/", import.meta.url));
const files = fs.readdirSync(assets);
const entry = files.find((file) => /^DashboardPage-.*\.js$/.test(file));
assert.ok(
  entry,
  "Build the frontend before checking the dashboard critical path",
);
const visited = new Set();
function visit(file) {
  if (visited.has(file)) return;
  visited.add(file);
  const code = fs.readFileSync(path.join(assets, file), "utf8");
  for (const match of code.matchAll(
    /(?:from|import)\s*["']\.\/([^"']+\.js)["']/g,
  )) {
    visit(match[1]);
  }
}
visit(entry);
const detailChunks = [...visited].filter((file) =>
  /^(DashboardSystemViews|ResponsiveDataTable)-/.test(file),
);
assert.deepEqual(
  detailChunks,
  [],
  "Dashboard overview must not wait for detail tables",
);
console.log(
  JSON.stringify(
    {
      entry,
      staticChunks: visited.size,
      staticBytes: [...visited].reduce(
        (sum, file) => sum + fs.statSync(path.join(assets, file)).size,
        0,
      ),
      detailChunks,
    },
    null,
    2,
  ),
);
