import { eq } from "drizzle-orm";
import OpenAI from "openai";
import { db } from "../db/client.ts";
import { type Agent, agentServers, agents, type Settings, settings } from "../db/schema.ts";

export async function loadSettings(): Promise<Settings> {
  const [row] = await db.select().from(settings).where(eq(settings.id, "default")).limit(1);
  if (!row) throw new Error("settings row is missing — did ensureSchema() run?");
  return row;
}

/**
 * An agent, with everything it left blank filled in from settings.
 *
 * Agents exist so that one can be a local model with no key and the next a frontier API, and
 * the cost of that is that every knob has two possible homes. This is the one place that
 * question is answered: below here nothing consults settings, and nothing branches on whether
 * a value came from the agent or from the fallback.
 */
export interface Resolved {
  agentId: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  /** This agent's own standing instruction, if it has one. Not the job — the job is the lane's. */
  systemPrompt: string;
  maxTokens: number;
  temperature: number;
  maxToolIterations: number;
  toolDiscovery: "eager" | "ondemand";
  toolSelectModel: string;
  requestTimeoutSeconds: number;
  maxRetries: number;
  /** The MCP servers this agent may reach. Empty means it runs with no tools at all. */
  serverIds: string[];
}

/**
 * Zero means inherit for every numeric knob here, because none of them has a meaningful zero:
 * no tokens, no tool iterations and no timeout are all ways of saying "do not run". The two
 * that do — `temperature` and `maxRetries` — use `-1` instead.
 */
const num = (own: number, fallback: number, inherit = 0) => (own === inherit ? fallback : own);

export async function resolveAgent(agent: Agent, config?: Settings): Promise<Resolved> {
  const base = config ?? (await loadSettings());
  const links = await db
    .select({ serverId: agentServers.serverId })
    .from(agentServers)
    .where(eq(agentServers.agentId, agent.id));
  return {
    agentId: agent.id,
    name: agent.name,
    baseUrl: agent.baseUrl || base.baseUrl,
    // Deliberately not `agent.apiKey || base.apiKey || env`: an agent pointed at a local model
    // has no key and should not silently borrow the one meant for the paid endpoint. It only
    // falls through when the agent is also using the shared `baseUrl`.
    apiKey: agent.apiKey || (agent.baseUrl ? "" : base.apiKey || process.env.OPENAI_API_KEY || ""),
    model: agent.model || base.model,
    // Nothing to inherit from: an identity is either written or it is not, and a blank one is
    // the expected case. What the agent is asked to *do* is composed at the lane.
    systemPrompt: agent.systemPrompt,
    maxTokens: num(agent.maxTokens, base.maxTokens),
    temperature: num(agent.temperature, base.temperature, -1),
    maxToolIterations: num(agent.maxToolIterations, base.maxToolIterations),
    toolDiscovery: agent.toolDiscovery === "inherit" ? base.toolDiscovery : agent.toolDiscovery,
    toolSelectModel: base.toolSelectModel,
    requestTimeoutSeconds: num(agent.requestTimeoutSeconds, base.requestTimeoutSeconds),
    maxRetries: num(agent.maxRetries, base.maxRetries, -1),
    serverIds: links.map((link) => link.serverId),
  };
}

/** The agent with this id, resolved. Throws if it is gone or switched off. */
export async function resolveAgentId(agentId: string): Promise<Resolved> {
  const [agent] = await db.select().from(agents).where(eq(agents.id, agentId)).limit(1);
  if (!agent) throw new Error(`no agent with id ${agentId}`);
  if (!agent.enabled) throw new Error(`agent "${agent.name}" is disabled`);
  return resolveAgent(agent);
}

/**
 * The agent for one of the two jobs that are not stations, resolved.
 *
 * Refining and decomposing happen off the board, so there is no lane to read an agent off. The
 * project names one, or Settings does, or it is the first enabled agent by name — deterministic
 * so two servers with the same rows agree on which that is. Nothing here asks what an agent is
 * *for*: an agent is not for anything, and which job this is belongs to the caller.
 */
export async function resolveJobAgent(
  job: "refine" | "decompose",
  preferredId?: string | null,
): Promise<Resolved> {
  const base = await loadSettings();
  const named = preferredId || (job === "refine" ? base.refineAgentId : base.decomposeAgentId);
  if (named) return resolveAgentId(named);
  const enabled = await db.select().from(agents).where(eq(agents.enabled, true));
  const [agent] = enabled.sort((a, b) => a.name.localeCompare(b.name));
  if (!agent) throw new Error(`no enabled agent to ${job} with — define one first`);
  return resolveAgent(agent, base);
}

/** Zero or less means no limit, which the SDK spells as `undefined`. */
export const timeoutMs = (config: Pick<Resolved, "requestTimeoutSeconds">): number | undefined =>
  config.requestTimeoutSeconds > 0 ? config.requestTimeoutSeconds * 1000 : undefined;

/**
 * A client per endpoint, made once and kept.
 *
 * The SDK holds its own connection pool, and a run makes a request per tool iteration on top of
 * whatever side tasks it asks for — building a fresh client for each of them throws that pool
 * away every time. Agents make this a map rather than the single slot it would otherwise be:
 * two agents on two endpoints are two long-lived clients, and a third agent sharing an endpoint
 * with one of them shares its client too.
 *
 * The SDK insists on a non-empty key even where the server will not look at it.
 *
 * `maxRetries: 0` turns the SDK's own retrying off. Streaming is what this server does, and a
 * stream that has already emitted tokens must not be replayed from the top — the caller in
 * `agent.ts` knows whether anything has been produced yet and the SDK does not.
 */
const clients = new Map<string, OpenAI>();

export function getClient(config: Pick<Resolved, "baseUrl" | "apiKey" | "requestTimeoutSeconds">) {
  const apiKey = config.apiKey || "kanban-server";
  const timeout = timeoutMs(config);
  // Stringified rather than joined on a separator: no character is impossible in a URL or a
  // key, and two different endpoints must never resolve to the same cached client.
  const key = JSON.stringify([config.baseUrl, apiKey, timeout]);
  const existing = clients.get(key);
  if (existing) return existing;
  const client = new OpenAI({ baseURL: config.baseUrl, apiKey, timeout, maxRetries: 0 });
  clients.set(key, client);
  return client;
}

/**
 * Model ids an endpoint reports. With no agent named it asks the one in settings, which is
 * what the settings page needs; with one, it asks that agent's own endpoint.
 */
export async function listModels(agentId?: string | null): Promise<string[]> {
  const base = await loadSettings();
  const config = agentId
    ? await resolveAgentId(agentId)
    : {
        baseUrl: base.baseUrl,
        apiKey: base.apiKey || process.env.OPENAI_API_KEY || "",
        requestTimeoutSeconds: base.requestTimeoutSeconds,
      };
  const { data } = await getClient(config).models.list();
  return data.map((model) => model.id).sort((a, b) => a.localeCompare(b));
}
