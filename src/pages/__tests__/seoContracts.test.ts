import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("SEO contracts", () => {
  it("keeps the static title concise", () => {
    const html = source("index.html");
    const title = html.match(/<title>([^<]+)<\/title>/)?.[1] ?? "";
    expect(title.length).toBeGreaterThan(0);
    expect(title.length).toBeLessThanOrEqual(60);
  });

  it("keeps one H1 on authentication entry points", () => {
    expect(source("src/components/auth/AuthPage.tsx")).toContain("<h1");
    expect(source("src/pages/ForgotPassword.tsx")).toContain("<h1");
  });

  it("uses page-specific canonicals and noindex on auth pages", () => {
    const cases = [
      ["src/pages/Login.tsx", "/login"],
      ["src/pages/Signup.tsx", "/signup"],
      ["src/pages/ForgotPassword.tsx", "/forgot-password"],
    ] as const;

    for (const [file, route] of cases) {
      const content = source(file);
      expect(content).toContain(`lovable.app${route}`);
      expect(content).toContain('name="robots" content="noindex, nofollow"');
    }
  });

  it("publishes only indexable public routes in the sitemap", () => {
    const sitemap = source("public/sitemap.xml");
    expect(sitemap).toContain("<loc>https://couple-milestone-planner.lovable.app/</loc>");
    expect(sitemap).toContain("/guia-planejamento-financeiro</loc>");
    for (const privateRoute of [
      "/protected",
      "/connect",
      "/login",
      "/signup",
      "/forgot-password",
      "/reset-password",
    ]) {
      expect(sitemap).not.toContain(`${privateRoute}</loc>`);
    }
  });

  it("blocks private and authentication routes in robots.txt", () => {
    const robots = source("public/robots.txt");
    for (const route of ["/connect", "/login", "/signup", "/forgot-password"]) {
      expect(robots).toContain(`Disallow: ${route}`);
    }
  });
});
