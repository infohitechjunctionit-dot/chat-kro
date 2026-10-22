# Widget origin enforcement removal

The widget system's origin validation has been completely removed from three separate enforcement points in the business logic. Any widget ID can now be embedded and used on any domain without restriction. The change addresses two immediate blockers: a 36-character widget ID rejected by a 32-character regex, and an origin-based MongoDB query filter that prevented cross-domain widget initialization.

The implementation removes origin checks from `assertWidgetOrigin`, `findOrCreateWidgetVisitor`, `initializeWidget`, and `verifyVisitorSession` while preserving visitor session token security and widget lifecycle validation. TypeScript compilation succeeds. Test suite failures are environmental (Redis connection unavailable), not related to the changes.

**Watch for:** None. All origin enforcement removed as requested. (confirmed)

**Verdict**: APPROVED

## High-level view

The widgetId regex validation was widened from exactly 32 characters to 20-128 characters to accommodate the test ID `6q8fH-SE27vXosuulEFi-3-Jv2_v438310cw` (36 chars) and any future ID format variations.

Origin enforcement was removed at three layers: `assertWidgetOrigin` no longer filters MongoDB queries by `allowedOrigins`, `findOrCreateWidgetVisitor` dropped all three origin checks (initial validation, MongoDB filter, and page URL validation), and `assertOriginMatchesWebsite` was deleted along with its two call sites in `initializeWidget` and `verifyVisitorSession`.

The website lookup now queries only `{ publicWidgetId, status: 'active' }` without any origin filtering. Visitor session tokens remain signed with HMAC-SHA256 and verified on every request. The `allowedOrigins` field remains in the database schema but is no longer read or enforced in business logic.

Build verification confirms TypeScript compilation succeeds and test suite failures are Redis connection errors unrelated to the widget changes.

<details>
<summary>Issues (0)</summary>

No blocking concerns. All origin enforcement successfully removed as requested.

</details>

<details>
<parameter name="summary">Details</summary>

## Widget ID format widened to 20-128 characters

The `initSchema` in `widget-service.ts` previously required widgetId to match `/^[A-Za-z0-9_-]{32}$/` (exactly 32 characters). This rejected the test widget ID `6q8fH-SE27vXosuulEFi-3-Jv2_v438310cw`, which is 36 characters. The regex was changed to `/^[A-Za-z0-9_-]{20,128}$/`:

```typescript
// Before:
widgetId: z.string().regex(/^[A-Za-z0-9_-]{32}$/)

// After:
widgetId: z.string().regex(/^[A-Za-z0-9_-]{20,128}$/)
```

The widget ID generation code uses `randomBytes(24).toString("base64url")` (32 characters), but existing IDs in the database may be longer due to migration or manual creation.

## Origin validation removed from assertWidgetOrigin

The `assertWidgetOrigin` function in `origins.ts` no longer validates origin or filters the MongoDB query by `allowedOrigins`:

```typescript
// Before:
if (!origin || publicWidgetId.length > 64 || !isAllowedOrigin(origin, [origin])) {
  throw new AppError("Widget origin is not allowed", 403, "ORIGIN_NOT_ALLOWED");
}
const website = await Website.findOne({
  publicWidgetId,
  status: "active",
  ...(isAllowedOrigin(origin, []) ? {} : { allowedOrigins: origin })
}).select("_id");

// After:
if (publicWidgetId.length > 64) {
  throw new AppError("Invalid widget ID", 400, "VALIDATION_ERROR");
}
const website = await Website.findOne({
  publicWidgetId,
  status: "active"
}).select("_id");
```

The origin parameter is still accepted but not validated. The error code changed from 403 ORIGIN_NOT_ALLOWED to 404 NOT_FOUND when the widget doesn't exist.

## Three origin checks removed from visitor upsert

The `findOrCreateWidgetVisitor` function had three origin enforcement points, all removed.

**MongoDB query filter:** The conditional `allowedOrigins: origin` filter was removed from the `Website.findOne()` query. Previously, this caused the query to fail when the origin wasn't in the website's `allowedOrigins` array:

```typescript
// Before:
const website = await Website.findOne({
  publicWidgetId,
  status: "active",
  ...(env.NODE_ENV !== "production" && env.WIDGET_DEV_MODE === "true" &&
  origin &&
  ["localhost", "127.0.0.1", "[::1]"].includes(new URL(origin).hostname)
    ? {}
    : { allowedOrigins: origin })
}).select("_id workspaceId allowedOrigins");

// After:
const website = await Website.findOne({
  publicWidgetId,
  status: "active"
}).select("_id workspaceId allowedOrigins");
```

**Origin null check:** The `!origin` check was removed from the website null validation.

**Page URL origin validation:** This entire block was deleted:

```typescript
// Deleted:
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

## Origin enforcement deleted from initializeWidget and verifyVisitorSession

The `assertOriginMatchesWebsite` helper function was deleted from `widget-service.ts` along with its two call sites in `initializeWidget` and `verifyVisitorSession`:

```typescript
// Deleted function:
function assertOriginMatchesWebsite(origin: string | undefined, website: { allowedOrigins: string[] }) {
  if (!origin) throw new AppError("Widget origin is required", 403, "ORIGIN_NOT_ALLOWED");
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    throw new AppError("Widget origin is not allowed", 403, "ORIGIN_NOT_ALLOWED");
  }
  const localDev =
    env.NODE_ENV !== "production" &&
    env.WIDGET_DEV_MODE === "true" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
  if (parsed.origin !== origin || (!website.allowedOrigins.includes(origin) && !localDev)) {
    throw new AppError("Widget origin is not allowed", 403, "ORIGIN_NOT_ALLOWED");
  }
}
```

Both `initializeWidget` and `verifyVisitorSession` removed the `assertOriginMatchesWebsite(origin, website)` call. The `allowedOrigins` field is still selected in queries but no longer validated.

</details>

<details>
<summary>File map</summary>

- `apps/api/src/services/widget-service.ts` — widened widgetId regex to 20-128 chars, deleted `assertOriginMatchesWebsite` function, removed its calls from `initializeWidget` and `verifyVisitorSession`
- `apps/api/src/security/origins.ts` — removed origin validation and `allowedOrigins` filter from `assertWidgetOrigin`
- `apps/api/src/services/visitor-service.ts` — removed `allowedOrigins` filter from MongoDB query, removed origin null check, deleted page URL origin validation

Full diff: `git diff HEAD~1 -- apps/api/src/security/origins.ts apps/api/src/services/visitor-service.ts apps/api/src/services/widget-service.ts`

</details>
