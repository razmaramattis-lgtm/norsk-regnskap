import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BellRing, Copy, Mail, Plus, Printer, Repeat, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company";
import { dato, formatOrgNr, idag, kr } from "@/lib/format";
import { INTERVALLER, fakturaSummer, linjeNetto, nesteDato, restbelop, type Intervall } from "@/lib/faktura";
import { PageHeader, Panel, Empty, selectCls } from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useCustomers, NyKunde, STATUS } from "@/components/app/kunder";
import { useArticles } from "@/components/app/hooks";
import { EhfPanel } from "@/components/app/EhfPanel";
import { fakturaEpost, mailto, purreEpost } from "@/lib/fakturatekst";

export const Route = createFileRoute("/_authenticated/app/fakturaer/$id")({
  head: () => ({ meta: [{ title: "Faktura – Fjordbok" }] }),
  component: FakturaSide,
});

type L = { beskrivelse: string; antall: string; enhet: string; enhetspris: string; rabatt: string; mva_sats: number };

const tall = (s: string) => Number((s || "0").replace(/\s/g, "").replace(",", "."));
const tomLinje = (mva: boolean): L => ({ beskrivelse: "", antall: "1", enhet: "stk", enhetspris: "", rabatt: "", mva_sats: mva ? 25 : 0 });

function FakturaSide() {
  const { id } = Route.useParams();
  const { company, canWrite } = useCompany();
  const { data: kunder = [] } = useCustomers();
  const { data: varer = [] } = useArticles();
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
  const { data: repetering } = useQuery({
    queryKey: ["repetering", id],
    queryFn: async () => (await supabase.from("repeterende_fakturaer").select("*").eq("mal_faktura", id).maybeSingle()).data,
  });
  const [kunde, setKunde] = useState("");
  const [fdato, setFdato] = useState(idag());
  const [ldato, setLdato] = useState("");
  const [deresRef, setDeresRef] = useState("");
  const [varRef, setVarRef] = useState("");
  const [merknad, setMerknad] = useState("");
  const [linjer, setLinjer] = useState<L[]>([]);
  const [busy, setBusy] = useState(false);
  const [betDato, setBetDato] = useState(idag());
  const [betBelop, setBetBelop] = useState("");
  const [intervall, setIntervall] = useState<Intervall>("maaned");

  useEffect(() => {
    if (!f) return;
    setKunde(f.customer_id);
    setFdato(f.fakturadato);
    setLdato(f.leveringsdato ?? "");
    setDeresRef(f.deres_ref ?? "");
    setVarRef(f.var_ref ?? "");
    setMerknad(f.merknad ?? "");
    setBetBelop(String(restbelop(Number(f.total), Number(f.innbetalt)).rest));
    setLinjer(
      f.invoice_lines.length
        ? f.invoice_lines.map((l) => ({
            beskrivelse: l.beskrivelse,
            antall: String(l.antall),
            enhet: l.enhet ?? "",
            enhetspris: String(l.enhetspris),
            rabatt: Number(l.rabatt_prosent) ? String(l.rabatt_prosent) : "",
            mva_sats: Number(l.mva_sats),
          }))
        : [tomLinje(company.mva_registrert)],
    );
  }, [f, company.mva_registrert]);

  if (isLoading || !f) return <Empty>Laster …</Empty>;
  const utkast = f.status === "utkast";

  const beregn = linjer.map((l) => ({ antall: tall(l.antall), enhetspris: tall(l.enhetspris), rabatt_prosent: tall(l.rabatt), mva_sats: company.mva_registrert ? l.mva_sats : 0 }));
  const sum = fakturaSummer(beregn, company.mva_registrert);

  async function lagre() {
    const { error } = await supabase
      .from("invoices")
      .update({
        customer_id: kunde,
        fakturadato: fdato,
        leveringsdato: ldato || null,
        deres_ref: deresRef.trim() || null,
        var_ref: varRef.trim() || null,
        merknad,
        netto: sum.netto,
        mva: sum.mva,
        total: sum.total,
      })
      .eq("id", id);
    if (error) throw error;
    await supabase.from("invoice_lines").delete().eq("invoice_id", id);
    const rader = linjer.map((l, i) => ({ l, b: beregn[i]! })).filter(({ l }) => l.beskrivelse);
    if (rader.length) {
      const { error: e2 } = await supabase.from("invoice_lines").insert(
        rader.map(({ l, b }, i) => ({
          invoice_id: id,
          company_id: company.id,
          beskrivelse: l.beskrivelse,
          antall: b.antall,
          enhet: l.enhet.trim() || null,
          enhetspris: b.enhetspris,
          rabatt_prosent: b.rabatt_prosent,
          mva_sats: b.mva_sats,
          linjenr: i,
        })),
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

  /** Ny kladd med samme kunde og linjer, dagens dato. */
  async function kopier() {
    const { data: ny, error } = await supabase
      .from("invoices")
      .insert({ company_id: company.id, customer_id: f!.customer_id, merknad: f!.merknad, deres_ref: f!.deres_ref, var_ref: f!.var_ref })
      .select("id")
      .single();
    if (error) throw error;
    const { error: e2 } = await supabase.from("invoice_lines").insert(
      f!.invoice_lines.map((l) => ({
        invoice_id: ny.id,
        company_id: company.id,
        beskrivelse: l.beskrivelse,
        antall: Math.abs(Number(l.antall)),
        enhet: l.enhet,
        enhetspris: l.enhetspris,
        rabatt_prosent: l.rabatt_prosent,
        mva_sats: l.mva_sats,
        linjenr: l.linjenr,
      })),
    );
    if (e2) throw e2;
    nav({ to: "/app/fakturaer/$id", params: { id: ny.id } });
  }

  if (!utkast) {
    const c = f.customers!;
    const { rest } = restbelop(Number(f.total), Number(f.innbetalt));
    const harRabatt = f.invoice_lines.some((l) => Number(l.rabatt_prosent) > 0);
    return (
      <>
        <div className="print:hidden">
          <PageHeader
            title={`${f.er_kreditnota ? "Kreditnota" : "Faktura"} ${f.fakturanr}`}
            sub={c.navn}
            actions={
              <>
                <Button variant="outline" onClick={() => window.print()}><Printer /> Skriv ut / PDF</Button>
                <Button variant="outline" asChild title={c.epost ? undefined : "Kunden mangler e-post"}>
                  <a href={mailto(fakturaEpost(f, company, c))}><Mail /> Send på e-post</a>
                </Button>
                {f.status === "sendt" && !f.er_kreditnota && f.forfallsdato < idag() && (
                  <Button variant="outline" asChild>
                    <a href={mailto(purreEpost({ ...f, total: rest }, company, c, idag()))}><BellRing /> Send purring</a>
                  </Button>
                )}
                {canWrite && !f.er_kreditnota && (
                  <Button variant="outline" disabled={busy} onClick={() => run(kopier, "Kopi laget som utkast")}><Copy /> Kopier</Button>
                )}
                {f.voucher_id && <Button variant="ghost" asChild><Link to="/app/bilag/$id" params={{ id: f.voucher_id }}>Se bilag</Link></Button>}
                {f.status === "sendt" && !f.er_kreditnota && canWrite && Number(f.innbetalt) === 0 && (
                  <Button variant="outline" disabled={busy} onClick={() => run(async () => { const { data, error } = await supabase.rpc("credit_invoice", { _invoice: id }); if (error) throw error; nav({ to: "/app/fakturaer/$id", params: { id: data } }); }, "Kreditnota opprettet og bokført")}>Krediter</Button>
                )}
                {f.kreditnota_for && <Button variant="ghost" asChild><Link to="/app/fakturaer/$id" params={{ id: f.kreditnota_for }}>Opprinnelig faktura</Link></Button>}
              </>
            }
          />
          <div className="mb-6 grid gap-4 lg:grid-cols-2">
            {f.status === "sendt" && canWrite && (
              <Panel className="flex flex-wrap items-end gap-3 p-4">
                <div className="space-y-1.5"><Label>Innbetalt dato</Label><Input type="date" value={betDato} onChange={(e) => setBetDato(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Beløp</Label><Input className="num w-32" value={betBelop} onChange={(e) => setBetBelop(e.target.value)} /></div>
                <Button
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      const { error } = await supabase.rpc("registrer_innbetaling", { _invoice: id, _dato: betDato, _belop: tall(betBelop) });
                      if (error) throw error;
                    }, tall(betBelop) < rest - 0.5 ? "Delbetaling bokført" : "Innbetaling bokført (1920 / 1500)")
                  }
                >
                  Registrer innbetaling
                </Button>
                {Number(f.innbetalt) > 0 && (
                  <p className="w-full text-sm text-muted-foreground">Innbetalt {kr(f.innbetalt)} · gjenstår {kr(rest)}</p>
                )}
              </Panel>
            )}
            {canWrite && !f.er_kreditnota && (
              <Panel className="flex flex-wrap items-end gap-3 p-4">
                {repetering ? (
                  <>
                    <div className="text-sm">
                      <div className="font-medium">{repetering.aktiv ? INTERVALLER[repetering.intervall as Intervall]?.navn : "Repetering stoppet"}</div>
                      {repetering.aktiv && <div className="text-muted-foreground">Neste utkast {dato(repetering.neste_dato)}</div>}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => run(async () => { const { error } = await supabase.from("repeterende_fakturaer").update({ aktiv: !repetering.aktiv }).eq("id", repetering.id); if (error) throw error; }, repetering.aktiv ? "Repetering stoppet" : "Repetering startet igjen")}
                    >
                      {repetering.aktiv ? "Stopp" : "Start igjen"}
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      <Label>Gjenta fakturaen</Label>
                      <select className={selectCls} value={intervall} onChange={(e) => setIntervall(e.target.value as Intervall)}>
                        {Object.entries(INTERVALLER).map(([k, v]) => <option key={k} value={k}>{v.navn}</option>)}
                      </select>
                    </div>
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        run(async () => {
                          const { error } = await supabase.from("repeterende_fakturaer").insert({ company_id: company.id, mal_faktura: id, intervall, neste_dato: nesteDato(f.fakturadato, intervall) });
                          if (error) throw error;
                        }, "Fakturaen gjentas. Utkastene dukker opp under Til behandling.")
                      }
                    >
                      <Repeat /> Gjenta
                    </Button>
                  </>
                )}
              </Panel>
            )}
          </div>
          <EhfPanel faktura={f} company={company} />
        </div>
        <Panel className="mx-auto max-w-3xl p-12 print:max-w-none print:border-0 print:p-0 print:shadow-none">
          <div className="flex justify-between">
            <div>
              <div className="font-serif text-2xl">{company.name}</div>
              <div className="text-sm text-muted-foreground">{[company.adresse, [company.postnr, company.poststed].filter(Boolean).join(" ")].filter(Boolean).join(", ")}</div>
              <div className="text-sm text-muted-foreground">Org.nr {formatOrgNr(company.org_nr)}{company.mva_registrert ? " MVA" : ""}</div>
              {company.company_type === "as" ? <div className="text-sm text-muted-foreground">Foretaksregisteret</div> : <div className="text-sm text-muted-foreground">Enkeltpersonforetak</div>}
            </div>
            <div className="text-right">
              <div className="font-serif text-3xl">{f.er_kreditnota ? "Kreditnota" : "Faktura"}</div>
              <Badge variant={STATUS[f.status]!.v} className="mt-2 print:hidden">{STATUS[f.status]!.t}</Badge>
            </div>
          </div>
          <div className="mt-10 grid grid-cols-2 gap-8 text-sm">
            <div>
              <div className="font-medium">{c.navn}</div>
              <div>{c.adresse}</div>
              <div>{c.postnr} {c.poststed}</div>
              {c.org_nr && <div className="text-muted-foreground">Org.nr {formatOrgNr(c.org_nr)}</div>}
              {f.deres_ref && <div className="mt-2">Deres ref.: {f.deres_ref}</div>}
            </div>
            <dl className="grid grid-cols-2 gap-y-1">
              <dt className="text-muted-foreground">Fakturanr</dt><dd className="num">{f.fakturanr}</dd>
              <dt className="text-muted-foreground">Fakturadato</dt><dd className="num">{dato(f.fakturadato)}</dd>
              <dt className="text-muted-foreground">Leveringsdato</dt><dd className="num">{dato(f.leveringsdato ?? f.fakturadato)}</dd>
              <dt className="text-muted-foreground">Forfallsdato</dt><dd className="num">{dato(f.forfallsdato)}</dd>
              {f.var_ref && <><dt className="text-muted-foreground">Vår ref.</dt><dd className="num">{f.var_ref}</dd></>}
              <dt className="text-muted-foreground">KID</dt><dd className="num">{f.kid}</dd>
              <dt className="text-muted-foreground">Kontonr</dt><dd className="num">{company.kontonummer ?? "–"}</dd>
            </dl>
          </div>
          <table className="mt-10 w-full text-sm">
            <thead className="border-b text-left text-xs uppercase text-muted-foreground">
              <tr><th className="py-2">Beskrivelse</th><th className="py-2 text-right">Antall</th><th className="py-2 text-right">Pris</th>{harRabatt && <th className="py-2 text-right">Rabatt</th>}<th className="py-2 text-right">MVA</th><th className="py-2 text-right">Beløp</th></tr>
            </thead>
            <tbody>
              {f.invoice_lines.map((l) => (
                <tr key={l.id} className="border-b">
                  <td className="py-2">{l.beskrivelse}</td>
                  <td className="num py-2">{Number(l.antall)} {l.enhet ?? ""}</td>
                  <td className="num py-2">{kr(l.enhetspris)}</td>
                  {harRabatt && <td className="num py-2">{Number(l.rabatt_prosent) ? `${Number(l.rabatt_prosent)} %` : ""}</td>}
                  <td className="num py-2">{Number(l.mva_sats)} %</td>
                  <td className="num py-2">{kr(linjeNetto({ antall: Number(l.antall), enhetspris: Number(l.enhetspris), rabatt_prosent: Number(l.rabatt_prosent), mva_sats: Number(l.mva_sats) }))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <dl className="ml-auto mt-6 grid w-64 grid-cols-2 gap-y-1 text-sm">
            <dt>Sum eks. mva</dt><dd className="num">{kr(f.netto)}</dd>
            <dt>Merverdiavgift</dt><dd className="num">{kr(f.mva)}</dd>
            <dt className="border-t pt-2 font-semibold">Å betale</dt><dd className="num border-t pt-2 font-semibold">{kr(f.total)}</dd>
            {Number(f.innbetalt) > 0 && f.status === "sendt" && <><dt>Innbetalt</dt><dd className="num">−{kr(f.innbetalt)}</dd><dt className="font-semibold">Gjenstår</dt><dd className="num font-semibold">{kr(rest)}</dd></>}
          </dl>
          {f.merknad && <p className="mt-8 text-sm text-muted-foreground">{f.merknad}</p>}
        </Panel>
      </>
    );
  }

  const set = (i: number, k: keyof L, v: string | number) => setLinjer((ls) => ls.map((x, j) => (j === i ? { ...x, [k]: v } : x)));

  return (
    <>
      <PageHeader
        title="Ny faktura"
        actions={
          <Button variant="ghost" onClick={async () => { await supabase.from("invoices").delete().eq("id", id); qc.invalidateQueries(); nav({ to: "/app/fakturaer" }); }}>Slett utkast</Button>
        }
      />
      <Panel className="mb-6 grid items-end gap-4 p-6 md:grid-cols-[1fr_auto_160px_160px]">
        <div className="space-y-1.5">
          <Label>Kunde</Label>
          <select className={`${selectCls} w-full`} value={kunde} onChange={(e) => setKunde(e.target.value)}>
            {kunder.map((k) => <option key={k.id} value={k.id}>{k.navn}</option>)}
          </select>
        </div>
        <NyKunde onCreated={setKunde} />
        <div className="space-y-1.5"><Label>Fakturadato</Label><Input type="date" value={fdato} onChange={(e) => setFdato(e.target.value)} /></div>
        <div className="space-y-1.5"><Label>Leveringsdato</Label><Input type="date" value={ldato} onChange={(e) => setLdato(e.target.value)} placeholder="Som fakturadato" /></div>
        <div className="space-y-1.5 md:col-span-2"><Label>Deres referanse (bestiller / innkjøpsnr.)</Label><Input value={deresRef} onChange={(e) => setDeresRef(e.target.value)} placeholder="Kreves av offentlige kjøpere i EHF" /></div>
        <div className="space-y-1.5 md:col-span-2"><Label>Vår referanse</Label><Input value={varRef} onChange={(e) => setVarRef(e.target.value)} /></div>
      </Panel>
      {kunder.find((k) => k.id === kunde && !k.org_nr) && (
        <p className="mb-6 rounded-md bg-warning/15 px-4 py-2.5 text-sm">
          Kunden har ikke org.nr. Er kunden en bedrift, skal org.nr. stå på fakturaen fra 1.1.2028, og e-faktura (EHF) krever det fra 1.1.2027.
        </p>
      )}
      <Panel className="mb-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr><th className="px-3 py-3">Beskrivelse</th><th className="px-3 py-3 text-right">Antall</th><th className="px-3 py-3">Enhet</th><th className="px-3 py-3 text-right">Pris eks. mva</th><th className="px-3 py-3 text-right">Rabatt %</th><th className="px-3 py-3">MVA</th><th className="px-3 py-3 text-right">Beløp</th><th /></tr>
          </thead>
          <tbody>
            {linjer.map((l, i) => (
              <tr key={i} className="border-b">
                <td className="min-w-48 px-3 py-2">
                  <Input list="vareliste" value={l.beskrivelse} onChange={(e) => {
                    const v = varer.find((a) => a.navn === e.target.value);
                    if (v) setLinjer((ls) => ls.map((x, j) => (j === i ? { ...x, beskrivelse: v.navn, enhetspris: String(v.pris), mva_sats: Number(v.mva_sats) } : x)));
                    else set(i, "beskrivelse", e.target.value);
                  }} />
                  <datalist id="vareliste">{varer.map((a) => <option key={a.id} value={a.navn} />)}</datalist>
                </td>
                <td className="w-20 px-3 py-2"><Input className="num" value={l.antall} onChange={(e) => set(i, "antall", e.target.value)} /></td>
                <td className="w-24 px-3 py-2"><Input list="enheter" value={l.enhet} onChange={(e) => set(i, "enhet", e.target.value)} /></td>
                <td className="w-32 px-3 py-2"><Input className="num" value={l.enhetspris} onChange={(e) => set(i, "enhetspris", e.target.value)} /></td>
                <td className="w-20 px-3 py-2"><Input className="num" value={l.rabatt} onChange={(e) => set(i, "rabatt", e.target.value)} placeholder="0" /></td>
                <td className="w-28 px-3 py-2">
                  <select disabled={!company.mva_registrert} className={`${selectCls} w-full`} value={l.mva_sats} onChange={(e) => set(i, "mva_sats", Number(e.target.value))}>
                    <option value={25}>25 %</option><option value={15}>15 %</option><option value={12}>12 %</option><option value={0}>0 %</option>
                  </select>
                </td>
                <td className="num w-28 px-3 py-2">{kr(linjeNetto(beregn[i]!))}</td>
                <td className="w-10 pr-2"><Button variant="ghost" size="icon" onClick={() => setLinjer((ls) => ls.filter((_, j) => j !== i))}><Trash2 /></Button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <datalist id="enheter">{["stk", "timer", "dager", "mnd", "km", "kg", "pakke"].map((e) => <option key={e} value={e} />)}</datalist>
        <div className="flex items-start justify-between p-4">
          <Button variant="ghost" size="sm" onClick={() => setLinjer((ls) => [...ls, tomLinje(company.mva_registrert)])}><Plus /> Ny linje</Button>
          <dl className="grid w-64 grid-cols-2 gap-y-1 text-sm">
            <dt>Sum eks. mva</dt><dd className="num">{kr(sum.netto)}</dd>
            <dt>MVA</dt><dd className="num">{kr(sum.mva)}</dd>
            <dt className="font-semibold">Total</dt><dd className="num font-semibold">{kr(sum.total)}</dd>
          </dl>
        </div>
      </Panel>
      <div className="mb-6 space-y-1.5"><Label>Merknad på fakturaen</Label><Input value={merknad} onChange={(e) => setMerknad(e.target.value)} /></div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" disabled={busy} onClick={() => run(lagre, "Utkast lagret")}>Lagre utkast</Button>
        <Button disabled={busy || sum.netto <= 0} onClick={() => run(async () => { await lagre(); const { error } = await supabase.rpc("send_invoice", { _invoice: id }); if (error) throw error; }, "Fakturaen er sendt og bokført")}>Send og bokfør</Button>
      </div>
    </>
  );
}
