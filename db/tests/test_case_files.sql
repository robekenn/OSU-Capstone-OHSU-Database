-- Issue #63: attachment metadata. All data below is synthetic; no file bytes
-- are stored in the database, only metadata about fictional files.
-- SQLSTATE 23514 is check_violation.
BEGIN;

INSERT INTO app_user (id, name, email, role)
VALUES (9301, 'Synthetic Uploader', 'uploader@example.test', 'instructor');

INSERT INTO sim_case (id, title, owner_id) VALUES
  (9401, 'Synthetic Attachment Case A', 9301),
  (9402, 'Synthetic Attachment Case B', 9301);

INSERT INTO case_version (id, case_id, version_number, created_by) VALUES
  (9501, 9401, 1, 9301),
  (9502, 9402, 1, 9301);

INSERT INTO case_file (id, case_id, storage_key, original_filename, media_type,
                       size_bytes, sha256, uploaded_by)
VALUES (9601, 9401, 'cases/9401/00000000-0000-4000-8000-000000000001',
        'synthetic-handout.pdf', 'application/pdf', 1024, repeat('a', 64), 9301);

-- Defaults and the happy path.
SELECT test.assert_equals('upload time is recorded',
  (SELECT uploaded_at IS NOT NULL FROM case_file WHERE id = 9601), TRUE);
INSERT INTO case_version_file (case_version_id, case_file_id, case_id) VALUES (9501, 9601, 9401);

-- A file can only be linked to a version of the same case.
SELECT test.assert_raises(
  'a file cannot be linked to another case''s version',
  $$INSERT INTO case_version_file (case_version_id, case_file_id, case_id) VALUES (9502, 9601, 9402)$$,
  '23503');
SELECT test.assert_raises(
  'the link''s case must match the version and the file',
  $$INSERT INTO case_version_file (case_version_id, case_file_id, case_id) VALUES (9502, 9601, 9401)$$,
  '23503');

-- Each stored object belongs to exactly one metadata row.
SELECT test.assert_raises(
  'a storage key cannot be reused',
  $$INSERT INTO case_file (case_id, storage_key, original_filename, media_type, size_bytes, sha256, uploaded_by)
    VALUES (9401, 'cases/9401/00000000-0000-4000-8000-000000000001', 'copy.pdf', 'application/pdf', 1, repeat('b', 64), 9301)$$,
  '23505');

-- Disallowed types, sizes and malformed values are rejected by the database too.
SELECT test.assert_raises('an HTML file is rejected',
  $$INSERT INTO case_file (case_id, storage_key, original_filename, media_type, size_bytes, sha256, uploaded_by)
    VALUES (9401, 'cases/9401/00000000-0000-4000-8000-000000000002', 'page.html', 'text/html', 1, repeat('b', 64), 9301)$$,
  '23514');
SELECT test.assert_raises('a file over 25 MiB is rejected',
  $$INSERT INTO case_file (case_id, storage_key, original_filename, media_type, size_bytes, sha256, uploaded_by)
    VALUES (9401, 'cases/9401/00000000-0000-4000-8000-000000000003', 'big.pdf', 'application/pdf', 26214401, repeat('b', 64), 9301)$$,
  '23514');
SELECT test.assert_raises('an empty file is rejected',
  $$INSERT INTO case_file (case_id, storage_key, original_filename, media_type, size_bytes, sha256, uploaded_by)
    VALUES (9401, 'cases/9401/00000000-0000-4000-8000-000000000004', 'empty.pdf', 'application/pdf', 0, repeat('b', 64), 9301)$$,
  '23514');
SELECT test.assert_raises('a malformed checksum is rejected',
  $$INSERT INTO case_file (case_id, storage_key, original_filename, media_type, size_bytes, sha256, uploaded_by)
    VALUES (9401, 'cases/9401/00000000-0000-4000-8000-000000000005', 'x.pdf', 'application/pdf', 1, 'not-a-hash', 9301)$$,
  '23514');
SELECT test.assert_raises('a storage key outside the case prefix format is rejected',
  $$INSERT INTO case_file (case_id, storage_key, original_filename, media_type, size_bytes, sha256, uploaded_by)
    VALUES (9401, '../outside', 'x.pdf', 'application/pdf', 1, repeat('b', 64), 9301)$$,
  '23514');
SELECT test.assert_raises('a blank filename is rejected',
  $$INSERT INTO case_file (case_id, storage_key, original_filename, media_type, size_bytes, sha256, uploaded_by)
    VALUES (9401, 'cases/9401/00000000-0000-4000-8000-000000000006', '   ', 'application/pdf', 1, repeat('b', 64), 9301)$$,
  '23514');
SELECT test.assert_raises('an uploader is required',
  $$INSERT INTO case_file (case_id, storage_key, original_filename, media_type, size_bytes, sha256)
    VALUES (9401, 'cases/9401/00000000-0000-4000-8000-000000000007', 'x.pdf', 'application/pdf', 1, repeat('b', 64))$$,
  '23502');

-- Carry forward: version 2 copies version 1's links, then the file is removed
-- from version 2 only. Version 1 still has it and the metadata row remains.
INSERT INTO case_version (id, case_id, version_number, created_by) VALUES (9503, 9401, 2, 9301);
INSERT INTO case_version_file (case_version_id, case_file_id, case_id)
SELECT 9503, case_file_id, case_id FROM case_version_file WHERE case_version_id = 9501;
DELETE FROM case_version_file WHERE case_version_id = 9503 AND case_file_id = 9601;

SELECT test.assert_equals('the older version keeps the removed file',
  (SELECT count(*) FROM case_version_file WHERE case_version_id = 9501 AND case_file_id = 9601), 1::BIGINT);
SELECT test.assert_equals('the file metadata is not deleted',
  (SELECT count(*) FROM case_file WHERE id = 9601), 1::BIGINT);

-- A linked file's metadata cannot be deleted out from under a version.
SELECT test.assert_raises('a linked file cannot be deleted',
  $$DELETE FROM case_file WHERE id = 9601$$,
  '23503');

ROLLBACK;
