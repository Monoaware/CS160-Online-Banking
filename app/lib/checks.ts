// Server-side check utilities
// This file uses server-only imports and should NOT be imported in client components

import { createClient } from "@/utils/supabase/server";
import { extractCheckData, type CheckExtractionResult } from "./groq";

export type ValidationResult =
  | { valid: true }
  | { valid: false; error: string };

// Re-export ALLOWED_MIME_TYPES for server-side use
export const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];

/**
 * Upload check image to Supabase Storage
 * @param file - The image file to upload
 * @param userId - The authenticated user's ID
 * @returns The public URL of the uploaded image
 */
export async function uploadCheckToSupabase(
  file: File,
  userId: string,
): Promise<{ url: string; path: string }> {
  const supabase = await createClient();

  // Generate unique filename
  const timestamp = Date.now();
  const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
  const filePath = `${userId}/${timestamp}-${sanitizedFilename}`;

  // Convert file to ArrayBuffer
  const arrayBuffer = await file.arrayBuffer();

  // Upload to Supabase Storage
  const { error } = await supabase.storage
    .from("checks")
    .upload(filePath, arrayBuffer, {
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    // Provide helpful error message for missing bucket
    if (
      error.message.includes("Bucket not found") ||
      error.message.includes("not found")
    ) {
      throw new Error(
        "The 'checks' storage bucket has not been created yet. " +
          "Please run 'pnpm tsx scripts/setup-storage.ts' to create it, " +
          "or create it manually in your Supabase dashboard under Storage.",
      );
    }
    throw new Error(`Failed to upload check image: ${error.message}`);
  }

  // Get public URL
  const {
    data: { publicUrl },
  } = supabase.storage.from("checks").getPublicUrl(filePath);

  return {
    url: publicUrl,
    path: filePath,
  };
}

/**
 * Get a pre-signed URL for a check image (for private buckets)
 */
export async function getPresignedUrl(
  filePath: string,
  expiresIn: number = 3600, // 1 hour default
): Promise<string> {
  const supabase = await createClient();

  const { data, error } = await supabase.storage
    .from("checks")
    .createSignedUrl(filePath, expiresIn);

  if (error) {
    throw new Error(`Failed to create signed URL: ${error.message}`);
  }

  return data.signedUrl;
}

/**
 * Validate extracted check data (loose validation)
 */
export function validateExtractedCheck(
  result: CheckExtractionResult,
): ValidationResult {
  if (!result.success) {
    return {
      valid: false,
      error: result.error,
    };
  }

  const { data } = result;

  // Loose validation: only check that amount exists and is positive
  if (!data.amount || data.amount <= 0) {
    return {
      valid: false,
      error: "Could not extract a valid amount from the check",
    };
  }

  return { valid: true };
}

/**
 * Extract check data from image URL using Groq
 */
export async function extractCheckDataFromImage(
  imageUrl: string,
): Promise<CheckExtractionResult> {
  return await extractCheckData(imageUrl);
}
