import type { Metadata } from "next";

import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { requireWorkspace } from "@/lib/db/auth/session";

export const metadata: Metadata = { title: "Settings" };

/**
 * Read-only for now.
 *
 * Deliberately not built (plan.md §27): team invitations, roles, billing, SSO.
 * `workspace_members` exists in the schema so those stay migrations rather
 * than rewrites, but there is no UI for them and should not be one yet.
 */
export default async function SettingsPage() {
  const { session, workspace } = await requireWorkspace();

  const fields = [
    { label: "Name", value: session.user.name },
    { label: "Email", value: session.user.email },
    { label: "Workspace", value: workspace.name },
    { label: "Workspace slug", value: workspace.slug, mono: true },
  ];

  return (
    <>
      <PageHeader title="Settings" description="Your account and workspace." />

      <Card className="max-w-xl [--card-spacing:--spacing(6)]">
        <CardContent className="space-y-5">
          {fields.map((field) => (
            <div key={field.label} className="space-y-1.5">
              <Label className="text-muted-foreground">{field.label}</Label>
              <p className={field.mono ? "font-mono text-sm" : "text-sm"}>
                {field.value}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}
