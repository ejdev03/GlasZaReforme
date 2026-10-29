export const DEFAULT_LOCALE = "sr-Latn";

// Languages offered to residents. The list covers the requested languages and
// Serbia's largest census languages; English is the general fallback.
export const SUPPORTED_LANGUAGES = [
  { code: "sr-Latn", label: "Srpski (latinica)" },
  { code: "sr-Cyrl", label: "Српски (ћирилица)" },
  { code: "hu", label: "Magyar" },
  { code: "sq", label: "Shqip" },
  { code: "bs", label: "Bosanski" },
  { code: "rom", label: "Romani čhib" },
  { code: "sk", label: "Slovenčina" },
  { code: "ro", label: "Română" },
  { code: "hr", label: "Hrvatski" },
  { code: "bg", label: "Български" },
  { code: "mk", label: "Македонски" },
  { code: "ru", label: "Русский" },
  { code: "uk", label: "Українська" },
  { code: "zh-Hans", label: "简体中文" },
  { code: "en", label: "English" },
];

export const SUPPORTED_LOCALES = SUPPORTED_LANGUAGES.map(({ code }) => code);

export function normalizeLocale(value) {
  if (!value) return DEFAULT_LOCALE;
  const normalized = String(value).trim().replaceAll("_", "-");
  const exact = SUPPORTED_LOCALES.find((code) => code.toLowerCase() === normalized.toLowerCase());
  if (exact) return exact;
  const lower = normalized.toLowerCase();
  if (lower.startsWith("sr") && lower.includes("cyrl")) return "sr-Cyrl";
  if (lower.startsWith("sr")) return "sr-Latn";
  if (lower.startsWith("zh")) return "zh-Hans";
  const base = lower.split("-")[0];
  return SUPPORTED_LOCALES.find((code) => code.toLowerCase().split("-")[0] === base) ?? DEFAULT_LOCALE;
}

export function translationTargets(sourceLocale) {
  const source = normalizeLocale(sourceLocale);
  return SUPPORTED_LOCALES.filter((locale) => locale !== source);
}
