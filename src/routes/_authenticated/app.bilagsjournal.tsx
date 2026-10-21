import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company";
import { dato, kr } from "@/lib/format";
import { PageHeader, Panel, Empty, selectCls, theadCls } from "@/components/app/ui";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/app/bilagsjournal")({
  head: () => ({ meta: [{ title: "Bilagsjournal – Fjordbok" }] }),
  component: Bilagsjournal,
});

const KILDER: Record<string, string> = {
  manuelt: "Manuelt", faktura: "Faktura", kreditnota: "Kreditnota", innbetaling: "Innbetaling",
  leverandor: "Leverandør", leverandorbetaling: "Lev.betaling", bank: "Bank", lonn: "Lønn",
  aarsavslutning: "Årsavslutning", korreksjon: "Korreksjon",
};

function Bilagsjournal() {
  const { company } = useCompany();
  const y = new Date().getFullYear();
  const [fra, setFra] = useState(`${y}-01-01`);
  const [til, setTil] = useState(`${y}-12-31`);
  const [status, setStatus] = useState("alle");
  const { data, isLoading } = useQuery({
    queryKey: ["bilagsjournal", company.id, fra, til, status],
    queryFn: async () => {
      const rader = [];
      for (let f = 0; ; f += 1000) {
        let q = supabase.from("vouchers").select("id, bilagsnr, dato, beskrivelse, status, kilde, korrigerer, bokfort_at, voucher_lines(debet, kredit)")
          .eq("company_id", company.id).gte("dato", fra).lte("dato", til).order("dato", { ascending: false }).order("bilagsnr", { ascending: false }).range(f, f + 999);
        if (status !== "alle") q = q.eq("status", status);
        const { data, error } = await q;
        if (error) throw error;
        rader.push(...(data ?? []));
        if (!data || data.length < 1000) break;
      }
      return rader.map((v) => ({
        ...v,
        debet: v.voucher_lines.reduce((s, l) => s + Number(l.debet), 0),
        kredit: v.voucher_lines.reduce((s, l) => s + Number(l.kredit), 0),
      }));
    },
  });
  return (
    <>
      <PageHeader title="Bilagsjournal" sub="Alle bilag i nummer- og datorekkefølge, med sum og status."
        actions={<>
          <select className={selectCls} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="alle">Alle statuser</option>
            <option value="bokfort">Bokført</option>
            <option value="utkast">Utkast</option>
          </select>
          <Input type="date" value={fra} onChange={(e) => setFra(e.target.value)} className="w-40" />
          <Input type="date" value={til} onChange={(e) => setTil(e.target.value)} className="w-40" />
        </>} />
      <Panel>
        {isLoading || !data ? <Empty>Laster …</Empty> : data.length === 0 ? <Empty>Ingen bilag i perioden.</Empty> : (
          <table className="w-full text-sm">
            <thead className={theadCls}><tr><th className="px-4 py-3">Bilag</th><th className="px-4 py-3">Dato</th><th className="px-4 py-3">Beskrivelse</th><th className="px-4 py-3">Kilde</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Debet</th><th className="px-4 py-3 text-right">Kredit</th></tr></thead>
            <tbody>
              {data.map((v) => (
                <tr key={v.id} className="border-b">
                  <td className="px-4 py-2 font-mono"><Link to="/app/bilag/$id" params={{ id: v.id }} className="text-primary hover:underline">{v.bilagsnr ?? "–"}</Link></td>
                  <td className="px-4 py-2">{dato(v.dato)}</td>
                  <td className="px-4 py-2">{v.beskrivelse}{v.korrigerer ? " (korreksjon)" : ""}</td>
                  <td className="px-4 py-2 text-muted-foreground">{KILDER[v.kilde] ?? v.kilde}</td>
                  <td className="px-4 py-2">{v.status === "bokfort" ? "Bokført" : <span className="text-amber-600 dark:text-amber-400">Utkast</span>}</td>
                  <td className="num px-4 py-2">{kr(v.debet)}</td>
                  <td className="num px-4 py-2">{kr(v.kredit)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr className="bg-muted/50 font-medium"><td colSpan={5} className="px-4 py-3">Sum {data.length} bilag</td><td className="num px-4 py-3">{kr(data.reduce((s, v) => s + v.debet, 0))}</td><td className="num px-4 py-3">{kr(data.reduce((s, v) => s + v.kredit, 0))}</td></tr></tfoot>
          </table>
        )}
      </Panel>
    </>
  );
}
