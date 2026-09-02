# AGENTS.md — kanban-server

A kanban board that works itself. A **project** is a body of work; its **lanes** are the
board's columns, and a lane that names an **agent** is a station — cards there get worked and
then moved on. An agent is a **role** — a job of work, which is a prompt and nothing else —
pointed at a model endpoint. A **task** is what a person asks for in their own words, refined over a
**message** thread until they accept it; a decompose agent turns the one task into many
**cards**, which are the units an agent executes. Every time an agent is asked to do anything
— refine, decompose, or work a card — that is one **run**. The same API is served three ways
from one process: GraphQL at `/graphql`, MCP tools at `/mcp`, and the built React app on
everything else.

Read [`README.md`](README.md) first — it holds the design decisions this file only summarises.

Single package, no workspaces: `server/` (Express 5 + graphql-yoga + Drizzle), `src/` (Vite +
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
npm run codegen          # schema, then graphql-codegen into src/gql/graphql.ts
npm run db:generate      # drizzle-kit, after a change to server/db/schema.ts
npm run db:migrate       # apply drizzle/ by hand; the server does this on boot anyway
npm run db:studio

# Build / run
npm run build            # codegen, typecheck, then vite build into dist/
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
| **Node type stripping** | The container runs `node server/index.ts`; `tsx` is a devDependency and is not in the image. Nothing under `server/` may use syntax that survives erasure — no enums, no parameter properties |
| **Biome** | One formatter and linter. `noExplicitAny` and `noNonNullAssertion` are errors here, not warnings |

## Key conventions

**Relative imports carry the `.ts`/`.tsx` extension.** Both tsx and Node's type stripping
require it, and `allowImportingTsExtensions` is on for that reason.

**The schema is the contract, and it is generated.** Add a column to `server/db/schema.ts` and
the typed documents in `src/graphql/*.graphql` see it. Never hand-write a type that codegen
produces, and never edit `src/gql/graphql.ts` — biome ignores it because it is output.

`npm run codegen` does it explicitly, but under `npm run dev` you should not need to: the
server rewrites `schema.graphql` on boot and regenerates with it when the SDL moved, and vite
runs codegen off its own watcher for the documents. Both are dev-only — `@graphql-codegen/cli`
is a devDependency and `server/dev/codegen.ts` is behind a `NODE_ENV !== "production"` guard,
because the image has neither codegen nor the sources it would write. `npm run build` runs
codegen before the typecheck, and CI regenerates and diffs it against what is committed.

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
in; a card is the unit an agent executes; the decomposer exists because those two are different
sizes. `submitTask` is the one-shot path — create, accept and decompose in a single call, for
an MCP client that has nothing to refine — and it records a failed decomposition on the task
rather than throwing, so the task survives to be retried.

**A lane is a station, and the board is the pipeline.** `agentId` says what runs on the cards
in a lane; `onSuccessLaneId` and `onFailureLaneId` say where they go afterwards; `wipLimit`
caps how many run at once; `readVerdict` says this station judges cards rather than working
them. That is the whole of the automation — there is no workflow engine, and the shape of the
pipeline is the shape of the board someone drew. A lane with no agent is a resting place, which
is what a backlog and a done pile are.

**A role is the job; an agent is the job plus a model.** `roles` is a table, not an enum, because
the useful ones are not knowable from here — a tester, a security reviewer, a technical writer are
each a paragraph of instruction and none should need a migration. What cannot be invented is
`stage`: `refine` and `decompose` answer in JSON the server itself parses, so they are two fixed
stations, and `card` is every role a lane may point at. `resolveStage` is how the refiner and the
decomposer are found; `seedLanes` finds the executor and the reviewer by their role's name.
An agent's empty `systemPrompt` inherits the role's, which is why editing what every executor is
told is one edit rather than one per agent, and why a card run no longer starts with an empty
system message when somebody made an agent by hand.

**The optimistic board and the server agree by construction.** A drop rewrites the board cache
before the request goes out, and `src/lib/board-order.ts` holds the pure functions that decide
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

**A board template stores indexes, not ids.** `saveBoardTemplate` snapshots a project's lanes
into `board_templates.lanes`, turning `onSuccessLaneId`/`onFailureLaneId` into positions in the
template's own list — a lane id belongs to one project and means nothing in another. Applying
one writes the lanes first and the arrows second, in a single transaction, which is the same
two steps `seedLanes` takes and for the same reason. An `agentId` that no longer exists
resolves to none rather than failing: a template is a shape, and the agents are whoever happens
to be on this server. `readVerdict` is read back with `?? false`, because a template saved before
stations could judge cards has no such key and a lane that does not say it reads a verdict does
not read one. Applying is refused on a board with cards, because deleting a lane takes its cards
with it.

**`done` means nothing further will happen.** A card that passes into a lane that has an agent
of its own is not finished — it is waiting for that lane's turn — so it goes back to `idle`,
because `readyCards` only picks up `idle`. `done` is for a card that stayed put, or landed
where no agent runs. A card a reviewer rejected stays `error`, so the Doing↔Review loop cannot
spin on its own; `retryCard` is the way back, and clears the error where the card stands.

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
`lanes.readVerdict` is what decides whether that first word is read at all, because judging is
something a station does: the same agent can work cards in Doing and rule on them in Review, and
a board may have two reviewing stations or none. Nothing in a card run branches on which role its
agent fills.

**Automation is opt-in per project.** `projects.autoRun` gates the worker; `server/worker/loop.ts`
polls rather than waking on writes, because the things that make a card runnable are not all
writes — a dependency finishing, an agent switched back on, a run stopped.

**Hand-written GraphQL fields go in `server/graphql/`**, beside the generated entities:
`models`, `mcpStatus`, `runEvents`, `spend` on the query side; `refineTask`, `acceptTask`,
`decomposeTask`, `submitTask`, `runCard`, `stopCard`, `stopTask`, `moveCard`, `retryCard`,
`archiveCard`, `restoreCard`, `setCardDeps`, `setAgentServers`,
`testMcpServer`, `reconnectMcp`, `setApiKey`, `setAgentApiKey` on the mutation side. Give every
one of them a `description` — it is what an agent on `/mcp` reads to decide whether to call it.

**Writes go through `onWrite` hooks.** Creating a project seeds its four lanes and their
success/failure wiring in the same transaction (`payload.tx`), and an edited MCP server
reconciles the connection pool without a restart. A write that should change either of those
belongs in a hook, not in a route handler.

**The API key is never readable.** `exclude.columns` drops `apiKey` from both `settings` and
`agents`, so there is no field to select; `setApiKey` and `setAgentApiKey` are write-only. Two
tests hold that line.

**The `/mcp` surface is curated, not the whole schema.** `server/mcp-endpoint.ts` lists the
thirty-one tools an outside client gets. Nothing that empties a table in one call, nothing that
reads or writes the API key, and no editing of agents, roles or MCP servers — a visiting client can
see which agents and roles exist, because a lane points at one, but which model runs where and on
whose key is the operator's business. A new tool goes in that list deliberately,
with a `HINTS` entry if the generated description does not say enough. The driver renames after
it filters, so the `include` list names GraphQL fields in camelCase while `HINTS` — and the
client — sees the snake_case tool name: `Mutation.createProject` is the tool `create_project`.

**Prompts are the room a `HINTS` line has not got.** `server/mcp-prompts.ts` holds four —
`kanban_guide`, the orientation an agent should read before its first call, and three jobs of work
(`start_project`, `submit_work`, `triage_board`) written as instructions naming the tools in the
order they actually go. They are why `mcp-endpoint.ts` writes out `createHttpHandler`'s stateless
path instead of calling it: nothing in graphql-mcp hands a caller the `McpServer` a request is
served by, and a prompt must be registered on it before `connectServer`, because the SDK declares
`capabilities.prompts` on the first registration and refuses to declare one after a transport is
attached. `createServerFactory` and `connectServer` are used unchanged, so the shared `tools/list`
render and the argument guard are untouched. cubicecho/graphql-mcp#20 is the ask upstream; when it
lands this goes back to one call. A prompt taking no arguments is registered with no `argsSchema`
rather than an empty one — a client with nothing to send omits `params.arguments`, and an empty
object schema refuses `undefined`.

**The tool listing has a size test, and it is not incidental.** The generated relation filters
recurse between tables, and written out as JSON Schema rather than named as SDL they would make
the listing enormous — more than a model will read, and it arrives before any call. graphql-mcp
builds each input type once so the repeats become `$ref`s. `tests/mcp-endpoint.test.ts` holds
every tool under 150 kB and the listing under 1.2 MB. The bounds sit above the real figure on
purpose: it is the driver's to move, and what the test is for is the order of magnitude.
Anything added here that grows it needs to answer to that test rather than raise the bound.

**The LLM call retries only before the model has spoken.** `server/runner/agent.ts` owns the
retry loop, not the OpenAI SDK, whose own retries are off: once a chunk has arrived the turn
is unrepeatable, so a failure after that propagates. `requestTimeoutSeconds` is a silence
watchdog that rearms on every chunk, not a deadline on the request, and an aborted stream ends
its iteration rather than throwing — hence the `throwIfAborted()` after the loop.

**Agents inherit from Settings by sentinel — and from their role for the prompt.** Every numeric
knob treats `0` as "inherit",
except `temperature` and `maxRetries`, which use `-1` because `0` is a value someone may
genuinely want; empty strings inherit the same way, and `toolDiscovery` uses the word
`"inherit"` rather than an empty string, because a nameless enum member reads as a bug in the
API. `systemPrompt` is the one that inherits from the agent's role instead, a prompt being what a
role *is*. `server/runner/llm.ts` is the only place any of that resolution happens.

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

**Totals are read, never counted.** `spend` sums the run rows on every call, and reports the
oldest run it counted. A stored counter would keep climbing after `runRetentionDays` deleted the
runs behind it, and a total that cannot be checked against the rows is worse than none.

**Frontend:** shadcn primitives in `src/components/ui/` with no app logic; routes in
`src/routes/`; `@/` maps to `src/`. Every query goes through `request()` in `src/lib/gql.ts`
with a typed document — no raw `fetch` in a component — and every mutation invalidates the
query keys it affected.

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

## Finding code

Prefer an LSP (definitions, references) over grep when navigating.
