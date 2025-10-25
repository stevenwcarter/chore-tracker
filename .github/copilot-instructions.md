# GitHub Copilot Instructions for Chore Tracker

## Project Overview

This is a chore tracker application built with a Rust backend using Axum and Diesel, and a React TypeScript frontend using Vite. The application allows families to track children's chores, with admin approval workflows and payout tracking.

## Architecture

### Backend (Rust)

- **Framework**: Axum web framework
- **Database**: SQLite with Diesel ORM (migrations in `/migrations/`)
- **GraphQL**: Juniper for GraphQL API at `/graphql`
- **Authentication**: OIDC for admin accounts
- **Structure**:
  - `/src/main.rs` - Entry point
  - `/src/models.rs` - Database models and GraphQL objects
  - `/src/graphql.rs` - GraphQL schema and resolvers
  - `/src/svc/` - Business logic services
  - `/src/api/` - REST API routes (minimal, prefer GraphQL)

### Frontend (React TypeScript)

- **Location**: `/site/` directory
- **Build Tool**: Vite
- **Package Manager**: **Always use `yarn` commands** (not npm)
- **GraphQL Client**: Apollo Client
- **Styling**: Tailwind CSS
- **Router**: React Router
- **linting**: ESLint and Prettier, with eslint automatically applying prettier rules. Auto-fix on save is enabled, so if it is possible for you (copilot) to utilize that system while you are writing code, please do so.
- **Structure**:
  - `/site/src/components/` - Reusable components
  - `/site/src/page/` - Page components
  - `/site/src/types/` - TypeScript type definitions
  - `/site/src/queries.ts` - GraphQL queries

## Key Technical Guidelines

### GraphQL Field Naming Convention

- **Rust backend fields**: Use `snake_case` (e.g., `some_field`, `created_at`)
- **GraphQL queries**: Automatically converted to `camelCase` (e.g., `someField`, `createdAt`)
- **Boolean fields**: Do NOT prefix with `is` (use `active`, not `isActive`)

### Database

- Using SQLite stored at `./db/db.sqlite`
- Diesel migrations run automatically on startup
- All models use UUIDs for external references (the tool currently uses the integer IDs, but eventually this will change, so still add UUID fields)
- Foreign keys use integer IDs internally

### Testing Philosophy

- **When fixing bugs**: Always write a test first to reproduce the bug
- **After implementation**: Run tests to confirm everything works including the original issue
- Use Vitest for frontend tests
- Use standard Rust testing for backend

## Development Workflow

### Frontend Commands

```bash
cd site
yarn dev        # Start development server
yarn build      # Build for production
yarn test       # Run tests
yarn lint       # Run linting
```

### Backend Commands

```bash
cargo run       # Start development server
cargo test      # Run tests
cargo build     # Build for production
```

## Entity Relationships

### Core Models

- **Users**: Children who complete chores (no login, image-based selection)
- **Admins**: Parents who manage system (OIDC login required)
- **Chores**: Tasks with payment rules and day requirements
- **ChoreAssignments**: Many-to-many relationship between chores and users
- **ChoreCompletions**: Individual completion records with approval workflow
- **ChoreCompletionNotes**: Notes from users/admins on completions. Admins are able to mark some notes as only visible to other admins.

### Key Business Rules

- Users self-report completions → Admin approval required → Payout tracking
- Each completion stores historical amount (immutable)
- Chores can be daily (per-completion) or weekly (all days bonus) payment
- Admin notes can be hidden from users
- Payout system marks completions as paid without deleting data

## Authentication & Authorization

- **Users**: No authentication, selection via profile images
- **Admins**: OIDC authentication required
- **Permissions**: Only admins can create/modify chores, approve completions

## Frontend Patterns

### GraphQL Usage

```typescript
// Queries should match backend snake_case → camelCase conversion
const GET_CHORES = gql`
  query ListChores($userId: Int, $activeOnly: Boolean) {
    listChores(userId: $userId, activeOnly: $activeOnly) {
      id
      uuid
      name
      amountCents
      paymentType
      requiredDays
      assignedUsers {
        id
        name
      }
    }
  }
`;
```

**Note**: Ensure that you are using the query name within the `data` of `useQuery`, e.g., `data.listChores`.
**Note**: Most GraphQL handling should be written in a hook, located in `/site/src/hooks/`. See existing hooks for examples.

### Component Structure

- Use functional components with hooks
- Lazy load page components
- Implement loading states and error handling
- Use TypeScript interfaces from `/site/src/types/`

## Common Development Tasks

### Adding New Features

1. Update database schema (create migration)
2. Update Rust models in `src/models.rs`
3. Add service logic in `src/svc/`
4. Add GraphQL resolvers in `src/graphql.rs`
5. Update TypeScript types in `site/src/types/`
6. Create/update React components
7. Write tests for both frontend and backend

### Bug Fixing Process

1. **Write failing test** to reproduce the bug
2. Implement fix
3. **Run all tests** to ensure fix works and nothing breaks
4. Update documentation if needed

## File Organization

### When creating new files:

- **Backend services**: `/src/svc/{entity_name}.rs`
- **React components**: `/site/src/components/{ComponentName}.tsx`
- **React pages**: `/site/src/page/{PageName}.tsx`
- **Types**: `/site/src/types/{entity}.ts`
- **GraphQL queries**: Add to `/site/src/queries.ts` or component-specific files

### Naming Conventions

- **Rust files**: `snake_case.rs`
- **React components**: `PascalCase.tsx`
- **TypeScript files**: `camelCase.ts`
- **GraphQL operations**: `UPPER_SNAKE_CASE`

## Database Migrations

When modifying database schema:

1. Create new migration: `diesel migration generate {description}`
2. Edit both `up.sql` and `down.sql`
3. Test migration: `diesel migration run`, then `diesel migration revert`, then `diesel migration run` again to ensure reversibility
4. Update Rust models to match schema
5. Regenerate schema: `diesel print-schema > src/schema.rs`

## Performance Considerations

- Use database indexes for frequently queried fields
- Implement GraphQL field-level loading for relationships so the frontend can request only what it needs, and have access to nested data without N+1 queries
- Optimize bundle size with code splitting
- Use React.memo for expensive components/calculations

## Security Notes

- OIDC handles admin authentication
- No user authentication (family app assumption)
- Validate all inputs on backend
- Sanitize user-generated content (notes)
- Admin-only mutations protected by authentication

## Common Patterns

### Error Handling

```rust
// Backend: Use anyhow for error handling
pub fn some_operation(context: &GraphQLContext) -> anyhow::Result<T> {
    // Implementation
}

// Convert to GraphQL errors
graphql_translate_anyhow(result)
```

**Note**: Prefer importing functions rather than fully qualifying them, unless it can help to disambiguate, or provide clarity. As an example, importing `std::cmp` and then calling `cmp::min` is preferred over `std::cmp::min`, unless there is another `min` function in scope.

```typescript
// Frontend: Use Apollo error handling
const [createChore, { loading, error }] = useMutation(CREATE_CHORE);

if (error) {
  toast.error(`Error: ${error.message}`);
}
```

### Form Handling

- Use controlled components
- Validate on client and server
- Show loading states during submission
- Display success/error feedback with toast notifications

Remember: This is a family application with 3 users and 2 admins, so optimize for simplicity and usability over complex enterprise features.
