#!/usr/bin/env bash
# Loads db/schema.sql into a fresh, empty database, then runs every
# db/tests/test_*.sql file against it. Exits non-zero if the schema fails to
# load or any test fails. CI runs this on every pull request.
#
# Run locally (needs psql, createdb and a Postgres you can create databases on):
#   bash db/test.sh
# Point it at your server with the usual PG* variables, for example:
#   PGHOST=localhost PGUSER=postgres bash db/test.sh
#
# Each test file wraps itself in BEGIN ... ROLLBACK, so tests never see each
# other's rows. All test data is synthetic (see AGENTS.md, Development data).
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
db="${TEST_DB:-ohsu_sim_test}"
run_psql=(psql -X -q -v ON_ERROR_STOP=1 -d "$db")

dropdb --if-exists "$db"
createdb "$db"
trap 'dropdb --if-exists "$db"' EXIT

# NFR-2: schema.sql runs without errors on an empty PostgreSQL database.
# --single-transaction means a broken schema leaves nothing half-created.
echo "Loading schema.sql into empty database $db"
"${run_psql[@]}" --single-transaction -f "$here/schema.sql"
"${run_psql[@]}" -f "$here/tests/helpers.sql"

passed=0
failed=0
shopt -s nullglob
for test_file in "$here"/tests/test_*.sql; do
  name="$(basename "$test_file")"
  if output="$("${run_psql[@]}" -f "$test_file" 2>&1)"; then
    echo "PASS  $name"
    passed=$((passed + 1))
  else
    echo "FAIL  $name"
    echo "$output" | sed 's/^/      /'
    failed=$((failed + 1))
  fi
done

if [ $((passed + failed)) -eq 0 ]; then
  echo "No db/tests/test_*.sql files found."
  exit 1
fi

echo "$passed passed, $failed failed"
[ "$failed" -eq 0 ]
