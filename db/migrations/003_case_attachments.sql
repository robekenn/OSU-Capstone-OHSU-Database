-- Issue #63: attach files to a case. Existing databases only; db/schema.sql
-- already contains these changes for new databases. No existing rows change.
-- Reverse with: DROP TABLE case_version_file, case_file;
--               ALTER TABLE case_version DROP CONSTRAINT case_version_id_case_id_key;
BEGIN;

ALTER TABLE public.case_version
  ADD CONSTRAINT case_version_id_case_id_key UNIQUE (id, case_id);

CREATE TABLE public.case_file (
  id SERIAL PRIMARY KEY,
  case_id INT NOT NULL REFERENCES public.sim_case(id),
  storage_key TEXT NOT NULL UNIQUE CHECK (storage_key ~ '^cases/[0-9]+/[0-9a-f-]{36}$'),
  original_filename TEXT NOT NULL
    CHECK (length(original_filename) BETWEEN 1 AND 255 AND original_filename = btrim(original_filename)),
  media_type TEXT NOT NULL CHECK (media_type IN (
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/png',
    'image/jpeg')),
  size_bytes BIGINT NOT NULL CHECK (size_bytes BETWEEN 1 AND 26214400),
  sha256 TEXT NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  uploaded_by INT NOT NULL REFERENCES public.app_user(id),
  uploaded_at TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE (id, case_id)
);

CREATE TABLE public.case_version_file (
  case_version_id INT NOT NULL,
  case_file_id INT NOT NULL,
  case_id INT NOT NULL,
  PRIMARY KEY (case_version_id, case_file_id),
  FOREIGN KEY (case_version_id, case_id) REFERENCES public.case_version(id, case_id),
  FOREIGN KEY (case_file_id, case_id) REFERENCES public.case_file(id, case_id)
);

CREATE INDEX idx_case_file_case ON public.case_file(case_id);
CREATE INDEX idx_case_version_file_file ON public.case_version_file(case_file_id);

-- Same rule as 002: only the API reads these tables.
ALTER TABLE public.case_file ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_version_file ENABLE ROW LEVEL SECURITY;

COMMIT;
