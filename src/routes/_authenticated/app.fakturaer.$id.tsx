import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Printer, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company";
import { dato, formatOrgNr, idag, kr } from "@/lib/format";
import { PageHeader, Panel, Empty } from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useCustomers, NyKunde } from "./app.kunder";
import { STATUS } from "./app.fakturaer.index";

export const Route = createFileRoute("/_authenticated/app/fakturaer/$id")({
  head: () => ({ meta: [{ title: "Faktura – Fjordbok" }] }),
  component: FakturaSide,
});

type L = { beskrivelse: string; antall: string; enhetspris: string; mva_sats: number };

function FakturaSide() {
  const { id } = Route.useParams();
  const { company, canWrite } = useCompany();
  const { data: kunder = [] } = useCustomers();
  const qc = useQueryClient();
  const nav = useNavigate();
  const { data: f, isLoading } = useQuery({
    queryKey: ["invoice", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("invoices").select("*, customers(*), invoice_lines(*)").eq("id", id).single();
      if (error) throw error;
      data.invoice_lines.sort((a, b) => a.linjenr - b.linjenr);
      return data;
    },
  });
  const [kunde, setKunde] = useState("");
  const [fdato, setFdato] = useState(idag());
  const [merknad, setMerknad] = useState("");
  const [linjer, setLinjer] = useState<L[]>([]);
  const [busy, setBusy] = useState(false);
  const [betDato, setBetDato] = useState(idag());

  useEffect(() => {
    if (!f) return;
    setKunde(f.customer_id);
    setFdato(f.fakturadato);
    setMerknad(f.merknad ?? "");
    setLinjer(
      f.invoice_lines.length
        ? f.invoice_lines.map((l) => ({ beskrivelse: l.beskrivelse, antall: String(l.antall), enhetspris: String(l.enhetspris), mva_sats: Number(l.mva_sats) }))
        : [{ beskrivelse: "", antall: "1", enhetspris: "", mva_sats: company.mva_registrert ? 25 : 0 }],
    );
  }, [f, company.mva_registrert]);

  if (isLoading || !f) return <Empty>Laster …</Empty>;
  const utkast = f.status === "utkast";

  const netto = linjer.reduce((s, l) => s + Number(l.antall || 0) * Number(l.enhetspris || 0), 0);
  const mva = company.mva_registrert ? linjer.reduce((s, l) => s + Math.round(Number(l.antall || 0) * Number(l.enhetspris || 0) * l.mva_sats) / 100, 0) : 0;

  async function lagre() {
    const { error } = await supabase.from("invoices").update({ customer_id: kunde, fakturadato: fdato, merknad, netto, mva, total: netto + mva }).eq("id", id);
    if (error) throw error;
    await supabase.from("invoice_lines").delete().eq("invoice_id", id);
    const rader = linjer.filter((l) => l.beskrivelse);
    if (rader.length) {
      const { error: e2 } = await supabase.from("invoice_lines").insert(
        rader.map((l, i) => ({ invoice_id: id, company_id: company.id, beskrivelse: l.beskrivelse, antall: Number(l.antall), enhetspris: Number(l.enhetspris), mva_sats: company.mva_registrert ? l.mva_sats : 0, linjenr: i })),
      );
      if (e2) throw e2;
    }
  }

  async function run(fn: () => Promise<void>, ok: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      qc.invalidateQueries();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!utkast) {
    const c = f.customers!;
    return (
      <>
        <PageHeader
          title={`Faktura ${f.fakturanr}`}
          sub={c.navn}
          actions={
            <>
              <Button variant="outline" onClick={() => window.print()}><Printer /> Skriv ut / PDF</Button>
              {f.voucher_id && <Button variant="ghost" asChild><Link to="/app/bilag/$id" params={{ id: f.voucher_id }}>Se bilag</Link></Button>}
            </>
          }
        />
        {f.status === "sendt" && canWrite && (
          <Panel className="mb-6 flex items-end gap-3 p-4 print:hidden">
            <div className="space-y-1.5"><Label>Innbetalt dato</Label><Input type="date" value={betDato} onChange={(e) => setBetDato(e.target.value)} /></div>
            <Button disabled={busy} onClick={() => run(async () => { const { error } = await supabase.rpc("register_invoice_payment", { _invoice: id, _dato: betDato }); if (error) throw error; }, "Innbetaling bokført (1920 / 1500)")}>Registrer innbetaling</Button>
          </Panel>
        )}
        <Panel className="mx-auto max-w-3xl p-12">
          <div className="flex justify-between">
            <div>
              <div className="font-serif text-2xl">{company.name}</div>
              <div className="text-sm text-muted-foreground">Org.nr {formatOrgNr(company.org_nr)}{company.mva_registrert ? " MVA" : ""}</div>
              {company.company_type === "as" ? null : <div className="text-sm text-muted-foreground">Enkeltpersonforetak</div>}
            </div>
            <div className="text-right">
              <div className="font-serif text-3xl">Faktura</div>
              <Badge variant={STATUS[f.status].v} className="mt-2">{STATUS[f.status].t}</Badge>
            </div>
          </div>
          <div className="mt-10 grid grid-cols-2 gap-8 text-sm">
            <div>
              <div className="font-medium">{c.navn}</div>
              <div>{c.adresse}</div>
              <div>{c.postnr} {c.poststed}</div>
              {c.org_nr && <div className="text-muted-foreground">Org.nr {formatOrgNr(c.org_nr)}</div>}
            </div>
            <dl className="grid grid-cols-2 gap-y-1">
              <dt className="text-muted-foreground">Fakturanr</dt><dd className="num">{f.fakturanr}</dd>
              <dt className="text-muted-foreground">Fakturadato</dt><dd className="num">{dato(f.fakturadato)}</dd>
              <dt className="text-muted-foreground">Forfallsdato</dt><dd className="num">{dato(f.forfallsdato)}</dd>
              <dt className="text-muted-foreground">KID</dt><dd className="num">{f.kid}</dd>
              <dt className="text-muted-foreground">Kontonr</dt><dd className="num">{company.kontonummer ?? "–"}</dd>
            </dl>
          </div>
          <table className="mt-10 w-full text-sm">
            <thead className="border-b text-left text-xs uppercase text-muted-foreground"><tr><th className="py-2">Beskrivelse</th><th className="py-2 text-right">Antall</th><th className="py-2 text-right">Pris</th><th className="py-2 text-right">MVA</th><th className="py-2 text-right">Beløp</th></tr></thead>
            <tbody>
              {f.invoice_lines.map((l) => (
                <tr key={l.id} className="border-b"><td className="py-2">{l.beskrivelse}</td><td className="num py-2">{Number(l.antall)}</td><td className="num py-2">{kr(l.enhetspris)}</td><td className="num py-2">{Number(l.mva_sats)} %</td><td className="num py-2">{kr(Number(l.antall) * Number(l.enhetspris))}</td></tr>
              ))}
            </tbody>
          </table>
          <dl className="ml-auto mt-6 grid w-64 grid-cols-2 gap-y-1 text-sm">
            <dt>Sum eks. mva</dt><dd className="num">{kr(f.netto)}</dd>
            <dt>Merverdiavgift</dt><dd className="num">{kr(f.mva)}</dd>
            <dt className="border-t pt-2 font-semibold">Å betale</dt><dd className="num border-t pt-2 font-semibold">{kr(f.total)}</dd>
          </dl>
          {f.merknad && <p className="mt-8 text-sm text-muted-foreground">{f.merknad}</p>}
        </Panel>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Ny faktura"
        actions={
          <Button variant="ghost" onClick={async () => { await supabase.from("invoices").delete().eq("id", id); qc.invalidateQueries(); nav({ to: "/app/fakturaer" }); }}>Slett utkast</Button>
        }
      />
      <Panel className="mb-6 grid items-end gap-4 p-6 md:grid-cols-[1fr_auto_180px]">
        <div className="space-y-1.5">
          <Label>Kunde</Label>
          <select className="h-9 w-full rounded-md border border-input bg-card px-2 text-sm" value={kunde} onChange={(e) => setKunde(e.target.value)}>
            {kunder.map((k) => <option key={k.id} value={k.id}>{k.navn}</option>)}
          </select>
        </div>
        <NyKunde onCreated={setKunde} />
        <div className="space-y-1.5"><Label>Fakturadato</Label><Input type="date" value={fdato} onChange={(e) => setFdato(e.target.value)} /></div>
      </Panel>
      <Panel className="mb-6">
        <table className="w-full text-sm">
          <thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr><th className="px-4 py-3">Beskrivelse</th><th className="px-4 py-3 text-right">Antall</th><th className="px-4 py-3 text-right">Pris eks. mva</th><th className="px-4 py-3">MVA</th><th className="px-4 py-3 text-right">Beløp</th><th /></tr>
          </thead>
          <tbody>
            {linjer.map((l, i) => {
              const set = (k: keyof L, v: string | number) => setLinjer((ls) => ls.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
              return (
                <tr key={i} className="border-b">
                  <td className="px-4 py-2"><Input value={l.beskrivelse} onChange={(e) => set("beskrivelse", e.target.value)} /></td>
                  <td className="w-24 px-4 py-2"><Input className="num" value={l.antall} onChange={(e) => set("antall", e.target.value.replace(",", "."))} /></td>
                  <td className="w-36 px-4 py-2"><Input className="num" value={l.enhetspris} onChange={(e) => set("enhetspris", e.target.value.replace(",", "."))} /></td>
                  <td className="w-32 px-4 py-2">
                    <select disabled={!company.mva_registrert} className="h-9 w-full rounded-md border border-input bg-card px-2 text-sm" value={l.mva_sats} onChange={(e) => set("mva_sats", Number(e.target.value))}>
                      <option value={25}>25 %</option><option value={15}>15 %</option><option value={12}>12 %</option><option value={0}>0 %</option>
                    </select>
                  </td>
                  <td className="num w-32 px-4 py-2">{kr(Number(l.antall || 0) * Number(l.enhetspris || 0))}</td>
                  <td className="w-10 pr-2"><Button variant="ghost" size="icon" onClick={() => setLinjer((ls) => ls.filter((_, j) => j !== i))}><Trash2 /></Button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="flex items-start justify-between p-4">
          <Button variant="ghost" size="sm" onClick={() => setLinjer((ls) => [...ls, { beskrivelse: "", antall: "1", enhetspris: "", mva_sats: company.mva_registrert ? 25 : 0 }])}><Plus /> Ny linje</Button>
          <dl className="grid w-64 grid-cols-2 gap-y-1 text-sm">
            <dt>Sum eks. mva</dt><dd className="num">{kr(netto)}</dd>
            <dt>MVA</dt><dd className="num">{kr(mva)}</dd>
            <dt className="font-semibold">Total</dt><dd className="num font-semibold">{kr(netto + mva)}</dd>
          </dl>
        </div>
      </Panel>
      <div className="mb-6 space-y-1.5"><Label>Merknad på fakturaen</Label><Input value={merknad} onChange={(e) => setMerknad(e.target.value)} /></div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" disabled={busy} onClick={() => run(lagre, "Utkast lagret")}>Lagre utkast</Button>
        <Button disabled={busy || netto <= 0} onClick={() => run(async () => { await lagre(); const { error } = await supabase.rpc("send_invoice", { _invoice: id }); if (error) throw error; }, "Fakturaen er sendt og bokført")}>Send og bokfør</Button>
      </div>
    </>
  );
}
