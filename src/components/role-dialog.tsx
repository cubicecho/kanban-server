import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useDiscardGuard } from "@/components/discard-guard";
import { useFieldError } from "@/components/field-error";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  CreateRoleDocument,
  type RolesContractEnum,
  type RolesQuery,
  UpdateRoleDocument,
} from "@/gql/graphql";
import { useDirty } from "@/lib/dirty";
import { request } from "@/lib/gql";

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

  const { close, guard } = useDiscardGuard(
    useDirty({ name, description, contract, prompt }),
    onClose,
  );
  // Said where the field is, before the button is pressed, rather than thrown as an error from
  // inside the mutation and landed in the far corner of the screen as a toast.
  const nameError = useFieldError("role-name", name.trim() ? "" : "A role needs a name.");

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
    onError: (error: Error) => toast.error(error.message),
  });

  const chosen = CONTRACTS.find((row) => row.value === contract);

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{role ? "Edit role" : "New role"}</DialogTitle>
          <DialogDescription>
            A kind of lane. Every lane of this kind is told this, so editing it changes all of them
            at once.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="role-name">Name</Label>
              <Input
                id="role-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Testing"
                {...nameError.field}
              />
              {nameError.error}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="role-contract">Answers with</Label>
              <Select value={contract} onValueChange={setContract}>
                <SelectTrigger id="role-contract" className="w-full">
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
            </div>
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">{chosen?.hint}</p>

          <div className="flex flex-col gap-2">
            <Label htmlFor="role-description">Description</Label>
            <Input
              id="role-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Runs the suite and says what broke"
            />
            <p className="text-xs text-muted-foreground">
              One line, to pick this kind of lane by. It is never sent to a model.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="role-prompt">Prompt</Label>
            <Textarea
              id="role-prompt"
              rows={10}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="What an agent working a lane of this kind is told."
            />
            <p className="text-xs text-muted-foreground">
              A lane may add to this on its own board. It never replaces it.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate()} disabled={nameError.invalid || save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
        {guard}
      </DialogContent>
    </Dialog>
  );
}
