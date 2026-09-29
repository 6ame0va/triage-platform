# Triage Platform — Project Handover Document

**Version:** 1.0  
**Status:** Sub-Task 1 Complete — Sub-Task 2 in progress  
**Repository:** https://github.com/6ame0va/triage-platform  
**Active Branch:** `dev` (branched from `main`)  
**Document Purpose:** Full handover for any developer, QA engineer, or stakeholder
picking up this project. Covers product background, requirements, process flows,
acceptance criteria, technical decisions, and current build state.

---

## Table of Contents

1. [Product Background](#1-product-background)
2. [Problem Statement](#2-problem-statement)
3. [Stakeholders & Roles](#3-stakeholders--roles)
4. [Functional Requirements](#4-functional-requirements)
5. [Non-Functional Requirements](#5-non-functional-requirements)
6. [Process Flows — BPMN](#6-process-flows--bpmn)
7. [Risk Scoring Model](#7-risk-scoring-model)
8. [Acceptance Criteria](#8-acceptance-criteria)
9. [System Architecture](#9-system-architecture)
10. [Data Model](#10-data-model)
11. [API Contract Summary](#11-api-contract-summary)
12. [Integration Specifications](#12-integration-specifications)
13. [Tech Stack Decisions](#13-tech-stack-decisions)
14. [Build State & Progress](#14-build-state--progress)
15. [Environment Setup](#15-environment-setup)
16. [Out of Scope — V1](#16-out-of-scope--v1)
17. [Glossary](#17-glossary)

---

## 1. Product Background

**Product Name:** Triage Platform  
**Product Owner:** (internal stakeholder — name TBC)  
**Requirement Engineer / Developer / Tester:** AI-assisted engineering session

The Triage Platform was commissioned to solve a recurring operational problem: when
QA engineers or penetration testers find bugs or security vulnerabilities, the path
from discovery to a developer understanding, prioritising, and scheduling a fix is
slow, inconsistent, and often broken.

The product is a web-based workspace where developers and managers receive, understand,
score, and action findings from any external bug-tracking or project management tool.

---

## 2. Problem Statement

### Bottlenecks Identified in Current Triage Pipeline

The following bottlenecks were identified through requirement engineering sessions with
the product owner:

| # | Bottleneck | Impact |
|---|---|---|
| B1 | **Reproduction gap** — Dev cannot reproduce the bug; environments differ, repro steps are missing | Finding stalls, dev rejects as "works on my machine" |
| B2 | **Context loss** — Reports arrive without logs, request/response payloads, affected version, or environment fingerprint | Dev cannot assess impact without significant back-and-forth |
| B3 | **Prioritisation ambiguity** — "Critical" means different things to QA, pentesters, devs, and managers. No shared scoring model | Wrong things get fixed first; real risks get deferred |
| B4 | **Asset criticality ignored** — A critical bug on a low-value asset is treated the same as a critical bug on a payment service | Sprint capacity is wasted on low-impact work |
| B5 | **Validity disputes** — Dev rejects finding as "by design" with no audit trail; reporter has no recourse | Legitimate issues get silently closed |
| B6 | **Assignment fog** — No clear owner. Finding bounces between teams | Delay and duplicate effort |
| B7 | **Status blindness** — Reporter does not know if their finding was read, acknowledged, or closed | No feedback loop; reporter loses confidence |
| B8 | **Duplicate noise** — The same bug is filed multiple times from different sources | Dev triages the same issue repeatedly |
| B9 | **Security vs functional split** — Pentest findings (CVEs, CVSS) need different handling but most trackers treat them identically | Security findings get lost in the functional backlog |

### Solution Approach

A unified triage workspace where:
- Findings flow in from any tool via webhooks (Jira, GitHub, ClickUp, Asana, Trello,
  Zoho, or any tool via a generic schema)
- Every finding is automatically enriched by AI (severity suggestion, duplicate
  detection, fix recommendation)
- A deterministic **Risk Score = Severity × Asset Criticality** model replaces
  subjective severity judgements
- A sprint planner surfaces system recommendations and lets managers approve or
  override with a logged reason
- Every change is captured in an immutable audit log

---

## 3. Stakeholders & Roles

| Role | Responsibilities in the Platform |
|---|---|
| **DEV (Developer)** | Views triage board, reads finding details, updates status and repro steps, views audit trail |
| **MANAGER** | All DEV permissions + manages sprints, assigns findings, overrides recommendations, views integrations |
| **QA Engineer** | External — files findings via integrated tools (Jira, ClickUp, etc.) or the generic webhook |
| **Pentester** | External — same as QA; findings include CVSS scores and security-specific context |
| **Product Owner** | Defines priorities, reviews sprint plans, not a platform user in v1 |

---

## 4. Functional Requirements

### FR-01 — Finding Ingestion

| ID | Requirement |
|---|---|
| FR-01.1 | The system SHALL accept findings from Jira, GitHub Issues, ClickUp, Asana, Trello, and Zoho via HMAC-SHA256 signed webhooks |
| FR-01.2 | The system SHALL expose a generic webhook endpoint accepting a documented JSON schema for any other tool |
| FR-01.3 | The system SHALL allow manual finding creation via the API (source = MANUAL) |
| FR-01.4 | The system SHALL skip duplicate findings using sourceProvider + sourceId uniqueness |
| FR-01.5 | The system SHALL flag findings as NEEDS_REVIEW when the source lacks severity or asset criticality data |

### FR-02 — Risk Scoring

| ID | Requirement |
|---|---|
| FR-02.1 | The system SHALL compute a Risk Score as Severity Score × Asset Criticality Score |
| FR-02.2 | Risk Score SHALL be computed server-side and never accepted from the client |
| FR-02.3 | The system SHALL assign a priority label (P1–P4) based on the Risk Score |
| FR-02.4 | When severity or asset criticality is updated, the system SHALL recompute and store the new Risk Score |
| FR-02.5 | The system SHALL display the risk score formula breakdown to the user |

### FR-03 — AI Enrichment

| ID | Requirement |
|---|---|
| FR-03.1 | The system SHALL automatically suggest a severity level from the finding title and description |
| FR-03.2 | The system SHALL automatically suggest a remediation approach (fix suggestion) |
| FR-03.3 | The system SHALL detect likely duplicate findings and flag them with a link to the original |
| FR-03.4 | AI enrichment SHALL run asynchronously — finding creation response SHALL NOT block on AI |
| FR-03.5 | AI-suggested severity SHALL be stored separately from human-entered severity; the human value is always authoritative |
| FR-03.6 | The system SHALL allow manual re-triggering of AI analysis via an endpoint |
| FR-03.7 | If OPENAI_API_KEY is not configured, AI enrichment SHALL be silently skipped with a logged warning |

### FR-04 — Triage Board

| ID | Requirement |
|---|---|
| FR-04.1 | The system SHALL display all open findings sorted by Risk Score descending |
| FR-04.2 | Each finding row SHALL show: title, severity, asset criticality, risk score, risk label, affected component, status, and source provider |
| FR-04.3 | The system SHALL allow filtering by status, severity, asset criticality, and risk label |
| FR-04.4 | Risk labels SHALL be colour-coded: P1=red, P2=orange, P3=yellow, P4=grey |
| FR-04.5 | The system SHALL paginate findings (page + limit) |

### FR-05 — Finding Detail

| ID | Requirement |
|---|---|
| FR-05.1 | The system SHALL display all finding fields on a detail page |
| FR-05.2 | The system SHALL display the AI-suggested fix in a clearly labelled panel |
| FR-05.3 | The system SHALL display repro steps as a numbered list |
| FR-05.4 | The system SHALL display the full audit log trail for a finding |
| FR-05.5 | Developers SHALL be able to update severity, asset criticality, status, and repro steps inline |
| FR-05.6 | DUPLICATE findings SHALL display a banner with a link to the original finding |

### FR-06 — Sprint Planner

| ID | Requirement |
|---|---|
| FR-06.1 | The system SHALL recommend which sprint a finding belongs in based on its Risk Score |
| FR-06.2 | Managers SHALL be able to accept or override the system recommendation |
| FR-06.3 | Override decisions SHALL require a reason, which is stored in the audit log |
| FR-06.4 | The system SHALL display sprint columns with P1/P2/P3/P4 risk summaries |
| FR-06.5 | Managers SHALL be able to create new sprints with a name, start date, and end date |
| FR-06.6 | Findings removed from a sprint SHALL return to the Unassigned pool |

### FR-07 — Access Control

| ID | Requirement |
|---|---|
| FR-07.1 | The system SHALL require authentication for all dashboard routes |
| FR-07.2 | DEV users SHALL NOT be able to access sprint planner or integrations pages |
| FR-07.3 | The system SHALL display the current user's name and role in the navigation |

### FR-08 — Audit Trail

| ID | Requirement |
|---|---|
| FR-08.1 | The system SHALL log every field change with the previous value, new value, user, and timestamp |
| FR-08.2 | Audit logs SHALL be immutable — no delete or update operations |
| FR-08.3 | Sprint assignment, removal, and overrides SHALL all be logged |

---

## 5. Non-Functional Requirements

| ID | Requirement |
|---|---|
| NFR-01 | API responses SHALL return within 500ms for all non-AI endpoints under normal load |
| NFR-02 | The system SHALL be deployable from a single `npm install` + `.env` configuration |
| NFR-03 | All webhook endpoints SHALL reject payloads with invalid HMAC signatures with HTTP 401 |
| NFR-04 | All API inputs SHALL be validated with Zod schemas; invalid inputs return HTTP 400 with field-level errors |
| NFR-05 | The frontend SHALL be responsive and usable on screens 1280px and wider |
| NFR-06 | Passwords SHALL be hashed with bcrypt (min cost factor 10) |
| NFR-07 | The system SHALL handle missing OPENAI_API_KEY gracefully — no crash, logged warning only |
| NFR-08 | All finding deletions are soft-deletes — records are never physically removed |

---

## 6. Process Flows — BPMN

The following diagrams use BPMN notation described in structured text.
Each pool represents a participant; lanes represent roles within a pool.

---

### BPMN-01 — Finding Ingestion Flow

**Participants:** External Tool, Integration Layer, AI Service, Database, Dev/Manager

```
START
  │
  ▼
[External Tool] ── webhook POST ──► [Integration Layer]
                                          │
                                    ┌─────▼─────┐
                                    │ Verify     │
                                    │ HMAC sig   │
                                    └─────┬─────┘
                                          │
                              ┌───────────┴──────────┐
                         INVALID                    VALID
                              │                      │
                              ▼                      ▼
                        [Return 401]         [Normalise payload]
                                                    │
                                       ┌────────────▼────────────┐
                                       │ Check sourceProvider +  │
                                       │ sourceId uniqueness     │
                                       └────────────┬────────────┘
                                                    │
                                       ┌────────────┴────────────┐
                                   DUPLICATE               NOT DUPLICATE
                                       │                         │
                                       ▼                         ▼
                                 [Return 200,           [Compute Risk Score]
                                  skip silently]               │
                                                               ▼
                                                    [Write Finding to DB]
                                                               │
                                                               ▼
                                                    [Return 201 to caller]
                                                               │
                                                 (fire and forget, async)
                                                               │
                                                               ▼
                                                    [AI Enrichment Service]
                                                    ├── suggestSeverity()
                                                    ├── suggestFix()
                                                    └── detectDuplicate()
                                                               │
                                                               ▼
                                                    [Update Finding in DB
                                                     with AI fields]
END
```

**Decision Points:**
- `HMAC valid?` → YES: proceed / NO: return 401
- `Duplicate sourceId?` → YES: skip / NO: persist
- `AI key configured?` → YES: enrich / NO: skip silently

---

### BPMN-02 — Developer Triage Flow

**Participants:** Developer, Triage Platform, Database

```
START
  │
  ▼
[DEV logs in]
  │
  ▼
[Views Triage Board — findings sorted by Risk Score DESC]
  │
  ▼
[Selects a finding]
  │
  ▼
[Views Finding Detail]
  ├── Reads title, description, repro steps
  ├── Reads evidence
  ├── Reviews AI-suggested fix
  ├── Sees Risk Score breakdown (Severity × Asset Criticality)
  └── Checks audit trail
  │
  ▼
┌──────────────────────────────┐
│ Does dev agree with severity │
│ and asset criticality?       │
└──────────────────────────────┘
       │               │
      YES              NO
       │               │
       ▼               ▼
[Acknowledges     [Edits severity /
 finding —         asset criticality]
 status →               │
 ACKNOWLEDGED]          ▼
                  [System recomputes
                   Risk Score]
                        │
                        ▼
                  [AuditLog entry written]
  │
  ▼
[Dev updates status as work progresses]
  OPEN → ACKNOWLEDGED → IN_SPRINT → FIXED → CLOSED
END
```

---

### BPMN-03 — Sprint Planning Flow

**Participants:** Manager, Triage Platform, Database

```
START
  │
  ▼
[MANAGER logs in]
  │
  ▼
[Views Sprint Planner page]
  │
  ├── Sees Unassigned findings panel (sorted by Risk Score)
  │   Each finding shows system recommendation:
  │   P1/P2 → "Recommend: Current Sprint"
  │   P3    → "Recommend: Next Sprint"
  │   P4    → "Recommend: Backlog"
  │
  └── Sees Sprint columns (ACTIVE / UPCOMING)
  │
  ▼
[Manager selects a finding to assign]
  │
  ▼
[Manager picks target sprint]
  │
  ▼
┌─────────────────────────────────────┐
│ Does target match system            │
│ recommendation?                     │
└─────────────────────────────────────┘
        │                  │
       YES                  NO
        │                  │
        ▼                  ▼
[Assign to sprint]   [Override modal shown]
[recommendedBy        Manager enters reason
 System = true,             │
 overrideReason = null]     ▼
                     [Assign to sprint]
                     [recommendedBy
                      System = true,
                      overrideReason = reason]
                            │
  ┌─────────────────────────┘
  ▼
[SprintFinding record created in DB]
[AuditLog entry written:
 action = "SPRINT_ASSIGNED"
 overrideReason if applicable]
[Finding status → IN_SPRINT]
END
```

---

### BPMN-04 — Duplicate Detection Flow

**Participants:** AI Service, Database

```
START (triggered after Finding creation)
  │
  ▼
[Fetch 50 most recent OPEN findings (excluding self)]
  │
  ▼
[Send titles + descriptions to OpenAI]
  │
  ▼
┌──────────────────────────────┐
│ Did AI return a duplicate ID?│
└──────────────────────────────┘
        │              │
       YES              NO
        │              │
        ▼              ▼
[Set duplicateOfId   [No action]
 on Finding]
[Set status →
 DUPLICATE]
[Write AuditLog:
 action = "MARKED_DUPLICATE"]
END
```

---

### BPMN-05 — Webhook Registration Flow

**Participants:** Manager, Triage Platform

```
START
  │
  ▼
[MANAGER navigates to Integrations page]
  │
  ▼
[Selects provider: Jira / GitHub / ClickUp /
 Asana / Trello / Zoho / Generic]
  │
  ▼
[Enters webhook secret]
  │
  ▼
[POST /api/integrations]
  │
  ▼
[Integration record saved in DB]
  │
  ▼
[Platform displays:
 webhook URL to configure in external tool
 + the secret to use for HMAC signing]
END
```

---

## 7. Risk Scoring Model

### Scoring Table

| Severity | Score | Asset Criticality | Score | Risk Score | Label | Sprint Recommendation |
|---|---|---|---|---|---|---|
| CRITICAL | 4 | HIGH | 3 | 12 | P1 | Current Sprint |
| CRITICAL | 4 | MEDIUM | 2 | 8 | P2 | Current Sprint (if capacity) |
| CRITICAL | 4 | LOW | 1 | 4 | P3 | Next Sprint |
| HIGH | 3 | HIGH | 3 | 9 | P1 | Current Sprint |
| HIGH | 3 | MEDIUM | 2 | 6 | P2 | Current Sprint (if capacity) |
| HIGH | 3 | LOW | 1 | 3 | P3 | Next Sprint |
| MEDIUM | 2 | HIGH | 3 | 6 | P2 | Current Sprint (if capacity) |
| MEDIUM | 2 | MEDIUM | 2 | 4 | P3 | Next Sprint |
| MEDIUM | 2 | LOW | 1 | 2 | P4 | Backlog |
| LOW | 1 | HIGH | 3 | 3 | P3 | Next Sprint |
| LOW | 1 | MEDIUM | 2 | 2 | P4 | Backlog |
| LOW | 1 | LOW | 1 | 1 | P4 | Backlog |

### Key Design Principle

> A CRITICAL bug on a LOW-criticality asset scores 4 — P3 (Next Sprint).
> A HIGH bug on a HIGH-criticality asset scores 9 — P1 (Current Sprint).
>
> Severity alone does not determine urgency. Asset value must be factored in.

---

## 8. Acceptance Criteria

Acceptance criteria are written in Given / When / Then (GWT) format.
All criteria must pass before a sub-task is considered done.

---

### AC-01 — Finding Ingestion

**AC-01.1 — Webhook creates finding**
- **Given** a valid Jira webhook payload with HMAC-SHA256 signature
- **When** POST is made to `/api/integrations/jira/webhook`
- **Then** a Finding is created in the database with correct mapped fields and HTTP 201 is returned

**AC-01.2 — Invalid signature is rejected**
- **Given** a webhook payload with an invalid or missing HMAC signature
- **When** POST is made to any `/api/integrations/:provider/webhook` endpoint
- **Then** HTTP 401 is returned and no Finding is created

**AC-01.3 — Duplicate source finding is skipped**
- **Given** a Finding already exists with sourceProvider=JIRA and sourceId="PROJ-123"
- **When** a webhook POST arrives with the same sourceId
- **Then** HTTP 200 is returned and no duplicate Finding is created

**AC-01.4 — Generic webhook with valid payload creates finding**
- **Given** a POST to `/api/integrations/generic/webhook` with all required fields and a valid `X-Triage-Secret` header
- **When** the request is processed
- **Then** a Finding is created and HTTP 201 is returned

**AC-01.5 — Generic webhook with missing required fields returns 400**
- **Given** a POST to `/api/integrations/generic/webhook` missing the `severity` field
- **When** the request is processed
- **Then** HTTP 400 is returned with a field-level error message referencing `severity`

**AC-01.6 — Findings lacking severity are flagged for review**
- **Given** a Trello webhook payload with no severity-mapped label
- **When** the finding is created
- **Then** the Finding has `severity=MEDIUM`, `assetCriticality=MEDIUM`, and `needsReview=true`

---

### AC-02 — Risk Scoring

**AC-02.1 — Risk score is computed on creation**
- **Given** a POST to `/api/findings` with `severity=CRITICAL` and `assetCriticality=HIGH`
- **When** the finding is created
- **Then** the returned record has `riskScore=12` and the client-submitted `riskScore` field (if any) is ignored

**AC-02.2 — Risk score recomputes on update**
- **Given** a Finding with `severity=HIGH` and `assetCriticality=LOW` (riskScore=3)
- **When** a PATCH updates `assetCriticality=HIGH`
- **Then** the Finding's `riskScore` updates to 9 and an AuditLog entry is written

**AC-02.3 — All 12 scoring combinations are correct**
- **Given** the scoring table in Section 7
- **When** unit tests run against `computeRiskScore(severity, assetCriticality)`
- **Then** all 12 severity × criticality combinations return the correct score

---

### AC-03 — AI Enrichment

**AC-03.1 — AI enrichment is non-blocking**
- **Given** OPENAI_API_KEY is configured
- **When** a finding is created via POST /api/findings
- **Then** the HTTP 201 response is returned before AI enrichment completes

**AC-03.2 — suggestedFix is populated after enrichment**
- **Given** a finding has been created and AI enrichment has completed
- **When** GET /api/findings/:id is called
- **Then** the `suggestedFix` field contains a non-empty string

**AC-03.3 — AI severity is stored separately from human severity**
- **Given** AI suggests CRITICAL but human entered HIGH
- **When** GET /api/findings/:id is called
- **Then** `severity=HIGH` and `aiSuggestedSeverity=CRITICAL` are both present; `severity` is the authoritative value

**AC-03.4 — Duplicate detected by AI is flagged correctly**
- **Given** a near-identical finding already exists in the database
- **When** a new finding is created and AI enrichment runs
- **Then** `duplicateOfId` is set to the existing finding's ID and `status=DUPLICATE`

**AC-03.5 — Missing API key does not crash the system**
- **Given** OPENAI_API_KEY is not set in the environment
- **When** a finding is created
- **Then** the finding is saved normally, AI fields remain null, and a warning is logged

---

### AC-04 — Triage Board

**AC-04.1 — Board displays findings sorted by risk score**
- **Given** multiple findings with different risk scores exist
- **When** the triage board is loaded
- **Then** findings appear in descending Risk Score order (highest first)

**AC-04.2 — Filter by severity narrows results**
- **Given** findings with CRITICAL and LOW severity exist
- **When** the filter is set to CRITICAL
- **Then** only CRITICAL findings are displayed

**AC-04.3 — P1 findings are displayed in red**
- **Given** a finding with riskScore=12 (P1) exists
- **When** it appears on the triage board
- **Then** its risk label badge is styled in red (Tailwind red-600)

**AC-04.4 — Empty state renders when no findings match filter**
- **Given** no findings match the current filter
- **When** the triage board renders
- **Then** an empty state message is shown and no finding rows are rendered

---

### AC-05 — Finding Detail

**AC-05.1 — Risk breakdown formula is shown**
- **Given** a finding with severity=HIGH (3) and assetCriticality=MEDIUM (2)
- **When** the finding detail page is viewed
- **Then** the UI displays "3 × 2 = 6 — P2"

**AC-05.2 — AI suggestion panel is clearly labelled**
- **Given** a finding has an AI-generated fix suggestion
- **When** the detail page is viewed
- **Then** the suggestion is shown in a visually distinct panel with an "AI Generated" label

**AC-05.3 — Inline edit updates the finding**
- **Given** a developer is viewing a finding detail page
- **When** they change the status to ACKNOWLEDGED and save
- **Then** the PATCH is sent, the page refreshes with the new status, and an AuditLog entry is created

**AC-05.4 — Duplicate banner links to original**
- **Given** a finding with status=DUPLICATE and a valid duplicateOfId
- **When** the detail page is viewed
- **Then** a banner is shown containing a link to the original finding's detail page

---

### AC-06 — Sprint Planner

**AC-06.1 — System recommendation is shown on unassigned findings**
- **Given** an unassigned finding with riskScore=10 (P1)
- **When** the Sprint Planner page loads
- **Then** the finding shows a recommendation badge "→ Current Sprint"

**AC-06.2 — Assignment without override requires no reason**
- **Given** a finding recommended for Current Sprint
- **When** manager assigns it to the Current Sprint
- **Then** a SprintFinding record is created with `overrideReason=null`

**AC-06.3 — Override requires and stores a reason**
- **Given** a finding recommended for Next Sprint (P3)
- **When** manager assigns it to the Current Sprint
- **Then** the override modal appears, a reason must be entered, and `overrideReason` is stored

**AC-06.4 — Override reason appears in audit log**
- **Given** a manager overrode the recommendation with reason "Urgent client request"
- **When** the finding detail audit trail is viewed
- **Then** an audit entry shows action=SPRINT_ASSIGNED with the override reason

**AC-06.5 — Removed finding returns to Unassigned**
- **Given** a finding is assigned to Sprint 1
- **When** the manager removes it from Sprint 1
- **Then** the finding appears in the Unassigned panel

---

### AC-07 — Access Control

**AC-07.1 — Unauthenticated user is redirected to login**
- **Given** a user is not logged in
- **When** they navigate to `/`
- **Then** they are redirected to `/login`

**AC-07.2 — DEV role cannot access sprint planner**
- **Given** a user is logged in with role=DEV
- **When** they navigate to `/sprints`
- **Then** they are redirected to `/`

**AC-07.3 — MANAGER role can access all pages**
- **Given** a user is logged in with role=MANAGER
- **When** they navigate to `/sprints` and `/integrations`
- **Then** the pages load successfully

---

## 9. System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              External Tools                                 │
│  Jira · GitHub · ClickUp · Asana · Trello · Zoho · Generic │
└──────────────────────────┬──────────────────────────────────┘
                           │ HMAC-signed webhooks / X-Triage-Secret
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              Integration Layer  (Express API)               │
│  POST /api/integrations/:provider/webhook                   │
│  POST /api/integrations/generic/webhook                     │
│  Named normalisers: jira · github · clickup · asana         │
│                     trello · zoho · generic                 │
└──────────────────────────┬──────────────────────────────────┘
                           │ NormalisedFinding
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              Finding Service  (Express API)                 │
│  computeRiskScore() · validate() · persist()                │
└────────────┬──────────────────────────┬─────────────────────┘
             │                          │ fire-and-forget
             ▼                          ▼
┌────────────────────┐    ┌─────────────────────────────────┐
│   PostgreSQL DB    │    │     AI Analysis Service         │
│   (Prisma ORM)     │    │  suggestSeverity()              │
│                    │    │  suggestFix()                   │
│  Finding           │◄───│  detectDuplicate()              │
│  Sprint            │    │  (OpenAI GPT-4o)                │
│  SprintFinding     │    └─────────────────────────────────┘
│  AuditLog          │
│  User              │
│  Integration       │
└────────────┬───────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│              Next.js Frontend  (App Router)                 │
│                                                             │
│  /                   Triage Board (DEV + MANAGER)          │
│  /findings/[id]      Finding Detail (DEV + MANAGER)        │
│  /sprints            Sprint Planner (MANAGER only)         │
│  /integrations       Integrations (MANAGER only)           │
│  /login              Login page                            │
└─────────────────────────────────────────────────────────────┘
```

---

## 10. Data Model

### Entity Relationship Summary

```
User ──────────────────────────────────┐
  │ (addedBy)                          │ (userId)
  ▼                                    ▼
SprintFinding ◄──── Finding ──────► AuditLog
  │                  │   │
  │            (duplicateOf)   └──► Integration
  ▼                  │                (provider, webhookSecret)
Sprint               └── (self-relation: duplicates)
```

### Key Model Fields

**Finding**
| Field | Type | Notes |
|---|---|---|
| id | cuid | Primary key |
| title | String | Required |
| description | String | Required |
| reproSteps | String? | Optional; rendered as numbered list |
| evidence | String? | URL or text; no file upload in v1 |
| severity | Severity enum | CRITICAL/HIGH/MEDIUM/LOW — human entered |
| assetCriticality | AssetCriticality enum | HIGH/MEDIUM/LOW — human entered |
| riskScore | Int | Server-computed: severity × assetCriticality |
| cvssScore | Float? | Optional CVSS score from pentester |
| affectedComponent | String | Required |
| affectedVersion | String? | Optional |
| status | FindingStatus enum | OPEN/ACKNOWLEDGED/IN_SPRINT/FIXED/CLOSED/DUPLICATE/NEEDS_REVIEW |
| needsReview | Boolean | true when source lacked severity/criticality data |
| suggestedFix | String? | AI-generated |
| aiSuggestedSeverity | Severity? | AI-suggested; does NOT override severity |
| aiSuggestedSeverityReason | String? | AI explanation |
| duplicateOfId | String? | Self-relation FK |
| sourceProvider | Provider enum | JIRA/GITHUB/CLICKUP/ASANA/TRELLO/ZOHO/GENERIC/MANUAL |
| sourceId | String? | External tool's own ID; used for deduplication |

**Unique constraint:** `[sourceProvider, sourceId]`

---

## 11. API Contract Summary

### Findings

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | /api/findings | Required | Create finding (computes riskScore) |
| GET | /api/findings | Required | List findings (sorted riskScore DESC, paginated) |
| GET | /api/findings/:id | Required | Get single finding with audit log |
| PATCH | /api/findings/:id | Required | Update finding (recomputes score if needed) |
| DELETE | /api/findings/:id | Required | Soft-delete (status → CLOSED) |
| POST | /api/findings/:id/analyse | Required | Re-trigger AI enrichment |
| GET | /api/findings/unassigned | Required | Findings with no sprint + recommendation |

### Sprints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /api/sprints | Required | List sprints with risk summaries |
| POST | /api/sprints | MANAGER | Create sprint |
| GET | /api/sprints/:id/findings | Required | Findings in sprint |
| POST | /api/sprints/:id/findings | MANAGER | Assign finding to sprint |
| DELETE | /api/sprints/:id/findings/:fid | MANAGER | Remove finding from sprint |

### Integrations

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /api/integrations | MANAGER | List configured integrations |
| POST | /api/integrations | MANAGER | Register integration |
| POST | /api/integrations/:provider/webhook | None (HMAC) | Receive named provider webhook |
| POST | /api/integrations/generic/webhook | None (secret header) | Receive generic webhook |
| GET | /api/integrations/generic/schema | None | Return generic payload JSON schema |

---

## 12. Integration Specifications

### Generic Webhook — Required Payload Schema

```json
{
  "title": "string (required)",
  "description": "string (required)",
  "severity": "CRITICAL | HIGH | MEDIUM | LOW (required)",
  "assetCriticality": "HIGH | MEDIUM | LOW (required)",
  "affectedComponent": "string (required)",
  "sourceId": "string (required — caller's unique ID for idempotency)",
  "reproSteps": "string (optional)",
  "evidence": "string (optional — URL or text)",
  "affectedVersion": "string (optional)",
  "cvssScore": "number (optional)"
}
```

Authentication: `X-Triage-Secret: <your-registered-secret>` header.

### Named Provider Severity Mappings

| Provider | Priority / Label | Maps To |
|---|---|---|
| Jira | Highest | CRITICAL |
| Jira | High | HIGH |
| Jira | Medium | MEDIUM |
| Jira | Low / Lowest | LOW |
| GitHub | label: critical | CRITICAL |
| GitHub | label: security | HIGH |
| GitHub | label: bug | MEDIUM |
| GitHub | (no matching label) | MEDIUM + needsReview |
| ClickUp | urgent | CRITICAL |
| ClickUp | high | HIGH |
| ClickUp | normal | MEDIUM |
| ClickUp | low | LOW |
| Asana | custom_field: severity (if present) | mapped directly |
| Asana | (no severity field) | MEDIUM + needsReview |
| Trello | label: red | CRITICAL |
| Trello | label: orange | HIGH |
| Trello | label: yellow | MEDIUM |
| Trello | (other colours) | LOW + needsReview |
| Zoho | severity field (BugTracker) | mapped directly |
| Zoho | (no severity field) | MEDIUM + needsReview |

---

## 13. Tech Stack Decisions

| Layer | Choice | Rationale |
|---|---|---|
| Frontend | Next.js 14 (App Router) | Server components, TypeScript-first, strong ecosystem |
| Styling | Tailwind CSS | Utility-first; fast to build consistent UI for demo |
| Backend | Node.js + Express | Lightweight, flexible, wide TypeScript support |
| ORM | Prisma | Type-safe DB queries, clean migration workflow |
| Database | PostgreSQL | Relational integrity needed for audit log and sprint relations |
| AI | OpenAI GPT-4o | Best JSON-structured output; graceful skip if key absent |
| Auth | NextAuth.js (credentials) | Minimal setup for demo; extensible to OAuth in v2 |
| Validation | Zod | Runtime schema validation with TypeScript inference |
| Testing | Jest + ts-jest | Standard Node.js testing stack |
| Version Control | Git — dev branch from main | `dev` = active development; `main` = stable baseline |

---

## 14. Build State & Progress

### Sub-Task Tracker

| # | Sub-Task | Status |
|---|---|---|
| 1 | Project Scaffold & Database Schema | ✅ Complete |
| 2 | Core API: Findings CRUD + Risk Scoring | 🔄 In Progress |
| 3 | AI Analysis Layer | ⏳ Pending |
| 4 | Integration Layer: Multi-Provider Webhooks + Generic Fallback | ⏳ Pending |
| 5 | Sprint Planner API | ⏳ Pending |
| 6 | Frontend: Triage Board | ⏳ Pending |
| 7 | Frontend: Finding Detail View | ⏳ Pending |
| 8 | Frontend: Sprint Planner | ⏳ Pending |
| 9 | Auth + Navigation Shell | ⏳ Pending |

### Sub-Task 1 — Delivered Files

| Path | Description |
|---|---|
| `package.json` | Monorepo root with workspaces and shared scripts |
| `apps/web/` | Next.js 14 + Tailwind + TypeScript scaffold |
| `apps/api/package.json` | Express + Prisma + OpenAI + Zod dependencies |
| `apps/api/tsconfig.json` | TypeScript compiler config |
| `apps/api/jest.config.json` | Jest + ts-jest config |
| `apps/api/prisma/schema.prisma` | Full Prisma schema — all models and enums |
| `apps/api/prisma/seed.ts` | Seeds dev@demo.com + manager@demo.com |
| `apps/api/src/index.ts` | Express entry point with /health endpoint |
| `.env.example` | Documents all required env variables |
| `.gitignore` | Excludes node_modules, .env, build artifacts |

### Git State

```
main  ── initial commit (README only)
  └─ dev ── feat: Sub-Task 1 — project scaffold, monorepo, Prisma schema, API bootstrap
```

---

## 15. Environment Setup

### Prerequisites

- Node.js 18+
- PostgreSQL 14+ (local or Docker)
- npm 9+

### First-time Setup

```bash
# 1. Clone the repository
git clone https://github.com/6ame0va/triage-platform.git
cd triage-platform
git checkout dev

# 2. Copy environment file and fill in values
cp .env.example .env

# 3. Install all dependencies (monorepo — installs both apps)
npm install

# 4. Run the database migration
npm run db:migrate

# 5. Seed demo users
npm run db:seed

# 6. Start the API (port 4000)
npm run dev:api

# 7. Start the frontend (port 3000) in a new terminal
npm run dev:web
```

### Demo Credentials (after seed)

| Email | Password | Role |
|---|---|---|
| dev@demo.com | demo1234 | DEV |
| manager@demo.com | demo1234 | MANAGER |

### Key Environment Variables

| Variable | Required | Description |
|---|---|---|
| DATABASE_URL | Yes | PostgreSQL connection string |
| OPENAI_API_KEY | No | If absent, AI enrichment is skipped silently |
| NEXTAUTH_SECRET | Yes | Random string for session encryption |
| NEXTAUTH_URL | Yes | Frontend URL (http://localhost:3000 for dev) |
| NEXT_PUBLIC_API_URL | Yes | API URL (http://localhost:4000 for dev) |

---

## 16. Out of Scope — V1

The following were explicitly agreed as out of scope for this version:

| Feature | Notes |
|---|---|
| File / image upload for evidence | Use text or URLs in the evidence field |
| Real-time updates (WebSockets) | Manual refresh only in v1 |
| Drag-and-drop kanban sprint board | Side-by-side panel layout only |
| Email / Slack notifications | No outbound alerting in v1 |
| Linear, GitLab, Azure DevOps integrations | Beyond the 6 named providers + generic fallback |
| User management UI | Users seeded only; no admin panel |
| Two-factor authentication | Credential auth only |
| Custom CVSS calculator UI | CVSS score is a free-entry field |
| OAuth-based provider auth | Shared secrets (HMAC) only |

---

## 17. Glossary

| Term | Definition |
|---|---|
| **Finding** | A bug, vulnerability, or issue filed by QA or a pentester |
| **Risk Score** | Severity Score × Asset Criticality Score (range 1–12) |
| **Asset Criticality** | How important the affected system/component is to the business (HIGH/MEDIUM/LOW) |
| **P1 / P2 / P3 / P4** | Priority labels derived from Risk Score: P1=9-12, P2=5-8, P3=3-4, P4=1-2 |
| **Sprint Recommendation** | System-generated suggestion for which sprint a finding should go into |
| **Override** | When a manager assigns a finding to a sprint other than the recommended one |
| **Normaliser** | A function that maps a provider-specific webhook payload to the internal NormalisedFinding schema |
| **HMAC-SHA256** | Hash-based message authentication code used to verify webhook payload integrity |
| **Soft Delete** | Setting status=CLOSED instead of physically removing a record |
| **Audit Log** | Immutable record of every change: who changed what, from what value, to what value, when |
| **NEEDS_REVIEW** | Status flag indicating AI or import could not determine severity/criticality; human review required |
| **Fire-and-forget** | An async operation triggered without waiting for its result (used for AI enrichment) |
| **CVSS** | Common Vulnerability Scoring System — an industry-standard score for security vulnerabilities |
| **DEV** | Developer role — read/triage access |
| **MANAGER** | Manager role — full access including sprint planning and integrations |
