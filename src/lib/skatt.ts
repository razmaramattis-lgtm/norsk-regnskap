/**
 * Forenklede skattegrunnlag. Dette er et beslutningsgrunnlag og forberedelse til
 * skattemeldingen, ikke et skatteoppgjør. Innsendingen gjøres via adapteren
 * `skattemelding` når en leverandør er valgt.
 */

/** Alminnelig inntektsskatt for selskaper, i prosent. Verifiser mot gjeldende år før bruk i skattemelding. */
export const SELSKAPSSKATT_SATS = 22;

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export type SkattInput = {
  resultatForSkatt: number;
  /** Positivt = ikke fradragsberettiget kostnad (legges til), negativt = skattefri inntekt (trekkes fra). */
  permanenteForskjeller?: number;
  /** Endring i midlertidige forskjeller i året (positivt øker skattepliktig inntekt). */
  endringMidlertidige?: number;
  framfortUnderskudd?: number;
  sats?: number;
};

export function beregnSelskapsskatt(i: SkattInput) {
  const sats = i.sats ?? SELSKAPSSKATT_SATS;
  const foerFremfoert = r2(
    i.resultatForSkatt + (i.permanenteForskjeller ?? 0) + (i.endringMidlertidige ?? 0),
  );
  const brukt = foerFremfoert > 0 ? Math.min(foerFremfoert, i.framfortUnderskudd ?? 0) : 0;
  const skattepliktig = r2(foerFremfoert - brukt);
  const nyttFramfortUnderskudd = r2(
    (i.framfortUnderskudd ?? 0) - brukt + (foerFremfoert < 0 ? -foerFremfoert : 0),
  );
  return {
    skattepliktigInntekt: Math.max(0, skattepliktig),
    betalbarSkatt: Math.max(0, r2((Math.max(0, skattepliktig) * sats) / 100)),
    brukttUnderskudd: r2(brukt),
    nyttFramfortUnderskudd,
    sats,
  };
}

export type Naeringsspesifikasjon = {
  driftsinntekter: number;
  driftskostnader: number;
  finansinntekter: number;
  finanskostnader: number;
  naeringsresultat: number;
  /** Utgående og inngående balanse for kontroll mot forrige års spesifikasjon. */
  sumEiendeler: number;
  sumEgenkapitalOgGjeld: number;
};

/** Grunnlag til næringsspesifikasjonen (ENK/AS) fra regnskapsoppstillingen. */
export function naeringsspesifikasjon(
  r: { driftsinntekter: number; driftskostnader: number; finansresultat: number },
  b: { sumEiendeler: number; sumEgenkapitalOgGjeld: number },
  finans: { inntekter: number; kostnader: number },
): Naeringsspesifikasjon {
  return {
    driftsinntekter: r.driftsinntekter,
    driftskostnader: r.driftskostnader,
    finansinntekter: finans.inntekter,
    finanskostnader: finans.kostnader,
    naeringsresultat: r2(r.driftsinntekter - r.driftskostnader + r.finansresultat),
    sumEiendeler: b.sumEiendeler,
    sumEgenkapitalOgGjeld: b.sumEgenkapitalOgGjeld,
  };
}
