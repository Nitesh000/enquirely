import Link from "next/link";

import { LogoMark } from "@/components/brand/logo";

export default function FormNotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <LogoMark className="size-10 rounded-xl" />

      <h1 className="font-heading mt-6 text-2xl font-semibold tracking-tight">
        This form isn&rsquo;t available
      </h1>
      <p className="mt-2 max-w-sm text-pretty text-muted-foreground">
        The link may be wrong, or the form may have been closed by the person
        who created it.
      </p>

      <Link
        href="/"
        className="mt-8 text-sm font-medium underline-offset-4 hover:underline"
      >
        What is Enquirely?
      </Link>
    </main>
  );
}
