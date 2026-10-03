import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { formVersions, forms } from "@/lib/db/schema";
import type { FormDefinition } from "@/lib/forms/schema";

export type PublishedForm = {
  formId: string;
  versionId: string;
  versionNumber: number;
  title: string;
  definition: FormDefinition;
};

/**
 * The published form behind a public `/f/[slug]` URL, or `null`.
 *
 * Reads `form_versions.definition` --- the frozen snapshot --- never
 * `forms.definition`, which is the live draft the creator may be
 * mid-edit on (`plan.md` §6). A respondent must never see an unpublished
 * change, and a response must always be attributable to the exact
 * definition it was answered against.
 */
export async function getPublishedFormBySlug(
  slug: string,
): Promise<PublishedForm | null> {
  const [row] = await db
    .select({
      formId: forms.id,
      title: forms.title,
      versionId: formVersions.id,
      versionNumber: formVersions.versionNumber,
      definition: formVersions.definition,
    })
    .from(forms)
    .innerJoin(
      formVersions,
      and(
        eq(formVersions.id, forms.publishedVersionId),
        eq(formVersions.formId, forms.id),
      ),
    )
    .where(eq(forms.slug, slug))
    .limit(1);

  if (!row) return null;

  return {
    formId: row.formId,
    versionId: row.versionId,
    versionNumber: row.versionNumber,
    title: row.title,
    definition: row.definition,
  };
}
