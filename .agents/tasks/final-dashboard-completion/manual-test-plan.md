# Manual Test Plan - Final Dashboard Completion

## Prerequisites
1. Start both servers: `npm run dev` (runs both API and Dashboard)
2. Have two browser windows/tabs open:
   - Dashboard: http://localhost:3000/dashboard/inbox
   - Widget Demo: http://localhost:3000/widget-demo?widgetId=YOUR_WIDGET_ID

## Test Flow

### 1. Authentication & Setup
- [ ] Sign up / Login to dashboard
- [ ] Create a new widget from "Create Widget" button (top right)
- [ ] Copy the widget ID

### 2. Sidebar Features
- [ ] Verify sidebar shows only: Inbox, History, Settings, Logout
- [ ] Click collapse/expand button (hamburger menu)
- [ ] Verify main content area expands when sidebar collapsed
- [ ] Verify sidebar state persists on page refresh

### 3. Real-Time Chat (No Refresh)
- [ ] Open widget demo with your widget ID
- [ ] Send a message from widget as a visitor
- [ ] Verify message appears in dashboard Inbox WITHOUT refreshing
- [ ] Reply from dashboard
- [ ] Verify visitor sees reply without refresh
- [ ] Send multiple messages back and forth
- [ ] Verify all messages appear in real-time

### 4. Sound Notifications
- [ ] Click the sound icon in inbox header to enable
- [ ] Send a message from widget
- [ ] Verify you hear a short beep sound
- [ ] Click sound icon again to disable
- [ ] Send another message
- [ ] Verify no sound plays

### 5. Browser Notifications
- [ ] Click the bell icon in inbox header
- [ ] Accept browser notification permission when prompted
- [ ] Blur/unfocus the dashboard tab (switch to another tab)
- [ ] Send a message from widget
- [ ] Verify desktop notification appears
- [ ] Click notification to return to dashboard
- [ ] Focus dashboard tab and send another widget message
- [ ] Verify NO notification appears when tab is focused

### 6. Visitor URL Display

#### In Inbox List:
- [ ] Open widget from `http://localhost:3000/some-page?param=value`
- [ ] Send a message from widget
- [ ] In dashboard inbox list, verify conversation shows "from http://localhost:3000/some-page?param=value"

#### In Visitor Details Panel:
- [ ] Click on the conversation
- [ ] Verify right sidebar shows "Current Page" section
- [ ] Verify full URL is displayed and clickable
- [ ] Click URL link
- [ ] Verify it opens in new tab

### 7. History Page

#### Navigation:
- [ ] Click "History" in sidebar
- [ ] Verify history page loads with table layout

#### Filtering:
- [ ] Click "All" filter - verify all conversations shown
- [ ] Click "Open" filter - verify only open conversations shown
- [ ] Click "Resolved" filter - verify only resolved conversations shown

#### Display Verification:
- [ ] Verify each row shows:
  - Visitor avatar with color
  - Visitor name and email
  - Website name
  - Full URL (clickable)
  - Date formatted correctly
  - Status badge with color
  - Delete button

#### URL Display:
- [ ] Verify "Full URL" column shows complete visitor URL
- [ ] Click a URL
- [ ] Verify it opens in new tab

#### Delete Functionality:
- [ ] Click delete button on a conversation
- [ ] Verify confirmation dialog appears
- [ ] Click "Cancel" - verify conversation remains
- [ ] Click delete again
- [ ] Click "OK/Confirm"
- [ ] Verify conversation is removed from list
- [ ] Go to Inbox - verify conversation also removed there

#### Pagination:
- [ ] If more than 20 conversations exist, verify "Load More" button appears
- [ ] Click "Load More"
- [ ] Verify more conversations load without page refresh

### 8. Unread Badge
- [ ] Have multiple unread conversations
- [ ] Verify sidebar "Inbox" shows red badge with count
- [ ] Open and read a conversation
- [ ] Verify badge count decreases
- [ ] Mark all as read
- [ ] Verify badge disappears

### 9. Connection Status
- [ ] Verify header shows "Connected" status with green dot
- [ ] Stop API server
- [ ] Verify status changes to "Offline" or "Reconnecting..."
- [ ] Restart API server
- [ ] Verify status returns to "Connected"

### 10. Mobile Responsiveness
- [ ] Open dashboard on mobile browser or resize to mobile width
- [ ] Verify sidebar becomes overlay
- [ ] Click hamburger to open sidebar
- [ ] Verify backdrop overlay appears
- [ ] Click backdrop to close sidebar
- [ ] Test conversation switching
- [ ] Verify three-panel mobile navigation (List → Thread → Details)

## Expected Results Summary

| Feature | Expected Behavior | Status |
|---------|------------------|--------|
| Sidebar | Only 4 items, collapsible, persistent state | ⬜ |
| Real-time Chat | No refresh needed, instant updates | ⬜ |
| Sound Notifications | Plays on visitor messages, toggleable | ⬜ |
| Browser Notifications | Shows when unfocused, requires permission | ⬜ |
| Visitor URL - Inbox List | Shows in conversation preview | ⬜ |
| Visitor URL - Details Panel | Shows as clickable link | ⬜ |
| Visitor URL - History | Shows in dedicated column | ⬜ |
| History Filters | All/Open/Resolved work correctly | ⬜ |
| History Delete | Confirmation prompt, removes from both | ⬜ |
| History Pagination | Loads more without refresh | ⬜ |
| Unread Badge | Shows count, updates in real-time | ⬜ |
| Connection Status | Shows current state with indicator | ⬜ |
| Mobile Layout | Responsive, touch-friendly | ⬜ |

## Common Issues & Solutions

### Issue: Sound doesn't play
**Solution:** Some browsers require user interaction before playing audio. Click anywhere in the page first.

### Issue: Notifications don't appear
**Solution:** Check browser notification permission in browser settings. May need to allow for localhost.

### Issue: Widget not loading
**Solution:** 
1. Verify `NEXT_PUBLIC_WIDGET_API_URL` is set
2. Check browser console for errors
3. Ensure widget ID is correct (32 character string)

### Issue: Real-time not working
**Solution:**
1. Check API server is running
2. Verify MongoDB connection
3. Check browser console for WebSocket errors

### Issue: URL not showing
**Solution:** Widget must send `currentPageUrl` in initial connection. Check widget initialization includes page URL tracking.

## Performance Checks

- [ ] Inbox loads in < 2 seconds
- [ ] New messages appear in < 500ms
- [ ] History page loads in < 2 seconds
- [ ] Sidebar animation is smooth (no jank)
- [ ] Scrolling is smooth in message history
- [ ] No console errors
- [ ] No memory leaks (check DevTools Memory tab)

## Browser Compatibility Testing

Test on:
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile Safari (iOS)
- [ ] Mobile Chrome (Android)

## Notes Section

Use this space to record any issues found:

---

**Test Date:** _________________

**Tested By:** _________________

**Browser/Device:** _________________

**Issues Found:**

---

