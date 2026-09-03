import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

/** A route whose component or loader threw. */
export function RouteError({ error }: { error: Error }) {
  return (
    <Frame title="This page did not load" detail={error.message}>
      <Button variant="outline" onClick={() => window.location.reload()}>
        Reload
      </Button>
    </Frame>
  );
}

/** A path that is not one of the nine. */
export function RouteNotFound() {
  return (
    <Frame title="There is no page here" detail="The address does not match anything in the app.">
      <Button variant="outline" asChild>
        <Link to="/">Back to the start</Link>
      </Button>
    </Frame>
  );
}

function Frame({
  title,
  detail,
  children,
}: {
  title: string;
  detail: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-lg font-semibold">{title}</h1>
      <p className="max-w-md text-sm text-muted-foreground">{detail}</p>
      {children}
    </div>
  );
}
