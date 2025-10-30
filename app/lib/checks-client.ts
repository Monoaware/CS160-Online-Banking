// Client-side check validation utilities
// This file can be safely imported in client components

export const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];

const MAX_FILE_SIZE_BASE64 = 4 * 1024 * 1024; // 4MB for base64 encoded images
const MAX_RESOLUTION_PIXELS = 33 * 1024 * 1024; // 33 megapixels

export type ValidationResult =
  | { valid: true }
  | { valid: false; error: string };

/**
 * Validate an image file before upload (client-side validation)
 * Note: This is meant to be used in the browser only
 */
export async function validateCheckImage(
  file: File,
): Promise<ValidationResult> {
  // Check file type
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid file type. Allowed types: ${ALLOWED_MIME_TYPES.join(", ")}`,
    };
  }

  // Check file size (for base64 encoding, we need smaller size)
  if (file.size > MAX_FILE_SIZE_BASE64) {
    return {
      valid: false,
      error: `File too large. Maximum size: ${MAX_FILE_SIZE_BASE64 / (1024 * 1024)}MB`,
    };
  }

  // Check image resolution (browser-only)
  if (typeof window === "undefined") {
    // Server-side: just check file size and type
    return { valid: true };
  }

  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const totalPixels = img.width * img.height;
      if (totalPixels > MAX_RESOLUTION_PIXELS) {
        resolve({
          valid: false,
          error: `Image resolution too high. Maximum: 33 megapixels`,
        });
      } else {
        resolve({ valid: true });
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({
        valid: false,
        error: "Invalid image file",
      });
    };

    img.src = objectUrl;
  });
}
