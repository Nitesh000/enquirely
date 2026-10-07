import { Logo } from "@/components/brand/logo";
import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { UserMenu } from "@/components/dashboard/user-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { requireWorkspace } from "@/lib/db/auth/session";

/**
 * Authenticated shell.
 *
 * `requireWorkspace()` runs here so every page underneath can assume both a
 * session and a workspace exist. Pages still call it themselves to get the
 * workspace id --- it is `cache()`d, so that costs nothing.
 */
export default async function DashboardLayout({ children }: LayoutProps<"/">) {
  const { session, workspace } = await requireWorkspace();

  return (
    <div className="flex flex-col flex-1 min-h-full">
      <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur-md">
        <div className="flex gap-3 items-center px-4 h-14 sm:px-6">
          <Logo href="/forms" />

          <span
            className="hidden py-1 px-2 text-xs rounded-md sm:inline truncate bg-muted text-muted-foreground"
            title={workspace.name}
          >
            {workspace.name}
          </span>

          <div className="ml-auto">
            <UserMenu
              name={session.user.name}
              email={session.user.email}
              image={session.user.image}
            />
          </div>
        </div>
      </header>

      <div className="flex flex-col flex-1 gap-6 py-6 px-4 mx-auto w-full max-w-7xl sm:px-6 lg:flex-row lg:gap-10">
        <aside className="lg:pt-1 lg:w-52 lg:shrink-0">
          <SidebarNav />
        </aside>

        <main className="flex-1 pb-12 min-w-0">{children}</main>
      </div>

      <ConfirmDialog />
    </div>
  );
}
