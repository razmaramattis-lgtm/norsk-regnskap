/**
 * Anleggsmidler og skattemessig saldoavskrivning (skatteloven kap. 14, § 14-40 flg.).
 *
 * Satsene og grensene under er hentet fra Sticos (inntektsår 2024/2025) og må kontrolleres mot
 * Skatteetaten for det aktuelle inntektsåret før de brukes i en skattemelding.
 *
 * Forenklinger: hele året avskrives uansett anskaffelsesdato (som i skatteloven for saldogrupper);
 * negativ saldo inntektsføres med minst 20 % (§ 14-44) og her akkurat 20 %, med mulighet for å velge mer;
 * særregler (f.eks. nedskrivning, skattefri omdanning, bygg under oppføring) er ikke støttet.
 */

export type Saldogruppe = "a" | "b" | "c" | "d" | "e" | "f" | "g" | "h" | "i" | "j";

export type GruppeInfo = {
  sats: number;
  navn: string;
  /** Felles saldo for gruppen (true), eller egen saldo per driftsmiddel/bygg (false). */
  felles: boolean;
  /** Standard balansekonto i NS 4102-malen. */
  konto: string;
  avskrivningskonto: "6000" | "6010";
};

export const SALDOGRUPPER: Record<Saldogruppe, GruppeInfo> = {
  a: {
    sats: 30,
    navn: "Kontormaskiner o.l.",
    felles: true,
    konto: "1280",
    avskrivningskonto: "6010",
  },
  b: {
    sats: 20,
    navn: "Ervervet forretningsverdi (goodwill)",
    felles: true,
    konto: "1080",
    avskrivningskonto: "6010",
  },
  c: {
    sats: 20,
    navn: "Lastebil, buss, varebil, drosje m.m.",
    felles: true,
    konto: "1230",
    avskrivningskonto: "6010",
  },
  d: {
    sats: 20,
    navn: "Personbil, maskiner, inventar, verktøy",
    felles: true,
    konto: "1250",
    avskrivningskonto: "6010",
  },
  e: {
    sats: 14,
    navn: "Skip, fartøy, rigger",
    felles: false,
    konto: "1200",
    avskrivningskonto: "6010",
  },
  f: {
    sats: 12,
    navn: "Fly og helikopter",
    felles: false,
    konto: "1200",
    avskrivningskonto: "6010",
  },
  g: {
    sats: 5,
    navn: "Kraftoverføring og -distribusjon m.m.",
    felles: false,
    konto: "1200",
    avskrivningskonto: "6010",
  },
  h: {
    sats: 4,
    navn: "Bygg og anlegg, hotell, losji og serveringssteder",
    felles: false,
    konto: "1200",
    avskrivningskonto: "6000",
  },
  i: { sats: 2, navn: "Forretningsbygg", felles: false, konto: "1200", avskrivningskonto: "6000" },
  j: {
    sats: 10,
    navn: "Tekniske installasjoner i bygg",
    felles: false,
    konto: "1200",
    avskrivningskonto: "6000",
  },
};

/** Driftsmiddel under denne kostprisen kan kostnadsføres direkte (eller har brukstid under 3 år). */
export const GRENSE_DIREKTE_KOSTNADSFORING = 30_000;
/** Minste årlige inntektsføring av negativ saldo (§ 14-44). */
export const MIN_INNTEKTSFORING_PROSENT = 20;

export type Anleggsmiddel = {
  id: string;
  navn: string;
  saldogruppe: Saldogruppe;
  /** ISO-dato (YYYY-MM-DD). */
  anskaffet: string;
  anskaffelseskost: number;
  /** ISO-dato for salg/utrangering. */
  solgt?: string | null;
  salgssum?: number | null;
};

export type SaldoRad = {
  /** Nøkkel: gruppebokstav for felles saldo, ellers «gruppe:id». */
  nokkel: string;
  gruppe: Saldogruppe;
  navn: string;
  sats: number;
  ib: number;
  tilgang: number;
  avgang: number;
  /** Saldo før årets avskrivning (IB + tilgang − avgang). */
  saldoFoer: number;
  /** Årets avskrivning (positivt tall, fradrag). */
  avskrivning: number;
  /** Årets inntektsføring av negativ saldo (positivt tall, inntekt). */
  inntektsforing: number;
  /** Utgående saldo. Negativ saldo er ikke inntektsført ennå og tas med videre. */
  ub: number;
  /** Utgående saldo er under grensen og kan kostnadsføres (positiv restsaldo). */
  kanKostnadsforeRest: boolean;
};

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const aarAv = (d: string) => Number(d.slice(0, 4));

export function kanKostnadsfores(kostpris: number, brukstidAar?: number): boolean {
  return kostpris < GRENSE_DIREKTE_KOSTNADSFORING || (brukstidAar !== undefined && brukstidAar < 3);
}

const nokkelFor = (m: Anleggsmiddel) =>
  SALDOGRUPPER[m.saldogruppe].felles ? m.saldogruppe : `${m.saldogruppe}:${m.id}`;

/**
 * Beregner saldoutviklingen til og med `aar` for alle driftsmidler. Starter i første anskaffelsesår og
 * ruller saldoen år for år, slik at inngående saldo alltid stemmer med tidligere års avskrivninger.
 *
 * `inntektsforingProsent` kan settes høyere enn 20 for å inntektsføre negativ saldo raskere.
 */
export function beregnSaldo(
  midler: Anleggsmiddel[],
  aar: number,
  inntektsforingProsent: number = MIN_INNTEKTSFORING_PROSENT,
): SaldoRad[] {
  if (inntektsforingProsent < MIN_INNTEKTSFORING_PROSENT || inntektsforingProsent > 100)
    throw new Error(`Inntektsføring må være mellom ${MIN_INNTEKTSFORING_PROSENT} og 100 %`);
  const relevante = midler.filter((m) => aarAv(m.anskaffet) <= aar);
  if (!relevante.length) return [];

  const forsteAar = Math.min(...relevante.map((m) => aarAv(m.anskaffet)));
  const navn = new Map<string, { gruppe: Saldogruppe; navn: string }>();
  for (const m of relevante) {
    const g = SALDOGRUPPER[m.saldogruppe];
    navn.set(nokkelFor(m), {
      gruppe: m.saldogruppe,
      navn: g.felles
        ? `Gruppe ${m.saldogruppe.toUpperCase()} ${g.navn}`
        : `${m.navn} (gruppe ${m.saldogruppe.toUpperCase()})`,
    });
  }

  const ibForAar = new Map<string, number>();
  let siste: SaldoRad[] = [];

  for (let y = forsteAar; y <= aar; y++) {
    siste = [];
    for (const [nokkel, info] of navn) {
      const g = SALDOGRUPPER[info.gruppe];
      const i = nokkel.includes(":") ? nokkel.slice(nokkel.indexOf(":") + 1) : null;
      const medlemmer = relevante.filter(
        (m) => nokkelFor(m) === nokkel && (i === null || m.id === i),
      );
      const ib = ibForAar.get(nokkel) ?? 0;
      const tilgang = r2(
        medlemmer
          .filter((m) => aarAv(m.anskaffet) === y)
          .reduce((s, m) => s + m.anskaffelseskost, 0),
      );
      const avgang = r2(
        medlemmer
          .filter((m) => m.solgt && aarAv(m.solgt) === y)
          .reduce((s, m) => s + (m.salgssum ?? 0), 0),
      );
      const saldoFoer = r2(ib + tilgang - avgang);
      let avskrivning = 0;
      let inntektsforing = 0;
      if (saldoFoer > 0) avskrivning = r2((saldoFoer * g.sats) / 100);
      else if (saldoFoer < 0) inntektsforing = r2((-saldoFoer * inntektsforingProsent) / 100);
      const ub = r2(saldoFoer - avskrivning + inntektsforing);
      ibForAar.set(nokkel, ub);
      siste.push({
        nokkel,
        gruppe: info.gruppe,
        navn: info.navn,
        sats: g.sats,
        ib,
        tilgang,
        avgang,
        saldoFoer,
        avskrivning,
        inntektsforing,
        ub,
        kanKostnadsforeRest: ub > 0 && ub < GRENSE_DIREKTE_KOSTNADSFORING,
      });
    }
  }
  // Skjul rader som er helt uten bevegelse eller saldo i valgt år.
  return siste
    .filter((r) => r.ib || r.tilgang || r.avgang || r.ub || r.avskrivning || r.inntektsforing)
    .sort((a, b) => a.gruppe.localeCompare(b.gruppe) || a.navn.localeCompare(b.navn));
}

export type AvskrivningsLinje = { konto: string; tekst: string; debet: number; kredit: number };

/**
 * Bilagsforslag for årets avskrivning (netto-metoden): debet avskrivningskonto, kredit anleggsmidlets
 * konto. Bruk `kontoFor` for å overstyre balansekonto per driftsmiddel/gruppe. Inntektsføring av negativ
 * saldo er et skattemessig forhold og føres ikke i regnskapet her.
 */
export function byggAvskrivningsbilag(
  rader: SaldoRad[],
  kontoFor: (r: SaldoRad) => string = (r) => SALDOGRUPPER[r.gruppe].konto,
): AvskrivningsLinje[] {
  const debet = new Map<string, number>();
  const kredit = new Map<string, number>();
  for (const r of rader) {
    if (r.avskrivning <= 0) continue;
    const g = SALDOGRUPPER[r.gruppe];
    debet.set(g.avskrivningskonto, r2((debet.get(g.avskrivningskonto) ?? 0) + r.avskrivning));
    const k = kontoFor(r);
    kredit.set(k, r2((kredit.get(k) ?? 0) + r.avskrivning));
  }
  return [
    ...[...debet]
      .sort()
      .map(([konto, belop]) => ({ konto, tekst: "Årets avskrivning", debet: belop, kredit: 0 })),
    ...[...kredit]
      .sort()
      .map(([konto, belop]) => ({ konto, tekst: "Årets avskrivning", debet: 0, kredit: belop })),
  ];
}

export type MaanedsRad = {
  /** Månedsnummer 1–12. */
  maaned: number;
  /** ISO-dato for siste dag i måneden. */
  dato: string;
  linjer: AvskrivningsLinje[];
  sum: number;
};

/**
 * Fordeler årets avskrivning på tolv månedsbilag. Måned 1–11 får avskrivning/12 avrundet til
 * nærmeste øre; desember får resten, slik at summene alltid blir nøyaktig lik årsavskrivningen.
 */
export function byggMaanedsplan(
  rader: SaldoRad[],
  aar: number,
  kontoFor: (r: SaldoRad) => string = (r) => SALDOGRUPPER[r.gruppe].konto,
): MaanedsRad[] {
  const plan: MaanedsRad[] = [];
  for (let m = 1; m <= 12; m++) {
    const debet = new Map<string, number>();
    const kredit = new Map<string, number>();
    for (const r of rader) {
      if (r.avskrivning <= 0) continue;
      const perMnd = r2(r.avskrivning / 12);
      const belop = m < 12 ? perMnd : r2(r.avskrivning - perMnd * 11);
      if (belop <= 0) continue;
      const g = SALDOGRUPPER[r.gruppe];
      debet.set(g.avskrivningskonto, r2((debet.get(g.avskrivningskonto) ?? 0) + belop));
      const k = kontoFor(r);
      kredit.set(k, r2((kredit.get(k) ?? 0) + belop));
    }
    const linjer: AvskrivningsLinje[] = [
      ...[...debet].sort().map(([konto, belop]) => ({ konto, tekst: `Avskrivning ${m}/${aar}`, debet: belop, kredit: 0 })),
      ...[...kredit].sort().map(([konto, belop]) => ({ konto, tekst: `Avskrivning ${m}/${aar}`, debet: 0, kredit: belop })),
    ];
    plan.push({
      maaned: m,
      dato: new Date(Date.UTC(aar, m, 0)).toISOString().slice(0, 10),
      linjer,
      sum: r2(linjer.reduce((s, l) => s + l.debet, 0)),
    });
  }
  return plan;
}

export function sumSkattemessig(rader: SaldoRad[]) {
  return {
    avskrivning: r2(rader.reduce((s, r) => s + r.avskrivning, 0)),
    inntektsforing: r2(rader.reduce((s, r) => s + r.inntektsforing, 0)),
    ub: r2(rader.reduce((s, r) => s + r.ub, 0)),
  };
}
