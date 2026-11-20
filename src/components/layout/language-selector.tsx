"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Globe, Check, ArrowLeftRight } from "lucide-react";
import {
  DEFAULT_LOCALE,
  defaultLocalizationEngine,
  getLocaleDescriptor,
  LocalizationEngine,
  SUPPORTED_LOCALES,
  SupportedLocale,
  TextDirection,
  TranslationParams,
} from "@/lib/i18n/localization-engine";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface LocalizationContextValue {
  locale: SupportedLocale;
  dir: TextDirection;
  isRtl: boolean;
  setLocale: (locale: SupportedLocale) => void;
  t: (key: string, params?: TranslationParams) => string;
}

const LocalizationContext = createContext<LocalizationContextValue>({
  locale: DEFAULT_LOCALE,
  dir: "ltr",
  isRtl: false,
  setLocale: (locale) => {
    defaultLocalizationEngine.setLocale(locale);
  },
  t: (key, params) => defaultLocalizationEngine.t(key, params),
});

export function LocalizationProvider({
  children,
  engine = defaultLocalizationEngine,
}: {
  children: React.ReactNode;
  engine?: LocalizationEngine;
}) {
  const [locale, setLocaleState] = useState<SupportedLocale>(() =>
    engine.getLocale()
  );

  useEffect(() => {
    engine.applyDocumentAttributes(locale);
    return engine.subscribe((updated) => {
      setLocaleState(updated);
    });
  }, [engine, locale]);

  const setLocale = useCallback(
    (next: SupportedLocale) => {
      const applied = engine.setLocale(next, true);
      setLocaleState(applied);
    },
    [engine]
  );

  const t = useCallback(
    (key: string, params?: TranslationParams) =>
      engine.t(key, params, locale),
    [engine, locale]
  );

  const dir = engine.getDirection(locale);
  const isRtl = dir === "rtl";

  const value = useMemo(
    () => ({
      locale,
      dir,
      isRtl,
      setLocale,
      t,
    }),
    [locale, dir, isRtl, setLocale, t]
  );

  return (
    <LocalizationContext.Provider value={value}>
      <div dir={dir} data-locale={locale} className="contents">
        {children}
      </div>
    </LocalizationContext.Provider>
  );
}

export function useLocalization(): LocalizationContextValue {
  return useContext(LocalizationContext);
}

export function LanguageSelector({ className }: { className?: string }) {
  const { locale, dir, isRtl, setLocale, t } = useLocalization();
  const activeDescriptor = getLocaleDescriptor(locale);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("topbar.languageSelector")}
        data-testid="language-selector-trigger"
        data-dir={dir}
        className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-xs font-medium",
          "border border-white/[0.06] bg-white/[0.03] text-muted-foreground",
          "hover:bg-white/[0.07] hover:text-foreground transition-colors",
          "rtl:flex-row-reverse",
          className
        )}
      >
        <Globe className="h-4 w-4 text-cyan-400 shrink-0" />
        <span className="uppercase tracking-wide font-semibold">
          {activeDescriptor.code}
        </span>
        {isRtl && (
          <span
            data-testid="rtl-direction-badge"
            className="inline-flex items-center gap-0.5 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300"
          >
            <ArrowLeftRight className="h-2.5 w-2.5" />
            RTL
          </span>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align={isRtl ? "start" : "end"}
        dir={dir}
        className="w-64 max-h-80 overflow-y-auto border-white/10 bg-[#0B1120]/95 backdrop-blur-xl"
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{t("topbar.languageSelector")}</span>
            <span className="font-mono text-[10px] uppercase text-cyan-400">
              12 Locales • {dir.toUpperCase()}
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-white/[0.06]" />
          {SUPPORTED_LOCALES.map((item) => {
            const selected = item.code === locale;
            return (
              <DropdownMenuItem
                key={item.code}
                data-testid={`locale-option-${item.code}`}
                onClick={() => setLocale(item.code)}
                className={cn(
                  "flex items-center justify-between gap-2 cursor-pointer rounded-lg px-2.5 py-2 text-xs",
                  "rtl:flex-row-reverse rtl:text-right",
                  selected
                    ? "bg-cyan-500/15 text-cyan-300 font-semibold"
                    : "text-foreground/85 hover:bg-white/[0.06]"
                )}
              >
                <div className="flex items-center gap-2 rtl:flex-row-reverse">
                  <span aria-hidden="true" className="text-sm">
                    {item.flag}
                  </span>
                  <div className="flex flex-col">
                    <span>{item.nativeName}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {item.name} · {item.region}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {item.dir === "rtl" && (
                    <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-mono uppercase text-amber-300">
                      RTL
                    </span>
                  )}
                  {selected && <Check className="h-3.5 w-3.5 text-cyan-400" />}
                </div>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
