# RFC: PostgreSQL vs MariaDB for the OHSU Simulation Database

| Field | Value |
| --- | --- |
| Author | Amit Lad |
| Date | 2026-10-24 |
| Status | Accepted |
| Decision Date | 2026-10-06 |
| Deciders | Whole group |
| Superseded By | |

## Problem and Context

OHSU School of Nursing has given us a task of creating a centralized simulation case database with a frontend where faculty members can organize all the case simulations in one place. The database must store long, structured cases, keep a version history for each case, and let faculty search by course, campus, and learning outcome.

For this, we need to decide what database management system would be best for this project. We narrowed the choice down to two relational databases, PostgreSQL and MariaDB, because these are the two the group has the most experience with.

We made this decision early because this is the backbone of our project. The rest of our project will be based on the database we create. Switching later would mean rewriting the schema, redoing the import code, and migrating any cases already entered.

## Options

### Option A: PostgreSQL

PostgreSQL is an open-source relational database that is built to safely store and manage complex data. This option is well suited for handling advanced queries, keeping data accurate, and supporting heavy workloads for large applications ("What is PostgreSQL?".

**Benefits:**
- Uses indexing to support query performance so users can query quickly.
- Defines custom data types.
- Has JSONB, which allows for storing and operating on JSON objects.
- Comparable to commercial databases like Oracle.

**Costs**
- It's a new tool for part of the team. Most of us have used MariaDB in class, so Postgres is just a new tool with different syntax.
- Because we will use JSONB, this part will not run on other databases. This would make it very difficult for us to swap databases because it is a feature only Postgres has.
- It introduces unnecessary complexity and configuration for small, simple apps. 

### Option B: MariaDB

MariaDB is an open-source relational database used to store, organize, and manage information. It was created by the developers of MySQL as a faster alternative and is designed so that websites and apps can easily switch from MySQL to MariaDB without changing their code (Charles).

**Benefits:**
- Easy to migrate to MySQL without having to change code.
- It is a lightweight server that integrates quickly with third-party tools.
- It is very easy to use.

**Costs:**
- Does not support a native JSON data type the way PostgreSQL does.
- For enterprise users, you need to pay a subscription to use. 

### Option C: Do Nothing

Keep simulation cases as Word files stored in shared folders across courses and campuses, like what they do today. No database is built.

**Benefits:**
- No building or hosting costs.
- Faculty keep the workflow they already know.

**Costs**
- Faculty cannot search by course, campus, or learning outcome.
- There is no version history.

**When the cost arrives:** 
- The cost arrives now. As the number of cases grows, nobody can remember what exists or which version is the newest.

**Right choice when:**
- There are only a few cases, and only one campus uses it. Also when cases do not need version history.

## Analysis

MariaDB's official page says that its JSON type is an alias for LONGTEXT (“JSON Data Type | Server | MariaDB Documentation”). So what it's trying to say is that it is stored as text with a validity check. According to PostgreSQL committer Michael Paquier, JSONB stores data in a decomposed binary format, which makes writes slower but reads faster and supports GIN indexing (Paquier). For our project, cases are written less often than  searches are used. For security, PostgreSQL is stronger (EDB). It allows for role-based access control, row-level security, and support for detailed auditing (EDB). This is important as these cases belong to OHSU and might include sensitive information. PostgreSQL uses a permissive license that allows for use with minimal restrictions. MariaDB, on the other hand, uses a mix of licenses, which brings limitations around commercial use (EDB). 

## Recommendation and Verification Plan

My recommendation is PostgreSQL. It is the option that wins because of the requirements we got from OHSU. The cases are long and structured, and the templates will change. JSONB lets users store that content without a migration for every template change, while courses, campus, and outcomes stay in indexed tables for search.

We will know it worked when:
1. Both sample cases import with no missing sections, confirmed by our sponsor.
2. A case saved through the frontend form reloads with every field unchanged.
3. Searching by course, campus, and outcome returns exactly the cases we implemented.
4. Adding a new section to the template on a test branch requires no schema migration.

## Constraints

- **Licensing:** PostgreSQL uses a permissive license, so it works with private or open-source repos.
- **Data use:** The cases are simulated, not real patient records.
- **IP:** The case content belongs to OHSU, and we only store it.
- **Confidentiality:** The templates come from our project partner. We describe their structure but do not include their content in the repo or into AI tools without project partner approval. 

## Delegation and Validation

- **What you handed to AI tools**: I used Claude to explain JSONB and the PostgreSQL vs. MariaDB differences. I gave it the project description information only, and did not give it sample OHSU content. 

- **What checks made that reasonable**: Every claim I made is cited. Our contributions page has rules set up so that a teammate other than the author has to approve the PR before it merges. We currently do not have CI set up. 

- **Where you stopped and validated the result yourself, and why those points.** I opened each source and confirmed they support what I wrote. I confirmed PostgreSQL experience on the team with teammates. This decision is hard to reverse because of the schema and import code that depend on it.

## Decision

Accepted - 10/13 - Amit Chaired the decision

## Resources
Charles, Colin. “MariaDB vs Mysql: Key Differences and Use Cases.” Percona, 9 June 2026, www.percona.com/blog/mysql-vs-mariadb-reality-check/. 

“JSON Data Type: Server: Mariadb Documentation.” Server | MariaDB Documentation, mariadb.com/docs/server/reference/data-types/string-data-types/json. Accessed 25 Oct. 2026. 

Paquier, Micheal. “Postgres 9.4 Feature Highlight - Indexing JSON Data with JSONB Data Type.” Michael Paquier - PostgreSQL Committer, 14 June 2014, https://paquier.xyz/postgresql-2/postgres-9-4-feature-highlight-indexing-jsonb/. Accessed 24 Oct. 2026. 

Team, EDB. “MariaDB vs. Postgresql: Choosing the Right Open Source Database.” EDB, 6 Feb. 2026, www.enterprisedb.com/blog/mariadb-vs-postgresql. 
“What Is Postgresql? - Postgresql Explained - AWS.” What Is PostgreSQL?, aws.amazon.com/rds/postgresql/what-is-postgresql/. Accessed 25 Oct. 2026. 

