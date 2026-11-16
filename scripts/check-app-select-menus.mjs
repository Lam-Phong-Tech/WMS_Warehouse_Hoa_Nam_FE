import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));
function inspect(code, file = "fixture.tsx") {
  const source = ts.createSourceFile(
    file,
    code,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const errors = [];
  const nativeNames = new Set(["NativeSelect"]);
  for (const node of source.statements) {
    if (
      !ts.isImportDeclaration(node) ||
      !ts.isStringLiteral(node.moduleSpecifier)
    )
      continue;
    const clause = node.importClause;
    const nativeModule = /(?:^|\/)NativeSelect(?:\/index)?(?:\.js)?$/.test(
      node.moduleSpecifier.text,
    );
    if (nativeModule && clause?.name) nativeNames.add(clause.name.text);
    if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) {
      for (const specifier of clause.namedBindings.elements) {
        const imported = (specifier.propertyName ?? specifier.name).text;
        if (
          imported === "NativeSelect" ||
          (nativeModule && imported === "default")
        )
          nativeNames.add(specifier.name.text);
      }
    }
  }
  function visit(node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(source);
      const nativeAttribute = node.attributes.properties.some(
        (prop) =>
          ts.isJsxAttribute(prop) &&
          prop.name.getText(source) === "native" &&
          (!prop.initializer ||
            (ts.isJsxExpression(prop.initializer) &&
              prop.initializer.expression?.kind === ts.SyntaxKind.TrueKeyword)),
      );
      if (
        tag === "select" ||
        nativeNames.has(tag) ||
        tag.endsWith(".NativeSelect") ||
        nativeAttribute
      )
        errors.push(node);
    }
    if (
      ts.isCallExpression(node) &&
      /(?:^|\.)createElement$/.test(node.expression.getText(source)) &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0]) &&
      node.arguments[0].text === "select"
    )
      errors.push(node);
    if (
      ts.isPropertyAssignment(node) &&
      node.name.getText(source) === "native" &&
      node.initializer.kind === ts.SyntaxKind.TrueKeyword
    )
      errors.push(node);
    ts.forEachChild(node, visit);
  }
  visit(source);
  return errors.map(
    (node) =>
      `${file}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}: dùng UiSelect/UiFormSelect thay menu select mặc định của trình duyệt`,
  );
}

if (process.argv.includes("--self-test")) {
  for (const code of [
    "const x = <select />;",
    'import { NativeSelect as Choice } from "@mui/material"; const x = <Choice />;',
    'import Choice from "@mui/material/NativeSelect"; const x = <Choice />;',
    "const x = <Select native />;",
    'React.createElement("select", null);',
    "const x = { select: { native: true } };",
  ])
    assert.equal(inspect(code).length, 1);
  assert.equal(
    inspect(
      '// <select> example\nconst x = <UiSelect options={[]} value="" onChange={() => {}} />;',
    ).length,
    0,
  );
  assert.equal(inspect("const x = <Select native={false} />;").length, 0);
  console.log("[ui:select-menus] self-test PASS");
} else {
  const errors = [];
  function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (
        entry.isDirectory() &&
        absolute !== path.join(root, "src", "test") &&
        entry.name !== "__tests__"
      )
        walk(absolute);
      else if (
        /\.tsx?$/.test(entry.name) &&
        !/\.(test|spec)\./.test(entry.name)
      )
        errors.push(
          ...inspect(
            fs.readFileSync(absolute, "utf8"),
            path.relative(root, absolute),
          ),
        );
    }
  }
  walk(path.join(root, "src"));
  if (errors.length) {
    console.error(
      `[ui:select-menus] FAIL — ${errors.length} vị trí:\n${errors.join("\n")}`,
    );
    process.exitCode = 1;
  } else
    console.log(
      "[ui:select-menus] PASS — không còn menu select mặc định trong mã ứng dụng",
    );
}
