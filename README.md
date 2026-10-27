# OHSU Simulation Database

A shared database where OHSU School of Nursing faculty can create, find, review, adapt and maintain simulation cases across campuses. Cases follow a standardized template and are searchable by course, campus, learning outcome and other curricular metadata, with version history and peer review.

## Project status

Early development. The repository currently contains:

- The PostgreSQL schema for cases, versions, outcome mapping, tags, campus use and reviews (`db/schema.sql`)
- Automated tests for that schema (`db/tests/`), run in CI on every pull request
- Requirements and recorded design decisions (`docs/`)

There is no web application yet. The planned stack is PostgreSQL, Node.js + Express (TypeScript) and React + TypeScript, with sign-in through OHSU's OIDC provider (see `docs/requirements.md`, Constraints). Hosting is waiting on OHSU IT approval. This README will gain app setup steps when the app exists.

## Quickstart

This gets you from a clean clone to the schema loaded in PostgreSQL with all tests passing.

### Prerequisites

- Git
- **Either** [Docker](https://docs.docker.com/get-docker/) **or** PostgreSQL 16 installed locally (server plus the `psql`, `createdb` and `dropdb` command-line tools)

### 1. Clone

```bash
git clone https://github.com/robekenn/OSU-Capstone-OHSU-Database.git
cd OSU-Capstone-OHSU-Database
```

### 2a. Run the tests with Docker

This uses the same PostgreSQL image as CI. No local PostgreSQL install is needed.

```bash
docker run -d --name ohsu-pg -e POSTGRES_HOST_AUTH_METHOD=trust \
  -v "$PWD":/repo postgres:16.15

# Repeat until it prints "accepting connections" (a few seconds)
docker exec ohsu-pg pg_isready -U postgres

docker exec -e PGUSER=postgres ohsu-pg bash /repo/db/test.sh
```

On Windows in Git Bash, start the first command with `MSYS_NO_PATHCONV=1` and use `"$(pwd -W)"` in place of `"$PWD"`, so the folder mounts correctly.

When you're finished: `docker rm -f ohsu-pg`

### 2b. Or run the tests with a local PostgreSQL

Point the standard `PG*` environment variables at a server where your user can create databases:

```bash
PGHOST=localhost PGUSER=postgres bash db/test.sh
```

### Expected output

```
NOTICE:  database "ohsu_sim_test" does not exist, skipping
Loading schema.sql into empty database ohsu_sim_test
PASS  test_cases_and_versions.sql
PASS  test_filters.sql
PASS  test_outcome_mapping.sql
PASS  test_reviews_users_tags.sql
4 passed, 0 failed
```

The `NOTICE` line is normal. The script creates a temporary database named `ohsu_sim_test`, loads the schema, runs the tests and drops the database when it finishes.

### 3. Explore the schema (optional)

To keep a database you can query, load the schema into one yourself. With local PostgreSQL:

```bash
createdb ohsu_sim_dev
psql -d ohsu_sim_dev -v ON_ERROR_STOP=1 -f db/schema.sql
psql -d ohsu_sim_dev -c '\dt'
```

With Docker, run the same commands inside the container, for example `docker exec ohsu-pg createdb -U postgres ohsu_sim_dev`, and use `/repo/db/schema.sql` as the file path.

Use only synthetic data in any database you create. See [Data safety](#data-safety).

### Troubleshooting

- **`$'\r': command not found`:** `db/test.sh` was checked out with Windows line endings. Run `sed -i 's/\r$//' db/test.sh` and try again.
- **Asked for a password over and over:** your local PostgreSQL uses password sign-in, and the script connects several times. Store the password once in a [`.pgpass` file](https://www.postgresql.org/docs/16/libpq-pgpass.html) rather than typing it each time, and never commit that file.
- **`createdb: error: ... permission denied`:** your PostgreSQL user can't create databases. Use a user that can, such as `postgres`.
- **A test prints `FAIL`:** the line under it names the requirement that broke, for example `FAILED: a case without a title is rejected`.

## Repository layout

| Path | Contents |
|---|---|
| `db/schema.sql` | PostgreSQL schema |
| `db/test.sh` | Loads the schema into an empty database and runs the tests |
| `db/tests/` | SQL tests, one file per area, mapped to requirement IDs |
| `docs/requirements.md` | What the product must do, with acceptance criteria, non-goals and open questions |
| `docs/rfcs/` | Recorded design decisions, each with the options considered and why |
| `.github/workflows/ci.yml` | CI: secret scan, schema tests, and app lint/test/build once app code exists |
| `AGENTS.md` | Guide for AI coding tools and contributors, including data-safety rules |
| `CONTRIBUTING.md` | Branching, pull requests, Definition of Done |

## Continuous integration

Every pull request and every push to `main` runs three jobs:

- **Secrets and sensitive files:** blocks tracked `.env`, key and secret files, and scans the full Git history with gitleaks
- **Database schema and tests:** loads `db/schema.sql` into PostgreSQL 16.15 and runs `db/tests/`
- **App lint, test, build:** runs once a root `package.json` exists; skipped with a notice until then

A pull request can merge only when all three pass and a teammate other than the author has approved it.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) for branch naming, pull request rules and the Definition of Done. Read [AGENTS.md](AGENTS.md) before making changes, especially if you use AI coding tools.

When you change `db/schema.sql`, add or update a test in `db/tests/` that would fail if your change were reverted.

## Data safety

This is a public repository. Never commit or paste real patient, learner, faculty or simulated-patient data, OHSU internal hostnames, or credentials of any kind. All test and demo data must be clearly synthetic. [AGENTS.md](AGENTS.md#data-safety-and-confidentiality) has the full rules.

## License

No license has been chosen yet, so no rights to reuse this code are granted. The license will be decided with the capstone instructor and the project partner.
