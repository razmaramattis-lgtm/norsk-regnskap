import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleAlert, CircleCheck, Paperclip, Plus, Scale, Trash2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company";
import { dato as visDato, kr, idag } from "@/lib/format";
import { MVA_KODER, OMVENDT_KODER, INNGAENDE_KONTO, byggOmvendtAvgift, splittBrutto } from "@/lib/mva";
import { KATEGORI_NAVN, bruk, malerFor } from "@/lib/bokforingsmaler";
import { BETALT_FRA, HENDELSER, KJOPSTYPER, byggHendelse, type HendelseType } from "@/lib/hendelser";
import { useAccounts, Panel } from "./ui";
import { lastOppDokument } from "./Vedlegg";
import { differanse, kontrollerBilag } from "@/lib/bilagskontroll";
import { forslagFraHistorikk, skalerLinjer } from "@/lib/hukommelse";
import { useTidligereBilag } from "./hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type EditLinje = { konto: string; tekst: string; debet: string; kredit: string; mva_kode: string };

const tom_ = (): EditLinje => ({ konto: "", tekst: "", debet: "", kredit: "", mva_kode: "" });

export function BilagEditor({
  voucherId,
  initial,
}: {
  voucherId?: string;
  initial?: { dato: string; beskrivelse: string; linjer: EditLinje[] };
}) {
  const { company } = useCompany();
  const { data: kontoer = [] } = useAccounts();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [dato, setDato] = useState(initial?.dato ?? idag());
  const [beskr, setBeskr] = useState(initial?.beskrivelse ?? "");
  const [linjer, setLinjer] = useState<EditLinje[]>(initial?.linjer ?? [tom_(), tom_()]);
  const [busy, setBusy] = useState(false);

  // Tidligere føringer med samme tekst
  const { data: historikk = [] } = useTidligereBilag();
  const forslag = voucherId ? [] : forslagFraHistorikk(beskr, historikk);
  function brukForslag(f: (typeof forslag)[number]) {
    const b = Number(hBelop.replace(/\s/g, "").replace(",", ".")) || f.belop;
    setLinjer(
      skalerLinjer(f.bilag.linjer, b).map((l) => ({
        konto: l.konto,
        tekst: l.tekst ?? "",
        debet: l.debet ? String(l.debet) : "",
        kredit: l.kredit ? String(l.kredit) : "",
        mva_kode: l.mva_kode ?? "",
      })),
    );
    toast.success("Samme kontering som sist. Kontroller beløpet og bokfør.");
  }

  // Hva har skjedd?
  const [hType, setHType] = useState<HendelseType>("kjop");
  const [hBelop, setHBelop] = useState("");
  const [hKjop, setHKjop] = useState("kontor");
  const [hSats, setHSats] = useState(25);
  const [hFra, setHFra] = useState("1920");
  const [hTil, setHTil] = useState("1950");

  function lagFraHendelse() {
    const b = Number(hBelop.replace(/\s/g, "").replace(",", "."));
    if (!b || b <= 0) { toast.error("Skriv inn beløp"); return; }
    const navn = HENDELSER.find((h) => h.id === hType)!.navn;
    const tekst = beskr.trim() || (hType === "kjop" ? KJOPSTYPER.find((k) => k.id === hKjop)!.navn : navn);
    const ls = byggHendelse({
      type: hType,
      belop: b,
      tekst,
      firmatype: company.company_type === "as" ? "as" : "enk",
      mvaRegistrert: company.mva_registrert,
      kjopstype: hKjop,
      sats: hSats,
      betaltFra: hFra,
      tilKonto: hTil,
    });
    setLinjer(ls.map((l) => ({ konto: l.konto, tekst: l.tekst, debet: l.debet ? String(l.debet) : "", kredit: l.kredit ? String(l.kredit) : "", mva_kode: l.mva_kode })));
    if (!beskr.trim()) setBeskr(tekst);
    toast.success("Posteringer laget – kontroller og bokfør.");
  }

  // Hurtigutgift
  const [brutto, setBrutto] = useState("");
  const [kostKonto, setKostKonto] = useState("6800");
  const [sats, setSats] = useState(25);
  const [betaltFra, setBetaltFra] = useState("1920");

  // Konteringsmal
  const [malId, setMalId] = useState("");
  const [malBelop, setMalBelop] = useState("");
  const maler = malerFor(company.company_type === "as" ? "as" : "enk");
  const valgtMal = maler.find((m) => m.id === malId);

  function lagFraMal() {
    if (!valgtMal) { toast.error("Velg en mal"); return; }
    const b = Number(malBelop.replace(",", "."));
    if (!b) { toast.error("Skriv inn beløp"); return; }
    setLinjer(bruk(valgtMal, b).map((p) => ({ konto: p.konto, tekst: p.tekst, debet: p.debet ? String(p.debet) : "", kredit: p.kredit ? String(p.kredit) : "", mva_kode: "" })));
    if (!beskr.trim()) setBeskr(valgtMal.navn);
    toast.success("Posteringer laget – kontroller og bokfør.");
  }

  // Kjøp fra utlandet (omvendt avgiftsplikt)
  const [uBelop, setUBelop] = useState("");
  const [uKode, setUKode] = useState("86");
  const [uKonto, setUKonto] = useState("6800");
  const [uMot, setUMot] = useState("2400");

  function lagFraUtlandet() {
    const b = Number(uBelop.replace(",", "."));
    if (!b || b <= 0) { toast.error("Skriv inn beløp uten mva"); return; }
    if (!company.mva_registrert) { toast.error("Firmaet er ikke mva-registrert. Omvendt avgiftsplikt krever registrering."); return; }
    const ls = byggOmvendtAvgift(b, uKode, uKonto, uMot);
    setLinjer(ls.map((l) => ({ konto: l.konto, tekst: l.tekst, debet: l.debet ? String(l.debet) : "", kredit: l.kredit ? String(l.kredit) : "", mva_kode: l.mva_kode ?? "" })));
    if (!beskr.trim()) setBeskr("Kjøp fra utlandet");
    toast.success("Posteringer laget – kontroller og bokfør.");
  }

  const sumD = linjer.reduce((s, l) => s + Number(l.debet || 0), 0);
  const sumK = linjer.reduce((s, l) => s + Number(l.kredit || 0), 0);
  const balanse = Math.round((sumD - sumK) * 100) / 100;
  const kLinjer = linjer.map((l) => ({ konto: l.konto, debet: Number(l.debet || 0), kredit: Number(l.kredit || 0), mva_kode: l.mva_kode }));
  const funn = kontrollerBilag({
    dato,
    idag: idag(),
    beskrivelse: beskr,
    linjer: kLinjer,
    kontoer,
    mvaRegistrert: company.mva_registrert,
    laastTil: company.laast_til,
  });
  const harFeil = funn.some((f) => f.alvor === "feil");

  // Mulig duplikat: et annet bokført bilag samme dag med samme sum
  const { data: duplikat } = useQuery({
    queryKey: ["duplikat", company.id, dato, Math.round(sumD * 100)],
    enabled: sumD > 0 && !!dato,
    queryFn: async () => {
      const { data } = await supabase
        .from("vouchers")
        .select("id, bilagsnr, beskrivelse, voucher_lines(debet)")
        .eq("company_id", company.id)
        .eq("dato", dato)
        .eq("status", "bokfort");
      return (data ?? []).find((v) => v.id !== voucherId && Math.abs(v.voucher_lines.reduce((x, l) => x + Number(l.debet), 0) - sumD) < 0.005) ?? null;
    },
  });

  function fyllDifferanse() {
    const d = differanse(kLinjer);
    if (!d) return;
    const tom = linjer.findIndex((l) => !Number(l.debet) && !Number(l.kredit));
    const ny = { debet: d < 0 ? String(-d) : "", kredit: d > 0 ? String(d) : "" };
    setLinjer((ls) => (tom >= 0 ? ls.map((l, i) => (i === tom ? { ...l, ...ny } : l)) : [...ls, { ...tom_(), ...ny }]));
  }

  // Vedlegg valgt før bilaget er lagret, lastes opp når bilaget får id
  const [ventende, setVentende] = useState<File[]>([]);
  const filRef = useRef<HTMLInputElement>(null);

  // Ctrl/⌘ + Enter bokfører når bilaget er uten feil
  const lagreRef = useRef<(b: boolean) => void>(() => {});
  useEffect(() => {
    const tast = (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        lagreRef.current(true);
      }
    };
    window.addEventListener("keydown", tast);
    return () => window.removeEventListener("keydown", tast);
  }, []);

  const set = (i: number, k: keyof EditLinje, v: string) =>
    setLinjer((ls) => ls.map((l, j) => (j === i ? { ...l, [k]: v, ...(k === "konto" ? { mva_kode: kontoer.find((a) => a.number === v)?.mva_kode ?? l.mva_kode } : {}) } : l)));

  function lagFraUtgift() {
    const b = Number(brutto.replace(",", "."));
    if (!b) { toast.error("Skriv inn beløp"); return; }
    const mvaOk = company.mva_registrert && sats > 0;
    const { netto, mva } = mvaOk ? splittBrutto(b, sats) : { netto: b, mva: 0 };
    const ink = INNGAENDE_KONTO[sats] ?? { konto: "2710", kode: "1" };
    const ls: EditLinje[] = [
      { konto: kostKonto, tekst: beskr, debet: String(netto), kredit: "", mva_kode: mvaOk ? ink.kode : "" },
    ];
    if (mvaOk) ls.push({ konto: ink.konto, tekst: `Inngående mva ${sats} %`, debet: String(mva), kredit: "", mva_kode: ink.kode });
    ls.push({ konto: betaltFra, tekst: beskr, debet: "", kredit: String(b), mva_kode: "" });
    setLinjer(ls);
    toast.success("Posteringer laget – kontroller og bokfør.");
  }

  async function lagre(bokfor: boolean) {
    if (!beskr.trim()) { toast.error("Legg inn en beskrivelse"); return; }
    if (bokfor && harFeil) { toast.error(funn.find((f) => f.alvor === "feil")!.tekst); return; }
    const rader = linjer.filter((l) => l.konto && (Number(l.debet) || Number(l.kredit)));
    for (const r of rader) if (!kontoer.find((a) => a.number === r.konto)) { toast.error(`Konto ${r.konto} finnes ikke i kontoplanen`); return; }
    setBusy(true);
    try {
      let id = voucherId;
      if (id) {
        const { error } = await supabase.from("vouchers").update({ dato, beskrivelse: beskr }).eq("id", id);
        if (error) throw error;
        await supabase.from("voucher_lines").delete().eq("voucher_id", id);
      } else {
        const { data, error } = await supabase.from("vouchers").insert({ company_id: company.id, dato, beskrivelse: beskr }).select("id").single();
        if (error) throw error;
        id = data.id;
      }
      if (rader.length) {
        const { error } = await supabase.from("voucher_lines").insert(
          rader.map((r, i) => ({
            voucher_id: id!,
            company_id: company.id,
            konto: r.konto,
            tekst: r.tekst || null,
            debet: Number(r.debet || 0),
            kredit: Number(r.kredit || 0),
            mva_kode: r.mva_kode || null,
            linjenr: i,
          })),
        );
        if (error) throw error;
      }
      for (const fil of ventende) await lastOppDokument(company.id, fil, { voucher_id: id! });
      if (ventende.length) setVentende([]);
      if (bokfor) {
        const { data: nr, error } = await supabase.rpc("post_voucher", { _voucher: id! });
        if (error) throw error;
        toast.success(`Bilag ${nr} er bokført`);
      } else toast.success("Utkast lagret");
      qc.invalidateQueries();
      nav({ to: "/app/bilag/$id", params: { id: id! } });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  lagreRef.current = (b) => { if (!busy) void lagre(b); };

  return (
    <div className="space-y-6">
      <Panel className="grid gap-4 p-6 md:grid-cols-[180px_1fr]">
        <div className="space-y-1.5">
          <Label>Bilagsdato</Label>
          <Input type="date" value={dato} onChange={(e) => setDato(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Beskrivelse</Label>
          <Input list="tidligere-tekster" value={beskr} onChange={(e) => setBeskr(e.target.value)} placeholder="F.eks. Kontorrekvisita fra Staples" />
          <datalist id="tidligere-tekster">
            {[...new Set(historikk.map((h) => h.beskrivelse))].slice(0, 200).map((t) => <option key={t} value={t} />)}
          </datalist>
          {forslag.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
              <span className="text-muted-foreground">Ført før:</span>
              {forslag.map((f) => (
                <button
                  key={f.bilag.id}
                  type="button"
                  onClick={() => brukForslag(f)}
                  className="rounded-full border border-primary/30 bg-primary/5 px-2.5 py-1 text-primary transition hover:bg-primary/10"
                >
                  {f.bilag.linjer.filter((l) => l.debet).map((l) => l.konto).join(" + ")} · {kr(f.belop)} · {visDato(f.bilag.dato)}
                  {f.antall > 1 ? ` (${f.antall}×)` : ""}
                </button>
              ))}
            </div>
          )}
        </div>
      </Panel>

      <Tabs defaultValue={initial ? "manuell" : "hendelse"}>
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="hendelse">Hva har skjedd?</TabsTrigger>
          <TabsTrigger value="utgift">Kjøp / utgift</TabsTrigger>
          <TabsTrigger value="utland">Kjøp fra utlandet</TabsTrigger>
          <TabsTrigger value="mal">Fra mal</TabsTrigger>
          <TabsTrigger value="manuell">Posteringer</TabsTrigger>
        </TabsList>
        <TabsContent value="hendelse">
          <Panel className="space-y-5 p-6">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              {HENDELSER.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => {
                    setHType(h.id);
                    setHSats(h.id === "kjop" ? (KJOPSTYPER.find((k) => k.id === hKjop)?.sats ?? 25) : 25);
                  }}
                  className={`rounded-md border p-3 text-left transition-colors ${hType === h.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
                >
                  <div className="text-sm font-medium">{h.navn}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{h.tekst}</div>
                </button>
              ))}
            </div>
            <div className="grid items-end gap-4 md:grid-cols-4">
              <div className="space-y-1.5">
                <Label>{hType === "kjop" || hType === "salg" ? "Beløp inkl. mva" : "Beløp"}</Label>
                <Input className="num" value={hBelop} onChange={(e) => setHBelop(e.target.value)} placeholder="0,00" />
              </div>
              {hType === "kjop" && (
                <div className="space-y-1.5">
                  <Label>Hva kjøpte du?</Label>
                  <select className="h-9 w-full rounded-md border border-input bg-card px-2 text-sm" value={hKjop} onChange={(e) => { setHKjop(e.target.value); setHSats(KJOPSTYPER.find((k) => k.id === e.target.value)?.sats ?? 25); }}>
                    {KJOPSTYPER.map((k) => <option key={k.id} value={k.id}>{k.navn}</option>)}
                  </select>
                </div>
              )}
              {(hType === "kjop" || hType === "salg") && company.mva_registrert && (
                <div className="space-y-1.5">
                  <Label>MVA</Label>
                  <select className="h-9 w-full rounded-md border border-input bg-card px-2 text-sm" value={hSats} onChange={(e) => setHSats(Number(e.target.value))}>
                    <option value={25}>25 %</option>
                    <option value={15}>15 % (mat)</option>
                    <option value={12}>12 % (transport, overnatting)</option>
                    <option value={0}>{hType === "kjop" ? "Ingen fradrag" : "0 % (fritatt)"}</option>
                  </select>
                </div>
              )}
              {hType === "kjop" && (
                <div className="space-y-1.5">
                  <Label>Betalt med</Label>
                  <select className="h-9 w-full rounded-md border border-input bg-card px-2 text-sm" value={hFra} onChange={(e) => setHFra(e.target.value)}>
                    {BETALT_FRA.map((f) => <option key={f.konto} value={f.konto}>{f.navn}</option>)}
                  </select>
                </div>
              )}
              {hType === "overforing" && (
                <>
                  <div className="space-y-1.5">
                    <Label>Fra konto</Label>
                    <KontoInput value={hFra} onChange={setHFra} kontoer={kontoer} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Til konto</Label>
                    <KontoInput value={hTil} onChange={setHTil} kontoer={kontoer} />
                  </div>
                </>
              )}
              <Button type="button" onClick={lagFraHendelse}>Lag posteringer</Button>
            </div>
            {hType === "eier_inn" && company.company_type === "as" && (
              <p className="text-sm text-muted-foreground">Penger fra eier til et AS føres som lån fra eier (2910). Kapitalforhøyelse må vedtas og registreres i Foretaksregisteret.</p>
            )}
            {hType === "eier_ut" && company.company_type === "as" && (
              <p className="text-sm text-muted-foreground">Fra et AS kan eier bare ta ut penger som lønn, utbytte eller tilbakebetaling av lån. Dette fører tilbakebetaling av lån (2910). Bruk malene for utbytte og lønnsmodulen for lønn.</p>
            )}
          </Panel>
        </TabsContent>
        <TabsContent value="utgift">
          <Panel className="grid items-end gap-4 p-6 md:grid-cols-5">
            <div className="space-y-1.5">
              <Label>Beløp inkl. mva</Label>
              <Input className="num" value={brutto} onChange={(e) => setBrutto(e.target.value)} placeholder="0,00" />
            </div>
            <div className="space-y-1.5">
              <Label>Kostnadskonto</Label>
              <KontoInput value={kostKonto} onChange={setKostKonto} kontoer={kontoer} />
            </div>
            <div className="space-y-1.5">
              <Label>MVA-sats</Label>
              <select className="h-9 w-full rounded-md border border-input bg-card px-2 text-sm" value={sats} onChange={(e) => setSats(Number(e.target.value))}>
                <option value={25}>25 % (høy)</option>
                <option value={15}>15 % (mat)</option>
                <option value={12}>12 % (transport, kino)</option>
                <option value={0}>0 % / ingen</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Betalt fra</Label>
              <KontoInput value={betaltFra} onChange={setBetaltFra} kontoer={kontoer} />
            </div>
            <Button type="button" variant="secondary" onClick={lagFraUtgift}>Lag posteringer</Button>
          </Panel>
        </TabsContent>
        <TabsContent value="utland">
          <Panel className="grid items-end gap-4 p-6 md:grid-cols-5">
            <div className="space-y-1.5">
              <Label>Beløp uten mva</Label>
              <Input className="num" value={uBelop} onChange={(e) => setUBelop(e.target.value)} placeholder="0,00" />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Type kjøp</Label>
              <select className="h-9 w-full rounded-md border border-input bg-card px-2 text-sm" value={uKode} onChange={(e) => setUKode(e.target.value)}>
                {OMVENDT_KODER.map((k) => <option key={k.kode} value={k.kode}>{k.kode} · {k.navn}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Kostnadskonto</Label>
              <KontoInput value={uKonto} onChange={setUKonto} kontoer={kontoer} />
            </div>
            <div className="space-y-1.5">
              <Label>Motkonto</Label>
              <KontoInput value={uMot} onChange={setUMot} kontoer={kontoer} />
            </div>
            <Button type="button" variant="secondary" onClick={lagFraUtlandet}>Lag posteringer</Button>
            <p className="text-sm text-muted-foreground md:col-span-5">
              Du beregner norsk mva selv på kjøp av tjenester fra utlandet og på innførsel som ikke er avgiftsbelagt ved grensen. Avgiften føres som utgående, og som inngående hvis du har fradragsrett, slik at den går i null. Velg «uten fradragsrett» bare når kjøpet ikke er til bruk i avgiftspliktig virksomhet.
            </p>
          </Panel>
        </TabsContent>
        <TabsContent value="mal">
          <Panel className="grid items-end gap-4 p-6 md:grid-cols-[1fr_180px_auto]">
            <div className="space-y-1.5">
              <Label>Mal</Label>
              <select className="h-9 w-full rounded-md border border-input bg-card px-2 text-sm" value={malId} onChange={(e) => setMalId(e.target.value)}>
                <option value="">Velg mal …</option>
                {(Object.keys(KATEGORI_NAVN) as (keyof typeof KATEGORI_NAVN)[]).map((k) => {
                  const ms = maler.filter((m) => m.kategori === k);
                  return ms.length ? <optgroup key={k} label={KATEGORI_NAVN[k]}>{ms.map((m) => <option key={m.id} value={m.id}>{m.navn}</option>)}</optgroup> : null;
                })}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Beløp</Label>
              <Input className="num" value={malBelop} onChange={(e) => setMalBelop(e.target.value)} placeholder="0,00" />
            </div>
            <Button type="button" variant="secondary" onClick={lagFraMal}>Lag posteringer</Button>
            {valgtMal && <p className="text-sm text-muted-foreground md:col-span-3">{valgtMal.beskrivelse}</p>}
          </Panel>
        </TabsContent>
        <TabsContent value="manuell" />
      </Tabs>

      <Panel>
        <table className="w-full text-sm">
          <thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Konto</th>
              <th className="px-4 py-3">Tekst</th>
              <th className="px-4 py-3">MVA-kode</th>
              <th className="px-4 py-3 text-right">Debet</th>
              <th className="px-4 py-3 text-right">Kredit</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {linjer.map((l, i) => (
              <tr key={i} className="border-b last:border-0">
                <td className="w-56 px-4 py-2"><KontoInput value={l.konto} onChange={(v) => set(i, "konto", v)} kontoer={kontoer} /></td>
                <td className="px-4 py-2"><Input value={l.tekst} onChange={(e) => set(i, "tekst", e.target.value)} /></td>
                <td className="w-44 px-4 py-2">
                  <select className="h-9 w-full rounded-md border border-input bg-card px-2 text-sm" value={l.mva_kode} onChange={(e) => set(i, "mva_kode", e.target.value)}>
                    <option value="">–</option>
                    {MVA_KODER.map((k) => <option key={k.kode} value={k.kode}>{k.kode} · {k.navn}</option>)}
                  </select>
                </td>
                <td className="w-36 px-4 py-2"><Input className="num" value={l.debet} onChange={(e) => set(i, "debet", e.target.value.replace(",", "."))} /></td>
                <td className="w-36 px-4 py-2"><Input className="num" value={l.kredit} onChange={(e) => set(i, "kredit", e.target.value.replace(",", "."))} /></td>
                <td className="w-10 pr-2">
                  <Button variant="ghost" size="icon" onClick={() => setLinjer((ls) => ls.filter((_, j) => j !== i))}><Trash2 /></Button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t bg-muted/50">
              <td className="px-4 py-3" colSpan={3}>
                <Button variant="ghost" size="sm" onClick={() => setLinjer((ls) => [...ls, tom_()])}><Plus /> Ny linje</Button>
              </td>
              <td className="num px-4 py-3">{kr(sumD)}</td>
              <td className="num px-4 py-3">{kr(sumK)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </Panel>

      <div className="space-y-1.5 text-sm">
        {funn.length === 0 && !duplikat ? (
          <div className="flex items-center gap-2 text-success"><CircleCheck className="h-4 w-4" /> Bilaget balanserer og er klart til bokføring</div>
        ) : (
          <>
            {funn.map((f, i) => (
              <div key={i} className={`flex items-start gap-2 ${f.alvor === "feil" ? "text-destructive" : "text-[oklch(0.45_0.1_70)]"}`}>
                {f.alvor === "feil" ? <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" /> : <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />} {f.tekst}
              </div>
            ))}
            {duplikat && (
              <div className="flex items-start gap-2 text-[oklch(0.45_0.1_70)]">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /> Mulig duplikat: bilag {duplikat.bilagsnr} ({duplikat.beskrivelse}) har samme dato og beløp.
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {balanse !== 0 && (
            <Button variant="outline" size="sm" onClick={fyllDifferanse}><Scale /> Fyll differanse ({kr(Math.abs(balanse))})</Button>
          )}
          {!voucherId && (
            <>
              <input
                ref={filRef}
                type="file"
                multiple
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => { setVentende((v) => [...v, ...Array.from(e.target.files ?? [])]); e.target.value = ""; }}
              />
              <Button variant="outline" size="sm" onClick={() => filRef.current?.click()}><Paperclip /> Legg ved kvittering</Button>
              {ventende.map((f, i) => (
                <span key={i} className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs">
                  {f.name}
                  <button aria-label="Fjern" onClick={() => setVentende((v) => v.filter((_, j) => j !== i))}><Trash2 className="h-3 w-3" /></button>
                </span>
              ))}
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden text-xs text-muted-foreground sm:inline">Ctrl/⌘ + Enter bokfører</span>
          <Button variant="outline" disabled={busy} onClick={() => lagre(false)}>Lagre utkast</Button>
          <Button disabled={busy || harFeil} onClick={() => lagre(true)}>Bokfør</Button>
        </div>
      </div>
    </div>
  );
}

function KontoInput({ value, onChange, kontoer }: { value: string; onChange: (v: string) => void; kontoer: { number: string; name: string }[] }) {
  const navn = kontoer.find((k) => k.number === value)?.name;
  return (
    <div>
      <Input list="kontoliste" value={value} onChange={(e) => onChange(e.target.value.split(" ")[0] ?? "")} className="font-mono" />
      <datalist id="kontoliste">
        {kontoer.map((k) => <option key={k.number} value={k.number}>{k.number} {k.name}</option>)}
      </datalist>
      {navn && <div className="mt-1 truncate text-xs text-muted-foreground">{navn}</div>}
    </div>
  );
}
