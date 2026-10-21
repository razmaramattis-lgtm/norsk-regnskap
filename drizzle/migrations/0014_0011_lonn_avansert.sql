-- Avansert lønn: lønnsarter (poster per ansatt), naturalytelser, trekkfrie godtgjørelser, trekk i lønn,
-- tabelltrekk med halvt trekk, og feriepenger for 60+. Bokføringen skjer fortsatt i book_payroll.

INSERT INTO public.account_templates (number, name, mva_kode, kun_for) VALUES
('5280','Annen fordel i arbeidsforhold',NULL,NULL),
('5290','Motkonto for gruppe 52',NULL,NULL),
('7130','Reisekostnad, oppgavepliktig',NULL,NULL)
ON CONFLICT (number) DO NOTHING;
INSERT INTO public.accounts (company_id, number, name, mva_kode)
SELECT c.id, t.number, t.name, t.mva_kode FROM public.companies c CROSS JOIN public.account_templates t
WHERE t.number IN ('5280','5290','7130') AND (t.kun_for IS NULL OR t.kun_for = c.company_type)
ON CONFLICT (company_id, number) DO NOTHING;

ALTER TABLE public.employees
  ADD COLUMN fodselsdato date,
  ADD COLUMN trekkmetode text NOT NULL DEFAULT 'prosent' CHECK (trekkmetode IN ('prosent','tabell')),
  ADD COLUMN tabelltrekk numeric(14,2) NOT NULL DEFAULT 0 CHECK (tabelltrekk >= 0),
  ADD COLUMN trekktabell text;

ALTER TABLE public.payroll_runs ADD COLUMN halvt_trekk boolean NOT NULL DEFAULT false;

ALTER TABLE public.payroll_lines
  ADD COLUMN naturalytelse numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN godtgjorelse numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN trekk numeric(14,2) NOT NULL DEFAULT 0,
  -- [{lonnsart, navn, kategori, konto, amelding, antall, sats, belop}] – grunnlag for lønnsslipp og a-melding
  ADD COLUMN poster jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(poster) = 'array');

CREATE OR REPLACE FUNCTION public.book_payroll(_run uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _r public.payroll_runs; _vid uuid; s record; p record; _nr int := 0;
BEGIN
  SELECT * INTO _r FROM public.payroll_runs WHERE id = _run FOR UPDATE;
  IF NOT public.can_write(_r.company_id) THEN RAISE EXCEPTION 'Ingen tilgang'; END IF;
  IF _r.status <> 'utkast' THEN RAISE EXCEPTION 'Lønnskjøringen er allerede bokført'; END IF;
  SELECT COALESCE(sum(brutto + tillegg),0) b, COALESCE(sum(skattetrekk),0) t, COALESCE(sum(feriepenger),0) f,
         COALESCE(sum(otp),0) o, COALESCE(sum(aga),0) a, COALESCE(sum(netto),0) n, COALESCE(sum(naturalytelse),0) na,
         COALESCE(sum(godtgjorelse),0) g, COALESCE(sum(trekk),0) tr, count(*) c
    INTO s FROM public.payroll_lines WHERE run_id = _run;
  IF s.c = 0 THEN RAISE EXCEPTION 'Ingen ansatte i lønnskjøringen'; END IF;
  -- Netto må stemme med postene, ellers balanserer ikke bilaget
  IF round(s.b - s.t - s.tr + s.g, 2) <> round(s.n, 2) THEN
    RAISE EXCEPTION 'Netto lønn stemmer ikke med lønn, trekk og godtgjørelser';
  END IF;

  INSERT INTO public.vouchers (company_id, dato, beskrivelse, kilde, created_by)
  VALUES (_r.company_id, _r.utbetalingsdato, 'Lønn ' || _r.periode, 'lonn', auth.uid()) RETURNING id INTO _vid;
  INSERT INTO public.voucher_lines (voucher_id, company_id, konto, tekst, debet, kredit, linjenr) VALUES
    (_vid, _r.company_id, '5000', 'Lønn', s.b, 0, 0),
    (_vid, _r.company_id, '5092', 'Feriepenger', s.f, 0, 1),
    (_vid, _r.company_id, '5400', 'Arbeidsgiveravgift', s.a, 0, 2),
    (_vid, _r.company_id, '5420', 'Obligatorisk tjenestepensjon (OTP)', s.o, 0, 3),
    (_vid, _r.company_id, '5280', 'Naturalytelser', s.na, 0, 4),
    (_vid, _r.company_id, '5290', 'Motkonto naturalytelser', 0, s.na, 5),
    (_vid, _r.company_id, '2600', 'Forskuddstrekk', 0, s.t, 6),
    (_vid, _r.company_id, '2940', 'Skyldige feriepenger', 0, s.f, 7),
    (_vid, _r.company_id, '2770', 'Skyldig arbeidsgiveravgift', 0, s.a, 8),
    (_vid, _r.company_id, '2990', 'Skyldig pensjon', 0, s.o, 9),
    (_vid, _r.company_id, '1920', 'Utbetalt nettolønn', 0, s.n, 10);
  _nr := 11;
  -- Trekkfrie godtgjørelser (debet) og trekk i lønn (kredit) per konto fra postene
  FOR p IN
    SELECT e->>'kategori' AS kategori, e->>'konto' AS konto, min(e->>'navn') AS navn, sum((e->>'belop')::numeric) AS belop
    FROM public.payroll_lines l, jsonb_array_elements(l.poster) e
    WHERE l.run_id = _run AND e->>'kategori' IN ('godtgjorelse','trekk')
    GROUP BY 1, 2
  LOOP
    IF p.konto IS NULL OR p.konto !~ '^\d{4,6}$' THEN RAISE EXCEPTION 'Lønnsart % mangler konto', p.navn; END IF;
    INSERT INTO public.voucher_lines (voucher_id, company_id, konto, tekst, debet, kredit, linjenr)
    VALUES (_vid, _r.company_id, p.konto, p.navn,
            CASE WHEN p.kategori = 'godtgjorelse' THEN p.belop ELSE 0 END,
            CASE WHEN p.kategori = 'trekk' THEN p.belop ELSE 0 END, _nr);
    _nr := _nr + 1;
  END LOOP;
  DELETE FROM public.voucher_lines WHERE voucher_id = _vid AND debet = 0 AND kredit = 0;
  PERFORM public.post_voucher(_vid);
  UPDATE public.payroll_runs SET status = 'bokfort', voucher_id = _vid WHERE id = _run;
  RETURN _vid;
END $$;
GRANT EXECUTE ON FUNCTION public.book_payroll(uuid) TO authenticated;