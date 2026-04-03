import { describe, expect, it } from "vitest";
import { buildLoginHref, buildScopeLoginHref } from "./auth";

describe("buildLoginHref", () => {
  it("builds a same-origin login URL and preserves the source page", () => {
    const href = buildLoginHref("https://brave.example.com/list?view=all#top");
    const loginUrl = new URL(href);

    expect(loginUrl.origin).toBe("https://brave.example.com");
    expect(loginUrl.pathname).toBe("/login");
    expect(loginUrl.searchParams.get("src")).toBe(
      "https://brave.example.com/list?view=all#top",
    );
    expect(href).not.toContain(":2727");
  });

  it("builds a same-origin scope-login URL and preserves the source page", () => {
    const href = buildScopeLoginHref(
      "https://brave.example.com/admin?tab=oauth",
    );
    const loginUrl = new URL(href);

    expect(loginUrl.origin).toBe("https://brave.example.com");
    expect(loginUrl.pathname).toBe("/login/scope");
    expect(loginUrl.searchParams.get("src")).toBe(
      "https://brave.example.com/admin?tab=oauth",
    );
    expect(href).not.toContain(":2727");
  });
});
