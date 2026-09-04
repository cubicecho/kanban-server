import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CreateRoleDocument,
  type RolesContractEnum,
  type RolesQuery,
  UpdateRoleDocument,
} from "@/__generated__/graphql";
import { InputField, TextareaField, useAppForm } from "@/components/app-form";
import { FieldRow } from "@/components/field-row";
import { FormDialog } from "@/components/form-dialog";
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

  const save = useMutation({
    mutationFn: async (values: {
      name: string;
      description: string;
      contract: string;
      prompt: string;
    }) => {
      const row = {
        name: values.name.trim(),
        description: values.description.trim(),
        contract: values.contract as RolesContractEnum,
        prompt: values.prompt,
      };
      if (role) await request(UpdateRoleDocument, { id: role.id, set: row });
      else await request(CreateRoleDocument, { values: row });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      onClose();
    },
  });

  const form = useAppForm({
    defaultValues: {
      name: role?.name ?? "",
      description: role?.description ?? "",
      contract: role?.contract ?? "work",
      prompt: role?.prompt ?? "",
    },
    onSubmit: ({ value }) => save.mutateAsync(value).catch(toastError),
  });

  return (
    <FormDialog
      form={form}
      title={role ? "Edit role" : "New role"}
      description="A kind of lane. Every lane of this kind is told this, so editing it changes all of them at once."
      width="2xl"
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
              placeholder="Testing"
              validators={{
                onChange: ({ value }) => (value.trim() ? undefined : "A role needs a name."),
              }}
            />
            <form.AppField name="contract">
              {(field) => (
                <field.SelectField
                  label="Answers with"
                  options={CONTRACTS}
                  description={CONTRACTS.find((row) => row.value === field.state.value)?.hint}
                />
              )}
            </form.AppField>
          </>
        }
      />

      <InputField
        form={form}
        name="description"
        label="Description"
        description="One line, to pick this kind of lane by. It is never sent to a model."
        placeholder="Runs the suite and says what broke"
      />

      <TextareaField
        form={form}
        name="prompt"
        label="Prompt"
        description="A lane may add to this on its own board. It never replaces it."
        rows={10}
        placeholder="What an agent working a lane of this kind is told."
      />
    </FormDialog>
  );
}
