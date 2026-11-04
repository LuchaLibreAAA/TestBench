import { describe, it, expect } from "vitest";
import { evaluate } from "../evaluate";
import type { Question, Response, MarkingSchema } from "../../schema";

const defaultMarking: MarkingSchema = {
  correct: 4,
  wrong: -1,
  unattempted: 0,
};

function createResponse(answer: Response["answer"]): Response {
  return {
    qid: "q1",
    answer,
    status: answer !== null ? "answered" : "notAnswered",
    timeSpentMs: 1000,
    visits: 1,
  };
}

describe("Marking Engine: evaluate()", () => {
  describe("Single choice", () => {
    const q: Question = {
      id: "q1",
      type: "single",
      text: "Sample single question",
      options: [
        { id: "a", text: "Option A" },
        { id: "b", text: "Option B" },
      ],
      answer: ["b"],
    };

    it("awards full marks for correct answer", () => {
      const res = evaluate(q, createResponse(["b"]), defaultMarking);
      expect(res).toEqual({ outcome: "correct", marks: 4 });
    });

    it("deducts negative marks for wrong answer", () => {
      const res = evaluate(q, createResponse(["a"]), defaultMarking);
      expect(res).toEqual({ outcome: "wrong", marks: -1 });
    });

    it("gives 0 marks when skipped / null answer", () => {
      const res = evaluate(q, createResponse(null), defaultMarking);
      expect(res).toEqual({ outcome: "skipped", marks: 0 });
    });

    it("gives 0 marks when response is undefined", () => {
      const res = evaluate(q, undefined, defaultMarking);
      expect(res).toEqual({ outcome: "skipped", marks: 0 });
    });
  });

  describe("Multi-select with partial marking", () => {
    const multiMarking: MarkingSchema = {
      correct: 4,
      wrong: -2,
      unattempted: 0,
      partial: {
        perCorrect: 1,
        anyWrong: -2,
      },
    };

    const q: Question = {
      id: "q2",
      type: "multi",
      text: "Select vectors",
      options: [
        { id: "a", text: "A" },
        { id: "b", text: "B" },
        { id: "c", text: "C" },
        { id: "d", text: "D" },
      ],
      answer: ["a", "c"],
    };

    it("awards full marks when all correct options chosen", () => {
      const res = evaluate(q, createResponse(["a", "c"]), multiMarking);
      expect(res).toEqual({ outcome: "correct", marks: 4 });
    });

    it("awards partial marks when subset of correct options chosen with no wrong", () => {
      const res = evaluate(q, createResponse(["a"]), multiMarking);
      expect(res).toEqual({ outcome: "partial", marks: 1 });
    });

    it("applies penalty if any wrong option is chosen", () => {
      const res = evaluate(q, createResponse(["a", "b"]), multiMarking);
      expect(res).toEqual({ outcome: "wrong", marks: -2 });
    });

    it("gives skipped when empty array", () => {
      const res = evaluate(q, createResponse([]), multiMarking);
      expect(res).toEqual({ outcome: "skipped", marks: 0 });
    });
  });

  describe("Numerical", () => {
    const numMarking: MarkingSchema = {
      correct: 4,
      wrong: 0,
      unattempted: 0,
    };

    const qExact: Question = {
      id: "q3",
      type: "numerical",
      text: "Value of x",
      answer: 12,
      tolerance: 0.05,
    };

    it("correct on exact match", () => {
      const res = evaluate(qExact, createResponse(12), numMarking);
      expect(res).toEqual({ outcome: "correct", marks: 4 });
    });

    it("correct within tolerance", () => {
      const res = evaluate(qExact, createResponse(12.03), numMarking);
      expect(res).toEqual({ outcome: "correct", marks: 4 });
    });

    it("wrong outside tolerance", () => {
      const res = evaluate(qExact, createResponse(12.1), numMarking);
      expect(res).toEqual({ outcome: "wrong", marks: 0 });
    });

    const qRange: Question = {
      id: "q4",
      type: "numerical",
      text: "Range question",
      answerRange: [10, 20],
    };

    it("correct within answerRange", () => {
      const res = evaluate(qRange, createResponse(15), numMarking);
      expect(res).toEqual({ outcome: "correct", marks: 4 });
    });

    it("wrong outside answerRange", () => {
      const res = evaluate(qRange, createResponse(25), numMarking);
      expect(res).toEqual({ outcome: "wrong", marks: 0 });
    });
  });

  describe("True/False", () => {
    const q: Question = {
      id: "q5",
      type: "tf",
      text: "Is gravity real?",
      answer: true,
    };

    it("correct on true", () => {
      const res = evaluate(q, createResponse(true), defaultMarking);
      expect(res).toEqual({ outcome: "correct", marks: 4 });
    });

    it("wrong on false", () => {
      const res = evaluate(q, createResponse(false), defaultMarking);
      expect(res).toEqual({ outcome: "wrong", marks: -1 });
    });
  });
});

