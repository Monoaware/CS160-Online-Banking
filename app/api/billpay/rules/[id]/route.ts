import { getPrisma } from "@/app/lib/prisma";
import { getAuthUserFromRequest } from "@/lib/auth";

// Configure route segment
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Helper function to unschedule a pg_cron job for a billpay rule
 */
async function unscheduleCronJob(ruleId: number): Promise<void> {
  const prisma = getPrisma();
  const jobName = `billpay_rule_${ruleId}`;

  try {
    await prisma.$executeRawUnsafe(`SELECT cron.unschedule($1::text)`, jobName);
  } catch (error) {
    // If job doesn't exist, that's okay - just log it
    console.warn(`Failed to unschedule cron job ${jobName}:`, error);
  }
}

/**
 * @swagger
 * /api/billpay/rules/{id}:
 *   delete:
 *     summary: Delete a billpay rule
 *     description: Deletes a billpay rule and unschedules its cron job
 *     tags:
 *       - Billpay
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Billpay rule deleted successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not onboarded or rule not found
 *       403:
 *         description: Forbidden - Rule does not belong to user
 *       500:
 *         description: Internal Server Error
 */

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // Await params in Next.js 15
  const { id } = await params;

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
    const ruleId = parseInt(id, 10);
    if (isNaN(ruleId)) {
      return new Response(
        JSON.stringify({
          error: "Invalid rule ID",
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 400,
        },
      );
    }

    // Find rule and verify ownership
    const rule = await getPrisma().billPayRule.findUnique({
      where: { id: ruleId },
    });

    if (!rule) {
      return new Response(
        JSON.stringify({
          error: "Billpay rule not found",
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 404,
        },
      );
    }

    if (rule.user_id !== currentUser.id) {
      return new Response(
        JSON.stringify({
          error: "Forbidden: You do not have permission to delete this rule",
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 403,
        },
      );
    }

    // Unschedule cron job first
    await unscheduleCronJob(ruleId);

    // Delete the rule
    await getPrisma().billPayRule.delete({
      where: { id: ruleId },
    });

    return new Response(
      JSON.stringify({
        message: "Billpay rule deleted successfully",
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    console.error("Error deleting billpay rule:", error);
    return new Response(
      JSON.stringify({
        error: {
          message: "Failed to delete billpay rule",
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
