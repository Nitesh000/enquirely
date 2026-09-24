/**
 * Respondent shell.
 *
 * Deliberately outside the (marketing) and (dashboard) route groups: no site
 * header, no sidebar, no auth. This route is the one users judge the product
 * by, so keep its bundle boring --- do not import dashboard or builder code
 * from anything rendered here, or it ships to every respondent.
 */
export default function FormLayout({ children }: LayoutProps<"/f/[slug]">) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-background">
      {children}
    </div>
  );
}
