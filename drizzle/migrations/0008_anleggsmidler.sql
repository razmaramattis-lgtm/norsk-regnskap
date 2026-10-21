-- Anleggsregister for skattemessig saldoavskrivning (saldogrupper a–j).
CREATE TABLE public.anleggsmidler (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  navn text NOT NULL CHECK (char_length(btrim(navn)) BETWEEN 1 AND 120),
  saldogruppe text NOT NULL CHECK (saldogruppe IN ('a','b','c','d','e','f','g','h','i','j')),
  anskaffet date NOT NULL,
  anskaffelseskost numeric(14,2) NOT NULL CHECK (anskaffelseskost > 0),
  konto text,                                   -- balansekonto (f.eks. 1250); standard hentes fra saldogruppen
  solgt date,
  salgssum numeric(14,2) CHECK (salgssum IS NULL OR salgssum >= 0),
  notat text,
  opprettet_av uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (solgt IS NULL OR solgt >= anskaffet),
  CHECK (salgssum IS NULL OR solgt IS NOT NULL)
);
CREATE INDEX ON public.anleggsmidler (company_id);
REVOKE ALL ON public.anleggsmidler FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.anleggsmidler TO authenticated;
GRANT ALL ON public.anleggsmidler TO service_role;
ALTER TABLE public.anleggsmidler ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read anleggsmidler" ON public.anleggsmidler FOR SELECT TO authenticated USING (public.is_member(company_id));
CREATE POLICY "writers insert anleggsmidler" ON public.anleggsmidler FOR INSERT TO authenticated WITH CHECK (public.can_write(company_id));
CREATE POLICY "writers update anleggsmidler" ON public.anleggsmidler FOR UPDATE TO authenticated USING (public.can_write(company_id)) WITH CHECK (public.can_write(company_id));
CREATE POLICY "writers delete anleggsmidler" ON public.anleggsmidler FOR DELETE TO authenticated USING (public.can_write(company_id));

-- Endringer i anleggsregisteret skal kunne etterprøves.
CREATE OR REPLACE FUNCTION public.anleggsmidler_audit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _r public.anleggsmidler;
BEGIN
  _r := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  PERFORM public.log_audit(_r.company_id, 'anleggsmiddel_' || lower(TG_OP), 'anleggsmiddel', _r.id,
    jsonb_build_object('navn', _r.navn, 'saldogruppe', _r.saldogruppe, 'kost', _r.anskaffelseskost, 'solgt', _r.solgt, 'salgssum', _r.salgssum));
  RETURN _r;
END $$;
REVOKE ALL ON FUNCTION public.anleggsmidler_audit() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER anleggsmidler_audit AFTER INSERT OR UPDATE OR DELETE ON public.anleggsmidler FOR EACH ROW EXECUTE FUNCTION public.anleggsmidler_audit();
