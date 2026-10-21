# Fjordbok – norsk regnskapssystem

Regnskapsprogram for norske enkeltpersonforetak og aksjeselskap. Dobbel bokføring etter bokføringsloven, NS 4102-kontoplan,
faktura med KID, MVA-melding, lønn, bank, årsregnskap og skattegrunnlag.

Utviklet med [Accounted](https://github.com/erp-mafia/accounted) (svensk, AGPL-3.0) som referanse for arkitektur og funksjonsomfang.
Ingen kode er kopiert. Se [docs/SVERIGE-TIL-NORGE.md](docs/SVERIGE-TIL-NORGE.md) for hva som er svensk, hva som er norsk motstykke og hvor langt vi har kommet.

## Hovedprinsipper

- **Lovkravene ligger i databasen**, ikke i appen: balansekontroll, fortløpende bilagsnummer, låste bilag, periodelås og revisjonslogg gjelder uansett hvem som kaller.
- **Agenter foreslår, mennesker godkjenner.** AI og regelmotor lager forslag; godkjenning går gjennom samme databasevakt som alle bilag.
- **Forberedt for leverandører, men ingen er valgt.** Peppol/EHF, MVA-innsending, a-melding, årsregnskap og skattemelding har ferdige adaptere som feiler tydelig til en leverandør er valgt (se `/app/integrasjoner`).

## Oversikt over koden

| Mappe | Innhold |
| --- | --- |
| `src/lib/` | Ren forretningslogikk med tester: MVA, lønn, frister, årsregnskap, skatt, kontoforslag, konteringsmaler, Enhetsregisteret |
| `src/lib/integrasjoner/` | Adaptere, kravliste per tjeneste, EHF-generator, betalingsfil (pain.001) |
| `src/routes/_authenticated/` | Sidene i appen |
| `drizzle/migrations/` | Databaseskjema, funksjoner og vakter |
| `docs/` | Dokumentasjon |
| `roadmap.md` | Hva som er gjort og hva som gjenstår |

## Utvikling

Prosjektet bruker bun.

```sh
bun install
bun run dev        # utviklingsserver
bun run test       # tester
bun run build      # produksjonsbygg
```

## Lovable

Prosjektet er koblet til [Lovable](https://lovable.dev/projects/b45eb5b3-a793-4202-a4b1-a6fed669e441). Endringer som pushes til `main` synkroniseres til Lovable.
Ikke skriv om publisert historikk (force push, rebase eller squash).
