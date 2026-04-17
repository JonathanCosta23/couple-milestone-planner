/**
 * Identidade do plano: modo canônico e perfis dos participantes.
 */

/**
 * Modo canônico do plano. "individual" = um titular ativo. "casal" = dois titulares.
 * Strings legadas "solo"/"couple" continuam aceitas pelo loader (appStorage) e
 * são convertidas no momento da leitura para garantir retrocompatibilidade.
 */
export type PlanMode = "individual" | "casal";

export interface Profile {
  id: string;
  name: string;
  age?: number;
  email?: string;
  avatarColor?: string;
}

export interface Partner {
  profile: Profile;
  addedAt: string;
  removedAt?: string; // soft-delete to preserve history
}
