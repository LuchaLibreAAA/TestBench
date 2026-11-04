import { describe, it, expect } from "vitest";
import { examReducer, createInitialState } from "../machine";
import type { Paper } from "../../schema";

describe("Exam Reducer & State Machine", () => {
  const samplePaper: Paper = {
    schemaVersion: 1,
    id: "sample-mock",
    title: "Sample Mock",
    exam: "jee-main",
    durationMin: 180,
    languages: ["en"],
    navigation: "free",
    sections: [
      {
        id: "sec-1",
        name: "Section 1",
        marking: { correct: 4, wrong: -1, unattempted: 0 },
        questions: [
          {
            id: "q1",
            type: "single",
            text: "Question 1",
            options: [{ id: "a" }, { id: "b" }],
            answer: ["a"],
          },
          {
            id: "q2",
            type: "single",
            text: "Question 2",
            options: [{ id: "a" }, { id: "b" }],
            answer: ["b"],
          },
        ],
      },
    ],
  };

  it("START initializes state and first question to notAnswered", () => {
    const state = createInitialState();
    const next = examReducer(state, {
      type: "START",
      payload: { paper: samplePaper, attemptId: "att-1", language: "en" },
    });

    expect(next.phase).toBe("running");
    expect(next.currentQid).toBe("q1");
    expect(next.responses["q1"].status).toBe("notAnswered");
    expect(next.responses["q2"].status).toBe("notVisited");
    expect(next.endsAt).toBeGreaterThan(Date.now());
  });

  it("SELECT_OPTION updates student response", () => {
    let state = examReducer(createInitialState(), {
      type: "START",
      payload: { paper: samplePaper, attemptId: "att-1", language: "en" },
    });

    state = examReducer(state, {
      type: "SELECT_OPTION",
      payload: { qid: "q1", optionId: "a" },
    });

    expect(state.responses["q1"].answer).toEqual(["a"]);
  });

  it("SAVE_NEXT sets status to answered and moves to next question", () => {
    let state = examReducer(createInitialState(), {
      type: "START",
      payload: { paper: samplePaper, attemptId: "att-1", language: "en" },
    });

    state = examReducer(state, {
      type: "SELECT_OPTION",
      payload: { qid: "q1", optionId: "a" },
    });

    state = examReducer(state, { type: "SAVE_NEXT" });

    expect(state.responses["q1"].status).toBe("answered");
    expect(state.currentQid).toBe("q2");
    expect(state.responses["q2"].status).toBe("notAnswered");
  });

  it("CLEAR removes answer and resets status", () => {
    let state = examReducer(createInitialState(), {
      type: "START",
      payload: { paper: samplePaper, attemptId: "att-1", language: "en" },
    });

    state = examReducer(state, {
      type: "SELECT_OPTION",
      payload: { qid: "q1", optionId: "a" },
    });

    state = examReducer(state, { type: "CLEAR", payload: { qid: "q1" } });

    expect(state.responses["q1"].answer).toBeNull();
    expect(state.responses["q1"].status).toBe("notAnswered");
  });

  it("SUBMIT transitions to submitted phase", () => {
    let state = examReducer(createInitialState(), {
      type: "START",
      payload: { paper: samplePaper, attemptId: "att-1", language: "en" },
    });

    state = examReducer(state, { type: "SUBMIT" });
    expect(state.phase).toBe("submitted");
  });
});

