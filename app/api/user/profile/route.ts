import { getPrisma } from "@/app/lib/prisma";
import { getAuthUserFromRequest } from "@/lib/auth";
import { UpdateProfileSchema } from "@/lib/schemas/user";
import { unstable_cache } from "next/cache";

/**
 * @swagger
 * /api/user/profile:
 *   get:
 *     summary: Get user profile
 *     description: Retrieves the profile information for the authenticated user
 *     tags:
 *       - User Profile
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved user profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized - Invalid or missing authentication token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Unauthorized
 *       404:
 *         description: User not onboarded
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: User not onboarded
 */
export async function GET(request: Request) {
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
    return new Response(JSON.stringify({ message: "User not onboarded" }), {
      headers: { "Content-Type": "application/json" },
      status: 404,
    });
  }

  // Fetch with caching
  // Cache tags: user-{supabaseUserId} and user-{dbUserId} for granular invalidation
  const getCachedUserProfile = unstable_cache(
    async () => {
      return prisma.user.findUnique({
        where: { auth_user_id: auth.supabaseUser.id },
      });
    },
    [`profile-${auth.supabaseUser.id}-${dbUser.id}`],
    {
      tags: [
        `user-${auth.supabaseUser.id}`,
        `user-${dbUser.id}`,
        `profile-${auth.supabaseUser.id}`,
        `profile-${dbUser.id}`,
      ],
      revalidate: 60, // Revalidate every 60 seconds (time-based)
    },
  );

  const currentUser = await getCachedUserProfile();

  if (!currentUser) {
    return new Response(JSON.stringify({ message: "User not onboarded" }), {
      headers: { "Content-Type": "application/json" },
      status: 404,
    });
  }

  return new Response(JSON.stringify({ user: currentUser }), {
    headers: {
      "Content-Type": "application/json",
      // Cache headers removed since we're using Next.js cache
    },
  });
}

/**
 * @swagger
 * /api/user/profile:
 *   put:
 *     summary: Update user profile
 *     description: Updates the profile information for the authenticated user
 *     tags:
 *       - User Profile
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - first_name
 *               - last_name
 *               - phone_number
 *               - street_address
 *               - city
 *               - state_or_territory
 *               - postal_code
 *             properties:
 *               first_name:
 *                 type: string
 *                 example: John
 *               last_name:
 *                 type: string
 *                 example: Doe
 *               phone_number:
 *                 type: string
 *                 example: "+1234567890"
 *               street_address:
 *                 type: string
 *                 example: "123 Main St"
 *               address_line_2:
 *                 type: string
 *                 nullable: true
 *                 example: "Apt 4B"
 *               city:
 *                 type: string
 *                 example: "San Francisco"
 *               state_or_territory:
 *                 type: string
 *                 enum: [AL, AK, AZ, AR, CA, CO, CT, DE, FL, GA, HI, ID, IL, IN, IA, KS, KY, LA, ME, MD, MA, MI, MN, MS, MO, MT, NE, NV, NH, NJ, NM, NY, NC, ND, OH, OK, OR, PA, RI, SC, SD, TN, TX, UT, VT, VA, WA, WV, WI, WY, DC, AS, GU, MP, PR, VI]
 *                 example: CA
 *               postal_code:
 *                 type: string
 *                 example: "94105"
 *     responses:
 *       200:
 *         description: Successfully updated user profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Bad Request - Invalid JSON body
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Invalid JSON body"
 *       401:
 *         description: Unauthorized - Invalid or missing authentication token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Unauthorized
 *       404:
 *         description: User not onboarded
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: User not onboarded
 *       422:
 *         description: Unprocessable Entity - Validation failed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Validation failed"
 *                 errors:
 *                   type: object
 *                   description: Field-specific validation errors
 *                   example:
 *                     first_name: ["First name is required"]
 *                     phone_number: ["Phone number must be in E.164 format (+1XXXXXXXXXX)"]
 */
export async function PUT(request: Request) {
  const auth = await getAuthUserFromRequest(request);
  if (!auth.ok) {
    return new Response(JSON.stringify(auth.body), {
      headers: { "Content-Type": "application/json" },
      status: auth.status,
    });
  }

  const currentUser = await getPrisma().user.findUnique({
    where: { auth_user_id: auth.supabaseUser.id },
  });

  if (!currentUser) {
    return new Response(JSON.stringify({ message: "User not onboarded" }), {
      headers: { "Content-Type": "application/json" },
      status: 404,
    });
  }

  // Parse and validate request body with Zod
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ message: "Invalid JSON body" }), {
      headers: { "Content-Type": "application/json" },
      status: 400,
    });
  }

  const parseResult = UpdateProfileSchema.safeParse(body);
  if (!parseResult.success) {
    return new Response(
      JSON.stringify({
        message: "Validation failed",
        errors: parseResult.error.flatten().fieldErrors,
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 422,
      },
    );
  }

  const validatedData = parseResult.data;

  // Update user
  const updatedUser = await getPrisma().user.update({
    where: { id: currentUser.id },
    data: {
      first_name: validatedData.first_name,
      last_name: validatedData.last_name,
      phone_number: validatedData.phone_number,
      street_address: validatedData.street_address,
      address_line_2: validatedData.address_line_2 || null,
      city: validatedData.city,
      state_or_territory: validatedData.state_or_territory,
      postal_code: validatedData.postal_code,
    },
  });

  // Invalidate caches after update
  const { revalidatePath, revalidateTag } = await import("next/cache");
  await revalidateTag(`user-${auth.supabaseUser.id}`);
  await revalidateTag(`user-${currentUser.id}`);
  await revalidateTag(`profile-${auth.supabaseUser.id}`);
  await revalidateTag(`profile-${currentUser.id}`);
  await revalidatePath("/dashboard");
  await revalidatePath("/api/user/profile");

  return new Response(JSON.stringify({ user: updatedUser }), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "private, no-cache, no-store, must-revalidate",
    },
  });
}
