import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
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
  type AgentsQuery,
  CreateRoleDocument,
  type RolesStageEnum,
  UpdateRoleDocument,
} from "@/gql/graphql";
import { request } from "@/lib/gql";

type Role = AgentsQuery["roles"][number];

const STAGES: { value: string; label: string; hint: string }[] = [
  {
    value: "card",
    label: "Works cards",
    hint: "A lane can point at an agent in this role. Anything a board does is one of these.",
  },
  {
    value: "refine",
    label: "Refines a task",
    hint: "Talks a request into a brief. Must answer with the JSON the refiner is asked for.",
  },
  {
    value: "decompose",
    label: "Decomposes a task",
    hint: "Turns a brief into cards. Must answer with the JSON array the decomposer is asked for.",
  },
];

/**
 * A role: the job, apart from the model that does it.
 *
 * `stage` is the only part of this the server itself reads, and the two that are not `card`
 * carry an output contract — the refiner's reply and the decomposer's card list are parsed, not
 * displayed — so the form says so rather than letting somebody find out from a failed run.
 */
export function RoleDialog({ role, onClose }: { role?: Role; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [stage, setStage] = useState<string>(role?.stage ?? "card");
  const [systemPrompt, setSystemPrompt] = useState(role?.systemPrompt ?? "");

  const save = useMutation({
    mutationFn: async () => {
      const values = {
        name: name.trim(),
        description: description.trim(),
        stage: stage as RolesStageEnum,
        systemPrompt,
      };
      if (!values.name) throw new Error("A role needs a name.");
      if (role) await request(UpdateRoleDocument, { id: role.id, set: values });
      else await request(CreateRoleDocument, { values });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      onClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const chosen = STAGES.find((row) => row.value === stage);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{role ? "Edit role" : "New role"}</DialogTitle>
          <DialogDescription>
            What an agent is asked to be. Every agent in this role is told this, unless it writes
            its own.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="role-name">Name</Label>
              <Input
                id="role-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="tester"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Stage</Label>
              <Select value={stage} onValueChange={setStage}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STAGES.map((row) => (
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
              One line, to pick this role by. It is never sent to a model.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="role-prompt">System prompt</Label>
            <Textarea
              id="role-prompt"
              rows={10}
              value={systemPrompt}
              onChange={(event) => setSystemPrompt(event.target.value)}
              placeholder="What an agent in this role is told."
            />
            {stage === "card" ? (
              <p className="text-xs text-muted-foreground">
                A role for a lane that judges cards should begin its answer with PASS or FAIL on its
                own line — that is the word the lane reads.
              </p>
            ) : null}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
