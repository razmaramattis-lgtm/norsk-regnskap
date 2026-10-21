# AI-agenter i Fjordbok

En agent (Claude, en MCP-server, et eget skript) kan hjelpe til med bokføring, men **aldri bokføre selv**.
Den legger frem et *forslag*; et menneske godkjenner i Fjordbok under **Forslag fra AI**.
Godkjenning går gjennom `approve_proposal` → `post_voucher`, så balansekontroll, periodelås,
kontoplan, fortløpende bilagsnummer og revisjonslogg gjelder som for alle andre bilag.

## Hva en agentnøkkel kan

| Kan | Kan ikke |
| --- | --- |
| Lese kontoplanen i ett firma | Se bilag, kunder, lønn eller noe annet |
| Lese nye (uavstemte) banktransaksjoner uten ventende forslag | Bokføre, godkjenne eller avvise |
| Opprette forslag (maks 500 ventende per firma) | Endre eller slette forslag |
| | Bruke nøkkelen i et annet firma |

Nøkkelen lages av eier/administrator under **Forslag fra AI → Koble til en AI-agent**. Klartekst vises én gang;
databasen lagrer bare en SHA-256-hash. Tilbakekalling virker umiddelbart. Opprettelse, tilbakekalling og hvert
forslag fra en agent havner i revisjonsloggen.

## Funksjoner (HTTPS, PostgREST)

Alle kalles med `POST {SUPABASE_URL}/rest/v1/rpc/<navn>`, headeren `apikey: <offentlig nøkkel>` og JSON-body.

### `agent_hent_kontoplan`
```json
{ "_key": "fbk_…" }
```
Svar: `[{"konto":"6800","navn":"Kontorrekvisita","mva_kode":"1"}, …]`

### `agent_hent_banktransaksjoner`
```json
{ "_key": "fbk_…", "_grense": 100 }
```
Svar: `[{"id":"…","dato":"2026-10-20","tekst":"…","belop":-100,"bankkonto":"1920"}, …]`

### `agent_foreslaa_bilag`
```json
{
  "_key": "fbk_…",
  "_tittel": "Kontorrekvisita",
  "_begrunnelse": "Tekst og beløp ligner tidligere kjøp hos samme leverandør.",
  "_sikkerhet": 0.9,
  "_agent_navn": "Claude",
  "_bank_transaction_id": "…",
  "_payload": {
    "dato": "2026-10-20",
    "beskrivelse": "Kontorrekvisita",
    "linjer": [
      { "konto": "6800", "debet": 80, "kredit": 0, "mva_kode": "1" },
      { "konto": "2710", "debet": 20, "kredit": 0, "mva_kode": "1" },
      { "konto": "1920", "debet": 0, "kredit": 100 }
    ]
  }
}
```
Svar: forslagets id. Feil gis på norsk (ukjent konto, færre enn to linjer, ugyldig dato,
transaksjonen er allerede avstemt, eller det finnes allerede et ventende forslag for den).

For kjøp med omvendt avgiftsplikt (kodene 81–89): bruk kostnad + inngående (271x) + utgående (270x) i
samme forslag. Se `byggOmvendtAvgift` i `src/lib/mva.ts`.

## Retningslinjer for agenter

- Foreslå bare når du har grunnlag. Skriv hva forslaget bygger på i `_begrunnelse`, og ærlig `_sikkerhet`.
- Ikke gjett kontoer eller MVA-koder. Er du usikker, la være å foreslå.
- Hent kontoplanen først; bruk bare kontoer som finnes.
- Personopplysninger (lønn, ansatte) skal ikke sendes til en ekstern modell uten databehandleravtale.

## MCP-server

`mcp/fjordbok-mcp.mjs` pakker de tre funksjonene som MCP-verktøy (`hent_kontoplan`, `hent_banktransaksjoner`,
`foreslaa_bilag`) over stdio, uten avhengigheter. Oppsett står i `mcp/README.md`. Serveren har ingen egne rettigheter:
alt begrenses av nøkkelen i databasen.

## Videre arbeid

- Lesing av vedlegg (kvitteringer) for agenter, med egen tilgangsbegrensning.
- Grenser per nøkkel (antall forslag per døgn).
