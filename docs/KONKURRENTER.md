# Tripletex, Fiken og Accounted: hva Fjordbok lærer av dem

Oppsummering per 21.10.2026. Accounted-delen bygger på gjennomgangen i `docs/SVERIGE-TIL-NORGE.md`. Delene om Tripletex og
Fiken er generell produktkjennskap og er **ikke kontrollert mot leverandørenes nettsider i dag**. Priser og funksjoner
endrer seg, så sjekk dem før dere bruker dem i salg eller beslutninger.

## Kort fortalt

| | Fiken | Tripletex | Accounted | Fjordbok i dag |
| --- | --- | --- | --- | --- |
| Målgruppe | ENK og små AS som fører selv | SMB og regnskapsbyråer | Svenske småfirma og byråer, åpen kildekode | ENK/AS som fører selv, og byrå |
| Styrke | Svært enkelt, «hva har skjedd»-flyt, få valg | Bredde: prosjekt, timer, reise, lønn, moduler, API | AI-først, MCP-verktøy, konteringspakker, byrå-cockpit | Norske regler i databasen, AI foreslår og mennesket godkjenner |
| Svakhet | Lite fleksibelt for byrå og vekst | Mange menyer, bratt læringskurve | Svensk lovverk, AGPL | Mangler leverandøravtaler (Peppol, Skatteetaten, bank) og import |

## Fiken: det vi bør kopiere

- **Spør hva som skjedde, ikke hvilken konto.** «Kjøp», «Salg», «Lønn», «Overføring» i stedet for debet/kredit.
  Fjordbok har hurtigregistrering og konteringsmaler; de bør bli hovedveien, med bilagseditoren som ekspertvalg.
- **Én innboks for alt som venter.** Bank som skal avstemmes, kvitteringer uten bilag, forfalte fakturaer.
  *Gjort nå:* «Til behandling» på oversikten.
- **Kvitteringer fra mobil og e-post** (egen e-postadresse per firma). Krever OCR-leverandør, se under.
- **Bankkobling som standard**, så transaksjonene kommer inn av seg selv. Krever PSD2-leverandør.
- **Faktura som PDF på e-post med ett klikk**, og purring.
- **Ren, rolig design og få valg per side.**

## Tripletex: det vi bør kopiere

- **Globalt søk og snarveier** for folk som bruker systemet hele dagen. *Gjort nå:* ⌘K / Ctrl+K.
- **Regnskapsbyrå-funksjoner:** klientliste, oppgaver per klient, tilgangsstyring. Fjordbok har klientoversikt og
  månedsavslutning; avkrysningen bør lagres.
- **Automatisk kontering som lærer** av tidligere bilag per leverandør. Fjordbok har regelmotor (`kontoforslag.ts`);
  neste steg er å lære av godkjente forslag.
- **Prosjekt, avdeling, timer og reiseregning** som dimensjoner. Står i veikartet.
- **Åpent API og markedsplass.** Fjordbok har agentnøkler og MCP; et generelt API kommer senere.

## Accounted: det vi bør hente (ideer, ikke kode)

- **AI-agent som foreslår, menneske som godkjenner.** Fjordbok har dette (`agent_proposals`, `approve_proposal`).
- **Byrå-cockpit** med mest hastende klient først. Fjordbok har dette (`/app/klienter`).
- **Firmaform som profil** (hva firmaet kan gjøre), og **konteringspakker som data** når malene blir mange.
- **SIE-import** → hos oss **SAF-T-import**. Det største gapet for å ta over kunder fra Fiken og Tripletex.
- Accounted er AGPL. Ikke kopier kode (se `AGENTS.md`).

## Plan: brukervennlig, automatisk og pent

### Gjort i denne runden

1. **«Til behandling» på oversikten**: forfalte kunde- og leverandørfakturaer, AI-forslag, bank som skal avstemmes,
   bilagsutkast og nær frist, mest hastende først. Logikken er ren TS i `src/lib/gjoremaal.ts` med tester.
2. **Graf over inntekter og kostnader per måned** på oversikten (`src/lib/maanedstall.ts`).
3. **Søk og hurtigvalg med ⌘K / Ctrl+K**: alle sider, «Registrer bilag», «Ny faktura», «Importer kontoutskrift» og
   bytt firma.
4. **Mobil**: sidemenyen blir en skuff bak en menyknapp på små skjermer, med søk i toppen.

### Neste, uten leverandøravtale

1. **SAF-T-import** av kontoplan, kunder, leverandører og åpningsbalanse (flytting fra Fiken/Tripletex).
2. **Lær av godkjente forslag**: når et forslag for samme motpart godkjennes to ganger, lag regel automatisk.
3. **Faktura-PDF** og «send på e-post», med automatisk purring på forfalte fakturaer.
4. **Veiviser for nytt firma**: hent fra Enhetsregisteret, velg MVA-termin, importer første kontoutskrift.
5. **Fiken-lignende registrering**: «Hva har skjedd?» med kjøp/salg/overføring som førstevalg i «Registrer bilag».
6. **Lagre avkrysning i månedsavslutningen.**

### Krever leverandør eller avtale

- Bankkobling (PSD2), OCR for kvitteringer, Peppol-aksesspunkt, Maskinporten for MVA-melding og a-melding.
  Alt går gjennom adapterne i `src/lib/integrasjoner/adapter.ts`.
