# Implementation Plan: Remove Widget Origin Restrictions

## Problem Summary
The widget fails with "Widget origin is not allowed" (403) because origin enforcement is implemented in three separate places in the business logic, even though HTTP CORS middleware already allows all origins. The user requires: **any widget ID must work on any website/domain with no origin restrictions**.

Additionally, the `widgetId` validation regex requires exactly 32 characters, but the test widgetId `6q8fH-SE27vXosuulEFi-3-Jv2_v438310cw` is 36 characters, causing validation failure before the origin check is even reached.

## Root Cause
1. **origins.ts** - `assertWidgetOrigin` queries MongoDB with `{ allowedOrigins: origin }` filter, causing 404→403 when origin not in array
2. **visitor-service.ts** - Three separate origin checks in `findOrCreateWidgetVisitor`
3. **widget-service.ts** - `assertOriginMatchesWebsite` called in `initializeWidget` and `verifyVisitorSession`
4. **widget-service.ts** - `widgetId` regex validation requires exactly 32 chars: `/^[A-Za-z0-9_-]{32}$/`

## Implementation Plan

- [ ] 1. **Fix widgetId validation regex in widget-service.ts**
      
      The current regex `/^[A-Za-z0-9_-]{32}$/` requires exactly 32 characters, but widget IDs can be 32-48 characters (base64url encoding of 24 bytes). Widen the regex to accept 20-128 characters to accommodate current and future ID formats.
      
      **Files:** `apps/api/src/services/widget-service.ts`
      
      **Changes:**
      - Line 12: Change `z.string().regex(/^[A-Za-z0-9_-]{32}$/)` to `z.string().regex(/^[A-Za-z0-9_-]{20,128}$/)`
      
      **Verify:** `npm run typecheck --workspace @live-chat/api` — TypeScript compiles without errors

- [ ] 2. **Remove origin enforcement from origins.ts**
      
      The `assertWidgetOrigin` function queries MongoDB with `allowedOrigins: origin` filter. Change it to only verify the widgetId exists and is active, without checking origin.
      
      **Files:** `apps/api/src/security/origins.ts`
      
      **Changes:**
      - Lines 27-39: Replace the entire `assertWidgetOrigin` function with:
        ```typescript
        export async function assertWidgetOrigin(
          publicWidgetId: string,
          origin: string | undefined
        ): Promise<void> {
          if (publicWidgetId.length > 64) {
            throw new AppError("Invalid widget ID", 400, "VALIDATION_ERROR");
          }
          const website = await Website.findOne({
            publicWidgetId,
            status: "active"
          }).select("_id");
          if (!website) {
            throw new AppError("Widget not found", 404, "NOT_FOUND");
          }
        }
        ```
      - Keep the `isAllowedOrigin` function (lines 5-25) as-is for potential future use or other callers
      
      **Rationale:** Remove the MongoDB query filter `allowedOrigins: origin` and the `isAllowedOrigin` check. Only validate that the widgetId exists and the website is active. This makes the function name slightly misleading, but keeping it avoids changing all call sites.
      
      **Verify:** `npm run typecheck --workspace @live-chat/api` — TypeScript compiles without errors

- [ ] 3. **Remove all three origin checks from visitor-service.ts**
      
      The `findOrCreateWidgetVisitor` function has three origin enforcement points that must be removed: the initial `assertWidgetOrigin` call (which now only checks existence), the MongoDB query filter `allowedOrigins: origin`, and the `website.allowedOrigins.includes(pageUrl.origin)` check.
      
      **Files:** `apps/api/src/services/visitor-service.ts`
      
      **Changes:**
      - Line 5: Keep the import `assertWidgetOrigin` (it now only verifies widget exists)
      - Line 44: Keep the call `await assertWidgetOrigin(publicWidgetId, origin);` (it now only checks widget exists)
      - Lines 47-54: Replace the entire `Website.findOne()` query with:
        ```typescript
        const website = await Website.findOne({
          publicWidgetId,
          status: "active"
        }).select("_id workspaceId allowedOrigins");
        ```
      - Lines 57-61: **Delete** the entire `isLocalDevPage` and page origin validation block:
        ```typescript
        const isLocalDevPage =
          env.NODE_ENV !== "production" &&
          env.WIDGET_DEV_MODE === "true" &&
          origin === pageUrl?.origin &&
          !!pageUrl &&
          ["localhost", "127.0.0.1", "[::1]"].includes(pageUrl.hostname);
        if (pageUrl && !website.allowedOrigins.includes(pageUrl.origin) && !isLocalDevPage) {
          throw new AppError("Page origin is not allowed", 403, "ORIGIN_NOT_ALLOWED");
        }
        ```
      
      **Rationale:** The website lookup now only filters on `publicWidgetId` and `status: 'active'`. Remove the conditional `allowedOrigins: origin` filter (lines 50-53) and the page URL origin check (lines 57-61). Keep the `assertWidgetOrigin` call because it now only verifies the widget exists.
      
      **Verify:** `npm run typecheck --workspace @live-chat/api` — TypeScript compiles without errors

- [ ] 4. **Remove origin enforcement from widget-service.ts**
      
      The `assertOriginMatchesWebsite` helper function enforces origin restrictions and is called from both `initializeWidget` and `verifyVisitorSession`. Remove all calls to this function.
      
      **Files:** `apps/api/src/services/widget-service.ts`
      
      **Changes:**
      - Lines 67-82: **Delete** the entire `assertOriginMatchesWebsite` function
      - Line 144: **Delete** the line `assertOriginMatchesWebsite(origin, website);` in `initializeWidget` (after the website query)
      - Line 207: **Delete** the line `assertOriginMatchesWebsite(origin, website);` in `verifyVisitorSession` (after the website/visitor query)
      
      **Rationale:** The `assertOriginMatchesWebsite` function checks if the request origin is in the website's `allowedOrigins` array. Since we're removing all origin restrictions, delete the function and all calls to it.
      
      **Verify:** `npm run typecheck --workspace @live-chat/api` — TypeScript compiles without errors

- [ ] 5. **Build and verify the changes**
      
      Build the API to ensure TypeScript compiles and run any existing tests.
      
      **Files:** None (compilation only)
      
      **Changes:** None
      
      **Verify:** 
      ```bash
      npm run build --workspace @live-chat/api
      npm run test --workspace @live-chat/api
      ```
      Both commands complete successfully. Tests may be minimal or nonexistent; focus on compilation success.

- [ ] 6. **Test widget initialization with curl**
      
      Test the `/widget/init` endpoint against the deployed API at https://chat-kro-api.onrender.com with a real widgetId and any arbitrary origin.
      
      **Test command:**
      ```bash
      curl -X POST https://chat-kro-api.onrender.com/widget/init \
        -H "Content-Type: application/json" \
        -H "Origin: https://example.com" \
        -d '{
          "widgetId": "6q8fH-SE27vXosuulEFi-3-Jv2_v438310cw",
          "visitorId": "test-visitor-' + Date.now() + '-abc123xyz789012345",
          "currentPageUrl": "https://example.com/test-page",
          "referrer": "https://google.com"
        }'
      ```
      
      **Expected outcome:** 
      - HTTP 200 response with JSON containing `visitorToken`, `website`, and `config` fields
      - No "Widget origin is not allowed" or "Widget not found" errors
      - If the widgetId doesn't exist in the database, expect HTTP 404 with "Widget not found" (this is correct)
      - If the widgetId exists but is disabled, expect HTTP 404 (this is correct)
      
      **Alternative test** (if the widgetId doesn't exist in production):
      1. Use the dashboard to create a website and copy its widgetId
      2. Replace the widgetId in the curl command above
      3. Run the test with any origin (e.g., `https://totally-different-domain.com`)
      4. Verify it succeeds regardless of what origins are configured in the dashboard

- [ ] 7. **Verify CORS headers are still present**
      
      Confirm that the CORS middleware in app.ts still allows all origins for widget routes (it should, since we only changed business logic, not middleware).
      
      **Test command:**
      ```bash
      curl -I -X OPTIONS https://chat-kro-api.onrender.com/widget/init \
        -H "Origin: https://random-site.com" \
        -H "Access-Control-Request-Method: POST"
      ```
      
      **Expected outcome:**
      - `Access-Control-Allow-Origin: *` header present
      - `Access-Control-Allow-Methods` includes `POST`
      - HTTP 204 response

## Git Commit Message

```
fix: remove origin restrictions from widget initialization

Remove all origin enforcement from widget business logic to allow
any widget ID to work on any domain/website. CORS middleware already
allows all origins for widget routes.

Changes:
- Widen widgetId regex from exactly 32 chars to 20-128 chars
- Remove allowedOrigins filter from MongoDB queries in origins.ts
- Remove three origin checks from visitor-service.ts
- Delete assertOriginMatchesWebsite from widget-service.ts
- Keep website.allowedOrigins field in DB for future use

The widget now only validates:
- widgetId format (20-128 base64url chars)
- website exists and status is 'active'
- visitor session signing/verification

Fixes widget initialization failure on external domains.
```

## Notes

### What we're keeping:
- The `publicWidgetId` regex validation (now 20-128 chars instead of exactly 32)
- The website `status: 'active'` check
- The `WIDGET_SESSION_SECRET` signing/verification for visitor tokens
- All error handling for missing widgetId
- The `allowedOrigins` field in the Website model (not enforcing it, but not removing it)
- The CORS middleware in app.ts (already allows all origins)

### What we're removing:
- All MongoDB query filters on `allowedOrigins`
- All runtime checks against `website.allowedOrigins.includes(origin)`
- The `assertOriginMatchesWebsite` function
- The `isLocalDevPage` dev-mode exception logic (no longer needed)

### Why the widgetId regex change:
The test widgetId `6q8fH-SE27vXosuulEFi-3-Jv2_v438310cw` is 36 characters, not 32. The `publicWidgetId` field uses `randomBytes(24).toString("base64url")`, which produces 32 characters, but existing IDs in the database may be longer due to migration or manual creation. Widening to 20-128 accommodates all realistic base64url-encoded IDs.

### Database field note:
The `allowedOrigins` field in the Website model (workspace.ts) has a default of `[]` and validation for up to 50 origins. We're not removing this field because:
1. It may be needed in the future
2. Existing documents have it
3. Removing it would require a migration
4. Not enforcing it in code is sufficient for the user's requirement
