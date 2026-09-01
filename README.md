# kanban-server

A kanban board that works itself. You describe what you want; a decomposing agent turns it into
cards; the lanes of the board are the pipeline those cards move through, and the agents named on
those lanes do the work.

It is the shape of task-server with the clock taken out: nothing here fires on a schedule, and
what moves work along is a card arriving in a lane that has an agent on it.

## Quick start

```sh
git clone git@github.com:cubicecho/kanban-server.git
cd kanban-server
npm install
npm run dev        # express on :8788, vite on :3001
```

Open <http://localhost:3001>, go to **Settings**, point *Base URL* at any OpenAI-compatible
server (Ollama `http://localhost:11434/v1`, LM Studio `http://localhost:1234/v1`, OpenAI,
OpenRouter), pick a model, and save. That configures all four built-in agents at once — they
are seeded on first boot with every model setting left inheriting from Settings. Then make a
project, type what you want into the box on the home page, and press **Make task**.

The database is postgres, and with nothing configured it is an embedded one — PGlite, running
in the server's own process against `data/`. Nothing to install, nothing to start, and the
tables are created on first boot; see **Postgres**. Copy `.env.example` to `.env` if you want
to move the port, point at a postgres server, lock the server behind a token, or supply the API
key from the environment instead of the UI.

## The model

- **project** — a board, and the standing description of the work. Its `context` is given to
  every agent working it, ahead of whatever that agent was asked to do, so no card's prompt has
  to repeat what the project is. `autoRun` is the switch that lets agents pick cards up on their
  own.
- **lane** — a column, and where it names an `agentId`, a station. `onSuccessLaneId` and
  `onFailureLaneId` are where a card goes when that agent is finished with it, and `wipLimit`
  caps how many run there at once. A lane with no agent is a resting place, which is what a
  backlog and a done pile are.
- **agent** — a model endpoint, a system prompt, and a set of MCP servers. `role` is `refine`,
  `decompose`, `review` or `execute`. Each agent carries its own base URL, key and model, so one
  can be a local llama.cpp and the next a frontier API; anything left empty inherits from
  Settings.
- **task** — what a person asked for, in their own words. A title, a `brief`, and a `status`
  that walks `draft` → `ready` → `decomposing` → `decomposed`.
- **message** — one turn of the conversation refining a task. The thread is the task's history.
- **card** — one piece of work, on the board. `acceptance` is kept apart from `body` because it
  is what a review agent is asked to check against, and a criterion buried in a paragraph is a
  criterion that gets skipped. `dependsOn` links say which cards must finish first.
- **run** — one execution of one agent: `kind` is `refine`, `decompose` or `card`, and the row
  keeps the status, timings, output or error, the tools called and the tokens spent. A run in
  flight can be called off (`stopCard`, `stopTask`), which aborts the request and finishes the
  run as `stopped` — neither a success nor a failure. Nothing whose run is going can be deleted;
  the delete is refused server-side until it has stopped.
- **mcp server** — a stdio or http MCP server whose tools an agent can reach, exposed to the
  model as `slug__tool-name`. Which agents see which servers is a separate choice — see
  **Agents and their tools**.
- **settings** — one row: the fallback endpoint, key and model, the token and temperature
  limits, the tool-iteration cap, how MCP tools are discovered, how long runs are kept and how
  often the worker looks for work.

## A task is not a card

This is the distinction the whole thing is built around. A task is the unit a person thinks in
— "get the billing export working again" — and a card is the unit an agent can actually finish
in one sitting. The decomposer exists because those two are different sizes, and keeping both
means every card can be traced back to the sentence that asked for it.

There are two ways in, and they are the same pipeline entered at different points:

- **Talk it over.** The home page's chat box sends what you wrote to the refining agent, which
  answers in prose and rewrites the task's title and brief each turn. When the brief says what
  you meant, **accept** it — that is what marks it ready — and then decompose it.
- **Just make it.** If you already know what you want, every turn of conversation would only be
  you telling an agent what you already wrote down. **Make task** writes it, accepts it and
  decomposes it in one go. Over the API that is `submitTask`, one call, answering once the cards
  exist.

The decomposer is asked for a JSON array of cards — title, body, acceptance criteria, and the
titles of any cards that must finish first — and it is parsed forgivingly, because failing a run
over a model's habit of saying "here you go:" first is not worth it. The cards land in the
board's intake lane. A `dependsOn` naming a card that is not in the list is dropped rather than
failing the decomposition.

A decomposition that fails leaves the task in `error` with the reason on it rather than throwing
it away, so a client that submitted a task can read it back and find out what happened.

## The board is the pipeline

A new project comes with four lanes already wired:

```
Backlog  ──▶  Doing  ──▶  Review  ──▶  Done
   (intake)   executor     reviewer
                 ▲            │
                 └── on FAIL ─┘
```

There is no workflow engine here. `agentId`, `onSuccessLaneId` and `onFailureLaneId` on the lane
rows are the whole of it, which means the pipeline is whatever board someone drew — add a lane
called "Needs a human" with no agent on it and cards sent there stop, because that is what a
lane with no agent is.

Two rules are worth knowing because they are what keeps a board from running away:

**A card that passes into a staffed lane goes back to `idle`, not `done`.** It is not finished;
it is waiting for that lane's turn. `done` means nothing further will happen to it — it stayed
put, or it landed where no agent runs.

**A card a reviewer rejected stays `error`.** Review sends it back to Doing, but `error` is a
status the worker will not pick up, so a rejected card waits for a person rather than looping
between two agents at whatever a token costs. `retryCard` — the **Retry** button on the card —
clears the error and returns it to `idle` where it stands, and that is how a failed card is put
back in play. Moving it does the same thing, since a moved card comes back to `idle` too.

The review verdict is a property of the output, not of the run: a reviewer that answers `FAIL`
has still run fine, so the run is `ok` and it is the card that failed. An answer that is neither
counts as a pass. A mumbling reviewer must not be able to wedge a board.

A card whose dependencies have not finished is skipped by the worker rather than run out of
order. Asking for it by hand marks it `blocked` and says on the card what it is waiting on.

## Automation

`autoRun` on a project is what lets the worker start things by itself. Off — the default — the
board is a board: cards sit where they are put, and an agent runs when someone presses the
button on a card. On, `server/worker/loop.ts` sweeps every lane of every auto project, and picks
up a card where three things are true: the project is on auto, the lane names an agent, and the
lane has room under its WIP limit. Each of those is a different person's intent, which is why it
is three checks and not one.

It polls, at `workerIntervalSeconds`, rather than waking on writes — the things that make a card
runnable are not all writes: a dependency finishing, an agent switched back on, a run stopped. A
few seconds of latency on work measured in model round-trips is not worth the bookkeeping. Set
the interval to `0` to stop it entirely.

Runs are started but not awaited, so one slow agent does not hold up every other board.

## Agents and their tools

Four agents are seeded on first boot — `refiner`, `decomposer`, `reviewer`, `executor` — differing
only by their prompt, with every model setting left inheriting. Configure one endpoint in
Settings and all four work. Edit any of them on the **Agents** page to point it somewhere else:
its own base URL, key, model, temperature, iteration cap, timeout and retries.

Inheritance is by sentinel, and it is worth knowing which: `0` means "inherit" for every numeric
knob except `temperature` and `maxRetries`, which use `-1` because `0` is a value someone may
genuinely want. Empty strings inherit the same way, and `toolDiscovery` uses the word `inherit`.

Which MCP servers an agent may reach is per agent (`setAgentServers`), because the answer differs
by role: an executor wants everything it can get, and a refiner is having a conversation and
should have nothing. The connection pool is shared — a stdio server is a child process, and one
per agent would be one per agent per restart — so this decides what an agent is *shown*, not what
is running.

With several servers connected, tool definitions cost more per request than the card's own prompt
— they are mostly JSON Schema, and every one is sent on every turn. There are two discovery modes
(`runner/tool-loading.ts`):

- **eager** — every definition on every request. Simple, and fine with a handful of tools.
- **on demand** — the system prompt carries a name-only catalogue and the model calls
  `load_tools` for the schemas it wants, which arrive on the turn after. Names cost roughly a
  fortieth of what the schemas do. Before the run starts, an optional small **tool-picking
  model** reads the same catalogue and guesses the tools the work needs; when it guesses well the
  run opens with that shortlist alone. A wrong guess costs an unused definition for one run.

MCP tool schemas are normalised before they reach the model (`runner/schema-compat.ts`):
llama.cpp-backed servers compile every tool into one grammar, so a single shape their converter
dislikes — a `type: ["string", "null"]`, a lookaround `pattern`, a bare type name where a schema
belongs — fails the whole request rather than the one tool. If the server still reports a grammar
failure, the advisory `pattern` and `format` keywords are dropped and the call is retried once.
Cloud providers accept all of it, so the retry never fires against them.

The retry loop around the request is the runner's own, and the OpenAI SDK's is off: once a chunk
has arrived the turn is unrepeatable, so only a failure *before* the model has spoken is retried.
`requestTimeoutSeconds` is a silence watchdog that rearms on every chunk, not a deadline on the
request.

## Watching a run

A run row is a before and an after. Everything in between — the thinking, the tool the model
reached for, the argument it got wrong — is what you need when an agent misbehaves, and it is
gone by the time the row is written. So the runner streams its completions and reports what it is
doing as it does it: reasoning and reply tokens, each tool call with its arguments, each result,
and the turn boundaries of the agent loop.

Those events go to an in-memory bus (`server/runner/events.ts`) and out over a GraphQL
subscription, `runEvents(runId:)`, which yoga serves as SSE — the browser reads it with its own
`EventSource`, so the client needs no library for it. A watcher that joins halfway through is
replayed the run so far, so opening it late reads the same as having watched from the start.

Three places show it, all the same stream: expand a run on the **Runs** page, press the aerial
button on a running card to watch it without leaving the board, and the refinement chat writes
the agent's answer as it arrives rather than sitting on "Thinking…" until the turn is over. A
card and a task each know they are being worked but not by which run, so the pages ask
`runs(where: { status: { eq: running } })` for the name of the run to watch.

It is debugging output, not the record: nothing is persisted, nothing survives a restart, and a
finished run is forgotten a minute later. The row remains the lasting account of what happened.

## What it has cost

`spend(projectId:)` adds up the tokens on a project's runs — `spend(taskId:)` narrows it to one
task, which is its refinement, its decomposition and every run of every card it became. It shows
on the board beside the lane button, and on a task beside its cards.

The total is read from the run rows every time it is asked for rather than kept in a counter,
because `runRetentionDays` deletes runs: a counter would go on reporting money spent on runs
nobody can look at any more. That is also why the label says `from` — the oldest run in the
total — instead of the window that was asked for. Thirty days of runs on a board that keeps
seven is seven days of tokens, and it says so.

## Layout

```
server/
  db/          drizzle schema and client; migrate.ts applies drizzle/ and seeds on boot
  graphql/     the schema: drizzle-graphql entities plus the hand-written fields
  runner/      llm client, MCP pool, tool loading + schema compat, agent loop,
               prompts, and run.ts — refine, decompose, and work a card
  scheduler/   cleanup.ts prunes old runs hourly
  worker/      loop.ts, the poll that moves cards on auto-run boards
  mcp-endpoint.ts  the curated /mcp tool surface
  index.ts     express + yoga + the MCP endpoint + the built SPA
shared/        the bits both halves import
src/           vite + react + tanstack router/query + shadcn
               (new task, board, tasks, agents, runs, mcp servers, settings)
tests/         vitest
```

## GraphQL

The API is generated from the Drizzle tables by
[`@vantreeseba/drizzle-graphql`](https://github.com/vantreeseba/drizzle-graphql), so a new column
is queryable as soon as it exists. Hand-written fields fill the gaps that CRUD cannot express:
`models`, `mcpStatus` and `runEvents` on the query side; `refineTask`, `acceptTask`,
`decomposeTask`, `submitTask`, `runCard`, `stopCard`, `stopTask`, `moveCard`, `setAgentServers`,
`testMcpServer`, `reconnectMcp`, `setApiKey` and `setAgentApiKey` on the mutation side.

- **`POST /graphql`** — the API, plus GraphiQL in a browser.
- **`/mcp`** — the same server offered to agents as MCP tools; see below. Not for the web app,
  which talks only GraphQL.

Creating a project seeds its four lanes and the arrows between them in the same transaction, so a
rollback takes the lanes with it and there is no such thing as a project with a half-drawn board.
Editing an MCP server reconciles the connection pool without a restart. Both are `onWrite` hooks.

API keys travel one way: `apiKey` is excluded from the `Setting` and `Agent` output types, so
there is no field to select it with, and `setApiKey`/`setAgentApiKey` are the write-only way in.

`features.nestedWrites` is off. A project and its lanes save as separate mutations, and `moveCard`
writes a lane's whole ordering rather than a row at a time.

## MCP endpoint

`/mcp` serves this server's own API as MCP tools over Streamable HTTP, so another client — Claude
Code, Claude Desktop, anything that speaks MCP — can put work on a board here without going
through the web app. That is the shortest path from this being a board someone fills in to being
somewhere work is handed off. In dev it is on the server's own port (`:8788`); vite proxies
`/graphql` alone.

```sh
claude mcp add --transport http kanban http://localhost:8788/mcp
```

Twenty-five tools, chosen in `server/mcp-endpoint.ts` rather than projected from the whole schema:

- **read** — `projects`, `lanes`, `cards`, `tasks`, `runs`, `agents`, `run_events`, `spend`
- **projects** — `create_project`, `update_project_single`
- **tasks** — `submit_task`, `create_task`, `refine_task`, `accept_task`, `decompose_task`,
  `delete_task_single`
- **cards** — `create_card`, `update_card_single`, `delete_card_single`, `set_card_deps`,
  `move_card`, `retry_card`, `run_card`, `stop_card`, `stop_task`

`submit_task` is the one to reach for: describe what you want and it is written down, broken into
cards, and put on the board in a single call. `create_card` is the other way round — one piece of
work you already know the shape of, put straight into a lane you name, with no task behind it.
`set_card_deps` writes the whole waiting list for a card at once, and refuses a list that would
close a loop — naming the cards in it, since cards that wait on each other never run.

Tool names are snake_case while the GraphQL fields they come from are camelCase: an MCP client
reads a tool name as a name, and snake_case is the convention it meets everywhere else. The
arguments and the fields in the answer are the schema's own, so they keep their spelling.

Several tools carry a `HINTS` line beyond their generated description, because a field generated
from a table describes itself only as "the `cards` query" and a visiting agent has no other way to
learn that a task is not a card, or that what moves a card along is the lane it is in.

`mutationHints: "byName"` reads the conventional `create`/`update`/`delete` prefixes off the field
name, which settles most of the destructive/idempotent marks. The ones named after neither prefix
arrive under the conservative default — destructive, not idempotent — and are corrected by hand:
the four that run an agent destroy nothing, none of them is idempotent (decomposing a task twice
makes two sets of cards), and `accept_task` and `move_card` are idempotent and destroy nothing.
`stop_card` keeps its destructive mark, because aborting a run throws away whatever the agent had
done, and gains an idempotent one, because a second call finds nothing in flight and says so.

Left out on purpose: the settings row and `setApiKey` (which model runs where, on whose key, is
the operator's business, not a visiting agent's), writes to agents and MCP servers, the aggregates
and group-bys, every bulk mutation — `deleteCard` with no `where` empties the table, where
`deleteCardSingle` cannot — and deleting a project, which takes its whole board and history with
it and is worth the walk to the UI. Each tool selects one level of fields, so a listing of cards
does not drag every run's output along with it.

The whole listing is about 662 kB, which is worth saying because it very nearly was not. The
generated filters reach through relations — a project filtered by its cards, each card filtered
back by its project — which costs nothing in the SDL, where a type is named rather than written
out. As the JSON Schema a tool advertises, a driver that rebuilds each type per route has to spell
that recursion out at every level, and the listing runs to megabytes of tool definitions handed
over before a client can call anything. graphql-mcp builds each input type once and emits a `$ref`
for the repeats, so the relation filters cost almost nothing and stay — `where: { cards: { some:
{ status: { eq: "error" } } } }` is a question worth being able to ask. A test holds every tool
under 150 kB and the listing under 1.2 MB.

Unknown fields in a tool's arguments are rejected rather than dropped: a misspelled key comes back
as `Unrecognized key: "order"` instead of a success with that part of the request quietly
discarded, which is the correction an agent can act on.

`run_card`, `decompose_task` and `submit_task` do not answer until the run is over, which for real
work is minutes. To watch one meanwhile, poll `run_events(runId, afterSeq)` — the snapshot form of
the subscription the Runs page uses, with consecutive output tokens folded into one entry. Pass
the `seq` of the last entry you read as `afterSeq` and you get what came after it, and nothing
twice.

It is stateless: each request builds its own server and answers as JSON, so there is no session to
keep alive and a client can reconnect whenever it likes. The endpoint is mounted for every method,
not just `POST`, so the `GET` a client uses to offer a notification stream and the `DELETE` it
uses to end a session are answered by the transport in JSON-RPC rather than by Express's 404 page.

No CORS headers, deliberately: the browser reaches this from its own origin, and there is no
reason to let a page from another one drive the board.

## Locking it

`KANBAN_SERVER_TOKEN` is empty by default, and then there is no authentication at all: anyone who
can reach the port can drive the board, read every run's output, and — through `/mcp` — spend the
operator's API key. That is the right shape for something on a laptop, and the wrong shape for
anything with a public IP.

Set it and both `/graphql` and `/mcp` want `Authorization: Bearer <it>`:

```sh
KANBAN_SERVER_TOKEN=$(openssl rand -hex 32) npm run dev
```

```sh
claude mcp add --transport http --header "Authorization: Bearer $KANBAN_SERVER_TOKEN" \
  kanban http://localhost:8788/mcp
```

The web app asks for the token once and posts it to `/api/auth`, which hands back an `httpOnly`
cookie — nothing on the page can read it afterwards, and the browser attaches it to the run
stream, which an `EventSource` could not do with a header. The cookie is `SameSite=Strict`, so
another site's page cannot borrow it. Log out by deleting it: `DELETE /api/auth`.

One shared token, not accounts: this is a tool one person points at their own board, and what is
worth locking is not who you are but the key the agents spend. A wrong token is compared in
constant time and refused with a bare `401` that says nothing about what is here.

## Retention

**Settings → Keep runs for** sets how many days of runs to keep. At `0`, the default, nothing is
ever deleted. Above zero, an hourly sweep — and one at boot — deletes runs that started longer ago
than that. A run still going is never touched, however old it looks. The cards and tasks those
runs were about stay where they are: history is disposable, work is not.

## Docker

```sh
docker compose up --build
```

The server is on `http://localhost:8788` — the board, `/graphql`, and `/mcp` all from the one
container, the same as `npm start`. The embedded postgres keeps its data on the volume,
bind-mounted at `./data`, so the projects survive the container.

For a postgres server of its own, `docker-compose.pg.yml` is the same image beside a `postgres:17`
service, with `DATABASE_URL` pointed at it and the data in a named volume:

```sh
docker compose -f docker-compose.pg.yml up --build
```

Nothing in the image changes between the two — see **Postgres** below.

`OPENAI_API_KEY` is optional and only a fallback: an agent takes its key from its own row, then
from the settings row the UI saves, and only then from the environment. `KANBAN_SERVER_TOKEN` is
the other one worth setting here — see **Locking it**; the container's healthcheck sends it too.

The image builds the client with the dev dependencies and then throws them away, and the runtime
stage has no `tsx` in it — Node runs the server's TypeScript by stripping the types. That is the
one thing about the image that could break on a source change, so CI builds it, boots it, and asks
it a question on every pull request.

Releases are cut from the commit log by semantic-release and push four tags — `latest` and the
version, to both `ghcr.io/<owner>/<repo>` and Docker Hub. GHCR authenticates with the built-in
`GITHUB_TOKEN`, so it is never a setup step. Docker Hub is the optional half: it authenticates
with `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN`, and when they are missing the workflow drops
those two tags and publishes to GHCR alone rather than failing. Only `feat:`/`fix:` commits produce
a version, so the Release workflow also takes a manual run with a version typed in, which
publishes the images without tagging a release.

## Codegen

The schema is built at runtime from the tables, so codegen needs it written out first:

```sh
npm run codegen    # prints schema.graphql, then generates src/gql/
```

That produces `src/gql/graphql.ts`: a typed document node per operation, so a query whose shape
changes breaks compilation rather than at runtime.

In development you rarely run it by hand, because both halves of `npm run dev` keep it current
from the side they can see:

- the **server** rewrites `schema.graphql` on boot, and regenerates the types with it — that is
  the moment after a table changes, and it only does the work when the SDL actually moved
- **vite** watches `schema.graphql` and `src/graphql/**/*.graphql` through
  `vite-plugin-graphql-codegen`, so editing a document regenerates its typed node and hot-reloads

Both are dev-only. The production image has no codegen in it and nothing to regenerate: it serves
a `dist/` that was built against the types it was typechecked with.

`npm run build` runs codegen before the typecheck, so a stale `src/gql/graphql.ts` cannot reach a
build. CI additionally regenerates and diffs against what is committed — the artefacts are
generated *and* checked in, and that step is what stops the two from drifting apart.

## Postgres

Postgres is the only database, and it comes in two shapes.

With nothing set, the server runs **PGlite**: postgres itself, compiled to WebAssembly and running
inside the Node process against a directory under `data/`. A fresh clone has a database the moment
it boots, with nothing installed and nothing to start — and it is the same engine, the same SQL
and the same types as the deployed thing, which is the point of it. The tests run one in memory, a
throwaway per suite.

PGlite does not defend its own directory, so `client.ts` does: two processes opened on one data
directory both succeed and then stop seeing each other's writes. A pid in `<store>.lock` refuses
the second one and takes over a lock whose holder is gone. It cannot see across a pid namespace,
so a container sharing a bind-mounted `./data` with a host process is still on its own — that case
is what `DATABASE_URL` is for.

With `DATABASE_URL` set it is a postgres server over `pg`, for the deployment that has outgrown a
single process — more than one server, a managed backup, storage that is not the app's own disk.

```sh
DATABASE_URL=postgres://kanban:kanban@localhost:5432/kanban npm start
```

That variable is the whole switch, and `server/db/client.ts` is the only place in the server that
acts on it — everything above `server/db/` is written against one `db` and one set of tables. The
schema is created on first boot either way, so an empty database is all a postgres server has to
arrive with; `docker-compose.pg.yml` is the same image against a `postgres:17` service.

The schema comes from the migrations committed in `drizzle/`, which `server/db/migrate.ts` applies
on boot against either database. Changing `server/db/schema.ts` means running `npm run db:generate`
and committing the migration it writes.

It is a swap, not a migration: the two databases share no data, and moving a board from one to the
other is your own `pg_dump`-shaped problem.

`npm run db:generate`, `db:migrate` and `db:studio` follow `DATABASE_URL` too.

## Scripts

| | |
| --- | --- |
| `npm run dev` | server and web together |
| `npm run build` | codegen, typecheck, then build the SPA into `dist/` |
| `npm start` | production: express serves `dist/` and the API on one port |
| `npm run codegen` | print `schema.graphql` and regenerate `src/gql/` |
| `npm test` | vitest |
| `npm run lint` / `format` | biome |
| `npm run db:generate` | write a migration into `drizzle/` after a schema change |
| `npm run db:migrate` | apply `drizzle/` by hand; the server does it on boot anyway |
| `npm run db:studio` | drizzle studio |

## License

MIT
