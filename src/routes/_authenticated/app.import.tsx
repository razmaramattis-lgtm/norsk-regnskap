import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company";
import { formatOrgNr, idag, kr } from "@/lib/format";
import {
  aapningsdato,
  byggAapningsbalanse,
  lesSaft,
  type SaftImport,
  type SaftPart,
} from "@/lib/saftimport";
import {
  PageHeader,
  Panel,
  Stat,
  StatusPill,
  Th,
  theadCls,
  useAccounts,
} from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/app/import")({
  head: () => ({ meta: [{ title: "Import fra annet system – Fjordbok" }] }),
  component: Import,
});

const nøkkel = (p: { navn: string; org_nr?: string | null; orgNr?: string | null }) =>
  (p.orgNr ?? p.org_nr) || p.navn.trim().toLowerCase();

function Import() {
  const { company, canWrite } = useCompany();
  const qc = useQueryClient();
  const nav = useNavigate();
  const ref = useRef<HTMLInputElement>(null);
  const [fil, setFil] = useState<{ navn: string; data: SaftImport } | null>(null);
  const [dato, setDato] = useState(idag());
  const [jobber, setJobber] = useState(false);
  const { data: kontoer = [] } = useAccounts();
  const { data: parter } = useQuery({
    queryKey: ["import-parter", company.id],
    queryFn: async () => {
      const [k, l] = await Promise.all([
        supabase.from("customers").select("navn, org_nr").eq("company_id", company.id),
        supabase.from("suppliers").select("navn, org_nr").eq("company_id", company.id),
      ]);
      return {
        kunder: new Set((k.data ?? []).map(nøkkel)),
        leverandorer: new Set((l.data ?? []).map(nøkkel)),
      };
    },
  });

  async function velg(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try {
      const data = lesSaft(await f.text());
      setFil({ navn: f.name, data });
      setDato(aapningsdato(data.periodeSlutt, idag()));
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  const finnes = new Set(kontoer.map((k) => k.number));
  const nyeKontoer = fil?.data.kontoer.filter((k) => !finnes.has(k.nummer)) ?? [];
  const unike = (ps: SaftPart[], har: Set<string> | undefined) => {
    const sett = new Set(har);
    return ps.filter((p) => (sett.has(nøkkel(p)) ? false : (sett.add(nøkkel(p)), true)));
  };
  const nyeKunder = unike(fil?.data.kunder ?? [], parter?.kunder);
  const nyeLev = unike(fil?.data.leverandorer ?? [], parter?.leverandorer);
  const åpning = fil ? byggAapningsbalanse(fil.data.kontoer) : [];
  const feilFirma =
    fil?.data.firma.orgNr &&
    company.org_nr &&
    fil.data.firma.orgNr !== company.org_nr.replace(/\s/g, "");

  async function importer() {
    if (!fil) return;
    setJobber(true);
    try {
      const kort = (p: SaftPart) => ({
        company_id: company.id,
        navn: p.navn,
        org_nr: p.orgNr,
        adresse: p.adresse,
        postnr: p.postnr,
        poststed: p.poststed,
        land: p.land,
        epost: p.epost,
      });
      if (nyeKontoer.length) {
        const { error } = await supabase
          .from("accounts")
          .insert(
            nyeKontoer.map((k) => ({ company_id: company.id, number: k.nummer, name: k.navn })),
          );
        if (error) throw error;
      }
      if (nyeKunder.length) {
        const { error } = await supabase.from("customers").insert(nyeKunder.map(kort));
        if (error) throw error;
      }
      if (nyeLev.length) {
        const { error } = await supabase.from("suppliers").insert(nyeLev.map(kort));
        if (error) throw error;
      }
      let bilag: string | null = null;
      if (åpning.length) {
        const { data: v, error } = await supabase
          .from("vouchers")
          .insert({
            company_id: company.id,
            dato,
            beskrivelse: `Åpningsbalanse fra ${fil.navn}`,
            kilde: "saft_import",
          })
          .select("id")
          .single();
        if (error) throw error;
        const { error: e2 } = await supabase
          .from("voucher_lines")
          .insert(
            åpning.map((l, i) => ({ voucher_id: v.id, company_id: company.id, ...l, linjenr: i })),
          );
        if (e2) {
          await supabase.from("vouchers").delete().eq("id", v.id);
          throw e2;
        }
        bilag = v.id;
      }
      toast.success(
        `Importert: ${nyeKontoer.length} kontoer, ${nyeKunder.length} kunder, ${nyeLev.length} leverandører` +
          (bilag ? ". Åpningsbalansen ligger som utkast." : "."),
      );
      qc.invalidateQueries();
      setFil(null);
      if (bilag) nav({ to: "/app/bilag/$id", params: { id: bilag } });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setJobber(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Import fra annet system"
        sub="Flytt fra Fiken, Tripletex, PowerOffice eller andre med en SAF-T-fil (Financial, XML)"
        actions={
          canWrite && (
            <>
              <input
                ref={ref}
                type="file"
                accept=".xml,text/xml,application/xml"
                hidden
                onChange={velg}
              />
              <Button onClick={() => ref.current?.click()}>
                <Upload className="mr-2 h-4 w-4" /> Velg SAF-T-fil
              </Button>
            </>
          )
        }
      />
      {!fil ? (
        <Panel className="p-8 text-sm leading-relaxed text-muted-foreground">
          <h2 className="mb-3 text-xl text-foreground">Slik gjør du det</h2>
          <ol className="list-decimal space-y-1.5 pl-5">
            <li>
              Eksporter SAF-T Financial fra det gamle systemet for siste avsluttede periode (i Fiken
              og Tripletex ligger det under rapporter/eksport).
            </li>
            <li>Last opp filen her. Vi viser hva som blir lagt til før noe lagres.</li>
            <li>
              Kontoer, kunder og leverandører som mangler blir opprettet. Det som finnes fra før,
              røres ikke.
            </li>
            <li>
              Åpningsbalansen lages som et bilagsutkast. Du kontrollerer og bokfører det selv.
            </li>
          </ol>
          <p className="mt-4">
            Bilagshistorikken blir i det gamle systemet. Ta vare på eksporten og tilgangen der, for
            bokføringsloven krever at regnskapet oppbevares. Åpne kunde- og leverandørfakturaer
            flyttes som saldo på 1500/2400, ikke som enkeltposter.
          </p>
        </Panel>
      ) : (
        <>
          <div className="mb-6 flex flex-wrap items-center gap-3 text-sm">
            <span className="font-medium">{fil.navn}</span>
            <span className="text-muted-foreground">
              {fil.data.firma.navn}{" "}
              {fil.data.firma.orgNr && `· ${formatOrgNr(fil.data.firma.orgNr)}`}
            </span>
            {feilFirma && <StatusPill tone="bad">Annet org.nr enn {company.name}</StatusPill>}
          </div>
          <div className="grid gap-4 md:grid-cols-4">
            <Stat
              label="Nye kontoer"
              value={nyeKontoer.length}
              sub={`av ${fil.data.kontoer.length} i filen`}
            />
            <Stat
              label="Nye kunder"
              value={nyeKunder.length}
              sub={`av ${fil.data.kunder.length} i filen`}
            />
            <Stat
              label="Nye leverandører"
              value={nyeLev.length}
              sub={`av ${fil.data.leverandorer.length} i filen`}
            />
            <Stat label="Linjer i åpningsbalansen" value={åpning.length} />
          </div>
          <Panel className="mt-6 overflow-x-auto">
            <div className="flex flex-wrap items-end justify-between gap-4 p-5">
              <h2 className="text-xl">Åpningsbalanse</h2>
              <div className="space-y-1">
                <Label htmlFor="dato">Dato</Label>
                <Input
                  id="dato"
                  type="date"
                  value={dato}
                  onChange={(e) => setDato(e.target.value)}
                  className="w-44"
                />
              </div>
            </div>
            <table className="w-full text-sm">
              <thead className={theadCls}>
                <tr>
                  <Th>Konto</Th>
                  <Th>Tekst</Th>
                  <Th right>Debet</Th>
                  <Th right>Kredit</Th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {åpning.map((l) => (
                  <tr key={l.konto}>
                    <td className="num px-4 py-2 text-left">{l.konto}</td>
                    <td className="px-4 py-2">{l.tekst}</td>
                    <td className="num px-4 py-2">{l.debet ? kr(l.debet) : ""}</td>
                    <td className="num px-4 py-2">{l.kredit ? kr(l.kredit) : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
          <div className="mt-6 flex gap-2">
            <Button onClick={importer} disabled={jobber || !canWrite}>
              {jobber ? "Importerer …" : "Importer"}
            </Button>
            <Button variant="outline" onClick={() => setFil(null)}>
              Avbryt
            </Button>
          </div>
        </>
      )}
    </>
  );
}
