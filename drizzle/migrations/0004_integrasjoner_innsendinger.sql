-- Integrasjoner (leverandørvalg per firma) og innsendingskø (MVA, EHF, a-melding, årsregnskap, skattemelding, betalingsfil)

CREATE TABLE public.integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  domene text NOT NULL CHECK (domene IN ('peppol','mva_innsending','a_melding','aarsregnskap','skattemelding','aksjonaerregister','lonn_utbetaling','bank')),
  leverandor text,
  status text NOT NULL DEFAULT 'ikke_valgt' CHECK (status IN ('ikke_valgt','konfigurert','testmodus','aktiv','feil')),
  miljo text NOT NULL DEFAULT 'test' CHECK (miljo IN ('test','produksjon')),
  -- Kun ikke-hemmelig konfigurasjon (f.eks. aksesspunkt-ID, avsender-org.nr). Hemmeligheter lagres aldri her.
  konfig jsonb NOT NULL DEFAULT '{}'::jsonb,
  notat text,
  oppdatert_at timestamptz NOT NULL DEFAULT now(),
  oppdatert_av uuid DEFAULT auth.uid(),
  UNIQUE (company_id, domene),
  CHECK (status = 'ikke_valgt' OR leverandor IS NOT NULL)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.integrations TO authenticated;
GRANT ALL ON public.integrations TO service_role;
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read integrations" ON public.integrations FOR SELECT TO authenticated USING (public.is_member(company_id));
CREATE POLICY "admins insert integrations" ON public.integrations FOR INSERT TO authenticated WITH CHECK (public.is_admin(company_id));
CREATE POLICY "admins update integrations" ON public.integrations FOR UPDATE TO authenticated USING (public.is_admin(company_id)) WITH CHECK (public.is_admin(company_id));
CREATE POLICY "admins delete integrations" ON public.integrations FOR DELETE TO authenticated USING (public.is_admin(company_id));

-- Hemmeligheter (passord, tokens, nøkler) skal aldri ligge i konfig.
CREATE OR REPLACE FUNCTION public.integrations_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF jsonb_typeof(NEW.konfig) <> 'object' THEN RAISE EXCEPTION 'konfig må være et JSON-objekt'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_object_keys(NEW.konfig) k WHERE k ~* '(secret|passord|password|token|api[_-]?key|private|nokkel|key)') THEN
    RAISE EXCEPTION 'Hemmeligheter kan ikke lagres i integrasjonskonfigurasjonen. Bruk sikker hemmelighetslagring.';
  END IF;
  NEW.oppdatert_at := now();
  NEW.oppdatert_av := auth.uid();
  PERFORM public.log_audit(NEW.company_id, CASE WHEN TG_OP = 'INSERT' THEN 'integrasjon_opprettet' ELSE 'integrasjon_endret' END, 'integrasjon', NEW.id,
    jsonb_build_object('domene', NEW.domene, 'leverandor', NEW.leverandor, 'status', NEW.status, 'miljo', NEW.miljo));
  RETURN NEW;
END $$;
CREATE TRIGGER integrations_guard BEFORE INSERT OR UPDATE ON public.integrations FOR EACH ROW EXECUTE FUNCTION public.integrations_guard();

CREATE TABLE public.innsendinger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  domene text NOT NULL CHECK (domene IN ('peppol','mva_innsending','a_melding','aarsregnskap','skattemelding','aksjonaerregister','lonn_utbetaling','bank')),
  type text NOT NULL CHECK (type IN ('ehf_faktura','mva_melding','a_melding','aarsregnskap','skattemelding','aksjonaerregister','betalingsfil')),
  periode text,
  objekt_id uuid,
  status text NOT NULL DEFAULT 'utkast' CHECK (status IN ('utkast','klar','sendt','mottatt','avvist','feilet')),
  payload jsonb,
  dokument text,
  referanse text,
  kvittering jsonb,
  feil jsonb,
  opprettet_av uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  sendt_at timestamptz,
  oppdatert_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.innsendinger (company_id, type, periode);
CREATE INDEX ON public.innsendinger (company_id, status);
-- Samme periode/objekt kan ikke sendes to ganger (rettelser lages som egen type/periode).
CREATE UNIQUE INDEX innsendinger_en_aktiv ON public.innsendinger (company_id, type, COALESCE(periode, ''), COALESCE(objekt_id, '00000000-0000-0000-0000-000000000000'::uuid)) WHERE status IN ('sendt','mottatt');

GRANT SELECT, INSERT, UPDATE, DELETE ON public.innsendinger TO authenticated;
GRANT ALL ON public.innsendinger TO service_role;
ALTER TABLE public.innsendinger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read innsendinger" ON public.innsendinger FOR SELECT TO authenticated USING (public.is_member(company_id));
CREATE POLICY "writers insert innsendinger" ON public.innsendinger FOR INSERT TO authenticated WITH CHECK (public.can_write(company_id) AND status IN ('utkast','klar'));
CREATE POLICY "writers update innsendinger" ON public.innsendinger FOR UPDATE TO authenticated USING (public.can_write(company_id) AND status IN ('utkast','klar')) WITH CHECK (public.can_write(company_id) AND status IN ('utkast','klar'));
CREATE POLICY "writers delete draft innsendinger" ON public.innsendinger FOR DELETE TO authenticated USING (public.can_write(company_id) AND status IN ('utkast','klar'));

-- Det som er sendt kan ikke endres: grunnlag og dokument er bevis for hva myndigheten/mottakeren fikk.
CREATE OR REPLACE FUNCTION public.innsendinger_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status NOT IN ('utkast','klar') THEN RAISE EXCEPTION 'Sendte innsendinger kan ikke slettes.'; END IF;
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status IN ('sendt','mottatt','avvist') AND (
      NEW.payload IS DISTINCT FROM OLD.payload OR NEW.dokument IS DISTINCT FROM OLD.dokument OR NEW.type <> OLD.type
      OR NEW.periode IS DISTINCT FROM OLD.periode OR NEW.objekt_id IS DISTINCT FROM OLD.objekt_id OR NEW.company_id <> OLD.company_id
    ) THEN
      RAISE EXCEPTION 'Grunnlaget for en sendt innsending kan ikke endres.';
    END IF;
  END IF;
  IF NEW.status IN ('sendt','mottatt') AND NEW.sendt_at IS NULL THEN NEW.sendt_at := now(); END IF;
  NEW.oppdatert_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER innsendinger_guard BEFORE UPDATE OR DELETE ON public.innsendinger FOR EACH ROW EXECUTE FUNCTION public.innsendinger_guard();
CREATE TRIGGER innsendinger_guard_ins BEFORE INSERT ON public.innsendinger FOR EACH ROW EXECUTE FUNCTION public.innsendinger_guard();

CREATE OR REPLACE FUNCTION public.innsendinger_audit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.log_audit(NEW.company_id, 'innsending_' || NEW.status, 'innsending', NEW.id,
    jsonb_build_object('type', NEW.type, 'periode', NEW.periode, 'status', NEW.status, 'referanse', NEW.referanse));
  RETURN NEW;
END $$;
CREATE TRIGGER innsendinger_audit AFTER INSERT OR UPDATE OF status ON public.innsendinger FOR EACH ROW EXECUTE FUNCTION public.innsendinger_audit();
