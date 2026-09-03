# kanban-server

A kanban board that works itself. You describe what you want; it goes on the board as one card;
the lanes of the board are the pipeline that card moves through — the first of them breaks it
into the cards that carry the work out — and the agents named on those lanes do the work.

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
- **lane** — a column, and where it names a `roleId` and an `agentId`, a station: the role says
  what kind of lane it is, the agent says which model works it. `prompt` is anything this board
  adds to what the kind says, appended and never replacing it. `onSuccessLaneId` and
  `onFailureLaneId` are where a card goes when the agent is finished with it — or, with
  `archiveOnSuccess`, off the board entirely, which is the end of a pipeline saying so and a
  Done pile nobody has to empty by hand. `wipLimit`
  caps how many run there at once. `maxAttempts` is how many failures it will put back in play
  before it stops and waits for a person. A lane with no role or no agent is a resting place,
  which is what a backlog and a done pile are.
- **role** — a kind of lane: a name, a `contract`, and the prompt every lane of that kind is
  told. `contract` is the shape of the answer — `work` reports on the card, `verdict` rules
  `PASS`/`FAIL` on it, `expand` breaks it into more cards — and it is the only part of a role
  the server itself reads. A role is a row, so a new kind of station — a tester, a technical
  writer — is something you write rather than something we ship.
- **agent** — a model to run work on: an endpoint, a set of MCP servers, and optionally a word
  about itself. It does not know what job it does; it finds that out at the lane, and the same
  agent can work one lane and judge another. Each agent carries its own base URL, key and model,
  so one can be a local llama.cpp and the next a frontier API; anything left empty inherits from
  Settings.
- **task** — a conversation about what somebody wants, in their own words: a title and a
  `brief` the refining agent rewrites each turn. It has no status and no pipeline of its own,
  because nothing happens to a conversation — its one exit is `makeCard`, and whether it ever
  reached the board is the card carrying its id.
- **message** — one turn of the conversation refining a task. The thread is the task's history.
- **card** — one piece of work, on the board. `acceptance` is kept apart from `body` because it
  is what a review agent is asked to check against, and a criterion buried in a paragraph is a
  criterion that gets skipped. `dependsOn` links say which cards must finish first. `error` is
  what broke — a crash, a timeout, an interrupted run, and never a verdict; what was *said*
  about the card is in its notes. `status` is `idle`, `running`, `done`, `rejected` or `error`;
  `attempts` counts the failures since a person last put it in play, which is what a lane's
  `maxAttempts` is spent against.
- **card note** — one thing said about a card. `kind` is `report` — what an agent made of it
  when it worked it — or `verdict`, a reviewing station's ruling, or `note`, something a person
  wants taken into account. Three names for one thing, because they *are* one thing: what is
  known about this card that is not the card. Every note is handed to the next agent that works
  it, so a note is how you tell that agent something without editing the card out from under
  whoever wrote it. Only a note is anybody's to rewrite; a report and a verdict are an account
  of what happened.
- **card event** — one move of a card: from a lane, to a lane, who, and the note that explains
  it. This is where a reviewer's reasons are pointed at, and where a person's are — it is the
  only record that knows a card was dragged. "Why is this card here?" is a question about the
  move that brought it, so the answer is kept on the move rather than on the card, where each
  new reason would erase the last.
- **run** — one execution of one agent: `kind` is `refine` or `card` — and `decompose` on rows
  from before breaking work up was a station — and the row
  keeps the status, timings, output or error, the tools called and the tokens spent. A run in
  flight can be called off (`stopCard`, `stopTask`), which aborts the request and finishes the
  run as `stopped` — neither a success nor a failure, so the card goes back to `idle` where it
  is, costs no attempt and follows neither arrow. Nothing whose run is going can be deleted;
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
in one sitting. Breaking one into the other is a station on the board, and keeping both means
every card can be traced back to the sentence that asked for it.

A task is a conversation and nothing else. Talking it over does not advance it through anything,
and it is not a stage work passes through on its way to the board:

```
chat ──"make cards"──▶ Intake ──expand──▶ Backlog ──▶ Doing ──▶ Review ──▶ Done
                       1 card             N children
```

There are two ways in, and they meet at the same door:

- **Talk it over.** The home page's chat box sends what you wrote to the refining agent, which
  answers in prose and rewrites the task's title and brief each turn. When the brief says what
  you meant, **Make cards** puts it on the board — one card, at the front door. The conversation
  is left where it is and you can go on talking about it afterwards.
- **Just make it.** If you already know what you want, every turn of conversation would only be
  you telling an agent what you already wrote down. **Put it on the board** writes the card
  straight away, with no task behind it. Over the API that is `submitCard`.

What becomes of that card is the board's business. Landing in a lane whose role is `expand` — the
seeded **Intake** — is what turns the one card into the several the work actually needs: the
agent is asked for a JSON array of cards, with a title, a body, acceptance criteria and the
titles of any cards that must finish first. It is parsed forgivingly, because failing a run over
a model's habit of saying "here you go:" first is not worth it, and a `dependsOn` naming a card
that is not in the list is dropped rather than failing the batch. The children land down the
lane's pass arrow, each carrying `parentId`, and the card they came from archives itself.

An expansion nobody could read a card out of is an error rather than an empty success: a card the
agent could not break up is exactly the case a person needs told about. And a lane that expands
with no pass arrow is refused before it runs, because its children would have nowhere to land.

If no lane on a board is marked `intake`, work arriving without one lands in the leftmost lane —
a guess, so the board says so out loud rather than quietly dropping cards at the left edge.

## The board is the pipeline

A new project comes with five lanes already wired:

```
Intake  ──▶  Backlog  ──▶  Doing  ──▶  Review  ──▶  Done
expand                     work        verdict
                              ▲            │
                              └── on FAIL ─┘
```

Intake, Doing and Review are all staffed by whatever agent this server has; what makes them
different is the kind of lane each one is.

There is no workflow engine here. `roleId`, `agentId`, `onSuccessLaneId`, `archiveOnSuccess` and
`onFailureLaneId` on the lane rows are the whole of it, which means the pipeline is whatever board someone drew — add
a lane called "Needs a human" with no agent on it and cards sent there stop, because that is what
a lane with no agent is.

Two rules are worth knowing because they are what keeps a board from running away:

**A card that passes into a staffed lane goes back to `idle`, not `done`.** It is not finished;
it is waiting for that lane's turn. `done` means nothing further will happen to it — it stayed
put, or it landed where no agent runs.

**A card a reviewer rejected stays `rejected`, unless the reviewer was given a budget.**
`rejected` is a status the worker will not pick up, so by default a rejected card waits for a
person rather than looping between two agents at whatever a token costs. `retryCard` — the
**Retry** button on the card — returns it to `idle` where it stands, and that is how a stopped
card is put back in play. Moving it does the same thing, since a moved card comes back to `idle`
too.

`rejected` is its own status, in its own colour, and not `error`, because the two want different
things from you. A reviewer saying no is the board working: there is a decision to make. A crash
is a fault: there is something to look at. Folding them together meant the board could not say
which of the two a card was, and meant a connection reset reached the next agent as though it
were review feedback.

**A station can be given attempts to spend, and then the board corrects itself.** `maxAttempts`
on a lane — **Attempts before a person**, in the lane dialog — is how many times that station
will send a card it failed back round instead of stopping. Zero, the default, is the behaviour
above. Set Review to 1 and a rejected card returns to Doing as `idle`, gets worked again with the
reviewer's reason in its prompt, and comes back for a second ruling; reject it twice and it stops
as `error`, waiting for a person as before. The budget belongs to the lane that *failed* the
card, not the one it goes back to, because how many times a thing is worth rejecting is the
judging station's call. A lane with no failure arm retries in place, which is how a flaky
executor gets a second go at its own card.

The count is on the card (`attempts`) and it does not reset when a card passes — a Doing↔Review
loop that refilled its budget every time round would never stop. Only a person resets it: Retry,
or moving the card. A run somebody stopped costs nothing, and neither does a restart; those are
nobody's verdict on the work. The card shows how many failed attempts it has had, so an `idle`
card that is idle for the second time says so.

The review verdict is a property of the output, not of the run: a reviewer that answers `FAIL`
has still run fine, so the run is `ok` and it is the card that failed. An answer that is neither
counts as a pass. A mumbling reviewer must not be able to wedge a board.

A verdict is also not an account of the work, so a judging station does not overwrite one: both
are notes on the card, of different kinds, and the ruling is additionally pointed at by the move
it caused — which is how the next agent round the loop is handed it as "Why this came back". A
second attempt without the reason for the first is the first attempt again. A pass is recorded
the same way — why a card was let through is worth keeping too, and it used to be thrown away.

The notes a *person* leaves arrive under their own heading, "Notes on this card". A rejection
explains one move and stops applying once the card is sent on; a note stands until whoever wrote
it takes it back. That is the whole difference, and it is why they are not the same paragraph.

What a card's prompt never contains is `error`. A crash is not feedback: an endpoint that reset
the connection has said nothing about the work, and an agent handed a stack trace under that
heading is being told the last attempt was wrong when nobody said so.

Reading an answer as a verdict is the **lane's** business, not the agent's: a lane judges
because it is a Review lane, which is what its role says. A new board has one such lane and the
lane dialog is where that moves — which is what lets the same agent judge cards at one station
and work them at another, and lets a board have two reviewing stations, or none.

A card whose dependencies have not finished is skipped by the worker rather than run out of
order, and asking for it by hand is refused with the count. Nothing is written to the card about
waiting: what it waits on is worked out from the cards around it whenever the question is asked —
by the board, which names them under the card, and by the `blockers` query. A stored answer was
written once and never revisited, so a card sat saying it was waiting long after the thing it
waited on had finished.

The card dialog is where an ordering is corrected, and it asks for the card's dependencies itself
rather than reading them off the board. The board does not carry archived cards, so it does not
carry a dependency on one either — a dialog that trusted it would show a shorter list than the
truth and then save that shorter list, which is how an archived dependency used to disappear. Here
they are drawn, marked `archived`, and kept. The list is searchable by title and lane, grouped by
lane in board order with each card's status beside it, and a card that already waits on this one —
directly or through a chain of others — is drawn but not selectable, with the reason on it, rather
than offered and then refused by the server after the save. Underneath the picker is the other
direction: what is waiting on this card, read-only, because changing that belongs in those cards'
own dialogs.

## Moving a card

Cards drag, by the grip on their left, and they also move with the arrows on the card. Both land
on the same `moveCard`, which puts the card in a lane at a position and renumbers that lane so
the board stays in the order it looks like — and brings the card back to `idle` with its error
cleared, which is why dragging a failed card is a retry.

Every move is written down, whoever made it: which lane it came from, which it went to, and why
if anybody said. `moveCard` takes a `note`, and an agent that picks the card up afterwards is
told it exactly the way it would be told a reviewer's rejection — moving a card back without
saying what was wrong with it buys a second attempt identical to the first.

The grip is a handle rather than the whole card being draggable, and that is about the keyboard
as much as the mouse: a card carries eight buttons, and a drag listener on the card itself would
take the space bar off every one of them. On the handle it is tab to reach, space to lift, arrows
to move, space to drop, escape to think better of it. The lane arrows stay because "two lanes to
the right" is one keystroke on an arrow and a dozen on a drag.

A drop is applied to the query cache before the server has answered, using the same arithmetic
the server does (`src/lib/board-order.ts`), because a card that jumps back for a moment reads as
broken. `tests/board-order.test.ts` drags cards against the real mutation and asserts the two
orders are the same one. A refusal — a card an agent picked up between the drop and the request —
puts the board back as it was. The board's own three-second poll stops while a card is in the air:
a lane that renumbers itself under the cursor is a card dropped where nobody aimed.

A card an agent is working does not drag at all. The server refuses to move it, so the board does
not offer to.

## Archiving a card

A board that has been worked for a while is mostly Done, and a Done pile long enough to scroll is
a lane nobody reads. Archiving takes a card off the board without deleting it: it stops being
drawn, stops being picked up by its lane's agent, and stops counting as something other cards are
waiting on — but it keeps its lane, its status and whatever the agent produced, and the **Archive**
page is where all of that can still be read. Restoring puts it back at the end of the lane it was
archived from, with its status untouched: a card archived as `error` comes back as one, because
what it was is usually why it was put away.

This is the middle answer between a Done pile that grows forever and a delete that cannot be
undone, and it is the one to reach for. Deleting is still there, on the archive page, for a card
that should never have existed.

Archiving is refused while an agent is working the card — stop it first — moving, running and
retrying are refused on an archived one, and deleting a lane is refused while it holds archived
cards. The board cannot show you those, and a lane takes its cards
with it when it goes.

It is also drawn at the top of its lane and its badge is green, because a run is the one thing on
a board that is happening rather than waiting, and hunting for it down a column of twenty is the
wrong way to find out what a project is doing. That is a view and not a move: `position` is left
alone, since a run that renumbered its lane would shuffle every other card on the way in and
shuffle them back on the way out. It stays honest with the drag arithmetic precisely because a
running card cannot be dropped onto — it is the one card whose drawn place and `position`
disagree, and nothing ever asks `landing` about it.

## Saving a board

The four lanes are a starting point, not the shape most projects end up with, and redrawing the
same five-lane board by hand for every new project is the kind of work a tool should not ask for.
`saveBoardTemplate` keeps a project's lanes — their names, their agents, their WIP limits, their
rework budgets, which of them judge cards rather than work them, and the arrows between them —
under a name, and
`applyBoardTemplate` draws them onto another project.
**Save as template** on the board and the **Board** picker in the new-project dialog are the two
ends of it.

The cards are not part of a template. A template is the shape of a board, not its contents.

Two things are worth knowing about how it is stored. The arrows are saved as **indexes into the
template's own lane list**, not lane ids, which is what makes a saved board portable — a lane id
belongs to one project and means nothing in another. And an `agentId` naming an agent this server
no longer has resolves to **no agent** rather than failing to apply: a template is a shape, and
the agents are whoever happens to be here. A lane that comes back without an agent is a resting
place, so a redrawn board stops rather than doing the wrong work.

Applying one is refused on a board that already has cards, with `HAS_CARDS`. Replacing lanes
deletes them, and a lane takes its cards with it — so this is for a project that has not started,
not a way to rearrange one that has. Saving under a name that is already taken replaces that
template, which is how one gets corrected.

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

The switch is in the frame rather than in project settings, on a strip under the heading of every
page that is about a project. Whether a board runs itself is a thing decided once and settings is
where those belong — but a board working on the wrong understanding of what you asked for is
stopped in a hurry, and it is noticed from whatever page you happened to be on. Pausing stops the
next card being picked up and does nothing to the runs already going, so the strip says how many
of those there are beside the switch that will not stop them.

Nothing survives the process that started it: an agent runs in memory, so a server killed
mid-run leaves rows saying `running` with nothing left alive to finish them — a run retention
will not prune and spend keeps counting, and a card holding a place under its lane's WIP limit
for good. The server puts those back on boot. Runs it cannot possibly still be doing are closed
as `error` and their cards return to `idle` to be picked up again. A conversation is not
something a restart can interrupt — a task has no state to be caught in the middle of — so there
is nothing to put back there. It costs a card no attempt: a restart is not a verdict on the work. The line the server
prints on the way up says how much it found.

## Agents and their tools

There are two pages, because they answer different questions. **Roles** are the kinds of lane a
board can be assembled out of — a prompt and the shape of the answer, and nothing about a model.
**Agents** are the models available to run work on, and nothing about a job. They meet only at a
lane. Three roles (`Doing`, `Review`, `Intake`) and one agent are seeded on first boot, with every
model setting left inheriting, so configuring one endpoint in Settings makes a board work.

The split is what makes a board's staff yours to define. Write a `Testing` role, add a lane of
that kind and point it at any agent you have: that is a new station, with no release involved.
Editing what every Review lane is told is one edit to the role rather than one per board, and a
lane may add its own paragraph on top without touching the kind. A role a lane is still of cannot
be deleted until nothing is of it.

The prompt a run starts with is four layers: the project's context (where you are), the agent's
`systemPrompt` (who it is — expected empty), the role's `prompt` (what happens here), and the
lane's `prompt` (and on this board). The lane speaks last, and a station whose lower three come
out empty is refused rather than run — background alone is nothing an agent can act on. The
card's own prompt then says what to do, and does not repeat where it is.

Inheritance is by sentinel, and it is worth knowing which: `0` means "inherit" for every numeric
knob except `temperature` and `maxRetries`, which use `-1` because `0` is a value someone may
genuinely want. Empty strings inherit the same way and `toolDiscovery` uses the word `inherit`.
`systemPrompt` inherits from nothing — it is the agent's own, and blank is the usual answer.

Which MCP servers an agent may reach is per agent (`setAgentServers`), because the answer differs
by model as much as by job: an agent working cards wants everything it can get, and one that only
ever judges them needs nothing. The connection pool is shared — a stdio server is a child process, and one
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

### The context window

A card carries more than a chat message does — a system prompt in four layers, the notes and the
verdicts said about it, and whatever the tools hand back over as many as twenty turns — so a run
can outgrow the model's window without anybody having written anything long. That used to arrive
as the endpoint's own complaint, which names a number nobody set:

    request (40368 tokens) exceeds the available context size (16384 tokens)

The window is now read from the model listing, which is where a server that says anything says
it: `context_length`, `max_context_window`, `max_model_len`, `context_window` or `n_ctx`,
whichever turns up, cached per endpoint. It shows against each model in the picker, and a request
that plainly cannot fit is refused before it is sent, with the figure and its source in the
message.

**Set Settings → Context window, or the agent's, when the endpoint is not to be believed.** It
usually is not: llama.cpp and Ollama report the window a model was *built* with and serve it in
whatever `-c` / `num_ctx` they were started with, so a 256k model can be listed as 256k and run
in 16k. The field is that number, and zero means ask the endpoint. The other half of the fix is
on the server — `llama-server -c 262144`, or `OLLAMA_CONTEXT_LENGTH=262144` — since a window the
model is not actually being served in is not one an agent can use.

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

The rows are half of where a card's own history is. Opening a card shows every run against it
merged with every move it made — the station and the agent, when, how long, how many tokens, and
between them the verdicts and the drags that put the card where it is. A run expands to what it
said or the error it died of; a verdict shows its first line without being asked, because a
one-line reason is the whole value of a review.

It reads oldest first, and says so, with a button to turn it round. A history is a story and a
story only reads forwards: a rejection makes sense after the attempt it was about and nonsense
before it. The Runs page is newest-first on purpose — it is a firehose across a whole board,
where the last thing to happen is the thing being looked for.

## What it has cost

`spend(projectId:)` adds up the tokens on a project's runs — `spend(taskId:)` narrows it to one
task, which is the conversation and every run of every card it became. It shows on the project
strip, so it is on every page the board is — including Runs, which is where you go to see what
the number was spent on — and on a task beside its cards.

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
               prompts, and run.ts — refine a task, and work a card
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
`models`, `mcpStatus`, `blockers` and `runEvents` on the query side; `refineTask`, `makeCard`,
`submitCard`, `runCard`, `stopCard`, `stopTask`, `moveCard`, `setAgentServers`,
`testMcpServer`, `reconnectMcp`, `setApiKey` and `setAgentApiKey` on the mutation side.

Tables are keyed in the plural and the schema is built with `typeNameMapper: "singularize"`, so
the singular and the plural of a table's own name are what tell one row from many: `card` and
`cards` on the query side, `createCard`/`createCards`, `updateCard`/`updateCards`,
`deleteCard`/`deleteCards` on the mutation side. Nothing carries a `Single` any more —
drizzle-graphql 13 lets the suffixes reach the update and delete pairs, which until then only the
insert one obeyed, and a `deleteCardSingle` that was really *the* delete read to an agent as a
variant it had to choose between.

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

Thirty-six tools, chosen in `server/mcp-endpoint.ts` rather than projected from the whole schema:

- **read** — `projects`, `lanes`, `cards`, `tasks`, `runs`, `agents`, `roles`, `run_events`,
  `card_events`, `card_notes`, `blockers`, `spend`, `board_templates`
- **projects** — `create_project`, `update_project`
- **tasks** — `create_task`, `refine_task`, `make_card`, `delete_task`
- **cards** — `submit_card`, `create_card`, `update_card`, `delete_card`, `set_card_deps`,
  `move_card`, `retry_card`, `archive_card`, `restore_card`, `run_card`, `stop_card`,
  `stop_task`, `add_card_note`, `update_card_note`, `delete_card_note`
- **boards** — `save_board_template`, `apply_board_template`

`submit_card` is the one to reach for: describe what you want and it lands at the board's front
door, without needing to know a lane id. It is one card, not many — if that lane is a station
that expands, the card becomes the cards that carry the work out as soon as it is worked, which
is why it does not have to be small. `create_card` is the exact way round — one piece of work you
already know the shape of, put straight into a lane you name.
`set_card_deps` writes the whole waiting list for a card at once, and refuses a list that would
close a loop — naming the cards in it, since cards that wait on each other never run.

Tool names are snake_case while the GraphQL fields they come from are camelCase: an MCP client
reads a tool name as a name, and snake_case is the convention it meets everywhere else. The
arguments and the fields in the answer are the schema's own, so they keep their spelling.

Several tools carry a `HINTS` line beyond their generated description, because a field generated
from a table describes itself only as "the `cards` query" and a visiting agent has no other way to
learn that a task is not a card, or that what moves a card along is the lane it is in.

Four **prompts** come with them, because a `HINTS` line is a line and the model behind this board
wants a page. `kanban_guide` takes no arguments and is the orientation — the five nouns, why a lane
with an agent is the only thing that makes work move, what each card status actually means, and the
three ways work gets onto a board. The other three are jobs of work: `start_project` stands a board
up and gets the first cards onto it, `submit_work` turns a request in somebody's own words into
work on a board that already exists, and `triage_board` reads a board's lanes, cards and runs and
says what is stuck and what to do about each one. A client that renders prompts as slash commands
gets them as `/kanban_guide` and friends; one that does not can fetch them like anything else.

They live in `server/mcp-prompts.ts`, and having them is why `mcp-endpoint.ts` writes out
`createHttpHandler`'s stateless path — a dozen lines of transport wiring — rather than calling it.
Nothing in graphql-mcp hands a caller the `McpServer` a request is served by, and a prompt has to be
registered on that server *before* it connects: the SDK declares `capabilities.prompts` as a side
effect of the first registration and refuses to declare a capability once a transport is attached,
so a server that registered late would answer `prompts/list` having told the client during
`initialize` that it had none. `createServerFactory` and `connectServer` are still the driver's own,
and the shared `tools/list` render and the argument guard are installed by the factory rather than
by the handler, so nothing is lost by owning those lines. cubicecho/graphql-mcp#20 asks for a hook
that would put it back to one call.

`mutationHints: "byName"` reads the conventional `create`/`update`/`delete` prefixes off the field
name, which settles most of the destructive/idempotent marks. The ones named after neither prefix
arrive under the conservative default — destructive, not idempotent — and are corrected by hand:
the two that run an agent destroy nothing and neither is idempotent (refining a task twice is
two turns of a conversation), the two front doors add a card and discard nothing but put two on
the board if asked twice, and `move_card`, `retry_card`, `archive_card` and `restore_card` are
idempotent and destroy nothing.
`stop_card` keeps its destructive mark, because aborting a run throws away whatever the agent had
done, and gains an idempotent one, because a second call finds nothing in flight and says so.

Left out on purpose: the settings row and `setApiKey` (which model runs where, on whose key, is
the operator's business, not a visiting agent's), writes to agents and MCP servers, the aggregates
and group-bys, every bulk mutation — `deleteCards` with no `where` empties the table, where
`deleteCard` cannot — and deleting a project, which takes its whole board and history with it
and is worth the walk to the UI. Each tool selects one level of fields, so a listing of cards
does not drag every run's output along with it.

The whole listing is about 662 kB, which is worth saying because it very nearly was not. The
generated filters reach through relations — a project filtered by its cards, each card filtered
back by its project — which costs nothing in the SDL, where a type is named rather than written
out. As the JSON Schema a tool advertises, a driver that rebuilds each type per route has to spell
that recursion out at every level, and the listing runs to megabytes of tool definitions handed
over before a client can call anything. graphql-mcp builds each input type once and emits a `$ref`
for the repeats, so the relation filters cost almost nothing and stay — `where: { cards: { some:
{ status: { eq: "error" } } } }` is a question worth being able to ask. A test holds every tool
under 100 kB and the listing under 1 MB, and asserts that a column offers only the operators it
can take: drizzle-graphql 12 stopped generating one filter shape for every column, so a timestamp
no longer advertises `ilike` and an enum no longer advertises `startsWith`.

Unknown fields in a tool's arguments are rejected rather than dropped: a misspelled key comes back
as `Unrecognized key: "order"` instead of a success with that part of the request quietly
discarded, which is the correction an agent can act on.

`run_card` and `refine_task` do not answer until the run is over, which for real work is
minutes. To watch one meanwhile, poll `run_events(runId, afterSeq)` — the snapshot form of
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

To run what a release published rather than building it, `docker-compose.example.yml` is the same
service with `image:` where the others have `build:`. It and `.env.example` are the whole of what
a server needs — no clone:

```sh
curl -O https://raw.githubusercontent.com/cubicecho/kanban-server/main/docker-compose.example.yml
curl -o .env https://raw.githubusercontent.com/cubicecho/kanban-server/main/.env.example
docker compose -f docker-compose.example.yml up -d
```

It runs `latest`, so the file is right whenever it is read; for a deployment worth caring about,
pin the version in it, because `latest` moves under a running server on the next `--pull always`
and an upgrade should be something someone decided to do. While the GHCR package is private a
pull wants `docker login ghcr.io` with a token that has `read:packages`.

`.env` is where compose looks for `TZ`, `OPENAI_API_KEY`, `KANBAN_SERVER_TOKEN` and
`POSTGRES_PASSWORD`; all four have a line in `.env.example`, and all four have a default, so an
empty one is a working server.

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
schema is created on first boot either way, and so is the database it lives in: an empty *server*
is all a postgres has to arrive with, which is what makes a shared instance one variable rather
than a variable and a `CREATE DATABASE` somebody has to run first. `docker-compose.pg.yml` is the
same image against a `postgres:17` service.

Finding the database missing is what triggers it, so the check costs one query on the connection
the migrations were about to open and needs no rights on the maintenance database at all; only a
missing one goes looking for `postgres` or `template1` to create it from. A role without
`CREATEDB` gets an error naming the statement to run by hand rather than a driver stack, and two
servers booting at once are safe — whichever loses the race takes the other's database. Set
`KANBAN_SERVER_CREATE_DATABASE=0` where that is the DBA's business, and a missing database is
reported instead. Note this is the server's own boot: `npm run db:migrate` is drizzle-kit and
still wants a database that exists.

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
