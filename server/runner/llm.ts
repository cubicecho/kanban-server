import {
  contextLimitFor as askWindow,
  type Endpoint,
  listModels as listEndpointModels,
  type ModelInfo,
} from "@cubicecho/agent-core";
import { eq } from "drizzle-orm";
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
  /** What the operator says this model reads. Zero means ask the endpoint — see `contextLimitFor`. */
  contextLength: number;
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
    contextLength: num(agent.contextLength, base.contextLength),
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
 * The agent that refines, resolved.
 *
 * Refinement is the one job with no lane behind it — a conversation with a person rather than
 * something that happens to a card — so there is nowhere on the board to read an agent off.
 * The project names one, or Settings does, or it is the first enabled agent by name:
 * deterministic, so two servers with the same rows agree on which that is. Nothing here asks
 * what an agent is *for*, because an agent is not for anything.
 */
export async function resolveRefineAgent(preferredId?: string | null): Promise<Resolved> {
  const base = await loadSettings();
  const named = preferredId || base.refineAgentId;
  if (named) return resolveAgentId(named);
  const enabled = await db.select().from(agents).where(eq(agents.enabled, true));
  const [agent] = enabled.sort((a, b) => a.name.localeCompare(b.name));
  if (!agent) throw new Error("no enabled agent to refine with — define one first");
  return resolveAgent(agent, base);
}

/**
 * How much this agent's model will read, in tokens. Zero means nobody knows.
 *
 * The package asks the endpoint and caches the answer; what is added here is the one thing it
 * cannot know, which is that this server lets an operator declare the window on the agent row.
 * That number wins outright: an endpoint can report the window a model was *built* with while
 * serving it in a much smaller one — llama.cpp will happily load a 256k model at `-c 16384` and
 * go on listing it as 256k — and a run refused on the honest-looking number is a run that fails
 * at the endpoint instead.
 */
export const contextLimitFor = (config: Resolved): Promise<number> =>
  askWindow(config, config.contextLength);

/** The endpoint Settings names, as the shape the client and the listing cache both want. */
const settingsEndpoint = (base: Settings): Endpoint => ({
  baseUrl: base.baseUrl,
  apiKey: base.apiKey || process.env.OPENAI_API_KEY || "",
  requestTimeoutSeconds: base.requestTimeoutSeconds,
});

/**
 * The models an endpoint reports. With no agent named it asks the one in settings, which is
 * what the settings page needs; with one, it asks that agent's own endpoint.
 */
export async function listModels(agentId?: string | null): Promise<ModelInfo[]> {
  const base = await loadSettings();
  return listEndpointModels(agentId ? await resolveAgentId(agentId) : settingsEndpoint(base));
}
