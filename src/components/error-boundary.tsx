import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

/**
 * The last thing between a thrown render and a white page.
 *
 * There was nothing here before, so any error a component threw took the whole app with it
 * and left no way back but the address bar. Reloading is offered rather than a reset, because
 * a render that threw once will usually throw again against the same cache.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <h1 className="text-lg font-semibold">Something broke on this page</h1>
        <p className="max-w-md text-sm text-muted-foreground">{error.message}</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Reload
        </Button>
      </div>
    );
  }
}
