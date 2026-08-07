import { SUPPORTED_LANGUAGES } from "@/lib/i18n";

export type LanguageOption = {
  value: string;
  label: string;
};

/** Languages with real UI translations (not the full ISO-639 list). */
export function getLanguageOptions(): LanguageOption[] {
  return SUPPORTED_LANGUAGES.map((l) => ({ value: l.value, label: l.label }));
}
