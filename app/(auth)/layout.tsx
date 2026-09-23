import Link from "next/link";
import { redirect } from "next/navigation";

import { LogoMark, Wordmark } from "@/components/brand/logo";
import { getSession } from "@/lib/session";

export default async function AuthLayout({ children }: LayoutProps<"/">) {
  // Already signed in? The sign-in page has nothing to offer.
  if (await getSession()) {
    redirect("/forms");
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-12">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-grid opacity-30 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_40%,black,transparent)]"
      />

      <Link href="/" className="mb-8 inline-flex items-center gap-2.5">
        <LogoMark />
        <Wordmark className="text-lg" />
      </Link>

      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
