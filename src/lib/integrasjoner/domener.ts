/**
 * Integrasjonsdomener Fjordbok er forberedt på, og hva som kreves for å gå live.
 *
 * Ingen leverandør er valgt ennå. Hvert domene har en adapter (se `adapter.ts`)
 * som i dag er en stub som sier fra at leverandør mangler. Når en leverandør er
 * valgt implementeres adapteren, og domenet slås på per firma i `integrations`.
 *
 * Kilder (hentet 21.10.2026):
 *  - Skatteetaten, «Reetablering av Altinn – for systemleverandører»
 *  - OpenPeppol, «Norway country profile» (oppdatert 16.03.2026)
 *  - Skatteetaten, «Skattemelding for næringsdrivende»
 */

export const DOMENER = [
  "peppol",
  "mva_innsending",
  "a_melding",
  "aarsregnskap",
  "skattemelding",
  "aksjonaerregister",
  "lonn_utbetaling",
  "bank",
] as const;

export type DomeneId = (typeof DOMENER)[number];

export type KandidatLeverandor = {
  navn: string;
  /** Alle kandidater er foreløpig uverifiserte forslag; sjekk mot offisielle lister før valg. */
  verifisert: boolean;
  merknad?: string;
};

export type DomeneInfo = {
  id: DomeneId;
  navn: string;
  kort: string;
  myndighet: string;
  /** Hva som må være på plass før integrasjonen kan slås på. */
  krav: string[];
  /** Hva Fjordbok allerede gjør selv, uavhengig av leverandør. */
  klartIFjordbok: string[];
  kandidater: KandidatLeverandor[];
  kilder: { tittel: string; url: string }[];
  /** Skal fristmotoren varsle om dette domenet? */
  fristKategori?: "mva" | "lonn" | "skatt" | "regnskap" | "selskap";
};

const uverifisert = (navn: string, merknad?: string): KandidatLeverandor =>
  merknad ? { navn, verifisert: false, merknad } : { navn, verifisert: false };

export const DOMENE_INFO: Record<DomeneId, DomeneInfo> = {
  peppol: {
    id: "peppol",
    navn: "E-faktura (EHF / Peppol)",
    kort: "Send og motta elektroniske fakturaer via Peppol-nettverket.",
    myndighet: "DFØ (Peppol Authority i Norge)",
    krav: [
      "Avtale med en godkjent Peppol aksesspunkt-leverandør (Access Point). DFØ stiller egne krav til AP/SMP-leverandører.",
      "Registrering av firmaets org.nr. i ELMA/SMP slik at andre kan sende til dere.",
      "Peppol BIS Billing 3 (EHF 3.0) er påkrevd for offentlig sektor.",
    ],
    klartIFjordbok: [
      "Generering av faktura som Peppol BIS Billing 3.0 (UBL 2.1) fra utgående faktura",
      "Kontroll av pliktige felt før sending",
      "Innsendingskø med status per faktura",
    ],
    kandidater: [
      uverifisert("Unimicro"),
      uverifisert("Visma"),
      uverifisert("Pagero"),
      uverifisert("Basware"),
      uverifisert("Storecove", "Internasjonalt aksesspunkt med API"),
    ],
    kilder: [
      {
        tittel: "OpenPeppol: Norway country profile",
        url: "https://peppol.org/learn-more/country-profiles/norway/",
      },
      {
        tittel: "DFØ: Peppol i Norge",
        url: "https://anskaffelser.no/public-procurement/e-procurement/peppol",
      },
    ],
  },
  mva_innsending: {
    id: "mva_innsending",
    navn: "MVA-melding",
    kort: "Send MVA-meldingen direkte til Skatteetaten fra Fjordbok.",
    myndighet: "Skatteetaten",
    krav: [
      "System registrert i Altinn, med tilgangspakker kundene må ha.",
      "Tilgang til Skatteetatens tjenester via deres skjema for tilgang, samt akseptert bruksvilkår.",
      "Autentisering via Maskinporten og systembruker; testing i TT02 før produksjon.",
      "Altinn 2-roller fjernes senest 31.12.2026, så tilgangspakker må være på plass.",
    ],
    klartIFjordbok: [
      "Beregning av MVA-melding per termin etter SAF-T-koder",
      "Lagring av innsendt grunnlag og kvittering",
      "Avstemming mot 27xx-kontiene og oppgjørskonto 2740",
    ],
    kandidater: [
      uverifisert(
        "Direkte mot Skatteetaten",
        "Krever at Fjordbok registreres som sluttbrukersystem",
      ),
      uverifisert(
        "Mellomledd/innsendingstjeneste",
        "Fra en leverandør som allerede er godkjent sluttbrukersystem",
      ),
    ],
    kilder: [
      {
        tittel: "Skatteetaten: for systemleverandører",
        url: "https://www.skatteetaten.no/en/our-partners/reetablering-altinn/systemleverandor/",
      },
    ],
    fristKategori: "mva",
  },
  a_melding: {
    id: "a_melding",
    navn: "A-melding",
    kort: "Månedlig innrapportering av lønn og arbeidsforhold.",
    myndighet: "Skatteetaten, NAV og SSB (via Altinn)",
    krav: [
      "Levering fra system krever Maskinporten og riktige tilgangspakker i Altinn.",
      "Altinn 2-roller slutter å virke for a-melding 17. november (se Skatteetatens side for gjeldende år).",
      "Testing i TT02 før produksjon.",
    ],
    klartIFjordbok: [
      "Ansatte, lønnskjøring, forskuddstrekk, feriepenger, OTP og AGA per sone",
      "Fristmotor for 5. hver måned og betaling av trekk og AGA",
    ],
    kandidater: [
      uverifisert(
        "Direkte mot Altinn",
        "A-meldingen er et omfattende format; vurder kjøpt innsendingstjeneste først",
      ),
      uverifisert("Lønnssystem som mellomledd"),
    ],
    kilder: [
      {
        tittel: "Skatteetaten: a-melding fra system",
        url: "https://www.skatteetaten.no/en/business-and-organisation/employer/the-a-melding/submitting-the-a-melding/levering-fra-system/",
      },
    ],
    fristKategori: "lonn",
  },
  aarsregnskap: {
    id: "aarsregnskap",
    navn: "Årsregnskap",
    kort: "Innsending av årsregnskap, årsberetning og revisjonsberetning.",
    myndighet: "Brønnøysundregistrene (Regnskapsregisteret)",
    krav: [
      "Innsendingsvei og format må avklares med Brønnøysundregistrene før valg av leverandør.",
      "Signering av styret (og eventuell revisor) før innsending.",
    ],
    klartIFjordbok: [
      "Oppstilling av resultat og balanse etter regnskapslovens oppstillingsplan fra saldobalansen",
      "Størrelsesvurdering (små foretak) og kontroll av at balansen går i null",
      "Notekrav som sjekkliste",
    ],
    kandidater: [uverifisert("Innsendingstjeneste/regnskapsprogram med godkjent innsending")],
    kilder: [],
    fristKategori: "regnskap",
  },
  skattemelding: {
    id: "skattemelding",
    navn: "Skattemelding for næringsdrivende",
    kort: "Skattemelding med næringsspesifikasjon (ENK og AS).",
    myndighet: "Skatteetaten",
    krav: [
      "Innsending fra system er hovedløsningen for næringsdrivende (Skatteetaten).",
      "Registrering som sluttbrukersystem, Maskinporten og systembruker, som for MVA.",
      "Tilgang til forhåndsutfylte data (deling av data) må søkes om.",
    ],
    klartIFjordbok: [
      "Grunnlag fra regnskapet: resultat før skatt og 22 %-beregning for AS",
      "Næringsspesifikasjon-grunnlag fra saldobalanse",
      "Frist 31. mai i fristmotoren",
    ],
    kandidater: [
      uverifisert("Direkte mot Skatteetaten"),
      uverifisert("Årsoppgjørsprogram som mellomledd"),
    ],
    kilder: [
      {
        tittel: "Skatteetaten: innsending av skattemelding fra system",
        url: "https://www.skatteetaten.no/bedrift-og-organisasjon/skatt/skattemelding-naringsdrivende/innsending-av-skattemelding-fra-system-blir-hovedlosning-for-naringsdrivende/",
      },
    ],
    fristKategori: "skatt",
  },
  aksjonaerregister: {
    id: "aksjonaerregister",
    navn: "Aksjonærregisteroppgave",
    kort: "Årlig oppgave over aksjonærer og utbytte (AS).",
    myndighet: "Skatteetaten",
    krav: ["Innsendingsvei må avklares (Altinn)."],
    klartIFjordbok: ["Frist 31. januar i fristmotoren"],
    kandidater: [uverifisert("Mellomledd")],
    kilder: [],
    fristKategori: "selskap",
  },
  lonn_utbetaling: {
    id: "lonn_utbetaling",
    navn: "Betalingsfiler (pain.001)",
    kort: "Utbetalinger til leverandører og ansatte som ISO 20022-fil til nettbanken.",
    myndighet: "Bank",
    krav: [
      "Avtale om filoverføring/betalingsfil hos banken, eller opplasting manuelt i nettbanken.",
    ],
    klartIFjordbok: ["Generering av pain.001.001.03 med KID/melding og betalingsdato"],
    kandidater: [uverifisert("Opplasting manuelt i nettbank", "Fungerer uten avtale")],
    kilder: [],
  },
  bank: {
    id: "bank",
    navn: "Bankintegrasjon (åpne bank-API-er)",
    kort: "Automatisk henting av banktransaksjoner via PSD2.",
    myndighet: "Bank/Finanstilsynet",
    krav: ["Avtale med en tilbyder av kontoinformasjonstjeneste (AISP)."],
    klartIFjordbok: ["CSV-import, duplikatsjekk og avstemming mot faktura (KID)"],
    kandidater: [
      uverifisert("Enable Banking", "Brukes av Accounted for PSD2"),
      uverifisert("Neonomics"),
      uverifisert("Tink"),
    ],
    kilder: [],
  },
};

export const DOMENE_LISTE: DomeneInfo[] = DOMENER.map((d) => DOMENE_INFO[d]);
