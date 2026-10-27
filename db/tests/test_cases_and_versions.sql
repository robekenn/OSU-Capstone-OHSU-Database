-- FR-2 (create a case, saved as a draft) and FR-3 (every edit is a new version).
-- All data below is synthetic.
BEGIN;

INSERT INTO app_user (id, name, email, role)
VALUES (9001, 'Test Author', 'author@example.test', 'educator');

INSERT INTO sim_case (id, title, owner_id) VALUES
  (9101, 'Synthetic Case A', 9001),
  (9102, 'Synthetic Case B', 9001);

INSERT INTO case_version (id, case_id, version_number, content, created_by)
VALUES (9201, 9101, 1, '{"overview": "synthetic v1"}', 9001);

-- FR-2: a case needs a title.
SELECT test.assert_raises(
  'a case without a title is rejected',
  $$INSERT INTO sim_case (title) VALUES (NULL)$$,
  '23502');

-- FR-2: a new version starts as a draft and gets a creation time.
SELECT test.assert_equals('new version defaults to draft',
  (SELECT status FROM case_version WHERE id = 9201), 'draft');
SELECT test.assert_equals('new version gets created_at',
  (SELECT created_at IS NOT NULL FROM case_version WHERE id = 9201), TRUE);

-- A version must belong to a case that exists.
SELECT test.assert_raises(
  'a version for a nonexistent case is rejected',
  $$INSERT INTO case_version (case_id, version_number) VALUES (999999, 1)$$,
  '23503');

-- FR-3: version numbers are unique within a case...
SELECT test.assert_raises(
  'a second version 1 of the same case is rejected',
  $$INSERT INTO case_version (case_id, version_number) VALUES (9101, 1)$$,
  '23505');

-- ...but each case counts its own versions.
INSERT INTO case_version (id, case_id, version_number)
VALUES (9202, 9102, 1);

-- FR-3: an edit adds exactly one version and leaves the old one unchanged.
INSERT INTO case_version (id, case_id, version_number, content, created_by)
VALUES (9203, 9101, 2, '{"overview": "synthetic v2"}', 9001);

SELECT test.assert_equals('case A has two versions after one edit',
  (SELECT count(*) FROM case_version WHERE case_id = 9101), 2::BIGINT);
SELECT test.assert_equals('version 1 content is unchanged',
  (SELECT content FROM case_version WHERE id = 9201),
  '{"overview": "synthetic v1"}'::JSONB);

-- A case's current version must be a version that exists.
UPDATE sim_case SET current_version_id = 9203 WHERE id = 9101;
SELECT test.assert_raises(
  'current_version_id must point at an existing version',
  $$UPDATE sim_case SET current_version_id = 999999 WHERE id = 9101$$,
  '23503');

ROLLBACK;
