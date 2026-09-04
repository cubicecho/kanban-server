import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { type GraphQLSchema, graphql } from "graphql";
import { afterAll, beforeAll, expect, test } from "vitest";

// The schema is built from the live Drizzle tables at import time, so the database has to be
// pointed somewhere disposable before anything under server/ is loaded.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kanban-server-permissions-"));
process.env.KANBAN_SERVER_DATA_DIR = dir;

let schema: GraphQLSchema;

beforeAll(async () => {
  const { ensureSchema } = await import("../server/db/migrate.ts");
  await ensureSchema();
  schema = (await import("../server/graphql/schema.ts")).schema;
});

afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

/** As the web app asks, which is as the person whose server this is. */
const asOperator = (source: string, variableValues?: Record<string, unknown>) =>
  graphql({ schema, source, variableValues, contextValue: { caller: "operator" } });

/** As a client on `/mcp` asks, which is the only other kind of caller there is. */
const asAgent = (source: string, variableValues?: Record<string, unknown>) =>
  graphql({ schema, source, variableValues, contextValue: { caller: "agent" } });

const errorsOf = (result: { errors?: readonly { message: string }[] }) =>
  result.errors?.map((error) => error.message).join("\n") ?? "";

async function newCard() {
  const project = await asOperator(
    `mutation { createProject(values: { name: "guarded" }) { id } }`,
  );
  // biome-ignore lint/suspicious/noExplicitAny: assertions walk arbitrary GraphQL payloads.
  const projectId = (project.data as any).createProject.id as string;
  const board = await asOperator(
    `query L($projectId: String!) {
       lanes(where: { projectId: { eq: $projectId } }, orderBy: { position: { direction: asc, priority: 1 } }) { id }
     }`,
    { projectId },
  );
  // biome-ignore lint/suspicious/noExplicitAny: assertions walk arbitrary GraphQL payloads.
  const laneId = (board.data as any).lanes[0].id as string;
  const made = await asOperator(
    `mutation M($values: CreateCardInput!) { createCard(values: $values) { id } }`,
    { values: { projectId, laneId, title: "guarded" } },
  );
  // biome-ignore lint/suspicious/noExplicitAny: assertions walk arbitrary GraphQL payloads.
  return { projectId, laneId, cardId: (made.data as any).createCard.id as string };
}

test("a bulk write is nobody's to make, whichever door they came in by", async () => {
  // `deleteCards` with no `where` empties the table, and `deleteCard` cannot. It was left out
  // of the tool listing, which decided what an agent was told about and nothing else; now it
  // is shut, and shut for the web app too, which has never had a reason to reach for one.
  for (const call of [asAgent, asOperator]) {
    expect(errorsOf(await call(`mutation { deleteCards { id } }`))).toMatch(
      /Not authorized to call Mutation.deleteCards/,
    );
  }
});

test("a mutation nothing named arrives shut", async () => {
  // The map denies every mutation it does not name, so a generated write that a new table
  // brings with it is refused until somebody decides otherwise. `updateAgentServersMany` is
  // one of forty-odd nobody has ever wanted: `setAgentServers` is the door.
  expect(
    errorsOf(await asOperator(`mutation { updateAgentServersMany(updates: []) { id } }`)),
  ).toMatch(/Not authorized to call Mutation.updateAgentServersMany/);
});

test("the operator may re-key and re-staff the server, and an agent may not", async () => {
  expect(errorsOf(await asOperator(`mutation { setApiKey(apiKey: "sk-operator") }`))).toBe("");
  expect(errorsOf(await asAgent(`mutation { setApiKey(apiKey: "sk-agent") }`))).toMatch(
    /Not authorized to call Mutation.setApiKey/,
  );

  const makeAgent = `mutation { createAgent(values: { name: "n", baseUrl: "u", model: "m" }) { id } }`;
  expect(errorsOf(await asAgent(makeAgent))).toMatch(/Not authorized to call Mutation.createAgent/);
  expect(errorsOf(await asOperator(makeAgent))).toBe("");

  // Which model runs where and on whose key is the operator's account of their own server.
  expect(errorsOf(await asAgent(`{ settings { id } }`))).toMatch(
    /Not authorized to call Query.settings/,
  );
  expect(errorsOf(await asOperator(`{ settings { id } }`))).toBe("");

  // The agents and the roles are readable either way, because a lane names one of each and a
  // client drawing a board has to be able to ask which exist.
  expect(errorsOf(await asAgent(`{ agents { id name } roles { id name } }`))).toBe("");
});

test("a table an agent may not read has more than one door, and they are all shut", async () => {
  // The generated schema offers a table four ways. Guarding the list and leaving the rest is
  // guarding the front door of a room with two: a group-by answers with the same column values
  // under a different heading, and an aggregate answers with the numeric ones.
  for (const source of [
    `{ settings { baseUrl } }`,
    `{ setting { baseUrl } }`,
    `{ settingsAggregate { count } }`,
    `{ settingsGroupBy(groupBy: [baseUrl]) { group { baseUrl } } }`,
    `{ mcpServers { headers env } }`,
    `{ mcpServersGroupBy(groupBy: [url]) { group { url } } }`,
    `{ agentServers { id } }`,
  ]) {
    expect(errorsOf(await asAgent(source)), source).toMatch(/Not authorized/);
    expect(errorsOf(await asOperator(source)), source).toBe("");
  }
});

test("and the way to a withheld table is shut from the table beside it", async () => {
  // A rule guards a field that is *resolved*, so the walk needs something at the end of it: an
  // agent wired to a server, which is what an operator's Agents page writes.
  const agent = await asOperator(
    `mutation { createAgent(values: { name: "wired", baseUrl: "u", model: "m" }) { id } }`,
  );
  const server = await asOperator(
    `mutation {
       createMcpServer(values: { slug: "s", label: "l", command: "c", headers: { auth: "sk" } }) {
         id
       }
     }`,
  );
  await asOperator(
    `mutation S($agentId: String!, $serverIds: [String!]!) {
       setAgentServers(agentId: $agentId, serverIds: $serverIds)
     }`,
    {
      // biome-ignore lint/suspicious/noExplicitAny: assertions walk arbitrary GraphQL payloads.
      agentId: (agent.data as any).createAgent.id,
      // biome-ignore lint/suspicious/noExplicitAny: assertions walk arbitrary GraphQL payloads.
      serverIds: [(server.data as any).createMcpServer.id],
    },
  );

  // `agents` is readable, because a lane names one. Walking from there to the MCP servers it is
  // wired to would hand a visiting agent `env` and `headers`, which are credentials in all but
  // name — so the rule is on the type rather than on the query that usually returns it.
  const walk = `{ agents { servers { server { headers env } } } }`;
  expect(errorsOf(await asAgent(walk))).toMatch(/Not authorized/);
  expect(errorsOf(await asOperator(walk))).toBe("");

  // A relation's aggregate answers with a type of its own, which the rule on the row type does
  // not reach.
  const counted = `{ agents { serversAggregate { count } } }`;
  expect(errorsOf(await asAgent(counted))).toMatch(/Not authorized/);
  expect(errorsOf(await asOperator(counted))).toBe("");
});

test("a card's lane, status and budget are the board's to write, not its author's", async () => {
  const { cardId, laneId } = await newCard();

  // Each of these has a door of its own that renumbers the lane and writes the ledger row
  // saying why the card moved. Going through the generated field would do neither.
  const set = async (fragment: string) =>
    errorsOf(
      await asOperator(
        `mutation U($id: String!) {
           updateCard(where: { id: { eq: $id } }, set: { ${fragment} }) { id }
         }`,
        { id: cardId },
      ),
    );

  expect(await set(`laneId: "${laneId}"`)).toMatch(/laneId is the board's to set/);
  expect(await set("status: done")).toMatch(/status is the board's to set/);
  expect(await set("attempts: 0")).toMatch(/attempts is the board's to set/);
  // The message names every column it refused, not just the first one it met.
  expect(await set("status: done, position: 3")).toMatch(/position, status/);

  // A refusal after the write would report `Forbidden` and still have moved the card, which is
  // the failure this guard exists to prevent — so the card itself is what the assertion is on.
  const after = await asOperator(
    `query C($id: String!) { cards(where: { id: { eq: $id } }) { laneId status attempts } }`,
    { id: cardId },
  );
  expect(after.data).toMatchObject({
    cards: [{ laneId, status: "idle", attempts: 0 }],
  });

  // And what the author does own goes through untouched, which is the whole of what the card
  // dialog sends.
  expect(
    errorsOf(
      await asOperator(
        `mutation U($id: String!) {
           updateCard(where: { id: { eq: $id } }, set: { title: "renamed", body: "b" }) { title }
         }`,
        { id: cardId },
      ),
    ),
  ).toBe("");
});

test("an agent runs the board it is given, and does not redraw it", async () => {
  const { projectId, cardId, laneId } = await newCard();

  // The shape of the pipeline is the board somebody drew. A station that rewires itself is one
  // nobody can reason about afterwards.
  expect(
    errorsOf(
      await asAgent(
        `mutation C($projectId: String!) {
        createLane(values: { projectId: $projectId, name: "mine", position: 9 }) { id }
      }`,
        { projectId },
      ),
    ),
  ).toMatch(/Not authorized to call Mutation.createLane/);

  // Deleting a project takes a whole board and its history with it.
  expect(
    errorsOf(
      await asAgent(
        `mutation D($id: String!) { deleteProject(where: { id: { eq: $id } }) { id } }`,
        {
          id: projectId,
        },
      ),
    ),
  ).toMatch(/Not authorized to call Mutation.deleteProject/);

  // What it may do is the work: move a card, and say what it found.
  expect(
    errorsOf(
      await asAgent(
        `mutation M($cardId: String!, $laneId: String!) {
        moveCard(cardId: $cardId, laneId: $laneId) { id }
      }`,
        { cardId, laneId },
      ),
    ),
  ).toBe("");
  expect(
    errorsOf(
      await asAgent(
        `mutation N($cardId: String!) {
        addCardNote(cardId: $cardId, body: "read the migration first") { id }
      }`,
        { cardId },
      ),
    ),
  ).toBe("");
});

test("a request nothing built a context for is the server asking itself", async () => {
  // A test calling `graphql()` directly, or a tool executing the schema in process: there is no
  // door it came through, so it is not an agent. Both endpoints do supply one.
  const result = await graphql({ schema, source: `{ settings { id } }` });
  expect(errorsOf(result)).toBe("");
});
