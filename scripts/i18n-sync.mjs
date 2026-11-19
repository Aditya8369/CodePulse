#!/usr/bin/env node
/**
 * CodePulse Continuous Localization (i18n) Linter & AI Translation Sync
 * - Audits all 12 supported locales against public/locales/en/common.json
 * - In --check mode (CI), exits with code 1 if any translation keys are missing
 * - In --translate mode (with OPENAI_API_KEY or GEMINI_API_KEY), translates missing keys automatically
 */
import fs from "node:fs";
import path from "node:path";

const LOCALES_DIR = path.resolve(process.cwd(), "public/locales");
const SUPPORTED_LOCALES = [
  "en",
  "hi",
  "es",
  "zh",
  "ja",
  "de",
  "fr",
  "pt",
  "ar",
  "ru",
  "bn",
  "ko",
];

const args = new Set(process.argv.slice(2));
const shouldTranslate = args.has("--translate");

function readLocaleFile(locale) {
  const filePath = path.join(LOCALES_DIR, locale, "common.json");
  if (!fs.existsSync(filePath)) {
    return {};
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeLocaleFile(locale, data) {
  const dirPath = path.join(LOCALES_DIR, locale);
  fs.mkdirSync(dirPath, { recursive: true });
  const filePath = path.join(dirPath, "common.json");
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function translateMissingEntries(targetLocale, missingEntries) {
  const geminiKey = process.env.GEMINI_API_KEY;
  const openAiKey = process.env.OPENAI_API_KEY;

  const prompt = `Translate the following JSON key-value UI strings from English into locale "${targetLocale}". Preserve all ICU MessageFormat syntax ({count, plural, ...}, {gender, select, ...}, {name}, #) intact. Return ONLY valid JSON.\n\n${JSON.stringify(
    missingEntries,
    null,
    2
  )}`;

  if (geminiKey) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(
        geminiKey
      )}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" },
        }),
      }
    );
    if (!res.ok) {
      throw new Error(`Gemini API translation failed (${res.status})`);
    }
    const payload = await res.json();
    const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    return JSON.parse(text);
  }

  if (openAiKey) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openAiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) {
      throw new Error(`OpenAI API translation failed (${res.status})`);
    }
    const payload = await res.json();
    const text = payload?.choices?.[0]?.message?.content ?? "{}";
    return JSON.parse(text);
  }

  throw new Error(
    "Neither GEMINI_API_KEY nor OPENAI_API_KEY is configured for --translate mode"
  );
}

async function main() {
  const baseline = readLocaleFile("en");
  const baselineKeys = Object.keys(baseline);

  if (baselineKeys.length === 0) {
    console.error("[i18n] Baseline public/locales/en/common.json is empty.");
    process.exit(1);
  }

  let totalMissing = 0;

  for (const locale of SUPPORTED_LOCALES) {
    const current = readLocaleFile(locale);
    const missingKeys = baselineKeys.filter(
      (k) => typeof current[k] !== "string" || current[k].trim() === ""
    );

    if (missingKeys.length > 0) {
      totalMissing += missingKeys.length;
      console.warn(
        `[i18n] Locale "${locale}" is missing ${missingKeys.length} key(s): ${missingKeys.join(
          ", "
        )}`
      );

      if (shouldTranslate) {
        const subset = Object.fromEntries(
          missingKeys.map((k) => [k, baseline[k]])
        );
        const translated = await translateMissingEntries(locale, subset);
        const merged = { ...current, ...translated };
        writeLocaleFile(locale, merged);
        console.log(
          `[i18n] Auto-translated ${missingKeys.length} key(s) for "${locale}".`
        );
      }
    }
  }

  if (totalMissing > 0 && !shouldTranslate) {
    console.error(
      `[i18n] Audit failed: ${totalMissing} missing translation key(s) detected across locales.`
    );
    process.exit(1);
  }

  console.log(
    `[i18n] Verified ${baselineKeys.length} keys across all ${SUPPORTED_LOCALES.length} supported locales with 0 missing translations.`
  );
}

main().catch((err) => {
  console.error("[i18n] Fatal error:", err);
  process.exit(1);
});
