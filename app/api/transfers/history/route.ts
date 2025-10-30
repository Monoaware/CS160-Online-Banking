import { getPrisma } from "@/app/lib/prisma";
import { getAuthUserFromRequest } from "@/lib/auth";
import { TransferHistoryQuerySchema } from "@/lib/schemas/transfer";

// Configure route segment
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * @swagger
 * /api/transfers/history:
 *   get:
 *     summary: Get transfer history
 *     description: Retrieves paginated transfer history for the authenticated user
 *     tags:
 *       - Transfer History
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of items per page
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [internal_transfer, external_transfer]
 *         description: Filter by transfer type
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter transfers from this date
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter transfers until this date
 *     responses:
 *       200:
 *         description: Successfully retrieved transfer history
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 transfers:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                       amount:
 *                         type: integer
 *                         description: Amount in cents
 *                       status:
 *                         type: string
 *                         enum: [approved, denied]
 *                       transaction_type:
 *                         type: string
 *                         enum: [internal_transfer, external_transfer]
 *                       direction:
 *                         type: string
 *                         enum: [inbound, outbound]
 *                       source_account_number:
 *                         type: string
 *                       destination_account_number:
 *                         type: string
 *                       external_routing_number:
 *                         type: string
 *                       external_account_number:
 *                         type: string
 *                       external_nickname:
 *                         type: string
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     total_pages:
 *                       type: integer
 *       401:
 *         description: Unauthorized - Invalid or missing authentication token
 *       404:
 *         description: User not onboarded
 *       422:
 *         description: Unprocessable Entity - Invalid query parameters
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
    // Parse and validate query parameters
    const url = new URL(request.url);
    const queryParams = {
      page: url.searchParams.get("page")
        ? parseInt(url.searchParams.get("page")!)
        : 1,
      limit: url.searchParams.get("limit")
        ? parseInt(url.searchParams.get("limit")!)
        : 20,
      type: url.searchParams.get("type") || undefined,
      start_date: url.searchParams.get("start_date") || undefined,
      end_date: url.searchParams.get("end_date") || undefined,
    };

    const parseResult = TransferHistoryQuerySchema.safeParse(queryParams);
    if (!parseResult.success) {
      return new Response(
        JSON.stringify({
          error: "Invalid query parameters",
          details: parseResult.error.issues,
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 422,
        },
      );
    }

    const { page, limit, type, start_date, end_date } = parseResult.data;
    const skip = (page - 1) * limit;

    // Get user's account IDs
    const accountIds = currentUser.internal_accounts.map((acc) => acc.id);

    // Build where clause for filtering
    const whereClause: {
      internal_account_id: { in: number[] };
      transaction_type: { in: ("internal_transfer" | "external_transfer")[] };
      created_at?: { gte?: Date; lte?: Date };
    } = {
      internal_account_id: { in: accountIds },
      transaction_type: { in: ["internal_transfer", "external_transfer"] },
    };

    if (type) {
      whereClause.transaction_type = { in: [type] };
    }

    if (start_date || end_date) {
      whereClause.created_at = {};
      if (start_date) {
        whereClause.created_at.gte = new Date(start_date);
      }
      if (end_date) {
        whereClause.created_at.lte = new Date(end_date);
      }
    }

    // Get total count for pagination
    const total = await getPrisma().transaction.count({
      where: whereClause,
    });

    // Get transfers with pagination, including transfer rule to get account info
    const transactions = await getPrisma().transaction.findMany({
      where: whereClause,
      include: {
        transfer_rule: {
          include: {
            source_internal: true,
            destination_internal: true,
          },
        },
      },
      orderBy: { created_at: "desc" },
      skip,
      take: limit,
    });

    // Format response
    const transfers = transactions.map((transaction) => {
      // For internal transfers, use transfer rule to determine source/destination
      let source_account_number: string | undefined;
      let destination_account_number: string | undefined;

      if (
        transaction.transaction_type === "internal_transfer" &&
        transaction.transfer_rule
      ) {
        const transferRule = transaction.transfer_rule;
        if (transaction.direction === "outbound") {
          // This is a debit from source account, money goes to destination
          source_account_number = currentUser.internal_accounts.find(
            (acc) => acc.id === transaction.internal_account_id,
          )?.account_number;
          destination_account_number = transferRule.destination_internal
            ? currentUser.internal_accounts.find(
                (acc) => acc.id === transferRule.destination_internal_id,
              )?.account_number
            : undefined;
        } else {
          // This is a credit to destination account, money came from source
          source_account_number = transferRule.source_internal
            ? currentUser.internal_accounts.find(
                (acc) => acc.id === transferRule.source_internal_id,
              )?.account_number
            : undefined;
          destination_account_number = currentUser.internal_accounts.find(
            (acc) => acc.id === transaction.internal_account_id,
          )?.account_number;
        }
      } else if (transaction.transaction_type === "external_transfer") {
        // For external transfers, source is always the internal account
        source_account_number = transaction.external_routing_number
          ? undefined
          : currentUser.internal_accounts.find(
              (acc) => acc.id === transaction.internal_account_id,
            )?.account_number;
        destination_account_number = undefined;
      }

      return {
        id: transaction.id,
        created_at: transaction.created_at.toISOString(),
        // Convert amount from dollars to cents for API response
        amount: Math.round(Number(transaction.amount) * 100),
        status: transaction.status,
        transaction_type: transaction.transaction_type,
        direction: transaction.direction,
        source_account_number,
        destination_account_number,
        external_routing_number: transaction.external_routing_number,
        external_account_number: transaction.external_account_number,
        external_nickname: transaction.external_nickname,
      };
    });

    const totalPages = Math.ceil(total / limit);

    return new Response(
      JSON.stringify({
        transfers,
        pagination: {
          page,
          limit,
          total,
          total_pages: totalPages,
        },
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "private, no-cache, no-store, must-revalidate",
        },
      },
    );
  } catch (error) {
    console.error("Error fetching transfer history:", error);
    return new Response(
      JSON.stringify({
        error: {
          message: "Failed to fetch transfer history",
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
