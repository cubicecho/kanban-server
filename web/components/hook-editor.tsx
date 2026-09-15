import {
  HOOK_EVENTS,
  type HookEvent,
  hookVars,
  INJECT_EVENTS,
  validateHooks,
} from "@cubicecho/agent-mcp-pool/hooks";
import { Plus, X } from "lucide-react";
import { ActionButton } from "@/components/app-buttons";
import { FormField } from "@/components/form-field";
import { OptionSelect } from "@/components/option-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { parseJson } from "@/lib/mcp-config";
import { HOOK_EVENT_TIMING, KANBAN_HOOK_VARS, type ToolHook } from "../../shared/hooks.ts";

/**
 * A hook as the form holds it: the arguments as text, because text on its way to being valid JSON
 * is most of what is in the box while somebody types it, and `key` so a row keeps its identity
 * while its id is being edited.
 */
export interface HookDraft extends Omit<ToolHook, "args"> {
  key: number;
  args: string;
}

export const toHookDrafts = (hooks: unknown): HookDraft[] =>
  (Array.isArray(hooks) ? (hooks as ToolHook[]) : []).map((hook, key) => ({
    ...hook,
    key,
    args: hook.args === undefined ? "" : JSON.stringify(hook.args, null, 2),
  }));

/**
 * The drafts as the column wants them. Throws on arguments that do not parse, or on anything the
 * pool's `validateHooks` refuses, naming the hook — the same check, in the same words, the server
 * makes on write, so a bad hook is caught before the round trip.
 */
export const fromHookDrafts = (drafts: readonly HookDraft[]): ToolHook[] => {
  const hooks = drafts.map(({ key: _key, args, ...hook }) => {
    const parsed = parseJson<unknown>(args, `The arguments of hook "${hook.id}"`, undefined);
    return parsed === undefined ? hook : { ...hook, args: parsed };
  });
  const problems = validateHooks(hooks);
  if (problems.length) throw new Error(problems.join("\n"));
  return hooks;
};

const EVENT_OPTIONS = HOOK_EVENTS.map((event) => ({
  value: event,
  label: `${event} — ${HOOK_EVENT_TIMING[event]}`,
}));

/** The next `hook-N` the list has not used, so two new hooks never share an id. */
const nextId = (hooks: readonly HookDraft[]) => {
  let n = hooks.length + 1;
  while (hooks.some((hook) => hook.id === `hook-${n}`)) n += 1;
  return `hook-${n}`;
};

/** A positive number from a box, or nothing — nothing being the pool's own default. */
const positive = (text: string) => {
  const value = Number(text);
  return text.trim() && value > 0 ? value : undefined;
};

function HookRow({
  hook,
  tools,
  onChange,
  onRemove,
}: {
  hook: HookDraft;
  /** The server's tool names, when it has answered. A server that has not is typed by hand. */
  tools: readonly string[];
  onChange: (hook: HookDraft) => void;
  onRemove: () => void;
}) {
  const update = (patch: Partial<HookDraft>) => onChange({ ...hook, ...patch });
  const injects = INJECT_EVENTS.has(hook.on);
  const vars = [...hookVars(hook.on), ...KANBAN_HOOK_VARS];

  return (
    <div className="flex flex-col gap-3 rounded-md border p-3">
      <div className="flex items-center gap-2">
        <Input
          aria-label="Hook id"
          className="flex-1 font-mono"
          value={hook.id}
          onChange={(event) => update({ id: event.target.value })}
        />
        <Switch
          aria-label={`Run hook ${hook.id}`}
          checked={hook.enabled !== false}
          // Absent is on, so a hook switched back on is written the way a new one is.
          onCheckedChange={(enabled) => update({ enabled: enabled ? undefined : false })}
        />
        <ActionButton
          variant="ghost"
          size="icon"
          label={`Remove hook ${hook.id}`}
          hint="Remove hook"
          onClick={onRemove}
        >
          <X className="size-4" aria-hidden />
        </ActionButton>
      </div>

      <FormField
        label="When"
        control={(wiring) => (
          <OptionSelect
            {...wiring}
            options={EVENT_OPTIONS}
            value={hook.on}
            onValueChange={(value) => {
              const on = value as HookEvent;
              // Context can only be added ahead of a request, so it goes when the hook moves off one.
              update(
                INJECT_EVENTS.has(on) ? { on } : { on, inject: undefined, maxTokens: undefined },
              );
            }}
          />
        )}
      />

      <FormField
        label="Tool"
        description="The server's own name for it, without the slug."
        control={(wiring) =>
          tools.length ? (
            <OptionSelect
              {...wiring}
              className="font-mono"
              options={[...new Set([...tools, ...(hook.tool ? [hook.tool] : [])])].map((tool) => ({
                value: tool,
                label: tool,
              }))}
              value={hook.tool}
              onValueChange={(tool) => update({ tool })}
            />
          ) : (
            <Input
              {...wiring}
              className="font-mono"
              value={hook.tool}
              placeholder="remember"
              onChange={(event) => update({ tool: event.target.value })}
            />
          )
        }
      />

      <FormField
        label="Arguments"
        description={
          <>
            JSON. <code>{"{{path}}"}</code> fills in when the hook runs, and a path the event has no
            value for skips it. Here: {vars.map((name) => `{{${name}}}`).join(", ")}.
          </>
        }
        control={
          <Textarea
            rows={4}
            className="font-mono text-xs"
            value={hook.args}
            placeholder={'{ "query": "{{prompt}}", "scope": "{{vars.projectId}}" }'}
            onChange={(event) => update({ args: event.target.value })}
          />
        }
      />

      {injects ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <FormField
            orientation="horizontal"
            className="flex-1"
            label="Add what it returns to the run's prompt"
            control={
              <Switch
                checked={Boolean(hook.inject)}
                onCheckedChange={(inject) =>
                  update(inject ? { inject } : { inject: undefined, maxTokens: undefined })
                }
              />
            }
          />
          {hook.inject ? (
            <FormField
              label="At most (tokens)"
              description="Empty is 1000."
              className="sm:w-40"
              control={
                <Input
                  type="number"
                  min={1}
                  value={hook.maxTokens ?? ""}
                  onChange={(event) => update({ maxTokens: positive(event.target.value) })}
                />
              }
            />
          ) : null}
        </div>
      ) : null}

      <FormField
        label="Timeout (ms)"
        description={
          injects
            ? "Empty is 3000 — the run waits for it."
            : "Empty is the server's call timeout. The run has already finished."
        }
        className="sm:w-60"
        control={
          <Input
            type="number"
            min={1}
            value={hook.timeoutMs ?? ""}
            onChange={(event) => update({ timeoutMs: positive(event.target.value) })}
          />
        }
      />
    </div>
  );
}

/**
 * A server's hooks: its own tools, called by this board at points in a run rather than by the
 * model. What a hook is for is a memory server — recall ahead of a run, remember after it, forget
 * when the card goes.
 */
export function HooksEditor({
  value,
  tools,
  onChange,
}: {
  value: readonly HookDraft[];
  tools: readonly string[];
  onChange: (hooks: HookDraft[]) => void;
}) {
  const add = () =>
    onChange([
      ...value,
      {
        key: Math.max(-1, ...value.map((hook) => hook.key)) + 1,
        id: nextId(value),
        on: "beforeTurn",
        tool: tools[0] ?? "",
        args: "",
      },
    ]);

  return (
    <div className="flex flex-col gap-2">
      {value.map((hook, index) => (
        <HookRow
          key={hook.key}
          hook={hook}
          tools={tools}
          onChange={(next) => onChange(value.map((item, i) => (i === index ? next : item)))}
          onRemove={() => onChange(value.filter((_, i) => i !== index))}
        />
      ))}
      <div>
        <Button type="button" variant="secondary" size="sm" onClick={add}>
          <Plus className="size-4" />
          Add hook
        </Button>
      </div>
    </div>
  );
}
