## Background and Motivation

- Implement a dedicated Trash view so users can see trashed bookmarks and restore or permanently delete them, instead of only soft-deleting from the main list.
- Apply Emil design engineering UI polish to the dashboard header so collection chips and route navigation feel crisp, touch-friendly, and free of layout shift.
- Introduce a storyboarded Interface Craft animation for the "new collection" interaction in the header so that tapping the plus icon smoothly transitions from collection chips + Trash tab to an inline collection-name input without layout jank.

## Key Challenges and Analysis

- Reuse the existing Elysia `/bookmarks/trash`, `/:id/restore`, and `/:id` endpoints from the web app.
- Integrate the Trash UI into the current Next.js App Router dashboard flow without breaking existing collection filtering.
- Keep the UI polished and accessible, applying Interface Craft (storyboarded motion) and Emil design engineering principles (no layout shift, good tap targets, reduced motion support).
- For the header specifically, refine chip and nav styles without regressing keyboard navigation, tap target sizing (44px+), or reduced-motion behavior for users who prefer minimal animation.
- The "new collection" flow should feel like a single, coherent transition: chips and Trash fade away first, then an inline input grows from right → left while the plus icon slides left to sit just to the left of the input, with cursor focus landing in the field and respecting `prefers-reduced-motion`.
- Need to reuse or adapt the existing `NewCollectionPopover` logic (submit, validation, error handling) while changing the visual presentation to an inline input inside the header pill, and ensure Escape/cancel returns cleanly to the default chips view.

## High-level Task Breakdown

- [ ] Add a Trash view in the dashboard app that lists trashed bookmarks.
- [ ] Wire restore and permanent delete actions to the server API, with optimistic UI and safe fallbacks.
- [ ] Add navigation affordance (e.g. header toggle) between the main inbox and Trash views.
- [ ] Optionally add an “Empty trash” bulk action using the purge endpoint.
- [x] Design and document an Emil-aligned UI polish plan for the header component (`Header`), with success criteria around layout stability, tap targets, motion, and focus states.
- [x] Design an Interface Craft storyboard and state machine for the "new collection" animation sequence in `Header`, including stage timings, config objects, and reduced-motion behavior, without touching implementation yet.

## Project Status Board

- [ ] Implement Trash bookmarks view (list trashed items, restore, delete).
- [ ] Apply Emil UI polish to `BookmarkList` interactions (reduced motion, hover/touch, dialog a11y).
- [ ] Apply Emil UI polish to the dashboard header (`Header`) including collection chips and Inbox/Trash nav.
- [ ] Plan and implement Interface Craft storyboarded animation for the header "new collection" interaction (Planner done; Executor implementing, pending verification).

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

## Executor's Feedback or Assistance Requests

- Implemented a Trash view (route `/dashboard/trash`) with list, restore, and permanent delete actions, plus header navigation between Inbox and Trash; awaiting your manual verification before marking the task complete.
- Applied initial Emil design engineering UI polish to `BookmarkList`: added `prefers-reduced-motion` support for row and duplicate dialog animations, limited hover effects to pointer devices, and improved the duplicate dialog/button accessibility.
- Implemented the storyboarded "new collection" header interaction: clicking the plus icon now fades/slides the collection chips and Trash tab out, then reveals an inline "Collection name" input that expands from right → left while the plus icon slides left to sit beside it; Escape cancels and restores the chips, Enter submits to `handleCreateCollection`. Please exercise this flow (including reduced-motion mode) and confirm it matches the desired feel before we mark the related task complete.

## Lessons

- Remember to align new motion with existing motion/react usage and respect `prefers-reduced-motion` when adding animations.

