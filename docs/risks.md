# Project Risks

Objective: Deliver a shared simulation case database that OHSU faculty can use across campuses and that the team can develop and maintain together.

This is the single risk register for the project. Review it at each sprint planning meeting and update it when conditions change.

Risks are listed in priority order. Likelihood and impact use High, Medium, or Low.

## R-1 — Hosting approval or account access may arrive too late

- Category: Business
- Likelihood: Medium — follow-up is in progress, but the response date and account arrangements are not confirmed.
- Impact: High — the Week 10 deployment depends on an agreed target and access to it.
- Owner: [team member tracking hosting]
- Status: Open — follow-up in progress

The requirements leave AWS approval as an open question. If the hosting decision or account access arrives later than needed, the team may not have enough time to deploy and test the walking skeleton in the agreed environment.

Response — Mitigate:
- Continue the existing follow-up.
- Confirm the deployment target, account owner, required approvals, and expected access date.
- Record the partner-agreed target in `docs/design.md`.
- Set a deployment setup date and use it to track the external dependencies.

Trigger: The deployment setup date is reached without the required approval or access.

Contingency: Agree on a permitted fallback with the partner and instruction team before relying on it.

Priority reason: This risk ranks first because it depends on an external timeline and directly affects the deployment gate.

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

### E-1 — Hosting approval and deployment target

- Needed for: Week 10 deployment.
- Requester: Requirements identify Calvin as asking OHSU IT; confirm the actual requester.
- Recipient: OHSU IT; specific contact not recorded.
- Request date: Not recorded.
- Expected response: Not recorded.
- Status: Follow-up in progress.
- Next action: Record the request details, decision, and expected response date.

### E-2 — Hosting account and deployment access

- Needed for: Deployment setup and operation.
- Requester: Not recorded.
- Recipient: Account owner or access provider; not recorded.
- Request date: Not recorded.
- Start by: [date before deployment setup begins].
- Status: Confirm whether this is included in E-1.
- Next action: Name the account owner and confirm who provides access and when.

### E-3 — OHSU identity integration

- Needed for: FR-1 in a later development stage.
- Requester: Not recorded.
- Recipient: Calvin is the IT contact identified in requirements; confirm the appropriate IT recipient.
- Request date: Not recorded.
- Start by: [date that allows the confirmed lead time before integration].
- Status: Login is deferred from the first prototype. Whether an integration request has been made is not recorded.
- Next action: Confirm the identity provider, application-registration process, and expected lead time.

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