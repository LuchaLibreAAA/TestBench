import { describe, it, expect } from "vitest";
import { formatTime, getRemainingMs, isExpired, getTimerSeverity } from "../timer";

describe("Timer Utilities", () => {
  it("formats milliseconds into HH:MM:SS", () => {
    expect(formatTime(3661000)).toBe("01:01:01");
    expect(formatTime(0)).toBe("00:00:00");
    expect(formatTime(60000)).toBe("00:01:00");
  });

  it("calculates remaining ms clamping at 0", () => {
    const endsAt = 10000;
    expect(getRemainingMs(endsAt, 5000)).toBe(5000);
    expect(getRemainingMs(endsAt, 12000)).toBe(0);
  });

  it("checks expiration properly", () => {
    const endsAt = 10000;
    expect(isExpired(endsAt, 9999)).toBe(false);
    expect(isExpired(endsAt, 10000)).toBe(true);
    expect(isExpired(endsAt, 15000)).toBe(true);
  });

  it("returns appropriate severity level", () => {
    expect(getTimerSeverity(600000)).toBe("normal");
    expect(getTimerSeverity(200000)).toBe("warning");
    expect(getTimerSeverity(30000)).toBe("danger");
  });
});

