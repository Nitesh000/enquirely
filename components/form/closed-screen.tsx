import { LockIcon } from "lucide-react";

export function ClosedScreen({ title }: { title: string }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-5 py-12 text-center">
      <div className="grid size-14 place-items-center rounded-2xl bg-muted text-muted-foreground">
        <LockIcon className="size-6" />
      </div>

      <h1 className="font-heading mt-7 text-2xl font-semibold tracking-tight">
        This form is no longer accepting responses
      </h1>
      <p className="mt-2.5 max-w-sm text-[0.9375rem] text-pretty text-muted-foreground">
        {title} has been closed by its owner. Get in touch with whoever shared
        this link if you think it should still be open.
      </p>
    </main>
  );
}
