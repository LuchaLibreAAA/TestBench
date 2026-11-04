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

### 4. Offline-First & JSON / ZIP Content
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

## 📄 License
MIT
