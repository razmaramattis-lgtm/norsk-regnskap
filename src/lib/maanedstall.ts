export const MAANEDER = [
  "jan",
  "feb",
  "mar",
  "apr",
  "mai",
  "jun",
  "jul",
  "aug",
  "sep",
  "okt",
  "nov",
  "des",
];

export type Maanedstall = { maaned: string; inntekt: number; kostnad: number; resultat: number };

/**
 * Driftsinntekter (3xxx) og driftskostnader (4xxx–7xxx) per måned i ett år, fra bokførte linjer.
 * Finansposter og årsoppgjør (8xxx) er holdt utenfor, så grafen viser driften.
 */
export function maanedstall(
  linjer: { konto: string; debet: number; kredit: number; dato: string }[],
  aar: number,
): Maanedstall[] {
  const ut = MAANEDER.map((maaned) => ({ maaned, inntekt: 0, kostnad: 0, resultat: 0 }));
  for (const l of linjer) {
    if (Number(l.dato.slice(0, 4)) !== aar) continue;
    const m = ut[Number(l.dato.slice(5, 7)) - 1];
    const k = Number(l.konto);
    if (!m) continue;
    if (k >= 3000 && k < 4000) m.inntekt += l.kredit - l.debet;
    else if (k >= 4000 && k < 8000) m.kostnad += l.debet - l.kredit;
  }
  for (const m of ut) m.resultat = m.inntekt - m.kostnad;
  return ut;
}
