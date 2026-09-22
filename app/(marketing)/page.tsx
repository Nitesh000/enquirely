import {
  ArrowRightIcon,
  BarChart3Icon,
  FileSpreadsheetIcon,
  GitBranchIcon,
  KeyboardIcon,
  MessageSquareQuoteIcon,
  SparklesIcon,
  SmartphoneIcon,
} from "lucide-react";
import Link from "next/link";

import { RuntimePreview } from "@/components/marketing/runtime-preview";
import { Section, SectionHeading } from "@/components/marketing/section";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const features = [
  {
    icon: SparklesIcon,
    title: "Describe it, don't build it",
    body: "Say what you want to learn. Inquirely writes the questions, picks the right input for each one, and wires up the branching. Then you edit anything you disagree with.",
  },
  {
    icon: KeyboardIcon,
    title: "Answerable without a mouse",
    body: "One question at a time. Enter to advance, letter keys to pick an option, number keys to rate. Respondents finish in a fraction of the time a grid of inputs takes.",
  },
  {
    icon: SmartphoneIcon,
    title: "Genuinely good on a phone",
    body: "The right keyboard for every field, tap targets you can actually hit, and a layout that does not fight the on-screen keyboard. Most of your answers will come from here.",
  },
  {
    icon: GitBranchIcon,
    title: "Logic that stays readable",
    body: "Branching is stored as structured rules, not a tangle of nested conditions. Ask a designer and a developer different questions without maintaining two forms.",
  },
  {
    icon: BarChart3Icon,
    title: "Results the moment they land",
    body: "Completion rate, drop-off per question, distributions and averages --- computed from your data, not estimated. Filter with the same conditions your logic uses.",
  },
  {
    icon: FileSpreadsheetIcon,
    title: "Exports that open cleanly",
    body: "CSV, JSON, and real Excel workbooks with a summary sheet and charts. Stable column order, so the spreadsheet you built last month still works.",
  },
];

const steps = [
  {
    step: "01",
    title: "Describe what you need",
    body: "\u201cA cancellation survey for a SaaS product, under two minutes, focused on onboarding.\u201d That is the whole brief.",
  },
  {
    step: "02",
    title: "Refine in plain language",
    body: "\u201cMake it shorter and friendlier. Drop question 13.\u201d You see exactly what changed before anything is applied, and undo still works.",
  },
  {
    step: "03",
    title: "Share the link, read the answers",
    body: "Send one URL. As responses arrive, ask questions about them the same way you built the form.",
  },
];

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-grid opacity-[0.35] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 left-1/2 size-[42rem] -translate-x-1/2 rounded-full bg-brand/15 blur-3xl"
        />

        <div className="relative mx-auto w-full max-w-6xl px-6 pt-20 pb-16 sm:pt-28 sm:pb-24">
          <div className="mx-auto max-w-3xl text-center">
            <Link
              href="/#how-it-works"
              className="inline-flex items-center gap-2 rounded-full border bg-background/70 px-3 py-1 text-xs text-muted-foreground backdrop-blur transition-colors hover:text-foreground"
            >
              <span className="size-1.5 rounded-full bg-brand" />
              Describe a survey, get a finished form
              <ArrowRightIcon className="size-3" />
            </Link>

            <h1 className="font-heading mt-6 text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
              Forms worth{" "}
              <span className="relative whitespace-nowrap">
                <span className="relative z-10">answering</span>
                <span
                  aria-hidden
                  className="absolute inset-x-0 bottom-1 z-0 h-3 bg-brand/25 sm:bottom-2 sm:h-4"
                />
              </span>
            </h1>

            <p className="mx-auto mt-6 max-w-xl text-lg text-pretty text-muted-foreground">
              Inquirely builds your survey from a sentence, makes answering it
              feel effortless on any device, and then tells you what the
              answers actually mean.
            </p>

            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button variant="brand" size="xl" asChild>
                <Link href="/sign-up">
                  Start building free
                  <ArrowRightIcon />
                </Link>
              </Button>
              <Button variant="outline" size="xl" asChild>
                <Link href="/#how-it-works">See how it works</Link>
              </Button>
            </div>

            <p className="mt-4 text-xs text-muted-foreground">
              No credit card. Your first form takes about a minute.
            </p>
          </div>

          <div className="mx-auto mt-16 max-w-2xl">
            <RuntimePreview />
          </div>
        </div>
      </section>

      {/* How it works */}
      <Section id="how-it-works" className="border-t bg-muted/30">
        <SectionHeading
          eyebrow="How it works"
          title="Three steps, and none of them are drag and drop"
          description="Building a survey should not feel like assembling furniture. Describe the outcome you want and adjust from there."
        />

        <ol className="mt-14 grid gap-6 md:grid-cols-3">
          {steps.map((item) => (
            <li key={item.step}>
              <Card className="h-full [--card-spacing:--spacing(6)]">
                <CardContent>
                  <span className="font-mono text-xs tracking-widest text-brand">
                    {item.step}
                  </span>
                  <h3 className="mt-3 text-lg font-semibold tracking-tight">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm text-pretty text-muted-foreground">
                    {item.body}
                  </p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
      </Section>

      {/* Features */}
      <Section id="features" className="border-t">
        <SectionHeading
          eyebrow="Features"
          title="Built around the person answering"
          description="Every response you lose to a tedious form is data you never get back. That is the constraint the whole product is designed around."
        />

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <Card
              key={feature.title}
              className="h-full [--card-spacing:--spacing(6)]"
            >
              <CardContent>
                <span className="inline-grid size-10 place-items-center rounded-xl bg-brand/10 text-brand">
                  <feature.icon className="size-5" />
                </span>
                <h3 className="mt-4 text-base font-semibold tracking-tight">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm text-pretty text-muted-foreground">
                  {feature.body}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>

      {/* Analysis */}
      <Section id="analysis" className="border-t bg-muted/30">
        <div className="grid items-center gap-14 lg:grid-cols-2">
          <div>
            <SectionHeading
              align="start"
              eyebrow="Analysis"
              title="Ask your responses a question"
              description="Two hundred free-text answers is not data, it is homework. Ask what you want to know and get an answer you can check --- every claim links back to the responses it came from."
            />

            <ul className="mt-8 space-y-4">
              {[
                "Themes pulled out of open text, with counts you can verify",
                "Statistics computed in the database, never guessed by a model",
                "Every insight cites the responses behind it",
              ].map((point) => (
                <li key={point} className="flex gap-3 text-sm">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand" />
                  <span className="text-muted-foreground">{point}</span>
                </li>
              ))}
            </ul>

            <Button variant="brand" size="lg" className="mt-8" asChild>
              <Link href="/sign-up">
                Try it on your own data
                <ArrowRightIcon />
              </Link>
            </Button>
          </div>

          <Card className="overflow-hidden [--card-spacing:--spacing(6)]">
            <CardContent className="space-y-4">
              <div className="flex justify-end">
                <p className="max-w-[85%] rounded-2xl rounded-br-sm bg-brand px-4 py-2.5 text-sm text-brand-foreground">
                  What are developers who rated onboarding below 3 complaining
                  about?
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-muted-foreground">
                  <span className="rounded-md bg-muted px-2 py-1">
                    filter · role = Developer
                  </span>
                  <span className="rounded-md bg-muted px-2 py-1">
                    filter · rating &lt; 3
                  </span>
                  <span className="rounded-md bg-muted px-2 py-1">
                    17 responses
                  </span>
                </div>

                <div className="max-w-[92%] space-y-3 rounded-2xl rounded-bl-sm border bg-background px-4 py-3 text-sm">
                  <p className="text-pretty">
                    Three themes account for 14 of the 17 responses:
                  </p>
                  <ul className="space-y-2 text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <MessageSquareQuoteIcon className="mt-0.5 size-3.5 shrink-0 text-brand" />
                      <span>
                        <strong className="text-foreground">
                          API keys are hard to find
                        </strong>{" "}
                        &mdash; 8 responses
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <MessageSquareQuoteIcon className="mt-0.5 size-3.5 shrink-0 text-brand" />
                      <span>
                        <strong className="text-foreground">
                          Docs assume prior setup
                        </strong>{" "}
                        &mdash; 4 responses
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <MessageSquareQuoteIcon className="mt-0.5 size-3.5 shrink-0 text-brand" />
                      <span>
                        <strong className="text-foreground">
                          No local dev story
                        </strong>{" "}
                        &mdash; 2 responses
                      </span>
                    </li>
                  </ul>
                  <p className="text-xs text-muted-foreground">
                    Sources: #14, #22, #31, #38 and 10 more
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </Section>

      {/* Closing CTA */}
      <Section className="border-t">
        <div className="relative overflow-hidden rounded-3xl border bg-card px-6 py-16 text-center sm:px-16">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-24 left-1/2 size-[28rem] -translate-x-1/2 rounded-full bg-brand/15 blur-3xl"
          />
          <div className="relative">
            <h2 className="font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Your next survey is one sentence away
            </h2>
            <p className="mx-auto mt-4 max-w-md text-pretty text-muted-foreground">
              Describe what you want to learn. Share the link. Read what it
              means.
            </p>
            <Button variant="brand" size="xl" className="mt-8" asChild>
              <Link href="/sign-up">
                Create your first form
                <ArrowRightIcon />
              </Link>
            </Button>
          </div>
        </div>
      </Section>
    </>
  );
}
