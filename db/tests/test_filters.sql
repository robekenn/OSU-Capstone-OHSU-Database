-- FR-6: a user filters cases by course, campus, and outcome.
-- Acceptance: each filter alone returns only matching cases.
-- All data below is synthetic.
BEGIN;

INSERT INTO campus (id, name) VALUES
  (9401, 'Synthetic Campus North'),
  (9402, 'Synthetic Campus South');
INSERT INTO course (id, code, title) VALUES
  (9501, 'TEST 101', 'Synthetic Course 101'),
  (9502, 'TEST 202', 'Synthetic Course 202');
INSERT INTO outcome (id, framework, outcome_type, code, description) VALUES
  (9301, 'Test Framework', 'course', 'TF-1', 'Synthetic outcome 1'),
  (9302, 'Test Framework', 'course', 'TF-2', 'Synthetic outcome 2');

INSERT INTO sim_case (id, title) VALUES
  (9101, 'Case A'),
  (9102, 'Case B'),
  (9103, 'Case C');
INSERT INTO case_version (id, case_id, version_number) VALUES
  (9201, 9101, 1),
  (9202, 9102, 1),
  (9203, 9103, 1),
  (9204, 9103, 2);
UPDATE sim_case SET current_version_id = 9201 WHERE id = 9101;
UPDATE sim_case SET current_version_id = 9202 WHERE id = 9102;
UPDATE sim_case SET current_version_id = 9204 WHERE id = 9103;

-- Where each case runs:
--   A: North / TEST 101    B: South / TEST 101    C: South / TEST 202
INSERT INTO case_use (case_id, campus_id, course_id) VALUES
  (9101, 9401, 9501),
  (9102, 9402, 9501),
  (9103, 9402, 9502);

-- Outcomes: A -> TF-1, B -> TF-2. C mapped TF-1 only in its old version 1,
-- so an outcome search on current versions must not return C.
INSERT INTO case_version_outcome (case_version_id, outcome_id) VALUES
  (9201, 9301),
  (9202, 9302),
  (9203, 9301),
  (9204, 9302);

SELECT test.assert_equals('filter by course TEST 101',
  (SELECT array_agg(DISTINCT c.title ORDER BY c.title)
     FROM sim_case c JOIN case_use u ON u.case_id = c.id
    WHERE u.course_id = 9501),
  ARRAY['Case A', 'Case B']);

SELECT test.assert_equals('filter by campus South',
  (SELECT array_agg(DISTINCT c.title ORDER BY c.title)
     FROM sim_case c JOIN case_use u ON u.case_id = c.id
    WHERE u.campus_id = 9402),
  ARRAY['Case B', 'Case C']);

SELECT test.assert_equals('filter by outcome TF-1 uses current versions only',
  (SELECT array_agg(DISTINCT c.title ORDER BY c.title)
     FROM sim_case c
     JOIN case_version_outcome m ON m.case_version_id = c.current_version_id
    WHERE m.outcome_id = 9301),
  ARRAY['Case A']);

SELECT test.assert_raises(
  'a case cannot be listed under a nonexistent course',
  $$INSERT INTO case_use (case_id, campus_id, course_id)
    VALUES (9101, 9401, 999999)$$,
  '23503');

ROLLBACK;
