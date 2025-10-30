/**
 * Setup script to create the Supabase Storage bucket for check images and configure RLS policies
 * Run this once to set up the storage bucket: pnpm tsx scripts/setup-storage.ts
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve } from "path";

// Load environment variables from .env.local or .env
config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing required environment variables:");
  console.error("  - NEXT_PUBLIC_SUPABASE_URL");
  console.error("  - SUPABASE_SERVICE_ROLE_KEY");
  console.error("\nMake sure these are set in your .env.local or .env file");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function setupStorage() {
  console.log("Setting up Supabase Storage bucket 'checks'...");

  // Check if bucket already exists
  const { data: buckets, error: listError } =
    await supabase.storage.listBuckets();

  if (listError) {
    console.error("Error listing buckets:", listError.message);
    process.exit(1);
  }

  const checksBucket = buckets?.find((bucket) => bucket.name === "checks");

  if (!checksBucket) {
    // Create the bucket
    console.log("Creating bucket 'checks'...");
    const { data, error } = await supabase.storage.createBucket("checks", {
      public: true, // Make it public for now (simpler)
      allowedMimeTypes: ["image/jpeg", "image/jpg", "image/png", "image/webp"],
      fileSizeLimit: 4194304, // 4MB limit
    });

    if (error) {
      console.error("Error creating bucket:", error.message);
      process.exit(1);
    }

    console.log("✓ Successfully created bucket 'checks' as public");
  } else {
    console.log("✓ Bucket 'checks' already exists");

    // Make sure it's public
    if (!checksBucket.public) {
      console.log("Making bucket public...");
      const { error: updateError } = await supabase.storage.updateBucket(
        "checks",
        {
          public: true,
        },
      );

      if (updateError) {
        console.error("Failed to make bucket public:", updateError.message);
        console.log("\nYou can make it public manually in Supabase Dashboard:");
        console.log("  Storage → checks → Settings → Make public");
      } else {
        console.log("✓ Made bucket public");
      }
    } else {
      console.log("✓ Bucket is already public");
    }
  }

  console.log(
    "\n⚠️  If you're still getting RLS errors, you need to run SQL in Supabase:",
  );
  console.log("\nOption 1: Disable RLS for this bucket (simplest):");
  console.log("  Run in Supabase SQL Editor:");
  console.log(
    "  UPDATE storage.buckets SET public = true WHERE id = 'checks';",
  );
  console.log(
    "  DELETE FROM storage.objects WHERE bucket_id = 'checks' AND name LIKE '%'; -- Clear existing policies",
  );

  console.log("\nOption 2: Set up proper RLS policies:");
  console.log("  See scripts/storage-rls-policies.sql for the SQL to run");

  console.log("\n✓ Storage setup complete!");
  console.log(
    "\nTry uploading a check image now. If you still get RLS errors,",
  );
  console.log(
    "run the SQL statements above in Supabase Dashboard → SQL Editor",
  );
}

setupStorage()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("Unexpected error:", error);
    process.exit(1);
  });
