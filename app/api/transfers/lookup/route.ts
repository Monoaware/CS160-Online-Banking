import { getPrisma } from "@/app/lib/prisma";
import { getAuthUserFromRequest } from "@/lib/auth";
import { z } from "zod";

// Configure route segment
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * @swagger
 * /api/transfers/lookup:
 *   get:
 *     summary: Lookup user by email or phone
 *     description: Finds a user account by email address or phone number for transfers
 *     tags:
 *       - Transfers
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: email
 *         schema:
 *           type: string
 *           format: email
 *         description: Email address to lookup
 *       - in: query
 *         name: phone
 *         schema:
 *           type: string
 *         description: Phone number to lookup (E.164 format)
 *     responses:
 *       200:
 *         description: User found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 found:
 *                   type: boolean
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     email:
 *                       type: string
 *                     phone_number:
 *                       type: string
 *                     first_name:
 *                       type: string
 *                     last_name:
 *                       type: string
 *                     accounts:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           account_type:
 *                             type: string
 *       404:
 *         description: User not found
 *       401:
 *         description: Unauthorized
 *       400:
 *         description: Bad Request - Must provide email or phone
 */

const LookupQuerySchema = z
  .object({
    email: z.string().email().optional(),
    phone: z.string().optional(),
  })
  .refine((data) => data.email || data.phone, {
    message: "Must provide either email or phone",
  });

export async function GET(request: Request) {
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
    // Parse query parameters
    const url = new URL(request.url);
    const queryParams = {
      email: url.searchParams.get("email") || undefined,
      phone: url.searchParams.get("phone") || undefined,
    };

    const parseResult = LookupQuerySchema.safeParse(queryParams);
    if (!parseResult.success) {
      return new Response(
        JSON.stringify({
          error: "Invalid query parameters",
          details: parseResult.error.issues,
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 400,
        },
      );
    }

    const { email, phone } = parseResult.data;

    // Lookup user by email or phone
    const whereClause: { email?: string; phone_number?: string } = {};
    if (email) {
      whereClause.email = email.toLowerCase().trim();
    } else if (phone) {
      whereClause.phone_number = phone.trim();
    }

    const foundUser = await getPrisma().user.findFirst({
      where: whereClause,
      include: {
        internal_accounts: {
          where: { is_active: true },
          select: {
            id: true,
            account_type: true,
          },
        },
      },
    });

    if (!foundUser) {
      // Black hole: return mock user info when recipient not found
      return new Response(
        JSON.stringify({
          found: true,
          user: {
            id: -1, // Special ID indicating mock user
            email: email || phone || "external@recipient.com",
            phone_number: phone || email || "+0000000000",
            first_name: "External",
            last_name: "Recipient",
            accounts: [],
          },
        }),
        {
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Don't allow transferring to yourself
    if (foundUser.id === currentUser.id) {
      return new Response(
        JSON.stringify({
          error:
            "Cannot transfer to your own account. Use Internal Transfer instead.",
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 400,
        },
      );
    }

    // Return user info (without sensitive data)
    return new Response(
      JSON.stringify({
        found: true,
        user: {
          id: foundUser.id,
          email: foundUser.email,
          phone_number: foundUser.phone_number,
          first_name: foundUser.first_name,
          last_name: foundUser.last_name,
          accounts: foundUser.internal_accounts.map(
            (acc: { id: number; account_type: string }) => ({
              id: acc.id,
              account_type: acc.account_type,
            }),
          ),
        },
      }),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Error looking up user:", error);
    return new Response(
      JSON.stringify({
        error: {
          message: "Failed to lookup user",
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
