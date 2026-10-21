import { useState } from "react";
import { toast } from "sonner";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { hentEnhet, BrregFeil, type Enhet } from "@/lib/brreg";

/** Henter navn og adresse fra Enhetsregisteret. Fyller kun ut; brukeren kontrollerer og lagrer selv. */
export function BrregKnapp({ orgNr, onFunnet }: { orgNr: string; onFunnet: (e: Enhet) => void }) {
  const [busy, setBusy] = useState(false);
  async function slaaOpp() {
    setBusy(true);
    try {
      const e = await hentEnhet(orgNr);
      if (!e) {
        toast.error("Fant ingen enhet med dette organisasjonsnummeret.");
        return;
      }
      if (e.slettet) toast.warning(`${e.navn} er slettet i Enhetsregisteret.`);
      else if (e.konkurs || e.underAvvikling)
        toast.warning(`${e.navn} er registrert med konkurs eller avvikling. Vær varsom.`);
      onFunnet(e);
    } catch (err) {
      toast.error(err instanceof BrregFeil ? err.message : "Oppslaget feilet.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={busy || !orgNr.trim()}
      onClick={slaaOpp}
      className="h-7 px-2 text-xs"
    >
      <Search className="h-3 w-3" /> {busy ? "Henter …" : "Hent fra Brønnøysund"}
    </Button>
  );
}
