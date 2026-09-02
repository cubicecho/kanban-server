import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { type GraphQLSchema, graphql } from "graphql";
import { afterAll, beforeAll, expect, test } from "vitest";

// The schema is built from the live Drizzle tables at import time, so the database has to be
// pointed somewhere disposable before anything under server/ is loaded.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kanban-server-test-"));
process.env.KANBAN_SERVER_DATA_DIR = dir;

let schema: GraphQLSchema;
let db: typeof import("../server/db/client.ts").db;
let tables: typeof import("../server/db/schema.ts");

beforeAll(async () => {
  const { ensureSchema } = await import("../server/db/migrate.ts");
  await ensureSchema();
  schema = (await import("../server/graphql/schema.ts")).schema;
  db = (await import("../server/db/client.ts")).db;
  tables = await import("../server/db/schema.ts");
});

afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

async function run(source: string, variableValues?: Record<string, unknown>) {
  const result = await graphql({ schema, source, variableValues });
  expect(result.errors).toBeUndefined();
  // biome-ignore lint/suspicious/noExplicitAny: assertions walk arbitrary GraphQL payloads.
  return result.data as Record<string, any>;
}

/** The same call, kept when the point of the test is the message that comes back. */
const fails = async (source: string, variableValues?: Record<string, unknown>) => {
  const result = await graphql({ schema, source, variableValues });
  return result.errors?.map((error) => error.message).join("\n") ?? "";
};

const newProject = async (name: string) => {
  const { createProject } = await run(
    `mutation Create($name: String!) { createProject(values: { name: $name }) { id name } }`,
    { name },
  );
  return createProject as { id: string; name: string };
};

const board = async (projectId: string) => {
  const { lanes } = await run(
    `query Board($projectId: String!) {
       lanes(where: { projectId: { eq: $projectId } }, orderBy: { position: { direction: asc, priority: 1 } }) {
         id name position intake wipLimit maxAttempts onSuccessLaneId onFailureLaneId agentId
       }
     }`,
    { projectId },
  );
  return lanes as {
    id: string;
    name: string;
    position: number;
    intake: boolean;
    wipLimit: number;
    maxAttempts: number;
    onSuccessLaneId: string | null;
    onFailureLaneId: string | null;
    agentId: string | null;
  }[];
};

test("a new project comes with a board already wired up", async () => {
  const project = await newProject("wired");
  const lanes = await board(project.id);

  expect(lanes.map((lane) => lane.name)).toEqual(["Backlog", "Doing", "Review", "Done"]);
  const [backlog, doing, review, done] = lanes;

  // Cards land in the backlog and nothing runs there — that is what a backlog is.
  expect(backlog.intake).toBe(true);
  expect(backlog.agentId).toBeNull();

  // Work flows Doing → Review → Done, and a rejected card goes back to Doing.
  expect(doing.onSuccessLaneId).toBe(review.id);
  expect(review.onSuccessLaneId).toBe(done.id);
  expect(review.onFailureLaneId).toBe(doing.id);
  expect(done.onSuccessLaneId).toBeNull();
});

test("the lanes are seeded per project, not shared between them", async () => {
  const first = await newProject("one");
  const second = await newProject("two");
  const [a, b] = [await board(first.id), await board(second.id)];
  expect(a).toHaveLength(4);
  expect(b).toHaveLength(4);
  expect(a.map((lane) => lane.id)).not.toEqual(b.map((lane) => lane.id));
});

test("moveCard renumbers the lane it lands in and puts the card back to idle", async () => {
  const project = await newProject("moving");
  const [backlog, doing] = await board(project.id);

  const make = async (title: string, laneId: string, position: number) =>
    (
      await run(
        `mutation Make($values: CreateCardInput!) { createCard(values: $values) { id title position } }`,
        { values: { projectId: project.id, laneId, title, position } },
      )
    ).createCard as { id: string; position: number };

  const first = await make("first", doing.id, 0);
  const second = await make("second", doing.id, 7);
  const stray = await make("stray", backlog.id, 0);

  const { moveCard } = await run(
    `mutation Move($cardId: String!, $laneId: String!) {
       moveCard(cardId: $cardId, laneId: $laneId) { id laneId position status }
     }`,
    { cardId: stray.id, laneId: doing.id },
  );
  expect(moveCard.laneId).toBe(doing.id);
  expect(moveCard.status).toBe("idle");

  const { cards } = await run(
    `query Cards($laneId: String!) {
       cards(where: { laneId: { eq: $laneId } }, orderBy: { position: { direction: asc, priority: 1 } }) {
         id title position
       }
     }`,
    { laneId: doing.id },
  );
  // Whatever the positions were before, the lane is 0..n-1 afterwards — nothing else can be
  // ordered against a lane that keeps a gap at 7.
  expect(cards.map((card: { title: string }) => card.title)).toEqual(["first", "second", "stray"]);
  expect(cards.map((card: { position: number }) => card.position)).toEqual([0, 1, 2]);
  expect([first.id, second.id]).toContain(cards[0].id);
});

test("retryCard puts a rejected card back in play where it stands", async () => {
  const project = await newProject("retrying");
  const [, doing] = await board(project.id);

  const { createCard } = await run(
    `mutation Make($values: CreateCardInput!) { createCard(values: $values) { id } }`,
    { values: { projectId: project.id, laneId: doing.id, title: "rejected", position: 0 } },
  );
  // What a reviewer's FAIL leaves behind: back in Doing, out of budget, and in a status the
  // worker will not pick up. Nothing on the card says why — the reason is on the move that
  // brought it here, which is why a retry can clear the status without erasing the feedback.
  await run(
    `mutation Fail($id: String!) {
       updateCardSingle(
         where: { id: { eq: $id } }
         set: { status: rejected, attempts: 3 }
       ) { id }
     }`,
    { id: createCard.id },
  );

  const { retryCard } = await run(
    `mutation Retry($cardId: String!) {
       retryCard(cardId: $cardId) { id laneId status error attempts }
     }`,
    { cardId: createCard.id },
  );
  expect(retryCard).toMatchObject({
    id: createCard.id,
    laneId: doing.id,
    status: "idle",
    error: "",
    // A person putting a card back in play is a fresh start, budget and all: otherwise a card
    // that had used up its lane's attempts would come straight back to the same standstill.
    attempts: 0,
  });

  // The other thing a person retries is a card that broke rather than one that was turned
  // down, and that one has a fault written on it for the retry to clear.
  const { createCard: crashed } = await run(
    `mutation Make($values: CreateCardInput!) { createCard(values: $values) { id } }`,
    { values: { projectId: project.id, laneId: doing.id, title: "crashed", position: 1 } },
  );
  await run(
    `mutation Break($id: String!) {
       updateCardSingle(
         where: { id: { eq: $id } }
         set: { status: error, error: "ECONNREFUSED" }
       ) { id }
     }`,
    { id: crashed.id },
  );
  const retried = await run(
    `mutation Retry($cardId: String!) { retryCard(cardId: $cardId) { status error } }`,
    { cardId: crashed.id },
  );
  expect(retried.retryCard).toMatchObject({ status: "idle", error: "" });

  expect(await fails(`mutation { retryCard(cardId: "nope") { id } }`)).toMatch(/no card with id/);
});

test("blockers names what a card is waiting on, and stops naming it when it stops", async () => {
  const project = await newProject("waiting");
  const [backlog] = await board(project.id);

  const make = async (title: string) =>
    (
      await run(`mutation Make($values: CreateCardInput!) { createCard(values: $values) { id } }`, {
        values: { projectId: project.id, laneId: backlog.id, title },
      })
    ).createCard as { id: string };

  const migration = await make("write the migration");
  const endpoint = await make("read it from the endpoint");
  const page = await make("call it from the page");

  await run(
    `mutation Set($cardId: String!, $dependsOn: [String!]!) { setCardDeps(cardId: $cardId, dependsOn: $dependsOn) }`,
    { cardId: page.id, dependsOn: [migration.id, endpoint.id] },
  );

  const waitingOn = async (cardId: string) =>
    (
      (await run(`query B($cardId: String!) { blockers(cardId: $cardId) { title } }`, { cardId }))
        .blockers as { title: string }[]
    )
      .map((card) => card.title)
      .sort();

  expect(await waitingOn(page.id)).toEqual(["read it from the endpoint", "write the migration"]);
  // A card nothing is ordered against waits on nothing — not on an empty answer meaning
  // "unknown", which is what a stored `waiting on: …` string decayed into.
  expect(await waitingOn(migration.id)).toEqual([]);

  await run(
    `mutation Done($id: String!) {
       updateCardSingle(where: { id: { eq: $id } }, set: { status: done }) { id }
     }`,
    { id: migration.id },
  );
  // Nothing was rewritten anywhere for this to change: the answer is worked out when it is
  // asked for, so it is right the moment the card it is about finishes.
  expect(await waitingOn(page.id)).toEqual(["read it from the endpoint"]);

  // And an archived card is not in the way. It is off the board, and a dependent waiting on
  // one nobody can find would wait for good.
  await run(`mutation Archive($cardId: String!) { archiveCard(cardId: $cardId) { id } }`, {
    cardId: endpoint.id,
  });
  expect(await waitingOn(page.id)).toEqual([]);
});

test("setCardDeps writes an ordering as a set, and refuses one that closes a loop", async () => {
  const project = await newProject("ordering");
  const other = await newProject("elsewhere");
  const [backlog] = await board(project.id);
  const [elsewhere] = await board(other.id);

  const make = async (title: string, laneId = backlog.id) =>
    (
      await run(`mutation Make($values: CreateCardInput!) { createCard(values: $values) { id } }`, {
        values: { projectId: laneId === backlog.id ? project.id : other.id, laneId, title },
      })
    ).createCard as { id: string };

  const migration = await make("write the migration");
  const endpoint = await make("read it from the endpoint");
  const page = await make("call it from the page");
  const stranger = await make("another board's card", elsewhere.id);

  const set = (cardId: string, dependsOn: string[]) =>
    run(
      `mutation Set($cardId: String!, $dependsOn: [String!]!) { setCardDeps(cardId: $cardId, dependsOn: $dependsOn) }`,
      {
        cardId,
        dependsOn,
      },
    );
  const setFails = (cardId: string, dependsOn: string[]) =>
    fails(
      `mutation Set($cardId: String!, $dependsOn: [String!]!) { setCardDeps(cardId: $cardId, dependsOn: $dependsOn) }`,
      {
        cardId,
        dependsOn,
      },
    );

  expect(await set(endpoint.id, [migration.id])).toEqual({ setCardDeps: [migration.id] });
  expect(await set(page.id, [endpoint.id, migration.id])).toEqual({
    setCardDeps: [endpoint.id, migration.id],
  });

  // A whole set, not an append: writing one id leaves one edge, whatever was there before.
  expect(await set(page.id, [endpoint.id])).toEqual({ setCardDeps: [endpoint.id] });
  const { cards } = await run(
    `query Deps($id: String!) { cards(where: { id: { eq: $id } }) { deps { dependsOnCardId } } }`,
    { id: page.id },
  );
  expect(cards[0].deps.map((dep: { dependsOnCardId: string }) => dep.dependsOnCardId)).toEqual([
    endpoint.id,
  ]);

  // The three refusals, and each says which card is the problem.
  expect(await setFails(migration.id, [migration.id])).toMatch(/cannot wait on itself/);
  expect(await setFails(migration.id, [stranger.id])).toMatch(/Not cards on this board/);
  const loop = await setFails(migration.id, [page.id]);
  expect(loop).toMatch(/cycle/i);
  expect(loop).toContain("write the migration");
  expect(loop).toContain("call it from the page");

  // A refusal writes nothing: the ordering that was there is the ordering that is there.
  const after = await run(
    `query Deps($id: String!) { cards(where: { id: { eq: $id } }) { deps { dependsOnCardId } } }`,
    { id: migration.id },
  );
  expect(after.cards[0].deps).toEqual([]);

  // And an empty list is how a card is told it waits on nothing.
  expect(await set(page.id, [])).toEqual({ setCardDeps: [] });
});

test("the API never hands back a stored key", async () => {
  expect(await run(`mutation { setApiKey(apiKey: "sk-secret") }`)).toEqual({ setApiKey: true });
  // The write goes through; the column is not in the schema at all, so nothing can read it back
  // — not the UI, not an agent that got as far as this server's own MCP endpoint.
  expect(await fails(`{ settings { apiKey } }`)).toMatch(/apiKey/);
  expect(await fails(`{ agents { apiKey } }`)).toMatch(/apiKey/);
});

test("runs are the server's own record: nothing outside it may write one", async () => {
  expect(await fails(`mutation { createRun(values: { kind: card }) { id } }`)).toMatch(
    /Cannot query field "createRun"|Unknown/,
  );
  expect(await fails(`mutation { updateRun(set: { status: ok }) { id } }`)).toMatch(
    /Cannot query field "updateRun"|Unknown/,
  );
});

test("submitting a task with no decomposer says so rather than leaving a task in limbo", async () => {
  const project = await newProject("no agents");
  const { submitTask } = await run(
    `mutation Submit($projectId: String!) {
       submitTask(projectId: $projectId, title: "ship it", brief: "make the thing") {
         id status error
       }
     }`,
    { projectId: project.id },
  );
  // Kept, not thrown away: the task is there to retry once an agent exists, and it says why.
  expect(submitTask.status).toBe("error");
  expect(submitTask.error).toMatch(/decompose/i);
});

test("spend adds up the runs behind it, and says how far back they go", async () => {
  const project = await newProject("what it cost");
  const { lanes } = await run(
    `query Lanes($projectId: String!) { lanes(where: { projectId: { eq: $projectId } }) { id } }`,
    { projectId: project.id },
  );
  const laneId = lanes[0].id as string;

  const [task] = await db
    .insert(tables.tasks)
    .values({ projectId: project.id, title: "the expensive one", brief: "..." })
    .returning();
  const [card] = await db
    .insert(tables.cards)
    .values({ projectId: project.id, laneId, taskId: task.id, title: "its card" })
    .returning();
  const [other] = await db
    .insert(tables.cards)
    .values({ projectId: project.id, laneId, title: "somebody else's card" })
    .returning();

  const day = 24 * 60 * 60 * 1000;
  const tokens = (n: number) => ({
    promptTokens: n,
    completionTokens: n,
    totalTokens: n * 2,
    status: "ok" as const,
  });
  await db.insert(tables.runs).values([
    // The task's own refinement, and a run of the card it was broken into: both are its cost.
    { projectId: project.id, taskId: task.id, kind: "refine", ...tokens(10) },
    { projectId: project.id, cardId: card.id, kind: "card", ...tokens(100) },
    // Another card's run: the project paid for it, the task did not.
    { projectId: project.id, cardId: other.id, kind: "card", ...tokens(1000) },
    // Older than the window asked for, and so outside every total below.
    {
      projectId: project.id,
      cardId: other.id,
      kind: "card",
      startedAt: new Date(Date.now() - 40 * day),
      ...tokens(9999),
    },
  ]);

  const { spend } = await run(
    `query Spend($projectId: String!) {
       spend(projectId: $projectId, days: 30) { runs promptTokens totalTokens days retentionDays from }
     }`,
    { projectId: project.id },
  );
  expect(spend).toMatchObject({
    runs: 3,
    promptTokens: 1110,
    totalTokens: 2220,
    days: 30,
    // Nothing is swept by default, so the window is the whole truth.
    retentionDays: 0,
  });
  // The oldest run counted, which is what the number actually covers — not the window asked for.
  expect(new Date(spend.from).getTime()).toBeGreaterThan(Date.now() - day);

  const { spend: forTask } = await run(
    `query Spend($projectId: String!, $taskId: String!) {
       spend(projectId: $projectId, taskId: $taskId, days: 30) { runs totalTokens }
     }`,
    { projectId: project.id, taskId: task.id },
  );
  expect(forTask).toEqual({ runs: 2, totalTokens: 220 });

  // Zero days is everything still kept, which is the run the window left out.
  const { spend: everything } = await run(
    `query Spend($projectId: String!) {
       spend(projectId: $projectId, days: 0) { runs totalTokens }
     }`,
    { projectId: project.id },
  );
  expect(everything).toEqual({ runs: 4, totalTokens: 22218 });

  // A project nobody has run anything on says so rather than dividing by nothing.
  const empty = await newProject("untouched");
  const { spend: nothing } = await run(
    `query Spend($projectId: String!) { spend(projectId: $projectId) { runs totalTokens from } }`,
    { projectId: empty.id },
  );
  expect(nothing).toEqual({ runs: 0, totalTokens: 0, from: null });
});

test("a board saved under a name is drawn onto the next project the same shape", async () => {
  const source = await newProject("the one worth keeping");
  const drawn = await board(source.id);

  // A shape worth saving is one somebody changed: a fifth lane, a cap, a rework budget, and an
  // arrow home.
  const [, doing, review, done] = drawn;
  await run(
    `mutation Widen($id: String!) {
       updateLaneSingle(where: { id: { eq: $id } }, set: { wipLimit: 3 }) { id }
     }`,
    { id: doing.id },
  );
  await run(
    `mutation Budget($id: String!) {
       updateLaneSingle(where: { id: { eq: $id } }, set: { maxAttempts: 2 }) { id }
     }`,
    { id: review.id },
  );
  const [parked] = await db
    .insert(tables.lanes)
    .values({
      projectId: source.id,
      name: "Parked",
      position: 4,
      onSuccessLaneId: done.id,
      // An agent that will not be here when the template is drawn again.
      agentId: null,
    })
    .returning();

  const { saveBoardTemplate } = await run(
    `mutation Save($projectId: String!) {
       saveBoardTemplate(projectId: $projectId, name: "five lanes", description: "with a parking bay") {
         id name description
       }
     }`,
    { projectId: source.id },
  );
  expect(saveBoardTemplate).toMatchObject({
    name: "five lanes",
    description: "with a parking bay",
  });

  const target = await newProject("the next one");
  const { applyBoardTemplate } = await run(
    `mutation Apply($projectId: String!, $templateId: String!) {
       applyBoardTemplate(projectId: $projectId, templateId: $templateId) { id name position }
     }`,
    { projectId: target.id, templateId: saveBoardTemplate.id },
  );
  expect(applyBoardTemplate.map((lane: { name: string }) => lane.name)).toEqual([
    "Backlog",
    "Doing",
    "Review",
    "Done",
    "Parked",
  ]);

  // The arrows are the point: saved as indexes, they come back pointing at the new lanes.
  const redrawn = await board(target.id);
  const [newBacklog, newDoing, newReview, newDone, newParked] = redrawn;
  expect(newDoing.onSuccessLaneId).toBe(newReview.id);
  expect(newReview.onFailureLaneId).toBe(newDoing.id);
  expect(newParked.onSuccessLaneId).toBe(newDone.id);
  expect(newDone.onSuccessLaneId).toBeNull();
  expect(newBacklog.intake).toBe(true);
  expect(newDoing.wipLimit).toBe(3);
  expect(newReview.maxAttempts).toBe(2);
  // A lane nobody gave a budget to has none, not the one next door.
  expect(newDoing.maxAttempts).toBe(0);
  // Nothing of the board it came from: different project, different lanes.
  expect(redrawn.map((lane) => lane.id)).not.toContain(parked.id);

  // Saving again under the same name corrects the template rather than making a second one.
  const { saveBoardTemplate: again } = await run(
    `mutation Save($projectId: String!) {
       saveBoardTemplate(projectId: $projectId, name: "five lanes", description: "") { id }
     }`,
    { projectId: target.id },
  );
  expect(again.id).toBe(saveBoardTemplate.id);
  const { boardTemplates } = await run(
    `query Templates { boardTemplates(where: { name: { eq: "five lanes" } }) { id } }`,
  );
  expect(boardTemplates).toHaveLength(1);
});

test("a template names its agents by id, and forgets the ones this server no longer has", async () => {
  const [role] = await db
    .select()
    .from(tables.roles)
    .where(eq(tables.roles.name, "executor"))
    .limit(1);
  const [agent] = await db
    .insert(tables.agents)
    .values({ name: "a passing executor", roleId: role.id, model: "none", baseUrl: "http://x" })
    .returning();

  const source = await newProject("staffed");
  const [, doing] = await board(source.id);
  await db.update(tables.lanes).set({ agentId: agent.id }).where(eq(tables.lanes.id, doing.id));

  const { saveBoardTemplate } = await run(
    `mutation Save($projectId: String!) {
       saveBoardTemplate(projectId: $projectId, name: "staffed board") { id }
     }`,
    { projectId: source.id },
  );

  // Kept while the agent exists: a template drawn onto a live server should still work cards.
  const kept = await newProject("same server");
  await run(
    `mutation Apply($projectId: String!, $templateId: String!) {
       applyBoardTemplate(projectId: $projectId, templateId: $templateId) { id }
     }`,
    { projectId: kept.id, templateId: saveBoardTemplate.id },
  );
  expect((await board(kept.id))[1].agentId).toBe(agent.id);

  // Gone, and the lane comes back without one rather than the whole template failing.
  await db.delete(tables.agents).where(eq(tables.agents.id, agent.id));
  const after = await newProject("agent since removed");
  await run(
    `mutation Apply($projectId: String!, $templateId: String!) {
       applyBoardTemplate(projectId: $projectId, templateId: $templateId) { id }
     }`,
    { projectId: after.id, templateId: saveBoardTemplate.id },
  );
  const lanes = await board(after.id);
  expect(lanes).toHaveLength(4);
  expect(lanes[1].agentId).toBeNull();
});

test("a template is refused on a board with cards, because lanes take their cards with them", async () => {
  const source = await newProject("the template's home");
  const { saveBoardTemplate } = await run(
    `mutation Save($projectId: String!) {
       saveBoardTemplate(projectId: $projectId, name: "plain four") { id }
     }`,
    { projectId: source.id },
  );

  const started = await newProject("already going");
  const [backlog] = await board(started.id);
  await db
    .insert(tables.cards)
    .values({ projectId: started.id, laneId: backlog.id, title: "work in hand" });

  const message = await fails(
    `mutation Apply($projectId: String!, $templateId: String!) {
       applyBoardTemplate(projectId: $projectId, templateId: $templateId) { id }
     }`,
    { projectId: started.id, templateId: saveBoardTemplate.id },
  );
  expect(message).toMatch(/cards on it/i);
  // And the board it refused is untouched, not half-redrawn.
  expect(await board(started.id)).toHaveLength(4);

  // A project with no lanes at all has no shape to save.
  const bare = await newProject("about to be stripped");
  await db.delete(tables.lanes).where(eq(tables.lanes.projectId, bare.id));
  expect(
    await fails(
      `mutation Save($projectId: String!) {
         saveBoardTemplate(projectId: $projectId, name: "nothing at all") { id }
       }`,
      { projectId: bare.id },
    ),
  ).toMatch(/no lanes/i);
});
