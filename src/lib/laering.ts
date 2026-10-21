import type { Regel } from "./kontoforslag";

/**
 * Lærer kontoregler av banktransaksjoner som allerede er avstemt (manuelt eller via godkjent forslag). Er samme motpart
 * ført på samme konto minst to ganger, foreslås den kontoen neste gang. Reglene er forslag; godkjenning skjer som før.
 */

export type Historikk = {
  tekst: string;
  belop: number;
  linjer: { konto: string; debet: number; kredit: number; mva_kode: string | null }[];
};

/** Ord som sier noe om betalingsmåten, ikke hvem det gjelder. */
const STOPPORD = new Set(
  "varekjøp varekjop kortkjøp kortkjop visa mastercard bankaxept vipps nok kr betaling overføring overforing giro efaktura avtalegiro fra til reservert dato kjøp kjop kort innbetaling utbetaling ref kid faktura nettgiro straksbetaling".split(
    " ",
  ),
);

/** De to første meningsbærende ordene i teksten, eller null om teksten er for tynn. */
export function motpart(tekst: string): string[] | null {
  const ord = tekst
    .toLowerCase()
    .split(/[^a-zæøå]+/)
    .filter((o) => o.length >= 3 && !STOPPORD.has(o));
  return ord.length ? ord.slice(0, 2) : null;
}

const SATS_FOR_KODE: Record<string, number> = { "1": 25, "11": 15, "13": 12 };

/** Kostnads- eller inntektskontoen i et avstemt bilag: største linje som ikke er bank eller MVA (27xx). */
function hovedkonto(h: Historikk, bankkonto: string) {
  const kandidater = h.linjer.filter((l) => l.konto !== bankkonto && !l.konto.startsWith("27"));
  const beste = kandidater.sort((a, b) => b.debet + b.kredit - (a.debet + a.kredit))[0];
  return beste ? { konto: beste.konto, mvaSats: SATS_FOR_KODE[beste.mva_kode ?? ""] ?? 0 } : null;
}

export function laerRegler(historikk: Historikk[], bankkonto = "1920"): Regel[] {
  const grupper = new Map<
    string,
    { ord: string[]; retning: "ut" | "inn"; valg: Map<string, number> }
  >();
  for (const h of historikk) {
    const ord = motpart(h.tekst);
    const k = hovedkonto(h, bankkonto);
    if (!ord || !k || !h.belop) continue;
    const retning = h.belop < 0 ? "ut" : "inn";
    const nøkkel = `${retning}:${ord.join(" ")}`;
    const g = grupper.get(nøkkel) ?? { ord, retning, valg: new Map() };
    const v = `${k.konto}|${k.mvaSats}`;
    g.valg.set(v, (g.valg.get(v) ?? 0) + 1);
    grupper.set(nøkkel, g);
  }

  const regler: Regel[] = [];
  for (const [nøkkel, g] of grupper) {
    const totalt = [...g.valg.values()].reduce((s, n) => s + n, 0);
    const [valg, antall] = [...g.valg.entries()].sort((a, b) => b[1] - a[1])[0]!;
    // Minst to like, og ingen tydelig uenighet om kontoen.
    if (antall < 2 || antall / totalt < 0.75) continue;
    const [konto, sats] = valg.split("|");
    regler.push({
      id: `laert:${nøkkel}`,
      navn: `Som før (${antall} ganger)`,
      moenstre: [g.ord],
      konto: konto!,
      mvaSats: Number(sats),
      retning: g.retning,
      sikkerhet: Math.min(0.95, 0.8 + 0.05 * antall),
    });
  }
  return regler;
}
