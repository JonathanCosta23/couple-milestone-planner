-- Make legal_consents strictly append-only for authenticated users.
DROP POLICY IF EXISTS "Users delete own legal_consents" ON public.legal_consents;
REVOKE DELETE, UPDATE ON public.legal_consents FROM authenticated;
-- Ensure remaining rights are exactly SELECT + INSERT for authenticated.
GRANT SELECT, INSERT ON public.legal_consents TO authenticated;
-- service_role keeps full administrative access.
GRANT ALL ON public.legal_consents TO service_role;