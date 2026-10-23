# Implementation Plan: Final Dashboard Completion

This plan implements all remaining features for a simplified, professional chat dashboard with real-time functionality, history management, full URL display, and a clean Jivo-style inbox.

## Project Context

**Project type**: Next.js 16 dashboard + Express API + MongoDB + Socket.IO
**Build system**: npm workspaces with Next.js and tsc
**Test framework**: vitest (API), manual testing (dashboard)
**Build command**: `npm run build` (from root)
**Test command**: `npm run test` (from root)
**Dev command**: `npm run dev` (starts both API on :4000 and dashboard on :3000)

**Key patterns found**:
- Dashboard uses client components with "use client" directive
- Socket.IO already configured in `apps/api/src/socket/realtime.ts` and client connects from `apps/dashboard/src/components/dashboard-shell.tsx`
- Sidebar navigation in `dashboard-shell.tsx` uses array of nav items
- Inbox uses `inbox-page.tsx` component with socket.io-client
- API routes in `apps/api/src/routes/workspaces.ts` follow REST pattern with authentication middleware
- Models in `apps/api/src/models/` use Mongoose schemas
- Visitor model already has `currentPageUrl` field (2048 chars, validated as HTTP URL)
- Conversation model has visitor ref, website ref, and unread counts
- Real-time events already emit via `emitToConversation` function

**Environment**: Local development with hot reload; changes take effect immediately

## Implementation Steps

- [ ] 1. **Simplify the sidebar navigation to 5 items only**
      
      Modify `apps/dashboard/src/components/dashboard-shell.tsx` navigation array to keep only:
      - Inbox (with unread badge using conversation agentUnreadCount)
      - Websites / Widgets (renamed to "Widgets")
      - History (new route, will be created in step 2)
      - Settings
      - Logout (moved from footer to main nav as a nav item, not a button)
      
      Remove: Contacts, Team, Canned replies, Analytics, Billing, Profile, Agent login link.
      
      Add unread count badge to Inbox nav item by fetching conversation counts from the existing socket connection state.
      
      Files: `apps/dashboard/src/components/dashboard-shell.tsx`
      
      Verify: Run `npm run dev`, navigate to `/dashboard/inbox`, confirm only 5 sidebar items appear and Inbox shows an unread badge if conversations have agentUnreadCount > 0.

- [ ] 2. **Create the History page showing all past conversations with delete functionality**
      
      Create `apps/dashboard/src/app/(dashboard)/dashboard/history/page.tsx` as a new route.
      
      The page shows:
      - Page title "Chat History"
      - Filter tabs: All / Open / Resolved (use query param `?status=`)
      - Table columns: Visitor (avatar + name), Website (from conversation.website.name), Full URL (from visitor.currentPageUrl), Date (lastMessageAt), Messages (fetch message count), Status (open/pending/resolved), Actions (Delete button)
      - Delete button opens a confirm dialog, then calls new DELETE endpoint
      - Pagination with 20 items per page (use `?page=` query param)
      - Empty state when no history
      
      Fetch conversations from `/workspaces/:workspaceId/conversations?limit=20&status=<filter>` (existing endpoint).
      
      For the delete action, optimistically remove from UI, call DELETE endpoint (step 3), show error toast if it fails.
      
      Files: `apps/dashboard/src/app/(dashboard)/dashboard/history/page.tsx` (new)
      
      Verify: Run `npm run dev`, navigate to `/dashboard/history`, see conversation list, click delete on a conversation (will fail until step 3 implements endpoint), confirm UI updates.

- [ ] 3. **Add DELETE /conversations/:id API endpoint**
      
      Add a new route handler in `apps/api/src/routes/workspaces.ts`:
      ```
      DELETE /workspaces/:workspaceId/conversations/:conversationId
      ```
      
      Handler logic:
      - Require authentication and CSRF token
      - Verify the actor is a workspace member with `requireWorkspaceMember`
      - Verify the conversation belongs to the workspace with `requireConversation`
      - Delete all messages in the conversation: `await Message.deleteMany({ conversationId })`
      - Delete the conversation: `await Conversation.findByIdAndDelete(conversationId)`
      - Return 204 No Content on success
      
      Files: `apps/api/src/routes/workspaces.ts`
      
      Verify: Run `npm run dev`, use the History page delete button (from step 2) or call the endpoint with curl/Postman, confirm conversation and its messages are deleted from MongoDB, and the History page updates.

- [ ] 4. **Ensure visitor full URL is captured and stored in currentPageUrl**
      
      The visitor model already has `currentPageUrl` field (confirmed in `apps/api/src/models/visitor.ts`).
      
      Check widget initialization in `apps/widget/src/main.ts` (or equivalent widget entry) to confirm it sends `window.location.href` as the `pageUrl` or `currentPageUrl` field during visitor init or conversation creation.
      
      If not sending: modify the widget init payload to include `pageUrl: window.location.href`.
      
      In the API widget service (`apps/api/src/services/widget-service.ts`), ensure the visitor record is created/updated with `currentPageUrl` from the widget payload.
      
      Files: `apps/widget/src/main.ts`, `apps/api/src/services/widget-service.ts`
      
      Verify: Open the widget demo page, start a chat, inspect the visitor record in MongoDB, confirm `currentPageUrl` is set to the full URL including path and query params. Check the inbox and history pages, confirm the URL displays correctly.

- [ ] 5. **Update inbox and history to display the full URL in visitor details**
      
      Modify `apps/dashboard/src/components/inbox-page.tsx`:
      - In the conversation list item, below the visitor name, add a line showing "from <currentPageUrl>" (e.g., "from https://example.com/products/shoes") using `conversation.visitor?.currentPageUrl`
      - In the visitor details panel (right sidebar when showDetails is true), add a "Current Page" field displaying the full `currentPageUrl` as a clickable link (opens in new tab)
      
      Modify `apps/dashboard/src/app/(dashboard)/dashboard/history/page.tsx`:
      - In the Website column, show the full URL from `conversation.visitor?.currentPageUrl` instead of just the website name. If currentPageUrl is null, fall back to website.domain.
      
      Files: `apps/dashboard/src/components/inbox-page.tsx`, `apps/dashboard/src/app/(dashboard)/dashboard/history/page.tsx`
      
      Verify: Run `npm run dev`, start a chat from the widget demo, open Inbox and History, confirm the full URL (with path) is visible in conversation list and details.

- [ ] 6. **Redesign inbox layout to Jivo-style 3-column layout**
      
      Refactor `apps/dashboard/src/components/inbox-page.tsx` to use a 3-column grid layout on desktop:
      
      **Column 1 (left, ~200px)**: Simplified sidebar (already done in step 1, ensure it's visible here)
      **Column 2 (middle, ~320px)**: Conversation list
      - All/Unread tabs at top
      - Search bar below tabs
      - Conversation items with:
        - Circular avatar with gradient background (use existing `getAvatarColor` function)
        - Online status dot (green if visitor online, gray if offline)
        - Visitor name + timestamp on same line
        - "from <currentPageUrl>" in smaller gray text
        - Last message preview (truncated)
        - Unread badge (if agentUnreadCount > 0)
      - Hover effect: slight background color change
      - Active conversation: blue background tint
      
      **Column 3 (right, flex-1)**: Chat thread
      - Header: avatar, visitor name, online status, action buttons (Resolve/Reopen, assign dropdown if role allows)
      - Message history (scrollable, auto-scroll to bottom on new message)
      - Typing indicator when visitor is typing
      - Message input at bottom with Send button
      
      Use CSS grid: `grid-cols-[200px_320px_1fr]` on `lg:` breakpoint. On mobile, show one column at a time with back button navigation.
      
      Apply premium styling: soft shadows, rounded corners, smooth transitions, clean spacing, modern gradients for active states.
      
      Files: `apps/dashboard/src/components/inbox-page.tsx`
      
      Verify: Run `npm run dev`, open `/dashboard/inbox`, confirm 3-column layout on desktop, mobile toggle works, styling is clean and professional like Jivo.

- [ ] 7. **Implement real-time chat updates (no refresh needed)**
      
      The inbox already uses socket.io, but ensure these events work correctly:
      
      **A. New message instantly appears**
      - Handler: `socket.on("conversation:message", ...)` already exists in inbox-page.tsx
      - Confirm it updates the messages array and scrolls to bottom
      
      **B. Unread count updates in real time**
      - Handler: `socket.on("unread:update", ...)` already exists
      - Confirm it updates the conversation unread counts
      - Emit this event from the sidebar component to update the badge count
      
      **C. Typing indicator**
      - Handler: `socket.on("conversation:typing", ...)` already exists
      - Show "Visitor is typing..." when payload.isTyping is true
      - Also emit typing indicator when agent types: call `socket.emit("typing:set", { workspaceId, conversationId, isTyping: true })` on textarea input, debounced with 1s timeout
      
      **D. Online/offline status**
      - Handler: `socket.on("visitor:presence", ...)` already exists
      - Update the online dot color in conversation list and chat header
      
      **E. New conversation appears**
      - Handler: `socket.on("conversation:created", ...)` already exists
      - Confirm it adds the new conversation to the list
      
      Files: `apps/dashboard/src/components/inbox-page.tsx` (refinements to existing handlers)
      
      Verify: Run `npm run dev`, open two browser windows (one as visitor widget, one as agent inbox), send messages from both sides, confirm they appear instantly without refresh, typing indicator shows, unread counts update, online status is accurate.

- [ ] 8. **Add browser notifications for new messages**
      
      Create `apps/dashboard/src/hooks/useNotifications.ts` hook:
      - On mount, check if `Notification.permission === "default"`, then call `Notification.requestPermission()`
      - Store permission state in localStorage as "relay-inbox-notifications"
      - Provide `sendNotification(title, body)` function
      
      In `inbox-page.tsx`:
      - Import and use the hook
      - When `socket.on("conversation:message", ...)` fires and `message.senderType === "visitor"` and the window is not focused (`document.hasFocus() === false`), call `sendNotification("New visitor message", message.body.slice(0, 120))`
      - Add a toggle button in the inbox header to enable/disable notifications (stored in localStorage)
      
      Files: `apps/dashboard/src/hooks/useNotifications.ts` (new), `apps/dashboard/src/components/inbox-page.tsx`
      
      Verify: Run `npm run dev`, enable notifications, send a message from widget while dashboard window is not focused, confirm browser notification appears with message preview.

- [ ] 9. **Add optional notification sound on new message**
      
      In `inbox-page.tsx`:
      - Add a toggle button in the inbox header to enable/disable sound (stored in localStorage as "relay-inbox-sound")
      - When `socket.on("conversation:message", ...)` fires and `message.senderType === "visitor"` and sound is enabled, play a short beep using Web Audio API:
        ```ts
        const audio = new AudioContext();
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        oscillator.frequency.value = 660;
        gain.gain.value = 0.035;
        oscillator.connect(gain);
        gain.connect(audio.destination);
        oscillator.start();
        oscillator.stop(audio.currentTime + 0.12);
        ```
      - The inbox already has sound toggle logic (line 440-455 in current inbox-page.tsx), ensure it's wired correctly
      
      Files: `apps/dashboard/src/components/inbox-page.tsx`
      
      Verify: Run `npm run dev`, enable sound, send a message from widget, confirm a short beep plays when the message arrives.

- [ ] 10. **Polish and final integration testing**
      
      - Ensure all 5 sidebar items work (Inbox, Widgets, History, Settings, Logout)
      - Ensure Logout actually signs out (already implemented in dashboard-shell.tsx)
      - Test History page filters (All, Open, Resolved) and delete with confirmation
      - Test Inbox 3-column layout responsiveness (desktop and mobile)
      - Test real-time: new message, typing, online status, unread badge, notifications, sound
      - Test full URL display in conversation list, visitor details, and history table
      - Fix any styling issues to match Jivo premium feel: clean spacing, soft shadows, smooth animations
      
      Files: All files from previous steps
      
      Verify: Run `npm run dev`, complete a full user flow: login, view inbox, chat with visitor in real time, check history, delete a conversation, verify all real-time features work, confirm UI is clean and professional.

## Verification Summary

After completing all steps:

1. **Sidebar**: Only 5 items (Inbox with unread badge, Widgets, History, Settings, Logout)
2. **History page**: Shows all conversations, delete works, filters work, displays full URL
3. **Full URL**: Displayed in conversation list ("from <url>"), visitor details, and history table
4. **Jivo layout**: 3-column inbox (sidebar, conversation list, chat thread) with premium styling
5. **Real-time**: Messages appear instantly, typing indicator, online status, unread counts update live
6. **Notifications**: Browser notifications when window not focused (with toggle)
7. **Sound**: Optional beep on new message (with toggle)
8. **No refresh needed**: All updates via socket.io

**Final check**: Start the dev servers with `npm run dev`, open `/dashboard/inbox`, start a chat from widget demo, send messages back and forth, verify instant delivery, then go to History, delete the conversation, confirm it's gone.
