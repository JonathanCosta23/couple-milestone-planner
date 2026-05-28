/**
 * Auditoria estática da projeção: garante que ProjectionRealistic
 * não contém inflação hardcoded (0.045) nem meta hardcoded (1_000_000 / "R$ 1M"),
 * e que ConsentGate exige privacy como consentimento obrigatório.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { REQUIRED_CONSENTS } from "@/lib/consent/versions";

const ROOT = join(__dirname, "..", "..", "..");

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("ProjectionRealistic — auditoria estática", () => {
  const src = read("src/components/plan/ProjectionRealistic.tsx");

  it("não contém inflação hardcoded (0.045)", () => {
    expect(src).not.toMatch(/inflationRate:\s*0\.045/);
    expect(src).not.toMatch(/\b0\.045\b/);
  });

  it("não contém meta hardcoded (1_000_000 ou 'R$ 1M')", () => {
    expect(src).not.toMatch(/1_000_000/);
    expect(src).not.toMatch(/"R\$ 1M"/);
  });

  it("ReferenceLine usa targetAmount do plano", () => {
    expect(src).toMatch(/ReferenceLine\s+y=\{targetAmount\}/);
  });

  it("cenários derivam de core.assumptions, não de selicRate hardcoded", () => {
    expect(src).toMatch(/core\.assumptions/);
  });
});

describe("ConsentGate — privacy é obrigatório", () => {
  it("privacy faz parte de REQUIRED_CONSENTS", () => {
    expect(REQUIRED_CONSENTS).toContain("privacy");
    expect(REQUIRED_CONSENTS).toContain("terms");
    expect(REQUIRED_CONSENTS).toContain("educational_disclaimer");
  });
});