<!-- docs/rfcs/2026-10-20-front-end-framework.md -->

# RFC: Front End Framework with React and TypeScript (Vite)

| Field | Value |
| --- | --- |
| Author | Logan Moskal |
| Date | 2026-10-20 (draft); 2026-11-17 (revised) |
| Status | Accepted |
| Decision Date | 2026-10-13 |
| Deciders | All members |
| Superseded By | |

## Problem and Context

The OHSU School of Nursing runs medical simulations; those cases are kept in Word and PDF files spread across courses and faculty. Our capstone project is a shared database where faculty and simulation staff create cases, import existing ones into a standard template, and search, review, and adapt them. The back end is already chosen: a Node.js and Express REST API over PostgreSQL. This RFC covers the browser front end that sits on top of that API.

The front end has to handle the complicated cases. We were given two template cases, CR_1 and CR_2, both structured differently. CR_1 is a format with one patient and three versions of a scenario, whereas CR_2 is three separate scenarios, each with its own objective. Both have fields that hold more than one value, checkboxes, tables, skills, images, and grids. The case editor is the project's core workflow.

Every screen is written in the framework we pick. Switching later means rewriting the whole UI, and next year's team, or OHSU, inherits whatever we leave them.

With no decision, the default is the path of least effort: Express pages, where each teammate adds JavaScript to their pages (Option C). That works for very simple pages but will get complicated when creating the case editor, which is the most important feature.

## Options

### Option A: React + TypeScript single-page app, built with Vite

A React 19 app in TypeScript that runs in the browser, started from Vite's `react-ts` template, with React Router for page URLs. Express serves only data, through the REST API. One shared TypeScript file defines the shape of a case, and both the Express and React code import it.

- **Benefits:** Reusable components fit the editor: a medication table or scenario version is built once and used everywhere it appears. TypeScript catches mismatches between the API and the screens before the code runs, and React is the most widely used front-end library.
- **Costs:** Two things to deploy instead of one. We must pick our own routing, data-loading, and form libraries. Teammates must learn JSX, hooks, and TypeScript together. Keyboard focus and back-button behavior must be built on purpose.
- **Right choice when** the back end already exists and the core screen is a large interactive form.

### Option B: Vue 3 + TypeScript single-page app, built with Vite

The same setup with Vue 3 and Vue Router.

- **Benefits:** HTML-like templates may be easier than JSX; `v-model` binds form inputs to data in both directions (Vue, n.d.), which cuts code in long forms. Vue's official router and state library mean fewer choices to make.
- **Costs:** Far fewer developers use Vue (see Analysis), so there are fewer ready-made components and future maintainers. No one on our team has used Vue.
- **Right choice when** the team already knows Vue, or form code becomes the main source of bugs.

### Option C: Do Nothing — Express Pages

Express builds each page as HTML with EJS, and interactive parts get small amounts of plain JavaScript.

- **Benefits:** One app to deploy, the least to learn, and navigation and accessibility work by default. It is the quickest way to get simple pages working.
- **Costs and when they arrive:** The cost arrives when we build the case editor and import review screen. Adding rows, nested scenario versions, validation, and autosave become handwritten page code with no type checking, and many pieces get written twice (server template and JavaScript). Each feature costs more than the last.
- **Right choice when** the app is mostly read-only pages and simple forms. Ours is not, because the editor is the core workflow.

### Option D: React + TypeScript with Next.js

React's recommendation for new apps is to start with a framework like Next.js, which includes routing, data loading, code splitting, and server rendering.

- **Benefits:** It follows React's recommended plan. Routing, data loading, and code splitting come prebuilt. Server rendering can make the first page load sooner as well.
- **Costs:** Next.js uses its own Node.js server, and we already have an Express server that handles the API. We would have to run two servers or move the API and sign-in to Next.js. Some features need a running Next.js server and are not supported in static exports (Vercel, 2026).
- **Right choice when** a project starts without a back end.

## Analysis

**Fit.** The case editor is our core workflow, and its nested, repeating sections are what component frameworks (Options A, B, and D) handle well and handwritten page code (Option C) handles poorly. Medication tables and scenario versions are rows users add, remove, and reorder. React Hook Form's `useFieldArray` can support append, insert, remove, move, and replace operations on the rows inside the tables (React Hook Form, n.d.). Vue's `v-model` can help simple fields but not nested sections, so the editor rules out Option C but does not choose among Options A, B, and D.

**Team and complexity.** In the 2025 Stack Overflow survey, the percentage of respondents that used React was 44.7%, 20.8% used Next.js, and 17.6% used Vue (Stack Overflow, 2025). No one on our team has used Vue, and a couple of teammates have some React experience, so Options A and D give a head start over B. However, A is less complex and easier to learn than D, which adds servers into the mix.

**Going against React's advice.** React deprecated Create React App in 2025 and now recommends starting with a framework like Next.js, while still documenting Vite for custom setups (Carroll & Hanlon, 2025). React's page on building from scratch warns that this route "is often the same as building your own adhoc framework," as routing, data fetching, and code splitting are left to our team (React, n.d.-a, "Consider Using a Framework" section). We accept this challenge because our server already exists, and the repo will document which library we chose and why, so handoff is easier for next year.

**Maintainability.** The TypeScript case type is the main gain for maintainability. When the schema for cases changes, every screen using a removed or renamed field fails the type check instead of failing in production. Type-checking tests run on every pull request, so it is consistently being protected. This is very important for handoff come next year.

**Performance.** Because every page is behind the login, search indexing doesn't really matter, and server rendering gives us little benefit. The single-page risk is a large first open. React guides developers to split code by route so each page loads only necessities, and to avoid fetching data inside nests, which can slow down chains of requests (React, n.d.-a). The editor is the heaviest page, so it will load as its own bundle.

**Cost.** Each option uses free, open-source software. The only difference is the source of hosting. `vite build` produces a folder of static files that any host can serve (Vite, n.d.). This means that Express can serve it, so Option A's "two things to deploy" can be one deployment for hosting. Option D needs a running Next.js server for its features (Vercel, 2026), which is a second process to run and monitor.

**Security.** React by default escapes every value it renders, which OWASP names as a defense against cross-site scripting. OWASP names React's `dangerouslySetInnerHTML` without sanitizing as a gap (OWASP, n.d.). That gap is important. Our pipeline uses mammoth to turn Word files into HTML, and its documentation says it does not sanitize, and that documents can contain `javascript:` links (Williamson, n.d.). React's documentation says to use `dangerouslySetInnerHTML` only with sanitized data (React, n.d.-b). Imported HTML is sanitized with DOMPurify before it's stored and is rendered through a shared component, never left ad hoc.

**Accessibility.** Federal ADA Title II rules require WCAG 2.1 AA for public universities' web apps (U.S. Department of Justice, 2024). Option A must explicitly include focus and keyboard. In April 2026, the Department of Justice moved the compliance date for large public entities to April 26, 2027, without changing the standard (U.S. Department of Justice, 2026). This is important because this is before handoff; our project needs to explicitly follow these guidelines. A single-page app has to manage focus and page titles on route changes itself, and every editor control needs to work from the keyboard.

**Uncertain.** Whether the team can utilize React's full capabilities in time, and whether OHSU IT has front-end requirements.

## Recommendation and Verification Plan

**Recommendation: Option A.** It fits the case editor best, catches API mismatches at build time, deploys static files from the existing Express server, and is easiest to hand off. Option D is the best alternate but loses because we already have an Express server.

We will know it worked when:

| # | Check | How it detects failure | Status |
|---|---|---|---|
| 1 | Type checking and linting test on every pull request. | A change that breaks the branch cannot merge. | Passing |
| 2 | Each teammate builds a read-only case view in React against the Express API. | A teammate who cannot finish this check shows too high of a learning cost. | Pending |
| 3 | CR_1 and CR_2 templates display in the case page with nothing missing. | Anything missing means a component or type is wrong. | Pending |
| 4 | An editor section, the medication table, is built with React Hook Form. Component tests cover adding, removing, and ordering rows, and required fields. | A failing test, or a section a library cannot build, shows a wrong approach. | Pending |
| 5 | A test enters CR_1 and CR_2 medication tables through the editor, saves, reloads, and compares fields with what was inputted. | Any loss or change fails the test, catching loss invisible to read-only views. | Pending |
| 6 | A test imports a Word file (.docx) with a `javascript:` link and an image with an `onerror` script, then renders it. | Any active link or script that runs fails. | Pending |
| 7 | Automated axe checks (Deque Systems, n.d.) report no critical issues in the case view, search, or table editor. A teammate completes the editor section with a keyboard. | The keyboard pass covers what the check cannot. | Pending |

**Revisit** if checks 4 and 5 don't pass by the end of the term. The team will reopen the RFC before continuing to build; changing course is much easier earlier rather than later.

## Constraints

- **Licensing.** React, Vite, React Router, Next.js, and Vue are MIT-licensed, and TypeScript is Apache-2.0, so they work with a private or open-source repo.
- **Data use.** No third-party tracking scripts; libraries are bundled at build time. No case content is kept in browser storage, because sim lab computers may be shared. Editor autosave must save drafts to the server, not to the browser.
- **IP and partner confidentiality.** We will not commit sample OHSU templates or case content to the repo, or paste them into outside tools, without our partner's approval. The tests in checks 4–6 are to use made-up cases that copy CR_1's and CR_2's structure, not their content. Our mentor performs check 3 and uses the real cases in an environment the partner approves.
- **Accessibility.** WCAG 2.1 AA is the target; we will confirm OHSU's own requirements with our partner. Editor components must work fully from the keyboard, and check 7 adds a manual keyboard pass.

## Delegation and Validation

- **What you handed to AI tools:** I had given general information about the project, the repo, the peer reviews, and the original draft to Claude Opus 5.5 to help brainstorm analysis points and to find licensing and accessibility sources. For this revision, I gave it my draft and peer reviews to compare it against. No confidential OHSU information was included.
- **What checks made that reasonable:** Every claim is cited, so a reviewer can check it with the source. Our contributing rules require a teammate other than the author to approve this pull request before it merges. Type checking and linting now run on every pull request; they check the code this RFC governs, not this document.
- **Where you stopped and validated the result yourself, and why those points:** I opened each source and confirmed it supports the claim. I confirmed the team's React and Vue experience with my teammates, because that fact decides between Options A and B. I checked each verification check against our repo myself, because a false "Passing" would hide the failures.

## Decision

Accepted on 2026-10-13 by the capstone team. The team adopted Option A, recorded in our tech-stack decisions.

## References

Carroll, M., & Hanlon, R. (2025, February 14). *Sunsetting Create React App*. React. https://react.dev/blog/2025/02/14/sunsetting-create-react-app

Deque Systems. (n.d.). *axe-core* [Computer software]. GitHub. Retrieved November 17, 2026, from https://github.com/dequelabs/axe-core

OWASP. (n.d.). *Cross site scripting prevention cheat sheet*. OWASP Cheat Sheet Series. Retrieved November 17, 2026, from https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html

React. (n.d.-a). *Build a React app from scratch*. Retrieved November 17, 2026, from https://react.dev/learn/build-a-react-app-from-scratch

React. (n.d.-b). *Common components (e.g. \<div\>)*. Retrieved November 17, 2026, from https://react.dev/reference/react-dom/components/common

React Hook Form. (n.d.). *useFieldArray*. Retrieved November 17, 2026, from https://react-hook-form.com/docs/usefieldarray

Stack Overflow. (2025). *2025 Developer Survey: Technology*. https://survey.stackoverflow.co/2025/technology/

U.S. Department of Justice. (2024). *Fact sheet: New rule on the accessibility of web content and mobile apps provided by state and local governments*. https://www.ada.gov/resources/2024-03-08-web-rule/

U.S. Department of Justice. (2026). Extension of compliance dates for nondiscrimination on the basis of disability; accessibility of web information and services of state and local government entities. *Federal Register, 91*, 20902. https://www.federalregister.gov/documents/2026/04/20/2026-07663/extension-of-compliance-dates-for-nondiscrimination-on-the-basis-of-disability-accessibility-of-web

Vercel. (2026). *How to self-host your Next.js application*. Next.js. Retrieved November 17, 2026, from https://nextjs.org/docs/app/guides/self-hosting

Vite. (n.d.). *Deploying a static site*. Retrieved November 17, 2026, from https://vite.dev/guide/static-deploy

Vue. (n.d.). *Form input bindings*. Retrieved November 17, 2026, from https://vuejs.org/guide/essentials/forms.html

Williamson, M. (n.d.). *mammoth.js* [Computer software]. GitHub. Retrieved November 17, 2026, from https://github.com/mwilliamson/mammoth.js