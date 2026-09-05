import { useQuery } from "@tanstack/react-query";
import { List } from "lucide-react";
import type { AriaAttributes, ComponentProps } from "react";
import { useState } from "react";
import { AgentModelsDocument } from "@/__generated__/graphql";
import { ActionButton } from "@/components/app-buttons";
import {
  bindToForm,
  type FieldProps,
  splitProps,
  useFieldContext,
  useFieldError,
} from "@/components/app-form";
import { FormField } from "@/components/form-field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { request } from "@/lib/gql";
import { compactTokens } from "@/lib/runs";

/**
 * What a `FormField` wires onto the control it is drawn around: the id its label points at, and
 * the aria the field owns. Spread rather than taken as an `id` alone, because this component
 * renders two different elements and the shell cannot see either — a clone of it would hand the
 * attributes to a function and lose them without saying so.
 */
type Wiring = { id?: string } & AriaAttributes;

// Radix refuses an empty item value, so the two non-model choices carry sentinels.
const DEFAULT = "__default__";
const CUSTOM = "__custom__";

/**
 * Picks a model from whatever the endpoint offers.
 *
 * Which endpoint depends on `agentId`: an agent may be pointed at a server of its own, and the
 * models it can choose from are that server's, not the shared one's. Without an id this asks
 * the endpoint in Settings.
 *
 * The list is a live call to that server, which may not be running, so it is only fetched
 * once the menu is opened — and because it can fail, or be a server with no `/models` at
 * all, "Type a name…" drops the field back to free text.
 */
export function ModelSelect({
  value,
  onChange,
  defaultLabel,
  agentId,
  ...wiring
}: {
  value: string;
  onChange: (model: string) => void;
  /** Label for the empty choice. Omitted, a model must be named. */
  defaultLabel?: string;
  /** Whose endpoint to ask. Omitted, the one in Settings. */
  agentId?: string;
} & Wiring) {
  const [typing, setTyping] = useState(false);
  const [opened, setOpened] = useState(false);

  const models = useQuery({
    queryKey: ["models", agentId ?? ""],
    queryFn: () => request(AgentModelsDocument, { agentId: agentId ?? null }),
    enabled: opened,
    retry: false,
    staleTime: 60_000,
  });

  if (typing) {
    return (
      <div className="flex gap-2">
        <Input
          {...wiring}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="llama3.1:8b"
        />
        <ActionButton
          variant="ghost"
          size="icon"
          label="Pick from the list"
          onClick={() => setTyping(false)}
        >
          <List className="size-4" />
        </ActionButton>
      </div>
    );
  }

  // A model saved before the server offered it still has to show as the current choice — with
  // no window against it, because a model the endpoint is not listing has told us nothing.
  const listed = models.data?.models ?? [];
  const options =
    value && !listed.some((model) => model.id === value)
      ? [{ id: value, contextLength: 0 }, ...listed]
      : listed;

  return (
    <Select
      value={value || (defaultLabel ? DEFAULT : "")}
      onValueChange={(next) => {
        if (next === CUSTOM) setTyping(true);
        else onChange(next === DEFAULT ? "" : next);
      }}
      onOpenChange={(open) => open && setOpened(true)}
    >
      <SelectTrigger {...wiring} className="w-full">
        <SelectValue placeholder="Select a model" />
      </SelectTrigger>
      <SelectContent>
        {defaultLabel ? <SelectItem value={DEFAULT}>{defaultLabel}</SelectItem> : null}
        {options.map((model) => (
          <SelectItem key={model.id} value={model.id} className="font-mono">
            {model.id}
            {model.contextLength ? (
              <span className="ml-2 font-sans text-muted-foreground text-xs">
                {compactTokens(model.contextLength)} context
              </span>
            ) : null}
          </SelectItem>
        ))}
        {models.isFetching && options.length === 0 ? (
          <p className="px-2 py-1.5 text-sm text-muted-foreground">Loading…</p>
        ) : null}
        {models.error ? (
          <p className="px-2 py-1.5 text-xs text-destructive">{(models.error as Error).message}</p>
        ) : null}
        <SelectSeparator />
        <SelectItem value={CUSTOM}>Type a name…</SelectItem>
      </SelectContent>
    </Select>
  );
}

type ModelFieldProps = FieldProps & Omit<ComponentProps<typeof ModelSelect>, "value" | "onChange">;

/**
 * The same picker, bound to a form. It goes through `FormField`'s function form because this
 * control renders a trigger or an input depending on how it was last used, and neither is
 * something the shell can see to clone.
 */
function BoundModelField(props: ModelFieldProps) {
  const [fieldProps, control] = splitProps(props);
  const field = useFieldContext<string>();
  const error = useFieldError();

  return (
    <FormField
      {...fieldProps}
      error={error}
      control={(wiring) => (
        <ModelSelect
          {...wiring}
          {...control}
          value={field.state.value ?? ""}
          onChange={field.handleChange}
        />
      )}
    />
  );
}

export const ModelField = bindToForm<ModelFieldProps, string>(BoundModelField, "ModelField");
