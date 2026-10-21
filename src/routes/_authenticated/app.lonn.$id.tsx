import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company";
import { kr } from "@/lib/format";
import { AGA_SONER, beregnLonn } from "@/lib/lonn";
import { PageHeader, Panel, Empty, theadCls } from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEmployees } from "@/components/app/hooks";

export const Route = createFileRoute("/_authenticated/app/lonn/$id")({
  head: () => ({ meta: [{ title: "Lønnskjøring – Fjordbok" }] }),
  component: Kjoring,
});

type Rad = { employee_id: string; navn: string; timer: string; brutto: string; tillegg: string; trekkPst: number; otpPst: number; timelonn: number };

function Kjoring() {
  const { id } = Route.useParams();
  const { company } = useCompany();
  const { data: ansatte = [] } = useEmployees();
  const qc = useQueryClient();
  const nav = useNavigate();
  const aga = AGA_SONER[company.aga_sone] ?? AGA_SONER["1"]!;
  const { data: run } = useQuery({
    queryKey: ["run", id],
    queryFn: async () => (await supabase.from("payroll_runs").select("*, payroll_lines(*, employees(navn))").eq("id", id).single()).data,
  });
  const [periode, setPeriode] = useState("");
  const [utb, setUtb] = useState("");
  const [rader, setRader] = useState<Rad[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!run || !ansatte.length) return;
    setPeriode(run.periode);
    setUtb(run.utbetalingsdato);
    setRader(ansatte.filter((a) => a.aktiv).map((a) => {
      const l = run.payroll_lines.find((x) => x.employee_id === a.id);
      return {
        employee_id: a.id, navn: a.navn, timer: l ? String(l.timer) : "", trekkPst: Number(a.skattetrekk_prosent), otpPst: Number(a.otp_prosent), timelonn: Number(a.timelonn),
        brutto: l ? String(l.brutto) : a.lonnstype === "maaned" ? String(a.maanedslonn) : "0", tillegg: l ? String(l.tillegg) : "0",
      };
    }));
  }, [run, ansatte]);

  if (!run) return <Empty>Laster …</Empty>;
  const beregnet = rader.map((r) => ({ r, b: beregnLonn({ brutto: Number(r.brutto || 0), tillegg: Number(r.tillegg || 0), skattetrekkProsent: r.trekkPst, feriepengesats: Number(company.feriepengesats), otpProsent: r.otpPst, agaSats: aga.sats }) }));
  const sum = (k: "grunnlag" | "skattetrekk" | "feriepenger" | "otp" | "aga" | "netto") => beregnet.reduce((s, x) => s + x.b[k], 0);
  const laast = run.status !== "utkast";

  async function lagre(bokfor: boolean) {
    setBusy(true);
    try {
      const { error } = await supabase.from("payroll_runs").update({ periode, utbetalingsdato: utb }).eq("id", id);
      if (error) throw error;
      await supabase.from("payroll_lines").delete().eq("run_id", id);
      const { error: e2 } = await supabase.from("payroll_lines").insert(beregnet.filter((x) => x.b.grunnlag > 0).map(({ r, b }) => ({
        run_id: id, company_id: company.id, employee_id: r.employee_id, timer: Number(r.timer || 0), brutto: Number(r.brutto || 0), tillegg: Number(r.tillegg || 0),
        skattetrekk: b.skattetrekk, feriepenger: b.feriepenger, otp: b.otp, aga: b.aga, netto: b.netto,
      })));
      if (e2) throw e2;
      if (bokfor) {
        const { error: e3 } = await supabase.rpc("book_payroll", { _run: id });
        if (e3) throw e3;
        toast.success("Lønnen er bokført");
      } else toast.success("Lagret");
      qc.invalidateQueries();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  const visRader = laast
    ? run.payroll_lines.map((l) => ({ navn: l.employees?.navn ?? "", grunnlag: Number(l.brutto) + Number(l.tillegg), skattetrekk: Number(l.skattetrekk), feriepenger: Number(l.feriepenger), otp: Number(l.otp), aga: Number(l.aga), netto: Number(l.netto) }))
    : null;

  return (
    <>
      <PageHeader title={`Lønn ${run.periode}`} sub={`Arbeidsgiveravgift ${aga.navn}: ${aga.sats} % · feriepenger ${Number(company.feriepengesats)} %`}
        actions={laast ? (run.voucher_id && <Button variant="ghost" asChild><Link to="/app/bilag/$id" params={{ id: run.voucher_id }}>Se bilag</Link></Button>)
          : <Button variant="ghost" onClick={async () => { await supabase.from("payroll_runs").delete().eq("id", id); qc.invalidateQueries(); nav({ to: "/app/lonn" }); }}>Slett</Button>} />
      {!laast && (
        <Panel className="mb-6 flex gap-4 p-4">
          <div className="space-y-1.5"><Label>Periode</Label><Input type="month" value={periode} onChange={(e) => setPeriode(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Utbetalingsdato</Label><Input type="date" value={utb} onChange={(e) => setUtb(e.target.value)} /></div>
        </Panel>
      )}
      <Panel className="mb-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className={theadCls}><tr><th className="px-3 py-3">Ansatt</th>{!laast && <><th className="px-3 py-3">Timer</th><th className="px-3 py-3 text-right">Fastlønn</th><th className="px-3 py-3 text-right">Tillegg</th></>}<th className="px-3 py-3 text-right">Brutto</th><th className="px-3 py-3 text-right">Forskuddstrekk</th><th className="px-3 py-3 text-right">Netto</th><th className="px-3 py-3 text-right">Feriepenger</th><th className="px-3 py-3 text-right">OTP</th><th className="px-3 py-3 text-right">AGA</th></tr></thead>
          <tbody>
            {laast ? visRader!.map((v, i) => (
              <tr key={i} className="border-b"><td className="px-3 py-2">{v.navn}</td><td className="num px-3 py-2">{kr(v.grunnlag)}</td><td className="num px-3 py-2">{kr(v.skattetrekk)}</td><td className="num px-3 py-2">{kr(v.netto)}</td><td className="num px-3 py-2">{kr(v.feriepenger)}</td><td className="num px-3 py-2">{kr(v.otp)}</td><td className="num px-3 py-2">{kr(v.aga)}</td></tr>
            )) : beregnet.map(({ r, b }, i) => {
              const set = (k: keyof Rad, v: string) => setRader((rs) => rs.map((x, j) => (j === i ? { ...x, [k]: v, ...(k === "timer" && x.timelonn ? { brutto: String(Math.round(Number(v) * x.timelonn * 100) / 100) } : {}) } : x)));
              return (
                <tr key={r.employee_id} className="border-b">
                  <td className="px-3 py-2">{r.navn}</td>
                  <td className="w-20 px-3 py-2"><Input className="num" value={r.timer} onChange={(e) => set("timer", e.target.value)} /></td>
                  <td className="w-32 px-3 py-2"><Input className="num" value={r.brutto} onChange={(e) => set("brutto", e.target.value)} /></td>
                  <td className="w-28 px-3 py-2"><Input className="num" value={r.tillegg} onChange={(e) => set("tillegg", e.target.value)} /></td>
                  <td className="num px-3 py-2">{kr(b.grunnlag)}</td><td className="num px-3 py-2">{kr(b.skattetrekk)}</td><td className="num px-3 py-2 font-medium">{kr(b.netto)}</td>
                  <td className="num px-3 py-2">{kr(b.feriepenger)}</td><td className="num px-3 py-2">{kr(b.otp)}</td><td className="num px-3 py-2">{kr(b.aga)}</td>
                </tr>
              );
            })}
          </tbody>
          {!laast && (
            <tfoot><tr className="bg-muted/50 font-medium"><td colSpan={4} className="px-3 py-3">Sum</td><td className="num px-3 py-3">{kr(sum("grunnlag"))}</td><td className="num px-3 py-3">{kr(sum("skattetrekk"))}</td><td className="num px-3 py-3">{kr(sum("netto"))}</td><td className="num px-3 py-3">{kr(sum("feriepenger"))}</td><td className="num px-3 py-3">{kr(sum("otp"))}</td><td className="num px-3 py-3">{kr(sum("aga"))}</td></tr></tfoot>
          )}
        </table>
      </Panel>
      {!laast && (
        <div className="flex justify-end gap-2">
          <Button variant="outline" disabled={busy} onClick={() => lagre(false)}>Lagre</Button>
          <Button disabled={busy || sum("grunnlag") <= 0} onClick={() => lagre(true)}>Bokfør lønn</Button>
        </div>
      )}
    </>
  );
}
