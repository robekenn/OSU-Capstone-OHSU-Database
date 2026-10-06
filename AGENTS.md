# OHSU Simulation Database Agent Guide

## Purpose and scope

This file applies to the entire repository. It guides contributors and AI coding agents working on the OSU capstone project for the OHSU School of Nursing.

The project will provide a centralized system for faculty to develop, find, review, adapt, and maintain simulation-based learning experiences across OHSU campuses. It is not merely file storage. The product must support structured simulation design, quality assurance, curricular alignment, collaboration, version history, and continuous improvement.

This repository is at an early discovery stage. Do not invent requirements or commit the team to a framework, cloud provider, database, authentication service, or deployment model until the team and project partner have documented that decision.

## Project outcomes

Changes should advance one or more of these outcomes:

- Create and maintain simulation cases using a standardized template.
- Convert existing cases into the standardized structure without losing important content.
- Search and filter cases by clinical topic, course, learner level, population, modality, competencies, learning outcomes, campus use, and other approved metadata.
- Support peer review and approval for new or substantially revised cases.
- Prompt owners to review cases periodically, including annual review.
- Preserve case versions and meaningful revision history.
- Map simulations to course outcomes, program outcomes, competencies, and approved educational frameworks or standards.
- Help faculty identify curricular gaps, redundancies, and opportunities for reuse.
- Support cross-campus adaptation and sharing while reducing duplicated work.
- Leave room for future evaluation, reporting, simulation management, and quality-improvement capabilities.

## Sources of truth

Use this order when requirements disagree:

1. Written decisions approved by the OHSU project partner.
2. Accepted architecture decision records in `docs/adr/`.
3. Approved requirements, backlog items, and acceptance criteria.
4. The project description, problem statement, and objectives.
5. The current OHSU simulation design template and needs-assessment form.
6. Existing implementation and tests.

Record significant product, architecture, data, security, or workflow decisions as ADRs in `docs/adr/`. If a needed decision has not been made, document the uncertainty and ask; do not silently choose a long-term direction.

## Current team ownership

Keep these role names unchanged because they are required by the capstone charter:

- Project Manager: Amit Lad and William Zhao
- AI Coordinator: Logan Moskal
- Quality Owner: Kenneth Robertson

The charter states that each concern must ultimately have exactly one named owner and that ownership rotates at least once per term. The current Project Manager entry lists two people, so the team must resolve and document the single accountable owner before the defense. Do not change role ownership in this file without team approval.

## Collaboration and decisions

- GitHub is the source of truth for code and repository documentation.
- Microsoft Teams is used for shared team files.
- The team group text is used for direct communication.
- Decisions are made by majority vote. The current charter uses rock-paper-scissors to break a tied vote.
- Record decisions and their rationale in the repository so an absent teammate can catch up without relying on chat history.
- The charter's final escalation or override rule is not yet complete. Do not invent it. Add the approved rule here and to the team charter once the team decides it.
- Raise conflict early, discuss it directly and respectfully, involve other teammates as mediators when needed, and escalate to the instructional team under the measurable time bounds the team still needs to define.
- Tie accountability to observable work such as commits, pull requests, reviews, issue updates, meeting attendance, and completed acceptance criteria.
- Design meetings so every member can contribute. Record notes and decisions, use turn-taking when needed, and make it easy to request accommodations or surface barriers without blame.

## Before making a change

1. Read this file and any more specific `AGENTS.md` in the area being changed.
2. Read the related issue, acceptance criteria, ADRs, and project-partner notes.
3. Inspect the existing code, tests, schemas, migrations, and documentation before proposing a solution.
4. Identify whether the work touches confidential material, health-related data, authorization, version history, or approval state.
5. Ask for clarification when a choice would create a durable product or architecture commitment.
6. Keep the change as small and reviewable as practical.

## Product and domain model

Treat the following as the initial domain vocabulary, not a final database schema:

- Simulation case
- Case version or revision
- Author, owner, reviewer, and approver
- Campus, discipline, program, and course
- Learner level and population
- Learning environment and simulation modality
- Clinical topic
- Competency, learning outcome, and measurable objective
- Needs assessment and gap analysis using SBAR
- Cost and resource impact
- Patient chart and relevant history
- Orders and medication information
- Simulation operations, patient details, setting, equipment, supplies, and initial software setup
- Participant, patient, embedded-participant, educator, and staff roles
- Prebriefing, scenario progression, cues, expected actions, responses, and debriefing
- Learning assessment and simulation quality evaluation
- Standardized-patient script and supporting materials
- Review status, approval status, review due date, and campus adaptation

Preserve the distinction between broad learning outcomes and specific measurable objectives. Preserve relationships among cases, courses, competencies, outcomes, campuses, reviews, and versions instead of flattening everything into uploaded documents or free-text tags.

## Workflow expectations

The final workflow is still subject to partner approval, but implementations should be capable of supporting these states without destructive overwrites:

1. Draft
2. Submitted for review
3. Changes requested
4. Approved or published
5. Superseded or archived
6. Due for periodic review

New or substantially revised cases should support peer review. Approved content must not be modified in place without an auditable revision. Preserve who changed what and when, and provide a useful revision summary. Archiving should be reversible when feasible and must not erase historical references.

Do not implement automated approvals, annual-review policy details, or notification schedules until the team has confirmed owners, timing, and escalation behavior.

## Data safety and confidentiality

Use the most restrictive rule when classification is uncertain. Ask the AI Coordinator or project partner before moving material to a less restrictive tier.

### Open material

The following may be used in ordinary approved development tools:

- Code written for this public repository.
- Open-source dependencies.
- Stack traces and error messages after all data, secrets, internal hostnames, and internal endpoints are removed.
- Synthetic data created by the team.
- Public information about the OHSU simulation program.
- Team stand-up notes and decision summaries that contain no partner-confidential details.

### Approved or local tools only

The following require tools approved for that material or a local-only workflow:

- Partner-provided code or configuration.
- OHSU internal hostnames, endpoints, or network-layout details.
- Database schemas and data dictionaries supplied by the partner.
- Partner API documentation and internal documents.
- De-identified samples explicitly approved by the partner for development.
- Partner meeting notes and requirements discussions.

Do not place this material in the public repository unless the partner explicitly approves publication.

### Never share with AI tools or commit

- Real records that identify patients, learners, faculty, staff, or standardized patients.
- Protected health information or data resembling a real patient record.
- Production database exports.
- Partner-session video, audio, recordings, or transcripts.
- Passwords, API keys, tokens, connection strings, SSH keys, OHSU or OSU login details, and `.env` files.

Do not use AI note-takers in partner meetings unless the partner explicitly agrees. If a file contains a secret, remove and rotate the secret before using the remaining content. Merely deleting a secret in a later commit does not remove it from Git history.

## Development data

- Use clearly fictional, synthetic data in development, demos, screenshots, fixtures, and automated tests.
- Do not copy names, dates, narratives, identifiers, or unusual combinations of attributes from real records.
- Label synthetic fixtures where confusion is possible.
- Keep sensitive-field examples minimal. Test authorization and privacy behavior without realistic personal records.
- Avoid logging patient-chart fields, free-text case content, credentials, session tokens, or full request bodies.

## Security and authorization

Until the authentication and hosting model is approved, avoid assumptions that would make later integration difficult.

- Enforce authorization on the server for every create, read, update, review, approval, export, and administrative action.
- Do not rely on hidden buttons or client-side checks for access control.
- Apply least privilege and default-deny behavior.
- Separate ordinary editing, peer review, approval, and system-administration capabilities.
- Validate and normalize untrusted input on the server.
- Use parameterized database access. Never build queries by concatenating user input.
- Protect uploaded content by validating type and size, generating safe storage names, and preventing executable uploads.
- Treat exports, search results, audit history, and attachments as authorization-sensitive.
- Keep secrets in approved secret-management or environment facilities and provide only a sanitized example configuration.
- Review dependencies and avoid adding a package when the platform or existing dependency already solves the problem safely.
- Report suspected exposure immediately; do not attempt to conceal or quietly rewrite it.

## Data integrity and migrations

- Use stable identifiers; do not use mutable display names as keys.
- Use controlled vocabularies or reference tables for important filters when the partner needs consistent reporting.
- Preserve referential integrity among cases, versions, authors, reviews, campuses, courses, competencies, and outcomes.
- Store timestamps consistently and document the time-zone convention.
- Make schema migrations reviewable, deterministic, and reversible where practical.
- Never edit an already-applied shared migration. Add a new migration.
- Backfills must be idempotent or safely restartable and must not fabricate missing domain facts.
- Do not hard-delete approved cases, audit records, or version history unless a documented retention policy requires it.

## Search and accessibility

- Search and filters must use normalized metadata and return understandable active-filter state.
- Define whether archived, superseded, draft, or campus-specific versions appear in results.
- Avoid ranking behavior that hides exact identifier, title, course, competency, or outcome matches.
- Design for keyboard navigation, visible focus, semantic labels, adequate contrast, understandable validation, and assistive-technology support.
- Do not communicate review or approval state through color alone.
- Make long simulation templates resumable and preserve entered work safely.

## Implementation standards

The stack and commands are not selected yet. Once selected, add exact setup, lint, test, migration, seed, build, and run commands here.

For all code:

- Prefer clear, boring, maintainable solutions over premature abstraction.
- Keep domain rules out of presentation-only components.
- Use explicit types and validation at trust boundaries.
- Handle empty, loading, error, unauthorized, and stale-version states.
- Add comments for rationale or non-obvious constraints, not line-by-line narration.
- Keep generated files out of version control unless the build or deployment process requires them.
- Update documentation and examples when behavior or configuration changes.
- Do not add telemetry, analytics, external integrations, or remote AI services without approval and a data-flow review.

## Testing and quality gate

Every behavior change should include tests at the lowest reliable level. Important workflows also need integration or end-to-end coverage.

At minimum, test applicable cases for:

- Required fields, controlled vocabularies, and invalid input.
- Search and combined filters.
- Role and record-level authorization.
- Draft, review, approval, archive, and annual-review transitions.
- Concurrent edits and stale versions.
- Version creation, history, and restoration behavior.
- Campus adaptation without corruption of the source case.
- Curricular mappings and gap or redundancy calculations.
- File upload and export boundaries.
- Keyboard and accessible-name behavior for critical flows.

Before requesting review, run the documented formatter, linter, type checks, tests, migrations, and build. If a command does not exist yet, say so in the pull request rather than claiming validation occurred. The Quality Owner has final responsibility for maintaining this section and the project quality gate.

## Git and review practices

- Work from a focused issue or clearly stated task.
- Use short-lived branches and small, coherent commits unless the team adopts another documented model.
- Do not force-push shared branches or rewrite teammates' work without coordination.
- Pull requests should explain the problem, the chosen approach, user-visible impact, data or migration impact, privacy and security considerations, and verification performed.
- Include screenshots for meaningful UI changes, using synthetic data only.
- Require review for security, authorization, schema, migration, approval-workflow, and confidential-data changes.
- Resolve review comments with code, evidence, or a documented decision; do not dismiss concerns silently.

## Documentation maintenance

Update this file as decisions become known. The next important additions are:

- Approved technology stack and repository structure.
- Local setup and exact quality-check commands.
- Authentication, roles, and permission matrix.
- Hosting, environments, and deployment process.
- Final peer-review and approval workflow.
- Annual-review ownership, timing, reminders, and escalation.
- Data-retention, backup, recovery, and deletion rules.
- Supported attachment formats and storage policy.
- Final team escalation rule, inclusion norms, measurable accountability triggers, and single Project Manager owner.

Keep unknowns visible. A short, accurate TODO is better than a confident but unsupported rule.
