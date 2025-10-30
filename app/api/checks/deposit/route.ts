import { getAuthUserFromRequest } from "@/lib/auth";
import { getPrisma } from "@/app/lib/prisma";
import {
  json,
  createDeniedTransaction,
  createApprovedTransaction,
  findExistingTransaction,
} from "@/app/lib/transactions";
import {
  extractCheckDataFromImage,
  validateExtractedCheck,
  getPresignedUrl,
} from "@/app/lib/checks";
import { Decimal } from "@prisma/client/runtime/library";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CheckDepositSchema = z.object({
  check_image_url: z.string().url("Invalid check image URL"),
  destination_account_number: z.string().min(1, "Account number required"),
  idempotency_key: z.string().optional(),
});

/**
 * @swagger
 * /api/checks/deposit:
 *   post:
 *     summary: Process check deposit
 *     description: Extracts check data using Groq Vision API, validates it, and creates a deposit transaction
 *     tags:
 *       - Check Deposits
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: header
 *         name: Idempotency-Key
 *         schema:
 *           type: string
 *         required: false
 *         description: Optional idempotency key to prevent duplicate transaction processing
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - check_image_url
 *               - destination_account_number
 *             properties:
 *               check_image_url:
 *                 type: string
 *                 format: uri
 *                 description: URL of the check image (from upload endpoint or Supabase storage)
 *               destination_account_number:
 *                 type: string
 *                 description: Account number to deposit funds into
 *               idempotency_key:
 *                 type: string
 *                 description: Optional idempotency key for duplicate prevention
 *     responses:
 *       200:
 *         description: Transaction processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 transaction_id:
 *                   type: integer
 *                 amount:
 *                   type: number
 *                 validation_result:
 *                   type: object
 *       400:
 *         description: Bad Request - Invalid image URL or extraction failed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Account inactive or check validation failed
 *       404:
 *         description: Account not found
 *       500:
 *         description: Internal Server Error
 */
export async function POST(request: Request) {
  try {
    // Authenticate user
    const auth = await getAuthUserFromRequest(request);
    if (!auth.ok) {
      return json(auth.status, { error: auth.body.message });
    }

    // Parse request body
    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return json(400, { error: "Invalid JSON body" });
    }

    const parseResult = CheckDepositSchema.safeParse(raw);
    if (!parseResult.success) {
      return json(422, {
        error: "Invalid request body",
        details: parseResult.error.issues,
      });
    }

    const {
      check_image_url,
      destination_account_number,
      idempotency_key: bodyIdempotencyKey,
    } = parseResult.data;

    // Get idempotency key from header or body
    const idempotency_key =
      request.headers.get("Idempotency-Key")?.trim() ||
      bodyIdempotencyKey ||
      null;

    const prisma = getPrisma();

    // Verify account belongs to user
    const account = await prisma.internalAccount.findUnique({
      where: { account_number: destination_account_number },
      include: { user: true },
    });

    if (!account || account.user.auth_user_id !== auth.supabaseUser.id) {
      return json(404, {
        error: "Destination account not found or does not belong to user",
      });
    }

    if (!account.is_active) {
      return json(403, {
        error: "Forbidden: Destination account is inactive",
      });
    }

    // Generate pre-signed URL if needed (for private Supabase buckets)
    // For now, we'll try to use the URL directly, and if it fails, we'll generate a signed URL
    let imageUrlForGroq = check_image_url;
    try {
      // Check if URL is a Supabase storage URL and might need signing
      if (check_image_url.includes("supabase.co/storage")) {
        // Try to extract path from URL
        const urlParts = check_image_url.split(
          "/storage/v1/object/public/checks/",
        );
        if (urlParts.length > 1) {
          const filePath = urlParts[1];
          // Generate signed URL for better access
          imageUrlForGroq = await getPresignedUrl(filePath, 3600);
        }
      }
    } catch (error) {
      // If signing fails, use original URL
      console.warn("Failed to generate signed URL, using original:", error);
    }

    // Extract check data using Groq Vision API
    const extractionResult = await extractCheckDataFromImage(imageUrlForGroq);

    // Validate extracted data
    const validationResult = validateExtractedCheck(extractionResult);

    if (!validationResult.valid) {
      // Create denied transaction
      return await prisma.$transaction(async (tx) => {
        const deniedTransaction = await createDeniedTransaction(tx, {
          internal_account_id: account.id,
          amount: new Decimal(0), // Use 0 for denied transactions
          transaction_type: "deposit",
          direction: "inbound",
          idempotency_key,
        });

        // Update transaction with check_image_url
        await tx.transaction.update({
          where: { id: deniedTransaction.id },
          data: {
            check_image_url: check_image_url,
            check_number: extractionResult.success
              ? extractionResult.data.check_number || null
              : null,
          },
        });

        return json(403, {
          status: "Check deposit denied",
          error: validationResult.error,
          transaction_id: deniedTransaction.id,
        });
      });
    }

    // If we got here, extraction was successful
    const extractedData = extractionResult.success
      ? extractionResult.data
      : null;
    if (!extractedData) {
      return json(400, { error: "Failed to extract check data" });
    }

    const amount = new Decimal(extractedData.amount.toString());

    // Create deposit transaction
    return await prisma.$transaction(async (tx) => {
      // Check for existing transaction
      const existing = await findExistingTransaction(tx, {
        idempotency_key,
        transaction_type: "deposit",
        internal_account_id: account.id,
        amount,
      });

      if (existing) {
        return json(200, {
          status: "Deposit already processed (idempotency key found)",
          transaction_id: existing.id,
          amount: Number(amount),
        });
      }

      // Update account balance
      await tx.internalAccount.update({
        where: { id: account.id },
        data: { balance: { increment: amount } },
      });

      // Create approved transaction
      const result = await createApprovedTransaction(
        tx,
        {
          internal_account_id: account.id,
          amount,
          transaction_type: "deposit",
          direction: "inbound",
          idempotency_key,
        },
        "Check deposit successful",
      );

      if (!result.transaction) {
        return json(500, { error: "Failed to create transaction" });
      }

      // Update transaction with check-specific data
      await tx.transaction.update({
        where: { id: result.transaction.id },
        data: {
          check_image_url: check_image_url,
          check_number: extractedData.check_number || null,
          external_routing_number: extractedData.routing_number || null,
          external_account_number: extractedData.account_number || null,
        },
      });

      return json(200, {
        status: result.duplicate ? result.message : "Check deposit successful",
        transaction_id: result.transaction.id,
        amount: Number(amount),
        validation_result: {
          extracted_amount: extractedData.amount,
          routing_number: extractedData.routing_number,
          account_number: extractedData.account_number,
          check_number: extractedData.check_number,
          payee_name: extractedData.payee_name,
          payor_name: extractedData.payor_name,
        },
      });
    });
  } catch (error) {
    console.error("Error processing check deposit:", error);
    return json(500, {
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
}
