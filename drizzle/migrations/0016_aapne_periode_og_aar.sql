-- Gjør det mulig å låse opp perioder og åpne en årsavslutning.
-- Opplåsing logges i revisjonsloggen, og åpning av år skjer med korreksjonsbilag (ikke sletting),
-- slik at sporet etter den opprinnelige avslutningen bevares.

-- Periodelås kan nå flyttes begge veier, og fjernes helt med NULL
CREATE OR REPLACE FUNCTION public.set_period_lock(_company uuid, _dato date)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_admin(_company) THEN RAISE EXCEPTION 'Kun administrator kan endre periodelås'; END IF;
  UPDATE public.companies SET laast_til = _dato WHERE id = _company;
  PERFORM public.log_audit(_company, CASE WHEN _dato IS NULL THEN 'periodelaas_fjernet' ELSE 'periode_laast' END, 'firma', _company, jsonb_build_object('til', _dato));
END $function$;

-- Årsavslutningen kan åpnes igjen: korreksjonsbilaget nuller ut disponeringen,
-- og close_year ser bort fra avslutninger som er korrigert.
CREATE OR REPLACE FUNCTION public.close_year(_company uuid, _aar integer)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _res numeric; _vid uuid; _c public.companies;
BEGIN
  IF NOT public.is_admin(_company) THEN RAISE EXCEPTION 'Kun administrator kan avslutte året'; END IF;
  SELECT * INTO _c FROM public.companies WHERE id = _company;
  IF EXISTS (
    SELECT 1 FROM public.vouchers v
    WHERE v.company_id = _company AND v.kilde = 'aarsavslutning' AND v.status = 'bokfort' AND extract(year FROM v.dato) = _aar
      AND NOT EXISTS (SELECT 1 FROM public.vouchers k WHERE k.korrigerer = v.id AND k.status = 'bokfort')
  ) THEN
    RAISE EXCEPTION 'Året % er allerede avsluttet', _aar;
  END IF;
  SELECT COALESCE(sum(l.kredit - l.debet), 0) INTO _res FROM public.voucher_lines l JOIN public.vouchers v ON v.id = l.voucher_id
  WHERE v.company_id = _company AND v.status = 'bokfort' AND extract(year FROM v.dato) = _aar AND l.konto >= '3000' AND l.konto < '8800';
  INSERT INTO public.vouchers (company_id, dato, beskrivelse, kilde, created_by)
  VALUES (_company, make_date(_aar, 12, 31), 'Årsavslutning ' || _aar || ': disponering av årsresultat', 'aarsavslutning', auth.uid()) RETURNING id INTO _vid;
  IF _res >= 0 THEN
    INSERT INTO public.voucher_lines (voucher_id, company_id, konto, tekst, debet, linjenr) VALUES (_vid, _company, '8800', 'Årsresultat', _res, 0);
    INSERT INTO public.voucher_lines (voucher_id, company_id, konto, tekst, kredit, linjenr) VALUES (_vid, _company, '2050', CASE WHEN _c.company_type = 'as' THEN 'Overført annen egenkapital' ELSE 'Overført egenkapital' END, _res, 1);
  ELSE
    INSERT INTO public.voucher_lines (voucher_id, company_id, konto, tekst, kredit, linjenr) VALUES (_vid, _company, '8800', 'Årsresultat (underskudd)', -_res, 0);
    INSERT INTO public.voucher_lines (voucher_id, company_id, konto, tekst, debet, linjenr) VALUES (_vid, _company, CASE WHEN _c.company_type = 'as' THEN '2080' ELSE '2050' END, 'Dekning av underskudd', -_res, 1);
  END IF;
  PERFORM public.post_voucher(_vid);
  RETURN _vid;
END $function$;

-- Åpner et avsluttet år ved å korrigere bort disponeringsbilaget
CREATE OR REPLACE FUNCTION public.reopen_year(_company uuid, _aar integer)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _v public.vouchers; _rev uuid;
BEGIN
  IF NOT public.is_admin(_company) THEN RAISE EXCEPTION 'Kun administrator kan åpne året'; END IF;
  SELECT * INTO _v FROM public.vouchers v
  WHERE v.company_id = _company AND v.kilde = 'aarsavslutning' AND v.status = 'bokfort' AND extract(year FROM v.dato) = _aar
    AND NOT EXISTS (SELECT 1 FROM public.vouchers k WHERE k.korrigerer = v.id AND k.status = 'bokfort')
  ORDER BY v.dato DESC LIMIT 1;
  IF _v.id IS NULL THEN RAISE EXCEPTION 'Året % er ikke avsluttet', _aar; END IF;
  _rev := public.reverse_voucher(_v.id);
  PERFORM public.log_audit(_company, 'aar_aapnet', 'bilag', _v.id, jsonb_build_object('aar', _aar, 'korreksjon', _rev));
  RETURN _rev;
END $function$;
REVOKE ALL ON FUNCTION public.reopen_year(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reopen_year(uuid, integer) TO authenticated;