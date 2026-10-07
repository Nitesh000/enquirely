import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { requireWorkspace } from "@/lib/db/auth/session";

/**
 * Builder shell, deliberately outside `(dashboard)` --- its header/sidebar/
 * `max-w-7xl` content column would fight `BuilderShell`'s own full-viewport
 * three-pane layout (same reasoning as `app/f/[slug]/layout.tsx` sitting
 * outside every other group). Still auth-gated: `requireWorkspace()` runs
 * here exactly as it does in `(dashboard)/layout.tsx`.
 */
export default async function BuilderLayout({ children }: LayoutProps<"/">) {
  await requireWorkspace();

  return (
    <div className="h-dvh">
      {children}
      <ConfirmDialog />
    </div>
  );
}
