## Background and Motivation

- Implement a dedicated Trash view so users can see trashed bookmarks and restore or permanently delete them, instead of only soft-deleting from the main list.
- Apply Emil design engineering UI polish to the dashboard header so collection chips and route navigation feel crisp, touch-friendly, and free of layout shift.
- Introduce a storyboarded Interface Craft animation for the "new collection" interaction in the header so that tapping the plus icon smoothly transitions from collection chips + Trash tab to an inline collection-name input without layout jank.
- Add first-class visibility controls for bookmarks (private / friends / public), surfaced directly in the bookmark context menu so users can quickly change who can see a specific bookmark without opening a separate settings modal.
- Add an admin control surface with persistent user roles/status, a protected `/admin` entry point, searchable user management, moderation actions, and eventually a fully dynamic achievement builder.
- **Mutual friendship system**: Users add friends only when both sides agree (friend request → accept/deny). Once friends, the existing "friends" visibility on bookmarks/collections applies to them, and users can share a bookmark or collection directly to a friend via a modal (e.g. "Share to…" → pick friend → friend sees it in a "Shared with you" surface or notification).

## Key Challenges and Analysis

- Reuse the existing Elysia `/bookmarks/trash`, `/:id/restore`, and `/:id` endpoints from the web app.
- Integrate the Trash UI into the current Next.js App Router dashboard flow without breaking existing collection filtering.
- Keep the UI polished and accessible, applying Interface Craft (storyboarded motion) and Emil design engineering principles (no layout shift, good tap targets, reduced motion support).
- For the header specifically, refine chip and nav styles without regressing keyboard navigation, tap target sizing (44px+), or reduced-motion behavior for users who prefer minimal animation.
- The "new collection" flow should feel like a single, coherent transition: chips and Trash fade away first, then an inline input grows from right → left while the plus icon slides left to sit just to the left of the input, with cursor focus landing in the field and respecting `prefers-reduced-motion`.
- Need to reuse or adapt the existing `NewCollectionPopover` logic (submit, validation, error handling) while changing the visual presentation to an inline input inside the header pill, and ensure Escape/cancel returns cleanly to the default chips view.
- Bookmark visibility exists in the database schema (`visibilityEnum` on `bookmark` and `collection`) but there is currently no dedicated API in `bookmarksRouter` nor any UI in `BookmarkList`’s context menu to toggle it; we need to design a small, focused API surface and a frictionless context-menu UX for changing visibility.
- Visibility rules must stay consistent with collection-level visibility and any future “friends-only” model; for now we will treat bookmark visibility as independent per-row, but we should avoid surprises (e.g. private bookmark inside public collection) in the eventual social surface.

- **Friendship vs follow**: The app already has one-way **follow** (`userFollow`) used for profiles and feed. Friendship is **mutual** and gated by request/accept. Keep both: follow remains for discovery and feed; friendship gates "friends" visibility and "share to friend" target list.
- **Friendship schema**: Introduce **friend_request** (requesterId, addresseeId, status: pending | accepted | denied, createdAt, respondedAt) and **friendship** with one row per pair using canonical ordering (userIdA, userIdB where userIdA < userIdB) so "all friends of X" is a simple query and duplicate pairs are avoided.
- **"Friends" visibility enforcement**: Currently all server reads filter only by `public`; `friends` is stored but not enforced. Add a helper (e.g. `areFriends(userIdA, userIdB)`) and use it in profile bookmarks/collections and any endpoint returning another user's content so that visibility `friends` is returned only when the requester is a friend of the owner.
- **Share-to-friend**: "Share to friend" = user picks bookmark or collection, opens a modal, selects a friend; the friend sees the item in a "Shared with you" list. Store **share** records (senderId, recipientId, bookmarkId or collectionId, createdAt) and expose GET "shared with me" plus optional notification/badge.
- **Idempotency**: Send friend request idempotent (already pending → success); accept/deny once-only. Prevent self-friend and duplicate friendships.

## High-level Task Breakdown

- [ ] Add a Trash view in the dashboard app that lists trashed bookmarks.
- [ ] Wire restore and permanent delete actions to the server API, with optimistic UI and safe fallbacks.
- [ ] Add navigation affordance (e.g. header toggle) between the main inbox and Trash views.
- [ ] Optionally add an “Empty trash” bulk action using the purge endpoint.
- [x] Design and document an Emil-aligned UI polish plan for the header component (`Header`), with success criteria around layout stability, tap targets, motion, and focus states.
- [x] Design an Interface Craft storyboard and state machine for the "new collection" animation sequence in `Header`, including stage timings, config objects, and reduced-motion behavior, without touching implementation yet.
- [ ] Design and implement bookmark visibility controls:
  - [ ] Add REST API support in `bookmarksRouter` to update a bookmark’s `visibility` (private / friends / public) with proper auth and type validation.
  - [ ] Extend `BookmarkList` types and data-loading so each bookmark row knows its current visibility.
  - [ ] Add a visibility section to the bookmark context menu (e.g. radio-group style submenu) that lets the owner switch visibility in one click, with optimistic UI and error fallback.
  - [ ] Ensure the context menu respects read-only mode (no visibility changes for followed collections) and remains accessible (ARIA roles, keyboard, reduced-motion).

### Mutual friendship and share-to-friend (Planner)

- [ ] **Schema and migrations**
  - [x] Add `friend_request` table: id, requesterId, addresseeId, status (pending | accepted | denied), createdAt, respondedAt. Indexes on requesterId, addresseeId, and (requesterId, addresseeId) for idempotency.
  - [x] Add `friendship` table: userIdA, userIdB (canonical: userIdA < userIdB), createdAt. Unique on (userIdA, userIdB). Indexes for "friends of X" queries.
  - [x] Add `bookmark_share` (or generic `share`) table: id, senderId, recipientId, bookmarkId (nullable), collectionId (nullable), createdAt. Ensure exactly one of bookmarkId or collectionId is set. Index on recipientId for "shared with me".
  - [x] Run `bun drizzle-kit push` from `packages/db` and export new relations from schema index.
  - **Success criteria**: Schema pushes cleanly; relations allow querying friends, requests, and shares.

- [ ] **Server: friendship API**
  - [ ] Add helper `areFriends(userIdA, userIdB)` (and optionally `getFriendIds(userId)`) in a small module (e.g. `friends.ts` or under `users`).
  - [ ] `POST /users/me/friend-requests` — body `{ username }`. Resolve username to userId; create pending request; idempotent if same pending exists; 400 for self, 404 if user not found.
  - [ ] `GET /users/me/friend-requests` — return incoming (pending) and optionally outgoing (pending) with requester/addressee user summary.
  - [ ] `POST /users/me/friend-requests/:id/accept` — only addressee can accept; create friendship row(s) with canonical ordering; update request status and respondedAt; 403 if not addressee, 409 if already responded.
  - [ ] `POST /users/me/friend-requests/:id/deny` — only addressee can deny; update status and respondedAt; 403 if not addressee, 409 if already responded.
  - [ ] `GET /users/me/friends` — list friends with id, name, username, image for share modal and UI.
  - [ ] `DELETE /users/me/friends/:username` — remove friendship (both sides); 404 if not friends.
  - **Success criteria**: All endpoints covered by auth guard; accept creates mutual friendship; deny/accept idempotent after first response; unit or integration tests for key flows.

- [ ] **Server: enforce "friends" visibility**
  - [ ] In `GET /users/:username/bookmarks` and `GET /users/:username/collections` (and any public profile content): if item visibility is `friends`, include it only when the current user is a friend of the profile owner (use `areFriends`). Keep `public` behavior unchanged.
  - [ ] **Success criteria**: Unauthenticated or non-friend users do not see friends-only content; friends of the owner do.

- [ ] **Server: share API**
  - [ ] `POST /users/me/share` — body `{ bookmarkId?: string, collectionId?: string, recipientUsername: string }`. Validate exactly one of bookmarkId/collectionId; resolve recipient; verify recipient is friend; insert share row; return success.
  - [ ] `GET /users/me/shared-with-me` — list shares where recipientId = me, with sender and bookmark/collection summary, ordered by createdAt desc.
  - [ ] Optional: `GET /users/me/shared-by-me` — list shares sent by me (for "I shared this with X").
  - **Success criteria**: Only friends can be recipients; "shared with me" returns correct items with sender info.

- [ ] **Web: friend request and friends UI**
  - [ ] Add a Friends or "Friend requests" entry point (e.g. in header dropdown, or a dedicated /dashboard/friends or /settings/friends): show pending incoming requests with Accept / Deny; show outgoing pending; show list of friends with option to remove.
  - [ ] Add "Add friend" flow: input username → POST friend-request → show success or error (e.g. "Request sent", "User not found", "Already friends").
  - **Success criteria**: User can send request, accept, deny, see friends list, and remove friend from one place.

- [ ] **Web: share-to-friend modal**
  - [ ] Add "Share to…" (or "Share with friend") action in bookmark context menu and collection context menu (or header chip menu for collection). Opens a modal/dialog.
  - [ ] Modal: fetch `GET /users/me/friends`; show list of friends (avatar, name, username); single-select or multi-select; "Share" button. On submit call `POST /users/me/share` with bookmarkId or collectionId and chosen friend(s).
  - [ ] After success: toast or inline message "Shared with [name]"; close modal.
  - **Success criteria**: From a bookmark or collection, user can open Share modal, pick a friend, and share; friend can see it in "Shared with me".

- [ ] **Web: "Shared with me" surface**
  - [ ] Add a way to view "Shared with me" (e.g. a section on dashboard, or a tab, or a dedicated page). Call `GET /users/me/shared-with-me` and render list of shared bookmarks/collections with sender info and link to open.
  - **Success criteria**: Recipient can see who shared what and open the bookmark or collection.

## Project Status Board

- [ ] Implement Trash bookmarks view (list trashed items, restore, delete).
- [ ] Apply Emil UI polish to `BookmarkList` interactions (reduced motion, hover/touch, dialog a11y).
- [ ] Apply Emil UI polish to the dashboard header (`Header`) including collection chips and Inbox/Trash nav.
- [ ] Plan and implement Interface Craft storyboarded animation for the header "new collection" interaction (Planner done; Executor implementing, pending verification).
- [ ] Add bookmark visibility controls:
  - [ ] Backend: `PATCH /bookmarks/:id/visibility` endpoint with `visibility` body param (`"private" | "friends" | "public"`), using `visibilityEnum`, user ownership checks, and updated `updatedAt`.
  - [ ] Frontend data: expose bookmark `visibility` in the dashboard bookmarks fetch and thread it through to `BookmarkList`.
  - [ ] Frontend UI: add a “Visibility” section or submenu in the bookmark context menu with three options (Private, Friends, Public), reflecting the current state and dispatching the API call.
  - [ ] UX & a11y: ensure the new menu items are not shown in read-only mode, have proper ARIA (menuitemradio / checked state), respect `prefers-reduced-motion`, and don’t introduce layout shift or hover jank.
- [x] Admin Phase 1: add `user.role` / `user.status`, reusable server authz helpers, enforce active-user checks on authenticated writes, and protect a new `/admin` entry point.
- [ ] **Mutual friendship and share-to-friend**: Schema (friend_request, friendship, share); server APIs (friend request/accept/deny, list friends, share, shared-with-me); enforce "friends" visibility; web: friend UI, Share modal, Shared with me surface.
- [x] Admin Phase 2: add admin user directory, user detail API, ban/unban flows, audit logging, and an admin moderation console UI.
- [x] Admin Phase 3: replace the static server achievement catalog with DB-backed definitions plus a validated rule/evaluator model.
- [x] Admin Phase 4: build admin achievement CRUD and preview tooling on the web side.
- [x] Admin Phase 5: migrate existing code-defined achievements into the new model and reconcile user progress safely.
- [x] Admin Phase 6: add rollout safeguards, deeper tests, and verification for authz/moderation/achievement rule changes.

### Header Emil UI Polish Design (Planner)

- **Chosen direction**: Keep the header minimal and utility-focused, but make every interaction feel smooth and satisfying with tight, fast animations. No layout shift, no flashy marketing chrome, just a crisp, touch-first bar.
- **Collections pill group**
  - Keep the overall structure (All + dynamic chips) but:
    - Ensure the `All` chip and collection chips have at least a 44px tap target height (padding adjustments as needed) while preserving the current rounded-full shape.
    - Refine selected vs unselected states so they rely on stable background and color changes (no font-weight change) and use a soft, non-intrusive focus ring via box-shadow rather than outline.
    - Gate hover-only affordances with `@media(hover:hover)` so touch devices do not show hover flicker; keep active/pressed scale subtle (e.g. ~0.96–0.97) and very fast (\<=150ms).
  - Preserve the existing storyboarded animations for:
    - New collection chip entrance (wrapper expand + chip scale/opacity).
    - Initial load stagger for all chips.
  - Success criteria:
    - No horizontal layout shift when collections load or when a new chip appears (max-width animation only, no text reflow).
    - Tap targets for All and chips meet or exceed 44px and are easy to hit on touch devices.
    - Focus ring is clearly visible and does not affect layout.
    - `prefers-reduced-motion` still collapses durations to 0 for wrapper and chip transitions.

- **Inbox/Trash navigation**
  - Evolve the current two-button nav into a segmented-control style with a shared “pill” highlight behind the active route:
    - Wrap the two `Link` elements in a rounded-full container with a very subtle background (e.g. `bg-muted/60` or equivalent token).
    - Introduce a `motion.div` behind the active item that:
      - Uses `layout` or explicit `x/width` animation to slide between Inbox and Trash without causing layout shift.
      - Animates with a short (150–200ms) ease-out transform/opacity-only transition.
      - Respects `prefers-reduced-motion` by instantly snapping to the active position when reduced motion is enabled.
    - Keep text size small but legible, and avoid changing font-weight on selection.
  - Preserve existing `aria-current="page"` behavior for the active route and ensure both links remain fully focusable and keyboard-navigable.
  - Success criteria:
    - Switching between Inbox and Trash feels “snappy” with a single, smooth pill movement.
    - No layout shift when toggling routes; only the background highlight moves.
    - Keyboard navigation (Tab + Enter/Space) behaves identically to mouse/touch interaction.
    - On reduced motion, the pill moves with no animation.

- **Touch & accessibility**
  - Confirm all interactive elements in the header:
    - Have `user-select: none` where appropriate to avoid accidental text selection while dragging or tapping.
    - Use pointer-events correctly so decorative glows/gradients (if added later) never capture taps.
    - Maintain or improve existing focus-visible states without relying on color alone.
  - Success criteria:
    - Header interactions feel as good on a trackpad/mouse as on a phone or tablet.
    - All elements remain reachable and usable via keyboard.

- **Performance & motion constraints**
  - Only animate `transform` and `opacity` for new nav and chip interactions; avoid animating `width`/`height` directly to keep things jank-free.
  - Keep all interaction animations under ~200ms and skip anything non-essential for frequently-used actions (e.g. extremely subtle scaling only, no large bounces).
  - Success criteria:
    - Animations feel immediate, never sluggish.
    - No noticeable jank when rapidly switching collections or toggling between Inbox and Trash, even on lower-end hardware.

### Header "New Collection" Storyboard Design (Planner)

- **What we are animating**
  - The existing header pill that currently contains:
    - `All` chip
    - Collection chips (scrollable `motion.div` wrapper)
    - Plus icon trigger (`NewCollectionPopover` trigger)
    - Trash icon tab
  - On tapping the plus icon, we transition from "normal browsing" to a "create collection inline" mode inside the same pill.

- **Storyboard (user-facing description)**

  /* ─────────────────────────────────────────────────────────
   * ANIMATION STORYBOARD — NEW COLLECTION
   *
   *   0ms   Plus icon is tapped; chips and Trash tab start fading/sliding out
   * 150ms   Collection chips and Trash tab are fully gone; pill feels empty to the right
   * 180ms   Inline "New collection name" input fades in at the right edge, width 0 → full
   * 260ms   Plus icon slides left to sit just before the input, leaving a small gap
   * 320ms   Input is fully expanded, caret focused; user can type the collection name
   * ───────────────────────────────────────────────────────── */

- **TIMING object (Planner proposal)**
  - `const NEW_COLLECTION_TIMING = {`
  - `  chipsExit:        0,    // chips + Trash begin fading/sliding out`
  - `  chipsExitDone:  150,    // chips + Trash fully gone; safe to start input reveal`
  - `  inputReveal:    180,    // input starts fading in and expanding from right → left`
  - `  iconSlide:      260,    // plus icon starts sliding left to sit near input`
  - `  inputReady:     320,    // input fully expanded, focus can safely be applied`
  - `};`
  - All values are ms relative to the plus-icon tap (the trigger).

- **State machine (stage-driven, no scattered booleans)**
  - Introduce a dedicated integer stage for this interaction in `Header`, e.g. `newCollectionStage`:
    - `0`: Default browsing mode — chips + Trash visible, plus icon at far right, no inline input.
    - `1`: Chips/Trash exiting — fading/sliding out; plus icon still anchored at original position.
    - `2`: Input appearing — chips/Trash are gone, input is fading/expanding, plus icon beginning to slide left.
    - `3`: Input ready — input fully expanded, plus icon settled to the left with a small gap, cursor focused.
  - A single `useEffect` driven by a "replay" value for the plus-tap will schedule timeouts at `NEW_COLLECTION_TIMING.*` to advance `newCollectionStage` from 0 → 1 → 2 → 3.
  - Cancelling (Escape or clicking outside) or successful submit should reset `newCollectionStage` to 0 and cancel timers.

- **Element config objects (Planner proposal)**
  - `NEW_CHIPS`:
    - `exitOffsetY = 4` px (slight slide-down as they fade out).
    - `exitDurationMs = NEW_COLLECTION_TIMING.chipsExitDone - NEW_COLLECTION_TIMING.chipsExit`.
    - `spring` or ease: reuse existing `EASE_OUT_CUBIC` with a short duration and opacity+transform only.
  - `NEW_TRASH_TAB`:
    - Mirrors `NEW_CHIPS` exit behavior so the Trash icon leaves in sync with the chips.
  - `NEW_INPUT`:
    - `maxWidthRem = 16` (tunable; enough for typical collection names).
    - `growDurationMs ≈ 180–200` (from `inputReveal` to `inputReady`).
    - Animated props: `opacity` 0 → 1, `scaleX` or width proxy from 0 → 1 while anchored to the right edge, so visually it expands right → left without causing layout shift.
    - Uses a spring config tuned for a smooth but quick growth (e.g. stiffness 320, damping 30).
  - `NEW_PLUS_ICON`:
    - `shiftXRem ≈ -1.0` to `-1.5` rem so it moves left just enough to create a small gap before the input.
    - `slideDurationMs` aligned with `NEW_INPUT.growDurationMs` so icon and input feel like one motion.
    - Animated props: `x` only (transform), no width/height changes.

- **Reduced-motion behavior**
  - When `useReducedMotion()` is true:
    - All durations collapse to 0.
    - Stage jumps to `3` immediately when the plus icon is tapped (chips/Trash disappear, input + icon appear in final positions without animation).
    - Focus still moves to the input at the equivalent of `inputReady`.

- **Accessibility and UX notes**
  - Input should receive focus at stage 3 and support:
    - Enter → submit (reusing existing `handleCreateCollection` logic from `NewCollectionPopover`).
    - Escape → cancel, reset `newCollectionStage` to 0, restore chips + Trash.
  - While in stages 1–3, the "All" chip should remain visible and usable; only collection chips + Trash tab are part of the exit/entrance choreography.
  - Haptics:
    - Reuse the existing `useWebHaptics` trigger on plus tap and successful submit; keep durations short (≤50ms) to avoid feeling heavy.

## Achievement Redesign Plan

### Design Direction

Follow AGENTS.md: "premium, modern, minimal dark-luxury aesthetic (cinematic glass layers, subtle gradients, restrained motion)." The current implementation is functional but visually flat — every badge looks the same (primary color), icons are generic, the toast celebration is underwhelming, and the admin studio uses raw HTML selects. This redesign brings category identity, glass-layer depth, and more satisfying celebration motion.

### Key Design Decisions

**Category Color System** — Each achievement category gets its own accent color so badges have visual identity at a glance:
- `bookmarks_total` → Blue (`210`)
- `bookmarks_read` → Emerald (`155`)
- `bookmarks_favorited` → Amber (`45`)
- `followers_total` / social → Violet (`270`)
- `followed_collections` → Rose (`340`)
- `daily_streak` → Orange (`25`)
- `account_age` → Indigo (`240`)
- `xp_level` → Primary (theme)

Colors are expressed as OKLCH hues and rendered as CSS variables so they adapt to light/dark mode automatically.

**Icon Refresh** — Replace the generic Award icon in toasts with the actual badge-category icon. Expand the icon map to cover more badges distinctively.

### Surfaces to Redesign (6 files)

---

#### Task 1: Category Color System + Icon Refresh (`achievement-badge.tsx`)

**What changes:**
- Add a `getAchievementCategoryColor(icon: string)` helper that returns an OKLCH hue number per category.
- Update `AchievementIcon` to include more icons (Trophy for xp_level, Clock for account_age) and export it for reuse in toasts.
- Update `AchievementBadgeCard`:
  - Icon container gets a category-colored gradient background (`bg-[oklch(0.25_0.08_HUE)]` dark, `bg-[oklch(0.95_0.04_HUE)]` light) instead of flat `bg-primary/10`.
  - Unlocked card gets a subtle top-edge glow line (1px gradient border-top using category color).
  - Progress bar uses the category color instead of flat `bg-primary`.
  - XP pill gets category-tinted border.
- Update `AchievementBadgeChip`:
  - Icon dot uses category color.
  - Chip border tinted with category color when hovered.

**Success criteria:**
- Each badge visually belongs to its category through color.
- Unlocked badges look vivid; locked badges stay muted/grayscale.
- No new dependencies; only Tailwind classes and inline styles.

---

#### Task 2: Achievement Toast Redesign (`toast.tsx` + `toast-motion.ts`)

**What changes:**
- Replace the generic `Award` + `Sparkles` icon in `BadgeToastIcon` with the actual `AchievementIcon` from `achievement-badge.tsx` so each unlock shows its real category icon.
- Icon container uses category-colored gradient glow instead of generic `bg-primary/25`.
- `BadgeBurst` particles get the category color (`bg-[oklch(0.65_0.18_HUE)]`) instead of flat `bg-primary/80`.
- Toast card: add a subtle horizontal shimmer sweep (`@keyframes shimmer` — a gradient overlay that sweeps once on entrance for `rare` and `epic` levels).
- Better entrance animation: increase spring stiffness for a snappier pop-in; add subtle `backdropFilter` blur increase during entrance.
- `toast-motion.ts`: Tune the tween to have a more dramatic overshoot for epic (scalePeak: 1.2 → 1.3, with a second settle bounce).
- Pass `icon` string and celebration level down to `BadgeToast` so colors/icons resolve correctly.
- XP text: animate the number counting up from 0 → value with a CSS `font-variant-numeric: tabular-nums`.

**Success criteria:**
- Each badge unlock toast shows the correct category icon + category color.
- Epic celebrations feel genuinely exciting (shimmer + bigger burst + longer glow).
- Subtle celebrations still feel good but restrained.
- `prefers-reduced-motion` disables shimmer and particles.

---

#### Task 3: Settings Badges Section Redesign (`settings-modal.tsx` > `BadgesSection`)

**What changes:**
- Stat cards (Level, Total XP, Current Streak): add a subtle icon to each card (Shield, Zap, Flame), plus a thin category-colored top border.
- Badge grid: switch from flat 2-col grid to a section with unlocked badges first (vivid), then a "Locked" divider, then locked badges (muted).
- Each `AchievementBadgeCard` gets staggered entrance animation (`motion.div` with `variants` and `staggerChildren: 0.04`).
- Replace the linear progress bar inside badge cards with a small circular progress ring (SVG arc) using the category color — it's more compact and premium-feeling.
- Add hover effect on unlocked badges: gentle scale 1.01 + glow shadow.

**Success criteria:**
- Badges are visually sorted (unlocked first, locked after divider).
- Stat cards have subtle iconography and look polished.
- Entrance animation is smooth and staggered.
- The whole section feels premium and consistent with the rest of the app.

---

#### Task 4: Admin Achievement Studio Redesign (`admin-achievement-studio.tsx`)

**What changes:**
- Replace raw `<select>` elements for Celebration and Metric with styled pill/button groups that visually indicate the selection (similar to the color-mode selector in settings).
- Celebration selector: three pills (subtle, rare, epic) with a category-colored dot indicator.
- Achievement sidebar list: add the badge icon (small, via `AchievementIcon`) + celebration level dot next to each item.
- Add a "Live Preview" card below the form that renders an `AchievementBadgeCard` with the current draft values so the admin can see how the badge will look before saving.
- Improve section headers with slightly larger type and better spacing.
- Replace the plain checkbox cluster with styled toggle switches or at minimum pill-style checkboxes.

**Success criteria:**
- No more raw HTML `<select>` elements.
- Admin can see a live preview of the badge while editing.
- Celebration level is visually obvious in the sidebar list.
- The studio feels like part of the same design system as the rest of the app.

---

#### Task 5: Celebration Visuals Tuning (`badge-unlock-celebration.ts`)

**What changes:**
- Increase burst counts: subtle 3→4, rare 5→6, epic 8→10.
- Increase glow opacity for epic: 0.38→0.45.
- Slightly increase scale peaks: subtle 1.03→1.05, rare 1.08→1.12, epic 1.14→1.22.
- Increase durations slightly for epic to let the animation breathe: 1100→1400ms.

**Success criteria:**
- Epic celebrations feel dramatic and rewarding.
- Subtle celebrations feel quick and light.
- No jarring motion; everything still feels smooth.

---

#### Task 6: Profile Badge Chips Polish (`profile-view.tsx`)

**What changes:**
- `AchievementBadgeChip` already gets category colors from Task 1, so this is mostly about ensuring the profile view renders them well.
- Add a subtle entrance stagger when badges load.
- Ensure badge chips wrap gracefully on mobile.

**Success criteria:**
- Profile badge chips show category colors.
- They wrap properly and have a smooth entrance.

---

### Implementation Order

1. **Task 1** — Category color system + icon refresh (foundation; other tasks depend on it)
2. **Task 5** — Celebration visuals tuning (small, isolated)
3. **Task 2** — Toast redesign (depends on Task 1 exports)
4. **Task 3** — Settings badges section (depends on Task 1)
5. **Task 4** — Admin studio redesign (depends on Task 1)
6. **Task 6** — Profile chips polish (depends on Task 1)

### Not in scope
- No database schema changes.
- No new API endpoints.
- No new npm dependencies (everything uses existing motion/react, Tailwind, Lucide).
- Achievement logic/rules are untouched.

## Executor's Feedback or Assistance Requests

- Completed the achievement redesign across all 6 surfaces:
  - **Task 1** (`achievement-badge.tsx`): Added category color system (OKLCH hues per badge type), expanded icon set with Library/Clock/Trophy/Shield, category-colored gradient icon backgrounds, tinted progress bars, subtle top-edge glow on unlocked cards, radial ambient glow behind unlocked badges.
  - **Task 5** (`badge-unlock-celebration.ts`): Tuned celebration visuals — increased burst counts (subtle 4, rare 6, epic 10), raised glow opacity and scale peaks, extended epic duration to 1400ms.
  - **Task 2** (`toast.tsx` + `toast-motion.ts`): Replaced generic Award icon with actual badge category icons (BadgeIconGlyph), category-colored glow/particles/border, top-edge glow line, horizontal shimmer sweep for rare/epic, sparkle accent only for rare/epic, wider spring entrance. Added `icon` and `hue` fields to BadgeToast type. Updated providers.tsx to pass icon + hue through to celebrateBadge.
  - **Task 3** (`settings-modal.tsx` BadgesSection): Added stat card icons (Shield/Zap/Flame) with category-colored top glow lines, sorted badges (unlocked first, locked after divider), staggered entrance animation for badge grid.
  - **Task 4** (`admin-achievement-studio.tsx`): Replaced raw `<select>` elements with styled pill selectors for Celebration and Metric, added category icon + celebration dot to sidebar list items, added live AchievementBadgeCard preview showing current draft values.
  - **Task 6** (`profile-view.tsx`): Added staggered spring entrance animation for badge chips on public profiles.
  - All changes pass `bun run check-types` and lint checks. No new dependencies added.
  - Please verify in-browser that: (a) badge cards show distinct category colors, (b) toast celebrations display correct icons with colored glow, (c) settings badges section sorts unlocked/locked properly, (d) admin studio pill selectors and live preview work, (e) profile badge chips animate in smoothly.

- Implemented a Trash view (route `/dashboard/trash`) with list, restore, and permanent delete actions, plus header navigation between Inbox and Trash; awaiting your manual verification before marking the task complete.
- Applied initial Emil design engineering UI polish to `BookmarkList`: added `prefers-reduced-motion` support for row and duplicate dialog animations, limited hover effects to pointer devices, and improved the duplicate dialog/button accessibility.
- Implemented the storyboarded "new collection" header interaction: clicking the plus icon now fades/slides the collection chips and Trash tab out, then reveals an inline "Collection name" input that expands from right → left while the plus icon slides left to sit beside it; Escape cancels and restores the chips, Enter submits to `handleCreateCollection`. Please exercise this flow (including reduced-motion mode) and confirm it matches the desired feel before we mark the related task complete.
- Implemented the badges and achievements system end-to-end:
  - Added `user_achievement` and `user_achievement_stats` schema tables plus a server-side achievements engine with catalog definitions, unlock evaluation, XP/level calculation, streak handling, and full recompute support.
  - Wired live achievement updates into bookmark save/read/favorite flows and user/collection follow flows.
  - Added `GET /users/me/badges`, `GET /users/:username/badges`, and `POST /users/me/badges/recompute` so the web app can show private progress, public earned badges, and manually reconcile/backfill.
  - Added a new `Badges` settings section with colored unlocked badges, grayscale locked badges, hover/focus tooltips, and XP/level/streak summary cards.
  - Added public profile badge chips under the profile stats row.
  - Added Bun tests for the pure achievements engine helpers and verified they pass; workspace `bun run check-types` also passes.
- Implemented badge unlock celebrations:
  - Added manual per-badge celebration levels (`subtle`, `rare`, `epic`) to the achievements catalog so unlock intensity is authored badge-by-badge instead of inferred.
  - Extended the shared toast system with a dedicated achievement unlock presentation that escalates glow, burst, and scale based on the badge celebration level.
  - Added a global badge unlock watcher in `apps/web/src/components/providers.tsx` that polls `/users/me/badges`, diffs unlocked badge IDs, and shows each new unlock only once per session.
  - Wired immediate `kura:refresh-badges` refresh events into successful bookmark save/read/favorite flows and user/collection follow flows so celebrations do not have to wait for the next poll tick.
  - Added a focused Bun test for the unlock diff helper and celebration visuals; re-ran that test and `bun run check-types` successfully.
  - Please manually verify the animation feel in-browser and confirm whether the current toast-based celebration is strong enough before we consider the interaction fully settled.
- Completed the admin authz foundation in the main workspace:
  - Added persistent `role` / `status` fields on `user`, moderation metadata (`bannedAt`, `banReason`, `bannedByUserId`), and reusable `requireAuth` / `requireActiveUser` / `requireAdmin` guard helpers with focused Bun tests.
  - Hydrated the full DB user in `authMiddleware`, enforced active-user checks across authenticated write routes, and added a protected `/admin/me` API plus a server-rendered `/admin` entry point.
  - Re-ran Bun tests and workspace typecheck successfully.
- Completed the admin user-ops slice:
  - Added `admin_action_log`, tested moderation patch building, and implemented `/admin/users`, `/admin/users/:id`, `/admin/users/:id/ban`, and `/admin/users/:id/unban`.
  - Built a searchable admin moderation console that loads users, shows badge/social detail, displays moderation history, and performs ban/unban actions with inline feedback.
  - Re-ran Bun tests, Biome lint checks on changed files, and workspace `bun run check-types` successfully.
- Completed the dynamic achievement admin stack:
  - Added `achievement_definition` plus validated `rule` JSON, converted the achievements engine to read DB-backed definitions, and moved the legacy hard-coded catalog into seed defaults instead of runtime source of truth.
  - Implemented `/admin/achievements` list/create/update/preview/sync-defaults/reconcile APIs and extended the `/admin` web surface with an achievement studio for CRUD, previewing against a selected user, and queueing reconcile jobs.
  - Ran focused Bun tests for rule parsing, moderation helpers, and achievement unlock evaluation; re-ran workspace `bun run check-types`; then applied the schema locally with `bun run db:push`.
- Current executor status: admin roles, moderation, dynamic achievements, migration/backfill hooks, and rollout checks are implemented and verified in the main workspace.
- In the Settings modal Friends section, adjusted the friends polling logic so the skeleton loader only appears on the very first load; subsequent 5-second refreshes now update lists in the background without flashing the skeleton.

- Fixed the `/users/me/friends` API to return enriched pending friend requests with `requester` / `addressee` user objects again (the route had been accidentally duplicated, so the simpler version without nested user data was shadowing the enriched one). This restores the Friends settings UI so "Request from" / "Request to" now show the other user's name/username instead of their raw id.

- Added support for cancelling outgoing friend requests: new `DELETE /users/me/friend-requests/:id` endpoint on the server (only the requester can cancel while pending), and a "Cancel" button next to each outgoing request in the Settings → Friends section that calls this endpoint and refreshes the list. This lets users withdraw a request they previously sent.

- Implemented a first "Shared with you" surface so friends can actually see items that were shared with them: the Friends section in Settings now also fetches `GET /users/me/shared-with-me` and renders a list of shared bookmarks/collections (showing what was shared, who shared it, and an Open button for bookmarks). This confirms that share-to-friend is wired correctly end-to-end, even though shared items are not yet integrated directly into the main Inbox list.

## Lessons

- Remember to align new motion with existing motion/react usage and respect `prefers-reduced-motion` when adding animations.
- For server-side pure helper tests that import DB-backed modules, provide valid dummy env values (`DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `CORS_ORIGIN`) so environment validation does not fail before the test code runs.
- For app-wide celebration UX, a small global watcher in `Providers` plus targeted `window.dispatchEvent(new CustomEvent("kura:refresh-badges"))` hooks on success paths gives immediate feedback without coupling unlock to a single screen like Settings.
- Motion runtime note: `motion/react` spring and inertia transitions only support two keyframes; if a badge or toast animation uses three-step keyframes (for example `scale: [start, overshoot, settle]`), switch that specific animation to a `tween` or split it into separate motion elements to avoid runtime crashes.
- When Elysia route guards return structured error payloads, export the payload interfaces from helper modules; otherwise TypeScript can leak anonymous helper types into exported router/app types and fail `check-types`.
- For route-level authz in TypeScript, returning a typed `GuardUser | GuardError` helper (`getActiveUser`, `getAdminUser`) avoids repeated non-null assertions and keeps Biome + TypeScript happy at the same time.
- For dynamic configuration that still needs safe bootstrapping, keep the runtime source of truth in the database but preserve a small code-level default seed list plus an idempotent sync helper so existing environments can migrate forward without a one-off manual step.
- When a test imports server modules that eventually touch env-backed packages, use the same dummy env bootstrap values consistently; it keeps focused Bun tests stable even as the engine grows.

- When adding or refactoring routes in `usersRouter`, watch for accidental duplicate definitions of the same path (like `/users/me/friends`) later in the chain, since the last definition silently wins and can change the response shape in ways that break existing web code.

