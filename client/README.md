# Client

The web client for the OHSU Simulation Database: React 19 + TypeScript, built with Vite, with React Router for page URLs.

## Pages

Routes are defined in `src/App.tsx`. Every page renders inside `src/components/Layout.tsx`, which provides the skip link and the header navigation.

| Route | File | What it does |
|---|---|---|
| `/` | `src/App.tsx` | Redirects to `/cases` |
| `/cases` | `src/pages/CasesPage.tsx` | Lists cases from `GET /api/cases`, with text search and course, campus and outcome filters. The applied filters live in the page URL, so a search can be bookmarked and Back/Forward step through earlier searches. The dropdowns are filled from `GET /api/courses`, `/api/campuses` and `/api/outcomes`. Helpers are in `src/pages/caseFilters.ts`. |
| `/new` | `src/pages/NewCasePage.tsx` | New case form; saves with `POST /api/cases` |
| anything else | `src/pages/NotFoundPage.tsx` | Page not found |

The case template's sections and fields are defined in `src/templates/caseTemplate.ts` and rendered by `src/components/FieldInput.tsx`. All API calls go through `src/api/cases.ts`.

## Styling

Plain CSS, no framework. `src/index.css` holds the design tokens (colors, type, spacing) for the light and dark themes, base element and form-control styles, and the app shell. Each page's layout lives next to it (`src/pages/*.css`). Use the tokens instead of color values; the theme test enforces this.

## Running it

Setup is in the [root README](../README.md#run-the-app). In short, from the repository root:

```bash
npm ci
npm run dev --workspace server   # API on port 3000, needs server/.env
npm run dev --workspace client   # Vite dev server
```

The Vite dev server forwards every `/api` request to `http://localhost:3000` (see `vite.config.ts`), so the API must be running for pages to load data.

## Checks

Run from the repository root to check both workspaces, or add `--workspace client` to check only this one:

```bash
npm run lint        # oxlint
npm run typecheck   # tsc -b
npm test            # tests/*.test.ts(x) with Node's test runner via tsx
npm run build       # type check, then vite build into dist/
```

`tests/cases.test.tsx` (the list) and `tests/case-filters.test.tsx` (search and filters) use mocked HTTP responses with synthetic data and render components on the server. `tests/theme.test.ts` reads the stylesheets and fails if a color is used outside the tokens in `src/index.css`, if the light and dark themes define different tokens, or if a text or border pair drops below WCAG 2.1 AA contrast. None of them need the API or a database. When you add a test file, add it to the `test` script in `package.json`; it lists files explicitly. See [Cases list demo (#37)](../docs/issue-37-demo.md) for a manual end-to-end walkthrough.

Use only synthetic data in tests, demos, and screenshots. See [AGENTS.md](../AGENTS.md#data-safety-and-confidentiality).
