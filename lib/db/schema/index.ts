/**
 * Single import surface for the database schema.
 *
 * Next milestones add `forms.ts` (forms, form_versions), `responses.ts`
 * (responses, form_events) and `ai.ts` (ai_conversations) alongside these.
 * Export them from here too so `db.query.*` stays fully typed.
 */
export * from "./auth";
export * from "./workspaces";
