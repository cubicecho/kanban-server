import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { type GraphQLSchema, graphql } from "graphql";
import { afterAll, beforeAll, expect, test } from "vitest";
import { landing, laneOrder, placement } from "../web/lib/board-order.ts";

// The schema is built from the live Drizzle tables at import time, so the database has to be
// pointed somewhere disposable before anything under server/ is loaded.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kanban-server-test-"));
process.env.KANBAN_SERVER_DATA_DIR = dir;

let schema: GraphQLSchema;

beforeAll(async () => {
  const { ensureSchema } = await import("../server/db/migrate.ts");
  await ensureSchema();
  schema = (await import("../server/graphql/schema.ts")).schema;
});

afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

async function run(source: string, variableValues?: Record<string, unknown>) {
  const result = await graphql({ schema, source, variableValues });
  expect(result.errors).toBeUndefined();
  // biome-ignore lint/suspicious/noExplicitAny: assertions walk arbitrary GraphQL payloads.
  return result.data as Record<string, any>;
}

type Card = { id: string; laneId: string; position: number; title: string };

/** A board with two lanes and three cards in the first, which is enough to move one wrongly. */
async function board() {
  const { createProject } = await run(
    `mutation { createProject(values: { name: "dragged" }) { id } }`,
  );
  const projectId = createProject.id as string;
  const { lanes } = await run(
    `query Lanes($projectId: String!) {
       lanes(where: { projectId: { eq: $projectId } }, orderBy: { position: { direction: asc, priority: 1 } }) { id }
     }`,
    { projectId },
  );
  const laneIds = (lanes as { id: string }[]).map((lane) => lane.id);

  for (const title of ["A", "B", "C"]) {
    await run(
      `mutation Add($projectId: String!, $laneId: String!, $title: String!) {
         createCard(values: { projectId: $projectId, laneId: $laneId, title: $title }) { id }
       }`,
      { projectId, laneId: laneIds[0], title },
    );
  }
  return { projectId, laneIds };
}

const cardsOf = async (projectId: string) => {
  const { cards } = await run(
    `query Cards($projectId: String!) {
       cards(where: { projectId: { eq: $projectId } }, orderBy: { position: { direction: asc, priority: 1 } }) {
         id laneId position title status error
       }
     }`,
    { projectId },
  );
  return cards as (Card & { status: string; error: string })[];
};

const titlesIn = (cards: Card[], laneId: string) =>
  cards
    .filter((card) => card.laneId === laneId)
    .sort((a, b) => a.position - b.position)
    .map((card) => card.title);

const idOf = (cards: Card[], title: string) => cards.find((card) => card.title === title)?.id ?? "";

test("a drop lands where it was aimed, and the client works out the same order the server does", async () => {
  const { projectId, laneIds } = await board();
  const [backlog, doing] = laneIds;

  // Each case is a drop: what was dragged, what it was let go over, and the lane it ends in.
  const drops = [
    // Downwards past itself — the case an index read straight off the drop target gets wrong.
    {
      drag: "A",
      over: (cards: Card[]) => idOf(cards, "C"),
      lane: backlog,
      expect: ["B", "C", "A"],
    },
    // Upwards, onto the card it should end up above.
    {
      drag: "C",
      over: (cards: Card[]) => idOf(cards, "B"),
      lane: backlog,
      expect: ["C", "B", "A"],
    },
    // Into another lane, onto nothing in particular: the lane's own space means the end.
    { drag: "B", over: () => `lane:${doing}`, lane: doing, expect: ["B"] },
    // And onto a card in that lane, which means above it.
    { drag: "A", over: (cards: Card[]) => idOf(cards, "B"), lane: doing, expect: ["A", "B"] },
  ];

  for (const drop of drops) {
    const before = await cardsOf(projectId);
    const activeId = idOf(before, drop.drag);
    const to = landing(before, laneIds, activeId, drop.over(before));
    expect(to, `dropping ${drop.drag}`).not.toBeNull();
    if (!to) return;
    expect(to.laneId).toBe(drop.lane);

    // What the board would show before the server has answered.
    const optimistic = placement(before, { cardId: activeId, ...to });

    await run(
      `mutation Move($cardId: String!, $laneId: String!, $position: Int) {
         moveCard(cardId: $cardId, laneId: $laneId, position: $position) { id }
       }`,
      { cardId: activeId, laneId: to.laneId, position: to.position },
    );

    const after = await cardsOf(projectId);
    expect(titlesIn(after, to.laneId), `after dropping ${drop.drag}`).toEqual(drop.expect);
    // The two orders are the same one, which is what stops a dropped card moving twice.
    expect(optimistic).toEqual(
      after
        .filter((card) => card.laneId === to.laneId)
        .sort((a, b) => a.position - b.position)
        .map((card) => card.id),
    );
  }
});

test("a drop that means nothing is not a move", async () => {
  const { projectId, laneIds } = await board();
  const cards = await cardsOf(projectId);
  const a = idOf(cards, "A");

  // Onto itself, which is where it already is.
  expect(landing(cards, laneIds, a, a)).toBeNull();
  // Onto a lane that is not on this board — another project's, or a stale id.
  expect(landing(cards, laneIds, a, "lane:nowhere")).toBeNull();
  // A card that is not here at all.
  expect(landing(cards, laneIds, "not-a-card", idOf(cards, "B"))).toBeNull();

  // Dropping a card on its own lane's space is a move to the end, not a no-op — [A, B, C]
  // becomes [B, C, A], which is what letting go below the last card looks like.
  expect(landing(cards, laneIds, a, `lane:${laneIds[0]}`)).toEqual({
    laneId: laneIds[0],
    position: 2,
  });
});

test("a moved card comes back to idle, and the client's guess says so too", async () => {
  const { projectId, laneIds } = await board();
  const before = await cardsOf(projectId);
  const failed = before.find((card) => card.title === "A");
  if (!failed) throw new Error("no card A");

  // A card a reviewer rejected: `error`, and waiting for a person.
  await run(
    `mutation Fail($id: String!) {
       updateCard(where: { id: { eq: $id } }, set: { status: error, error: "rejected" }) { id }
     }`,
    { id: failed.id },
  );

  await run(
    `mutation Move($cardId: String!, $laneId: String!, $position: Int) {
       moveCard(cardId: $cardId, laneId: $laneId, position: $position) { id }
     }`,
    { cardId: failed.id, laneId: laneIds[1], position: 0 },
  );

  const moved = (await cardsOf(projectId)).find((card) => card.id === failed.id);
  expect(moved).toMatchObject({ laneId: laneIds[1], position: 0, status: "idle", error: "" });
});

test("a running card is drawn at the top of its lane, and the drag arithmetic is unmoved", () => {
  // Running in the middle by position, which is the case the display order has to survive.
  const cards = [
    { id: "a", laneId: "one", position: 0, status: "idle" },
    { id: "r", laneId: "one", position: 1, status: "running" },
    { id: "b", laneId: "one", position: 2, status: "idle" },
    { id: "elsewhere", laneId: "two", position: 0, status: "running" },
  ];

  expect(laneOrder(cards, "one").map((card) => card.id)).toEqual(["r", "a", "b"]);
  // A view and not a move: nothing was renumbered to put it there.
  expect(cards.map((card) => card.position)).toEqual([0, 1, 2, 0]);

  // Dropping A onto B is dropping it below B on the board, and it has to still be below B once
  // the running card has been pulled back to the top. `landing` reads `position`, which is why
  // a running card is not a drop target: nothing is ever dropped onto the card that moved.
  const to = landing(cards, ["one", "two"], "a", "b");
  expect(to).toEqual({ laneId: "one", position: 2 });
  if (!to) return;

  const order = placement(cards, { cardId: "a", ...to });
  const moved = cards.map((card) =>
    order.includes(card.id) ? { ...card, position: order.indexOf(card.id) } : card,
  );
  expect(laneOrder(moved, "one").map((card) => card.id)).toEqual(["r", "b", "a"]);
});
