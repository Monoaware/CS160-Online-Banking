-- Supabase Storage RLS Policies for 'checks' bucket
-- Run this in Supabase Dashboard → SQL Editor

-- OPTION 1: Simplest solution - Disable RLS for public buckets
-- If your bucket is public, you can disable RLS (recommended for public buckets)
-- Note: This syntax may not work directly, so use Option 2 below

-- OPTION 2: Keep RLS enabled but add proper policies (RECOMMENDED)
-- First, ensure RLS is enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies that might conflict
DROP POLICY IF EXISTS "Users can upload to their own folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can read from their own folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete from their own folder" ON storage.objects;
DROP POLICY IF EXISTS "Public can read check images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete" ON storage.objects;

-- Policy 1: Allow authenticated users to upload files (any authenticated user can upload)
CREATE POLICY "Authenticated users can upload"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'checks');

-- Policy 2: Allow authenticated users to read files
CREATE POLICY "Authenticated users can read"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'checks');

-- Policy 3: Allow public read access (for Groq API to access images via URL)
CREATE POLICY "Public can read check images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'checks');

-- Policy 4: Allow authenticated users to delete files (for cleanup)
CREATE POLICY "Authenticated users can delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'checks');

-- OPTION 3: Make bucket public (simplest, but less secure)
-- Uncomment if you want a fully public bucket:
-- UPDATE storage.buckets SET public = true WHERE id = 'checks';

