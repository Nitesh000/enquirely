import Link from "next/link";

import { LogoMark, Wordmark } from "@/components/brand/logo";

const columns = [
  {
    title: "Product",
    links: [
      { href: "/#how-it-works", label: "How it works" },
      { href: "/#features", label: "Features" },
      { href: "/#analysis", label: "AI analysis" },
    ],
  },
  {
    title: "Get started",
    links: [
      { href: "/sign-up", label: "Create an account" },
      { href: "/sign-in", label: "Sign in" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border/60">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <LogoMark />
            <Wordmark />
          </Link>
          <p className="mt-4 max-w-xs text-sm text-muted-foreground">
            Forms worth answering. Describe what you want to learn, and let the
            answers explain themselves.
          </p>
        </div>

        {columns.map((column) => (
          <div key={column.title}>
            <h2 className="text-sm font-medium">{column.title}</h2>
            <ul className="mt-4 space-y-3">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-border/60">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-6 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {new Date().getFullYear()} Inquirely. All rights reserved.</p>
          <p>Built for people who hate filling in forms.</p>
        </div>
      </div>
    </footer>
  );
}
