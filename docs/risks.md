# Project Risks

Objective: Deliver a shared simulation case database that OHSU faculty can use across campuses and that the team can develop and maintain together.

This is the single risk register for the project. Review it at each sprint planning meeting and update it when conditions change.

Risks are listed in priority order. Likelihood and impact use High, Medium, or Low.

## R-1 — OHSU may not accept the leading hosting and sign-in setup

- Category: Business
- Likelihood: Low — a Vercel + Supabase deployment already runs with synthetic data, so the team is not blocked waiting for an environment.
- Impact: High — if OHSU requires different hosting or OHSU single sign-on (OIDC) late in the project, deployment, sign-in, and storage work may need to be redone.
- Owner: Kenneth Robertson
- Status: Open

The leading option is Vercel for the client and API, with Supabase for the database, Auth, and file storage (requirements OQ-1). It is not final. If OHSU IT rejects it, or requires its own hosting or SSO after the team has built on it, the team may not have enough time to move and retest before the final deployment.

Response — Mitigate:
- Confirm with the partner and OHSU IT whether Vercel + Supabase is acceptable and whether SSO is required.
- Keep hosting-specific settings in environment variables and documented setup steps, not in application code.
- Record the outcome in `docs/requirements.md` (OQ-1) and `docs/design.md`.
- Set a date by which the hosting and sign-in decision must be made.

Trigger: OHSU rejects Vercel + Supabase or requires SSO, or the decision date passes without an answer.

Contingency: Agree on a permitted fallback with the partner and instruction team before relying on it. Keep the local-only setup working so the team can demonstrate the app regardless of hosting.

Priority reason: This risk ranks first because it depends on an external decision and could force rework across deployment, sign-in, and storage.

## R-2 — Different implementation assumptions may cause integration rework

- Category: Technical / Team
- Likelihood: Medium — implementation is starting, and shared interfaces have not yet been confirmed.
- Impact: High — integration problems could delay several features and make maintenance depend on one developer.
- Owner: William Zhao
- Status: Open

The first prototype will provide a starting point for further development. If later tasks use different assumptions about API requests, responses, or stored data, their code may be difficult to combine. If application knowledge remains with one developer, other members may have difficulty extending or maintaining it.

Response — Mitigate:
- Use the first prototype to agree on the boundaries and interfaces needed for the next tasks.
- Record these agreements in `docs/design.md`.
- Have another teammate run and change the application.
- Create follow-up issues with clear owners and dependencies.
- Review shared interface changes with affected contributors.

Trigger: Two features cannot work together because their contracts differ, or another teammate cannot run and make a small change using the available instructions.

Contingency: Pause the affected work, resolve the shared contract, and pair on one working end-to-end flow before continuing dependent features.

Priority reason: This risk ranks second because it affects parallel development, but the team can test and reduce it through the first prototype.

## External Prerequisites

“Not recorded” means this register needs confirmation. It does not mean no one has acted.

### E-1 — Hosting and sign-in decision

- Needed for: Final deployment.
- Requester: Kenneth Robertson (owner of requirements OQ-1).
- Recipient: OHSU IT and the project partner; specific contact not recorded.
- Request date: Not recorded.
- Expected response: Not recorded.
- Status: Open. Vercel + Supabase is the leading option; whether OHSU requires other hosting or SSO is unknown.
- Next action: Ask whether Vercel + Supabase is acceptable and whether SSO is required, then record the answer and date.

### E-2 — Hosting account ownership and access

- Needed for: Deployment setup, operation, and handoff.
- Requester: Not recorded.
- Recipient: Owners of the Vercel project and the Supabase project; not recorded.
- Request date: Not recorded.
- Start by: Before the final deployment and handoff.
- Status: A Vercel deployment and Supabase Auth are in use. Who owns each account, and which teammates have dashboard access, is not recorded.
- Next action: Name the account owners, record who has access, and confirm how the accounts transfer to OHSU at handoff.

### E-3 — OHSU identity integration

- Needed for: Production sign-in, only if OHSU requires SSO (OQ-1).
- Requester: Not recorded.
- Recipient: Calvin is the IT contact identified in requirements; confirm the appropriate IT recipient.
- Request date: Not recorded.
- Start by: [date that allows the confirmed lead time before integration].
- Status: Sign-in with Supabase Auth and team-provisioned instructor accounts is implemented (FR-1). Whether OHSU SSO is required is open.
- Next action: Resolve as part of E-1. If SSO is required, confirm the identity provider, application-registration process, and expected lead time.

### E-4 — Permitted use of partner templates

- Needed for: FR-8 import development and testing.
- Requester: Not recorded.
- Recipient: Partner contact responsible for document-use permission.
- Request date: Not recorded.
- Start by: Before using partner documents in development or external tools.
- Status: Templates have been provided; the permitted use needs to be recorded.
- Next action: Check existing permission and record any storage, testing, publication, or tool-use restrictions. Request additional permission only if needed.

### E-5 — Faculty participation in validation

- Needed for: Validation of the proposed search success metric.
- Coordinator: Not recorded.
- Recipient: Partner contact who can arrange faculty participation.
- Request date: Not recorded.
- Start by: [date that allows recruitment before the planned test].
- Status: Requirements propose a search test with three faculty; the target and arrangements need confirmation.
- Next action: Confirm the target with the partner, assign a coordinator, and record the planned session date.

## Review and Closure

At each sprint planning meeting:
- Check risk triggers and external requests.
- Update rankings, owners, dates, and next actions.
- Link a board issue when a trigger occurs.
- Record completed external prerequisites with dates and evidence.
- Move resolved risks to a Closed section with the resolution date.

Keep implementation tasks on the board. Use this register for uncertainties that could affect the project objective.
