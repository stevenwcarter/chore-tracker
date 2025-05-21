-- Drop indexes
DROP INDEX IF EXISTS idx_chore_completion_notes_completion;
DROP INDEX IF EXISTS idx_chore_completions_paid_out;
DROP INDEX IF EXISTS idx_chore_completions_approved;
DROP INDEX IF EXISTS idx_chore_completions_user;
DROP INDEX IF EXISTS idx_chore_completions_date;
DROP INDEX IF EXISTS idx_chore_completions_uuid;
DROP INDEX IF EXISTS idx_chores_active;
DROP INDEX IF EXISTS idx_chores_uuid;
DROP INDEX IF EXISTS idx_admins_oidc_subject;
DROP INDEX IF EXISTS idx_admins_uuid;
DROP INDEX IF EXISTS idx_users_uuid;

-- Drop tables in reverse order of creation
DROP TABLE IF EXISTS chore_completion_notes;
DROP TABLE IF EXISTS chore_completions;
DROP TABLE IF EXISTS chore_assignments;
DROP TABLE IF EXISTS chores;
DROP TABLE IF EXISTS admins;
DROP TABLE IF EXISTS users;
