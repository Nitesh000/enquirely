import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * PLACEHOLDER MARK --- replace when the real logo lands.
 *
 * Swap the SVG below for the final artwork and everything else keeps working:
 * the header, footer, auth pages and dashboard sidebar all render `<Logo />`
 * or `<LogoMark />` and never draw the mark themselves.
 *
 * Keep the mark square and let it inherit `currentColor` so it survives dark
 * mode and the inverted footer without a second asset.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-grid size-8 shrink-0 place-items-center rounded-[0.55rem] bg-brand text-brand-foreground",
        className,
      )}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className="size-[1.125em]"
        strokeWidth={2.25}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* A question mark drawn as a speech-bubble tail: "asking", not "help". */}
        <path d="M8.5 8.75a3.5 3.5 0 1 1 4.9 3.21c-.86.38-1.4 1.2-1.4 2.14v.4" />
        <path d="M12 18.25h.01" />
      </svg>
    </span>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "font-heading text-[1.0625rem] font-semibold tracking-tight",
        className,
      )}
    >
      Inquirely
    </span>
  );
}

export function Logo({
  className,
  href = "/",
  showWordmark = true,
}: {
  className?: string;
  href?: string;
  showWordmark?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        className,
      )}
    >
      <LogoMark />
      {showWordmark ? <Wordmark /> : <span className="sr-only">Inquirely</span>}
    </Link>
  );
}
