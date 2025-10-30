import { getPrisma } from "@/app/lib/prisma";
import { getAuthUserFromRequest } from "@/lib/auth";
import { InternalTransferSchema } from "@/lib/schemas/transfer";

// Configure route segment
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * @swagger
 * /api/transfers/internal:
 *   post:
 *     summary: Create internal transfer
 *     description: Creates and executes a one-time internal transfer between user's accounts
 *     tags:
 *       - Internal Transfers
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - source_account_id
 *               - destination_account_id
 *               - amount
 *             properties:
 *               source_account_id:
 *                 type: integer
 *                 description: ID of the source account
 *               destination_account_id:
 *                 type: integer
 *                 description: ID of the destination account
 *               amount:
 *                 type: integer
 *                 description: Amount in cents
 *                 minimum: 1
 *                 maximum: 999999999
 *     responses:
 *       200:
 *         description: Transfer executed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 transaction_id:
 *                   type: integer
 *                 amount:
 *                   type: integer
 *       400:
 *         description: Bad Request - Invalid transfer details
 *       401:
 *         description: Unauthorized - Invalid or missing authentication token
 *       404:
 *         description: User not onboarded or account not found
 *       409:
 *         description: Conflict - Insufficient funds
 *       422:
 *         description: Unprocessable Entity - Invalid request body
 *       500:
 *         description: Internal Server Error
 */

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
    include: { internal_accounts: true },
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

    const parseResult = InternalTransferSchema.safeParse(raw);
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

    const { source_account_id, destination_account_id, amount } =
      parseResult.data;

    // Verify both accounts belong to the user
    const sourceAccount = currentUser.internal_accounts.find(
      (acc) => acc.id === source_account_id,
    );
    const destinationAccount = currentUser.internal_accounts.find(
      (acc) => acc.id === destination_account_id,
    );

    if (!sourceAccount) {
      return new Response(
        JSON.stringify({
          error: "Source account not found or does not belong to user",
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 404,
        },
      );
    }

    if (!destinationAccount) {
      return new Response(
        JSON.stringify({
          error: "Destination account not found or does not belong to user",
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 404,
        },
      );
    }

    // Check if accounts are active
    if (!sourceAccount.is_active) {
      return new Response(
        JSON.stringify({
          error: "Source account is inactive",
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 400,
        },
      );
    }

    if (!destinationAccount.is_active) {
      return new Response(
        JSON.stringify({
          error: "Destination account is inactive",
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 400,
        },
      );
    }

    // Check sufficient funds
    // amount is in cents, balance is in dollars
    const amountInDollars = amount / 100;
    if (Number(sourceAccount.balance) < amountInDollars) {
      return new Response(
        JSON.stringify({
          error: "Insufficient funds",
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 409,
        },
      );
    }

    // Create transfer rule and execute transfer
    const result = await getPrisma().$transaction(async (tx) => {
      // Create a one-time transfer rule
      const transferRule = await tx.transferRule.create({
        data: {
          user_id: currentUser.id,
          transfer_kind: "one_off",
          direction: "outbound",
          amount,
          start_time: new Date(),
          run_at: new Date(), // Execute immediately
          source_internal_id: source_account_id,
          destination_internal_id: destination_account_id,
        },
      });

      // Execute the transfer by calling the existing transaction API logic
      // We'll simulate the transaction creation here since we can't call the API from within the API
      const idempotency_key = `internal-transfer-${transferRule.id}-${Date.now()}`;

      // amount is in cents, convert to dollars for transaction and balance updates
      const amountInDollars = amount / 100;

      // Create outbound transaction (from source account)
      const outboundTransaction = await tx.transaction.create({
        data: {
          internal_account_id: source_account_id,
          amount: -amountInDollars, // Negative for outbound
          transaction_type: "internal_transfer",
          direction: "outbound",
          status: "approved",
          transfer_rule_id: transferRule.id,
          idempotency_key,
        },
      });

      // Create inbound transaction (to destination account)
      await tx.transaction.create({
        data: {
          internal_account_id: destination_account_id,
          amount: amountInDollars, // Positive for inbound
          transaction_type: "internal_transfer",
          direction: "inbound",
          status: "approved",
          transfer_rule_id: transferRule.id,
          idempotency_key: `${idempotency_key}-inbound`,
        },
      });

      // Update account balances
      await tx.internalAccount.update({
        where: { id: source_account_id },
        data: { balance: { decrement: amountInDollars } },
      });

      await tx.internalAccount.update({
        where: { id: destination_account_id },
        data: { balance: { increment: amountInDollars } },
      });

      return {
        success: true,
        message: "Internal transfer completed successfully",
        transaction_id: outboundTransaction.id,
        amount,
      };
    });

    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error processing internal transfer:", error);
    return new Response(
      JSON.stringify({
        error: {
          message: "Failed to process internal transfer",
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
