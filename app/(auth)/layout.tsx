import Link from "next/link";
import { redirect } from "next/navigation";

import { Logo, LogoMark, LogoMedium, Wordmark } from "@/components/brand/logo";
import { getSession } from "@/lib/session";

export default async function AuthLayout({ children }: LayoutProps<"/">) {
  // Already signed in? The sign-in page has nothing to offer.
  if (await getSession()) {
    redirect("/forms");
  }

  return (
    <main className="flex flex-col flex-1 justify-center items-center py-12 px-6">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-grid opacity-30 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_40%,black,transparent)]"
      />

      <div className="inline-flex gap-2.5 items-center mb-8">
        <LogoMedium />
      </div>

      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
