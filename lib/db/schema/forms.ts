import { relations } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import type { FormDefinition, FormTheme } from "@/lib/forms/schema";

import { workspaces } from "./workspaces";

/**
 * `forms.definition` is the live, mutable draft. `form_versions.definition`
 * is an immutable snapshot frozen at publish time (`plan.md` §6).
 * `responses` reference the version they were answered against, never the
 * draft --- so editing a published form can never corrupt the
 * interpretation of historical responses.
 */
export const forms = pgTable(
  "forms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    slug: text("slug").notNull().unique(),
    definition: jsonb("definition").$type<FormDefinition>().notNull(),
    settings: jsonb("settings").$type<Record<string, unknown>>(),
    theme: jsonb("theme").$type<FormTheme>(),
    publishedVersionId: uuid("published_version_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    /**
     * Explicit millisecond precision --- the autosave route's optimistic
     * lock (`steps.md` M3.7) compares this column against a value the
     * client round-tripped through `Date.toISOString()`, which only carries
     * milliseconds. Postgres' default `timestamp` precision is
     * microseconds; left at the default, the comparison would fail on
     * *every* save, concurrent or not, since the sub-millisecond digits
     * the client could never have known about would never match.
     */
    updatedAt: timestamp("updated_at", { precision: 3 }).notNull().defaultNow(),
  },
  (table) => [
    // "list my forms" runs on every dashboard request.
    index("forms_workspace_id_idx").on(table.workspaceId),
  ],
);

export const formVersions = pgTable(
  "form_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    formId: uuid("form_id")
      .notNull()
      .references(() => forms.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    definition: jsonb("definition").$type<FormDefinition>().notNull(),
    publishedAt: timestamp("published_at").notNull().defaultNow(),
  },
  (table) => [index("form_versions_form_id_idx").on(table.formId)],
);

export const responses = pgTable(
  "responses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    formId: uuid("form_id")
      .notNull()
      .references(() => forms.id, { onDelete: "cascade" }),
    formVersionId: uuid("form_version_id")
      .notNull()
      .references(() => formVersions.id, { onDelete: "cascade" }),
    answers: jsonb("answers").$type<Record<string, unknown>>().notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    // every analytics query in M5 (completion rate, drop-off) hits this.
    index("responses_form_id_idx").on(table.formId),
  ],
);

export const formsRelations = relations(forms, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [forms.workspaceId],
    references: [workspaces.id],
  }),
  versions: many(formVersions),
  responses: many(responses),
}));

export const formVersionsRelations = relations(
  formVersions,
  ({ one, many }) => ({
    form: one(forms, {
      fields: [formVersions.formId],
      references: [forms.id],
    }),
    responses: many(responses),
  }),
);

export const responsesRelations = relations(responses, ({ one }) => ({
  form: one(forms, {
    fields: [responses.formId],
    references: [forms.id],
  }),
  formVersion: one(formVersions, {
    fields: [responses.formVersionId],
    references: [formVersions.id],
  }),
}));

export type Form = typeof forms.$inferSelect;
export type FormVersion = typeof formVersions.$inferSelect;
export type Response = typeof responses.$inferSelect;
