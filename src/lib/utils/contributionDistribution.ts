/**
 * distributeMonthlyContribution — redistribui um novo aporte mensal total
 * entre os contribuidores existentes preservando a proporção atual.
 *
 * Regras:
 *  - Trabalha em centavos inteiros para evitar erro de ponto flutuante.
 *  - Quando o total atual é > 0, aplica proporção sobre cada bucket
 *    (plannedSelic, plannedCDB) de cada contribuidor.
 *  - Distribui o resíduo de arredondamento de forma determinística: pela
 *    maior fração restante, com desempate estável por (índice, bucket).
 *  - Quando o total atual é 0, aloca todo o valor no `plannedSelic` do
 *    primeiro contribuidor (participante principal) — regra explícita para
 *    não inventar distribuição silenciosa entre buckets/pessoas.
 *  - Garante que a soma final seja exatamente igual ao aporte informado.
 */
import type { Contributor } from "@/lib/types";

export interface DistributionResult {
  contributors: Contributor[];
  /** Total distribuído em reais (deve bater com o solicitado). */
  total: number;
}

type Slot = { i: number; key: "selic" | "cdb"; raw: number; floor: number; frac: number };

export function distributeMonthlyContribution(
  contributors: Contributor[],
  newMonthly: number,
): DistributionResult {
  if (!Number.isFinite(newMonthly) || newMonthly < 0) {
    throw new Error("Aporte mensal inválido para distribuição.");
  }
  if (contributors.length === 0) {
    return { contributors: [], total: 0 };
  }

  const targetCents = Math.round(newMonthly * 100);
  const priorCents = contributors.map((c) => ({
    selic: Math.round((c.plannedSelic ?? 0) * 100),
    cdb: Math.round((c.plannedCDB ?? 0) * 100),
  }));
  const priorSum = priorCents.reduce((s, p) => s + p.selic + p.cdb, 0);

  const nextCents = contributors.map(() => ({ selic: 0, cdb: 0 }));

  if (targetCents === 0) {
    // Zera tudo mantendo os contribuidores.
  } else if (priorSum > 0) {
    const slots: Slot[] = [];
    for (let i = 0; i < priorCents.length; i++) {
      const p = priorCents[i];
      const rawS = (p.selic * targetCents) / priorSum;
      const rawC = (p.cdb * targetCents) / priorSum;
      slots.push({ i, key: "selic", raw: rawS, floor: Math.floor(rawS), frac: rawS - Math.floor(rawS) });
      slots.push({ i, key: "cdb", raw: rawC, floor: Math.floor(rawC), frac: rawC - Math.floor(rawC) });
    }
    const allocated = slots.reduce((s, f) => s + f.floor, 0);
    let remainder = targetCents - allocated;
    const order = [...slots].sort(
      (a, b) => b.frac - a.frac || a.i - b.i || (a.key < b.key ? -1 : 1),
    );
    for (let k = 0; k < order.length && remainder > 0; k++) {
      order[k].floor += 1;
      remainder -= 1;
    }
    for (const f of slots) {
      nextCents[f.i][f.key] = f.floor;
    }
  } else {
    // Sem distribuição anterior: aloca tudo no plannedSelic do principal.
    nextCents[0].selic = targetCents;
  }

  const nextContributors: Contributor[] = contributors.map((c, i) => ({
    ...c,
    plannedSelic: nextCents[i].selic / 100,
    plannedCDB: nextCents[i].cdb / 100,
  }));

  const totalCents = nextCents.reduce((s, p) => s + p.selic + p.cdb, 0);
  return { contributors: nextContributors, total: totalCents / 100 };
}