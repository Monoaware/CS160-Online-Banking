### CS160 Online Banking

1. Env (.env)

- DATABASE_URL
- DIRECT_URL
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY

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
