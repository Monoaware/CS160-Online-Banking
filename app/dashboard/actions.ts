"use server";

import { revalidatePath, revalidateTag } from "next/cache";

/**
 * Server action to invalidate dashboard cache
 * Call this after updating user profile
 */
export async function revalidateDashboard() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard", "layout");
  revalidatePath("/api/user/profile");
}

/**
 * Server action to invalidate specific user cache
 */
export async function revalidateUserCache(userId: string) {
  revalidateTag(`user-${userId}`);
  revalidatePath("/dashboard");
}

/**
 * Invalidate cache for a specific user after mutations
 * @param supabaseUserId - The Supabase user ID (auth.users.id)
 * @param dbUserId - Optional database user ID (if available)
 * @param cacheTypes - Types of cache to invalidate ('all' | 'accounts' | 'transactions' | 'profile')
 */
export async function invalidateUserCache(
  supabaseUserId: string,
  dbUserId?: number,
  cacheTypes: "all" | "accounts" | "transactions" | "profile" = "all",
) {
  // Always invalidate user-level cache
  await revalidateTag(`user-${supabaseUserId}`);

  if (dbUserId) {
    await revalidateTag(`user-${dbUserId}`);
  }

  // Invalidate specific cache types
  if (cacheTypes === "all" || cacheTypes === "accounts") {
    await revalidateTag(`accounts-${supabaseUserId}`);
    if (dbUserId) {
      await revalidateTag(`accounts-${dbUserId}`);
    }
  }

  if (cacheTypes === "all" || cacheTypes === "transactions") {
    await revalidateTag(`transactions-${supabaseUserId}`);
    if (dbUserId) {
      await revalidateTag(`transactions-${dbUserId}`);
    }
  }

  if (cacheTypes === "all" || cacheTypes === "profile") {
    await revalidatePath("/dashboard");
    await revalidatePath("/api/user/profile");
  }
}
