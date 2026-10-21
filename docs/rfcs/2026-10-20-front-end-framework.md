<!-- docs/rfcs/2026-10-20-front-end-framework.md -->

# RFC: Front End Framework with React and Typescript (Vite)

| Field | Value |
| --- | --- |
| Author | Logan Moskal |
| Date | 2026-10-20 |
| Status | Draft |
| Decision Date | (fill when decided) |
| Deciders | (who agreed to the outcome) |
| Superseded By | |

## Problem and Context

The OHSU School of Nursing simulation database needs a browser front end that faculty, simulation operations specialists, simulated patient actors, students, clinical faculty, and partner school staff will use to create, import, search, review, and adapt simulation cases.

A case modeled on our two given simulation templates is structured in many sections: multivalue fields, multiple scenario versions, checkbox lists, medication tables, and progression grids that are facilitator access only.

The decision is needed now because every screen we code on is written in whatever we choose. Switching later means rewriting the whole UI, and next year's team, or OHSU inherits whatever we leave them.

## Options

### Option A: React + TypeScript single page app, built with Vite

A React 19 app in TypeScript that runs in the browser, started from Vite's `react-ts` template, with React Router for page URLs. Express only serves data through the API. One shared TypeScript file defines what the API sends, and both the Express and React code use it.

- **Benefits:** Reusable components suit the case editor (a medication table or scenario version is built once and reused). TypeScript catches API/screen mismatches before the code runs. React is the most widely used frontend library, so help is easy to find and next year's team will likely know it.
- **Costs:** Two things to deploy instead of one. We must pick our own routing, data loading, and form libraries. Teammates must learn JSX, hooks, and TypeScript together. Keyboard focus and back button behavior must be built on purpose.

### Option B: Vue 3 + TypeScript single page app, built with Vite

The same setup with Vue 3 and Vue Router.

- **Benefits:** HTML like templates may be easier than JSX, `v-model` simplifies long forms, and the official router and state library mean fewer choices.
- **Costs:** Far fewer developers use Vue (see Analysis), so fewer ready made components and future maintainers. No one on our team has used Vue.

### Option C: Do Nothing

Express builds each page as HTML with EJS, and interactive parts get small amounts of plain JavaScript.

- **Benefits:** One app to deploy, the least to learn, and navigation and accessibility work by default. Quickest way to get simple pages working.
- **Costs and when they arrive:** The cost arrives when we build the case editor and import review screen. Adding rows, nested scenario versions, validation, and autosave become handwritten page code with no type checking, and many pieces get written twice (server template and JavaScript). Each feature costs more than the last.

## Analysis

**Fit.** The case editor is our core workflow, and its nested, repeating sections are what component frameworks (Options A and B) handle well and handwritten page code (Option C) handles poorly.

**Team and handoff.** In the 2025 Stack Overflow survey, React was used by 44.7% of respondents versus 17.6% for Vue (Stack Overflow, 2025). No one on our team has used Vue, and a couple of teammates have some React experience, so React gives a head start.

**Going against React's advice.** React deprecated Create React App in 2025 and now recommends starting with a framework like Next.js, while still documenting Vite for custom setups (Carroll & Hanlon, 2025). We already have an Express server for sign in and the API, so a framework's server would duplicate it. The cost is that we choose our own routing and data loading libraries.

**Security.** Hiding facilitator only fields in React would still send them to the browser, so the API must remove them for student accounts. HTML imported from Word must be sanitized before it is displayed.

**Accessibility.** Federal ADA Title II rules require WCAG 2.1 AA for public universities' web apps (U.S. Department of Justice, 2024). Option A must explicitly include focus and keyboard.

**Uncertain.** Whether the team can become utilize Reacts full capabilities in time, and whether OHSU IT has front end requirements.

## Recommendation and Verification Plan

**Recommendation: Option A.** It fits the case editor best, catches API mismatches at build time and is easiest to hand off.

We will know it worked when:

1. Each teammate builds the read only case view in React.
2. Both sample cases display with nothing missing, confirmed by our sponsor.
3. Type checking and linting run on every pull request.
4. A test confirms student accounts receive no facilitator only fields.
5. Automated accessibility checks show no serious issues on the case view and search pages.

## Constraints

- **Licensing.** React, Vite, React Router, and Vue are MIT-licensed and TypeScript is Apache-2.0, so they work with a private or open source repo.
- **Data use.** No third party tracking scripts, libraries bundled at build time, and no case content stored in the browser, since sim lab computers may be shared.
- **IP and partner confidentiality.** We will not commit sample OHSU templates or case content to the repo, or paste them into outside tools, without our partner's approval.
- **Accessibility.** WCAG 2.1 AA is the target, we will confirm OHSU's own requirements with our partner.

## Delegation and Validation

- **What you handed to AI tools** I had given general information about project and the repo to Claude to help brainstorm points of emphasis on the analysis and sources to confirm licensing and accessiblity documents. No confidential OHSU information was included.
- **What checks made that reasonable**: Every claim is cited, so a reviewer can check it with the source. Our contributing rules require a teammate other than the author to approve this pull request before it merges. CI is not yet set up, so there are no automated checks on this document.
- **Where you stopped and validated the result yourself, and why those points.** I opened each source and confirmed it supports the claim. I confirmed the team's React and Vue experience with my teammates instead of assuming it, because that fact decides between Options A and B.

## Decision

(Draft. Fill in Accepted, Rejected or Superseded, the date and who chaired the decision.)

## References

Carroll, M., & Hanlon, R. (2025, February 14). *Sunsetting Create React App*. React. https://react.dev/blog/2025/02/14/sunsetting-create-react-app

Stack Overflow. (2025). *2025 Developer Survey: Technology*. https://survey.stackoverflow.co/2025/technology/

U.S. Department of Justice. (2024). *Fact sheet: New rule on the accessibility of web content and mobile apps provided by state and local governments*. https://www.ada.gov/resources/2024-03-08-web-rule/
