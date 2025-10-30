import { getPrisma } from "@/app/lib/prisma";
import { getAuthUserFromRequest } from "@/lib/auth";
import { ExternalAccountSchema } from "@/lib/schemas/transfer";

// Configure route segment
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * @swagger
 * /api/transfers/external-accounts:
 *   get:
 *     summary: Get user's saved external accounts
 *     description: Retrieves all saved external accounts for the authenticated user
 *     tags:
 *       - External Accounts
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved external accounts
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
 *                       nickname:
 *                         type: string
 *                         nullable: true
 *                       account_number:
 *                         type: string
 *                       routing_number:
 *                         type: string
 *       401:
 *         description: Unauthorized - Invalid or missing authentication token
 *       404:
 *         description: User not onboarded
 *   post:
 *     summary: Save external account
 *     description: Saves a new external account for the authenticated user
 *     tags:
 *       - External Accounts
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - account_number
 *               - routing_number
 *             properties:
 *               nickname:
 *                 type: string
 *                 maxLength: 30
 *               account_number:
 *                 type: string
 *                 maxLength: 17
 *               routing_number:
 *                 type: string
 *                 pattern: "^[0-9]{9}$"
 *     responses:
 *       201:
 *         description: External account saved successfully
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
 *                     nickname:
 *                       type: string
 *                       nullable: true
 *                     account_number:
 *                       type: string
 *                     routing_number:
 *                       type: string
 *       400:
 *         description: Bad Request - Invalid account details
 *       401:
 *         description: Unauthorized - Invalid or missing authentication token
 *       404:
 *         description: User not onboarded
 *       409:
 *         description: Conflict - External account already exists
 *       500:
 *         description: Internal Server Error
 */

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
    // Get user's external accounts
    const externalAccounts = await getPrisma().externalAccount.findMany({
      where: { user_id: currentUser.id },
      orderBy: { id: "desc" },
    });

    // Format response
    const accounts = externalAccounts.map((account) => ({
      id: account.id,
      nickname: account.nickname,
      account_number: account.account_number,
      routing_number: account.routing_number,
    }));

    return new Response(JSON.stringify({ accounts }), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    console.error("Error fetching external accounts:", error);
    return new Response(
      JSON.stringify({
        error: {
          message: "Failed to fetch external accounts",
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
    // Parse and validate request body
    let raw: unknown;
    try {
      raw = await request.json();
    } catch (error) {
      console.error("Error parsing JSON body:", error);
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        headers: { "Content-Type": "application/json" },
        status: 400,
      });
    }

    const parseResult = ExternalAccountSchema.safeParse(raw);
    if (!parseResult.success) {
      return new Response(
        JSON.stringify({
          error: "Invalid request body",
          details: parseResult.error.issues,
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 422,
        },
      );
    }

    const { nickname, account_number, routing_number } = parseResult.data;

    // Check if external account already exists for this user
    const existingAccount = await getPrisma().externalAccount.findUnique({
      where: {
        user_id_routing_number_account_number: {
          user_id: currentUser.id,
          routing_number,
          account_number,
        },
      },
    });

    if (existingAccount) {
      return new Response(
        JSON.stringify({
          error: "External account already exists",
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 409,
        },
      );
    }

    // Create external account
    const externalAccount = await getPrisma().externalAccount.create({
      data: {
        user_id: currentUser.id,
        nickname: nickname || null,
        account_number,
        routing_number,
      },
    });

    // Format response
    const account = {
      id: externalAccount.id,
      nickname: externalAccount.nickname,
      account_number: externalAccount.account_number,
      routing_number: externalAccount.routing_number,
    };

    return new Response(JSON.stringify({ account }), {
      headers: { "Content-Type": "application/json" },
      status: 201,
    });
  } catch (error) {
    console.error("Error creating external account:", error);
    return new Response(
      JSON.stringify({
        error: {
          message: "Failed to create external account",
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
