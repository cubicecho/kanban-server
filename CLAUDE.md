# AGENTS.md — kanban-server

A kanban board that works itself. A **project** is a body of work; its **lanes** are the
board's columns, and a lane that names a **role** and an **agent** is a station — cards there get
worked and then moved on. A role is a *kind of lane*: a prompt and the shape of the answer it
expects. An agent is only a model endpoint. A **task** is a conversation about what a person
wants, in their own words, refined over a **message** thread; its one exit is a **card**, and a
station whose role is to expand turns that one card into the many that carry the work out. Cards
are the units an agent executes. Every time an agent is asked to do anything — refine a task, or
work a card — that is one **run**. The same API is served three ways
from one process: GraphQL at `/graphql`, MCP tools at `/mcp`, and the built React app on
everything else.

Read [`README.md`](README.md) first — it holds the design decisions this file only summarises.

Single package, no workspaces: `server/` (Express 5 + graphql-yoga + Drizzle), `web/` (Vite +
React 19 + TanStack Router/Query + shadcn), `shared/`, `tests/` (Vitest).

## Commands

```bash
# Dev
npm run dev              # express on :8788 + vite on :3001, concurrently
npm run dev:server       # tsx watch server/index.ts
npm run dev:web          # vite only (proxies /graphql to :8788)

# Quality — run all three before every commit; CI fails otherwise
npm run lint             # biome check (use `npx biome ci .` for the read-only form)
npm run format           # biome check --write
npm run typecheck        # tsc --noEmit
npm test                 # vitest run

# Schema and types
npm run schema           # prints the runtime schema to schema.graphql
npm run codegen          # schema, then graphql-codegen into web/__generated__/graphql/
npm run db:generate      # drizzle-kit, after a change to server/db/schema.ts
npm run db:migrate       # apply drizzle/ by hand; the server does this on boot anyway
npm run db:studio

# Build / run
npm run build            # typecheck (regenerates first), then vite build into dist/
npm start                # NODE_ENV=production tsx server/index.ts
docker compose up --build
```

## Tech stack

| Choice | Why |
| --- | --- |
| **Postgres + Drizzle** | One dialect everywhere. With no `DATABASE_URL` the server runs PGlite — postgres as WebAssembly, in-process, against `data/` — so a clone and the tests need no database of their own; set the variable and it is a `pg` pool instead. Same SQL, same types, either way |
| **`@vantreeseba/drizzle-graphql`** | The API is generated from the tables — a new column is queryable as soon as it exists. Hand-written fields fill what CRUD cannot say |
| **graphql-yoga** | Serves the query API and the `runEvents` subscription as SSE, which the browser reads with a plain `EventSource` |
| **`@cubicecho/graphql-mcp`** | Projects the same schema as MCP tools. `server/mcp-endpoint.ts` curates which ones — see below |
| **`@cubicecho/agent-core`** | The endpoint-agnostic half of the agent loop, extracted from this server and two others that had each written it separately: `runTurn` and its retries, `tool-loading`, `schema-compat`, the run event bus, `getClient`/`listModels`/`contextLimitFor`, `parseJson`. `server/runner/agent.ts` is what is left — the parts that are about a kanban board |
| **`@cubicecho/agent-mcp-pool`** | The MCP connections, likewise. `server/runner/mcp.ts` is one `new McpPool({ load, clientName, clientVersion })` — where the rows come from, and how this process introduces itself, are the only parts of it this server owns |
| **Node type stripping** | The container runs `node server/index.ts`; `tsx` is a devDependency and is not in the image. Nothing under `server/` may use syntax that survives erasure — no enums, no parameter properties |
| **Biome** | One formatter and linter. `noExplicitAny` and `noNonNullAssertion` are errors here, not warnings |

## Key conventions

**Relative imports carry the `.ts`/`.tsx` extension.** Both tsx and Node's type stripping
require it, and `allowImportingTsExtensions` is on for that reason.

**The schema is the contract, and it is generated.** Add a column to `server/db/schema.ts` and
the typed documents in `web/graphql/*.graphql` see it. Never hand-write a type that codegen
produces, and never edit `web/__generated__/graphql/index.ts` — biome ignores that folder, and
git does not track it at all.

`npm run codegen` does it explicitly, but under `npm run dev` you should not need to: the
server rewrites `schema.graphql` on boot and regenerates with it when the SDL moved, and vite
runs codegen off its own watcher for the documents. Both are dev-only — `@graphql-codegen/cli`
is a devDependency and `server/dev/codegen.ts` is behind a `NODE_ENV !== "production"` guard,
because the image has neither codegen nor the sources it would write.

**The types are generated, not kept.** `web/__generated__/` is in `.gitignore`: it is a pure
function of `schema.graphql` and the documents, both of which are tracked, and a generated file
in a diff is a review nobody reads and a merge conflict everybody resolves the same way. So the
three scripts that read it regenerate it first — `typecheck` runs codegen, `test` runs codegen,
and `build` runs `typecheck` — and a fresh clone can go straight to any of them. `schema.graphql`
stays committed, because that one *is* the API and a column added without codegen should show up
as a change to it; CI regenerates it and diffs.

**A schema change is an edit and a generate.** Change `server/db/schema.ts`, then run
`npm run db:generate` and commit what lands in `drizzle/` — the SQL and the snapshot both.
`server/db/migrate.ts` applies that folder on boot, against PGlite or a `pg` pool alike, so
nothing hand-writes DDL. Never edit a migration that has shipped; generate another.

**Only `client.ts` knows which postgres this is.** It reads `DATABASE_URL` and opens either a
`pg` pool or a PGlite instance, and hands out one `db` under one set of types. Nothing above
`server/db/` should branch on it.

It also creates the database when the server it reaches has not got one, so a shared postgres is
one variable rather than a variable and a `CREATE DATABASE` run by hand. `ensureDatabase` is the
first thing `ensureSchema` does and is a no-op on PGlite, which is how `migrate.ts` stays out of
the branch. The trigger is a `3D000` off the pool's first query — the connection the migrations
wanted anyway — so the happy path needs no rights on `postgres` or `template1` at all; a racing
peer's `42P04` counts as success, and a role without `CREATEDB` gets the statement to run rather
than a driver stack. `KANBAN_SERVER_CREATE_DATABASE=0` in `paths.ts` turns it off.

It also claims the data directory, because PGlite does not: two processes on one directory both
open it and then stop seeing each other's writes. A pid in `<store>.lock` refuses the second
one, takes over a lock whose holder is gone, and does nothing at all for a `postgres://` URL or
`memory://`. It cannot see across a pid namespace, so a container sharing the bind-mounted
`./data` with a host process is still on its own — that case is what `DATABASE_URL` is for.

**A task is not a card, and the distinction is the point.** A task is the unit a person thinks
in; a card is the unit an agent executes; the `expand` contract exists because those two are
different sizes. A task is a conversation and has no state of its own — no status, no error, no
pipeline — because whether it ever became work is `cards.taskId`, which already points the right
way; storing it a second time is how `blocked` and `readVerdict` went stale. `makeCard` is its
one exit and writes exactly one card at the front door; `submitCard` is the same door for a
caller with no conversation behind it, and the door is where a lane says `intake`, else the
leftmost lane. What becomes of that card is the board's business rather than the submitter's:
neither mutation runs an agent, and a front door that is not a station is a card sitting in a
column, which is a board somebody drew that way.

**Breaking work up is a station, not a stage.** A lane whose role's contract is `expand` reads
one card and writes the cards it becomes down its *pass* arrow, each carrying `parentId`, and
archives the one it read — the parent is not a card anybody works, and leaving it on the board
would say otherwise. `writeCards` is shared with nothing else now but is still its own function,
because the half worth keeping is resolving `dependsOn` by title within the batch: a title outside
the batch is dropped rather than failing it, on the same principle a board template's missing
`agentId` resolves to none. Two run-time guards, both the class of the rework guard: an `expand`
lane with no pass arrow is refused before it runs, its children having nowhere to land, and an
expansion nobody could read a card out of is an `error` rather than an empty success — a card the
agent could not break up is exactly the case a person needs told about.

**A lane is a station, and the board is the pipeline.** `roleId` says what kind of lane it is
and `prompt` is anything this board adds to that; `agentId` says which model works the cards
there; `onSuccessLaneId` and `onFailureLaneId` say where they go afterwards, or
`archiveOnSuccess` takes what passes off the board instead — the two are answers to one question
and the archive is the one that is read; `wipLimit`
caps how many run at once; `maxAttempts` is how many failures it will put back in play before
stopping. That is the whole of the automation — there is no workflow engine, and the shape of the
pipeline is the shape of the board someone drew. A lane with no role or no agent is a resting
place, which is what a backlog and a done pile are.

**A role is a kind of lane; an agent is a model. They meet only at a lane.** Neither table
references the other. `roles` is a table, not an enum, because the useful kinds are not knowable
from here — a tester, a security reviewer, a technical writer are each a paragraph of instruction
and none should need a migration. What cannot be invented is `contract`, the shape of the answer:
`work` reports on the card, `verdict` rules `PASS`/`FAIL` on it, `expand` breaks it into more
cards. That is the only part of a role anything reads, and `seedLanes` finds the three it draws
by contract rather than by name, a name being a thing somebody edits.

The prompt a run starts with is composed by `systemPromptFor`, in layers: the project's context
says where you are, the agent's `systemPrompt` says who it is, the role's `prompt` says what
happens here, and the lane's own `prompt` adds whatever is true of this board only. The lane
speaks last, and a composition of the lower three that comes out empty is refused at run time —
which is the one guard replacing both a `notNull` on the agent and the worry about a run starting
with an empty system message. The project's background is asked for separately so that it cannot
satisfy that guard: a system prompt made only of background is a lane with no job. Editing what
every Review lane is told is one edit rather than one per board, which is why a lane points at a
role instead of carrying a copy of its prompt.

`projectContext` is standing context and lives in that first layer alone. `cardPrompt` says what
to do and never where — the same paragraph in both would be sent twice on every run of the board,
and it is what the on-demand tool preselector reads to guess which tools a card needs.

Refining has no contract, because refinement is not something a lane does — it is a conversation
with a person, and there is no card for it to happen to. Its prompt is `settings.refinePrompt`
(empty meaning `REFINE_SYSTEM`), and `resolveRefineAgent` reads the project's agent, else
Settings', else the first enabled agent by name. It is the only agent named anywhere but a lane,
and the only one that has to be, which is the whole of what "off the board" now means.

**The optimistic board and the server agree by construction.** A drop rewrites the board cache
before the request goes out, and `web/lib/board-order.ts` holds the pure functions that decide
where a card lands and how its lane renumbers — the same arithmetic `moveCard` does.
`tests/board-order.test.ts` runs the real mutation and compares, because the failure mode of a
disagreement is a card that moves twice: once where it was dropped, once when the refetch lands.
Dragging is by a handle, not the whole card: a card carries eight buttons, and a keyboard drag
listener on the card would take the space bar off all of them.

`laneOrder` is the third of those functions and the one that is a view rather than arithmetic: a
running card is drawn at the top of its lane, in green, because it is the one thing on a board
that is happening rather than waiting. It does not renumber anything — a run that reordered its
lane would shuffle every other card twice, once each way — and it is safe against the drag
arithmetic only because a running card is not a drop target, so nothing is ever dropped onto the
card whose drawn place and `position` disagree.

**A dependency you cannot see is a dependency you will lose.** The `Board` query filters archived
cards out, so a card's `deps` as the board carries them are only the visible half — and a dialog
seeded from that half writes the short list back on the next save, quietly forgetting whichever
dependency got archived. `CardDeps` in `web/graphql/board.graphql` asks for one card's real edges,
archived ones included, and `card-dialog.tsx` holds the picker empty until that answer lands rather
than seeding from the board and correcting itself: the window between the two is a save that drops
work. It is its own query rather than a field on `Board` because `Board` polls every three seconds
over as many as five hundred cards, and this is one card's answer, wanted once, when a dialog
opens. The reverse direction — what waits on *this* card — comes back with it and is drawn
read-only: editing another card's list from inside this one is a change with no visible cause.

`cyclingCards` in `web/lib/cards.ts` is the same bargain `board-order.ts` strikes, in the other
direction: it walks the board's edges to find the cards that already lead back to this one, and the
picker draws those rows disabled with the reason on them. `setCardDeps` stays the authority — it
reads every card in the project, archived ones included, and names the loop — so the two can only
differ on a chain running through an archived card the board's graph does not carry, which is a row
offered and then refused rather than one refused and then allowed. `tests/card-deps.test.ts` asks
both of them about the same board card for card. The dialog writes `setCardDeps` **before**
`updateCard` for the same reason: a refusal after the card is written leaves half the dialog saved.

**A board template stores indexes, not ids.** `saveBoardTemplate` snapshots a project's lanes
into `board_templates.lanes`, turning `onSuccessLaneId`/`onFailureLaneId` into positions in the
template's own list — a lane id belongs to one project and means nothing in another. Applying
one writes the lanes first and the arrows second, in a single transaction, which is the same
two steps `seedLanes` takes and for the same reason. An `agentId` that no longer exists
resolves to none rather than failing, and a `roleId` is treated exactly the same way: a template
is a shape, and the agents and the roles are whoever happens to be on this server. `prompt` is
read back with `?? ""` and `maxAttempts` with `?? 0`, because a template saved before a lane
carried its own job or spent attempts has no such key, and a lane that says it adds nothing adds
nothing. Applying is refused on a board with cards, because deleting a lane takes its cards
with it.

**`done` means nothing further will happen.** A card that passes into a lane that has an agent
of its own is not finished — it is waiting for that lane's turn — so it goes back to `idle`,
because `readyCards` only picks up `idle`. `done` is for a card that stayed put, or landed
where no agent runs. A card a reviewer rejected stays `rejected` unless the rejecting station has
a budget left to spend on it, so the Doing↔Review loop cannot spin on its own; `retryCard` is the
way back by hand, and puts the card back in play where it stands.

**The rework loop is a budget, and the budget is the lane's.** `lanes.maxAttempts` is how many
times a station will put a card it failed back in play; `cards.attempts` counts the failures
against it. Zero — the default, and what every board did before this — stops at the first
failure and waits for a person. The budget belongs to the lane that *failed* the card rather
than the one it goes back to, because how many times a thing is worth rejecting is the judging
station's call. `attempts` is not reset by a pass: a Doing↔Review loop that refilled its budget
every time round would never terminate. Only a person resets it — `retryCard` and `moveCard`,
both being somebody deciding to start the card over. A stopped run and a restart cost nothing
and move nothing, being nobody's verdict on the work: a called-off review leaves the card in
Review rather than dropping it down the failure arm as though it had been turned down. Rework needs the landing lane to have an agent, or an `idle`
card in a resting place would just be lost; the passing arm still asks after the *success* lane's
agent, since a card that passes with nowhere to go must not re-run where it stands.

**Everything said about a card is a note, and there is one place for them.** `card_notes` holds
three kinds — `report`, what an agent made of the card when it worked it; `verdict`, a judging
station's ruling; and `note`, something a person wants taken into account. These were three
separate things: a `cards.result` column each run overwrote, a `card_events.note` string, and,
for a person, nothing at all. They are one table because they are one thing — what is known
about this card that is not the card — and because a column holding only the most recent one
could not be the list the next agent is handed.

`kind` is what each is *for*, and only `note` is anybody's to write, edit or take back:
`addCardNote`, `updateCardNote` and `deleteCardNote` refuse the other two, and `features` keeps
the table out of generated CRUD entirely. A report and a verdict are an account of what
happened, and an account anybody may correct afterwards is worth no more than none — the same
argument the ledger is read-only on. `author` is stored rather than worked out from `runId`,
because `runRetentionDays` empties that and a pruned agent's report must not start reading as
somebody's own words.

**An artifact is a record, not a copy.** `artifacts` says that a card's work put something
somewhere — a file through a filesystem server, a page on a wiki, an object on a NAS — and how:
`serverSlug`, `serverLabel`, `transport` and `tool` are snapshots of the server it went through,
stored rather than joined for the same reason `card_notes.author` is, since a server row edited or
deleted must not rewrite how a thing was stored. Nothing here reads the thing back, and nothing
could promise to: a location on somebody's NAS is not a path this process can open.

There are three ways a row arrives, and `source` says which. `detected` is the runner reading a
successful MCP call whose tool name starts with a write verb and whose arguments name a location
(`detectArtifact` in `server/runner/artifacts.ts`, pure); `declared` is the agent calling the
built-in `record_artifact` tool, offered only on a card run with MCP tools to write with; `client`
is `recordArtifact` over GraphQL or `/mcp`. `server/db/artifacts.ts` is the one writer, and it
folds repeats within a run by location, so a write followed by a declaration is one row carrying
both the size and the title — while a second pass round a rework loop is a second row, each pass
being something that happened. Rows are written as the calls land rather than when the run
finishes, so a stopped or crashed run keeps what it had already made, and a sink that fails is a
notice rather than a failed run. `features` keeps the table out of generated writes, and no one —
operator included — can edit or delete a row through the API.

**A verdict is not an account of the work.** A station whose role has the `verdict` contract
writes a `verdict` note rather than another `report` — overwriting the executor's account with
the word `PASS` would lose the one thing the next agent round the loop has to read. That note is
also what the *move* it caused points at, through `card_events.noteId`, and `cardPrompt` appends
it as "Why this came back", because a second attempt without the reason for the first is the
first attempt again. A pass records its reasons the same way: why a card was let through
outlives the run that said so. The move points at the note rather than copying it, which is what
stops a verdict existing twice and the two drifting.

A person's notes arrive under their own heading, "Notes on this card". A rejection explains one
move and stops applying once the card is sent on; a note stands until it is taken back. An
expansion writes no note at all — its answer is the cards it became, and the JSON it arrived as
is not something anybody would want read back — and neither does a card archived on its way out
of a lane that archives, the ledger row being the whole of what happened.

**A rejection is not an error, and neither is a wait.** `cards.status` has five values and they
divide the ways a card can be stopped by what a person has to do about it: `rejected` is a
reviewer saying no, which wants a decision, and `error` is something that broke — a crash, a
timeout, a run a restart interrupted — which wants looking at. `cards.error` therefore holds
faults and only faults, and `cardPrompt` deliberately does not read it: handing an agent a stack
trace under the heading "why this came back" was how a reset connection came to read as a review.

There is no `blocked`. A card waiting on a dependency is `idle`, and `blockers` works out what it
waits on when it is asked. The stored answer was written once and never revisited, so a card sat
saying "waiting on X" long after X was done — the same staleness `lanes.readVerdict` had as a
second place to say a thing the rows already knew. Nothing stores what the rows around it say.

**A card's history is a ledger of its moves.** `card_events` records every move a card makes —
from, to, who, and the note that explains it — because "why is this card here?" is a question
about the move that brought it, not about the card. A column on the card could only ever hold
the most recent reason and lost the one before it; the ledger also catches a person dragging a
card back, which no run ever records. `server/db/history.ts` is the only writer for both tables:
`recordMove` takes the transaction it belongs to, so a card that moved and the row saying so
commit together, and it writes the note through `addNote` unless handed a `noteId` that already
exists. `lastMoveNote` reads backwards from the newest event and stops at the one that brought
the card to this lane — anything older happened somewhere else — skipping note-less events on
the way, so a person hitting retry does not quietly delete the reason the card came back.
`saidAbout` is the other half: the newest report and every standing note, which is what
`cardPrompt` is given. Moving a card onwards is
what clears a rejection, which is what stops it following the card around the board for good.

The ledger is written by hand rather than generated, and `features` refuses insert, update and
delete on it through GraphQL: its whole worth is that it is an account nobody edited. Nothing
prunes it either — it is small, and it is the durable answer to a question the runs behind it
stop being able to answer as soon as `runRetentionDays` deletes them.

`runs.verdict` carries the same ruling on the run that made it, because a judging station whose
failure arm goes nowhere moves nothing and would otherwise leave no trace of having ruled. A run
that crashed has `none`: a reviewer whose connection dropped ruled on nothing, whatever half a
sentence made it out before the stream died.

**A restart puts back what it interrupted.** `inFlight` is memory, so a process that dies leaves
`running` rows that nothing will ever finish: a run `runRetentionDays` will not prune and `spend`
keeps counting, and a card that holds a place against its lane's WIP limit for good. `reconcile()`
in `server/runner/run.ts` runs once from `server/index.ts` after `ensureSchema`, and closes
whatever this process does not genuinely have in flight — runs to `error`, cards back to `idle`.
A conversation is not something a restart can interrupt, so there is nothing to put back on a
task. `error` rather than `stopped`: nobody called these off. It costs a card no attempt, and writes nothing to
the ledger — a restart is not a ruling, and the story of a card is what became of it rather than
what the process it was running in did.

**Archiving is off the board, not gone, and it is not a status.** `cards.archivedAt` is a
timestamp rather than a flag because an archive is a list and a list wants an order; it is kept
apart from `status` because a card is archived whether it finished, failed or was never picked
up, and folding the two together would lose the outcome it is being archived with. An archived
card keeps its `laneId` — that is where `restoreCard` puts it back, at the end of the lane,
since the position it had has long been taken. Everything that reads the board filters it out:
the `Board` query, `readyCards`, and `blockers`, where an archived card counts as no longer in
the way — otherwise a dependent waits forever on a card nobody can find. `moveCard`,
`runCard` and `retryCard` refuse one outright. Deleting a lane is refused while it holds archived cards, because
the cascade would take them with it and the board cannot show they are there: the guard that
matters is the one for what you cannot see.

**A review verdict is a property of the output, not of the run — and reading one is a property
of the lane.** A reviewer that answers `FAIL` has still run fine, so the run is `ok` and the card
is what fails. Ambiguity counts as a pass: a mumbling reviewer must not be able to wedge a board.
The lane's role is what decides whether that first word is read at all, because judging is
something a station does: the same agent can work cards in Doing and rule on them in Review, and
a board may have two reviewing stations or none. Nothing in a card run knows anything about the
agent beyond which endpoint it is.

**Automation is opt-in per project.** `projects.autoRun` gates the worker; `server/worker/loop.ts`
polls rather than waking on writes, because the things that make a card runnable are not all
writes — a dependency finishing, an agent switched back on, a run stopped. The switch is in the
frame, not in project settings: `Page` takes the project rather than a `crumb` string, and a page
that passes one gets `ProjectBar` under its heading — the auto-run switch, what is in flight, and
what the board has spent. Settings is for what is decided once, and stopping a board that has got
the wrong end of the stick is not that. The strip is outside the scroll container with the
heading, so the way to stop a board is on screen at the bottom of five hundred cards as well as
at the top. The switch wears its state in the badge tones — green and pulsing on auto, amber and
paused — rather than in a grey `text-xs` word on a grey strip, and `toneSurface` in
`status-badge.tsx` is where it gets those two colours from, a control not being something a
`h-5 overflow-hidden` badge can hold. Amber for paused on purpose: a stopped board is the state
worth noticing, being the one where nothing will happen until somebody says so.

**Hand-written GraphQL fields go in `server/graphql/`**, beside the generated entities:
`models`, `mcpStatus`, `runEvents`, `blockers`, `spend` on the query side; `refineTask`,
`makeCard`, `submitCard`, `runCard`, `stopCard`, `stopTask`, `moveCard`, `retryCard`,
`archiveCard`, `restoreCard`, `setCardDeps`, `recordArtifact`, `addCardNote`, `updateCardNote`, `deleteCardNote`,
`setAgentServers`,
`testMcpServer`, `reconnectMcp`, `setApiKey`, `setAgentApiKey` on the mutation side. Give every
one of them a `description` — it is what an agent on `/mcp` reads to decide whether to call it.

**Writes go through `onWrite` hooks.** Creating a project seeds its five lanes and their
success/failure wiring in the same transaction (`payload.tx`); a created card gets the first row
of its ledger; and an edited MCP server reconciles the connection pool without a restart. That
hook reads the card's lane back from the database rather than off the rows it is handed, which
carry only the columns the caller selected — a client asking for `{ id }` would otherwise record
a card arriving nowhere. A write that should change either of those
belongs in a hook, not in a route handler.

**The API key is never readable.** `exclude.columns` drops `apiKey` from both `settings` and
`agents`, so there is no field to select; `setApiKey` and `setAgentApiKey` are write-only. Two
tests hold that line.

**The `/mcp` surface is curated, not the whole schema — and the curation is a listing, not
a lock.** What an agent may reach is `permissions.ts`, below. `server/mcp-endpoint.ts` lists the
thirty-eight tools an outside client gets. Nothing that empties a table in one call, nothing that
reads or writes the API key, and no editing of agents, roles or MCP servers — a visiting client can
see which agents and roles exist, because a lane points at each, but which model runs where and on
whose key is the operator's business. A new tool goes in that list deliberately,
with a `HINTS` entry if the generated description does not say enough. The driver renames after
it filters, so the `include` list names GraphQL fields in camelCase while `HINTS` — and the
client — sees the snake_case tool name: `Mutation.createProject` is the tool `create_project`.

**Prompts are the room a `HINTS` line has not got.** `server/mcp-prompts.ts` holds four —
`kanban_guide`, the orientation an agent should read before its first call, and three jobs of work
(`start_project`, `submit_work`, `triage_board`) written as instructions naming the tools in the
order they actually go. They are registered through `decorateServer`, which runs on each server
`createHttpHandler` mints and *before* it is connected — the one window there is, since the SDK
declares `capabilities.prompts` on the first registration and refuses to declare one after a
transport is attached, so a server that registered late would answer `prompts/list` having told
the client at `initialize` that it had none. This file used to write out `createHttpHandler`'s
stateless path by hand for exactly that reason, the driver handing its server to nobody;
cubicecho/graphql-mcp#20 landed as the hook and the fork went with it. A prompt taking no
arguments is still registered with no `argsSchema` rather than an empty one, which is what it
means — that it was also once the only callable shape is now `connectServer`'s problem, and it
disarms `prompts/get` alongside `tools/call`.

**The tool listing has a size test, and it is not incidental.** The generated relation filters
recurse between tables, and written out as JSON Schema rather than named as SDL they would make
the listing enormous — more than a model will read, and it arrives before any call. graphql-mcp
builds each input type once so the repeats become `$ref`s. `tests/mcp-endpoint.test.ts` holds
every tool under 100 kB and the listing under 1 MB — ~75 kB and ~935 kB as it stands, down from
~88 kB and ~1.1 MB before drizzle-graphql 12, which gives each column type only the operators it
can use rather than one filter shape for every column. The bounds sit above the real figure on
purpose: it is the driver's to move, and what the test is for is the order of magnitude.
Anything added here that grows it needs to answer to that test rather than raise the bound.
A new query tool costs the better part of 75 kB whatever its own shape, and a `many` relation
back to a new table from `cards`, `runs` or `projects` costs another 80 kB across every tool that
reaches them — which is why `artifacts` points at its card and run and nothing points back.

The same test file reaches a tool's `where` through `$ref`s and null branches rather than
reading its layout, because that layout is the conversion of the week and has changed under us
without the surface changing at all — and it asserts the operators a column offers, since a
timestamp advertising `ilike` is bytes an agent reads past on every column of every tool.

**The seam is a shape, not a config type.** Both packages were this server's own files, copied
into `task_server` and `min-agent` until the three had drifted; what made them uncopiable was one
line each, an `import { db }` and a config type. So neither package imports a type from a
consumer: every function takes the narrowest shape it reads — `Endpoint`, `McpServerConfig` —
which `Resolved` and an `mcp_servers` row satisfy structurally without being named anywhere, and
the pool asks for its rows through `options.load` rather than reaching for a database.

**The pool's debounce is what a write hook needs.** `syncSoon()` waits past the transaction the
hook runs inside, where `sync()` read the table as it stood *before* the edit it was reacting to
and folded nothing; it also folds a batch of edits into one reconnect rather than a child process
each. `mcpStatus` calls `flush()` first, because "add a server" and "did it connect?" arrive
milliseconds apart and the answer must not predate the write. `undefined` scope means every
connected server and an *empty* scope means none of them: an agent with no servers linked to it
wants the second, so the two must not collapse.

**What goes ahead of the card holds still, because a prompt cache keeps only a prefix.** The
system prompt is the lane's and the tool array is the agent's, and neither may depend on which card
is running, when, or on anything a write to another table happens to reorder; the card, its notes
and hook `<context>` go on the user message behind them. The pool keeps its servers in the order
`load` hands them over, and that order is the tool array's and an on-demand catalogue's, so `load`
reads `mcp_servers` by slug — unordered, an edit to one server's timeout moved its tools to the end
of every request on the board. `tests/prompt-cache.test.ts` holds two cards in a lane to the same
prefix, each turn of a run to an append, and both through an edited server.

**A connection cost belongs to the server, not to the pool.** `mcp_servers.cwd` and
`mcp_servers.connectTimeoutMs` are both nullable, and null is the pool's own answer — this
process's directory, and whatever bound the pool was built with. They are columns rather than
`McpPool` options because neither is one number for every server: several stdio servers resolve a
relative path against their cwd rather than against an argument, and a local `node` child answers
the handshake in milliseconds where `uvx some-server@latest` on a cold cache downloads a package
first, so a pool-wide timeout has to be the slowest server's and leaves the quick ones unbounded.
`mcp.ts` is untouched by either — the rows go through `load` — and the only code that had to
know is `testMcpServer`, which passes both to `mcp.probe` so the button dials the way the pool
will; a probe that ignored the row's patience would report a working server as broken.

`mcp_servers.callTimeoutMs` is the same argument for one tool call — a filesystem read and a
research server that thinks for minutes cannot share a number either — and needs even less: the
pool reads it at call time, so an edit applies to the next call without a reconnect, and
`testMcpServer` does not pass it, a probe listing tools and calling none. Null there is the MCP
SDK's own minute, the pool being built with no `callTimeoutMs` of its own. The form writes an
empty box and a `0` back as null for both timeouts, because the pool reads 0 as a server given
no time at all rather than as one given the default — the numeric knobs here that are not the
agents' `0` sentinel, since the columns themselves are nullable.

**Hooks are the pool's, and what a session is is ours.** `mcp_servers.hooks` and `hiddenTools`
are agent-mcp-pool rows, the same shape min-agent keeps; `server/runner/hooks.ts` is the half
that says a card or a task is the session and each run a turn of it. Assembling the `<context>`
blocks, capping them and writing the notes are agent-core's `gather`, `notify` and `withContext`,
handed `mcp.runHooks` as the runner; what `hooks.ts` adds is the agent's scope, the preface —
agent-core's speaks of a user's message, and nobody on a board sent one — and the run's events. `execute` in `run.ts` fires
`sessionStart` (a subject's first run, counted from `runs`) and `beforeTurn` inside its try on the
run's own signal, and hands their `<context>` to `runAgent` as `context`, which goes on the user
message rather than the system prompt — the system prompt is a lane's, shared by every card, and a
prompt cache keeps it only while it does not change per card. `afterTurn` and `sessionEnd` are not
awaited: a memory server filing a card is no reason to hold it `running`, and `hooksSettled()` is
how a test waits for them. `sessionDelete` is fired from the `cards`, `tasks` and `projects` write
hooks, the last reading the doomed ids in `before` since the cascade leaves `after` nothing to
read. A hook never fails a run; what it did lands in `runs.hooks`. What the model was opened with as a whole — the system message and the first user
message, `<context>` blocks and all — lands in `runs.prompt` through `runAgent`'s `onPrompt`, taken
off the first request as it goes rather than rebuilt, and is said live as a `prompt` notice that
`RunStream` draws above everything else. `shared/hooks.ts` copies the
pool's variable table for the web and re-exports agent-core's `HookNote` as a type, the pool being a server package, and `tests/hooks.test.ts`
compares the copy against `hookVars` — edit both together.

**Both packages come from npm, and the two forms before it are worth remembering.** They started
as `file:../` links to sibling checkouts, which the Docker build cannot see at all — a sibling is
outside the build context, so `npm ci` could not find it and there was no image. A git URL fixed
that and cost the image `git`, which the `node:*-slim` base has not got and which both stages had
to install. A registry range is the end of both problems: a tarball npm already knows how to
fetch, something a bot can watch, and a Dockerfile with nothing in it about either package.

agent-core's `openai` is a peer dependency, and a registry install is why that settles itself: one
flattened copy for all three. The `file:` links did not — a linked sibling brought its own, and
two copies of a class with a `#private` field are two nominal types, so an `OpenAI` the package
built was not an `OpenAI` to us. That wanted a `paths` entry in `tsconfig.json` to force one
resolution; it went with the links that needed it.

**The LLM call retries only before the model has spoken.** `runTurn` in `@cubicecho/agent-core`
owns the retry loop, not the OpenAI SDK, whose own retries are off: once a chunk has arrived the
turn is unrepeatable, so a failure after that propagates. `requestTimeoutSeconds` is a silence
watchdog that rearms on every chunk, not a deadline on the request. `agent.ts` hands it a
`request(supported, byModel)` builder rather than one request, because the capability negotiation
is the inner half of that loop — `capabilitiesFor(baseUrl, apiKey)` latches what an endpoint turned out to
accept, per endpoint — the URL and the key together — rather than per process, so a second endpoint does not inherit the first
one's refusals. What `agent.ts` keeps of the old loop is the `ContextOverflow` it throws when the
endpoint's own refusal comes back, since the wording that names both numbers is this server's —
`runTurn` will size a request itself if handed a `contextLimit`, and is deliberately not, because
the guard here is the one that says where its figure came from.

**A refusal about the model is not a refusal about the endpoint.** `strictSchemas` and
`usageInStream` are facts about a server; a ceiling spelled `max_completion_tokens` and a
temperature that is not ours to pick are facts about one model on it. They cannot latch together,
because one API key reaches every model a provider offers and the model is a dropdown on the agent
page: a flag on the endpoint would let the first run on whatever was picked last stop the next
model ever being sent a `max_tokens` it takes. So `runTurn` is given `model` and the builder's
second argument is `modelCapabilitiesFor(supports, model)`, keyed `(endpoint, model)` by hanging
off the endpoint's own. What is this server's to decide is which fields a refusal may take away:
a refused temperature is *dropped* rather than re-sent as the one value the model would accept,
since `config.temperature` is what the agent's page shows and answering with a different number
would make that reading a lie. The sizing call passes the same object, so the estimate is of the
body that actually goes. `tests/agent-resilience.test.ts` names a different model per test rather
than resetting the module's memory — that the memory is per model is the thing under test.

**agent-core prints nothing, and `notice` in `agent.ts` is where its words go.** `runTurn`,
`negotiate`, `ask` and `tryAsk` each report what they gave up on through an `onNotice` with no
default: a library that wrote to the console would be choosing for this server where operator text
goes, and there are two places for it here — the log, and the run event bus, so a person watching
an unexplained pause is told what caused it. Every one of those call sites is handed the same sink.

**The context window is asked for, overridable, and read before the request goes out.** The
OpenAI listing has no field for it, so agent-core's `listModels` takes whichever one a server adds
— `context_length`, `max_context_window`, `max_model_len`, `context_window`, `n_ctx` — off
`models.list()`, cached per endpoint because two endpoints are two different sets of models.
`contextLimitFor(config, declared)` answers with `declared` first and the listing second, and
`llm.ts` passes the agent's own `contextLength` as that figure: the package has no idea this
server keeps one, and the precedence is the caller's to state. A listing that fails is an unknown
window rather than a failed run: nothing here may stop a turn that would otherwise have worked.

The override is the point of the field, not a convenience. A server can report the window a model
was *built* with while serving it in a fraction of one — llama.cpp will load a 256k model at
`-c 16384` and go on listing it as 256k — and a run held to the honest-looking number fails at
the endpoint with somebody else's stack trace. So `agent.ts` refuses an over-large request before
it is sent, in a message that says what the request measured, what the window is, and *where that
figure came from*, since the whole difficulty of this failure is two numbers disagreeing.
`requestTokens` is agent-core's, and it is characters over four with the request's own JSON put
back — the keys only some messages carry, and one envelope per content part, because a transcript
a client appends block by block is mostly parts and charging each only its text ran short in
proportion to how finely the content was split. There is no tokenizer here and no prospect of
one, so it still runs low on tool schemas, which is the side to be wrong on — guessing high
refuses a run that would have worked, and guessing low leaves us exactly where we were.
`runTurn` recognises the endpoint's own refusal and raises it as a `ContextOverflow` in its words,
and `agent.ts` adds ours with the original as `cause`; either way it is a `ContextOverflow`, which `isTransient` will not retry, because the same request refused
again is the same refusal.

**Agents inherit from Settings by sentinel.** Every numeric knob treats `0` as "inherit",
except `temperature` and `maxRetries`, which use `-1` because `0` is a value someone may
genuinely want; empty strings inherit the same way, and `toolDiscovery` uses the word
`"inherit"` rather than an empty string, because a nameless enum member reads as a bug in the
API. `systemPrompt` inherits from nothing: it is the agent's own word about itself, expected
empty, and what to do comes from the lane. `server/runner/llm.ts` is the only place any of that
resolution happens.

**Run events are debugging output and are not persisted.** They live in an in-memory bus for a
minute after the run ends, folded so consecutive output tokens arrive as one entry. Anything
worth keeping goes in the run row.

**A run is watched by its id, and nothing on a page holds one.** A card, a task and the button
that started them all know the subject, not the run; `ActiveRuns` — `runs` filtered to
`status: running` for the project — is the join, and `RunStream` takes it from there. The board
and the refinement chat both go through it, so a run is watchable where it is happening.

**Authentication is optional and off by default.** `KANBAN_SERVER_TOKEN` unset is the server as
it always was; set, `server/auth.ts` puts `requireAuth` in front of `/graphql` and `/mcp`. Agents
send a bearer header; the browser trades the token for an `httpOnly` `SameSite=Strict` cookie at
`/api/auth`, because an `EventSource` cannot send headers and the run stream is one. Compare
tokens with `tokenMatches` — hashed, then `timingSafeEqual` — and never say more in a 401.

**One token is not one permission.** Both doors are behind the same secret, so `TOOLS` in
`mcp-endpoint.ts` was a listing and never a lock: a client that could call a curated tool could
post to `/graphql` and call `deleteCards` with no `where`. `server/graphql/permissions.ts` holds
the CASL rules that decide what a caller can *reach*, applied to the schema itself through
`applyPermissions` — which is what makes them true of both endpoints — and `schema.ts` exports
the wrapped schema so there is no unguarded path. There are two callers and no accounts:
`callerFor` in `auth.ts` says which, `/mcp` is always an agent, and a request nothing built a
context for is the operator, because that is the server executing its own schema.

The operator may do anything. An agent may run the board and not redraw it — no lanes, no agents,
no roles, no MCP servers, no settings row, and no deleting a project. Two rules bind both: every
bulk write is denied, and `updateCard` accepts only `title`, `body` and `acceptance`, since a
card's lane, position, status, attempts and archive date each have a door that renumbers the lane
and writes the ledger. `MUTATIONS` is a whitelist under `"*": deny`, so a generated write a new
table brings with it arrives shut. `tests/permissions.test.ts` holds all of it, and a fixture
wanting a card already failed writes the row through `setCardState` rather than through the
guarded field.

Reads are accepted except for three tables, and each of those is shut at four doors rather than
one — a generated schema offers a list, a single row, an aggregate and a group-by, and
`settingsGroupBy` answers with the same columns as `settings`. The rule also sits on the row
type, because `agents { servers { server { headers } } }` reaches an MCP server's credentials
from a table an agent may read; a rule on the type guards every field of it wherever it is
reached, which naming the query fields alone does not.

**Totals are read, never counted.** `spend` sums the run rows on every call, and reports the
oldest run it counted. A stored counter would keep climbing after `runRetentionDays` deleted the
runs behind it, and a total that cannot be checked against the rows is worse than none.

**Frontend:** shadcn primitives in `web/components/ui/` with no app logic; routes in
`web/routes/`; `@/` maps to `web/`. Every query goes through `request()` in `web/lib/gql.ts`
with a typed document — no raw `fetch` in a component — and every mutation invalidates the
query keys it affected.

**A thing the board has a word for is drawn by one component.** Between `ui/` and the routes sits
a layer of domain components, built out of the primitives and named after what they say rather
than how they look: `status-badge.tsx` (a card's status, a run's, a verdict), `live-dot.tsx`,
`meta-line.tsx`, `disclosure-row.tsx` — the openable row Runs, Tasks, Artifacts and the archive are all
lists of — `probe-result.tsx` and `show-more.tsx`. Every one of them replaced a copy per page,
and every one of those copies had drifted: a `running` card was green on the board and grey on
Runs, a card's status in Tasks was grey whatever it said, and the meta line under a title grew a
stray `·` wherever the middle of it was empty. There is one tone vocabulary — five tones and two
colours — in `status-badge.tsx`, and a page picks a tone rather than a Tailwind class. Anything
drawn in two places belongs here; anything drawn once belongs where it is drawn.

A row with nothing to open is shadcn's `Item` itself, which is what Agents, Roles and MCP are
lists of and what `disclosure-row.tsx` is built on, so the two line up down to the padding.
`query-state.tsx` is the ladder every one of those pages climbs before it draws a row: failed,
loading, empty. That last rung is why it is a component rather than three — six pages wrote the
empty check two different ways, `data?.roles.length === 0` where the query is read straight and
`shown.length === 0 && !isPending && !isError` where the list was already defaulted to `[]`, and
both being correct is exactly what stops anybody fixing it. `enable-switch.tsx` is the
on/off toggle Agents and MCP share, along with the two things about it worth remembering: a Radix
switch needs its name said outright, and the label names the action rather than the state.
`toastError` in `web/lib/toast.ts` is how a failed write is said — one line that was written
twenty-five times, seven of those as the same local `const onError` — and `nameList` in
`web/lib/text.ts` is the "and 2 more" that trails a list of what a delete is about to take.

`form-dialog.tsx` is the same argument taken as far as it goes: the seven dialogs on this server
differ in their fields and in nothing else, so the shell — the open/close wiring, the header, the
scrolling body, a footer with a ghost Cancel and a Save that says "Saving…" — is written once and
they pass what is theirs. `dirty` is asked for rather than worked out, because only the caller
knows what its fields are; `aside` is whatever sits at the far end of the footer and is what
splits it, being a second action (Test connection, Delete project) or a word about why Save is
refusing. What the shell is really for is the guard: six of the seven closed through
`useDiscardGuard` and the seventh, written before it existed, wired `onOpenChange` straight into
`onClose` and quietly lost a typed template name to a stray Escape. A guard a caller cannot see is
a guard a caller cannot forget.

**A label and its control are introduced by one component.** `form-field.tsx` — cubeui's, over
shadcn's `Field` — draws the label, the control, the description and the error, and mints the `id`
that ties them together. What it replaced was seventy-four hand-written `<div className="flex
flex-col gap-2">` blocks pairing a `<Label htmlFor>` with an input whose `id` matched by hand, and
the drift is what the count is for: the error was a `<p>` beside the box that nothing pointed at,
so a screen reader read the field's name and never said it had been rejected, and `aria-invalid`
— which is where the shadcn primitives get their red ring — was set on none of them. `useFieldError`
keeps only the timing it was written for, which is that a form does not tell you off for what you
have not typed yet; it returns the message as a string and the field draws it.

**A `<Select>` has to be handed its wiring rather than given it.** `control` takes a node, which
the shell clones — or a function, which it calls with the props. The function form is not a
convenience: a `Select` root renders no DOM at all, so a clone of it swallows the `id` and the
`aria-describedby` silently, and the field ends up wired to nothing while looking exactly right.
Every select on this server passes `control={(props) => …}` and spreads onto the `SelectTrigger`;
`ModelSelect` takes the same props as `...wiring` because it renders a trigger or an input
depending on how it was last used, and neither is something the shell can see. `asGroup` is the
other half — a row of badges, a box of switches, the history ledger, a `<pre>` to copy — where the
heading is drawn as a title the group points back at, because HTML will not let a `<label>` name
any of them and a `for` that resolves to nothing reads as wired and is not.

## Code style

- Biome-enforced: double quotes, semicolons, trailing commas, 2-space indent, 100 line width,
  `import type` for type-only imports, imports organised on save
- Files `kebab-case.ts(x)`; components `PascalCase`; vars and functions `camelCase`; true
  constants `SCREAMING_SNAKE_CASE`
- Prefix an unused parameter with `_`; `unknown` over `any`, which is an error
- Comments explain why, not what. A comment that restates the line below it is noise
- Tests are `tests/*.test.ts`, Vitest `describe`/`it`/`expect`, against an in-memory PGlite —
  no mocks of the database. Agent tests drive a fake OpenAI-compatible server over HTTP and a
  real MCP server over stdio, rather than stubbing either

## Git

- Use **Conventional Commits**, always: `feat:`, `fix:`, `perf:`, `refactor:`, `docs:`,
  `test:`, `build:`, `ci:`, `chore:`, with an optional scope (`feat(web): …`) and breaking
  changes via `!` or a `BREAKING CHANGE:` footer. semantic-release derives the version and the
  Docker image tags from these on `main`, so a `feat:` or `fix:` is what makes a release happen
  and anything else ships nothing
- Subject in the imperative, lowercase after the colon, no trailing period. The body says why,
  wrapped at 80
- Run `npm run lint`, `npm run typecheck` and `npm test` before every commit
- Branch for the work; `main` is what CI and release watch
- **Never rebase — merge.** To bring `main` into a branch, `git merge origin/main`. Rebasing
  rewrites commits other checkouts and worktrees may already have; a merge commit records what
  actually happened instead

## CI / release

- `.github/workflows/ci.yml` — biome, codegen drift, typecheck, vitest, build; plus a job that
  builds the Docker image, boots it and waits for it to answer a GraphQL query. Nothing here
  starts a postgres server: the suites run on PGlite, and CI is kept to what is fast
- **Three compose files, and none of them is run end to end here.** `docker-compose.yml` and
  `docker-compose.pg.yml` build this checkout; `docker-compose.example.yml` names the published
  image and is what somebody copies onto a server. CI runs `docker compose config` over all
  three — the interpolation and the schema are what there is to get wrong — and boots the built
  image on its own. A change to one of them is usually a change to all three
- `.github/workflows/release.yml` — after CI passes on `main`, semantic-release cuts the
  release and one build pushes `latest` and the version to `ghcr.io/<owner>/<repo>` and
  `<user>/kanban-server` on Docker Hub. GHCR uses the built-in `GITHUB_TOKEN` and needs no
  setup. Docker Hub is optional: `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` come from the
  organisation's shared secrets, and when they are absent those tags and the login are skipped
  rather than failing the release. A `workflow_dispatch` with a version publishes the images
  without cutting a release
- **The version in `package.json` is the one the image reports, and the release stamps it.**
  `@semantic-release/npm` sits in `.releaserc.json` with `npmPublish: false` purely for that:
  it writes the cut version into the manifest before the image is built from the same working
  tree. Without it the field sat at `0.1.0` from the first commit, and that constant was what
  `/mcp` told every client and the MCP pool told every server it dialled — a plausible-looking
  lie rather than a missing value. A working tree says `0.0.0-dev`, which reads as unreleased;
  the manual `workflow_dispatch` path stamps the version it was given, since it runs no
  semantic-release to do it

## Finding code

Prefer an LSP (definitions, references) over grep when navigating.
