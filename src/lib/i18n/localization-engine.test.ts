import { describe, it, expect, beforeEach } from "vitest";
import {
  detectLocaleFromAcceptLanguage,
  formatIcuMessage,
  getTextDirection,
  LocalizationEngine,
  readLocaleCookie,
  SUPPORTED_LOCALES,
} from "./localization-engine";

describe("LocalizationEngine (12 Locales, ICU Syntax, RTL & Fallbacks)", () => {
  let engine: LocalizationEngine;

  beforeEach(() => {
    engine = new LocalizationEngine({ initialLocale: "en" });
  });

  it("supports all 12 required languages with zero missing translation keys", () => {
    expect(SUPPORTED_LOCALES).toHaveLength(12);
    const expectedCodes = [
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
    expect(SUPPORTED_LOCALES.map((l) => l.code)).toEqual(expectedCodes);

    const audit = engine.auditMissingKeys();
    for (const code of expectedCodes) {
      expect(audit[code as keyof typeof audit]).toEqual([]);
    }
  });

  it("enforces Right-to-Left (RTL) direction for Arabic and Hebrew and LTR for others", () => {
    expect(getTextDirection("ar")).toBe("rtl");
    expect(getTextDirection("ar-SA")).toBe("rtl");
    expect(getTextDirection("he")).toBe("rtl");
    expect(getTextDirection("en")).toBe("ltr");
    expect(getTextDirection("hi")).toBe("ltr");
    expect(getTextDirection("ja")).toBe("ltr");

    engine.setLocale("ar", false);
    expect(engine.getDirection()).toBe("rtl");
    expect(engine.isRtl()).toBe(true);
  });

  it("evaluates ICU pluralization rules (=0, one, other, #) and gender select agreement accurately", () => {
    expect(engine.t("dashboard.commitSummary", { count: 0 })).toBe(
      "No commits today"
    );
    expect(engine.t("dashboard.commitSummary", { count: 1 })).toBe(
      "1 commit today"
    );
    expect(engine.t("dashboard.commitSummary", { count: 14 })).toBe(
      "14 commits today"
    );

    expect(engine.t("dashboard.mentorGreeting", { gender: "female" })).toBe(
      "She reached the Diamond League!"
    );
    expect(engine.t("dashboard.mentorGreeting", { gender: "male" })).toBe(
      "He reached the Diamond League!"
    );
    expect(engine.t("dashboard.mentorGreeting", { gender: "nonbinary" })).toBe(
      "They reached the Diamond League!"
    );

    // Custom ICU message formatting check
    const customMsg = formatIcuMessage(
      "{gender, select, female {Her} male {His} other {Their}} {count, plural, =0 {first PR} one {# PR} other {# PRs}} merged!",
      { gender: "female", count: 3 },
      "en"
    );
    expect(customMsg).toBe("Her 3 PRs merged!");
  });

  it("falls back to English default locale when a key is missing in the active locale", () => {
    engine.registerTranslations("en", {
      "experimental.featureBanner": "Quantum Sandbox Enabled",
    });

    engine.setLocale("de", false);
    expect(engine.t("nav.repositories")).toBe("Repositories");
    expect(engine.t("experimental.featureBanner")).toBe(
      "Quantum Sandbox Enabled"
    );
    expect(engine.t("nonexistent.key")).toBe("nonexistent.key");
  });

  it("auto-detects preferred locale from Accept-Language headers and parses cookies", () => {
    expect(
      detectLocaleFromAcceptLanguage("ar-AE,ar;q=0.9,en-US;q=0.8,en;q=0.7")
    ).toBe("ar");
    expect(
      detectLocaleFromAcceptLanguage("fr-CA;q=0.4,ja-JP;q=0.95,en;q=0.5")
    ).toBe("ja");
    expect(detectLocaleFromAcceptLanguage("tlh-KL")).toBe("en");

    expect(readLocaleCookie("theme=dark; codepulse_locale=hi; path=/")).toBe(
      "hi"
    );
  });
});
