import { MESSAGES_VI } from "./messages";
import { englishMessages } from "./english-messages";
import { chineseMessages } from "./chinese-messages";
import { useLanguageStore } from "./language.store";
import { translateBackendCatalogMessage } from "./backend-message-catalog";
import {
  BACKEND_MESSAGES,
  VALIDATION_MESSAGES,
  VALIDATION_ATTRIBUTES,
} from "./server-message-catalog";
import {
  BACKEND_MESSAGES_ZH,
  VALIDATION_MESSAGES_ZH,
  VALIDATION_ATTRIBUTES_ZH,
} from "./server-message-catalog.zh";

type Entry = { source: string; target: string };
function entries(source: unknown, target: unknown): Entry[] {
  if (typeof source === "string" && typeof target === "string")
    return [{ source, target }];
  if (
    !source ||
    !target ||
    typeof source !== "object" ||
    typeof target !== "object"
  )
    return [];
  return Object.entries(source).flatMap(([key, value]) =>
    entries(value, (target as Record<string, unknown>)[key]),
  );
}
let cachedTarget: unknown;
let cachedEntries: Entry[] = [];
function catalog(target: unknown) {
  if (cachedTarget !== target) {
    cachedTarget = target;
    cachedEntries = entries(MESSAGES_VI, target);
  }
  return cachedEntries;
}
let cachedAlternateSource: unknown;
let cachedAlternateTarget: unknown;
let cachedAlternateExact = new Map<string, string>();
function alternateExactCatalog(source: unknown, target: unknown) {
  if (cachedAlternateSource !== source || cachedAlternateTarget !== target) {
    cachedAlternateSource = source;
    cachedAlternateTarget = target;
    cachedAlternateExact = new Map();
    for (const entry of entries(source, target)) {
      // Exact reversal also covers short labels; templates use the stricter
      // fixed-prose and numeric-capture checks below.
      if (
        !/\{\w+\}/.test(entry.source) &&
        !cachedAlternateExact.has(entry.source)
      )
        cachedAlternateExact.set(entry.source, entry.target);
    }
  }
  return cachedAlternateExact;
}
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const numericParameter =
  /^(min|max|count|decimals|limit|size|length|total|seconds|minutes|days|months|hours|attempts|remaining|maximum|minimum)$/i;
const numericValue = /^[+-]?\d(?:[\d.,\s\u00a0\u202f]*\d)?%?$/u;
let cachedTemplateSource: unknown;
let cachedTemplateTarget: unknown;
let cachedAlternateTemplates: Array<{
  entry: Entry;
  names: string[];
  pattern: RegExp;
  specificity: number;
}> = [];

function alternateTemplates(source: unknown, target: unknown) {
  if (cachedTemplateSource !== source || cachedTemplateTarget !== target) {
    cachedTemplateSource = source;
    cachedTemplateTarget = target;
    cachedAlternateTemplates = entries(source, target)
      .flatMap((entry) => {
        const names = [...entry.source.matchAll(/\{(\w+)\}/g)].map(
          (match) => match[1],
        );
        if (!names.length) return [];
        const literal = entry.source.replace(/\{\w+\}/g, "");
        const prefix = entry.source.split(/\{\w+\}/)[0].trim();
        const numericConstraint =
          names.every((name) => numericParameter.test(name)) &&
          /\b(must|at least|at most|cannot|exceed|characters|allowed|required)\b|至少|不得|不能|不超过|最多|必须|允许|字符/u.test(
            literal,
          );
        const specificProse = prefix.length >= 8 && literal.length >= 28;
        const specificChinese =
          /\p{Script=Han}/u.test(literal) &&
          prefix.length >= 4 &&
          literal.length >= 12;
        const specificField =
          names.includes("attribute") &&
          prefix.length >= 4 &&
          literal.length >= 24;
        if (
          !(numericConstraint && prefix.length >= 2 && literal.length >= 4) &&
          !specificProse &&
          !specificChinese &&
          !specificField
        )
          return [];
        const parts = entry.source
          .split(/(\{\w+\})/g)
          .map((part) =>
            /^\{\w+\}$/.test(part) ? "([\\s\\S]*?)" : escape(part),
          );
        return [
          {
            entry,
            names,
            pattern: new RegExp(`^${parts.join("")}$`, "u"),
            specificity: literal.length,
          },
        ];
      })
      .sort((a, b) => b.specificity - a.specificity);
  }
  return cachedAlternateTemplates;
}

function reverseUiTemplate(
  message: string,
  source: unknown,
  target: unknown,
): string | undefined {
  for (const { entry, names, pattern } of alternateTemplates(source, target)) {
    const match = pattern.exec(message);
    if (
      !match ||
      names.some(
        (name, index) =>
          numericParameter.test(name) && !numericValue.test(match[index + 1]),
      )
    )
      continue;
    return entry.target.replace(/\{(\w+)\}/g, (placeholder, name: string) => {
      const index = names.indexOf(name);
      if (index < 0) return placeholder;
      const value = match[index + 1];
      return name === "attribute"
        ? (alternateExactCatalog(source, target).get(value) ?? value)
        : value;
    });
  }
  return undefined;
}
const normalizedAttributes = (attributes: Record<string, string>) =>
  Object.fromEntries(
    Object.entries(attributes).map(([source, target]) => [
      source.toLocaleLowerCase("vi"),
      target,
    ]),
  );
const englishAttributes = normalizedAttributes(VALIDATION_ATTRIBUTES);
const chineseAttributes = normalizedAttributes(VALIDATION_ATTRIBUTES_ZH);

/** Translate only known prose/templates. Captured names, codes and quantities remain data. */
function matchTemplate(
  message: string,
  source: string,
  target: string,
  attributeLabel?: (value: string) => string,
): string | undefined {
  // Label-only templates such as `{code}` match every possible message and
  // would swallow untranslated backend prose before its specific rule runs.
  if (!/\p{L}/u.test(source.replace(/\{\w+\}/g, ""))) return undefined;
  const names: string[] = [];
  const parts = source.split(/(\{\w+\})/g).map((part) => {
    if (/^\{\w+\}$/.test(part)) {
      names.push(part.slice(1, -1));
      return "(.+?)";
    }
    return escape(part);
  });
  if (!names.length) return undefined;
  const match = new RegExp(`^${parts.join("")}$`, "iu").exec(message);
  if (!match) return undefined;
  return target.replace(/\{(\w+)\}/g, (placeholder, name: string) => {
    const index = names.indexOf(name);
    return index < 0
      ? placeholder
      : name === "attribute" && attributeLabel
        ? attributeLabel(match[index + 1])
        : match[index + 1];
  });
}

export function localizeMessage(message: string): string {
  return localizeMessageWithDepth(message, 0);
}

function localizeMessageWithDepth(message: string, nesting: number): string {
  const language = useLanguageStore.getState().language;
  if (language === "vi" || !message) return message;
  const target = language === "en" ? englishMessages() : chineseMessages();
  const known = catalog(target);
  const trimmed = message.trim();
  const exact = known.find(({ source }) => source === trimmed);
  if (exact) return exact.target;
  // Client services sometimes capture tStatic() in an Error before the user
  // switches languages. Reverse only exact messages from the loaded catalog.
  const alternate = language === "zh" ? englishMessages() : chineseMessages();
  const alternateExact = alternateExactCatalog(alternate, target).get(trimmed);
  if (alternateExact !== undefined) return alternateExact;
  const backendMessages =
    language === "zh" ? BACKEND_MESSAGES_ZH : BACKEND_MESSAGES;
  const validationMessages =
    language === "zh" ? VALIDATION_MESSAGES_ZH : VALIDATION_MESSAGES;
  const validationAttributes =
    language === "zh" ? chineseAttributes : englishAttributes;
  const backend = Object.hasOwn(backendMessages, trimmed)
    ? backendMessages[trimmed]
    : undefined;
  if (backend) return backend;
  const catalogMessage = translateBackendCatalogMessage(
    trimmed,
    language,
    (nested) =>
      nesting < 4 ? localizeMessageWithDepth(nested, nesting + 1) : nested,
  );
  if (catalogMessage !== undefined) return catalogMessage;
  const retainedUiMessage = reverseUiTemplate(trimmed, alternate, target);
  if (retainedUiMessage !== undefined) return retainedUiMessage;
  for (const [source, translatedTemplate] of validationMessages) {
    const translated = matchTemplate(
      trimmed,
      source,
      translatedTemplate,
      (value) =>
        known.find(
          ({ source: label }) =>
            label.toLocaleLowerCase("vi") === value.toLocaleLowerCase("vi"),
        )?.target ??
        (Object.hasOwn(validationAttributes, value.toLocaleLowerCase("vi"))
          ? validationAttributes[value.toLocaleLowerCase("vi")]
          : undefined) ??
        value,
    );
    if (translated !== undefined) return translated;
  }
  // Backend validation rules understand field labels. Generic UI templates
  // such as `Vui lòng nhập {value0}.` would preserve a captured Vietnamese
  // field name as user data, so they must run after those specific rules.
  for (const entry of known) {
    const translated = matchTemplate(trimmed, entry.source, entry.target);
    if (translated !== undefined) return translated;
  }
  // Unknown business prose remains available; never replace detailed server errors with a generic failure.
  return message;
}
