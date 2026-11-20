import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  LanguageSelector,
  LocalizationProvider,
  useLocalization,
} from "./language-selector";
import { LocalizationEngine } from "@/lib/i18n/localization-engine";

function Probe() {
  const { locale, dir, t } = useLocalization();
  return (
    <div>
      <span data-testid="active-locale">{locale}</span>
      <span data-testid="active-dir">{dir}</span>
      <span data-testid="translated-nav">{t("nav.dashboard")}</span>
    </div>
  );
}

describe("LanguageSelector & RTL Layout Mirroring", () => {
  beforeEach(() => {
    document.documentElement.dir = "ltr";
    document.documentElement.lang = "en";
  });

  it("switches language instantaneously without page reload and mirrors document dir='rtl' for Arabic", () => {
    const engine = new LocalizationEngine({ initialLocale: "en" });

    render(
      <LocalizationProvider engine={engine}>
        <LanguageSelector />
        <Probe />
      </LocalizationProvider>
    );

    expect(screen.getByTestId("active-locale").textContent).toBe("en");
    expect(screen.getByTestId("active-dir").textContent).toBe("ltr");
    expect(screen.getByTestId("translated-nav").textContent).toBe("Dashboard");

    // Open dropdown and select Arabic (ar)
    const trigger = screen.getByTestId("language-selector-trigger");
    fireEvent.click(trigger);

    const arabicOption = screen.getByTestId("locale-option-ar");
    fireEvent.click(arabicOption);

    expect(screen.getByTestId("active-locale").textContent).toBe("ar");
    expect(screen.getByTestId("active-dir").textContent).toBe("rtl");
    expect(document.documentElement.dir).toBe("rtl");
    expect(document.documentElement.lang).toBe("ar");
    expect(screen.getByTestId("rtl-direction-badge")).toBeDefined();
    expect(screen.getByTestId("translated-nav").textContent).toBe(
      "لوحة التحكم"
    );
  });
});
