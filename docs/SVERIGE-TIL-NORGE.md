# Fra svensk til norsk: kartlegging av Accounted

Fjordbok er bygget med [erp-mafia/accounted](https://github.com/erp-mafia/accounted) som referanse. Accounted er svensk
regnskapsprogramvare (AGPL-3.0). **Ingen kode er kopiert derfra.** Fjordbok har egen arkitektur (TanStack Start, Vite og
Supabase), og ideene er skrevet på nytt mot norske regler. Det gjør at AGPL-kravene ikke trekkes inn i Fjordbok.

Dokumentet viser hva som er svensk i Accounted, hva som er motstykket i Norge, og hvor langt Fjordbok har kommet.

## Hva ble undersøkt

Målt i Accounted (commit `b0b481b`, 21.10.2026):

| Mål | Omfang |
| --- | --- |
| Databasemigrasjoner | 1 089 filer |
| Moduler under `src/lib` | ca. 110 |
| Utvidelser (`src/extensions`) | 20 |
| API-grupper | ca. 70 |
| Filer som nevner Skatteverket | ca. 700 |
| Filer som nevner BAS/kontoplan | ca. 800 |
| Filer som nevner moms | ca. 670 |
| Filer som nevner personnummer/organisationsnummer | ca. 390 |
| Konteringspakker (`packs/`) | 27 |

**Ærlig avgrensning:** Jeg har lest README, juridiske formprofiler, mappestruktur, fristkonfigurasjon, pakkeformat og
moduloversikter, og skannet etter svenske begreper. Jeg har ikke lest alle 1 089 migrasjoner linje for linje. En ren
oversettelse av hele kodebasen var uansett ikke målet: de svenske reglene sitter i hundrevis av filer, og Fjordbok
trenger norske regler, ikke svensk kode med norske etiketter.

## Kartlegging

Status: **Gjort** = fungerer og er testet. **Forberedt** = kode og struktur finnes, men krever leverandør eller avtale.
**Ikke gjort** = ikke startet.

### Lovverk og institusjoner

| Sverige | Norge | Status |
| --- | --- | --- |
| Bokföringslagen | Bokføringsloven og bokføringsforskriften | Gjort (bilagslås, fortløpende nummer, korreksjon i stedet for endring) |
| Årsredovisningslagen | Regnskapsloven | Delvis: oppstilling og sjekkliste finnes, noter og beretning er manuelle |
| Aktiebolagslagen | Aksjeloven | Delvis (utbyttemaler, aksjekapital) |
| Skatteverket | Skatteetaten | Forberedt (se under) |
| Bolagsverket | Brønnøysundregistrene | Oppslag Gjort (uverifisert mot live-API), innsending Forberedt |

### Regnskapskjerne

| Sverige | Norge | Status |
| --- | --- | --- |
| BAS-kontoplan | NS 4102 | Gjort (83 kontoer i malen, utvides ved behov) |
| Verifikation, löpnummer | Bilag, fortløpende bilagsnummer | Gjort |
| Låst period | Periodelås | Gjort |
| Konteringspaket (27 YAML-filer) | Konteringsmaler (`src/lib/bokforingsmaler.ts`, 15 maler) | Gjort, validert mot kontoplanen |
| SIE import/eksport | SAF-T Financial (eksport) | Eksport Gjort, **import Ikke gjort** |
| 7 års arkivering | Oppbevaring etter bokføringsloven | Arkiv med SHA-256 finnes; kontroller fristen mot loven |

### MVA

| Sverige | Norge | Status |
| --- | --- | --- |
| Momsdeklaration (SKV 4700) | MVA-melding | Beregning Gjort, innsending Forberedt |
| Momssatser 25/12/6 % | 25/15/12 % | Gjort |
| BAS-momskonton 26xx | NS 4102 27xx, SAF-T-koder | Gjort |
| Avräkning mot skattekonto | MVA-oppgjør mot oppgjørskonto 2740 | Gjort (oppgjørsbilag genereres) |
| Terminer (mån/kvartal/år) | Tomånedlig eller årlig | Gjort |
| Omvendt skattskyldighet (EU) | Omvendt avgiftsplikt, import (SAF-T 14, 15, 81–89) | Gjort i beregning og bilagseditor; kodene må kontrolleres mot Skatteetatens kodeliste før første innsending |
| Periodisk sammanställning, VIES | Må vurderes mot norske regler | Ikke gjort |
| OSS/IOSS | VOEC-ordningen | Ikke gjort |

### Lønn

| Sverige | Norge | Status |
| --- | --- | --- |
| Arbetsgivardeklaration på individnivå (AGI) | A-melding | Forberedt (ansatte og beregning finnes; innsending krever Altinn/Maskinporten) |
| Arbetsgivaravgift (én sats) | Arbeidsgiveravgift per sone | Gjort |
| Semesterlön | Feriepenger | Gjort |
| Preliminärskatt på lön | Forskuddstrekk | Gjort |
| Egenavgifter (enskild firma) | Trygdeavgift/personinntekt | Ikke gjort |

### Skatt og årsoppgjør

| Sverige | Norge | Status |
| --- | --- | --- |
| INK2 / NE-bilaga, SRU-filer | Skattemelding med næringsspesifikasjon | Grunnlag Gjort, innsending Forberedt |
| Årsredovisning K2/K3, iXBRL | Årsregnskap til Regnskapsregisteret | Oppstilling Gjort, innsending Forberedt, format må avklares |
| Periodiseringsfond, räntefördelning, expansionsfond | Skjermingsfradrag m.fl. | Ikke gjort |
| ROT/RUT | Ingen motpart | Utelatt |
| Skattekonto-avstemming | Skattekonto-avstemming | Ikke gjort |

### Betalinger, bank og faktura

| Sverige | Norge | Status |
| --- | --- | --- |
| Bankgiro/Plusgiro, OCR | Kontonummer (mod11), KID (mod10) | Gjort |
| pain.001 for leverandørbetaling | pain.001 | Gjort (må testes mot den enkelte bank) |
| Swish | Vipps | Ikke gjort |
| Peppol via Qvalia | EHF/Peppol BIS 3 via godkjent aksesspunkt | Generator Gjort, sending Forberedt |
| PSD2 via Enable Banking | Norsk tilbyder av kontoinformasjon | Forberedt, ingen leverandør valgt |

### Eier, firmaformer og drift

| Sverige | Norge | Status |
| --- | --- | --- |
| Enskild firma, aktiebolag | ENK, AS | Gjort |
| Ideell förening, ekonomisk förening, bostadsrättsförening | Forening, samvirke, borettslag | Ikke gjort |
| Svenske helligdager i fristmotor | Norske helligdager | Gjort (`src/lib/frister.ts`) |
| Skatteverkets frister | Skatteetatens og Brønnøysunds frister | Gjort |
| Språk: sv/en | Bokmål | Gjort |

### AI og agenter

| Accounted | Fjordbok | Status |
| --- | --- | --- |
| 150+ MCP-verktøy, scoped API-nøkler | Forslagslag og scopede agentnøkler (les kontoplan/bank, foreslå bilag): agent foreslår, menneske godkjenner | Gjort |
| AI-kategorisering som utvidelse | Regelmotor for banktransaksjoner | Gjort |
| MCP-server og Claude-plugin | MCP-server (`mcp/`) med tre verktøy over scopede nøkler; ingen Claude-plugin | Gjort (MCP) |
| Kvitteringsgjenkjenning (OCR) | Krever leverandør | Ikke gjort |

## Hva Accounted gjør bedre (verdt å hente)

- **Én profil per firmaform** (`docs/LEGAL-FORMS.md` hos dem): koden spør hva et firma kan gjøre, ikke hvilken type det er.
  Det blir viktig når Fjordbok får flere firmaformer enn ENK og AS.
- **Konteringspakker som data i filer** i stedet for rader i migrasjoner. Fjordbok har maler som kode; flytt til data når
  de blir mange.
- **SAF-T/SIE-import** for å flytte kunder over fra andre systemer. Største gapet for å kunne ta imot kunder fra Fiken,
  Tripletex og PowerOffice.

## Neste steg som krever beslutning

Se `/app/integrasjoner` i appen. For hver tjeneste står hva som kreves, og kandidater å undersøke (uverifiserte forslag).
Tjenestene som krever en avtale: Peppol-aksesspunkt, Skatteetatens sluttbrukersystem-tilgang (MVA, skattemelding og
a-melding via Maskinporten), innsendingsvei for årsregnskap, bank-API og lønnssystem om dere ikke bygger a-melding selv.
