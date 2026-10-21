import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { setActiveCompanyId } from "@/lib/company";
import { gyldigOrgNr } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { BrregKnapp } from "@/components/app/BrregKnapp";
import type { Enhet } from "@/lib/brreg";

export function NyttFirma({ onDone }: { onDone?: () => void }) {
  const qc = useQueryClient();
  const [navn, setNavn] = useState("");
  const [org, setOrg] = useState("");
  const [type, setType] = useState<"as" | "enk">("as");
  const [mva, setMva] = useState(true);
  const [termin, setTermin] = useState<"tomaaned" | "aarlig">("tomaaned");
  const [adresse, setAdresse] = useState({ adresse: "", postnr: "", poststed: "" });
  const [konto, setKonto] = useState("");
  const [busy, setBusy] = useState(false);

  function fyllFra(e: Enhet) {
    setNavn(e.navn);
    if (e.organisasjonsform === "ENK") setType("enk");
    else if (e.organisasjonsform === "AS") setType("as");
    if (e.mvaRegistrert !== null) setMva(e.mvaRegistrert);
    setAdresse({ adresse: e.adresse, postnr: e.postnr, poststed: e.poststed });
    toast.success("Hentet fra Enhetsregisteret. Kontroller før du oppretter.");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (org && !gyldigOrgNr(org)) { toast.error("Ugyldig organisasjonsnummer"); return; }
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("companies")
      .insert({
        name: navn,
        org_nr: org.replace(/\s/g, "") || null,
        company_type: type,
        mva_registrert: mva,
        mva_termin: termin,
        adresse: adresse.adresse || null,
        postnr: adresse.postnr || null,
        poststed: adresse.poststed || null,
        kontonummer: konto.replace(/[\s.]/g, "") || null,
        created_by: u.user!.id,
      })
      .select("id")
      .single();
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setActiveCompanyId(data.id);
    await qc.invalidateQueries();
    toast.success("Firmaet er opprettet med standard kontoplan (NS 4102).");
    onDone?.();
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="org">Organisasjonsnummer</Label>
          <BrregKnapp orgNr={org} onFunnet={fyllFra} />
        </div>
        <Input id="org" value={org} onChange={(e) => setOrg(e.target.value)} placeholder="9 siffer – vi henter resten" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {(["as", "enk"] as const).map((t) => (
          <button
            type="button"
            key={t}
            onClick={() => setType(t)}
            className={`rounded-md border p-4 text-left transition-colors ${type === t ? "border-primary bg-primary/5" : "border-border"}`}
          >
            <div className="font-medium">{t === "as" ? "Aksjeselskap (AS)" : "Enkeltpersonforetak (ENK)"}</div>
            <div className="mt-1 text-xs text-muted-foreground">{t === "as" ? "Aksjekapital, utbytte, skattemelding for AS" : "Privatuttak, næringsoppgave"}</div>
          </button>
        ))}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="fn">Firmanavn</Label>
        <Input id="fn" value={navn} onChange={(e) => setNavn(e.target.value)} required />
      </div>
      <label className="flex items-center justify-between rounded-md border p-3">
        <span>
          <span className="block text-sm font-medium">Registrert i Merverdiavgiftsregisteret</span>
          <span className="text-xs text-muted-foreground">Påkrevd når omsetningen passerer 50 000 kr på 12 måneder</span>
        </span>
        <Switch checked={mva} onCheckedChange={setMva} />
      </label>
      {mva && (
        <div className="grid grid-cols-2 gap-2">
          {(["tomaaned", "aarlig"] as const).map((t) => (
            <button
              type="button"
              key={t}
              onClick={() => setTermin(t)}
              className={`rounded-md border p-3 text-left text-sm transition-colors ${termin === t ? "border-primary bg-primary/5" : "border-border"}`}
            >
              <div className="font-medium">{t === "tomaaned" ? "Seks terminer i året" : "Årstermin"}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {t === "tomaaned" ? "Vanlig. MVA-melding annenhver måned" : "Etter søknad, når omsetningen er under 1 mill. kr"}
              </div>
            </button>
          ))}
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="konto">Kontonummer for innbetalinger</Label>
        <Input id="konto" value={konto} onChange={(e) => setKonto(e.target.value)} placeholder="Står på fakturaene" />
      </div>
      <Button type="submit" className="w-full" disabled={busy}>Opprett firma</Button>
    </form>
  );
}
