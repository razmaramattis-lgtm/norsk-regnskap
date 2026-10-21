/**
 * Deterministisk kontoforslag for banktransaksjoner. Dette er første lag i agent-flyten:
 * enkle, forklarbare regler som foreslår kontering. En språkmodell/MCP-agent kan bygge videre
 * på samme format (`Forslag`), og alt går uansett via menneskelig godkjenning.
 */

export type Regel = {
  id: string;
  navn: string;
  /** Alle ord i minst én gruppe må finnes i teksten (små bokstaver). */
  moenstre: string[][];
  konto: string;
  /** Innkjøp med fradragsberettiget inngående MVA (sats i prosent), ellers 0. */
  mvaSats: number;
  retning: "ut" | "inn";
  sikkerhet: number;
};

export const STANDARDREGLER: Regel[] = [
  {
    id: "bankgebyr",
    navn: "Bankgebyr",
    moenstre: [["gebyr"], ["kortgebyr"], ["månedsavgift"], ["maanedsavgift"]],
    konto: "7770",
    mvaSats: 0,
    retning: "ut",
    sikkerhet: 0.9,
  },
  {
    id: "rente-kost",
    navn: "Rentekostnad",
    moenstre: [["rentekostnad"], ["debetrente"], ["renter lån"]],
    konto: "8140",
    mvaSats: 0,
    retning: "ut",
    sikkerhet: 0.85,
  },
  {
    id: "rente-inn",
    navn: "Renteinntekt",
    moenstre: [["rente", "innskudd"], ["kreditrente"], ["renteinntekt"]],
    konto: "8040",
    mvaSats: 0,
    retning: "inn",
    sikkerhet: 0.85,
  },
  {
    id: "programvare",
    navn: "Programvare / abonnement",
    moenstre: [
      ["microsoft"],
      ["google", "workspace"],
      ["adobe"],
      ["fiken"],
      ["tripletex"],
      ["dropbox"],
      ["slack"],
      ["zoom"],
      ["lovable"],
      ["openai"],
      ["anthropic"],
    ],
    konto: "6552",
    mvaSats: 25,
    retning: "ut",
    sikkerhet: 0.7,
  },
  {
    id: "telefon",
    navn: "Telefon og internett",
    moenstre: [["telenor"], ["telia"], ["ice mobil"], ["onecall"], ["altibox"]],
    konto: "6900",
    mvaSats: 25,
    retning: "ut",
    sikkerhet: 0.8,
  },
  {
    id: "drivstoff",
    navn: "Drivstoff",
    moenstre: [["circle k"], ["esso"], ["shell"], ["uno-x"], ["uno x"], ["yx "], ["bunker oil"]],
    konto: "7000",
    mvaSats: 25,
    retning: "ut",
    sikkerhet: 0.75,
  },
  {
    id: "kontor",
    navn: "Kontorrekvisita",
    moenstre: [["kontorlandia"], ["staples"], ["clas ohlson"], ["jula"]],
    konto: "6800",
    mvaSats: 25,
    retning: "ut",
    sikkerhet: 0.7,
  },
  {
    id: "forsikring",
    navn: "Forsikring",
    moenstre: [["gjensidige"], ["if skadeforsikring"], ["tryg"], ["storebrand"]],
    konto: "7500",
    mvaSats: 0,
    retning: "ut",
    sikkerhet: 0.7,
  },
  {
    id: "reklame",
    navn: "Reklame",
    moenstre: [["facebook", "ads"], ["meta platforms"], ["google ads"], ["linkedin"], ["annonse"]],
    konto: "7320",
    mvaSats: 25,
    retning: "ut",
    sikkerhet: 0.7,
  },
  {
    id: "regnskap",
    navn: "Regnskaps- og rådgivningstjenester",
    moenstre: [["regnskap"], ["revisjon"], ["advokat"]],
    konto: "6700",
    mvaSats: 25,
    retning: "ut",
    sikkerhet: 0.6,
  },
  {
    id: "husleie",
    navn: "Husleie",
    moenstre: [["husleie"], ["leie lokale"]],
    konto: "6300",
    mvaSats: 0,
    retning: "ut",
    sikkerhet: 0.8,
  },
];

export type BankTx = { id?: string; dato: string; tekst: string; belop: number };

export type Forslag = {
  tittel: string;
  begrunnelse: string;
  sikkerhet: number;
  payload: {
    dato: string;
    beskrivelse: string;
    linjer: { konto: string; debet: number; kredit: number; mva_kode?: string; tekst?: string }[];
  };
  regelId: string;
};

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const INNGAENDE_KODE: Record<number, { konto: string; kode: string }> = {
  25: { konto: "2710", kode: "1" },
  15: { konto: "2711", kode: "11" },
  12: { konto: "2712", kode: "13" },
};

export function finnRegel(
  tekst: string,
  retning: "ut" | "inn",
  regler: Regel[] = STANDARDREGLER,
): Regel | null {
  const t = tekst.toLowerCase();
  let beste: Regel | null = null;
  for (const r of regler) {
    if (r.retning !== retning) continue;
    const treff = r.moenstre.some((gruppe) => gruppe.every((ord) => t.includes(ord)));
    if (treff && (!beste || r.sikkerhet > beste.sikkerhet)) beste = r;
  }
  return beste;
}

/**
 * Lager et bilagsforslag for én banktransaksjon (bankkonto 1920).
 * Returnerer null når ingen regel treffer, så ingenting gjettes.
 * MVA: bruttobeløpet splittes i netto og inngående MVA når regelen sier det.
 */
export function foreslaaForBanktransaksjon(
  tx: BankTx,
  mvaRegistrert: boolean,
  regler: Regel[] = STANDARDREGLER,
  bankkonto = "1920",
): Forslag | null {
  if (!tx.belop) return null;
  const retning = tx.belop < 0 ? "ut" : "inn";
  const regel = finnRegel(tx.tekst, retning, regler);
  if (!regel) return null;
  const brutto = Math.abs(tx.belop);

  const linjer: Forslag["payload"]["linjer"] = [];
  if (retning === "ut") {
    const sats = mvaRegistrert ? regel.mvaSats : 0;
    const inn = INNGAENDE_KODE[sats];
    if (inn) {
      const mva = r2((brutto * sats) / (100 + sats));
      linjer.push({
        konto: regel.konto,
        debet: r2(brutto - mva),
        kredit: 0,
        mva_kode: inn.kode,
        tekst: tx.tekst,
      });
      linjer.push({
        konto: inn.konto,
        debet: mva,
        kredit: 0,
        mva_kode: inn.kode,
        tekst: `Inngående MVA ${sats} %`,
      });
    } else {
      linjer.push({ konto: regel.konto, debet: brutto, kredit: 0, tekst: tx.tekst });
    }
    linjer.push({ konto: bankkonto, debet: 0, kredit: brutto, tekst: tx.tekst });
  } else {
    linjer.push({ konto: bankkonto, debet: brutto, kredit: 0, tekst: tx.tekst });
    linjer.push({ konto: regel.konto, debet: 0, kredit: brutto, tekst: tx.tekst });
  }

  // Lavere sikkerhet når MVA-behandlingen er en antakelse (brutto kan ha blandede satser).
  const sikkerhet = r2(Math.min(regel.sikkerhet, regel.mvaSats > 0 ? 0.8 : 0.95));
  return {
    tittel: `${regel.navn}: ${tx.tekst}`.slice(0, 120),
    begrunnelse: `Teksten «${tx.tekst}» treffer regelen «${regel.navn}» (konto ${regel.konto}${regel.mvaSats && mvaRegistrert ? `, inngående MVA ${regel.mvaSats} % antatt` : ""}). Kontroller at beløp og MVA stemmer med bilaget før du godkjenner.`,
    sikkerhet,
    payload: { dato: tx.dato, beskrivelse: tx.tekst, linjer },
    regelId: regel.id,
  };
}

/** Forslag for en hel liste; transaksjoner uten treff hoppes over. */
export function foreslaaForListe(
  txs: BankTx[],
  mvaRegistrert: boolean,
  regler: Regel[] = STANDARDREGLER,
) {
  const forslag: (Forslag & { txId?: string })[] = [];
  let utenTreff = 0;
  for (const tx of txs) {
    const f = foreslaaForBanktransaksjon(tx, mvaRegistrert, regler);
    if (f) forslag.push(tx.id ? { ...f, txId: tx.id } : f);
    else utenTreff++;
  }
  return { forslag, utenTreff };
}
