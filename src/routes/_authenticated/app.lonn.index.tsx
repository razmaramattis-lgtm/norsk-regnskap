import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company";
import { dato, idag, kr } from "@/lib/format";
import { PageHeader, Panel, Empty, theadCls, selectCls } from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

import { useEmployees } from "@/components/app/hooks";

export const Route = createFileRoute("/_authenticated/app/lonn/")({
  head: () => ({ meta: [{ title: "Lønn – Fjordbok" }] }),
  component: Lonn,
});

function Lonn() {
  const { company, canWrite } = useCompany();
  const nav = useNavigate();
  const { data: ansatte = [] } = useEmployees();
  const { data: runs = [], isLoading } = useQuery({
    queryKey: ["runs", company.id],
    queryFn: async () => (await supabase.from("payroll_runs").select("*, payroll_lines(brutto, tillegg, netto)").eq("company_id", company.id).order("utbetalingsdato", { ascending: false })).data ?? [],
  });

  if (!canWrite) return <><PageHeader title="Lønn" /><Panel><Empty>Lønnsdata er kun tilgjengelig for eier, administrator og regnskapsfører.</Empty></Panel></>;

  async function nyKjoring() {
    const aktive = ansatte.filter((a) => a.aktiv);
    if (!aktive.length) { toast.error("Legg til minst én ansatt først"); return; }
    const d = new Date();
    const periode = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const { data, error } = await supabase.from("payroll_runs").insert({ company_id: company.id, periode, utbetalingsdato: idag() }).select("id").single();
    if (error) { toast.error(error.message); return; }
    nav({ to: "/app/lonn/$id", params: { id: data.id } });
  }

  return (
    <>
      <PageHeader title="Lønn" sub="Lønnsarter, overtid, naturalytelser, trekk, feriepenger, OTP, arbeidsgiveravgift, lønnsslipp og grunnlag for a-melding." actions={<Button onClick={nyKjoring}><Plus /> Ny lønnskjøring</Button>} />
      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <div className="mb-3 flex items-center justify-between"><h2 className="text-xl">Ansatte</h2><NyAnsatt /></div>
          <Panel>
            {ansatte.length === 0 ? <Empty>Ingen ansatte.</Empty> : (
              <table className="w-full text-sm">
                <thead className={theadCls}><tr><th className="px-4 py-3">Navn</th><th className="px-4 py-3">Stilling</th><th className="px-4 py-3 text-right">Lønn</th><th className="px-4 py-3 text-right">Trekk</th></tr></thead>
                <tbody>{ansatte.map((a) => (
                  <tr key={a.id} className={`border-b last:border-0 ${a.aktiv ? "" : "opacity-50"}`}><td className="px-4 py-3 font-medium"><NyAnsatt ansatt={a} trigger={<button className="text-left text-primary hover:underline">{a.navn}</button>} /></td><td className="px-4 py-3">{a.stilling} {Number(a.stillingsprosent) !== 100 && `(${Number(a.stillingsprosent)} %)`}</td>
                    <td className="num px-4 py-3">{a.lonnstype === "maaned" ? `${kr(a.maanedslonn)}/mnd` : `${kr(a.timelonn)}/t`}</td><td className="num px-4 py-3">{a.trekkmetode === "tabell" ? `Tabell ${a.trekktabell ?? ""}` : `${Number(a.skattetrekk_prosent)} %`}</td></tr>
                ))}</tbody>
              </table>
            )}
          </Panel>
        </div>
        <div>
          <h2 className="mb-3 text-xl">Lønnskjøringer</h2>
          <Panel>
            {isLoading ? <Empty>Laster …</Empty> : runs.length === 0 ? <Empty>Ingen lønnskjøringer.</Empty> : (
              <table className="w-full text-sm">
                <thead className={theadCls}><tr><th className="px-4 py-3">Periode</th><th className="px-4 py-3">Utbetaling</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Brutto</th></tr></thead>
                <tbody>{runs.map((r) => (
                  <tr key={r.id} className="border-b last:border-0"><td className="px-4 py-3"><Link to="/app/lonn/$id" params={{ id: r.id }} className="text-primary hover:underline">{r.periode}</Link></td><td className="px-4 py-3">{dato(r.utbetalingsdato)}</td>
                    <td className="px-4 py-3"><Badge variant={r.status === "bokfort" ? "default" : "outline"}>{r.status === "bokfort" ? "Bokført" : "Utkast"}</Badge></td>
                    <td className="num px-4 py-3">{kr(r.payroll_lines.reduce((s, l) => s + Number(l.brutto) + Number(l.tillegg), 0))}</td></tr>
                ))}</tbody>
              </table>
            )}
          </Panel>
        </div>
      </div>
      <p className="mt-6 text-xs text-muted-foreground">A-melding til Altinn sendes innen den 5. i måneden etter utbetaling. Direkte innsending krever Maskinporten-avtale og kommer i en senere versjon.</p>
    </>
  );
}

type Ansatt = ReturnType<typeof useEmployees>["data"] extends (infer T)[] | undefined ? T : never;

function NyAnsatt({ ansatt, trigger }: { ansatt?: Ansatt; trigger?: React.ReactNode }) {
  const { company } = useCompany();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const start = () => ({
    navn: ansatt?.navn ?? "",
    epost: ansatt?.epost ?? "",
    stilling: ansatt?.stilling ?? "",
    stillingsprosent: String(ansatt?.stillingsprosent ?? 100),
    ansatt_dato: ansatt?.ansatt_dato ?? idag(),
    fodselsdato: ansatt?.fodselsdato ?? "",
    kontonummer: ansatt?.kontonummer ?? "",
    lonnstype: ansatt?.lonnstype ?? "maaned",
    maanedslonn: ansatt ? String(ansatt.maanedslonn) : "",
    timelonn: ansatt ? String(ansatt.timelonn) : "",
    trekkmetode: ansatt?.trekkmetode ?? "prosent",
    skattetrekk_prosent: String(ansatt?.skattetrekk_prosent ?? 30),
    trekktabell: ansatt?.trekktabell ?? "",
    tabelltrekk: String(ansatt?.tabelltrekk ?? 0),
    otp_prosent: String(ansatt?.otp_prosent ?? 2),
    aktiv: ansatt?.aktiv ?? true,
  });
  const [f, setF] = useState(start);
  const up = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (Number(f.otp_prosent) < 2) { toast.error("OTP må være minst 2 % etter loven om obligatorisk tjenestepensjon"); return; }
    const rad = {
      navn: f.navn, epost: f.epost || null, stilling: f.stilling || null, stillingsprosent: Number(f.stillingsprosent),
      ansatt_dato: f.ansatt_dato || null, fodselsdato: f.fodselsdato || null, kontonummer: f.kontonummer || null, lonnstype: f.lonnstype,
      maanedslonn: Number(f.maanedslonn || 0), timelonn: Number(f.timelonn || 0), trekkmetode: f.trekkmetode,
      skattetrekk_prosent: Number(f.skattetrekk_prosent), trekktabell: f.trekktabell || null, tabelltrekk: Number(f.tabelltrekk || 0),
      otp_prosent: Number(f.otp_prosent), aktiv: f.aktiv,
    };
    const { error } = ansatt
      ? await supabase.from("employees").update(rad).eq("id", ansatt.id)
      : await supabase.from("employees").insert({ company_id: company.id, ...rad });
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["employees"] });
    setOpen(false);
  }
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) setF(start()); }}>
      <DialogTrigger asChild>{trigger ?? <Button size="sm" variant="outline"><Plus /> Ny ansatt</Button>}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{ansatt ? `Endre ${ansatt.navn}` : "Ny ansatt"}</DialogTitle></DialogHeader>
        <form onSubmit={save} className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1.5"><Label>Navn</Label><Input value={f.navn} onChange={up("navn")} required /></div>
          <div className="space-y-1.5"><Label>Stilling</Label><Input value={f.stilling} onChange={up("stilling")} /></div>
          <div className="space-y-1.5"><Label>Stillingsprosent</Label><Input type="number" value={f.stillingsprosent} onChange={up("stillingsprosent")} /></div>
          <div className="space-y-1.5"><Label>Lønnstype</Label><select className={`${selectCls} w-full`} value={f.lonnstype} onChange={up("lonnstype")}><option value="maaned">Fast månedslønn</option><option value="time">Timelønn</option></select></div>
          {f.lonnstype === "maaned"
            ? <div className="space-y-1.5"><Label>Månedslønn</Label><Input className="num" value={f.maanedslonn} onChange={up("maanedslonn")} /></div>
            : <div className="space-y-1.5"><Label>Timelønn</Label><Input className="num" value={f.timelonn} onChange={up("timelonn")} /></div>}
          {f.lonnstype === "maaned" && <div className="col-span-2 space-y-1.5"><Label>Timelønn for overtid (valgfritt)</Label><Input className="num" value={f.timelonn} onChange={up("timelonn")} placeholder="Brukes for overtid 50 % og 100 %" /></div>}
          <div className="space-y-1.5"><Label>Skattetrekk</Label><select className={`${selectCls} w-full`} value={f.trekkmetode} onChange={up("trekkmetode")}><option value="prosent">Prosenttrekk</option><option value="tabell">Tabelltrekk</option></select></div>
          {f.trekkmetode === "prosent"
            ? <div className="space-y-1.5"><Label>Trekkprosent (fra skattekortet)</Label><Input type="number" value={f.skattetrekk_prosent} onChange={up("skattetrekk_prosent")} /></div>
            : <>
                <div className="space-y-1.5"><Label>Trekktabell</Label><Input value={f.trekktabell} onChange={up("trekktabell")} placeholder="F.eks. 8115" /></div>
                <div className="space-y-1.5"><Label>Månedlig trekk fra tabellen</Label><Input className="num" value={f.tabelltrekk} onChange={up("tabelltrekk")} /></div>
              </>}
          <div className="space-y-1.5"><Label>OTP (min. 2 %)</Label><Input type="number" step="0.1" value={f.otp_prosent} onChange={up("otp_prosent")} /></div>
          <div className="space-y-1.5"><Label>Fødselsdato</Label><Input type="date" value={f.fodselsdato} onChange={up("fodselsdato")} /></div>
          <div className="space-y-1.5"><Label>Ansatt fra</Label><Input type="date" value={f.ansatt_dato} onChange={up("ansatt_dato")} /></div>
          <div className="space-y-1.5"><Label>Kontonummer</Label><Input value={f.kontonummer} onChange={up("kontonummer")} /></div>
          <div className="space-y-1.5"><Label>E-post</Label><Input type="email" value={f.epost} onChange={up("epost")} /></div>
          {ansatt && (
            <label className="col-span-2 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={f.aktiv} onChange={(e) => setF({ ...f, aktiv: e.target.checked })} /> Aktiv (tas med i nye lønnskjøringer)
            </label>
          )}
          <p className="col-span-2 text-xs text-muted-foreground">
            Fødselsdato brukes til ekstra feriepenger fra 60 år. Trekket hentes fra skattekortet; tabelltrekket legges inn manuelt til skattekort-API-et er koblet på.
          </p>
          <Button type="submit" className="col-span-2">Lagre</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
