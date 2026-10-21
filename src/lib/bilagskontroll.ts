/**
 * Kontroll av bilag før bokføring. Databasen (`post_voucher`) håndhever balanse, låste perioder og kontoplan
 * uansett; dette er for å gi beskjed tidlig og forklare hva som er galt, mens brukeren skriver.
 */

export type KLinje = { konto: string; debet: number; kredit: number; mva_kode: string };
export type Funn = { alvor: "feil" | "advarsel"; tekst: string };

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function differanse(linjer: KLinje[]): number {
  return r2(linjer.reduce((s, l) => s + l.debet - l.kredit, 0));
}

export function kontrollerBilag(i: {
  dato: string;
  idag: string;
  beskrivelse: string;
  linjer: KLinje[];
  kontoer: { number: string; mva_kode: string | null }[];
  mvaRegistrert: boolean;
  laastTil?: string | null;
}): Funn[] {
  const ut: Funn[] = [];
  const feil = (tekst: string) => ut.push({ alvor: "feil", tekst });
  const adv = (tekst: string) => ut.push({ alvor: "advarsel", tekst });
  const ls = i.linjer.filter((l) => l.konto || l.debet || l.kredit);

  if (!i.beskrivelse.trim()) feil("Bilaget mangler beskrivelse.");
  if (ls.filter((l) => l.debet || l.kredit).length < 2) feil("Et bilag trenger minst to linjer med beløp.");
  const d = differanse(ls);
  if (d !== 0) feil(`Bilaget balanserer ikke: debet er ${d > 0 ? "høyere" : "lavere"} enn kredit med ${Math.abs(d).toFixed(2)}.`);
  if (i.laastTil && i.dato <= i.laastTil) feil(`Perioden er låst til og med ${i.laastTil}. Velg en senere dato eller lås opp perioden.`);

  const finnes = new Map(i.kontoer.map((k) => [k.number, k]));
  ls.forEach((l, n) => {
    const nr = `Linje ${n + 1}`;
    if (!l.konto) feil(`${nr} mangler konto.`);
    else if (!finnes.has(l.konto)) feil(`${nr}: konto ${l.konto} finnes ikke i kontoplanen.`);
    if (l.debet && l.kredit) feil(`${nr} har både debet og kredit. Bruk to linjer.`);
    if (l.debet < 0 || l.kredit < 0) adv(`${nr} har negativt beløp. Før det heller på motsatt side.`);
    if (l.konto.startsWith("27") && Number(l.konto) < 2740 && !l.mva_kode) adv(`${nr}: mva-konto ${l.konto} uten mva-kode kommer ikke med i mva-meldingen.`);
    if (l.mva_kode && !i.mvaRegistrert) adv(`${nr} har mva-kode, men firmaet er ikke mva-registrert.`);
  });

  // Kjøp ført på en konto som normalt har fradrag, uten linje for inngående mva
  if (i.mvaRegistrert && !ls.some((l) => /^271[0-2]$/.test(l.konto))) {
    const kjop = ls.find((l) => l.debet > 0 && Number(l.konto) >= 4000 && Number(l.konto) < 8000 && finnes.get(l.konto)?.mva_kode === "1" && !l.mva_kode);
    if (kjop) adv(`Konto ${kjop.konto} har vanligvis fradrag for inngående mva, men bilaget har ingen mva-linje. Stemmer det?`);
  }

  const dagerFrem = (Date.parse(i.dato) - Date.parse(i.idag)) / 86400000;
  if (dagerFrem > 31) adv("Datoen er mer enn en måned frem i tid.");
  if (i.dato.slice(0, 4) < String(Number(i.idag.slice(0, 4)) - 1)) adv("Datoen er i et tidligere regnskapsår. Er året avsluttet?");
  return ut;
}
