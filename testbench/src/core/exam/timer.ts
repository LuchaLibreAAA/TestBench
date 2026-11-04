// ────────────────────────────────────────────────────────────────────────────
// Timer utilities — pure functions, no DOM / setInterval.
// ────────────────────────────────────────────────────────────────────────────

/**
 * Returns the number of milliseconds remaining until `endsAt`.
 * Never returns a negative value — clamps to 0.
 *
 * @param endsAt - Deadline as epoch milliseconds.
 * @param now    - Current time as epoch milliseconds (defaults to Date.now()).
 * @returns Remaining milliseconds (≥ 0).
 */
export function getRemainingMs(endsAt: number, now?: number): number {
  const currentTime = now ?? Date.now();
  return Math.max(0, endsAt - currentTime);
}

/**
 * Checks whether the deadline has passed.
 *
 * @param endsAt - Deadline as epoch milliseconds.
 * @param now    - Current time as epoch milliseconds (defaults to Date.now()).
 * @returns `true` if the deadline is in the past.
 */
export function isExpired(endsAt: number, now?: number): boolean {
  return getRemainingMs(endsAt, now) === 0;
}

/**
 * Formats a duration in milliseconds as `"HH:MM:SS"`.
 *
 * @param ms - Duration in milliseconds (negative values are treated as 0).
 * @returns Formatted time string, e.g. `"02:41:10"`.
 */
export function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number): string => n.toString().padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Returns a severity level based on remaining time. Useful for colouring
 * the timer display.
 *
 * - `"danger"` — less than 1 minute remaining.
 * - `"warning"` — less than 5 minutes remaining.
 * - `"normal"` — 5 minutes or more remaining.
 *
 * @param ms - Remaining time in milliseconds.
 * @returns `"normal"`, `"warning"`, or `"danger"`.
 */
export function getTimerSeverity(
  ms: number,
): "normal" | "warning" | "danger" {
  if (ms < 60_000) return "danger";
  if (ms < 300_000) return "warning";
  return "normal";
}
