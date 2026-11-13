import { MESSAGES_VI } from "./messages";
import { englishMessages } from "./english-messages";
import { chineseMessages } from "./chinese-messages";
import { useLanguageStore } from "./language.store";
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
      // Only complete known messages are reversible. Matching templates from
      // another language could mistake user names or identifiers for prose.
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
