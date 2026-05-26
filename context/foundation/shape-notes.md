---
project: 10xCards
context_type: greenfield
updated: 2026-05-25

checkpoint:
  current_phase: 8
  phases_completed: [1, 2, 3, 4, 5, 6, 7]
  frs_drafted: 10
  quality_check_status: accepted
---

## Vision & Problem Statement

Manual creation of high-quality educational flashcards is time-consuming — this is a **workflow friction** problem. The learner knows how to make cards, but the effort is the barrier. The result: they skip card creation entirely and abandon the spaced-repetition method.

**Pain:** Manual flashcard creation takes too long — workflow friction, not a skill gap.
**Moment:** When a learner sits down with new material (a doc, research paper, or article) and faces the overhead of extracting and formatting knowledge into cards.
**Cost today:** They skip the card creation step and get no benefit from spaced repetition.

**Insight:** Existing tools split the workflow — users copy-paste between ChatGPT for generation and Anki for review. The friction is the switching, not any single tool being bad. 10xCards integrates generate + review in one place.

**Success criteria (from seed notes):**
- 75% of AI-generated flashcards are accepted by the user without editing
- Users create 75% of their flashcards using AI (not manually)

## User & Persona

**Primary persona:** Professionals learning on the job — reading technical documentation, research papers, or domain literature.

They are motivated, have material to learn, and know that spaced repetition works — but the manual overhead of card creation is enough friction to make them reach for passive reading instead.

## Access Control

**Auth model:** Login — email + password or OAuth. Cards are stored server-side, tied to an account. Cross-device access is expected.

**Role model:** Flat — every authenticated user has the same capabilities. No admin or moderator roles in MVP.

## Success Criteria

### Primary
The MVP flow works end-to-end:
1. User pastes text (doc, article, research paper excerpt)
2. AI generates a set of flashcards from the text
3. User reviews generated cards — accepts, edits, or deletes each
4. User can also create cards manually
5. User studies cards via a spaced-repetition review session
6. App schedules next review using an existing SR algorithm

**Quantitative targets (from seed notes):**
- 75% of AI-generated flashcards are accepted by the user without editing
- 75% of all cards created by users are generated via AI (not typed manually)

### Secondary
User returns for a second review session without being prompted — measures whether the product is sticky enough to bring them back.

### Guardrails
- User's cards are never lost — data durability is non-negotiable. Losing a deck would destroy trust.

**Timeline:** 1–3 weeks of after-hours work.

## Functional Requirements

### Authentication
- FR-001: User can register and log in to an account. Priority: must-have
  > Socrates: Counter-argument considered: "account creation adds friction that kills v1 conversion." Resolution: kept — cards must survive across sessions and devices; accounts are the minimum viable persistence mechanism.
- FR-002: User can log out. Priority: must-have

### AI Card Generation
- FR-003: User can paste text and trigger AI generation of flashcards. Priority: must-have
  > Socrates: Counter-argument considered: "if AI quality is low, a poor accept-rate will destroy trust faster than manual cards would." Resolution: kept, but noted as a quality risk — prompt engineering must be validated before launch; low card quality is the primary failure mode for this feature.
- FR-004: User can review AI-generated flashcards and accept, edit, or delete each before saving. Priority: must-have
  > Socrates: Counter-argument considered: "auto-save all and let users delete later reduces clicks." Resolution: kept — the explicit review step is load-bearing for the 75% acceptance-rate metric and for user trust in AI output.

### Manual Card Management
- FR-005: User can create a flashcard manually (front + back). Priority: must-have
  > Socrates: Counter-argument considered: "if 75% of cards come from AI, manual creation delays shipping the core flow." Resolution: kept — manual creation is the safety valve; users won't adopt AI-only without the ability to correct or supplement it.
- FR-006: User can view all their flashcards. Priority: must-have
- FR-007: User can edit any flashcard. Priority: must-have
- FR-008: User can delete any flashcard. Priority: must-have
  > Socrates (FR-006–008): No counter-argument; basic card management is necessary for any trust in the deck.

### Spaced Repetition
- FR-009: User can start a spaced-repetition review session. Priority: must-have
- FR-010: App schedules the next review for each card using a built-in SR algorithm. Priority: must-have
  > Socrates: Counter-argument considered: "a simple pass/fail queue ships faster than a full SR algorithm." Resolution: kept — without SR scheduling, the product is a flashcard viewer; the algorithm is the core value proposition that differentiates it from a notes file.

## Product Framing

- **product_type:** web-app
- **target_scale:** medium (dozens to ~100 users)
- **timeline_budget:**
  - mvp_weeks: 3
  - hard_deadline: null
  - after_hours_only: true

## Non-Goals

- **No custom SR algorithm** — SM-2 is used off-the-shelf. Building a custom scheduling algorithm (like SuperMemo or Anki) is out of scope; the app's value is the integrated flow, not the algorithm.
- **No multi-format import** — text paste only for v1. PDF, DOCX, and image import add parsing complexity that is not worth the investment before the core generate-and-review loop is proven.
- **No shared decks** — cards are private to each user. No social features, collaboration, or public deck discovery in MVP.
- **No mobile app** — web only. Native iOS/Android development is deferred until the web product is validated.
- **No integrations with external learning platforms** — Anki sync, LMS integrations, etc. are out of scope.

## Business Logic

**Domain rule:** The app makes two interlocking decisions for the user: (1) what knowledge to extract from raw text into flashcard form (AI extraction rule), and (2) when to surface each card for review based on the user's recall performance (SR scheduling rule).

**AI extraction rule:** Given a block of text pasted by the user, the app identifies concepts, definitions, and facts worth memorising and formats them as question/answer pairs. The user reviews and accepts, edits, or discards the output — the app's job is to propose, not to decide unilaterally.

**SR scheduling rule:** After each review session, the app rates the user's recall of each card (using the SM-2 algorithm) and computes the next review date. Cards the user struggles with are surfaced more frequently; well-retained cards are spaced further apart. The user does not set review schedules manually.

**Algorithm:** SM-2 (SuperMemo 2) — widely documented, open-source implementations exist, no external service dependency required.

## Non-Functional Requirements

- **AI generation latency:** User-perceived response time for card generation must be acceptable — generation completes or the first card appears within a timeframe that does not cause the user to abandon the session. (Specific budget TBD during implementation; streaming output is a candidate mitigation.)
- **Data privacy:** One user's cards are never visible to another user. Deck isolation is enforced at the data layer, not just the UI.

## User Stories

### US-01: Generate cards from text
**Given** I have a block of text I want to learn from,
**When** I paste it into the generation screen and confirm,
**Then** the app presents a set of AI-generated flashcards that I can accept, edit, or delete before they are saved to my deck.

## Quality Cross-Check

All six greenfield quality elements present. Status: **accepted**.

| Element | Status |
|---|---|
| Access Control | present — login (email/OAuth), flat user model |
| Business Logic | present — two-part rule: AI extraction + SM-2 scheduling |
| Project artifacts | present — shape-notes.md with valid checkpoint |
| Timeline-cost ack | present — 1–3 weeks, within tight-MVP threshold |
| Non-Goals | present — 5 explicit entries |
