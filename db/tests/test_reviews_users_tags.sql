-- FR-7 (a review records reviewer, decision, comment, and time), FR-1 (users
-- sign in through OIDC), and the tag vocabulary used for search.
-- All data below is synthetic.
BEGIN;

INSERT INTO app_user (id, oidc_subject, name, email, role) VALUES
  (9001, 'test-subject-1', 'Test Author', 'author@example.test', 'educator'),
  (9002, 'test-subject-2', 'Test Reviewer', 'reviewer@example.test', 'educator');
INSERT INTO sim_case (id, title) VALUES (9101, 'Synthetic Case A');
INSERT INTO case_version (id, case_id, version_number) VALUES (9201, 9101, 1);

-- FR-7: a review records reviewer, decision, comment, and time.
INSERT INTO review (id, case_version_id, reviewer_id, decision, comments)
VALUES (9601, 9201, 9002, 'changes_requested', 'Synthetic comment');
SELECT test.assert_equals('review gets decided_at',
  (SELECT decided_at IS NOT NULL FROM review WHERE id = 9601), TRUE);

SELECT test.assert_raises(
  'a review without a reviewer is rejected',
  $$INSERT INTO review (case_version_id, decision) VALUES (9201, 'approved')$$,
  '23502');
SELECT test.assert_raises(
  'a review by a nonexistent user is rejected',
  $$INSERT INTO review (case_version_id, reviewer_id, decision)
    VALUES (9201, 999999, 'approved')$$,
  '23503');
SELECT test.assert_raises(
  'a review of a nonexistent version is rejected',
  $$INSERT INTO review (case_version_id, reviewer_id, decision)
    VALUES (999999, 9002, 'approved')$$,
  '23503');

-- FR-1: one account per OIDC subject and per email.
SELECT test.assert_raises(
  'two users cannot share an OIDC subject',
  $$INSERT INTO app_user (oidc_subject, name, email, role)
    VALUES ('test-subject-1', 'Dup', 'dup@example.test', 'educator')$$,
  '23505');
SELECT test.assert_raises(
  'two users cannot share an email',
  $$INSERT INTO app_user (name, email, role)
    VALUES ('Dup', 'author@example.test', 'educator')$$,
  '23505');

-- Tags: a name is unique within its category, not across categories.
INSERT INTO tag (category, name) VALUES ('modality', 'Test Value');
INSERT INTO tag (category, name) VALUES ('population', 'Test Value');
SELECT test.assert_raises(
  'a duplicate tag in the same category is rejected',
  $$INSERT INTO tag (category, name) VALUES ('modality', 'Test Value')$$,
  '23505');

ROLLBACK;
