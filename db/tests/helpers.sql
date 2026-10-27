-- Assertion helpers for db/tests. db/test.sh loads this after schema.sql.
-- They live in their own "test" schema so they never mix with app tables.
--
-- SQLSTATE codes used in the tests:
--   23502 not_null_violation    23503 foreign_key_violation
--   23505 unique_violation

CREATE SCHEMA test;

-- Fails unless running stmt raises an error with SQLSTATE expected_state.
CREATE FUNCTION test.assert_raises(
  description TEXT, stmt TEXT, expected_state TEXT
) RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = expected_state THEN
      RETURN;
    END IF;
    RAISE EXCEPTION 'FAILED: % (expected SQLSTATE %, got %: %)',
      description, expected_state, SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'FAILED: % (statement succeeded, expected SQLSTATE %)',
    description, expected_state;
END
$$;

-- Fails unless actual equals expected (NULLs compare as equal).
CREATE FUNCTION test.assert_equals(
  description TEXT, actual ANYELEMENT, expected ANYELEMENT
) RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
  IF actual IS DISTINCT FROM expected THEN
    RAISE EXCEPTION 'FAILED: % (expected %, got %)',
      description, expected, actual;
  END IF;
END
$$;
