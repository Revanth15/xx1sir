import { redirect } from "next/navigation";

import type { UserProfile } from "@/utils/AuthProvider";
import { ApiError } from "@/utils/api";
import { createClient } from "@/utils/supabase/server";

export async function getCurrentUserProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile: UserProfile | null = null;

  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    profile = (data as UserProfile | null) ?? null;
  }

  return { supabase, user, profile };
}

export async function requireApiUser() {
  const context = await getCurrentUserProfile();

  const user = context.user;

  if (!user) {
    throw new ApiError(401, "Authentication required.");
  }

  return { ...context, user };
}

export async function requireApiAdmin() {
  const context = await requireApiUser();

  if (context.profile?.role !== "admin") {
    throw new ApiError(403, "Admin access required.");
  }

  return context;
}

export async function requirePageAdmin(redirectTo = "/assets") {
  const context = await getCurrentUserProfile();

  if (context.profile?.role !== "admin") {
    redirect(redirectTo);
  }

  return context;
}
