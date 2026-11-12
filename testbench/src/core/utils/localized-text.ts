import type { LocalizedText } from "../schema";

/**
 * Resolves a {@link LocalizedText} value to a plain string for the given language.
 *
 * Resolution order:
 * 1. If `text` is already a plain string, return it directly.
 * 2. If `text` is a record, look up `language` first.
 * 3. Fall back to the explicit `fallback` parameter if provided.
 * 4. Fall back to the first available value in the record.
 * 5. Return an empty string if nothing is available.
 *
 * @param text     - The localized text value (string or record).
 * @param language - The desired language code (e.g. "en", "hi").
 * @param fallback - Optional fallback string when the language is not found.
 * @returns The resolved plain string.
 */
export function resolveText(
  text: LocalizedText,
  language: string,
  fallback?: string,
): string {
  if (typeof text === "string") {
    return text;
  }

  if (text[language] !== undefined) {
    return text[language];
  }

  if (fallback !== undefined) {
    return fallback;
  }

  const values = Object.values(text);
  return values.length > 0 ? values[0] : "";
}

/**
 * Formats a language code for display, returning explicit "English" / "Bengali"
 * labels for WBTET papers while preserving uppercase codes for other exams.
 */
export function getWbtetLanguageLabel(lang: string, exam?: string): string {
  if (exam !== "wbtet") {
    return lang.toUpperCase();
  }
  if (lang === "en") return "English";
  if (lang === "bn") return "Bengali";
  return lang.toUpperCase();
}

/**
 * Returns a human-readable language badge for a WBTET question card
 * ("English Version", "Bengali Version", "English", or "Bengali").
 */
export function getWbtetQuestionLanguageBadge(
  sectionId: string,
  language: string,
  hasBilingualImages: boolean,
): string {
  if (hasBilingualImages) {
    return language === "bn" ? "Bengali Version" : "English Version";
  }
  if (sectionId === "lang1-bn") return "Bengali";
  if (sectionId === "lang2-en") return "English";
  return language === "bn" ? "Bengali" : "English";
}
