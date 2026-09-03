import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  AgentsDocument,
  type BoardQuery,
  CreateLaneDocument,
  RolesDocument,
  UpdateLaneDocument,
} from "@/__generated__/graphql";
import { useFieldError } from "@/components/field-error";
import { FormDialog } from "@/components/form-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useDirty } from "@/lib/dirty";
import { request } from "@/lib/gql";
import { toastError } from "@/lib/toast";

type Lane = BoardQuery["lanes"][number];

// Radix refuses an empty item value, so "nothing" carries a sentinel.
const NONE = "__none__";
// And so does "off the board", which is a pass target like any other rather than a switch
// beside one: a card that passes either goes somewhere or is archived, never both, and one
// picker with three kinds of answer is what makes that true by construction.
const ARCHIVE = "__archive__";

/** What a lane of each kind does to a card, said in the dialog rather than found out from a run. */
const CONTRACT_SAYS: Record<string, string> = {
  work: "The agent works the card and reports back. What it says becomes the card's result, and the card leaves by the success arm.",
  verdict:
    "The agent judges the card: PASS or FAIL on its first line, and that word picks the arm. Anything else counts as a pass, and the card's result is left alone.",
  expand:
    "The agent breaks the card into cards, which are written into the success arm. The card itself is archived.",
};

/**
 * A lane, and what it does to the cards in it.
 *
 * This is where the pipeline is drawn, and the fields are ordered as the sentence a lane makes:
 * what it is called, what kind of lane it is, anything to add on this board, who works it, and
 * where cards go afterwards. The kind is a role — shared with every other lane of that kind —
 * and the agent is only a model, which is why the picker below does not filter.
 */
export function LaneDialog({
  lane,
  lanes,
  projectId,
  onClose,
}: {
  lane?: Lane;
  lanes: readonly Lane[];
  projectId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(lane?.name ?? "");
  const [roleId, setRoleId] = useState(lane?.roleId ?? "");
  const [prompt, setPrompt] = useState(lane?.prompt ?? "");
  const [agentId, setAgentId] = useState(lane?.agentId ?? "");
  const [onSuccess, setOnSuccess] = useState(
    lane?.archiveOnSuccess ? ARCHIVE : (lane?.onSuccessLaneId ?? ""),
  );
  const [onFailureLaneId, setOnFailure] = useState(lane?.onFailureLaneId ?? "");
  const [wipLimit, setWipLimit] = useState(lane?.wipLimit ?? 1);
  const [maxAttempts, setMaxAttempts] = useState(lane?.maxAttempts ?? 0);
  const [intake, setIntake] = useState(lane?.intake ?? false);

  const agents = useQuery({ queryKey: ["agents"], queryFn: () => request(AgentsDocument) });
  const roles = useQuery({ queryKey: ["roles"], queryFn: () => request(RolesDocument) });
  const others = lanes.filter((row) => row.id !== lane?.id);
  const kind = (roles.data?.roles ?? []).find((row) => row.id === roleId);

  const dirty = useDirty({
    name,
    roleId,
    prompt,
    agentId,
    onSuccess,
    onFailureLaneId,
    wipLimit,
    maxAttempts,
    intake,
  });
  const nameError = useFieldError("lane-name", name.trim() ? "" : "A lane needs a name.");

  const save = useMutation({
    mutationFn: async () => {
      const values = {
        name: name.trim(),
        roleId: roleId || null,
        prompt,
        agentId: agentId || null,
        onSuccessLaneId: onSuccess === ARCHIVE ? null : onSuccess || null,
        archiveOnSuccess: onSuccess === ARCHIVE,
        onFailureLaneId: onFailureLaneId || null,
        wipLimit,
        maxAttempts,
        intake,
      };
      if (lane) await request(UpdateLaneDocument, { id: lane.id, set: values });
      else {
        await request(CreateLaneDocument, {
          values: { ...values, projectId, position: lanes.length },
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["board", projectId] });
      onClose();
    },
    onError: toastError,
  });

  // Picking a kind for a lane nobody has named yet names it: a board is assembled out of known
  // parts, and "New lane ▸ Review" is the whole gesture.
  const pickKind = (next: string) => {
    const id = next === NONE ? "" : next;
    setRoleId(id);
    if (!name.trim()) setName((roles.data?.roles ?? []).find((row) => row.id === id)?.name ?? "");
  };

  const laneSelect = (
    id: string,
    value: string,
    onChange: (next: string) => void,
    empty: string,
    archive?: boolean,
  ) => (
    <Select value={value || NONE} onValueChange={(next) => onChange(next === NONE ? "" : next)}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>{empty}</SelectItem>
        {others.map((row) => (
          <SelectItem key={row.id} value={row.id}>
            {row.name}
          </SelectItem>
        ))}
        {archive ? (
          <>
            <SelectSeparator />
            <SelectItem value={ARCHIVE}>Archive it</SelectItem>
          </>
        ) : null}
      </SelectContent>
    </Select>
  );

  return (
    <FormDialog
      title={lane ? "Edit lane" : "New lane"}
      description="A lane with a kind and an agent is a station. One without either is somewhere cards rest."
      width="lg"
      dirty={dirty}
      onClose={onClose}
      onSave={() => save.mutate()}
      saving={save.isPending}
      canSave={!nameError.invalid}
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="lane-name">Name</Label>
            <Input
              id="lane-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Review"
              {...nameError.field}
            />
            {nameError.error}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="lane-kind">Kind</Label>
            <Select value={roleId || NONE} onValueChange={pickKind}>
              <SelectTrigger id="lane-kind" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Cards just rest here</SelectItem>
                {(roles.data?.roles ?? []).map((row) => (
                  <SelectItem key={row.id} value={row.id}>
                    {row.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {kind ? (
          <div className="flex flex-col gap-2 rounded-md border p-3">
            <p className="text-xs text-muted-foreground">{CONTRACT_SAYS[kind.contract]}</p>
            <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap text-xs text-muted-foreground">
              {kind.prompt || "This kind of lane says nothing yet."}
            </pre>
            <p className="text-xs text-muted-foreground">
              Shared with every {kind.name} lane on this server — editing it on the Roles page
              changes all of them.
            </p>
          </div>
        ) : null}

        <div className="flex flex-col gap-2">
          <Label htmlFor="lane-prompt">Also on this board</Label>
          <Textarea
            id="lane-prompt"
            rows={4}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Added after the kind's prompt, for this lane only. It never replaces it."
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="lane-agent">Agent</Label>
          <Select
            value={agentId || NONE}
            onValueChange={(value) => setAgentId(value === NONE ? "" : value)}
          >
            <SelectTrigger id="lane-agent" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Nothing runs here</SelectItem>
              {(agents.data?.agents ?? []).map((agent) => (
                <SelectItem key={agent.id} value={agent.id}>
                  {agent.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Which model does the work. The same agent can work one lane and judge another.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="lane-success">On success</Label>
            {laneSelect("lane-success", onSuccess, setOnSuccess, "Stay here", true)}
            {onSuccess === ARCHIVE ? (
              <p className="text-xs text-muted-foreground">
                A card that passes here goes straight to the archive, keeping this lane — restoring
                puts it back at the end of it. The end of a pipeline, without a Done pile to empty
                by hand.
              </p>
            ) : null}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="lane-failure">On failure</Label>
            {laneSelect("lane-failure", onFailureLaneId, setOnFailure, "Stay here")}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="lane-wip">Work in progress limit</Label>
            <Input
              id="lane-wip"
              type="number"
              min={1}
              value={wipLimit}
              onChange={(event) => setWipLimit(Number(event.target.value))}
            />
            <p className="text-xs text-muted-foreground">
              How many cards the worker runs here at once.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="lane-attempts">Attempts before a person</Label>
            <Input
              id="lane-attempts"
              type="number"
              min={0}
              value={maxAttempts}
              onChange={(event) => setMaxAttempts(Math.max(0, Number(event.target.value)))}
            />
            <p className="text-xs text-muted-foreground">
              How many times this lane puts a card it failed back in play — the budget a board
              corrects itself out of. Zero stops at the first failure and waits.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-md border p-3">
          <div>
            <Label htmlFor="lane-intake">Intake</Label>
            <p className="mt-1 text-xs text-muted-foreground">
              The board's front door: work that arrives without naming a lane lands here. One lane
              per board, and a kind that expands is the usual choice.
            </p>
          </div>
          <Switch id="lane-intake" checked={intake} onCheckedChange={setIntake} />
        </div>
      </div>
    </FormDialog>
  );
}
