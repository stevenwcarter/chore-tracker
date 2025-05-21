-- Add table for storing user images directly in the database
CREATE TABLE user_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    user_id INTEGER NOT NULL,
    image_data BLOB NOT NULL,
    content_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Update users table to add image_id reference
ALTER TABLE users ADD COLUMN image_id INTEGER REFERENCES user_images (id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX idx_user_images_user_id ON user_images (user_id);
