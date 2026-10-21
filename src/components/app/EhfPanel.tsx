import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { Download, Send } from "lucide-react";
import type { Company } from "@/lib/company";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Panel, StatusPill } from "@/components/app/ui";
import { byggEhfFaktura, validerEhf, type EhfInput } from "@/lib/integrasjoner/ehf";
import { erKlarTilSending } from "@/lib/integrasjoner/send";
import { filnavn, lastNed } from "@/lib/nedlasting";

type Kunde = {
  navn: string;
  org_nr: string | null;
  adresse: string | null;
  postnr: string | null;
  poststed: string | null;
  land: string;
};
type Linje = {
  beskrivelse: string;
  antall: number | string;
  enhetspris: number | string;
  mva_sats: number | string;
};
export type EhfFaktura = {
  fakturanr: number | null;
  fakturadato: string;
  forfallsdato: string;
  kid: string | null;
  merknad: string | null;
  netto: number | string;
  mva: number | string;
  total: number | string;
  er_kreditnota?: boolean | null;
  kreditnota_for?: string | null;
  customers: Kunde | null;
  invoice_lines: Linje[];
};

/** E-faktura (EHF / Peppol BIS Billing 3.0): kontroll, nedlasting av XML og sending når en leverandør er koblet på. */
export function EhfPanel({ faktura, company }: { faktura: EhfFaktura; company: Company }) {
  const [referanse, setReferanse] = useState("");
  const k = faktura.customers;
  const kreditnota = !!faktura.er_kreditnota;
  const { data: opprinnelig } = useQuery({
    queryKey: ["invoice-original-nr", faktura.kreditnota_for],
    enabled: kreditnota && !!faktura.kreditnota_for,
    queryFn: async () =>
      (
        await supabase
          .from("invoices")
          .select("fakturanr")
          .eq("id", faktura.kreditnota_for!)
          .single()
      ).data?.fakturanr ?? null,
  });
  if (!k) return null;

  // Kreditnotaer lagres med negative tall; Peppol Credit Note bruker positive beløp.
  const fortegn = kreditnota ? -1 : 1;
  const input: EhfInput = {
    type: kreditnota ? "kreditnota" : "faktura",
    opprinneligFakturanr: opprinnelig ?? null,
    fakturanr: faktura.fakturanr ?? "",
    fakturadato: faktura.fakturadato,
    forfallsdato: faktura.forfallsdato,
    selger: {
      navn: company.name,
      orgNr: company.org_nr ?? "",
      adresse: company.adresse,
      postnr: company.postnr,
      poststed: company.poststed,
      mvaRegistrert: company.mva_registrert,
    },
    kjoper: {
      navn: k.navn,
      orgNr: k.org_nr ?? "",
      adresse: k.adresse,
      postnr: k.postnr,
      poststed: k.poststed,
      land: k.land,
    },
    linjer: faktura.invoice_lines.map((l) => ({
      beskrivelse: l.beskrivelse,
      antall: Number(l.antall) * fortegn,
      enhetspris: Number(l.enhetspris),
      mvaSats: Number(l.mva_sats),
    })),
    kid: faktura.kid,
    kontonummer: company.kontonummer,
    kjopersReferanse: referanse,
    merknad: faktura.merknad,
    lagretTotal: {
      netto: Number(faktura.netto) * fortegn,
      mva: Number(faktura.mva) * fortegn,
      total: Number(faktura.total) * fortegn,
    },
  };
  const funn = validerEhf(input);
  const feil = funn.filter((f) => f.alvor === "feil");
  const adv = funn.filter((f) => f.alvor === "advarsel");

  async function sendPeppol() {
    const klar = await erKlarTilSending(company.id, "peppol");
    if (!klar.klar) {
      toast.info(klar.grunn ?? "Peppol er ikke klart.");
      return;
    }
    toast.error("Sending via Peppol er ikke implementert ennå.");
  }

  return (
    <Panel className="mb-6 p-5 print:hidden">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg">E-faktura (EHF / Peppol)</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {kreditnota ? "Kreditnotaen" : "Fakturaen"} kan lastes ned som Peppol BIS Billing 3.0
            {kreditnota ? " Credit Note" : ""}. Sending via Peppol krever en aksesspunkt-leverandør.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={feil.length > 0}
            onClick={() =>
              lastNed(
                `${filnavn(`${kreditnota ? "kreditnota" : "faktura"}-${faktura.fakturanr ?? "uten-nr"}`)}.xml`,
                byggEhfFaktura(input),
              )
            }
          >
            <Download /> Last ned XML
          </Button>
          <Button onClick={sendPeppol}>
            <Send /> Send via Peppol
          </Button>
        </div>
      </div>

      <div className="mt-4 grid max-w-md gap-1.5">
        <Label htmlFor="kjopersref">Kjøpers referanse (påkrevd av offentlige kjøpere)</Label>
        <Input
          id="kjopersref"
          value={referanse}
          onChange={(e) => setReferanse(e.target.value)}
          placeholder="F.eks. bestillingsnr. eller innkjøpers navn"
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        {feil.length === 0 && adv.length === 0 ? (
          <StatusPill tone="ok">Klar for sending</StatusPill>
        ) : null}
        {feil.length > 0 && <StatusPill tone="bad">{feil.length} feil må rettes</StatusPill>}
        {adv.length > 0 && <StatusPill tone="warn">{adv.length} å vurdere</StatusPill>}
      </div>
      {funn.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm">
          {funn.map((f, i) => (
            <li
              key={i}
              className={f.alvor === "feil" ? "text-destructive" : "text-muted-foreground"}
            >
              • {f.melding}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-xs text-muted-foreground">
        Dokumentet følger Peppol BIS Billing 3.0 men er ikke validert mot offisielle
        Schematron-regler ennå. Test sammen med aksesspunkt-leverandøren før produksjon.{" "}
        <Link to="/app/integrasjoner" className="text-primary hover:underline">
          Velg leverandør
        </Link>
      </p>
    </Panel>
  );
}
