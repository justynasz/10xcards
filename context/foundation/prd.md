---
project: "10xCards"
version: 1
status: draft
created: 2026-05-25
context_type: greenfield
product_type: web-app
target_scale:
  users: medium
  qps: low
  data_volume: small
timeline_budget:
  mvp_weeks: 3
  hard_deadline: null
  after_hours_only: true
---

## Vision & Problem Statement

Manual creation of high-quality educational flashcards is time-consuming — a workflow friction problem. The learner knows how to make cards; the effort is the barrier. The result: they skip card creation entirely and abandon the spaced-repetition method before it can deliver any benefit.

Existing tools split the workflow: users copy-paste text into a generic AI tool to generate cards, then manually import the result into a spaced-repetition app. The friction is the context-switching between tools, not any single tool being bad. 10xCards collapses the generate-and-review loop into one place — text in, scheduled review out, no tools to juggle.

## User & Persona

**Primary persona:** A professional learning on the job — reading technical documentation, research papers, or domain literature to build expertise in their field.

They are motivated and have material to learn. They know that spaced repetition works — but the overhead of extracting, formatting, and maintaining a flashcard deck from dense technical material is enough friction to make them reach for passive reading instead. They have tried Anki, found card creation too slow, and reverted to highlighting.

## Success Criteria

### Primary
- The end-to-end MVP flow works: user pastes text → AI generates flashcards → user reviews and accepts, edits, or discards each card → user studies cards via a spaced-repetition session → app schedules the next review automatically.
- 75% of AI-generated flashcards are accepted by the user without editing.
- 75% of all cards created by users are generated via AI (not typed manually).

### Secondary
- A user returns for a second review session without being prompted — indicating the product is sticky enough to bring them back organically.

### Guardrails
- A user's flashcard data is never lost. Losing a deck would destroy trust immediately and is an unrecoverable failure for the MVP.

## User Stories

### US-01: Generate cards from text

- **Given** I have a block of text I want to learn from
- **When** I paste it into the generation screen and confirm
- **Then** the app presents a set of AI-generated flashcards that I can accept, edit, or delete before they are saved to my deck

#### Acceptance Criteria
- Each generated card has a clear question on the front and an answer on the back.
- The user can accept, edit, or delete each card individually before saving.
- Only accepted cards are added to the deck; discarded cards are not saved.
- A partial failure — some cards bad, others good — does not discard the whole batch.

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

## Non-Functional Requirements

- **Generation feedback:** The user sees visible progress during card generation; the complete set of generated cards is presented within a timeframe that does not lead a reasonable user to abandon the session. The acceptable generation latency ceiling is TBD — see Open Questions.
- **Data isolation:** One user's flashcard data is never visible to another user. No path exists — direct or indirect — by which one authenticated user can read, modify, or infer the existence of another user's cards.

## Business Logic

The app makes two interlocking decisions for the user so they can focus on learning rather than logistics.

**Extraction rule:** Given a block of text submitted by the user, the app identifies the concepts, definitions, and facts most worth memorising and proposes them as question/answer card pairs. The user reviews and accepts, edits, or discards each proposal — the app's role is to surface candidates, not to decide unilaterally what is saved.

**Scheduling rule:** After each review interaction, the app computes the next review date for that card based on how well the user recalled it. Cards recalled with difficulty are scheduled for review soon; cards recalled easily are scheduled further out. The user never sets review dates manually — scheduling is fully automatic.

## Access Control

Users authenticate via email + password or OAuth. Each authenticated user has a private, isolated deck that no other user can access. There are no roles beyond "authenticated user" — the access model is flat. Unauthenticated requests to any card or review resource are rejected.

## Non-Goals

- **No custom spaced-repetition algorithm** — the product uses an existing, well-documented SR algorithm off-the-shelf. Building a custom scheduling algorithm from scratch is out of scope; the app's value is the integrated generate-and-review flow, not a proprietary algorithm.
- **No multi-format import** — text paste only for v1. Parsing PDF, DOCX, images, or other file formats adds complexity that is not worth the investment before the core generate-and-review loop is validated.
- **No shared decks** — cards are private to each user. No social features, collaboration, public deck discovery, or deck-sharing in MVP.
- **No mobile app** — web only. Native iOS/Android development is deferred until the web product proves the core loop.
- **No integrations with external learning platforms** — no sync with third-party flashcard or LMS tools in MVP.

## Open Questions

1. **What is the acceptable AI card generation latency ceiling?** The NFR requires generation to complete before the user would abandon the session, but no specific number is set. Owner: user / implementation team. Resolve before UI specification. Block: yes for NFR completeness.
2. **How will AI generation quality be validated before launch?** The Socrates round on FR-003 flagged low card quality as the primary failure mode for the product. A prompt validation protocol (sample texts, acceptance-rate measurement) should be agreed before the first user-facing release. Owner: user. Block: yes — the 75% acceptance-rate target depends on it.
3. **Which identity providers will be supported for OAuth?** The PRD specifies OAuth as an auth option but does not name providers. This is a downstream implementation decision. Owner: tech-stack-selection step. Block: no.
