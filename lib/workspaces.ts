import "server-only";

import { and, asc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { workspaceMembers, workspaces, type Workspace } from "@/lib/db/schema";
import { randomSuffix, slugify } from "@/lib/slug";

/**
 * Creates a user's personal workspace and their `owner` membership.
 *
 * Called from the Better Auth signup hook. Both rows go in one transaction:
 * a workspace nobody belongs to is invisible and unrecoverable through the UI.
 */
export async function createPersonalWorkspace({
  userId,
  name,
  email,
}: {
  userId: string;
  name: string;
  email: string;
}): Promise<Workspace> {
  const displayName = name.trim() || email.split("@")[0];
  const base = slugify(displayName, "workspace");

  return db.transaction(async (tx) => {
    let workspace: Workspace | undefined;

    // Slug collisions are rare but the column is unique, so retry rather than
    // fail a signup over it.
    for (let attempt = 0; attempt < 5 && !workspace; attempt++) {
      const slug = attempt === 0 ? base : `${base}-${randomSuffix()}`;

      const [inserted] = await tx
        .insert(workspaces)
        .values({
          name: `${displayName}'s workspace`,
          slug,
          ownerId: userId,
        })
        .onConflictDoNothing({ target: workspaces.slug })
        .returning();

      workspace = inserted;
    }

    if (!workspace) {
      throw new Error(
        `Could not allocate a workspace slug for user ${userId} after 5 attempts`,
      );
    }

    await tx.insert(workspaceMembers).values({
      workspaceId: workspace.id,
      userId,
      role: "owner",
    });

    return workspace;
  });
}

/** Every workspace the user belongs to, oldest first. */
export async function listWorkspacesForUser(
  userId: string,
): Promise<Workspace[]> {
  const rows = await db
    .select({ workspace: workspaces })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(eq(workspaceMembers.userId, userId))
    .orderBy(asc(workspaces.createdAt));

  return rows.map((row) => row.workspace);
}

/**
 * The workspace to act on for this request.
 *
 * Today that is simply the user's first (personal) workspace. When a workspace
 * switcher arrives, read the active id from a cookie here and keep every
 * caller unchanged.
 */
export async function getActiveWorkspace(
  userId: string,
): Promise<Workspace | null> {
  const [workspace] = await listWorkspacesForUser(userId);
  return workspace ?? null;
}

/**
 * Throws unless the user is a member of the workspace.
 *
 * Call this in any handler that takes a workspace id from the client. Never
 * trust a workspace id that arrived over HTTP.
 */
export async function requireWorkspaceMembership(
  userId: string,
  workspaceId: string,
): Promise<Workspace> {
  const [row] = await db
    .select({ workspace: workspaces })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(
      and(
        eq(workspaceMembers.userId, userId),
        eq(workspaceMembers.workspaceId, workspaceId),
      ),
    )
    .limit(1);

  if (!row) {
    throw new Error("Workspace not found");
  }

  return row.workspace;
}
