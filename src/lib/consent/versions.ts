/**
 * Versões oficiais dos documentos legais aceitos pelo usuário.
 *
 * Incrementar a versão obriga o usuário a aceitar novamente. Manter em
 * sincronia com `LegalDialogs.tsx` (conteúdo exibido) e com o histórico
 * gravado em `public.legal_consents`.
 */

export type ConsentType = "terms" | "privacy" | "educational_disclaimer";

export const CONSENT_VERSIONS: Record<ConsentType, string> = {
  terms: "terms_v1",
  privacy: "privacy_v1",
  educational_disclaimer: "educational_disclaimer_v1",
};

/** Tipos de consentimento exigidos antes de liberar o app autenticado. */
export const REQUIRED_CONSENTS: ConsentType[] = [
  "terms",
  "privacy",
  "educational_disclaimer",
];