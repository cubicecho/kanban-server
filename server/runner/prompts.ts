import type { Card, Project, Task } from "../db/schema.ts";

/**
 * What the four built-in roles are told, and the shape of what they are asked to send back.
 *
 * Two of the three jobs here need an answer a program can act on rather than prose, so both
 * ask for JSON and both are parsed forgivingly — see `side-task.ts`. Being strict about the
 * wrapper would fail runs over a model's habit of saying "here you go:" first, which is not a
 * thing worth failing a run over.
 */

export const REFINE_SYSTEM = `You help someone turn a rough request into a task worth working on.

Ask about what is genuinely ambiguous, one or two things at a time — not a questionnaire. Where
the answer is obvious from what they have already said, assume it and say that you did. Keep the
brief in their vocabulary; do not pad it with sections they did not ask for.

Answer with JSON and nothing else:

{
  "reply": "what you want to say to them, in plain prose",
  "title": "a short name for the task",
  "brief": "the current best statement of the whole task, rewritten each turn"
}

The brief is what a decomposer will read without seeing this conversation, so it has to stand
on its own. Carry forward everything already settled; never shorten it to a summary.`;

export const DECOMPOSE_SYSTEM = `You break one task into the cards that would carry it out.

A card is one sitting of work with a result someone could check. Split where the work genuinely
changes shape — a migration, then the endpoint that reads it, then the page that calls it — and
not merely to make the list longer. Between three and ten cards is usual; one card is a fine
answer for a small task.

Answer with a JSON array and nothing else:

[
  {
    "title": "imperative, under about ten words",
    "body": "what to do and what to watch out for",
    "acceptance": "how someone can tell this card is done",
    "dependsOn": ["exact titles of cards in this list that must finish first"]
  }
]

Order the array so a card never depends on one after it. Use "dependsOn" only for a real
ordering constraint; parallel cards should have none.`;

export const EXECUTE_SYSTEM = `You carry out one card of work using the tools available to you.

Do the work rather than describing it. When a tool fails, say so plainly and say what you tried;
do not report success you did not have. Finish by stating what you changed and how it can be
checked against the card's acceptance criteria.`;

export const REVIEW_SYSTEM = `You review one card of work that another agent has finished.

Check it against the card's acceptance criteria and nothing else — not style, not what you would
have done differently. Begin your reply with PASS or FAIL on its own line, then say why in a
sentence or two. FAIL means a criterion is not met; say which one.`;

/**
 * The roles a fresh install comes with: the four jobs this server knows how to ask for.
 *
 * They are ordinary rows and may be edited, renamed or joined by others — a board wanting a
 * tester writes one. These four are seeded because two of them (`refine` and `decompose`) have
 * an output contract the server itself parses, and the other two are what `seedLanes` wires a
 * new board to; a server with none of them draws boards nothing runs on.
 */
export const DEFAULT_ROLES = [
  {
    name: "refiner",
    stage: "refine" as const,
    description: "Talks a rough request into a task worth working on",
    systemPrompt: REFINE_SYSTEM,
  },
  {
    name: "decomposer",
    stage: "decompose" as const,
    description: "Turns an accepted task into the cards that carry it out",
    systemPrompt: DECOMPOSE_SYSTEM,
  },
  {
    name: "executor",
    stage: "card" as const,
    description: "Works a card using the tools it has been given",
    systemPrompt: EXECUTE_SYSTEM,
  },
  {
    name: "reviewer",
    stage: "card" as const,
    description: "Checks a finished card against its acceptance criteria, PASS or FAIL",
    systemPrompt: REVIEW_SYSTEM,
  },
];

/** The role a lane's Doing station is wired to on a fresh board, and the one Review gets. */
export const EXECUTOR_ROLE = "executor";
export const REVIEWER_ROLE = "reviewer";

/**
 * One agent per seeded role, so the first task has something to run on.
 *
 * Each leaves `systemPrompt` empty and takes its role's, which is the whole point of the split:
 * changing what an executor is told is one edit to one role, not an edit to every agent doing
 * that job. Every model setting is left inheriting from settings, so configuring one endpoint
 * configures all four.
 */
export const DEFAULT_AGENTS = DEFAULT_ROLES.map((role) => ({ name: role.name, role: role.name }));

/** One card as JSON, before it is a row: what the decomposer is asked for. */
export interface DecomposedCard {
  title: string;
  body?: string;
  acceptance?: string;
  dependsOn?: string[];
}

/**
 * The project's own background, ahead of whatever the agent was asked to do.
 *
 * Every agent working a project needs the same paragraph about it, and putting it in each
 * card's prompt would mean the decomposer writing it out ten times.
 */
export const projectContext = (project: Project): string =>
  [
    `Project: ${project.name}`,
    project.description ? `\n${project.description}` : "",
    project.context ? `\n\n${project.context}` : "",
  ]
    .join("")
    .trim();

/** What the decomposer is given: the project it is for, and the task to break up. */
export const decomposePrompt = (project: Project, task: Task): string =>
  `${projectContext(project)}\n\nTask: ${task.title || "(untitled)"}\n\n${task.brief}`.trim();

/**
 * What an agent working a card is given: the project, the card, and its criteria.
 *
 * `note` is the reason the card is in this lane, off the ledger — a reviewer's FAIL in its own
 * words, or what a person said when they dragged it back. An agent picking up a card that came
 * back needs that, or a second attempt is the first one again.
 *
 * What it is deliberately *not* given is `card.error`. That is where a crash goes, and a crash
 * is not feedback: an endpoint that reset the connection has said nothing about the work, and
 * handing an agent a stack trace under the heading "why this came back" was how a broken
 * network read as a review.
 */
export const cardPrompt = (project: Project, card: Card, note = ""): string =>
  [
    projectContext(project),
    `\n\nCard: ${card.title}`,
    card.body ? `\n\n${card.body}` : "",
    card.acceptance ? `\n\nDone when:\n${card.acceptance}` : "",
    // An agent judging a card is reading the same card another just worked, so it needs what
    // came out of that as well as what went in.
    card.result ? `\n\nWhat the last agent reported:\n${card.result}` : "",
    note ? `\n\nWhy this came back:\n${note}` : "",
  ]
    .join("")
    .trim();
