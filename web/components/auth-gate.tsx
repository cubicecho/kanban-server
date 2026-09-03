import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Auth {
  /** Whether this server was started with a token at all. */
  required: boolean;
  /** Whether this browser is already carrying one that works. */
  ok: boolean;
}

/**
 * The door, on a server that has one.
 *
 * A server with no `KANBAN_SERVER_TOKEN` answers `required: false` and this renders the app
 * without ever showing itself — which is the laptop case, and the default. With a token, the
 * app is behind one form.
 *
 * The token goes to the server and comes back as an `httpOnly` cookie rather than being kept
 * here: nothing on the page can read it afterwards, and the browser attaches it to the run
 * stream, which an `EventSource` could not do with a header.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  const auth = useQuery({
    queryKey: ["auth"],
    queryFn: async (): Promise<Auth> => {
      const response = await fetch("/api/auth");
      if (!response.ok) throw new Error("Could not reach the server.");
      return response.json();
    },
    // The cookie lasts a month and the answer never changes under us; asking once is enough.
    staleTime: Number.POSITIVE_INFINITY,
  });

  // Until the server has answered, show nothing rather than a form it may not want — a flash
  // of a login box on an open server would be a lie about what this is.
  if (auth.isPending) return null;
  if (auth.data && (!auth.data.required || auth.data.ok)) return <>{children}</>;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSending(true);
    setError("");
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!response.ok) {
        setError("That is not the token.");
        return;
      }
      setToken("");
      await queryClient.invalidateQueries({ queryKey: ["auth"] });
    } catch {
      setError("Could not reach the server.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-full items-center justify-center p-6">
      <Card className="w-full max-w-sm gap-4 p-6">
        <div>
          <h1 className="text-base font-semibold">kanban-server</h1>
          <p className="text-sm text-muted-foreground">
            {auth.error
              ? "The server is not answering."
              : "This board is locked. The token is the one the server was started with."}
          </p>
        </div>
        <form className="flex flex-col gap-3" onSubmit={submit}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="token">Token</Label>
            <Input
              id="token"
              type="password"
              autoComplete="current-password"
              value={token}
              onChange={(event) => setToken(event.target.value)}
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" disabled={sending || !token}>
            {sending ? "Checking…" : "Unlock"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
