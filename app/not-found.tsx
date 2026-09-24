import Link from "next/link";

import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <LogoMark className="size-10 rounded-xl" />

      <p className="mt-6 font-mono text-xs tracking-widest text-brand uppercase">
        404
      </p>
      <h1 className="font-heading mt-2 text-3xl font-semibold tracking-tight">
        Page not found
      </h1>
      <p className="mt-2 max-w-sm text-pretty text-muted-foreground">
        That page does not exist. It may have moved, or the link may be wrong.
      </p>

      <Button variant="brand" className="mt-8" asChild>
        <Link href="/">Back to home</Link>
      </Button>
    </main>
  );
}
