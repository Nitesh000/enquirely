import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { formVersions, forms, responses } from "@/lib/db/schema";
import { randomSuffix, slugify } from "@/lib/utils/slug";
import { formDefinitionSchema, type FormDefinition } from "@/lib/forms/schema";
import { validateDefinition } from "@/lib/forms/validate-definition";

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

export type FormListItem = {
  id: string;
  title: string;
  slug: string;
  blockCount: number;
  published: boolean;
  updatedAt: Date;
  responseCount: number;
};

/** Every form in a workspace, most recently updated first --- AGENTS.md: every form query is workspace-scoped. */
export async function listFormsForWorkspace(
  workspaceId: string,
): Promise<FormListItem[]> {
  const rows = await db
    .select({
      id: forms.id,
      title: forms.title,
      slug: forms.slug,
      definition: forms.definition,
      publishedVersionId: forms.publishedVersionId,
      updatedAt: forms.updatedAt,
      // LEFT JOIN + count: a form with zero responses must still appear,
      // not get dropped by an inner join.
      responseCount: sql<number>`count(${responses.id})::int`,
    })
    .from(forms)
    .leftJoin(responses, eq(responses.formId, forms.id))
    .where(eq(forms.workspaceId, workspaceId))
    .groupBy(forms.id)
    .orderBy(desc(forms.updatedAt));

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    slug: row.slug,
    blockCount: row.definition.blocks.length,
    published: row.publishedVersionId !== null,
    updatedAt: row.updatedAt,
    responseCount: row.responseCount,
  }));
}

const emptyDefinition: FormDefinition = formDefinitionSchema.parse({
  version: 1,
  title: "Untitled form",
  blocks: [],
  logic: [],
});

/**
 * Starts a new, empty draft. Slug collisions retry with a random suffix ---
 * same pattern as `createPersonalWorkspace`, since `forms.slug` is globally
 * unique (it's the public `/f/[slug]` path, not scoped per workspace).
 */
export async function createForm({
  workspaceId,
  title,
  definition: provided,
}: {
  workspaceId: string;
  title: string;
  /**
   * A starting definition --- AI generation (`steps.md` M6.5) hands one over
   * rather than creating an empty form and then patching it, which would
   * leave an "Untitled form" row behind if the second request failed.
   */
  definition?: FormDefinition;
}): Promise<{ id: string; slug: string }> {
  // A generated form carries its own title, and the slug should reflect it
  // rather than the caller's placeholder.
  const trimmedTitle = (provided?.title ?? title).trim() || "Untitled form";
  const base = slugify(trimmedTitle);
  const definition = { ...(provided ?? emptyDefinition), title: trimmedTitle };

  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = attempt === 0 ? base : `${base}-${randomSuffix()}`;

    const [inserted] = await db
      .insert(forms)
      .values({ workspaceId, title: trimmedTitle, slug, definition })
      .onConflictDoNothing({ target: forms.slug })
      .returning({ id: forms.id, slug: forms.slug });

    if (inserted) return inserted;
  }

  throw new Error(`Could not allocate a form slug after 5 attempts`);
}

export type EditableForm = {
  id: string;
  title: string;
  slug: string;
  definition: FormDefinition;
  publishedVersionId: string | null;
  updatedAt: Date;
};

/**
 * A form's live draft, scoped to the workspace that owns it.
 *
 * Takes `workspaceId` as a required filter, not an afterthought check ---
 * a form id guessed or copied from another workspace matches nothing here
 * rather than leaking another tenant's draft.
 */
export async function getFormForEdit({
  formId,
  workspaceId,
}: {
  formId: string;
  workspaceId: string;
}): Promise<EditableForm | null> {
  const [row] = await db
    .select({
      id: forms.id,
      title: forms.title,
      slug: forms.slug,
      definition: forms.definition,
      publishedVersionId: forms.publishedVersionId,
      updatedAt: forms.updatedAt,
    })
    .from(forms)
    .where(and(eq(forms.id, formId), eq(forms.workspaceId, workspaceId)))
    .limit(1);

  return row ?? null;
}

export type SaveDefinitionResult =
  | { ok: true; updatedAt: Date }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "conflict"; updatedAt: Date };

/**
 * Autosaves the draft, with optimistic locking on `updated_at`
 * (`steps.md` M3.7): the caller must pass the `updatedAt` it last saw, and
 * the write only lands if no other save has happened since. A second tab
 * (or a stale local save queued behind a slow request) gets told to reload
 * rather than silently overwriting a newer draft.
 *
 * `forms.title` is kept mirrored to `definition.title` on every save so the
 * two never drift --- the list page reads the column, the builder and the
 * respondent runtime read the JSON.
 */
export async function updateFormDefinition({
  formId,
  workspaceId,
  definition,
  expectedUpdatedAt,
}: {
  formId: string;
  workspaceId: string;
  definition: FormDefinition;
  expectedUpdatedAt: Date;
}): Promise<SaveDefinitionResult> {
  const [updated] = await db
    .update(forms)
    .set({ title: definition.title, definition, updatedAt: new Date() })
    .where(
      and(
        eq(forms.id, formId),
        eq(forms.workspaceId, workspaceId),
        eq(forms.updatedAt, expectedUpdatedAt),
      ),
    )
    .returning({ updatedAt: forms.updatedAt });

  if (updated) return { ok: true, updatedAt: updated.updatedAt };

  const [current] = await db
    .select({ updatedAt: forms.updatedAt })
    .from(forms)
    .where(and(eq(forms.id, formId), eq(forms.workspaceId, workspaceId)))
    .limit(1);

  if (!current) return { ok: false, reason: "not_found" };
  return { ok: false, reason: "conflict", updatedAt: current.updatedAt };
}

export async function renameForm({
  formId,
  workspaceId,
  title,
}: {
  formId: string;
  workspaceId: string;
  title: string;
}): Promise<boolean> {
  const trimmedTitle = title.trim();
  if (!trimmedTitle) return false;

  const [row] = await db
    .select({ definition: forms.definition })
    .from(forms)
    .where(and(eq(forms.id, formId), eq(forms.workspaceId, workspaceId)))
    .limit(1);

  if (!row) return false;

  const [updated] = await db
    .update(forms)
    .set({
      title: trimmedTitle,
      definition: { ...row.definition, title: trimmedTitle },
      updatedAt: new Date(),
    })
    .where(and(eq(forms.id, formId), eq(forms.workspaceId, workspaceId)))
    .returning({ id: forms.id });

  return Boolean(updated);
}

/** Copies the draft only --- publish history is deliberately not duplicated. */
export async function duplicateForm({
  formId,
  workspaceId,
}: {
  formId: string;
  workspaceId: string;
}): Promise<{ id: string } | null> {
  const source = await getFormForEdit({ formId, workspaceId });
  if (!source) return null;

  const title = `${source.title} (copy)`;
  const base = slugify(title);

  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = attempt === 0 ? base : `${base}-${randomSuffix()}`;

    const [inserted] = await db
      .insert(forms)
      .values({
        workspaceId,
        title,
        slug,
        definition: { ...source.definition, title },
      })
      .onConflictDoNothing({ target: forms.slug })
      .returning({ id: forms.id });

    if (inserted) return inserted;
  }

  throw new Error(`Could not allocate a form slug after 5 attempts`);
}

export async function deleteForm({
  formId,
  workspaceId,
}: {
  formId: string;
  workspaceId: string;
}): Promise<boolean> {
  const [deleted] = await db
    .delete(forms)
    .where(and(eq(forms.id, formId), eq(forms.workspaceId, workspaceId)))
    .returning({ id: forms.id });

  return Boolean(deleted);
}

export type PublishResult =
  | { ok: true; versionId: string; versionNumber: number }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "invalid"; issues: string[] };

/**
 * Validates the draft, inserts an immutable `form_versions` snapshot, and
 * points `published_version_id` at it (`plan.md` §6, `steps.md` M3.10).
 * Refuses outright on validation failure --- the respondent runtime and the
 * version table must never hold a form that fails its own structural rules.
 */
export async function publishForm({
  formId,
  workspaceId,
}: {
  formId: string;
  workspaceId: string;
}): Promise<PublishResult> {
  const form = await getFormForEdit({ formId, workspaceId });
  if (!form) return { ok: false, reason: "not_found" };

  const issues = validateDefinition(form.definition);
  if (issues.length > 0) {
    return {
      ok: false,
      reason: "invalid",
      issues: issues.map((i) => i.message),
    };
  }

  return db.transaction(async (tx) => {
    const [latest] = await tx
      .select({ versionNumber: formVersions.versionNumber })
      .from(formVersions)
      .where(eq(formVersions.formId, formId))
      .orderBy(desc(formVersions.versionNumber))
      .limit(1);

    const versionNumber = (latest?.versionNumber ?? 0) + 1;

    const [version] = await tx
      .insert(formVersions)
      .values({ formId, versionNumber, definition: form.definition })
      .returning({ id: formVersions.id });

    await tx
      .update(forms)
      .set({ publishedVersionId: version.id })
      .where(eq(forms.id, formId));

    return { ok: true, versionId: version.id, versionNumber };
  });
}
