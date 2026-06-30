import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("astro:middleware", () => ({ defineMiddleware: (fn: unknown) => fn }));
vi.mock("@/lib/supabase", () => ({ createClient: vi.fn().mockReturnValue(null) }));

import { onRequest } from "../middleware";

function makeContext(pathname: string) {
  return {
    url: new URL("http://localhost" + pathname),
    locals: {},
    request: new Request("http://localhost" + pathname),
    redirect: (url: string) => new Response(null, { status: 302, headers: { Location: url } }),
    cookies: {},
  };
}

describe("middleware onRequest", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("redirects unauthenticated request to /generate", async () => {
    const next = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));

    const response = await (onRequest as Function)(makeContext("/generate"), next);

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("/auth/signin");
    expect(next).not.toHaveBeenCalled();
  });

  it("passes through unauthenticated request to /api/flashcards/generate", async () => {
    const next = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));

    await (onRequest as Function)(makeContext("/api/flashcards/generate"), next);

    expect(next).toHaveBeenCalled();
  });
});
