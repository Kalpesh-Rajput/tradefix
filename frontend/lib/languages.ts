/** ISO 639-1 language codes with localized English display names. */

export type LanguageOption = {
  value: string;
  label: string;
};

/** Complete ISO 639-1 set (two-letter codes). */
const ISO_639_1 = [
  "aa", "ab", "ae", "af", "ak", "am", "an", "ar", "as", "av", "ay", "az",
  "ba", "be", "bg", "bh", "bi", "bm", "bn", "bo", "br", "bs",
  "ca", "ce", "ch", "co", "cr", "cs", "cu", "cv", "cy",
  "da", "de", "dv", "dz",
  "ee", "el", "en", "eo", "es", "et", "eu",
  "fa", "ff", "fi", "fj", "fo", "fr", "fy",
  "ga", "gd", "gl", "gn", "gu", "gv",
  "ha", "he", "hi", "ho", "hr", "ht", "hu", "hy", "hz",
  "ia", "id", "ie", "ig", "ii", "ik", "io", "is", "it", "iu",
  "ja", "jv",
  "ka", "kg", "ki", "kj", "kk", "kl", "km", "kn", "ko", "kr", "ks", "ku", "kv", "kw", "ky",
  "la", "lb", "lg", "li", "ln", "lo", "lt", "lu", "lv",
  "mg", "mh", "mi", "mk", "ml", "mn", "mr", "ms", "mt", "my",
  "na", "nb", "nd", "ne", "ng", "nl", "nn", "no", "nr", "nv", "ny",
  "oc", "oj", "om", "or", "os",
  "pa", "pi", "pl", "ps", "pt",
  "qu",
  "rm", "rn", "ro", "ru", "rw",
  "sa", "sc", "sd", "se", "sg", "si", "sk", "sl", "sm", "sn", "so", "sq", "sr", "ss", "st", "su", "sv", "sw",
  "ta", "te", "tg", "th", "ti", "tk", "tl", "tn", "to", "tr", "ts", "tt", "tw", "ty",
  "ug", "uk", "ur", "uz",
  "ve", "vi", "vo",
  "wa", "wo",
  "xh",
  "yi", "yo",
  "za", "zh", "zu",
] as const;

let _cache: LanguageOption[] | null = null;

export function getLanguageOptions(): LanguageOption[] {
  if (_cache) return _cache;

  const display = new Intl.DisplayNames(["en"], { type: "language" });
  const options: LanguageOption[] = ISO_639_1.map((code) => {
    const name = display.of(code) || code;
    return {
      value: code,
      label: `${name} (${code})`,
    };
  });

  options.sort((a, b) => a.label.localeCompare(b.label, "en"));

  // Pin English to the top for discoverability
  const enIdx = options.findIndex((o) => o.value === "en");
  if (enIdx > 0) {
    const [en] = options.splice(enIdx, 1);
    options.unshift(en);
  }

  _cache = options;
  return options;
}
