import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AgentsDocument,
  type BoardQuery,
  CreateLaneDocument,
  RolesDocument,
  UpdateLaneDocument,
} from "@/__generated__/graphql";
import {
  InputField,
  NumberField,
  SelectField,
  SwitchField,
  TextareaField,
  useAppForm,
} from "@/components/app-form";
import { FieldRow } from "@/components/field-row";
import { FormDialog } from "@/components/form-dialog";
import { request } from "@/lib/gql";
import { forPicker, idOrNone } from "@/lib/picker";
import { toastError } from "@/lib/toast";

type Lane = BoardQuery["lanes"][number];

// Radix refuses an empty item value, so "nothing" carries a sentinel.
const NONE = "__none__";
// And so does "off the board", which is a pass target like any other rather than a switch
// beside one: a card that passes either goes somewhere or is archived, never both, and one
// picker with three kinds of answer is what makes that true by construction. It used to be set
// apart by a `SelectSeparator`, which `SelectField` has no way to express (cubicecho/cubeui#10);
// until it has, the label says what the rule said.
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
  const agents = useQuery({ queryKey: ["agents"], queryFn: () => request(AgentsDocument) });
  const roles = useQuery({ queryKey: ["roles"], queryFn: () => request(RolesDocument) });
  const others = lanes.filter((row) => row.id !== lane?.id);

  const save = useMutation({
    mutationFn: async (draft: {
      name: string;
      roleId: string;
      prompt: string;
      agentId: string;
      onSuccess: string;
      onFailureLaneId: string;
      wipLimit: number | null;
      maxAttempts: number | null;
      intake: boolean;
    }) => {
      const values = {
        name: draft.name.trim(),
        roleId: idOrNone(draft.roleId, NONE),
        prompt: draft.prompt,
        agentId: idOrNone(draft.agentId, NONE),
        onSuccessLaneId: idOrNone(draft.onSuccess, NONE, ARCHIVE),
        archiveOnSuccess: draft.onSuccess === ARCHIVE,
        onFailureLaneId: idOrNone(draft.onFailureLaneId, NONE),
        wipLimit: draft.wipLimit ?? 1,
        maxAttempts: Math.max(0, draft.maxAttempts ?? 0),
        intake: draft.intake,
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
  });

  const form = useAppForm({
    defaultValues: {
      name: lane?.name ?? "",
      roleId: forPicker(lane?.roleId, NONE),
      prompt: lane?.prompt ?? "",
      agentId: forPicker(lane?.agentId, NONE),
      onSuccess: lane?.archiveOnSuccess ? ARCHIVE : forPicker(lane?.onSuccessLaneId, NONE),
      onFailureLaneId: forPicker(lane?.onFailureLaneId, NONE),
      wipLimit: (lane?.wipLimit ?? 1) as number | null,
      maxAttempts: (lane?.maxAttempts ?? 0) as number | null,
      intake: lane?.intake ?? false,
    },
    onSubmit: ({ value }) => save.mutateAsync(value).catch(toastError),
  });

  const laneOptions = (empty: string, archive?: boolean) => [
    { value: NONE, label: empty },
    ...others.map((row) => ({ value: row.id, label: row.name })),
    ...(archive ? [{ value: ARCHIVE, label: "Archive it — off the board" }] : []),
  ];

  return (
    <FormDialog
      form={form}
      title={lane ? "Edit lane" : "New lane"}
      description="A lane with a kind and an agent is a station. One without either is somewhere cards rest."
      width="lg"
      onClose={onClose}
    >
      <FieldRow
        content={
          <>
            <InputField
              form={form}
              name="name"
              label="Name"
              required
              placeholder="Review"
              validators={{
                onChange: ({ value }) => (value.trim() ? undefined : "A lane needs a name."),
              }}
            />
            {/*
              `form.AppField` rather than the one-line form, because picking a kind for a lane
              nobody has named yet names it — "New lane ▸ Review" is the whole gesture — and a
              side effect of a change is a `listeners`, which the bound fields do not forward
              (cubicecho/cubeui#11).
            */}
            <form.AppField
              name="roleId"
              listeners={{
                onChange: ({ value }) => {
                  if (form.state.values.name.trim()) return;
                  const kind = (roles.data?.roles ?? []).find((row) => row.id === value);
                  if (kind) form.setFieldValue("name", kind.name);
                },
              }}
            >
              {(field) => (
                <field.SelectField
                  label="Kind"
                  options={[
                    { value: NONE, label: "Cards just rest here" },
                    ...(roles.data?.roles ?? []).map((row) => ({
                      value: row.id,
                      label: row.name,
                    })),
                  ]}
                />
              )}
            </form.AppField>
          </>
        }
      />

      <form.Subscribe selector={(state) => state.values.roleId}>
        {(roleId) => {
          const kind = (roles.data?.roles ?? []).find((row) => row.id === roleId);
          if (!kind) return null;
          return (
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
          );
        }}
      </form.Subscribe>

      <TextareaField
        form={form}
        name="prompt"
        label="Also on this board"
        rows={4}
        placeholder="Added after the kind's prompt, for this lane only. It never replaces it."
      />

      <SelectField
        form={form}
        name="agentId"
        label="Agent"
        description="Which model does the work. The same agent can work one lane and judge another."
        options={[
          { value: NONE, label: "Nothing runs here" },
          ...(agents.data?.agents ?? []).map((agent) => ({ value: agent.id, label: agent.name })),
        ]}
      />

      <FieldRow
        content={
          <>
            <form.AppField name="onSuccess">
              {(field) => (
                <field.SelectField
                  label="On success"
                  options={laneOptions("Stay here", true)}
                  description={
                    field.state.value === ARCHIVE
                      ? "A card that passes here goes straight to the archive, keeping this lane — restoring puts it back at the end of it. The end of a pipeline, without a Done pile to empty by hand."
                      : undefined
                  }
                />
              )}
            </form.AppField>
            <SelectField
              form={form}
              name="onFailureLaneId"
              label="On failure"
              options={laneOptions("Stay here")}
            />
          </>
        }
      />

      <FieldRow
        content={
          <>
            <NumberField
              form={form}
              name="wipLimit"
              label="Work in progress limit"
              description="How many cards the worker runs here at once."
              min={1}
            />
            <NumberField
              form={form}
              name="maxAttempts"
              label="Attempts before a person"
              description="How many times this lane puts a card it failed back in play — the budget a board corrects itself out of. Zero stops at the first failure and waits."
              min={0}
            />
          </>
        }
      />

      <SwitchField
        form={form}
        name="intake"
        label="Intake"
        description="The board's front door: work that arrives without naming a lane lands here. One lane per board, and a kind that expands is the usual choice."
        className="rounded-md border p-3"
      />
    </FormDialog>
  );
}
