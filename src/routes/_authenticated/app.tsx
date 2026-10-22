import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LogOut, Menu, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CompanyProvider, useCompany, useMemberships, ROLLENAVN } from "@/lib/company";
import { NyttFirma } from "@/components/app/NyttFirma";
import { Kommandopalett } from "@/components/app/Kommandopalett";
import { grupper } from "@/components/app/navigasjon";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Bokforingsmodus } from "@/components/app/Bokforingsmodus";
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


function Shell() {
  const [søk, setSøk] = useState(false);
  const [meny, setMeny] = useState(false);
  const [bokforing, setBokforing] = useState(false);
  return (
    <Bokforingsmodus.Provider value={setBokforing}>
    <div className="flex min-h-screen">
      <aside className={`sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground ${bokforing ? "" : "md:flex"}`}>
        <Sidemeny onSøk={() => setSøk(true)} />
      </aside>
      <Sheet open={meny} onOpenChange={setMeny}>
        <SheetContent side="left" className="flex w-72 flex-col gap-0 border-0 bg-sidebar p-0 text-sidebar-foreground">
          <SheetTitle className="sr-only">Meny</SheetTitle>
          <Sidemeny onSøk={() => { setMeny(false); setSøk(true); }} onVelg={() => setMeny(false)} />
        </SheetContent>
      </Sheet>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className={`${bokforing ? "hidden" : "flex md:hidden"} sticky top-0 z-20 items-center gap-2 border-b border-border bg-background/85 px-4 py-2.5 backdrop-blur`}>
          <button onClick={() => setMeny(true)} className="rounded-md p-2 hover:bg-muted" aria-label="Åpne meny">
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-serif text-lg">Fjordbok</span>
          <button onClick={() => setSøk(true)} className="ml-auto rounded-md p-2 hover:bg-muted" aria-label="Søk">
            <Search className="h-5 w-5" />
          </button>
        </header>
        <main className={bokforing ? "min-w-0 flex-1 p-3" : "min-w-0 flex-1 px-4 py-6 md:px-10 md:py-10"}>
          <Outlet />
        </main>
      </div>
      <Kommandopalett open={søk} onOpenChange={setSøk} />
    </div>
    </Bokforingsmodus.Provider>
  );
}

function Sidemeny({ onSøk, onVelg }: { onSøk: () => void; onVelg?: () => void }) {
  const { company, companies, setActive, role } = useCompany();
  const navigate = useNavigate();
  const { data: mottak = 0 } = useQuery({
    queryKey: ["mottak-antall", company.id],
    queryFn: async () =>
      (
        await supabase
          .from("documents")
          .select("id", { count: "exact", head: true })
          .eq("company_id", company.id)
          .is("voucher_id", null)
          .is("supplier_invoice_id", null)
      ).count ?? 0,
  });
  const merke: Record<string, number> = { "/app/mottak": mottak };
  return (
    <>
      <div className="flex items-center gap-2.5 px-5 pb-4 pt-6">
        <svg aria-hidden viewBox="0 0 32 32" className="h-8 w-8 shrink-0">
          <rect width="32" height="32" rx="8" fill="var(--sidebar-primary)" />
          <path d="M5 21 C 9 15, 12 23, 16 17 S 23 12, 27 18" stroke="var(--sidebar)" strokeWidth="2.6" fill="none" strokeLinecap="round" />
          <path d="M5 25.5 C 9 21, 12 27, 16 22.5 S 23 18.5, 27 23" stroke="var(--sidebar)" strokeWidth="1.8" fill="none" strokeLinecap="round" opacity=".55" />
        </svg>
        <span className="font-serif text-xl text-sidebar-accent-foreground">Fjordbok</span>
      </div>
      <div className="px-3 pb-3">
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
      <div className="px-3 pb-4">
        <button
          onClick={onSøk}
          className="flex w-full items-center gap-3 rounded-md border border-sidebar-border px-3 py-1.5 text-sm opacity-80 transition hover:bg-sidebar-accent hover:opacity-100"
        >
          <Search className="h-4 w-4" />
          Søk
          <kbd className="ml-auto rounded border border-sidebar-border px-1.5 text-[10px] opacity-70">⌘K</kbd>
        </button>
      </div>
      <nav className="flex-1 space-y-4 overflow-y-auto px-3 pb-4">
        {grupper.map((g) => (
          <div key={g.tittel}>
            {g.tittel && <div className="px-3 pb-1 text-[10px] uppercase tracking-[0.15em] opacity-50">{g.tittel}</div>}
            {g.lenker.map(({ to, label, icon: Icon, ...rest }) => (
              <Link
                key={to}
                to={to}
                onClick={onVelg}
                activeOptions={{ exact: "exact" in rest }}
                className="relative flex items-center gap-3 rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-sidebar-accent"
                activeProps={{ className: "bg-sidebar-accent text-sidebar-primary before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-0.5 before:rounded-full before:bg-sidebar-primary" }}
              >
                <Icon className="h-4 w-4" />
                {label}
                {!!merke[to] && (
                  <span className="ml-auto rounded-full bg-sidebar-primary px-1.5 text-[11px] font-semibold leading-5 text-sidebar-primary-foreground">{merke[to]}</span>
                )}
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
    </>
  );
}
