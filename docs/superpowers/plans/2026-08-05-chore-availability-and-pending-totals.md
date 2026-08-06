# Chore Availability Windows, Assignee Filter & Pending Totals — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin filter Chore Management by assignee and mark chores as available only between a repeating month/day start and end (e.g. Sep 1 – Jun 15), and show each kid their pending unpaid earnings on the landing page.

**Architecture:** A chore's season is two nullable MMDD integers (`month * 100 + day`) on `chores`, wrapped in a new clippy-checked `src/availability.rs` module owning a `MonthDay` newtype and a wrap-aware `AvailabilityWindow::contains`. The kid's weekly grid blanks out-of-season cells and hides fully-out-of-season rows as an affordance; `ChoreCompletionSvc::create` is the actual enforcement. The assignee filter and the pending-totals readout are both client-side additions over data that is already (or newly) fetched.

**Tech Stack:** Rust 2024 / Axum / Diesel (SQLite) / Juniper GraphQL; React 19 + TypeScript + Apollo Client + Tailwind; vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-05-chore-availability-and-pending-totals-design.md`

## Global Constraints

- **Baselines on the clean tree at `3806c3c`:** clippy exactly **10** warnings; `cargo fmt --check` exactly **11** diffs; **77** Rust lib tests + 2 + 2 integration + 2 doctests; **93** frontend tests across **14** files. Every task must leave these at or above their starting point, with clippy and fmt counts **unchanged**.
- **Never run bare `cargo fmt`.** The 11 pre-existing diffs must not be swept into a commit. Run `rustfmt --edition 2024 <file>` on edited files only, then `git diff --stat` to confirm nothing unexpected moved.
- **Never pass `-D warnings`** to clippy. Add no new warnings; fix none of the baseline.
- The husky pre-commit hook runs `cd site && npx lint-staged && CI=true yarn test`. It runs the **frontend** suite only — it will not catch Rust breakage. Run `cargo test` yourself.
- `site/src/App.test.tsx` is known-flaky under CPU load and reproduces on an untouched tree. If **only** that file fails, re-run before concluding regression.
- **Locate every symbol with `grep -n`.** Line numbers in this plan may be stale.
- Frontend package manager is **yarn**, run from `site/`. Never npm.
- GraphQL naming: Rust `snake_case` auto-converts to `camelCase`. Booleans take no `is` prefix.
- New Rust domain code goes in `src/availability.rs`, **not** `src/models.rs` — that file is 1019 lines and carries a module-level `#![allow(clippy::all)]`, so new logic placed there would escape linting.

## Task dependency graph

```
Feature A:  T1 → T2 → T3 → T4
                  ↘  T5 → T6
                      T5 → T8 ← T7
                      T5 → T9
Feature B:  T10 → T11          (fully independent of A)
Wrap-up:    T12                (after all)
```

T5, T7, T10 have no prerequisites and can start any time. T1–T4 are a serial Rust chain.

---

### Task 1: Migration, schema, and the two `Chore` columns

**Files:**
- Create: `migrations/2026-08-05-<HHMMSS>-0000_add_chore_availability_window/up.sql`
- Create: `migrations/2026-08-05-<HHMMSS>-0000_add_chore_availability_window/down.sql`
- Modify: `src/schema.rs` (regenerated, do not hand-edit)
- Modify: `src/models.rs` — `Chore` struct, `ChoreInput`, `impl From<ChoreInput> for Chore`
- Modify: `src/test_helpers.rs` — `create_test_chore`'s `ChoreInput` literal
- Modify: `src/svc/chore.rs` — 8 `ChoreInput` literals, 1 `Chore` literal in `test_chore_crud_operations`
- Modify: `src/svc/chore_completion.rs` — 2 `ChoreInput` literals
- Test: `src/svc/chore.rs` (tests module at the bottom)

**Interfaces:**
- Consumes: nothing.
- Produces: `Chore.available_start: Option<i32>`, `Chore.available_end: Option<i32>`, `ChoreInput.available_start: Option<i32>`, `ChoreInput.available_end: Option<i32>`. Task 2 and 3 build on these field names.

- [ ] **Step 1: Generate the migration**

```bash
diesel migration generate add_chore_availability_window
```

Then write the two files (the generated directory name embeds a timestamp — use whatever diesel produced):

`up.sql`:
```sql
ALTER TABLE chores ADD COLUMN available_start INTEGER;
ALTER TABLE chores ADD COLUMN available_end INTEGER;
```

`down.sql`:
```sql
ALTER TABLE chores DROP COLUMN available_end;
ALTER TABLE chores DROP COLUMN available_start;
```

- [ ] **Step 2: Test the migration in both directions**

Run:
```bash
diesel migration run && diesel migration revert && diesel migration run
```
Expected: all three succeed with no error. This is required by CLAUDE.md — SQLite `DROP COLUMN` is version-sensitive and a broken `down.sql` is only discoverable this way.

- [ ] **Step 3: Regenerate the schema**

```bash
diesel print-schema > src/schema.rs
```

Confirm `chores` now ends with `available_start -> Nullable<Integer>,` and `available_end -> Nullable<Integer>,`. Do not edit this file by hand.

- [ ] **Step 4: Write the failing round-trip test**

Add to the `tests` module at the bottom of `src/svc/chore.rs`:

```rust
#[test]
fn test_chore_persists_availability_window_columns() {
    let context = create_test_context();
    let admin = create_test_admin(&context, "Test Admin", "admin@test.com");

    let input = ChoreInput {
        uuid: None,
        name: "School year chore".to_owned(),
        description: None,
        payment_type: PaymentType::Daily,
        amount_cents: 100,
        required_days: day_patterns::weekdays(),
        active: Some(true),
        created_by_admin_id: admin.id.unwrap(),
        bonus_date: None,
        max_claims: None,
        available_start: Some(901),
        available_end: Some(615),
    };
    let created = ChoreSvc::create(&context, &Chore::from(input)).unwrap();

    let reloaded = ChoreSvc::get(&context, &created.uuid).unwrap();
    assert_eq!(reloaded.available_start, Some(901));
    assert_eq!(reloaded.available_end, Some(615));
}

#[test]
fn test_chore_without_availability_window_stores_nulls() {
    let context = create_test_context();
    let admin = create_test_admin(&context, "Test Admin", "admin@test.com");

    let chore = create_test_chore(
        &context,
        "Year round chore",
        PaymentType::Daily,
        100,
        day_patterns::every_day(),
        admin.id.unwrap(),
    );

    let reloaded = ChoreSvc::get(&context, &chore.uuid).unwrap();
    assert_eq!(reloaded.available_start, None);
    assert_eq!(reloaded.available_end, None);
}
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `cargo test test_chore_persists_availability_window_columns`
Expected: FAIL to compile — `ChoreInput` has no field `available_start`.

- [ ] **Step 6: Add the fields to the model layer**

In `src/models.rs`, add to `struct Chore` after `max_claims`:

```rust
    /// Start of the chore's yearly availability window, MMDD-encoded
    /// (`month * 100 + day`), or `None` for a chore available year round.
    /// Always set together with `available_end`; see `crate::availability`.
    pub available_start: Option<i32>,
    /// End of the yearly availability window, MMDD-encoded and inclusive. When
    /// `available_end < available_start` the window wraps the new year, which is
    /// the normal case for a school-year chore (Sep 1 - Jun 15).
    pub available_end: Option<i32>,
```

Add the same two fields (without the doc comments) to `struct ChoreInput`, and to `impl From<ChoreInput> for Chore`:

```rust
            available_start: input.available_start,
            available_end: input.available_end,
```

- [ ] **Step 7: Update every existing struct literal**

`grep -rn "ChoreInput {" src/` reports 12 hits; one (`src/models.rs`) is the definition. Add `available_start: None, available_end: None,` to the other **11**: 1 in `src/test_helpers.rs`, 8 in `src/svc/chore.rs`, 2 in `src/svc/chore_completion.rs`.

Also `grep -n "let updated_chore = Chore {" src/svc/chore.rs` — that literal constructs a `Chore` directly and needs the same two fields.

- [ ] **Step 8: Run the tests to verify they pass**

Run: `cargo test`
Expected: PASS, **79** lib tests (77 baseline + 2 new).

- [ ] **Step 9: Verify lint and format baselines**

```bash
cargo clippy --all-targets 2>&1 | grep -c '^warning'   # expect 10
cargo fmt --check 2>&1 | grep -c '^Diff'                # expect 11
rustfmt --edition 2024 src/models.rs src/test_helpers.rs src/svc/chore.rs src/svc/chore_completion.rs
git diff --stat
```

- [ ] **Step 10: Commit**

```bash
git add migrations src/schema.rs src/models.rs src/test_helpers.rs src/svc/chore.rs src/svc/chore_completion.rs
git commit -m "feat(chore): add nullable availability window columns"
```

---

### Task 2: `MonthDay` and `AvailabilityWindow` domain types

**Files:**
- Create: `src/availability.rs`
- Modify: `src/lib.rs` — register the module
- Test: `src/availability.rs` (inline `#[cfg(test)] mod tests`)

**Interfaces:**
- Consumes: nothing (pure module; does not touch Diesel).
- Produces:
  - `MonthDay::new(month: u32, day: u32) -> anyhow::Result<MonthDay>`
  - `MonthDay::from_mmdd(mmdd: i32) -> anyhow::Result<MonthDay>`
  - `MonthDay::from_date(date: NaiveDate) -> MonthDay`
  - `MonthDay::month(self) -> i32`, `::day(self) -> i32`, `::as_mmdd(self) -> i32`
  - `AvailabilityWindow::new(start: MonthDay, end: MonthDay) -> AvailabilityWindow`
  - `AvailabilityWindow::from_columns(start: Option<i32>, end: Option<i32>) -> anyhow::Result<Option<AvailabilityWindow>>`
  - `AvailabilityWindow::contains(&self, date: NaiveDate) -> bool`
  - `AvailabilityWindow::start(&self) -> MonthDay`, `::end(&self) -> MonthDay`

  Tasks 3, 4 and the TS mirror in Task 5 all depend on these exact names.

- [ ] **Step 1: Register the module**

In `src/lib.rs`, add `pub mod availability;` to the module list (alphabetically, before `pub mod api;` is fine — the list is currently `api, auth, context, db, graphql, models, routes, schema, svc`).

- [ ] **Step 2: Write the failing tests**

Create `src/availability.rs` containing **only** the test module for now:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use chrono::NaiveDate;

    fn date(year: i32, month: u32, day: u32) -> NaiveDate {
        NaiveDate::from_ymd_opt(year, month, day).expect("valid test date")
    }

    #[test]
    fn month_day_accepts_valid_dates() {
        assert_eq!(MonthDay::new(9, 1).unwrap().as_mmdd(), 901);
        assert_eq!(MonthDay::new(6, 15).unwrap().as_mmdd(), 615);
        assert_eq!(MonthDay::new(12, 31).unwrap().as_mmdd(), 1231);
        assert_eq!(MonthDay::new(1, 1).unwrap().as_mmdd(), 101);
    }

    #[test]
    fn month_day_accepts_feb_29() {
        // A window boundary is a month/day pair with no year, so Feb 29 is a
        // well-defined boundary even though it is not a date in every year.
        let feb29 = MonthDay::new(2, 29).unwrap();
        assert_eq!(feb29.as_mmdd(), 229);
    }

    #[test]
    fn month_day_rejects_out_of_range_values() {
        assert!(MonthDay::new(0, 15).is_err(), "month 0");
        assert!(MonthDay::new(13, 1).is_err(), "month 13");
        assert!(MonthDay::new(6, 0).is_err(), "day 0");
        assert!(MonthDay::new(2, 30).is_err(), "Feb 30");
        assert!(MonthDay::new(4, 31).is_err(), "Apr 31");
        assert!(MonthDay::new(1, 32).is_err(), "Jan 32");
    }

    #[test]
    fn month_day_accessors_decode_the_encoding() {
        let md = MonthDay::new(9, 1).unwrap();
        assert_eq!(md.month(), 9);
        assert_eq!(md.day(), 1);
    }

    #[test]
    fn month_day_from_mmdd_revalidates() {
        assert_eq!(MonthDay::from_mmdd(901).unwrap().as_mmdd(), 901);
        assert!(MonthDay::from_mmdd(1301).is_err(), "month 13");
        assert!(MonthDay::from_mmdd(230).is_err(), "Feb 30");
        assert!(MonthDay::from_mmdd(-5).is_err(), "negative");
    }

    #[test]
    fn month_day_from_date_drops_the_year() {
        assert_eq!(MonthDay::from_date(date(2026, 9, 1)).as_mmdd(), 901);
        assert_eq!(MonthDay::from_date(date(1999, 9, 1)).as_mmdd(), 901);
    }

    /// Non-wrapping window: a summer-only chore.
    #[test]
    fn contains_non_wrapping_window() {
        let w = AvailabilityWindow::new(MonthDay::new(6, 1).unwrap(), MonthDay::new(8, 31).unwrap());

        assert!(w.contains(date(2026, 7, 4)), "mid window");
        assert!(w.contains(date(2026, 6, 1)), "start is inclusive");
        assert!(w.contains(date(2026, 8, 31)), "end is inclusive");
        assert!(!w.contains(date(2026, 5, 31)), "day before start");
        assert!(!w.contains(date(2026, 9, 1)), "day after end");
        assert!(!w.contains(date(2026, 1, 15)), "far outside");
    }

    /// Wrapping window: the school year, Sep 1 - Jun 15.
    #[test]
    fn contains_wrapping_window() {
        let w = AvailabilityWindow::new(MonthDay::new(9, 1).unwrap(), MonthDay::new(6, 15).unwrap());

        assert!(w.contains(date(2026, 9, 1)), "start is inclusive");
        assert!(w.contains(date(2026, 10, 20)), "autumn");
        assert!(w.contains(date(2026, 12, 31)), "last day of the year");
        assert!(w.contains(date(2027, 1, 1)), "first day of the year");
        assert!(w.contains(date(2027, 3, 10)), "spring");
        assert!(w.contains(date(2027, 6, 15)), "end is inclusive");

        assert!(!w.contains(date(2027, 6, 16)), "day after end");
        assert!(!w.contains(date(2027, 7, 4)), "summer");
        assert!(!w.contains(date(2027, 8, 31)), "day before start");
    }

    #[test]
    fn contains_single_day_window() {
        let w = AvailabilityWindow::new(MonthDay::new(3, 14).unwrap(), MonthDay::new(3, 14).unwrap());

        assert!(w.contains(date(2026, 3, 14)));
        assert!(!w.contains(date(2026, 3, 13)));
        assert!(!w.contains(date(2026, 3, 15)));
    }

    #[test]
    fn from_columns_requires_both_or_neither() {
        assert!(AvailabilityWindow::from_columns(None, None).unwrap().is_none());

        let w = AvailabilityWindow::from_columns(Some(901), Some(615))
            .unwrap()
            .expect("both columns set yields a window");
        assert_eq!(w.start().as_mmdd(), 901);
        assert_eq!(w.end().as_mmdd(), 615);

        assert!(
            AvailabilityWindow::from_columns(Some(901), None).is_err(),
            "start without end"
        );
        assert!(
            AvailabilityWindow::from_columns(None, Some(615)).is_err(),
            "end without start"
        );
    }

    #[test]
    fn from_columns_rejects_invalid_encodings() {
        assert!(AvailabilityWindow::from_columns(Some(1301), Some(615)).is_err());
        assert!(AvailabilityWindow::from_columns(Some(901), Some(230)).is_err());
    }
}
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cargo test --lib availability`
Expected: FAIL to compile — `MonthDay` and `AvailabilityWindow` are not defined.

- [ ] **Step 4: Write the implementation**

Prepend to `src/availability.rs`, above the test module:

```rust
//! Yearly chore availability windows.
//!
//! A chore may be limited to part of the calendar year - a school-year chore runs
//! Sep 1 to Jun 15 and repeats every year. The window is stored as two nullable
//! MMDD integers on `chores` and is inclusive at both ends.
//!
//! The MMDD encoding (`month * 100 + day`) sorts in calendar order, which is what
//! reduces the "does this date fall in the window" question to a pair of integer
//! comparisons - including the wrap-the-new-year case.
//!
//! This logic is mirrored in `site/src/utils/availabilityWindow.ts`. The two test
//! tables are deliberately identical; change one and you must change the other.

use anyhow::{Result, bail};
use chrono::{Datelike, NaiveDate};

/// A day of the year with no year attached, encoded as `month * 100 + day`.
///
/// Sep 1 is `901`, Jun 15 is `615`, Dec 31 is `1231`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub struct MonthDay(i32);

impl MonthDay {
    /// Days in `month`, or 0 when `month` is out of range.
    ///
    /// February reports 29: a window boundary is a month/day pair with no year, so
    /// it has no leap year in which to be valid or invalid. Feb 29 as a boundary
    /// simply sorts after Feb 28 and before Mar 1, which is the behaviour we want
    /// in every year.
    const fn days_in_month(month: u32) -> u32 {
        match month {
            1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
            4 | 6 | 9 | 11 => 30,
            2 => 29,
            _ => 0,
        }
    }

    /// Builds a `MonthDay`, rejecting a month outside 1-12 or a day outside the
    /// range that month allows.
    pub fn new(month: u32, day: u32) -> Result<Self> {
        let max_day = Self::days_in_month(month);
        if max_day == 0 {
            bail!("Month must be between 1 and 12, got {month}");
        }
        if day == 0 || day > max_day {
            bail!("Day must be between 1 and {max_day} for month {month}, got {day}");
        }
        Ok(Self(i32::try_from(month * 100 + day).expect("month/day fits in i32")))
    }

    /// Decodes a stored MMDD column value, revalidating it.
    pub fn from_mmdd(mmdd: i32) -> Result<Self> {
        if mmdd < 0 {
            bail!("MMDD value must not be negative, got {mmdd}");
        }
        let month = u32::try_from(mmdd / 100).expect("checked non-negative");
        let day = u32::try_from(mmdd % 100).expect("checked non-negative");
        Self::new(month, day)
    }

    /// Drops the year from `date`.
    pub fn from_date(date: NaiveDate) -> Self {
        let month = i32::try_from(date.month()).expect("chrono month is 1-12");
        let day = i32::try_from(date.day()).expect("chrono day is 1-31");
        Self(month * 100 + day)
    }

    pub const fn month(self) -> i32 {
        self.0 / 100
    }

    pub const fn day(self) -> i32 {
        self.0 % 100
    }

    /// The MMDD encoding, for storage in the `available_start` / `available_end`
    /// columns.
    pub const fn as_mmdd(self) -> i32 {
        self.0
    }
}

/// An inclusive month/day range that repeats every year.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct AvailabilityWindow {
    start: MonthDay,
    end: MonthDay,
}

impl AvailabilityWindow {
    pub const fn new(start: MonthDay, end: MonthDay) -> Self {
        Self { start, end }
    }

    /// Reads a window from the two nullable columns.
    ///
    /// Both NULL means the chore is available year round. Exactly one set is a
    /// half-open window, which the domain does not allow, so it is an error rather
    /// than a silent default.
    pub fn from_columns(start: Option<i32>, end: Option<i32>) -> Result<Option<Self>> {
        match (start, end) {
            (None, None) => Ok(None),
            (Some(start), Some(end)) => Ok(Some(Self::new(
                MonthDay::from_mmdd(start)?,
                MonthDay::from_mmdd(end)?,
            ))),
            (Some(_), None) => bail!("Availability window has a start but no end"),
            (None, Some(_)) => bail!("Availability window has an end but no start"),
        }
    }

    pub const fn start(&self) -> MonthDay {
        self.start
    }

    pub const fn end(&self) -> MonthDay {
        self.end
    }

    /// Whether `date` falls inside the window, inclusive at both ends.
    ///
    /// When `start <= end` the window sits inside one calendar year. When
    /// `start > end` it wraps the new year - a Sep 1 to Jun 15 school year is in
    /// season in December and in March, but not in July.
    pub fn contains(&self, date: NaiveDate) -> bool {
        let day = MonthDay::from_date(date).as_mmdd();
        let (start, end) = (self.start.as_mmdd(), self.end.as_mmdd());
        if start <= end {
            start <= day && day <= end
        } else {
            day >= start || day <= end
        }
    }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cargo test --lib availability`
Expected: PASS, 10 tests.

- [ ] **Step 6: Verify baselines and format**

```bash
cargo test                                              # expect 89 lib tests (79 + 10)
cargo clippy --all-targets 2>&1 | grep -c '^warning'   # expect 10
rustfmt --edition 2024 src/availability.rs src/lib.rs
cargo fmt --check 2>&1 | grep -c '^Diff'                # expect 11
```

- [ ] **Step 7: Commit**

```bash
git add src/availability.rs src/lib.rs
git commit -m "feat(availability): add MonthDay and AvailabilityWindow domain types"
```

---

### Task 3: GraphQL surface for the availability window

**Files:**
- Modify: `src/models.rs` — new `AvailabilityWindowGql` object + `AvailabilityWindowInput`, `Chore` resolver, `ChoreInput` field, `From<ChoreInput> for Chore`
- Test: `src/svc/chore.rs` (tests module)

**Interfaces:**
- Consumes: `Chore.available_start` / `available_end` (Task 1); `MonthDay`, `AvailabilityWindow` (Task 2).
- Produces: GraphQL `Chore.availabilityWindow: AvailabilityWindow` and `ChoreInput.availabilityWindow: AvailabilityWindowInput`. Task 5 and 6 consume the wire shape `{ startMonth, startDay, endMonth, endDay }`.

- [ ] **Step 1: Write the failing test**

Add to the `tests` module in `src/svc/chore.rs`:

```rust
#[test]
fn test_chore_input_availability_window_maps_to_columns() {
    use crate::models::AvailabilityWindowInput;

    let input = ChoreInput {
        uuid: None,
        name: "Spelling test".to_owned(),
        description: None,
        payment_type: PaymentType::Daily,
        amount_cents: 100,
        required_days: day_patterns::weekdays(),
        active: Some(true),
        created_by_admin_id: 1,
        bonus_date: None,
        max_claims: None,
        availability_window: Some(AvailabilityWindowInput {
            start_month: 9,
            start_day: 1,
            end_month: 6,
            end_day: 15,
        }),
    };

    let chore = Chore::try_from(input).unwrap();
    assert_eq!(chore.available_start, Some(901));
    assert_eq!(chore.available_end, Some(615));
}

#[test]
fn test_chore_input_without_window_clears_the_columns() {
    let input = ChoreInput {
        uuid: None,
        name: "Make bed".to_owned(),
        description: None,
        payment_type: PaymentType::Daily,
        amount_cents: 100,
        required_days: day_patterns::every_day(),
        active: Some(true),
        created_by_admin_id: 1,
        bonus_date: None,
        max_claims: None,
        availability_window: None,
    };

    let chore = Chore::try_from(input).unwrap();
    assert_eq!(chore.available_start, None);
    assert_eq!(chore.available_end, None);
}

#[test]
fn test_chore_input_rejects_an_invalid_month_day() {
    use crate::models::AvailabilityWindowInput;

    let input = ChoreInput {
        uuid: None,
        name: "Impossible".to_owned(),
        description: None,
        payment_type: PaymentType::Daily,
        amount_cents: 100,
        required_days: 0,
        active: Some(true),
        created_by_admin_id: 1,
        bonus_date: None,
        max_claims: None,
        availability_window: Some(AvailabilityWindowInput {
            start_month: 2,
            start_day: 30,
            end_month: 6,
            end_day: 15,
        }),
    };

    assert!(Chore::try_from(input).is_err(), "Feb 30 is not a valid boundary");
}
```

**Note the `From` becomes `TryFrom`**, because an input can now carry an invalid month/day. That is the point — validation happens once, at the boundary.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cargo test --lib test_chore_input_availability`
Expected: FAIL to compile — no `AvailabilityWindowInput`, no `availability_window` field, no `TryFrom`.

- [ ] **Step 3: Replace the Task 1 `available_start`/`available_end` input fields with the object**

In `src/models.rs`, **remove** the two raw `available_start` / `available_end` fields from `ChoreInput` added in Task 1 Step 6 (they stay on `Chore`, the row struct — only the *input* switches to the structured object) and add:

```rust
/// GraphQL input for a chore's yearly availability window. Absent means the chore
/// is available year round; present means both ends are supplied.
#[derive(GraphQLInputObject, Debug, Clone, Copy)]
pub struct AvailabilityWindowInput {
    pub start_month: i32,
    pub start_day: i32,
    pub end_month: i32,
    pub end_day: i32,
}

impl AvailabilityWindowInput {
    /// Validates and converts to the pair of MMDD column values.
    fn to_columns(self) -> anyhow::Result<(i32, i32)> {
        let to_u32 = |v: i32, what: &str| {
            u32::try_from(v).map_err(|_| anyhow::anyhow!("{what} must not be negative, got {v}"))
        };
        let start = crate::availability::MonthDay::new(
            to_u32(self.start_month, "start month")?,
            to_u32(self.start_day, "start day")?,
        )?;
        let end = crate::availability::MonthDay::new(
            to_u32(self.end_month, "end month")?,
            to_u32(self.end_day, "end day")?,
        )?;
        Ok((start.as_mmdd(), end.as_mmdd()))
    }
}

/// GraphQL output object for a chore's availability window.
#[derive(GraphQLObject, Debug, Clone, Copy)]
#[graphql(name = "AvailabilityWindow")]
pub struct AvailabilityWindowGql {
    pub start_month: i32,
    pub start_day: i32,
    pub end_month: i32,
    pub end_day: i32,
}
```

Add to `ChoreInput`:
```rust
    pub availability_window: Option<AvailabilityWindowInput>,
```

- [ ] **Step 4: Convert `From<ChoreInput>` to `TryFrom<ChoreInput>`**

Replace the existing `impl From<ChoreInput> for Chore` with:

```rust
impl TryFrom<ChoreInput> for Chore {
    type Error = anyhow::Error;

    fn try_from(input: ChoreInput) -> anyhow::Result<Self> {
        let (available_start, available_end) = match input.availability_window {
            Some(window) => {
                let (start, end) = window.to_columns()?;
                (Some(start), Some(end))
            }
            None => (None, None),
        };

        Ok(Self {
            id: None,
            uuid: crate::uuid_or_generate(input.uuid),
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
            available_start,
            available_end,
        })
    }
}
```

- [ ] **Step 5: Add the `Chore` resolver**

In the `#[juniper::graphql_object(context = GraphQLContext)] impl Chore` block, after `max_claims()`:

```rust
    /// The chore's yearly availability window, or null when it is available year
    /// round. A window whose end sorts before its start wraps the new year.
    pub fn availability_window(&self) -> Option<AvailabilityWindowGql> {
        crate::availability::AvailabilityWindow::from_columns(
            self.available_start,
            self.available_end,
        )
        .ok()
        .flatten()
        .map(|w| AvailabilityWindowGql {
            start_month: w.start().month(),
            start_day: w.start().day(),
            end_month: w.end().month(),
            end_day: w.end().day(),
        })
    }
```

- [ ] **Step 6: Fix every `Chore::from(...)` call site**

`grep -rn "Chore::from(" src/` — each becomes `Chore::try_from(...)`. In `src/graphql.rs` the create and update mutations must propagate the error via the existing `graphql_translate_anyhow` path; in test modules `.unwrap()` is fine. Also update the 11 `ChoreInput` literals from Task 1: replace `available_start: None, available_end: None,` with `availability_window: None,`.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `cargo test`
Expected: PASS, **92** lib tests (89 + 3).

- [ ] **Step 8: Verify the GraphQL schema exposes the field**

```bash
cargo run &
sleep 5
curl -s localhost:7007/graphql -H 'content-type: application/json' \
  -d '{"query":"{ __type(name: \"Chore\") { fields { name } } }"}' | grep -o availabilityWindow
kill %1
```
Expected: prints `availabilityWindow`.

- [ ] **Step 9: Verify baselines, format, commit**

```bash
cargo clippy --all-targets 2>&1 | grep -c '^warning'   # expect 10
rustfmt --edition 2024 src/models.rs src/graphql.rs
cargo fmt --check 2>&1 | grep -c '^Diff'                # expect 11
git add src/models.rs src/graphql.rs src/svc src/test_helpers.rs
git commit -m "feat(graphql): expose chore availabilityWindow on Chore and ChoreInput"
```

---

### Task 4: Server-side enforcement in `ChoreCompletionSvc::create`

**Files:**
- Modify: `src/svc/chore_completion.rs` — new `ensure_within_availability_window` helper, called from `create`
- Test: `src/svc/chore_completion.rs` (tests module)

**Interfaces:**
- Consumes: `AvailabilityWindow::from_columns` / `contains` (Task 2); `Chore.available_start` / `available_end` (Task 1).
- Produces: nothing consumed by later tasks. This is the enforcement seam.

- [ ] **Step 1: Write the failing tests**

Add to the `tests` module in `src/svc/chore_completion.rs`. Find the existing helper imports at the top of that module and reuse them.

```rust
/// Creates a chore whose availability window runs Sep 1 - Jun 15 (a school year,
/// so the window wraps the new year).
fn create_school_year_chore(context: &GraphQLContext, admin_id: i32) -> Chore {
    let input = ChoreInput {
        uuid: None,
        name: "Study spelling".to_owned(),
        description: None,
        payment_type: PaymentType::Daily,
        amount_cents: 100,
        required_days: 0,
        active: Some(true),
        created_by_admin_id: admin_id,
        bonus_date: None,
        max_claims: None,
        availability_window: Some(crate::models::AvailabilityWindowInput {
            start_month: 9,
            start_day: 1,
            end_month: 6,
            end_day: 15,
        }),
    };
    ChoreSvc::create(context, &Chore::try_from(input).unwrap()).unwrap()
}

#[test]
fn create_rejects_a_completion_outside_the_availability_window() {
    let context = create_test_context();
    let admin = create_test_admin(&context, "Test Admin", "admin@test.com");
    let user = create_test_user(&context, "Test User");
    let chore = create_school_year_chore(&context, admin.id.unwrap());

    let result = ChoreCompletionSvc::create(
        &context,
        &ChoreCompletionInput {
            uuid: None,
            chore_id: chore.id.unwrap(),
            user_id: user.id.unwrap(),
            completed_date: NaiveDate::from_ymd_opt(2026, 7, 4).unwrap(), // summer
        },
    );

    assert!(result.is_err(), "July 4 is outside a Sep 1 - Jun 15 window");
}

#[test]
fn create_accepts_a_completion_inside_the_availability_window() {
    let context = create_test_context();
    let admin = create_test_admin(&context, "Test Admin", "admin@test.com");
    let user = create_test_user(&context, "Test User");
    let chore = create_school_year_chore(&context, admin.id.unwrap());

    let result = ChoreCompletionSvc::create(
        &context,
        &ChoreCompletionInput {
            uuid: None,
            chore_id: chore.id.unwrap(),
            user_id: user.id.unwrap(),
            completed_date: NaiveDate::from_ymd_opt(2026, 10, 20).unwrap(),
        },
    );

    assert!(result.is_ok(), "October 20 is inside a Sep 1 - Jun 15 window");
}

#[test]
fn create_accepts_completions_on_both_window_boundaries() {
    let context = create_test_context();
    let admin = create_test_admin(&context, "Test Admin", "admin@test.com");
    let user = create_test_user(&context, "Test User");
    let chore = create_school_year_chore(&context, admin.id.unwrap());

    for (label, day) in [
        ("start boundary", NaiveDate::from_ymd_opt(2026, 9, 1).unwrap()),
        ("end boundary", NaiveDate::from_ymd_opt(2027, 6, 15).unwrap()),
    ] {
        let result = ChoreCompletionSvc::create(
            &context,
            &ChoreCompletionInput {
                uuid: None,
                chore_id: chore.id.unwrap(),
                user_id: user.id.unwrap(),
                completed_date: day,
            },
        );
        assert!(result.is_ok(), "{label} must be inclusive");
    }
}

#[test]
fn create_accepts_any_date_for_a_chore_with_no_window() {
    let context = create_test_context();
    let admin = create_test_admin(&context, "Test Admin", "admin@test.com");
    let user = create_test_user(&context, "Test User");
    let chore = create_test_chore(
        &context,
        "Year round",
        PaymentType::Daily,
        100,
        day_patterns::every_day(),
        admin.id.unwrap(),
    );

    let result = ChoreCompletionSvc::create(
        &context,
        &ChoreCompletionInput {
            uuid: None,
            chore_id: chore.id.unwrap(),
            user_id: user.id.unwrap(),
            completed_date: NaiveDate::from_ymd_opt(2026, 7, 4).unwrap(),
        },
    );

    assert!(result.is_ok(), "a windowless chore is never out of season");
}

/// Pins the decision that a season never changes the weekly per-day rate: a week
/// cut short by the window pays less, it does not pay the same amount over fewer
/// days. A future proration change must break this test deliberately.
#[test]
fn weekly_rate_ignores_the_availability_window() {
    let context = create_test_context();
    let admin = create_test_admin(&context, "Test Admin", "admin@test.com");
    let user = create_test_user(&context, "Test User");

    let input = ChoreInput {
        uuid: None,
        name: "Weekly seasonal".to_owned(),
        description: None,
        payment_type: PaymentType::Weekly,
        amount_cents: 150,
        required_days: day_patterns::weekdays(), // 5 days -> 30 cents each
        active: Some(true),
        created_by_admin_id: admin.id.unwrap(),
        bonus_date: None,
        max_claims: None,
        availability_window: Some(crate::models::AvailabilityWindowInput {
            start_month: 9,
            start_day: 1,
            end_month: 6,
            end_day: 17, // window ends mid-week
        }),
    };
    let chore = ChoreSvc::create(&context, &Chore::try_from(input).unwrap()).unwrap();

    // Wednesday 2026-06-17 is the final in-season day of that week.
    let completion = ChoreCompletionSvc::create(
        &context,
        &ChoreCompletionInput {
            uuid: None,
            chore_id: chore.id.unwrap(),
            user_id: user.id.unwrap(),
            completed_date: NaiveDate::from_ymd_opt(2026, 6, 17).unwrap(),
        },
    )
    .unwrap();

    assert_eq!(
        completion.amount_cents, 30,
        "rate stays amount_cents / required-day-count regardless of the season"
    );
}
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cargo test --lib chore_completion`
Expected: FAIL — `create_rejects_a_completion_outside_the_availability_window` fails its assertion (the create currently succeeds).

- [ ] **Step 3: Write the guard**

In `src/svc/chore_completion.rs`, next to the existing `ensure_bonus_claim_allowed` free function:

```rust
/// Rejects a completion dated outside the chore's yearly availability window.
///
/// This is the enforcement point for seasonal chores. The weekly grid also hides
/// out-of-season days, but that is a UI affordance - correctness lives here, so a
/// future frontend change cannot silently remove the guarantee.
fn ensure_within_availability_window(chore: &Chore, completed_date: NaiveDate) -> Result<()> {
    let window =
        crate::availability::AvailabilityWindow::from_columns(chore.available_start, chore.available_end)?;

    match window {
        Some(window) if !window.contains(completed_date) => {
            anyhow::bail!(
                "'{}' is not available on {completed_date}; it runs {}/{} to {}/{}",
                chore.name,
                window.start().month(),
                window.start().day(),
                window.end().month(),
                window.end().day(),
            )
        }
        _ => Ok(()),
    }
}
```

Call it in `create`, immediately after the existing bonus check:

```rust
            ensure_bonus_claim_allowed(&chore, conn)?;
            ensure_within_availability_window(&chore, completion_input.completed_date)?;
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cargo test`
Expected: PASS, **97** lib tests (92 + 5).

- [ ] **Step 5: Verify baselines, format, commit**

```bash
cargo clippy --all-targets 2>&1 | grep -c '^warning'   # expect 10
rustfmt --edition 2024 src/svc/chore_completion.rs
cargo fmt --check 2>&1 | grep -c '^Diff'                # expect 11
git add src/svc/chore_completion.rs
git commit -m "feat(chore): reject completions outside a chore's availability window"
```

---

### Task 5: TypeScript availability-window utility

**Files:**
- Create: `site/src/utils/availabilityWindow.ts`
- Create: `site/src/utils/__tests__/availabilityWindow.test.ts`
- Modify: `site/src/types/chore.ts` — `AvailabilityWindow` interface, `Chore.availabilityWindow`, `ChoreInput.availabilityWindow`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `interface AvailabilityWindow { startMonth: number; startDay: number; endMonth: number; endDay: number }`
  - `isDateInWindow(window: AvailabilityWindow | null | undefined, date: Date): boolean`
  - `formatWindow(window: AvailabilityWindow): string`
  - `isWeekInWindow(window: AvailabilityWindow | null | undefined, dates: Date[]): boolean`

  Tasks 6, 8 and 9 consume these.

Check the existing `site/src/utils/__tests__/` directory name before creating; if utils tests live elsewhere, follow that convention (`ls site/src/utils`).

- [ ] **Step 1: Add the types**

In `site/src/types/chore.ts`:

```ts
/**
 * A chore's yearly availability window, inclusive at both ends. Month is 1-12 and
 * day is 1-31. When the end sorts before the start the window wraps the new year -
 * a Sep 1 to Jun 15 school-year chore is in season in December.
 *
 * Mirrors `AvailabilityWindow` in `src/availability.rs`.
 */
export interface AvailabilityWindow {
  startMonth: number;
  startDay: number;
  endMonth: number;
  endDay: number;
}
```

Add to `interface Chore`: `availabilityWindow?: AvailabilityWindow | null;`
Add to `interface ChoreInput`: `availabilityWindow?: AvailabilityWindow | null;`

- [ ] **Step 2: Write the failing tests**

Create `site/src/utils/__tests__/availabilityWindow.test.ts`. This is the **mirror of the Rust table in `src/availability.rs`** — the two must stay in lockstep.

```ts
import { describe, it, expect } from 'vitest';
import { isDateInWindow, formatWindow, isWeekInWindow } from '../availabilityWindow';
import type { AvailabilityWindow } from 'types/chore';

const window = (
  startMonth: number,
  startDay: number,
  endMonth: number,
  endDay: number,
): AvailabilityWindow => ({ startMonth, startDay, endMonth, endDay });

/** Local-time date, matching how the weekly grid builds its dates. */
const date = (year: number, month: number, day: number) => new Date(year, month - 1, day);

describe('isDateInWindow', () => {
  it('treats a missing window as always available', () => {
    expect(isDateInWindow(null, date(2026, 7, 4))).toBe(true);
    expect(isDateInWindow(undefined, date(2026, 7, 4))).toBe(true);
  });

  // Summer-only chore: the window sits inside one calendar year.
  describe('non-wrapping window (Jun 1 - Aug 31)', () => {
    const w = window(6, 1, 8, 31);

    it('includes a mid-window day', () => expect(isDateInWindow(w, date(2026, 7, 4))).toBe(true));
    it('includes the start day', () => expect(isDateInWindow(w, date(2026, 6, 1))).toBe(true));
    it('includes the end day', () => expect(isDateInWindow(w, date(2026, 8, 31))).toBe(true));
    it('excludes the day before', () => expect(isDateInWindow(w, date(2026, 5, 31))).toBe(false));
    it('excludes the day after', () => expect(isDateInWindow(w, date(2026, 9, 1))).toBe(false));
  });

  // School year: the window wraps the new year.
  describe('wrapping window (Sep 1 - Jun 15)', () => {
    const w = window(9, 1, 6, 15);

    it('includes the start day', () => expect(isDateInWindow(w, date(2026, 9, 1))).toBe(true));
    it('includes autumn', () => expect(isDateInWindow(w, date(2026, 10, 20))).toBe(true));
    it('includes Dec 31', () => expect(isDateInWindow(w, date(2026, 12, 31))).toBe(true));
    it('includes Jan 1', () => expect(isDateInWindow(w, date(2027, 1, 1))).toBe(true));
    it('includes spring', () => expect(isDateInWindow(w, date(2027, 3, 10))).toBe(true));
    it('includes the end day', () => expect(isDateInWindow(w, date(2027, 6, 15))).toBe(true));
    it('excludes the day after the end', () =>
      expect(isDateInWindow(w, date(2027, 6, 16))).toBe(false));
    it('excludes summer', () => expect(isDateInWindow(w, date(2027, 7, 4))).toBe(false));
    it('excludes the day before the start', () =>
      expect(isDateInWindow(w, date(2027, 8, 31))).toBe(false));
  });

  describe('single-day window', () => {
    const w = window(3, 14, 3, 14);

    it('includes the day', () => expect(isDateInWindow(w, date(2026, 3, 14))).toBe(true));
    it('excludes the day before', () => expect(isDateInWindow(w, date(2026, 3, 13))).toBe(false));
    it('excludes the day after', () => expect(isDateInWindow(w, date(2026, 3, 15))).toBe(false));
  });
});

describe('isWeekInWindow', () => {
  const w = window(9, 1, 6, 15);
  const weekFrom = (year: number, month: number, day: number) =>
    Array.from({ length: 7 }, (_, i) => date(year, month, day + i));

  it('is true when every day of the week is in season', () => {
    expect(isWeekInWindow(w, weekFrom(2026, 10, 5))).toBe(true);
  });

  it('is true when only some days of the week are in season', () => {
    // Jun 14-20 2027 straddles the Jun 15 end boundary.
    expect(isWeekInWindow(w, weekFrom(2027, 6, 14))).toBe(true);
  });

  it('is false when the whole week is out of season', () => {
    expect(isWeekInWindow(w, weekFrom(2027, 7, 6))).toBe(false);
  });

  it('is true for a missing window', () => {
    expect(isWeekInWindow(null, weekFrom(2027, 7, 6))).toBe(true);
  });
});

describe('formatWindow', () => {
  it('renders a readable range', () => {
    expect(formatWindow(window(9, 1, 6, 15))).toBe('Sep 1 – Jun 15');
    expect(formatWindow(window(6, 1, 8, 31))).toBe('Jun 1 – Aug 31');
    expect(formatWindow(window(12, 25, 12, 25))).toBe('Dec 25 – Dec 25');
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run (from `site/`): `CI=true yarn test availabilityWindow`
Expected: FAIL — cannot resolve `../availabilityWindow`.

- [ ] **Step 4: Write the implementation**

Create `site/src/utils/availabilityWindow.ts`:

```ts
import type { AvailabilityWindow } from 'types/chore';

/**
 * Single source of truth for the chore availability-window encoding on the client.
 *
 * A window is an inclusive month/day range that repeats every year. Comparisons go
 * through an MMDD number (`month * 100 + day`), which sorts in calendar order and
 * so reduces the in-season question to a pair of integer comparisons - including
 * the wrap-the-new-year case.
 *
 * This mirrors `src/availability.rs` on the server. The two test tables are
 * deliberately identical; change one and you must change the other. The server is
 * the enforcement point (`ChoreCompletionSvc::create`); everything here is a UI
 * affordance.
 */

const MONTH_ABBREVIATIONS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

const toMmdd = (month: number, day: number): number => month * 100 + day;

/** True when `date` falls inside `window`, inclusive at both ends. A null or
 *  absent window means the chore is available year round. Uses local time, to
 *  match the dates the weekly grid builds. */
export function isDateInWindow(
  window: AvailabilityWindow | null | undefined,
  date: Date,
): boolean {
  if (!window) return true;

  const day = toMmdd(date.getMonth() + 1, date.getDate());
  const start = toMmdd(window.startMonth, window.startDay);
  const end = toMmdd(window.endMonth, window.endDay);

  return start <= end ? start <= day && day <= end : day >= start || day <= end;
}

/** True when at least one of `dates` is in season. The weekly grid uses this to
 *  decide whether a chore's row belongs in the displayed week at all. */
export function isWeekInWindow(
  window: AvailabilityWindow | null | undefined,
  dates: Date[],
): boolean {
  if (!window) return true;
  return dates.some((date) => isDateInWindow(window, date));
}

/** Renders a window as `Sep 1 – Jun 15` for display. */
export function formatWindow(window: AvailabilityWindow): string {
  const label = (month: number, day: number) => `${MONTH_ABBREVIATIONS[month - 1]} ${day}`;
  return `${label(window.startMonth, window.startDay)} – ${label(window.endMonth, window.endDay)}`;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run (from `site/`): `CI=true yarn test availabilityWindow`
Expected: PASS, 24 tests.

- [ ] **Step 6: Lint and commit**

```bash
cd site && yarn lint && CI=true yarn test && yarn build
cd .. && git add site/src/utils/availabilityWindow.ts site/src/utils/__tests__/availabilityWindow.test.ts site/src/types/chore.ts
git commit -m "feat(site): add availability-window utility mirroring the Rust domain type"
```

---

### Task 6: Gate the kid's weekly view by season

**Files:**
- Modify: `site/src/graphql/queries.ts` — `GET_USER_CHORES` and `GET_ALL_CHORES`
- Modify: `site/src/components/ChoreRow.tsx` — `renderChoreCell`
- Modify: `site/src/hooks/useUserChores.ts` — `weeklyChoreData` memo
- Test: `site/src/components/__tests__/ChoreRow.test.tsx` (create)
- Test: `site/src/hooks/__tests__/useUserChores.test.tsx` (create)

**Interfaces:**
- Consumes: `isDateInWindow`, `isWeekInWindow` (Task 5); `availabilityWindow` on the wire (Task 3).
- Produces: nothing consumed later.

- [ ] **Step 1: Add the field to both queries, and repair the existing mocks in the same step**

In `site/src/graphql/queries.ts`, add to the selection set of **both** `GET_USER_CHORES` and `GET_ALL_CHORES`:

```graphql
      availabilityWindow {
        startMonth
        startDay
        endMonth
        endDay
      }
```

**This widens a selection set that existing `MockedProvider` tests already mock.** A mock result missing a field the document requests yields incomplete data, so fix the fixtures in the same step rather than leaving the suite red for two tasks:

```bash
cd site && grep -rln "GET_ALL_CHORES\|GET_USER_CHORES" src --include=*.test.tsx --include=*.stories.tsx
```

Add `availabilityWindow: null` to every chore fixture those files feed into a `listChores` mock result — at minimum `WASH_DISHES` in `src/components/__tests__/AdminChoreManagement.test.tsx`. Run `CI=true yarn test` before moving on; the 93 baseline tests must still pass.

- [ ] **Step 2: Write the failing `ChoreRow` test**

Create `site/src/components/__tests__/ChoreRow.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ChoreRow from '../ChoreRow';
import { PaymentType, WeeklyChoreData } from 'types/chore';
import { WEEKDAY_BITS } from 'utils/weekdayBitmask';

const EVERY_DAY = Object.values(WEEKDAY_BITS).reduce((a, b) => a | b, 0);

const choreData = (availabilityWindow: unknown): WeeklyChoreData =>
  ({
    chore: {
      id: 1,
      uuid: 'chore-1',
      name: 'Study spelling',
      description: null,
      amountCents: 100,
      paymentType: PaymentType.Daily,
      requiredDays: EVERY_DAY,
      active: true,
      createdAt: '2026-01-01T00:00:00Z',
      createdByAdminId: 1,
      availabilityWindow,
    },
    completions: [],
  }) as unknown as WeeklyChoreData;

const renderRow = (data: WeeklyChoreData, day: Date) =>
  render(
    <table>
      <tbody>
        <ChoreRow
          choreData={data}
          dates={[day]}
          onCompleteChore={vi.fn()}
          onSelectCompletion={vi.fn()}
          isChoreCompletedByAnyone={() => false}
        />
      </tbody>
    </table>,
  );

const SCHOOL_YEAR = { startMonth: 9, startDay: 1, endMonth: 6, endDay: 15 };

describe('ChoreRow availability window', () => {
  it('renders a complete button on an in-season day', () => {
    renderRow(choreData(SCHOOL_YEAR), new Date(2026, 9, 20)); // Oct 20
    expect(screen.getByTitle('Mark as completed')).toBeInTheDocument();
  });

  it('renders no complete button on an out-of-season day', () => {
    renderRow(choreData(SCHOOL_YEAR), new Date(2026, 6, 4)); // Jul 4
    expect(screen.queryByTitle('Mark as completed')).not.toBeInTheDocument();
  });

  it('renders a complete button on the inclusive end boundary', () => {
    renderRow(choreData(SCHOOL_YEAR), new Date(2027, 5, 15)); // Jun 15
    expect(screen.getByTitle('Mark as completed')).toBeInTheDocument();
  });

  it('renders a complete button for a chore with no window', () => {
    renderRow(choreData(null), new Date(2026, 6, 4)); // Jul 4
    expect(screen.getByTitle('Mark as completed')).toBeInTheDocument();
  });
});
```

Note the dates use JS month indexing (`new Date(2026, 9, 20)` is October 20). Use a **past** date so the existing `isFutureDate` guard does not disable the button; if the suite runs after these dates, shift the years back.

- [ ] **Step 3: Run to verify it fails**

Run (from `site/`): `CI=true yarn test ChoreRow`
Expected: FAIL — "renders no complete button on an out-of-season day" finds a button.

- [ ] **Step 4: Gate the cell**

In `site/src/components/ChoreRow.tsx`, add the import:

```tsx
import { isDateInWindow } from '../utils/availabilityWindow';
```

and change the `isScheduled` line inside `renderChoreCell`:

```tsx
    // A day is offered only when the chore is scheduled for that weekday AND the
    // date falls inside the chore's yearly availability window. Out-of-season days
    // render exactly like unscheduled ones. The server enforces the same rule in
    // ChoreCompletionSvc::create - this is only the affordance.
    const isScheduled =
      isDayInBitmask(choreData.chore.requiredDays, date) &&
      isDateInWindow(choreData.chore.availabilityWindow, date);
```

- [ ] **Step 5: Run to verify it passes**

Run (from `site/`): `CI=true yarn test ChoreRow`
Expected: PASS, 4 tests.

- [ ] **Step 6: Write the failing `useUserChores` test**

Create `site/src/hooks/__tests__/useUserChores.test.tsx`, following the `MockedProvider` pattern in `site/src/hooks/__tests__/useBonusChores.test.tsx` (read it first for the exact harness shape):

```tsx
import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing/react';
import type { MockedResponse } from '@apollo/client/testing';
import { useUserChores } from '../useUserChores';
import { GET_USER_CHORES, GET_WEEKLY_CHORES } from 'graphql/queries';
import { PaymentType } from 'types/chore';
import { formatDateForGraphQL } from 'utils/dateUtils';

const SCHOOL_CHORE = {
  id: 1,
  uuid: 'chore-1',
  name: 'Study spelling',
  description: null,
  paymentType: PaymentType.Daily,
  amountCents: 100,
  requiredDays: 127,
  active: true,
  createdAt: '2026-01-01T00:00:00Z',
  availabilityWindow: { startMonth: 9, startDay: 1, endMonth: 6, endDay: 15 },
};

const YEAR_ROUND_CHORE = { ...SCHOOL_CHORE, id: 2, uuid: 'chore-2', name: 'Make bed', availabilityWindow: null };

const mocks = (weekStart: Date): MockedResponse[] => [
  {
    request: { query: GET_USER_CHORES, variables: { userId: 1 } },
    result: { data: { listChores: [SCHOOL_CHORE, YEAR_ROUND_CHORE] } },
  },
  {
    request: {
      query: GET_WEEKLY_CHORES,
      variables: { userId: 1, weekStartDate: formatDateForGraphQL(weekStart) },
    },
    result: { data: { getWeeklyChoreCompletions: [] } },
  },
];

const renderForWeek = (weekStart: Date) =>
  renderHook(() => useUserChores({ userId: 1, weekStartDate: weekStart }), {
    wrapper: ({ children }) => (
      <MockedProvider mocks={mocks(weekStart)}>{children}</MockedProvider>
    ),
  });

describe('useUserChores availability window', () => {
  it('keeps a seasonal chore during a fully in-season week', async () => {
    const { result } = renderForWeek(new Date(2026, 9, 4)); // week of Oct 4 2026
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.weeklyChoreData.map((d) => d.chore.name)).toEqual([
      'Study spelling',
      'Make bed',
    ]);
  });

  it('keeps a seasonal chore during a boundary week', async () => {
    const { result } = renderForWeek(new Date(2027, 5, 13)); // week containing Jun 15 2027
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.weeklyChoreData.map((d) => d.chore.name)).toContain('Study spelling');
  });

  it('drops a seasonal chore when the whole week is out of season', async () => {
    const { result } = renderForWeek(new Date(2027, 6, 5)); // week of Jul 5 2027
    await waitFor(() => expect(result.current.loading).toBe(false));

    const names = result.current.weeklyChoreData.map((d) => d.chore.name);
    expect(names).not.toContain('Study spelling');
    expect(names).toContain('Make bed');
  });
});
```

- [ ] **Step 7: Run to verify it fails**

Run (from `site/`): `CI=true yarn test useUserChores`
Expected: FAIL — the third test still finds "Study spelling".

- [ ] **Step 8: Filter the week**

In `site/src/hooks/useUserChores.ts`, add imports:

```ts
import { getWeekDateRange } from 'utils/dateUtils';
import { isWeekInWindow } from 'utils/availabilityWindow';
```

and inside the `weeklyChoreData` memo, filter before mapping:

```ts
    // A seasonal chore drops out of the grid entirely when no day of the displayed
    // week falls inside its availability window; on a boundary week it stays and
    // ChoreRow blanks the individual out-of-season days.
    const weekDates = getWeekDateRange(weekStartDate).dates;

    return userChoresData.listChores
      .filter((chore: Chore) => isWeekInWindow(chore.availabilityWindow, weekDates))
      .map((backendChore: Chore) => ({
        chore: { ...backendChore },
        completions: completionMap.get(backendChore.id) ?? [],
      }));
```

Add `weekStartDate` to the memo's dependency array.

- [ ] **Step 9: Run to verify it passes**

Run (from `site/`): `CI=true yarn test`
Expected: PASS. Total rises to **100** (93 + 4 ChoreRow + 3 useUserChores). If `App.test.tsx` alone fails, re-run.

- [ ] **Step 10: Lint, build, commit**

```bash
cd site && yarn lint && yarn build
cd .. && git add site/src/graphql/queries.ts site/src/components/ChoreRow.tsx site/src/hooks/useUserChores.ts site/src/components/__tests__/ChoreRow.test.tsx site/src/hooks/__tests__/useUserChores.test.tsx
git commit -m "feat(site): hide out-of-season chore days and fully out-of-season rows"
```

---

### Task 7: `UserImage` size prop and the `ChoreAssigneeFilter` component

**Files:**
- Modify: `site/src/components/UserImage.tsx`
- Create: `site/src/components/ChoreAssigneeFilter.tsx`
- Test: `site/src/components/__tests__/ChoreAssigneeFilter.test.tsx` (create)

**Interfaces:**
- Consumes: `User` from `types/chore`.
- Produces:
  - `type AssigneeFilterValue = 'all' | 'unassigned' | number`
  - `<ChoreAssigneeFilter users={User[]} value={AssigneeFilterValue} onChange={(v: AssigneeFilterValue) => void} />`
  - `<UserImage user={user} size?: 'sm' | 'lg' />` — `'lg'` is the default and preserves the current 80px rendering.

  Task 8 consumes both.

- [ ] **Step 1: Write the failing tests**

Create `site/src/components/__tests__/ChoreAssigneeFilter.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import ChoreAssigneeFilter from '../ChoreAssigneeFilter';
import UserImage from '../UserImage';

const users = [
  { id: 1, uuid: 'u1', name: 'Alice', imagePath: undefined, createdAt: '2026-01-01T00:00:00Z' },
  { id: 2, uuid: 'u2', name: 'Bob', imagePath: '/images/bob.png', createdAt: '2026-01-01T00:00:00Z' },
];

describe('ChoreAssigneeFilter', () => {
  it('renders All, one chip per user, and Unassigned', () => {
    render(<ChoreAssigneeFilter users={users} value="all" onChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: /all/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /alice/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /bob/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /unassigned/i })).toBeInTheDocument();
  });

  it('reports the selected user id', async () => {
    const onChange = vi.fn();
    render(<ChoreAssigneeFilter users={users} value="all" onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: /bob/i }));
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it('reports the unassigned selection', async () => {
    const onChange = vi.fn();
    render(<ChoreAssigneeFilter users={users} value="all" onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: /unassigned/i }));
    expect(onChange).toHaveBeenCalledWith('unassigned');
  });

  it('marks only the selected chip as pressed', () => {
    render(<ChoreAssigneeFilter users={users} value={1} onChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: /alice/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /bob/i })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: /^all$/i })).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('UserImage size prop', () => {
  it('defaults to the existing large rendering', () => {
    const { container } = render(<UserImage user={users[0]} />);
    expect(container.firstChild).toHaveClass('w-20', 'h-20');
  });

  it('renders a small variant on request', () => {
    const { container } = render(<UserImage user={users[0]} size="sm" />);
    expect(container.firstChild).toHaveClass('w-12', 'h-12');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run (from `site/`): `CI=true yarn test ChoreAssigneeFilter`
Expected: FAIL — cannot resolve `../ChoreAssigneeFilter`.

- [ ] **Step 3: Add the `size` prop to `UserImage`**

Replace `site/src/components/UserImage.tsx`:

```tsx
import { User } from 'types/chore';

/** Avatar sizes. `lg` (80px) is the default so every pre-existing call site -
 *  UserSelector, UserManagementCard - renders exactly as before. */
const SIZE_CLASSES = {
  sm: { box: 'w-12 h-12', initial: 'text-lg' },
  lg: { box: 'w-20 h-20', initial: 'text-2xl' },
} as const;

interface UserImageProps {
  user: User;
  size?: keyof typeof SIZE_CLASSES;
}

export const UserImage = ({ user, size = 'lg' }: UserImageProps) => {
  const { box, initial } = SIZE_CLASSES[size];

  return (
    <div
      className={`cursor-pointer ${box} rounded-full overflow-hidden bg-linear-to-br from-blue-400 to-purple-500 flex items-center justify-center`}
    >
      {user.imagePath ? (
        <img src={user.imagePath} alt={user.name} className="w-full h-full object-cover" />
      ) : (
        <span className={`text-white ${initial} font-bold`}>
          {user.name.charAt(0).toUpperCase()}
        </span>
      )}
    </div>
  );
};

export default UserImage;
```

- [ ] **Step 4: Write `ChoreAssigneeFilter`**

Create `site/src/components/ChoreAssigneeFilter.tsx`:

```tsx
import React from 'react';
import { User } from 'types/chore';
import UserImage from './UserImage';

/** Which chores the Chore Management grid is showing: everything, the chores
 *  assigned to one user (by id), or the chores nobody is assigned to. */
export type AssigneeFilterValue = 'all' | 'unassigned' | number;

interface ChoreAssigneeFilterProps {
  users: User[];
  value: AssigneeFilterValue;
  onChange: (value: AssigneeFilterValue) => void;
}

const chipClasses = (selected: boolean) =>
  [
    'flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all',
    selected ? 'bg-gray-700 ring-4 ring-blue-500' : 'bg-gray-800 hover:bg-gray-700',
  ].join(' ');

export const ChoreAssigneeFilter: React.FC<ChoreAssigneeFilterProps> = ({
  users,
  value,
  onChange,
}) => (
  <div className="flex flex-wrap items-start gap-3" role="group" aria-label="Filter by assignee">
    <span className="self-center text-sm font-medium text-gray-300">Assignee:</span>

    <button
      type="button"
      onClick={() => onChange('all')}
      aria-pressed={value === 'all'}
      className={chipClasses(value === 'all')}
    >
      <span className="w-12 h-12 rounded-full bg-gray-600 flex items-center justify-center text-white text-xs font-bold">
        ALL
      </span>
      <span className="text-xs text-gray-300">All</span>
    </button>

    {users.map((user) => (
      <button
        key={user.id}
        type="button"
        onClick={() => onChange(user.id)}
        aria-pressed={value === user.id}
        className={chipClasses(value === user.id)}
      >
        <UserImage user={user} size="sm" />
        <span className="text-xs text-gray-300">{user.name}</span>
      </button>
    ))}

    <button
      type="button"
      onClick={() => onChange('unassigned')}
      aria-pressed={value === 'unassigned'}
      className={chipClasses(value === 'unassigned')}
    >
      <span className="w-12 h-12 rounded-full bg-gray-600 flex items-center justify-center text-white text-xl">
        —
      </span>
      <span className="text-xs text-gray-300">Unassigned</span>
    </button>
  </div>
);

export default ChoreAssigneeFilter;
```

- [ ] **Step 5: Run to verify it passes**

Run (from `site/`): `CI=true yarn test ChoreAssigneeFilter`
Expected: PASS, 6 tests.

- [ ] **Step 6: Confirm nothing regressed at existing `UserImage` call sites**

Run (from `site/`): `CI=true yarn test`
Expected: PASS. `UserSelector` and `UserManagementCard` render unchanged because `size` defaults to `'lg'`.

- [ ] **Step 7: Lint, build, commit**

```bash
cd site && yarn lint && yarn build
cd .. && git add site/src/components/UserImage.tsx site/src/components/ChoreAssigneeFilter.tsx site/src/components/__tests__/ChoreAssigneeFilter.test.tsx
git commit -m "feat(site): add ChoreAssigneeFilter chips and a UserImage size prop"
```

---

### Task 8: Wire the filter into Chore Management and show the window on `ChoreCard`

**Files:**
- Modify: `site/src/components/AdminChoreManagement.tsx`
- Modify: `site/src/components/ChoreCard.tsx`
- Test: `site/src/components/__tests__/AdminChoreManagement.test.tsx` (extend)

**Interfaces:**
- Consumes: `ChoreAssigneeFilter`, `AssigneeFilterValue` (Task 7); `formatWindow` (Task 5).
- Produces: nothing consumed later.

- [ ] **Step 1: Write the failing tests**

Append to `site/src/components/__tests__/AdminChoreManagement.test.tsx`. The existing fixtures define one chore (`WASH_DISHES`, assigned to Alice); add two more so filtering is observable. Read the top of that file first — reuse its `baseMocks()` helper and extend the fixture list rather than duplicating it.

```tsx
const READ_BOOK = {
  id: 11,
  uuid: 'chore-uuid-11',
  name: 'Read a book',
  description: null,
  amountCents: 100,
  paymentType: PaymentType.Daily,
  requiredDays: 0,
  active: true,
  createdAt: '2026-01-01T00:00:00Z',
  assignedUsers: [{ id: 2, uuid: 'user-uuid-2', name: 'Bob', imageId: null, imagePath: null }],
  availabilityWindow: null,
};

const SPELLING = {
  id: 12,
  uuid: 'chore-uuid-12',
  name: 'Study spelling',
  description: null,
  amountCents: 100,
  paymentType: PaymentType.Daily,
  requiredDays: 0,
  active: true,
  createdAt: '2026-01-01T00:00:00Z',
  assignedUsers: [],
  availabilityWindow: { startMonth: 9, startDay: 1, endMonth: 6, endDay: 15 },
};

describe('assignee filter', () => {
  const filterMocks = (): MockedResponse[] => [
    {
      request: { query: GET_ALL_CHORES },
      result: { data: { listChores: [WASH_DISHES, READ_BOOK, SPELLING] } },
    },
    { request: { query: GET_ALL_USERS }, result: { data: { listUsers: users } } },
  ];

  const renderScreen = () =>
    render(
      <MockedProvider mocks={filterMocks()}>
        <AdminChoreManagement adminId={1} />
      </MockedProvider>,
    );

  it('shows every chore by default', async () => {
    renderScreen();
    expect(await screen.findByText('Wash dishes')).toBeInTheDocument();
    expect(screen.getByText('Read a book')).toBeInTheDocument();
    expect(screen.getByText('Study spelling')).toBeInTheDocument();
  });

  it('narrows to one kid when their chip is clicked', async () => {
    renderScreen();
    await screen.findByText('Wash dishes');

    await userEvent.click(screen.getByRole('button', { name: /alice/i }));

    expect(screen.getByText('Wash dishes')).toBeInTheDocument();
    expect(screen.queryByText('Read a book')).not.toBeInTheDocument();
    expect(screen.queryByText('Study spelling')).not.toBeInTheDocument();
  });

  it('shows only unassigned chores for the Unassigned chip', async () => {
    renderScreen();
    await screen.findByText('Wash dishes');

    await userEvent.click(screen.getByRole('button', { name: /unassigned/i }));

    expect(screen.getByText('Study spelling')).toBeInTheDocument();
    expect(screen.queryByText('Wash dishes')).not.toBeInTheDocument();
  });

  it('restores the full list via All', async () => {
    renderScreen();
    await screen.findByText('Wash dishes');

    await userEvent.click(screen.getByRole('button', { name: /^bob$/i }));
    expect(screen.queryByText('Wash dishes')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /^all$/i }));
    expect(screen.getByText('Wash dishes')).toBeInTheDocument();
    expect(screen.getByText('Read a book')).toBeInTheDocument();
  });

  it('renders an empty state when the filter matches nothing', async () => {
    render(
      <MockedProvider
        mocks={[
          { request: { query: GET_ALL_CHORES }, result: { data: { listChores: [WASH_DISHES] } } },
          { request: { query: GET_ALL_USERS }, result: { data: { listUsers: users } } },
        ]}
      >
        <AdminChoreManagement adminId={1} />
      </MockedProvider>,
    );
    await screen.findByText('Wash dishes');

    await userEvent.click(screen.getByRole('button', { name: /^bob$/i }));

    expect(screen.getByText(/no chores assigned to bob/i)).toBeInTheDocument();
  });
});

describe('ChoreCard availability window', () => {
  it('shows the window only for a seasonal chore', async () => {
    render(
      <MockedProvider
        mocks={[
          {
            request: { query: GET_ALL_CHORES },
            result: { data: { listChores: [WASH_DISHES, SPELLING] } },
          },
          { request: { query: GET_ALL_USERS }, result: { data: { listUsers: users } } },
        ]}
      >
        <AdminChoreManagement adminId={1} />
      </MockedProvider>,
    );
    await screen.findByText('Study spelling');

    expect(screen.getByText('Sep 1 – Jun 15')).toBeInTheDocument();
    expect(screen.getAllByText(/available:/i)).toHaveLength(1);
  });
});
```

`WASH_DISHES` should already carry `availabilityWindow: null` from Task 6 Step 1; confirm it does before writing these tests.

- [ ] **Step 2: Run to verify it fails**

Run (from `site/`): `CI=true yarn test AdminChoreManagement`
Expected: FAIL — no assignee chips render.

- [ ] **Step 3: Wire the filter into `AdminChoreManagement`**

Add imports:

```tsx
import { useMemo } from 'react';  // extend the existing React import
import ChoreAssigneeFilter, { AssigneeFilterValue } from './ChoreAssigneeFilter';
```

Add state next to the other `useState` calls:

```tsx
  const [assigneeFilter, setAssigneeFilter] = useState<AssigneeFilterValue>('all');
```

After the `useAdminChoreManagement()` destructure, derive the visible list:

```tsx
  // Filtering is client-side: the chore list and its assignments are already loaded
  // for the assignment modal, so there is nothing to refetch.
  const visibleChores = useMemo(() => {
    if (assigneeFilter === 'all') return chores;
    if (assigneeFilter === 'unassigned') {
      return chores.filter((chore) => (chore.assignedUsers?.length ?? 0) === 0);
    }
    return chores.filter((chore) =>
      chore.assignedUsers?.some((user) => user.id === assigneeFilter),
    );
  }, [chores, assigneeFilter]);

  const emptyStateMessage =
    assigneeFilter === 'unassigned'
      ? 'No unassigned chores.'
      : `No chores assigned to ${users.find((u) => u.id === assigneeFilter)?.name ?? 'this user'}.`;
```

Render the filter under `<AdminChoreToolbar .../>`:

```tsx
        <ChoreAssigneeFilter users={users} value={assigneeFilter} onChange={setAssigneeFilter} />
```

and replace the chore grid block with:

```tsx
      {visibleChores.length === 0 && assigneeFilter !== 'all' ? (
        <p className="text-gray-400">{emptyStateMessage}</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
          {visibleChores.map((chore) => (
            <ChoreCard
              key={chore.id}
              chore={chore}
              onManage={setSelectedChore}
              onEdit={setEditingChore}
            />
          ))}
        </div>
      )}
```

- [ ] **Step 4: Add the `Available:` row to `ChoreCard`**

Add the import:

```tsx
import { formatWindow } from '../utils/availabilityWindow';
```

and inside the `space-y-2 text-sm` block, after the Payment row:

```tsx
        {chore.availabilityWindow && (
          <div className="flex justify-between">
            <span className="text-gray-400">Available:</span>
            <span className="text-white">{formatWindow(chore.availabilityWindow)}</span>
          </div>
        )}
```

- [ ] **Step 5: Run to verify it passes**

Run (from `site/`): `CI=true yarn test`
Expected: PASS. Total **106** (100 + 6).

- [ ] **Step 6: Lint, build, commit**

```bash
cd site && yarn lint && yarn build
cd .. && git add site/src/components/AdminChoreManagement.tsx site/src/components/ChoreCard.tsx site/src/components/__tests__/AdminChoreManagement.test.tsx
git commit -m "feat(site): filter Chore Management by assignee and show the season on cards"
```

---

### Task 9: `MonthDayPicker` and the availability section on `CreateChoreForm`

**Files:**
- Create: `site/src/components/MonthDayPicker.tsx`
- Modify: `site/src/components/CreateChoreForm.tsx`
- Test: `site/src/components/__tests__/CreateChoreForm.test.tsx` (create)

**Interfaces:**
- Consumes: `AvailabilityWindow` type (Task 5).
- Produces: `<MonthDayPicker label={string} month={number} day={number} onChange={(month: number, day: number) => void} disabled?={boolean} />`.

- [ ] **Step 1: Write the failing tests**

Create `site/src/components/__tests__/CreateChoreForm.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import CreateChoreForm from '../CreateChoreForm';
import { PaymentType, Chore } from 'types/chore';

const users = [
  { id: 1, uuid: 'u1', name: 'Alice', imagePath: undefined, createdAt: '2026-01-01T00:00:00Z' },
];

const seasonalChore = {
  id: 1,
  uuid: 'chore-1',
  name: 'Study spelling',
  description: '',
  amountCents: 100,
  paymentType: PaymentType.Daily,
  requiredDays: 0,
  active: true,
  createdAt: '2026-01-01T00:00:00Z',
  createdByAdminId: 1,
  assignedUsers: [],
  availabilityWindow: { startMonth: 9, startDay: 1, endMonth: 6, endDay: 15 },
} as unknown as Chore;

describe('CreateChoreForm availability window', () => {
  it('sends a null window when the season checkbox is off', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<CreateChoreForm users={users} adminId={1} onSubmit={onSubmit} onCancel={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(/chore title/i), 'Make bed');
    await userEvent.click(screen.getByRole('button', { name: /create chore/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ availabilityWindow: null }),
      [],
    );
  });

  it('sends the window when the season checkbox is on', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<CreateChoreForm users={users} adminId={1} onSubmit={onSubmit} onCancel={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(/chore title/i), 'Study spelling');
    await userEvent.click(screen.getByLabelText(/only available part of the year/i));

    await userEvent.selectOptions(screen.getByLabelText(/available from month/i), '9');
    await userEvent.selectOptions(screen.getByLabelText(/available from day/i), '1');
    await userEvent.selectOptions(screen.getByLabelText(/available until month/i), '6');
    await userEvent.selectOptions(screen.getByLabelText(/available until day/i), '15');

    await userEvent.click(screen.getByRole('button', { name: /create chore/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        availabilityWindow: { startMonth: 9, startDay: 1, endMonth: 6, endDay: 15 },
      }),
      [],
    );
  });

  it('prefills both pickers when editing a seasonal chore', () => {
    render(
      <CreateChoreForm
        users={users}
        adminId={1}
        initialChore={seasonalChore}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(/only available part of the year/i)).toBeChecked();
    expect(screen.getByLabelText(/available from month/i)).toHaveValue('9');
    expect(screen.getByLabelText(/available from day/i)).toHaveValue('1');
    expect(screen.getByLabelText(/available until month/i)).toHaveValue('6');
    expect(screen.getByLabelText(/available until day/i)).toHaveValue('15');
  });

  it('limits February to 29 days', async () => {
    render(<CreateChoreForm users={users} adminId={1} onSubmit={vi.fn()} onCancel={vi.fn()} />);

    await userEvent.click(screen.getByLabelText(/only available part of the year/i));
    await userEvent.selectOptions(screen.getByLabelText(/available from month/i), '2');

    const dayOptions = within(screen.getByLabelText(/available from day/i)).getAllByRole('option');
    expect(dayOptions).toHaveLength(29);
  });
});
```

Add `within` to the `@testing-library/react` import.

- [ ] **Step 2: Run to verify it fails**

Run (from `site/`): `CI=true yarn test CreateChoreForm`
Expected: FAIL — no season checkbox exists.

- [ ] **Step 3: Write `MonthDayPicker`**

Create `site/src/components/MonthDayPicker.tsx`:

```tsx
import React from 'react';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

/**
 * Days offered for `month`. February offers 29 because a window boundary is a
 * month/day pair with no year - it has no leap year to be valid or invalid in.
 * This must match `MonthDay::days_in_month` in `src/availability.rs`.
 */
const daysInMonth = (month: number): number => {
  if (month === 2) return 29;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
};

interface MonthDayPickerProps {
  /** Human label, e.g. "Available from". Also drives the two select labels. */
  label: string;
  month: number;
  day: number;
  onChange: (month: number, day: number) => void;
  disabled?: boolean;
}

const selectClasses =
  'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500';

export const MonthDayPicker: React.FC<MonthDayPickerProps> = ({
  label,
  month,
  day,
  onChange,
  disabled = false,
}) => {
  const monthId = `${label.replace(/\s+/g, '-').toLowerCase()}-month`;
  const dayId = `${label.replace(/\s+/g, '-').toLowerCase()}-day`;

  const handleMonthChange = (nextMonth: number) => {
    // Clamp the day so switching from Mar 31 to February cannot leave an
    // impossible pair behind.
    onChange(nextMonth, Math.min(day, daysInMonth(nextMonth)));
  };

  return (
    <div>
      <div className="block text-sm font-medium text-gray-700 mb-1">{label}</div>
      <div className="flex gap-2">
        <select
          id={monthId}
          aria-label={`${label} month`}
          value={month}
          onChange={(e) => handleMonthChange(Number(e.target.value))}
          className={selectClasses}
          disabled={disabled}
        >
          {MONTHS.map((name, index) => (
            <option key={name} value={index + 1}>
              {name}
            </option>
          ))}
        </select>
        <select
          id={dayId}
          aria-label={`${label} day`}
          value={day}
          onChange={(e) => onChange(month, Number(e.target.value))}
          className={selectClasses}
          disabled={disabled}
        >
          {Array.from({ length: daysInMonth(month) }, (_, i) => i + 1).map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default MonthDayPicker;
```

- [ ] **Step 4: Add the availability section to `CreateChoreForm`**

Add imports:

```tsx
import MonthDayPicker from './MonthDayPicker';
```

Add state alongside the others:

```tsx
  const [seasonEnabled, setSeasonEnabled] = useState(false);
  const [startMonth, setStartMonth] = useState(9);
  const [startDay, setStartDay] = useState(1);
  const [endMonth, setEndMonth] = useState(6);
  const [endDay, setEndDay] = useState(15);
```

In the `useEffect` that seeds edit mode, after `setSelectedDays(...)`:

```tsx
      const window = initialChore.availabilityWindow;
      setSeasonEnabled(!!window);
      if (window) {
        setStartMonth(window.startMonth);
        setStartDay(window.startDay);
        setEndMonth(window.endMonth);
        setEndDay(window.endDay);
      }
```

In `handleSubmit`, add to `choreData`:

```tsx
        availabilityWindow: seasonEnabled
          ? { startMonth, startDay, endMonth, endDay }
          : null,
```

and in the non-edit reset block, add `setSeasonEnabled(false);`.

Render the section between "Required Days" and "Assign to Users":

```tsx
      <div>
        <label className="flex items-center space-x-2 cursor-pointer">
          <input
            type="checkbox"
            checked={seasonEnabled}
            onChange={(e) => setSeasonEnabled(e.target.checked)}
            className="rounded text-blue-600 focus:ring-blue-500"
            disabled={loading}
          />
          <span className="text-sm font-medium text-gray-700">
            Only available part of the year
          </span>
        </label>

        {seasonEnabled && (
          <div className="mt-3 space-y-3 border border-gray-200 rounded-md p-3">
            <MonthDayPicker
              label="Available from"
              month={startMonth}
              day={startDay}
              onChange={(month, day) => {
                setStartMonth(month);
                setStartDay(day);
              }}
              disabled={loading}
            />
            <MonthDayPicker
              label="Available until"
              month={endMonth}
              day={endDay}
              onChange={(month, day) => {
                setEndMonth(month);
                setEndDay(day);
              }}
              disabled={loading}
            />
            <p className="text-xs text-gray-500">
              Repeats every year. An end before the start wraps the new year — Sep 1 to Jun 15 is
              the school year.
            </p>
          </div>
        )}
      </div>
```

- [ ] **Step 5: Run to verify it passes**

Run (from `site/`): `CI=true yarn test CreateChoreForm`
Expected: PASS, 4 tests.

- [ ] **Step 6: Full suite, lint, build, commit**

```bash
cd site && CI=true yarn test && yarn lint && yarn build
cd .. && git add site/src/components/MonthDayPicker.tsx site/src/components/CreateChoreForm.tsx site/src/components/__tests__/CreateChoreForm.test.tsx
git commit -m "feat(site): let admins set a repeating availability window on a chore"
```

Expected total: **110** (106 + 4).

---

### Task 10: `getPendingTotals` service and GraphQL query

**Files:**
- Modify: `src/svc/chore_completion.rs` — `get_pending_totals`
- Modify: `src/models.rs` — `PendingTotal` GraphQL object
- Modify: `src/graphql.rs` — `get_pending_totals` query
- Test: `src/svc/chore_completion.rs` (tests module)

**Interfaces:**
- Consumes: nothing from Tasks 1-9. **This task is fully independent of Feature A.**
- Produces: `ChoreCompletionSvc::get_pending_totals(context) -> Result<Vec<(User, i32)>>`; GraphQL `getPendingTotals: [PendingTotal!]!` with `{ user, amountCents }`.

- [ ] **Step 1: Write the failing tests**

Add to the `tests` module in `src/svc/chore_completion.rs`:

```rust
/// Pending = completed but not paid out, regardless of approval. Approval is the
/// admin's gate on *payout*, not on whether the kid has done the work, so an
/// unapproved completion still shows in the kid's pending figure.
#[test]
fn pending_totals_count_unapproved_and_approved_but_not_paid_out() {
    let context = create_test_context();
    let admin = create_test_admin(&context, "Test Admin", "admin@test.com");
    let user = create_test_user(&context, "Test User");
    let chore = create_test_chore(
        &context,
        "Make bed",
        PaymentType::Daily,
        100,
        day_patterns::every_day(),
        admin.id.unwrap(),
    );

    // Unapproved.
    ChoreCompletionSvc::create(
        &context,
        &ChoreCompletionInput {
            uuid: None,
            chore_id: chore.id.unwrap(),
            user_id: user.id.unwrap(),
            completed_date: NaiveDate::from_ymd_opt(2026, 5, 4).unwrap(),
        },
    )
    .unwrap();

    // Approved but not paid out.
    let approved = ChoreCompletionSvc::create(
        &context,
        &ChoreCompletionInput {
            uuid: None,
            chore_id: chore.id.unwrap(),
            user_id: user.id.unwrap(),
            completed_date: NaiveDate::from_ymd_opt(2026, 5, 5).unwrap(),
        },
    )
    .unwrap();
    ChoreCompletionSvc::approve(&context, &approved.uuid, admin.id.unwrap()).unwrap();

    let totals = ChoreCompletionSvc::get_pending_totals(&context).unwrap();
    let (_, amount) = totals
        .iter()
        .find(|(u, _)| u.id == user.id)
        .expect("user has pending work");

    assert_eq!(*amount, 200, "both completions count");
}

#[test]
fn pending_totals_exclude_paid_out_completions() {
    let context = create_test_context();
    let admin = create_test_admin(&context, "Test Admin", "admin@test.com");
    let user = create_test_user(&context, "Test User");
    let chore = create_test_chore(
        &context,
        "Make bed",
        PaymentType::Daily,
        100,
        day_patterns::every_day(),
        admin.id.unwrap(),
    );

    let completion = ChoreCompletionSvc::create(
        &context,
        &ChoreCompletionInput {
            uuid: None,
            chore_id: chore.id.unwrap(),
            user_id: user.id.unwrap(),
            completed_date: NaiveDate::from_ymd_opt(2026, 5, 4).unwrap(),
        },
    )
    .unwrap();
    ChoreCompletionSvc::approve(&context, &completion.uuid, admin.id.unwrap()).unwrap();
    ChoreCompletionSvc::mark_as_paid(&context, Some(user.id.unwrap())).unwrap();

    let totals = ChoreCompletionSvc::get_pending_totals(&context).unwrap();
    let entry = totals.iter().find(|(u, _)| u.id == user.id);

    assert!(
        entry.is_none() || entry.unwrap().1 == 0,
        "paid-out money has moved to the YNAB balance and must not be counted twice"
    );
}

#[test]
fn pending_totals_keep_users_separate() {
    let context = create_test_context();
    let admin = create_test_admin(&context, "Test Admin", "admin@test.com");
    let alice = create_test_user(&context, "Alice");
    let bob = create_test_user(&context, "Bob");
    let chore = create_test_chore(
        &context,
        "Make bed",
        PaymentType::Daily,
        100,
        day_patterns::every_day(),
        admin.id.unwrap(),
    );

    for (user_id, count) in [(alice.id.unwrap(), 2), (bob.id.unwrap(), 1)] {
        for day in 0..count {
            ChoreCompletionSvc::create(
                &context,
                &ChoreCompletionInput {
                    uuid: None,
                    chore_id: chore.id.unwrap(),
                    user_id,
                    completed_date: NaiveDate::from_ymd_opt(2026, 5, 4 + day).unwrap(),
                },
            )
            .unwrap();
        }
    }

    let totals = ChoreCompletionSvc::get_pending_totals(&context).unwrap();
    assert_eq!(totals.iter().find(|(u, _)| u.id == alice.id).unwrap().1, 200);
    assert_eq!(totals.iter().find(|(u, _)| u.id == bob.id).unwrap().1, 100);
}

#[test]
fn pending_totals_omit_a_user_with_no_completions() {
    let context = create_test_context();
    let user = create_test_user(&context, "Idle User");

    let totals = ChoreCompletionSvc::get_pending_totals(&context).unwrap();
    assert!(
        totals.iter().all(|(u, _)| u.id != user.id),
        "a user with nothing pending is absent; the client reads that as zero"
    );
}
```

`mark_as_paid(context, user_id: Option<i32>)` is the real payout entry point (there is also a `mark_as_paid_batch`); `grep -n "pub fn mark_as_paid" src/svc/chore_completion.rs` to confirm before writing the second test.

- [ ] **Step 2: Run to verify it fails**

Run: `cargo test --lib pending_totals`
Expected: FAIL to compile — no `get_pending_totals`.

- [ ] **Step 3: Write the service function**

Add to `impl ChoreCompletionSvc`, next to `get_unpaid_totals`:

```rust
    /// Per-user totals of money earned but not yet received: every completion with
    /// `paid_out = false`, **regardless of approval status**.
    ///
    /// This is deliberately not `get_unpaid_totals`. That one is the payout screen's
    /// query - approved *and* unpaid, with a LEFT JOIN that keeps zero-owed users
    /// visible. This one answers the kid's "what have I earned so far" question, so
    /// work still awaiting an admin's approval counts.
    ///
    /// Paid-out completions are excluded because that money has already moved into
    /// the kid's YNAB balance, which the landing page shows alongside this figure -
    /// counting it in both places would double it. A user with nothing pending is
    /// absent from the result rather than present with a zero.
    pub fn get_pending_totals(context: &GraphQLContext) -> Result<Vec<(User, i32)>> {
        let results: Vec<(User, Option<i64>)> = chore_completions::table
            .inner_join(users::table)
            .filter(chore_completions::paid_out.eq(false))
            .group_by(users::id)
            .select((
                User::as_select(),
                diesel::dsl::sum(chore_completions::amount_cents).nullable(),
            ))
            .load(&mut get_conn(context)?)
            .context("Could not load pending totals")?;

        Ok(results
            .into_iter()
            .map(|(user, total)| (user, i32::try_from(total.unwrap_or(0)).unwrap_or(i32::MAX)))
            .collect())
    }
```

If Diesel rejects the `inner_join` direction, invert it to `users::table.inner_join(chore_completions::table)` — the `joinable!` declarations in `src/schema.rs` decide which way compiles.

- [ ] **Step 4: Add the GraphQL type and query**

In `src/models.rs`, next to `UnpaidTotal`:

```rust
/// A kid's earned-but-unpaid total, regardless of approval status. Distinct from
/// [`UnpaidTotal`], which is approved-and-unpaid and drives the payout screen.
#[derive(Debug, Clone)]
pub struct PendingTotal {
    pub user: User,
    pub amount_cents: i32,
}

#[juniper::graphql_object(context = GraphQLContext)]
impl PendingTotal {
    pub fn user(&self) -> &User {
        &self.user
    }
    pub fn amount_cents(&self) -> i32 {
        self.amount_cents
    }
}

impl PendingTotal {
    pub fn new(user: User, amount_cents: i32) -> Self {
        Self { user, amount_cents }
    }
}
```

In `src/graphql.rs`, add `PendingTotal` to the `models::{...}` import list and add the query next to `get_unpaid_totals`:

```rust
    pub fn get_pending_totals(context: &GraphQLContext) -> FieldResult<Vec<PendingTotal>> {
        let results = ChoreCompletionSvc::get_pending_totals(context)?;
        Ok(results
            .into_iter()
            .map(|(user, amount)| PendingTotal::new(user, amount))
            .collect())
    }
```

- [ ] **Step 5: Run to verify it passes**

Run: `cargo test`
Expected: PASS, **101** lib tests (97 + 4). The existing `get_unpaid_totals` tests must pass **unmodified** — if one needed editing, the payout path was disturbed and that is a bug.

- [ ] **Step 6: Verify the schema, baselines, format, commit**

```bash
cargo run &
sleep 5
curl -s localhost:7007/graphql -H 'content-type: application/json' \
  -d '{"query":"{ getPendingTotals { amountCents user { name } } }"}'
kill %1

cargo clippy --all-targets 2>&1 | grep -c '^warning'   # expect 10
rustfmt --edition 2024 src/svc/chore_completion.rs src/models.rs src/graphql.rs
cargo fmt --check 2>&1 | grep -c '^Diff'                # expect 11

git add src/svc/chore_completion.rs src/models.rs src/graphql.rs
git commit -m "feat(graphql): add getPendingTotals for earned-but-unpaid amounts"
```

---

### Task 11: Show pending amounts on the landing page

**Files:**
- Modify: `site/src/hooks/queries.ts` — `GET_PENDING_TOTALS`
- Create: `site/src/hooks/usePendingTotals.ts`
- Modify: `site/src/components/UserBalance.tsx`
- Modify: `site/src/components/UserSelector.tsx`
- Test: `site/src/components/__tests__/UserBalance.test.tsx` (create)

**Interfaces:**
- Consumes: `getPendingTotals` (Task 10).
- Produces: nothing consumed later.

- [ ] **Step 1: Write the failing tests**

Create `site/src/components/__tests__/UserBalance.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import UserBalance from '../UserBalance';

const balances = [{ name: 'Alice', balance: 12.5 }];

describe('UserBalance', () => {
  it('renders the YNAB balance in dollars', () => {
    render(<UserBalance name="Alice" balances={balances} />);
    expect(screen.getByText('$12.50')).toBeInTheDocument();
  });

  // The balance arrives from YNAB in whole dollars and the pending figure arrives
  // from our database in cents. This assertion fails loudly on a 100x mixup.
  it('renders pending cents in parentheses', () => {
    render(<UserBalance name="Alice" balances={balances} pendingCents={200} />);
    expect(screen.getByText('($2.00)')).toBeInTheDocument();
  });

  it('renders no pending line when nothing is pending', () => {
    render(<UserBalance name="Alice" balances={balances} pendingCents={0} />);
    expect(screen.queryByText(/\(\$/)).not.toBeInTheDocument();
  });

  it('renders no pending line when the figure is absent', () => {
    render(<UserBalance name="Alice" balances={balances} />);
    expect(screen.queryByText(/\(\$/)).not.toBeInTheDocument();
  });

  it('leaves the balance line unaffected by the pending figure', () => {
    render(<UserBalance name="Alice" balances={balances} pendingCents={200} />);
    expect(screen.getByText('$12.50')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run (from `site/`): `CI=true yarn test UserBalance`
Expected: FAIL — "($2.00)" is not rendered.

- [ ] **Step 3: Add the query and hook**

Append to `site/src/hooks/queries.ts`:

```ts
export const GET_PENDING_TOTALS = gql`
  query GetPendingTotals {
    getPendingTotals {
      amountCents
      user {
        id
      }
    }
  }
`;
```

Create `site/src/hooks/usePendingTotals.ts`:

```ts
import { useEffect, useMemo } from 'react';
import { useQuery } from '@apollo/client/react';
import { toast } from 'react-toastify';
import { GET_PENDING_TOTALS } from './queries';

interface PendingTotal {
  amountCents: number;
  user: { id: number };
}

interface PendingTotalsResponse {
  getPendingTotals: PendingTotal[];
}

/**
 * Per-user money earned but not yet paid out, in **cents**, keyed by user id.
 *
 * Note the contrast with `useBalances`, which returns YNAB spending money in
 * whole **dollars** keyed by **name**. The landing page shows both, so keep the
 * two straight.
 *
 * Polls every 30s - matching `useUserChores` - so a kid who completes a chore
 * sees the figure move without reloading.
 */
export const usePendingTotals = () => {
  const { data, error } = useQuery<PendingTotalsResponse>(GET_PENDING_TOTALS, {
    pollInterval: 30_000,
  });

  useEffect(() => {
    if (error) toast.error('Error loading pending totals');
  }, [error]);

  const pendingByUserId = useMemo(() => {
    const map = new Map<number, number>();
    (data?.getPendingTotals ?? []).forEach((total) => map.set(total.user.id, total.amountCents));
    return map;
  }, [data]);

  return { pendingByUserId };
};
```

- [ ] **Step 4: Render the pending line**

Replace the `UserBalance` component body in `site/src/components/UserBalance.tsx`:

```tsx
import { Balance } from 'types';
import { formatCurrency } from 'utils/dateUtils';

interface UserBalanceProps {
  name: string;
  balances: Balance[];
  /**
   * Money earned but not yet paid out, in **cents**.
   *
   * `balances` above are YNAB spending money in whole **dollars**, matched by
   * name; this is our own database's figure in cents, matched by user id. The two
   * use different formatters on purpose - do not merge them.
   */
  pendingCents?: number;
}

const formatBalance = (amount: number, currency = 'USD', locale = 'en-US') => {
  if (amount === 0) {
    return '-';
  }

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(amount);
};

export const UserBalance = (props: UserBalanceProps) => {
  const { name, balances, pendingCents } = props;
  if (!balances || balances.length === 0) {
    return null;
  }

  const userBalance = balances.find((balance) => balance.name === name) || { balance: 0 };

  return (
    <div className="mt-1">
      <div className="text-sm text-white">{formatBalance(userBalance.balance)}</div>
      {!!pendingCents && (
        <div className="text-xs text-yellow-400" title="Earned, awaiting payout">
          ({formatCurrency(pendingCents)})
        </div>
      )}
    </div>
  );
};

export default UserBalance;
```

- [ ] **Step 5: Wire it into `UserSelector`**

In `site/src/components/UserSelector.tsx`, add:

```tsx
import { usePendingTotals } from 'hooks/usePendingTotals';
```

then inside the component, next to `useBalances()`:

```tsx
  const { pendingByUserId } = usePendingTotals();
```

and pass it down — note the balance is looked up by **name** while pending is looked up by **id**:

```tsx
              <UserBalance
                name={user.name}
                balances={balances}
                pendingCents={pendingByUserId.get(user.id)}
              />
```

- [ ] **Step 6: Run to verify it passes**

Run (from `site/`): `CI=true yarn test`
Expected: PASS. Total **115** (110 + 5).

- [ ] **Step 7: Lint, build, commit**

```bash
cd site && yarn lint && yarn build
cd .. && git add site/src/hooks/queries.ts site/src/hooks/usePendingTotals.ts site/src/components/UserBalance.tsx site/src/components/UserSelector.tsx site/src/components/__tests__/UserBalance.test.tsx
git commit -m "feat(site): show each kid's pending unpaid earnings on the landing page"
```

---

### Task 12: Documentation and final verification

**Files:**
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: everything.
- Produces: nothing.

- [ ] **Step 1: Document the availability window**

Add to `CLAUDE.md`, immediately after the *Weekly Chore Payment Logic* section:

```markdown
## Chore Availability Windows

A chore may be limited to part of the calendar year, repeating annually — a
school-year chore runs Sep 1 → Jun 15. The window lives in two nullable
`chores` columns, `available_start` and `available_end`, MMDD-encoded as
`month * 100 + day` (Sep 1 = `901`). Both NULL means available year round;
exactly one set is an error. The window is **inclusive at both ends**, and an
end that sorts before the start wraps the new year.

`src/availability.rs` owns the encoding and the wrap-aware `contains` check;
`site/src/utils/availabilityWindow.ts` mirrors it for the client. **The two
test tables are deliberately identical — change one and you must change the
other.** `ChoreCompletionSvc::create` is the enforcement point; the weekly
grid's blanked cells and hidden rows are a UI affordance only.

A season never changes the weekly per-day rate — a week cut short by the
window simply pays less. See
`docs/superpowers/specs/2026-08-05-chore-availability-and-pending-totals-design.md`.
```

- [ ] **Step 2: Document the two totals queries**

Add to the *Key Conventions* section:

```markdown
**Two totals queries, easily confused**: `getUnpaidTotals` is
**approved and** unpaid — it drives the admin payout screen and keeps
zero-owed users visible. `getPendingTotals` is unpaid **regardless of
approval** — it drives the "earned so far" figure under each kid on the
landing page. Both are in cents; the YNAB `getBalances` figure beside them on
that page is in whole dollars, keyed by name rather than id.
```

- [ ] **Step 3: Run the full verification**

```bash
cargo test
cargo clippy --all-targets 2>&1 | grep -c '^warning'   # expect 10
cargo fmt --check 2>&1 | grep -c '^Diff'                # expect 11
cd site && CI=true yarn test && yarn lint && yarn build
```

Expected: 101 Rust lib tests, 115 frontend tests, clippy 10, fmt 11, both builds clean.

- [ ] **Step 4: Manual smoke test**

```bash
cargo run
```

Then in the browser at `localhost:7007`:
1. Chore Management → create a chore with the season Sep 1 – Jun 15 → the card shows `Available: Sep 1 – Jun 15`.
2. Click a kid's chip → the list narrows to their chores. Click **Unassigned** → only unassigned chores. Click **All** → everything returns.
3. Assign the seasonal chore to a kid, select that kid on the landing page, and navigate to a July week → the row is absent. Navigate to an October week → the row is present.
4. Complete a chore → the pending figure under the kid's photo rises within 30s.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: describe chore availability windows and the two totals queries"
```

---

## Self-review notes

**Spec coverage.** A1→T1, A2→T2, A3→T3, A4→T4, A5→T5+T6, A6→T7+T8, A7→T9, B1→T11, B2→T10, B3→T11, documentation→T12. All six listed invariants have a home: 1 in T2+T5, 2 in T4, 3 in T4's `weekly_rate_ignores_the_availability_window`, 4 in T7's `UserImage` default test, 5 in T11's `($2.00)` assertion, 6 in T10 Step 5 ("existing tests must pass unmodified").

**Deviation from the spec, recorded deliberately.** The spec's A3 described `ChoreInput` carrying raw `available_start` / `available_end`. The plan instead has Task 1 add those raw fields and Task 3 replace them on the *input* with the structured `AvailabilityWindowInput`, keeping the raw pair only on the `Chore` row struct. This keeps Task 1 shippable on its own while ending at the spec's intended GraphQL shape, and forces `From<ChoreInput>` to become `TryFrom` so an invalid month/day is rejected once, at the boundary.

**Storybook.** Not updated by any task. `site/src/stories/AdminChoreManagement.stories.tsx` and `ChoreCard.stories.tsx` render fixtures that will simply lack `availabilityWindow` and so render as year-round chores — correct, not broken. Adding seasonal variants is optional polish, deliberately left out to keep the branch focused.
