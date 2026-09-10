import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { messages, type Lang, type Messages } from "./messages";
import { obsMessages } from "./obs";

const STORAGE_KEY = "lumi-workbench-lang";

function translate(
  m: Messages,
  obsMap: Record<string, string>,
  key: string,
  vars?: Record<string, string | number>,
): string {
  // Observatory flat-key lookup takes priority.
  const obsVal = obsMap[key];
  if (typeof obsVal === "string") {
    if (!vars) return obsVal;
    return obsVal.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
  }
  // Fall back to navigating the nested messages structure.
  const parts = key.split(".");
  let val: unknown = m;
  for (const p of parts) {
    if (val == null || typeof val !== "object") return key;
    val = (val as Record<string, unknown>)[p];
  }
  if (typeof val !== "string") return key;
  if (!vars) return val;
  return val.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
}

type LanguageContextValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  toggleLang: () => void;
  m: Messages;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

const LANGS: Lang[] = ["en", "fr", "es"];

function readInitialLang(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as Lang | null;
    return stored && LANGS.includes(stored) ? stored : "en";
  } catch {
    return "en";
  }
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readInitialLang);

  const setLang = (next: Lang) => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // localStorage unavailable: keep the in-memory choice only.
    }
    setLangState(next);
  };

  useEffect(() => {
    document.documentElement.lang = lang === "fr" ? "fr-CA" : lang === "es" ? "es" : "en-CA";
    document.title = messages[lang].documentTitle;
  }, [lang]);

  const value = useMemo<LanguageContextValue>(() => ({
    lang,
    setLang,
    toggleLang: () => setLang(LANGS[(LANGS.indexOf(lang) + 1) % LANGS.length]),
    m: messages[lang],
    t: (key, vars) => translate(messages[lang], obsMessages[lang], key, vars),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [lang]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("Language context is unavailable");
  return context;
}

export type { Lang, Messages };
