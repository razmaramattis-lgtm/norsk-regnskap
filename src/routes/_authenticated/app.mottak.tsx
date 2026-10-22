import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ChevronLeft, ChevronRight, Camera, CheckCircle2, FileText, Inbox, Sparkles, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company";
import { dato, idag, kr } from "@/lib/format";
import { BETALT_FRA, KJOPSTYPER, byggHendelse, type HendelseType } from "@/lib/hendelser";
import { forslagFraHistorikk, skalerLinjer, type HLinje } from "@/lib/hukommelse";
import { kontrollerBilag } from "@/lib/bilagskontroll";
import { DokumentViser } from "@/components/app/DokumentViser";
import { lastOppDokument } from "@/components/app/Vedlegg";
import { useTidligereBilag } from "@/components/app/hooks";
import { useServerFn } from "@tanstack/react-start";
import { lesBilag, type LestBilag } from "@/lib/les-bilag.functions";
import { foreslaaKontoKi, type KiKontoforslag } from "@/lib/kontoforslag-ki.functions";
import { Empty, PageHeader, Panel, selectCls, useAccounts } from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useBokforingsmodus } from "@/components/app/Bokforingsmodus";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/app/mottak")({
  head: () => ({ meta: [
    { title: "Bilagsmottak – Fjordbok" },
    { name: "description", content: "Behandle og bokfør kvitteringer og fakturaer i Fjordbok." },
    { property: "og:title", content: "Bilagsmottak – Fjordbok" },
    { property: "og:description", content: "Behandle og bokfør kvitteringer og fakturaer i Fjordbok." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: Mottak,
});

export function useMottak() {
  const { company } = useCompany();
  return useQuery({
    queryKey: ["mottak", company.id],
    queryFn: async () =>
      (
        await supabase
          .from("documents")
          .select("id, path, filnavn, mime, created_at, notat")
          .eq("company_id", company.id)
          .is("voucher_id", null)
          .is("supplier_invoice_id", null)
          .order("created_at")
      ).data ?? [],
  });
}

function Mottak() {
  const { company, canWrite } = useCompany();
  const qc = useQueryClient();
  const { data: docs = [], isLoading } = useMottak();
  const [valgt, setValgt] = useState<string | null>(null);
  const [besokt, setBesokt] = useState<string[]>([]);
  const setBokforingsmodus = useBokforingsmodus();
  const [drar, setDrar] = useState(false);
  const [laster, setLaster] = useState(0);
  const filRef = useRef<HTMLInputElement>(null);
  const kameraRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (valgt && !docs.find((d) => d.id === valgt)) setValgt(docs[0]?.id ?? null);
  }, [docs, valgt]);

  useEffect(() => {
    setBokforingsmodus(!!valgt);
    if (valgt) setBesokt((ids) => ids.includes(valgt) ? ids : [...ids, valgt]);
    return () => setBokforingsmodus(false);
  }, [valgt, setBokforingsmodus]);

  async function lastOpp(filer: File[]) {
    const gyldige = filer.filter((f) => f.type === "application/pdf" || f.type.startsWith("image/"));
    if (gyldige.length < filer.length) toast.warning("Bare PDF og bilder kan lastes opp.");
    setLaster(gyldige.length);
    let ok = 0;
    for (const f of gyldige) {
      try {
        await lastOppDokument(company.id, f);
        ok++;
      } catch (e) {
        toast.error((e as Error).message);
      }
      setLaster((n) => n - 1);
    }
    if (ok) toast.success(`${ok} ${ok === 1 ? "dokument" : "dokumenter"} lagt i mottaket`);
    qc.invalidateQueries({ queryKey: ["mottak"] });
  }

  const d = docs.find((x) => x.id === valgt);
  const indeks = docs.findIndex((x) => x.id === valgt);

  return (
    <>
      {!d && <PageHeader
        title="Bilagsmottak"
        sub="Slipp kvitteringer og fakturaer her. Før dem én og én med dokumentet ved siden av – vi husker hvordan du førte sist."
        actions={
          canWrite && (
            <>
              <input ref={filRef} type="file" multiple accept="image/*,application/pdf" hidden onChange={(e) => { void lastOpp([...(e.target.files ?? [])]); e.target.value = ""; }} />
              <input ref={kameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { void lastOpp([...(e.target.files ?? [])]); e.target.value = ""; }} />
              <Button variant="outline" className="md:hidden" onClick={() => kameraRef.current?.click()}><Camera /> Ta bilde</Button>
              <Button onClick={() => filRef.current?.click()}><Upload /> Last opp</Button>
            </>
          )
        }
      />}
      {d && (
        <div className="mb-3 flex min-w-0 flex-wrap items-center gap-2 border-b pb-3">
          <Button variant="outline" onClick={() => setValgt(null)}><ArrowLeft /> Bilagsmottak</Button>
          <span className="hidden font-serif text-lg sm:block">Bokføring</span>
          <div className="ml-auto flex min-w-0 items-center gap-2">
            <Button variant="outline" size="icon" aria-label="Forrige fil" disabled={indeks <= 0} onClick={() => setValgt(docs[indeks - 1]?.id ?? null)}><ChevronLeft /></Button>
            <select aria-label="Velg fil" className={`${selectCls} w-32 min-w-0 sm:w-64`} value={valgt ?? ""} onChange={(e) => setValgt(e.target.value)}>
              {docs.map((x) => <option key={x.id} value={x.id}>{x.filnavn}</option>)}
            </select>
            <span className="shrink-0 text-xs text-muted-foreground">{indeks + 1} / {docs.length}</span>
            <Button variant="outline" size="icon" aria-label="Neste fil" disabled={indeks >= docs.length - 1} onClick={() => setValgt(docs[indeks + 1]?.id ?? null)}><ChevronRight /></Button>
          </div>
        </div>
      )}
      <div
        onDragOver={(e) => { e.preventDefault(); setDrar(true); }}
        onDragLeave={() => setDrar(false)}
        onDrop={(e) => { e.preventDefault(); setDrar(false); if (canWrite) void lastOpp([...e.dataTransfer.files]); }}
        className={`relative rounded-xl transition ${drar ? "ring-2 ring-primary ring-offset-4 ring-offset-background" : ""}`}
      >
        {drar && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl border-2 border-dashed border-primary bg-primary/10 text-lg font-medium text-primary backdrop-blur-sm">
            Slipp filene for å legge dem i mottaket
          </div>
        )}
        {isLoading ? (
          <Panel><Empty>Laster …</Empty></Panel>
        ) : docs.length === 0 ? (
          <Panel className="flex flex-col items-center gap-3 px-6 py-20 text-center">
            <div className="rounded-full bg-success/10 p-4"><CheckCircle2 className="h-8 w-8 text-success" /></div>
            <div className="text-lg">Mottaket er tomt</div>
            <p className="max-w-md text-sm text-muted-foreground">
              Dra kvitteringer og PDF-fakturaer hit, eller bruk «Last opp». På mobilen kan du ta bilde av kvitteringen direkte.
            </p>
            {laster > 0 && <p className="text-sm text-primary">Laster opp {laster} …</p>}
          </Panel>
        ) : (
          <div className={d ? "grid min-w-0 gap-3 md:h-[calc(100dvh-88px)] md:grid-cols-[minmax(300px,0.7fr)_minmax(0,1.3fr)]" : "grid gap-4"}>
            {!d && <Panel className="h-fit p-2">
              <div className="flex items-center gap-2 px-2 pb-2 pt-1 text-xs uppercase tracking-wide text-muted-foreground">
                <Inbox className="h-3.5 w-3.5" /> {docs.length} til behandling
              </div>
              <ul className="space-y-1">
                {docs.map((x) => (
                  <li key={x.id}>
                    <Button variant="ghost"
                      onClick={() => setValgt(x.id)}
                      className="flex h-auto w-full items-start justify-start gap-2 rounded-md px-2 py-3 text-left text-sm"
                    >
                      <FileText className="mt-0.5 h-4 w-4 shrink-0" />
                      <span className="min-w-0">
                        <span className="block truncate">{x.filnavn}</span>
                        <span className="block text-xs text-muted-foreground">{dato(x.created_at)}</span>
                      </span>
                    </Button>
                  </li>
                ))}
              </ul>
              {laster > 0 && <p className="px-2 pt-2 text-xs text-primary">Laster opp {laster} …</p>}
            </Panel>}
            <div className={d ? "min-h-0 min-w-0 md:overflow-y-auto" : "hidden"}>
              {canWrite && docs.filter((x) => besokt.includes(x.id)).map((x) => (
                <div key={x.id} hidden={x.id !== valgt}>
                  <Registrering dokumentId={x.id} filnavn={x.filnavn} aktiv={x.id === valgt} />
                </div>
              ))}
              {d && !canWrite && (
                <Panel className="h-fit p-5 text-sm text-muted-foreground">Du har lesetilgang i dette firmaet og kan ikke bokføre. Be en eier eller administrator om tilgang som regnskapsfører.</Panel>
              )}
            </div>
            {d && <DokumentViser key={d.id} path={d.path} mime={d.mime} filnavn={d.filnavn} className="h-[70dvh] min-w-0 md:h-full" />}
          </div>
        )}
      </div>
    </>
  );
}

/** Rask føring av ett dokument: hva, beløp, dato – resten foreslås. */
function Registrering({ dokumentId, filnavn, aktiv }: { dokumentId: string; filnavn: string; aktiv: boolean }) {
  const { company } = useCompany();
  const qc = useQueryClient();
  const { data: kontoer = [] } = useAccounts();
  const { data: historikk = [] } = useTidligereBilag();
  const [type, setType] = useState<HendelseType>("kjop");
  const [kjop, setKjop] = useState("kontor");
  const [sats, setSats] = useState(25);
  const [fra, setFra] = useState("1920");
  const [belop, setBelop] = useState("");
  const [dato_, setDato] = useState(idag());
  const [tekst, setTekst] = useState(filnavn.replace(/\.[a-z0-9]+$/i, "").replace(/[_-]+/g, " "));
  const [egne, setEgne] = useState<HLinje[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [lest, setLest] = useState<LestBilag | null>(null);
  const [leser, setLeser] = useState(false);
  const les = useServerFn(lesBilag);
  const b = Number(belop.replace(/\s/g, "").replace(",", "."));
  const forslag = forslagFraHistorikk(tekst, historikk);

  async function lesDokument() {
    setLeser(true);
    try {
      const r = await les({ data: { dokumentId } });
      setLest(r);
      const navn = [r.leverandor, r.beskrivelse].filter(Boolean).join(" – ");
      if (navn || r.fakturanr) setTekst(`${navn || "Faktura"}${r.fakturanr ? ` (faktura ${r.fakturanr})` : ""}`);
      if (r.belop_inkl_mva) setBelop(String(r.belop_inkl_mva).replace(".", ","));
      if (r.fakturadato && /^\d{4}-\d{2}-\d{2}$/.test(r.fakturadato)) setDato(r.fakturadato);
      if (r.type) setType(r.type);
      if (r.mva_sats != null && [0, 12, 15, 25].includes(r.mva_sats)) setSats(r.mva_sats);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLeser(false);
    }
  }
  useEffect(() => { void lesDokument(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [ki, setKi] = useState<KiKontoforslag | null>(null);
  const [kiLaster, setKiLaster] = useState(false);
  const foreslaa = useServerFn(foreslaaKontoKi);
  async function hentKiForslag() {
    setKiLaster(true);
    try {
      const r = await foreslaa({ data: { dokumentId } });
      setKi(r);
      setEgne(null);
      setType(r.type);
      setSats(r.mva_sats);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setKiLaster(false);
    }
  }

  const linjer: HLinje[] = egne
    ? skalerLinjer(egne, b)
    : byggHendelse({
        type,
        belop: b,
        tekst,
        firmatype: company.company_type === "as" ? "as" : "enk",
        mvaRegistrert: company.mva_registrert,
        kjopstype: kjop,
        sats,
        betaltFra: fra,
        ...(ki && ki.type === type ? { konto: ki.konto } : {}),
      }).map((l) => ({ ...l, mva_kode: l.mva_kode || null }));
  const funn = kontrollerBilag({
    dato: dato_,
    idag: idag(),
    beskrivelse: tekst,
    linjer: linjer.map((l) => ({ ...l, mva_kode: l.mva_kode ?? "" })),
    kontoer,
    mvaRegistrert: company.mva_registrert,
    laastTil: company.laast_til,
  });
  const feil = funn.find((f) => f.alvor === "feil");

  async function lagre(bokfor: boolean) {
    if (!b) { toast.error("Skriv inn beløpet fra kvitteringen"); return; }
    if (bokfor && feil) { toast.error(feil.tekst); return; }
    setBusy(true);
    try {
      const { data: v, error } = await supabase.from("vouchers").insert({ company_id: company.id, dato: dato_, beskrivelse: tekst, kilde: "mottak" }).select("id").single();
      if (error) throw error;
      const { error: e2 } = await supabase.from("voucher_lines").insert(
        linjer.map((l, i) => ({ voucher_id: v.id, company_id: company.id, konto: l.konto, tekst: l.tekst, debet: l.debet, kredit: l.kredit, mva_kode: l.mva_kode, linjenr: i })),
      );
      if (e2) { await supabase.from("vouchers").delete().eq("id", v.id); throw e2; }
      const { error: e3 } = await supabase.from("documents").update({ voucher_id: v.id }).eq("id", dokumentId);
      if (e3) throw e3;
      if (bokfor) {
        const { data: nr, error: e4 } = await supabase.rpc("post_voucher", { _voucher: v.id });
        if (e4) throw e4;
        toast.success(`Bilag ${nr} er bokført`, { action: { label: "Vis", onClick: () => window.location.assign(`/app/bilag/${v.id}`) } });
      } else toast.success("Lagret som utkast");
      qc.invalidateQueries();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!aktiv) return;
    const tast = (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void lagre(true); }
    };
    window.addEventListener("keydown", tast);
    return () => window.removeEventListener("keydown", tast);
  });

  return (
    <Panel className="h-fit space-y-4 p-5">
      <div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-xs">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 font-medium text-primary"><Sparkles className="h-3.5 w-3.5" /> {leser ? "Leser bilaget …" : lest ? "Hentet fra bilaget – kontroller før bokføring" : "Les fakturadata fra bilaget"}</span>
          {!leser && <button className="text-primary underline" onClick={() => void lesDokument()}>{lest ? "Les på nytt" : "Les"}</button>}
        </div>
        {lest && (
          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 text-muted-foreground">
            {lest.leverandor && <><dt>Leverandør</dt><dd className="text-foreground">{lest.leverandor}</dd></>}
            {lest.fakturanr && <><dt>Fakturanr.</dt><dd className="font-mono text-foreground">{lest.fakturanr}</dd></>}
            {lest.fakturadato && <><dt>Fakturadato</dt><dd className="text-foreground">{dato(lest.fakturadato)}</dd></>}
            {lest.forfallsdato && <><dt>Forfall</dt><dd className="text-foreground">{dato(lest.forfallsdato)}</dd></>}
            {lest.kid && <><dt>KID</dt><dd className="font-mono text-foreground">{lest.kid}</dd></>}
            {lest.mva_belop != null && <><dt>MVA</dt><dd className="text-foreground">{kr(lest.mva_belop)}</dd></>}
          </dl>
        )}
      </div>
      <div className="rounded-md border p-3 text-xs">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium">Konto og mva</span>
          <Button size="sm" variant="outline" disabled={kiLaster} onClick={() => void hentKiForslag()}>
            <Sparkles /> {kiLaster ? "Vurderer …" : ki ? "Foreslå på nytt" : "Foreslå med KI"}
          </Button>
        </div>
        {ki && (
          <div className="mt-2 space-y-1">
            <div className="text-sm">
              <span className="font-mono">{ki.konto}</span> {ki.kontonavn} · {ki.mva_behandling}
              <span className="ml-1 text-muted-foreground">({Math.round(ki.sikkerhet * 100)} % sikker)</span>
            </div>
            <p className="text-muted-foreground">{ki.begrunnelse}</p>
            <button className="text-muted-foreground underline" onClick={() => setKi(null)}>Ikke bruk forslaget</button>
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1.5">
          <Label>Hva er dette?</Label>
          <Input aria-label="Hva er dette?" value={tekst} onChange={(e) => { setTekst(e.target.value); setEgne(null); }} placeholder="F.eks. Telenor mobil oktober" />
          {forslag.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {forslag.map((f) => (
                <button
                  key={f.bilag.id}
                  onClick={() => { setEgne(f.bilag.linjer); if (!b) setBelop(String(f.belop)); }}
                  className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition ${egne === f.bilag.linjer ? "border-primary bg-primary text-primary-foreground" : "border-primary/30 bg-primary/5 text-primary hover:bg-primary/10"}`}
                >
                  <Sparkles className="h-3 w-3" /> Som sist: {f.bilag.linjer.filter((l) => l.debet).map((l) => l.konto).join(" + ")} · {kr(f.belop)}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="space-y-1.5"><Label>Beløp inkl. mva</Label><Input aria-label="Beløp inkl. mva" className="num text-lg" inputMode="decimal" value={belop} onChange={(e) => setBelop(e.target.value)} placeholder="0,00" /></div>
        <div className="space-y-1.5"><Label>Dato</Label><Input type="date" value={dato_} onChange={(e) => setDato(e.target.value)} /></div>
        {!egne && (
          <>
            <div className="col-span-2 space-y-1.5">
              <Label>Type</Label>
              <div className="grid grid-cols-2 gap-1.5">
                {([["kjop", "Kjøp / utgift"], ["salg", "Salg"]] as const).map(([k, n]) => (
                  <button key={k} onClick={() => setType(k)} className={`rounded-md border px-3 py-2 text-sm ${type === k ? "border-primary bg-primary/5 font-medium" : "hover:bg-muted"}`}>{n}</button>
                ))}
              </div>
            </div>
            {type === "kjop" && !ki && (
              <div className="col-span-2 space-y-1.5">
                <Label>Hva kjøpte du?</Label>
                <select className={`${selectCls} w-full`} value={kjop} onChange={(e) => { setKjop(e.target.value); setSats(KJOPSTYPER.find((k) => k.id === e.target.value)?.sats ?? 25); }}>
                  {KJOPSTYPER.map((k) => <option key={k.id} value={k.id}>{k.navn}</option>)}
                </select>
              </div>
            )}
            {company.mva_registrert && (
              <div className="space-y-1.5">
                <Label>MVA</Label>
                <select className={`${selectCls} w-full`} value={sats} onChange={(e) => setSats(Number(e.target.value))}>
                  <option value={25}>25 %</option><option value={15}>15 %</option><option value={12}>12 %</option><option value={0}>{type === "kjop" ? "Ingen fradrag" : "0 %"}</option>
                </select>
              </div>
            )}
            {type === "kjop" && (
              <div className="space-y-1.5">
                <Label>Betalt med</Label>
                <select className={`${selectCls} w-full`} value={fra} onChange={(e) => setFra(e.target.value)}>
                  {BETALT_FRA.map((f) => <option key={f.konto} value={f.konto}>{f.konto === "1920" ? "Firmakonto" : "Privat utlegg"}</option>)}
                </select>
              </div>
            )}
          </>
        )}
        {egne && (
          <button className="col-span-2 text-left text-xs text-muted-foreground underline" onClick={() => setEgne(null)}>Velg kontering selv i stedet</button>
        )}
      </div>

      {b > 0 && (
        <div className="rounded-md bg-muted/50 p-3 text-sm">
          {linjer.map((l, i) => (
            <div key={i} className="flex justify-between gap-2 py-0.5">
              <span className="truncate"><span className="font-mono">{l.konto}</span> <span className="text-muted-foreground">{kontoer.find((k) => k.number === l.konto)?.name}</span></span>
              <span className="num shrink-0">{l.debet ? kr(l.debet) : `−${kr(l.kredit)}`}</span>
            </div>
          ))}
        </div>
      )}
      {funn.length > 0 && b > 0 && (
        <ul className="space-y-1 text-xs">
          {funn.map((f, i) => <li key={i} className={f.alvor === "feil" ? "text-destructive" : "text-[oklch(0.45_0.1_70)]"}>{f.tekst}</li>)}
        </ul>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link to="/app/bilag/ny" className="text-xs text-muted-foreground hover:underline">Mer avansert føring</Link>
        <div className="flex gap-2">
          <Button variant="outline" disabled={busy || !b} onClick={() => lagre(false)}>Utkast</Button>
          <Button disabled={busy || !b || !!feil} onClick={() => lagre(true)}>Bokfør</Button>
        </div>
      </div>
      <p className="text-right text-[11px] text-muted-foreground">Ctrl/⌘ + Enter bokfører og går til neste</p>
    </Panel>
  );
}
