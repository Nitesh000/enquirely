import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { auth, type Session } from "@/lib/db/auth/auth";
import { getActiveWorkspace } from "@/lib/db/workspace/workspaces";
import type { Workspace } from "@/lib/db/schema";

/**
 * The current session, or null.
 *
 * Wrapped in `cache()` so a layout and three server components in the same
 * render share one lookup instead of hitting the session store four times.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  return auth.api.getSession({ headers: await headers() });
});

/** Session or redirect to sign-in. Use in any page under (dashboard). */
export async function requireSession(): Promise<Session> {
  const session = await getSession();

  if (!session) {
    redirect("/sign-in");
  }

  return session;
}

/**
 * Session plus the workspace to scope queries by.
 *
 * Signup always creates a workspace, so a session without one means the hook
 * failed --- send them back through sign-in rather than rendering an empty
 * dashboard that silently writes nowhere.
 */
export async function requireWorkspace(): Promise<{
  session: Session;
  workspace: Workspace;
}> {
  const session = await requireSession();
  const workspace = await getActiveWorkspace(session.user.id);

  if (!workspace) {
    redirect("/sign-in?error=no-workspace");
  }

  return { session, workspace };
}
