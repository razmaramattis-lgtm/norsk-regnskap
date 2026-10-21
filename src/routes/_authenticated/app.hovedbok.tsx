import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company";
import { dato, kr } from "@/lib/format";
import { PageHeader, Panel, Empty, useAccounts, selectCls, theadCls } from "@/components/app/ui";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/app/hovedbok")({
  validateSearch: z.object({ konto: z.string().optional() }),
  head: () => ({ meta: [{ title: "Hovedbok – Fjordbok" }] }),
  component: Hovedbok,
});

type Rad = {
  id: string;
  debet: number;
  kredit: number;
  tekst: string | null;
  mva_kode: string | null;
  v: { id: string; bilagsnr: number | null; dato: string; beskrivelse: string };
};

type KontoGruppe = { konto: string; navn: string; ib: number; rader: Rad[] };

function KontoTabell({ g }: { g: KontoGruppe }) {
  let saldo = g.ib;
  return (
    <table className="w-full text-sm">
      <thead className={theadCls}><tr><th className="px-4 py-3">Dato</th><th className="px-4 py-3">Bilag</th><th className="px-4 py-3">Tekst</th><th className="px-4 py-3">MVA</th><th className="px-4 py-3 text-right">Debet</th><th className="px-4 py-3 text-right">Kredit</th><th className="px-4 py-3 text-right">Saldo</th></tr></thead>
      <tbody>
        <tr className="border-b bg-muted/40 italic"><td className="px-4 py-2" colSpan={6}>Inngående saldo</td><td className="num px-4 py-2">{kr(g.ib)}</td></tr>
        {g.rader.map((r) => {
          saldo += r.debet - r.kredit;
          return (
            <tr key={r.id} className="border-b">
              <td className="px-4 py-2">{dato(r.v.dato)}</td>
              <td className="px-4 py-2 font-mono"><Link to="/app/bilag/$id" params={{ id: r.v.id }} className="text-primary hover:underline">{r.v.bilagsnr}</Link></td>
              <td className="px-4 py-2">{r.tekst || r.v.beskrivelse}</td>
              <td className="px-4 py-2 font-mono">{r.mva_kode}</td>
              <td className="num px-4 py-2">{r.debet ? kr(r.debet) : ""}</td>
              <td className="num px-4 py-2">{r.kredit ? kr(r.kredit) : ""}</td>
              <td className="num px-4 py-2">{kr(saldo)}</td>
            </tr>
          );
        })}
      </tbody>
      <tfoot><tr className="bg-muted/50 font-medium"><td colSpan={6} className="px-4 py-3">Utgående saldo</td><td className="num px-4 py-3">{kr(saldo)}</td></tr></tfoot>
    </table>
  );
}

function Hovedbok() {
  const { company } = useCompany();
  const { konto: k0 } = Route.useSearch();
  const { data: kontoer = [] } = useAccounts();
  const y = new Date().getFullYear();
  const [konto, setKonto] = useState(k0 ?? "");
  const [fra, setFra] = useState(`${y}-01-01`);
  const [til, setTil] = useState(`${y}-12-31`);
  const { data, isLoading } = useQuery({
    queryKey: ["gl", company.id, konto, fra, til],
    queryFn: async () => {
      const navn = new Map(kontoer.map((a) => [a.number, a.name]));
      const grupper = new Map<string, KontoGruppe>();
      const valgte = konto ? [konto] : kontoer.map((a) => a.number);
      for (const k of valgte) grupper.set(k, { konto: k, navn: navn.get(k) ?? "", ib: 0, rader: [] });
      for (let f = 0; ; f += 1000) {
        let q = supabase.from("voucher_lines").select("id, konto, debet, kredit, tekst, mva_kode, vouchers!inner(id, bilagsnr, dato, beskrivelse, status)")
          .eq("company_id", company.id).eq("vouchers.status", "bokfort").lte("vouchers.dato", til).order("linjenr").range(f, f + 999);
        if (konto) q = q.eq("konto", konto);
        const { data, error } = await q;
        if (error) throw error;
        for (const l of data ?? []) {
          const g = grupper.get(l.konto);
          if (!g) continue;
          const rad: Rad = { ...l, debet: Number(l.debet), kredit: Number(l.kredit), v: l.vouchers };
          if (rad.v.dato < fra) g.ib += rad.debet - rad.kredit;
          else g.rader.push(rad);
        }
        if (!data || data.length < 1000) break;
      }
      for (const g of grupper.values()) g.rader.sort((a, b) => a.v.dato.localeCompare(b.v.dato) || (a.v.bilagsnr ?? 0) - (b.v.bilagsnr ?? 0));
      return [...grupper.values()].filter((g) => g.ib !== 0 || g.rader.length > 0 || konto === g.konto);
    },
  });
  return (
    <>
      <PageHeader title="Hovedbok" sub="Alle posteringer per konto med løpende saldo."
        actions={<>
          <select className={selectCls} value={konto} onChange={(e) => setKonto(e.target.value)}>
            <option value="">Alle kontoer</option>
            {kontoer.map((a) => <option key={a.number} value={a.number}>{a.number} {a.name}</option>)}
          </select>
          <Input type="date" value={fra} onChange={(e) => setFra(e.target.value)} className="w-40" />
          <Input type="date" value={til} onChange={(e) => setTil(e.target.value)} className="w-40" />
        </>} />
      {isLoading || !data ? <Panel><Empty>Laster …</Empty></Panel> : data.length === 0 ? <Panel><Empty>Ingen bokførte posteringer i perioden.</Empty></Panel> : (
        <div className="space-y-6">
          {data.map((g) => (
            <Panel key={g.konto}>
              <h2 className="border-b px-4 py-3 font-mono text-sm font-semibold">{g.konto} <span className="font-sans font-normal text-muted-foreground">{g.navn}</span></h2>
              <KontoTabell g={g} />
            </Panel>
          ))}
        </div>
      )}
    </>
  );
}
