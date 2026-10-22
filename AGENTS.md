<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Voucher inbox focus mode is shared with the app shell through a dedicated React context; this lets the shell hide navigation without affecting other pages.
- Bookkeeping integrity (balance check, sequential voucher numbers, immutability of posted vouchers, invoice posting) lives in Postgres functions/triggers (`post_voucher`, `send_invoice`, `register_invoice_payment`, `reverse_voucher`), never in client code — the law requires it be enforced regardless of caller.
- Multi-tenancy: every business table has `company_id`; RLS uses `is_member` / `can_write` / `is_admin` security-definer helpers on `company_members`.
- Active company is chosen client-side via `CompanyProvider` (`src/lib/company.tsx`); pages read it with `useCompany()`.
- MVA logic (codes, rates, melding calculation) is pure TS in `src/lib/mva.ts` with tests in `src/lib/mva.test.ts`; MVA box assignment uses the line's SAF-T `mva_kode`, with 27xx accounts holding the tax amount.
- UI copy is Norwegian bokmål; feature roadmap is in `roadmap.md`.
- Integrasjoner (Peppol, MVA-innsending, a-melding, årsregnskap, skattemelding, bank) går alltid gjennom adaptere i `src/lib/integrasjoner/adapter.ts`. Ingen leverandør er valgt; stubbene kaster `LeverandorMangler`. Ekte adaptere trenger hemmeligheter og skal kjøres på serveren, aldri i nettleseren. Hemmeligheter lagres aldri i `integrations.konfig` (databasen avviser det).
- Det som er sendt (`innsendinger.status` er sendt/mottatt/avvist) kan ikke endres eller slettes; trigger i Postgres håndhever det.
- AI og regler lager `agent_proposals`, aldri bilag direkte. Bokføring skjer kun via `approve_proposal`, som kaller `post_voucher`.
- Frister beregnes i `src/lib/frister.ts` (norske helligdager, flytting til virkedag). Ikke hardkod frister i sidene.
- Nye konteringsmaler i `src/lib/bokforingsmaler.ts` må bruke kontoer som finnes i NS 4102-malen; testen leser migrasjonen og feiler ellers.
- Nye migrasjoner legges i `drizzle/migrations/` med nytt løpenummer og oppføring i `meta/_journal.json`. Oppdater `src/integrations/supabase/types.ts` for nye tabeller og funksjoner.
- Accounted (svensk, AGPL) er referanse, ikke kodekilde. Ikke kopier kode derfra.
- Agenter bruker kun `agent_*`-funksjonene med en `agent_keys`-nøkkel (lagres som hash, aldri i klartekst). Nøkkelen kan lese kontoplan/nye banktransaksjoner og foreslå bilag, aldri bokføre. Se `docs/AI-AGENTER.md`.
- Kjøp med omvendt avgiftsplikt lages med `byggOmvendtAvgift` (`src/lib/mva.ts`): avgift på 270x (utgående) og 271x (inngående) i samme bilag, samme MVA-kode på alle tre linjene.
- Anleggsmidler: saldosatser og grenser ligger i `src/lib/anleggsmidler.ts` (hentet fra Sticos, må kontrolleres per inntektsår). Beregningen ruller saldo fra første anskaffelsesår; ikke lagre beregnet saldo i databasen.
