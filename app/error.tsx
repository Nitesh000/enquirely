"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Replace with your error reporter when one exists. Until then the
    // console at least keeps the digest reachable in production.
    console.error(error);
  }, [error]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <h1 className="font-heading text-2xl font-semibold tracking-tight">
        Something went wrong
      </h1>
      <p className="mt-2 max-w-sm text-pretty text-muted-foreground">
        The error has been logged. Try again, and if it keeps happening the
        digest below will help track it down.
      </p>

      {error.digest ? (
        <code className="mt-4 rounded-md bg-muted px-2 py-1 font-mono text-xs text-muted-foreground">
          {error.digest}
        </code>
      ) : null}

      <Button variant="brand" className="mt-8" onClick={reset}>
        Try again
      </Button>
    </main>
  );
}
