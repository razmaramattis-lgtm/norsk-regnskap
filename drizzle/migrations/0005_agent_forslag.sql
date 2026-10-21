-- Agent-forslag: en AI-agent (eller automatisk regel) FORESLÅR bilag; et menneske godkjenner.
-- Godkjenning oppretter bilaget og bokfører det gjennom post_voucher, så all bokføringslogikk
-- (balansekontroll, periodelås, kontoplan, fortløpende nr, revisjonslogg) gjelder uendret.

CREATE TABLE public.agent_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  kilde text NOT NULL DEFAULT 'agent',           -- f.eks. 'agent', 'regel', 'mcp'
  agent_navn text,                                -- hvilken agent/klient som foreslo
  type text NOT NULL DEFAULT 'bilag' CHECK (type IN ('bilag')),
  tittel text NOT NULL,
  begrunnelse text,                               -- agentens forklaring til mennesket
  sikkerhet numeric(3,2) CHECK (sikkerhet IS NULL OR (sikkerhet >= 0 AND sikkerhet <= 1)),
  bank_transaction_id uuid REFERENCES public.bank_transactions(id) ON DELETE SET NULL,
  payload jsonb NOT NULL,                         -- {"dato":"YYYY-MM-DD","beskrivelse":"..","linjer":[{"konto":"6800","debet":100,"kredit":0,"mva_kode":"1","tekst":".."}]}
  status text NOT NULL DEFAULT 'ventende' CHECK (status IN ('ventende','godkjent','avvist')),
  voucher_id uuid REFERENCES public.vouchers(id),
  avgjort_av uuid,
  avgjort_at timestamptz,
  avvisningsgrunn text,
  opprettet_av uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.agent_proposals (company_id, status);
GRANT SELECT, INSERT, DELETE ON public.agent_proposals TO authenticated;
GRANT ALL ON public.agent_proposals TO service_role;
ALTER TABLE public.agent_proposals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read proposals" ON public.agent_proposals FOR SELECT TO authenticated USING (public.is_member(company_id));
CREATE POLICY "writers insert proposals" ON public.agent_proposals FOR INSERT TO authenticated WITH CHECK (public.can_write(company_id) AND status = 'ventende' AND voucher_id IS NULL);
CREATE POLICY "writers delete pending proposals" ON public.agent_proposals FOR DELETE TO authenticated USING (public.can_write(company_id) AND status = 'ventende');
-- Ingen UPDATE-policy: status endres kun via approve_proposal / reject_proposal.

CREATE OR REPLACE FUNCTION public.validate_proposal_payload(_p jsonb) RETURNS void LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE _l jsonb;
BEGIN
  IF jsonb_typeof(_p) <> 'object' THEN RAISE EXCEPTION 'Forslaget må være et JSON-objekt'; END IF;
  IF (_p->>'dato') IS NULL OR (_p->>'dato') !~ '^\d{4}-\d{2}-\d{2}$' THEN RAISE EXCEPTION 'Forslaget mangler gyldig dato (YYYY-MM-DD)'; END IF;
  IF jsonb_typeof(_p->'linjer') <> 'array' OR jsonb_array_length(_p->'linjer') < 2 THEN RAISE EXCEPTION 'Forslaget må ha minst to linjer'; END IF;
  FOR _l IN SELECT * FROM jsonb_array_elements(_p->'linjer') LOOP
    IF (_l->>'konto') IS NULL OR (_l->>'konto') !~ '^\d{4}$' THEN RAISE EXCEPTION 'Hver linje må ha et firesifret kontonummer'; END IF;
    IF COALESCE((_l->>'debet')::numeric, 0) < 0 OR COALESCE((_l->>'kredit')::numeric, 0) < 0 THEN RAISE EXCEPTION 'Beløp kan ikke være negative'; END IF;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.proposals_validate() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM public.validate_proposal_payload(NEW.payload);
  RETURN NEW;
END $$;
CREATE TRIGGER proposals_validate BEFORE INSERT ON public.agent_proposals FOR EACH ROW EXECUTE FUNCTION public.proposals_validate();

CREATE OR REPLACE FUNCTION public.approve_proposal(_id uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _p public.agent_proposals; _vid uuid; _l jsonb; _i int := 0; _nr int;
BEGIN
  SELECT * INTO _p FROM public.agent_proposals WHERE id = _id FOR UPDATE;
  IF _p.id IS NULL THEN RAISE EXCEPTION 'Forslaget finnes ikke'; END IF;
  IF NOT public.can_write(_p.company_id) THEN RAISE EXCEPTION 'Ingen tilgang'; END IF;
  IF _p.status <> 'ventende' THEN RAISE EXCEPTION 'Forslaget er allerede avgjort (%).', _p.status; END IF;
  -- Å godkjenne sitt eget forslag er tillatt, men loggføres (se detaljer under).
  INSERT INTO public.vouchers (company_id, dato, beskrivelse, kilde, created_by)
  VALUES (_p.company_id, (_p.payload->>'dato')::date, COALESCE(NULLIF(_p.payload->>'beskrivelse', ''), _p.tittel), 'agent', auth.uid())
  RETURNING id INTO _vid;
  FOR _l IN SELECT * FROM jsonb_array_elements(_p.payload->'linjer') LOOP
    INSERT INTO public.voucher_lines (voucher_id, company_id, konto, tekst, debet, kredit, mva_kode, linjenr)
    VALUES (_vid, _p.company_id, _l->>'konto', _l->>'tekst', COALESCE((_l->>'debet')::numeric, 0), COALESCE((_l->>'kredit')::numeric, 0), NULLIF(_l->>'mva_kode', ''), _i);
    _i := _i + 1;
  END LOOP;
  _nr := public.post_voucher(_vid);   -- balansekontroll, periodelås, kontoplan, nummerering
  UPDATE public.agent_proposals SET status = 'godkjent', voucher_id = _vid, avgjort_av = auth.uid(), avgjort_at = now() WHERE id = _id;
  IF _p.bank_transaction_id IS NOT NULL THEN
    UPDATE public.bank_transactions SET status = 'avstemt', voucher_id = _vid WHERE id = _p.bank_transaction_id AND company_id = _p.company_id AND status = 'ny';
  END IF;
  PERFORM public.log_audit(_p.company_id, 'forslag_godkjent', 'forslag', _id,
    jsonb_build_object('bilagsnr', _nr, 'kilde', _p.kilde, 'agent', _p.agent_navn, 'foreslatt_av', _p.opprettet_av, 'godkjent_av', auth.uid(), 'samme_person', _p.opprettet_av = auth.uid()));
  RETURN _vid;
END $$;
GRANT EXECUTE ON FUNCTION public.approve_proposal(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.reject_proposal(_id uuid, _grunn text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _p public.agent_proposals;
BEGIN
  SELECT * INTO _p FROM public.agent_proposals WHERE id = _id FOR UPDATE;
  IF _p.id IS NULL THEN RAISE EXCEPTION 'Forslaget finnes ikke'; END IF;
  IF NOT public.can_write(_p.company_id) THEN RAISE EXCEPTION 'Ingen tilgang'; END IF;
  IF _p.status <> 'ventende' THEN RAISE EXCEPTION 'Forslaget er allerede avgjort (%).', _p.status; END IF;
  UPDATE public.agent_proposals SET status = 'avvist', avgjort_av = auth.uid(), avgjort_at = now(), avvisningsgrunn = _grunn WHERE id = _id;
  PERFORM public.log_audit(_p.company_id, 'forslag_avvist', 'forslag', _id, jsonb_build_object('grunn', _grunn, 'kilde', _p.kilde, 'agent', _p.agent_navn));
END $$;
GRANT EXECUTE ON FUNCTION public.reject_proposal(uuid, text) TO authenticated;
