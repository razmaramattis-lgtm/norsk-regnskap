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

function Hovedbok() {
  const { company } = useCompany();
  const { konto: k0 } = Route.useSearch();
  const { data: kontoer = [] } = useAccounts();
  const y = new Date().getFullYear();
  const [konto, setKonto] = useState(k0 ?? "1920");
  const [fra, setFra] = useState(`${y}-01-01`);
  const [til, setTil] = useState(`${y}-12-31`);
  const { data, isLoading } = useQuery({
    queryKey: ["gl", company.id, konto, fra, til],
    queryFn: async () => {
      const { data, error } = await supabase.from("voucher_lines").select("id, debet, kredit, tekst, mva_kode, vouchers!inner(id, bilagsnr, dato, beskrivelse, status)")
        .eq("company_id", company.id).eq("konto", konto).eq("vouchers.status", "bokfort").lte("vouchers.dato", til);
      if (error) throw error;
      const rader = data.map((l) => ({ ...l, d: Number(l.debet), k: Number(l.kredit), v: l.vouchers })).sort((a, b) => a.v.dato.localeCompare(b.v.dato) || (a.v.bilagsnr ?? 0) - (b.v.bilagsnr ?? 0));
      const ib = rader.filter((r) => r.v.dato < fra).reduce((s, r) => s + r.d - r.k, 0);
      return { ib, rader: rader.filter((r) => r.v.dato >= fra) };
    },
  });
  let saldo = data?.ib ?? 0;
  return (
    <>
      <PageHeader title="Hovedbok" sub="Alle posteringer per konto med løpende saldo."
        actions={<>
          <select className={selectCls} value={konto} onChange={(e) => setKonto(e.target.value)}>{kontoer.map((a) => <option key={a.number} value={a.number}>{a.number} {a.name}</option>)}</select>
          <Input type="date" value={fra} onChange={(e) => setFra(e.target.value)} className="w-40" />
          <Input type="date" value={til} onChange={(e) => setTil(e.target.value)} className="w-40" />
        </>} />
      <Panel>
        {isLoading || !data ? <Empty>Laster …</Empty> : (
          <table className="w-full text-sm">
            <thead className={theadCls}><tr><th className="px-4 py-3">Dato</th><th className="px-4 py-3">Bilag</th><th className="px-4 py-3">Tekst</th><th className="px-4 py-3">MVA</th><th className="px-4 py-3 text-right">Debet</th><th className="px-4 py-3 text-right">Kredit</th><th className="px-4 py-3 text-right">Saldo</th></tr></thead>
            <tbody>
              <tr className="border-b bg-muted/40 italic"><td className="px-4 py-2" colSpan={6}>Inngående saldo {dato(fra)}</td><td className="num px-4 py-2">{kr(data.ib)}</td></tr>
              {data.rader.map((r) => {
                saldo += r.d - r.k;
                return (
                  <tr key={r.id} className="border-b">
                    <td className="px-4 py-2">{dato(r.v.dato)}</td>
                    <td className="px-4 py-2 font-mono"><Link to="/app/bilag/$id" params={{ id: r.v.id }} className="text-primary hover:underline">{r.v.bilagsnr}</Link></td>
                    <td className="px-4 py-2">{r.tekst || r.v.beskrivelse}</td>
                    <td className="px-4 py-2 font-mono">{r.mva_kode}</td>
                    <td className="num px-4 py-2">{r.d ? kr(r.d) : ""}</td>
                    <td className="num px-4 py-2">{r.k ? kr(r.k) : ""}</td>
                    <td className="num px-4 py-2">{kr(saldo)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot><tr className="bg-muted/50 font-medium"><td colSpan={6} className="px-4 py-3">Utgående saldo {dato(til)}</td><td className="num px-4 py-3">{kr(saldo)}</td></tr></tfoot>
          </table>
        )}
      </Panel>
    </>
  );
}
