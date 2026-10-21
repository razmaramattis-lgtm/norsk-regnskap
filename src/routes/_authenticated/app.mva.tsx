import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company";
import { mvaFrist } from "@/lib/frister";
import { erKlarTilSending } from "@/lib/integrasjoner/send";
import { kr, dato } from "@/lib/format";
import { beregnMvaMelding, byggMvaOppgjor, terminer } from "@/lib/mva";
import { PageHeader, Panel, Empty, StatusPill, usePostedLines } from "@/components/app/ui";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/app/mva")({
  head: () => ({ meta: [{ title: "MVA-melding – Fjordbok" }] }),
  component: Mva,
});

function Mva() {
  const { company, canWrite } = useCompany();
  const qc = useQueryClient();
  const nav = useNavigate();
  const aar = new Date().getFullYear();
  const [valgtAar, setAar] = useState(aar);
  const t = terminer(valgtAar, company.mva_termin);
  const [idx, setIdx] = useState(company.mva_termin === "aarlig" ? 0 : Math.floor(new Date().getMonth() / 2));
  const termin = t[Math.min(idx, t.length - 1)] ?? t[0]!;
  const { data = [], isLoading } = usePostedLines(termin.fra, termin.til);
  const m = beregnMvaMelding(data);
  const periodeNokkel = company.mva_termin === "aarlig" ? `${valgtAar}-aar` : `${valgtAar}-T${Math.min(idx, t.length - 1) + 1}`;
  const frist = mvaFrist(valgtAar, company.mva_termin === "aarlig" ? "aarlig" : Math.min(idx, t.length - 1) + 1);
  const { data: innsendinger = [] } = useQuery({
    queryKey: ["innsendinger", company.id, "mva_melding", periodeNokkel],
    queryFn: async () => (await supabase.from("innsendinger").select("id, status, referanse, sendt_at, created_at").eq("company_id", company.id).eq("type", "mva_melding").eq("periode", periodeNokkel).order("created_at", { ascending: false })).data ?? [],
  });
  const { data: utkastIPerioden = 0 } = useQuery({
    queryKey: ["mva-utkast", company.id, termin.fra, termin.til],
    queryFn: async () => (await supabase.from("vouchers").select("id", { count: "exact", head: true }).eq("company_id", company.id).eq("status", "utkast").gte("dato", termin.fra).lte("dato", termin.til)).count ?? 0,
  });
  const sendt = innsendinger.find((i) => i.status === "sendt" || i.status === "mottatt");
  const klar = innsendinger.find((i) => i.status === "klar");

  async function lagreKlar() {
    const payload = { orgNr: company.org_nr, aar: valgtAar, termin: periodeNokkel, fra: termin.fra, til: termin.til, rader: m.rader.filter((r) => r.grunnlag || r.avgift).map((r) => ({ kode: r.kode, grunnlag: r.grunnlag, avgift: r.avgift })), utgaende: m.utgaende, inngaende: m.inngaende, aBetale: m.aBetale, beregnet: new Date().toISOString() };
    const { error } = klar
      ? await supabase.from("innsendinger").update({ payload }).eq("id", klar.id)
      : await supabase.from("innsendinger").insert({ company_id: company.id, domene: "mva_innsending", type: "mva_melding", periode: periodeNokkel, status: "klar", payload });
    if (error) { toast.error(error.message); return; }
    toast.success("Meldingen er lagret som klar til innsending");
    qc.invalidateQueries({ queryKey: ["innsendinger"] });
  }

  const oppgjor = byggMvaOppgjor(data);

  async function lagOppgjorsbilag() {
    const { data: v, error } = await supabase
      .from("vouchers")
      .insert({ company_id: company.id, dato: termin.til, beskrivelse: `MVA-oppgjør ${termin.navn} ${valgtAar}`, kilde: "mva_oppgjor" })
      .select("id")
      .single();
    if (error) { toast.error(error.message); return; }
    const { error: e2 } = await supabase.from("voucher_lines").insert(
      oppgjor.map((l, i) => ({ voucher_id: v.id, company_id: company.id, konto: l.konto, tekst: l.tekst, debet: l.debet, kredit: l.kredit, linjenr: i })),
    );
    if (e2) { await supabase.from("vouchers").delete().eq("id", v.id); toast.error(e2.message); return; }
    toast.success("Oppgjørsbilag opprettet som utkast. Kontroller og bokfør.");
    qc.invalidateQueries();
    nav({ to: "/app/bilag/$id", params: { id: v.id } });
  }

  async function sendInn() {
    const k = await erKlarTilSending(company.id, "mva_innsending");
    if (!k.klar) { toast.info(k.grunn ?? "Innsending er ikke klar."); return; }
    toast.error("Innsending til Skatteetaten er ikke implementert ennå.");
  }

  if (!company.mva_registrert) {
    return (
      <>
        <PageHeader title="MVA-melding" />
        <Panel><Empty>Firmaet er ikke registrert i Merverdiavgiftsregisteret. Endre dette under «Firma og brukere».</Empty></Panel>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="MVA-melding"
        sub={`${termin.navn} · ${dato(termin.fra)}–${dato(termin.til)} · frist 10. i andre måned etter terminen`}
        actions={
          <>
            <select className="h-9 rounded-md border border-input bg-card px-2 text-sm" value={valgtAar} onChange={(e) => setAar(Number(e.target.value))}>
              {[aar - 2, aar - 1, aar, aar + 1].map((y) => <option key={y}>{y}</option>)}
            </select>
            <select className="h-9 rounded-md border border-input bg-card px-2 text-sm" value={idx} onChange={(e) => setIdx(Number(e.target.value))}>
              {t.map((x, i) => <option key={x.navn} value={i}>{x.navn}</option>)}
            </select>
          </>
        }
      />
      <Panel>
        {isLoading ? <Empty>Laster …</Empty> : (
          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="px-4 py-3">Kode</th><th className="px-4 py-3">Beskrivelse</th><th className="px-4 py-3 text-right">Grunnlag</th><th className="px-4 py-3 text-right">Avgift</th></tr>
            </thead>
            <tbody>
              {m.rader.map((r) => (
                <tr key={r.kode} className={`border-b ${r.grunnlag || r.avgift ? "" : "text-muted-foreground"}`}>
                  <td className="px-4 py-3 font-mono">{r.kode}</td>
                  <td className="px-4 py-3">{r.navn}</td>
                  <td className="num px-4 py-3">{kr(r.grunnlag)}</td>
                  <td className="num px-4 py-3">{kr(r.avgift)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-muted/50">
              <tr><td colSpan={3} className="px-4 py-2">Sum utgående avgift</td><td className="num px-4 py-2">{kr(m.utgaende)}</td></tr>
              <tr><td colSpan={3} className="px-4 py-2">Sum fradragsberettiget inngående avgift</td><td className="num px-4 py-2">− {kr(m.inngaende)}</td></tr>
              <tr className="border-t text-base font-semibold">
                <td colSpan={3} className="px-4 py-3">{m.aBetale >= 0 ? "Å betale" : "Til gode"}</td>
                <td className="num px-4 py-3">{kr(Math.abs(m.aBetale))}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </Panel>
      <Panel className="mt-6 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg">MVA-oppgjør</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {oppgjor.length
                ? `Nuller ut utgående og inngående MVA mot oppgjørskonto 2740 (${m.aBetale >= 0 ? "skyldig" : "til gode"} ${kr(Math.abs(m.aBetale))}). Betalingen føres deretter mot bank.`
                : "Ingen åpne MVA-saldoer i perioden, eller oppgjøret er allerede bokført."}
            </p>
          </div>
          {canWrite && <Button variant="outline" disabled={!oppgjor.length} onClick={lagOppgjorsbilag}>Opprett oppgjørsbilag</Button>}
        </div>
      </Panel>
      <Panel className="mt-6 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg">Innsending</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Frist: <span className="font-medium text-foreground">{dato(frist.dato)}</span>
              {frist.dato !== frist.opprinnelig && ` (flyttet fra ${dato(frist.opprinnelig)})`}. Meldingen leveres foreløpig i Altinn; direkte innsending krever{" "}
              <Link to="/app/integrasjoner" className="text-primary hover:underline">valg av leverandør</Link>.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {sendt ? <StatusPill tone="ok">Sendt {sendt.referanse ? `· ${sendt.referanse}` : ""}</StatusPill> : klar ? <StatusPill tone="info">Klar til innsending</StatusPill> : <StatusPill tone="muted">Ikke forberedt</StatusPill>}
          </div>
        </div>
        {utkastIPerioden > 0 && <p className="mt-3 text-sm text-destructive">{utkastIPerioden} bilag i perioden står som utkast og er ikke med i tallene.</p>}
        {canWrite && !sendt && (
          <div className="mt-4 flex gap-2">
            <Button variant="outline" onClick={lagreKlar}>{klar ? "Oppdater klart grunnlag" : "Lagre som klar"}</Button>
            <Button onClick={sendInn}><Send /> Send til Skatteetaten</Button>
          </div>
        )}
      </Panel>
      <p className="mt-4 text-xs text-muted-foreground">
        Tallene er hentet fra bokførte bilag med MVA-kode i perioden. Kontroller mot oppgjørskonto 2740 og leverandørenes MVA før innsending.
      </p>
    </>
  );
}
