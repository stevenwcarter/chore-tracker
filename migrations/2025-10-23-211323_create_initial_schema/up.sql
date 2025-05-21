-- Users table (children who do chores)
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    image_path TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Admins table (parents who manage chores)
CREATE TABLE admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    oidc_subject TEXT NOT NULL UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Chores table
CREATE TABLE chores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    -- Payment type: 'daily' for per-completion, 'weekly' for weekly completion bonus
    payment_type TEXT NOT NULL CHECK (payment_type IN ('daily', 'weekly')),
    amount_cents INTEGER NOT NULL, -- Store as cents to avoid decimal issues
    -- Days of week as bitmask: Sunday=1, Monday=2, Tuesday=4, etc.
    required_days INTEGER NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT 1,
    created_by_admin_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by_admin_id) REFERENCES admins(id)
);

-- Junction table for chore assignments to users
CREATE TABLE chore_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chore_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chore_id) REFERENCES chores(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(chore_id, user_id)
);

-- Chore completions table
CREATE TABLE chore_completions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT NOT NULL UNIQUE,
    chore_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    completed_date DATE NOT NULL,
    amount_cents INTEGER NOT NULL, -- Historical amount at time of completion
    approved BOOLEAN NOT NULL DEFAULT 0,
    approved_by_admin_id INTEGER,
    approved_at DATETIME,
    paid_out BOOLEAN NOT NULL DEFAULT 0,
    paid_out_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chore_id) REFERENCES chores(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (approved_by_admin_id) REFERENCES admins(id)
);

-- Notes on chore completions
CREATE TABLE chore_completion_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT NOT NULL UNIQUE,
    chore_completion_id INTEGER NOT NULL,
    author_type TEXT NOT NULL CHECK (author_type IN ('user', 'admin')),
    author_user_id INTEGER,
    author_admin_id INTEGER,
    note_text TEXT NOT NULL,
    visible_to_user BOOLEAN NOT NULL DEFAULT 1, -- Admin notes can be hidden from users
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chore_completion_id) REFERENCES chore_completions(id) ON DELETE CASCADE,
    FOREIGN KEY (author_user_id) REFERENCES users(id),
    FOREIGN KEY (author_admin_id) REFERENCES admins(id),
    CHECK (
        (author_type = 'user' AND author_user_id IS NOT NULL AND author_admin_id IS NULL) OR
        (author_type = 'admin' AND author_admin_id IS NOT NULL AND author_user_id IS NULL)
    )
);

-- Create indexes for performance
CREATE INDEX idx_users_uuid ON users(uuid);
CREATE INDEX idx_admins_uuid ON admins(uuid);
CREATE INDEX idx_admins_oidc_subject ON admins(oidc_subject);
CREATE INDEX idx_chores_uuid ON chores(uuid);
CREATE INDEX idx_chores_active ON chores(active);
CREATE INDEX idx_chore_completions_uuid ON chore_completions(uuid);
CREATE INDEX idx_chore_completions_date ON chore_completions(completed_date);
CREATE INDEX idx_chore_completions_user ON chore_completions(user_id);
CREATE INDEX idx_chore_completions_approved ON chore_completions(approved);
CREATE INDEX idx_chore_completions_paid_out ON chore_completions(paid_out);
CREATE INDEX idx_chore_completion_notes_completion ON chore_completion_notes(chore_completion_id);
