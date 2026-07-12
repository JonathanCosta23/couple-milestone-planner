import { describe, it, expectTypeOf } from "vitest";
import type { UpsertActionInput } from "../services/nextActionPersistence";

describe("nextActionPersistence · tipos", () => {
  it("planId é obrigatório na fronteira de persistência", () => {
    expectTypeOf<UpsertActionInput["planId"]>().toEqualTypeOf<string>();
  });
});