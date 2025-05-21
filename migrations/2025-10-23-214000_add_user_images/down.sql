-- Drop the index
DROP INDEX IF EXISTS idx_user_images_user_id;

-- Remove the image_id column from users
ALTER TABLE users DROP COLUMN IF EXISTS image_id;

-- Drop the user_images table
DROP TABLE IF EXISTS user_images;
