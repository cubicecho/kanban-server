import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

/**
 * The prompts offered beside the tools, and the reason there are any.
 *
 * The tools are generated from the tables, so their descriptions can say what a column is and
 * never what the board does with it. `mcp-endpoint.ts` buys back a line of that per tool, but a
 * line is not room to explain that a task is not a card, or that a lane with an agent is the
 * only thing that makes work move. A prompt is: it is fetched deliberately, once, and it is the
 * one place a client can be handed the model rather than the schema.
 *
 * `kanban_guide` is that orientation and takes no arguments — read it before the first call.
 * The other three are jobs of work: standing a board up, putting a request onto one, and
 * finding out what is stuck. Each of them is written as instructions to the agent that fetched
 * it, naming the tools in the order they actually go, because the order is most of what is hard
 * to guess from a tool listing.
 *
 * Arguments are strings and are pasted into the text — MCP prompt arguments are strings by
 * definition, and there is nothing here to escape into.
 */

/** A board named the way a person would name it, rather than by id. */
const project = z
  .string()
  .describe("The board to work on, by name or id. Resolve it with the `projects` tool.");

const GUIDE = `You are driving a kanban server through its MCP tools. Read this before the
first call: those tools are generated from the database, so between them they describe every
field and none of the machinery.

## The five nouns

- **Project** — a board, and a body of work. \`context\` on it is the standing description every
  agent working the project is shown; \`autoRun\` says whether agents pick cards up by themselves
  or wait to be asked.
- **Lane** — a column, left to right by \`position\`. A lane with a \`roleId\` and an \`agentId\` is
  a *station*: the role is what kind of lane it is, the agent is which model works it. A lane
  without them is a resting place, which is what a backlog and a done pile are.
- **Role** — a kind of lane, shared across boards. Its \`contract\` is what happens to a card
  there: \`work\` reports on it, \`verdict\` rules PASS or FAIL on it, \`expand\` breaks it up.
- **Card** — the unit an agent executes. A title, a body, an \`acceptance\` it will be judged on,
  and a \`status\`.
- **Task** — a conversation about what somebody wants, in their own words. A task is not a card:
  it has no status and no pipeline, and its one exit is \`make_card\`, which writes it onto the
  board as a single card. Breaking that card up is a station's job, not a stage of its own.
- **Run** — one time an agent was asked to do something: refine a task, or work a card.

## The board is the pipeline

There is no workflow engine here. A lane says what happens to its cards (\`roleId\`), who does it
(\`agentId\`), how many at once (\`wipLimit\`), and where a card goes when its run succeeds
(\`onSuccessLaneId\`) or fails (\`onFailureLaneId\`). That is the whole of the automation, and the
shape of the pipeline is the shape of the board somebody drew. A new project arrives with five
lanes — Intake, Backlog, Doing, Review, Done — already carrying kinds and an agent, so it works
without being configured.

Intake is the front door and a station at once: a card dropped there is broken into the cards
that carry the work out, which land in Backlog while the card that asked for them is archived.
That is the only place decomposition happens, and it is a lane like any other — a board without
one is a board where a request stays a single card.

## Getting work onto a board

- Almost always: \`submit_card\` — one card through the front door, no lane id needed. It does
  not have to be small, because a front door that expands will break it up.
- You know exactly which station it should start at: \`create_card\` into a lane you picked out
  of \`lanes\`. This skips the front door, so nothing will expand it.
- The request is vague and wants talking over first: \`create_task\`, then \`refine_task\` for as
  many turns as it takes, then \`make_card\` once the brief is worth working.

Whatever you put in the body is all the first agent gets. Constraints, where the work lives, what
"done" looks like — none of it is in the room unless it is in the card or in the project's
\`context\`.

## Reading a status

\`idle\` is waiting for its lane's agent. \`running\` is being worked now. \`rejected\` is a review
the card did not pass. \`error\` is something that broke — a crash, a timeout, a run a restart
interrupted. \`done\` means nothing further will happen — a card that passes into a lane which has
an agent of its own goes back to \`idle\` instead, because it is not finished, it is waiting for
that lane's turn.

There is no status for waiting on a dependency: a card with unfinished dependencies is \`idle\`,
and \`blockers\` says what it is waiting on, worked out when you ask rather than stored and left
to go stale.

\`rejected\` and \`error\` are kept apart because they want different things from you: one is a
decision to make, the other is a fault to look at. A rejected card stays rejected so a
Doing-to-Review loop cannot spin without a person noticing; \`retry_card\` is the way back.

Why a card is where it is, in the words of whoever put it there, is in \`card_events\` — the
reviewer's reasons, or what a person said when they moved it. Nothing on the card itself carries
that: \`result\` is the last account of the *work*, and \`error\` is only ever a fault.

## When something has gone wrong

Read \`runs\` for the project, ordered by \`startedAt\` descending: a finished run carries its
output, its error, the tools it called and what it cost. Then either \`retry_card\`, which puts a
card back in play where it stands, or \`move_card\`, which sends it to a different station and
clears it to \`idle\` on the way.

## What is not on offer

Agents and MCP servers are readable but not editable, and the API key is not readable at all —
which model runs where, on whose key, is the operator's business rather than a visiting client's.
There are no bulk deletes: one row at a time, deliberately.

## Start here

Call \`projects\` to see what boards exist, then \`lanes\` for the one you want, so you know its
stations before you put anything into it.`;

/**
 * One prompt. `args` is a zod raw shape of strings because MCP prompt arguments are strings and
 * nothing else; `render` is handed whatever of them arrived, and an optional one may not have.
 */
type Prompt = {
  name: string;
  title: string;
  description: string;
  args?: Record<string, z.ZodString | z.ZodOptional<z.ZodString>>;
  render: (args: Record<string, string | undefined>) => string;
};

const PROMPTS: Prompt[] = [
  {
    name: "kanban_guide",
    title: "How this kanban server works",
    description:
      "Orientation for an agent about to drive this board: what a project, lane, card, task " +
      "and run are, how a lane's role and agent and its success and failure arrows make the " +
      "pipeline, the three ways work gets onto a board, and what each card status actually " +
      "means. Fetch this before the first tool call.",
    render: () => GUIDE,
  },
  {
    name: "start_project",
    title: "Stand up a board and get the first work onto it",
    description:
      "Creates a project, gives it the standing context its agents will read, optionally draws " +
      "a saved board template onto it, and puts the first card through its front door — in the " +
      "order those have to happen.",
    args: {
      goal: z.string().describe("What the project is for, in as much detail as you have."),
      name: z.string().optional().describe("What to call the board. Omit and one is chosen."),
    },
    render: (args: Record<string, string | undefined>) =>
      `Stand up a new kanban board for this work and get the first cards onto it.

**The work:** ${args.goal}
**Name:** ${args.name || "choose one — short, and about the work rather than about the board"}

In this order, because the order matters:

1. \`board_templates\`. If one of the saved shapes fits this work, plan on it now: a template can
   only be applied to a board with no cards, so it has to go on before any work does.
2. \`create_project\`. It arrives with Intake, Backlog, Doing, Review and Done already wired —
   Intake breaking work up, Doing working the cards and Review judging them, all staffed by an
   agent this server has. Put the standing description in \`context\` — what this project is,
   what it is working on, and any constraint that applies to every card in it. Every agent
   working the project is shown it, which makes it the one cheap place to say something once
   instead of in every card.
3. If a template fitted, \`apply_board_template\`, then read \`lanes\` back. A template naming an
   agent this server has not got leaves that lane without one, and a lane without an agent works
   nothing — it is a resting place. Check one lane still has \`intake\` set and a kind that
   expands, or the first card you send will simply sit where it lands.
4. \`submit_card\` with the first piece of work. It goes in whole; the front door is what breaks
   it up, so say everything rather than pre-dividing it yourself.
5. Leave \`autoRun\` alone until Intake has run and you have read the cards it wrote — that first
   card needs \`run_card\` by hand. When they look right, \`update_project_single\` with
   \`set: { autoRun: true }\` and the board starts working itself.

Finish by reporting the project id, its lanes and which agent is on each, and the cards that
landed.`,
  },
  {
    name: "submit_work",
    title: "Put a request onto an existing board",
    description:
      "Turns a request in somebody's own words into work on a board that already exists: " +
      "resolving the project, choosing which door to send it through, writing a body the first " +
      "agent can actually use, and checking what appeared.",
    args: {
      project,
      request: z.string().describe("What is being asked for, in the words it was asked in."),
    },
    render: (args: Record<string, string | undefined>) =>
      `Put this request onto an existing board as work.

**Board:** ${args.project}
**The request:** ${args.request}

1. Resolve the board with \`projects\`, matching on name or id. If nothing matches, say so rather
   than creating one — a second board under a similar name is worse than a question.
2. Read \`lanes\` for it, so you know which lane is the front door, what kind it is and which
   ones have agents.
3. Choose the door. \`submit_card\` unless you have a reason not to: it needs no lane id, and if
   the front door is a station that expands then the one card becomes the cards that carry the
   work out. \`create_card\` into a lane you named is for when you know exactly where the work
   should start — it skips the front door, so nothing will break it up.
4. Write the body properly, because it and the project's \`context\` are all the first agent
   gets, and a card written from a thin body is a card an agent has to guess at. Say what is
   wanted, where it lives, what must not change, and how anyone could tell it was done. That
   last part goes in \`acceptance\` when you are writing a card by hand: a criterion buried in a
   paragraph is one that gets skipped.
5. Read back what appeared — \`cards\` filtered to the project. A card at an expanding front door
   is one card now and several once it has been worked, so look again after it runs. If the
   cards have an order that matters, \`set_card_deps\` puts it back; a card waiting on an
   unfinished dependency is skipped rather than run out of turn.

Finish by reporting the ids of what you created and which lanes they are sitting in.`,
  },
  {
    name: "triage_board",
    title: "Find out what is stuck on a board",
    description:
      "Reads a board's lanes, cards, moves and runs, explains why each rejected, failed or " +
      "waiting card is where it is, and proposes one move per stuck card — retry, edit, move, " +
      "archive or delete.",
    args: { project },
    render: (args: Record<string, string | undefined>) =>
      `Work out what is stuck on this board and what should be done about it.

**Board:** ${args.project}

1. Resolve it with \`projects\`, then read \`lanes\` (in \`position\` order) and \`cards\` for it.
2. Say what the board looks like, grouped by \`status\`: what is running, what is waiting, what
   has failed, what is finished.
3. For every card in \`rejected\` or \`error\`, say *why* it is stuck rather than that it is. A
   \`rejected\` card failed its acceptance criteria and the reviewer said what was wrong: read it
   from \`card_events\` for that card, newest first. An \`error\` card broke, and the reason is on
   the run — \`runs\` for the project, newest first.
4. For every \`idle\` card, check \`blockers\` before proposing anything: a card waiting on an
   unfinished dependency is not stuck, it is queued. One waiting on something already archived,
   or on a card that will never be done, is a stale ordering worth clearing with
   \`set_card_deps\`.
5. Then propose exactly one move per stuck card:
   - \`retry_card\` — the failure was transient, or its cause was fixed elsewhere.
   - \`update_card_single\` and then \`retry_card\` — the card itself was wrong: too big, or vague
     about what done means.
   - \`move_card\` — the card belongs at a different station.
   - \`archive_card\` — nobody is going to do it, but it happened and is worth keeping. This is
     also what to reach for on a Done pile long enough to be in the way.
   - \`delete_card_single\` — it should never have been written. \`stop_card\` first if something
     is running on it.
6. Look at \`spend\` for the project while you are here, and mention it if the board has cost more
   than the work on it looks worth.

Say what you would do before doing any of it, unless you were told to just fix the board.`,
  },
];

/**
 * Registers the prompts on a freshly minted server, before it is connected.
 *
 * Before, not after: the SDK declares `capabilities.prompts` as a side effect of the first
 * registration, and refuses to declare a capability once a transport is attached. A server that
 * connected first would answer `prompts/list` while telling the client during `initialize` that
 * it had no prompts to list, which is the same as having none.
 */
export function registerPrompts(server: McpServer): void {
  for (const prompt of PROMPTS) {
    const config = { title: prompt.title, description: prompt.description };
    const render = (args: Record<string, string | undefined>) => ({
      messages: [
        { role: "user" as const, content: { type: "text" as const, text: prompt.render(args) } },
      ],
    });

    // A prompt that takes no arguments is registered without a schema rather than with an empty
    // one. The MCP schema makes `params.arguments` optional and a client with nothing to put
    // there omits it, at which point an empty object schema is handed `undefined` and refuses it
    // — "expected object, received undefined", for a prompt that wanted nothing. It is the same
    // trap `connectServer` disarms for `tools/call`, and it is not disarmed here.
    if (!prompt.args) {
      server.registerPrompt(prompt.name, config, () => render({}));
      continue;
    }
    server.registerPrompt(prompt.name, { ...config, argsSchema: prompt.args }, render);
  }
}
