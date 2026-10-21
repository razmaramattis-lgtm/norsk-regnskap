import type { DomeneId } from "./domener";

/**
 * Leverandøruavhengige kontrakter. Fjordbok skriver mot disse grensesnittene;
 * en konkret leverandør implementerer dem senere uten at resten av appen endres.
 */

export type IntegrasjonStatus = "ikke_valgt" | "konfigurert" | "testmodus" | "aktiv" | "feil";
export type Miljo = "test" | "produksjon";

export type Valideringsfeil = { felt?: string; melding: string; alvor: "feil" | "advarsel" };

export type InnsendingStatus = "mottatt" | "under_behandling" | "avvist" | "feilet";

export type InnsendingResultat = {
  status: InnsendingStatus;
  /** Leverandørens eller myndighetens referanse (f.eks. innsendings-ID). */
  referanse?: string;
  feil?: Valideringsfeil[];
  /** Rå kvittering lagres uendret for etterprøvbarhet. */
  kvittering?: unknown;
};

export type PeppolMottaker = { orgNr: string; navn?: string };

export interface PeppolAdapter {
  /** Er mottakeren registrert og i stand til å motta EHF/Peppol BIS 3? */
  kanMotta(mottaker: PeppolMottaker): Promise<boolean>;
  sendFaktura(ubl: string, mottaker: PeppolMottaker): Promise<InnsendingResultat>;
  hentInnkommende(): Promise<{ id: string; ubl: string; mottatt: string }[]>;
}

export type MvaMeldingGrunnlag = {
  orgNr: string;
  aar: number;
  termin: number | "aarlig";
  rader: { kode: string; grunnlag: number; avgift: number }[];
  aBetale: number;
};

export interface MvaInnsendingAdapter {
  valider(m: MvaMeldingGrunnlag): Promise<Valideringsfeil[]>;
  send(m: MvaMeldingGrunnlag): Promise<InnsendingResultat>;
  hentStatus(referanse: string): Promise<InnsendingResultat>;
}

export type AMeldingGrunnlag = {
  orgNr: string;
  aar: number;
  maaned: number;
  ansatte: {
    fnr: string;
    navn: string;
    brutto: number;
    skattetrekk: number;
    agaGrunnlag: number;
  }[];
};

export interface AMeldingAdapter {
  valider(m: AMeldingGrunnlag): Promise<Valideringsfeil[]>;
  send(m: AMeldingGrunnlag): Promise<InnsendingResultat>;
  hentStatus(referanse: string): Promise<InnsendingResultat>;
}

export interface GenerellInnsendingAdapter<T> {
  valider(m: T): Promise<Valideringsfeil[]>;
  send(m: T): Promise<InnsendingResultat>;
  hentStatus(referanse: string): Promise<InnsendingResultat>;
}

export type AdapterFor = {
  peppol: PeppolAdapter;
  mva_innsending: MvaInnsendingAdapter;
  a_melding: AMeldingAdapter;
  aarsregnskap: GenerellInnsendingAdapter<unknown>;
  skattemelding: GenerellInnsendingAdapter<unknown>;
  aksjonaerregister: GenerellInnsendingAdapter<unknown>;
  lonn_utbetaling: GenerellInnsendingAdapter<unknown>;
  bank: GenerellInnsendingAdapter<unknown>;
};

export class LeverandorMangler extends Error {
  readonly domene: DomeneId;
  constructor(domene: DomeneId) {
    super(`Ingen leverandør er valgt for «${domene}». Velg leverandør under Integrasjoner.`);
    this.name = "LeverandorMangler";
    this.domene = domene;
  }
}

const mangler = (domene: DomeneId) => async (): Promise<never> => {
  throw new LeverandorMangler(domene);
};

/** Stub som feiler tydelig til en ekte leverandør er koblet på. */
export function manglendeAdapter<D extends DomeneId>(domene: D): AdapterFor[D] {
  const f = mangler(domene);
  const stub = {
    kanMotta: f,
    sendFaktura: f,
    hentInnkommende: f,
    valider: f,
    send: f,
    hentStatus: f,
  };
  return stub as unknown as AdapterFor[D];
}

type Fabrikk<D extends DomeneId> = (konfig: Record<string, unknown>, miljo: Miljo) => AdapterFor[D];

// Registeret er bevisst løst typet internt; den typede flaten er registrerAdapter/hentAdapter.
const register = new Map<string, Map<string, Fabrikk<DomeneId>>>();

/** Brukes av leverandørmoduler for å melde seg på, f.eks. `registrerAdapter("peppol", "unimicro", fabrikk)`. */
export function registrerAdapter<D extends DomeneId>(
  domene: D,
  leverandor: string,
  fabrikk: Fabrikk<D>,
) {
  const rec = register.get(domene) ?? new Map<string, Fabrikk<DomeneId>>();
  rec.set(leverandor, fabrikk as unknown as Fabrikk<DomeneId>);
  register.set(domene, rec);
}

export function hentAdapter<D extends DomeneId>(
  domene: D,
  valg: { leverandor: string | null; konfig?: Record<string, unknown>; miljo?: Miljo },
): AdapterFor[D] {
  const fabrikk = valg.leverandor ? register.get(domene)?.get(valg.leverandor) : undefined;
  if (!fabrikk) return manglendeAdapter(domene);
  return fabrikk(valg.konfig ?? {}, valg.miljo ?? "test") as AdapterFor[D];
}

export function harAdapter(domene: DomeneId, leverandor: string | null): boolean {
  return !!(leverandor && register.get(domene)?.has(leverandor));
}
