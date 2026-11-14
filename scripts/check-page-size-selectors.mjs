import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));
const marker =
  /FILTER_WIDTH\.pageSize|shared\.table\.(perPage|rowsPerPage)|\/ trang|\/ page|pageSizeOption|dashboardAudit\.(perPage|pageSize)|packingLabelReport\.perPage|goodsTraceAudit\.pageSize/;
export function inspect(code, file = "fixture.tsx") {
  const source = ts.createSourceFile(
    file,
    code,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const selectors = [];
  const errors = [];
  function visit(node) {
    if (ts.isJsxSelfClosingElement(node) || ts.isJsxElement(node)) {
      const opening = ts.isJsxElement(node) ? node.openingElement : node;
      const tag = opening.tagName.getText(source);
      const text = node.getText(source);
      const isSelect =
        /(?:Select|Autocomplete|TextField)$/.test(tag) || tag === "select";
      const isPageSize =
        marker.test(text) ||
        /value=\{(?:perPage|pageSize|rowsPerPage)\}/.test(text);
      if (isSelect && isPageSize) {
        const location = `${file}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1}`;
        selectors.push(location);
        const kind = opening.attributes.properties.find(
          (property) =>
            ts.isJsxAttribute(property) &&
            property.name.getText(source) === "kind",
        );
        if (
          tag !== "UiSelect" ||
          !kind?.initializer ||
          !ts.isStringLiteral(kind.initializer) ||
          kind.initializer.text !== "page-size"
        ) {
          errors.push(
            `${location}: page-size controls must use <UiSelect kind="page-size">`,
          );
        }
        const choices = opening.attributes.properties.find(
          (property) =>
            ts.isJsxAttribute(property) &&
            property.name.getText(source) === "options",
        );
        const labels = [];
        function findLabels(child) {
          if (
            ts.isPropertyAssignment(child) &&
            child.name.getText(source) === "label"
          )
            labels.push(child.initializer);
          ts.forEachChild(child, findLabels);
        }
        if (choices) findLabels(choices);
        const localized =
          labels.length > 0 &&
          labels.every(
            (label) =>
              ts.isCallExpression(label) &&
              label.arguments[0] &&
              ts.isStringLiteral(label.arguments[0]) &&
              label.arguments[0].text === "shared.table.perPage",
          );
        if (!localized) {
          errors.push(
            `${location}: use the shared.table.perPage translation for every choice`,
          );
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return { selectors, errors };
}

if (process.argv.includes("--self-test")) {
  const options =
    'options={[10, 20, 50].map(size => ({value: size, label: t("shared.table.perPage", {size})}))}';
  assert.equal(
    inspect(`<UiSelect kind="page-size" ${options} />`).errors.length,
    0,
  );
  assert.equal(inspect(`<UiSelect ${options} />`).errors.length, 1);
  assert.equal(
    inspect("<select value={perPage}><option>20 / trang</option></select>")
      .errors.length,
    2,
  );
  assert.equal(
    inspect('<UiSelect kind="page-size" value={pageSize} options={sizes} />')
      .errors.length,
    1,
  );
  assert.equal(
    inspect("<UiSelect value={status} options={statuses} />").selectors.length,
    0,
  );
  assert.equal(
    inspect(
      '<UiSelect kind="page-size" aria-label={t("shared.table.perPageAria")} options={[{value: 10, label: "10 / trang"}]} />',
    ).errors.length,
    1,
  );
  assert.equal(
    inspect(
      '<UiSelect kind="page-size" options={[{value:10,label:t("shared.table.perPage",{size:10})},{value:20,label:"20 / trang"}]} />',
    ).errors.length,
    1,
  );
  console.log("page-size guard self-test: 7 cases passed");
} else {
  const selectors = [];
  const errors = [];
  function scan(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) scan(file);
      else if (/\.tsx$/.test(file) && !/\.(test|spec)\./.test(file)) {
        const result = inspect(
          fs.readFileSync(file, "utf8"),
          path.relative(root, file).replaceAll("\\", "/"),
        );
        selectors.push(...result.selectors);
        errors.push(...result.errors);
      }
    }
  }
  scan(path.join(root, "src"));
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  } else {
    console.log(
      `page-size guard: ${selectors.length} controls use single-line localized options`,
    );
    if (process.argv.includes("--list")) console.log(selectors.join("\n"));
  }
}
