CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL
);

CREATE TABLE papers (
    id TEXT PRIMARY KEY CHECK (id GLOB '[a-z0-9-]*'),
    title TEXT NOT NULL,
    exam TEXT NOT NULL,
    year INTEGER NOT NULL,
    total_questions INTEGER NOT NULL,
    duration_min INTEGER NOT NULL,
    exam_metadata_json TEXT NOT NULL,
    data_version INTEGER NOT NULL DEFAULT 1,
    content_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE sections (
    paper_id TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    section_id TEXT NOT NULL,
    section_name TEXT NOT NULL,
    subject TEXT NOT NULL,
    question_type TEXT NOT NULL,
    marking_json TEXT NOT NULL,
    position INTEGER NOT NULL,
    PRIMARY KEY (paper_id, section_id)
);

CREATE TABLE questions (
    id TEXT PRIMARY KEY,
    paper_id TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    question_number INTEGER NOT NULL,
    question_id TEXT NOT NULL,
    section_id TEXT NOT NULL,
    subject TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('single_choice','numeric')),
    content_json TEXT NOT NULL,
    options_json TEXT NOT NULL,
    answer_json TEXT NOT NULL,
    explanation_json TEXT NOT NULL DEFAULT '{"text":"","imagePaths":[]}',
    source_json TEXT NOT NULL,
    UNIQUE (paper_id, question_number),
    UNIQUE (paper_id, question_id),
    FOREIGN KEY (paper_id, section_id) REFERENCES sections(paper_id, section_id)
);
CREATE INDEX idx_q_paper_subject ON questions(paper_id, subject);
CREATE INDEX idx_q_paper_section ON questions(paper_id, section_id);

CREATE TABLE jobs (
    id TEXT PRIMARY KEY,
    status TEXT NOT NULL CHECK (status IN ('queued','running','done','failed')),
    paper_id TEXT,
    error TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    finished_at TEXT
);

CREATE VIRTUAL TABLE questions_fts USING fts5(
    question_id UNINDEXED, paper_id UNINDEXED, body, tokenize='unicode61'
);
