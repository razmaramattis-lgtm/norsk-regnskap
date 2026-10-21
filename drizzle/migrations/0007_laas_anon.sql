-- Stram inn tilgang for den uinnloggede rollen (anon) på det som ble lagt til i 0004–0005.
-- RLS og auth.uid()-sjekkene stoppet allerede anon, men tilgangen skal heller ikke finnes.
REVOKE ALL ON public.integrations FROM anon;
REVOKE ALL ON public.innsendinger FROM anon;
REVOKE ALL ON public.agent_proposals FROM anon;
REVOKE ALL ON FUNCTION public.approve_proposal(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reject_proposal(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.validate_proposal_payload(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.proposals_validate() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.integrations_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.innsendinger_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.innsendinger_audit() FROM PUBLIC, anon, authenticated;
-- proposals_validate kjører som innlogget bruker og kaller denne, så authenticated må beholde tilgangen.
GRANT EXECUTE ON FUNCTION public.validate_proposal_payload(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_proposal(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_proposal(uuid, text) TO authenticated;
-- agent_foreslaa_bilag kaller validate_proposal_payload som SECURITY DEFINER-eier, så anon trenger ikke tilgang direkte.
