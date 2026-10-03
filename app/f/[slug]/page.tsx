import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FormRenderer } from "@/components/form/form-renderer";
import { getPublishedFormBySlug } from "@/lib/db/forms/forms";

/**
 * Public form runtime --- M2.
 *
 * Stays a server component: it loads the published version and hands the
 * definition to `FormRenderer`, which owns every bit of interactivity. Two
 * rules worth keeping:
 *  - render the *version's* definition, never `forms.definition` (the draft)
 *  - import nothing from the dashboard or builder here, or it ships to every
 *    respondent
 */
export async function generateMetadata({
  params,
}: PageProps<"/f/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const form = await getPublishedFormBySlug(slug);

  if (!form) return { title: "Form not found" };

  return {
    title: form.title,
    description: form.definition.description,
    // A respondent link is not a page we want in search results.
    robots: { index: false, follow: false },
  };
}

export default async function PublicFormPage({
  params,
}: PageProps<"/f/[slug]">) {
  const { slug } = await params;
  const form = await getPublishedFormBySlug(slug);

  if (!form) notFound();

  return (
    <FormRenderer
      definition={form.definition}
      slug={slug}
      formId={form.formId}
      versionId={form.versionId}
    />
  );
}
