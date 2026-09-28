# Triage Platform — Plan

## Overview

A web-based triage and prioritisation platform that ingests bug reports and security
findings from external tools (Jira, GitHub Issues, ClickUp, Asana, Trello, Zoho, and
any other tool via a generic webhook) and gives developers and
managers a single workspace to understand, score, and action them.

The core problem it solves: findings arrive without enough context, severity is judged
inconsistently, and there is no reliable mechanism to decide whether a fix belongs in
the current sprint or the next one.

**Key design principle:** Risk = Severity × Asset Criticality. A critical bug on a
low-value asset is not urgent. The platform enforces this model throughout.

**Branch:** `dev` (branched from `main`)  
**V1 target:** Demo/MVP — functional enough to present to stakeholders.

---

## Architecture

```
External Tools (Jira / GitHub / etc.)
        │
        ▼ webhook or manual import
┌─────────────────────────────────────────┐
│            Integration Layer            │  Node/Express API
│  /api/integrations/:provider/webhook    │
└───────────────┬─────────────────────────┘
                │ normalised Finding record
                ▼
┌─────────────────────────────────────────┐
│              AI Analysis Layer          │  LLM calls (OpenAI / compatible)
│  - auto-score severity                  │
│  - duplicate detection                  │
│  - fix suggestion                       │
└───────────────┬─────────────────────────┘
                │ enriched Finding record
                ▼
┌─────────────────────────────────────────┐
│              PostgreSQL Database        │
│  findings, assets, sprints, users       │
└───────────────┬─────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│           Next.js Frontend              │
│  - Finding detail view                  │
│  - Triage board (risk-ranked list)      │
│  - Sprint planner (recommend + override)│
└─────────────────────────────────────────┘
```

---

## Risk Scoring Model

**Risk Score = Severity Score × Asset Criticality Score**

| Field | Values | Score |
|---|---|---|
| Severity | Critical | 4 |
| | High | 3 |
| | Medium | 2 |
| | Low | 1 |
| Asset Criticality | High | 3 |
| | Medium | 2 |
| | Low | 1 |

**Risk Score range: 1–12**

| Risk Score | Label | Sprint Recommendation |
|---|---|---|
| 9–12 | P1 — Critical Risk | Current sprint |
| 5–8 | P2 — High Risk | Current sprint (if capacity) |
| 3–4 | P3 — Medium Risk | Next sprint |
| 1–2 | P4 — Low Risk | Backlog |

This recommendation is surfaced to the manager as a suggestion. They can override and
assign to any sprint. Override reason is logged.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router, React) |
| Backend API | Node.js with Express |
| Database | PostgreSQL with Prisma ORM |
| AI Layer | OpenAI API (GPT-4o) — severity scoring, duplicate detection, fix suggestion |
| Auth | NextAuth.js (simple credential auth for demo) |
| Styling | Tailwind CSS |
| Version control | Git — `dev` branch from `main` |

---

## Sub-Tasks

---

### Sub-Task 1 — Project Scaffold & Database Schema

**Status:** `[ ] pending`

**Intent:**  
Bootstrap the monorepo structure, configure the toolchain, and define the full
database schema. Everything else builds on this foundation. Getting the schema right
upfront avoids painful migrations later.

**Expected Outcomes:**
- Next.js app and Express API exist in a single repo under `/apps/web` and `/apps/api`
- Prisma schema defines all core models: `Finding`, `Sprint`, `User`, `Integration`, `AuditLog`
- Database can be created and migrated with a single command
- `.env.example` documents all required environment variables
- `dev` branch exists and is checked out

**Todo List:**
1. Initialise git repo, create `main` branch with a root README, then create `dev` branch
2. Scaffold monorepo with a root `package.json` and two workspaces: `apps/web` and `apps/api`
3. Create Next.js app in `apps/web` with Tailwind CSS and TypeScript
4. Create Express API in `apps/api` with TypeScript and ts-node-dev
5. Install and configure Prisma in `apps/api`, point it at PostgreSQL
6. Define Prisma schema with the following models:
   - `User` — id, name, email, role (DEV | MANAGER), createdAt
   - `Finding` — id, title, description, reproSteps, evidence (text), severity (CRITICAL|HIGH|MEDIUM|LOW), assetCriticality (HIGH|MEDIUM|LOW), riskScore (computed int), cvssScore (optional float), affectedComponent, affectedVersion, status (OPEN|ACKNOWLEDGED|IN_SPRINT|FIXED|CLOSED|DUPLICATE), suggestedFix (AI-generated text), duplicateOfId (self-relation), sourceProvider (JIRA|GITHUB|MANUAL), sourceId (external ref), createdAt, updatedAt
   - `Sprint` — id, name, startDate, endDate, status (ACTIVE|UPCOMING|COMPLETED)
   - `SprintFinding` — join table: sprintId, findingId, addedBy (userId), overrideReason (nullable), recommendedBySystem (bool)
   - `AuditLog` — id, findingId, userId, action, previousValue, newValue, createdAt
   - `Integration` — id, provider (JIRA|GITHUB), config (JSON), webhookSecret, createdAt
7. Run initial Prisma migration to create the schema
8. Add `db:migrate` and `db:studio` scripts to root package.json
9. Create `.env.example` with: DATABASE_URL, OPENAI_API_KEY, NEXTAUTH_SECRET, NEXTAUTH_URL, API_URL

**Relevant Context:**
- Risk score is a stored computed field: `riskScore = severityScore(severity) × assetCriticalityScore(assetCriticality)`
- Score mapping is defined in the Risk Scoring Model section above
- `duplicateOfId` is a self-referential foreign key on `Finding` — Prisma handles this with `@relation`
- `evidence` is stored as text (URLs or base64) for demo; file upload is out of scope for v1

---

### Sub-Task 2 — Core API: Findings CRUD + Risk Scoring

**Status:** `[ ] pending`

**Intent:**  
Build the Express API endpoints that power finding creation, retrieval, update, and
deletion. Risk score must be computed and stored server-side — never trusted from the
client — so it is enforced here.

**Expected Outcomes:**
- `POST /api/findings` creates a finding, computes and stores risk score, returns the full record
- `GET /api/findings` returns all findings, sorted by risk score descending, with pagination
- `GET /api/findings/:id` returns a single finding with full detail
- `PATCH /api/findings/:id` updates allowed fields, recomputes risk score if severity or assetCriticality changes, appends to AuditLog
- `DELETE /api/findings/:id` soft-deletes (sets status to CLOSED)
- All endpoints validate input with Zod schemas
- Risk score computation lives in a single shared utility function

**Todo List:**
1. Create `src/utils/riskScore.ts` — pure function `computeRiskScore(severity, assetCriticality): number` using the scoring table from the plan
2. Create Zod validation schemas for Finding create and update payloads
3. Implement `POST /api/findings` — validate, compute risk score, create record, return 201
4. Implement `GET /api/findings` — sort by riskScore DESC, support `?page` and `?limit` query params, support `?status` filter
5. Implement `GET /api/findings/:id` — return finding with related sprint assignments
6. Implement `PATCH /api/findings/:id` — validate partial payload, recompute risk score if relevant fields change, write AuditLog entry
7. Implement `DELETE /api/findings/:id` — set status to CLOSED, write AuditLog entry
8. Add error handling middleware for Zod validation errors (return 400) and unexpected errors (return 500)
9. Write unit tests for `computeRiskScore` covering all severity × assetCriticality combinations

**Relevant Context:**
- Risk score is always computed server-side in `computeRiskScore` — never accepted as a client input
- AuditLog entries must capture `previousValue` and `newValue` as JSON strings for any changed field
- Soft delete pattern: status = CLOSED, record is retained in DB

---

### Sub-Task 3 — AI Analysis Layer

**Status:** `[ ] pending`

**Intent:**  
Integrate the OpenAI API to enrich findings automatically after they are created or
imported. Three AI functions: severity scoring from description text, duplicate
detection against existing findings, and fix suggestion. AI output is advisory —
it is stored alongside the human-entered data and surfaced clearly as AI-generated.

**Expected Outcomes:**
- After a finding is created, an async AI enrichment job runs in the background
- `suggestedFix` field on the finding is populated with AI-generated remediation advice
- AI-suggested severity is stored as `aiSuggestedSeverity` (separate from human-entered `severity`)
- If a likely duplicate is detected, `duplicateOfId` is set and status changes to `DUPLICATE`
- A `POST /api/findings/:id/analyse` endpoint allows manual re-triggering of AI analysis
- AI results are clearly labelled in the API response so the frontend can distinguish them

**Todo List:**
1. Install and configure the OpenAI Node SDK in `apps/api`
2. Create `src/services/aiAnalysis.ts` with three functions:
   - `suggestSeverity(title, description): Promise<Severity>` — prompt asks the model to return one of CRITICAL|HIGH|MEDIUM|LOW with a short reason
   - `suggestFix(title, description, affectedComponent): Promise<string>` — prompt asks for a concise remediation approach
   - `detectDuplicate(finding, existingFindings): Promise<string | null>` — returns the ID of the likely duplicate finding, or null
3. Add `aiSuggestedSeverity` and `aiSuggestedSeverityReason` fields to the `Finding` Prisma model, create migration
4. Wire `runAiEnrichment(findingId)` as a background call (fire-and-forget with error logging) inside `POST /api/findings`
5. Implement `POST /api/findings/:id/analyse` for manual re-trigger
6. For duplicate detection: fetch the 50 most recent OPEN findings (excluding self) and pass titles + descriptions to the model; keep prompt concise to stay within token limits
7. Add `OPENAI_API_KEY` guard — if key is not set, skip AI enrichment silently and log a warning (allows demo without a key)
8. Write unit tests for each AI service function using mocked OpenAI responses

**Relevant Context:**
- AI enrichment is fire-and-forget — the `POST /api/findings` response must not block on AI
- `aiSuggestedSeverity` is distinct from `severity` — the human value is always authoritative
- Duplicate detection fetches from DB inside the service; keep the candidate set small (50) to control token usage
- All three prompts should include explicit instructions to respond in structured JSON to make parsing reliable

---

### Sub-Task 4 — Integration Layer: Multi-Provider Webhooks + Generic Fallback

**Status:** `[ ] pending`

**Intent:**
Allow findings to flow in automatically from any external tool via webhooks. Named
normalisers handle the top providers (Jira, GitHub, ClickUp, Asana, Trello, Zoho).
A generic fallback endpoint accepts any tool that can POST a standard JSON schema —
this future-proofs the platform without requiring a new normaliser for every tool
that ever exists. All paths funnel into the same finding creation service.

**Expected Outcomes:**
- Named webhook endpoints exist for: Jira, GitHub Issues, ClickUp, Asana, Trello, Zoho Projects
- A generic fallback endpoint `POST /api/integrations/generic/webhook` accepts any tool using a documented JSON schema
- Each named provider has its own normaliser file under `src/integrations/`
- Webhook signature verification (HMAC-SHA256) is applied to all named providers; generic endpoint uses a shared secret header
- Normalised findings default `assetCriticality` to MEDIUM and `severity` to MEDIUM when the source lacks that data — flagged for human review with `needsReview: true`
- Duplicate source IDs are detected and skipped (idempotent webhook handling)
- `GET /api/integrations` lists all configured integrations
- `POST /api/integrations` registers a new integration (provider, webhookSecret, optional config)
- A `GET /api/integrations/generic/schema` endpoint returns the documented JSON schema any tool must follow to use the generic endpoint

**Todo List:**
1. Create `src/integrations/types.ts` — define the `NormalisedFinding` interface and the `GenericWebhookPayload` schema (the standard JSON any tool must POST to the generic endpoint)
2. Create named normaliser files — each maps provider-specific fields to `NormalisedFinding`:
   - `src/integrations/jira.normaliser.ts` — summary→title, description, priority→severity (Highest→CRITICAL, High→HIGH, Medium→MEDIUM, Low/Lowest→LOW), labels→affectedComponent
   - `src/integrations/github.normaliser.ts` — title, body→description, labels→severity (critical→CRITICAL, security→HIGH, bug→MEDIUM, else MEDIUM)
   - `src/integrations/clickup.normaliser.ts` — name→title, description, priority (urgent→CRITICAL, high→HIGH, normal→MEDIUM, low→LOW), tags→affectedComponent
   - `src/integrations/asana.normaliser.ts` — name→title, notes→description, custom_fields for severity if present, else MEDIUM
   - `src/integrations/trello.normaliser.ts` — name→title, desc→description, labels→severity (red→CRITICAL, orange→HIGH, yellow→MEDIUM, else LOW)
   - `src/integrations/zoho.normaliser.ts` — title, description, severity field if present (Zoho BugTracker), else MEDIUM
3. Create `src/integrations/generic.normaliser.ts` — validates and maps the standard `GenericWebhookPayload` directly to `NormalisedFinding`; returns a 400 with field-level errors if required fields are missing
4. Create `src/middleware/webhookSignature.ts` — HMAC-SHA256 signature verification middleware, reads secret from the `Integration` record in DB; generic endpoint uses `X-Triage-Secret` header comparison
5. Create a single `src/integrations/router.ts` that registers all provider webhook routes dynamically — each route resolves its normaliser by provider name, keeping the controller code DRY
6. Implement `POST /api/integrations/:provider/webhook` — verify signature, resolve normaliser by provider, normalise payload, check `sourceProvider + sourceId` uniqueness to skip duplicates, call the finding creation service
7. Implement `POST /api/integrations/generic/webhook` — validate against `GenericWebhookPayload` schema, skip if duplicate, call the finding creation service
8. Implement `GET /api/integrations/generic/schema` — returns the `GenericWebhookPayload` JSON schema as documentation
9. Implement `GET /api/integrations` and `POST /api/integrations`
10. Update the `Integration` Prisma model `provider` enum to include: JIRA, GITHUB, CLICKUP, ASANA, TRELLO, ZOHO, GENERIC
11. Write unit tests for every normaliser with a realistic sample payload for that provider
12. Write an integration test for the generic endpoint: valid payload creates a finding, missing required fields return 400

**Relevant Context:**
- All normalisers must implement the same function signature: `normalise(payload: unknown): NormalisedFinding`
- The `GenericWebhookPayload` required fields are: `title`, `description`, `severity` (CRITICAL|HIGH|MEDIUM|LOW), `assetCriticality` (HIGH|MEDIUM|LOW), `affectedComponent`, `sourceId` (caller's own unique ID for idempotency)
- Optional fields on `GenericWebhookPayload`: `reproSteps`, `evidence`, `affectedVersion`, `cvssScore`
- `sourceProvider + sourceId` unique constraint in DB enforces idempotency for all providers
- The finding creation service from Sub-Task 2 is reused — normalisers only transform, they never write to DB
- Zoho normaliser targets Zoho BugTracker/Projects webhook format specifically

---

### Sub-Task 5 — Sprint Planner API

**Status:** `[ ] pending`

**Intent:**  
Expose the sprint management endpoints that power the sprint planner UI. The system
recommends which sprint a finding belongs in based on its risk score, and managers
can accept or override. Every override is logged with a reason.

**Expected Outcomes:**
- `GET /api/sprints` returns all sprints with their finding counts and risk summary
- `POST /api/sprints` creates a new sprint
- `GET /api/sprints/:id/findings` returns findings assigned to a sprint, sorted by risk score
- `POST /api/sprints/:id/findings` assigns a finding to a sprint (accepts override reason if the manager disagrees with the system recommendation)
- `DELETE /api/sprints/:id/findings/:findingId` removes a finding from a sprint
- `GET /api/findings/unassigned` returns findings not yet in any sprint, with the system sprint recommendation included in each record

**Todo List:**
1. Create `src/utils/sprintRecommendation.ts` — pure function `recommendSprint(riskScore): SprintLabel` returning P1/P2/P3/P4 label and a human-readable reason string
2. Implement `GET /api/sprints` — include aggregate: count of findings per risk level in each sprint
3. Implement `POST /api/sprints` — validate name, startDate, endDate
4. Implement `GET /api/sprints/:id/findings` — join SprintFinding with Finding, sort by riskScore DESC
5. Implement `POST /api/sprints/:id/findings` — create SprintFinding record, set `recommendedBySystem` flag, log override to AuditLog if `overrideReason` is present
6. Implement `DELETE /api/sprints/:id/findings/:findingId` — remove from sprint, log to AuditLog
7. Implement `GET /api/findings/unassigned` — findings with no SprintFinding record, append `sprintRecommendation` to each result
8. Write unit tests for `recommendSprint` covering P1 through P4 score boundaries

**Relevant Context:**
- Sprint recommendation thresholds are defined in the Risk Scoring Model section of this plan
- `recommendedBySystem: true` + `overrideReason: null` = manager accepted the recommendation
- `recommendedBySystem: true` + `overrideReason: "..."` = manager overrode — this is what gets audited
- The `sprintRecommendation` field on unassigned findings is computed at query time, not stored

---

### Sub-Task 6 — Frontend: Triage Board

**Status:** `[ ] pending`

**Intent:**  
Build the main developer-facing view: a risk-ranked list of all open findings. This is
the primary surface where a dev or manager understands what is in the queue, scans
severity and asset criticality, and drills into individual findings.

**Expected Outcomes:**
- Triage board page at `/` shows all open findings sorted by risk score descending
- Each row shows: title, severity badge, asset criticality badge, risk score, risk label (P1–P4), affected component, status, and source provider icon
- Clicking a row opens the Finding Detail page
- Filter bar allows filtering by status, severity, asset criticality, and risk label
- Risk score is visually prominent — colour-coded (P1 red, P2 orange, P3 yellow, P4 grey)
- Empty state shown when no findings match the filter

**Todo List:**
1. Set up Next.js App Router structure: `app/(dashboard)/page.tsx` as the triage board
2. Create reusable UI components: `<SeverityBadge>`, `<RiskScoreBadge>`, `<ProviderIcon>`, `<StatusChip>`
3. Build `<FindingRow>` component with all required fields, linking to `/findings/[id]`
4. Build `<FilterBar>` component with dropdowns for status, severity, assetCriticality, riskLabel
5. Build the triage board page: fetch findings from the API, render filtered list, handle loading and empty states
6. Apply Tailwind colour coding: P1=red-600, P2=orange-500, P3=yellow-400, P4=gray-400
7. Add pagination controls (previous/next) wired to the API `?page` param

**Relevant Context:**
- Data fetched from `GET /api/findings` (Sub-Task 2) — use `?status=OPEN` as default filter
- Components should be in `apps/web/src/components/`
- Keep state management simple — React useState + useEffect for demo; no Redux/Zustand needed
- AI-suggested severity, if different from human severity, should be shown as a small indicator on the row

---

### Sub-Task 7 — Frontend: Finding Detail View

**Status:** `[ ] pending`

**Intent:**  
The full-detail page for a single finding. This is where a developer goes to fully
understand an issue: read the repro steps, review evidence, see the AI-suggested fix,
understand the risk score breakdown, and see its sprint assignment.

**Expected Outcomes:**
- Finding detail page at `/findings/[id]` renders all finding fields
- Risk score breakdown is shown as a formula: `Severity (n) × Asset Criticality (n) = Risk Score (n) — P1`
- AI-suggested fix is displayed in a clearly labelled "AI Suggestion" panel
- If AI suggested a different severity than human-entered, both are shown with a note
- If finding is marked DUPLICATE, a link to the original finding is shown
- Repro steps are rendered as a numbered list
- Evidence field rendered as a preformatted block (URLs or text)
- Edit button allows updating severity, assetCriticality, status, and reproSteps inline
- Audit log trail shown at the bottom of the page

**Todo List:**
1. Create `app/(dashboard)/findings/[id]/page.tsx` — fetch finding by ID from API
2. Build `<RiskBreakdown>` component: displays `Severity Score × Asset Criticality Score = Risk Score (Label)` visually
3. Build `<AISuggestionPanel>` component: shows suggestedFix, aiSuggestedSeverity with a clear "AI Generated" label
4. Build `<ReproSteps>` component: renders reproSteps as a numbered ordered list
5. Build `<AuditTrail>` component: renders AuditLog entries for this finding in chronological order
6. Build inline edit form for severity, assetCriticality, status, reproSteps — calls `PATCH /api/findings/:id` on save
7. Handle DUPLICATE status: show a banner with a link to `duplicateOfId` finding
8. Handle loading, error, and not-found states

**Relevant Context:**
- All data from `GET /api/findings/:id` (Sub-Task 2)
- Inline edit triggers a `PATCH` and refreshes the finding data on success
- AuditLog is returned in the finding detail response from Sub-Task 2 (include in the Prisma query)
- AI panel must be visually distinct — use a blue-tinted background or "sparkle" icon to signal AI content

---

### Sub-Task 8 — Frontend: Sprint Planner

**Status:** `[ ] pending`

**Intent:**  
The manager-facing sprint planning view. Shows unassigned findings with their system
recommendation, and allows the manager to assign findings to sprints with an optional
override reason. Sprint contents are viewable with risk summaries.

**Expected Outcomes:**
- Sprint planner page at `/sprints` shows active and upcoming sprints as columns
- An "Unassigned" column shows findings not yet in a sprint, each with a system recommendation badge (e.g. "→ Current Sprint")
- Manager can assign a finding to a sprint; if overriding the recommendation, a modal prompts for a reason
- Sprint columns show a risk summary: count of P1/P2/P3/P4 findings
- Manager can create a new sprint via a form
- Removing a finding from a sprint moves it back to Unassigned

**Todo List:**
1. Create `app/(dashboard)/sprints/page.tsx` — fetch sprints and unassigned findings
2. Build `<SprintColumn>` component: shows sprint name, date range, risk summary counts, and a list of assigned findings
3. Build `<UnassignedPanel>` component: shows unassigned findings sorted by risk score, each with a `<RecommendationBadge>` showing the system sprint suggestion
4. Build `<AssignToSprintModal>` — dropdown to select target sprint, optional override reason textarea, confirm button
5. Build `<CreateSprintForm>` — name, startDate, endDate inputs, POST to `/api/sprints`
6. Wire assign action: POST to `/api/sprints/:id/findings`, pass overrideReason if provided, refresh both panels on success
7. Wire remove action: DELETE `/api/sprints/:id/findings/:findingId`, refresh on success
8. Show a visual indicator on findings where manager overrode the system recommendation

**Relevant Context:**
- Data from Sub-Tasks 5 endpoints: `GET /api/findings/unassigned`, `GET /api/sprints`, `GET /api/sprints/:id/findings`
- Override reason modal should only appear when the target sprint does not match the system recommendation
- Keep the layout simple for demo: side-by-side panels, not a full drag-and-drop kanban (that is v2)

---

### Sub-Task 9 — Auth + Navigation Shell

**Status:** `[ ] pending`

**Intent:**  
Wire up minimal authentication (credential-based for demo) and the navigation shell
that wraps all pages. Roles: DEV sees the triage board and finding detail. MANAGER
sees everything including the sprint planner.

**Expected Outcomes:**
- Login page at `/login` with email + password (demo credentials seeded in DB)
- NextAuth.js session protects all dashboard routes
- Navigation sidebar shows: Triage Board, Sprint Planner (MANAGER only), Integrations (MANAGER only)
- Current user name and role shown in the sidebar footer
- Role-based access: DEV users cannot access `/sprints` or `/integrations` — redirected to triage board

**Todo List:**
1. Install and configure NextAuth.js with credentials provider in `apps/web`
2. Create the login page at `app/login/page.tsx`
3. Create a middleware file `middleware.ts` at the Next.js root — protect all `/` routes, redirect unauthenticated to `/login`
4. Build `<Sidebar>` navigation component with role-conditional menu items
5. Create a root layout `app/(dashboard)/layout.tsx` that wraps all dashboard pages with the Sidebar
6. Add a DB seed script `prisma/seed.ts` that creates two demo users: one DEV and one MANAGER
7. Restrict `/sprints` and `/integrations` routes — redirect DEV role to `/`

**Relevant Context:**
- NextAuth session should expose `user.role` — configure the session callback in `[...nextauth].ts`
- Seeded demo credentials: `dev@demo.com / demo1234` (DEV role), `manager@demo.com / demo1234` (MANAGER role)
- This is the last sub-task because it wraps all previously built pages — do not build auth first

---

## Out of Scope for V1

- File/image upload for evidence (use text/URL in v1)
- Real-time updates (WebSockets / live push)
- Full drag-and-drop kanban sprint board (side-by-side panels only)
- Email or Slack notifications
- Provider integrations beyond the 6 named + generic fallback (e.g. Linear, GitLab, Azure DevOps)
- User management UI (users are seeded only)
- Two-factor authentication
- Custom CVSS calculator UI
- OAuth-based provider authentication (webhooks with shared secrets only in v1)
