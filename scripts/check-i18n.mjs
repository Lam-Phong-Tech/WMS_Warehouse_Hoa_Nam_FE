import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { registerHooks } from "node:module";
import assert from "node:assert/strict";
import ts from "typescript";
import { checkSourceReview } from "./i18n-source-contract.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// These modules contain catalog data and pure merge helpers only. Native Node
// TypeScript support avoids booting React/jsdom merely to inspect dictionaries.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(".")) {
      const target = new URL(specifier, context.parentURL);
      if (
        !path.extname(target.pathname) ||
        !fs.existsSync(fileURLToPath(target))
      ) {
        const typed = pathToFileURL(fileURLToPath(target) + ".ts");
        if (fs.existsSync(fileURLToPath(typed))) {
          return nextResolve(typed.href, context);
        }
      }
    }
    return nextResolve(specifier, context);
  },
});

function leaves(value, prefix = "", output = {}) {
  for (const [key, item] of Object.entries(value)) {
    const name = prefix ? `${prefix}.${key}` : key;
    if (typeof item === "string") output[name] = item;
    else if (item && typeof item === "object") leaves(item, name, output);
  }
  return output;
}

const placeholders = (value) => (value.match(/\{\w+\}/g) ?? []).sort();

export function checkCatalogs(source, targets) {
  const problems = [];
  for (const [language, target] of Object.entries(targets)) {
    for (const [key, value] of Object.entries(source)) {
      if (!Object.hasOwn(target, key))
        problems.push(`${language}: missing ${key}`);
      else if (!target[key].trim()) problems.push(`${language}: empty ${key}`);
      else if (
        JSON.stringify(placeholders(value)) !==
        JSON.stringify(placeholders(target[key]))
      ) {
        problems.push(`${language}: placeholders ${key}`);
      }
    }
    for (const key of Object.keys(target)) {
      if (!Object.hasOwn(source, key))
        problems.push(`${language}: unknown ${key}`);
    }
  }
  return problems;
}

function files(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const name = path.join(directory, entry.name);
    if (entry.isDirectory()) return files(name);
    return /\.tsx?$/.test(name) &&
      !/\.(?:test|spec)\./.test(name) &&
      !name.includes(`${path.sep}test${path.sep}`)
      ? [name]
      : [];
  });
}

export function inspectReferences(text, filename, known) {
  const source = ts.createSourceFile(
    filename,
    text,
    ts.ScriptTarget.Latest,
    true,
    filename.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const names = new Map();
  const hooks = new Set(["useT"]);
  const translatorTypes = new Set(["TranslateFn"]);
  const problems = [];
  const dynamicCalls = [];
  let literalReferences = 0;
  let dynamicReferences = 0;
  const remember = (node) => {
    if (
      ts.isImportDeclaration(node) &&
      /\/useT$/.test(node.moduleSpecifier.text)
    ) {
      for (const item of node.importClause?.namedBindings?.elements ?? []) {
        const imported = item.propertyName?.text ?? item.name.text;
        if (imported === "useT") hooks.add(item.name.text);
        if (imported === "TranslateFn") translatorTypes.add(item.name.text);
        if (["tStatic", "translate"].includes(imported))
          names.set(item.name.text, imported === "translate" ? 1 : 0);
      }
    }
    if (
      ts.isParameter(node) &&
      ts.isIdentifier(node.name) &&
      node.type &&
      ts.isTypeReferenceNode(node.type) &&
      ts.isIdentifier(node.type.typeName) &&
      translatorTypes.has(node.type.typeName.text)
    )
      names.set(node.name.text, 0);
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isCallExpression(node.initializer) &&
      ts.isIdentifier(node.initializer.expression) &&
      hooks.has(node.initializer.expression.text)
    ) {
      names.set(node.name.text, 0);
    }
    ts.forEachChild(node, remember);
  };
  remember(source);
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      names.has(node.expression.text)
    ) {
      const argument = node.arguments[names.get(node.expression.text)];
      if (
        argument &&
        (ts.isStringLiteral(argument) ||
          ts.isNoSubstitutionTemplateLiteral(argument))
      ) {
        literalReferences++;
        if (!Object.hasOwn(known, argument.text)) {
          const { line } = source.getLineAndCharacterOfPosition(
            argument.getStart(),
          );
          problems.push(
            `${filename}:${line + 1}: unknown translation key ${argument.text}`,
          );
        }
      } else {
        dynamicReferences++;
        const { line } = source.getLineAndCharacterOfPosition(node.getStart());
        dynamicCalls.push({
          file: filename,
          line: line + 1,
          expression: argument?.getText(source) ?? "",
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return { problems, literalReferences, dynamicReferences, dynamicCalls };
}

async function main() {
  if (process.argv.includes("--self-test")) {
    const contract = {
      messages: [{ source: "Known", rawSources: ["Known alias"] }],
      unresolved: [],
    };
    assert.equal(
      checkSourceReview(
        [{ source: "Known alias", normalized: "Known" }],
        [],
        contract,
      ).unreviewed.length,
      0,
    );
    assert.equal(
      checkSourceReview([{ source: "Nguồn mới không hợp lệ." }], [], contract)
        .unreviewed.length,
      1,
    );
    assert.equal(
      checkSourceReview(
        [],
        [{ path: "new.php", sink: "ApiError", expression: "$message" }],
        contract,
      ).unreviewedRuntime.length,
      1,
    );
    assert.deepEqual(
      checkCatalogs(
        { greeting: "Hello {name}" },
        { en: { greeting: "Hi {name}" } },
      ),
      [],
    );
    assert.equal(checkCatalogs({ a: "A {n}" }, { zh: {} }).length, 1);
    assert.equal(
      checkCatalogs({ a: "A {n}" }, { zh: { a: "数量 {count}" } }).length,
      1,
    );
    assert.equal(checkCatalogs({ a: "A" }, { en: { a: " " } }).length, 1);
    const sample =
      'import {tStatic as copy} from "@/shared/i18n/useT"; const t=useT(); t("missing"); copy("valid"); t(dynamicKey);';
    const checked = inspectReferences(sample, "sample.ts", { valid: "Valid" });
    assert.equal(checked.problems.length, 1);
    assert.equal(checked.literalReferences, 2);
    assert.equal(checked.dynamicReferences, 1);
    assert.equal(
      inspectReferences(
        'import type {TranslateFn as Copy} from "@/shared/i18n/useT"; function options(label: Copy) {return label("missing");}',
        "helper.ts",
        {},
      ).problems.length,
      1,
    );
    console.log(
      "i18n guard self-test passed (missing/empty/placeholder/key regressions)",
    );
    return;
  }
  const load = (name) =>
    import(pathToFileURL(path.join(root, "src/shared/i18n", name)).href);
  const [{ MESSAGES_VI }, { MESSAGES_EN }, { MESSAGES_ZH }] = await Promise.all(
    [load("messages.ts"), load("messages.en.ts"), load("messages.zh.ts")],
  );
  const vi = leaves(MESSAGES_VI);
  const en = leaves(MESSAGES_EN);
  const zh = leaves(MESSAGES_ZH);
  const problems = checkCatalogs(vi, { en, zh });
  let literalReferences = 0;
  let dynamicReferences = 0;
  const dynamicCalls = [];
  const productionFiles = files(path.join(root, "src"));
  for (const file of productionFiles) {
    const relative = path.relative(root, file).split(path.sep).join("/");
    const result = inspectReferences(
      fs.readFileSync(file, "utf8"),
      relative,
      vi,
    );
    problems.push(...result.problems);
    literalReferences += result.literalReferences;
    dynamicReferences += result.dynamicReferences;
    dynamicCalls.push(...result.dynamicCalls);
  }
  const report = {
    generatedAt: new Date().toISOString(),
    catalogs: {
      vi: Object.keys(vi).length,
      en: Object.keys(en).length,
      zh: Object.keys(zh).length,
    },
    productionFiles: productionFiles.length,
    literalReferences,
    dynamicReferences,
    dynamicCalls,
    problems,
    limits: [
      "Dynamic translation keys require runtime tests.",
      "Catalog parity does not establish every UI state or unknown server message is translated.",
    ],
  };
  const reportIndex = process.argv.indexOf("--report");
  if (reportIndex >= 0) {
    const destination = path.resolve(root, process.argv[reportIndex + 1]);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, JSON.stringify(report, null, 2) + "\n");
  }
  console.log(
    JSON.stringify(
      {
        ...report,
        dynamicCalls: `${dynamicCalls.length} recorded in JSON report`,
      },
      null,
      2,
    ),
  );
  if (problems.length) process.exitCode = 1;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  await main();
