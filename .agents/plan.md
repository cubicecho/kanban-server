# Clarifying roles, lanes and the record of work

> **Step one on approval:** copy this file to `.agents/plan.md` in the repo, so it lives with the
> code and can be decomposed into cards.

## Context

The board's automation works, but three things have gone wrong as it grew.

**The job is attached to the wrong noun.** `roles` (a prompt) hangs off `agents` (a model
endpoint), and `lanes` merely point at an agent. But a role is really a **kind of lane** — a
Review lane is a Review lane whoever staffs it — and an agent is really just *which model*.
Welding the job to the worker means a board can only do jobs somebody minted an agent for; it
makes `readVerdict` a second, disagreeable place to say a lane judges; and it forces `seedLanes`
to find its executor and reviewer by matching a user-editable role **name**
(`server/graphql/schema.ts:176`, `server/runner/prompts.ts:98`).

**The card's record of what happened is overloaded and lossy.** `cards.error` carries four
unrelated things — a crash, a reviewer's FAIL text, `waiting on: …`, and `INTERRUPTED` — and
`cardPrompt` feeds all of it to the next agent as "Why this came back"
(`server/runner/prompts.ts:150`). A connection-reset message can reach an agent as review feedback.
A judging station that *passes* a card writes nothing to it (`server/runner/run.ts:518`), so the
note explaining a pass survives only in `runs.output` until retention deletes it. And nothing
anywhere records a *person* moving a card.

**The pipeline has two front doors.** A task is refined, accepted, then decomposed off-board; the
board picks up from there. Two mental models for one flow.

---

## How the system works, after this change

### Five nouns and two records

| | Is | Carries |
| --- | --- | --- |
| **Project** | a body of work | a board, and the context every agent here is given |
| **Card** | a unit of work | the only thing that moves |
| **Lane** | a column, and maybe a station | a kind, a worker, and where cards go next |
| **Role** | a **kind of lane** | a contract, and the prompt that goes with it |
| **Agent** | a worker | a model endpoint, tools, and an optional "who am I" |
| **Run** | one execution of an agent | what it said, what it called, what it cost |
| **Card event** | one move of a card | from, to, why, and who |

**The one rule: a role and an agent never meet except at a lane.** Neither knows about the other.

### A lane is the whole of the automation

```
  kind        → what sort of lane this is     lanes.roleId
  extra       → anything to add, this board   lanes.prompt      (appended, never replaces)
  worker      → which agent does it           lanes.agentId
  on pass     → where cards go next           lanes.onSuccessLaneId
  on fail     → where cards go instead        lanes.onFailureLaneId
  at once     → how many run here             lanes.wipLimit
  retries     → how many failures to absorb   lanes.maxAttempts
```

Any may be empty. A lane with no kind is a resting place — a backlog, a done pile. There is no
workflow engine; the pipeline is the shape of the board somebody drew.

### A role is a pre-defined kind of lane

**The word keeps its spelling and changes its owner.** A role used to be something an agent *was*;
it is now the role a lane *plays* in the pipeline. That is correct English — "this lane's role is
to review" — and it is the sentence that has to land for the rest of the model to read clearly.

A lane is an *instance* of a role. Making a board is picking kinds of lane and wiring them up:

```
  New lane ▸ Review    →  contract: verdict, and the reviewer prompt, already filled in
```

The three seeded roles are the three kinds of station a board can have:

| Role | `contract` | The agent answers with | What happens to the card |
| --- | --- | --- | --- |
| **Doing** | `work` | a report | becomes `cards.result`; card follows the pass arrow |
| **Review** | `verdict` | `PASS`/`FAIL`, then why | routes the card; the rest is kept as the move's note |
| **Intake** | `expand` | JSON cards | children created down the pass arrow; the parent archives |

`contract` is the only thing about a role a program relies on. Everything else is prose.

**There is no `refine` contract**, because refinement never appears on a board — it is a chat a
person has (Phase 3). The old `refiner` role was only ever a row because everything else was; it
becomes the `REFINE_SYSTEM` constant plus `settings.refineAgentId`, with `settings.refinePrompt`
(blank = the constant) keeping it editable. Every contract that exists is something a lane does,
with no odd member out.

**This replaces `lanes.readVerdict`.** A lane judges because it *is* a Review lane. The old flag
existed to keep judging off the *agent*; with the job on the lane that need is met, and two rows
that can disagree about one fact is the bug being removed. A `reviewer` role pointed at a lane with
`readVerdict: false` is a board that looks like it reviews and silently does not.

*What this costs:* an advisory reviewer — a station told to judge whose verdict is ignored. It is
recoverable by writing a second role with `contract: work`. Niche enough to name, not design for.

### The prompt an agent gets is three layers

```
  project.context      where you are        the stack, the conventions, where things live
  agent.systemPrompt   who you are          usually empty — the model's own standing instruction
  role.prompt          what happens here    the job, shared by every board that does it
  + lanes.prompt       …and on this board   optional, appended
```

Composed by a new `systemPromptFor()` in `server/runner/prompts.ts`. A lane whose composition
comes out empty is **refused at run time** — one check replacing both the old `agents.roleId`
`notNull` and the worry about a run starting with an empty system message.

The order is deliberate: **an agent says who it is, and the lane says what to do, so the lane
speaks last.** `agent.systemPrompt` used to *replace* the job; now it precedes it. Expect it blank
— it is for the case a lane cannot express, like a small local model that needs "be terse" on
every station it works.

### The board is the whole pipeline

```
  intake  →  backlog  →  doing  →  review  →  done
  expand                 work      verdict
```

Refinement is no longer a stage. It is a **chat a person has** when they want to think something
through, ending with "make cards?" — dropping the result into intake. An agent with nothing to
refine creates a card in intake directly.

### A card's history is a ledger of its moves

**A rejection is a property of the move, not of the card.** "Why is this card here?" is answered by
the most recent inbound move. The ledger also catches human drags, which runs never do.

```
  created            → Intake     you          "add oauth login"
  expanded           → Backlog    decomposer   4 cards            [parent archived]
  moved    Backlog   → Doing      you
  worked             in Doing     executor     → result
  moved    Doing     → Review     executor
  REJECTED Review    → Doing      reviewer     "no test for the refresh path"
  worked             in Doing     executor     → result
  PASSED   Review    → Done       reviewer     "criteria met"
```

### What each field means afterwards

| Field | Means, and only this |
| --- | --- |
| `cards.result` | the last account of the **work** — what an executor reported |
| `cards.error` | what actually **broke** — a crash, an interrupted run. Never a verdict |
| `cards.status` | `idle`, `running`, `done`, `rejected`, `error` |
| card event `note` | **why** a card moved — a verdict, or a person's reason |
| `runs.output` | what one agent said, once |

`rejected` is not `error`. A reviewer saying no is the system working; a crash is not. They look
different on the board and a person can tell at a glance which one needs them.

**Nothing stores what can be recomputed from the cards around it.** `blocked` stops being a status
and `waiting on: …` stops being stored — both were written once and never revisited, so both went
stale. `blockers` becomes a GraphQL field, derived per call.

---

## Decisions taken

- **A role is a pre-defined kind of lane**, and a lane is an instance of one. The word `roles`
  keeps its spelling and changes its owner — "this lane's role is to review". The table is not
  renamed; the docs and the UI are what move.
- Roles are a **shared library of lane kinds**; a lane points at one and may append an addendum.
  Editing a role changes every lane of that kind — that is the point of keeping the pointer rather
  than copying the prompt onto each lane, and the lane dialog must say so out loud.
- **There is no `refine` contract.** Refinement is not a kind of lane, so the `refiner` role is
  deleted and its prompt moves to `settings.refinePrompt`. Every contract that survives is
  something a lane does.
- Roles **move off the Agents page** to their own route. They stopped being about agents.
- **`agents.roleId` is dropped.** An agent is a model endpoint and an optional identity, nothing
  more. It no longer knows what job it does; it finds out at the lane.
- `agent.systemPrompt` **survives as an Identity layer** — prepended, expected blank, for the
  standing instruction a particular model needs on every lane it works ("you are a small local
  model; be terse"). It stops being an *override* of the job and becomes a layer above it.
- A role served by **both** a judging and a working lane is **cloned** in the migration, and only
  the judging lanes are repointed. Ten lines of SQL against a working lane silently becoming a
  judging one — the same silent-wedge failure the rest of the codebase guards against.
- **No `draft` card status.** An undecomposed card is an idle card in a lane whose job is `expand`.
- An expanding card **archives itself**; children carry `parentId` and land down the **pass arrow**.
- The **move ledger**, not a field on the card, is where a rejection note lives. No `cards.feedback`.
- The card dialog timeline **merges moves and runs by timestamp**, collapsing a move and the run
  that caused it into one expandable entry.
- The timeline reads **oldest first** — it is a story, and the rhythm only reads forwards. The
  order must be **stated in the UI**, not implied, with a control to invert it. (The Runs page
  stays newest-first; it is a firehose across the whole board, where recency is the point.)

---

# Phase 1 — Rejection is not an error, and moves are recorded

*Independent of every other phase. Fixes live bugs. Start here.*

### 1.1 Schema — `server/db/schema.ts`

**New table `cardEvents`**, after `cardDeps` (~line 405):

```
id, cardId (cascade), runId (nullable, set null),
fromLaneId / toLaneId (nullable, set null),   -- null from = created; null to = archived
note (text, default ""),
actor: "agent" | "user" | "system",
createdAt
```

Index on `cardId`. No `kind` column — from/to/actor/note already say what happened, and an enum
here would be the same over-specification `readVerdict` was. **Not pruned by
`runRetentionDays`**: the ledger is small and is the durable answer to "why is this card here",
which must outlive the runs it points at.

**`cards`** — `status` (line 341): drop `blocked`, add `rejected`. Doc comment says which is which.
Give `error` the comment it has never had. **No `feedback` column.**

**`runs`** — add `verdict: "none" | "pass" | "fail"`. A verdict run that doesn't move the card
leaves no event, so the run must carry it.

**Relations** (~line 578-592) — add `runs.lane` (Phase 1 timeline needs the station's name),
`cardDeps.dependsOn` and `cards.blocks` (Phase 4). Add `card_deps_depends_idx` on
`dependsOnCardId` — nothing can ask "what waits on this" today.

> ⚠️ Run `tests/mcp-endpoint.test.ts` **early**. Three new relations grow the generated tool
> listing, and per AGENTS.md the bound is the driver's to move, not ours to raise. If it bites,
> drop `cards.blocks` — the dialog derives the reverse direction client-side anyway.

### 1.2 Migration

`npm run db:generate`, then hand-add the data statements (precedent:
`drizzle/20260902004627_easy_siren/migration.sql`). Never touch `snapshot.json`.

```sql
UPDATE "cards" SET "status" = 'idle', "error" = '' WHERE "status" = 'blocked';
```

**Do not** try to reclassify existing `error` cards as `rejected`. The old column genuinely
conflated four things; a wrong reclassification is worse than a stale one, and `error` already
means "a person must look at this".

### 1.3 `runCard` — `server/runner/run.ts:449-524`

- **Delete the blocked write** (461-468). Just `throw` — the caller already gets the reason in the
  message, and the stored string was the thing that went stale.
- Verdict needs a judging station **and** a finished run:
  `lane judges && run.status === "ok" ? (/^\s*FAIL\b/i.test(output) ? "fail" : "pass") : "none"`.
  A reviewer whose connection dropped ruled on nothing.
- `status`: `stopped || rework ? idle : !passed ? (verdict === "fail" ? "rejected" : "error") : …`
- `error: run.error` — **replaces** `passed ? "" : run.error || (readVerdict ? output : "the agent
  did not finish")`. That expression wrote *"the agent did not finish"* onto cards whose run
  somebody **stopped** (`stopped` short-circuits `status` at 513 but not `error` at 518). Existing
  bug, fixed for free.
- Write a `cardEvents` row for every move, carrying the verdict text as `note` and `runId`.
- `readyCards` (533-553): `inArray(status, ["idle","blocked"])` → `eq(status, "idle")`.
- `reconcile` (92-125): unchanged. `INTERRUPTED` → `cards.error` is now exactly right.

### 1.4 Every other writer emits an event

`moveCard` (gains an optional **`note`** argument), `retryCard`, `archiveCard`/`restoreCard`,
and card creation. `retryCard` clears `error` and `attempts` but **does not** rewrite history.

### 1.5 `cardPrompt` — `server/runner/prompts.ts:139-153`

Reads `cards.result` as "What the last agent reported" and the **most recent inbound move's note**
as "Why this came back". **`card.error` leaves the prompt entirely** — this is the headline fix.
One extra query per prompt build; negligible.

### 1.6 GraphQL & MCP

- New `blockers(cardId:)` query field beside `models`/`spend`, resolving the existing
  `blockers()` from `run.ts:411`. Add to the `TOOLS` list — `triage_board` asks agents to name what
  a blocked card waits on and today has no way to.
- `moveCard` gains `note`. Rewrite the descriptions of `moveCard`, `retryCard`, `archiveCard` and
  the `cards`/`runs` HINTS — they are what an MCP client reads.

### 1.7 Frontend

- New `src/lib/cards.ts` — `CARD_STATUS_VARIANT`, retiring the map duplicated at
  `board-card.tsx:24` and `archive.tsx:23`. `rejected` gets its **own** colour, not
  `destructive`: the whole point is telling it apart from a crash at a glance.
- `board-card.tsx`: retry button on `error || rejected`; the "After X, Y" line stops swallowing
  archived deps (`board.tsx:347` `.filter(Boolean)` → `|| "an archived card"`).
- **Card timeline** — extract `History` out of `card-dialog.tsx` (228 lines, and Phase 4 adds
  more) into `src/components/card-history.tsx`. Merge `cardEvents` and `runs` by timestamp,
  collapsing where an event carries a `runId`. A work run leads with `Doing · executor`; a verdict
  row leads with a `PASS`/`FAIL` badge and shows **the first line of the note inline**, not behind
  a click — a one-line reason is the whole value of a review. Reuse `duration` and
  `RUN_STATUS_VARIANT` from `src/lib/runs.ts`.
- Poll while a run is live (mirror `board.tsx:132-138`) and render `<RunStream>` for an expanded
  running row, as `runs.tsx:165` does. Add `card-runs` to `refresh()` in `board.tsx:145`.

### 1.8 Docs

`AGENTS.md` — "**`done` means nothing further will happen**" ("a card a reviewer rejected stays
`error`") and "**A verdict is not an account of the work**" ("the rejection lands in
`cards.error`") both now state the opposite of the truth. `README.md:116-160`, and
`mcp-prompts.ts:68-76` + `triage_board` steps 3-4.

### 1.9 Tests

`tests/board-run.test.ts` carries most of it: `blocked` assertions (288) become "the status is not
written"; every `back.status === "error"` after a FAIL becomes `rejected`; `back.error` becomes the
move's note. **The two most important new tests:**

1. A judging station whose run **crashes** leaves the card `error`, verdict `none`, and the crash
   text **absent from the next agent's prompt**. This is the bug the phase exists for.
2. A **pass** records its note. Today a pass's reasoning vanishes.

Plus `graphql.test.ts` (`retryCard` fixture, a new `blockers` test), `recovery.test.ts` (a restart
is not a ruling), `worker.test.ts`, `archive.test.ts`.

> **`feat!:`** — removing `blocked` from the generated `CardsStatusEnum` breaks any client
> filtering on it. semantic-release reads the footer.

---

# Phase 2 — The role moves from the agent to the lane

> **The one rule this phase buys: a role and an agent never meet except at a lane.** Neither table
> references the other. An agent is *what model*; a role is *what job*; the lane is where they meet.

### 2.1 Schema — `server/db/schema.ts`

| Table | Change |
| --- | --- |
| `roles` | `stage` → **`contract`** (`work \| verdict \| expand`); `systemPrompt` → `prompt` |
| `agents` | **`roleId` dropped** (`:105-110`). `systemPrompt` stays, recommented as Identity (`:117`) |
| `lanes` | gains **`roleId`** (nullable, `restrict`) and **`prompt`** (text, default `""`). **`readVerdict` dropped** |
| `settings` | gains `refineAgentId` + **`refinePrompt`**, and `decomposeAgentId` (which Phase 3 retires) |
| relations | drop `roles.agents` + `agents.role` (`:535-539`); add `lanes.role` + `roles.lanes` |

> `lanes.roleId` stays **nullable** — a Backlog is not a station. Guard at run time instead.

`lanes` has **no text column but `name` today**, so `prompt` is genuinely new — which means
`TemplateLane` (`:452-471`) gains `roleId: string | null` and `prompt: string`, and
`saveBoardTemplate`/`applyBoardTemplate` must carry both. A template's `roleId` gets exactly the
treatment `agentId` already has — read back `?? null`, because a role id belongs to this server.

### 2.2 Migration — hand-ordered, three hazards

1. **drizzle-kit groups DDL by table**, so `agents DROP COLUMN roleId` will likely be emitted
   *before* `lanes ADD COLUMN roleId` — and the backfill reads `agents.roleId`. **Reorder by hand
   and diff before committing.**
2. **Both renames** (`stage`→`contract`, `systemPrompt`→`prompt`) emit DROP + ADD
   non-interactively, silently blanking the column. Hand-fix to `ALTER TABLE "roles" RENAME COLUMN`.
3. `roles` was created by `drizzle/20260902004627_easy_siren` with **empty** prompts, and
   `migrate.ts:36-45` repairs them from `DEFAULT_ROLES` on boot. That repair must keep working
   against the renamed column or every seeded role silently loses its prompt.

Order:

```sql
-- 1. lanes gain the job
ALTER TABLE lanes ADD COLUMN "roleId" text REFERENCES roles(id) ON DELETE restrict;
ALTER TABLE lanes ADD COLUMN prompt text NOT NULL DEFAULT '';
UPDATE lanes SET "roleId" = a."roleId" FROM agents a WHERE lanes."agentId" = a.id;

-- 2. freeze what resolveStage used to compute, before the join that computes it is gone
UPDATE settings SET "refineAgentId" = (…first enabled agent whose role.stage='refine', by name…),
                    "decomposeAgentId" = (…same for 'decompose'…) WHERE id = 'default';

-- 3. rename, then set contracts
ALTER TABLE roles RENAME COLUMN stage TO contract;
ALTER TABLE roles RENAME COLUMN "systemPrompt" TO prompt;

-- 3a. a role behind BOTH a judging and a working lane becomes two roles
INSERT INTO roles (id, name, description, contract, prompt, "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, r.name || ' (review)', r.description, 'verdict', r.prompt, now(), now()
FROM roles r WHERE EXISTS (judging lane with r) AND EXISTS (working lane with r);
UPDATE lanes SET "roleId" = <the clone> WHERE "readVerdict" AND "roleId" = r.id;

UPDATE roles SET contract = 'verdict' WHERE id IN (…roles only ever on readVerdict lanes…);
UPDATE roles SET contract = 'work'    WHERE contract = 'card';
UPDATE roles SET contract = 'expand'  WHERE contract = 'decompose';

-- 3b. refinement is not a kind of lane; its prompt moves to settings and the row goes
UPDATE settings SET "refinePrompt" = (SELECT prompt FROM roles WHERE contract = 'refine' LIMIT 1)
WHERE id = 'default';
DELETE FROM roles WHERE contract = 'refine';

-- 4. the old homes go
ALTER TABLE lanes DROP COLUMN "readVerdict";
ALTER TABLE agents DROP COLUMN "roleId";
```

> The `refine` deletion is the one destructive statement here. It is safe because a `refine` role
> can never be on a lane (`lane-dialog.tsx:136-145` has always filtered the picker to
> `stage === "card"`), so nothing references it — but the prompt must be copied to `settings`
> **before** the delete, or a customised refiner is lost.

**What is still not preserved, and it is the `feat!:`:**
- `agent.systemPrompt` changes from **override to layer**. Text preserved, behaviour is not.
  `tests/board-run.test.ts:244-272` asserts the override exactly — the second half becomes a
  `toContain` rather than a `toBe`.
- Agents never wired to a lane lose their job. Under this design that is *correct* — an unwired
  agent is an endpoint — but say it in the footer. Do **not** paper over it by copying the role
  prompt into `agent.systemPrompt`; that defeats the reuse the change is for.
- Old board templates have no role or prompt. `?? null` / `?? ""`, on the principle already
  written down for `agentId` ("a template is a shape").
- `Role.stage` and `Agent.roleId` leave the generated GraphQL schema. Anything selecting them
  stops compiling.

### 2.3 Code

**`resolveStage` (`llm.ts:113-126`) is deleted outright, not replaced.** It existed to answer "which
agent can do this job", and after this change no agent *has* a job. Its two callers are the two
things that never sat on a board: `refineTask` (`run.ts:263`) and `decomposeTask` (`run.ts:339`),
and both now read an agent id straight out of `settings`. Everything on a board reads
`lanes.agentId`, which was always the honest answer. The `agents ⋈ roles` join goes with it.

`roleFor(contract)` — the first role with that contract, by name — replaces the load-bearing **role
name** lookup in `seedLanes` (`server/graphql/schema.ts:166-177`); delete
`EXECUTOR_ROLE`/`REVIEWER_ROLE` (`prompts.ts:98-99`).

New **`systemPromptFor()`** in `prompts.ts` composes the three layers. Note `run.ts:283` and
`run.ts:351` already carry a second fallback (`agent.systemPrompt || REFINE_SYSTEM`) — fold those
into the composer rather than leaving two fallback chains.

`resolveAgent` (`llm.ts:62-98`) drops the role query at `:68`, the throw at `:72`, and the
inheritance at `:88`. **`Resolved` drops `roleId`/`roleName`/`stage` almost for free** — nothing in
production reads any of the three; the only breakage is three test fixtures
(`agent.test.ts:55`, `agent-ondemand.test.ts:95`, `agent-resilience.test.ts:85`).

**Seed one agent, not four.** `migrate.ts:46-51` currently builds a name→id map and inserts one
agent per role. After this change those four rows differ in *nothing*, and their names
(`executor`, `reviewer`) actively lie about what an agent is. Seed one, only when `agents` is
empty, so upgrades keep the four they have.

`DEFAULT_ROLES` becomes **three**, and they should be renamed to what they now are — kinds of
lane, not jobs a worker holds. `executor`/`reviewer`/`decomposer` → **Doing / Review / Intake**,
matching the lanes `seedLanes` draws. `REFINE_SYSTEM` stays in `prompts.ts` as the constant behind
`settings.refinePrompt`; `EXECUTE_SYSTEM`, `REVIEW_SYSTEM` and `DECOMPOSE_SYSTEM` stay as the three
roles' seeded prompts.

### 2.4 UI — five files, and one of them is deleted from the agent side

**Creating a lane leads with its kind.** "New lane ▸ Review" fills in the role, and with it the
contract and the prompt; the user names it and wires the arrows. This is the change that makes the
board legible to someone new — you assemble it out of known parts rather than filling in seven
fields and hoping. A lane with no role is still creatable; that is a resting place.

**`lane-dialog.tsx`** becomes the board's important screen, ordered as the sentence a lane makes:
name → **kind** (role picker, the role's prompt shown read-only, with the warning that editing it
changes every lane of that kind) → **also on this board** (the addendum; the placeholder has to
make append-only unmistakable) → **worker** → arrows, WIP, attempts. The `role.stage === "card"`
filter on the agent picker (`:136-145`) **goes away** — any agent will do, which is the whole point.
**Delete the "Judge, do not work" switch**; a derived read-only line replaces it.

**`agent-dialog.tsx`** gets shorter: no role `<Select>` (`:156-168`), no per-stage copy
(`:171-177`), no "Start from {role.name}" button (`:235-243`), no `roleId` validation (`:101`).
`systemPrompt` is relabelled **Identity** — "usually empty; the lane's role says what to do".

**`agents.tsx`** loses the role badge (`:92`), the effective-prompt line (`:125`), **and the whole
Roles section** (`:132-198`, plus the `removeRole` mutation at `:59-65` and the `RoleDialog` mount
at `:195-198`). Roles lived on the Agents page because a role was something an agent had; as kinds
of lane they belong with the board. **Move them to their own `/roles` route** (`src/router.tsx:43`),
reachable from the board — the per-role count becomes a **lane** count, and the delete-refused
toast now reads "a lane is still of this kind".

**`role-dialog.tsx`** — the `STAGES` array (`:33-49`) becomes `CONTRACTS`, **three** entries, with
copy saying what shape of answer each expects and what it does to the card.

**`project-dialog.tsx`** — the `byStage` filter (`:82-83`, `:217`, `:236`) has nothing left to
filter on, so the refine/decompose pickers offer every enabled agent. Fine, and arguably right, but
it is a visible behaviour change.

### 2.5 GraphQL / MCP

`roles` is a fully generated entity with **no `features` clause** (`server/graphql/schema.ts:59-67`)
— it stays writable. `Query.roles` is one of the 31 MCP tools; its HINT
(`mcp-endpoint.ts:101-104`) describes `stage` and "only a `card` role is one a lane can point at"
and must be rewritten for `contract`. The `agents` HINT (`:99`, "filling which role") and the
`create_project` HINT (`:114-118`, "this server's executor and reviewer agents") are both now wrong.

> `tests/mcp-endpoint.test.ts:93` and `:382` assert the **exact sorted 31-tool list**, twice. Phase 1
> adds `blockers` (and possibly `card_events`) to both. Update them deliberately, not reflexively.

### 2.6 Tests and docs

`tests/board-run.test.ts:59-67` and `tests/worker.test.ts:101-105` both seed agents by looking up
role rows *by name* and throwing if they are missing — that fixture becomes "one agent, and lanes
carrying roles", and it is the change that proves the phase. `graphql.test.ts:452-461` selects the
executor role only to get a `roleId` for a hand-made agent; that line just goes.

**New test, the one that pins the rule:** one agent, three lanes, three different roles, all
running correctly — a role and an agent meeting only at a lane.

`AGENTS.md` needs the whole "**A role is the job; an agent is the job plus a model**" block
(`:109-116`) rewritten, plus `:5`, `:195-196`, `:219-221` and the sentinel-inheritance block
(`:254-260`). `README.md` glossary `:43-51`, the Agents-page section `:263-273`, and `:278`/`:281`.

### 2.7 Flagged
`projectContext` is currently in the **user** prompt for card runs (`prompts.ts:139`) and the
**system** prompt for refine. Moving it to the system layer without stripping it from `cardPrompt`
sends it **twice** every run. Strip it — but **as its own commit**, because it changes what the
tool-preselector sees (`agent.ts:284`), so a regression there stays bisectable.

---

# Phase 3 — Refinement becomes a chat; decomposition becomes a lane

**A task stops being a stage and becomes a conversation.** It has no status, no pipeline and no
decomposition of its own. Its single exit is a button that writes one card into intake. From there
the board is the only thing that happens.

```
  chat ──"make cards?"──▶  intake  ──expand──▶  backlog  ──▶  doing  ──▶  review  ──▶  done
                           1 card               N children
```

### 3.1 Schema

- `cards.parentId` (nullable, `set null`) — which card asked for this one.
- **`tasks.status` and `tasks.error` are dropped.** Whether a conversation produced work is
  `cards.taskId`, which **already exists** (`schema.ts:330`) and already points the right way.
  This is the same rule as `blocked` and `readVerdict`, applied a third time: nothing stores what
  the rows around it already say.
- `roles.contract` gains nothing — `expand` was already in Phase 2's enum.

### 3.2 The `expand` contract — reuse `decomposeTask`'s body, don't rewrite it

The `decomposer` role is not deleted here — Phase 2 already turned it into the **Intake** kind of
lane (`contract: expand`). What this phase adds is the handler that honours that contract on a
board, so decomposition stops being an off-board stage and becomes a station like any other.

`decomposeTask` (`run.ts:335-409`) already does exactly this job, and the half worth keeping is the
half below the run: writing the cards, then resolving `dependsOn` **by title within the batch**
(`:392-405`), dropping any title outside it. Extract `:376-405` into a shared
`writeCards(tx, { projectId, laneId, taskId, parentId, proposed })` and let both callers use it.

The `expand` handler in `runCard` then: parse JSON cards → write them into the lane's
**`onSuccessLaneId`** with `parentId` set → **archive the parent** (`archivedAt`, which Phase 1's
ledger records as an `archived` event caused by this run).

Two guards, both at run time, both the same class as the existing rework guard:
- an `expand` lane with **no pass arrow** is refused — the children would have nowhere to land;
- an expansion producing **zero readable cards** is an error, not an empty success. That is already
  `decomposeTask`'s rule (`:372-374`) and the reason is unchanged: a card the agent could not break
  up is exactly the case a person needs told about.

### 3.3 What goes, what stays

| | |
| --- | --- |
| `refineTask` | **stays.** Drop the `task.status !== "draft"` guard (`run.ts:261`) with status |
| `stopTask` | **stays** — it is about runs, not the pipeline |
| `acceptTask` | **deleted.** Accepting was the handoff to decomposition; there is no handoff |
| `decomposeTask` | **deleted as a mutation**; its body becomes §3.2's `expand` handler |
| `submitTask` | **replaced by `submitCard(projectId, title, body)`** — one card into intake |
| `intakeLane()` | **stays as it is** (`run.ts:303-313`) — `intake` desc, then leftmost. Never fails |

New mutation **`makeCard(taskId)`**: writes one card into the intake lane with the task's `title`
and its `brief` as the body, and `taskId` set so the card links back to the conversation. That is
the "make cards?" button, and it is the *only* way a chat reaches the board.

`submitCard` is the MCP front door. An outside client has no lane ids, so it cannot use the
generated `create_card`; this is the tool that knows where a project's front door is.

### 3.4 UI and MCP

- The tasks screen loses its accept and decompose buttons and gains one: **"Make cards"**. Once a
  task has a card, show a link to it rather than the button.
- **Warn on the board when a project has no lane with `intake` set** — the front door then falls
  through to the leftmost lane, which is a guess. `intakeLane`'s fallback stays so nothing throws;
  the warning is what makes the guess visible.
- `mcp-endpoint.ts` `TOOLS`: drop `accept_task` and `decompose_task`, add `submit_card` and
  `make_card`. `mcp-prompts.ts` — `submit_work` is written entirely around `submitTask` and needs
  rewriting; `start_project` and `kanban_guide` both describe the refine→accept→decompose flow.
- `README.md`'s task/card distinction and `AGENTS.md`'s "**A task is not a card, and the
  distinction is the point**" both describe the flow being removed.

> **`feat!:`** — `acceptTask`, `decomposeTask` and `submitTask` leave the schema, and `tasks.status`
> with them.

# Phase 4 — Dependencies you can see and pick

**Two real bugs first.** An archived dependency is invisible to the dialog (the board query filters
`archivedAt`) and is therefore **silently dropped on the next save**; and cycle errors surface as a
toast *after* the card write has already committed (`card-dialog.tsx:126-138`).

- New `CardDeps` query fetching a card's *actual* deps (including archived) plus the reverse
  direction, via the new `cardDeps.dependsOn` / `cards.blocks` relations. **Not** on the `Board`
  query — that polls every 3s over up to 500 cards.
- Reorder the dialog's writes so `setCardDeps` runs **before** `UpdateCard`; a refused ordering
  then leaves nothing written.
- Port `wouldCycle` to `src/lib/cards.ts` so a looping row renders disabled rather than erroring
  after save — the same client/server-agree-by-construction bargain `src/lib/board-order.ts`
  strikes, and it wants the same kind of test.
- New `src/components/card-deps-field.tsx` replacing the 60-`Switch` list: selected deps as
  removable chips **above** the list (hoisting without moving rows under the cursor), a search
  `Input` filtering title and lane, rows **grouped by lane** in board order showing each card's
  status, cycle rows disabled, render capped at ~50 with "…and N more". Archived deps carry an
  `(archived)` marker — the state that used to vanish becomes the most visible thing in the field.
- **No `cmdk`, no virtualization, no combobox.** `radix-ui@^1.6.7` already bundles Checkbox and
  Popover if wanted, so nothing new enters `package.json`.
- The reverse direction is **read-only** and lives in the dialog, not on the board card — editing
  another card's dependencies from inside this one is a change with no visible cause.

---

## Verification

Per commit: `npm run lint && npm run typecheck && npm test`. Schema commits also
`npm run db:generate` + commit `drizzle/`, then `npm run codegen` + commit `schema.graphql` and
`src/gql/graphql.ts` — CI diffs both.

**End to end, on a real board** (`npm run dev`, project with `autoRun` on):

1. A card fails review → shows **`rejected`**, not `error`, in its own colour; its dialog shows
   `REJECTED Review → Doing` with the reviewer's note; the next executor's prompt contains that
   note and **not** any crash text.
2. Kill the endpoint mid-run → the card shows **`error`**, and the crash text does **not** reach
   the next agent.
3. A card that **passes** review keeps the reviewer's note in its history. (Today it vanishes.)
4. Drag a card by hand with a note → the ledger records it against **you**, not an agent.
5. Restart the server mid-run → `reconcile` leaves `error`, verdict `none`, no ledger entry — a
   restart is nobody's ruling.
6. A card with an unfinished dependency is skipped and its dialog names what it waits on; finish
   the dependency and it runs **without anything having rewritten a stored status**.
7. Phase 2: **one** agent, three lanes of three different kinds, all working — proving a role and
   an agent only meet at a lane. Then "New lane ▸ Review" arrives pre-wired to judge without
   anyone ticking a box, and editing the Review role's prompt changes every Review lane at once.
8. Phase 3: a chat ends with "Make cards" → one card in Intake → the Intake station expands it into
   children in Backlog, each carrying `parentId`, with the parent archived and its ledger showing
   why. Then delete the intake lane's role and confirm the board **warns** rather than silently
   dropping work at the leftmost column.
