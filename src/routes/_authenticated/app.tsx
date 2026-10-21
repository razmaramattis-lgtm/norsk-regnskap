import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { Archive, BookOpen, Bot, Building, Building2, CalendarCheck, CalendarClock, FileInput, FileText, FileSpreadsheet, History, Landmark, LayoutDashboard, ListTree, LogOut, Package, Plug, Receipt, BarChart3, ScrollText, Truck, Users, Wallet, Scale } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CompanyProvider, useCompany, useMemberships, ROLLENAVN } from "@/lib/company";
import { NyttFirma } from "@/components/app/NyttFirma";
import { formatOrgNr } from "@/lib/format";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/app")({
  head: () => ({ meta: [{ title: "Fjordbok" }] }),
  component: AppLayout,
});

function AppLayout() {
  const { data, isLoading, error } = useMemberships();
  if (isLoading) return <div className="p-10 text-sm text-muted-foreground">Laster …</div>;
  if (error) return <div className="p-10 text-destructive">{(error as Error).message}</div>;
  if (!data || data.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-lg">
          <h1 className="mb-2 text-3xl">Opprett ditt første firma</h1>
          <p className="mb-8 text-sm text-muted-foreground">Vi setter opp standard kontoplan etter NS 4102 automatisk.</p>
          <NyttFirma />
        </div>
      </div>
    );
  }
  return (
    <CompanyProvider memberships={data}>
      <Shell />
    </CompanyProvider>
  );
}

const grupper = [
  { tittel: "", lenker: [{ to: "/app", label: "Oversikt", icon: LayoutDashboard, exact: true }] },
  { tittel: "Salg", lenker: [
    { to: "/app/fakturaer", label: "Fakturaer", icon: FileText },
    { to: "/app/kunder", label: "Kunder", icon: Users },
    { to: "/app/varer", label: "Varer og tjenester", icon: Package },
  ] },
  { tittel: "Kjøp", lenker: [
    { to: "/app/leverandorfakturaer", label: "Inngående fakturaer", icon: FileInput },
    { to: "/app/leverandorer", label: "Leverandører", icon: Truck },
  ] },
  { tittel: "Regnskap", lenker: [
    { to: "/app/bilag", label: "Bilag", icon: BookOpen },
    { to: "/app/bank", label: "Bank", icon: Landmark },
    { to: "/app/lonn", label: "Lønn", icon: Wallet },
    { to: "/app/arkiv", label: "Bilagsarkiv", icon: Archive },
    { to: "/app/anleggsmidler", label: "Anleggsmidler", icon: Building },
    { to: "/app/forslag", label: "Forslag fra AI", icon: Bot },
  ] },
  { tittel: "Rapporter", lenker: [
    { to: "/app/mva", label: "MVA-melding", icon: Receipt },
    { to: "/app/aarsregnskap", label: "Årsregnskap", icon: FileSpreadsheet },
    { to: "/app/frister", label: "Frister", icon: CalendarClock },
    { to: "/app/rapporter", label: "Resultat og balanse", icon: BarChart3 },
    { to: "/app/hovedbok", label: "Hovedbok", icon: ScrollText },
    { to: "/app/reskontro", label: "Reskontro", icon: Scale },
  ] },
  { tittel: "Innstillinger", lenker: [
    { to: "/app/aarsavslutning", label: "Perioder og årsoppgjør", icon: CalendarCheck },
    { to: "/app/kontoplan", label: "Kontoplan", icon: ListTree },
    { to: "/app/integrasjoner", label: "Integrasjoner", icon: Plug },
    { to: "/app/logg", label: "Revisjonslogg", icon: History },
    { to: "/app/firma", label: "Firma og brukere", icon: Building2 },
  ] },
] as const;

function Shell() {
  const { company, companies, setActive, role } = useCompany();
  const navigate = useNavigate();
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground">
        <div className="px-5 pb-4 pt-6 font-serif text-xl text-sidebar-accent-foreground">Fjordbok</div>
        <div className="px-3 pb-4">
          <Select value={company.id} onValueChange={(v) => (v === "__ny" ? navigate({ to: "/app/firma", search: { ny: true } }) : setActive(v))}>
            <SelectTrigger className="border-sidebar-border bg-sidebar-accent text-sidebar-accent-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {companies.map((m) => (
                <SelectItem key={m.company.id} value={m.company.id}>
                  {m.company.name}
                </SelectItem>
              ))}
              <SelectItem value="__ny">+ Nytt firma</SelectItem>
            </SelectContent>
          </Select>
          <div className="mt-2 px-1 text-xs opacity-60">
            {company.company_type === "as" ? "AS" : "ENK"} · {formatOrgNr(company.org_nr) || "uten org.nr"} · {ROLLENAVN[role]}
          </div>
        </div>
        <nav className="flex-1 space-y-4 overflow-y-auto px-3 pb-4">
          {grupper.map((g) => (
            <div key={g.tittel}>
              {g.tittel && <div className="px-3 pb-1 text-[10px] uppercase tracking-[0.15em] opacity-50">{g.tittel}</div>}
              {g.lenker.map(({ to, label, icon: Icon, ...rest }) => (
                <Link
                  key={to}
                  to={to}
                  activeOptions={{ exact: "exact" in rest }}
                  className="flex items-center gap-3 rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-sidebar-accent"
                  activeProps={{ className: "bg-sidebar-accent text-sidebar-primary" }}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <button
          onClick={async () => {
            await supabase.auth.signOut();
            navigate({ to: "/" });
          }}
          className="m-3 flex items-center gap-3 rounded-md px-3 py-2 text-sm opacity-70 hover:bg-sidebar-accent hover:opacity-100"
        >
          <LogOut className="h-4 w-4" /> Logg ut
        </button>
      </aside>
      <main className="min-w-0 flex-1 px-10 py-10">
        <Outlet />
      </main>
    </div>
  );
}
