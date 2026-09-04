import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  CreateRoleDocument,
  type RolesContractEnum,
  type RolesQuery,
  UpdateRoleDocument,
} from "@/__generated__/graphql";
import { useFieldError } from "@/components/field-error";
import { FieldRow } from "@/components/field-row";
import { FormDialog } from "@/components/form-dialog";
import { FormField } from "@/components/form-field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useDirty } from "@/lib/dirty";
import { request } from "@/lib/gql";
import { toastError } from "@/lib/toast";

type Role = RolesQuery["roles"][number];

const CONTRACTS: { value: string; label: string; hint: string }[] = [
  {
    value: "work",
    label: "Works the card",
    hint: "Answers with a report of what it did, which becomes the card's result.",
  },
  {
    value: "verdict",
    label: "Judges the card",
    hint: "Answers PASS or FAIL on its first line, then why. That word picks the arm the card leaves by, and the rest is kept as the reason it moved.",
  },
  {
    value: "expand",
    label: "Breaks the card up",
    hint: "Answers with a JSON array of cards, which are written into the lane's success arm.",
  },
];

/**
 * A role: a kind of lane, apart from any board that has one.
 *
 * `contract` is the only part of this the server itself reads — it is the shape of the answer,
 * and two of the three are parsed rather than displayed — so the form says what each expects
 * instead of letting somebody find out from a failed run.
 */
export function RoleDialog({ role, onClose }: { role?: Role; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [contract, setContract] = useState<string>(role?.contract ?? "work");
  const [prompt, setPrompt] = useState(role?.prompt ?? "");

  // Said where the field is, before the button is pressed, rather than thrown as an error from
  // inside the mutation and landed in the far corner of the screen as a toast.
  const dirty = useDirty({ name, description, contract, prompt });
  const nameError = useFieldError(name.trim() ? "" : "A role needs a name.");

  const save = useMutation({
    mutationFn: async () => {
      const values = {
        name: name.trim(),
        description: description.trim(),
        contract: contract as RolesContractEnum,
        prompt,
      };
      if (role) await request(UpdateRoleDocument, { id: role.id, set: values });
      else await request(CreateRoleDocument, { values });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      onClose();
    },
    onError: toastError,
  });

  const chosen = CONTRACTS.find((row) => row.value === contract);

  return (
    <FormDialog
      title={role ? "Edit role" : "New role"}
      description="A kind of lane. Every lane of this kind is told this, so editing it changes all of them at once."
      width="2xl"
      dirty={dirty}
      onClose={onClose}
      onSave={() => save.mutate()}
      saving={save.isPending}
      canSave={!nameError.invalid}
    >
      <div className="flex flex-col gap-4">
        <FieldRow
          content={
            <>
              <FormField
                label="Name"
                required
                error={nameError.error}
                control={
                  <Input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Testing"
                    {...nameError.field}
                  />
                }
              />
              <FormField
                label="Answers with"
                description={chosen?.hint}
                control={(props) => (
                  <Select value={contract} onValueChange={setContract}>
                    <SelectTrigger {...props} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONTRACTS.map((row) => (
                        <SelectItem key={row.value} value={row.value}>
                          {row.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </>
          }
        />

        <FormField
          label="Description"
          description="One line, to pick this kind of lane by. It is never sent to a model."
          control={
            <Input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Runs the suite and says what broke"
            />
          }
        />

        <FormField
          label="Prompt"
          description="A lane may add to this on its own board. It never replaces it."
          control={
            <Textarea
              rows={10}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="What an agent working a lane of this kind is told."
            />
          }
        />
      </div>
    </FormDialog>
  );
}
