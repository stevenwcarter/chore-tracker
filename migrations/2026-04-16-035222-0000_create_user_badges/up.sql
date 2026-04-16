CREATE TABLE user_badges (
    id INTEGER PRIMARY KEY NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id),
    badge_type TEXT NOT NULL,
    earned_at TIMESTAMP NOT NULL,
    UNIQUE(user_id, badge_type)
);
