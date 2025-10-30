### CS160 Online Banking

1. Env (.env)

- DATABASE_URL
- DIRECT_URL
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- GROQ_API_KEY

2. Install

```bash
pnpm install
```

3. DB migrate + seed

```bash
pnpm prisma migrate dev
pnpm seed
```

4. Run

```bash
pnpm dev
```

5. Tests

```bash
pnpm test
# watch mode
pnpm test:watch
```

Tests can also be run in a Docker container:

```
docker compose build
```

```bash
pnpm run test:docker
```

6. Lint & Format

```bash
pnpm lint
pnpm format:fix
```

7. API Documentation

View docs: http://localhost:3000/api-doc (dev only)

Add docs to new routes:

```typescript
/**
 * @swagger
 * /api/your-route:
 *   get:
 *     summary: Brief description
 *     tags: [YourTag]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success response
 */
export async function GET(request: Request) {
  // your code
}
```

Seeded logins (for local testing):

- manager@example.com / Password123!
- ava@example.com / Password123!
- liam@example.com / Password123!

8. Google Maps API Key Setup

To use the ATM locator feature, you need to set up a Google Maps API key:

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the following APIs:
   - Maps JavaScript API
   - Places API
   - Geocoding API
4. Go to "Credentials" and create an API key
5. Restrict the API key:
   - Under "Application restrictions", select "HTTP referrers" and add your domain(s)
   - Under "API restrictions", select "Restrict key" and choose the APIs you enabled
6. Add the API key to your `.env.local` file:
   ```
   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_api_key_here
   ```

**Important**: The API key is used for both server-side API calls and client-side map rendering. Make sure to restrict the API key by domain and specific APIs for security.

9. Groq API Key Setup

To use the check deposit feature, you need to set up a Groq API key:

1. Go to [Groq Console](https://console.groq.com/)
2. Sign up or log in to your account
3. Navigate to "API Keys" section
4. Create a new API key
5. Add the API key to your `.env` or `.env.local` file:
   ```
   GROQ_API_KEY=your_groq_api_key_here
   ```

The Groq API key is used server-side only for processing check images using the Vision API.

10. Supabase Storage Setup

To use the check deposit feature, you need to create a storage bucket in Supabase:

**Option 1: Using the setup script (Recommended)**

```bash
pnpm tsx scripts/setup-storage.ts
```

**Option 2: Manual setup via Supabase Dashboard**

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Navigate to Storage
3. Click "Create bucket"
4. Name it `checks`
5. Make it public (for now, or configure RLS policies if you want private access)
6. Set allowed MIME types: `image/jpeg`, `image/jpg`, `image/png`, `image/webp`
7. Set file size limit: `4194304` (4MB)

**Optional: Set up RLS Policies**
If you want to restrict access so users can only access their own check images:

1. Go to Storage > Policies for the `checks` bucket
2. Add policies for authenticated users to upload/read files in their own folder (`{auth.uid()}/*`)
