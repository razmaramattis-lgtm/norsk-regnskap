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

export const Route = createFileRoute("/_authenticated/app/lonn/")({
  head: () => ({ meta: [{ title: "Lønn – Fjordbok" }] }),
  component: Lonn,
});

export function useEmployees() {
  const { company } = useCompany();
  return useQuery({
    queryKey: ["employees", company.id],
    queryFn: async () => (await supabase.from("employees").select("*").eq("company_id", company.id).order("navn")).data ?? [],
  });
}

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
      <PageHeader title="Lønn" sub="Lønnskjøring med forskuddstrekk, feriepenger, OTP og arbeidsgiveravgift." actions={<Button onClick={nyKjoring}><Plus /> Ny lønnskjøring</Button>} />
      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <div className="mb-3 flex items-center justify-between"><h2 className="text-xl">Ansatte</h2><NyAnsatt /></div>
          <Panel>
            {ansatte.length === 0 ? <Empty>Ingen ansatte.</Empty> : (
              <table className="w-full text-sm">
                <thead className={theadCls}><tr><th className="px-4 py-3">Navn</th><th className="px-4 py-3">Stilling</th><th className="px-4 py-3 text-right">Lønn</th><th className="px-4 py-3 text-right">Trekk</th></tr></thead>
                <tbody>{ansatte.map((a) => (
                  <tr key={a.id} className="border-b last:border-0"><td className="px-4 py-3 font-medium">{a.navn}</td><td className="px-4 py-3">{a.stilling} {Number(a.stillingsprosent) !== 100 && `(${Number(a.stillingsprosent)} %)`}</td>
                    <td className="num px-4 py-3">{a.lonnstype === "maaned" ? `${kr(a.maanedslonn)}/mnd` : `${kr(a.timelonn)}/t`}</td><td className="num px-4 py-3">{Number(a.skattetrekk_prosent)} %</td></tr>
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

function NyAnsatt() {
  const { company } = useCompany();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ navn: "", epost: "", stilling: "", stillingsprosent: "100", ansatt_dato: idag(), kontonummer: "", lonnstype: "maaned", maanedslonn: "", timelonn: "", skattetrekk_prosent: "30", otp_prosent: "2" });
  const up = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("employees").insert({
      company_id: company.id, navn: f.navn, epost: f.epost || null, stilling: f.stilling || null, stillingsprosent: Number(f.stillingsprosent),
      ansatt_dato: f.ansatt_dato, kontonummer: f.kontonummer || null, lonnstype: f.lonnstype, maanedslonn: Number(f.maanedslonn || 0),
      timelonn: Number(f.timelonn || 0), skattetrekk_prosent: Number(f.skattetrekk_prosent), otp_prosent: Number(f.otp_prosent),
    });
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["employees"] });
    setOpen(false);
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="outline"><Plus /> Ny ansatt</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Ny ansatt</DialogTitle></DialogHeader>
        <form onSubmit={save} className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1.5"><Label>Navn</Label><Input value={f.navn} onChange={up("navn")} required /></div>
          <div className="space-y-1.5"><Label>Stilling</Label><Input value={f.stilling} onChange={up("stilling")} /></div>
          <div className="space-y-1.5"><Label>Stillingsprosent</Label><Input type="number" value={f.stillingsprosent} onChange={up("stillingsprosent")} /></div>
          <div className="space-y-1.5"><Label>Lønnstype</Label><select className={`${selectCls} w-full`} value={f.lonnstype} onChange={up("lonnstype")}><option value="maaned">Fast månedslønn</option><option value="time">Timelønn</option></select></div>
          {f.lonnstype === "maaned"
            ? <div className="space-y-1.5"><Label>Månedslønn</Label><Input className="num" value={f.maanedslonn} onChange={up("maanedslonn")} /></div>
            : <div className="space-y-1.5"><Label>Timelønn</Label><Input className="num" value={f.timelonn} onChange={up("timelonn")} /></div>}
          <div className="space-y-1.5"><Label>Skattetrekk (% fra skattekort)</Label><Input type="number" value={f.skattetrekk_prosent} onChange={up("skattetrekk_prosent")} /></div>
          <div className="space-y-1.5"><Label>OTP (min. 2 %)</Label><Input type="number" step="0.1" value={f.otp_prosent} onChange={up("otp_prosent")} /></div>
          <div className="space-y-1.5"><Label>Ansatt fra</Label><Input type="date" value={f.ansatt_dato} onChange={up("ansatt_dato")} /></div>
          <div className="space-y-1.5"><Label>Kontonummer</Label><Input value={f.kontonummer} onChange={up("kontonummer")} /></div>
          <Button type="submit" className="col-span-2">Lagre</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
