import { getAuthUserFromRequest } from "@/lib/auth";
import { json } from "@/app/lib/transactions";
import { uploadCheckToSupabase, ALLOWED_MIME_TYPES } from "@/app/lib/checks";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB

/**
 * @swagger
 * /api/checks/upload:
 *   post:
 *     summary: Upload check image
 *     description: Uploads a check image to Supabase Storage and returns the URL
 *     tags:
 *       - Check Deposits
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Image uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 image_url:
 *                   type: string
 *                 upload_id:
 *                   type: string
 *       400:
 *         description: Bad Request - Invalid file or missing file
 *       401:
 *         description: Unauthorized
 *       413:
 *         description: File too large
 */
export async function POST(request: Request) {
  try {
    // Authenticate user
    const auth = await getAuthUserFromRequest(request);
    if (!auth.ok) {
      return json(auth.status, { error: auth.body.message });
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return json(400, { error: "No file provided" });
    }

    // Validate file type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return json(400, {
        error: `Invalid file type. Allowed types: ${ALLOWED_MIME_TYPES.join(", ")}`,
      });
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return json(413, {
        error: `File too large. Maximum size: ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
      });
    }

    // Upload to Supabase Storage
    const { url, path } = await uploadCheckToSupabase(
      file,
      auth.supabaseUser.id,
    );

    return json(200, {
      image_url: url,
      upload_id: path,
    });
  } catch (error) {
    console.error("Error uploading check image:", error);
    return json(500, {
      error: error instanceof Error ? error.message : "Failed to upload image",
    });
  }
}
