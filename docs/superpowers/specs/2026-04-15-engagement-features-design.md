# Engagement Features Design

**Date:** 2026-04-15
**Features:** Completion Celebration, Bonus Chores, Achievement Badges

---

## Overview

Three features targeting kid engagement on the chore tracker. Kids select themselves via profile image (no login), so all engagement mechanics must be purely visual and frictionless — no accounts, no settings.

---

## Feature 4 — Completion Celebration Animation

### Scope
Frontend only. No backend changes required.

### Approach
Add the `canvas-confetti` npm package to `site/`. When a chore completion mutation succeeds, fire a confetti burst at the point of interaction.

### Implementation
- Install: `yarn add canvas-confetti` + `@types/canvas-confetti`
- In `ChoreRow.tsx`, after `onCompleteChore` resolves without error, call:
  ```ts
  confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } })
  ```
- The call goes in the success branch of `handleCompleteChore` — only fires on new completions, not when clicking an already-completed chore.
- No new components, no state changes.

### Error handling
If `canvas-confetti` fails to load (unlikely), the completion still succeeds — confetti is purely cosmetic.

---

## Feature 5 — Bonus / One-Off Chores

### Scope
Backend (migration + service + GraphQL) + Frontend (new UI sections in kid view and admin chore management).

### Data model
Extend the existing `chores` table with two nullable columns:

```sql
ALTER TABLE chores ADD COLUMN bonus_date DATE;
ALTER TABLE chores ADD COLUMN max_claims INTEGER;
```

- `bonus_date NOT NULL` → this is a bonus chore, active only on that specific date
- `bonus_date NULL` → regular chore (existing behavior unchanged)
- `max_claims NULL` → unlimited claims; `max_claims = 1` → only one kid can complete it

The existing `required_days` column is ignored for bonus chores (treated as 0). All existing completion, approval, and payout logic is reused unchanged.

### Backend

**Migration:** `diesel migration generate add_bonus_chore_fields`

**`src/models.rs`:**
- Add `bonus_date: Option<NaiveDate>` and `max_claims: Option<i32>` to `Chore` struct
- Add corresponding GraphQL fields and to `ChoreInput`

**`src/svc/chore.rs`:**
- `list_bonus_chores(date: NaiveDate)` — returns active chores where `bonus_date = date`
- `can_claim_bonus(chore_id, conn)` — checks completion count against `max_claims`; returns `Ok(true)` if claimable

**`src/graphql.rs`:**
- Query: `listBonusChores(date: NaiveDate!) -> Vec<Chore>`
- Mutation: `createBonusChore(input: ChoreInput!) -> Chore` (admin only)
- Guard `createChoreCompletion` to call `can_claim_bonus` before inserting if `bonus_date` is set; return a GraphQL error if the cap is reached

### Frontend

**`WeeklyChoreView.tsx`:** Below the weekly chore grid, add a "Bonus Chores" section querying `listBonusChores(today)`. Each bonus chore renders as a `ChoreCard`-style tile showing the name, amount, and a "Claim it!" button. On click, calls the existing `createChoreCompletion` mutation. If `max_claims = 1` and already claimed by anyone, the button is disabled with "Already claimed".

**`AdminChoreManagementPage.tsx`:** Add a "Create Bonus Chore" form (name, amount, date, optional max-claims) alongside the existing chore creation form. Bonus chores appear in a separate "Bonus Chores" tab/section in the chore list.

**`site/src/hooks/useBonusChores.ts`:** New hook wrapping `listBonusChores` query and `createBonusChore` mutation.

### Error handling
- Max claims exceeded → toast: "Sorry, that bonus chore was already claimed!"
- Admin creates bonus chore with past date → frontend date picker disables past dates

---

## Feature 6 — Achievement Badges

### Scope
Backend (migration + service + GraphQL) + Frontend (badge display in kid's chore view).

### Data model

```sql
CREATE TABLE user_badges (
    id INTEGER PRIMARY KEY NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id),
    badge_type TEXT NOT NULL,
    earned_at TIMESTAMP NOT NULL,
    UNIQUE(user_id, badge_type)
);
```

The `UNIQUE(user_id, badge_type)` constraint makes badge award idempotent — safe to re-check on every approval.

### Badge definitions

| Badge type (stored as string) | Condition |
|---|---|
| `first_chore` | First approved completion ever |
| `ten_dollars_earned` | Cumulative approved earnings ≥ $10 |
| `fifty_dollars_earned` | Cumulative approved earnings ≥ $50 |
| `perfect_week` | All assigned chores completed and approved in a single week |
| `five_day_streak` | Approved completions on 5 consecutive calendar days |

### Backend

**Migration:** `diesel migration generate create_user_badges`

**`src/models.rs`:**
- `UserBadge` struct: `id, user_id, badge_type: String, earned_at: NaiveDateTime`
- `BadgeType` GraphQL enum: `FirstChore`, `TenDollarsEarned`, `FiftyDollarsEarned`, `PerfectWeek`, `FiveDayStreak`

**`src/svc/badge.rs`** (new file):
- `check_and_award(context, user_id)` — runs all badge condition checks, inserts any newly-earned badges
- Each condition is a separate private fn for clarity and testability
- Called from `src/svc/chore_completion.rs` after a completion is approved (inside the approval mutation handler)

**`src/graphql.rs`:**
- Query: `userBadges(userId: Int!) -> Vec<UserBadge>`

### Frontend

**`WeeklyChoreView.tsx`:** Below the user name/avatar in the header, add a horizontal scrollable row of badge chips. Each chip shows an emoji icon + label. Badges are fetched via a new `useUserBadges(userId)` hook. Unearned badges are not shown (earned-only display).

**`site/src/hooks/useUserBadges.ts`:** New hook wrapping `userBadges` query, polling disabled (fetched fresh on each user selection).

**Badge display mapping:**

| Badge type | Emoji | Label |
|---|---|---|
| `first_chore` | 🌟 | First Chore! |
| `ten_dollars_earned` | 💰 | Earned $10 |
| `fifty_dollars_earned` | 🏆 | Earned $50 |
| `perfect_week` | ✨ | Perfect Week |
| `five_day_streak` | 🔥 | 5-Day Streak |

### Error handling
- Badge check failure is non-fatal: log the error, do not block the approval mutation.
- `UNIQUE` constraint on `user_badges` prevents duplicate awards even if `check_and_award` is called multiple times.

---

## Testing

### Feature 4
- Unit: none needed (confetti is a side-effect with no logic)
- Manual: complete a chore, confirm confetti fires; re-click a completed chore, confirm it does not fire again

### Feature 5
- Backend unit tests: `can_claim_bonus` returns false when claim count ≥ max_claims
- Backend integration test: completing a capped bonus chore past the limit returns an error
- Manual: create bonus chore for today, complete it as a kid, verify it appears and is claimable; set max_claims=1, have first kid claim it, verify second kid sees "Already claimed"

### Feature 6
- Backend unit tests for each badge condition fn (use test_helpers db)
- Test idempotency: calling `check_and_award` twice does not duplicate badges
- Manual: approve a first completion, verify `first_chore` badge appears on kid's view
