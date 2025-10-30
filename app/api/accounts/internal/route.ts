import { getPrisma } from "@/app/lib/prisma";
import { getAuthUserFromRequest } from "@/lib/auth";
import { unstable_cache } from "next/cache";
// import { InternalAccountResponseSchema } from "@/lib/schemas/transfer";

/**
 * @swagger
 * /api/accounts/internal:
 *   get:
 *     summary: Get user's internal accounts
 *     description: Retrieves all internal accounts for the authenticated user with balances
 *     tags:
 *       - Accounts
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved accounts
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accounts:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       account_number:
 *                         type: string
 *                       account_type:
 *                         type: string
 *                         enum: [checking, savings]
 *                       balance:
 *                         type: number
 *                       is_active:
 *                         type: boolean
 *       401:
 *         description: Unauthorized - Invalid or missing authentication token
 *       404:
 *         description: User not onboarded
 *   post:
 *     summary: Create internal bank account
 *     description: Creates a new checking or savings account for the authenticated user
 *     tags:
 *       - Accounts
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - account_type
 *             properties:
 *               account_type:
 *                 type: string
 *                 enum: [checking, savings]
 *                 example: checking
 *               initial_deposit:
 *                 type: number
 *                 format: decimal
 *                 minimum: 0
 *                 example: 100.00
 *     responses:
 *       201:
 *         description: Account created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 account:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     account_number:
 *                       type: string
 *                       example: "12345678901234567"
 *                     routing_number:
 *                       type: string
 *                       example: "123456789"
 *                     account_type:
 *                       type: string
 *                       enum: [checking, savings]
 *                     balance:
 *                       type: number
 *                       format: decimal
 *                       example: 100.00
 *                     is_active:
 *                       type: boolean
 *                       example: true
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Bad Request - Invalid account type or initial deposit amount
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Invalid account type"
 *       401:
 *         description: Unauthorized - Invalid or missing authentication token
 *       404:
 *         description: Not Found - User not found or not onboarded
 *       500:
 *         description: Internal Server Error - Failed to create account
 */

interface CreateAccountRequest {
  account_type: "checking" | "savings";
  initial_deposit?: number;
}

async function generateUniqueAccountNumber(): Promise<string> {
  // We're generating unique account numbers through guess and check
  // This is pretty bad, but should be fine for now
  const maxAttempts = 10;
  let attempts = 0;

  while (attempts < maxAttempts) {
    // Generate 17-digit account number
    const accountNumber = Array.from({ length: 17 }, () =>
      Math.floor(Math.random() * 10),
    ).join("");

    // Check if account number exists
    const existing = await getPrisma().internalAccount.findUnique({
      where: { account_number: accountNumber },
    });

    if (!existing) {
      return accountNumber;
    }

    attempts++;
  }

  throw new Error(
    "Failed to generate unique account number after multiple attempts",
  );
}

export async function GET(request: Request) {
  // Auth check
  const auth = await getAuthUserFromRequest(request);
  if (!auth.ok) {
    return new Response(JSON.stringify(auth.body), {
      headers: { "Content-Type": "application/json" },
      status: auth.status,
    });
  }

  // Get database user ID for cache key
  const prisma = getPrisma();
  const dbUser = await prisma.user.findUnique({
    where: { auth_user_id: auth.supabaseUser.id },
    select: { id: true },
  });

  if (!dbUser) {
    return new Response(
      JSON.stringify({
        error: { message: "User not onboarded" },
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 404,
      },
    );
  }

  // Fetch with caching
  // Cache tags: user-{supabaseUserId}, accounts-{supabaseUserId}, user-{dbUserId}, accounts-{dbUserId}
  const getCachedAccounts = unstable_cache(
    async () => {
      const currentUser = await prisma.user.findUnique({
        where: { auth_user_id: auth.supabaseUser.id },
        include: { internal_accounts: true },
      });

      if (!currentUser) {
        return null;
      }

      // Convert Decimal balances to numbers and format response
      return currentUser.internal_accounts.map((account) => ({
        id: account.id,
        account_number: account.account_number,
        routing_number: account.routing_number,
        account_type: account.account_type,
        balance: Number(account.balance),
        is_active: account.is_active,
        created_at: account.created_at.toISOString(),
      }));
    },
    [`accounts-${auth.supabaseUser.id}-${dbUser.id}`],
    {
      tags: [
        `user-${auth.supabaseUser.id}`,
        `accounts-${auth.supabaseUser.id}`,
        `user-${dbUser.id}`,
        `accounts-${dbUser.id}`,
      ],
      revalidate: 30, // Revalidate every 30 seconds (time-based)
    },
  );

  const accounts = await getCachedAccounts();

  if (accounts === null) {
    return new Response(
      JSON.stringify({
        error: { message: "User not onboarded" },
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 404,
      },
    );
  }

  return new Response(JSON.stringify({ accounts }), {
    headers: {
      "Content-Type": "application/json",
      // Cache headers removed since we're using Next.js cache
    },
  });
}

export async function POST(request: Request) {
  // Auth check
  const auth = await getAuthUserFromRequest(request);
  if (!auth.ok) {
    return new Response(JSON.stringify(auth.body), {
      headers: { "Content-Type": "application/json" },
      status: auth.status,
    });
  }

  // Get current user
  const currentUser = await getPrisma().user.findUnique({
    where: { auth_user_id: auth.supabaseUser.id },
  });

  if (!currentUser) {
    return new Response(
      JSON.stringify({
        error: { message: "User not onboarded" },
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 404,
      },
    );
  }

  try {
    const data = (await request.json()) as CreateAccountRequest;

    // Validate account type
    if (
      !data.account_type ||
      !["checking", "savings"].includes(data.account_type)
    ) {
      return new Response(
        JSON.stringify({
          error: { message: "Invalid account type" },
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 400,
        },
      );
    }

    const accountNumber = await generateUniqueAccountNumber();

    // Create account
    const account = await getPrisma().internalAccount.create({
      data: {
        account_type: data.account_type,
        account_number: accountNumber,
        balance: data.initial_deposit || 0,
        user_id: currentUser.id,
      },
    });

    // Invalidate cache after successful account creation
    const { revalidateTag } = await import("next/cache");
    await revalidateTag(`user-${auth.supabaseUser.id}`);
    await revalidateTag(`accounts-${auth.supabaseUser.id}`);
    await revalidateTag(`user-${currentUser.id}`);
    await revalidateTag(`accounts-${currentUser.id}`);

    return new Response(JSON.stringify({ account }), {
      headers: { "Content-Type": "application/json" },
      status: 201,
    });
  } catch (error) {
    // Handle unique constraint violations
    if (error && typeof error === "object" && "code" in error) {
      if (error.code === "P2002") {
        return new Response(
          JSON.stringify({
            error: {
              message: "Account creation failed due to duplicate values",
            },
          }),
          {
            headers: { "Content-Type": "application/json" },
            status: 409,
          },
        );
      }
    }

    return new Response(
      JSON.stringify({
        error: {
          message: "Failed to create account",
          details: error instanceof Error ? error.message : "Unknown error",
        },
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
}
