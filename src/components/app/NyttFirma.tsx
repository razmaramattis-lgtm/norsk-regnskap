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

export function NyttFirma({ onDone }: { onDone?: () => void }) {
  const qc = useQueryClient();
  const [navn, setNavn] = useState("");
  const [org, setOrg] = useState("");
  const [type, setType] = useState<"as" | "enk">("as");
  const [mva, setMva] = useState(true);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (org && !gyldigOrgNr(org)) return toast.error("Ugyldig organisasjonsnummer");
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("companies")
      .insert({ name: navn, org_nr: org.replace(/\s/g, "") || null, company_type: type, mva_registrert: mva, created_by: u.user!.id })
      .select("id")
      .single();
    setBusy(false);
    if (error) return toast.error(error.message);
    setActiveCompanyId(data.id);
    await qc.invalidateQueries();
    toast.success("Firmaet er opprettet med standard kontoplan (NS 4102).");
    onDone?.();
  }

  return (
    <form onSubmit={submit} className="space-y-5">
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
      <div className="space-y-1.5">
        <Label htmlFor="org">Organisasjonsnummer</Label>
        <Input id="org" value={org} onChange={(e) => setOrg(e.target.value)} placeholder="9 siffer" />
      </div>
      <label className="flex items-center justify-between rounded-md border p-3">
        <span>
          <span className="block text-sm font-medium">Registrert i Merverdiavgiftsregisteret</span>
          <span className="text-xs text-muted-foreground">Påkrevd når omsetningen passerer 50 000 kr på 12 måneder</span>
        </span>
        <Switch checked={mva} onCheckedChange={setMva} />
      </label>
      <Button type="submit" className="w-full" disabled={busy}>Opprett firma</Button>
    </form>
  );
}
