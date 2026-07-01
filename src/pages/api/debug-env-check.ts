import type { APIRoute } from "astro";
import { SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL, SUPABASE_KEY } from "astro:env/server";

export const prerender = false;

export const GET: APIRoute = () => {
  return Response.json({
    hasUrl: Boolean(SUPABASE_URL),
    hasKey: Boolean(SUPABASE_KEY),
    hasServiceRoleKey: Boolean(SUPABASE_SERVICE_ROLE_KEY),
    serviceRoleKeyLength: SUPABASE_SERVICE_ROLE_KEY ? SUPABASE_SERVICE_ROLE_KEY.length : 0,
  });
};
