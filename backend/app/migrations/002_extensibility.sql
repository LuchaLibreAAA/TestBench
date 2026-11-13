-- 002_extensibility.sql
-- Multi-client extensibility: exams registry, content-addressed assets & variants, packages, expanded question types

-- 1. Exam registry
CREATE TABLE IF NOT EXISTS exams (
  code                     TEXT PRIMARY KEY,
  name                     TEXT NOT NULL,
  badge                    TEXT,
  default_marking_strategy TEXT NOT NULL DEFAULT 'nta-standard',
  pipeline_config          TEXT,
  config_json              TEXT NOT NULL DEFAULT '{}',
  position                 INTEGER NOT NULL DEFAULT 0,
  active                   INTEGER NOT NULL DEFAULT 1
);

-- Seed known exams
INSERT OR IGNORE INTO exams (code, name, badge, default_marking_strategy, pipeline_config, config_json, position, active) VALUES
('jee-main', 'JEE Main', 'JEE Main', 'nta-standard', 'jee_main', '{"instructions":"Official NTA JEE Main CBT","hasOptionalQuestions":true}', 1, 1),
('neet-ug', 'NEET UG', 'NEET UG', 'nta-standard', 'neet_ug', '{"instructions":"Official NTA NEET UG CBT","hasOptionalQuestions":false}', 2, 1),
('wbtet', 'WB Primary TET', 'WBTET', 'wbtet-standard', 'wbtet', '{"instructions":"WBBPE Primary TET examination","hasOptionalQuestions":false}', 3, 1);

-- 2. Papers additions
ALTER TABLE papers ADD COLUMN exam_code TEXT REFERENCES exams(code);
ALTER TABLE papers ADD COLUMN status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published','archived'));
ALTER TABLE papers ADD COLUMN schema_version TEXT NOT NULL DEFAULT '1.0';
ALTER TABLE papers ADD COLUMN min_client_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE papers ADD COLUMN required_features TEXT NOT NULL DEFAULT '[]';

CREATE INDEX IF NOT EXISTS idx_papers_exam ON papers(exam_code, year);

-- Backfill exam_code from legacy exam column
UPDATE papers SET exam_code = 'jee-main' WHERE (exam LIKE '%jee%' OR exam = 'jee-main') AND exam_code IS NULL;
UPDATE papers SET exam_code = 'neet-ug' WHERE (exam LIKE '%neet%' OR exam = 'neet' OR exam = 'neet-ug') AND exam_code IS NULL;
UPDATE papers SET exam_code = 'wbtet' WHERE (exam LIKE '%tet%' OR exam = 'wbtet') AND exam_code IS NULL;

-- 3. Sections additions
ALTER TABLE sections ADD COLUMN marking_strategy TEXT;
ALTER TABLE sections ADD COLUMN attempt_limit INTEGER;

-- 4. Content-addressed assets
CREATE TABLE IF NOT EXISTS assets (
  paper_id    TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  filename    TEXT NOT NULL,
  sha256      TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  bytes       INTEGER NOT NULL,
  width       INTEGER,
  height      INTEGER,
  role        TEXT NOT NULL CHECK (role IN ('question','option','explanation','other')),
  question_id TEXT,
  PRIMARY KEY (paper_id, filename)
);
CREATE INDEX IF NOT EXISTS idx_assets_sha ON assets(sha256);

-- 4b. Asset variants (WebP widths for mobile/perf)
CREATE TABLE IF NOT EXISTS asset_variants (
  paper_id    TEXT NOT NULL,
  filename    TEXT NOT NULL,
  variant     TEXT NOT NULL,
  format      TEXT NOT NULL CHECK (format IN ('png','webp')),
  sha256      TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  bytes       INTEGER NOT NULL,
  PRIMARY KEY (paper_id, filename, variant),
  FOREIGN KEY (paper_id, filename) REFERENCES assets(paper_id, filename) ON DELETE CASCADE
);

-- 4c. Offline packages (pre-built zip bundles)
CREATE TABLE IF NOT EXISTS paper_packages (
  paper_id     TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  variant      TEXT NOT NULL,
  data_version INTEGER NOT NULL,
  storage_key  TEXT NOT NULL,
  sha256       TEXT NOT NULL,
  bytes        INTEGER NOT NULL,
  PRIMARY KEY (paper_id, variant)
);

-- 5. Rebuild questions table to allow multi_choice & true_false, and add content_blocks_json
CREATE TABLE questions_new (
    id TEXT PRIMARY KEY,
    paper_id TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    question_number INTEGER NOT NULL,
    question_id TEXT NOT NULL,
    section_id TEXT NOT NULL,
    subject TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('single_choice','multi_choice','numeric','true_false')),
    content_json TEXT NOT NULL,
    content_blocks_json TEXT NOT NULL DEFAULT '[]',
    options_json TEXT NOT NULL,
    answer_json TEXT NOT NULL,
    explanation_json TEXT NOT NULL DEFAULT '{"text":"","imagePaths":[]}',
    source_json TEXT NOT NULL,
    UNIQUE (paper_id, question_number),
    UNIQUE (paper_id, question_id),
    FOREIGN KEY (paper_id, section_id) REFERENCES sections(paper_id, section_id)
);

INSERT INTO questions_new (id, paper_id, question_number, question_id, section_id, subject, type, content_json, content_blocks_json, options_json, answer_json, explanation_json, source_json)
SELECT id, paper_id, question_number, question_id, section_id, subject, type, content_json, '[]', options_json, answer_json, explanation_json, source_json
FROM questions;

DROP TABLE questions;
ALTER TABLE questions_new RENAME TO questions;

CREATE INDEX idx_q_paper_subject ON questions(paper_id, subject);
CREATE INDEX idx_q_paper_section ON questions(paper_id, section_id);
