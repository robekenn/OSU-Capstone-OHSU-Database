CREATE TABLE campus (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE app_user (
  id SERIAL PRIMARY KEY,
  oidc_subject TEXT UNIQUE,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  campus_id INT REFERENCES campus(id),
  role TEXT NOT NULL
);

CREATE TABLE course (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL,
  title TEXT
);

CREATE TABLE outcome (
  id SERIAL PRIMARY KEY,
  framework TEXT NOT NULL,
  outcome_type TEXT NOT NULL,
  code TEXT,
  description TEXT NOT NULL
);

-- CASES
CREATE TABLE sim_case (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  owner_id INT REFERENCES app_user(id),
  parent_case_id INT REFERENCES sim_case(id),
  current_version_id INT,
  next_review_due DATE
);

CREATE TABLE case_version (
  id SERIAL PRIMARY KEY,
  case_id INT NOT NULL REFERENCES sim_case(id),
  version_number INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  content JSONB,
  change_note TEXT,
  created_by INT REFERENCES app_user(id),
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE (case_id, version_number)
);

-- Now that case_version exists, finish the link from sim_case
ALTER TABLE sim_case
  ADD FOREIGN KEY (current_version_id) REFERENCES case_version(id);

-- SEARCH AND MAPPING
CREATE TABLE tag (
  id SERIAL PRIMARY KEY,
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  UNIQUE (category, name)
);

CREATE TABLE case_version_tag (
  case_version_id INT NOT NULL REFERENCES case_version(id),
  tag_id INT NOT NULL REFERENCES tag(id),
  PRIMARY KEY (case_version_id, tag_id)
);

CREATE TABLE case_use (
  case_id INT NOT NULL REFERENCES sim_case(id),
  campus_id INT NOT NULL REFERENCES campus(id),
  course_id INT NOT NULL REFERENCES course(id),
  last_run_date DATE,
  PRIMARY KEY (case_id, campus_id, course_id)
);

CREATE TABLE case_version_outcome (
  case_version_id INT NOT NULL REFERENCES case_version(id),
  outcome_id INT NOT NULL REFERENCES outcome(id),
  PRIMARY KEY (case_version_id, outcome_id)
);

-- QUALITY
CREATE TABLE review (
  id SERIAL PRIMARY KEY,
  case_version_id INT NOT NULL REFERENCES case_version(id),
  reviewer_id INT NOT NULL REFERENCES app_user(id),
  decision TEXT NOT NULL,
  comments TEXT,
  decided_at TIMESTAMP NOT NULL DEFAULT now()
);

-- INDEXES: Postgres does not index foreign keys automatically.
-- These speed up the most common lookups.
CREATE INDEX idx_case_version_case ON case_version(case_id);
CREATE INDEX idx_case_use_campus_course ON case_use(campus_id, course_id);
CREATE INDEX idx_review_version ON review(case_version_id);
