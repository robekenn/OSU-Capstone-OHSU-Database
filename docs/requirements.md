# Requirements

## Problem Statement
Faculty at the OHSU School of Nursing run simulation cases across multiple campuses. Each case is a long document. There is no central place to store them, so faculty cannot easily find a case by course, campus, or learning outcome, tell which copy is current, or reuse a case at another campus. 

## Functional Requirements
FR-1: Users sign in through OHSU's OIDC provider. Acceptance: A request without a valid token gets 401 on every route except the health check. 
FR-2: An author creates a case with a title and template content, saved as a draft. Acceptance: A missing title returns 400 and writes nothing; success writes one case row and one version row in a single transaction. 
FR-3: Every edit creates a new version; old versions are never changed. Acceptance: After one edit, the case has exactly one more version, and the old version's content is unchanged.
FR-4: A user sees a list of cases with title, status, campus, and last-updated date. Acceptance: A newly saved case appears in the list, and an empty list shows a message. 
FR-5: An author maps a case version to learning outcomes. Acceptance: Mapping a nonexistent outcome fails, and mapping the same outcomes twice does not create a duplicate.
FR-6: A user filters cases by course, campus, and outcome. Acceptance: each filter alone returns only matching cases.
FR-7: An author submits a draft, and a reviewer approves it or requests changes with a comment. Acceptance: only drafts can be submitted; a review records reviewers, decision, comment, and time. 
FR-8: An author imports a Word document into a new draft. Acceptance: both OHSU sample templates import, and anything that cannot be placed is listed, not dropped.
FR-9: A user exports a case to PDF or Word. Acceptance: the export contains every template section in the original order.

## Non-functional Requirements
NFR-1: The case list and search return in under 10 seconds with 100 cases. 
NFR-2: schema.sql runs without errors on an empty PostgreSQL database. 
NFR-3: Saving a case takes under 10 seconds. It will be measured on the templates.

## Constraints
C-1: PostgreSQL, Node.js + Express (TypeScript), React + TypeScript. 
C-2: Sign-in through OHSU OIDC.
C-3: No real patient data. 

## Success Metrics
- Faculty have entered at least 50 cases by the end of term 3.
- Faculty from at least 2 campuses have signed in.
- Finding a known case by course and outcome takes 30 seconds in a test with 3 faculty.

## Non-goals
- Co-editing one case simultaneously.
- Mobile App.
- AI-generated cases or AI-assisted entry.
- Migrating every case in history.

## Open Questions
OQ-1: Does OHSU IT approve AWS hosting, and which OIDC identity provider do we use? Owner: Calvin, asks IT. 
OQ-2: What are the exact roles and permissions? 
How many cases, faculty, and campuses should it handle? Owner: Calvin, before NFR-1 is measured.
Are the success-metric targets and non-goals correct? Owner: The team asks Calvin. 



