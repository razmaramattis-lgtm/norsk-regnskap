import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useCompany, ROLLENAVN, type Role } from "@/lib/company";
import { gyldigOrgNr } from "@/lib/format";
import { AGA_SONER } from "@/lib/lonn";
import { PageHeader, Panel } from "@/components/app/ui";
import { NyttFirma } from "@/components/app/NyttFirma";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/app/firma")({
  validateSearch: z.object({ ny: z.boolean().optional() }),
  head: () => ({ meta: [{ title: "Firma og brukere – Fjordbok" }] }),
  component: Firma,
});

function Firma() {
  const { company, isAdmin } = useCompany();
  const { ny } = Route.useSearch();
  const nav = Route.useNavigate();
  const qc = useQueryClient();
  const [f, setF] = useState(company);
  useEffect(() => setF(company), [company]);

  const { data: medlemmer = [] } = useQuery({
    queryKey: ["members", company.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("company_members").select("id, role, user_id").eq("company_id", company.id);
      if (error) throw error;
      return data;
    },
  });
  const { data: invites = [] } = useQuery({
    queryKey: ["invites", company.id],
    enabled: isAdmin,
    queryFn: async () => (await supabase.from("company_invites").select("*").eq("company_id", company.id)).data ?? [],
  });
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: async () => (await supabase.auth.getUser()).data.user });

  const { data: harSendt = true } = useQuery({
    queryKey: ["har-sendt-faktura", company.id],
    queryFn: async () =>
      ((await supabase.from("invoices").select("id", { count: "exact", head: true }).eq("company_id", company.id).not("fakturanr", "is", null)).count ?? 0) > 0,
  });
  const [epost, setEpost] = useState("");
  const [rolle, setRolle] = useState<Role>("regnskapsforer");

  async function lagre(e: React.FormEvent) {
    e.preventDefault();
    if (f.org_nr && !gyldigOrgNr(f.org_nr)) { toast.error("Ugyldig organisasjonsnummer"); return; }
    const { error } = await supabase.from("companies").update({
      name: f.name, org_nr: f.org_nr, mva_registrert: f.mva_registrert, mva_termin: f.mva_termin, aga_sone: f.aga_sone, feriepengesats: Number(f.feriepengesats),
      adresse: f.adresse, postnr: f.postnr, poststed: f.poststed, kontonummer: f.kontonummer, epost: f.epost,
      ...(harSendt ? {} : { neste_fakturanr: Number(f.neste_fakturanr) }),
    }).eq("id", company.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Lagret");
    qc.invalidateQueries({ queryKey: ["memberships"] });
  }

  async function inviter(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("company_invites").insert({ company_id: company.id, email: epost.toLowerCase(), role: rolle });
    if (error) { toast.error(error.message); return; }
    toast.success(`${epost} får tilgang når de logger inn med denne e-posten.`);
    setEpost("");
    qc.invalidateQueries({ queryKey: ["invites"] });
  }

  const up = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <>
      <PageHeader title="Firma og brukere" sub={company.company_type === "as" ? "Aksjeselskap" : "Enkeltpersonforetak"} actions={<Button variant="outline" onClick={() => nav({ search: { ny: true } })}>Nytt firma</Button>} />
      <div className="grid gap-8 lg:grid-cols-2">
        <Panel className="p-6">
          <h2 className="mb-4 text-xl">Firmaopplysninger</h2>
          <form onSubmit={lagre} className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5"><Label>Navn</Label><Input value={f.name} onChange={up("name")} disabled={!isAdmin} /></div>
            <div className="space-y-1.5"><Label>Org.nr</Label><Input value={f.org_nr ?? ""} onChange={up("org_nr")} disabled={!isAdmin} /></div>
            <div className="space-y-1.5"><Label>Bankkontonummer</Label><Input value={f.kontonummer ?? ""} onChange={up("kontonummer")} placeholder="1234.56.78901" disabled={!isAdmin} /></div>
            <div className="col-span-2 space-y-1.5"><Label>Adresse</Label><Input value={f.adresse ?? ""} onChange={up("adresse")} disabled={!isAdmin} /></div>
            <div className="space-y-1.5"><Label>Postnr</Label><Input value={f.postnr ?? ""} onChange={up("postnr")} disabled={!isAdmin} /></div>
            <div className="space-y-1.5"><Label>Poststed</Label><Input value={f.poststed ?? ""} onChange={up("poststed")} disabled={!isAdmin} /></div>
            <div className="col-span-2 space-y-1.5">
              <Label>Første fakturanummer</Label>
              <Input type="number" value={f.neste_fakturanr} onChange={up("neste_fakturanr")} disabled={!isAdmin || harSendt} />
              <p className="text-xs text-muted-foreground">
                {harSendt
                  ? "Fakturanumrene er låst: serien er fortløpende, og et nummer brukes aldri to ganger."
                  : "Kommer du fra Fiken eller Tripletex, fortsett serien derfra. Låses når første faktura er sendt."}
              </p>
            </div>
            <label className="col-span-2 flex items-center justify-between rounded-md border p-3 text-sm">MVA-registrert <Switch checked={f.mva_registrert} onCheckedChange={(v) => setF({ ...f, mva_registrert: v })} disabled={!isAdmin} /></label>
            <div className="col-span-2 space-y-1.5">
              <Label>MVA-termin</Label>
              <select className="h-9 w-full rounded-md border border-input bg-card px-2 text-sm" value={f.mva_termin} onChange={(e) => setF({ ...f, mva_termin: e.target.value })} disabled={!isAdmin}>
                <option value="tomaaned">Alminnelig (seks terminer)</option>
                <option value="aarlig">Årstermin (omsetning under 1 mill. kr)</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Arbeidsgiveravgift-sone</Label>
              <select className="h-9 w-full rounded-md border border-input bg-card px-2 text-sm" value={f.aga_sone} onChange={(e) => setF({ ...f, aga_sone: e.target.value })} disabled={!isAdmin}>
                {Object.entries(AGA_SONER).map(([k, v]) => <option key={k} value={k}>{v.navn} – {v.sats} %</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Feriepengesats</Label>
              <select className="h-9 w-full rounded-md border border-input bg-card px-2 text-sm" value={String(Number(f.feriepengesats))} onChange={(e) => setF({ ...f, feriepengesats: Number(e.target.value) })} disabled={!isAdmin}>
                <option value="10.2">10,2 % (4 uker + 1 dag)</option>
                <option value="12">12 % (5 uker, tariff)</option>
              </select>
            </div>
            {isAdmin && <Button type="submit" className="col-span-2">Lagre</Button>}
          </form>
        </Panel>
        <Panel className="p-6">
          <h2 className="mb-4 text-xl">Brukere</h2>
          <ul className="mb-6 divide-y text-sm">
            {medlemmer.map((m) => (
              <li key={m.id} className="flex items-center justify-between py-2">
                <span className="font-mono text-xs">{m.user_id === me?.id ? `${me?.email} (deg)` : m.user_id.slice(0, 8)}</span>
                <span className="flex items-center gap-2">
                  {ROLLENAVN[m.role]}
                  {isAdmin && m.user_id !== me?.id && (
                    <Button size="sm" variant="ghost" onClick={async () => { await supabase.from("company_members").delete().eq("id", m.id); qc.invalidateQueries({ queryKey: ["members"] }); }}>Fjern</Button>
                  )}
                </span>
              </li>
            ))}
            {invites.map((i) => <li key={i.id} className="flex justify-between py-2 text-muted-foreground"><span>{i.email}</span><span>Invitert · {ROLLENAVN[i.role]}</span></li>)}
          </ul>
          {isAdmin && (
            <form onSubmit={inviter} className="flex gap-2">
              <Input type="email" placeholder="e-post" value={epost} onChange={(e) => setEpost(e.target.value)} required />
              <select className="h-9 rounded-md border border-input bg-card px-2 text-sm" value={rolle} onChange={(e) => setRolle(e.target.value as Role)}>
                {(["admin", "regnskapsforer", "leser"] as Role[]).map((r) => <option key={r} value={r}>{ROLLENAVN[r]}</option>)}
              </select>
              <Button type="submit">Inviter</Button>
            </form>
          )}
        </Panel>
      </div>
      <Dialog open={!!ny} onOpenChange={(o) => !o && nav({ search: {} })}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nytt firma</DialogTitle></DialogHeader>
          <NyttFirma onDone={() => nav({ to: "/app", search: {} })} />
        </DialogContent>
      </Dialog>
    </>
  );
}
