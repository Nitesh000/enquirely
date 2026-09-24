import { Logo } from "@/components/brand/logo";
import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { UserMenu } from "@/components/dashboard/user-menu";
import { requireWorkspace } from "@/lib/session";

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
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur-md">
        <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
          <Logo href="/forms" />

          <span
            className="hidden truncate rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground sm:inline"
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

      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row lg:gap-10">
        <aside className="lg:w-52 lg:shrink-0 lg:pt-1">
          <SidebarNav />
        </aside>

        <main className="min-w-0 flex-1 pb-12">{children}</main>
      </div>
    </div>
  );
}
