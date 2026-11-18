import enCommon from "../../../public/locales/en/common.json";
import hiCommon from "../../../public/locales/hi/common.json";
import esCommon from "../../../public/locales/es/common.json";
import zhCommon from "../../../public/locales/zh/common.json";
import jaCommon from "../../../public/locales/ja/common.json";
import deCommon from "../../../public/locales/de/common.json";
import frCommon from "../../../public/locales/fr/common.json";
import ptCommon from "../../../public/locales/pt/common.json";
import arCommon from "../../../public/locales/ar/common.json";
import ruCommon from "../../../public/locales/ru/common.json";
import bnCommon from "../../../public/locales/bn/common.json";
import koCommon from "../../../public/locales/ko/common.json";

export type SupportedLocale =
  | "en"
  | "hi"
  | "es"
  | "zh"
  | "ja"
  | "de"
  | "fr"
  | "pt"
  | "ar"
  | "ru"
  | "bn"
  | "ko";

export type TextDirection = "ltr" | "rtl";

export interface LocaleDescriptor {
  code: SupportedLocale;
  name: string;
  nativeName: string;
  region: string;
  dir: TextDirection;
  flag: string;
}

export type TranslationDictionary = Record<string, string>;
export type TranslationParams = Record<string, string | number | boolean>;

export const LOCALE_COOKIE_NAME = "codepulse_locale";
export const DEFAULT_LOCALE: SupportedLocale = "en";

export const RTL_LANGUAGE_CODES = new Set<string>(["ar", "he", "fa", "ur"]);

export const SUPPORTED_LOCALES: readonly LocaleDescriptor[] = [
  { code: "en", name: "English", nativeName: "English", region: "Global", dir: "ltr", flag: "🌐" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी", region: "India", dir: "ltr", flag: "🇮🇳" },
  { code: "es", name: "Spanish", nativeName: "Español", region: "LATAM / Spain", dir: "ltr", flag: "🇪🇸" },
  { code: "zh", name: "Mandarin", nativeName: "简体中文", region: "China", dir: "ltr", flag: "🇨🇳" },
  { code: "ja", name: "Japanese", nativeName: "日本語", region: "Japan", dir: "ltr", flag: "🇯🇵" },
  { code: "de", name: "German", nativeName: "Deutsch", region: "Germany", dir: "ltr", flag: "🇩🇪" },
  { code: "fr", name: "French", nativeName: "Français", region: "France", dir: "ltr", flag: "🇫🇷" },
  { code: "pt", name: "Portuguese", nativeName: "Português", region: "Brazil", dir: "ltr", flag: "🇧🇷" },
  { code: "ar", name: "Arabic", nativeName: "العربية", region: "Middle East", dir: "rtl", flag: "🇸🇦" },
  { code: "ru", name: "Russian", nativeName: "Русский", region: "Eastern Europe", dir: "ltr", flag: "🇷🇺" },
  { code: "bn", name: "Bengali", nativeName: "বাংলা", region: "India / Bangladesh", dir: "ltr", flag: "🇧🇩" },
  { code: "ko", name: "Korean", nativeName: "한국어", region: "South Korea", dir: "ltr", flag: "🇰🇷" },
] as const;

export const BUNDLED_LOCALES: Record<SupportedLocale, TranslationDictionary> = {
  en: enCommon,
  hi: hiCommon,
  es: esCommon,
  zh: zhCommon,
  ja: jaCommon,
  de: deCommon,
  fr: frCommon,
  pt: ptCommon,
  ar: arCommon,
  ru: ruCommon,
  bn: bnCommon,
  ko: koCommon,
};

export function isSupportedLocale(locale: string): locale is SupportedLocale {
  return SUPPORTED_LOCALES.some((item) => item.code === locale);
}

export function normalizeLocaleCode(raw?: string | null): SupportedLocale {
  if (!raw) return DEFAULT_LOCALE;
  const cleaned = raw.trim().toLowerCase().replace(/_/g, "-");
  if (isSupportedLocale(cleaned)) return cleaned;
  const base = cleaned.split("-")[0];
  if (isSupportedLocale(base)) return base;
  return DEFAULT_LOCALE;
}

export function getTextDirection(locale: string): TextDirection {
  const base = locale.trim().toLowerCase().split("-")[0];
  return RTL_LANGUAGE_CODES.has(base) ? "rtl" : "ltr";
}

export function getLocaleDescriptor(locale: SupportedLocale): LocaleDescriptor {
  return (
    SUPPORTED_LOCALES.find((item) => item.code === locale) ??
    SUPPORTED_LOCALES[0]
  );
}

/**
 * Parses HTTP Accept-Language headers (e.g. "ar-SA,ar;q=0.9,en-US;q=0.8,en;q=0.7")
 * sorted by q-weight and selects the highest-priority supported locale.
 */
export function detectLocaleFromAcceptLanguage(
  acceptLanguageHeader?: string | null
): SupportedLocale {
  if (!acceptLanguageHeader || !acceptLanguageHeader.trim()) {
    return DEFAULT_LOCALE;
  }

  const weighted = acceptLanguageHeader
    .split(",")
    .map((part) => {
      const [tagPart, ...params] = part.trim().split(";");
      const qParam = params.find((p) => p.trim().startsWith("q="));
      const q = qParam ? parseFloat(qParam.trim().slice(2)) : 1.0;
      return {
        tag: tagPart.trim().toLowerCase(),
        q: Number.isFinite(q) ? q : 0,
      };
    })
    .filter((entry) => entry.tag.length > 0 && entry.q > 0)
    .sort((a, b) => b.q - a.q);

  for (const entry of weighted) {
    if (entry.tag === "*") continue;
    const normalized = entry.tag.replace(/_/g, "-");
    if (isSupportedLocale(normalized)) return normalized;
    const base = normalized.split("-")[0];
    if (isSupportedLocale(base)) return base;
  }

  return DEFAULT_LOCALE;
}

export function readLocaleCookie(cookieString?: string): SupportedLocale | null {
  const source =
    cookieString ?? (typeof document !== "undefined" ? document.cookie : "");
  if (!source) return null;

  const cookies = source.split(";");
  for (const item of cookies) {
    const [rawKey, ...rawValParts] = item.trim().split("=");
    if (rawKey === LOCALE_COOKIE_NAME) {
      const val = decodeURIComponent(rawValParts.join("="));
      return normalizeLocaleCode(val);
    }
  }
  return null;
}

export function writeLocaleCookie(
  locale: SupportedLocale,
  maxAgeSeconds = 365 * 24 * 60 * 60
): void {
  if (typeof document === "undefined") return;
  document.cookie = `${LOCALE_COOKIE_NAME}=${encodeURIComponent(
    locale
  )}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax`;
}

/**
 * Evaluates ICU MessageFormat expressions including:
 * - Simple variable substitution: {name}
 * - Plural rules with exact matches (=0, =1, =2) and CLDR categories (zero, one, two, few, many, other) + '#' replacement
 * - Select rules for gender/role agreement: {gender, select, female {...} male {...} other {...}}
 */
export function formatIcuMessage(
  template: string,
  params: TranslationParams = {},
  locale: string = DEFAULT_LOCALE
): string {
  if (!template.includes("{")) {
    return template;
  }

  let result = "";
  let i = 0;

  while (i < template.length) {
    if (template[i] === "'") {
      if (template[i + 1] === "'") {
        result += "'";
        i += 2;
        continue;
      }
      const closeQuote = template.indexOf("'", i + 1);
      if (closeQuote !== -1) {
        result += template.slice(i + 1, closeQuote);
        i = closeQuote + 1;
        continue;
      }
    }

    if (template[i] !== "{") {
      result += template[i];
      i += 1;
      continue;
    }

    const endBrace = findMatchingBrace(template, i);
    if (endBrace === -1) {
      result += template.slice(i);
      break;
    }

    const expr = template.slice(i + 1, endBrace).trim();
    result += evaluateIcuExpression(expr, params, locale);
    i = endBrace + 1;
  }

  return result;
}

function findMatchingBrace(str: string, openIdx: number): number {
  let depth = 0;
  for (let idx = openIdx; idx < str.length; idx++) {
    if (str[idx] === "{") depth += 1;
    else if (str[idx] === "}") {
      depth -= 1;
      if (depth === 0) return idx;
    }
  }
  return -1;
}

function evaluateIcuExpression(
  expr: string,
  params: TranslationParams,
  locale: string
): string {
  const firstComma = expr.indexOf(",");
  if (firstComma === -1) {
    const val = params[expr];
    return val !== undefined && val !== null ? String(val) : `{${expr}}`;
  }

  const argName = expr.slice(0, firstComma).trim();
  const rest = expr.slice(firstComma + 1).trim();
  const secondComma = rest.indexOf(",");

  if (secondComma === -1) {
    const val = params[argName];
    return val !== undefined && val !== null ? String(val) : `{${argName}}`;
  }

  const formatType = rest.slice(0, secondComma).trim().toLowerCase();
  const optionsBody = rest.slice(secondComma + 1).trim();
  const branches = parseIcuBranches(optionsBody);

  if (formatType === "plural" || formatType === "selectordinal") {
    const rawNum = Number(params[argName] ?? 0);
    const num = Number.isFinite(rawNum) ? rawNum : 0;
    const exactKey = `=${num}`;

    let selectedTemplate = branches[exactKey];
    if (selectedTemplate === undefined) {
      const pluralRule = new Intl.PluralRules(locale, {
        type: formatType === "selectordinal" ? "ordinal" : "cardinal",
      });
      const category = pluralRule.select(num);
      selectedTemplate = branches[category] ?? branches.other ?? "";
    }

    const formattedNumber = new Intl.NumberFormat(locale).format(num);
    const withHashReplaced = selectedTemplate.replace(/#/g, formattedNumber);
    return formatIcuMessage(withHashReplaced, params, locale);
  }

  if (formatType === "select") {
    const key = String(params[argName] ?? "other").trim();
    const selectedTemplate = branches[key] ?? branches.other ?? "";
    return formatIcuMessage(selectedTemplate, params, locale);
  }

  const fallbackVal = params[argName];
  return fallbackVal !== undefined ? String(fallbackVal) : "";
}

function parseIcuBranches(body: string): Record<string, string> {
  const branches: Record<string, string> = {};
  let cursor = 0;

  while (cursor < body.length) {
    while (cursor < body.length && /\s/.test(body[cursor])) cursor += 1;
    if (cursor >= body.length) break;

    const openBrace = body.indexOf("{", cursor);
    if (openBrace === -1) break;

    const selector = body.slice(cursor, openBrace).trim();
    const closeBrace = findMatchingBrace(body, openBrace);
    if (closeBrace === -1) break;

    branches[selector] = body.slice(openBrace + 1, closeBrace);
    cursor = closeBrace + 1;
  }

  return branches;
}

export class LocalizationEngine {
  private currentLocale: SupportedLocale;
  private readonly dictionaries = new Map<
    SupportedLocale,
    TranslationDictionary
  >();
  private readonly listeners = new Set<(locale: SupportedLocale) => void>();

  constructor(options?: {
    initialLocale?: SupportedLocale;
    dictionaries?: Partial<Record<SupportedLocale, TranslationDictionary>>;
  }) {
    for (const locale of SUPPORTED_LOCALES) {
      this.dictionaries.set(locale.code, {
        ...BUNDLED_LOCALES[locale.code],
        ...(options?.dictionaries?.[locale.code] ?? {}),
      });
    }

    if (options?.initialLocale) {
      this.currentLocale = normalizeLocaleCode(options.initialLocale);
    } else {
      const cookieLocale = readLocaleCookie();
      if (cookieLocale) {
        this.currentLocale = cookieLocale;
      } else if (typeof navigator !== "undefined" && navigator.language) {
        this.currentLocale = normalizeLocaleCode(navigator.language);
      } else {
        this.currentLocale = DEFAULT_LOCALE;
      }
    }
  }

  getLocale(): SupportedLocale {
    return this.currentLocale;
  }

  getDirection(locale: string = this.currentLocale): TextDirection {
    return getTextDirection(locale);
  }

  isRtl(locale: string = this.currentLocale): boolean {
    return this.getDirection(locale) === "rtl";
  }

  getSupportedLocales(): readonly LocaleDescriptor[] {
    return SUPPORTED_LOCALES;
  }

  setLocale(nextLocale: string, persistCookie = true): SupportedLocale {
    const normalized = normalizeLocaleCode(nextLocale);
    this.currentLocale = normalized;

    if (persistCookie) {
      writeLocaleCookie(normalized);
    }

    this.applyDocumentAttributes(normalized);
    for (const listener of this.listeners) {
      listener(normalized);
    }
    return normalized;
  }

  applyDocumentAttributes(locale: SupportedLocale = this.currentLocale): void {
    if (typeof document === "undefined") return;
    const dir = this.getDirection(locale);
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
    document.documentElement.setAttribute("data-locale", locale);
    document.documentElement.setAttribute("data-dir", dir);
  }

  subscribe(listener: (locale: SupportedLocale) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  registerTranslations(
    locale: SupportedLocale,
    entries: TranslationDictionary
  ): void {
    const existing = this.dictionaries.get(locale) ?? {};
    this.dictionaries.set(locale, { ...existing, ...entries });
  }

  t(
    key: string,
    params?: TranslationParams,
    localeOverride?: SupportedLocale
  ): string {
    const activeLocale = localeOverride ?? this.currentLocale;
    const activeDict = this.dictionaries.get(activeLocale);
    const fallbackDict = this.dictionaries.get(DEFAULT_LOCALE);

    const template = activeDict?.[key] ?? fallbackDict?.[key];
    if (!template) {
      return key;
    }

    return formatIcuMessage(template, params, activeLocale);
  }

  auditMissingKeys(): Record<SupportedLocale, string[]> {
    const baseline = this.dictionaries.get(DEFAULT_LOCALE) ?? {};
    const baselineKeys = Object.keys(baseline);
    const report = {} as Record<SupportedLocale, string[]>;

    for (const locale of SUPPORTED_LOCALES) {
      const target = this.dictionaries.get(locale.code) ?? {};
      report[locale.code] = baselineKeys.filter(
        (key) => typeof target[key] !== "string" || target[key].trim() === ""
      );
    }

    return report;
  }
}

export const defaultLocalizationEngine = new LocalizationEngine();
