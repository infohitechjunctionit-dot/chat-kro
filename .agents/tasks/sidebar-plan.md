# Implementation Plan: Collapsible Sidebar

## Overview
Implement a collapsible sidebar with toggle button, smooth transitions, and responsive behavior for the dashboard. The sidebar will collapse to show only icons on desktop, and overlay content on mobile.

## Context
- **Main component**: `c:\Users\satya\Desktop\New folder\chat system\apps\dashboard\src\components\dashboard-shell.tsx`
- **Current state**: Sidebar is fixed at 240px (w-60) on desktop (lg+ breakpoint), hidden on mobile with horizontal nav
- **State management**: Local useState hooks (no global state library)
- **Styling**: Tailwind CSS 4.3 utility classes
- **Icons**: lucide-react

## Implementation Steps

- [ ] 1. Add sidebar collapse state management with localStorage persistence
      In dashboard-shell.tsx, add useState hook for `sidebarCollapsed` state initialized from localStorage key 'sidebar-collapsed'. Add useEffect hooks to read from localStorage on mount and persist changes on state update.
      Files: `c:\Users\satya\Desktop\New folder\chat system\apps\dashboard\src\components\dashboard-shell.tsx`
      Verify: `npm run typecheck --workspace @live-chat/dashboard` passes, manual test: refresh page and verify state persists

- [ ] 2. Add hamburger toggle button in header
      Import Menu icon from lucide-react. Add button before the workspace name div in the header with onClick handler to toggle sidebarCollapsed. Style: flex size-9 items-center justify-center rounded-md hover:bg-slate-100 text-slate-600. Include aria-label="Toggle sidebar" for accessibility.
      Files: `c:\Users\satya\Desktop\New folder\chat system\apps\dashboard\src\components\dashboard-shell.tsx`
      Verify: `npm run lint --workspace @live-chat/dashboard` passes, manual test: button toggles state

- [ ] 3. Implement responsive sidebar width transitions
      Update the sidebar <aside> element classes based on sidebarCollapsed state:
      - Desktop expanded: 'w-60' (240px)
      - Desktop collapsed: 'w-15' (60px, ~15 in Tailwind = 3.75rem)
      - Add transition: 'transition-all duration-300 ease-in-out'
      - Keep existing 'hidden lg:flex' for mobile/desktop breakpoint
      Files: `c:\Users\satya\Desktop\New folder\chat system\apps\dashboard\src\components\dashboard-shell.tsx`
      Verify: Manual test desktop: toggle button, observe smooth 300ms width transition between 240px and 60px

- [ ] 4. Update navigation links for collapsed state
      Wrap each navigation link's label text in a <span> with conditional classes to hide when collapsed on desktop. When collapsed, use 'lg:opacity-0 lg:w-0 lg:overflow-hidden' to smoothly fade out text while keeping icons visible. Adjust icon and text spacing/padding for both states.
      Files: `c:\Users\satya\Desktop\New folder\chat system\apps\dashboard\src\components\dashboard-shell.tsx`
      Verify: Manual test: in collapsed state, only icons visible; in expanded state, icons and labels visible

- [ ] 5. Update workspace selector and branding for collapsed state
      In the logo/branding Link and workspace selector section, add conditional rendering or classes to show only an icon or abbreviated version when collapsed on desktop. Consider showing just the MessagesSquare icon without text when collapsed.
      Files: `c:\Users\satya\Desktop\New folder\chat system\apps\dashboard\src\components\dashboard-shell.tsx`
      Verify: Manual test: collapsed sidebar shows minimal branding/icon, expanded shows full text

- [ ] 6. Update main content area padding to match sidebar width
      Update the main content wrapper div (currently has 'lg:pl-60') with conditional padding based on sidebarCollapsed:
      - Collapsed: 'lg:pl-15'
      - Expanded: 'lg:pl-60'
      - Add transition: 'transition-all duration-300 ease-in-out'
      Files: `c:\Users\satya\Desktop\New folder\chat system\apps\dashboard\src\components\dashboard-shell.tsx`
      Verify: Manual test: main content area smoothly adjusts padding when sidebar toggles

- [ ] 7. Implement mobile overlay behavior
      For mobile (<lg breakpoint), when sidebar is expanded (sidebarCollapsed = false), make sidebar overlay content:
      - Add conditional 'fixed inset-0 z-40' classes to sidebar on mobile when open
      - Add backdrop overlay div (<div>) with 'fixed inset-0 bg-black/20 z-30 lg:hidden' that appears only when sidebar is open on mobile
      - Add onClick handler to backdrop to close sidebar
      Files: `c:\Users\satya\Desktop\New folder\chat system\apps\dashboard\src\components\dashboard-shell.tsx`
      Verify: Manual test mobile viewport: open sidebar overlays content with backdrop, clicking backdrop closes sidebar

- [ ] 8. Add max-width constraint for large screens
      Update the main content wrapper (<main> element) to include max-w-7xl or max-w-[1600px] to prevent content from stretching too wide on very large screens. Center content with mx-auto.
      Files: `c:\Users\satya\Desktop\New folder\chat system\apps\dashboard\src\components\dashboard-shell.tsx`
      Verify: Manual test on wide screen (>1600px): content has maximum width and is centered

- [ ] 9. Final verification and polish
      Run full type check and lint. Test all responsive breakpoints. Verify state persistence across navigations. Check accessibility: keyboard navigation, focus states, aria-labels.
      Files: `c:\Users\satya\Desktop\New folder\chat system\apps\dashboard\src\components\dashboard-shell.tsx`
      Verify: `npm run typecheck --workspace @live-chat/dashboard && npm run lint --workspace @live-chat/dashboard` both pass. Manual testing on desktop, mobile, and tablet viewports confirms all requirements met.

## Key Implementation Details

### State Management
```typescript
const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

useEffect(() => {
  const saved = localStorage.getItem('sidebar-collapsed');
  if (saved !== null) setSidebarCollapsed(saved === 'true');
}, []);

useEffect(() => {
  localStorage.setItem('sidebar-collapsed', String(sidebarCollapsed));
}, [sidebarCollapsed]);
```

### Responsive Behavior
- **Desktop (lg+)**: Sidebar width transitions between 240px (w-60) and 60px (w-15)
- **Mobile (<lg)**: Sidebar overlays content when open (fixed positioning with backdrop)
- **Transitions**: 300ms ease-in-out for smooth animations

### CSS Classes Pattern
```typescript
className={`fixed inset-y-0 left-0 flex-col border-r bg-white transition-all duration-300 ease-in-out
  ${sidebarCollapsed ? 'w-15' : 'w-60'}
  ${sidebarCollapsed ? 'lg:flex' : 'hidden lg:flex'}
  /* mobile overlay when open */
`}
```

## Verification Checklist
- [ ] TypeScript compiles without errors
- [ ] ESLint passes without errors
- [ ] Toggle button visible and functional on all screen sizes
- [ ] Desktop: smooth 300ms transitions between expanded/collapsed states
- [ ] Desktop collapsed: icons visible, text hidden
- [ ] Mobile: sidebar overlays content when open
- [ ] Mobile: backdrop closes sidebar when clicked
- [ ] State persists across page reloads
- [ ] Main content adjusts to use available space
- [ ] Large screens: content has max-width constraint
- [ ] Accessibility: proper aria-labels, keyboard navigation works
