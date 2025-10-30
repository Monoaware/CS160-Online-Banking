/**
 * Script to set up Supabase Storage RLS policies for 'checks' bucket
 * This uses a direct database connection with admin permissions
 * Run: pnpm tsx scripts/setup-rls-policies.ts
 */

import { config } from "dotenv";
import { resolve } from "path";
import { Pool } from "pg";

// Load environment variables
config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

const databaseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("Missing DATABASE_URL or DIRECT_URL environment variable");
  process.exit(1);
}

async function setupRLSPolicies() {
  console.log("Setting up RLS policies for 'checks' storage bucket...\n");

  const pool = new Pool({
    connectionString: databaseUrl,
  });

  try {
    // Ensure RLS is enabled
    console.log("1. Ensuring RLS is enabled...");
    await pool.query(`
      ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    `);
    console.log("   ✓ RLS enabled\n");

    // Drop existing policies that might conflict
    console.log("2. Dropping existing policies...");
    const dropPolicies = [
      "Users can upload to their own folder",
      "Users can read from their own folder",
      "Users can delete from their own folder",
      "Public can read check images",
      "Authenticated users can upload",
      "Authenticated users can read",
      "Authenticated users can delete",
    ];

    for (const policyName of dropPolicies) {
      try {
        await pool.query(
          `DROP POLICY IF EXISTS "${policyName}" ON storage.objects;`,
        );
      } catch (error) {
        // Ignore errors if policy doesn't exist
        console.log(`   - Policy "${policyName}" not found (skipping)`);
      }
    }
    console.log("   ✓ Policies cleared\n");

    // Create new policies
    console.log("3. Creating new policies...");

    // Policy 1: Allow authenticated users to upload
    await pool.query(`
      CREATE POLICY "Authenticated users can upload"
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'checks');
    `);
    console.log("   ✓ Created upload policy");

    // Policy 2: Allow authenticated users to read
    await pool.query(`
      CREATE POLICY "Authenticated users can read"
      ON storage.objects
      FOR SELECT
      TO authenticated
      USING (bucket_id = 'checks');
    `);
    console.log("   ✓ Created read policy");

    // Policy 3: Allow public read access (for Groq API)
    await pool.query(`
      CREATE POLICY "Public can read check images"
      ON storage.objects
      FOR SELECT
      TO public
      USING (bucket_id = 'checks');
    `);
    console.log("   ✓ Created public read policy");

    // Policy 4: Allow authenticated users to delete
    await pool.query(`
      CREATE POLICY "Authenticated users can delete"
      ON storage.objects
      FOR DELETE
      TO authenticated
      USING (bucket_id = 'checks');
    `);
    console.log("   ✓ Created delete policy\n");

    console.log("✓ All RLS policies created successfully!");
    console.log("\nYou can now upload check images.");
  } catch (error) {
    console.error("\n❌ Error setting up policies:", error);
    if (error instanceof Error) {
      console.error("   Message:", error.message);
    }
    console.log(
      "\nAlternative: Run the SQL manually in Supabase Dashboard → SQL Editor",
    );
    console.log("See scripts/storage-rls-policies.sql for the SQL statements.");
    process.exit(1);
  } finally {
    await pool.end();
  }
}

setupRLSPolicies()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("Unexpected error:", error);
    process.exit(1);
  });
