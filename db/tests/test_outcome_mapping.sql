-- FR-5: an author maps a case version to learning outcomes.
-- All data below is synthetic.
BEGIN;

INSERT INTO sim_case (id, title) VALUES (9101, 'Synthetic Case A');
INSERT INTO case_version (id, case_id, version_number) VALUES
  (9201, 9101, 1),
  (9202, 9101, 2);
INSERT INTO outcome (id, framework, outcome_type, code, description)
VALUES (9301, 'Test Framework', 'course', 'TF-1', 'Synthetic outcome 1');

INSERT INTO case_version_outcome (case_version_id, outcome_id)
VALUES (9201, 9301);

SELECT test.assert_raises(
  'mapping a nonexistent outcome fails',
  $$INSERT INTO case_version_outcome VALUES (9201, 999999)$$,
  '23503');

SELECT test.assert_raises(
  'mapping the same outcome twice does not create a duplicate',
  $$INSERT INTO case_version_outcome VALUES (9201, 9301)$$,
  '23505');

-- A new version can carry the same outcome forward.
INSERT INTO case_version_outcome (case_version_id, outcome_id)
VALUES (9202, 9301);
SELECT test.assert_equals('both versions map to the outcome',
  (SELECT count(*) FROM case_version_outcome WHERE outcome_id = 9301),
  2::BIGINT);

ROLLBACK;
