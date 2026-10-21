/**
 * Fakturabeløp regnet likt som `send_invoice` i databasen: linjebeløp avrundes per linje etter rabatt,
 * og mva regnes per sats av summen for satsen. Da stemmer forhåndsvisningen med det som bokføres.
 */

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export type FLinje = { antall: number; enhetspris: number; rabatt_prosent?: number; mva_sats: number };

export function linjeNetto(l: FLinje): number {
  return r2(l.antall * l.enhetspris * (1 - (l.rabatt_prosent ?? 0) / 100));
}

export function fakturaSummer(linjer: FLinje[], mvaRegistrert: boolean) {
  const perSats = new Map<number, number>();
  for (const l of linjer) perSats.set(l.mva_sats, r2((perSats.get(l.mva_sats) ?? 0) + linjeNetto(l)));
  let netto = 0;
  let mva = 0;
  for (const [sats, n] of perSats) {
    netto = r2(netto + n);
    if (mvaRegistrert && sats > 0) mva = r2(mva + r2((n * sats) / 100));
  }
  return { netto, mva, total: r2(netto + mva), perSats };
}

export type Intervall = "maaned" | "kvartal" | "halvaar" | "aar";
export const INTERVALLER: Record<Intervall, { navn: string; mnd: number }> = {
  maaned: { navn: "Hver måned", mnd: 1 },
  kvartal: { navn: "Hvert kvartal", mnd: 3 },
  halvaar: { navn: "Hvert halvår", mnd: 6 },
  aar: { navn: "Hvert år", mnd: 12 },
};

/** Neste fakturadato. Dag 29–31 flyttes til siste dag i måneden når den ikke finnes. */
export function nesteDato(dato: string, intervall: Intervall): string {
  const [y, m, d] = dato.split("-").map(Number) as [number, number, number];
  const tot = m - 1 + INTERVALLER[intervall].mnd;
  const ny = { y: y + Math.floor(tot / 12), m: (tot % 12) + 1 };
  const siste = new Date(Date.UTC(ny.y, ny.m, 0)).getUTCDate();
  return `${ny.y}-${String(ny.m).padStart(2, "0")}-${String(Math.min(d, siste)).padStart(2, "0")}`;
}

/** Hvor mye som gjenstår, og om fakturaen er betalt (øreavrunding regnes som betalt). */
export function restbelop(total: number, innbetalt: number) {
  const rest = r2(total - innbetalt);
  return { rest, betalt: Math.abs(rest) < 0.5 };
}

/** Norsk enhet til UN/ECE rec. 20-kode for EHF. Ukjent enhet blir «stk» (C62). */
export function enhetskode(enhet: string | null | undefined): string {
  const e = (enhet ?? "").trim().toLowerCase().replace(/\.$/, "");
  const k: Record<string, string> = {
    stk: "C62", "": "C62", time: "HUR", timer: "HUR", t: "HUR", dag: "DAY", dager: "DAY", d: "DAY",
    mnd: "MON", måned: "MON", måneder: "MON", km: "KMT", kg: "KGM", l: "LTR", liter: "LTR", m: "MTR", m2: "MTK", pakke: "PK",
  };
  return k[e] ?? "C62";
}
