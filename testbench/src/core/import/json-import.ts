import { validatePaper, type ValidationResult } from "./validate";

/**
 * Parses and validates raw JSON string into a verified Paper object.
 */
export function importPaperJSON(jsonString: string): ValidationResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch (err) {
    return {
      success: false,
      issues: [
        {
          level: "error",
          path: "",
          message: `Invalid JSON syntax: ${err instanceof Error ? err.message : String(err)}`,
        },
      ],
    };
  }

  return validatePaper(parsed);
}

