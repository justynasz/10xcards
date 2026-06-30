// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("astro:middleware", () => ({ defineMiddleware: (fn: unknown) => fn }));
vi.mock("@/lib/supabase", () => ({ createClient: vi.fn().mockReturnValue(null) }));

import { createClient } from "@/lib/supabase";
import { onRequest } from "../middleware";

interface TestContext {
  url: URL;
  locals: Record<string, unknown>;
  request: Request;
  redirect: (url: string) => Response;
  cookies: Record<string, unknown>;
}

type TestHandler = (context: TestContext, next: () => Promise<Response>) => Promise<Response>;

const handler = onRequest as unknown as TestHandler;

function makeContext(pathname: string): TestContext {
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

    const response = await handler(makeContext("/generate"), next);

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("/auth/signin");
    expect(next).not.toHaveBeenCalled();
  });

  it("passes through unauthenticated request to /api/flashcards/generate", async () => {
    const next = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));

    await handler(makeContext("/api/flashcards/generate"), next);

    expect(next).toHaveBeenCalled();
  });

  it("passes through authenticated request to protected route /generate", async () => {
    const fakeUser = { id: "u1" };
    vi.mocked(createClient).mockReturnValueOnce({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: fakeUser } }) },
    } as unknown as ReturnType<typeof createClient>);

    const next = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    const ctx = makeContext("/generate");

    await handler(ctx, next);

    expect(next).toHaveBeenCalled();
    expect(ctx.locals.user).toEqual(fakeUser);
  });
});
