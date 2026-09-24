import { notFound } from "next/navigation";

/**
 * Public form runtime --- M2.
 *
 * Nothing resolves yet because the `forms` and `form_versions` tables do not
 * exist. The shape this should take:
 *
 *   const form = await getPublishedForm(slug);   // joins published_version_id
 *   if (!form) notFound();
 *   return <FormRenderer definition={form.definition} formId={form.id}
 *                        versionId={form.versionId} />;
 *
 * Two rules worth keeping when you fill this in:
 *  - render the *version's* definition, never `forms.definition` (the draft)
 *  - keep this a server component; `FormRenderer` owns all the interactivity
 */
export default async function PublicFormPage({
  params,
}: PageProps<"/f/[slug]">) {
  const { slug } = await params;
  void slug;

  notFound();
}
