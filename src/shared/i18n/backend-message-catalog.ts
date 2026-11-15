import { BACKEND_CATALOG_BATCH_1 } from "./backend-catalog-batch-1";
import { BACKEND_CATALOG_BATCH_2 } from "./backend-catalog-batch-2";
import { BACKEND_CATALOG_BATCH_3 } from "./backend-catalog-batch-3";
import { BACKEND_CATALOG_BATCH_4 } from "./backend-catalog-batch-4";
import { BACKEND_CATALOG_BATCH_5 } from "./backend-catalog-batch-5";
import { BACKEND_CATALOG_BATCH_6 } from "./backend-catalog-batch-6";
import { BACKEND_CATALOG_BATCH_7 } from "./backend-catalog-batch-7";
import { BACKEND_CATALOG_BATCH_8 } from "./backend-catalog-batch-8";
import { BACKEND_CATALOG_BATCH_9 } from "./backend-catalog-batch-9";
import { BACKEND_CATALOG_BATCH_9_DYNAMIC } from "./backend-catalog-batch-9-dynamic";
import { BACKEND_CLIENT_ERRORS } from "./backend-catalog-client-errors";
import { FRONTEND_SERVICE_MESSAGES } from "./frontend-service-catalog";
import { translateBackendParameter } from "./backend-catalog-parameters";
import type { BackendCatalogEntry } from "./backend-catalog.types";
import { BACKEND_MESSAGES } from "./server-message-catalog";
import { BACKEND_MESSAGES_ZH } from "./server-message-catalog.zh";

export const BACKEND_CATALOG: ReadonlyArray<BackendCatalogEntry> = [
  ...BACKEND_CATALOG_BATCH_1,
  ...BACKEND_CATALOG_BATCH_2,
  ...BACKEND_CATALOG_BATCH_3,
  ...BACKEND_CATALOG_BATCH_4,
  ...BACKEND_CATALOG_BATCH_5,
  ...BACKEND_CATALOG_BATCH_6,
  ...BACKEND_CATALOG_BATCH_7,
  ...BACKEND_CATALOG_BATCH_8,
  ...BACKEND_CATALOG_BATCH_9,
  ...BACKEND_CATALOG_BATCH_9_DYNAMIC,
  ...BACKEND_CLIENT_ERRORS,
  ...FRONTEND_SERVICE_MESSAGES,
];

const exact = new Map<string, BackendCatalogEntry>();
const retainedExact = new Map<string, BackendCatalogEntry>();
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function compileTemplate(entry: BackendCatalogEntry, source = entry[0]) {
  const names: string[] = [];
  const parts = source.split(/(\{value\d+\})/g).map((part) => {
    if (/^\{value\d+\}$/.test(part)) {
      names.push(part.slice(1, -1));
      return "([\\s\\S]*?)";
    }
    return escape(part);
  });
  return {
    entry,
    names,
    specificity: source.replace(/\{value\d+\}/g, "").length,
    pattern: new RegExp(`^${parts.join("")}$`, "u"),
  };
}
const templates = BACKEND_CATALOG.filter(([source]) =>
  /\{value\d+\}/.test(source),
)
  .map((entry) => compileTemplate(entry))
  .sort((a, b) => b.specificity - a.specificity);

// Retained client errors may already contain a translated message when the
// language changes. Generic value-led prose is deliberately not reversed.
const retainedTemplates = BACKEND_CATALOG.filter((entry) => {
  if (!/\{value\d+\}/.test(entry[0])) return false;
  const prefix = entry[0].split(/\{value\d+\}/)[0];
  return (
    entry[4] ||
    (prefix.trim().length >= 4 &&
      entry[0].replace(/\{value\d+\}/g, "").length >= 16)
  );
})
  .flatMap((entry) =>
    [1, 2].flatMap((index) => {
      const source = entry[index] as string;
      return /^\{value\d+\}/.test(source) && !entry[4]
        ? []
        : [compileTemplate(entry, source)];
    }),
  )
  .sort((a, b) => b.specificity - a.specificity);
const allTemplates = [...templates, ...retainedTemplates];

for (const entry of BACKEND_CATALOG) {
  if (!/\{value\d+\}/.test(entry[0])) {
    exact.set(entry[0], entry);
    retainedExact.set(entry[1], entry);
    retainedExact.set(entry[2], entry);
  }
}
for (const [source, en] of Object.entries(BACKEND_MESSAGES)) {
  const zh = BACKEND_MESSAGES_ZH[source];
  if (!zh) continue;
  const entry: BackendCatalogEntry = [source, en, zh];
  retainedExact.set(en, entry);
  retainedExact.set(zh, entry);
}

/** Compiled once; performs no blanket word/enum replacement on API values. */
export function translateBackendCatalogMessage(
  message: string,
  language: "en" | "zh",
  translateNested: (message: string) => string = (value) => value,
): string | undefined {
  const targetIndex = language === "en" ? 1 : 2;
  const entry = exact.get(message) ?? retainedExact.get(message);
  if (entry) return entry[targetIndex];
  for (const { entry: template, names, pattern } of allTemplates) {
    const match = pattern.exec(message);
    if (!match) continue;
    if (
      template[4] &&
      Object.entries(template[4]).some(
        ([name, values]) => !values.includes(match[names.indexOf(name) + 1]),
      )
    )
      continue;
    return template[targetIndex].replace(/\{value\d+\}/g, (placeholder) => {
      const name = placeholder.slice(1, -1);
      const value = match[names.indexOf(name) + 1];
      const kind = template[3]?.[name];
      return kind
        ? translateBackendParameter(value, kind, language, translateNested)
        : value;
    });
  }
  return undefined;
}
