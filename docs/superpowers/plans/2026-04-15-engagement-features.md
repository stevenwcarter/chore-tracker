# Engagement Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three kid-engagement features: confetti on chore completion, admin-posted bonus/one-off chores, and auto-awarded achievement badges.

**Architecture:** Feature 4 is frontend-only (canvas-confetti). Feature 5 extends the `chores` table with two nullable columns and adds bonus-chore logic to existing svc/graphql/frontend layers. Feature 6 adds a new `user_badges` table and a `BadgeSvc` that runs after every approval. All three features are independent and can be implemented in sequence without conflicts.

**Tech Stack:** Rust/Axum + Diesel (SQLite) + Juniper GraphQL backend; React/TypeScript + Apollo Client frontend; `canvas-confetti` npm package.

---

## File Map

**New files:**
- `src/svc/badge.rs` — BadgeSvc with check_and_award and all badge condition fns
- `site/src/hooks/useBonusChores.ts` — list and claim bonus chores
- `site/src/hooks/useUserBadges.ts` — fetch earned badges for a user
- `site/src/components/BonusChoreSection.tsx` — kid-facing bonus chore list
- `site/src/components/CreateBonusChoreForm.tsx` — admin form to post a bonus chore

**Modified files:**
- `src/models.rs` — add bonus_date/max_claims to Chore; add BadgeType enum + UserBadge struct
- `src/schema.rs` — regenerated after each migration (do not edit manually)
- `src/svc/mod.rs` — export BadgeSvc
- `src/svc/chore.rs` — add list_bonus_chores, can_claim_bonus
- `src/svc/chore_completion.rs` — guard create for bonus cap; call BadgeSvc::check_and_award in approve
- `src/graphql.rs` — add listBonusChores query, createBonusChore mutation, userBadges query
- `site/src/types/chore.ts` — extend Chore with bonusDate/maxClaims; add UserBadge
- `site/src/graphql/queries.ts` — add LIST_BONUS_CHORES, CREATE_BONUS_CHORE, GET_USER_BADGES
- `site/src/components/ChoreRow.tsx` — fire confetti after successful completion
- `site/src/components/WeeklyChoreView.tsx` — render BonusChoreSection and badge chips
- `site/src/components/AdminChoreManagement.tsx` — add bonus chore creation UI

---

## Feature 4 — Completion Celebration

### Task 1: Install canvas-confetti

**Files:**
- Modify: `site/package.json`

- [ ] **Step 1: Install the package**

```bash
cd site && yarn add canvas-confetti && yarn add --dev @types/canvas-confetti
```

Expected: package.json updated with `"canvas-confetti"` in dependencies and `"@types/canvas-confetti"` in devDependencies.

- [ ] **Step 2: Verify TypeScript can import it**

```bash
cd site && yarn tsc --noEmit 2>&1 | head -20
```

Expected: no errors related to canvas-confetti.

- [ ] **Step 3: Commit**

```bash
git add site/package.json site/yarn.lock
git commit -m "feat: add canvas-confetti dependency"
```

---

### Task 2: Fire confetti on chore completion

**Files:**
- Modify: `site/src/components/ChoreRow.tsx`

- [ ] **Step 1: Add the import and update the prop type**

At the top of `site/src/components/ChoreRow.tsx`, change the import block and the interface:

```tsx
import React from 'react';
import confetti from 'canvas-confetti';
import { WeeklyChoreData, ChoreCompletion, PaymentType } from '../types/chore';
import { formatCurrency, isSameDayAsString } from '../utils/dateUtils';
import clsx from 'clsx';

interface ChoreRowProps {
  choreData: WeeklyChoreData;
  dates: Date[];
  onCompleteChore: (choreId: number, date: Date) => Promise<void>;
  onSelectCompletion: (completion: ChoreCompletion) => void;
  isChoreCompletedByAnyone: (choreId: number, date: Date) => boolean;
  currentDate?: Date;
  isMobile?: boolean;
}
```

- [ ] **Step 2: Replace the completion button's onClick with an async handler**

Inside `renderChoreCell`, replace the `<button>` element's `onClick`:

Old code (around line 94–101 in `site/src/components/ChoreRow.tsx`):
```tsx
    return (
      <button
        onClick={() => onCompleteChore(choreData.chore.id, date)}
        disabled={isFutureDate}
        className={displayClasses}
        title="Mark as completed"
      >
        +
      </button>
    );
```

New code:
```tsx
    const handleComplete = async () => {
      await onCompleteChore(choreData.chore.id, date);
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
    };

    return (
      <button
        onClick={handleComplete}
        disabled={isFutureDate}
        className={displayClasses}
        title="Mark as completed"
      >
        +
      </button>
    );
```

- [ ] **Step 3: Fix the prop type in WeeklyChoreView.tsx**

`handleCompleteChore` in `site/src/components/WeeklyChoreView.tsx` is already `async` and returns `Promise<void>` — no change needed there. The TypeScript prop type update in ChoreRow is sufficient.

- [ ] **Step 4: Build to verify no type errors**

```bash
cd site && yarn tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add site/src/components/ChoreRow.tsx
git commit -m "feat: confetti animation on chore completion"
```

---

## Feature 5 — Bonus / One-Off Chores

### Task 3: Migration — add bonus columns to chores

**Files:**
- Create: `migrations/<timestamp>_add_bonus_chore_fields/up.sql`
- Create: `migrations/<timestamp>_add_bonus_chore_fields/down.sql`

- [ ] **Step 1: Generate the migration**

```bash
diesel migration generate add_bonus_chore_fields
```

Expected output: `Creating migrations/YYYY-MM-DD-HHMMSS_add_bonus_chore_fields/up.sql` and `down.sql`.

- [ ] **Step 2: Write up.sql**

```sql
ALTER TABLE chores ADD COLUMN bonus_date DATE;
ALTER TABLE chores ADD COLUMN max_claims INTEGER;
```

- [ ] **Step 3: Write down.sql**

```sql
ALTER TABLE chores DROP COLUMN bonus_date;
ALTER TABLE chores DROP COLUMN max_claims;
```

- [ ] **Step 4: Run and verify the migration**

```bash
diesel migration run
diesel migration revert
diesel migration run
```

Expected: no errors on either direction.

- [ ] **Step 5: Regenerate schema.rs**

```bash
diesel print-schema > src/schema.rs
```

Verify `src/schema.rs` now includes `bonus_date -> Nullable<Date>` and `max_claims -> Nullable<Integer>` in the `chores` table block.

- [ ] **Step 6: Commit**

```bash
git add migrations/ src/schema.rs
git commit -m "feat: add bonus_date and max_claims columns to chores"
```

---

### Task 4: Update Chore model for bonus fields

**Files:**
- Modify: `src/models.rs`

- [ ] **Step 1: Add fields to the Chore struct**

In `src/models.rs`, add two fields to the `Chore` struct (after `updated_at`):

```rust
pub struct Chore {
    pub id: Option<i32>,
    pub uuid: String,
    pub name: String,
    pub description: Option<String>,
    pub payment_type: String,
    pub amount_cents: i32,
    pub required_days: i32,
    pub active: bool,
    pub created_by_admin_id: i32,
    pub created_at: Option<NaiveDateTime>,
    pub updated_at: Option<NaiveDateTime>,
    pub bonus_date: Option<NaiveDate>,
    pub max_claims: Option<i32>,
}
```

- [ ] **Step 2: Add GraphQL fields to the Chore graphql_object impl**

After the `updated_at` field resolver in `#[juniper::graphql_object(context = GraphQLContext)] impl Chore`, add:

```rust
    pub fn bonus_date(&self) -> Option<NaiveDate> {
        self.bonus_date
    }
    pub fn max_claims(&self) -> Option<i32> {
        self.max_claims
    }
```

- [ ] **Step 3: Add fields to ChoreInput**

In the `ChoreInput` struct, add after `created_by_admin_id`:

```rust
#[derive(GraphQLInputObject, Debug, Clone)]
pub struct ChoreInput {
    pub uuid: Option<String>,
    pub name: String,
    pub description: Option<String>,
    pub payment_type: PaymentType,
    pub amount_cents: i32,
    pub required_days: i32,
    pub active: Option<bool>,
    pub created_by_admin_id: i32,
    pub bonus_date: Option<NaiveDate>,
    pub max_claims: Option<i32>,
}
```

- [ ] **Step 4: Update From<ChoreInput> for Chore**

In the `From<ChoreInput> for Chore` impl, add the two new fields:

```rust
impl From<ChoreInput> for Chore {
    fn from(input: ChoreInput) -> Self {
        Self {
            id: None,
            uuid: input.uuid.unwrap_or_else(|| Uuid::now_v7().to_string()),
            name: input.name,
            description: input.description,
            payment_type: input.payment_type.into(),
            amount_cents: input.amount_cents,
            required_days: input.required_days,
            active: input.active.unwrap_or(true),
            created_by_admin_id: input.created_by_admin_id,
            created_at: None,
            updated_at: None,
            bonus_date: input.bonus_date,
            max_claims: input.max_claims,
        }
    }
}
```

- [ ] **Step 5: Build to verify no compile errors**

```bash
cargo build 2>&1 | head -40
```

Expected: builds successfully.

- [ ] **Step 6: Commit**

```bash
git add src/models.rs
git commit -m "feat: add bonus_date and max_claims to Chore model"
```

---

### Task 5: Add bonus chore service methods

**Files:**
- Modify: `src/svc/chore.rs`

- [ ] **Step 1: Write a failing test for list_bonus_chores**

Add to the `#[cfg(test)] mod tests` block in `src/svc/chore.rs`:

```rust
    #[test]
    fn test_list_bonus_chores() {
        let context = create_test_context();
        let admin = create_test_admin(&context, "Admin", "admin@test.com");

        // Create a regular chore (should not appear)
        create_test_chore(&context, "Regular", PaymentType::Daily, 100, day_patterns::every_day(), admin.id.unwrap());

        // Create a bonus chore for today
        let today = chrono::Utc::now().date_naive();
        let bonus_input = ChoreInput {
            uuid: None,
            name: "Bonus Chore".to_owned(),
            description: None,
            payment_type: PaymentType::Daily,
            amount_cents: 200,
            required_days: 0,
            active: Some(true),
            created_by_admin_id: admin.id.unwrap(),
            bonus_date: Some(today),
            max_claims: Some(2),
        };
        let bonus = ChoreSvc::create(&context, &Chore::from(bonus_input)).unwrap();

        // Create a bonus chore for tomorrow (should not appear)
        let tomorrow = today + chrono::Duration::days(1);
        let other_bonus_input = ChoreInput {
            uuid: None,
            name: "Tomorrow Bonus".to_owned(),
            description: None,
            payment_type: PaymentType::Daily,
            amount_cents: 100,
            required_days: 0,
            active: Some(true),
            created_by_admin_id: admin.id.unwrap(),
            bonus_date: Some(tomorrow),
            max_claims: None,
        };
        ChoreSvc::create(&context, &Chore::from(other_bonus_input)).unwrap();

        let results = ChoreSvc::list_bonus_chores(&context, today).unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].uuid, bonus.uuid);
        assert_eq!(results[0].max_claims, Some(2));
    }

    #[test]
    fn test_can_claim_bonus() {
        use crate::models::ChoreCompletionInput;
        use crate::svc::ChoreCompletionSvc;

        let context = create_test_context();
        let admin = create_test_admin(&context, "Admin", "admin@test.com");
        let user1 = create_test_user(&context, "User 1");
        let user2 = create_test_user(&context, "User 2");

        let today = chrono::Utc::now().date_naive();
        let bonus_input = ChoreInput {
            uuid: None,
            name: "Limited Bonus".to_owned(),
            description: None,
            payment_type: PaymentType::Daily,
            amount_cents: 300,
            required_days: 0,
            active: Some(true),
            created_by_admin_id: admin.id.unwrap(),
            bonus_date: Some(today),
            max_claims: Some(1),
        };
        let bonus = ChoreSvc::create(&context, &Chore::from(bonus_input)).unwrap();

        // Should be claimable before any completions
        assert!(ChoreSvc::can_claim_bonus(&context, bonus.id.unwrap()).unwrap());

        // User1 claims it
        let completion_input = ChoreCompletionInput {
            uuid: None,
            chore_id: bonus.id.unwrap(),
            user_id: user1.id.unwrap(),
            completed_date: today,
        };
        ChoreCompletionSvc::create(&context, &completion_input).unwrap();

        // Should no longer be claimable
        assert!(!ChoreSvc::can_claim_bonus(&context, bonus.id.unwrap()).unwrap());
    }
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cargo test test_list_bonus_chores test_can_claim_bonus 2>&1 | tail -20
```

Expected: compile error — `list_bonus_chores` and `can_claim_bonus` don't exist yet.

- [ ] **Step 3: Add the imports and methods to ChoreSvc**

At the top of `src/svc/chore.rs`, add `chore_completions` to the existing schema import:

```rust
use crate::{
    context::GraphQLContext,
    db::get_conn,
    models::{Chore, ChoreAssignment},
    schema::{chore_assignments, chore_completions, chores, users},
};
use anyhow::{Context, Result};
use chrono::NaiveDate;
use diesel::prelude::*;
```

Add two new methods to `impl ChoreSvc`, after `assign_user`:

```rust
    /// Returns all active bonus chores for a specific date.
    pub fn list_bonus_chores(context: &GraphQLContext, date: NaiveDate) -> Result<Vec<Chore>> {
        chores::table
            .filter(chores::bonus_date.eq(Some(date)))
            .filter(chores::active.eq(true))
            .select(Chore::as_select())
            .order_by(chores::name.asc())
            .load::<Chore>(&mut get_conn(context)?)
            .context("Could not load bonus chores")
    }

    /// Returns true if a bonus chore can still be claimed (below max_claims cap).
    /// Always returns true for regular chores and uncapped bonus chores.
    pub fn can_claim_bonus(context: &GraphQLContext, chore_id: i32) -> Result<bool> {
        let chore = Self::get_by_id(context, chore_id)?;

        if chore.bonus_date.is_none() {
            return Ok(true); // Regular chore — no cap
        }

        let max_claims = match chore.max_claims {
            None => return Ok(true), // Bonus chore with no cap
            Some(m) => m,
        };

        let count: i64 = chore_completions::table
            .filter(chore_completions::chore_id.eq(chore_id))
            .count()
            .get_result(&mut get_conn(context)?)
            .context("Could not count bonus chore completions")?;

        Ok(count < max_claims as i64)
    }
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cargo test test_list_bonus_chores test_can_claim_bonus 2>&1 | tail -20
```

Expected: `test test_list_bonus_chores ... ok` and `test test_can_claim_bonus ... ok`.

- [ ] **Step 5: Commit**

```bash
git add src/svc/chore.rs
git commit -m "feat: add list_bonus_chores and can_claim_bonus to ChoreSvc"
```

---

### Task 6: Guard ChoreCompletionSvc::create for bonus cap

**Files:**
- Modify: `src/svc/chore_completion.rs`

- [ ] **Step 1: Write a failing test**

Add to the `#[cfg(test)] mod tests` block in `src/svc/chore_completion.rs`:

```rust
    #[test]
    fn test_bonus_chore_claim_cap_enforced() {
        use crate::models::ChoreInput;
        use crate::svc::ChoreSvc;

        let context = create_test_context();
        let admin = create_test_admin(&context, "Admin", "admin@test.com");
        let user1 = create_test_user(&context, "User 1");
        let user2 = create_test_user(&context, "User 2");

        let today = chrono::Utc::now().date_naive();

        use crate::models::{Chore, PaymentType};
        let bonus_input = ChoreInput {
            uuid: None,
            name: "Capped Bonus".to_owned(),
            description: None,
            payment_type: PaymentType::Daily,
            amount_cents: 500,
            required_days: 0,
            active: Some(true),
            created_by_admin_id: admin.id.unwrap(),
            bonus_date: Some(today),
            max_claims: Some(1),
        };
        let bonus = ChoreSvc::create(&context, &Chore::from(bonus_input)).unwrap();

        // First claim succeeds
        let first = ChoreCompletionSvc::create(&context, &ChoreCompletionInput {
            uuid: None,
            chore_id: bonus.id.unwrap(),
            user_id: user1.id.unwrap(),
            completed_date: today,
        });
        assert!(first.is_ok(), "First claim should succeed");

        // Second claim fails
        let second = ChoreCompletionSvc::create(&context, &ChoreCompletionInput {
            uuid: None,
            chore_id: bonus.id.unwrap(),
            user_id: user2.id.unwrap(),
            completed_date: today,
        });
        assert!(second.is_err(), "Second claim should fail — cap reached");
        assert!(
            second.unwrap_err().to_string().contains("maximum"),
            "Error message should mention maximum"
        );
    }
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cargo test test_bonus_chore_claim_cap_enforced 2>&1 | tail -10
```

Expected: `FAILED` — second claim succeeds when it should not.

- [ ] **Step 3: Add the cap guard to ChoreCompletionSvc::create**

In `src/svc/chore_completion.rs`, update the imports to include `ChoreSvc`:

```rust
use crate::{
    context::GraphQLContext,
    db::get_conn,
    models::{ChoreCompletion, ChoreCompletionInput, PaymentType, User},
    schema::{chore_completions, users},
    svc::ChoreSvc,
};
```

Inside `ChoreCompletionSvc::create`, add the cap check right after fetching the chore (after `let payment_type = PaymentType::from(chore.payment_type);`):

```rust
    pub fn create(
        context: &GraphQLContext,
        completion_input: &ChoreCompletionInput,
    ) -> Result<ChoreCompletion> {
        let chore = ChoreSvc::get_by_id(context, completion_input.chore_id)?;
        let payment_type = PaymentType::from(&chore.payment_type);

        // Enforce bonus chore claim cap
        if !ChoreSvc::can_claim_bonus(context, completion_input.chore_id)? {
            anyhow::bail!("This bonus chore has reached its maximum number of claims");
        }

        let calculated_amount = PaymentType::calculate_completion_amount(
            &payment_type,
            chore.amount_cents,
            chore.required_days,
        );
        // ... rest of the method unchanged
```

- [ ] **Step 4: Run all completion tests**

```bash
cargo test --lib svc::chore_completion 2>&1 | tail -20
```

Expected: all tests pass including `test_bonus_chore_claim_cap_enforced`.

- [ ] **Step 5: Commit**

```bash
git add src/svc/chore_completion.rs
git commit -m "feat: enforce bonus chore claim cap in ChoreCompletionSvc::create"
```

---

### Task 7: GraphQL resolvers for bonus chores

**Files:**
- Modify: `src/graphql.rs`

- [ ] **Step 1: Add listBonusChores query**

In `src/graphql.rs`, add the necessary import at the top:

```rust
use chrono::NaiveDate;
```

(If already present, skip.) Then inside `impl Query`, after `list_chores`:

```rust
    pub fn list_bonus_chores(
        context: &GraphQLContext,
        date: NaiveDate,
    ) -> FieldResult<Vec<Chore>> {
        graphql_translate_anyhow(ChoreSvc::list_bonus_chores(context, date))
    }
```

- [ ] **Step 2: Add createBonusChore mutation**

In `impl Mutation`, after `create_chore`:

```rust
    pub async fn create_bonus_chore(
        context: &GraphQLContext,
        chore: ChoreInput,
    ) -> FieldResult<Chore> {
        if chore.bonus_date.is_none() {
            return Err(FieldError::new(
                "bonus_date is required when creating a bonus chore",
                juniper::Value::null(),
            ));
        }
        graphql_translate_anyhow(ChoreSvc::create(context, &chore.into()))
    }
```

- [ ] **Step 3: Build to verify**

```bash
cargo build 2>&1 | head -20
```

Expected: builds successfully.

- [ ] **Step 4: Run all backend tests**

```bash
cargo test 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/graphql.rs
git commit -m "feat: add listBonusChores query and createBonusChore mutation"
```

---

### Task 8: Frontend types and GraphQL queries for bonus chores

**Files:**
- Modify: `site/src/types/chore.ts`
- Modify: `site/src/graphql/queries.ts`

- [ ] **Step 1: Extend the Chore interface in types/chore.ts**

In the `Chore` interface in `site/src/types/chore.ts`, add two optional fields after `assignedUsers`:

```typescript
export interface Chore {
  id: number;
  uuid: string;
  name: string;
  description?: string;
  amountCents: number;
  paymentType: PaymentType;
  requiredDays: number;
  active?: boolean;
  createdAt: string;
  createdByAdminId: number;
  assignedUsers?: User[];
  bonusDate?: string;   // YYYY-MM-DD, present only for bonus chores
  maxClaims?: number;
}
```

- [ ] **Step 2: Add LIST_BONUS_CHORES and CREATE_BONUS_CHORE to queries.ts**

At the end of `site/src/graphql/queries.ts`, append:

```typescript
export const LIST_BONUS_CHORES = gql`
  query ListBonusChores($date: LocalDate!) {
    listBonusChores(date: $date) {
      id
      uuid
      name
      description
      amountCents
      bonusDate
      maxClaims
    }
  }
`;

export const CREATE_BONUS_CHORE = gql`
  mutation CreateBonusChore($chore: ChoreInput!) {
    createBonusChore(chore: $chore) {
      id
      uuid
      name
      bonusDate
      maxClaims
    }
  }
`;
```

- [ ] **Step 3: Build to verify**

```bash
cd site && yarn tsc --noEmit
```

Expected: no type errors.

- [ ] **Step 4: Commit**

```bash
git add site/src/types/chore.ts site/src/graphql/queries.ts
git commit -m "feat: add bonus chore types and GraphQL queries to frontend"
```

---

### Task 9: useBonusChores hook

**Files:**
- Create: `site/src/hooks/useBonusChores.ts`

- [ ] **Step 1: Create the hook**

```typescript
import { useMutation, useQuery } from '@apollo/client';
import { toast } from 'react-toastify';
import { Chore } from 'types/chore';
import { LIST_BONUS_CHORES, CREATE_CHORE_COMPLETION } from 'graphql/queries';
import { formatDateForGraphQL } from 'utils/dateUtils';

export const useBonusChores = (userId: number) => {
  const today = formatDateForGraphQL(new Date());

  const { data, loading, error, refetch } = useQuery(LIST_BONUS_CHORES, {
    variables: { date: today },
    fetchPolicy: 'cache-and-network',
  });

  const [createChoreCompletion] = useMutation(CREATE_CHORE_COMPLETION, {
    onCompleted: () => refetch(),
    onError: (err) => toast.error(err.message || 'Sorry, that bonus chore has already been claimed!'),
  });

  const claimBonusChore = async (choreId: number): Promise<void> => {
    await createChoreCompletion({
      variables: {
        completion: {
          choreId,
          userId,
          completedDate: today,
        },
      },
    });
  };

  const bonusChores: Chore[] = data?.listBonusChores ?? [];

  return { bonusChores, loading, error, claimBonusChore, refetch };
};

export default useBonusChores;
```

- [ ] **Step 2: Build to verify**

```bash
cd site && yarn tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add site/src/hooks/useBonusChores.ts
git commit -m "feat: add useBonusChores hook"
```

---

### Task 10: BonusChoreSection component

**Files:**
- Create: `site/src/components/BonusChoreSection.tsx`
- Modify: `site/src/components/WeeklyChoreView.tsx`

- [ ] **Step 1: Create BonusChoreSection component**

```tsx
import React from 'react';
import confetti from 'canvas-confetti';
import { Chore, ChoreCompletion } from 'types/chore';
import { formatCurrency } from 'utils/dateUtils';
import useBonusChores from 'hooks/useBonusChores';

interface BonusChoreSectionProps {
  userId: number;
  allCompletions: ChoreCompletion[];
}

export const BonusChoreSection: React.FC<BonusChoreSectionProps> = ({
  userId,
  allCompletions,
}) => {
  const { bonusChores, loading, claimBonusChore } = useBonusChores(userId);

  if (loading || bonusChores.length === 0) return null;

  const hasUserClaimed = (choreId: number): boolean =>
    allCompletions.some((c) => c.choreId === choreId && c.userId === userId);

  const isCapReached = (chore: Chore): boolean => {
    if (chore.maxClaims == null) return false;
    const count = allCompletions.filter((c) => c.choreId === chore.id).length;
    return count >= chore.maxClaims;
  };

  const handleClaim = async (chore: Chore) => {
    await claimBonusChore(chore.id);
    confetti({ particleCount: 120, spread: 90, origin: { y: 0.5 } });
  };

  return (
    <div className="mt-6 p-4 bg-yellow-900 bg-opacity-40 border border-yellow-600 rounded-lg">
      <h3 className="text-lg font-bold text-yellow-300 mb-3">⭐ Bonus Chores Available Today!</h3>
      <div className="space-y-3">
        {bonusChores.map((chore) => {
          const claimed = hasUserClaimed(chore.id);
          const capReached = isCapReached(chore);
          const disabled = claimed || capReached;

          return (
            <div
              key={chore.id}
              className="flex items-center justify-between bg-gray-800 p-3 rounded-lg"
            >
              <div>
                <p className="font-medium text-white">{chore.name}</p>
                {chore.description && (
                  <p className="text-sm text-gray-300">{chore.description}</p>
                )}
                <p className="text-sm text-green-400 font-medium">
                  {formatCurrency(chore.amountCents)}
                </p>
              </div>
              <button
                onClick={() => handleClaim(chore)}
                disabled={disabled}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                  disabled
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    : 'bg-yellow-500 text-black hover:bg-yellow-400'
                }`}
              >
                {claimed ? 'Claimed! ✓' : capReached ? 'Already claimed' : 'Claim it!'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BonusChoreSection;
```

- [ ] **Step 2: Add BonusChoreSection to WeeklyChoreView**

In `site/src/components/WeeklyChoreView.tsx`, add the import near the top:

```tsx
import BonusChoreSection from './BonusChoreSection';
```

Then add the `<BonusChoreSection>` after the closing `</div>` of the chore display section (just before the Modal), passing the `allCompletionsData`:

```tsx
      <BonusChoreSection
        userId={user.id}
        allCompletions={allCompletionsData?.getAllWeeklyCompletions ?? []}
      />

      {/* Completion detail modal */}
      <Modal ...
```

- [ ] **Step 3: Build to verify**

```bash
cd site && yarn tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add site/src/components/BonusChoreSection.tsx site/src/components/WeeklyChoreView.tsx
git commit -m "feat: bonus chore section in weekly chore view"
```

---

### Task 11: Admin UI for creating bonus chores

**Files:**
- Create: `site/src/components/CreateBonusChoreForm.tsx`
- Modify: `site/src/components/AdminChoreManagement.tsx`

- [ ] **Step 1: Create CreateBonusChoreForm component**

```tsx
import React, { useState } from 'react';
import { useMutation } from '@apollo/client';
import { toast } from 'react-toastify';
import { CREATE_BONUS_CHORE } from 'graphql/queries';
import { PaymentType } from 'types/chore';

interface CreateBonusChoreFormProps {
  adminId: number;
  onSuccess: () => void;
  onCancel: () => void;
}

export const CreateBonusChoreForm: React.FC<CreateBonusChoreFormProps> = ({
  adminId,
  onSuccess,
  onCancel,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [amountCents, setAmountCents] = useState(100);
  const [bonusDate, setBonusDate] = useState(new Date().toISOString().split('T')[0]);
  const [maxClaims, setMaxClaims] = useState<string>('');

  const [createBonusChore, { loading }] = useMutation(CREATE_BONUS_CHORE, {
    onCompleted: () => {
      toast.success('Bonus chore posted!');
      onSuccess();
    },
    onError: (err) => toast.error(err.message || 'Failed to create bonus chore'),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    await createBonusChore({
      variables: {
        chore: {
          name: name.trim(),
          description: description.trim() || null,
          paymentType: PaymentType.Daily,
          amountCents,
          requiredDays: 0,
          active: true,
          createdByAdminId: adminId,
          bonusDate,
          maxClaims: maxClaims !== '' ? parseInt(maxClaims, 10) : null,
        },
      },
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">Chore Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Clean the garage"
          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">Description (optional)</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What needs to be done"
          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
        />
      </div>
      <div className="flex gap-4">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-300 mb-1">Amount ($)</label>
          <input
            type="number"
            value={(amountCents / 100).toFixed(2)}
            onChange={(e) => setAmountCents(Math.round(parseFloat(e.target.value) * 100))}
            min="0.01"
            step="0.25"
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
            required
          />
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-300 mb-1">Date</label>
          <input
            type="date"
            value={bonusDate}
            onChange={(e) => setBonusDate(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
            required
          />
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-300 mb-1">Max Claims (optional)</label>
          <input
            type="number"
            value={maxClaims}
            onChange={(e) => setMaxClaims(e.target.value)}
            placeholder="Unlimited"
            min="1"
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
          />
        </div>
      </div>
      <div className="flex gap-3 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading || !name.trim()}
          className="px-4 py-2 bg-yellow-500 text-black rounded-lg font-medium hover:bg-yellow-400 disabled:opacity-50"
        >
          {loading ? 'Posting...' : 'Post Bonus Chore'}
        </button>
      </div>
    </form>
  );
};

export default CreateBonusChoreForm;
```

- [ ] **Step 2: Add bonus chore section to AdminChoreManagement.tsx**

In `site/src/components/AdminChoreManagement.tsx`, add the import:

```tsx
import CreateBonusChoreForm from './CreateBonusChoreForm';
```

Add state after the existing state declarations:

```tsx
  const [isCreatingBonusChore, setIsCreatingBonusChore] = useState(false);
```

Add a "Post Bonus Chore" button and form somewhere visible in the admin UI — right before the existing chore list section. Find the block that renders the "Create Chore" button and add a sibling button:

```tsx
          <button
            onClick={() => setIsCreatingBonusChore(true)}
            className="px-4 py-2 bg-yellow-500 text-black rounded-lg font-medium hover:bg-yellow-400 transition-colors"
          >
            ⭐ Post Bonus Chore
          </button>
```

And add the form rendering after the existing `isCreatingChore` modal/form section:

```tsx
        {isCreatingBonusChore && (
          <div className="bg-gray-800 border border-yellow-600 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-bold text-yellow-300 mb-4">Post a Bonus Chore</h3>
            <CreateBonusChoreForm
              adminId={adminId}
              onSuccess={() => setIsCreatingBonusChore(false)}
              onCancel={() => setIsCreatingBonusChore(false)}
            />
          </div>
        )}
```

- [ ] **Step 3: Build to verify**

```bash
cd site && yarn tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add site/src/components/CreateBonusChoreForm.tsx site/src/components/AdminChoreManagement.tsx
git commit -m "feat: admin UI for creating bonus chores"
```

---

## Feature 6 — Achievement Badges

### Task 12: Migration — create user_badges table

**Files:**
- Create: `migrations/<timestamp>_create_user_badges/up.sql`
- Create: `migrations/<timestamp>_create_user_badges/down.sql`

- [ ] **Step 1: Generate the migration**

```bash
diesel migration generate create_user_badges
```

- [ ] **Step 2: Write up.sql**

```sql
CREATE TABLE user_badges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    badge_type TEXT NOT NULL,
    earned_at TIMESTAMP NOT NULL,
    UNIQUE(user_id, badge_type)
);
```

- [ ] **Step 3: Write down.sql**

```sql
DROP TABLE user_badges;
```

- [ ] **Step 4: Run and verify the migration**

```bash
diesel migration run
diesel migration revert
diesel migration run
```

Expected: no errors.

- [ ] **Step 5: Regenerate schema.rs**

```bash
diesel print-schema > src/schema.rs
```

Verify `src/schema.rs` now contains a `user_badges` table block with `id, user_id, badge_type, earned_at` columns.

- [ ] **Step 6: Add user_badges to allow_tables_to_appear_in_same_query**

After running `diesel print-schema`, verify that `user_badges` appears in the `diesel::allow_tables_to_appear_in_same_query!` macro at the bottom of `src/schema.rs`. If it doesn't (Diesel CLI sometimes omits it), add it manually.

- [ ] **Step 7: Commit**

```bash
git add migrations/ src/schema.rs
git commit -m "feat: create user_badges migration"
```

---

### Task 13: UserBadge model and BadgeType enum

**Files:**
- Modify: `src/models.rs`

- [ ] **Step 1: Add BadgeType enum with conversions**

In `src/models.rs`, after the `AuthorType` enum and its `From` impls, add:

```rust
#[derive(Debug, Clone, PartialEq, Eq, GraphQLEnum)]
pub enum BadgeType {
    FirstChore,
    TenDollarsEarned,
    FiftyDollarsEarned,
    PerfectWeek,
    FiveDayStreak,
}

impl<T: AsRef<str>> From<T> for BadgeType {
    fn from(value: T) -> Self {
        match value.as_ref() {
            "ten_dollars_earned" => Self::TenDollarsEarned,
            "fifty_dollars_earned" => Self::FiftyDollarsEarned,
            "perfect_week" => Self::PerfectWeek,
            "five_day_streak" => Self::FiveDayStreak,
            _ => Self::FirstChore,
        }
    }
}

impl From<BadgeType> for String {
    fn from(bt: BadgeType) -> Self {
        match bt {
            BadgeType::FirstChore => "first_chore".to_owned(),
            BadgeType::TenDollarsEarned => "ten_dollars_earned".to_owned(),
            BadgeType::FiftyDollarsEarned => "fifty_dollars_earned".to_owned(),
            BadgeType::PerfectWeek => "perfect_week".to_owned(),
            BadgeType::FiveDayStreak => "five_day_streak".to_owned(),
        }
    }
}
```

- [ ] **Step 2: Add UserBadge struct**

After the `BadgeType` impls, add:

```rust
// UserBadge model
#[derive(Queryable, Debug, Clone, Identifiable, Insertable, Selectable)]
#[diesel(primary_key(id))]
#[diesel(table_name = user_badges)]
#[diesel(check_for_backend(diesel::sqlite::Sqlite))]
pub struct UserBadge {
    pub id: Option<i32>,
    pub user_id: i32,
    pub badge_type: String,
    pub earned_at: NaiveDateTime,
}

#[juniper::graphql_object(context = GraphQLContext)]
impl UserBadge {
    pub fn id(&self) -> Option<i32> {
        self.id
    }
    pub fn user_id(&self) -> i32 {
        self.user_id
    }
    pub fn badge_type(&self) -> BadgeType {
        BadgeType::from(&self.badge_type)
    }
    pub fn earned_at(&self) -> NaiveDateTime {
        self.earned_at
    }
}
```

- [ ] **Step 3: Add user_badges to the schema import in models.rs**

Near the top of `src/models.rs`, update the schema import to include `user_badges`:

```rust
use crate::{
    context::GraphQLContext,
    schema::*,
    svc::{ChoreCompletionNoteSvc, UserImageSvc},
};
```

The `schema::*` wildcard already pulls in `user_badges`, so no change needed here. Verify the build compiles.

- [ ] **Step 4: Build to verify**

```bash
cargo build 2>&1 | head -20
```

Expected: builds successfully.

- [ ] **Step 5: Commit**

```bash
git add src/models.rs
git commit -m "feat: add BadgeType enum and UserBadge model"
```

---

### Task 14: BadgeSvc — check and award badges

**Files:**
- Create: `src/svc/badge.rs`
- Modify: `src/svc/mod.rs`

- [ ] **Step 1: Write failing tests first**

Create `src/svc/badge.rs` with tests only:

```rust
use crate::{
    context::GraphQLContext,
    db::get_conn,
    models::{BadgeType, UserBadge},
    schema::{chore_assignments, chore_completions, chores, user_badges},
};
use anyhow::{Context, Result};
use chrono::Utc;
use diesel::prelude::*;

pub struct BadgeSvc {}

impl BadgeSvc {
    pub fn check_and_award(_context: &GraphQLContext, _user_id: i32) -> Result<()> {
        Ok(()) // Placeholder — will implement in Step 3
    }

    pub fn list_for_user(context: &GraphQLContext, user_id: i32) -> Result<Vec<UserBadge>> {
        user_badges::table
            .filter(user_badges::user_id.eq(user_id))
            .select(UserBadge::as_select())
            .order_by(user_badges::earned_at.asc())
            .load::<UserBadge>(&mut get_conn(context)?)
            .context("Could not load user badges")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        models::{ChoreCompletionInput, PaymentType},
        svc::{ChoreCompletionSvc, ChoreSvc},
        test_helpers::test_db::{
            create_test_admin, create_test_chore, create_test_chore_assignment,
            create_test_context, create_test_date, create_test_user, day_patterns,
        },
    };

    // These tests call BadgeSvc::check_and_award directly to verify badge logic.
    // The integration test for wiring through ChoreCompletionSvc::approve is in Task 15.

    #[test]
    fn test_first_chore_badge_awarded() {
        let context = create_test_context();
        let admin = create_test_admin(&context, "Admin", "admin@test.com");
        let user = create_test_user(&context, "Kid");

        let chore = create_test_chore(&context, "Dishes", PaymentType::Daily, 100, day_patterns::every_day(), admin.id.unwrap());
        create_test_chore_assignment(&context, chore.id.unwrap(), user.id.unwrap());

        let completion = ChoreCompletionSvc::create(&context, &ChoreCompletionInput {
            uuid: None,
            chore_id: chore.id.unwrap(),
            user_id: user.id.unwrap(),
            completed_date: create_test_date(2024, 10, 21),
        }).unwrap();
        ChoreCompletionSvc::approve(&context, &completion.uuid, admin.id.unwrap()).unwrap();

        // Explicitly call check_and_award — wiring into approve happens in Task 15
        BadgeSvc::check_and_award(&context, user.id.unwrap()).unwrap();

        let badges = BadgeSvc::list_for_user(&context, user.id.unwrap()).unwrap();
        let badge_types: Vec<String> = badges.iter().map(|b| b.badge_type.clone()).collect();
        assert!(badge_types.contains(&"first_chore".to_owned()), "first_chore badge should be awarded");
    }

    #[test]
    fn test_ten_dollars_badge_awarded() {
        let context = create_test_context();
        let admin = create_test_admin(&context, "Admin", "admin@test.com");
        let user = create_test_user(&context, "Kid");

        let chore = create_test_chore(&context, "Big Chore", PaymentType::Daily, 500, day_patterns::every_day(), admin.id.unwrap());
        create_test_chore_assignment(&context, chore.id.unwrap(), user.id.unwrap());

        for day in [21u32, 22] {
            let completion = ChoreCompletionSvc::create(&context, &ChoreCompletionInput {
                uuid: None,
                chore_id: chore.id.unwrap(),
                user_id: user.id.unwrap(),
                completed_date: create_test_date(2024, 10, day),
            }).unwrap();
            ChoreCompletionSvc::approve(&context, &completion.uuid, admin.id.unwrap()).unwrap();
        }

        BadgeSvc::check_and_award(&context, user.id.unwrap()).unwrap();

        let badges = BadgeSvc::list_for_user(&context, user.id.unwrap()).unwrap();
        let badge_types: Vec<String> = badges.iter().map(|b| b.badge_type.clone()).collect();
        assert!(badge_types.contains(&"ten_dollars_earned".to_owned()));
    }

    #[test]
    fn test_five_day_streak_badge_awarded() {
        let context = create_test_context();
        let admin = create_test_admin(&context, "Admin", "admin@test.com");
        let user = create_test_user(&context, "Kid");

        let chore = create_test_chore(&context, "Daily", PaymentType::Daily, 100, day_patterns::every_day(), admin.id.unwrap());
        create_test_chore_assignment(&context, chore.id.unwrap(), user.id.unwrap());

        for day in 21u32..=25 {
            let completion = ChoreCompletionSvc::create(&context, &ChoreCompletionInput {
                uuid: None,
                chore_id: chore.id.unwrap(),
                user_id: user.id.unwrap(),
                completed_date: create_test_date(2024, 10, day),
            }).unwrap();
            ChoreCompletionSvc::approve(&context, &completion.uuid, admin.id.unwrap()).unwrap();
        }

        BadgeSvc::check_and_award(&context, user.id.unwrap()).unwrap();

        let badges = BadgeSvc::list_for_user(&context, user.id.unwrap()).unwrap();
        let badge_types: Vec<String> = badges.iter().map(|b| b.badge_type.clone()).collect();
        assert!(badge_types.contains(&"five_day_streak".to_owned()));
    }

    #[test]
    fn test_badge_award_is_idempotent() {
        let context = create_test_context();
        let admin = create_test_admin(&context, "Admin", "admin@test.com");
        let user = create_test_user(&context, "Kid");

        let chore = create_test_chore(&context, "Chore", PaymentType::Daily, 100, day_patterns::every_day(), admin.id.unwrap());
        create_test_chore_assignment(&context, chore.id.unwrap(), user.id.unwrap());

        let completion = ChoreCompletionSvc::create(&context, &ChoreCompletionInput {
            uuid: None,
            chore_id: chore.id.unwrap(),
            user_id: user.id.unwrap(),
            completed_date: create_test_date(2024, 10, 21),
        }).unwrap();
        ChoreCompletionSvc::approve(&context, &completion.uuid, admin.id.unwrap()).unwrap();

        // Call check_and_award twice — should not fail or duplicate
        BadgeSvc::check_and_award(&context, user.id.unwrap()).unwrap();
        BadgeSvc::check_and_award(&context, user.id.unwrap()).unwrap();

        let badges = BadgeSvc::list_for_user(&context, user.id.unwrap()).unwrap();
        let first_chore_count = badges.iter().filter(|b| b.badge_type == "first_chore").count();
        assert_eq!(first_chore_count, 1, "Badge should only be awarded once");
    }
}
```

- [ ] **Step 2: Export from svc/mod.rs**

Add to `src/svc/mod.rs`:

```rust
pub mod badge;
pub use badge::BadgeSvc;
```

- [ ] **Step 3: Run failing tests**

```bash
cargo test --lib svc::badge 2>&1 | tail -20
```

Expected: `test_first_chore_badge_awarded`, `test_ten_dollars_badge_awarded`, and `test_five_day_streak_badge_awarded` fail (placeholder returns Ok without awarding). `test_badge_award_is_idempotent` passes.

- [ ] **Step 4: Implement check_and_award and helpers**

Replace the placeholder `check_and_award` in `src/svc/badge.rs` with the full implementation:

```rust
use crate::{
    context::GraphQLContext,
    db::get_conn,
    models::{BadgeType, UserBadge},
    schema::{chore_assignments, chore_completions, chores, user_badges},
};
use anyhow::{Context, Result};
use chrono::{NaiveDate, NaiveDateTime, Utc};
use diesel::prelude::*;

pub struct BadgeSvc {}

impl BadgeSvc {
    /// Checks all badge conditions for a user and inserts any newly-earned badges.
    /// Safe to call multiple times — uses INSERT OR IGNORE for idempotency.
    pub fn check_and_award(context: &GraphQLContext, user_id: i32) -> Result<()> {
        let badge_checks: Vec<(BadgeType, bool)> = vec![
            (BadgeType::FirstChore,        Self::check_first_chore(context, user_id).unwrap_or(false)),
            (BadgeType::TenDollarsEarned,  Self::check_earnings_threshold(context, user_id, 1000).unwrap_or(false)),
            (BadgeType::FiftyDollarsEarned, Self::check_earnings_threshold(context, user_id, 5000).unwrap_or(false)),
            (BadgeType::FiveDayStreak,     Self::check_five_day_streak(context, user_id).unwrap_or(false)),
            (BadgeType::PerfectWeek,       Self::check_perfect_week(context, user_id).unwrap_or(false)),
        ];

        let mut conn = get_conn(context)?;
        let now: NaiveDateTime = Utc::now().naive_utc();

        for (badge_type, earned) in badge_checks {
            if earned {
                let badge = UserBadge {
                    id: None,
                    user_id,
                    badge_type: String::from(badge_type),
                    earned_at: now,
                };
                diesel::insert_or_ignore_into(user_badges::table)
                    .values(&badge)
                    .execute(&mut conn)
                    .context("Could not insert badge")?;
            }
        }

        Ok(())
    }

    pub fn list_for_user(context: &GraphQLContext, user_id: i32) -> Result<Vec<UserBadge>> {
        user_badges::table
            .filter(user_badges::user_id.eq(user_id))
            .select(UserBadge::as_select())
            .order_by(user_badges::earned_at.asc())
            .load::<UserBadge>(&mut get_conn(context)?)
            .context("Could not load user badges")
    }

    fn check_first_chore(context: &GraphQLContext, user_id: i32) -> Result<bool> {
        let count: i64 = chore_completions::table
            .filter(chore_completions::user_id.eq(user_id))
            .filter(chore_completions::approved.eq(true))
            .count()
            .get_result(&mut get_conn(context)?)
            .context("Could not count approved completions")?;
        Ok(count >= 1)
    }

    fn check_earnings_threshold(context: &GraphQLContext, user_id: i32, threshold_cents: i64) -> Result<bool> {
        let total: Option<i64> = chore_completions::table
            .filter(chore_completions::user_id.eq(user_id))
            .filter(chore_completions::approved.eq(true))
            .select(diesel::dsl::sum(chore_completions::amount_cents))
            .first(&mut get_conn(context)?)
            .context("Could not sum earnings")?;
        Ok(total.unwrap_or(0) >= threshold_cents)
    }

    fn check_five_day_streak(context: &GraphQLContext, user_id: i32) -> Result<bool> {
        let dates: Vec<NaiveDate> = chore_completions::table
            .filter(chore_completions::user_id.eq(user_id))
            .filter(chore_completions::approved.eq(true))
            .select(chore_completions::completed_date)
            .distinct()
            .order_by(chore_completions::completed_date.asc())
            .load(&mut get_conn(context)?)
            .context("Could not load completion dates")?;

        if dates.len() < 5 {
            return Ok(false);
        }

        let mut streak = 1usize;
        for i in 1..dates.len() {
            if dates[i] == dates[i - 1] + chrono::Duration::days(1) {
                streak += 1;
                if streak >= 5 {
                    return Ok(true);
                }
            } else {
                streak = 1;
            }
        }
        Ok(false)
    }

    fn check_perfect_week(context: &GraphQLContext, user_id: i32) -> Result<bool> {
        // Get active regular chores assigned to this user (exclude bonus chores)
        let assigned: Vec<(i32, i32)> = chore_assignments::table
            .inner_join(chores::table)
            .filter(chore_assignments::user_id.eq(user_id))
            .filter(chores::active.eq(true))
            .filter(chores::required_days.gt(0))
            .filter(chores::bonus_date.is_null())
            .select((chores::id, chores::required_days))
            .load(&mut get_conn(context)?)
            .context("Could not load assigned chores")?;

        if assigned.is_empty() {
            return Ok(false);
        }

        // Load all approved completions as (chore_id, date) pairs
        let completions: Vec<(i32, NaiveDate)> = chore_completions::table
            .filter(chore_completions::user_id.eq(user_id))
            .filter(chore_completions::approved.eq(true))
            .select((chore_completions::chore_id, chore_completions::completed_date))
            .load(&mut get_conn(context)?)
            .context("Could not load approved completions")?;

        if completions.is_empty() {
            return Ok(false);
        }

        // Find unique week-start (Monday) dates
        let mut week_starts: std::collections::HashSet<NaiveDate> = std::collections::HashSet::new();
        for (_, date) in &completions {
            let days_from_mon = date.weekday().num_days_from_monday() as i64;
            week_starts.insert(*date - chrono::Duration::days(days_from_mon));
        }

        let completion_set: std::collections::HashSet<(i32, NaiveDate)> = completions.into_iter().collect();

        'week: for week_start in week_starts {
            for (chore_id, required_days) in &assigned {
                for day_offset in 0i64..7 {
                    let date = week_start + chrono::Duration::days(day_offset);
                    let day_bit = 1i32 << (date.weekday().num_days_from_monday() as i32);
                    if required_days & day_bit != 0 {
                        if !completion_set.contains(&(*chore_id, date)) {
                            continue 'week;
                        }
                    }
                }
            }
            return Ok(true); // All required days covered for this week
        }

        Ok(false)
    }
}
```

- [ ] **Step 5: Run badge tests**

```bash
cargo test --lib svc::badge 2>&1 | tail -20
```

Expected: all four tests pass.

- [ ] **Step 6: Run all tests**

```bash
cargo test 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/svc/badge.rs src/svc/mod.rs
git commit -m "feat: BadgeSvc with check_and_award for all badge conditions"
```

---

### Task 15: Wire badge check into approval + add GraphQL query

**Files:**
- Modify: `src/svc/chore_completion.rs`
- Modify: `src/graphql.rs`

- [ ] **Step 1: Call BadgeSvc::check_and_award after approval**

In `src/svc/chore_completion.rs`, add `BadgeSvc` to the imports:

```rust
use crate::{
    context::GraphQLContext,
    db::get_conn,
    models::{ChoreCompletion, ChoreCompletionInput, PaymentType, User},
    schema::{chore_completions, users},
    svc::{BadgeSvc, ChoreSvc},
};
use tracing::error;
```

Update `ChoreCompletionSvc::approve` to call `check_and_award` after the approval:

```rust
    pub fn approve(
        context: &GraphQLContext,
        completion_uuid: &str,
        admin_id: i32,
    ) -> Result<ChoreCompletion> {
        diesel::update(chore_completions::table)
            .filter(chore_completions::uuid.eq(completion_uuid))
            .set((
                chore_completions::approved.eq(true),
                chore_completions::approved_by_admin_id.eq(admin_id),
                chore_completions::approved_at.eq(Utc::now().naive_utc()),
            ))
            .execute(&mut get_conn(context)?)
            .context("Could not approve chore completion")?;

        let completion = Self::get(context, completion_uuid)?;

        // Award any newly-earned badges — non-fatal if it fails
        if let Err(e) = BadgeSvc::check_and_award(context, completion.user_id) {
            error!("Failed to check badges for user {}: {}", completion.user_id, e);
        }

        Ok(completion)
    }
```

- [ ] **Step 2: Add userBadges query to graphql.rs**

In `src/graphql.rs`, add to the imports at the top:

```rust
use crate::{
    context::GraphQLContext,
    models::{
        Admin, AdminInput, Chore, ChoreCompletion, ChoreCompletionInput, ChoreCompletionNote,
        ChoreCompletionNoteInput, ChoreInput, UnpaidTotal, User, UserBadge, UserInput,
    },
    svc::{
        AdminSvc, BadgeSvc, ChoreCompletionFixSvc, ChoreCompletionNoteSvc, ChoreCompletionSvc,
        ChoreSvc, UserSvc, chore_completion::ChoreCompletionFilter, user::UserBalance,
    },
};
```

Inside `impl Query`, after `list_chore_completion_notes`:

```rust
    // Badges
    pub fn user_badges(context: &GraphQLContext, user_id: i32) -> FieldResult<Vec<UserBadge>> {
        graphql_translate_anyhow(BadgeSvc::list_for_user(context, user_id))
    }
```

- [ ] **Step 3: Build and run all tests**

```bash
cargo build 2>&1 | head -20
cargo test 2>&1 | tail -15
```

Expected: builds and all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/svc/chore_completion.rs src/graphql.rs
git commit -m "feat: award badges on completion approval; add userBadges GraphQL query"
```

---

### Task 16: Frontend types, query, and useUserBadges hook

**Files:**
- Modify: `site/src/types/chore.ts`
- Modify: `site/src/graphql/queries.ts`
- Create: `site/src/hooks/useUserBadges.ts`

- [ ] **Step 1: Add UserBadge type to types/chore.ts**

Append to `site/src/types/chore.ts`:

```typescript
export interface UserBadge {
  id: number;
  userId: number;
  badgeType: string;  // 'first_chore' | 'ten_dollars_earned' | 'fifty_dollars_earned' | 'perfect_week' | 'five_day_streak'
  earnedAt: string;
}

export const BADGE_DISPLAY: Record<string, { emoji: string; label: string }> = {
  first_chore: { emoji: '🌟', label: 'First Chore!' },
  ten_dollars_earned: { emoji: '💰', label: 'Earned $10' },
  fifty_dollars_earned: { emoji: '🏆', label: 'Earned $50' },
  perfect_week: { emoji: '✨', label: 'Perfect Week' },
  five_day_streak: { emoji: '🔥', label: '5-Day Streak' },
};
```

- [ ] **Step 2: Add GET_USER_BADGES to queries.ts**

At the end of `site/src/graphql/queries.ts`:

```typescript
export const GET_USER_BADGES = gql`
  query GetUserBadges($userId: Int!) {
    userBadges(userId: $userId) {
      id
      userId
      badgeType
      earnedAt
    }
  }
`;
```

- [ ] **Step 3: Create useUserBadges hook**

```typescript
import { useQuery } from '@apollo/client';
import { UserBadge } from 'types/chore';
import { GET_USER_BADGES } from 'graphql/queries';

export const useUserBadges = (userId: number) => {
  const { data, loading, error } = useQuery(GET_USER_BADGES, {
    variables: { userId },
    fetchPolicy: 'cache-and-network',
  });

  const badges: UserBadge[] = data?.userBadges ?? [];

  return { badges, loading, error };
};

export default useUserBadges;
```

- [ ] **Step 4: Build to verify**

```bash
cd site && yarn tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add site/src/types/chore.ts site/src/graphql/queries.ts site/src/hooks/useUserBadges.ts
git commit -m "feat: UserBadge type, GET_USER_BADGES query, and useUserBadges hook"
```

---

### Task 17: Badge display in WeeklyChoreView

**Files:**
- Modify: `site/src/components/WeeklyChoreView.tsx`

- [ ] **Step 1: Import the hook and display constants**

At the top of `site/src/components/WeeklyChoreView.tsx`, add:

```tsx
import useUserBadges from 'hooks/useUserBadges';
import { BADGE_DISPLAY } from 'types/chore';
```

- [ ] **Step 2: Call the hook inside the component**

Inside `WeeklyChoreView`, after the existing hooks (after `useUserChores` and `useQuery` calls), add:

```tsx
  const { badges } = useUserBadges(user.id);
```

- [ ] **Step 3: Render badge chips in the header**

In the JSX header section (inside the `<div className="flex items-center gap-4 mb-4">` block), after the `<div>` containing `user.name + week range`, add a badge row:

```tsx
          <div>
            <h2 className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold text-white`}>
              {user.name}'s Chores
            </h2>
            {!isMobile && (
              <p className="text-gray-300">
                Week of {formatDateForDisplay(weekRange.start)} -{' '}
                {formatDateForDisplay(weekRange.end)}
              </p>
            )}
            {badges.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {badges.map((badge) => {
                  const display = BADGE_DISPLAY[badge.badgeType];
                  if (!display) return null;
                  return (
                    <span
                      key={badge.id}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-gray-700 border border-gray-500 rounded-full text-xs text-gray-200"
                      title={`Earned: ${new Date(badge.earnedAt).toLocaleDateString()}`}
                    >
                      {display.emoji} {display.label}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
```

- [ ] **Step 4: Build to verify**

```bash
cd site && yarn tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Run frontend tests**

```bash
cd site && yarn test --run
```

Expected: all tests pass.

- [ ] **Step 6: Run backend tests**

```bash
cargo test 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 7: Final commit**

```bash
git add site/src/components/WeeklyChoreView.tsx
git commit -m "feat: display earned achievement badges in weekly chore view"
```

---

## Done

All three features are now implemented. Manual testing checklist:

**Feature 4:**
- [ ] Select a user, mark a chore complete → confetti fires
- [ ] Re-click a completed chore (to view detail) → confetti does NOT fire

**Feature 5:**
- [ ] Log in as admin → Post Bonus Chore button is visible
- [ ] Create a bonus chore with max_claims=1 for today
- [ ] Select a kid → "Bonus Chores Available Today!" section appears
- [ ] Click "Claim it!" → confetti fires, button changes to "Claimed! ✓"
- [ ] Select a second kid → button shows "Already claimed" (cap reached)

**Feature 6:**
- [ ] Create and approve a kid's first-ever completion → 🌟 First Chore! badge appears
- [ ] Approve enough completions to reach $10 → 💰 Earned $10 badge appears
- [ ] Approve completions on 5 consecutive days → 🔥 5-Day Streak badge appears
