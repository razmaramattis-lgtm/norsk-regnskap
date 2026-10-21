import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company";
import { dato, kr } from "@/lib/format";
import { parseBankCsv, radHash } from "@/lib/bankimport";
import { PageHeader, Panel, Empty, useAccounts, usePostedLines, selectCls, theadCls } from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/app/bank")({
  head: () => ({ meta: [{ title: "Bank og avstemming – Fjordbok" }] }),
  component: Bank,
});

type Tx = { id: string; dato: string; tekst: string; belop: number; referanse: string | null; status: string; voucher_id: string | null };

function Bank() {
  const { company, canWrite } = useCompany();
  const qc = useQueryClient();
  const ref = useRef<HTMLInputElement>(null);
  const [vis, setVis] = useState<"ny" | "alle">("ny");
  const [valgt, setValgt] = useState<Tx | null>(null);
  const { data: txs = [], isLoading } = useQuery({
    queryKey: ["bank", company.id],
    queryFn: async () => ((await supabase.from("bank_transactions").select("*").eq("company_id", company.id).order("dato", { ascending: false })).data ?? []) as Tx[],
  });
  const { data: linjer = [] } = usePostedLines("1900-01-01", "2999-12-31");
  const hovedbok1920 = linjer.filter((l) => l.konto === "1920").reduce((s, l) => s + l.debet - l.kredit, 0);
  const banksum = txs.reduce((s, t) => s + Number(t.belop), 0);
  const uavstemt = txs.filter((t) => t.status === "ny");

  async function importer(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const rader = parseBankCsv(await file.text());
    e.target.value = "";
    if (!rader.length) { toast.error("Fant ingen transaksjoner i filen. Bruk CSV-eksport fra nettbanken."); return; }
    const { data, error } = await supabase.from("bank_transactions").upsert(
      rader.map((r) => ({ company_id: company.id, dato: r.dato, tekst: r.tekst, belop: r.belop, referanse: r.referanse ?? null, import_hash: radHash(r, "1920") })),
      { onConflict: "company_id,import_hash", ignoreDuplicates: true },
    ).select("id");
    if (error) { toast.error(error.message); return; }
    toast.success(`${data?.length ?? 0} nye transaksjoner importert (${rader.length - (data?.length ?? 0)} duplikater hoppet over)`);
    qc.invalidateQueries({ queryKey: ["bank"] });
  }

  const liste = vis === "ny" ? uavstemt : txs;
  return (
    <>
      <PageHeader title="Bank og avstemming" sub="Importer kontoutskrift (CSV) fra nettbanken og avstem mot hovedboken."
        actions={canWrite && (<><input ref={ref} type="file" accept=".csv,text/csv" className="hidden" onChange={importer} /><Button onClick={() => ref.current?.click()}><Upload /> Importer CSV</Button></>)} />
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Panel className="p-5"><div className="text-xs uppercase text-muted-foreground">Saldo 1920 i hovedbok</div><div className="num mt-2 text-left font-serif text-2xl">{kr(hovedbok1920)}</div></Panel>
        <Panel className="p-5"><div className="text-xs uppercase text-muted-foreground">Sum importerte transaksjoner</div><div className="num mt-2 text-left font-serif text-2xl">{kr(banksum)}</div></Panel>
        <Panel className="p-5"><div className="text-xs uppercase text-muted-foreground">Ikke avstemt</div><div className="mt-2 font-serif text-2xl">{uavstemt.length}</div></Panel>
      </div>
      <div className="mb-3 flex gap-2">
        <Button size="sm" variant={vis === "ny" ? "default" : "outline"} onClick={() => setVis("ny")}>Til avstemming</Button>
        <Button size="sm" variant={vis === "alle" ? "default" : "outline"} onClick={() => setVis("alle")}>Alle</Button>
      </div>
      <Panel>
        {isLoading ? <Empty>Laster …</Empty> : liste.length === 0 ? <Empty>{vis === "ny" ? "Alt er avstemt." : "Ingen transaksjoner. Importer en CSV-fil fra nettbanken."}</Empty> : (
          <table className="w-full text-sm">
            <thead className={theadCls}><tr><th className="px-4 py-3">Dato</th><th className="px-4 py-3">Tekst</th><th className="px-4 py-3">Referanse</th><th className="px-4 py-3 text-right">Beløp</th><th className="px-4 py-3" /></tr></thead>
            <tbody>
              {liste.map((t) => (
                <tr key={t.id} className="border-b last:border-0">
                  <td className="px-4 py-3">{dato(t.dato)}</td>
                  <td className="px-4 py-3">{t.tekst}</td>
                  <td className="px-4 py-3 font-mono text-xs">{t.referanse}</td>
                  <td className={`num px-4 py-3 ${Number(t.belop) < 0 ? "" : "text-success"}`}>{kr(t.belop)}</td>
                  <td className="px-4 py-3 text-right">
                    {t.status === "ny" ? (canWrite && <Button size="sm" onClick={() => setValgt(t)}>Avstem</Button>)
                      : t.voucher_id ? <Link to="/app/bilag/$id" params={{ id: t.voucher_id }}><Badge variant="secondary">Avstemt</Badge></Link> : <Badge>Avstemt</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
      {valgt && <Avstem tx={valgt} onClose={() => setValgt(null)} />}
    </>
  );
}

function Avstem({ tx, onClose }: { tx: Tx; onClose: () => void }) {
  const { company } = useCompany();
  const qc = useQueryClient();
  const { data: kontoer = [] } = useAccounts();
  const inn = Number(tx.belop) > 0;
  const [konto, setKonto] = useState(inn ? "3000" : "6800");
  const [sats, setSats] = useState(company.mva_registrert ? 25 : 0);
  const { data: forslag = [] } = useQuery({
    queryKey: ["match", tx.id],
    queryFn: async () => {
      if (inn) {
        const { data } = await supabase.from("invoices").select("id, fakturanr, kid, total, customers(navn)").eq("company_id", company.id).eq("status", "sendt");
        return (data ?? []).map((i) => ({ id: i.id, type: "faktura" as const, tekst: `Faktura ${i.fakturanr} – ${i.customers?.navn}`, total: Number(i.total), treff: (tx.referanse && i.kid === tx.referanse) || tx.tekst.includes(String(i.fakturanr)) || tx.tekst.includes(i.kid ?? "§") }));
      }
      const { data } = await supabase.from("supplier_invoices").select("id, fakturanr, kid, total, suppliers(navn)").eq("company_id", company.id).eq("status", "bokfort");
      return (data ?? []).map((i) => ({ id: i.id, type: "lev" as const, tekst: `${i.suppliers?.navn} ${i.fakturanr ?? ""}`, total: Number(i.total), treff: (!!i.kid && (tx.referanse === i.kid || tx.tekst.includes(i.kid))) }));
    },
  });
  const passende = forslag.filter((f) => Math.abs(f.total - Math.abs(Number(tx.belop))) < 0.005).sort((a, b) => Number(b.treff) - Number(a.treff));

  async function bokfor(args: { motkonto?: string; mva?: number; invoice?: string; sinv?: string }) {
    const { error } = await supabase.rpc("book_bank_transaction", {
      _tx: tx.id, _motkonto: args.motkonto ?? "", _mva_sats: args.mva ?? 0,
      _invoice: args.invoice ?? (null as unknown as string), _supplier_invoice: args.sinv ?? (null as unknown as string),
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Transaksjonen er bokført og avstemt");
    qc.invalidateQueries();
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{tx.tekst || "Banktransaksjon"} · {kr(tx.belop)}</DialogTitle></DialogHeader>
        {passende.length > 0 && (
          <div className="space-y-2">
            <Label>Forslag – åpne poster med samme beløp</Label>
            {passende.map((p) => (
              <button key={p.id} onClick={() => bokfor(p.type === "faktura" ? { invoice: p.id } : { sinv: p.id })} className="flex w-full items-center justify-between rounded-md border p-3 text-left text-sm hover:bg-muted">
                <span>{p.tekst} {p.treff && <Badge className="ml-2">KID/ref treff</Badge>}</span><span className="num">{kr(p.total)}</span>
              </button>
            ))}
          </div>
        )}
        <div className="space-y-3 border-t pt-4">
          <Label>Eller bokfør mot konto</Label>
          <select className={`${selectCls} w-full`} value={konto} onChange={(e) => setKonto(e.target.value)}>
            {kontoer.filter((k) => k.number !== "1920").map((k) => <option key={k.number} value={k.number}>{k.number} {k.name}</option>)}
          </select>
          <select disabled={!company.mva_registrert} className={`${selectCls} w-full`} value={sats} onChange={(e) => setSats(Number(e.target.value))}>
            <option value={25}>Beløpet inkluderer 25 % mva</option><option value={15}>Inkluderer 15 % mva</option><option value={12}>Inkluderer 12 % mva</option><option value={0}>Uten mva</option>
          </select>
          <Button className="w-full" onClick={() => bokfor({ motkonto: konto, mva: sats })}>Bokfør</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
