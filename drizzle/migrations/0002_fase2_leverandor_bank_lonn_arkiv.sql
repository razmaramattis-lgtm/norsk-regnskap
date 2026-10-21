
-- Periodelås
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS laast_til date;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS aga_sone text NOT NULL DEFAULT '1';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS feriepengesats numeric(5,2) NOT NULL DEFAULT 10.2;

-- Revisjonslogg
CREATE TABLE public.audit_log (
  id bigserial PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid DEFAULT auth.uid(),
  handling text NOT NULL,
  objekt text,
  objekt_id uuid,
  detaljer jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read audit" ON public.audit_log FOR SELECT TO authenticated USING (public.is_member(company_id));

CREATE OR REPLACE FUNCTION public.log_audit(_company uuid, _handling text, _objekt text, _id uuid, _det jsonb) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.audit_log (company_id, handling, objekt, objekt_id, detaljer) VALUES (_company, _handling, _objekt, _id, _det);
$$;
REVOKE EXECUTE ON FUNCTION public.log_audit(uuid, text, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;

-- post_voucher med periodelås og logg
CREATE OR REPLACE FUNCTION public.post_voucher(_voucher uuid) RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _v public.vouchers; _d numeric; _k numeric; _n int; _cnt int; _laast date;
BEGIN
  SELECT * INTO _v FROM public.vouchers WHERE id = _voucher FOR UPDATE;
  IF _v.id IS NULL THEN RAISE EXCEPTION 'Bilag finnes ikke'; END IF;
  IF NOT public.can_write(_v.company_id) THEN RAISE EXCEPTION 'Ingen tilgang'; END IF;
  IF _v.status = 'bokfort' THEN RAISE EXCEPTION 'Bilaget er allerede bokført'; END IF;
  SELECT laast_til INTO _laast FROM public.companies WHERE id = _v.company_id;
  IF _laast IS NOT NULL AND _v.dato <= _laast THEN RAISE EXCEPTION 'Perioden er låst til og med %. Velg en senere dato.', to_char(_laast, 'DD.MM.YYYY'); END IF;
  SELECT COALESCE(sum(debet),0), COALESCE(sum(kredit),0), count(*) INTO _d, _k, _cnt FROM public.voucher_lines WHERE voucher_id = _voucher;
  IF _cnt < 2 THEN RAISE EXCEPTION 'Et bilag må ha minst to linjer'; END IF;
  IF _d <> _k THEN RAISE EXCEPTION 'Bilaget balanserer ikke (debet % / kredit %)', _d, _k; END IF;
  IF _d = 0 THEN RAISE EXCEPTION 'Bilaget har ingen beløp'; END IF;
  IF EXISTS (SELECT 1 FROM public.voucher_lines l WHERE l.voucher_id = _voucher AND NOT EXISTS (SELECT 1 FROM public.accounts a WHERE a.company_id = _v.company_id AND a.number = l.konto)) THEN
    RAISE EXCEPTION 'Bilaget bruker en konto som ikke finnes i kontoplanen';
  END IF;
  UPDATE public.companies SET neste_bilagsnr = neste_bilagsnr + 1 WHERE id = _v.company_id RETURNING neste_bilagsnr - 1 INTO _n;
  UPDATE public.vouchers SET status = 'bokfort', bilagsnr = _n, bokfort_at = now(), bokfort_av = auth.uid() WHERE id = _voucher;
  PERFORM public.log_audit(_v.company_id, 'bokfort', 'bilag', _voucher, jsonb_build_object('bilagsnr', _n, 'belop', _d));
  RETURN _n;
END $$;

CREATE OR REPLACE FUNCTION public.set_period_lock(_company uuid, _dato date) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin(_company) THEN RAISE EXCEPTION 'Kun administrator kan låse perioder'; END IF;
  IF EXISTS (SELECT 1 FROM public.companies WHERE id = _company AND laast_til IS NOT NULL AND _dato < laast_til) THEN
    RAISE EXCEPTION 'En låst periode kan ikke åpnes igjen';
  END IF;
  UPDATE public.companies SET laast_til = _dato WHERE id = _company;
  PERFORM public.log_audit(_company, 'periode_laast', 'firma', _company, jsonb_build_object('til', _dato));
END $$;
GRANT EXECUTE ON FUNCTION public.set_period_lock(uuid, date) TO authenticated;

-- Årsavslutning: overfør årsresultat til egenkapital
CREATE OR REPLACE FUNCTION public.close_year(_company uuid, _aar int) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _res numeric; _vid uuid; _c public.companies;
BEGIN
  IF NOT public.is_admin(_company) THEN RAISE EXCEPTION 'Kun administrator kan avslutte året'; END IF;
  SELECT * INTO _c FROM public.companies WHERE id = _company;
  IF EXISTS (SELECT 1 FROM public.vouchers WHERE company_id = _company AND kilde = 'aarsavslutning' AND status = 'bokfort' AND extract(year FROM dato) = _aar) THEN
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
END $$;
GRANT EXECUTE ON FUNCTION public.close_year(uuid, int) TO authenticated;

-- Leverandører
CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  navn text NOT NULL,
  org_nr text,
  epost text,
  kontonummer text,
  adresse text, postnr text, poststed text,
  land text NOT NULL DEFAULT 'NO',
  standard_konto text DEFAULT '6800',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read suppliers" ON public.suppliers FOR SELECT TO authenticated USING (public.is_member(company_id));
CREATE POLICY "writers insert suppliers" ON public.suppliers FOR INSERT TO authenticated WITH CHECK (public.can_write(company_id));
CREATE POLICY "writers update suppliers" ON public.suppliers FOR UPDATE TO authenticated USING (public.can_write(company_id));
CREATE POLICY "writers delete suppliers" ON public.suppliers FOR DELETE TO authenticated USING (public.can_write(company_id));

CREATE TYPE public.supplier_invoice_status AS ENUM ('utkast','bokfort','betalt');
CREATE TABLE public.supplier_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id),
  fakturanr text,
  fakturadato date NOT NULL DEFAULT current_date,
  forfallsdato date NOT NULL DEFAULT (current_date + 14),
  kid text,
  status public.supplier_invoice_status NOT NULL DEFAULT 'utkast',
  netto numeric(14,2) NOT NULL DEFAULT 0,
  mva numeric(14,2) NOT NULL DEFAULT 0,
  total numeric(14,2) NOT NULL DEFAULT 0,
  voucher_id uuid REFERENCES public.vouchers(id),
  betalt_voucher_id uuid REFERENCES public.vouchers(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_invoices TO authenticated;
GRANT ALL ON public.supplier_invoices TO service_role;
ALTER TABLE public.supplier_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read sinv" ON public.supplier_invoices FOR SELECT TO authenticated USING (public.is_member(company_id));
CREATE POLICY "writers insert sinv" ON public.supplier_invoices FOR INSERT TO authenticated WITH CHECK (public.can_write(company_id) AND status = 'utkast');
CREATE POLICY "writers update sinv" ON public.supplier_invoices FOR UPDATE TO authenticated USING (public.can_write(company_id) AND status = 'utkast');
CREATE POLICY "writers delete sinv" ON public.supplier_invoices FOR DELETE TO authenticated USING (public.can_write(company_id) AND status = 'utkast');

CREATE TABLE public.supplier_invoice_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_invoice_id uuid NOT NULL REFERENCES public.supplier_invoices(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  konto text NOT NULL,
  beskrivelse text,
  netto numeric(14,2) NOT NULL DEFAULT 0,
  mva_sats numeric(5,2) NOT NULL DEFAULT 25,
  linjenr int NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_invoice_lines TO authenticated;
GRANT ALL ON public.supplier_invoice_lines TO service_role;
ALTER TABLE public.supplier_invoice_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read sinv lines" ON public.supplier_invoice_lines FOR SELECT TO authenticated USING (public.is_member(company_id));
CREATE POLICY "writers write sinv lines" ON public.supplier_invoice_lines FOR ALL TO authenticated
  USING (public.can_write(company_id) AND EXISTS (SELECT 1 FROM public.supplier_invoices i WHERE i.id = supplier_invoice_id AND i.status = 'utkast'))
  WITH CHECK (public.can_write(company_id) AND EXISTS (SELECT 1 FROM public.supplier_invoices i WHERE i.id = supplier_invoice_id AND i.status = 'utkast' AND i.company_id = supplier_invoice_lines.company_id));

CREATE OR REPLACE FUNCTION public.book_supplier_invoice(_inv uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _i public.supplier_invoices; _c public.companies; _s public.suppliers; _vid uuid; r record; _ln int := 1; _netto numeric := 0; _mva numeric := 0; _m numeric; _mk text; _kode text;
BEGIN
  SELECT * INTO _i FROM public.supplier_invoices WHERE id = _inv FOR UPDATE;
  IF NOT public.can_write(_i.company_id) THEN RAISE EXCEPTION 'Ingen tilgang'; END IF;
  IF _i.status <> 'utkast' THEN RAISE EXCEPTION 'Fakturaen er allerede bokført'; END IF;
  SELECT * INTO _c FROM public.companies WHERE id = _i.company_id;
  SELECT * INTO _s FROM public.suppliers WHERE id = _i.supplier_id;
  IF NOT EXISTS (SELECT 1 FROM public.supplier_invoice_lines WHERE supplier_invoice_id = _inv) THEN RAISE EXCEPTION 'Fakturaen har ingen linjer'; END IF;
  INSERT INTO public.vouchers (company_id, dato, beskrivelse, kilde, created_by)
  VALUES (_i.company_id, _i.fakturadato, 'Leverandørfaktura ' || COALESCE(_i.fakturanr, '') || ' – ' || _s.navn, 'leverandorfaktura', auth.uid()) RETURNING id INTO _vid;
  FOR r IN SELECT * FROM public.supplier_invoice_lines WHERE supplier_invoice_id = _inv ORDER BY linjenr LOOP
    _m := CASE WHEN _c.mva_registrert THEN round(r.netto * r.mva_sats / 100, 2) ELSE 0 END;
    _mk := CASE r.mva_sats WHEN 25 THEN '2710' WHEN 15 THEN '2711' WHEN 12 THEN '2712' ELSE NULL END;
    _kode := CASE r.mva_sats WHEN 25 THEN '1' WHEN 15 THEN '11' WHEN 12 THEN '13' ELSE NULL END;
    IF NOT _c.mva_registrert OR _mk IS NULL THEN
      INSERT INTO public.voucher_lines (voucher_id, company_id, konto, tekst, debet, linjenr) VALUES (_vid, _i.company_id, r.konto, r.beskrivelse, r.netto + _m, _ln);
    ELSE
      INSERT INTO public.voucher_lines (voucher_id, company_id, konto, tekst, debet, mva_kode, linjenr) VALUES (_vid, _i.company_id, r.konto, r.beskrivelse, r.netto, _kode, _ln);
      _ln := _ln + 1;
      INSERT INTO public.voucher_lines (voucher_id, company_id, konto, tekst, debet, mva_kode, linjenr) VALUES (_vid, _i.company_id, _mk, 'Inngående mva ' || r.mva_sats || ' %', _m, _kode, _ln);
    END IF;
    _ln := _ln + 1;
    _netto := _netto + r.netto; _mva := _mva + _m;
  END LOOP;
  INSERT INTO public.voucher_lines (voucher_id, company_id, konto, tekst, kredit, linjenr) VALUES (_vid, _i.company_id, '2400', 'Leverandørgjeld ' || _s.navn, _netto + _mva, 0);
  PERFORM public.post_voucher(_vid);
  UPDATE public.supplier_invoices SET status = 'bokfort', voucher_id = _vid, netto = _netto, mva = _mva, total = _netto + _mva WHERE id = _inv;
  RETURN _vid;
END $$;
GRANT EXECUTE ON FUNCTION public.book_supplier_invoice(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.pay_supplier_invoice(_inv uuid, _dato date) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _i public.supplier_invoices; _vid uuid;
BEGIN
  SELECT * INTO _i FROM public.supplier_invoices WHERE id = _inv FOR UPDATE;
  IF NOT public.can_write(_i.company_id) THEN RAISE EXCEPTION 'Ingen tilgang'; END IF;
  IF _i.status <> 'bokfort' THEN RAISE EXCEPTION 'Kun bokførte, ubetalte fakturaer kan betales'; END IF;
  INSERT INTO public.vouchers (company_id, dato, beskrivelse, kilde, created_by)
  VALUES (_i.company_id, _dato, 'Betaling leverandørfaktura ' || COALESCE(_i.fakturanr, ''), 'utbetaling', auth.uid()) RETURNING id INTO _vid;
  INSERT INTO public.voucher_lines (voucher_id, company_id, konto, tekst, debet, linjenr) VALUES (_vid, _i.company_id, '2400', 'Leverandørgjeld', _i.total, 0);
  INSERT INTO public.voucher_lines (voucher_id, company_id, konto, tekst, kredit, linjenr) VALUES (_vid, _i.company_id, '1920', 'Utbetaling', _i.total, 1);
  PERFORM public.post_voucher(_vid);
  UPDATE public.supplier_invoices SET status = 'betalt', betalt_voucher_id = _vid WHERE id = _inv;
  RETURN _vid;
END $$;
GRANT EXECUTE ON FUNCTION public.pay_supplier_invoice(uuid, date) TO authenticated;

-- Varer / artikler
CREATE TABLE public.articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  varenr text,
  navn text NOT NULL,
  enhet text NOT NULL DEFAULT 'stk',
  pris numeric(14,2) NOT NULL DEFAULT 0,
  mva_sats numeric(5,2) NOT NULL DEFAULT 25,
  aktiv boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.articles TO authenticated;
GRANT ALL ON public.articles TO service_role;
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read articles" ON public.articles FOR SELECT TO authenticated USING (public.is_member(company_id));
CREATE POLICY "writers insert articles" ON public.articles FOR INSERT TO authenticated WITH CHECK (public.can_write(company_id));
CREATE POLICY "writers update articles" ON public.articles FOR UPDATE TO authenticated USING (public.can_write(company_id));
CREATE POLICY "writers delete articles" ON public.articles FOR DELETE TO authenticated USING (public.can_write(company_id));

-- Kreditnota
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS kreditnota_for uuid REFERENCES public.invoices(id);
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS er_kreditnota boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.credit_invoice(_invoice uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _i public.invoices; _new uuid; _vid uuid; _nr int;
BEGIN
  SELECT * INTO _i FROM public.invoices WHERE id = _invoice FOR UPDATE;
  IF NOT public.can_write(_i.company_id) THEN RAISE EXCEPTION 'Ingen tilgang'; END IF;
  IF _i.status <> 'sendt' THEN RAISE EXCEPTION 'Kun sendte, ubetalte fakturaer kan krediteres'; END IF;
  IF _i.er_kreditnota THEN RAISE EXCEPTION 'En kreditnota kan ikke krediteres'; END IF;
  _vid := public.reverse_voucher(_i.voucher_id);
  UPDATE public.vouchers SET beskrivelse = beskrivelse WHERE false;
  UPDATE public.companies SET neste_fakturanr = neste_fakturanr + 1 WHERE id = _i.company_id RETURNING neste_fakturanr - 1 INTO _nr;
  INSERT INTO public.invoices (company_id, customer_id, fakturanr, fakturadato, forfallsdato, status, netto, mva, total, merknad, voucher_id, kreditnota_for, er_kreditnota)
  VALUES (_i.company_id, _i.customer_id, _nr, current_date, current_date, 'kreditert', -_i.netto, -_i.mva, -_i.total, 'Kreditnota for faktura ' || _i.fakturanr, _vid, _i.id, true)
  RETURNING id INTO _new;
  INSERT INTO public.invoice_lines (invoice_id, company_id, beskrivelse, antall, enhetspris, mva_sats, linjenr)
  SELECT _new, company_id, beskrivelse, -antall, enhetspris, mva_sats, linjenr FROM public.invoice_lines WHERE invoice_id = _invoice;
  UPDATE public.invoices SET status = 'kreditert' WHERE id = _invoice;
  RETURN _new;
END $$;
GRANT EXECUTE ON FUNCTION public.credit_invoice(uuid) TO authenticated;

-- Bank
CREATE TABLE public.bank_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  bankkonto text NOT NULL DEFAULT '1920',
  dato date NOT NULL,
  tekst text NOT NULL DEFAULT '',
  belop numeric(14,2) NOT NULL,
  referanse text,
  status text NOT NULL DEFAULT 'ny',
  voucher_id uuid REFERENCES public.vouchers(id),
  import_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, import_hash)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_transactions TO authenticated;
GRANT ALL ON public.bank_transactions TO service_role;
ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read bank" ON public.bank_transactions FOR SELECT TO authenticated USING (public.is_member(company_id));
CREATE POLICY "writers insert bank" ON public.bank_transactions FOR INSERT TO authenticated WITH CHECK (public.can_write(company_id) AND status = 'ny');
CREATE POLICY "writers delete new bank" ON public.bank_transactions FOR DELETE TO authenticated USING (public.can_write(company_id) AND status = 'ny');

-- Bokfør banktransaksjon mot konto (med eventuelt mva) eller mot faktura
CREATE OR REPLACE FUNCTION public.book_bank_transaction(_tx uuid, _motkonto text, _mva_sats numeric, _invoice uuid, _supplier_invoice uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _t public.bank_transactions; _c public.companies; _vid uuid; _abs numeric; _netto numeric; _mva numeric; _mk text; _kode text; _i public.invoices; _si public.supplier_invoices;
BEGIN
  SELECT * INTO _t FROM public.bank_transactions WHERE id = _tx FOR UPDATE;
  IF NOT public.can_write(_t.company_id) THEN RAISE EXCEPTION 'Ingen tilgang'; END IF;
  IF _t.status <> 'ny' THEN RAISE EXCEPTION 'Transaksjonen er allerede avstemt'; END IF;
  SELECT * INTO _c FROM public.companies WHERE id = _t.company_id;
  _abs := abs(_t.belop);

  IF _invoice IS NOT NULL THEN
    SELECT * INTO _i FROM public.invoices WHERE id = _invoice AND company_id = _t.company_id FOR UPDATE;
    IF _i.status <> 'sendt' THEN RAISE EXCEPTION 'Fakturaen er ikke åpen'; END IF;
    IF _t.belop <> _i.total THEN RAISE EXCEPTION 'Beløpet (%) stemmer ikke med fakturaen (%)', _t.belop, _i.total; END IF;
    _vid := public.register_invoice_payment(_invoice, _t.dato);
  ELSIF _supplier_invoice IS NOT NULL THEN
    SELECT * INTO _si FROM public.supplier_invoices WHERE id = _supplier_invoice AND company_id = _t.company_id FOR UPDATE;
    IF -_t.belop <> _si.total THEN RAISE EXCEPTION 'Beløpet (%) stemmer ikke med leverandørfakturaen (%)', _t.belop, _si.total; END IF;
    _vid := public.pay_supplier_invoice(_supplier_invoice, _t.dato);
  ELSE
    IF NOT EXISTS (SELECT 1 FROM public.accounts WHERE company_id = _t.company_id AND number = _motkonto) THEN RAISE EXCEPTION 'Ukjent konto %', _motkonto; END IF;
    INSERT INTO public.vouchers (company_id, dato, beskrivelse, kilde, created_by)
    VALUES (_t.company_id, _t.dato, _t.tekst, 'bank', auth.uid()) RETURNING id INTO _vid;
    IF _c.mva_registrert AND COALESCE(_mva_sats, 0) > 0 THEN
      _mva := round(_abs * _mva_sats / (100 + _mva_sats), 2);
    ELSE _mva := 0; END IF;
    _netto := _abs - _mva;
    IF _t.belop < 0 THEN
      _mk := CASE _mva_sats WHEN 25 THEN '2710' WHEN 15 THEN '2711' WHEN 12 THEN '2712' END;
      _kode := CASE _mva_sats WHEN 25 THEN '1' WHEN 15 THEN '11' WHEN 12 THEN '13' END;
      INSERT INTO public.voucher_lines (voucher_id, company_id, konto, tekst, debet, mva_kode, linjenr) VALUES (_vid, _t.company_id, _motkonto, _t.tekst, _netto, CASE WHEN _mva > 0 THEN _kode END, 0);
      IF _mva > 0 THEN INSERT INTO public.voucher_lines (voucher_id, company_id, konto, tekst, debet, mva_kode, linjenr) VALUES (_vid, _t.company_id, _mk, 'Inngående mva', _mva, _kode, 1); END IF;
      INSERT INTO public.voucher_lines (voucher_id, company_id, konto, tekst, kredit, linjenr) VALUES (_vid, _t.company_id, _t.bankkonto, _t.tekst, _abs, 2);
    ELSE
      _mk := CASE _mva_sats WHEN 25 THEN '2700' WHEN 15 THEN '2701' WHEN 12 THEN '2702' END;
      _kode := CASE _mva_sats WHEN 25 THEN '3' WHEN 15 THEN '31' WHEN 12 THEN '33' END;
      INSERT INTO public.voucher_lines (voucher_id, company_id, konto, tekst, debet, linjenr) VALUES (_vid, _t.company_id, _t.bankkonto, _t.tekst, _abs, 0);
      INSERT INTO public.voucher_lines (voucher_id, company_id, konto, tekst, kredit, mva_kode, linjenr) VALUES (_vid, _t.company_id, _motkonto, _t.tekst, _netto, CASE WHEN _mva > 0 THEN _kode END, 1);
      IF _mva > 0 THEN INSERT INTO public.voucher_lines (voucher_id, company_id, konto, tekst, kredit, mva_kode, linjenr) VALUES (_vid, _t.company_id, _mk, 'Utgående mva', _mva, _kode, 2); END IF;
    END IF;
    PERFORM public.post_voucher(_vid);
  END IF;
  UPDATE public.bank_transactions SET status = 'avstemt', voucher_id = _vid WHERE id = _tx;
  RETURN _vid;
END $$;
GRANT EXECUTE ON FUNCTION public.book_bank_transaction(uuid, text, numeric, uuid, uuid) TO authenticated;

-- Dokumentarkiv
CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  path text NOT NULL,
  filnavn text NOT NULL,
  mime text,
  storrelse bigint,
  sha256 text,
  voucher_id uuid REFERENCES public.vouchers(id),
  supplier_invoice_id uuid REFERENCES public.supplier_invoices(id),
  oppbevares_til date NOT NULL DEFAULT (current_date + interval '5 years' + interval '1 year')::date,
  lastet_opp_av uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read docs" ON public.documents FOR SELECT TO authenticated USING (public.is_member(company_id));
CREATE POLICY "writers insert docs" ON public.documents FOR INSERT TO authenticated WITH CHECK (public.can_write(company_id));
CREATE POLICY "writers link docs" ON public.documents FOR UPDATE TO authenticated USING (public.can_write(company_id));

-- Lønn
CREATE TABLE public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  navn text NOT NULL,
  epost text,
  stilling text,
  stillingsprosent numeric(5,2) NOT NULL DEFAULT 100,
  ansatt_dato date,
  kontonummer text,
  lonnstype text NOT NULL DEFAULT 'maaned',
  maanedslonn numeric(14,2) NOT NULL DEFAULT 0,
  timelonn numeric(14,2) NOT NULL DEFAULT 0,
  skattetrekk_prosent numeric(5,2) NOT NULL DEFAULT 30,
  otp_prosent numeric(5,2) NOT NULL DEFAULT 2,
  aktiv boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees TO authenticated;
GRANT ALL ON public.employees TO service_role;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "writers read employees" ON public.employees FOR SELECT TO authenticated USING (public.can_write(company_id));
CREATE POLICY "writers insert employees" ON public.employees FOR INSERT TO authenticated WITH CHECK (public.can_write(company_id));
CREATE POLICY "writers update employees" ON public.employees FOR UPDATE TO authenticated USING (public.can_write(company_id));

CREATE TABLE public.payroll_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  periode text NOT NULL,
  utbetalingsdato date NOT NULL,
  status text NOT NULL DEFAULT 'utkast',
  voucher_id uuid REFERENCES public.vouchers(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_runs TO authenticated;
GRANT ALL ON public.payroll_runs TO service_role;
ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "writers read runs" ON public.payroll_runs FOR SELECT TO authenticated USING (public.can_write(company_id));
CREATE POLICY "writers insert runs" ON public.payroll_runs FOR INSERT TO authenticated WITH CHECK (public.can_write(company_id) AND status = 'utkast');
CREATE POLICY "writers update runs" ON public.payroll_runs FOR UPDATE TO authenticated USING (public.can_write(company_id) AND status = 'utkast');
CREATE POLICY "writers delete runs" ON public.payroll_runs FOR DELETE TO authenticated USING (public.can_write(company_id) AND status = 'utkast');

CREATE TABLE public.payroll_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id),
  timer numeric(8,2) NOT NULL DEFAULT 0,
  brutto numeric(14,2) NOT NULL DEFAULT 0,
  tillegg numeric(14,2) NOT NULL DEFAULT 0,
  skattetrekk numeric(14,2) NOT NULL DEFAULT 0,
  feriepenger numeric(14,2) NOT NULL DEFAULT 0,
  otp numeric(14,2) NOT NULL DEFAULT 0,
  aga numeric(14,2) NOT NULL DEFAULT 0,
  netto numeric(14,2) NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_lines TO authenticated;
GRANT ALL ON public.payroll_lines TO service_role;
ALTER TABLE public.payroll_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "writers rw payroll lines" ON public.payroll_lines FOR ALL TO authenticated
  USING (public.can_write(company_id) AND EXISTS (SELECT 1 FROM public.payroll_runs r WHERE r.id = run_id AND r.status = 'utkast'))
  WITH CHECK (public.can_write(company_id) AND EXISTS (SELECT 1 FROM public.payroll_runs r WHERE r.id = run_id AND r.status = 'utkast' AND r.company_id = payroll_lines.company_id));
CREATE POLICY "writers read payroll lines" ON public.payroll_lines FOR SELECT TO authenticated USING (public.can_write(company_id));

CREATE OR REPLACE FUNCTION public.book_payroll(_run uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _r public.payroll_runs; _vid uuid; s record;
BEGIN
  SELECT * INTO _r FROM public.payroll_runs WHERE id = _run FOR UPDATE;
  IF NOT public.can_write(_r.company_id) THEN RAISE EXCEPTION 'Ingen tilgang'; END IF;
  IF _r.status <> 'utkast' THEN RAISE EXCEPTION 'Lønnskjøringen er allerede bokført'; END IF;
  SELECT COALESCE(sum(brutto + tillegg),0) b, COALESCE(sum(skattetrekk),0) t, COALESCE(sum(feriepenger),0) f, COALESCE(sum(otp),0) o, COALESCE(sum(aga),0) a, COALESCE(sum(netto),0) n, count(*) c
    INTO s FROM public.payroll_lines WHERE run_id = _run;
  IF s.c = 0 THEN RAISE EXCEPTION 'Ingen ansatte i lønnskjøringen'; END IF;
  INSERT INTO public.vouchers (company_id, dato, beskrivelse, kilde, created_by)
  VALUES (_r.company_id, _r.utbetalingsdato, 'Lønn ' || _r.periode, 'lonn', auth.uid()) RETURNING id INTO _vid;
  INSERT INTO public.voucher_lines (voucher_id, company_id, konto, tekst, debet, linjenr) VALUES
    (_vid, _r.company_id, '5000', 'Lønn', s.b, 0),
    (_vid, _r.company_id, '5092', 'Feriepenger', s.f, 1),
    (_vid, _r.company_id, '5400', 'Arbeidsgiveravgift', s.a, 2),
    (_vid, _r.company_id, '5420', 'Obligatorisk tjenestepensjon (OTP)', s.o, 3);
  INSERT INTO public.voucher_lines (voucher_id, company_id, konto, tekst, kredit, linjenr) VALUES
    (_vid, _r.company_id, '2600', 'Forskuddstrekk', s.t, 4),
    (_vid, _r.company_id, '2940', 'Skyldige feriepenger', s.f, 5),
    (_vid, _r.company_id, '2770', 'Skyldig arbeidsgiveravgift', s.a, 6),
    (_vid, _r.company_id, '2990', 'Skyldig pensjon', s.o, 7),
    (_vid, _r.company_id, '1920', 'Utbetalt nettolønn', s.n, 8);
  DELETE FROM public.voucher_lines WHERE voucher_id = _vid AND debet = 0 AND kredit = 0;
  PERFORM public.post_voucher(_vid);
  UPDATE public.payroll_runs SET status = 'bokfort', voucher_id = _vid WHERE id = _run;
  RETURN _vid;
END $$;
GRANT EXECUTE ON FUNCTION public.book_payroll(uuid) TO authenticated;

-- Seed new accounts into templates and existing companies
INSERT INTO public.account_templates (number, name, mva_kode, kun_for) VALUES
('1900','Kontanter',NULL,NULL),
('2780','Påløpt arbeidsgiveravgift på feriepenger',NULL,NULL)
ON CONFLICT (number) DO NOTHING;
INSERT INTO public.accounts (company_id, number, name, mva_kode)
SELECT c.id, t.number, t.name, t.mva_kode FROM public.companies c CROSS JOIN public.account_templates t
WHERE (t.kun_for IS NULL OR t.kun_for = c.company_type)
ON CONFLICT (company_id, number) DO NOTHING;
