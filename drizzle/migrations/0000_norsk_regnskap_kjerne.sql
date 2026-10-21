
CREATE TYPE public.company_type AS ENUM ('enk','as');
CREATE TYPE public.member_role AS ENUM ('eier','admin','regnskapsforer','leser');
CREATE TYPE public.voucher_status AS ENUM ('utkast','bokfort');
CREATE TYPE public.invoice_status AS ENUM ('utkast','sendt','betalt','kreditert');

-- Profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'), NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Companies
CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  org_nr text,
  company_type public.company_type NOT NULL DEFAULT 'as',
  mva_registrert boolean NOT NULL DEFAULT true,
  mva_termin text NOT NULL DEFAULT 'tomaaned',
  adresse text, postnr text, poststed text,
  kontonummer text,
  epost text,
  regnskapsaar_start int NOT NULL DEFAULT 1,
  neste_bilagsnr int NOT NULL DEFAULT 1,
  neste_fakturanr int NOT NULL DEFAULT 10001,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;

CREATE TABLE public.company_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.member_role NOT NULL DEFAULT 'leser',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_members TO authenticated;
GRANT ALL ON public.company_members TO service_role;

CREATE TABLE public.company_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  email text NOT NULL,
  role public.member_role NOT NULL DEFAULT 'regnskapsforer',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, email)
);
GRANT SELECT, INSERT, DELETE ON public.company_invites TO authenticated;
GRANT ALL ON public.company_invites TO service_role;

CREATE OR REPLACE FUNCTION public.is_member(_company uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.company_members WHERE company_id = _company AND user_id = auth.uid())
$$;
CREATE OR REPLACE FUNCTION public.can_write(_company uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.company_members WHERE company_id = _company AND user_id = auth.uid() AND role IN ('eier','admin','regnskapsforer'))
$$;
CREATE OR REPLACE FUNCTION public.is_admin(_company uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.company_members WHERE company_id = _company AND user_id = auth.uid() AND role IN ('eier','admin'))
$$;

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read company" ON public.companies FOR SELECT TO authenticated USING (public.is_member(id) OR created_by = auth.uid());
CREATE POLICY "create company" ON public.companies FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "admins update company" ON public.companies FOR UPDATE TO authenticated USING (public.is_admin(id));
CREATE POLICY "owner delete company" ON public.companies FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.company_members m WHERE m.company_id = id AND m.user_id = auth.uid() AND m.role = 'eier'));

ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read members" ON public.company_members FOR SELECT TO authenticated USING (public.is_member(company_id));
CREATE POLICY "admins manage members" ON public.company_members FOR UPDATE TO authenticated USING (public.is_admin(company_id));
CREATE POLICY "admins delete members" ON public.company_members FOR DELETE TO authenticated USING (public.is_admin(company_id) AND user_id <> auth.uid());

ALTER TABLE public.company_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read invites" ON public.company_invites FOR SELECT TO authenticated USING (public.is_admin(company_id));
CREATE POLICY "admins add invites" ON public.company_invites FOR INSERT TO authenticated WITH CHECK (public.is_admin(company_id));
CREATE POLICY "admins delete invites" ON public.company_invites FOR DELETE TO authenticated USING (public.is_admin(company_id));

-- Kontoplan-mal (NS 4102)
CREATE TABLE public.account_templates (
  number text PRIMARY KEY,
  name text NOT NULL,
  mva_kode text,
  kun_for public.company_type
);
GRANT SELECT ON public.account_templates TO authenticated;
GRANT ALL ON public.account_templates TO service_role;
ALTER TABLE public.account_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read templates" ON public.account_templates FOR SELECT TO authenticated USING (true);

INSERT INTO public.account_templates (number, name, mva_kode, kun_for) VALUES
('1000','Forskning og utvikling',NULL,NULL),
('1080','Goodwill',NULL,NULL),
('1200','Maskiner og anlegg',NULL,NULL),
('1230','Personbiler',NULL,NULL),
('1250','Inventar',NULL,NULL),
('1270','Verktøy',NULL,NULL),
('1280','Kontormaskiner',NULL,NULL),
('1300','Investeringer i datterselskap',NULL,'as'),
('1350','Investeringer i aksjer og andeler',NULL,NULL),
('1460','Innkjøpte varer for videresalg',NULL,NULL),
('1500','Kundefordringer',NULL,NULL),
('1570','Andre kortsiktige fordringer',NULL,NULL),
('1700','Forskuddsbetalt kostnad',NULL,NULL),
('1920','Bankinnskudd',NULL,NULL),
('1950','Bankinnskudd for skattetrekk',NULL,NULL),
('2000','Aksjekapital',NULL,'as'),
('2020','Overkursfond',NULL,'as'),
('2050','Annen egenkapital',NULL,'as'),
('2050','Egenkapital',NULL,'enk'),
('2080','Udekket tap',NULL,'as'),
('2800','Avsatt utbytte',NULL,'as'),
('2500','Betalbar skatt, ikke utlignet',NULL,'as'),
('2510','Betalbar skatt, utlignet',NULL,'as'),
('2400','Leverandørgjeld',NULL,NULL),
('2600','Forskuddstrekk',NULL,NULL),
('2700','Utgående merverdiavgift, høy sats','3',NULL),
('2701','Utgående merverdiavgift, middels sats','31',NULL),
('2702','Utgående merverdiavgift, lav sats','33',NULL),
('2710','Inngående merverdiavgift, høy sats','1',NULL),
('2711','Inngående merverdiavgift, middels sats','11',NULL),
('2712','Inngående merverdiavgift, lav sats','13',NULL),
('2740','Oppgjørskonto merverdiavgift',NULL,NULL),
('2770','Skyldig arbeidsgiveravgift',NULL,NULL),
('2780','Påløpt arbeidsgiveravgift på feriepenger',NULL,NULL),
('2910','Gjeld til ansatte og eiere',NULL,NULL),
('2940','Skyldige feriepenger',NULL,NULL),
('2990','Annen kortsiktig gjeld',NULL,NULL),
('3000','Salgsinntekt, avgiftspliktig høy sats','3',NULL),
('3010','Salgsinntekt, avgiftspliktig middels sats','31',NULL),
('3020','Salgsinntekt, avgiftspliktig lav sats','33',NULL),
('3100','Salgsinntekt, avgiftsfri','5',NULL),
('3200','Salgsinntekt, utenfor avgiftsområdet','6',NULL),
('3250','Salgsinntekt, eksport','52',NULL),
('3600','Leieinntekt fast eiendom',NULL,NULL),
('3900','Annen driftsrelatert inntekt',NULL,NULL),
('4000','Innkjøp av råvarer og halvfabrikata','1',NULL),
('4300','Innkjøp av varer for videresalg','1',NULL),
('4500','Fremmedytelser og underentreprise','1',NULL),
('5000','Lønn til ansatte',NULL,NULL),
('5090','Påløpte, ikke utbetalte lønninger',NULL,NULL),
('5092','Feriepenger',NULL,NULL),
('5400','Arbeidsgiveravgift',NULL,NULL),
('5420','Innberetningspliktig pensjonskostnad',NULL,NULL),
('5900','Annen personalkostnad',NULL,NULL),
('6000','Avskrivning på bygninger og annen fast eiendom',NULL,NULL),
('6010','Avskrivning på transportmidler, maskiner og inventar',NULL,NULL),
('6300','Leie lokale','1',NULL),
('6340','Lys, varme','1',NULL),
('6540','Inventar','1',NULL),
('6551','Datautstyr (hardware)','1',NULL),
('6552','Programvare (software)','1',NULL),
('6700','Fremmed tjeneste (regnskap, revisjon, rådgivning)','1',NULL),
('6800','Kontorrekvisita','1',NULL),
('6860','Møte, kurs, oppdatering','1',NULL),
('6900','Elektronisk kommunikasjon (telefon, internett)','1',NULL),
('7000','Drivstoff','1',NULL),
('7100','Bilgodtgjørelse, oppgavepliktig',NULL,NULL),
('7140','Reisekostnad, ikke oppgavepliktig','1',NULL),
('7320','Reklamekostnad','1',NULL),
('7350','Representasjon, fradragsberettiget',NULL,NULL),
('7500','Forsikringspremie',NULL,NULL),
('7770','Bank- og kortgebyrer',NULL,NULL),
('7790','Annen kostnad, fradragsberettiget',NULL,NULL),
('8040','Renteinntekt',NULL,NULL),
('8060','Valutagevinst (agio)',NULL,NULL),
('8140','Rentekostnad',NULL,NULL),
('8160','Valutatap (disagio)',NULL,NULL),
('8300','Betalbar skatt',NULL,'as'),
('8320','Endring utsatt skatt',NULL,'as'),
('8800','Årsresultat',NULL,NULL),
('8920','Avsatt utbytte',NULL,'as'),
('8960','Overføringer annen egenkapital',NULL,'as'),
('2010','Privatuttak',NULL,'enk')
ON CONFLICT (number) DO NOTHING;

CREATE TABLE public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  number text NOT NULL,
  name text NOT NULL,
  mva_kode text,
  aktiv boolean NOT NULL DEFAULT true,
  UNIQUE (company_id, number)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts TO authenticated;
GRANT ALL ON public.accounts TO service_role;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read accounts" ON public.accounts FOR SELECT TO authenticated USING (public.is_member(company_id));
CREATE POLICY "writers insert accounts" ON public.accounts FOR INSERT TO authenticated WITH CHECK (public.can_write(company_id));
CREATE POLICY "writers update accounts" ON public.accounts FOR UPDATE TO authenticated USING (public.can_write(company_id));

-- On company insert: add creator as owner + seed chart
CREATE OR REPLACE FUNCTION public.handle_new_company() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.company_members (company_id, user_id, role) VALUES (NEW.id, NEW.created_by, 'eier');
  INSERT INTO public.accounts (company_id, number, name, mva_kode)
  SELECT NEW.id, number, name, CASE WHEN NEW.mva_registrert THEN mva_kode ELSE NULL END
  FROM public.account_templates WHERE kun_for IS NULL OR kun_for = NEW.company_type;
  IF NEW.company_type = 'enk' THEN
    UPDATE public.accounts SET name = 'Egenkapital' WHERE company_id = NEW.id AND number = '2050';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER on_company_created AFTER INSERT ON public.companies FOR EACH ROW EXECUTE FUNCTION public.handle_new_company();

-- Accept invites when signed-in user's email matches (verified email via auth)
CREATE OR REPLACE FUNCTION public.accept_my_invites() RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _email text; _n int;
BEGIN
  SELECT email INTO _email FROM auth.users WHERE id = auth.uid() AND email_confirmed_at IS NOT NULL;
  IF _email IS NULL THEN RETURN 0; END IF;
  INSERT INTO public.company_members (company_id, user_id, role)
  SELECT company_id, auth.uid(), role FROM public.company_invites WHERE lower(email) = lower(_email)
  ON CONFLICT (company_id, user_id) DO NOTHING;
  GET DIAGNOSTICS _n = ROW_COUNT;
  DELETE FROM public.company_invites WHERE lower(email) = lower(_email);
  RETURN _n;
END $$;
GRANT EXECUTE ON FUNCTION public.accept_my_invites() TO authenticated;

-- Bilag (vouchers)
CREATE TABLE public.vouchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  bilagsnr int,
  dato date NOT NULL DEFAULT current_date,
  beskrivelse text NOT NULL DEFAULT '',
  status public.voucher_status NOT NULL DEFAULT 'utkast',
  kilde text NOT NULL DEFAULT 'manuell',
  korrigerer uuid REFERENCES public.vouchers(id),
  bokfort_at timestamptz,
  bokfort_av uuid,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, bilagsnr)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vouchers TO authenticated;
GRANT ALL ON public.vouchers TO service_role;
ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read vouchers" ON public.vouchers FOR SELECT TO authenticated USING (public.is_member(company_id));
CREATE POLICY "writers insert vouchers" ON public.vouchers FOR INSERT TO authenticated WITH CHECK (public.can_write(company_id) AND status = 'utkast');
CREATE POLICY "writers update draft vouchers" ON public.vouchers FOR UPDATE TO authenticated USING (public.can_write(company_id) AND status = 'utkast');
CREATE POLICY "writers delete draft vouchers" ON public.vouchers FOR DELETE TO authenticated USING (public.can_write(company_id) AND status = 'utkast');

CREATE TABLE public.voucher_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id uuid NOT NULL REFERENCES public.vouchers(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  konto text NOT NULL,
  tekst text,
  debet numeric(14,2) NOT NULL DEFAULT 0,
  kredit numeric(14,2) NOT NULL DEFAULT 0,
  mva_kode text,
  linjenr int NOT NULL DEFAULT 0,
  CHECK (debet >= 0 AND kredit >= 0)
);
CREATE INDEX ON public.voucher_lines (company_id, konto);
CREATE INDEX ON public.voucher_lines (voucher_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.voucher_lines TO authenticated;
GRANT ALL ON public.voucher_lines TO service_role;
ALTER TABLE public.voucher_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read lines" ON public.voucher_lines FOR SELECT TO authenticated USING (public.is_member(company_id));
CREATE POLICY "writers insert lines" ON public.voucher_lines FOR INSERT TO authenticated WITH CHECK (public.can_write(company_id) AND EXISTS (SELECT 1 FROM public.vouchers v WHERE v.id = voucher_id AND v.status = 'utkast' AND v.company_id = voucher_lines.company_id));
CREATE POLICY "writers update lines" ON public.voucher_lines FOR UPDATE TO authenticated USING (public.can_write(company_id) AND EXISTS (SELECT 1 FROM public.vouchers v WHERE v.id = voucher_id AND v.status = 'utkast'));
CREATE POLICY "writers delete lines" ON public.voucher_lines FOR DELETE TO authenticated USING (public.can_write(company_id) AND EXISTS (SELECT 1 FROM public.vouchers v WHERE v.id = voucher_id AND v.status = 'utkast'));

-- Immutability (bokføringsloven): posted vouchers and their lines cannot change
CREATE OR REPLACE FUNCTION public.protect_posted_voucher() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'bokfort' THEN RAISE EXCEPTION 'Bokførte bilag kan ikke slettes. Lag et korreksjonsbilag.'; END IF;
    RETURN OLD;
  END IF;
  IF OLD.status = 'bokfort' THEN RAISE EXCEPTION 'Bokførte bilag kan ikke endres. Lag et korreksjonsbilag.'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER protect_posted_voucher BEFORE UPDATE OR DELETE ON public.vouchers FOR EACH ROW EXECUTE FUNCTION public.protect_posted_voucher();

CREATE OR REPLACE FUNCTION public.protect_posted_lines() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE _vid uuid := COALESCE(NEW.voucher_id, OLD.voucher_id);
BEGIN
  IF EXISTS (SELECT 1 FROM public.vouchers WHERE id = _vid AND status = 'bokfort') THEN
    RAISE EXCEPTION 'Linjer på bokførte bilag kan ikke endres.';
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
CREATE TRIGGER protect_posted_lines BEFORE INSERT OR UPDATE OR DELETE ON public.voucher_lines FOR EACH ROW EXECUTE FUNCTION public.protect_posted_lines();

-- Post voucher: balance check + sequential number
CREATE OR REPLACE FUNCTION public.post_voucher(_voucher uuid) RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _v public.vouchers; _d numeric; _k numeric; _n int; _cnt int;
BEGIN
  SELECT * INTO _v FROM public.vouchers WHERE id = _voucher FOR UPDATE;
  IF _v.id IS NULL THEN RAISE EXCEPTION 'Bilag finnes ikke'; END IF;
  IF NOT public.can_write(_v.company_id) THEN RAISE EXCEPTION 'Ingen tilgang'; END IF;
  IF _v.status = 'bokfort' THEN RAISE EXCEPTION 'Bilaget er allerede bokført'; END IF;
  SELECT COALESCE(sum(debet),0), COALESCE(sum(kredit),0), count(*) INTO _d, _k, _cnt FROM public.voucher_lines WHERE voucher_id = _voucher;
  IF _cnt < 2 THEN RAISE EXCEPTION 'Et bilag må ha minst to linjer'; END IF;
  IF _d <> _k THEN RAISE EXCEPTION 'Bilaget balanserer ikke (debet % / kredit %)', _d, _k; END IF;
  IF _d = 0 THEN RAISE EXCEPTION 'Bilaget har ingen beløp'; END IF;
  UPDATE public.companies SET neste_bilagsnr = neste_bilagsnr + 1 WHERE id = _v.company_id RETURNING neste_bilagsnr - 1 INTO _n;
  -- bypass protect trigger: status still utkast at this point
  UPDATE public.vouchers SET status = 'bokfort', bilagsnr = _n, bokfort_at = now(), bokfort_av = auth.uid() WHERE id = _voucher;
  RETURN _n;
END $$;
GRANT EXECUTE ON FUNCTION public.post_voucher(uuid) TO authenticated;

-- Correction voucher (reversal)
CREATE OR REPLACE FUNCTION public.reverse_voucher(_voucher uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _v public.vouchers; _new uuid;
BEGIN
  SELECT * INTO _v FROM public.vouchers WHERE id = _voucher;
  IF NOT public.can_write(_v.company_id) THEN RAISE EXCEPTION 'Ingen tilgang'; END IF;
  IF _v.status <> 'bokfort' THEN RAISE EXCEPTION 'Kun bokførte bilag kan korrigeres'; END IF;
  INSERT INTO public.vouchers (company_id, dato, beskrivelse, kilde, korrigerer, created_by)
  VALUES (_v.company_id, current_date, 'Korreksjon av bilag ' || _v.bilagsnr || ': ' || _v.beskrivelse, 'korreksjon', _v.id, auth.uid()) RETURNING id INTO _new;
  INSERT INTO public.voucher_lines (voucher_id, company_id, konto, tekst, debet, kredit, mva_kode, linjenr)
  SELECT _new, company_id, konto, tekst, kredit, debet, mva_kode, linjenr FROM public.voucher_lines WHERE voucher_id = _voucher;
  PERFORM public.post_voucher(_new);
  RETURN _new;
END $$;
GRANT EXECUTE ON FUNCTION public.reverse_voucher(uuid) TO authenticated;

-- Kunder
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  navn text NOT NULL,
  org_nr text,
  epost text,
  adresse text, postnr text, poststed text,
  land text NOT NULL DEFAULT 'NO',
  betalingsfrist int NOT NULL DEFAULT 14,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read customers" ON public.customers FOR SELECT TO authenticated USING (public.is_member(company_id));
CREATE POLICY "writers insert customers" ON public.customers FOR INSERT TO authenticated WITH CHECK (public.can_write(company_id));
CREATE POLICY "writers update customers" ON public.customers FOR UPDATE TO authenticated USING (public.can_write(company_id));
CREATE POLICY "writers delete customers" ON public.customers FOR DELETE TO authenticated USING (public.can_write(company_id));

-- Fakturaer
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id),
  fakturanr int,
  fakturadato date NOT NULL DEFAULT current_date,
  forfallsdato date NOT NULL DEFAULT (current_date + 14),
  kid text,
  status public.invoice_status NOT NULL DEFAULT 'utkast',
  netto numeric(14,2) NOT NULL DEFAULT 0,
  mva numeric(14,2) NOT NULL DEFAULT 0,
  total numeric(14,2) NOT NULL DEFAULT 0,
  merknad text,
  voucher_id uuid REFERENCES public.vouchers(id),
  betalt_voucher_id uuid REFERENCES public.vouchers(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read invoices" ON public.invoices FOR SELECT TO authenticated USING (public.is_member(company_id));
CREATE POLICY "writers insert invoices" ON public.invoices FOR INSERT TO authenticated WITH CHECK (public.can_write(company_id) AND status = 'utkast');
CREATE POLICY "writers update draft invoices" ON public.invoices FOR UPDATE TO authenticated USING (public.can_write(company_id) AND status = 'utkast');
CREATE POLICY "writers delete draft invoices" ON public.invoices FOR DELETE TO authenticated USING (public.can_write(company_id) AND status = 'utkast');

CREATE TABLE public.invoice_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  beskrivelse text NOT NULL,
  antall numeric(12,2) NOT NULL DEFAULT 1,
  enhetspris numeric(14,2) NOT NULL DEFAULT 0,
  mva_sats numeric(5,2) NOT NULL DEFAULT 25,
  linjenr int NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_lines TO authenticated;
GRANT ALL ON public.invoice_lines TO service_role;
ALTER TABLE public.invoice_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read invoice lines" ON public.invoice_lines FOR SELECT TO authenticated USING (public.is_member(company_id));
CREATE POLICY "writers write invoice lines" ON public.invoice_lines FOR ALL TO authenticated
  USING (public.can_write(company_id) AND EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND i.status = 'utkast'))
  WITH CHECK (public.can_write(company_id) AND EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND i.status = 'utkast' AND i.company_id = invoice_lines.company_id));

-- KID mod10 (Luhn)
CREATE OR REPLACE FUNCTION public.kid_mod10(_base text) RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE s int := 0; d int; i int; dbl boolean := true;
BEGIN
  FOR i IN REVERSE length(_base)..1 LOOP
    d := substr(_base, i, 1)::int;
    IF dbl THEN d := d * 2; IF d > 9 THEN d := d - 9; END IF; END IF;
    s := s + d; dbl := NOT dbl;
  END LOOP;
  RETURN _base || ((10 - (s % 10)) % 10)::text;
END $$;

-- Send invoice: number, KID, voucher (1500 / 3xxx / 27xx)
CREATE OR REPLACE FUNCTION public.send_invoice(_invoice uuid) RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _i public.invoices; _c public.companies; _cust public.customers; _nr int; _vid uuid; _netto numeric := 0; _mva numeric := 0; r record; _ln int := 1;
  _inntekt text; _mvakonto text; _kode text;
BEGIN
  SELECT * INTO _i FROM public.invoices WHERE id = _invoice FOR UPDATE;
  IF NOT public.can_write(_i.company_id) THEN RAISE EXCEPTION 'Ingen tilgang'; END IF;
  IF _i.status <> 'utkast' THEN RAISE EXCEPTION 'Fakturaen er allerede sendt'; END IF;
  SELECT * INTO _c FROM public.companies WHERE id = _i.company_id;
  SELECT * INTO _cust FROM public.customers WHERE id = _i.customer_id;
  IF NOT EXISTS (SELECT 1 FROM public.invoice_lines WHERE invoice_id = _invoice) THEN RAISE EXCEPTION 'Fakturaen har ingen linjer'; END IF;

  UPDATE public.companies SET neste_fakturanr = neste_fakturanr + 1 WHERE id = _c.id RETURNING neste_fakturanr - 1 INTO _nr;

  INSERT INTO public.vouchers (company_id, dato, beskrivelse, kilde, created_by)
  VALUES (_i.company_id, _i.fakturadato, 'Faktura ' || _nr || ' – ' || _cust.navn, 'faktura', auth.uid()) RETURNING id INTO _vid;

  FOR r IN SELECT mva_sats, round(sum(antall * enhetspris), 2) AS netto FROM public.invoice_lines WHERE invoice_id = _invoice GROUP BY mva_sats LOOP
    IF NOT _c.mva_registrert THEN
      _inntekt := '3200'; _mvakonto := NULL; _kode := NULL;
    ELSIF r.mva_sats = 25 THEN _inntekt := '3000'; _mvakonto := '2700'; _kode := '3';
    ELSIF r.mva_sats = 15 THEN _inntekt := '3010'; _mvakonto := '2701'; _kode := '31';
    ELSIF r.mva_sats = 12 THEN _inntekt := '3020'; _mvakonto := '2702'; _kode := '33';
    ELSIF _cust.land <> 'NO' THEN _inntekt := '3250'; _mvakonto := NULL; _kode := '52';
    ELSE _inntekt := '3100'; _mvakonto := NULL; _kode := '5';
    END IF;
    INSERT INTO public.voucher_lines (voucher_id, company_id, konto, tekst, kredit, mva_kode, linjenr)
      VALUES (_vid, _i.company_id, _inntekt, 'Salg ' || r.mva_sats || '%', r.netto, _kode, _ln); _ln := _ln + 1;
    _netto := _netto + r.netto;
    IF _mvakonto IS NOT NULL AND r.mva_sats > 0 THEN
      INSERT INTO public.voucher_lines (voucher_id, company_id, konto, tekst, kredit, mva_kode, linjenr)
        VALUES (_vid, _i.company_id, _mvakonto, 'Utgående mva ' || r.mva_sats || '%', round(r.netto * r.mva_sats / 100, 2), _kode, _ln); _ln := _ln + 1;
      _mva := _mva + round(r.netto * r.mva_sats / 100, 2);
    END IF;
  END LOOP;
  INSERT INTO public.voucher_lines (voucher_id, company_id, konto, tekst, debet, linjenr)
    VALUES (_vid, _i.company_id, '1500', 'Kundefordring ' || _cust.navn, _netto + _mva, 0);
  PERFORM public.post_voucher(_vid);

  UPDATE public.invoices SET status = 'sendt', fakturanr = _nr, kid = public.kid_mod10(lpad(_nr::text, 8, '0')),
    netto = _netto, mva = _mva, total = _netto + _mva, voucher_id = _vid,
    forfallsdato = _i.fakturadato + _cust.betalingsfrist
  WHERE id = _invoice;
  RETURN _nr;
END $$;
GRANT EXECUTE ON FUNCTION public.send_invoice(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.register_invoice_payment(_invoice uuid, _dato date) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _i public.invoices; _vid uuid;
BEGIN
  SELECT * INTO _i FROM public.invoices WHERE id = _invoice FOR UPDATE;
  IF NOT public.can_write(_i.company_id) THEN RAISE EXCEPTION 'Ingen tilgang'; END IF;
  IF _i.status <> 'sendt' THEN RAISE EXCEPTION 'Kun sendte fakturaer kan registreres som betalt'; END IF;
  INSERT INTO public.vouchers (company_id, dato, beskrivelse, kilde, created_by)
  VALUES (_i.company_id, _dato, 'Innbetaling faktura ' || _i.fakturanr, 'innbetaling', auth.uid()) RETURNING id INTO _vid;
  INSERT INTO public.voucher_lines (voucher_id, company_id, konto, tekst, debet, linjenr) VALUES (_vid, _i.company_id, '1920', 'Innbetaling', _i.total, 0);
  INSERT INTO public.voucher_lines (voucher_id, company_id, konto, tekst, kredit, linjenr) VALUES (_vid, _i.company_id, '1500', 'Kundefordring', _i.total, 1);
  PERFORM public.post_voucher(_vid);
  UPDATE public.invoices SET status = 'betalt', betalt_voucher_id = _vid WHERE id = _invoice;
  RETURN _vid;
END $$;
GRANT EXECUTE ON FUNCTION public.register_invoice_payment(uuid, date) TO authenticated;

-- Allow the definer functions to bypass the status-based update policy (they run as owner; RLS bypassed).
-- Saldo per konto view
CREATE OR REPLACE VIEW public.account_balances WITH (security_invoker = true) AS
SELECT l.company_id, l.konto, v.dato, sum(l.debet) AS debet, sum(l.kredit) AS kredit, l.mva_kode
FROM public.voucher_lines l JOIN public.vouchers v ON v.id = l.voucher_id
WHERE v.status = 'bokfort'
GROUP BY l.company_id, l.konto, v.dato, l.mva_kode;
GRANT SELECT ON public.account_balances TO authenticated;
