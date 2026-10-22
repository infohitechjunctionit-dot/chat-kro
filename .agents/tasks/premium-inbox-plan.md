# Implementation Plan: Premium Inbox Redesign

This plan redesigns the admin dashboard inbox to look premium and professional like Jivo Chat, with proper scrolling, avatars, website URLs, and clean typography.

## Implementation Steps

- [ ] 1. **Fix conversation list scrolling**
      
      Modify the conversation list aside to use proper flex layout for scrolling:
      - Outer container: Add `h-full` to the aside className (currently has `flex-col`)
      - Header section (search + filters): Ensure it has `flex-none` to stay fixed
      - Scrolling list container: Ensure it has `flex-1 overflow-y-auto` to scroll
      
      Files: `apps/dashboard/src/components/inbox-page.tsx` (lines ~582-601)
      
      Verify: Run `npm run typecheck` to check types, then `npm run dev` and test that the conversation list scrolls while the header stays fixed when there are many conversations.

- [ ] 2. **Add avatar color hash utility**
      
      Create a utility function that generates consistent gradient colors based on visitor name:
      - Add `getAvatarColor(name: string): string` function that hashes the name and returns one of 8 gradient class pairs: 'from-indigo-500 to-indigo-600', 'from-purple-500 to-purple-600', 'from-blue-500 to-blue-600', 'from-green-500 to-green-600', 'from-orange-500 to-orange-600', 'from-rose-500 to-rose-600', 'from-cyan-500 to-cyan-600', 'from-pink-500 to-pink-600'
      - Use a simple hash: sum character codes, modulo palette length
      
      Files: `apps/dashboard/src/components/inbox-page.tsx` (add after imports, before component)
      
      Verify: Run `npm run typecheck` to ensure types are correct.

- [ ] 3. **Add website URL extraction utilities**
      
      Create utilities to extract and display website information:
      - Add `extractDomain(url: string | null): string | null` that safely extracts hostname from URL using try/catch with `new URL(url).hostname`
      - Add `getWebsiteDisplay(conversation: InboxConversation): string` that returns 'from ' + (conversation.website?.name || extractDomain(conversation.visitor?.currentPageUrl) || 'website')
      
      Files: `apps/dashboard/src/components/inbox-page.tsx` (add near getAvatarColor)
      
      Verify: Run `npm run typecheck` to check types.

- [ ] 4. **Redesign conversation card layout**
      
      Completely restructure each conversation card in the list to match the premium design:
      - Locate the conversation list mapping around line 593: `conversations.map((conversation) => <button...)`
      - Replace the card content structure with:
        - Container: `<button>` with `relative` positioning, `p-3`, `transition-all duration-150`, `hover:bg-gray-50`
        - Avatar section: `<div className="flex gap-3 items-start">` containing:
          - Avatar: `<div className="relative flex-none">` with 48px circular avatar (`size-12 rounded-full bg-gradient-to-br {getAvatarColor(visitorLabel(conversation.visitor))} text-white font-semibold text-lg flex items-center justify-center`)
          - Online indicator: `<div className="absolute bottom-0 right-0 size-2 rounded-full bg-green-500 ring-2 ring-white" />`
        - Content section: `<div className="flex-1 min-w-0">` containing:
          - Line 1: `<div className="flex items-center justify-between gap-2">` with name (`<span className="font-semibold text-[15px] text-gray-900 truncate">{visitorLabel(conversation.visitor)}</span>`) and time (`<time className="text-[12px] text-gray-500 flex-none">{formatTime(conversation.lastMessageAt)}</time>`)
          - Line 2: Website URL (`<p className="text-[12px] text-gray-600 truncate">{getWebsiteDisplay(conversation)}</p>`)
          - Line 3: Message preview (`<p className="text-[13px] text-gray-700 line-clamp-2 leading-snug mt-1">{conversation.lastMessagePreview || 'No messages yet'}</p>`)
        - Unread badge: Position in top-right of Line 1, update styling to `size-5 min-w-5 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center`
      - Keep active state styling: `selectedId === conversation.id ? "bg-blue-50 border-l-4 border-blue-600" : ""`
      
      Files: `apps/dashboard/src/components/inbox-page.tsx` (lines ~593-598)
      
      Verify: Run `npm run typecheck`, then `npm run dev` and verify all conversation cards show avatars with colors, online indicators, proper text layout, website URLs, and 2-line message previews.

- [ ] 5. **Polish typography and spacing**
      
      Refine the overall visual polish:
      - Ensure all conversation card borders use `border-gray-100` (update from `border-slate-100` if needed)
      - Remove `hover:scale-[1.02]` transform if present (too playful)
      - Verify all hover states use `transition-all duration-150`
      - Check text color hierarchy: gray-900 (names), gray-600 (website), gray-500 (timestamps), gray-700 (messages)
      - Ensure the 'Load older conversations' button uses consistent `text-blue-600 hover:text-blue-700`
      
      Files: `apps/dashboard/src/components/inbox-page.tsx` (conversation list section)
      
      Verify: Run `npm run typecheck`, then `npm run dev` and visually inspect for consistent spacing, smooth transitions, and professional appearance. Test hover states on all interactive elements.

- [ ] 6. **Cross-browser and responsive testing**
      
      Test the redesigned inbox across different scenarios:
      - Test with 0 conversations, 5 conversations, and 30+ conversations
      - Test scrolling behavior on desktop (>1024px width)
      - Test mobile view (<1024px width) to ensure responsive layout works
      - Verify avatar colors are consistent (same name = same color)
      - Test with long visitor names, long website URLs, long message previews
      - Verify online indicator displays correctly at different zoom levels
      
      Files: N/A (testing only)
      
      Verify: Manual testing in browser with different viewport sizes and data scenarios. Ensure no layout breaks or overflow issues.

## Design Decisions

1. **Avatar color palette**: Using 8 gradient color combinations (indigo, purple, blue, green, orange, rose, cyan, pink) to provide good variety while maintaining professional appearance. Hash function ensures consistency.

2. **Website URL display**: Prioritizes website.name if available, falls back to extracting domain from currentPageUrl, then falls back to generic 'website'. Prefix with 'from' for natural reading.

3. **Online indicator**: 8px green dot (size-2 in Tailwind = 8px) with white ring border, positioned at bottom-right of avatar using absolute positioning within relative container.

4. **Scrolling approach**: Using flex-col with h-full on container, flex-none on header, and flex-1 overflow-y-auto on list. This is the standard pattern for fixed-header scrollable-content layouts.

5. **Typography hierarchy**: Following the spec precisely - 15px bold names, 12px muted timestamps and website, 13px message preview. Using gray palette instead of slate for consistency.

6. **Hover states**: Keeping subtle - just background color change to gray-50, no scale transform (maintains professional feel vs playful).

7. **No new files**: All changes in the existing inbox-page.tsx component, maintaining the single-file component pattern used by this codebase.

## TypeScript Types

No changes needed to existing types. The `InboxConversation` and `InboxVisitor` types already contain all needed fields:
- `conversation.visitor?.displayName` for avatar and color hash
- `conversation.website?.name` and `conversation.website?.domain` for website display
- `conversation.visitor?.currentPageUrl` for domain extraction fallback
- `conversation.lastMessageAt` for timestamp
- `conversation.lastMessagePreview` for message preview

## Verification Commands

1. Type check: `npm run typecheck` (run from project root)
2. Dev server: `npm run dev` (starts both API and dashboard)
3. Manual testing: Navigate to `http://localhost:3000`, log in, go to inbox page

The project does not have UI component tests - verification is manual through the dev server.
