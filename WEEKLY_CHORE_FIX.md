# Weekly Chore Completion Fix Utility

This utility provides GraphQL mutations to fix existing weekly chore completion records that were created with the erroneous full payment amount before the fix was implemented.

## Available Mutations

### 1. `analyzeWeeklyCompletionAmounts`

**Purpose**: Analyze existing weekly chore completions to see which ones need fixing.

**GraphQL Query**:
```graphql
mutation {
  analyzeWeeklyCompletionAmounts
}
```

**Returns**: Array of arrays, where each inner array contains:
- `[0]`: `chore_id` (i32)
- `[1]`: `completion_count` (i32) - Number of completions for this chore
- `[2]`: `current_total_cents` (i32) - Current total amount being paid
- `[3]`: `expected_total_cents` (i32) - What the total should be after fix

**Example Response**:
```json
{
  "data": {
    "analyzeWeeklyCompletionAmounts": [
      [1, 6, 900, 300],  // Chore ID 1: 6 completions, currently paying 900¢, should pay 300¢
      [3, 4, 600, 200]   // Chore ID 3: 4 completions, currently paying 600¢, should pay 200¢
    ]
  }
}
```

### 2. `fixWeeklyCompletionAmounts`

**Purpose**: Fix all weekly chore completions to use the correct fractional payment amounts.

**GraphQL Mutation**:
```graphql
mutation {
  fixWeeklyCompletionAmounts
}
```

**Returns**: Number of records that were updated (i32)

**Example Response**:
```json
{
  "data": {
    "fixWeeklyCompletionAmounts": 27
  }
}
```

## Usage Workflow

1. **First, analyze what needs fixing**:
   ```graphql
   mutation {
     analyzeWeeklyCompletionAmounts
   }
   ```
   
   Review the results to understand the scope of changes.

2. **Apply the fix**:
   ```graphql
   mutation {
     fixWeeklyCompletionAmounts
   }
   ```
   
   This will update all affected records.

3. **Verify the fix** (optional):
   ```graphql
   mutation {
     analyzeWeeklyCompletionAmounts
   }
   ```
   
   After the fix, current and expected totals should match.

## How the Fix Works

For each weekly chore completion:

1. **Looks up the parent chore** to get:
   - `amount_cents`: Total weekly amount (e.g., 150¢)
   - `required_days`: Bitmask of assigned days (e.g., 21 = Mon+Wed+Fri = 3 days)

2. **Calculates the correct fractional amount**:
   - `fraction = amount_cents / number_of_assigned_days`
   - `corrected_amount = round_to_nearest_quarter(fraction)`
   - Example: 150¢ ÷ 3 days = 50¢ per day

3. **Updates the completion record** if the amount differs from the correct amount

## Example Scenario

**Before Fix**:
- Weekly chore worth 150¢ assigned to Mon/Wed/Fri (3 days)
- 6 completions recorded at 150¢ each = 900¢ total
- User is overpaid by 600¢

**After Fix**:
- Same 6 completions updated to 50¢ each = 300¢ total
- User receives correct proportional payment

## Security Note

These mutations currently have no authentication checks. In production, ensure these are only accessible to admin users.

## Logging

The fix function logs each update at INFO level:
```
Updated completion abc-123 for chore_id 1 from 150 to 50 cents
Weekly chore completion amount fix completed. Updated 27 records.
```