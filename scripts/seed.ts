import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

// Tooling script, runs outside Next --- same reason drizzle.config.ts loads
// .env.local itself instead of importing the server-only `lib/config/env`.
config({ path: ".env.local", quiet: true });

import { eq } from "drizzle-orm";

import { formDefinitionSchema, type FormDefinition } from "@/lib/forms/schema";
import { validateDefinition } from "@/lib/forms/validate-definition";

import * as schema from "../lib/db/schema";

const SEED_USER_ID = "ntudu2k19";
const SEED_USER_EMAIL = "ntudu2k19@gmail.com";
const SEED_WORKSPACE_SLUG = "ntudu2k19";
const SEED_FORM_SLUG = "customer-feedback";

const sampleDefinition: FormDefinition = {
  version: 1,
  title: "Customer Feedback",
  description: "A quick survey covering every MVP block type.",
  blocks: [
    {
      id: "q1",
      title: "What's your name?",
      type: "short_text",
      required: false,
      shortText: {},
    },
    {
      id: "q2",
      title: "What could we do better?",
      type: "long_text",
      required: false,
      longText: {},
    },
    {
      id: "q3",
      title: "What's your email, if you'd like a reply?",
      type: "email",
      required: false,
    },
    {
      id: "q4",
      title: "How many people are on your team?",
      type: "number",
      required: false,
      number: { min: 1 },
    },
    {
      id: "q5",
      title: "How did you hear about us?",
      type: "single_choice",
      required: true,
      singleChoice: {
        options: [
          { id: "google", label: "Google" },
          { id: "twitter", label: "Twitter" },
          { id: "friend", label: "Friend" },
          { id: "other", label: "Other" },
        ],
      },
    },
    {
      id: "q6",
      title: "Which features do you use?",
      type: "multi_choice",
      required: false,
      multiChoice: {
        options: [
          { id: "forms", label: "Forms" },
          { id: "logic", label: "Logic" },
          { id: "analytics", label: "Analytics" },
          { id: "exports", label: "Exports" },
        ],
      },
    },
    {
      id: "q7",
      title: "How likely are you to recommend us?",
      type: "rating",
      required: true,
      rating: { max: 5, style: "star" },
    },
    {
      id: "q8",
      title: "Would you like to be contacted for a follow-up interview?",
      type: "yes_no",
      required: false,
    },
  ],
  logic: [],
  theme: {
    preset: "minimal",
    accentColor: "#6366f1",
    font: "Inter",
    buttonStyle: "rounded",
    animation: "subtle",
  },
};

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is required. Copy .env.example to .env.local.",
    );
  }

  // Fail loudly before touching the database if the hand-authored definition
  // is wrong --- this is exactly the boundary `formDefinitionSchema` and
  // `validateDefinition` exist to guard.
  const definition = formDefinitionSchema.parse(sampleDefinition);
  const issues = validateDefinition(definition);
  if (issues.length > 0) {
    throw new Error(
      `Seed definition failed validation:\n${issues.map((i) => `  - ${i.message}`).join("\n")}`,
    );
  }

  const sql = postgres(databaseUrl, { max: 1 });
  const db = drizzle(sql, { schema, casing: "snake_case" });

  try {
    await db
      .insert(schema.users)
      .values({
        id: SEED_USER_ID,
        name: "Seed User",
        email: SEED_USER_EMAIL,
        emailVerified: true,
      })
      .onConflictDoNothing({ target: schema.users.id });

    const [workspace] = await db
      .insert(schema.workspaces)
      .values({
        name: "Seed Workspace",
        slug: SEED_WORKSPACE_SLUG,
        ownerId: SEED_USER_ID,
      })
      .onConflictDoUpdate({
        target: schema.workspaces.slug,
        set: { updatedAt: new Date() },
      })
      .returning();

    await db
      .insert(schema.workspaceMembers)
      .values({
        workspaceId: workspace.id,
        userId: SEED_USER_ID,
        role: "owner",
      })
      .onConflictDoNothing();

    const [form] = await db
      .insert(schema.forms)
      .values({
        workspaceId: workspace.id,
        title: definition.title,
        slug: SEED_FORM_SLUG,
        definition,
        theme: definition.theme,
      })
      .onConflictDoUpdate({
        target: schema.forms.slug,
        set: { definition, theme: definition.theme, updatedAt: new Date() },
      })
      .returning();

    const [existingVersion] = await db
      .select()
      .from(schema.formVersions)
      .where(eq(schema.formVersions.formId, form.id))
      .limit(1);

    const version =
      existingVersion ??
      (
        await db
          .insert(schema.formVersions)
          .values({
            formId: form.id,
            versionNumber: 1,
            definition,
          })
          .returning()
      )[0];

    await db
      .update(schema.forms)
      .set({ publishedVersionId: version.id })
      .where(eq(schema.forms.id, form.id));

    console.log("Seeded successfully:");
    console.log(`  Workspace: ${workspace.name} (${workspace.slug})`);
    console.log(`  Form:      ${form.title} -> /f/${form.slug}`);
    console.log(`  Version:   ${version.versionNumber}`);
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
