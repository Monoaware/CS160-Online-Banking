import { getPrisma } from "@/app/lib/prisma";
import { getAuthUserFromRequest } from "@/lib/auth";
import { BillPayRuleCreateSchema } from "@/lib/schemas/billpay";
import { Decimal } from "@prisma/client/runtime/library";

// Configure route segment
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Helper function to schedule a pg_cron job for a billpay rule
 */
async function scheduleCronJob(
  ruleId: number,
  frequency: string,
): Promise<void> {
  const prisma = getPrisma();
  const jobName = `billpay_rule_${ruleId}`;

  // Schedule the cron job to call the process_billpay_rule function
  // Note: This assumes the function exists in the database (created via migration)
  // pg_cron.schedule(job_name, schedule, command)
  // Use parameterized query to prevent SQL injection
  await prisma.$executeRawUnsafe(
    `SELECT cron.schedule($1, $2, $3)`,
    jobName,
    frequency,
    `SELECT process_billpay_rule(${ruleId})`,
  );
}

/**
 * @swagger
 * /api/billpay/rules:
 *   get:
 *     summary: Get user's billpay rules
 *     description: Retrieves all billpay rules for the authenticated user
 *     tags:
 *       - Billpay
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved billpay rules
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not onboarded
 *   post:
 *     summary: Create a new billpay rule
 *     description: Creates a new billpay rule with cron scheduling
 *     tags:
 *       - Billpay
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
 *               - frequency
 *               - start_time
 *             properties:
 *               source_account_id:
 *                 type: integer
 *               payee_id:
 *                 type: integer
 *               payee:
 *                 type: object
 *               amount:
 *                 type: string
 *               frequency:
 *                 type: string
 *               start_time:
 *                 type: string
 *               end_time:
 *                 type: string
 *     responses:
 *       201:
 *         description: Billpay rule created successfully
 *       400:
 *         description: Bad Request
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not onboarded
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
    // Get user's billpay rules
    const rules = await getPrisma().billPayRule.findMany({
      where: { user_id: currentUser.id },
      include: {
        payee: true,
        source_internal: true,
      },
      orderBy: { id: "desc" },
    });

    // Format response
    const formattedRules = rules.map((rule) => ({
      id: rule.id,
      user_id: rule.user_id,
      source_internal_id: rule.source_internal_id,
      payee_id: rule.payee_id,
      amount: Number(rule.amount), // Convert Decimal to number
      frequency: rule.frequency,
      start_time: rule.start_time.toISOString(),
      end_time: rule.end_time?.toISOString() || null,
    }));

    return new Response(JSON.stringify({ rules: formattedRules }), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    console.error("Error fetching billpay rules:", error);
    return new Response(
      JSON.stringify({
        error: {
          message: "Failed to fetch billpay rules",
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

    const parseResult = BillPayRuleCreateSchema.safeParse(raw);
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

    const ruleData = parseResult.data;

    // Verify source account belongs to the user
    const sourceAccount = currentUser.internal_accounts.find(
      (acc) => acc.id === ruleData.source_account_id,
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

    // Validate start_time is in the future
    const startTime = new Date(ruleData.start_time);
    if (startTime <= new Date()) {
      return new Response(
        JSON.stringify({
          error: "Start time must be in the future",
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 400,
        },
      );
    }

    // Validate end_time is after start_time if provided
    if (ruleData.end_time) {
      const endTime = new Date(ruleData.end_time);
      if (endTime <= startTime) {
        return new Response(
          JSON.stringify({
            error: "End time must be after start time",
          }),
          {
            headers: { "Content-Type": "application/json" },
            status: 400,
          },
        );
      }
    }

    // Convert amount from cents to dollars for database storage
    const amountInDollars = new Decimal(ruleData.amount / 100);

    // Create rule and payee (if needed) in a transaction
    const result = await getPrisma().$transaction(async (tx) => {
      let payeeId: number;

      if (ruleData.payee_id) {
        // Use existing payee
        const payee = await tx.billPayPayee.findUnique({
          where: { id: ruleData.payee_id },
        });

        if (!payee) {
          throw new Error("Payee not found");
        }

        payeeId = payee.id;
      } else if (ruleData.payee) {
        // Create new payee or find existing one
        const existingPayee = await tx.billPayPayee.findFirst({
          where: {
            routing_number: ruleData.payee.routing_number,
            account_number: ruleData.payee.account_number,
          },
        });

        if (existingPayee) {
          payeeId = existingPayee.id;
        } else {
          const newPayee = await tx.billPayPayee.create({
            data: {
              business_name: ruleData.payee.business_name,
              email: ruleData.payee.email,
              phone: ruleData.payee.phone,
              street_address: ruleData.payee.street_address,
              address_line_2: ruleData.payee.address_line_2 || null,
              city: ruleData.payee.city,
              state_or_territory: ruleData.payee.state_or_territory,
              postal_code: ruleData.payee.postal_code,
              country: ruleData.payee.country,
              account_number: ruleData.payee.account_number,
              routing_number: ruleData.payee.routing_number,
              is_active: true,
            },
          });
          payeeId = newPayee.id;
        }
      } else {
        throw new Error("Either payee_id or payee data is required");
      }

      // Create billpay rule
      const rule = await tx.billPayRule.create({
        data: {
          user_id: currentUser.id,
          source_internal_id: ruleData.source_account_id,
          payee_id: payeeId,
          amount: amountInDollars,
          frequency: ruleData.frequency,
          start_time: startTime,
          end_time: ruleData.end_time ? new Date(ruleData.end_time) : null,
        },
      });

      return rule;
    });

    // Schedule cron job for this rule
    try {
      await scheduleCronJob(result.id, ruleData.frequency);
    } catch (error) {
      console.error(
        `Failed to schedule cron job for rule ${result.id}:`,
        error,
      );
      // Continue even if cron scheduling fails - rule is still created
      // User can manually trigger or retry cron setup later
    }

    // Format response
    const formattedRule = {
      id: result.id,
      user_id: result.user_id,
      source_internal_id: result.source_internal_id,
      payee_id: result.payee_id,
      amount: Number(result.amount),
      frequency: result.frequency,
      start_time: result.start_time.toISOString(),
      end_time: result.end_time?.toISOString() || null,
    };

    return new Response(JSON.stringify({ rule: formattedRule }), {
      headers: { "Content-Type": "application/json" },
      status: 201,
    });
  } catch (error) {
    console.error("Error creating billpay rule:", error);
    return new Response(
      JSON.stringify({
        error: {
          message: "Failed to create billpay rule",
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
