import { describe, it, expect, vi } from "vitest";
import { readRuntimeEnv, type RuntimeGlobal } from "../_env";

function makeRuntime(overrides: Partial<RuntimeGlobal> = {}): RuntimeGlobal {
  return { ...(overrides as object) } as RuntimeGlobal;
}

describe("readRuntimeEnv", () => {
  it("reads from Deno.env when available", () => {
    const get = vi.fn((name: string) => (name === "FOO" ? "deno-value" : undefined));
    const runtime = makeRuntime({ Deno: { env: { get } } });
    expect(readRuntimeEnv(runtime, "FOO")).toBe("deno-value");
    expect(get).toHaveBeenCalledWith("FOO");
  });

  it("falls back to process.env when Deno is absent", () => {
    const runtime = makeRuntime({ process: { env: { BAR: "node-value" } } });
    expect(readRuntimeEnv(runtime, "BAR")).toBe("node-value");
  });

  it("prefers Deno over process.env when both exist", () => {
    const runtime = makeRuntime({
      Deno: { env: { get: () => "from-deno" } },
      process: { env: { X: "from-node" } },
    });
    expect(readRuntimeEnv(runtime, "X")).toBe("from-deno");
  });

  it("returns empty string when the variable is missing", () => {
    const runtime = makeRuntime({ process: { env: {} } });
    expect(readRuntimeEnv(runtime, "MISSING")).toBe("");
  });

  it("returns empty string when neither Deno nor process are defined", () => {
    const runtime = makeRuntime();
    expect(readRuntimeEnv(runtime, "ANY")).toBe("");
  });
});