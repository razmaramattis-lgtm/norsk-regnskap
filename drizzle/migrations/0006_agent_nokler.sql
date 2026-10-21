-- Agentnøkler: gir en AI-agent (f.eks. en MCP-server) tilgang til ÉN ting i ÉT firma:
-- å lese kontoplan og nye banktransaksjoner og å FORESLÅ bilag. Nøkkelen kan aldri bokføre, godkjenne,
-- slette eller lese noe annet. Godkjenning skjer fortsatt av et menneske via approve_proposal.
-- Nøkkelen lagres kun som SHA-256-hash; klartekst vises én gang ved opprettelse.

CREATE TABLE public.agent_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  navn text NOT NULL CHECK (char_length(btrim(navn)) BETWEEN 1 AND 80),
  prefix text NOT NULL,
  key_hash bytea NOT NULL UNIQUE,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  last_used_at timestamptz
);
CREATE INDEX ON public.agent_keys (company_id);
ALTER TABLE public.agent_keys ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.agent_keys FROM PUBLIC, anon, authenticated;
-- Hashen er aldri lesbar via API-et; endringer skjer kun via funksjonene under.
GRANT SELECT (id, company_id, navn, prefix, created_at, revoked_at, last_used_at) ON public.agent_keys TO authenticated;
GRANT ALL ON public.agent_keys TO service_role;
CREATE POLICY "admins read agent_keys" ON public.agent_keys FOR SELECT TO authenticated USING (public.is_admin(company_id));

CREATE OR REPLACE FUNCTION public.create_agent_key(_company uuid, _navn text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _key text; _id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(_company) THEN RAISE EXCEPTION 'Kun eier og administrator kan opprette agentnøkler'; END IF;
  _key := 'fbk_' || replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  INSERT INTO public.agent_keys (company_id, navn, prefix, key_hash)
  VALUES (_company, btrim(_navn), left(_key, 8), sha256(convert_to(_key, 'UTF8')))
  RETURNING id INTO _id;
  PERFORM public.log_audit(_company, 'agent_nokkel_opprettet', 'agentnokkel', _id, jsonb_build_object('navn', btrim(_navn)));
  RETURN _key;
END $$;
REVOKE ALL ON FUNCTION public.create_agent_key(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_agent_key(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.revoke_agent_key(_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _k public.agent_keys;
BEGIN
  SELECT * INTO _k FROM public.agent_keys WHERE id = _id FOR UPDATE;
  IF _k.id IS NULL OR auth.uid() IS NULL OR NOT public.is_admin(_k.company_id) THEN RAISE EXCEPTION 'Ingen tilgang'; END IF;
  IF _k.revoked_at IS NULL THEN
    UPDATE public.agent_keys SET revoked_at = now() WHERE id = _id;
    PERFORM public.log_audit(_k.company_id, 'agent_nokkel_tilbakekalt', 'agentnokkel', _id, jsonb_build_object('navn', _k.navn));
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.revoke_agent_key(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revoke_agent_key(uuid) TO authenticated;

-- Intern: slår opp firma fra nøkkel. Samme feilmelding uansett årsak, så ingenting lekker.
CREATE OR REPLACE FUNCTION public.agent_firma(_key text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _c uuid;
BEGIN
  IF _key IS NULL OR _key !~ '^fbk_[0-9a-f]{64}$' THEN RAISE EXCEPTION 'Ugyldig eller tilbakekalt agentnøkkel'; END IF;
  UPDATE public.agent_keys SET last_used_at = now()
  WHERE key_hash = sha256(convert_to(_key, 'UTF8')) AND revoked_at IS NULL
  RETURNING company_id INTO _c;
  IF _c IS NULL THEN RAISE EXCEPTION 'Ugyldig eller tilbakekalt agentnøkkel'; END IF;
  RETURN _c;
END $$;
REVOKE ALL ON FUNCTION public.agent_firma(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.agent_hent_kontoplan(_key text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _c uuid := public.agent_firma(_key);
BEGIN
  RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object('konto', number, 'navn', name, 'mva_kode', mva_kode) ORDER BY number)
                   FROM public.accounts WHERE company_id = _c AND aktiv), '[]'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.agent_hent_banktransaksjoner(_key text, _grense int DEFAULT 100) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _c uuid := public.agent_firma(_key);
BEGIN
  RETURN COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.dato, t.id) FROM (
    SELECT b.id, b.dato, b.tekst, b.belop, b.bankkonto
    FROM public.bank_transactions b
    WHERE b.company_id = _c AND b.status = 'ny'
      AND NOT EXISTS (SELECT 1 FROM public.agent_proposals p WHERE p.bank_transaction_id = b.id AND p.status = 'ventende')
    ORDER BY b.dato, b.id
    LIMIT LEAST(GREATEST(COALESCE(_grense, 100), 1), 500)
  ) t), '[]'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.agent_foreslaa_bilag(
  _key text, _tittel text, _begrunnelse text, _payload jsonb,
  _sikkerhet numeric DEFAULT NULL, _agent_navn text DEFAULT NULL, _bank_transaction_id uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _c uuid := public.agent_firma(_key); _id uuid; _l jsonb; _ventende int;
BEGIN
  IF _tittel IS NULL OR char_length(btrim(_tittel)) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'Tittel må være 1–200 tegn'; END IF;
  IF _begrunnelse IS NOT NULL AND char_length(_begrunnelse) > 2000 THEN RAISE EXCEPTION 'Begrunnelsen er for lang (maks 2000 tegn)'; END IF;
  SELECT count(*) INTO _ventende FROM public.agent_proposals WHERE company_id = _c AND status = 'ventende';
  IF _ventende >= 500 THEN RAISE EXCEPTION 'For mange ventende forslag. Be et menneske godkjenne eller avvise noen først.'; END IF;
  PERFORM public.validate_proposal_payload(_payload);
  -- Gi agenten rask tilbakemelding på ukjente kontoer (bokføringen ville feilet senere).
  FOR _l IN SELECT * FROM jsonb_array_elements(_payload->'linjer') LOOP
    IF NOT EXISTS (SELECT 1 FROM public.accounts WHERE company_id = _c AND number = _l->>'konto' AND aktiv) THEN
      RAISE EXCEPTION 'Konto % finnes ikke i firmaets kontoplan', _l->>'konto';
    END IF;
  END LOOP;
  IF _bank_transaction_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.bank_transactions WHERE id = _bank_transaction_id AND company_id = _c AND status = 'ny'
  ) THEN RAISE EXCEPTION 'Banktransaksjonen finnes ikke eller er allerede avstemt'; END IF;
  IF _bank_transaction_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.agent_proposals WHERE bank_transaction_id = _bank_transaction_id AND status = 'ventende'
  ) THEN RAISE EXCEPTION 'Det finnes allerede et ventende forslag for denne banktransaksjonen'; END IF;

  INSERT INTO public.agent_proposals (company_id, kilde, agent_navn, tittel, begrunnelse, sikkerhet, bank_transaction_id, payload, opprettet_av)
  VALUES (_c, 'mcp', left(_agent_navn, 80), btrim(_tittel), _begrunnelse, _sikkerhet, _bank_transaction_id, _payload, NULL)
  RETURNING id INTO _id;
  PERFORM public.log_audit(_c, 'forslag_fra_agent', 'forslag', _id, jsonb_build_object('agent', left(_agent_navn, 80), 'tittel', btrim(_tittel)));
  RETURN _id;
END $$;

REVOKE ALL ON FUNCTION public.agent_hent_kontoplan(text), public.agent_hent_banktransaksjoner(text, int),
  public.agent_foreslaa_bilag(text, text, text, jsonb, numeric, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.agent_hent_kontoplan(text), public.agent_hent_banktransaksjoner(text, int),
  public.agent_foreslaa_bilag(text, text, text, jsonb, numeric, text, uuid) TO anon, authenticated;
