import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { unstable_cache } from "next/cache";

interface Account {
  id: number;
  account_number: string;
  routing_number: string;
  account_type: "checking" | "savings";
  balance: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface Transaction {
  id: number;
  amount: number;
  transaction_type: string;
  direction: "inbound" | "outbound";
  status: "approved" | "denied" | "pending";
  created_at: string;
  internal_account_id: number;
}

interface DashboardData {
  accounts: Account[];
  transactions: Transaction[];
  totalBalance: number;
}

/**
 * Internal function to fetch dashboard data without caching
 */
async function fetchDashboardDataInternal(
  accessToken: string,
  baseUrl: string,
): Promise<DashboardData | null> {
  try {
    // Fetch accounts from the internal accounts API (same endpoint used by React Native)
    const accountsResponse = await fetch(`${baseUrl}/api/accounts/internal`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });

    if (!accountsResponse.ok) {
      throw new Error("Failed to fetch accounts");
    }

    const accountsData = (await accountsResponse.json()) as {
      accounts: Account[];
    };

    // Fetch recent transactions (same endpoint used by React Native)
    const transactionsResponse = await fetch(`${baseUrl}/api/transactions`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });

    if (!transactionsResponse.ok) {
      throw new Error("Failed to fetch transactions");
    }

    const transactionsData = (await transactionsResponse.json()) as {
      transactions: Transaction[];
    };

    // Calculate total balance
    const totalBalance = accountsData.accounts.reduce(
      (sum: number, account: Account) => sum + account.balance,
      0,
    );

    return {
      accounts: accountsData.accounts ?? [],
      transactions: transactionsData.transactions ?? [],
      totalBalance,
    };
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    return null;
  }
}

/**
 * Server-side function to fetch dashboard data with caching
 * Calls the same API routes used by React Native for consistency
 *
 * Cache tags:
 * - `user-{userId}` - All user data (invalidated on profile updates)
 * - `accounts-{userId}` - User accounts (invalidated on account creation/updates)
 * - `transactions-{userId}` - User transactions (invalidated on transaction creation)
 *
 * Cache duration: 30 seconds (can be invalidated earlier via tags)
 */
export async function getDashboardData(): Promise<DashboardData | null> {
  // Authenticate user and get session
  const supabase = await createClient();
  const {
    data: { user: supabaseUser },
  } = await supabase.auth.getUser();

  if (!supabaseUser) {
    redirect("/login");
  }

  // Get session with access token
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login");
  }

  // Get the base URL for API calls
  // In Next.js, we need to construct the full URL for server-side fetch
  // Use NEXT_PUBLIC_BASE_URL if available (set in production), otherwise try to get from headers
  let baseUrl: string;
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  } else {
    try {
      const headersList = await headers();
      const host = headersList.get("host") || "localhost:3000";

      // Detect protocol from request headers (for reverse proxies)
      // Check x-forwarded-proto first (most common)
      const forwardedProto = headersList.get("x-forwarded-proto");
      // Check forwarded header (RFC 7239)
      const forwarded = headersList.get("forwarded");

      // For localhost in development, always use http
      const isLocalhost =
        host.includes("localhost") || host.includes("127.0.0.1");

      let protocol = "http"; // Default to http

      if (forwardedProto) {
        protocol = forwardedProto.split(",")[0].trim();
      } else if (forwarded) {
        // Parse forwarded header: proto=https;host=example.com
        const protoMatch = forwarded.match(/proto=([^;,\s]+)/i);
        if (protoMatch) {
          protocol = protoMatch[1].trim();
        }
      } else if (!isLocalhost && process.env.NODE_ENV === "production") {
        // Only assume https in production for non-localhost hosts if no proxy headers are set
        protocol = "https";
      } else {
        // Default to http for localhost and development
        protocol = "http";
      }

      // Ensure protocol is http or https
      if (protocol !== "http" && protocol !== "https") {
        protocol = isLocalhost
          ? "http"
          : process.env.NODE_ENV === "production"
            ? "https"
            : "http";
      }

      baseUrl = `${protocol}://${host}`;
    } catch {
      // Fallback for test environments where headers() isn't available
      baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    }
  }

  // Create cached version with tags for granular invalidation
  const getCachedDashboardData = unstable_cache(
    async () => {
      return fetchDashboardDataInternal(session.access_token, baseUrl);
    },
    [`dashboard-${supabaseUser.id}`], // Cache key
    {
      tags: [
        `user-${supabaseUser.id}`,
        `accounts-${supabaseUser.id}`,
        `transactions-${supabaseUser.id}`,
      ],
      revalidate: 30, // Revalidate every 30 seconds (time-based)
    },
  );

  return getCachedDashboardData();
}
