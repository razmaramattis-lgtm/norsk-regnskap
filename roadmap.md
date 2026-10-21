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

## Neste faser
- [ ] Anleggsmidler og avskrivninger (saldogrupper)
- [ ] Periodiseringer, tilbud, ordre, repeterende fakturaer
- [ ] Prosjekter/avdelinger (dimensjoner), kontoregler for automatisk kontering
- [ ] Kjørebok og reiseregning
- [ ] Remittering (pain.001 betalingsfil) for leverandørbetalinger
- [ ] Skattekonto-avstemming
- [ ] To-faktor-innlogging, API-nøkler
- [ ] A-melding (Altinn) – krever Maskinporten-avtale
- [ ] MVA-melding innsending via Skatteetatens API – krever Maskinporten-avtale
- [ ] Skattemelding: næringsspesifikasjon (ENK/AS), RF-1167
- [ ] EHF/Peppol e-faktura – krever aksesspunkt-leverandør
- [ ] Faktura-PDF og utsendelse på e-post
- [ ] AI-assistent / agent-tilgang (MCP) for kontering og avstemming
- [ ] Bransjeveiledere (bygg, netthandel, konsulent, restaurant, helse) tilpasset norske regler
