import type { ReactNode } from "react";

import { cn } from "@/lib/utils/utils";

/** Shared page rhythm, so sections cannot drift apart over time. */
export function Section({
  id,
  className,
  children,
}: {
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className={cn("scroll-mt-20 py-20 sm:py-28", className)}>
      <div className="px-6 mx-auto w-full max-w-6xl">{children}</div>
    </section>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "center" | "start";
}) {
  return (
    <div
      className={cn(
        "max-w-2xl",
        align === "center" ? "mx-auto text-center" : "text-left",
      )}
    >
      {eyebrow ? (
        <p className="mb-3 font-mono text-xs tracking-widest uppercase text-brand">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl font-heading text-balance">
        {title}
      </h2>
      {description ? (
        <p className="mt-4 text-base sm:text-lg text-pretty text-muted-foreground">
          {description}
        </p>
      ) : null}
    </div>
  );
}
