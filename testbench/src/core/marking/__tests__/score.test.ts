import { describe, it, expect } from "vitest";
import { scorePaper } from "../score";
import type { Paper, Response } from "../../schema";

describe("Marking Engine: scorePaper()", () => {
  const paper: Paper = {
    schemaVersion: 1,
    id: "test-paper",
    title: "Test Paper",
    exam: "custom",
    durationMin: 60,
    languages: ["en"],
    navigation: "free",
    sections: [
      {
        id: "sec-a",
        name: "Section A",
        marking: { correct: 4, wrong: -1, unattempted: 0 },
        questions: [
          {
            id: "q1",
            type: "single",
            topic: "Physics",
            text: "Q1",
            options: [{ id: "a" }, { id: "b" }],
            answer: ["a"],
          },
          {
            id: "q2",
            type: "single",
            topic: "Physics",
            text: "Q2",
            options: [{ id: "a" }, { id: "b" }],
            answer: ["b"],
          },
        ],
      },
      {
        id: "sec-b",
        name: "Section B",
        marking: { correct: 4, wrong: 0, unattempted: 0 },
        attemptLimit: 1,
        questions: [
          {
            id: "q3",
            type: "numerical",
            topic: "Math",
            text: "Q3",
            answer: 10,
          },
          {
            id: "q4",
            type: "numerical",
            topic: "Math",
            text: "Q4",
            answer: 20,
          },
        ],
      },
    ],
  };

  it("correctly calculates scores for mixed results", () => {
    const responses: Record<string, Response> = {
      q1: { qid: "q1", answer: ["a"], status: "answered", timeSpentMs: 1000, visits: 1 }, // correct (+4)
      q2: { qid: "q2", answer: ["a"], status: "answered", timeSpentMs: 1000, visits: 1 }, // wrong (-1)
      q3: { qid: "q3", answer: 10, status: "answered", timeSpentMs: 1000, visits: 1 },    // correct (+4)
      q4: { qid: "q4", answer: 20, status: "answered", timeSpentMs: 1000, visits: 1 },    // ignored due to attemptLimit=1
    };

    const res = scorePaper(paper, responses);

    expect(res.totalObtained).toBe(7); // (+4) + (-1) + (+4) + (0) = 7
    expect(res.totalCorrect).toBe(2);
    expect(res.totalWrong).toBe(1);
    expect(res.totalSkipped).toBe(1); // q4 counted as skipped due to limit
    expect(res.sectionScores[0].obtained).toBe(3);
    expect(res.sectionScores[1].obtained).toBe(4);
  });
});

