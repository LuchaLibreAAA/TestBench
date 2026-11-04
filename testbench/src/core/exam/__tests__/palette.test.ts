import { describe, it, expect } from "vitest";
import { getNextStatus } from "../palette";

describe("Palette Transition Logic", () => {
  it("transitions notVisited to notAnswered on visit", () => {
    expect(getNextStatus("visit", "notVisited", false)).toBe("notAnswered");
  });

  it("does not change answered status on visit", () => {
    expect(getNextStatus("visit", "answered", true)).toBe("answered");
  });

  it("saveNext with answer becomes answered", () => {
    expect(getNextStatus("saveNext", "notAnswered", true)).toBe("answered");
  });

  it("saveNext without answer becomes notAnswered", () => {
    expect(getNextStatus("saveNext", "answered", false)).toBe("notAnswered");
  });

  it("markNext with answer becomes answeredMarked", () => {
    expect(getNextStatus("markNext", "notAnswered", true)).toBe("answeredMarked");
  });

  it("markNext without answer becomes marked", () => {
    expect(getNextStatus("markNext", "notAnswered", false)).toBe("marked");
  });

  it("clear on answeredMarked returns to marked", () => {
    expect(getNextStatus("clear", "answeredMarked", false)).toBe("marked");
  });

  it("clear on answered returns to notAnswered", () => {
    expect(getNextStatus("clear", "answered", false)).toBe("notAnswered");
  });
});

