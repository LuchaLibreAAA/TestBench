# Implementation Plan: Mock Test Platform (working title: **TestBench**)

> A mobile-first, offline-capable, JSON-driven mock test app that feels like the NTA exam interface. It is built as a Vite web app first, then wrapped as a hybrid mobile app with Capacitor.

---

## 0. Document Control

### 0.1 Revision Log
| Rev | Date | Author | Summary of change |
|-----|------|--------|-------------------|
| 0.1 | 2026-11-04 | initial | First full draft |
| | | | |

### 0.2 Status Legend
- `[ ]` not started, `[~]` in progress, `[x]` done
- `[VERIFY]` a fact (exam pattern, library API, version) that must be checked against an official or current source before relying on it
- `[OPEN]` an undecided question, tracked in Section 26
- `[FUTURE]` deliberately out of the current scope

### 0.3 How to Revise This Document
1. Every change to scope, schema or architecture gets a row in the Revision Log.
2. Schema changes also bump `schemaVersion` (Section 8.1) and add a migration note (Section 8.7).
3. Decisions move from Open Questions (Section 26) to the Decision Log (Section 27) once settled.
4. Exam patterns live in preset files (Section 5), never hardcoded, so pattern changes never need a code change.

---

## 1. Vision & Goals

### 1.1 Product Summary
A web app where a teacher or student can:
- **Import** question papers (JSON, ZIP with images, CSV) or **build** them in an in-app builder
- **Attempt** them in an NTA-style computer-based test (CBT) interface
- **Review** results, solutions and analytics

The same code runs in the browser (PWA) and inside a Capacitor Android/iOS shell.

### 1.2 Primary Goals (priority order)
1. **Mobile compatibility and feel.** The UI must be sleek on a ~360px-wide phone, with thumb-friendly controls.
2. **Familiar NTA experience.** Question palette colors, button names and flow match what JEE/NEET/CUET students see in real exams.
3. **Simple JSON-driven content.** One paper equals one JSON file plus optional images. Question types, marking and sections are all data-driven.
4. **Reliability.** No lost answers on refresh, crash or app backgrounding, and a timer that cannot drift.
5. **Multi-exam support.** JEE Main, JEE Advanced-style, NEET, banking (sectional), SSC-style and custom formats from one engine.
6. **Offline-first.** The full test flow works with no network.

### 1.3 Non-Goals (v1)
- Live proctoring (camera, mic, screen recording)
- Server-side question bank, payments or marketplace
- Real-time multi-user (live batch) tests
- AI-generated questions or solutions (`[FUTURE]`)
- Handwriting or drawing canvas (`[FUTURE]`, see 13.9)

### 1.4 Target Users
| Persona | Needs |
|---|---|
| Student | Attempt mocks on phone, resume interrupted tests, review mistakes |
| Teacher or coaching owner | Create and import papers, share the JSON/ZIP, view results |
| Developer (you) | Simple schema, strong validation, easy to add exam formats |

---

## 2. Guiding Principles
1. **Schema first.** The JSON schema is the product contract. UI and engine are built against it.
2. **Pure core, thin UI.** Marking, validation and exam state transitions are pure TypeScript with no React, fully unit-tested.
3. **Absolute time, not counters.** Timers derive from `endsAt` timestamps.
4. **Persist on every action.** Anything the student does is written to IndexedDB immediately.
5. **Mobile is the default layout.** Desktop is the enhancement, not the reverse.
6. **Never trust imported content.** Validate with Zod and sanitize rich text before rendering.
7. **Everything configurable lives in data.** Presets, marking and languages are all data-driven.

---

## 3. Exam Format Coverage

> `[VERIFY]` All patterns below must be checked against the current official notices (NTA, NEET/NMC, IBPS, SBI, SSC) before shipping preset files. Patterns change, and these are templates, not authoritative.

| Preset ID | Sections | Types used | Marking | Time | Navigation |
|---|---|---|---|---|---|
| `jee-main` | Physics, Chemistry, Maths. Each has Sec A (MCQ) and Sec B (numerical) | single, numerical | +4 / -1 (A), +4 / 0 (B) `[VERIFY]` | 180 min total | free |
| `jee-advanced-style` | Multiple parts with different rules | single, multi, numerical, paragraph, match | per section (partial marking) | per paper | free (or per paper) |
| `neet` | Physics, Chemistry, Botany, Zoology | single | +4 / -1 `[VERIFY]` section B optional-choice rule | 180 min total | free |
| `banking-prelims` | English, Quant, Reasoning | single, paragraph | +1 / -0.25 `[VERIFY]` | sectional (e.g. 20 min each) `[VERIFY]` | **locked per section** |
| `ssc-style` | GI, Reasoning, Quant, English | single | +2 / -0.5 `[VERIFY]` | 60 min total | free |
| `custom` | user-defined | any | user-defined | user-defined | configurable |

### 3.1 Preset Mechanism
A preset is a partial paper template: section names, marking, timing and navigation rules. When a teacher creates a paper in the builder, they pick a preset and the section shells are pre-filled. Presets live in `src/presets/*.json` and are validated against the same Zod schema.

---

## 4. Feature List

### 4.1 Core (MVP)
- [ ] JSON paper import with validation and readable errors
- [ ] Exam player: single, multi, numerical question types
- [ ] NTA palette with 5 states
- [ ] Save & Next, Mark for Review & Next, Clear Response, Previous
- [ ] Countdown timer based on `endsAt`, with auto-submit
- [ ] Autosave to IndexedDB and resume after refresh or crash
- [ ] Section tabs and a section-wise marking engine
- [ ] Result screen with score, accuracy and counts
- [ ] Image support in questions and options
- [ ] Instructions page and pre-submit summary

### 4.2 Phase 2
- [ ] Solution review (your answer vs correct, explanation)
- [ ] Analytics (time per question, topic-wise, section-wise)
- [ ] ZIP import (`paper.json` plus `images/`)
- [ ] KaTeX math rendering
- [ ] Bilingual toggle (EN/HI), expandable to more languages
- [ ] Attempt history and retry-wrong-only mode

### 4.3 Phase 3
- [ ] In-app paper builder with live preview
- [ ] CSV bulk import
- [ ] Paragraph and match types
- [ ] Banking-style sectional timers with section lock
- [ ] Shuffle questions and options
- [ ] Export paper as JSON/ZIP

### 4.4 Phase 4
- [ ] PWA install and full offline support
- [ ] Capacitor Android (and iOS) build
- [ ] Native niceties: back-button handling, status bar, keep-awake, splash
- [ ] Optional backend (auth, sync, shared library) `[FUTURE]`

### 4.5 Ideas Backlog (unscheduled)
- Bookmarked questions across attempts
- Formula sheet or on-screen calculator (banking, optional, per paper flag)
- Rough-work notepad (see 13.9)
- Percentile estimation from a seeded dataset
- Dark mode and "exam mode" high-contrast theme
- Text-to-speech for reading questions `[FUTURE]`
- PDF export of the result report
- Flashcards from wrong questions

---

## 5. Exam Presets (data files)

Location: `src/presets/`. Each file follows `PresetSchema` (Section 8.3).

```json
{
  "presetId": "jee-main",
  "title": "JEE Main",
  "defaultDurationMin": 180,
  "navigation": "free",
  "languages": ["en", "hi"],
  "sections": [
    { "id": "phy-a", "name": "Physics A", "type": "single", "count": 20,
      "marking": { "correct": 4, "wrong": -1, "unattempted": 0 } },
    { "id": "phy-b", "name": "Physics B", "type": "numerical", "count": 10, "attemptLimit": 5,
      "marking": { "correct": 4, "wrong": 0, "unattempted": 0 } }
  ]
}
```

`attemptLimit` (max questions countable in a section, e.g. "attempt any 5 of 10") needs a defined rule in the engine. See 10.6 and `[OPEN]` Q4.

---

## 6. Tech Stack

| Concern | Choice | Notes |
|---|---|---|
| Build | **Vite** | `[VERIFY]` pin the current major at scaffold time |
| UI | **React + TypeScript** | Vue is an acceptable alternative; the pure core is framework-agnostic |
| Styling | **Tailwind CSS** | design tokens in Section 14 |
| Primitives | **Radix UI** (Dialog, Tabs, Popover) or Headless UI | bottom sheet, dialogs, a11y |
| Routing | **React Router** (hash router) | hash routing avoids deep-link 404s inside Capacitor |
| State | **Zustand** | exam session store with persistence middleware |
| Persistence | **Dexie** (IndexedDB) | papers, assets, attempts, settings |
| Validation | **Zod** | the single source of truth for types (`z.infer`) |
| Math | **KaTeX** | lazy-loaded, rendered per question |
| Sanitizing | **DOMPurify** | for any HTML in text fields |
| ZIP | **fflate** or **JSZip** | import and export |
| CSV | **PapaParse** | bulk import |
| i18n | lightweight custom (`Record<lang,string>`) or `i18next` | UI chrome strings plus content strings |
| PWA | **vite-plugin-pwa** | service worker and manifest |
| Hybrid | **Capacitor** | Android first |
| Tests | **Vitest**, **React Testing Library**, **Playwright** | unit, component, e2e (mobile viewports) |
| Lint/format | ESLint, Prettier, `tsc --noEmit` in CI | |
| Charts | small SVG/Canvas lib or hand-rolled | keep the bundle light `[OPEN]` Q8 |

### 6.1 Browser and Device Support Targets
- Android WebView 90+ and Chrome for Android (last 2 years of devices)
- iOS Safari/WKWebView 15+
- Desktop Chrome, Edge, Firefox, Safari (latest 2 versions)
- Minimum viewport: 320px wide

---

## 7. Project Structure

```
testbench/
├─ index.html
├─ vite.config.ts
├─ capacitor.config.ts
├─ package.json
├─ tsconfig.json
├─ tailwind.config.ts
├─ public/
│  ├─ icons/                    # PWA/app icons
│  └─ samples/                  # sample papers (json, zip)
├─ src/
│  ├─ main.tsx
│  ├─ app/
│  │  ├─ App.tsx
│  │  ├─ routes.tsx
│  │  └─ providers.tsx
│  ├─ core/                     # PURE TS, no React
│  │  ├─ schema/                # zod schemas and inferred types
│  │  │  ├─ paper.ts
│  │  │  ├─ question.ts
│  │  │  ├─ marking.ts
│  │  │  ├─ attempt.ts
│  │  │  └─ index.ts
│  │  ├─ marking/               # scoring engine
│  │  │  ├─ score.ts
│  │  │  ├─ evaluate.ts
│  │  │  └─ __tests__/
│  │  ├─ exam/                  # state machine and timer logic
│  │  │  ├─ machine.ts
│  │  │  ├─ timer.ts
│  │  │  ├─ palette.ts
│  │  │  └─ __tests__/
│  │  ├─ analytics/
│  │  ├─ import/                # json, zip, csv parsers and error formatters
│  │  └─ utils/
│  ├─ data/
│  │  ├─ db.ts                  # Dexie schema
│  │  ├─ repositories/          # papers, attempts, assets, settings
│  │  └─ migrations/
│  ├─ presets/
│  ├─ features/
│  │  ├─ library/               # paper list, import, delete
│  │  ├─ instructions/
│  │  ├─ exam/                  # player UI
│  │  │  ├─ ExamScreen.tsx
│  │  │  ├─ QuestionView.tsx
│  │  │  ├─ renderers/          # Single, Multi, Numerical, Paragraph, Match
│  │  │  ├─ Palette.tsx
│  │  │  ├─ PaletteSheet.tsx    # mobile bottom sheet
│  │  │  ├─ ActionBar.tsx
│  │  │  ├─ Header.tsx
│  │  │  ├─ SectionTabs.tsx
│  │  │  ├─ NumericKeypad.tsx
│  │  │  └─ SummaryDialog.tsx
│  │  ├─ result/
│  │  ├─ review/                # solution review
│  │  ├─ analytics/
│  │  ├─ builder/               # paper builder
│  │  └─ settings/
│  ├─ components/               # shared UI (Button, Sheet, Dialog, RichText, Img)
│  ├─ hooks/
│  ├─ i18n/
│  ├─ styles/
│  └─ platform/                 # capacitor adapters (back button, keep awake, etc.)
├─ tests/
│  ├─ e2e/
│  └─ fixtures/                 # sample papers, bad papers for validation tests
└─ docs/
   └─ implementation.md
```

Rule: **`src/core` must never import from React, the DOM or Capacitor.**

---

## 8. Data Model

### 8.1 Paper JSON (v1)

Top-level:
```jsonc
{
  "schemaVersion": 1,
  "id": "jee-main-mock-01",          // unique, kebab-case
  "title": "JEE Main Mock 1",
  "description": "optional",
  "exam": "jee-main",                // preset id or "custom"
  "durationMin": 180,                // total time; omit if only sectional timers
  "languages": ["en", "hi"],         // first is default
  "navigation": "free",              // "free" | "sectionLocked"
  "instructions": { "en": "markdown/plain text" },
  "sections": [ /* Section[] */ ],
  "meta": { "author": "", "createdAt": "", "tags": [] }
}
```

Section:
```jsonc
{
  "id": "phy-a",
  "name": { "en": "Physics A", "hi": "भौतिकी A" },   // string OR localized map
  "marking": { "correct": 4, "wrong": -1, "unattempted": 0 },
  "timeLimitMin": 20,                // optional: sectional timer
  "lockOnExit": true,                // optional: no return after leaving
  "attemptLimit": 5,                 // optional: only first N attempted count
  "questions": [ /* Question[] */ ]
}
```

### 8.2 Question Types

Common fields (all types):
```jsonc
{
  "id": "p1",                        // unique within the PAPER
  "type": "single",
  "topic": "Kinematics",             // optional, drives analytics
  "subtopic": "optional",
  "difficulty": "easy",              // optional: easy|medium|hard
  "text": { "en": "..." },           // LocalizedText, may contain LaTeX and light markup
  "images": ["p1-graph.png"],        // optional, resolved via asset store
  "marking": { },                    // optional override of section marking
  "explanation": { "en": "..." },    // optional
  "explanationImages": ["p1-sol.png"],
  "tags": []
}
```

| Type | Extra fields | Answer format |
|---|---|---|
| `single` | `options[]` | `answer: ["b"]` (exactly one id) |
| `multi` | `options[]` | `answer: ["a","c"]` (one or more ids) |
| `numerical` | `tolerance?`, `decimals?`, `unit?` | `answer: 12` or `answerRange: [11.9, 12.1]` |
| `tf` | none (implied True/False) | `answer: true` |
| `paragraph` | `passage`, `passageImages?`, `questions[]` (children of any non-paragraph type) | per child |
| `match` | `leftItems[]`, `rightItems[]`, `options[]` (combos) | `answer: ["c"]` (see 8.2.1) |

Option:
```jsonc
{ "id": "a", "text": { "en": "6" }, "image": "optA.png" }   // text and/or image
```

#### 8.2.1 Match the Column
v1 treats `match` as a rendering variant of `single`/`multi`. It displays two columns, and the `options` carry the combinations (e.g. "A-2, B-1, C-4, D-3"). The answer scoring is the same as `single`/`multi`. A true drag/drop matrix type is `[FUTURE]`.

#### 8.2.2 Paragraph / Comprehension Sets
Children are first-class questions with their own ids and marking, and they appear individually in the palette. A child holds `parentId`. The UI shows the passage in a collapsible panel (a split view on desktop, a top accordion on mobile).

### 8.3 Zod Schema Sketch

```ts
// src/core/schema/question.ts
import { z } from "zod";

export const LocalizedText = z.union([
  z.string(),
  z.record(z.string(), z.string()),
]);

export const Option = z.object({
  id: z.string().min(1),
  text: LocalizedText.optional(),
  image: z.string().optional(),
}).refine(o => o.text || o.image, "Option needs text or image");

export const Marking = z.object({
  correct: z.number(),
  wrong: z.number().default(0),
  unattempted: z.number().default(0),
  partial: z.object({
    perCorrect: z.number(),        // marks per correct option when no wrong option chosen
    anyWrong: z.number(),          // marks if any wrong option is chosen
  }).optional(),
});

const Base = z.object({
  id: z.string().min(1),
  topic: z.string().optional(),
  subtopic: z.string().optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  text: LocalizedText,
  images: z.array(z.string()).optional(),
  marking: Marking.optional(),
  explanation: LocalizedText.optional(),
  explanationImages: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
});

export const Single = Base.extend({
  type: z.literal("single"),
  options: z.array(Option).min(2),
  answer: z.array(z.string()).length(1),
});

export const Multi = Base.extend({
  type: z.literal("multi"),
  options: z.array(Option).min(2),
  answer: z.array(z.string()).min(1),
});

export const Numerical = Base.extend({
  type: z.literal("numerical"),
  answer: z.number().optional(),
  answerRange: z.tuple([z.number(), z.number()]).optional(),
  tolerance: z.number().nonnegative().optional(),
  decimals: z.number().int().min(0).max(6).optional(),
  unit: z.string().optional(),
}).refine(q => q.answer !== undefined || q.answerRange,
  "Numerical needs answer or answerRange");

// tf, match, paragraph defined similarly; paragraph children use z.lazy

export const Question = z.discriminatedUnion("type", [Single, Multi, Numerical /* , ... */]);
```

Cross-field validation runs in a second pass (`validatePaper(paper)`), because Zod alone cannot easily check these:
- Unique question ids across the whole paper
- Every `answer` id exists in that question's `options`
- Every referenced image exists in the asset set (during ZIP import)
- Every language in `languages` has text for each question, or falls back to the default (warning, not error)
- Section `timeLimitMin` totals are consistent with `durationMin` (warning)
- `attemptLimit <= questions.length`

Validation output is structured:
```ts
type Issue = { level: "error" | "warning"; path: string; qid?: string; message: string };
```
Example message: `Q14 (section "phy-a"): correct option "E" doesn't exist. Available: a, b, c, d`.

### 8.4 Attempt Record

```ts
type QuestionStatus = "notVisited" | "notAnswered" | "answered" | "marked" | "answeredMarked";

type Response = {
  qid: string;
  answer: string[] | number | boolean | null;   // option ids, numeric value, or null
  rawInput?: string;                            // numeric string as typed
  status: QuestionStatus;
  timeSpentMs: number;
  visits: number;
  firstVisitedAt?: number;
  lastChangedAt?: number;
};

type Attempt = {
  id: string;                    // uuid
  paperId: string;
  paperVersion: string;          // content hash at start
  language: string;
  startedAt: number;
  endsAt: number;                // absolute deadline (total)
  sectionEndsAt?: Record<string, number>;
  status: "inProgress" | "submitted" | "autoSubmitted" | "abandoned";
  currentQid: string;
  currentSectionId: string;
  responses: Record<string, Response>;
  lockedSections: string[];
  tabSwitches: number;
  submittedAt?: number;
  result?: ScoreResult;
};
```

### 8.5 Result Structure
```ts
type ScoreResult = {
  total: number; maxTotal: number;
  attempted: number; correct: number; wrong: number; partial: number; skipped: number;
  accuracy: number;                       // correct / attempted
  bySection: Record<string, SectionScore>;
  byTopic: Record<string, TopicScore>;
  perQuestion: Record<string, { outcome: "correct"|"wrong"|"partial"|"skipped"; marks: number }>;
};
```

### 8.6 Paper Versioning and Identity
- `id` is the stable identity of a paper. `paperVersion` is a content hash (SHA-256 of normalized JSON).
- Attempts reference the version they were taken against. Editing a paper creates a new version and never mutates old attempt scores. Past attempts re-render using a **snapshot** of the paper stored with the attempt, or the old version kept in `papers` history `[OPEN]` Q5.

### 8.7 Schema Migration
- `schemaVersion` is in every paper file.
- `src/data/migrations/` holds `migrate_vN_to_vN+1(paper)` pure functions.
- The importer migrates on load and warns when a file is newer than the app supports.

---

## 9. Marking Engine (`src/core/marking`)

### 9.1 Resolution Order
1. The question's own `marking` override, if present
2. Otherwise the section's `marking`
3. Otherwise the preset default (`+1 / 0`)

### 9.2 Evaluation Rules

**single**
- No answer: `unattempted`
- Selected equals answer: `correct`
- Otherwise: `wrong`

**multi** (let S = selected, A = correct set)
- S empty: `unattempted`
- S equals A: `correct`
- S contains any id outside A: `partial.anyWrong` if partial is configured, else `wrong`
- S is a proper subset of A: `partial.perCorrect * |S|` if partial is configured, else `wrong`

**numerical**
- Empty or unparsable input: `unattempted` (an unparsable value is also flagged in the UI)
- Compare with `|value - answer| <= tolerance` (default 0), or `answerRange[0] <= value <= answerRange[1]`
- Optional rounding to `decimals` before comparison
- Match: `correct`. No match: `wrong` (often 0 marks in JEE-style sections)

**tf**: same as single.

**paragraph**: each child is evaluated by its own type.

**Questions marked for review but not answered** count as unattempted. Questions *answered and marked* **are evaluated** (this matches NTA behavior `[VERIFY]`).

### 9.3 Reference Implementation Sketch

```ts
// src/core/marking/evaluate.ts
export type Outcome = "correct" | "wrong" | "partial" | "skipped";

export function evaluate(q: Question, r: Response | undefined, m: Marking): { outcome: Outcome; marks: number } {
  if (!r || r.answer === null || (Array.isArray(r.answer) && r.answer.length === 0)) {
    return { outcome: "skipped", marks: m.unattempted };
  }
  switch (q.type) {
    case "single":
    case "tf":
      return sameSet(r.answer as string[], q.answer)
        ? { outcome: "correct", marks: m.correct }
        : { outcome: "wrong", marks: m.wrong };
    case "multi": {
      const sel = new Set(r.answer as string[]);
      const ans = new Set(q.answer);
      const anyWrong = [...sel].some(id => !ans.has(id));
      if (!anyWrong && sel.size === ans.size) return { outcome: "correct", marks: m.correct };
      if (anyWrong) return { outcome: "wrong", marks: m.partial?.anyWrong ?? m.wrong };
      if (m.partial) return { outcome: "partial", marks: m.partial.perCorrect * sel.size };
      return { outcome: "wrong", marks: m.wrong };
    }
    case "numerical": {
      const v = Number(r.answer);
      if (Number.isNaN(v)) return { outcome: "skipped", marks: m.unattempted };
      const ok = q.answerRange
        ? v >= q.answerRange[0] && v <= q.answerRange[1]
        : Math.abs(v - q.answer!) <= (q.tolerance ?? 0);
      return ok ? { outcome: "correct", marks: m.correct } : { outcome: "wrong", marks: m.wrong };
    }
  }
}
```

### 9.3.1 Floating-point Caution
Use a small epsilon (`1e-9`) in numerical comparison, and round displayed marks to 2 decimals.

### 9.4 Section Scoring
Sum per-question marks per section, then apply `attemptLimit` (9.6), then total. Track `maxMarks` per section (`count * correct`, adjusted for `attemptLimit`).

### 9.5 Test Cases (must exist before UI work)
- NEET single: right (+4), wrong (-1), skipped (0)
- JEE multi: all right (+4), 1 of 2 right and no wrong (+1), a wrong option present (-2), none selected (0)
- Numerical: exact, within tolerance, outside tolerance, empty, "abc", "1e2", "-0"
- Banking: +1 / -0.25 across a mixed attempt, with a totals check
- Mixed-section paper totals and the `maxTotal` calculation
- Paragraph children scored independently

### 9.6 `attemptLimit` Rule `[OPEN]` Q4
Proposed default: count the **first N attempted** questions in the section in order of question index, and ignore later ones with a visible note in the result. Alternative: count the **best N** marks (not NTA-like). Decide before Phase 1 ends.

---

## 10. Exam Engine (`src/core/exam`)

### 10.1 State Machine
```
idle → instructions → running → summary → submitted
                         ↑          │
                         └──────────┘ (back to test)
running → autoSubmitted (timer hits 0)
```
Transitions are pure functions: `reduce(state, action) → state`.

### 10.2 Actions
`START`, `GO_TO(qid)`, `SELECT_OPTION(qid, optId)`, `TOGGLE_OPTION(qid, optId)`, `SET_NUMERIC(qid, raw)`, `CLEAR(qid)`, `SAVE_NEXT`, `MARK_NEXT`, `PREV`, `SWITCH_SECTION(sid)`, `OPEN_SUMMARY`, `SUBMIT`, `TICK(now)`, `TAB_HIDDEN`, `TAB_VISIBLE`.

### 10.3 Palette Status Rules (NTA behavior)
| Status | Meaning | Color token |
|---|---|---|
| `notVisited` | never opened | grey |
| `notAnswered` | opened, no saved answer | red |
| `answered` | answer saved | green |
| `marked` | marked for review, no answer | purple |
| `answeredMarked` | answered and marked for review | purple with a green tick |

Transition rules:
- Opening a question for the first time: `notVisited → notAnswered`
- **Save & Next** with an answer: `answered`. With no answer: `notAnswered`
- **Mark for Review & Next**: `marked` (no answer) or `answeredMarked` (with answer)
- **Clear Response**: removes the answer. If it was marked, it becomes `marked`, otherwise `notAnswered`
- Selecting an option **without** pressing Save does **not** persist as "answered" in classic NTA. Decision: the app **auto-saves selection into the draft immediately** (for crash safety) but only flips the palette status on Save/Mark/navigate `[OPEN]` Q6.

### 10.4 Timer Design (critical)
```ts
// store: endsAt (ms epoch)
const remainingMs = Math.max(0, endsAt - Date.now());
```
- A UI tick every 1000 ms calls `TICK(Date.now())` to re-render. The remaining time is **always recomputed**, never decremented.
- On `visibilitychange` (visible) and Capacitor `resume`, recompute immediately.
- At `remainingMs === 0`: dispatch `SUBMIT` with `auto: true`.
- **Sectional mode:** keep `sectionEndsAt[sid]`. At section expiry, auto-advance to the next section, add the section to `lockedSections`, and show a modal. The total timer is the sum of sections (no separate total).
- Time per question: on entering a question store `enteredAt`, on leaving add `now - enteredAt` to `timeSpentMs`. Flush on backgrounding so backgrounded time is not counted as thinking time `[OPEN]` Q7.
- Clock tampering: accepted risk in v1 (offline). Mitigation ideas: store a monotonic `performance.now()` offset and compare on resume `[FUTURE]`.

### 10.5 Navigation Rules
- `navigation: "free"`: any section, any question.
- `navigation: "sectionLocked"` or `lockOnExit`: leaving a section requires a confirm dialog, then it is locked. Its palette is read-only and shown as locked.
- The Previous button on the first question of a locked section is disabled.

### 10.6 Submit Flow
1. The student taps Submit and the **Summary dialog** opens: per-section counts of answered, not answered, marked, and not visited.
2. A confirm dialog: "Are you sure? You cannot change answers after submitting."
3. `SUBMIT` scores the attempt, persists it, and routes to the Result screen.
4. Auto-submit skips the confirm dialog and shows a "Time is up" screen.

### 10.7 Resume Flow
On app launch, if an attempt with `status: "inProgress"` exists:
- If `now >= endsAt`: auto-submit it silently and show the result.
- Otherwise: show a "Resume test" card on the home screen, with the remaining time.

---

## 11. Persistence (`src/data`)

### 11.1 Dexie Schema
```ts
// src/data/db.ts
import Dexie, { Table } from "dexie";

class AppDB extends Dexie {
  papers!: Table<StoredPaper, string>;       // id
  assets!: Table<StoredAsset, string>;       // key: `${paperId}/${path}`
  attempts!: Table<Attempt, string>;         // id
  settings!: Table<{ key: string; value: unknown }, string>;

  constructor() {
    super("testbench");
    this.version(1).stores({
      papers:   "id, title, exam, updatedAt",
      assets:   "key, paperId",
      attempts: "id, paperId, status, startedAt",
      settings: "key",
    });
  }
}
export const db = new AppDB();
```
Each future schema change adds `this.version(n+1)` with an `.upgrade()` callback.

### 11.2 Autosave Policy
- Every answer-affecting action writes the attempt record. Debounce is 0 for answers and 500 ms for time counters.
- Writes are queued so ordering is preserved.
- After a write failure (e.g. quota exceeded), show a non-blocking warning and keep state in memory.
- Call `navigator.storage.persist()` to reduce eviction risk (iOS Safari is aggressive about evicting storage `[VERIFY]`).

### 11.3 Asset Handling
- Images are stored as `Blob`s in `assets`.
- A `useAssetUrl(paperId, path)` hook creates an object URL lazily and revokes it on unmount.
- Large papers: pre-warm the next 2-3 questions' images when navigating.
- Downscale oversized images on import (max long edge ~1600px, re-encoded as WebP/JPEG at quality ~0.85) with an option to keep originals `[OPEN]` Q9.

### 11.4 Storage Limits and Cleanup
- Show storage usage in Settings (`navigator.storage.estimate()`).
- Deleting a paper also deletes its assets, with a prompt about its attempt history.

### 11.5 Backup and Restore
- Export all data (papers, assets, attempts) as one ZIP. Import restores it with merge or replace.
- This matters for a hybrid app, because users can lose data when they clear the WebView data.

---

## 12. UI / UX Specification

### 12.1 Screen Inventory
| Route | Screen | Purpose |
|---|---|---|
| `/` | Home / Library | papers, resume card, import button, history shortcut |
| `/paper/:id` | Paper Detail | metadata, sections, start button, past attempts |
| `/exam/:attemptId/instructions` | Instructions | rules, language pick, "I have read" checkbox |
| `/exam/:attemptId` | Exam Player | the test |
| `/exam/:attemptId/summary` | Pre-submit Summary | counts per section |
| `/result/:attemptId` | Result | score, charts, section table |
| `/review/:attemptId` | Solution Review | per-question review with filters |
| `/analytics` | Analytics | trends across attempts |
| `/builder`, `/builder/:id` | Paper Builder | create and edit |
| `/import` | Import | file picker, validation report |
| `/settings` | Settings | language, theme, storage, backup |

### 12.2 Exam Player: Mobile Layout (< 768px)
```
┌─────────────────────────────┐
│ Header: title · ⏱ 02:41:10  │  sticky top, safe-area padded
│ Section tabs (scrollable)   │
├─────────────────────────────┤
│ Q 14 · Section · +4 / -1    │
│ [passage accordion if any]  │
│ Question text + image       │
│ ○ A  ○ B  ○ C  ○ D          │  scrollable content region
│  (or numeric input/keypad)  │
├─────────────────────────────┤
│ [Mark & Next] [Clear]       │  sticky bottom action bar
│ [‹ Prev]  [Save & Next ›]   │  + palette button (grid icon)
└─────────────────────────────┘
        ↑ Palette opens as a bottom sheet (70-85% height)
```
- Touch targets are at least 44x44 px, with 8+ px spacing between them.
- The bottom bar sits above the home indicator (`padding-bottom: env(safe-area-inset-bottom)`).
- The palette sheet has a drag handle, a legend with counts, per-section grouping, and a "Submit" button.
- Swipe left/right changes the question. It is **disabled** while the student scrolls inside a long question or zooms an image, and it is an **opt-in** setting `[OPEN]` Q10.
- Pinch-zoom or tap-to-zoom on question images (a fullscreen viewer with pan and zoom).
- Use `100dvh` instead of `100vh`. Handle virtual keyboard resize for numeric input.

### 12.3 Exam Player: Desktop Layout (>= 1024px)
- Two panes: a left column (question, options) and a right column (candidate info, legend, palette grid, section tabs above).
- The action bar sits at the bottom of the left pane, and Submit sits at the bottom of the palette pane. This follows the real NTA layout.
- Tablet (768-1023px): the palette is a collapsible side drawer.

### 12.4 Question Renderers
- **Single:** radio list. The whole row is tappable, and the selected state is a filled highlight. Tapping the selected option again does not deselect (use Clear Response).
- **Multi:** checkbox list with a "Select all that apply" hint.
- **Numerical:** an input with `inputmode="decimal"` plus an **on-screen keypad** (0-9, `.`, `-`, backspace, clear). The keypad is optional and the native keyboard is a setting. It validates live (one decimal point, one leading minus).
- **TF:** two large buttons.
- **Paragraph:** a passage panel plus a child question below.
- **Match:** a two-column table above the options.
- Options with images: a grid (2 columns on mobile if every option is an image-only).

### 12.5 Header, Info and Dialogs
- The timer turns amber at 10 minutes remaining and red at 5 minutes. It announces via `aria-live="polite"` only at coarse intervals (not every second).
- Question paper / instructions viewer: a button opens a read-only sheet.
- A confirm dialog before leaving the exam (back button, close tab).

### 12.6 Result Screen
- Hero card: score / max, percentage, accuracy.
- Count chips: correct, wrong, partial, skipped.
- Section table with a mini bar per section.
- Time-spent donut or bar and a "slow questions" list.
- Topic performance list sorted weakest first.
- Actions: Review solutions, Retry wrong only, Share/Export report `[FUTURE]`, Home.

### 12.7 Solution Review
- A filter chip bar: All, Correct, Wrong, Skipped, Marked, Partial.
- Each question shows: question, options with your answer and the correct answer highlighted, marks gained, time taken, explanation text and images.
- Swipe or Next/Prev navigation, with a palette colored by outcome (not by attempt status).

### 12.8 Empty, Loading and Error States
Every list and screen has a defined empty state, a skeleton or spinner, and an error state with a retry. Import errors show an issue list grouped by question, with a "Copy report" button.

### 12.9 Navigation Guard Details
- Android hardware back inside the exam: opens the "Leave exam?" dialog, never silently exits.
- Browser back: use `beforeunload` plus a router blocker.
- Pull-to-refresh is disabled inside the exam (`overscroll-behavior: none`).

---

## 13. Look and Feel: "NTA-like but sleek"

### 13.1 Design Tokens (Tailwind theme extension)
```ts
colors: {
  nta: {
    blue:   "#1f5fa6",   // header / primary
    bg:     "#f4f6f9",
    ink:    "#1b1f24",
  },
  status: {
    notVisited: "#cfd4da",
    notAnswered:"#e5533d",
    answered:   "#2e9e5b",
    marked:     "#6f42c1",
    answeredMarked: "#6f42c1", // with a green tick badge
  },
}
```
Final values are tunable. The goal is that students recognize the five states instantly.

### 13.2 Shape of the Palette Buttons
Optional NTA-like shapes: answered as a rounded-top "pentagon", not answered as an inverted one, marked as a circle. This can be a CSS `clip-path` or an SVG. Keep a **settings toggle** for "classic shapes" vs "simple squares" because shapes cost accessibility if color alone differs. Always add an icon or number so state is not color-only.

### 13.3 Typography
- UI: system font stack (fast, native feel). Exam content: a readable sans-serif at 16-18px base, with a user-adjustable text size (A- / A+).
- KaTeX font for math (self-hosted, subsetted if possible).
- Hindi/Devanagari: bundle a web font (e.g. Noto Sans Devanagari) with `font-display: swap`, subsetted `[OPEN]` Q11.

### 13.4 Motion
Subtle only: sheet slide, button press scale 0.98, 150-200 ms fade between questions. Respect `prefers-reduced-motion`.

### 13.5 Themes
Light (default), dark, and a high-contrast exam theme. Tokens are CSS variables so themes swap without rebuild.

### 13.6 Accessibility (see also Section 22)
Visible focus rings, ARIA roles for the palette (a grid of buttons with `aria-label="Question 14, answered"`), and a skip-to-question link.

### 13.7 Iconography
One icon set (e.g. Lucide), tree-shaken.

### 13.8 Branding
App name, logo, icon, and splash are placeholders until chosen `[OPEN]` Q12.

### 13.9 Rough Work Pad `[FUTURE]`
A simple notes sheet or a canvas for scribbling, stored per attempt. Not in the MVP.

---

## 14. Rich Text, Math and Images

### 14.1 Text Format
Content strings support:
- Plain text and a **minimal markup subset**: `**bold**`, `*italic*`, `^sup^`, `~sub~`, line breaks, and simple lists `[OPEN]` Q13 (Markdown subset vs sanitized HTML)
- LaTeX: inline `$...$`, block `$$...$$`
- Escaping rule: a literal dollar sign is written `\$`

### 14.2 Rendering Pipeline
`raw string → sanitize → split into text/math tokens → KaTeX render (lazy) → React nodes`
- KaTeX is **lazy-loaded** and its output cached per string hash.
- On a KaTeX error, fall back to showing the raw LaTeX in a code style with a warning in the builder (never crash the exam).
- Chemistry notation: support `\ce{}` via mhchem if needed `[OPEN]` Q14.

### 14.3 Images
- Referenced by relative filename in JSON, stored in the asset table.
- The `<Img>` component: lazy loading, blur/skeleton placeholder, error placeholder with a retry, `alt` text from optional `imagesAlt`, and tap-to-zoom.
- Supported formats: PNG, JPEG, WebP, SVG (sanitized), GIF (static use).
- Max size guidance in docs: <= 500 KB per image after import optimization.

### 14.4 Localization of Content
`LocalizedText` is either a string (treated as the default language) or `{ en, hi, ... }`. Resolution: selected language, then default language, then first available. The language toggle in the exam header swaps instantly without resetting state. A paper may declare `languages`, and the toggle shows only when more than one is declared.

---

## 15. Authoring and Import

### 15.1 JSON Import
1. The user picks a `.json` file (or drops one, or pastes JSON text).
2. Parse, migrate, then Zod validate, then cross-validate (8.3).
3. Show a **validation report** (errors block saving, warnings do not).
4. Save to the `papers` table.

### 15.2 ZIP Import
```
paper.zip
├─ paper.json
└─ images/
   ├─ p1-graph.png
   └─ ...
```
- Parse with fflate and read `paper.json`.
- Validate that every referenced image exists, and warn about unreferenced images.
- Path rules: only relative paths, no `..`, and an extension allow-list (zip-slip safe).
- Size caps: total uncompressed size and per-file size, to avoid zip bombs.

### 15.3 CSV Import (bulk MCQ)
Columns (header row required):
```
section,type,topic,question,optA,optB,optC,optD,answer,explanation,image,marksCorrect,marksWrong
Physics A,single,Kinematics,"A particle...",6,12,18,24,B,"a=dv/dt",p1.png,4,-1
Physics A,multi,Optics,"Which...",x,y,z,w,"A;C",,,,
```
- `answer` for multi uses `;` or `,` as a separator.
- Numerical rows use `answer` as the number and leave the options empty.
- The CSV is converted into a paper JSON, then validated like any import. Image columns reference files from an optional accompanying ZIP.
- Provide a downloadable CSV template.

### 15.4 Paper Builder (Phase 3)
Features:
- Paper metadata form, preset picker, and section manager (add, reorder, edit marking and timers).
- Question editor: type picker, rich text field with a LaTeX preview, option editor (add, reorder, mark correct, per-option image), numerical fields, explanation, topic and difficulty.
- **Paste image from clipboard** and drag-and-drop into any text or option field.
- A **live preview** that renders with the same components as the exam player.
- Autosave drafts to IndexedDB, with undo/redo for the question editor `[OPEN]` Q15.
- Reorder questions by drag and drop (touch-friendly handles).
- Duplicate question, duplicate paper, bulk-set marking for a section.
- Export as JSON or ZIP. "Validate" button runs the same validators with a jump-to-issue link.
- Mobile layout of the builder: a stacked form. Heavy authoring is expected on desktop, and the mobile builder can be reduced in v1.

### 15.5 Randomization (optional per paper)
`shuffleQuestions` (within a section) and `shuffleOptions` flags. The seed is stored on the attempt so review and resume show the same order. Options flagged `"fixed": true` (e.g. "All of the above") stay in position.

### 15.6 Sharing Papers
Phase 1: share the file (Capacitor Share plugin on mobile, download on web). Later: shareable links through a backend `[FUTURE]`.

---

## 16. Results and Analytics

### 16.1 Per-Attempt Metrics
Score, max score, percentage, accuracy, counts, section breakdown, topic breakdown, time per question, time per section, average time on correct vs wrong answers, and the "marked for review but left unanswered" count.

### 16.2 Flags and Insights (rule-based, no AI)
- **Slow questions:** time spent greater than 2x the section median.
- **Too fast and wrong:** under 10 seconds and incorrect (a guess marker).
- **Negative-marking loss:** total marks lost from wrong answers, and "what if you had skipped the weakest N".
- **Weak topics:** accuracy below a threshold with at least 3 attempted questions.

### 16.3 Across Attempts
Score trend, section trend, topic mastery over time, and an attempts table with filters by paper and date.

### 16.4 Retry Modes
- **Retry wrong and skipped:** builds a derived paper (`derivedFrom: paperId`) from those questions.
- **Practice mode:** untimed, with instant feedback after each answer (a per-attempt `mode: "practice"` flag with no autosubmit and an explanation shown inline).

### 16.5 Percentile / Rank `[FUTURE]`
Needs data from many users, so it is backend-dependent.

---

## 17. Integrity: Proctor-lite (optional per paper)

Flag: `"proctor": { "tabSwitchLimit": 3, "fullscreen": true }`
- Count `visibilitychange` (hidden) and window `blur` events, and show a warning toast on each one.
- At the limit, optionally auto-submit (off by default).
- Desktop fullscreen request on start (`requestFullscreen`), with a warning when exited.
- Block copy, paste and the context menu inside question content (a soft deterrent; document honestly that it can be bypassed).
- Log all events in `attempt.events[]` and show them in the result report.
- Mobile: the OS app-switch events are the `appStateChange` event from Capacitor.
- Everything is off by default. This is a practice app, not a secure exam system, and the docs should say so.

---

## 18. PWA and Offline

- `vite-plugin-pwa` with a precache of the app shell (JS, CSS, fonts, KaTeX assets).
- Runtime caching is not needed for papers, because papers live in IndexedDB.
- Manifest: name, short name, icons (192/512, maskable), `display: standalone`, theme and background colors, `orientation: any`.
- Update flow: "New version available, Reload" toast. **Never auto-reload during an active attempt.** Defer until the exam ends.
- An offline indicator is not needed for exam flow, but the import-from-URL feature requires a connection check.
- The install prompt is shown on the home screen only, never during an exam.

---

## 19. Hybrid App (Capacitor)

### 19.1 Setup
```
npm i @capacitor/core @capacitor/cli
npx cap init "TestBench" com.yourname.testbench --web-dir=dist
npm i @capacitor/android            # and @capacitor/ios later
npm run build && npx cap add android && npx cap sync
```
`capacitor.config.ts`: `appId`, `appName`, `webDir: "dist"`, `server.androidScheme: "https"`.

### 19.2 Plugins
| Need | Plugin |
|---|---|
| Android back button, app pause/resume | `@capacitor/app` |
| Status bar styling, overlay | `@capacitor/status-bar` |
| Splash screen | `@capacitor/splash-screen` |
| Keyboard resize behavior | `@capacitor/keyboard` |
| Share / export file | `@capacitor/share`, `@capacitor/filesystem` |
| File picker for import | web `<input type=file>` first, a native picker plugin if needed |
| Keep screen awake during exam | community keep-awake plugin `[VERIFY]` |
| Screen orientation lock (optional) | `@capacitor/screen-orientation` |
| Haptics (palette taps, subtle) | `@capacitor/haptics` |

### 19.3 `platform/` Adapter Layer
Wrap every native call so that the web build still runs: `platform.backButton.onPress(cb)`, `platform.keepAwake(on)`, `platform.share(file)`, `platform.isNative`. Each has a web fallback (a no-op or a web API).

### 19.4 Mobile-specific Details
- `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`
- Safe-area insets on header, action bar and sheets.
- Disable text-size auto-adjust and double-tap zoom on controls (`touch-action: manipulation`).
- Use `user-select: none` on UI chrome but allow selection in the question text `[OPEN]` Q16 (some teachers want to block copying).
- Android: handle the WebView storage lifecycle, and confirm that IndexedDB persists across app updates `[VERIFY]`.
- iOS: IndexedDB in WKWebView can be cleared under storage pressure, so back up (11.5) matters even more.
- App signing, icons and adaptive icons, Play Store assets, and the privacy policy go in the release checklist (Section 24).

---

## 20. Backend (Optional, Phase 4+) `[FUTURE]`

The app must stay fully functional with no backend. Backend work is purely additive.

- Provider: Supabase or Firebase `[OPEN]` Q17
- Auth: email/OTP, Google
- Tables: `papers`, `paper_versions`, `attempts`, `profiles`, `shares`
- Storage bucket for images
- Sync strategy: local-first, with `updatedAt` last-write-wins for papers and append-only attempts
- Features unlocked: cross-device history, a shared paper library, teacher-to-class assignment, leaderboards, percentiles
- Row-level security from day one
- Privacy: minimal PII, and a data export/delete option (account deletion is required by the app stores)

---

## 21. Performance Budget

| Metric | Target |
|---|---|
| Initial JS (gzipped), exam route | < 200 KB without KaTeX |
| First load on mid-range Android, 4G | < 3 s to interactive |
| Question switch | < 100 ms perceived |
| KaTeX | lazy-loaded, only when math is detected |
| Palette with 300 questions | smooth scroll (virtualize if needed) |
| Memory | revoke object URLs, cap cached images |

Tactics: route-level code splitting (builder and analytics are separate chunks), memoized question components, avoid re-rendering the palette on every timer tick (isolate the timer in its own component and store slice), and use `content-visibility` for long lists.

---

## 22. Accessibility and Internationalization

- Meets WCAG 2.1 AA on contrast and focus where feasible. Color is never the sole indicator.
- Keyboard: arrow keys move between options, `N`/`P` next/previous, `S` save and next, `M` mark. Desktop only, and it is documented on the instructions page.
- Screen readers: labelled controls, live-region timer warnings at 10, 5 and 1 minute.
- UI language packs: `en` first, `hi` second. Strings in `src/i18n/*.json`, with no hardcoded UI strings in components.
- Number and date formatting through `Intl`.
- RTL support is not planned (`[FUTURE]`).

---

## 23. Testing Strategy

### 23.1 Unit (Vitest), highest priority
- Marking engine (cases in 9.5)
- Palette state transitions (10.3)
- Timer math, including a fake clock and a resume after a long background
- Validators: a fixtures folder of good and intentionally bad papers
- Importers: JSON, ZIP (including malicious paths), CSV (quotes, commas, BOM)
- Migrations

### 23.2 Component (React Testing Library)
Renderers per question type, the palette, the action bar, and the summary dialog.

### 23.3 E2E (Playwright, mobile and desktop viewports)
- Import a sample paper, start, answer, mark, refresh mid-test, resume, submit, check the score.
- Auto-submit with a faked clock.
- Sectional lock behavior.
- Offline mode with the network disabled.

### 23.4 Manual Device Matrix
Low-end Android (2-3 GB RAM), a mid-range Android, an iPhone (small and large), and an iPad or tablet. Check keyboard overlap, safe areas, rotation, the back button, and the app switch during the timer.

### 23.5 CI
Typecheck, lint, unit tests, build, and a Playwright smoke test on every push.

---

## 24. Security and Privacy

- Sanitize all rich text (DOMPurify) and never use `dangerouslySetInnerHTML` with unsanitized input.
- SVG uploads are sanitized, or rasterized.
- Content Security Policy for the web build (no inline eval, with KaTeX allowed).
- ZIP safety: path traversal, size and count limits.
- No analytics or tracking in v1. If added later, make it opt-in.
- Imported JSON is treated as untrusted data, never as code.
- Store no secrets in the client. Any backend keys are public-anon only, with RLS enforcing access.
- Store-compliant privacy policy and data-safety form (for Play and App Store).

---

## 25. Roadmap with Task Breakdown

### Phase 0: Setup (0.5-1 day)
- [ ] Scaffold Vite + React + TS, Tailwind, ESLint, Prettier, Vitest
- [ ] Folder structure (Section 7), path aliases
- [ ] CI pipeline, a sample paper fixture
- [ ] Zod schema v1 for single, multi, numerical

### Phase 1: MVP Engine and Player
- [ ] Marking engine plus tests (Section 9)
- [ ] Exam reducer, palette logic, timer logic plus tests (Section 10)
- [ ] Dexie schema, repositories, autosave, resume
- [ ] JSON import with the validation report
- [ ] Library and paper detail screens
- [ ] Instructions screen
- [ ] Exam player: header, section tabs, renderers (single, multi, numerical), action bar
- [ ] Mobile palette bottom sheet plus desktop palette pane
- [ ] Summary dialog, submit, auto-submit
- [ ] Basic result screen
- [ ] Image support through the asset store (single-file JSON with images as data URIs in the MVP, as a bridge to ZIP in Phase 2)
- **Exit criteria:** a student can complete a JEE-style mock on a phone viewport, survive a refresh, and see a correct score.

### Phase 2: Depth
- [ ] ZIP import and asset pipeline
- [ ] KaTeX integration with the lazy loader
- [ ] EN/HI toggle and UI i18n
- [ ] Solution review screen
- [ ] Analytics (per attempt, then across attempts)
- [ ] Attempt history, retry-wrong mode, practice mode
- [ ] Image zoom viewer
- [ ] Settings (theme, text size, keypad toggle, shapes toggle)

### Phase 3: Authoring and Formats
- [ ] CSV import and template
- [ ] Paragraph and match types
- [ ] Banking sectional timers and locks
- [ ] Preset system
- [ ] Paper builder with the live preview
- [ ] Shuffle options
- [ ] Export JSON/ZIP, duplicate paper
- [ ] Backup and restore

### Phase 4: Hybrid and Release
- [ ] PWA configuration and the update flow
- [ ] Capacitor Android build, the `platform/` adapters
- [ ] Back button, keep awake, status bar, splash, haptics
- [ ] Device testing pass, performance pass, a11y pass
- [ ] Store assets, privacy policy, signing, internal testing track
- [ ] iOS build `[OPTIONAL]`

### Phase 5: Backend (optional)
- [ ] Auth, cloud sync, shared library, teacher assignment

---

## 26. Open Questions (`[OPEN]`, resolve and move to Section 27)

| # | Question | Leaning |
|---|---|---|
| Q1 | Final product name and branding | TBD |
| Q2 | React vs Vue | React (ecosystem and Capacitor examples) |
| Q3 | Is a backend ever required, or is this a purely local product? | local-first, decide after the MVP |
| Q4 | `attemptLimit` semantics (first N attempted vs best N) | first N attempted |
| Q5 | Keep old paper versions for old attempts, or snapshot into the attempt? | snapshot in the attempt (simpler, bigger) |
| Q6 | Does selecting an option count as answered before Save & Next? | draft saved immediately, status changes on Save/Mark/navigate |
| Q7 | Count backgrounded time in time-per-question? | no, flush on hide |
| Q8 | Chart library vs hand-rolled SVG | hand-rolled for the few charts |
| Q9 | Image downscale on import: default on or off? | on, with originals optional |
| Q10 | Swipe navigation default on or off? | off by default, opt-in |
| Q11 | Hindi font bundling and subsetting | bundle Noto Sans Devanagari subset |
| Q12 | Icon and splash design | placeholder first |
| Q13 | Rich text format: Markdown subset vs sanitized HTML | Markdown subset plus LaTeX |
| Q14 | mhchem (`\ce`) support for chemistry | add in Phase 2 if needed |
| Q15 | Undo/redo scope in the builder | question-level only |
| Q16 | Block text selection and copy in the exam? | soft block, user-configurable |
| Q17 | Supabase vs Firebase | Supabase (SQL, RLS) |
| Q18 | Do we need negative-marking-free "practice" scoring displays? | yes, via practice mode |
| Q19 | Calculator for banking papers (on-screen)? | Phase 3+ |
| Q20 | Should the JSON allow per-option marking (partial credit weights)? | not in v1 |

---

## 27. Decision Log
| # | Date | Decision | Reason |
|---|------|----------|--------|
| D1 | 2026-11-04 | JSON-first, schema-driven content | simple authoring, one engine for all exams |
| D2 | 2026-11-04 | Absolute `endsAt` timer | survives backgrounding and resume |
| D3 | 2026-11-04 | Dexie/IndexedDB for all local data | blobs for images, larger quota than localStorage |
| D4 | 2026-11-04 | Hash routing | safe in Capacitor and static hosting |
| D5 | 2026-11-04 | No backend in v1 | keep scope small, offline-first |
| | | | |

---

## 28. Risks and Mitigations
| Risk | Impact | Mitigation |
|---|---|---|
| WebView storage cleared (esp. iOS) | lost papers/attempts | persistent storage request, backup/restore, a visible warning |
| Exam patterns change | wrong scoring | data-driven presets, `[VERIFY]` step before release |
| Large image-heavy papers | slow, out of storage | downscale on import, lazy load, size warnings |
| KaTeX cost on low-end phones | jank | lazy load, cache, avoid re-render |
| Clock manipulation | cheating on timer | accepted for a practice app; document it |
| Authoring errors in JSON | broken papers | strict validation with friendly errors and the builder |
| Scope creep (builder, backend) | delayed MVP | strict phase exit criteria |
| Copyright of question content | legal exposure | ship only original or sample content, and add a content disclaimer |
| Store policy (privacy, account deletion) | rejected release | policy checklist in Phase 4 |

---

## 29. Appendices

### A. Complete Sample Paper (minimal)
```json
{
  "schemaVersion": 1,
  "id": "sample-mock-01",
  "title": "Sample Mock 1",
  "exam": "custom",
  "durationMin": 30,
  "languages": ["en"],
  "navigation": "free",
  "instructions": { "en": "Read each question carefully. +4 for correct, -1 for wrong." },
  "sections": [
    {
      "id": "s1",
      "name": "Physics A",
      "marking": { "correct": 4, "wrong": -1, "unattempted": 0 },
      "questions": [
        {
          "id": "q1", "type": "single", "topic": "Kinematics",
          "text": { "en": "If $v = 3t^2$, the acceleration at $t=2$ is" },
          "options": [
            { "id": "a", "text": "6" }, { "id": "b", "text": "12" },
            { "id": "c", "text": "18" }, { "id": "d", "text": "24" }
          ],
          "answer": ["b"],
          "explanation": { "en": "$a = dv/dt = 6t = 12$" }
        }
      ]
    },
    {
      "id": "s2",
      "name": "Physics B (Numerical)",
      "marking": { "correct": 4, "wrong": 0, "unattempted": 0 },
      "questions": [
        { "id": "q2", "type": "numerical", "topic": "Kinematics",
          "text": { "en": "Find $a$ at $t=2$ for $v=3t^2$." }, "answer": 12, "tolerance": 0.01 }
      ]
    },
    {
      "id": "s3",
      "name": "Multi-correct",
      "marking": { "correct": 4, "wrong": -2, "partial": { "perCorrect": 1, "anyWrong": -2 } },
      "questions": [
        { "id": "q3", "type": "multi", "topic": "Optics",
          "text": { "en": "Select all vectors." },
          "options": [
            { "id": "a", "text": "Velocity" }, { "id": "b", "text": "Speed" },
            { "id": "c", "text": "Force" },    { "id": "d", "text": "Mass" }
          ],
          "answer": ["a", "c"] }
      ]
    }
  ]
}
```

### B. Sample Banking Section Snippet
```json
{
  "id": "quant", "name": "Quantitative Aptitude",
  "timeLimitMin": 20, "lockOnExit": true,
  "marking": { "correct": 1, "wrong": -0.25, "unattempted": 0 },
  "questions": []
}
```

### C. Keyboard Shortcuts (desktop)
`←/→` prev/next, `S` save and next, `M` mark and next, `C` clear, `P` toggle palette, `1-4` select option (single/multi).

### D. Glossary
- **CBT:** computer-based test
- **Palette:** the grid of question-number buttons showing status
- **Sectional lock:** once a section ends or is left, it cannot be revisited
- **Draft answer:** a selection saved to the attempt but not yet committed by Save & Next

### E. Suggested Scaffold Commands
```bash
npm create vite@latest testbench -- --template react-ts
cd testbench
npm i zustand dexie zod react-router-dom katex dompurify fflate papaparse lucide-react
npm i -D tailwindcss postcss autoprefixer vitest @testing-library/react @testing-library/jest-dom jsdom @playwright/test vite-plugin-pwa @types/dompurify
npx tailwindcss init -p
```
`[VERIFY]` Check current package names and majors at scaffold time (Tailwind's setup in particular has changed between versions).

### F. Definition of Done (per feature)
- [ ] The behavior matches this document, or the doc is updated in the same change
- [ ] Unit tests for the pure logic
- [ ] Verified at 360x640 and at 1280x800
- [ ] Verified offline
- [ ] No console errors, and a11y labels present
- [ ] Revision Log row added if the spec changed