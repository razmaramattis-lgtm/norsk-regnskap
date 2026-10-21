# Fjordbok – veikart (norsk versjon av Accounted)

## Ferdig (fase 1)
- [x] Innlogging (e-post, Google, Lovable), flere firmaer og brukere med roller (eier/admin/regnskapsfører/leser), invitasjon på e-post
- [x] ENK og AS, NS 4102-kontoplan opprettes automatisk
- [x] Bilag: utkast, bokføring med balansekontroll og fortløpende nr, låste bilag, korreksjonsbilag
- [x] Hurtigregistrering av kjøp med inngående mva (25/15/12 %)
- [x] Kunder (org.nr-validering), utgående faktura med KID (mod10), automatisk postering, innbetaling
- [x] MVA-melding per termin (SAF-T-koder), tomånedlig/årlig
- [x] Resultat, balanse, saldobalanse, oversikt med frister

## Ferdig (fase 2)
- [x] Leverandører og inngående fakturaer med betaling (2400)
- [x] Bank: CSV-import, duplikatsjekk, avstemming mot faktura (KID) eller konto med mva
- [x] Bilagsarkiv med SHA-256 og oppbevaringsfrist, vedlegg på bilag og leverandørfaktura
- [x] Periodelåsing, årsavslutning (8800 → 2050/2080), revisjonslogg
- [x] SAF-T Financial 1.30-eksport
- [x] Lønn: ansatte, lønnskjøring, forskuddstrekk, feriepenger, OTP, AGA per sone
- [x] Kreditnota, varer/tjenester, hovedbok per konto, aldersfordelt reskontro

## Ferdig (fase 3: forberedt for leverandører)
- [x] Fristmotor med norske helligdager: MVA-terminer, a-melding, trekk/AGA, skattemelding, årsregnskap (`src/lib/frister.ts`)
- [x] Integrasjonsside med krav, kilder og leverandørvalg per tjeneste; databasevakt mot hemmeligheter i konfigurasjon
- [x] Leverandøruavhengige adaptere (Peppol, MVA, a-melding, årsregnskap, skattemelding) som feiler tydelig til en leverandør er valgt
- [x] EHF/Peppol BIS Billing 3.0-generator med validering og nedlasting fra faktura
- [x] Betalingsfil (pain.001) for leverandørbetalinger
- [x] Innsendingskø (`innsendinger`) som ikke kan endres etter sending
- [x] MVA-oppgjør: oppgjørsbilag mot 2740, og klargjøring av MVA-melding
- [x] Årsregnskap: oppstilling, sjekkliste før godkjenning og skattegrunnlag
- [x] Forslagslag for AI og regler (agent foreslår, menneske godkjenner), regelmotor for banktransaksjoner
- [x] Konteringsmaler (utbytte, privatuttak, skatt, MVA, bank m.fl.)
- [x] Oppslag i Enhetsregisteret på kunder og leverandører (uverifisert mot live-API)
- [x] Omvendt avgiftsplikt og innførsel: MVA-kodene 14, 15, 81–89 i MVA-meldingen, egen fane «Kjøp fra utlandet» i bilagseditoren (kodene bør kontrolleres mot Skatteetatens gjeldende kodeliste)
- [x] EHF kreditnota (Peppol Credit Note, type 381) fra kreditert faktura
- [x] Anleggsmidler: register, saldogrupper a–j, skattemessig saldoavskrivning, avskrivningsbilag som utkast (satser må kontrolleres for inntektsåret)
- [x] Klientoversikt for byrå (alle firmaer, mest hastende først) og månedsavslutning-sjekkliste
- [x] MCP-server (`mcp/fjordbok-mcp.mjs`) for AI-agenter, uten avhengigheter
- [x] Agentnøkler: scopede nøkler som kun kan lese kontoplan/banktransaksjoner og foreslå bilag (`docs/AI-AGENTER.md`)

## Brukervennlighet (fase 4, se `docs/KONKURRENTER.md`)
- [x] «Til behandling» på oversikten: alt som venter, mest hastende først (`src/lib/gjoremaal.ts`)
- [x] Graf over inntekter og kostnader per måned på oversikten
- [x] Søk og hurtigvalg med ⌘K / Ctrl+K (sider, oppgaver, bytt firma)
- [x] Mobilmeny
- [x] Lær kontoregler av avstemte banktransaksjoner: samme motpart to ganger på samme konto gir forslag (`src/lib/laering.ts`)
- [ ] Veiviser for nytt firma (Enhetsregisteret, MVA-termin, første kontoutskrift)
- [ ] «Hva har skjedd?»-registrering (kjøp/salg/overføring) som førstevalg

## Neste faser
- [ ] Velg og koble på leverandører: Peppol-aksesspunkt, Skatteetaten (MVA, skattemelding, a-melding), bank
- [x] SAF-T-import: kontoplan, kunder, leverandører og åpningsbalanse som utkast (`/app/import`)
- [ ] Periodiseringer, tilbud, ordre, repeterende fakturaer
- [ ] Prosjekter/avdelinger (dimensjoner), kontoregler for automatisk kontering
- [ ] Kjørebok og reiseregning
- [ ] Skattekonto-avstemming
- [ ] To-faktor-innlogging, API-nøkler
- [ ] A-melding (Altinn) – krever Maskinporten-avtale
- [ ] MVA-melding innsending via Skatteetatens API – krever Maskinporten-avtale
- [ ] Skattemelding: næringsspesifikasjon (ENK/AS), RF-1167
- [ ] Faktura-PDF og utsendelse på e-post
- [ ] Bransjeveiledere (bygg, netthandel, konsulent, restaurant, helse) tilpasset norske regler
