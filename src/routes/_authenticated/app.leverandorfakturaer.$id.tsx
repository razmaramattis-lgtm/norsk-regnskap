import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company";
import { dato, idag, kr } from "@/lib/format";
import { useSuppliers, NyLeverandor } from "@/components/app/leverandorer";
import { Vedlegg } from "@/components/app/Vedlegg";
import { PageHeader, Panel, Empty, useAccounts, selectCls, theadCls } from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/app/leverandorfakturaer/$id")({
  head: () => ({ meta: [{ title: "Leverandørfaktura – Fjordbok" }] }),
  component: Side,
});

type L = { konto: string; beskrivelse: string; netto: string; mva_sats: number };

function Side() {
  const { id } = Route.useParams();
  const { company, canWrite } = useCompany();
  const { data: lev = [] } = useSuppliers();
  const { data: kontoer = [] } = useAccounts();
  const qc = useQueryClient();
  const nav = useNavigate();
  const { data: f } = useQuery({
    queryKey: ["sinv1", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("supplier_invoices").select("*, suppliers(*), supplier_invoice_lines(*)").eq("id", id).single();
      if (error) throw error;
      data.supplier_invoice_lines.sort((a, b) => a.linjenr - b.linjenr);
      return data;
    },
  });
  const [h, setH] = useState({ supplier_id: "", fakturanr: "", fakturadato: idag(), forfallsdato: idag(), kid: "" });
  const [linjer, setLinjer] = useState<L[]>([]);
  const [betDato, setBetDato] = useState(idag());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!f) return;
    setH({ supplier_id: f.supplier_id, fakturanr: f.fakturanr ?? "", fakturadato: f.fakturadato, forfallsdato: f.forfallsdato, kid: f.kid ?? "" });
    setLinjer(f.supplier_invoice_lines.length ? f.supplier_invoice_lines.map((l) => ({ konto: l.konto, beskrivelse: l.beskrivelse ?? "", netto: String(l.netto), mva_sats: Number(l.mva_sats) }))
      : [{ konto: f.suppliers?.standard_konto ?? "6800", beskrivelse: "", netto: "", mva_sats: company.mva_registrert ? 25 : 0 }]);
  }, [f, company.mva_registrert]);

  if (!f) return <Empty>Laster …</Empty>;
  const netto = linjer.reduce((s, l) => s + Number(l.netto || 0), 0);
  const mva = company.mva_registrert ? linjer.reduce((s, l) => s + Math.round(Number(l.netto || 0) * l.mva_sats) / 100, 0) : 0;

  async function run(fn: () => Promise<void>, ok: string) {
    setBusy(true);
    try { await fn(); toast.success(ok); qc.invalidateQueries(); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }
  async function lagre() {
    const { error } = await supabase.from("supplier_invoices").update({ ...h, kid: h.kid || null, netto, mva, total: netto + mva }).eq("id", id);
    if (error) throw error;
    await supabase.from("supplier_invoice_lines").delete().eq("supplier_invoice_id", id);
    const rader = linjer.filter((l) => l.konto && Number(l.netto));
    if (rader.length) {
      const { error: e2 } = await supabase.from("supplier_invoice_lines").insert(rader.map((l, i) => ({ supplier_invoice_id: id, company_id: company.id, konto: l.konto, beskrivelse: l.beskrivelse, netto: Number(l.netto), mva_sats: l.mva_sats, linjenr: i })));
      if (e2) throw e2;
    }
  }

  if (f.status !== "utkast") {
    return (
      <>
        <PageHeader title={`${f.suppliers?.navn} – faktura ${f.fakturanr ?? ""}`} sub={`Fakturadato ${dato(f.fakturadato)} · forfall ${dato(f.forfallsdato)}${f.kid ? ` · KID ${f.kid}` : ""}`}
          actions={f.voucher_id && <Button variant="ghost" asChild><Link to="/app/bilag/$id" params={{ id: f.voucher_id }}>Se bilag</Link></Button>} />
        {f.status === "bokfort" && canWrite && (
          <Panel className="mb-6 flex items-end gap-3 p-4">
            <div className="space-y-1.5"><Label>Betalt dato</Label><Input type="date" value={betDato} onChange={(e) => setBetDato(e.target.value)} /></div>
            <Button disabled={busy} onClick={() => run(async () => { const { error } = await supabase.rpc("pay_supplier_invoice", { _inv: id, _dato: betDato }); if (error) throw error; }, "Betaling bokført (2400 / 1920)")}>Registrer betaling</Button>
          </Panel>
        )}
        <Panel className="mb-6">
          <table className="w-full text-sm">
            <thead className={theadCls}><tr><th className="px-4 py-3">Konto</th><th className="px-4 py-3">Beskrivelse</th><th className="px-4 py-3 text-right">Netto</th><th className="px-4 py-3 text-right">MVA</th></tr></thead>
            <tbody>{f.supplier_invoice_lines.map((l) => <tr key={l.id} className="border-b"><td className="px-4 py-2 font-mono">{l.konto}</td><td className="px-4 py-2">{l.beskrivelse}</td><td className="num px-4 py-2">{kr(l.netto)}</td><td className="num px-4 py-2">{Number(l.mva_sats)} %</td></tr>)}</tbody>
            <tfoot><tr className="bg-muted/50 font-medium"><td colSpan={2} className="px-4 py-3">Total inkl. mva</td><td colSpan={2} className="num px-4 py-3">{kr(f.total)}</td></tr></tfoot>
          </table>
        </Panel>
        <Vedlegg supplierInvoiceId={id} />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Registrer leverandørfaktura" actions={<Button variant="ghost" onClick={async () => { await supabase.from("supplier_invoices").delete().eq("id", id); qc.invalidateQueries(); nav({ to: "/app/leverandorfakturaer" }); }}>Slett utkast</Button>} />
      <Panel className="mb-6 grid items-end gap-4 p-6 md:grid-cols-6">
        <div className="space-y-1.5 md:col-span-2">
          <Label>Leverandør</Label>
          <select className={`${selectCls} w-full`} value={h.supplier_id} onChange={(e) => setH({ ...h, supplier_id: e.target.value })}>{lev.map((s) => <option key={s.id} value={s.id}>{s.navn}</option>)}</select>
        </div>
        <NyLeverandor onCreated={(sid) => setH({ ...h, supplier_id: sid })} />
        <div className="space-y-1.5"><Label>Fakturanr</Label><Input value={h.fakturanr} onChange={(e) => setH({ ...h, fakturanr: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>Fakturadato</Label><Input type="date" value={h.fakturadato} onChange={(e) => setH({ ...h, fakturadato: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>Forfall</Label><Input type="date" value={h.forfallsdato} onChange={(e) => setH({ ...h, forfallsdato: e.target.value })} /></div>
        <div className="space-y-1.5 md:col-span-2"><Label>KID</Label><Input className="font-mono" value={h.kid} onChange={(e) => setH({ ...h, kid: e.target.value })} /></div>
      </Panel>
      <Panel className="mb-6">
        <table className="w-full text-sm">
          <thead className={theadCls}><tr><th className="px-4 py-3">Konto</th><th className="px-4 py-3">Beskrivelse</th><th className="px-4 py-3 text-right">Netto</th><th className="px-4 py-3">MVA</th><th /></tr></thead>
          <tbody>
            {linjer.map((l, i) => {
              const set = (k: keyof L, v: string | number) => setLinjer((ls) => ls.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
              return (
                <tr key={i} className="border-b">
                  <td className="w-64 px-4 py-2">
                    <select className={`${selectCls} w-full`} value={l.konto} onChange={(e) => set("konto", e.target.value)}>
                      {kontoer.filter((k) => k.number >= "1000").map((k) => <option key={k.number} value={k.number}>{k.number} {k.name}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-2"><Input value={l.beskrivelse} onChange={(e) => set("beskrivelse", e.target.value)} /></td>
                  <td className="w-36 px-4 py-2"><Input className="num" value={l.netto} onChange={(e) => set("netto", e.target.value.replace(",", "."))} /></td>
                  <td className="w-32 px-4 py-2"><select disabled={!company.mva_registrert} className={`${selectCls} w-full`} value={l.mva_sats} onChange={(e) => set("mva_sats", Number(e.target.value))}><option value={25}>25 %</option><option value={15}>15 %</option><option value={12}>12 %</option><option value={0}>0 %</option></select></td>
                  <td className="w-10 pr-2"><Button variant="ghost" size="icon" onClick={() => setLinjer((ls) => ls.filter((_, j) => j !== i))}><Trash2 /></Button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="flex items-start justify-between p-4">
          <Button variant="ghost" size="sm" onClick={() => setLinjer((ls) => [...ls, { konto: "6800", beskrivelse: "", netto: "", mva_sats: company.mva_registrert ? 25 : 0 }])}><Plus /> Ny linje</Button>
          <dl className="grid w-64 grid-cols-2 gap-y-1 text-sm"><dt>Netto</dt><dd className="num">{kr(netto)}</dd><dt>Inngående mva</dt><dd className="num">{kr(mva)}</dd><dt className="font-semibold">Total</dt><dd className="num font-semibold">{kr(netto + mva)}</dd></dl>
        </div>
      </Panel>
      <div className="mb-6"><Vedlegg supplierInvoiceId={id} /></div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" disabled={busy} onClick={() => run(lagre, "Utkast lagret")}>Lagre utkast</Button>
        <Button disabled={busy || netto <= 0} onClick={() => run(async () => { await lagre(); const { error } = await supabase.rpc("book_supplier_invoice", { _inv: id }); if (error) throw error; }, "Fakturaen er bokført mot leverandørgjeld")}>Bokfør</Button>
      </div>
    </>
  );
}
