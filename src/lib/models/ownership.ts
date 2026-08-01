/**
 * Ownership financeiro canônico.
 *
 * `member_id = null` nunca possui significado implícito. O scope precisa
 * acompanhar explicitamente qualquer criação ou mudança de propriedade.
 */
export const OWNERSHIP_SCOPES = ["individual", "shared", "needs_review"] as const;

export type OwnershipScope = (typeof OWNERSHIP_SCOPES)[number];

export interface OwnershipWriteContext {
  memberId?: string | null;
  ownershipScope?: OwnershipScope;
}

export function isOwnershipScope(value: unknown): value is OwnershipScope {
  return typeof value === "string" && (OWNERSHIP_SCOPES as readonly string[]).includes(value);
}

/** Contrato obrigatório para uma criação normal feita pelos writers. */
export function buildIndividualOwnership(memberId: string | null | undefined): {
  member_id: string;
  ownership_scope: "individual";
} {
  if (typeof memberId !== "string" || memberId.trim().length === 0) {
    throw new Error("member_required");
  }
  return { member_id: memberId, ownership_scope: "individual" };
}

/**
 * Aplica ownership somente quando a intenção foi explícita.
 * Updates financeiros comuns chamam esta função sem campos e preservam o
 * vínculo existente no banco.
 */
export function applyOwnershipPatch(
  payload: Record<string, unknown>,
  context: OwnershipWriteContext,
): Record<string, unknown> {
  const { memberId, ownershipScope } = context;
  if (memberId === undefined && ownershipScope === undefined) return payload;

  if (ownershipScope === "individual" || (ownershipScope === undefined && typeof memberId === "string")) {
    Object.assign(payload, buildIndividualOwnership(memberId));
    return payload;
  }

  if (ownershipScope === "shared" || ownershipScope === "needs_review") {
    if (memberId !== null) throw new Error("ownership_member_mismatch");
    payload.member_id = null;
    payload.ownership_scope = ownershipScope;
    return payload;
  }

  // `memberId: null` sem scope é uma intenção incompleta. Mantemos o campo
  // para que o banco rejeite de forma segura; nunca inferimos shared/review.
  if (memberId === null) payload.member_id = null;
  return payload;
}
