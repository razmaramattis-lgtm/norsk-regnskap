-- Klientoversikt for regnskapsbyrå: ett kall gir status for alle firmaer innlogget bruker har tilgang til.
-- SECURITY INVOKER, så radnivåsikkerheten avgjør hva som telles; ingenting utenfor brukerens firmaer lekker.
CREATE OR REPLACE FUNCTION public.byraa_oversikt() RETURNS TABLE (
  company_id uuid,
  ubehandlede_banktransaksjoner int,
  bilagsutkast int,
  ventende_forslag int,
  forfalte_kundefakturaer int,
  forfalt_kundebelop numeric,
  forfalte_leverandorfakturaer int,
  forfalt_leverandorbelop numeric,
  har_ansatte boolean,
  siste_bilagsdato date,
  siste_bokforte_bilagsdato date
) LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT
    c.id,
    (SELECT count(*)::int FROM public.bank_transactions b WHERE b.company_id = c.id AND b.status = 'ny'),
    (SELECT count(*)::int FROM public.vouchers v WHERE v.company_id = c.id AND v.status = 'utkast'),
    (SELECT count(*)::int FROM public.agent_proposals p WHERE p.company_id = c.id AND p.status = 'ventende'),
    (SELECT count(*)::int FROM public.invoices i WHERE i.company_id = c.id AND i.status = 'sendt' AND i.forfallsdato < current_date),
    COALESCE((SELECT sum(i.total) FROM public.invoices i WHERE i.company_id = c.id AND i.status = 'sendt' AND i.forfallsdato < current_date), 0),
    (SELECT count(*)::int FROM public.supplier_invoices s WHERE s.company_id = c.id AND s.status = 'bokfort' AND s.forfallsdato < current_date),
    COALESCE((SELECT sum(s.total) FROM public.supplier_invoices s WHERE s.company_id = c.id AND s.status = 'bokfort' AND s.forfallsdato < current_date), 0),
    EXISTS (SELECT 1 FROM public.employees e WHERE e.company_id = c.id),
    (SELECT max(v.dato) FROM public.vouchers v WHERE v.company_id = c.id),
    (SELECT max(v.dato) FROM public.vouchers v WHERE v.company_id = c.id AND v.status = 'bokfort')
  FROM public.companies c
  WHERE public.is_member(c.id);
$$;
REVOKE ALL ON FUNCTION public.byraa_oversikt() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.byraa_oversikt() TO authenticated;
