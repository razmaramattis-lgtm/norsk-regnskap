-- Avkrysning av manuelle punkter i månedsavslutningen. Lagrer hvem som kontrollerte og når, til byråets
-- kvalitetskontroll. Én rad per firma, periode (siste dag i måneden) og punkt; fjernes når krysset tas bort.
CREATE TABLE public.maanedsavslutning_avkrysning (
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  periode date NOT NULL,
  punkt text NOT NULL CHECK (char_length(punkt) BETWEEN 1 AND 60),
  kontrollert_av uuid NOT NULL DEFAULT auth.uid(),
  kontrollert_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, periode, punkt)
);
REVOKE ALL ON public.maanedsavslutning_avkrysning FROM PUBLIC, anon;
GRANT SELECT, INSERT, DELETE ON public.maanedsavslutning_avkrysning TO authenticated;
GRANT ALL ON public.maanedsavslutning_avkrysning TO service_role;
ALTER TABLE public.maanedsavslutning_avkrysning ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read avkrysning" ON public.maanedsavslutning_avkrysning FOR SELECT TO authenticated USING (public.is_member(company_id));
CREATE POLICY "writers insert avkrysning" ON public.maanedsavslutning_avkrysning FOR INSERT TO authenticated
  WITH CHECK (public.can_write(company_id) AND kontrollert_av = auth.uid());
CREATE POLICY "writers delete avkrysning" ON public.maanedsavslutning_avkrysning FOR DELETE TO authenticated USING (public.can_write(company_id));