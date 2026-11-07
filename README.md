# OHSU Simulation Database

A shared database where OHSU School of Nursing faculty can create, find, review, adapt and maintain simulation cases across campuses. Cases follow a standardized template and are searchable by course, campus, learning outcome and other curricular metadata, with version history and peer review.

## Project status

Early development. The repository currently contains:

- The PostgreSQL schema for cases, versions, outcome mapping, tags, campus use and reviews (`db/schema.sql`)
- Automated tests for that schema (`db/tests/`), run in CI on every pull request
- A React + TypeScript web client (`client/`) with a New case form (`/new`) and a Cases list (`/cases`) that has text search and course, campus and outcome filters
- A Node.js + Express + TypeScript API (`server/`) with `GET /api/health`, `GET /api/cases` (search and filters), `POST /api/cases`, and the `GET /api/courses`, `/api/campuses` and `/api/outcomes` lists behind the filter dropdowns
- Requirements and recorded design decisions (`docs/`)

The stack is PostgreSQL, Node.js + Express (TypeScript) and React + TypeScript (see `docs/requirements.md`, Constraints). Sign-in through OHSU's OIDC provider is required but not built yet, so the app has no login and every route is open. Hosting is waiting on OHSU IT approval.

## Quickstart

This gets you from a clean clone to the schema loaded in PostgreSQL with all tests passing. To run the web app as well, continue with [Run the app](#run-the-app).

### Prerequisites

- Git
- **Either** [Docker](https://docs.docker.com/get-docker/) **or** PostgreSQL 16 installed locally (server plus the `psql`, `createdb` and `dropdb` command-line tools)
- To run the app: [Node.js](https://nodejs.org/) 22.12 or newer (CI uses Node 22)

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
createdb ohsu_sim
psql -d ohsu_sim -v ON_ERROR_STOP=1 -f db/schema.sql
psql -d ohsu_sim -c '\dt'
```

With Docker, run the same commands inside the container, for example `docker exec ohsu-pg createdb -U postgres ohsu_sim`, and use `/repo/db/schema.sql` as the file path.

With local PostgreSQL, this is also the database the app uses in [Run the app](#run-the-app), so you only need to create it once.

Use only synthetic data in any database you create. See [Data safety](#data-safety).

### Troubleshooting

- **`$'\r': command not found`:** `db/test.sh` was checked out with Windows line endings. Run `sed -i 's/\r$//' db/test.sh` and try again.
- **Asked for a password over and over:** your local PostgreSQL uses password sign-in, and the script connects several times. Store the password once in a [`.pgpass` file](https://www.postgresql.org/docs/16/libpq-pgpass.html) rather than typing it each time, and never commit that file.
- **`createdb: error: ... permission denied`:** your PostgreSQL user can't create databases. Use a user that can, such as `postgres`.
- **A test prints `FAIL`:** the line under it names the requirement that broke, for example `FAILED: a case without a title is rejected`.

## Run the app

The app is two npm workspaces: the API in `server/` (port 3000) and the web client in `client/` (Vite). The client forwards `/api` requests to the API, so open the client's URL in the browser.

### 1. Start a database with the schema loaded

The API needs a PostgreSQL database it can reach on `localhost:5432` with `db/schema.sql` loaded.

- **Local PostgreSQL:** follow [Explore the schema](#3-explore-the-schema-optional) to create `ohsu_sim`.
- **Docker:** the test container in step 2a doesn't publish a port, so start a separate one that does:

  ```bash
  docker run -d --name ohsu-pg-app -e POSTGRES_HOST_AUTH_METHOD=trust \
    -p 5432:5432 -v "$PWD":/repo postgres:16.15
  docker exec ohsu-pg-app pg_isready -U postgres   # repeat until "accepting connections"
  docker exec ohsu-pg-app createdb -U postgres ohsu_sim
  docker exec ohsu-pg-app psql -U postgres -d ohsu_sim -v ON_ERROR_STOP=1 -f /repo/db/schema.sql
  ```

  If something else is already using port 5432 (such as a local PostgreSQL), stop it first or map another port, for example `-p 5433:5432`, and use that port in step 2.

### 2. Configure the API

```bash
cp server/.env.example server/.env
```

Edit `DATABASE_URL` in `server/.env` to point at your database. With the Docker container above it is `postgres://postgres@localhost:5432/ohsu_sim`. `server/.env` is ignored by Git and blocked by CI; never commit it or paste its contents anywhere.

### 3. Install and start

```bash
npm ci
npm run dev --workspace server   # terminal 1: API on http://localhost:3000
npm run dev --workspace client   # terminal 2: prints the client URL
```

The API checks the database connection when it starts and exits with an error if it can't connect. Open the client URL; `/` redirects to `/cases`. [Cases list demo (#37)](docs/issue-37-demo.md) has a step-by-step walkthrough using synthetic data.

### App checks

From the repository root, these run the same checks as CI's app job. They don't need a database.

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

The server's filter tests (`server/tests/`) need a throwaway PostgreSQL database and are skipped unless `TEST_DATABASE_URL` points at one. The suite wipes and reloads that database, so its name must end in `_test`. Use a different name from `ohsu_sim_test`, which `db/test.sh` creates and drops on every run:

```bash
createdb ohsu_sim_server_test   # or: docker exec ohsu-pg-app createdb -U postgres ohsu_sim_server_test
TEST_DATABASE_URL=postgres://postgres@localhost:5432/ohsu_sim_server_test npm test --workspace server
```

Never point `TEST_DATABASE_URL` at a database whose data you want to keep. CI doesn't set it yet, so these tests only run when you run them locally.

## Repository layout

| Path | Contents |
|---|---|
| `client/` | React + TypeScript web client (Vite, React Router) |
| `server/` | Node.js + Express + TypeScript API; `server/.env.example` lists the settings it needs |
| `package.json` | npm workspaces root; runs `lint`, `typecheck`, `test` and `build` across `client/` and `server/` |
| `db/schema.sql` | PostgreSQL schema |
| `db/test.sh` | Loads the schema into an empty database and runs the tests |
| `db/tests/` | SQL tests, one file per area, mapped to requirement IDs |
| `docs/requirements.md` | What the product must do, with acceptance criteria, non-goals and open questions |
| `docs/design.md` | System design: architecture, API contract, data design and open questions |
| `docs/risks.md` | Project risk register, reviewed at sprint planning |
| `docs/rfcs/` | Recorded design decisions, each with the options considered and why |
| `docs/schema/` | Plain-language explanation of each table and column in the schema |
| `docs/issue-37-demo.md` | Walkthrough of the New case → Cases list demo |
| `.github/workflows/ci.yml` | CI: secret scan, schema tests, and app lint/typecheck/test/build |
| `AGENTS.md` | Guide for AI coding tools and contributors, including data-safety rules |
| `CONTRIBUTING.md` | Branching, pull requests, Definition of Done |

## Continuous integration

Every pull request and every push to `main` runs three jobs:

- **Secrets and sensitive files:** blocks tracked `.env`, key and secret files, and scans the full Git history with gitleaks
- **Database schema and tests:** loads `db/schema.sql` into PostgreSQL 16.15 and runs `db/tests/`
- **App lint, test, build:** on Node 22, runs `npm ci` and then `lint`, `typecheck`, `test` and `build` across both workspaces

A pull request can merge only when all three pass and a teammate other than the author has approved it.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) for branch naming, pull request rules and the Definition of Done. Read [AGENTS.md](AGENTS.md) before making changes, especially if you use AI coding tools.

When you change `db/schema.sql`, add or update a test in `db/tests/` that would fail if your change were reverted.

## Data safety

This is a public repository. Never commit or paste real patient, learner, faculty or simulated-patient data, OHSU internal hostnames, or credentials of any kind. All test and demo data must be clearly synthetic. [AGENTS.md](AGENTS.md#data-safety-and-confidentiality) has the full rules.

## License

No license has been chosen yet, so no rights to reuse this code are granted. The license will be decided with the capstone instructor and the project partner.
