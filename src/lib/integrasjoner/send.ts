import { supabase } from "@/integrations/supabase/client";
import { harAdapter, hentAdapter, type InnsendingResultat, type Miljo } from "./adapter";
import type { DomeneId } from "./domener";

/**
 * Eneste inngang for å sende noe ut av Fjordbok. Sjekker at integrasjonen er satt opp og aktiv,
 * og at en adapter faktisk finnes for valgt leverandør. Uten det feiler kallet tydelig.
 *
 * NB: Ekte leverandøradaptere trenger hemmeligheter (nøkler, sertifikater) og MÅ kjøres på serveren
 * (server function/edge function), aldri i nettleseren. Denne funksjonen er der kallet flyttes når
 * første leverandør kobles på.
 */
export async function hentIntegrasjon(companyId: string, domene: DomeneId) {
  const { data, error } = await supabase
    .from("integrations")
    .select("*")
    .eq("company_id", companyId)
    .eq("domene", domene)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export type KlarSjekk = { klar: boolean; grunn?: string };

export async function erKlarTilSending(companyId: string, domene: DomeneId): Promise<KlarSjekk> {
  const i = await hentIntegrasjon(companyId, domene);
  if (!i || !i.leverandor || i.status === "ikke_valgt")
    return { klar: false, grunn: "Ingen leverandør er valgt. Gå til Integrasjoner." };
  if (i.status !== "aktiv" && i.status !== "testmodus")
    return { klar: false, grunn: "Integrasjonen er ikke slått på ennå." };
  if (!harAdapter(domene, i.leverandor))
    return { klar: false, grunn: `Støtte for ${i.leverandor} er ikke bygget ennå.` };
  return { klar: true };
}

export async function adapterForFirma<D extends DomeneId>(companyId: string, domene: D) {
  const i = await hentIntegrasjon(companyId, domene);
  return hentAdapter(domene, {
    leverandor: i?.leverandor ?? null,
    konfig: (i?.konfig ?? {}) as Record<string, unknown>,
    miljo: (i?.miljo ?? "test") as Miljo,
  });
}

export type { InnsendingResultat };
