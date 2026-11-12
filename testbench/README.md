# TestBench

> A mobile-first, offline-capable, JSON-driven mock test platform built with React 19, TypeScript, Vite, and Tailwind CSS v4, replicating the official NTA computer-based test (CBT) experience.

---

## 🌟 Key Features

### 1. Familiar NTA Exam Interface
- **Official 5-State Question Palette**:
  - `notVisited` (Grey): Not yet opened
  - `notAnswered` (Red): Visited but unanswered
  - `answered` (Green): Saved and answered
  - `marked` (Purple): Marked for review without answer
  - `answeredMarked` (Purple with Green badge): Answered and marked for review (evaluated in scoring)
- **Exam Player Controls**: Save & Next, Mark for Review & Next, Clear Response, Previous, Question Navigation.
- **Section Tabs & Marking**: Section-wise grouping, custom negative marking schemes (+4/-1, +4/0, etc.), sectional attempt limits (e.g. JEE section B "any 5 of 10").
- **Drift-Proof Countdown Timer**: Absolute `endsAt` timer with severity alerts (amber at 5 min, red pulse at 1 min) and automatic submission.
- **Pre-Submit Summary Dialog**: Full question status breakdown by section before final submission.

### 2. Multi-Format Question Support
- **Single-choice MCQ**: Full-row touch targets with radio selection.
- **Multi-select MCQ**: Checkboxes with partial marking support.
- **Numerical Value**: Live decimal validation with an on-screen touch keypad (0-9, `.`, `-`, backspace, clear).
- **True / False**: Fast two-button selection.
- **LaTeX Math Support**: KaTeX equations formatted inline (`$...$`) and block (`$$...$$`).

### 3. Solution Review & Analytics
- **Review Mode**: Filter questions by All, Correct, Wrong, Skipped. Displays student choice vs correct answer, marks awarded, time spent, and detailed explanations.
- **Performance Analytics**: Score totals, accuracy percentage, time per question, and topic mastery breakdown.
- **Retry Modes**: Instant retake of wrong and skipped questions.

### 4. Official JEE Main & NEET UG Papers Catalog
- **Separate Dedicated Sections**: Distinct, organized sections in the Library for **JEE Main** and **NEET UG** past year papers.
- **Full Real Papers**:
  - **JEE Main 2024 (January Session 1, Shift 1)**: Complete 90 questions across Physics, Chemistry, and Mathematics (Section A MCQs + Section B numericals with 5/10 attempt limit).
  - **JEE Main 2023 (April Session 2, Shift 1)**: Complete 90 questions across Physics, Chemistry, and Mathematics.
  - **NEET UG 2024 (Official)**: Complete 200 questions across Physics, Chemistry, Botany, and Zoology (Section A 35 compulsory + Section B 15 questions with 10/15 attempt limit).
  - **NEET UG 2023 (Official)**: Complete 200 questions across Physics, Chemistry, Botany, and Zoology.
- **One-Click Paper Seeding**: Instant loading and local offline persistence of all official papers directly into IndexedDB.
- **Instant Search & Category Filters**: Search by exam name, year, or topic, with filtering tabs (`All`, `JEE Main`, `NEET UG`, `Custom`).

### 5. Offline-First & JSON / ZIP Content
- **100% Offline Capability**: Runs entirely in the browser using Dexie (IndexedDB) for local storage of papers, attempts, assets, and settings.
- **JSON & ZIP Import**: Drag-and-drop or upload `.json` papers or `.zip` packages containing `paper.json` and diagram assets (`images/`).
- **Two-Pass Validation**: Schema validation with Zod plus cross-field domain checks with human-readable error reporting.
- **Crash Recovery & Autosave**: Persists student answers and visited state on every interaction; seamlessly resume tests across page refreshes.

---

## 🛠 Tech Stack

- **Framework**: React 19 + TypeScript
- **Bundler**: Vite 8
- **Styling**: Tailwind CSS v4
- **State Management**: Zustand v5
- **Local Database**: Dexie (IndexedDB)
- **Validation**: Zod v4
- **Math Rendering**: KaTeX
- **ZIP Packaging**: fflate
- **Icons**: Lucide React
- **Testing**: Vitest + React Testing Library

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- npm or pnpm

### Installation

```bash
# Navigate to the project directory
cd testbench

# Install dependencies
npm install

# Start the local development server
npm run dev
```

### Running Tests

```bash
cd testbench
npm test
```

### Production Build

```bash
cd testbench
npm run build
```

---

## 🔒 Security & Data Privacy

- **Client-Side & Offline-Only Architecture**: TestBench executes 100% in the user's browser. No student answers, test scores, or personal responses are transmitted to any remote servers.
- **Zero Third-Party Tracking**: No analytics scripts, trackers, or cookies are stored or broadcast.
- **XSS Mitigation with DOMPurify**: All KaTeX math renderings and markdown markup are sanitized via `DOMPurify` before rendering to prevent script injection.
- **Rigorous Schema Validation**: All imported JSON and ZIP files are strictly validated with Zod v4 schemas with deep domain validation before any storage or execution.
- **0 Dependencies Vulnerabilities**: Audited clean against known CVEs via `npm audit`.

---

## 📄 License
MIT


