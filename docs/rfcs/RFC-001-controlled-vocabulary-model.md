# RFC: Use a Governed Vocabulary Registry for Simulation Search Metadata

| Field | Value |
|---|---|
| Author | Kenneth Robertson |
| Date | 2026-10-20 |
| Status | Draft |
| Decision Date | To be completed when decided |
| Deciders | OSU Capstone team, with OHSU project-partner confirmation |
| Superseded By | None |

## Problem and Context

The OHSU Simulation Database must let faculty find cases by campus, clinical topic, learner level, population, modality, competency, learning outcome, and other metadata. Search only works reliably if equivalent concepts use the same stored value. For example, “pediatrics,” “pediatric,” and “Peds” should not become three unrelated filters unless OHSU intentionally defines them that way.

The proposed schema in pull request #3 uses a generic `tag` table with `category` and `name` text fields, plus a join table connecting tags to case versions [1]. The pair is unique, but the database does not restrict valid categories, identify a stable code, distinguish preferred names from synonyms, record who governs a vocabulary, or retire an outdated term. The team needs to choose a metadata model before cases are imported and faculty begin depending on filters.

This decision is hard to reverse after adoption. Renaming a displayed label is easy, but determining whether two existing labels mean the same clinical concept requires domain judgment. If the team does nothing, duplicate and misspelled terms could fragment search results, weaken curricular reports, and make later cleanup depend on guesses.

## Options

### Option A: Separate Table for Every Metadata Type

Create dedicated tables and joins for `clinical_topic`, `population`, `learner_level`, `modality`, and every other approved facet. Each table can have its own columns and constraints. This provides strong typing and makes invalid cross-category references difficult. It is appropriate for major entities such as campus, course, and learning outcome, which already have dedicated tables in the proposed schema.

Its cost is schema growth. Adding a new facet requires a migration, application model, API changes, and new joins. Many small lookup tables would repeat the same fields and administrative behavior. The team also does not yet know every search facet the partner will require.

### Option B: Governed Vocabulary Registry

Create a `vocabulary` table for approved schemes and a `vocabulary_term` table for their values. A term would have a stable code, preferred label, optional definition, status, and vocabulary identifier. Optional alias and parent-term tables could support synonyms and simple hierarchies. A join table would connect case versions to terms. Campuses, courses, outcomes, users, and workflow states would remain dedicated domain tables rather than being converted into generic terms.

This preserves flexibility while preventing arbitrary category names. A displayed label could change without changing the stable code used by data and integrations. Deprecated terms could remain attached to historical versions while being unavailable for new selections. The W3C SKOS standard uses comparable ideas—concept schemes, stable notations, preferred labels, alternative labels, and broader/narrower relationships—although this project would implement only the small subset it needs [4].

The cost is that application code must know which vocabularies are permitted or required for a case. A generic join cannot express every rule by foreign keys alone. The team must also establish who may add, rename, merge, or retire terms.

### Option C: Do Nothing - Keep `tag(category, name)`

Merge the current schema and let authorized users create category and name strings as needed. This is the fastest path for a prototype and requires no vocabulary-governance interface. The unique constraint prevents an exact duplicate pair.

However, exact uniqueness does not prevent spelling, capitalization, abbreviation, or synonym duplicates. It also gives no stable identifier independent of the label. Search and reporting quality would increasingly depend on manual cleanup. This option is credible only while all data is disposable.

## Analysis

The primary tradeoff is integrity versus adaptability. Dedicated tables provide the clearest database model, but using them for every small facet would commit the team to categories that are still being discovered. The repository guidance explicitly says controlled vocabularies are important while the domain list is not yet a final database schema [2]. A registry handles that uncertainty without accepting unrestricted text.

PostgreSQL foreign keys can ensure that every case-term assignment points to an existing term, while unique constraints can prevent duplicate codes within a vocabulary [3]. A possible minimum model is:

- `vocabulary(id, key, name, managed_by, status)`
- `vocabulary_term(id, vocabulary_id, code, preferred_label, definition, status)`
- `term_alias(term_id, alias)`
- `case_version_term(case_version_id, term_id)`

The database should enforce uniqueness for vocabulary keys, `(vocabulary_id, code)`, aliases within a vocabulary, and case-version/term pairs. Terms referenced by historical cases should be retired rather than deleted. Application validation should restrict which vocabulary schemes may be assigned and prevent deprecated terms from being selected for new versions.

Performance is unlikely to distinguish Options A and B at the project’s expected early scale. Both use ordinary joins and indexes. The team has no production-sized dataset or query measurements, so this RFC does not claim a latency advantage. Option C may be simple to query, but inaccurate categories would make a fast query return incomplete results.

Option B adds moderate governance complexity but reduces later data-cleaning risk. It also supports future partner-approved synonyms: a search for an alias can resolve to one preferred term rather than creating a second filter value. The largest uncertainty is whether OHSU already maintains authoritative lists for any facets. Existing standards or partner lists should be imported with their original codes instead of recreated by the team.

## Recommendation and Verification Plan

I recommend Option B, with dedicated tables retained for campuses, courses, outcomes, users, and workflow entities. It gives OHSU consistent filters without requiring a new schema migration for every future vocabulary.

The decision will be considered successful when:

- The database rejects duplicate term codes within one vocabulary and references to nonexistent terms.
- Users can select terms only from approved vocabularies; ordinary case authors cannot create new terms during case editing.
- Searching by a preferred label or approved alias returns the same synthetic cases.
- Combined filters across at least three vocabularies return the expected intersection.
- Retiring a term removes it from new selections but does not alter historical case versions.
- Renaming a preferred label does not change the stable code or break existing case mappings.
- A migration of synthetic current-style tags produces a report of migrated, duplicate, and unresolved terms; ambiguous terms are not merged automatically.
- Query plans and response times are measured against a synthetic dataset after the team agrees on an expected case count and latency target.

These checks should become database and integration tests when a test framework exists. Today the repository has no CI workflow or executable test suite, so the immediate gate is the required teammate review documented in `CONTRIBUTING.md`. Before importing partner cases, the team must approve the initial vocabularies and test a reversible migration using synthetic data.

## Constraints

Only public standards, team-created structures, and synthetic examples may be committed. Partner-provided vocabulary lists or internal documentation must stay within the approved OHSU confidentiality boundary unless publication is explicitly allowed [2]. No real patient, learner, faculty, or staff information is needed for this decision. Stable codes must not embed personal information.

The repository does not currently contain a license, and this RFC does not settle ownership or redistribution rights. If OHSU adopts terminology from an external framework, the team must verify that framework’s licensing and attribution requirements before copying its terms.

## Delegation and Validation

I used ChatGPT/Codex to inspect the proposed schema, identify the uncontrolled-tag decision, research primary documentation, compare options, and draft this RFC. The tool did not invent a partner vocabulary, run nonexistent benchmarks, merge schema changes, or decide on behalf of the team.

The existing validation gate is human review: the repository requires one teammate’s approval, and `AGENTS.md` requires review for schema changes [2]. CI, automated tests, staging, and a tested rollback migration do not yet exist. Before submitting this draft, I will personally verify every source, confirm the proposed model against the partner’s actual search fields, and walk through three cases: a synonym, a retired term, and an ambiguous tag migration. I will not recommend acceptance until I can explain why each case behaves correctly without relying on the AI tool.

## Decision

Pending. After team and partner review, record whether the RFC was accepted, rejected, or superseded, along with the date and decision chair.

## References

1. OSU Capstone OHSU Database, “Create schema.sql,” pull request #3, 2026. https://github.com/robekenn/OSU-Capstone-OHSU-Database/pull/3
2. OSU Capstone OHSU Database, “OHSU Simulation Database Agent Guide,” 2026. https://github.com/robekenn/OSU-Capstone-OHSU-Database/blob/main/AGENTS.md
3. PostgreSQL Global Development Group, “Constraints,” PostgreSQL 18 Documentation. https://www.postgresql.org/docs/current/ddl-constraints.html
4. W3C, “SKOS Simple Knowledge Organization System Reference,” 2009. https://www.w3.org/TR/skos-reference/

