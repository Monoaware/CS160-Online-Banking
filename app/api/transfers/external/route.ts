import { getPrisma } from "@/app/lib/prisma";
import { getAuthUserFromRequest } from "@/lib/auth";
import { ExternalTransferSchema } from "@/lib/schemas/transfer";

// Configure route segment
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * @swagger
 * /api/transfers/external:
 *   post:
 *     summary: Create external transfer to another user
 *     description: Creates and executes a transfer to another user in the same bank via email/phone lookup (Zelle-style)
 *     tags:
 *       - External Transfers
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
 *               - amount
 *             properties:
 *               source_account_id:
 *                 type: integer
 *                 description: ID of the source account
 *               amount:
 *                 type: string
 *                 description: Amount as string (e.g., "100.50")
 *               recipient_email:
 *                 type: string
 *                 format: email
 *                 description: Recipient email address
 *               recipient_phone:
 *                 type: string
 *                 description: Recipient phone number (E.164 format)
 *               destination_account_id:
 *                 type: integer
 *                 description: Destination account ID (after lookup)
 *     responses:
 *       200:
 *         description: Transfer executed successfully
 *       400:
 *         description: Bad Request - Invalid transfer details
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found or account not found
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

    const parseResult = ExternalTransferSchema.safeParse(raw);
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

    const {
      source_account_id,
      amount,
      recipient_email,
      recipient_phone,
      destination_account_id,
    } = parseResult.data;

    // Verify source account belongs to the user
    const sourceAccount = currentUser.internal_accounts.find(
      (acc) => acc.id === source_account_id,
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

    // Check if source account is active
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

    // Lookup recipient if email/phone provided
    let destinationAccountId = destination_account_id;

    if (recipient_email || recipient_phone) {
      const whereClause: { email?: string; phone_number?: string } = {};
      if (recipient_email) {
        whereClause.email = recipient_email.toLowerCase().trim();
      } else if (recipient_phone) {
        whereClause.phone_number = recipient_phone.trim();
      }

      const recipientUser = await getPrisma().user.findFirst({
        where: whereClause,
        include: {
          internal_accounts: {
            where: { is_active: true },
          },
        },
      });

      if (!recipientUser) {
        // Black hole: recipient not found, but proceed with fake user info
        // This simulates a transfer to an external account that doesn't exist in our system
        const fakeRecipientName = "External Recipient";

        // Execute transfer with only outbound transaction (black hole)
        const result = await getPrisma().$transaction(async (tx) => {
          const idempotency_key = `external-transfer-blackhole-${source_account_id}-${Date.now()}`;
          const amountInDollars = amount / 100;

          // Create only outbound transaction (no inbound - black hole)
          const outboundTransaction = await tx.transaction.create({
            data: {
              internal_account_id: source_account_id,
              amount: -amountInDollars, // Negative for outbound
              transaction_type: "external_transfer",
              direction: "outbound",
              status: "approved",
              idempotency_key: `${idempotency_key}-outbound`,
              external_nickname: fakeRecipientName,
            },
          });

          // Deduct from source account
          await tx.internalAccount.update({
            where: { id: source_account_id },
            data: { balance: { decrement: amountInDollars } },
          });

          return {
            success: true,
            message: "Transfer completed successfully",
            transaction_id: outboundTransaction.id,
            recipient_name: fakeRecipientName,
            amount,
          };
        });

        return new Response(JSON.stringify(result), {
          headers: { "Content-Type": "application/json" },
        });
      }

      // Don't allow transferring to yourself
      if (recipientUser.id === currentUser.id) {
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

      // If no destination_account_id specified, use the first active account
      if (!destinationAccountId && recipientUser.internal_accounts.length > 0) {
        destinationAccountId = recipientUser.internal_accounts[0].id;
      }

      // If mock user (id: -1) or no accounts, treat as black hole
      if (recipientUser.id === -1 || !destinationAccountId) {
        // Black hole: mock user or no accounts, proceed with fake user info
        const fakeRecipientName = "External Recipient";

        // Execute transfer with only outbound transaction (black hole)
        const result = await getPrisma().$transaction(async (tx) => {
          const idempotency_key = `external-transfer-blackhole-${source_account_id}-${Date.now()}`;
          const amountInDollars = amount / 100;

          // Create only outbound transaction (no inbound - black hole)
          const outboundTransaction = await tx.transaction.create({
            data: {
              internal_account_id: source_account_id,
              amount: -amountInDollars, // Negative for outbound
              transaction_type: "external_transfer",
              direction: "outbound",
              status: "approved",
              idempotency_key: `${idempotency_key}-outbound`,
              external_nickname: fakeRecipientName,
            },
          });

          // Deduct from source account
          await tx.internalAccount.update({
            where: { id: source_account_id },
            data: { balance: { decrement: amountInDollars } },
          });

          return {
            success: true,
            message: "Transfer completed successfully",
            transaction_id: outboundTransaction.id,
            recipient_name: fakeRecipientName,
            amount,
          };
        });

        return new Response(JSON.stringify(result), {
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    if (!destinationAccountId) {
      return new Response(
        JSON.stringify({
          error: "Destination account ID is required",
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 400,
        },
      );
    }

    // Verify destination account exists and is active
    const destinationAccount = await getPrisma().internalAccount.findUnique({
      where: { id: destinationAccountId },
      include: { user: true },
    });

    if (!destinationAccount) {
      // Black hole: destination account not found, but proceed with fake user info
      const fakeRecipientName = "External Recipient";

      // Execute transfer with only outbound transaction (black hole)
      const result = await getPrisma().$transaction(async (tx) => {
        const idempotency_key = `external-transfer-blackhole-${source_account_id}-${Date.now()}`;
        const amountInDollars = amount / 100;

        // Create only outbound transaction (no inbound - black hole)
        const outboundTransaction = await tx.transaction.create({
          data: {
            internal_account_id: source_account_id,
            amount: -amountInDollars, // Negative for outbound
            transaction_type: "external_transfer",
            direction: "outbound",
            status: "approved",
            idempotency_key: `${idempotency_key}-outbound`,
            external_nickname: fakeRecipientName,
          },
        });

        // Deduct from source account
        await tx.internalAccount.update({
          where: { id: source_account_id },
          data: { balance: { decrement: amountInDollars } },
        });

        return {
          success: true,
          message: "Transfer completed successfully",
          transaction_id: outboundTransaction.id,
          recipient_name: fakeRecipientName,
          amount,
        };
      });

      return new Response(JSON.stringify(result), {
        headers: { "Content-Type": "application/json" },
      });
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

    // Don't allow transferring to yourself
    if (destinationAccount.user_id === currentUser.id) {
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

    // Execute transfer between accounts (similar to internal transfer but cross-user)
    const result = await getPrisma().$transaction(async (tx) => {
      // Create transactions for both accounts
      const idempotency_key = `external-transfer-${source_account_id}-${destinationAccountId}-${Date.now()}`;

      // amount is in cents, convert to dollars for transaction and balance updates
      const amountInDollars = amount / 100;

      // Create outbound transaction (from source account)
      const outboundTransaction = await tx.transaction.create({
        data: {
          internal_account_id: source_account_id,
          amount: -amountInDollars, // Negative for outbound
          transaction_type: "external_transfer",
          direction: "outbound",
          status: "approved",
          idempotency_key: `${idempotency_key}-outbound`,
        },
      });

      // Create inbound transaction (to destination account)
      await tx.transaction.create({
        data: {
          internal_account_id: destinationAccountId,
          amount: amountInDollars, // Positive for inbound
          transaction_type: "external_transfer",
          direction: "inbound",
          status: "approved",
          idempotency_key: `${idempotency_key}-inbound`,
        },
      });

      // Update both account balances
      await tx.internalAccount.update({
        where: { id: source_account_id },
        data: { balance: { decrement: amountInDollars } },
      });

      await tx.internalAccount.update({
        where: { id: destinationAccountId },
        data: { balance: { increment: amountInDollars } },
      });

      return {
        success: true,
        message: "Transfer completed successfully",
        transaction_id: outboundTransaction.id,
        recipient_name: `${destinationAccount.user.first_name} ${destinationAccount.user.last_name}`,
        amount,
      };
    });

    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error processing external transfer:", error);
    return new Response(
      JSON.stringify({
        error: {
          message: "Failed to process external transfer",
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
