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
- Bookkeeping integrity (balance check, sequential voucher numbers, immutability of posted vouchers, invoice posting) lives in Postgres functions/triggers (`post_voucher`, `send_invoice`, `register_invoice_payment`, `reverse_voucher`), never in client code — the law requires it be enforced regardless of caller.
- Multi-tenancy: every business table has `company_id`; RLS uses `is_member` / `can_write` / `is_admin` security-definer helpers on `company_members`.
- Active company is chosen client-side via `CompanyProvider` (`src/lib/company.tsx`); pages read it with `useCompany()`.
- MVA logic (codes, rates, melding calculation) is pure TS in `src/lib/mva.ts` with tests in `src/lib/mva.test.ts`; MVA box assignment uses the line's SAF-T `mva_kode`, with 27xx accounts holding the tax amount.
- UI copy is Norwegian bokmål; feature roadmap is in `roadmap.md`.
