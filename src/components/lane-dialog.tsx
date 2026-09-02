import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Switch } from "@/components/ui/switch";
import {
  AgentsDocument,
  type BoardQuery,
  CreateLaneDocument,
  UpdateLaneDocument,
} from "@/gql/graphql";
import { request } from "@/lib/gql";

type Lane = BoardQuery["lanes"][number];

// Radix refuses an empty item value, so "nothing" carries a sentinel.
const NONE = "__none__";

/**
 * A lane, and what it does to the cards in it.
 *
 * This is where the pipeline is drawn: the agent that works cards here, and the lanes they go
 * to when it succeeds or fails. Everything the worker does follows from these three fields.
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
  const [agentId, setAgentId] = useState(lane?.agentId ?? "");
  const [onSuccessLaneId, setOnSuccess] = useState(lane?.onSuccessLaneId ?? "");
  const [onFailureLaneId, setOnFailure] = useState(lane?.onFailureLaneId ?? "");
  const [wipLimit, setWipLimit] = useState(lane?.wipLimit ?? 1);
  const [intake, setIntake] = useState(lane?.intake ?? false);
  const [readVerdict, setReadVerdict] = useState(lane?.readVerdict ?? false);

  const agents = useQuery({ queryKey: ["agents"], queryFn: () => request(AgentsDocument) });
  const others = lanes.filter((row) => row.id !== lane?.id);

  const save = useMutation({
    mutationFn: async () => {
      const values = {
        name: name.trim(),
        agentId: agentId || null,
        onSuccessLaneId: onSuccessLaneId || null,
        onFailureLaneId: onFailureLaneId || null,
        wipLimit,
        intake,
        readVerdict,
      };
      if (!values.name) throw new Error("A lane needs a name.");
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
    onError: (error: Error) => toast.error(error.message),
  });

  const laneSelect = (value: string, onChange: (next: string) => void, empty: string) => (
    <Select value={value || NONE} onValueChange={(next) => onChange(next === NONE ? "" : next)}>
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>{empty}</SelectItem>
        {others.map((row) => (
          <SelectItem key={row.id} value={row.id}>
            {row.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{lane ? "Edit lane" : "New lane"}</DialogTitle>
          <DialogDescription>
            A lane with an agent is a stage of a pipeline. One without is somewhere cards rest.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="lane-name">Name</Label>
            <Input id="lane-name" value={name} onChange={(event) => setName(event.target.value)} />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Agent</Label>
            <Select
              value={agentId || NONE}
              onValueChange={(value) => setAgentId(value === NONE ? "" : value)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Nothing runs here</SelectItem>
                {/* Refining and decomposing are the project's stations, not the board's. */}
                {(agents.data?.agents ?? [])
                  .filter((agent) => agent.role.stage === "card")
                  .map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name} · {agent.role.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label>On success, move to</Label>
              {laneSelect(onSuccessLaneId, setOnSuccess, "Stay here")}
            </div>
            <div className="flex flex-col gap-2">
              <Label>On failure, move to</Label>
              {laneSelect(onFailureLaneId, setOnFailure, "Stay here")}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
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
            <div className="flex items-center justify-between gap-4 rounded-md border p-3">
              <div>
                <Label htmlFor="lane-intake">Intake</Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  Freshly decomposed cards land here.
                </p>
              </div>
              <Switch id="lane-intake" checked={intake} onCheckedChange={setIntake} />
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-md border p-3">
            <div>
              <Label htmlFor="lane-verdict">Judge, do not work</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                The agent here answers PASS or FAIL on its first line, and that word picks the arm.
                Anything else counts as a pass.
              </p>
            </div>
            <Switch id="lane-verdict" checked={readVerdict} onCheckedChange={setReadVerdict} />
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
