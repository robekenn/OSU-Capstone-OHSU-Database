# RFC: PostgreSQL vs MariaDB for the OHSU Simulation Database

| Field | Value |
| --- | --- |
| Author | Amit Lad |
| Date | 2026-11-21 |
| Status | Accepted |
| Decision Date | 2026-10-13 |
| Deciders | Whole group |
| Superseded By | None |

## Problem and Context

OHSU School of Nursing runs simulation cases across several campuses. Each case is a long Word document, and there is no central place to keep them. The faculty cannot easily find a case by course, campus, or learning outcome. They also cannot tell which copy is current and cannot reuse a case at another campus. Without a shared record, a revised copy cannot be traced back to the case it came from (`docs/requirements.md`).

Our capstone team was tasked with building a centralized simulation case database with a web frontend where faculty can enter, search, review, and revise cases. Reuse matters because campuses teach overlapping courses. One case can be used in several courses at several campuses, and the schema records each campus and course pairing separately. The database must be able to store long, structured cases, keep version history for every case, and allow faculty to search by course, campus, and learning outcome. A case is more than a few paragraphs. It can include patient charts, orders, equipment, roles, prebrief, scenario grids, debrief guides, and evaluation. The team was given two sample templates to model it on. Every saved edit must become a new version that keeps the old one, and each version moves through draft, in review, approved, and archived states.

For this, we need to decide what database management system would be best for this project. The API, the import tool, and every frontend screen sit on top of this choice. We narrowed the decision down to two relational database management systems, PostgreSQL and MariaDB, because they are the two the team has the most experience with. Doing nothing is also an option and is assessed below. 

The decision was made before other work could be done, because everything else is written for whichever system we pick. The schema, the import code, and every case already entered would all need to be rewritten or migrated to switch later. Each new table, query, or imported case raises that price. So waiting would make the decision more expensive without making it easier. The group accepted the decision on 10-13-2026 and has built on it since. If the choice proved wrong, the cost would arrive late in the project, when most cases are already entered and the least time remains to migrate them. This RFC records the reasoning and states how we will confirm it was right. 

## Options

### Option A: PostgreSQL

PostgreSQL is an open-source relational database that is built to safely store and manage complex data. This option is well suited for handling advanced queries, keeping data accurate, and supporting heavy workloads for large applications ("What is PostgreSQL?").

**Benefits:**
- Uses indexing to support query performance so users can query quickly.
- Defines custom data types.
- JSONB allows us to store and query JSON documents inside a relational table.
- It is compared to commercial databases such as Oracle.


**Costs:**
- It's a new tool for part of the team. Most of us have used MariaDB in class, so Postgres is just a new tool with different syntax.
- Because we will use JSONB, this part will not run on other databases. This would make it very difficult for us to swap databases because it is a feature only Postgres has.
- It introduces unnecessary complexity and configuration for small, simple apps. 

**Right Choice When:**
- The data is long and structured. The structure is expected to change, and search and access control matter.

### Option B: MariaDB

MariaDB is an open-source relational database used to store, organize, and manage information. It was created by the developers of MySQL as a faster alternative and is designed so that websites and apps can easily switch from MySQL to MariaDB without changing their code (Charles).

**Benefits:**
- Code can move to and from MySQL without changes.
- It is a lightweight server that integrates quickly with third-party tools.
- It is very easy to use.

**Costs:**
- Does not support a native JSON data type the way PostgreSQL does.
- For enterprise users, you need to pay a subscription to use it. 

**Right Choice When:** 
- The data is flat and stable, the team already runs MySQL projects, and easy movement to MySQL matters more than flexible document storage. 

MySQL is not listed as a separate option. MariaDB is the MySQL-compatible choice the team already knows from class, and no one on the team has experience with MySQL itself. We did not evaluate MySQL’s own JSON type. If the team ever needs a MySQL database, the cost list for Option B should be rechecked against MySQL before relying on it. 

### Option C: Do Nothing

Keep simulation cases as Word files stored in shared folders across courses and campuses, like what they do today. No database is built.

**Benefits:**
- No building or hosting costs.
- Faculty keep the workflow they already know.

**Costs:**
- Faculty cannot search by course, campus, or learning outcome.
- There is no version history.
- There is no place to store everything together.

**When the cost arrives:** 
- The cost arrives now. As the number of cases grows, nobody can remember what exists or which version is the newest.

**Right Choice When:**
- There are only a few cases, and only one campus uses it, and when cases do not need version history.

Doing nothing is the only option with no technical risks, but it fails the purpose of the project. Search by course, campus, outcomes, and a version history for every case. These are exactly what folders of Word files cannot provide (`docs/requirements.md`). It also leaves the next team, or OHSU itself, with the same scattered files and no record of which copy is current.

## Analysis

**Performance:**
MariaDB's official page says that its JSON type is an alias for LONGTEXT (“JSON Data Type | Server | MariaDB Documentation”). So what it's trying to say is that it is stored as text with a validity check. According to PostgreSQL committer Michael Paquier, JSONB stores data in a decomposed binary format, which makes writes slower but reads faster and supports GIN indexing (Paquier). Our own schema reduces how much this matters. In `db/schema.sql`, the faculty search fields by campus, course, and outcome live in relational tables, and `idx_case_use_campus_course` indexes the campus and course pair. The JSONB content column on `case_version`  holds the template body only. Each save also adds one new row instead of updating the old one (FR-3 in `docs/requirements.md`). There is a test we have not measured yet, which is search time on a large dataset. 

**Complexity and Maintainability:**
The template will change, and JSONB lets a new section appear without a schema migration. If we choose MariaDB, we would have to redesign the content column. We accept that because the stable relational tables would move without much trouble. The learning curve is real but small. Our CI already runs PostgreSQL, and `bash db/test.sh` loads the schema into an empty database, so teammates learn the tool through work they already do.

**Security:** 
EDB reports that PostgreSQL is stronger because it allows for role-based access control, row-level security, and support for detailed auditing (EDB). This is important as these cases belong to OHSU and might include sensitive information. EDB also reports that MariaDB offers baseline security with privileged access and optional encryption but states that PostgreSQL offers more advanced and built-in controls (EDB). 

**Cost and Licensing:** 
PostgreSQL uses a permissive license that allows for use with minimal restrictions. MariaDB, on the other hand, uses a mix of licenses, which brings limitations around commercial use (EDB). The team and OHSU would pay nothing for either one at our scale, so licensing counts as a secondary factor.

**What the Evidence Shows:**
The project evidence (the schema, CI file, database tests, and requirements) shows that PostgreSQL works for our data model today. The outside sources describe how each system behaves in general.


## Recommendation and Verification Plan

My recommendation is PostgreSQL. It is the option that wins because of the requirements we got from OHSU. The cases are long and structured, and the templates will change. JSONB lets users store that content without a migration for every template change, while courses, campus, and outcomes stay in indexed tables for search. Test 7 below checks search speed at scale, the one claim we have not measured yet.

These tests run SQL directly against PostgreSQL where possible, so a frontend bug cannot hide a storage failure. Tests 3 and 4 are already covered by `db/tests/test_cases_and_versions.sql`, and test 5 by `db/tests/test_filters.sql`. Tests 1, 2, 6, and 7 still need to be built.

| Number | Test | Pass Condition |
| --- | --- | --- |
| 1 | Import both sample templates given to the team. | No section is missing, and the project sponsor confirms. |
| 2 | Save a case through the form, then reload it. | Every field is unchanged. |
| 3 | Save one case three times, then read its history twice. | Exactly three versions numbered 1, 2, and 3, and both reads return the same history. |
| 4 | Save a case, update it, then read the history | Version 1 still holds the original content, version 2 holds the updated history. |
| 5 | Search by course, by campus, and by outcome | Each search returns the expected cases, and outcome search uses current versions only. |
| 6 | Add a new section to the template on a test branch. | `db/schema.sql` is unchanged and all database tests still pass. |
| 7 | Load 10, 50, 100, and 1000 cases and run the course, campus, and outcome search. | Every run is under the 10-second limit in NFR-1. |

If tests 3, 4, or 5 fail, we fix the schema or query before merging. If test 7 goes over its limit and a better index does not fix it, we reopen this decision with a new RFC.

## Constraints

- **Licensing:** PostgreSQL uses a permissive license, so it works with private or open-source repos. This does not rule out option A. MariaDB’s mixed licensing is a minor cost on Option B only.
- **Data use:** The cases are simulated, not real patient records. Every test in this plan therefore uses fake data. 
- **IP:** The case content belongs to OHSU, and we only store it. This rules out any option that would copy or host content outside OHSU’s approval. Hosting remains pending OHSU IT approval, and the RFC does not choose a host. 
- **Confidentiality:** The templates come from our project partner. We describe their structure but do not include their content in the repo or into AI tools without the project partner's approval. Test 1 runs only on partner-approved cases. Third-party services used in development, such as Supabase Auth, must only receive fake data. The production host and sign-in provider are separate decisions still pending OHSU IT approval.

## Delegation and Validation

- **What you handed to AI tools:** I used Claude to explain JSONB and the PostgreSQL vs. MariaDB differences. I gave it the project description information only, and did not give it sample OHSU content. The decision, evidence, and final wording are mine. I also used Claude to help draft and revise parts of this final RFC after peer review

- **What checks made that reasonable:** Every claim I made cites a source or a repository file. `CONTRIBUTING.md` requires passing CI and one approval from someone other than the author before a PR merges. CI now loads `db/schema.sql` into PostgreSQL 16.15 and runs the database tests, runs a secret scan, and lints, type-checks, and builds the app. My draft said CI was not set up. This is no longer true. 

- **Where you stopped and validated the result yourself, and why those points:** I opened each source and confirmed they support what I wrote. This is because a wrong claim about JSONB would put a wrong decision under the schema, which is hard to undo. I confirmed PostgreSQL experience on the team with teammates. This decision is hard to reverse because of the schema and import code that depend on it.

## Decision

Accepted on 10-13-2026. The whole group made the decision, and the author chaired it. The revision responds to peer and instructor review and does not change the decision.

## Resources
Charles, Colin. “MariaDB vs Mysql: Key Differences and Use Cases.” Percona, 9 June 2026, www.percona.com/blog/mysql-vs-mariadb-reality-check/. 

“JSON Data Type: Server: Mariadb Documentation.” Server | MariaDB Documentation, mariadb.com/docs/server/reference/data-types/string-data-types/json. Accessed 25 Oct. 2026. 

Paquier, Micheal. “Postgres 9.4 Feature Highlight - Indexing JSON Data with JSONB Data Type.” Michael Paquier - PostgreSQL Committer, 14 June 2014, https://paquier.xyz/postgresql-2/postgres-9-4-feature-highlight-indexing-jsonb/. Accessed 24 Oct. 2026. 

Team, EDB. “MariaDB vs. Postgresql: Choosing the Right Open Source Database.” EDB, 6 Feb. 2026, www.enterprisedb.com/blog/mariadb-vs-postgresql. 

“What Is Postgresql? - Postgresql Explained - AWS.” What Is PostgreSQL?, aws.amazon.com/rds/postgresql/what-is-postgresql/. Accessed 25 Oct. 2026. 

