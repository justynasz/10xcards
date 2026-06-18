import type { APIRoute } from "astro";
import { z } from "zod";
import { createClient, createAdminClient } from "@/lib/supabase";
import { deleteAccount } from "@/lib/account";

export const prerender = false;

const bodySchema = z.object({ password: z.string().min(1) });

export const POST: APIRoute = async (context) => {
  if (!context.locals.user) {
    return context.redirect("/auth/signin");
  }

  const form = await context.request.formData();
  const parsed = bodySchema.safeParse({ password: form.get("password") as string });
  if (!parsed.success) {
    return context.redirect(`/account?error=${encodeURIComponent(parsed.error.message)}`);
  }

  const email = context.locals.user.email;
  if (!email) {
    return context.redirect(`/account?error=${encodeURIComponent("Account email is missing")}`);
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(`/account?error=${encodeURIComponent("Supabase is not configured")}`);
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password: parsed.data.password,
  });
  if (signInError) {
    return context.redirect(`/account?error=${encodeURIComponent(signInError.message)}`);
  }

  const adminClient = createAdminClient();
  if (!adminClient) {
    return context.redirect(`/account?error=${encodeURIComponent("Account deletion is not configured")}`);
  }

  try {
    await deleteAccount(adminClient, context.locals.user.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete account. Please try again.";
    return context.redirect(`/account?error=${encodeURIComponent(message)}`);
  }

  await supabase.auth.signOut();
  return context.redirect("/auth/signin?deleted=1");
};
