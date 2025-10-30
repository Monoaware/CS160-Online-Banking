import { getPrisma } from "@/app/lib/prisma";
import { getAuthUserFromRequest } from "@/lib/auth";
import { BillPayPayeeSchema } from "@/lib/schemas/billpay";

// Configure route segment
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * @swagger
 * /api/billpay/payees:
 *   get:
 *     summary: Get available billpay payees
 *     description: Retrieves all available billpay payees (can be filtered by business name)
 *     tags:
 *       - Billpay
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: business_name
 *         schema:
 *           type: string
 *         description: Filter payees by business name (partial match)
 *     responses:
 *       200:
 *         description: Successfully retrieved payees
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not onboarded
 *   post:
 *     summary: Create a new billpay payee
 *     description: Creates a new payee for billpay. Account validation is not required (black hole support)
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
 *               - business_name
 *               - email
 *               - phone
 *               - street_address
 *               - city
 *               - state_or_territory
 *               - postal_code
 *               - account_number
 *               - routing_number
 *             properties:
 *               business_name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               phone:
 *                 type: string
 *               street_address:
 *                 type: string
 *               address_line_2:
 *                 type: string
 *               city:
 *                 type: string
 *               state_or_territory:
 *                 type: string
 *               postal_code:
 *                 type: string
 *               country:
 *                 type: string
 *                 default: United States
 *               account_number:
 *                 type: string
 *               routing_number:
 *                 type: string
 *     responses:
 *       201:
 *         description: Payee created successfully
 *       400:
 *         description: Bad Request
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not onboarded
 *       409:
 *         description: Conflict - Payee already exists
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
    // Get query parameters
    const url = new URL(request.url);
    const businessNameFilter = url.searchParams.get("business_name");

    // Build where clause
    const whereClause: {
      business_name?: { contains: string; mode?: "insensitive" };
    } = {};

    if (businessNameFilter) {
      whereClause.business_name = {
        contains: businessNameFilter,
        mode: "insensitive",
      };
    }

    // Get payees (all payees are available to all users)
    const payees = await getPrisma().billPayPayee.findMany({
      where: whereClause,
      orderBy: { business_name: "asc" },
    });

    // Format response
    const formattedPayees = payees.map((payee) => ({
      id: payee.id,
      business_name: payee.business_name,
      email: payee.email,
      phone: payee.phone,
      street_address: payee.street_address,
      address_line_2: payee.address_line_2,
      city: payee.city,
      state_or_territory: payee.state_or_territory,
      postal_code: payee.postal_code,
      country: payee.country,
      account_number: payee.account_number,
      routing_number: payee.routing_number,
      is_active: payee.is_active,
    }));

    return new Response(JSON.stringify({ payees: formattedPayees }), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    console.error("Error fetching payees:", error);
    return new Response(
      JSON.stringify({
        error: {
          message: "Failed to fetch payees",
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

    const parseResult = BillPayPayeeSchema.safeParse(raw);
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

    const payeeData = parseResult.data;

    // Check if payee already exists (by routing + account number)
    // Note: We allow creating payees even if account doesn't exist externally (black hole)
    const existingPayee = await getPrisma().billPayPayee.findFirst({
      where: {
        routing_number: payeeData.routing_number,
        account_number: payeeData.account_number,
      },
    });

    if (existingPayee) {
      // Return existing payee instead of error (idempotent behavior)
      const formattedPayee = {
        id: existingPayee.id,
        business_name: existingPayee.business_name,
        email: existingPayee.email,
        phone: existingPayee.phone,
        street_address: existingPayee.street_address,
        address_line_2: existingPayee.address_line_2,
        city: existingPayee.city,
        state_or_territory: existingPayee.state_or_territory,
        postal_code: existingPayee.postal_code,
        country: existingPayee.country,
        account_number: existingPayee.account_number,
        routing_number: existingPayee.routing_number,
        is_active: existingPayee.is_active,
      };

      return new Response(JSON.stringify({ payee: formattedPayee }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Create payee (no external account validation - black hole support)
    const payee = await getPrisma().billPayPayee.create({
      data: {
        business_name: payeeData.business_name,
        email: payeeData.email,
        phone: payeeData.phone,
        street_address: payeeData.street_address,
        address_line_2: payeeData.address_line_2 || null,
        city: payeeData.city,
        state_or_territory: payeeData.state_or_territory,
        postal_code: payeeData.postal_code,
        country: payeeData.country,
        account_number: payeeData.account_number,
        routing_number: payeeData.routing_number,
        is_active: true,
      },
    });

    // Format response
    const formattedPayee = {
      id: payee.id,
      business_name: payee.business_name,
      email: payee.email,
      phone: payee.phone,
      street_address: payee.street_address,
      address_line_2: payee.address_line_2,
      city: payee.city,
      state_or_territory: payee.state_or_territory,
      postal_code: payee.postal_code,
      country: payee.country,
      account_number: payee.account_number,
      routing_number: payee.routing_number,
      is_active: payee.is_active,
    };

    return new Response(JSON.stringify({ payee: formattedPayee }), {
      headers: { "Content-Type": "application/json" },
      status: 201,
    });
  } catch (error) {
    console.error("Error creating payee:", error);
    return new Response(
      JSON.stringify({
        error: {
          message: "Failed to create payee",
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
