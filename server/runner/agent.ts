import {
  ask,
  type Capabilities,
  type CatalogServer,
  ContextOverflow,
  capabilitiesFor,
  catalogPrompt,
  compact,
  contextLimitFor,
  expandNames,
  getClient,
  inCatalog,
  LOAD_TOOLS,
  LOAD_TOOLS_DEFINITION,
  loadResult,
  type ModelCapabilities,
  modelCapabilitiesFor,
  PRESELECT_SYSTEM,
  parseJson,
  preselectInput,
  preselection,
  type RunEventInput,
  relaxTools,
  requestedNames,
  requestTokens,
  runTurn,
  SMALLEST_LIKELY_WINDOW,
  sanitizeTools,
  timeoutMs,
  tryAsk,
  withContext,
} from "@cubicecho/agent-core";
import type OpenAI from "openai";
import { errorMessage } from "../../shared/errors.ts";
import type { RunPrompt } from "../../shared/run-prompt.ts";
import {
  type ArtifactDraft,
  declaredArtifact,
  detectArtifact,
  RECORD_ARTIFACT,
  RECORD_ARTIFACT_DEFINITION,
} from "./artifacts.ts";
import { PREFACE } from "./hooks.ts";
import type { Resolved } from "./llm.ts";
import { mcp } from "./mcp.ts";

export interface AgentResult {
  output: string;
  toolCalls: { name: string; ok: boolean }[];
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface AgentOptions {
  /** The agent, with everything it left blank already filled in. See `llm.ts`. */
  config: Resolved;
  /** Overrides the agent's own system prompt, for a caller that has more to say. */
  systemPrompt?: string;
  prompt: string;
  /**
   * What the MCP servers' hooks added for this run, as `<context>` blocks — see `hooks.ts`. It
   * goes ahead of the prompt the model is sent, and not into what the tool preselector reads:
   * a recalled memory is not a description of the job, and guessing tools off one guesses wrong.
   */
  context?: string;
  signal?: AbortSignal;
  /** Called as the run happens, for whoever is watching it. See `@cubicecho/agent-core`. */
  onEvent?: (event: RunEventInput) => void;
  /**
   * Where what the run leaves behind goes — see `artifacts.ts`. Given, the model is offered
   * `record_artifact` and every successful call is read for a write; not given, neither happens,
   * which is what a refinement is. Awaited, so a record lands before the run can finish, and a
   * sink that throws costs the run nothing but a notice.
   */
  onArtifact?: (draft: ArtifactDraft) => Promise<void>;
  /**
   * Handed the opening system and user messages once, as the first request is about to go — so
   * what is kept is what was sent, catalogue and hook context included, rather than a
   * reconstruction of it. Awaited; a sink that throws costs the run a notice.
   */
  onPrompt?: (prompt: RunPrompt) => Promise<void>;
}

/** A message's text, whether its content is a string or a list of parts. */
const textOf = (content: OpenAI.ChatCompletionMessageParam["content"]): string =>
  typeof content === "string"
    ? content
    : (content ?? []).map((part) => ("text" in part ? part.text : "")).join("");

/** Long tool arguments and results are for the model; a watcher needs the gist. */
const preview = (text: string, limit = 2000) =>
  text.length > limit ? `${text.slice(0, limit)}… (${text.length} chars)` : text;

/**
 * Guesses the tools this task will need, before the run starts.
 *
 * On-demand loading otherwise spends a round trip on reading the catalogue and calling
 * `load_tools`. A small model reading the same catalogue usually picks the right names, and
 * then the task model opens with them already in hand.
 *
 * Guessing wrong is cheap: an unused definition costs a few hundred tokens for one run, and
 * the model can still load what it actually wanted. So this never blocks or overrides the
 * model's own loading — it only tries to make it unnecessary.
 */
async function preselect(
  config: Resolved,
  model: string,
  catalog: CatalogServer[],
  prompt: string,
  signal: AbortSignal | undefined,
  notice: (message: string) => void,
  onEvent?: (event: RunEventInput) => void,
): Promise<string[]> {
  const reply = await ask(config, model, PRESELECT_SYSTEM, preselectInput(catalog, prompt), {
    maxTokens: 256,
    signal,
    onNotice: notice,
  });
  const chosen = preselection(parseJson<unknown>(reply), catalog);
  if (chosen.length) {
    console.log(`[agent] preselected: ${chosen.join(", ")}`);
    onEvent?.({ kind: "notice", text: `tools picked before the run: ${chosen.join(", ")}` });
  }
  return chosen;
}

/**
 * Runs one card to completion: send the prompt, execute whatever MCP tools the model asks
 * for, loop until it stops asking, and return its final reply.
 *
 * Unlike a chat this keeps no history — a run starts from nothing every time, so the only
 * state is the messages built up inside this call. That also means nothing is learned between
 * runs: whatever the model loads, it loads again next time.
 *
 * What one turn costs, how a refused capability is negotiated away and what is worth sending
 * again are `@cubicecho/agent-core`'s — see `runTurn`. What is here is the part that knows what
 * the run is for: the tools this board's agent may reach, the loop over them, and which fields
 * of the body a refusal is allowed to take away.
 */
export async function runAgent({
  config,
  systemPrompt,
  prompt,
  context = "",
  signal,
  onEvent,
  onArtifact,
  onPrompt,
}: AgentOptions): Promise<AgentResult> {
  const model = config.model;
  if (!model) {
    throw new Error(`Agent "${config.name}" has no model, and none is set in Settings.`);
  }
  const system = systemPrompt ?? config.systemPrompt;

  const client = getClient(config);
  const idleMs = timeoutMs(config);
  /**
   * Where agent-core's operator text goes.
   *
   * `runTurn`, `negotiate`, `ask` and `tryAsk` each report what they gave up on and none of them
   * writes to a console — a library that picked one would be deciding for this server where its
   * operator text goes, and this server has two places for it: the log, and the run the notice
   * belongs to. A watcher seeing an unexplained pause is exactly who the second is for.
   */
  const notice = (text: string) => {
    console.warn(`[agent] ${text}`);
    onEvent?.({ kind: "notice", text });
  };
  // What this endpoint has turned out not to support, kept per endpoint rather than per run:
  // a capability it refused once it will refuse again, and a laptop's llama.cpp saying so must
  // not cost a cloud agent its token counts. What one *model* on it refused hangs off this by
  // name — one key reaches every model a provider offers, so a refusal from the model somebody
  // picked last must not speak for the one they pick next.
  const supports = capabilitiesFor(config.baseUrl, config.apiKey);
  // The window, once anything wants to know it. An agent that names its own is answered from
  // the row; anything else costs a listing, so it is not asked for until a request is big
  // enough for the answer to change what happens — see `SMALLEST_LIKELY_WINDOW`.
  let contextLimit = config.contextLength;
  let windowKnown = config.contextLength > 0;
  const stated =
    config.contextLength > 0 ? "as this agent is set to read" : "as the endpoint reports it";
  const advice =
    config.contextLength > 0
      ? "Raise the context window on the agent, or give the lane less to read."
      : "Raise the window the model is served in, or set the agent's context window by hand " +
        "if the endpoint is reporting one it is not honouring.";
  // Both columns are `notNull` with a default, so this is belt and braces — but an unbounded
  // retry loop is a bad way to find out about a row that predates them.
  const maxRetries = Math.max(0, Number(config.maxRetries) || 0);

  // In on-demand mode the model sees a name-only catalogue up front and pulls in the schemas
  // it needs as the run goes; `loaded` grows between iterations.
  const catalog = mcp.catalog(config.serverIds);
  const onDemand = config.toolDiscovery === "ondemand" && catalog.length > 0;
  const loaded = new Set<string>();
  // Offered only to an agent that has something to store things with: with no tools at all there
  // is nothing it could have made, and a lone `record_artifact` would invite it to make one up.
  const recording = onArtifact && mcp.tools({ servers: config.serverIds }).length > 0;
  const keep = async (draft: ArtifactDraft | null) => {
    if (!draft || !onArtifact) return;
    try {
      await onArtifact(draft);
    } catch (error) {
      notice(`could not record artifact ${draft.location}: ${errorMessage(error)}`);
    }
  };

  const preselected = onDemand
    ? ((await tryAsk(
        "preselect",
        () =>
          preselect(
            config,
            config.toolSelectModel || model,
            catalog,
            prompt,
            signal,
            notice,
            onEvent,
          ),
        { onNotice: notice },
      )) ?? [])
    : [];
  for (const name of preselected) loaded.add(name);

  // Rebuilt each iteration: `loaded` grows as the run goes, and the catalogue has to stop
  // advertising a tool the moment the model can actually call it.
  const systemPromptFor = () =>
    onDemand ? `${system}\n\n${catalogPrompt(catalog, loaded)}`.trim() : system;

  // A fresh array either way, so the loop below may write into it.
  const messages = withContext(
    [
      { role: "system", content: systemPromptFor() },
      { role: "user", content: prompt },
    ],
    1,
    context,
    PREFACE,
  );

  const result: AgentResult = {
    output: "",
    toolCalls: [],
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
  };

  for (let iteration = 0; iteration < config.maxToolIterations; iteration++) {
    // A stop aborts the request in flight, but a tool call already handed to an MCP server
    // runs to its own end — so the signal is checked between steps as well.
    signal?.throwIfAborted();
    onEvent?.({ kind: "turn", text: `turn ${iteration + 1}` });

    // With a preselection in hand the first step gets the shortlist and nothing else — no
    // catalogue, no `load_tools`. Left with the menu in front of it the model shops: it
    // reloads what it already has, or picks a sibling of the right tool. Taking the menu away
    // for one step removes the choice, and everything comes back on the step after.
    const routed = preselected.length > 0 && iteration === 0;
    messages[0] = { role: "system", content: routed ? system : systemPromptFor() };
    if (iteration === 0 && onPrompt) {
      const [opening, question] = messages;
      try {
        await onPrompt({ system: textOf(opening.content), user: textOf(question.content) });
      } catch (error) {
        notice(`could not keep the run's prompt: ${errorMessage(error)}`);
      }
    }

    // MCP servers emit JSON Schema shapes a strict backend cannot compile — Gmail's, for one.
    // Normalising them here is cheap and cloud providers accept the result unchanged.
    // `record_artifact` goes last, so the tools a prompt cache has already seen keep their place.
    const declared = sanitizeTools([
      ...(routed
        ? mcp.tools({ names: preselected, servers: config.serverIds })
        : onDemand
          ? [LOAD_TOOLS_DEFINITION, ...mcp.tools({ names: [...loaded], servers: config.serverIds })]
          : mcp.tools({ servers: config.serverIds })),
      ...(recording ? [RECORD_ARTIFACT_DEFINITION] : []),
    ]);

    // Rebuilt on every attempt rather than held: what `runTurn` negotiates away changes what
    // goes in the body, and `relaxTools` has to apply to the schemas that were just sanitised.
    // Two levels of that, because the model is somebody's choice from a dropdown and not every
    // one of them takes the same body: the endpoint refused `stream_options` or a grammar
    // keyword, and this model spells its ceiling the other way or will not be given a
    // temperature at all. Both arrive as a refused request and both latch — see `runTurn`.
    const request = (
      supported: Capabilities,
      byModel: ModelCapabilities | undefined,
    ): OpenAI.ChatCompletionCreateParamsStreaming => {
      const tools = supported.strictSchemas ? declared : relaxTools(declared);
      return {
        model,
        ...(byModel?.legacyTokenLimit === false
          ? { max_completion_tokens: config.maxTokens }
          : { max_tokens: config.maxTokens }),
        // Dropped rather than replaced with the one value it would accept: a reasoning model
        // runs at the temperature it was built with, and sending that number back as though it
        // were the operator's setting would have the agent page keep showing a figure that is
        // no longer what happens.
        ...(byModel?.chosenTemperature === false ? {} : { temperature: config.temperature }),
        messages,
        stream: true,
        ...(supported.usageInStream ? { stream_options: { include_usage: true } } : {}),
        ...(tools.length ? { tools } : {}),
      };
    };

    // Before the request rather than after its refusal, because the refusal is a stack trace
    // from somebody else's server and this is the one place that knows what was in the request,
    // what the window is, and where that figure came from. Only the plainly-over case is
    // stopped: the estimate is rough, and a run refused here that the endpoint would have taken
    // is worse than the endpoint's own complaint, which still arrives with everything below.
    const needed = requestTokens(request(supports, modelCapabilitiesFor(supports, model)));
    if (!windowKnown && needed > SMALLEST_LIKELY_WINDOW) {
      contextLimit = await contextLimitFor(config, config.contextLength);
      windowKnown = true;
    }
    const room = contextLimit - config.maxTokens;
    if (contextLimit > 0 && room > 0 && needed > room) {
      throw new ContextOverflow(
        `This request is about ${compact(needed)} tokens and the model reads ` +
          `${compact(contextLimit)} (${stated}), of which ${compact(config.maxTokens)} is held ` +
          `back for the reply. ${advice}`,
      );
    }

    const step = await turn();

    async function turn() {
      try {
        return await runTurn(client, supports, request, {
          maxRetries,
          model,
          signal,
          idleMs,
          onThinking: (text) => onEvent?.({ kind: "thinking", text }),
          onOutput: (text) => onEvent?.({ kind: "output", text }),
          onNotice: notice,
        });
      } catch (error) {
        // The endpoint got there first — its window is smaller than anything we could read.
        // `runTurn` has already told it from any other refusal; kept in its own words, because
        // they are the true ones, with ours added: the whole difficulty of this failure is that
        // the number in it disagrees with the model's.
        if (error instanceof ContextOverflow) {
          const detail = error.message;
          throw new ContextOverflow(
            contextLimit > 0
              ? `${detail} — this agent was working to ${compact(contextLimit)} tokens (${stated}). ${advice}`
              : `${detail} — ${advice}`,
            { cause: error },
          );
        }
        throw error;
      }
    }

    result.promptTokens += step.usage.prompt;
    result.completionTokens += step.usage.completion;
    result.totalTokens += step.usage.total;

    // What the run has cost, at the only moment anybody can know it: usage arrives in the last
    // chunk of a turn. A turn the endpoint reported nothing for says nothing rather than
    // repeating the total, so a watcher can tell "no usage yet" from "no usage reported".
    if (step.usage.total > 0 || step.usage.prompt > 0 || step.usage.completion > 0) {
      onEvent?.({
        kind: "usage",
        usage: {
          promptTokens: result.promptTokens,
          completionTokens: result.completionTokens,
          totalTokens: result.totalTokens,
        },
      });
    }

    messages.push({
      role: "assistant",
      content: step.content || null,
      ...(step.toolCalls.length ? { tool_calls: step.toolCalls } : {}),
    });

    const calls = step.toolCalls;
    if (!calls.length) {
      result.output = step.content;
      return result;
    }

    for (const call of calls) {
      signal?.throwIfAborted();
      // Only function tools carry a name and arguments; anything else has nothing to run.
      if (call.type !== "function") continue;
      const name = call.function.name;
      let content: string;
      let ok = true;
      onEvent?.({ kind: "tool-call", name, text: preview(call.function.arguments) });
      try {
        const args = parseArgs(call.function.arguments);
        if (name === LOAD_TOOLS) {
          const resolved = expandNames(requestedNames(args), catalog);
          for (const loadedName of resolved.matched) loaded.add(loadedName);
          content = loadResult(resolved, catalog);
          ok = resolved.matched.length > 0;
        } else if (name === RECORD_ARTIFACT && recording) {
          const draft = declaredArtifact(args);
          await keep(draft);
          ok = draft !== null;
          content = draft
            ? `Recorded ${draft.location}.`
            : "Nothing recorded: `location` is required.";
        } else {
          // A model that skips `load_tools` and calls a catalogued tool straight from its name
          // is right about what it wants; load it and run it rather than erroring.
          if (onDemand && !loaded.has(name) && inCatalog(catalog, name)) loaded.add(name);
          content = await mcp.call(name, args, config.serverIds);
          if (recording) await keep(detectArtifact(name, args, true));
        }
      } catch (error) {
        content = errorMessage(error);
        ok = false;
      }
      // `load_tools` is recorded alongside the real calls: the run history is what the task
      // actually did, and "spent three steps loading tools" is part of that.
      result.toolCalls.push({ name, ok });
      onEvent?.({ kind: "tool-result", name, ok, text: preview(content) });
      messages.push({ role: "tool", tool_call_id: call.id, content });
    }
  }

  throw new Error(`Stopped after ${config.maxToolIterations} tool iterations.`);
}

function parseArgs(args: string): Record<string, unknown> {
  if (!args.trim()) return {};
  try {
    return JSON.parse(args) as Record<string, unknown>;
  } catch {
    throw new Error(`model produced invalid tool arguments: ${args.slice(0, 200)}`);
  }
}
