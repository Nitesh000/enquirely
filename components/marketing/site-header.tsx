import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/session";

const navigation = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#features", label: "Features" },
  { href: "/#analysis", label: "Analysis" },
];

export async function SiteHeader() {
  const session = await getSession();

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-6 px-6">
        <Logo />

        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {navigation.map((item) => (
            <Button key={item.href} variant="ghost" size="sm" asChild>
              <Link href={item.href}>{item.label}</Link>
            </Button>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          {session ? (
            <Button variant="brand" size="sm" asChild>
              <Link href="/forms">Go to dashboard</Link>
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/sign-in">Sign in</Link>
              </Button>
              <Button variant="brand" size="sm" asChild>
                <Link href="/sign-up">Get started</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
