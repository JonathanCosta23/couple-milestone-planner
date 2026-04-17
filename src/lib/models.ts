/**
 * V7 Entity Models — Plano do Milhão
 *
 * Este arquivo era um monolito (~460 linhas). Foi dividido por domínio em
 * `src/lib/models/` para sustentabilidade. Mantemos este shim como ponto
 * único de entrada para preservar todos os imports existentes
 * (`import { ... } from "@/lib/models"`).
 *
 * Para novos arquivos, prefira importar diretamente do submódulo desejado
 * (ex.: `import { Investment } from "@/lib/models/wealth"`).
 */

export * from "./models/index";
